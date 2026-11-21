// 26-1 홈 화면에 추가 · 오프라인 (the web build only: config.js OFFLINE). dist-web/sw.js keeps this version's files on the
// device, and every file the game fetched (a habitat's models once it was opened), so it opens without the internet.
// A newer version is fetched beside it and waits: a bar says so, and the game reloads only when the player taps it.
// inbox 62: a phone keeps the app open for days (iOS home screen, a tab left open), so the check also runs whenever the page
// comes back (after 10 minutes since the last one). Opened afresh with a newer version waiting (or one found before the first
// tap), it reloads into it at once: one open is enough, not two.
import { $t } from '../i18n/i18n.js';
// 227 B stay: called once this page stays on this build (no newer one coming, or the band shown): main.js holds 돌아왔어요 till
// then, so a page about to reload into a newer build shows and marks nothing (it showed the older build's lines for seconds)
export async function initOffline(touched = () => true, stay = () => {}) {
  let told = false, going = false; const stayed = () => { if (!told && !going) { told = true; stay(); } };
  const sw = navigator.serviceWorker; if (!sw) return stayed();
  // a worker opened this page: only then can an older build be on screen (deploy-4). Read at the page's start (index.html):
  // by now a newer worker may have taken over the page it served (Chrome: just after a reload, below)
  const had = self.swAt ?? !!sw.controller;
  // updateViaCache none: sw.js itself is never taken from the HTTP cache (GitHub Pages says max-age=600)
  const reg = await sw.register('sw.js', { updateViaCache: 'none' }).catch(() => null); if (!reg) return stayed();
  // what this visit fetched before sw.js was in charge (the first visit): kept too. Again when the tab is left.
  const keep = () => sw.ready.then(r => r.active?.postMessage({ keep: performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin)) }));
  keep(); addEventListener('visibilitychange', () => { if (document.hidden) keep(); });
  // going: one reload, however many taps or controllerchange events
  const go = () => {
    if (going) return; going = true;
    if (!reg.waiting) return location.reload();
    // Chrome may hold the new worker back while this page is open (seen in about half the tries): then the reload comes back
    // under the old one, and the new one takes over once this page is gone: below, the reloaded page goes once more
    sw.addEventListener('controllerchange', () => location.reload(), { once: true }); reg.waiting.postMessage('skip'); setTimeout(() => location.reload(), 1500);
  };
  // the new worker took over a page of the older build: untouched, load the new one now; else the band. Chrome may hand the
  // page over while it loads (no controllerchange here): then this build's cache (index.html names it) is gone, or goes once
  // the new worker is done activating
  const mine = document.querySelector('meta[name=build]')?.content;
  let moved = false;
  const stale = async () => { if (had && mine && !(await caches.has(mine).catch(() => true))) moved = true; };
  await stale(); sw.controller?.addEventListener('statechange', e => { if (e.target.state === 'activated') stale().then(bar); });
  sw.addEventListener('controllerchange', () => { if (!had || going) return; moved = true; if (fresh()) { going = true; location.reload(); } else bar(); });
  // fresh: opened, nothing tapped yet (main.js counts from the page's start). A newer version then is taken at once (no reload
  // loop: not twice in a minute)
  const fresh = () => !touched();
  const soon = () => { try { return Date.now() - Number(sessionStorage.getItem('toyhabitat.sw' + (moved ? 'old' : 'go'))) < 60e3; } catch { return true; } };
  const bar = () => {
    // the first visit: nothing older is on screen. Not sw.controller: clients.claim() turns it on mid-visit, so a second
    // install in that visit (deploy-3·4, just after a deploy) showed the bar over the newest build
    if (going || !had || !(reg.waiting || moved)) return; // 227 B: going: a second call (two listeners on one worker) shows no band over the reload
    if (fresh() && !soon()) { try { sessionStorage.setItem('toyhabitat.sw' + (moved ? 'old' : 'go'), String(Date.now())); } catch { /* none */ } return go(); }
    stayed(); if (document.getElementById('upd')) return;
    const el = document.createElement('div'); el.className = 'upd'; el.id = 'upd'; el.setAttribute('role', 'status');
    el.innerHTML = $t('새 버전이 있어요 · <button>새로 고침</button>'); document.getElementById('stage').append(el);
    el.querySelector('button').onclick = go;
  };
  // 227 B: the browser looks for a newer sw.js on every open; asked here too (at most 10 s: a slow line; offline it fails at once. 3 s was too short: a busy start took 3.3 s) so one on its way is
  // seen before 돌아왔어요. One installing then: its end decides (installed: bar; failed: this build stays)
  const watch = w => w?.addEventListener('statechange', () => { if (w.state === 'installed') bar(); else if (w.state === 'redundant' && !reg.installing && !reg.waiting) stayed(); });
  reg.addEventListener('updatefound', () => watch(reg.installing));
  if (had && !reg.installing && !reg.waiting) await Promise.race([reg.update().catch(() => {}), new Promise(r => setTimeout(r, 10e3))]);
  watch(reg.installing); bar(); if (!had || !reg.installing) stayed();
  // back on screen (a tab or a home-screen app left for a while): look again, at most every 10 minutes
  let last = Date.now();
  const back = () => { stale().then(bar); if (Date.now() - last < 600e3) return; last = Date.now(); reg.update().then(bar, () => {}); };
  addEventListener('visibilitychange', () => { if (!document.hidden) back(); });
  addEventListener('pageshow', e => { if (e.persisted) back(); });
}
