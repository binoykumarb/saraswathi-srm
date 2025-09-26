(function(){
  // Theme toggle (sun/moon)
  const key='pref-theme';
  const root=document.documentElement;
  function applyTheme(v){ root.setAttribute('data-theme', v); document.querySelectorAll('#themeToggle').forEach(b=> b.textContent = v==='moon' ? '☀️' : '🌙'); }
  let pref=localStorage.getItem(key)||'sun';
  applyTheme(pref);
  document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='themeToggle'){ pref = (pref==='sun'?'moon':'sun'); localStorage.setItem(key,pref); applyTheme(pref); }});

  // Active nav highlight (mobile-first multi-page)
  const path = location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (href.endsWith('/index.html') && path === href.replace(/index\.html$/, ''))) {
      a.classList.add('active');
    }
  });

  // Share helper (used on Feedback page)
  window.shareApp = () => {
    const url = location.origin + '/';
    if (navigator.share) navigator.share({ title: 'Saraswathi App', text: 'Explore Saraswathi stories & chants', url });
    else { navigator.clipboard.writeText(url); alert('Link copied!'); }
  };
})();