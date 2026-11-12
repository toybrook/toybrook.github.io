// Dino jungle layout (14-3): the snow's board (snow/layout.js) gone green. A jungle lagoon about a quarter of the walking board
// (no floes, nothing swims: the dinosaurs wade at its shelf at most), a mud wallow on the left front (a flat dip, glossy mud in
// it: the 'roll' spots), the fossil dig on the left back (flat sand a little sunk: the 'dig' spots, rules.js dig), two low rock
// mounds (their tops are the pterosaur's perches, ctx.perches in walk.js), tree ferns and a small smoking volcano along the back,
// a flat landing at the front. Everything that needs to know "where is what" in the jungle reads here.
import * as THREE from 'three';
import { bump } from '../stamps.js';
import { dist2D, WATER_Y } from '../meadow/layout.js';
import { BOARD0, rectAt, zoneSet, edgeOf, inRect } from '../zones.js';
import { UNIT } from '../../game/data.js';
export { WATER_Y };

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// as the snow's: S spreads the first board; R: the board as built, O: the open ground; Z: the zones
export const S = UNIT, BW0 = 36 * S, BD0 = 58 * S;
export const openAt = L => rectAt('dino', L);
export let R = [...BOARD0], O = [...BOARD0], Z = zoneSet('dino', 0);

// the lagoon: a rounded box (superellipse, power 3.5) 9 across by 11.5 deep round (4, -4), a little wobble
const RX = 9, RZ = 11.5, pond0 = { x: 4, z: -4 };
const shoreR0 = a => {
  const c = Math.abs(Math.cos(a)) / RX, s = Math.abs(Math.sin(a)) / RZ;
  return (c ** 3.5 + s ** 3.5) ** (-1 / 3.5) + 0.5 * Math.sin(3 * a + 2) + 0.3 * Math.sin(5 * a + 0.5);
};
const shore0 = (x, z) => Math.hypot(x - pond0.x, z - pond0.z) - shoreR0(Math.atan2(z - pond0.z, x - pond0.x));
// the mud wallow and the fossil dig: round flat ground (the hills smoothed out round them), sunk by dip with a flat floor
// r - 1.2 across; the mud's floor under a glossy mud disc (props.js)
const mud0 = { x: -10.5, z: 12, r: 3.0, dip: 0.28 }, fossil0 = { x: -10.5, z: -12, r: 3.4, dip: 0.15 };
const sites0 = [mud0, fossil0];
// the rock mounds: low round hills, big rocks round their foot (props.js), the top open
const mounds0 = [{ x: 12.5, z: 17, r: 2.8, h: 1.2 }, { x: -13.5, z: 1, r: 2.4, h: 1.0 }];
const landing0 = { x: -2, z: 21 }; // babies from the nest land here (ctx.landing)

function hills(x, z) {
  return 0.5 * Math.sin(x * 0.17 + 0.6) * Math.cos(z * 0.13 + 2.3) + 0.3 * Math.sin(x * 0.09 - z * 0.11 + 1.4)
    + 0.1 * Math.sin(x * 0.5 + z * 0.37) * Math.cos(z * 0.45 - x * 0.2);
}
const rise = z => 0.9 * sm((-19 - z) / 7); // the back rises a little toward the ferns
// the bed by distance from the shore line, as the pond's: a shallow shelf, then deep
const bed = s => -0.85 * sm((0.9 - s) / 1.7) - 1.35 * sm((-2.6 - s) / 2.4);
function h0(X, Zw) { // X, Zw: world metres (the zones'); x, z: the old board's
  const x = X / S, z = Zw / S, s = shore0(x, z);
  let flat = 0, dip = 0;
  for (const c of sites0) { const d = Math.hypot(x - c.x, z - c.z); flat = Math.max(flat, sm((c.r + 1.6 - d) / 1.6)); dip += c.dip * sm((c.r - d) / 1.2); }
  let land = 0.6 * hills(x, z) * sm((Math.min(s, Z.wd(X, Zw, true) / S - 0.4) - 0.4) / 3.5) * (1 - Z.flat(X, Zw)) * (1 - flat) + rise(z) + Z.lift(X, Zw) - dip;
  for (const m of mounds0) land += m.h * sm(1 - Math.hypot(x - m.x, z - m.z) / m.r);
  return Math.min(land + bed(s), land - Z.dip(X, Zw));
}

