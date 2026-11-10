// Snow layout (25-1): the pond's board (pond/layout.js) with snow on it. An ice pond about 30% of the walking board, cold
// water with two flat ice floes in it (dry ground: the seal and the penguin climb out and lie there), three low rock mounds
// (their tops are the owl's perches, ctx.perches in walk.js), snowy pines along the back, a flat landing at the front left.
// No stream and no bridge. Everything that needs to know "where is what" in the snow reads here.
import * as THREE from 'three';
import { bump } from '../stamps.js';
import { dist2D, WATER_Y } from '../meadow/layout.js';
import { BOARD0, rectAt, zoneSet, edgeOf, inRect } from '../zones.js';
export { WATER_Y };

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// 28-1 땅 넓히기 as the pond's: a zone a step along one side (zones.js); S stays 1. R: the board as built, O: the open ground; Z: the zones
export const BW0 = 36, BD0 = 58, S = 1;
export const openAt = L => rectAt('snow', L);
export let R = [...BOARD0], O = [...BOARD0], Z = zoneSet('snow', 0);

// the ice pond: a rounded box (superellipse, power 3.5) 10.5 across by 13.5 deep round (2.5, -2), a little wobble
const RX = 10.5, RZ = 13.5, pond0 = { x: 2.5, z: -2 };
const shoreR0 = a => {
  const c = Math.abs(Math.cos(a)) / RX, s = Math.abs(Math.sin(a)) / RZ;
  return (c ** 3.5 + s ** 3.5) ** (-1 / 3.5) + 0.45 * Math.sin(3 * a + 1) + 0.3 * Math.sin(5 * a + 2);
};
const shore0 = (x, z) => Math.hypot(x - pond0.x, z - pond0.z) - shoreR0(Math.atan2(z - pond0.z, x - pond0.x));
// the floes: flat ice a hand over the water (FLOE), its edge a short drop to the bed. isle: signed, from the floe's edge
const FLOE = WATER_Y + 0.15, floes0 = [{ x: 0, z: -6.5, r: 2.3 }, { x: 7, z: 3.5, r: 1.7 }];
const isle0 = (x, z) => { let d = Infinity; for (const I of floes0) d = Math.min(d, Math.hypot(x - I.x, z - I.z) - I.r); return d; };
// the rock mounds: low round hills, big rocks round their foot (props.js), the top open
const mounds0 = [{ x: -11.5, z: -14, r: 3.4, h: 1.5 }, { x: -12.6, z: 4, r: 2.8, h: 1.15 }, { x: 11.8, z: 18.5, r: 2.6, h: 1.0 }];
const landing0 = { x: -5.5, z: 20.5 }; // babies from the nest land here (ctx.landing)

function hills(x, z) {
  return 0.5 * Math.sin(x * 0.17 + 2.1) * Math.cos(z * 0.13 + 1.1) + 0.3 * Math.sin(x * 0.09 - z * 0.11 + 0.4)
    + 0.1 * Math.sin(x * 0.5 + z * 0.37) * Math.cos(z * 0.45 - x * 0.2);
}
const rise = z => 0.9 * sm((-19 - z) / 7); // the back rises a little toward the pines
// the bed by distance from the shore line, as the pond's: a shallow shelf (the penguin stands in it), then deep
const bed = s => -0.85 * sm((0.9 - s) / 1.7) - 1.35 * sm((-2.6 - s) / 2.4);
function h0(x, z) {
  const s = shore0(x, z);
  let land = 0.6 * hills(x, z) * sm((Math.min(s, Z.wd(x, z, true) - 0.4) - 0.4) / 3.5) * (1 - Z.flat(x, z)) + rise(z) + Z.lift(x, z); // 28-1: + the zones' hills
  for (const m of mounds0) land += m.h * sm(1 - Math.hypot(x - m.x, z - m.z) / m.r);
  let h = Math.min(land + bed(s), land - Z.dip(x, z));
  for (const I of floes0) h = Math.max(h, FLOE - 2.0 * sm((Math.hypot(x - I.x, z - I.z) / I.r - 0.94) / 0.3));
  return h;
}

