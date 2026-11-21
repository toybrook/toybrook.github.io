// 195 B-8 1-2 ④ 세밀 배치 (?yard, docs/decor-redesign.md 5-2 ②, 5-3 ④): the yard's 흩뿌리기·디테일 붓 (the placing
// rules and the names: habitat/yard/fine.js). Pure (no DOM, no three.js): tools/check-eggs.mjs runs it.
// S.scatter (the yard only, the flag on): a flat list of integers, five a piece: [kind (SCATTER index), x2, z2 (saved units x 2: a
// half cell; the piece is in cell floor(x2 / 2)), rot (0..7: eighths of a turn), size (0..2)]. Nothing in the way: drawn only
// (habitat/yard/scatter.js), under or beside props. In the save it is the yard part's sc (yard.js); rules.js tidyYard checks its shape,
// yardIn and setLayout each piece against the open land, the cell's paint and the cap (fitSc).
import { YARD_B, BRUSHES, UNIT } from './data.js';
import { rectAt, inRect } from '../habitat/zones.js';

export const KINDS = 5; // the kinds (yard/fine.js SCATTER: their names and colours, drawn by yard/scatter.js)
export const PER = 2; // pieces in one cell at most
export const capOf = (w, h) => Math.floor(w * h * 0.5); // 5-2 ②: land cells x 0.5
export const capAt = L => capOf(...(YARD_B.cells[L] ?? [0, 0]));
const MAX = capOf(...YARD_B.cells[YARD_B.cells.length - 1]);
const ok5 = (k, x, z, r, s) => [k, x, z, r, s].every(Number.isInteger) && k >= 0 && k < KINDS && Math.abs(x) <= 198 && Math.abs(z) <= 198 && r >= 0 && r < 8 && s >= 0 && s < 3;
// the shape only (rules.js tidyYard, setLayout, yard.js yardIn): whole pieces in range, PER a cell, at most the biggest yard's cap;
// anything else: null
export function tidySc(a) {
  if (!Array.isArray(a)) return null; const out = [], per = new Map();
  for (let i = 0; i + 4 < a.length && out.length < MAX * 5; i += 5) { const q = a.slice(i, i + 5); if (!ok5(...q)) continue;
    const c = Math.floor(q[1] / 2) + ',' + Math.floor(q[2] / 2), m = per.get(c) || 0; if (m < PER) { out.push(...q); per.set(c, m + 1); } }
  return out;
}
// a cell no piece goes on: the water, a line's (울타리·돌담·생울타리 stand; 다리, 문)
const LINE = new Set(['bridge', 'gate']), WATER = BRUSHES.findIndex(b => b.id === 'water');
export const scBlock = b => b != null && (b === WATER || !!BRUSHES[b]?.stand || LINE.has(BRUSHES[b]?.id));
// cell i, j takes pieces on S's yard: on the open land at its step, not a blocked cell
const cellOk = (S, i, j) => inRect(rectAt('yard', S.expand?.yard ?? 0), (i + 0.5) * UNIT, (j + 0.5) * UNIT) && !scBlock(S.paint?.yard?.[i + ',' + j]);
// pieces read back (yard.js yardIn, rules.js setLayout) on S as it is: tidySc, each on a cell that takes it, under the step's cap: { list, off (left out) }
export function fitSc(S, a) {
  const sc = tidySc(a) ?? [], cap = capAt(S.expand?.yard ?? 0), list = [];
  for (let i = 0; i < sc.length; i += 5) if (list.length < cap * 5 && cellOk(S, Math.floor(sc[i + 1] / 2), Math.floor(sc[i + 2] / 2))) list.push(...sc.slice(i, i + 5));
  return { list, off: Math.floor((Array.isArray(a) ? a.length : 0) / 5) - list.length / 5 };
}
const h32 = n => { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0; };
// a stroke over cells [[i, j]] with brush b ('s0'..: a kind, 'sx': clear what is there) on list: { list (a new one), n (changed) }.
// One more piece in each cell under PER while under cap; where in the cell, its turn and size from the cell and how many there are,
// so the same stroke gives the same pieces (habitat.js shows it as it goes with this; the game keeps it)
export function strokeOn(list, cells, b, cap, ok = () => true) { // ok(i, j): the cell takes pieces
  if (b === 'sx') { const gone = new Set(cells.map(([i, j]) => i + ',' + j)), out = []; let n = 0;
    for (let p = 0; p < list.length; p += 5) if (gone.has(Math.floor(list[p + 1] / 2) + ',' + Math.floor(list[p + 2] / 2))) n++; else out.push(...list.slice(p, p + 5));
    return { list: out, n }; }
  const k = typeof b === 'string' && /^s\d$/.test(b) ? +b[1] : -1, out = list.slice(); let n = 0; if (!(k >= 0 && k < KINDS)) return { list: out, n };
  const per = new Map(); for (let p = 0; p < out.length; p += 5) { const c = Math.floor(out[p + 1] / 2) + ',' + Math.floor(out[p + 2] / 2); per.set(c, (per.get(c) || 0) + 1); }
  for (const [i, j] of cells) {
    if (out.length / 5 >= cap) break; const c = i + ',' + j, m = per.get(c) || 0; if (m >= PER || !ok(i, j)) continue;
    const h = h32(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(out.length / 5 + 1, 83492791) ^ k);
    out.push(k, 2 * i + (h & 1), 2 * j + (h >> 1 & 1), h >> 2 & 7, (h >> 5 & 3) % 3); per.set(c, m + 1); n++;
  }
  return { list: out, n };
}
// the game's stroke (game.js scatter): the yard's cap at its step, cells on its land, not blocked
export function scatterOn(S, cells, b) {
  const r = strokeOn(S.scatter || [], cells, b, capAt(S.expand?.yard ?? 0), (i, j) => cellOk(S, i, j)); if (r.n) S.scatter = r.list; return r.n;
}
