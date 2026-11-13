// 17-3 정원이 숨 쉬어요. The garden changes a little each day by itself (no score, no cost, no penalty, nothing to do):
// - where the animals walk most the grass wears into a faint trail, and grows back some days after they stop going there
//   (꾸미기 땅 칠하기 「진짜 길로 굳히기」 paints it as a real path)
// - sprouts come up round the flowers (a seed carried along a trail lands further) and bloom two days later; two colours
//   side by side give a third by the MIX table (fixed, never random); each colour's first bloom goes in the 들꽃 도감
// - moss and then small mushrooms in the shade of the big trees and props; reeds along the water's edge, lilies on the pond
// The board (habitat.js) finds where each may grow (ground: never on paint, props, rails, the board's own path, the water's way
// in) and counts the animals' steps (walk). The days are stepped here, the same every time: by the cell and the day, no rng.
// S.wild: { d: the last day stepped (day number), book: { colour: the day it first bloomed }, news: [{ k, hab, at, c, sp, n }]
//   (돌아왔어요, till seen), h: { hab: H } }
// H: { c: { f, s, e, w }: the cells where flowers, moss (shade), reeds (the water's edge), lilies (water) may grow; src: [[cell,
//   colour]] the flowers there already; g: { cell: [kind f|m|u|r|l, colour, day] } what has grown; t: { cell: steps } and n:
//   { species: steps } not yet counted (they wait till WILD.min of them make a walked day: a day the app was shut changes no way,
//   the animals keep their habits); p: { cell: steps } the walked days' steps, the older fewer (WILD.decay a walked day); q: the
//   walked days; tr: [cell] the trails (from WILD.trail times the average cell, kept till under WILD.stay); sp: who walks the
//   most; pn: 1 the trail told; fl: { kind: 1 } its first told; a: the first day stepped; v: a version (the board draws again) }
import { SP, HAB } from './rules.js';
import { dayNo } from './clock.js';

export const WILD = { days: 40, cap: { f: 48, m: 30, u: 14, r: 24, l: 16, t: 90 }, keep: { f: 300, s: 60, e: 80, w: 50, src: 80, t: 600, p: 300 },
  decay: 0.85, trail: 2.5, stay: 1.5, min: 300, q: 2, every: 3, bud: 2, news: 12 };
// the 들꽃 colours: petal, middle; from: where one of the first ones grows (the 도감's hint)
export const BLOOMS = { wh: { name: '하양', c: ['#ffffff', '#ffcf33'], from: '들꽃 무리' }, ye: { name: '노랑', c: ['#ffd447', '#f08a24'], from: '들꽃 무리·해바라기' },
  rd: { name: '빨강', c: ['#ff6b6b', '#ffd447'], from: '튤립 화분' }, pu: { name: '보라', c: ['#9d86e8', '#fff1a8'], from: '들꽃 무리' },
  pk: { name: '분홍', c: ['#f7a8c4', '#ffe066'] }, lv: { name: '연보라', c: ['#b9a0f2', '#ffd447'] }, or: { name: '주황', c: ['#ffa04a', '#ffe066'] },
  cr: { name: '크림', c: ['#fff0b3', '#f0a830'] }, ap: { name: '살구', c: ['#ffbf9a', '#ffe066'] }, mg: { name: '자주', c: ['#d65fa8', '#ffe9a8'] },
  sk: { name: '하늘', c: ['#a9d4f5', '#ffe066'] } };
export const MIX = { 'rd+wh': 'pk', 'rd+ye': 'or', 'wh+ye': 'cr', 'pu+wh': 'lv', 'pk+ye': 'ap', 'pu+rd': 'mg', 'lv+wh': 'sk' };
export const mixOf = (a, b) => a === b ? a : MIX[[a, b].sort().join('+')] ?? null;
export const recipe = c => Object.keys(MIX).find(k => MIX[k] === c)?.split('+'); // ['rd', 'wh'] for pk
// the colour of a flower already on the board: a 들꽃 무리 by its flowerPal (props.js), a prop by what it holds
const NATIVE = ['wh', 'wh', 'lv', 'pk', 'ye', 'pu'], BED = ['pk', 'ye', 'wh'];
export const colOf = (prop, v, uid) => prop === 'wildflowers' ? NATIVE[((v | 0) % 6 + 6) % 6] : prop === 'tulips' ? 'rd' : prop === 'att_sunflower' ? 'ye'
  : prop === 'flowers' || prop === 'flowermound' ? BED[hash(String(uid)) % 3] : null;

