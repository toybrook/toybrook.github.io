// 26-1 홈 화면에 추가 · 오프라인 (the web build only: config.js OFFLINE). dist-web/sw.js keeps this version's files on the
// device, and every file the game fetched (a habitat's models once it was opened), so it opens without the internet.
// A newer version is fetched beside it and waits: a bar says so, and the game reloads only when the player taps it.
export async function initOffline() {
  const sw = navigator.serviceWorker; if (!sw) return;
  const had = !!sw.controller; // a worker opened this page: only then can an older build be on screen (deploy-4)
  const reg = await sw.register('sw.js').catch(() => null); if (!reg) return;
  // what this visit fetched before sw.js was in charge (the first visit): kept too. Again when the tab is left.
  const keep = () => sw.ready.then(r => r.active?.postMessage({ keep: performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin)) }));
  keep(); addEventListener('visibilitychange', () => { if (document.hidden) keep(); });
  const bar = () => {
    // the first visit: nothing older is on screen. Not sw.controller: clients.claim() turns it on mid-visit, so a second
    // install in that visit (deploy-3·4, just after a deploy) showed the bar over the newest build
    if (!had || document.getElementById('upd')) return;
    const el = document.createElement('div'); el.className = 'upd'; el.id = 'upd'; el.setAttribute('role', 'status');
    el.innerHTML = '새 버전이 있어요 · <button>새로 고침</button>'; document.getElementById('stage').append(el);
    el.querySelector('button').onclick = () => {
      if (!reg.waiting) return location.reload();
      sw.addEventListener('controllerchange', () => location.reload()); reg.waiting.postMessage('skip');
    };
  };
  if (reg.waiting) bar();
  reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') bar(); }); });
  // a tab left open for days: look for a new version when it comes back (at most once an hour)
  let last = Date.now();
  addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 3600e3) { last = Date.now(); reg.update().catch(() => {}); } });
}
