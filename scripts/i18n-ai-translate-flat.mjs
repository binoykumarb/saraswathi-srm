// scripts/i18n-ai-translate-flat.mjs
// Fills ONLY missing/empty keys in flat layout: <root>/i18n/<lang>.json
// Usage:
//   node scripts/i18n-ai-translate-flat.mjs \
//     --from en \
//     --to as,bn,gu,hi,kn,ml,mr,or,pa,sa,ta,te \
//     --localesDir i18n \
//     --provider google \
//     --project YOUR_GCP_PROJECT_ID [--dry]
//
// Setup:
//   npm i @google-cloud/translate
//   export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
//
// Notes:
// - Preserves i18next-style placeholders like {{name}} by masking before translate.
// - Won't overwrite existing non-empty translations.
// - Groups HTML vs plain text to set mimeType correctly.

import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------- arg parsing: supports --k=v and --k v ----------
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.split("=");
    const key = k.replace(/^--/, "");
    if (v !== undefined) {
      args[key] = v;
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
}

const FROM = (args.from || "en").toString();
const LOCALES_DIR = (args.localesDir || "i18n").toString();
const PROVIDER = (args.provider || "google").toString();
const PROJECT_ID = args.project;
const DRY = !!args.dry;
const TO = (args.to ? String(args.to) : "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- helpers ----------
const readJSON = (p) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
const writeJSON = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
};

function listLangs() {
  if (!fs.existsSync(LOCALES_DIR)) return [];
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"))
    .filter((lng) => lng !== FROM);
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function unflatten(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const parts = k.split(".");
    let cur = out;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) cur[p] = v;
      else cur = cur[p] ||= {};
    }
  }
  return out;
}

// mask {{placeholders}}
function maskPlaceholders(text) {
  const re = /\{\{\s*[^}]+\s*\}\}/g;
  const vars = [];
  const masked = String(text).replace(re, (m) => {
    const idx = vars.push(m) - 1;
    return `__VAR_${idx}__`;
  });
  return { masked, vars };
}
function unmaskPlaceholders(text, vars) {
  let out = String(text);
  vars.forEach((val, idx) => {
    const token = new RegExp(`__VAR_${idx}__`, "g");
    out = out.replace(token, val);
  });
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------- Google provider --------------
async function translateBatchGoogle({
  projectId,
  texts,
  source,
  target,
  mimeType = "text/plain",
}) {
  if (!projectId) throw new Error("Set --project <GCP_PROJECT_ID>");
  const { v3 } = await import("@google-cloud/translate");
  const client = new v3.TranslationServiceClient();
  const parent = `projects/${projectId}/locations/global`;
  const [resp] = await client.translateText({
    parent,
    contents: texts,
    mimeType,
    sourceLanguageCode: source,
    targetLanguageCode: target,
  });
  const translations = (resp.translations || []).map(
    (t) => t.translatedText || ""
  );
  return translations;
}

async function main() {
  if (PROVIDER !== "google") {
    throw new Error("This script currently implements --provider google only.");
  }

  // base english
  const basePath = path.join(LOCALES_DIR, `${FROM}.json`);
  const base = readJSON(basePath);
  if (!Object.keys(base).length)
    throw new Error(`Base file not found/empty: ${basePath}`);
  const baseFlat = flatten(base);

  const langs = TO.length ? TO : listLangs();
  if (!langs.length) {
    console.log("No target languages detected under", LOCALES_DIR);
    return;
  }

  for (const lng of langs) {
    const targetPath = path.join(LOCALES_DIR, `${lng}.json`);
    const current = readJSON(targetPath);
    const targetFlat = flatten(current);

    // gather missing/empty
    const plainItems = [];
    const htmlItems = [];
    const plainMeta = [];
    const htmlMeta = [];

    for (const [k, v] of Object.entries(baseFlat)) {
      const cur = targetFlat[k];
      const needs = cur === undefined || cur === "" || cur === null;
      if (!needs) continue;

      const sourceVal = v == null ? "" : String(v);
      if (!sourceVal.trim()) {
        targetFlat[k] = sourceVal;
        continue;
      }
      const isHtml = /<[^>]+>/.test(sourceVal);
      const { masked, vars } = maskPlaceholders(sourceVal);
      if (isHtml) {
        htmlItems.push(masked);
        htmlMeta.push({ key: k, vars });
      } else {
        plainItems.push(masked);
        plainMeta.push({ key: k, vars });
      }
    }

    const count = plainItems.length + htmlItems.length;
    if (!count) {
      console.log(`${lng}: nothing to translate`);
      continue;
    }
    if (DRY) {
      console.log(`${lng}: would translate ${count} keys`);
      continue;
    }

    // translate plain text in chunks
    const chunkSize = 100;
    for (let i = 0; i < plainItems.length; i += chunkSize) {
      const batch = plainItems.slice(i, i + chunkSize);
      const meta = plainMeta.slice(i, i + chunkSize);
      const results = await translateBatchGoogle({
        projectId: PROJECT_ID,
        texts: batch,
        source: FROM,
        target: lng,
        mimeType: "text/plain",
      });
      results.forEach((txt, j) => {
        const unmasked = unmaskPlaceholders(txt, meta[j].vars);
        targetFlat[meta[j].key] = unmasked;
      });
      await sleep(200);
    }

    // translate html in chunks
    for (let i = 0; i < htmlItems.length; i += chunkSize) {
      const batch = htmlItems.slice(i, i + chunkSize);
      const meta = htmlMeta.slice(i, i + chunkSize);
      const results = await translateBatchGoogle({
        projectId: PROJECT_ID,
        texts: batch,
        source: FROM,
        target: lng,
        mimeType: "text/html",
      });
      results.forEach((txt, j) => {
        const unmasked = unmaskPlaceholders(txt, meta[j].vars);
        targetFlat[meta[j].key] = unmasked;
      });
      await sleep(200);
    }

    // write back
    const merged = unflatten(targetFlat);
    writeJSON(targetPath, merged);
    console.log(`${lng}: translated ${count} keys`);
  }

  console.log("All done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
