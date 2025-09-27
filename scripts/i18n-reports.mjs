// scripts/i18n-report.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);

// defaults match your repo
const FROM = args.from || "en";
const LOCALES_DIR = args.localesDir || "assets/locales";
const NS = args.namespace || "translation";
const TO = (args.to ? String(args.to) : "").split(",").filter(Boolean);

const readJSON = (p) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};

const flatten = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

function listLangs() {
  if (!fs.existsSync(LOCALES_DIR)) return [];
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((d) => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory());
}

const basePath = path.join(LOCALES_DIR, FROM, `${NS}.json`);
const base = readJSON(basePath);
if (!Object.keys(base).length) {
  console.error(`Base file not found/empty: ${basePath}`);
  process.exit(1);
}
const baseFlat = flatten(base);

// figure targets
const langs = TO.length ? TO : listLangs().filter((l) => l !== FROM);

let totalMissing = 0;
for (const lng of langs) {
  const targetPath = path.join(LOCALES_DIR, lng, `${NS}.json`);
  const targetFlat = flatten(readJSON(targetPath));
  const missing = [];

  for (const [k, v] of Object.entries(baseFlat)) {
    const cur = targetFlat[k];
    if (cur === undefined || cur === "") missing.push(k);
  }

  totalMissing += missing.length;
  const label = missing.length ? `MISSING (${missing.length})` : "OK";
  console.log(`\n[${lng}] ${label}`);
  if (missing.length) missing.forEach((k) => console.log("  -", k));
}

if (!langs.length)
  console.log("No target languages detected under", LOCALES_DIR);
if (langs.length)
  console.log(
    `\nSummary: ${totalMissing} missing/blank keys across ${langs.length} locales.`
  );
