// scripts/i18n-ai-translate.mjs
// Fill missing translations using Google Cloud Translation (v3).
// Usage:
//   node scripts/i18n-ai-translate.mjs --from en --to ta,hi,ml,kn,te --localesDir assets/locales --namespace translation --provider google --project <GCP_PROJECT_ID> [--dry]
//
// Setup:
//   npm i @google-cloud/translate
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
//
// Notes:
// - Preserves i18next placeholders like {{name}} by masking before translate.
// - Won't overwrite non-empty existing translations.
// - Batch translates in chunks.

import fs from 'fs';
import path from 'path';
import process from 'process';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- CLI args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const FROM = args.from || 'en';
const TO = (args.to ? String(args.to) : '').split(',').filter(Boolean);
const LOCALES_DIR = args.localesDir || 'assets/locales';
const NS = args.namespace || 'translation';
const PROVIDER = args.provider || 'google';
const DRY = !!args.dry;
const PROJECT_ID = args.project;

// ---------- Helpers ----------
const readJSON = p => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJSON = (p, data) => {
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

function listLangs() {
  if (!fs.existsSync(LOCALES_DIR)) return [];
  return fs.readdirSync(LOCALES_DIR).filter(d => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory());
}

// Walk nested JSON flatten -> { "a.b.c": "..." }
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
// Unflatten back to nested object
function unflatten(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const parts = k.split('.');
    let cur = out;
    for (let i=0;i<parts.length;i++) {
      const p = parts[i];
      if (i === parts.length-1) cur[p] = v;
      else cur = (cur[p] ||= {});
    }
  }
  return out;
}

// Mask {{placeholders}} to __VAR_n__ before translate, then unmask.
function maskPlaceholders(text) {
  const re = /\{\{\s*[^}]+\s*\}\}/g;
  const vars = [];
  const masked = String(text).replace(re, (m) => {
    const idx = vars.push(m) - 1;
    return `__VAR_${idx}__`;
  });
  return {masked, vars};
}
function unmaskPlaceholders(text, vars) {
  let out = String(text);
  vars.forEach((val, idx) => {
    const token = new RegExp(`__VAR_${idx}__`, 'g');
    out = out.replace(token, val);
  });
  return out;
}

// ---------- Provider (Google) ----------
async function translateBatchGoogle({projectId, texts, source, target, mimeType='text/plain'}) {
  if (!projectId) throw new Error('Set --project <GCP_PROJECT_ID>');
  const {v3} = await import('@google-cloud/translate');
  const client = new v3.TranslationServiceClient();
  const parent = `projects/${projectId}/locations/global`;
  const [resp] = await client.translateText({
    parent,
    contents: texts,
    mimeType,
    sourceLanguageCode: source,
    targetLanguageCode: target
  });
  return (resp.translations || []).map(t => t.translatedText || '');
}

// Chunk an array
const chunk = (arr, size) => {
  const out = [];
  for (let i=0; i<arr.length; i+=size) out.push(arr.slice(i, i+size));
  return out;
};

// ---------- Main ----------
async function main() {
  if (PROVIDER !== 'google') {
    throw new Error('This script currently implements --provider google. If you want AWS/Azure, ask me and I\u2019ll generate that too.');
  }

  const langs = TO.length ? TO : listLangs().filter(l => l !== FROM);
  if (!langs.length) throw new Error('No target languages detected. Pass --to ta,hi,... or ensure locales folder exists.');

  const basePath = path.join(LOCALES_DIR, FROM, `${NS}.json`);
  const base = readJSON(basePath);
  if (!Object.keys(base).length) throw new Error(`Base file not found or empty: ${basePath}`);

  for (const lng of langs) {
    const targetPath = path.join(LOCALES_DIR, lng, `${NS}.json`);
    const target = readJSON(targetPath);

    // Flatten for easy diff
    const baseFlat = flatten(base);
    const targetFlat = flatten(target);

    // Identify missing or empty keys
    const toTranslate = [];
    const indexMap = []; // keep (key, vars, isHtml)
    for (const [k, v] of Object.entries(baseFlat)) {
      const cur = targetFlat[k];
      const needs = cur === undefined || cur === '' || cur === null;
      if (!needs) continue;

      const value = v == null ? '' : String(v);
      if (!value.trim()) { // don't translate empty source
        targetFlat[k] = value;
        continue;
      }

      // detect html-ish
      const isHtml = /<[^>]+>/.test(value);
      const {masked, vars} = maskPlaceholders(value);
      toTranslate.push(masked);
      indexMap.push({key: k, vars, isHtml});
    }

    if (!toTranslate.length) {
      console.log(`${lng}: nothing to translate`);
      continue;
    }

    console.log(`${lng}: translating ${toTranslate.length} keys...`);
    if (DRY) {
      indexMap.forEach((it, i) => console.log('  ', it.key));
      continue;
    }

    // Batch call google (100 per request is safe)
    let outIdx = 0;
    for (const batch of chunk(toTranslate, 100)) {
      const mimeType = indexMap[outIdx]?.isHtml ? 'text/html' : 'text/plain';
      const results = await translateBatchGoogle({
        projectId: PROJECT_ID,
        texts: batch,
        source: FROM,
        target: lng,
        mimeType
      });
      results.forEach((txt, j) => {
        const meta = indexMap[outIdx + j];
        const unmasked = unmaskPlaceholders(txt, meta.vars);
        targetFlat[meta.key] = unmasked;
      });
      outIdx += batch.length;
      // basic polite delay to avoid QPS spikes
      await new Promise(r => setTimeout(r, 200));
    }

    // Write back
    const merged = unflatten(targetFlat);
    writeJSON(targetPath, merged);
    console.log(`${lng}: done`);
  }

  console.log('All done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
