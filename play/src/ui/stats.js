// inbox 41 A 이용 통계 (Umami Cloud, EU, no cookies). Off = the script is never added, so no outside request at all: UMAMI_ID
// empty, 설정 › 이용 통계 보내기 끄기, the browser's Do Not Track, offline, or not on STATS_HOST (copies elsewhere, local tests).
// Only these, counted in this browser (toyhabitat.stats, apart from the save): start (a day), first_hatch and return_d1 (once
// ever), habitat_open (the habitat's name, a day each), attend (the day), error (120 characters + file:line, a day each; inbox 49: + the screen's width band, the habitat on screen, the GL context lost or not; 168: the game's version).
// inbox 51, for the release balance (docs/balance-data.md), bands only: buy (small/big/play, ♥0~49/50~99/100+), expand (habitat, step),
// level (each 5th), hearts_day (the last play day's hearts got and spent, 0/1~49/50~119/120+, sent the next day) and codex (cells
// in tens, a day), each with day: days since the game began (0~29, 30+), never a date or time. 25 a day at most, errors 5 more.
// inbox 54, the promotion funnel: start carries src (where the player came from, four ways only), play_1m/3m/10m (minutes on the
// game screen today, hidden time not counted, a day each), first_nest, first_decor, hatch_3 (the first day only, once ever).
// inbox 61 C: rate (love / ok / meh, the 「토이브룩 어때요?」 bar, a day at most).
/// 66-1 (inbox 66·68): first_drag (a friend carried, the first day), hatch_2 (the second hatch, within 2 min of the first or not, the
// first day), play_5m (with play_1m/3m: still here at 60/180/300 s), great_d1 (대만족 on the first day, sent the next day, in bands) and return_d7.
// 69-4: see_sent (a 구경 링크 or 구경 그림 sent) and see_open (one opened, to look at).
// 169: load (the first screen up, in time bands, with src) and d0_last (the first time away: where, and how long), the first day only, once ever.
// No names, mail, device id or save. The service worker leaves other hosts alone (dist-web/sw.js), so the script is never stored.
// report.js imports this before the game: nothing here may import the game.
import { UMAMI_ID, STATS_HOST, PREFS, TOSS } from '../config.js';
import { dayOf } from '../game/clock.js';
import { F170, TUT181 } from '../game/data.js'; // 170 A; 182 ②

const KEY = 'toyhabitat.stats', DAY = 86400000;
let st = {}; try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* private mode: counted for this visit only */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* full */ } };
// 174 앱인토스: no script there (no outside scripts): each event is one HTTPS POST to Umami's own endpoint (post), only inside the
// real Toss app: dist-toss's allowed() asks for operationalEnvironment 'toss' (not the sandbox, not a browser) in place of the
// host (tools/build-web.mjs toss()), the same events and the same off switches
export const allowed = () => !!UMAMI_ID && PREFS.stats !== false && location.hostname === STATS_HOST
  && navigator.doNotTrack !== '1' && window.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;
let tag = null, failed = false; const queue = []; // failed: not reached (blocked, no network): not asked again till the browser is back online
const post = (name, data) => fetch('https://gateway.umami.is/api/send', { method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'event', payload: { website: UMAMI_ID, hostname: 'toss.' + STATS_HOST, url: '/toss',
    language: navigator.language, screen: `${screen.width}x${screen.height}`, title: 'toybrook', referrer: '', name, data } }) }).catch(() => {});
const send = (name, data) => { try { if (allowed()) TOSS ? post(name, { ...data, lang: document.documentElement.lang || 'ko' }) : window.umami?.track(name, { ...data, lang: document.documentElement.lang || 'ko' }); } catch { /* the script's trouble, never the game's */ } };
function load() {
  if (TOSS) return; // 174: no script in Toss (post)
  if (tag || failed || !allowed() || !navigator.onLine) return;
  tag = Object.assign(document.createElement('script'), { src: 'https://cloud.umami.is/script.js', defer: true });
  Object.assign(tag.dataset, { websiteId: UMAMI_ID, autoTrack: 'false', doNotTrack: 'true', domains: STATS_HOST, excludeSearch: 'true', excludeHash: 'true' });
  tag.onload = () => { while (queue.length) send(...queue.shift()); };
  tag.onerror = () => { queue.length = 0; tag.remove(); tag = null; failed = true; }; // dropped
  document.head.append(tag);
}
addEventListener('online', () => { failed = false; load(); });
// key: once a day per key (a key ending in # is numbered: each one sent); the first call of a day clears the day's list
export function track(name, data, key = name) {
  if (!allowed()) return;
  const today = dayOf(Date.now()); if (st.day !== today) { st.day = today; st.sent = []; }
  if (key.endsWith('#')) key += st.sent.length;
  const err = key.startsWith('error:'); // errors: 5 kinds a day at most, the rest 25 (30 a device a day)
  if (st.sent.includes(key) || st.sent.filter(k => k.startsWith('error:') === err).length >= (err ? 5 : 25)) return;
  st.sent.push(key); keep();
  if (window.umami || TOSS) send(name, data); else { queue.push([name, data]); load(); }
}
// inbox 61 C: seconds on the game screen today; rateDay(): true the first time a day (the 「어때요?」 bar, kept even while off)
export const playedToday = () => st.pv?.day === dayOf(Date.now()) ? st.pv.s : 0;
// 92: the device's first day (a player from before 0.71: never)
export const firstDay = () => !!st.t0 && st.t0 !== 'old' && dayOf(Date.now()) === dayOf(st.t0);
export const rateDay = () => { const d = dayOf(Date.now()); if (st.rate === d) return false; st.rate = d; keep(); return true; };
// once ever, marked even while off (turned on later, it is not sent late)
const once = (name, data) => { if (st[name]) return; st[name] = 1; keep(); track(name, data); };

