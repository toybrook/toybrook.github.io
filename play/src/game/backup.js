// inbox 21 내 저장 백업: the whole save as a code (TB1.<base64 of the JSON below>) or the same JSON as a .json file.
// { game, edition, v: schemaVersion, at, sum, save }; sum = FNV-1a of edition + save JSON (catches a cut-off or edited
// code, not a cheat guard). Moving a save, not sharing one: a code given to someone copies the animals (not blocked).
// No personal data: the save has none (settings are kept apart in toyhabitat.prefs and do not go in).
import { now } from './clock.js';

const GAME = 'toyhabitat', TAG = 'TB1.', MAX = 1e6; // MAX: characters; a full late save is ~30 KB

const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16); };
const b64 = s => { let t = ''; for (const b of new TextEncoder().encode(s)) t += String.fromCharCode(b); return btoa(t); };
const unb64 = s => new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));

export function pack(S, edition, at = now()) {
  const save = JSON.stringify(S);
  return JSON.stringify({ game: GAME, edition, v: S.schemaVersion, at, sum: fnv(edition + save), save: JSON.parse(save) });
}
export const toCode = (S, edition, at) => TAG + b64(pack(S, edition, at));

// inbox 39: iPhone·iPad Safari may clear a site's storage after 7 days without a visit; a home-screen web app is spared.
// dev: { ua, touch: maxTouchPoints, standalone }. iPadOS asks for the desktop site (a Macintosh UA) but has touch points.
// Safari only: Chrome·Firefox·Edge·Opera on iOS and in-app browsers (Kakao, Naver, Instagram…) name themselves in the UA.
export const iosSafariTab = ({ ua = '', touch = 0, standalone = false }) => (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1))
  && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|NAVER|KAKAOTALK|Instagram|FBAN|FBAV|Line\/|DaumApps|Whale/.test(ua) && !standalone;
export const homeHintDue = (dev, flags = {}) => iosSafariTab(dev) && !flags.homeHintSeen;
// inbox 64-A: Instagram·Threads(Barcelona)·Facebook·KakaoTalk·LINE in-app browsers keep their own storage, so the save stays behind there
export const inApp = (ua = '') => /Instagram|Barcelona|Threads|FBAN|FBAV|FB_IAB|KAKAOTALK|Line\/|DaumApps/.test(ua);
export const appHintDue = (dev, flags = {}) => inApp(dev.ua) && !flags.appHintSeen;

// text pasted or read from a file -> { save, at } or { err: what to tell the player }. newest: the game's SCHEMA_VERSION.
export function unpack(text, edition, newest) {
  text = String(text ?? '').trim();
  if (!text) return { err: '백업 코드를 붙여 넣거나 파일을 골라 주세요' };
  if (text.length > MAX) return { err: '너무 커서 백업이 아니에요' };
  let o;
  try { o = JSON.parse(text.startsWith(TAG) ? unb64(text.slice(TAG.length).replace(/\s+/g, '')) : text); }
  catch { return { err: text.startsWith(TAG) ? '코드가 손상됐어요 · 끝까지 다 복사됐는지 확인해 주세요' : '백업 코드가 아니에요' }; }
  if (!o || typeof o !== 'object' || o.game !== GAME) return { err: '다른 게임의 데이터예요' };
  if (!o.save || typeof o.save !== 'object' || o.sum !== fnv(o.edition + JSON.stringify(o.save))) return { err: '코드가 손상됐어요 · 끝까지 다 복사됐는지 확인해 주세요' };
  if ((o.edition || 'beta') !== edition) return { err: edition === 'release' ? '베타 데이터는 정식판으로 옮길 수 없어요.' : '정식판 데이터는 베타에서 열 수 없어요.' };
  if (!(o.save.schemaVersion >= 1)) return { err: '읽을 수 없는 백업이에요' };
  if (o.save.schemaVersion > newest) return { err: '더 새 버전에서 만든 백업이에요 · 페이지를 새로 고친 뒤 다시 해 주세요' };
  return { save: o.save, at: o.at };
}
