// Auto-generated i18n sync script: fills missing keys across languages based on base language
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '..', 'assets/locales');
const NS_FILES = ['translation'];
const BASE = 'en';

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const deepAddMissing = (baseObj, targetObj) => {
  let added = 0;
  for (const k of Object.keys(baseObj)) {
    if (baseObj[k] && typeof baseObj[k] === 'object' && !Array.isArray(baseObj[k])) {
      targetObj[k] = targetObj[k] && typeof targetObj[k] === 'object' ? targetObj[k] : {};
      added += deepAddMissing(baseObj[k], targetObj[k]);
    } else if (!(k in targetObj)) {
      targetObj[k] = baseObj[k] || '';
      added++;
    }
  }
  return added;
};

const deepPruneExtras = (baseObj, targetObj) => {
  let removed = 0;
  for (const k of Object.keys(targetObj)) {
    if (!(k in baseObj)) {
      delete targetObj[k]; removed++;
    } else if (targetObj[k] && typeof targetObj[k] === 'object' && !Array.isArray(targetObj[k])) {
      removed += deepPruneExtras(baseObj[k], targetObj[k]);
      if (Object.keys(targetObj[k]).length === 0) delete targetObj[k];
    }
  }
  return removed;
};

const langs = fs.existsSync(LOCALES_DIR)
  ? fs.readdirSync(LOCALES_DIR).filter((f) => fs.statSync(path.join(LOCALES_DIR, f)).isDirectory())
  : [];

for (const ns of NS_FILES) {
  const basePath = path.join(LOCALES_DIR, BASE, ns + '.json');
  const base = readJson(basePath);

  let totalAdded = 0, totalRemoved = 0;
  for (const lng of langs) {
    if (lng === BASE) continue;
    const p = path.join(LOCALES_DIR, lng, ns + '.json');
    const current = readJson(p);
    const added = deepAddMissing(base, current);
    const removed = process.env.PRUNE_UNUSED === '1' ? deepPruneExtras(base, current) : 0;
    if (added || removed) writeJson(p, current);
    totalAdded += added; totalRemoved += removed;
    console.log('[' + ns + '] ' + lng + ': +' + added + (removed ? ', -' + removed : ''));
  }
  console.log('[' + ns + '] Done. Missing keys added: ' + totalAdded + (totalRemoved ? ' | Pruned: ' + totalRemoved : ''));
}
