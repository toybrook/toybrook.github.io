// 182 ④ 나의 뜰 (?yard, docs/concepts/custom-zone.md): a flat board. The open land (O, zones.js rectAt('yard', L)) is a
// rect round the middle that grows 16×16 -> 36×58 cells (YARD_B.cells, 184 ④ steps 4..6); past it the closed ground, drawn only. No water to swim in, no
// bridge, no zones, no natives of its own: the player paints, places and calls animals here.
// R: the board as built. 'board' base (184 ④, the default): the board stops just past the next step's land, a wooden frame
// round the open land and a wooden tray under it (index.js); 'meadow' (?yard=meadow): the closed ground runs on as a faded
// meadow to M past the next step's land.
import { bump } from '../stamps.js';
import { rectAt, edgeOf, inRect } from '../zones.js';
import { UNIT, YD247 } from '../../game/data.js';
import { under } from './fine.js';

export const S = UNIT;
export const BASE = 'board'; // release build: ?yard=meadow off (209 B) // 184 ④ Q2: the board by default; ?yard=meadow the 182 one, to compare
const M = BASE === 'board' ? 2.5 : 15;
export let O = rectAt('yard', 0), N = rectAt('yard', 1), R = O.map((v, i) => v + (i % 2 ? M : -M));

function edgeRound(h, x, z) {
  const e = edgeOf(R, x, z);
  if (e >= 1.2) return h;
  const t = Math.max(0, e) / 1.2; return -1.9 + (h + 1.9) * (1 - (1 - t) * (1 - t));
}
export const heightAt = (x, z) => edgeRound(bump(x, z), x, z); // 28-6 지형 도장 work here too
export const occupied = [], decor = [];
const inOpen = (x, z, m = 0) => inRect(O, x, z, m);
const clearOf = (x, z) => {
  for (const d of decor) if (!d.water && !d.open && (!d.nat || d.r > 0.9) && Math.hypot(d.x - x, d.z - z) < d.r + (d.nat ? 0.4 : 0.6)) return false;
  return true;
};
export const walkable = (x, z) => inOpen(x, z, 0.6) && clearOf(x, z);
export function placeable(x, z, r, water, over) { // over (195 B-8 1-2 겹쳐 놓기): an A띠 low one, inside another prop's spot too (fine.js under: not a line's, the water's, a rail's, a play prop's, nature's)
  if (water || !inOpen(x, z, Math.min(r, 1.2) * 0.6)) return false; // a prop may hang a little over the edge, never its middle
  return decor.every(d => d.nat && d.open || d.over || over && under(d) || Math.hypot(d.x - x, d.z - z) > d.r + r + 0.1);
}
export const paintable = (x, z) => inOpen(x, z);
export function pathClear(x1, z1, x2, z2, ok = walkable) {
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5);
  for (let i = 1; i <= n; i++) if (!ok(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return false;
  return true;
}
export const spawn = () => { for (let k = 0; ; k++) { const x = O[0] + 1.5 + Math.random() * (O[1] - O[0] - 3), z = O[2] + 1.5 + Math.random() * (O[3] - O[2] - 3); if (walkable(x, z) || k > 200) return [x, z]; } };

let seed = 31;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export function setLevel(L, top = L) {
  O = rectAt('yard', L); N = rectAt('yard', Math.max(L, top)); R = (YD247 && BASE === 'board' ? rectAt('yard', 99) : N).map((v, i) => v + (i % 2 ? M : -M)); // 247 A4: the whole 36×58 board from the start
  occupied.length = 0; decor.length = 0; seed = 31;
}
