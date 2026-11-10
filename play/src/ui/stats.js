// inbox 41 A 이용 통계 (Umami Cloud, EU, no cookies). Off = the script is never added, so no outside request at all: UMAMI_ID
// empty, 설정 › 이용 통계 보내기 끄기, the browser's Do Not Track, offline, or not on STATS_HOST (copies elsewhere, local tests).
// Only these, counted in this browser (toyhabitat.stats, apart from the save): start (a day), first_hatch and return_d1 (once
// ever), habitat_open (the habitat's name, a day each), attend (the day), error (120 characters + file:line, a day each).
// No names, mail, device id or save. The service worker leaves other hosts alone (dist-web/sw.js), so the script is never stored.
// report.js imports this before the game: nothing here may import the game.
import { UMAMI_ID, STATS_HOST, PREFS } from '../config.js';
import { dayOf } from '../game/clock.js';

const KEY = 'toyhabitat.stats', DAY = 86400000;
let st = {}; try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* private mode: counted for this visit only */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* full */ } };
export const allowed = () => !!UMAMI_ID && PREFS.stats !== false && location.hostname === STATS_HOST
  && navigator.doNotTrack !== '1' && window.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;
let tag = null, failed = false; const queue = []; // failed: not reached (blocked, no network): not asked again till the browser is back online
const send = (name, data) => { try { if (allowed()) window.umami?.track(name, data); } catch { /* the script's trouble, never the game's */ } };
function load() {
  if (tag || failed || !allowed() || !navigator.onLine) return;
  tag = Object.assign(document.createElement('script'), { src: 'https://cloud.umami.is/script.js', defer: true });
  Object.assign(tag.dataset, { websiteId: UMAMI_ID, autoTrack: 'false', doNotTrack: 'true', domains: STATS_HOST, excludeSearch: 'true', excludeHash: 'true' });
  tag.onload = () => { while (queue.length) send(...queue.shift()); };
  tag.onerror = () => { queue.length = 0; tag.remove(); tag = null; failed = true; }; // dropped
  document.head.append(tag);
}
addEventListener('online', () => { failed = false; load(); });
// key: once a day per key; the first call of a day clears the day's list
export function track(name, data, key = name) {
  if (!allowed()) return;
  const today = dayOf(Date.now()); if (st.day !== today) { st.day = today; st.sent = []; }
  if (st.sent.includes(key) || key.startsWith('error:') && st.sent.filter(k => k.startsWith('error:')).length >= 5) return; // errors: 5 kinds a day at most
  st.sent.push(key); keep();
  if (window.umami) send(name, data); else { queue.push([name, data]); load(); }
}
// once ever, marked even while off (turned on later, it is not sent late)
const once = (name, data) => { if (st[name]) return; st[name] = 1; keep(); track(name, data); };

// main.js, after the save is up. S: the game state (read only)
export function watch(G) {
  if (!st.t0) { st.t0 = G.S.stats.days > 1 ? 'old' : Date.now(); if (G.S.stats.hatch) st.first_hatch = 1; keep(); } // a player from before 0.71: no first or next day
  const tick = () => {
    const today = dayOf(Date.now());
    track('start');
    if (st.t0 !== 'old' && !st.return_d1 && today !== dayOf(st.t0)) { if (today === dayOf(st.t0 + DAY)) once('return_d1'); else { st.return_d1 = 1; keep(); } } // the next day only
    if (G.S.stats.hatch && !st.first_hatch) once('first_hatch');
  };
  tick(); G.on(tick);
}
