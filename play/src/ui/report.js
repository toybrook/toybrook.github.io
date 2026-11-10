// 27-4 문제 알리기. The latest 20 errors (window error, unhandled rejection) kept in this browser under their own key,
// apart from the save (so not in backups); nothing is sent anywhere. 설정 › 문제 알리기 copies a short text for the
// feedback form: version, device (OS, browser, screen), where the player is, the latest errors. No names, no save.
// main.js imports this first, so it listens before the rest of the game runs.
import { VERSION, PREFS } from '../config.js';
import { EDITION } from '../game/data.js';

const KEY = 'toyhabitat.errors', MAX = 20;
let list = []; try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch { /* broken or private mode: start empty */ }
let timer = 0; // an error every frame writes once a second, not 60 times
const keep = () => { timer ||= setTimeout(() => { timer = 0; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ } }, 1000); };
// where: the game's own path (src/ui/nest.js:170), never the site's address
const where = s => (String(s || '').match(/((?:src|vendor)\/[\w/.-]+\.js):(\d+)/) || []).slice(1).join(':');
export function note(msg, at = '') {
  const m = String(msg).replace(/^Uncaught /, '').replace(/\w+:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 160), last = list[list.length - 1];
  if (last && last.m === m && last.at === at) { last.n++; last.t = Date.now(); } // the same one again: counted
  else { list.push({ t: Date.now(), m, at, n: 1 }); if (list.length > MAX) list.shift(); }
  keep();
}
addEventListener('error', e => note(e.message, where(e.error?.stack) || where(`${e.filename}:${e.lineno}`)));
addEventListener('unhandledrejection', e => { const r = e.reason; note(r?.name ? `${r.name}: ${r.message}` : r, where(r?.stack)); });
export const errors = () => list.slice();

const ua = navigator.userAgent;
const BROWSERS = [['Edg', 'Edge'], ['SamsungBrowser', '삼성 인터넷'], ['Whale', '웨일'], ['CriOS', 'Chrome'], ['FxiOS', 'Firefox'], ['Firefox', 'Firefox'], ['Chrome', 'Chrome'], ['Version', 'Safari']];
const browser = () => { for (const [k, n] of BROWSERS) { const m = ua.match(new RegExp(k + '/(\\d+)')); if (m) return `${n} ${m[1]}`; } return '브라우저 모름'; };
const os = () => { const m = ua.match(/(iPhone|iPad)[^)]*OS (\d+)|Android (\d+)|Windows|Mac OS X|CrOS|Linux/); return !m ? '기기 모름' : m[1] ? `${m[1]} iOS ${m[2]}` : m[3] ? `Android ${m[3]}` : m[0].replace('Mac OS X', 'Mac').replace('CrOS', 'ChromeOS'); };
const day = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function reportText(place) {
  const last = list.slice(-5).reverse();
  return [`[토이브룩 문제 알림]`, `버전 ${VERSION} (${EDITION === 'beta' ? '베타' : EDITION})`,
    `기기 ${os()} · ${browser()} · 화면 ${innerWidth}×${innerHeight} ×${+devicePixelRatio.toFixed(2)}${matchMedia('(pointer:coarse)').matches ? ' · 터치' : ''} · 그래픽 ${({ low: '낮음', mid: '보통', high: '높음' })[PREFS.gfx] || PREFS.gfx}`,
    `있던 곳 ${place}`,
    list.length ? `최근 오류 ${list.length}개 중 ${last.length}개:` : '최근 오류 없음',
    ...last.map(e => `- ${day(e.t)} ${e.m}${e.at ? ` (${e.at})` : ''}${e.n > 1 ? ` ×${e.n}` : ''}`),
    '', '무슨 일이 있었는지 아래에 적어 주세요:', ''].join('\n');
}
// at the tap, before the form opens in a new tab (after that this page loses focus and the clipboard API refuses)
export function copyNow(text) {
  const t = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.append(t);
  t.select(); t.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* not allowed */ }
  t.remove();
  if (!ok && navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); ok = null; } // tried; can't say yet
  return ok;
}