export const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const ij = k => k.split(',').map(Number), far = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); // cells apart (a square ring)
const CELL = /^-?\d{1,4},-?\d{1,4}$/, KINDS = 'fmurl', isObj = v => !!v && typeof v === 'object' && !Array.isArray(v), num = v => Number.isFinite(v) && v >= 0;
const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));

export const blank = () => ({ d: 0, book: {}, news: [], h: {} });
const blankH = () => ({ c: { f: [], s: [], e: [], w: [] }, src: [], g: {}, t: {}, n: {}, p: {}, q: 0, tr: [], sp: '', pn: 0, fl: {}, a: null, v: 0 });
const cells = (a, n) => [...new Set((Array.isArray(a) ? a : []).filter(k => typeof k === 'string' && CELL.test(k)))].slice(0, n);
const heat = (o, n) => top(Object.fromEntries(Object.entries(isObj(o) ? o : {}).filter(([k, v]) => CELL.test(k) && num(v)).map(([k, v]) => [k, +v.toFixed(2)])), n);
function tidyH(H) {
  const c = isObj(H.c) ? H.c : {}, K = WILD.keep;
  return { c: { f: cells(c.f, K.f), s: cells(c.s, K.s), e: cells(c.e, K.e), w: cells(c.w, K.w) },
    src: (Array.isArray(H.src) ? H.src : []).filter(s => Array.isArray(s) && CELL.test(s[0]) && BLOOMS[s[1]]).slice(0, K.src).map(s => [s[0], s[1]]),
    g: Object.fromEntries(Object.entries(isObj(H.g) ? H.g : {}).filter(([k, x]) => CELL.test(k) && Array.isArray(x) && KINDS.includes(x[0]) && x[0].length === 1
      && (x[0] === 'f' ? !!BLOOMS[x[1]] : x[1] === '') && Number.isInteger(x[2])).slice(0, 200).map(([k, x]) => [k, [x[0], x[1], x[2]]])),
    t: heat(H.t, K.t), n: Object.fromEntries(Object.entries(isObj(H.n) ? H.n : {}).filter(([s, v]) => SP[s] && num(v))), p: heat(H.p, K.p),
    q: Number.isInteger(H.q) && H.q > 0 ? Math.min(H.q, 99) : 0, tr: cells(H.tr, WILD.cap.t),
    sp: SP[H.sp] ? H.sp : '', pn: H.pn === 1 ? 1 : 0, fl: Object.fromEntries(Object.keys(isObj(H.fl) ? H.fl : {}).filter(k => k.length === 1 && KINDS.includes(k) && H.fl[k] === 1).map(k => [k, 1])),
    a: Number.isInteger(H.a) ? H.a : null, v: Number.isInteger(H.v) ? H.v : 0 };
}
export function tidyWild(S) { // fromSave (a save before 17-3: none yet)
  const A = isObj(S.wild) ? S.wild : blank(), h = {};
  for (const [hab, H] of Object.entries(isObj(A.h) ? A.h : {})) if (HAB[hab] && isObj(H)) h[hab] = tidyH(H);
  S.wild = { d: Number.isInteger(A.d) ? A.d : 0, book: Object.fromEntries(Object.entries(isObj(A.book) ? A.book : {}).filter(([c, d]) => BLOOMS[c] && Number.isInteger(d))),
    news: (Array.isArray(A.news) ? A.news : []).filter(n => isObj(n) && RANK.includes(n.k) && HAB[n.hab] && CELL.test(n.at)).slice(-WILD.news)
      .map(n => ({ k: n.k, hab: n.hab, at: n.at, ...BLOOMS[n.c] && { c: n.c }, ...SP[n.sp] && { sp: n.sp }, ...Number.isInteger(n.n) && { n: n.n } })), h };
}
const hOf = (S, hab) => S.wild.h[hab] ??= blankH();

