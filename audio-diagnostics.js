/* audio-diagnostics.js
 * Drop this <script> on the page (or open diagnostics.html) and click "Run Audio Diagnostics".
 * It will:
 *  1) Detect your playlist from i18next or window.I18N.data.stories.episodes (if present),
 *     else let you paste audio URLs (one per line).
 *  2) HEAD-check each file (status, Content-Type, Content-Length, Accept-Ranges, CORS).
 *  3) For each file, create an <audio>, check canPlayType(), wire events, and call play().
 *  4) Report reasons why "only the first audio plays" (common: 404 path, MIME wrong, CORS, iOS gesture, autoplay policy).
 *
 * References:
 * - HTMLMediaElement.play() returns a Promise (autoplay failures reject). MDN. 
 * - Autoplay policies & diagnosing failures. MDN.
 * - MediaError codes (e.g., MEDIA_ERR_SRC_NOT_SUPPORTED = 4). MDN.
 * - canPlayType() for MIME support tests. MDN.
 * - loadedmetadata/canplay/ended events. MDN.
 * - HTTP Range requests & Accept-Ranges for seeking. MDN.
 */

(function(){
  const UI = (() => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:999999;background:#111827;color:#f9fafb;border:1px solid #374151;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.3);max-height:70vh;display:flex;flex-direction:column;overflow:hidden;font:13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-label','Audio diagnostics');

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:10px 12px;background:#0b0c10;border-bottom:1px solid #374151';
    bar.innerHTML = '<strong>Audio Diagnostics</strong><span style="opacity:.7">— find why only the first track plays</span>';
    wrap.appendChild(bar);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px 12px;background:#0f1115;border-bottom:1px solid #374151;flex-wrap:wrap';
    controls.innerHTML = `
      <button id="ad-run" style="background:#22c55e;border:none;color:#0b0c10;padding:6px 10px;border-radius:8px;font-weight:700">Run Audio Diagnostics</button>
      <button id="ad-close" style="background:#e11d48;border:none;color:#fff;padding:6px 10px;border-radius:8px">Close</button>
      <label style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <input id="ad-autoplay" type="checkbox" checked>
        <span>Attempt play() (requires a click)</span>
      </label>
    `;
    wrap.appendChild(controls);

    const pasteBox = document.createElement('textarea');
    pasteBox.id = 'ad-input';
    pasteBox.placeholder = 'If your playlist is not detected, paste audio URLs here (one per line)…';
    pasteBox.style.cssText = 'display:block;width:100%;min-height:84px;background:#0b0c10;color:#e5e7eb;border:0;border-bottom:1px solid #374151;padding:8px 12px;resize:vertical';
    wrap.appendChild(pasteBox);

    const pre = document.createElement('pre');
    pre.id = 'ad-log';
    pre.style.cssText = 'margin:0;padding:12px;overflow:auto;flex:1;background:#0b0c10;white-space:pre-wrap;word-break:break-word';
    wrap.appendChild(pre);

    document.body.appendChild(wrap);
    return {
      wrap,
      log: (...args)=>{ pre.textContent += args.join(' ') + '\n'; pre.scrollTop = pre.scrollHeight; },
      setInput: (t)=> pasteBox.value = t || '',
      getInput: ()=> pasteBox.value,
      onRun: (fn)=> document.getElementById('ad-run').addEventListener('click', fn, {passive:true}),
      onClose: ()=> document.getElementById('ad-close').addEventListener('click', ()=> wrap.remove(), {passive:true}),
      autoplayChecked: ()=> document.getElementById('ad-autoplay').checked
    };
  })();

  function detectPlaylistFromI18n(){
    try {
      if (window.i18next && typeof window.i18next.t === 'function'){
        const arr = window.i18next.t('stories.episodes', { returnObjects: true });
        if (Array.isArray(arr) && arr.length){
          return normalize(arr);
        }
        const tmp=[];
        for (let i=0;i<50;i++){
          const title = window.i18next.t(`stories.episodes.${i}.title`);
          if (!title || title === `stories.episodes.${i}.title`) break;
          const audio = window.i18next.t(`stories.episodes.${i}.audio`, { defaultValue: '' });
          tmp.push({title, audio});
        }
        if (tmp.length) return normalize(tmp);
      }
    } catch(e){}
    try {
      if (window.I18N && window.I18N.data && window.I18N.data.stories && Array.isArray(window.I18N.data.stories.episodes)){
        return normalize(window.I18N.data.stories.episodes);
      }
    } catch(e){}
    return null;
  }

  function normalize(arr){
    return arr.map((it, idx)=>{
      const o = typeof it === 'string' ? { title: it, audio: guessAudio(idx+1) } : it;
      const id = o.id || idx+1;
      const title = o.title || `Episode ${id}`;
      const audio = o.audio || o.src || guessAudio(id);
      return { id, title, audio };
    });
  }

  function guessAudio(n){
    const n2 = String(n).padStart(2,'0');
    return `assets/audio/ep${n2}.mp3`;
  }

  function extToMimes(url){
    const u = url.split('?')[0].split('#')[0].toLowerCase();
    if (u.endsWith('.mp3'))  return ['audio/mpeg'];
    if (u.endsWith('.m4a'))  return ['audio/mp4', 'audio/aac'];
    if (u.endsWith('.aac'))  return ['audio/aac'];
    if (u.endsWith('.wav'))  return ['audio/wav', 'audio/x-wav'];
    if (u.endsWith('.ogg') || u.endsWith('.oga')) return ['audio/ogg; codecs=vorbis','audio/ogg'];
    if (u.endsWith('.webm')) return ['audio/webm; codecs=opus','audio/webm'];
    return ['audio/mpeg','audio/mp4','audio/ogg','audio/wav'];
  }

  async function headCheck(url){
    try {
      const res = await fetch(url, { method:'HEAD', mode:'cors' });
      return {
        ok: res.ok,
        status: res.status,
        ct: res.headers.get('Content-Type'),
        len: res.headers.get('Content-Length'),
        ranges: res.headers.get('Accept-Ranges'),
        acao: res.headers.get('Access-Control-Allow-Origin')
      };
    } catch (e){
      return { ok:false, status: 'FETCH_ERR', err: String(e) };
    }
  }

  function mediaErrorName(code){
    // MDN MediaError codes
    return ({1:'MEDIA_ERR_ABORTED',2:'MEDIA_ERR_NETWORK',3:'MEDIA_ERR_DECODE',4:'MEDIA_ERR_SRC_NOT_SUPPORTED'})[code] || String(code);
  }

  function playSupportReport(audio, url){
    const mimes = extToMimes(url);
    const support = mimes.map(mt => `${mt}: ${audio.canPlayType(mt) || '""'}`).join(' | ');
    return support;
  }

  async function testOne(url, tryPlay){
    const a = new Audio();
    a.preload = 'metadata';
    a.crossOrigin = 'anonymous'; // harmless if same-origin, useful if cross-origin has CORS
    a.src = url;

    const report = [];
    report.push(`URL: ${url}`);

    const head = await headCheck(url);
    report.push(`HEAD: ok=${head.ok} status=${head.status}` +
                (head.ct? ` content-type=${head.ct}` : '') +
                (head.len? ` length=${head.len}` : '') +
                (head.ranges? ` accept-ranges=${head.ranges}` : '') +
                (head.acao? ` ac-allow-origin=${head.acao}` : '') +
                (head.err? ` err=${head.err}` : ''));

    report.push(`canPlayType: ${playSupportReport(a, url)}`);

    // Attach event listeners
    const evLog = [];
    const on = (ev)=> a.addEventListener(ev, ()=> evLog.push(ev), { passive:true });
    ['loadstart','loadedmetadata','canplay','canplaythrough','playing','pause','stalled','suspend','ended','error'].forEach(on);

    // Try load metadata
    try { a.load(); } catch(e){}
    await new Promise(r => setTimeout(r, 500)); // give it a moment
    report.push(`readyState=${a.readyState} networkState=${a.networkState}`);

    // Try play (after click). Autoplay policies require gesture.
    if (tryPlay){
      try {
        await a.play();
        report.push('play(): OK (started)');
        await new Promise(r => setTimeout(r, 800)); // let it play briefly
        a.pause();
      } catch (e){
        report.push(`play(): REJECTED — ${e && (e.name + ': ' + (e.message||''))}`);
        report.push('Hint: Autoplay may be blocked until a user gesture, or Permissions-Policy: autoplay may disallow it.');
      }
    }

    // Check error
    const err = a.error;
    if (err){
      report.push(`MediaError: code=${err.code} (${mediaErrorName(err.code)})${err.message? ' message='+err.message : ''}`);
    }

    // Log events seen
    if (evLog.length) report.push(`events: ${evLog.join(', ')}`);

    // Quick heuristics
    if (!head.ok || (typeof head.status==='number' && head.status>=400)){
      report.push('DIAG: The file URL is not reachable (check path/filename or server routing).');
    }
    if (head.ct && /^text\/html/i.test(head.ct)){
      report.push('DIAG: Server returned text/html (possible 404 page) instead of audio MIME — check the file path.');
    }
    if (head.ct && !/^audio\//i.test(head.ct)){
      report.push('DIAG: Content-Type is not audio/* — configure correct MIME types on the server.');
    }
    if (!head.ranges || !/bytes/i.test(head.ranges||'')){
      report.push('NOTE: Accept-Ranges not advertised. Seeking may fail; some browsers expect byte-range support.');
    }
    if (err && err.code === 4){
      report.push('DIAG: Browser thinks the source is unsupported. Check encoding and MIME.');
    }
    if (evLog.includes('loadedmetadata') && !evLog.includes('canplay')){
      report.push('DIAG: Metadata loaded but cannot play — encoding/codec mismatch or server not sending full data.');
    }

    return report.join('\n');
  }

  function collectUrlsFromUI(){
    const raw = UI.getInput().trim();
    if (!raw) return [];
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  function uniq(arr){ return Array.from(new Set(arr)); }

  async function run(){
    UI.log('Detecting playlist…');
    let urls = [];
    const detected = detectPlaylistFromI18n();
    if (detected && detected.length){
      urls = detected.map(x => new URL(x.audio, location.href).href);
      UI.log(`Found ${urls.length} items in i18n playlist.`);
    } else {
      UI.log('No i18n playlist found. Paste audio URLs (one per line) and click Run.');
      urls = collectUrlsFromUI();
      if (!urls.length){
        UI.log('Nothing to test. Aborting.');
        return;
      }
    }
    urls = uniq(urls);
    const tryPlay = UI.autoplayChecked();
    UI.log(`Testing ${urls.length} audio file(s)…`);
    for (let i=0;i<urls.length;i++){
      UI.log(`\n#${i+1}/${urls.length}`);
      try {
        const out = await testOne(urls[i], tryPlay);
        UI.log(out);
      } catch (e){
        UI.log('Fatal error: ', e && (e.name+': '+(e.message||'')));
      }
    }
    UI.log('\nDone. Scroll to see details.');
  }

  // Prefill textarea with guessed list (if present on page)
  const guessed = detectPlaylistFromI18n();
  if (!guessed){
    // leave empty; user can paste
  } else {
    UI.setInput(guessed.map(x => new URL(x.audio, location.href).href).join('\n'));
  }

  UI.onRun(run);
  UI.onClose();
})();