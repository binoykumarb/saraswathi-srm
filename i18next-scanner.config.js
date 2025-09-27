// Auto-generated i18next-scanner config tailored to your repo
// Detected locales dir: assets/locales
// Detected languages: ['en', 'ta', 'hi', 'ml', 'kn', 'te']
// Detected namespaces: ['translation']

const path = require('path');

module.exports = {
  input: [
    '{**/*}.{{js,jsx,ts,tsx,html}}',
    '!**/node_modules/**',
    '!assets/locales/**'
  ],
  output: '.',
  options: {
    debug: false,
    lngs: ['en', 'ta', 'hi', 'ml', 'kn', 'te'],
    ns: ['translation'],
    defaultLng: 'en',
    defaultNs: 'translation',
    resource: {
      loadPath: 'assets/locales/{{lng}}/{{ns}}.json',
      savePath: 'assets/locales/{{lng}}/{{ns}}.json'
    },
    keySeparator: '.',
    nsSeparator: ':',
    defaultValue: (lng, ns, key) => (lng === 'en' ? key : ''),
    func: {
      list: ['t','i18next.t'],
      extensions: ['.js','.jsx','.ts','.tsx','.html']
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey'
    },
    removeUnusedKeys: false
  },
  transform: function(file, enc, done) {
    const content = file.contents.toString('utf8');
    const parser = this.parser;
    const path = require('path');
    const ext = path.extname(file.path).toLowerCase();

    parser.parseFuncFromString(content, { list: ['t','i18next.t'] });
    parser.parseTransFromString(content, { component: 'Trans', i18nKey: 'i18nKey' });

    if (ext === '.html') {
      const re = /data-i18n\s*=\s*["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(content))) {
        const item = m[1];
        const parts = item.split(';');
        for (const p of parts) {
          const key = p.trim().replace(/^\[[^\]]+\]/, '');
          if (key) parser.set(key);
        }
      }
    }
    done();
  }
};
