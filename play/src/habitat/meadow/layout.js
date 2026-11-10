// Meadow layout: board size, stream/pond/path curves, height field, placement rules.
// Everything that needs to know "where is what" in the meadow reads from here.
import * as THREE from 'three';
import { bump } from '../stamps.js';
import { BOARD0, rectAt, zoneSet, edgeOf, inRect, polyD } from '../zones.js';

// the first board: 36 wide (x), 58 deep (z). 28-1 땅 넓히기: each step adds a zone, a strip along one side (zones.js); the next
// step's zone is built too, under mist (habitat mist.js). R: the board as built, O: the open (unmisted) ground, [x0, x1, z0, z1];
// Z: the zones built (their hills, pools, rills, spots)
export const BW0 = 36, BD0 = 58;
export const openAt = L => rectAt('meadow', L);
export let R = [...BOARD0], O = [...BOARD0], Z = zoneSet('meadow', 0);
export const SW = 1.9;         // stream half-width

export const stream = new THREE.CatmullRomCurve3([
  new THREE.Vector3(15, 0, -29), new THREE.Vector3(9, 0, -17), new THREE.Vector3(-1, 0, -9),
  new THREE.Vector3(4, 0, 2), new THREE.Vector3(-4, 0, 13), new THREE.Vector3(-13, 0, 29)
]);
export const sPts0 = stream.getSpacedPoints(300); // the stream on the first board (props.js plants it as before)
export let sPts = sPts0; // ... and carried on straight to the board's edge, front and back (setLevel)
export const pond = { x: 9, z: 13, r: 4.6 };
export const bridgeT = 0.47;
export const bP = stream.getPointAt(bridgeT), bTan = stream.getTangentAt(bridgeT);
export const bN = new THREE.Vector3(-bTan.z, 0, bTan.x).normalize();
// Bridge deck: BL long across the stream (along bN), arched; deckY(l) is the plank top at l from its centre.
export const BL = 6.6, bridgeArch = u => 0.12 + (1 - (2 * u) ** 2) * 0.62;
export const deckY = l => bridgeArch(l / BL) + 0.08;
// Animal path over the bridge: the two walkable landings just past the banks. Horses hop to one, then walk
// the deck to the other (horse.js 'cross'); the stream band in between is not walkable, so this is the only way.
export const BRIDGE_END = 4.4;
export const bridgeEnds = [-1, 1].map(s => bP.clone().addScaledVector(bN, s * BRIDGE_END));
// plank top under (x, z), or -Infinity off the deck (it is 2.3 wide)
export function deckAt(x, z) {
  const dx = x - bP.x, dz = z - bP.z, l = dx * bN.x + dz * bN.z, w = dx * bN.z - dz * bN.x;
  return Math.abs(l) <= BL / 2 && Math.abs(w) < 1.15 ? deckY(l) : -Infinity;
}
export const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-8.0, 0, -16.8), new THREE.Vector3(-7.8, 0, -11),
  bP.clone().addScaledVector(bN, -4.2), bP.clone().addScaledVector(bN, 4.2),
  new THREE.Vector3(6, 0, 6), new THREE.Vector3(3, 0, 20), new THREE.Vector3(5, 0, 29)
]);
export const pPts0 = path.getSpacedPoints(300);
export let pPts = pPts0;
// points on from p along the unit vector tn, every 0.25 for len
const straight = (p, tn, len) => Array.from({ length: Math.max(0, Math.ceil(len / 0.25 - 1e-6)) }, (_, i) => p.clone().addScaledVector(tn, Math.min(len, (i + 1) * 0.25)));
// the stream's water line (meadow water.js): the curve, N + 1 points, with its straight run on to the edge at both ends
export function streamLine(N) {
  const a = stream.getPointAt(0), ta = stream.getTangentAt(0), b = stream.getPointAt(1), tb = stream.getTangentAt(1);
  return [...straight(a, ta.clone().negate(), (a.z - R[2]) / ta.z).reverse().map(p => ({ p, tn: ta })),
    ...Array.from({ length: N + 1 }, (_, i) => ({ p: stream.getPointAt(i / N), tn: stream.getTangentAt(i / N) })),
    ...straight(b, tb, (R[3] - b.z) / tb.z).map(p => ({ p, tn: tb }))];
}
export const paddock = { x: -7.5, z: -18, w: 14, d: 7 }; // widened right in step 12: the barn and hay fill the left half
// Fence lines [x1, z1, x2, z2]: the paddock (gate gap of 2.6 in the middle of its front side) and two
// loose stretches. props.js builds posts and rails from these; walkable() keeps animals off them.
export const GATE = 1.3;
export const fences = (() => {
  const { x, z, w, d } = paddock, x1 = x - w / 2, x2 = x + w / 2, z1 = z - d / 2, z2 = z + d / 2;
  return [[x1, z1, x2, z1], [x1, z1, x1, z2], [x2, z1, x2, z2], [x1, z2, x - GATE, z2], [x + GATE, z2, x2, z2],
    [9.5, 27.3, 17, 25.6], [-17, -1.2, -12.6, 0.6]];
})();
const segDist = (x, z, [x1, z1, x2, z2]) => {
  const dx = x2 - x1, dz = z2 - z1, t = THREE.MathUtils.clamp(((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - x1 - dx * t, z - z1 - dz * t);
};

export function dist2D(pts, x, z) { let m = 1e9; for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// Raised back shelf (forest) with a short rounded cliff; the stream falls off it.
export const PLAT_H = 1.7, CLIFF_Z = -23.6;
export const plateau = z => PLAT_H * sm((CLIFF_Z - z) / 1.3);
// Water surface height along the stream/pond. Rest level -0.55, lifted on the shelf.
export const WATER_Y = -0.55;
export const waterY = z => WATER_Y + plateau(z);

// Rolling meadow: a few soft sine octaves (cheap and smooth, no visible grid).
function hills(x, z) {
  return 0.5 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.15 + 0.4)
    + 0.32 * Math.sin(x * 0.08 - z * 0.12 + 2.0)
    + 0.12 * Math.sin(x * 0.55 + z * 0.43) * Math.cos(z * 0.41 - x * 0.2);
}
// Cushion bank: flat bed, steep start, rounded shoulder (like a moulded edge). d = distance from water centre line.
function bankDepth(d, w) { const t = THREE.MathUtils.clamp((d - (w - 0.9)) / 1.5, 0, 1); return 1.25 * (1 - t) * (1 - t); }
// Board edge: everything rounds down onto the soil base.
export function edgeRound(h, x, z) {
  const e = edgeOf(R, x, z);
  if (e >= 1.2) return h;
  const t = Math.max(0, e) / 1.2; return -1.9 + (h + 1.9) * (1 - (1 - t) * (1 - t));
}

export function heightAt(x, z) {
  const ds = dist2D(sPts, x, z), dp = Math.hypot(x - pond.x, z - pond.z);
  const near = Math.min(ds - SW, dp - pond.r, Z.wd(x, z, true) - 0.4); // 28-1: and the zones' pools and rills
  const k = sm((near - 0.4) / 3.5);
  // paddock floor is kept nearly flat so the barn and fence sit level
  const pad = sm((paddock.w / 2 + 2 - Math.abs(x - paddock.x)) / 2) * sm((paddock.d / 2 + 2 - Math.abs(z - paddock.z)) / 2);
  let h = hills(x, z) * k * (1 - 0.8 * pad) * (1 - Z.flat(x, z)) + plateau(z) + Z.lift(x, z);
  h -= Math.max(bankDepth(ds, SW), bankDepth(dp, pond.r), Z.dip(x, z));
  const dpath = dist2D(pPts, x, z); if (dpath < 1.0 && ds > SW + 0.3) h -= 0.07 * sm(1 - dpath);
  return edgeRound(h + bump(x, z), x, z); // 28-6 지형 도장
}

// Footprints of placed props; filled by props.js, read by free()/walkable().
export const occupied = [];

// open ground for a prop of radius r inside the rect b (sp, pp: the stream's and path's points; zones: off the zones' water and paths)
export const freeOf = (b, sp = sPts, pp = pPts, zones = true) => (x, z, r) => {
  if (!inRect(b, x, z, 1.5)) return false;
  if (zones && (Z.wd(x, z, true) < r + 0.8 || Z.paths.some(f => polyD(x, z, f.pts) < f.w + 0.4 + r))) return false;
  if (dist2D(sp, x, z) < SW + r + 0.8) return false;
  if (Math.hypot(x - pond.x, z - pond.z) < pond.r + r + 0.8) return false;
  if (dist2D(pp, x, z) < 1.4 + r) return false;
  if (x > paddock.x - paddock.w / 2 - 1 - r && x < paddock.x + paddock.w / 2 + 1 + r && z > paddock.z - paddock.d / 2 - 1 - r && z < paddock.z + paddock.d / 2 + 1 + r) return false;
  for (const o of occupied) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
  return true;
};
export const freeBase = freeOf(BOARD0, sPts0, pPts0, false); // the first board, as it was (props.js)
export let free = freeOf(O); // the open ground now

// Horses are billboards 2.9 wide that tilt back with the camera (which always looks from the +z side, at
// 26-64 deg elevation). So beside a building they keep their half-width HR, and in front of one they need a
// deeper gap, or the top of the sprite sinks into the wall behind it. box: [half-width x, half-depth z, front gap].
export const HR = 1.5;
const inBox = (x, z, { x: bx, z: bz, box: [hw, hd, front] }) => Math.abs(x - bx) < hw + HR && z > bz - hd - 0.4 && z < bz + hd + front;

// ...and the same for fence rails behind a horse (0.85 high): none may pass through the strip 0.2-1.3 behind it.
const FENCE_BACK = 1.3;
function railBehind(x, z, [x1, z1, x2, z2]) { // Liang-Barsky clip of the fence segment against that strip
  let t0 = 0, t1 = 1; const dx = x2 - x1, dz = z2 - z1;
  for (const [p, q] of [[-dx, x1 - (x - HR)], [dx, x + HR - x1], [-dz, z1 - (z - FENCE_BACK)], [dz, z - 0.2 - z1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

export function walkable(x, z) {
  if (x < O[0] + 2.2 || x > O[1] - 2.2 || z < -22.5 || z > O[3] - 2.5) return false;
  if (dist2D(sPts, x, z) < SW + 2.2) return false;
  if (Z.wd(x, z) < 1.0) return false; // 28-1: a zone's pool or rill
  if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 2.0) return false;
  for (const o of occupied) if (o.box ? inBox(x, z, o) : o.r > 0.9 && Math.hypot(o.x - x, o.z - z) < o.r + 0.4) return false;
  for (const d of decor) if (!d.water && !d.open && (!d.nat || d.r > 0.9) && Math.hypot(d.x - x, d.z - z) < d.r + (d.nat ? 0.4 : 0.6)) return false; // open: walked over or under; nat (22-1): as occupied
  for (const f of fences) if (segDist(x, z, f) < 0.6 || railBehind(x, z, f)) return false;
  return true;
}

// Decor props the player placed (서식지 꾸미기): habitat.js keeps this list in step with the save. Animals walk round them
// (walkable, and each is a crowd.js body), and nothing else goes on them.
export const decor = [];
// Where a decor prop of radius r may stand. water: on the pond, off its rim. Land: open ground as free() sees it (board edge,
// stream, pond, path, paddock with the barn, trees and rocks) that animals can reach (walkable), off the loose fences and the
// bridge and its landings. Never on another prop. (The meadow nest is a button, not a spot on the board: nothing to keep clear.)
export function placeable(x, z, r, water, dry) { // dry (28-4, rail pieces and the rail bridge's ends): dry open ground, not kept off the stream as far as walkers are
  const ok = water ? Math.hypot(x - pond.x, z - pond.z) < pond.r - r - 0.4
    : free(x, z, r) && (dry || walkable(x, z)) && fences.every(f => segDist(x, z, f) > r + 0.4) && bridgeEnds.every(b => Math.hypot(b.x - x, b.z - z) > r + 1.6);
  return ok && decor.every(d => Math.hypot(d.x - x, d.z - z) > (d.nat && d.open ? 0.4 : d.r) + r + 0.1); // a wildflower patch: only its middle
}

export const inPaddock = (x, z) => Math.abs(x - paddock.x) < paddock.w / 2 && Math.abs(z - paddock.z) < paddock.d / 2;

// A hop is a straight line: every point on it must be walkable, so animals go round fences, water and
// big props instead of jumping through them (0.5 steps < 2 x the 0.6 fence margin, so no fence slips between).
// The paddock keeps whoever is in it: no hop starts on one side of its fence and ends on the other.
export function pathClear(x1, z1, x2, z2) {
  if (inPaddock(x1, z1) !== inPaddock(x2, z2)) return false;
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5);
  for (let i = 1; i <= n; i++) if (!walkable(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return false;
  return true;
}

// Seeded random so the meadow looks the same every visit.
let seed = 7;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// 21-3b: the board for 땅 넓히기 step L, with the zone of step `top` built (under mist). Before each build (habitat.js):
// the lists the build fills start empty, the random from its seed
export function setLevel(L, top = L) {
  O = openAt(L); R = openAt(Math.max(L, top)); Z = zoneSet('meadow', Math.max(L, top));
  const a = stream.getPointAt(0), ta = stream.getTangentAt(0), b = stream.getPointAt(1), tb = stream.getTangentAt(1), pe = path.getPointAt(1), pt = path.getTangentAt(1);
  sPts = [...straight(a, ta.clone().negate(), (a.z - R[2]) / ta.z).reverse(), ...sPts0, ...straight(b, tb, (R[3] - b.z) / tb.z)];
  pPts = [...pPts0, ...straight(pe, pt, (R[3] - pe.z) / pt.z)];
  free = freeOf(O); occupied.length = 0; decor.length = 0; seed = 7;
}
