
/**
 * i18n-scan.js
 * Scans .html files for data-i18n* attributes, ensures keys exist in i18n/en.json,
 * and backfills missing keys across all other language files with "" (to translate later).
 * Usage: node scripts/i18n-scan.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const I18N_DIR = path.join(ROOT, 'i18n');
const MASTER_FILE = path.join(I18N_DIR, 'en.json');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function setDeep(obj, dotKey, valueIfMissing="") {
  const parts = dotKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    if (i === parts.length - 1) {
      if (typeof cur[k] === 'undefined') cur[k] = valueIfMissing;
    } else {
      if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
  }
}

function collectKeysFromHTML(html) {
  const keys = new Set();
  const patterns = [
    /data-i18n=\"([^\"]+)\"/g,
    /data-i18n-html=\"([^\"]+)\"/g,
    /data-i18n-placeholder=\"([^\"]+)\"/g,
    /data-i18n-title=\"([^\"]+)\"/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) keys.add(m[1]);
  }
  return Array.from(keys);
}

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function sortKeys(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    const sorted = {};
    Object.keys(obj).sort().forEach(k => sorted[k] = sortKeys(obj[k]));
    return sorted;
  }
  return obj;
}

function main() {
  if (!fs.existsSync(I18N_DIR)) fs.mkdirSync(I18N_DIR);
  if (!fs.existsSync(MASTER_FILE)) fs.writeFileSync(MASTER_FILE, '{}');

  const files = walk(ROOT).filter(p => p.endsWith('.html'));
  const allKeys = new Set();
  for (const p of files) {
    const html = fs.readFileSync(p, 'utf8');
    collectKeysFromHTML(html).forEach(k => allKeys.add(k));
  }

  // Update master (en.json)
  const master = loadJSON(MASTER_FILE);
  const beforeMaster = JSON.stringify(master);
  for (const k of allKeys) setDeep(master, k, "");
  const sortedMaster = sortKeys(master);
  if (JSON.stringify(sortedMaster) !== beforeMaster) {
    saveJSON(MASTER_FILE, sortedMaster);
    console.log(`Updated master: ${MASTER_FILE}`);
  } else {
    console.log('Master up-to-date.');
  }

  // Update other languages
  const langs = fs.readdirSync(I18N_DIR).filter(n => n.endsWith('.json') && n !== 'en.json');
  for (const name of langs) {
    const p = path.join(I18N_DIR, name);
    const obj = loadJSON(p);
    const before = JSON.stringify(obj);
    for (const k of allKeys) setDeep(obj, k, "");
    const sorted = sortKeys(obj);
    if (JSON.stringify(sorted) !== before) {
      saveJSON(p, sorted);
      console.log(`Backfilled missing keys in ${name}`);
    }
  }

  console.log(`Scanned ${files.length} HTML files. Keys found: ${allKeys.size}`);
}

if (require.main === module) main();
