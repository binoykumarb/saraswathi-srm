// i18n dropdown runtime (Indian languages)
(function(){
  const I18N = {
    current: 'en',
    data: {},
    supported: [
      ['en','EN'], ['ta','தமிழ்'], ['te','తెలుగు'], ['hi','हिन्दी'],
      ['bn','বাংলা'], ['mr','मराठी'], ['gu','ગુજરાતી'], ['kn','ಕನ್ನಡ'],
      ['ml','മലയാളം'], ['or','ଓଡ଼ିଆ'], ['pa','ਪੰਜਾਬੀ'], ['as','অসমীয়া'], ['sa','संस्कृतम्']
    ],
    async load(lang){
      try {
        const res = await fetch('/i18n/' + lang + '.json', {cache:'no-store'});
        this.data = await res.json();
      } catch(e) {
        console.warn('i18n load failed for', lang, e);
        this.data = {};
      }
      this.current = lang;
      localStorage.setItem('lang', lang);
      document.documentElement.setAttribute('lang', lang);
      this.apply();
      const sel = document.getElementById('langSelect'); if (sel) sel.value = lang;
    },
    t(key, fallback){
      const segs = key.split('.'); let v = this.data;
      for (const s of segs){ if (v && s in v){ v = v[s]; } else { v = undefined; break; } }
      return (v===undefined || v===null || v==='') ? (fallback!==undefined?fallback:key) : v;
    },
    apply(root=document){
      root.querySelectorAll('[data-i18n]').forEach(el=>{
        const k = el.getAttribute('data-i18n'); el.textContent = this.t(k, el.textContent);
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
        const k = el.getAttribute('data-i18n-placeholder'); el.setAttribute('placeholder', this.t(k, el.getAttribute('placeholder')));
      });
      root.querySelectorAll('[data-i18n-html]').forEach(el=>{
        const k = el.getAttribute('data-i18n-html'); el.innerHTML = this.t(k, el.innerHTML);
      });
    }
  };
  window.I18N = I18N;

  document.addEventListener('DOMContentLoaded', async ()=>{
    const sel = document.getElementById('langSelect');
    if (sel && !sel.options.length) {
      I18N.supported.forEach(([code,label])=>{
        const opt = document.createElement('option');
        opt.value = code; opt.textContent = label;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', ()=> I18N.load(sel.value));
    }
    const nav = (navigator.language||'').toLowerCase();
    const pref = localStorage.getItem('lang') ||
      (nav.startsWith('ta')?'ta':nav.startsWith('te')?'te':nav.startsWith('hi')?'hi':
       nav.startsWith('bn')?'bn':nav.startsWith('mr')?'mr':nav.startsWith('gu')?'gu':
       nav.startsWith('kn')?'kn':nav.startsWith('ml')?'ml':nav.startsWith('or')?'or':
       nav.startsWith('pa')?'pa':nav.startsWith('as')?'as':nav.startsWith('sa')?'sa':'en');
    await I18N.load(pref);
  });
})();