# i18n automation (auto-generated)

**Detected locales dir**: `assets/locales`  
**Languages**: en, ta, hi, ml, kn, te  
**Namespaces**: translation  
**Base language**: `en`

## Install dev dependency
```
npm i -D i18next-scanner
```

## Run
```
npm run i18n:extract   # scan code & HTML for keys (t(), <Trans/>, data-i18n)
npm run i18n:sync      # fill missing keys in all languages based on base language
npm run i18n           # both
```

> To prune extra keys that are no longer used, run:
```
PRUNE_UNUSED=1 npm run i18n:sync
```

Files added:
- `i18next-scanner.config.js`
- `scripts/i18n-sync.mjs`
- `package.json` (created)
