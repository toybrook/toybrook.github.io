// Pond layout (19-2, grown in inbox 10): the meadow's board nearly all pond, a land rim round it, a small grass hill at the
// front left, two islands, and a spring stream from the back forest into the pond with a log bridge over it. Everything that needs to know "where is what" in the pond reads here.
import * as THREE from 'three';
import { bump } from '../stamps.js';
import { dist2D, WATER_Y } from '../meadow/layout.js';
import { BOARD0, rectAt, zoneSet, edgeOf, inRect } from '../zones.js';
export { WATER_Y };

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// 28-1 땅 넓히기 as the meadow's: each step adds a zone along one side (zones.js), the first board stays as it is. (21-3b to
// 27: the whole board spread out by S a step; S is 1 now, kept so the first board's code below reads as before.) R: the board
// as built, O: the open ground, [x0, x1, z0, z1]; Z: the zones built. The next step's zone is built too, under mist
export const BW0 = 36, BD0 = 58, S = 1;
export const openAt = L => rectAt('pond', L);
export let R = [...BOARD0], O = [...BOARD0], Z = zoneSet('pond', 0);

// inbox 10: the water (with its shallow rim) ~60% of the walking board (35% before). A rounded box (superellipse, power 3.5)
// 13 across (x) by 21.5 deep (z) round z 2.9, a little wobble, and a bite out of its front left for the grass hill.
// swim.js circles the centre at pond.r x lanes + 1.2 (3.2~9.8 here), z stretched by k: round the middle island, inside the small one
const RX = 13, RZ = 21.5, HA = 1.95, HW = 0.38, HD = 5;
const pond0 = { x: 0, z: 2.9 };
const shoreR0 = a => {
  const c = Math.abs(Math.cos(a)) / RX, s = Math.abs(Math.sin(a)) / RZ, d = ((a - HA) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return (c ** 3.5 + s ** 3.5) ** (-1 / 3.5) + 0.5 * Math.sin(3 * a) + 0.3 * Math.sin(5 * a) - HD * Math.exp(-((d / HW) ** 2)); // the wobble is 0 at the sides (the rim there is narrowest)
};
// signed distance from the shore line (< 0 in the pond), along the ray from the centre. The waterline is ~0.1 inside it (bed() below)
const shore0 = (x, z) => Math.hypot(x - pond0.x, z - pond0.z) - shoreR0(Math.atan2(z - pond0.z, x - pond0.x));
// the grass hill in the bite (babies from the nest land on it: ctx.landing) and the islands: the middle one 1.5x the old
// one (waterline r 1.27 -> 1.9), a small one in the back right corner, outside the swim lanes, a shallow wade from the shore
const hill0 = { x: -6.5, z: 21.5, r: 6 };
const islands0 = [{ x: pond0.x, z: pond0.z, r: 1.9 }, { x: 10.3, z: -12.3, r: 1.5 }];
const isle0 = (x, z) => { let d = Infinity; for (const I of islands0) d = Math.min(d, Math.hypot(x - I.x, z - I.z) - I.r); return d; }; // signed, from the islands' waterline

// Spring stream: from the forest at the back into the pond's back shore. Half-width of the water ~1.1.
const SW0 = 1.1, streamAt0 = [[-6, -25.6], [-6.6, -22.4], [-5.4, -19.4], [-4.4, -16.4]];
const sPts0 = new THREE.CatmullRomCurve3(streamAt0.map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(200);
// the back rises a little toward the forest; the stream's water follows it down to the pond
const rise = z => 0.9 * sm((-19 - z) / 7);

// Log bridge over the stream (built like the meadow bridge: deckAt / bridgeEnds for walk.js 'cross')
export const bridgeT = 0.52; // inbox 10: the stream is short now (forest to the back shore), the bridge in the middle of it
export const bridgeArch = u => 0.14 + (1 - (2 * u) ** 2) * 0.32;
export function deckAt(x, z) {
  const dx = x - bP.x, dz = z - bP.z, l = dx * bN.x + dz * bN.z, w = dx * bN.z - dz * bN.x;
  return Math.abs(l) <= BL / 2 && Math.abs(w) < 1.0 ? deckY(l) : -Infinity;
}

function hills(x, z) {
  return 0.5 * Math.sin(x * 0.17 + 2.1) * Math.cos(z * 0.13 + 1.1)
    + 0.3 * Math.sin(x * 0.09 - z * 0.11 + 0.4)
    + 0.1 * Math.sin(x * 0.5 + z * 0.37) * Math.cos(z * 0.45 - x * 0.2);
}
// pond bed by distance from the shore line: grass bank, a shallow shelf 0.3 deep and ~3 wide all round (inbox 7: the
// flamingo wades there, the capybara lies in it; the sand shows through), then deep
const bed = s => -0.85 * sm((0.9 - s) / 1.7) - 1.35 * sm((-2.6 - s) / 2.4);
const streamDepth = d => 1.0 * (1 - sm((d - 0.5) / 1.4));

function h0(x, z) {
  const ds = dist2D(sPts0, x, z), s = shore0(x, z), hill = hill0;
  const land = 0.75 * hills(x, z) * sm((Math.min(ds - SW0, s, Z.wd(x, z, true) - 0.4) - 0.4) / 3.5) * (1 - Z.flat(x, z)) + rise(z) + 0.8 * sm(1 - Math.hypot(x - hill.x, z - hill.z) / hill.r) * sm((s - 0.6) / 3) // + the hill: 0.8 high, flat to the shore
    + Z.lift(x, z); // 28-1: the zones' hills, their pools below
  let h = Math.min(land + bed(s), land - streamDepth(ds), land - Z.dip(x, z));
  for (const I of islands0) h = Math.max(h, 0.25 - 2.45 * sm((Math.hypot(x - I.x, z - I.z) * 1.27 / I.r - 0.5) / 2.0)); // each island: the old one's mound, scaled
  return h;
}

// ---- the board at this step (setLevel): the first one spread by S. Lengths x S, heights as they were ----
export let pond, hill, islands, SW, stream, sPts, bP, bTan, bN, BL, BRIDGE_END, bridgeEnds;
export const shoreR = a => S * shoreR0(a);
// signed distance from the shore line (< 0 in the pond), along the ray from the centre
export const shore = (x, z) => S * shore0(x / S, z / S);
export const isle = (x, z) => S * isle0(x / S, z / S);
export const waterY = z => WATER_Y + rise(z / S);
export const deckY = l => bridgeArch(l / BL) + bP.y + rise(bP.z / S) + 0.1;
// Board edge: everything rounds down onto the soil base (as the meadow's edgeRound)
function edgeRound(h, x, z) {
  const e = edgeOf(R, x, z);
  if (e >= 1.2) return h;
  const t = Math.max(0, e) / 1.2; return -1.9 + (h + 1.9) * (1 - (1 - t) * (1 - t));
}
export const heightAt = (x, z) => edgeRound(h0(x / S, z / S) + bump(x, z), x, z); // 28-6 지형 도장
export const depthAt = (x, z) => WATER_Y - heightAt(x, z);

// Footprints of placed props; filled by props.js, read by free()/walkable().
export const occupied = [];
export function free(x, z, r) {
  if (!inRect(O, x, z, 1.5) || Z.wd(x, z, true) < r + 0.8) return false;
  if (dist2D(sPts, x, z) < SW + r + 0.9) return false;
  if (shore(x, z) < r + 0.9) return false;
  for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
  return true;
}
const inBoard = (x, z) => x > O[0] + 1.8 && x < O[1] - 1.8 && z > -22.5 && z < O[3] - 2.5; // 0.4 wider than the meadow's: the side rim
const clearOf = (x, z) => {
  for (const o of occupied) if (o.r > 0.9 && Math.hypot(o.x - x, o.z - z) < o.r + 0.4) return false;
  for (const d of decor) if (!d.water && !d.open && (!d.nat || d.r > 0.9) && Math.hypot(d.x - x, d.z - z) < d.r + (d.nat ? 0.4 : 0.6)) return false; // open: walked over or under; nat (22-1): as occupied
  return true;
};
// dry ground animals walk on: the rim and the hill, and the islands' tops (0.5 in from their waterline; inbox 10)
export function walkable(x, z) {
  return inBoard(x, z) && dist2D(sPts, x, z) > SW + 1.7 && (shore(x, z) > 1.3 || isle(x, z) < -0.5) && (Z.wd(x, z) > 1.0 || Z.walkIn(x, z)) && clearOf(x, z); // walkIn: the isle zone's island and its bridge
}
// the rim and the hill only (a spawn, a drop from the nest: the flamingo could not wade off the middle island)
export const mainland = (x, z) => shore(x, z) > 1.3 && walkable(x, z);
// where a water animal may also go (MODELS walk.water): the bank and the pond ('swim'), or the bank and the shallow water
// ('wade', the rim and round the islands). Never the stream.
export function wet(x, z, kind) {
  if (!inBoard(x, z) || shore(x, z) > 1.4 || !clearOf(x, z)) return false;
  return kind === 'swim' || depthAt(x, z) < 0.45;
}
// a spot in the water for one heading in from (x, z): off the shelf ('swim'), or on the shallow shelf ('wade'); round the
// pond from where it is, so the way there stays in the shallows
// pond from where it is, so the way there stays in the shallows. Now and then (inbox 10) by an island instead: from there
// it walks up onto it (walk.js picks dry ground near it), if the way was all water it may go in (pathClear in walk.js)
export function waterSpot(kind, x0, z0) {
  const a0 = Math.atan2(z0 - pond.z, x0 - pond.x), I = Math.random() < 0.3 && islands[Math.floor(Math.random() * islands.length)];
  for (let k = 0; k < 40; k++) {
    let x, z;
    if (I) { const a = Math.random() * 2 * Math.PI, r = I.r + 0.3 + Math.random() * (kind === 'swim' ? 1.8 : 0.7); x = I.x + Math.cos(a) * r; z = I.z + Math.sin(a) * r; }
    else { const a = a0 + (Math.random() - 0.5) * 1.6, s = kind === 'swim' ? -1.3 - Math.random() * 4.5 : -0.4 - Math.random() * 2.3, r = shoreR(a) + s; x = pond.x + Math.cos(a) * r; z = pond.z + Math.sin(a) * r; }
    if (wet(x, z, kind) && depthAt(x, z) > 0.05) return [x, z];
  }
  return null;
}

// Decor props the player placed (서식지 꾸미기), kept in step with the save by habitat.js (as in the meadow)
export const decor = [];
export function placeable(x, z, r, water, dry) { // dry: as meadow's
  const ok = water ? shore(x, z) < -(r + 0.6) && isle(x, z) > r + 0.9
    : free(x, z, r) && (dry || walkable(x, z)) && bridgeEnds.every(b => Math.hypot(b.x - x, b.z - z) > r + 1.6);
  return ok && decor.every(d => Math.hypot(d.x - x, d.z - z) > (d.nat && d.open ? 0.4 : d.r) + r + 0.1); // a wildflower patch: only its middle
}

// A straight line every 0.5 of which passes ok (walkable by default; walk.js passes its own for water animals)
export function pathClear(x1, z1, x2, z2, ok = walkable) {
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5);
  for (let i = 1; i <= n; i++) if (!ok(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return false;
  return true;
}

let seed = 11;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// 21-3b: the board for 땅 넓히기 step L, with the zone of step `top` built (under mist). Before each build (habitat.js):
// the lists the build fills start empty, the random from its seed
export function setLevel(L, top = L) {
  O = openAt(L); R = openAt(Math.max(L, top)); Z = zoneSet('pond', Math.max(L, top));
  pond = { x: pond0.x * S, z: pond0.z * S, r: RX * S, k: RZ / RX, lanes: [0.15, 0.66] };
  hill = { x: hill0.x * S, z: hill0.z * S, r: hill0.r * S };
  islands = islands0.map(I => ({ x: I.x * S, z: I.z * S, r: I.r * S }));
  SW = SW0 * S; stream = new THREE.CatmullRomCurve3(streamAt0.map(([x, z]) => new THREE.Vector3(x * S, 0, z * S))); sPts = stream.getSpacedPoints(200);
  bP = stream.getPointAt(bridgeT); bTan = stream.getTangentAt(bridgeT); bN = new THREE.Vector3(-bTan.z, 0, bTan.x).normalize();
  BL = 5.2 * S; BRIDGE_END = 3.4 * S; bridgeEnds = [-1, 1].map(s => bP.clone().addScaledVector(bN, s * BRIDGE_END));
  occupied.length = 0; decor.length = 0; seed = 11;
}
setLevel(0);