// inbox 54: threads / instagram / other / direct. The first screen's (site/config.js keeps it for this tab), else this page's referrer.
// Never the address itself.
const fromRef = r => { let h = ''; try { h = new URL(r).hostname; } catch { /* none */ }
  return !h || h === location.hostname ? 'direct' : /(^|\.)threads\.(net|com)$/.test(h) ? 'threads' : /(^|\.)instagram\.com$/.test(h) ? 'instagram' : 'other'; };
let src = null; try { src = sessionStorage.getItem('toyhabitat.src'); } catch { /* private mode */ }
src ||= fromRef(document.referrer);

// 169: the first screen up (main.js: the boot cover off), seconds from the page's start in bands. The device's first day, once ever
export function loaded() {
  if (st.load) return; st.load = 1; keep(); const s = performance.now() / 1000;
  if (firstDay()) track('load', { in: s < 2 ? '~2s' : s < 4 ? '~4s' : s < 8 ? '~8s' : '8s+', src });
}
// 169: what was on screen when the player left (read from the page, nothing of the game): loading / intro / egg (the first egg's
// 바로 깨기 or the nest sheet, a hatch going) / card (the hatch card) / decor / codex / pet (the habitat, a pet in the last 60 s) / habitat / other
const shown = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
function where(petAt) {
  if (F170 && shown('intro')) return 'intro'; // 170 A: the start cover stays under the intro card
  if (TUT181 && document.body.dataset.tut) return 'tut:' + document.body.dataset.tut; // 182 ②: the tutorial's step or decor cell (ui/tut181.js), no event of its own
  if (document.getElementById('boot') && !document.getElementById('boot').classList.contains('done')) return 'loading';
  if (shown('intro')) return 'intro';
  if (shown('nest')) return shown('ncard') ? 'card' : 'egg';
  if (document.querySelector('#loading .lfirst:not([hidden])')) return 'egg';
  if (shown('loading')) return 'loading';
  if (shown('decor')) return 'decor';
  if (shown('codex')) return 'codex';
  if (document.getElementById('habitat')?.classList.contains('hidden') !== false || document.querySelector('#habitat > section:not([hidden]), body > section.pop:not([hidden])')) return 'other';
  return Date.now() - petAt < 60e3 ? 'pet' : 'habitat';
}
// main.js, after the save is up. S: the game state (read only)
const noon = t => new Date(t).setHours(12, 0, 0, 0);
const hb = n => n < 1 ? '0' : n < 50 ? '1~49' : n < 120 ? '50~119' : '120+';
export function watch(G) {
  if (!st.t0) { st.t0 = G.S.stats.days > 1 ? 'old' : Date.now(); if (G.S.stats.hatch) st.first_hatch = 1; if (st.t0 !== 'old') st.g1 = 0; keep(); } // a player from before 0.71: no first or next day
  const day = (t = Date.now()) => { const d = Math.round((noon(t) - noon(G.S.since)) / DAY); return d >= 30 ? '30+' : Math.max(0, d); };
  let pets = G.S.stats.pet || 0, petAt = 0; // 169: the last pet (one that gave hearts: rules.js counts those)
  let h = G.S.hearts; // hearts got and spent are what this page saw them do (not across a backup put in)
  const tick = (ev = []) => {
    const today = dayOf(Date.now());
    if (st.hd?.day !== today) { if (st.hd?.d != null) track('hearts_day', { got: hb(st.hd.got), spent: hb(st.hd.spent), day: st.hd.d }); st.hd = { day: today, d: day(), got: 0, spent: 0 }; }
    if ((G.S.stats.pet || 0) > pets) petAt = Date.now(); pets = G.S.stats.pet || 0;
    const dh = G.S.hearts - h; h = G.S.hearts; if (dh) { st.hd[dh > 0 ? 'got' : 'spent'] += Math.abs(dh); keep(); }
    track('start', { src });
    track('codex', { cells: Math.floor(Object.keys(G.S.codex).length / 10) * 10, day: day() });
    for (const e of ev) {
      if (e.type === 'guest' && e.what === 'great' && st.t0 !== 'old' && today === dayOf(st.t0)) { st.g1 = (st.g1 || 0) + 1; keep(); } // 66-1
      if (e.type === 'buy') track('buy', { kind: e.kind, price: e.price < 50 ? '0~49' : e.price < 100 ? '50~99' : '100+', day: day() }, 'buy#');
      if (e.type === 'expand') track('expand', { habitat: e.habitat, step: e.level, day: day() }, 'expand:' + e.habitat + e.level);
      if (e.type === 'level') for (let L = Math.floor(e.from / 5 + 1) * 5; L <= e.level; L += 5) track('level', { level: L, day: day() }, 'level' + L);
    }
    if (st.t0 !== 'old' && !st.return_d1 && today !== dayOf(st.t0)) { if (today === dayOf(st.t0 + DAY)) once('return_d1'); else { st.return_d1 = 1; keep(); } } // the next day only
    if (G.S.stats.hatch && !st.first_hatch) { once('first_hatch'); st.h1 = Date.now(); keep(); }
    if (st.t0 !== 'old' && !st.return_d7 && today !== dayOf(st.t0) && today !== dayOf(st.t0 + DAY)) { if ([6, 7, 8].some(k => today === dayOf(st.t0 + k * DAY))) { st.return_d7 = 1; keep(); track('return_d7'); } } // 66-1: back on day 7 (the 6th~8th day after, a day's slack each side)
    if (st.t0 !== 'old' && st.g1 != null && !st.g1s && today !== dayOf(st.t0)) { st.g1s = 1; keep(); track('great_d1', { n: st.g1 >= 6 ? '6+' : st.g1 >= 3 ? '3~5' : String(st.g1) }); }
    // inbox 54: the first day only; once ever, marked even when nothing went (a later day, or off)
    const first = (name, done) => { if (!done || st[name]) return; st[name] = 1; keep(); if (TUT181 && (name === 'first_nest' || name === 'first_pet')) return; /* 182 ②: tut:nest·tut:pet count those */ if (st.t0 !== 'old' && today === dayOf(st.t0)) track(name); };
    first('first_nest', G.S.flags.nestTapped); first('first_decor', G.S.props.some(p => p.placed && !p.nat)); first('hatch_3', G.S.stats.hatch >= 3);
    first('first_drag', G.S.flags.carried); // 66-1
    first('first_pet', G.S.stats.pet > 0); // 92-3
    for (let k = 1; k <= 3; k++) if (G.S.stats.hatch >= k && !st['fw_egg' + k]) { st['fw_egg' + k] = 1; keep(); const s = (Date.now() - st.t0) / 1000; if (firstDay()) track('fw_egg' + k, { in: s < 30 ? '30초 안' : s < 60 ? '1분 안' : s < 180 ? '3분 안' : '3분 넘게' }); } // 92-1: from the first visit
    if (G.S.stats.hatch >= 2 && !st.hatch_2) { st.hatch_2 = 1; keep(); if (st.t0 !== 'old' && today === dayOf(st.t0) && st.h1) track('hatch_2', { in: Date.now() - st.h1 <= 120e3 ? '2분 안' : '2분 넘게' }); }
  };
  tick(); G.on(tick);
  // 169: the first time the page is hidden or closed, marked even when not sent (a later day, or off); not reached: dropped
  const left = e => {
    if (st.d0 || e.type === 'visibilitychange' && !document.hidden) return; st.d0 = 1; keep(); const s = performance.now() / 1000;
    if (firstDay()) track('d0_last', { at: where(petAt), s: s < 30 ? '~30s' : s < 60 ? '~1m' : s < 180 ? '~3m' : s < 300 ? '~5m' : '5m+' });
  };
  addEventListener('visibilitychange', left); addEventListener('pagehide', left);
  // inbox 54: time on the game screen today (hidden or asleep not counted: a gap over 10 s counts 10 s)
  let last = Date.now();
  addEventListener('visibilitychange', () => { last = Date.now(); });
  setInterval(() => {
    const t = Date.now(), dt = Math.min(t - last, 10000), today = dayOf(t); last = t;
    if (document.hidden) return;
    if (st.pv?.day !== today) st.pv = { day: today, s: 0 };
    st.pv.s += dt / 1000; keep();
    for (const m of [1, 3, 5, 10]) if (st.pv.s >= m * 60) track(`play_${m}m`, { day: day() });
  }, 5000);
}
