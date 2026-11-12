// 16-2 특별한 하늘. Not the real sky: a sky that is hard to see for real (aurora, meteor showers) comes often, to everyone.
// All worked out on the device from the date (no place, nothing asked of a server). The real calendar only adds to it:
// the moon's real phase, and on a real meteor shower's peak night that shower comes for sure. A night = the evening of a
// local date to 05:00 the next morning (nightNo); the sky shows from 18:00 (an hour after the game's sunset, 17:00).
// The odds are BALANCE.sky (PACE.beta, 가안). 놓침 보장: no 유성우 or 오로라 seen for `miss` nights -> the next night has one.
// Seen = looked at in 하늘 보기 (ui/sky.js: the live sky, or last night again through the 하늘 망원경): each first one fills
// a 하늘 기록 slot (♥first). Named for 14차·15차: tonight(), nightNo(), seenNight().
import { BALANCE as B } from './data.js';

const DAY = 864e5, H = 36e5;
// a local night's number (days since 1970 of its evening's date); 00:00~04:59 still belongs to the night before
export const nightNo = t => { const d = new Date(t - 5 * H); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
const dateOf = n => new Date(n * DAY); // UTC fields = that night's local date
export const skyTime = h => h >= 18 || h < 5; // the hour (0..24) the special sky is up
export const hash = (...k) => { let h = 2166136261; for (const n of k) { h = Math.imul(h ^ n, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; } return (h >>> 0) / 4294967296; };

// the seven real showers, by their peak night (month, day; the evening of that date)
export const SHOWERS = [
  { id: 'qua', name: '사분의자리', m: 1, d: 3 }, { id: 'lyr', name: '거문고자리', m: 4, d: 22 }, { id: 'eta', name: '물병자리 에타', m: 5, d: 6 },
  { id: 'per', name: '페르세우스자리', m: 8, d: 12 }, { id: 'ori', name: '오리온자리', m: 10, d: 21 }, { id: 'leo', name: '사자자리', m: 11, d: 17 }, { id: 'gem', name: '쌍둥이자리', m: 12, d: 14 },
];
export const AURORAS = [{ id: 'green', name: '초록 오로라' }, { id: 'pink', name: '분홍 오로라' }, { id: 'violet', name: '보라 오로라' }, { id: 'red', name: '붉은 오로라' }];
export const STARS = [{ id: 'dipper', name: '북두칠성', season: '봄' }, { id: 'cygnus', name: '백조자리', season: '여름' }, { id: 'pegasus', name: '페가수스자리', season: '가을' }, { id: 'orion', name: '오리온자리', season: '겨울' }];
// the 하늘 기록: 18 slots
export const SLOTS = [...AURORAS.map(a => ({ id: 'au:' + a.id, name: a.name, icon: '🌌' })), ...SHOWERS.map(s => ({ id: 'me:' + s.id, name: s.name + ' 유성우', icon: '🌠' })),
  { id: 'comet', name: '혜성', icon: '☄️' }, { id: 'moon', name: '보름달', icon: '🌕' }, { id: 'bow2', name: '쌍무지개', icon: '🌈' }, ...STARS.map(s => ({ id: 'st:' + s.id, name: `${s.season} 별자리 · ${s.name}`, icon: '✨' }))];

const peakOf = n => { const d = dateOf(n); return SHOWERS.find(s => s.m === d.getUTCMonth() + 1 && s.d === d.getUTCDate()) ?? null; };
// a random shower is one in season: the last peak before the night or the next one after it (by the night's own roll)
function inSeason(n, r) {
  const y = dateOf(n).getUTCFullYear(), all = [-1, 0, 1].flatMap(k => SHOWERS.map(s => ({ s, n: Math.round(Date.UTC(y + k, s.m - 1, s.d) / DAY) })));
  const prev = all.filter(x => x.n <= n).sort((a, b) => b.n - a.n)[0].s, next = all.filter(x => x.n > n).sort((a, b) => a.n - b.n)[0].s;
  return r < 0.5 ? prev : next;
}
// the moon: its age (days) at the night's midnight, and the one night a month it is full (age within half a day of 14.77)
const SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
export const moonAge = n => (((n + 1) * DAY - NEW0) / DAY % SYN + SYN) % SYN;
export const fullMoon = n => Math.abs(moonAge(n) - SYN / 2) < 0.5;
export const moonName = n => { const a = moonAge(n); return fullMoon(n) ? '보름달' : a < 1.5 || a > SYN - 1.5 ? '그믐' : a < 7 ? '초승달' : a < 9 ? '상현달' : a < 14 ? '차오르는 달' : a < 22 ? '하현달 무렵' : '그믐달'; };
export const starOf = n => STARS[[3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][dateOf(n).getUTCMonth()]]; // 3~5 봄 6~8 여름 9~11 가을 12~2 겨울
export const bow2 = (dayNo, hab) => hash(dayNo, [...hab].reduce((h, c) => h * 31 + c.charCodeAt(0), 7), 9) < B.sky.bow2; // a day's rainbow is a double one (weather.js draws it)

// the night's own roll (the same on every device, every visit): { meteor: shower | null, peak, aurora: id | null, comet }
export function roll(n, hab) {
  const r = k => hash(n, k), P = B.sky, peak = peakOf(n);
  return { meteor: peak ?? (r(1) < P.meteor ? inSeason(n, r(2)) : null), peak: !!peak,
    aurora: r(3) < (hab === 'snow' ? P.auroraSnow : P.aurora) ? (r(4) < P.red ? 'red' : AURORAS[Math.floor(r(5) * 3)].id) : null, comet: r(6) < P.comet };
}
// the last night a 유성우 or 오로라 was seen before night n (none yet: the night before the save began)
const lastSeen = (S, n) => Math.max(nightNo(S.since ?? 0) - 1, ...S.sky.nights.filter(x => x < n));
// tonight's sky (n: a night number, default the one now) for a habitat, with 놓침 보장: { n, meteor, peak, aurora, comet, moon, full, star, sure, kept }
// sure: known ahead (a real peak or the 보장; the morning band says it), kept: the 보장 brought it
export function tonight(S, t, hab, n = nightNo(t)) {
  const o = roll(n, hab), kept = n - lastSeen(S, n) > B.sky.miss && !o.meteor && !o.aurora;
  if (kept) { if (hash(n, 7) < 0.5) o.meteor = inSeason(n, hash(n, 2)); else o.aurora = hash(n, 4) < B.sky.red ? 'red' : AURORAS[Math.floor(hash(n, 5) * 3)].id; }
  return { n, ...o, kept, sure: o.peak || kept, moon: moonAge(n), full: fullMoon(n), star: starOf(n) };
}
// the slots a night shows: what tonight() gave (bow: a double rainbow on screen, by day)
export const slotsOf = (T, bow = false) => bow ? ['bow2'] : [T.aurora && 'au:' + T.aurora, T.meteor && 'me:' + T.meteor.id, T.comet && 'comet', T.full && 'moon', 'st:' + T.star.id].filter(Boolean);

// S.sky: { nights: [night numbers a 유성우·오로라 was seen], got: { slot: at }, bits: 별 조각, told, ret: nights said already, scope: 1 given }
export const blank = () => ({ nights: [], got: {}, bits: 0 });
export function tidySky(S) {
  const V = S.sky && typeof S.sky === 'object' && !Array.isArray(S.sky) ? S.sky : blank(), int = v => Number.isInteger(v) ? v : undefined;
  S.sky = { nights: (Array.isArray(V.nights) ? V.nights : []).filter(Number.isInteger).slice(-8),
    got: Object.fromEntries(Object.entries(V.got && typeof V.got === 'object' ? V.got : {}).filter(([k, v]) => SLOTS.some(s => s.id === k) && Number.isFinite(v))),
    bits: Math.max(0, Math.floor(V.bits) || 0) }; // blank()'s key order (a save reads back byte for byte)
  for (const k of Object.keys(V)) if ((k === 'told' || k === 'ret') && int(V[k]) != null || k === 'scope' && V[k] === 1) S.sky[k] = V[k]; // in the save's own order
}
// seen (night n's sky, slots from slotsOf): its 유성우·오로라 counts for 놓침 보장; first slots fill (♥first each) -> { fresh: [slot], hearts }
export function seenNight(S, n, slots, now) {
  if (slots.some(k => k.startsWith('au:') || k.startsWith('me:')) && !S.sky.nights.includes(n)) S.sky.nights = [...S.sky.nights, n].sort((a, b) => a - b).slice(-8);
  const fresh = slots.filter(k => SLOTS.some(s => s.id === k) && !S.sky.got[k]);
  for (const k of fresh) S.sky.got[k] = now;
  const hearts = fresh.length * B.sky.first; S.hearts += hearts; return { fresh, hearts };
}
export const skyBit = S => ++S.sky.bits; // a falling star tapped: 별 조각 (kept for 14차·15차; nothing buys with it yet)
