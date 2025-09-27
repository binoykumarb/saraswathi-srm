// scripts/i18n-report.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse args: supports --k=v and --k v
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

// Defaults for your repo
const FROM = (args.from || "en").toString();
const LOCALES_DIR = (args.localesDir || "i18n").toString(); // <root>/i18n/<lang>.json
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

// Discover languages from i18n/*.json (excluding base)
function listLangs() {
  if (!fs.existsSync(LOCALES_DIR)) return [];
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"))
    .filter((lng) => lng !== FROM);
}

// Load base (English) and flatten
const basePath = path.join(LOCALES_DIR, `${FROM}.json`);
const base = readJSON(basePath);
if (!Object.keys(base).length) {
  console.error(`Base file not found/empty: ${basePath}`);
  process.exit(1);
}
const baseFlat = flatten(base);

// Targets
const langs = TO.length ? TO : listLangs();
if (!langs.length) {
  console.log("No target languages detected under", LOCALES_DIR);
  process.exit(0);
}

// Report
let totalMissing = 0;
for (const lng of langs) {
  const targetPath = path.join(LOCALES_DIR, `${lng}.json`);
  const targetFlat = flatten(readJSON(targetPath));
  const missing = [];

  for (const [k] of Object.entries(baseFlat)) {
    const cur = targetFlat[k];
    if (cur === undefined || cur === "") missing.push(k);
  }

  totalMissing += missing.length;
  const label = missing.length ? `MISSING (${missing.length})` : "OK";
  console.log(`\n[${lng}] ${label}`);
  if (missing.length) missing.forEach((k) => console.log("  -", k));
}

console.log(
  `\nSummary: ${totalMissing} missing/blank keys across ${langs.length} locales.`
);