// the worn cells: H.tr not painted, one beside another (a lone one is not a way); [cell, times the average cell's steps], the most first
const refOf = H => { const v = Object.values(H.p); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : Infinity; };
const joinedIn = on => k => { const [i, j] = ij(k); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && on.has(`${i + a},${j + b}`)) return true; return false; };
export const trails = (S, hab) => trailsOf(S.wild.h[hab], S.paint?.[hab]);
export function trailsOf(H, paint) {
  if (!H) return []; paint ||= {};
  const r = refOf(H), on = H.tr.filter(k => paint[k] == null);
  return on.filter(joinedIn(new Set(on))).map(k => [k, +((H.p[k] || 0) / r).toFixed(2)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, WILD.cap.t);
}

const RANK = ['bloom', 'path', 'moss', 'mush', 'reed', 'lily', 'grow'];
function tell(S, n) {
  const N = S.wild.news, g = n.k === 'grow' && N.find(o => o.k === 'grow' && o.hab === n.hab);
  if (g) { g.n += 1; g.at = n.at; return; }
  N.push(n); N.splice(0, Math.max(0, N.length - WILD.news));
}

// one day dd of the habitat hab
function step(S, hab, H, dd) {
  const W = WILD, g = H.g, paint = S.paint?.[hab] || {};
  H.a ??= dd;
  // a walked day (W.min steps, gathered over as many days as it takes): the ways walked most, against the average cell
  const tot = Object.values(H.t).reduce((a, b) => a + b, 0);
  if (tot >= W.min) {
    for (const k in H.p) H.p[k] *= W.decay;
    for (const k in H.t) H.p[k] = (H.p[k] || 0) + H.t[k];
    for (const k in H.p) if (H.p[k] < 0.5) delete H.p[k]; else H.p[k] = +H.p[k].toFixed(2);
    H.p = top(H.p, W.keep.p); H.q = Math.min(H.q + 1, 99);
    const r = refOf(H), was = new Set(H.tr), on = H.q < W.q ? [] : Object.keys(H.p).filter(k => H.p[k] >= (was.has(k) ? W.stay : W.trail) * r);
    H.tr = on.filter(joinedIn(new Set(on))).sort().slice(0, W.cap.t); // a way once worn stays till walked much less (no flicker)
    H.sp = Object.keys(H.n).sort((a, b) => H.n[b] - H.n[a])[0] || H.sp; H.t = {}; H.n = {};
  }
  const r = refOf(H), hot = new Set([...H.tr, ...Object.keys(H.p).filter(k => H.p[k] >= W.stay * r)]), free = q => !g[q] && !hot.has(q) && paint[q] == null;
  for (const k in g) if (hot.has(k) || paint[k] != null) delete g[k]; // trodden down, or painted over since
  const count = kind => Object.values(g).filter(x => x[0] === kind).length, tr = trails(S, hab), worn = tr.map(([k]) => ij(k));
  // flowers: each one there (and each bloomed) sows round itself now and then, further by a trail (a seed carried)
  const flowers = [...H.src, ...Object.keys(g).filter(k => g[k][0] === 'f' && dd - g[k][2] >= W.bud).map(k => [k, g[k][1]])].map(([k, c]) => [k, c, ij(k)]);
  let nf = count('f'), made = 0;
  for (const [k, col, at] of flowers) {
    if (made >= 3 || nf >= W.cap.f) break;
    if ((hash(k) + dd) % W.every) continue;
    const R = worn.some(q => far(q, at) <= 1) ? 4 : 2, opts = H.c.f.filter(q => free(q) && far(ij(q), at) <= R);
    if (!opts.length) continue;
    const q = opts[hash(`${k}|${dd}`) % opts.length], qa = ij(q);
    let other = null, od = 3; for (const [, c2, a2] of flowers) { const d = far(a2, qa); if (c2 !== col && d < od) { od = d; other = c2; } } // the nearest other colour, 2 cells at most
    g[q] = ['f', (other && mixOf(col, other)) || col, dd]; made++; nf++;
  }
  for (const k in g) if (g[k][0] === 'f' && dd - g[k][2] === W.bud) { // bloomed today
    const c = g[k][1]; if (S.wild.book[c] == null) { S.wild.book[c] = dd; tell(S, { k: 'bloom', hab, at: k, c }); } else tell(S, { k: 'grow', hab, at: k, n: 1 });
  }
  // moss in the shade (then mushrooms in old moss), reeds by the water, lilies on it: from the 3rd day, slowly, next to their own
  const add = (kind, from, cap, news) => {
    if (count(kind) >= cap) return; const opts = from.filter(free); if (!opts.length) return;
    const mine = Object.keys(g).filter(k => g[k][0] === kind).map(ij), near = opts.filter(q => mine.some(m => far(m, ij(q)) <= 1)), pool = near.length ? near : opts;
    const q = pool[hash(`${kind}|${hab}|${dd}`) % pool.length]; g[q] = [kind, '', dd];
    if (!H.fl[kind]) { H.fl[kind] = 1; tell(S, { k: news, hab, at: q }); }
  };
  if (dd - H.a >= 3) {
    const o = hash(hab);
    if ((dd + o) % 2 === 0) add('m', H.c.s, W.cap.m, 'moss');
    if ((dd + o) % 2 === 1) add('r', H.c.e, W.cap.r, 'reed');
    if ((dd + o) % 3 === 0) add('l', H.c.w, W.cap.l, 'lily');
    for (const k in g) if (g[k][0] === 'm' && dd - g[k][2] >= 5 && hash(k) % 3 === 0 && count('u') < W.cap.u) {
      g[k] = ['u', '', dd]; if (!H.fl.u) { H.fl.u = 1; tell(S, { k: 'mush', hab, at: k }); }
    }
  }
  if (tr.length >= 6 && !H.pn) { H.pn = 1; tell(S, { k: 'path', hab, at: tr[0][0], ...SP[H.sp] && { sp: H.sp } }); } else if (tr.length < 3) H.pn = 0;
  H.v++;
}

// advance: the days since the last one (WILD.days at most; none while 「정원이 자라요」 is off, or the clock went back)
export function wildTick(S, now, ev) {
  const W = S.wild, today = dayNo(now);
  if (S.flags.wildOff || !W.d || today < W.d) { W.d = today; return; }
  if (today === W.d) return;
  for (let dd = Math.max(W.d + 1, today - WILD.days + 1); dd <= today; dd++)
    for (const hab of Object.keys(W.h)) if (S.unlocked.includes(hab) && HAB[hab]?.ready !== false) step(S, hab, W.h[hab], dd);
  W.d = today; ev.push({ type: 'wild' });
}

// the board: the animals' steps (cell -> times entered) and who took them
export function walk(S, hab, t, n) {
  if (S.flags.wildOff || !HAB[hab] || !isObj(t)) return;
  const H = hOf(S, hab);
  for (const k in t) if (CELL.test(k) && num(t[k])) H.t[k] = (H.t[k] || 0) + Math.min(t[k], 50);
  for (const s in isObj(n) ? n : {}) if (SP[s] && num(n[s])) H.n[s] = (H.n[s] || 0) + n[s];
  if (Object.keys(H.t).length > WILD.keep.t) H.t = top(H.t, WILD.keep.t);
}
// the board: where each may grow now (props, paint or the board changed); what stands where it may no longer is gone
export function ground(S, hab, c) {
  if (!HAB[hab] || !isObj(c)) return;
  const H = hOf(S, hab), K = WILD.keep, was = Object.keys(H.g).length;
  H.c = { f: cells(c.f, K.f), s: cells(c.s, K.s), e: cells(c.e, K.e), w: cells(c.w, K.w) };
  H.src = (Array.isArray(c.src) ? c.src : []).filter(s => Array.isArray(s) && CELL.test(s[0]) && BLOOMS[s[1]]).slice(0, K.src).map(s => [s[0], s[1]]);
  const may = { f: new Set(H.c.f), m: new Set(H.c.s), u: new Set(H.c.s), r: new Set(H.c.e), l: new Set(H.c.w) };
  for (const k in H.g) if (!may[H.g[k][0]].has(k)) delete H.g[k];
  if (Object.keys(H.g).length !== was) H.v++;
}
// 42 F-6 자연 정리 「자란 것 모두 치우기」: all grown, and the worn ways (they wear again as the animals walk)
export function clear(S, hab) {
  const H = S.wild.h[hab]; if (!H) return 0;
  const n = Object.keys(H.g).length + trailsOf(H, S.paint?.[hab]).length; H.g = {}; H.p = {}; H.q = 0; H.tr = []; H.t = {}; H.n = {}; H.pn = 0; H.v++;
  S.wild.news = S.wild.news.filter(o => o.hab !== hab); return n;
}
export const seen = S => { S.wild.news = []; };

// 돌아왔어요: the one to tell (the most interesting), with how many there are
export function newsOf(S) {
  const N = S.wild.news; if (!N.length || S.flags.wildOff) return null;
  const b = [...N].sort((x, y) => RANK.indexOf(x.k) - RANK.indexOf(y.k))[0];
  const text = { bloom: () => `${BLOOMS[b.c]?.name ?? ''} 들꽃이 처음 피었어요`, path: () => `${SP[b.sp]?.name ?? '친구'}들이 다니는 길이 생겼어요`,
    moss: () => '그늘에 이끼가 돋았어요', mush: () => '이끼 사이에 작은 버섯이 났어요', reed: () => '물가에 갈대가 자라기 시작했어요',
    lily: () => '연못에 수련이 떴어요', grow: () => `새 들꽃이 ${b.n}곳에 피었어요` }[b.k]();
  return { text, sub: N.length > 1 ? `정원 변화 ${N.length}가지 · 보러 가요` : '정원 변화 · 보러 가요', hab: b.hab, at: b.at };
}