// ---- the board at this step (setLevel): the first one spread by S. Lengths x S, heights as they were ----
export let pond, islands, mounds, perches, landing;
export const shoreR = a => S * shoreR0(a);
export const shore = (x, z) => S * shore0(x / S, z / S);
export const isle = (x, z) => S * isle0(x / S, z / S);
export const waterY = () => WATER_Y;
export const deckAt = () => -Infinity; // no bridge
export const bridgeEnds = [];
export const sPts = []; // no stream (dist2D of none: far)
function edgeRound(h, x, z) {
  const e = edgeOf(R, x, z);
  if (e >= 1.2) return h;
  const t = Math.max(0, e) / 1.2; return -1.9 + (h + 1.9) * (1 - (1 - t) * (1 - t));
}
export const heightAt = (x, z) => edgeRound(h0(x / S, z / S) + bump(x, z), x, z); // 28-6 지형 도장
export const depthAt = (x, z) => WATER_Y - heightAt(x, z);
export const mound = (x, z) => { let k = 0; for (const m of mounds) k = Math.max(k, sm(1 - Math.hypot(x - m.x, z - m.z) / m.r)); return k; }; // 0..1 up a mound (terrain.js)

export const occupied = [];
export function free(x, z, r) {
  if (!inRect(O, x, z, 1.5) || Z.wd(x, z, true) < r + 0.8) return false;
  if (shore(x, z) < r + 0.9) return false;
  for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
  return true;
}
const inBoard = (x, z) => x > O[0] + 1.8 && x < O[1] - 1.8 && z > -22.5 && z < O[3] - 2.5;
const clearOf = (x, z) => {
  for (const o of occupied) if (o.r > 0.9 && Math.hypot(o.x - x, o.z - z) < o.r + 0.4) return false;
  for (const d of decor) if (!d.water && !d.open && (!d.nat || d.r > 0.9) && Math.hypot(d.x - x, d.z - z) < d.r + (d.nat ? 0.4 : 0.6)) return false;
  return true;
};
// dry ground: the snow round the pond, the mounds, and the floes' tops (0.4 in from their edge)
export function walkable(x, z) { return inBoard(x, z) && (shore(x, z) > 1.3 || isle(x, z) < -0.4) && Z.wd(x, z) > 1.0 && clearOf(x, z); }
export const mainland = (x, z) => shore(x, z) > 1.3 && walkable(x, z);
// where a water animal may also go, as the pond's: the bank and the pond ('swim'), or the shallows ('wade')
export function wet(x, z, kind) {
  if (!inBoard(x, z) || shore(x, z) > 1.4 || !clearOf(x, z)) return false;
  return kind === 'swim' || depthAt(x, z) < 0.45;
}
// a spot in the water near (x0, z0) round the pond; now and then by a floe (it climbs out onto it from there)
export function waterSpot(kind, x0, z0) {
  const a0 = Math.atan2(z0 - pond.z, x0 - pond.x), I = Math.random() < 0.35 && islands[Math.floor(Math.random() * islands.length)];
  for (let k = 0; k < 40; k++) {
    let x, z;
    if (I) { const a = Math.random() * 2 * Math.PI, r = I.r + 0.3 + Math.random() * (kind === 'swim' ? 1.8 : 0.7); x = I.x + Math.cos(a) * r; z = I.z + Math.sin(a) * r; }
    else { const a = a0 + (Math.random() - 0.5) * 1.6, s = kind === 'swim' ? -1.3 - Math.random() * 4.5 : -0.4 - Math.random() * 2.3, r = shoreR(a) + s; x = pond.x + Math.cos(a) * r; z = pond.z + Math.sin(a) * r; }
    if (wet(x, z, kind) && depthAt(x, z) > 0.05) return [x, z];
  }
  return null;
}

export const decor = [];
export function placeable(x, z, r, water, dry) { // dry: as meadow's
  const ok = water ? shore(x, z) < -(r + 0.6) && isle(x, z) > r + 0.9 : free(x, z, r) && (dry || walkable(x, z));
  return ok && decor.every(d => Math.hypot(d.x - x, d.z - z) > (d.nat && d.open ? 0.4 : d.r) + r + 0.1);
}
export function pathClear(x1, z1, x2, z2, ok = walkable) {
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5);
  for (let i = 1; i <= n; i++) if (!ok(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return false;
  return true;
}
export { dist2D };

let seed = 23;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export function setLevel(L, top = L) {
  O = openAt(L); R = openAt(Math.max(L, top)); Z = zoneSet('snow', Math.max(L, top));
  // swim.js lanes: outside the floes, inside the shore
  pond = { x: pond0.x * S, z: pond0.z * S, r: RX * S, k: RZ / RX, lanes: [0.62, 0.8] };
  islands = floes0.map(I => ({ x: I.x * S, z: I.z * S, r: I.r * S }));
  mounds = mounds0.map(m => ({ x: m.x * S, z: m.z * S, r: m.r * S, h: m.h }));
  perches = [...mounds.map(m => ({ x: m.x, z: m.z })), ...Z.perches]; // 28-1: + the ice pillars
  landing = [landing0.x * S, landing0.z * S];
  occupied.length = 0; decor.length = 0; seed = 23;
}
setLevel(0);