// ---- the board at this step (setLevel): the first one spread by S. Lengths x S, heights as they were ----
export let pond, islands, mounds, perches, landing, mud, fossil;
export const shoreR = a => S * shoreR0(a);
export const shore = (x, z) => S * shore0(x / S, z / S);
export const isle = () => Infinity; // no islands
export const waterY = () => WATER_Y;
export const deckAt = () => -Infinity; // no bridge
export const bridgeEnds = [];
export const sPts = []; // no stream
function edgeRound(h, x, z) {
  const e = edgeOf(R, x, z);
  if (e >= 1.2) return h;
  const t = Math.max(0, e) / 1.2; return -1.9 + (h + 1.9) * (1 - (1 - t) * (1 - t));
}
export const heightAt = (x, z) => edgeRound(h0(x, z) + bump(x, z), x, z); // 28-6 지형 도장
export const depthAt = (x, z) => WATER_Y - heightAt(x, z);
export const mound = (x, z) => { let k = 0; for (const m of mounds) k = Math.max(k, sm(1 - Math.hypot(x - m.x, z - m.z) / m.r)); return k; }; // 0..1 up a mound (terrain.js)
// 0..1 into the mud wallow / the fossil dig (terrain.js colours, props.js)
export const inMud = (x, z) => sm((mud.r - Math.hypot(x - mud.x, z - mud.z)) / (0.9 * S));
export const inDig = (x, z) => sm((fossil.r + 0.4 * S - Math.hypot(x - fossil.x, z - fossil.z)) / (0.9 * S));

export const occupied = [];
export function free(x, z, r) {
  if (!inRect(O, x, z, 1.5) || Z.wd(x, z, true) < r + 0.8) return false;
  if (shore(x, z) < r + 0.9) return false;
  for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
  return true;
}
const inBoard = (x, z) => x > O[0] + 1.8 && x < O[1] - 1.8 && z > -22.5 * S && z < O[3] - 2.5;
const clearOf = (x, z) => {
  for (const o of occupied) if (o.r > 0.9 && Math.hypot(o.x - x, o.z - z) < o.r + 0.4) return false;
  for (const d of decor) if (!d.water && !d.open && (!d.nat || d.r > 0.9) && Math.hypot(d.x - x, d.z - z) < d.r + (d.nat ? 0.4 : 0.6)) return false;
  return true;
};
// dry ground: round the lagoon, the mounds, the mud and the dig
export function walkable(x, z) { return inBoard(x, z) && shore(x, z) > 1.3 && Z.wd(x, z) > 1.0 && clearOf(x, z); }
export const mainland = walkable;
// as the snow's (no one here swims or wades: kept for the shared code)
export function wet(x, z, kind) {
  if (!inBoard(x, z) || shore(x, z) > 1.4 || !clearOf(x, z)) return false;
  return kind === 'swim' || depthAt(x, z) < 0.45;
}
export function waterSpot(kind, x0, z0) {
  const a0 = Math.atan2(z0 - pond.z, x0 - pond.x);
  for (let k = 0; k < 40; k++) {
    const a = a0 + (Math.random() - 0.5) * 1.6, s = kind === 'swim' ? -1.3 - Math.random() * 4.5 : -0.4 - Math.random() * 2.3, r = shoreR(a) + s, x = pond.x + Math.cos(a) * r, z = pond.z + Math.sin(a) * r;
    if (wet(x, z, kind) && depthAt(x, z) > 0.05) return [x, z];
  }
  return null;
}

export const decor = [];
export function placeable(x, z, r, water, dry) { // dry: as meadow's
  const ok = water ? shore(x, z) < -(r + 0.6) : free(x, z, r) && (dry || walkable(x, z));
  return ok && decor.every(d => d.nat && d.open || Math.hypot(d.x - x, d.z - z) > d.r + r + 0.1);
}
export function pathClear(x1, z1, x2, z2, ok = walkable) {
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5);
  for (let i = 1; i <= n; i++) if (!ok(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return false;
  return true;
}
export { dist2D };

let seed = 29;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// the board's own spots (walk.js ctx.spots, as the zones'): wallowing in the mud, digging at the fossil site
const spots0 = [[-10, 11.5, 'roll'], [-11.3, 12.9, 'roll'], [-9.6, -12.6, 'dig'], [-11.6, -11.2, 'dig']];
export let spots = [];

export function setLevel(L, top = L) {
  O = openAt(L); R = openAt(Math.max(L, top)); Z = zoneSet('dino', Math.max(L, top));
  pond = { x: pond0.x * S, z: pond0.z * S, r: RX * S, k: RZ / RX, lanes: [0.62, 0.8] };
  islands = [];
  mounds = mounds0.map(m => ({ x: m.x * S, z: m.z * S, r: m.r * S, h: m.h }));
  mud = { x: mud0.x * S, z: mud0.z * S, r: mud0.r * S }; fossil = { x: fossil0.x * S, z: fossil0.z * S, r: fossil0.r * S };
  perches = [...mounds.map(m => ({ x: m.x, z: m.z })), ...Z.perches]; // + the cliffs' rock stacks
  landing = [landing0.x * S, landing0.z * S];
  spots = spots0.map(([x, z, act]) => ({ x: x * S, z: z * S, act, r: act === 'dig' ? 1.4 : 1.2, k: 0 }));
  occupied.length = 0; decor.length = 0; seed = 29;
}
setLevel(0);
