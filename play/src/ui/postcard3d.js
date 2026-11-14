// 78 엽서 사진 (inbox 78 pilot; 79-2 all six places): a postcard's picture is a toy photo of the friend at the place it went. When it comes back
// (a card from before: when the album first shows it) one offscreen renderer shoots it once: its own figure in its own look,
// in a small diorama of the place made of the habitat's parts (its ground, the pond's water shader, trees, reeds, flowers,
// lily pads), lit and posed as its line says, from low down with the background out of focus. The picture (≤ 30 KB) is kept
// in IndexedDB, so a card is shot once. Each place's diorama is built the first time a card of it is shot, and kept.
import * as THREE from 'three';
import { makeSkyEnv, nightGlow, snowNow, rainNow, windTime } from '../habitat/toyKit.js';
import { TIMES } from '../habitat/daylight.js';
import { terrainMesh } from '../habitat/meadow/terrain.js';
import { vert, frag } from '../habitat/meadow/water.js';
import { kit, emptyL, finish, flowerCluster, flowerPal, addPads, addReeds, decorModel } from '../habitat/meadow/props.js';
import { makeFigure, loadModel, loadAcc } from '../animals/figure.js';
import { MODELS } from '../game/data.js';
import { SP } from '../game/rules.js';

export const PHOTO_PLACES = ['brook', 'flowers', 'hill', 'forest', 'lake', 'path']; // 79-2: all the walks' places (firehill, the 신수's, keeps stroll.js SCENES)
const W = 840, H = 560, FOV = 24, BLUR = 11, M = 2 * BLUR; // the picture; vertical field of view; the strongest blur (px); the margin shot round it for the blur

// ---- how each place's lines (data.js PLACES) are shot. t: the light (daylight.js TIMES); land: where a walker is (by water: [x,
// how far up the bank]; elsewhere [x, z]), swim: a swimmer ([x, that far out on the water]; where there is none it stands at land);
// y: stands this high (a stepping stone); p: its pose; face: where it looks (0: to the frame's left, side on; 90: away; -90: at
// us; 180: right); cam: where the camera is from it ([x, z]), el: how high (degrees),
// fill: the friend's share of the frame's width, at: where in the frame [x, y] (-0.5..0.5); sun: [left/right of the view, up]
// (degrees); boat: the duck boat [ahead, right] of the friend; add: a little thing of the line put by it when it is shot (ADD)
const ST = { sq: 1, rot: 0, gait: 'still', ph: 0 };
const WY = -0.3, BOARD = [-30, 28, -44, 28];
const sm = (a, b, t) => { t = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }; // (either way round)
const hills = (x, z) => (3 * sm(-25, -36, z) + 2.4 * sm(9, 20, z)) * (0.75 + 0.25 * Math.sin(x * 0.27)); // the wooded rise far off and behind
const roll = (x, z) => 0.25 * Math.sin(x * 0.4 + 1) * Math.cos(z * 0.33);

// the lake: an oval of water with a shelving bank, meadow round it, a wooded hill beyond (and behind the near bank)
const LC = { x: -1, z: -13, r: 11 };
const lakeD = (x, z) => { const dx = x - LC.x, dz = (z - LC.z) * 1.3, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) - LC.r - 0.7 * Math.sin(a * 3 + 1) - 0.4 * Math.sin(a * 5 + 2); }; // < 0: water
// the brook: a shallow winding stream across, stepping stones over it at x = STEP
const bz = x => -5 + 1.6 * Math.sin(x * 0.22), bw = x => 1.9 + 0.35 * Math.sin(x * 0.5 + 1), STEP = 1.2;
const brookD = (x, z) => Math.abs(z - bz(x)) - bw(x);
// the hill: one big round hill, its top at HC
const HC = { x: 0, z: -4 }, hillH = (x, z) => 4.2 * Math.exp(-((x - HC.x) ** 2 + ((z - HC.z) * 1.2) ** 2) / 70);
// the path: a dirt path going away from us, a fence along its right
const px = z => 1.2 * Math.sin(z * 0.11 + 0.4), pathD = (x, z) => Math.abs(x - px(z)) - 0.85 - 0.1 * Math.sin(z * 0.7);

const PL = {
  lake: { seed: 78, wd: lakeD, zc: () => LC.z, fall: 3.5, plane: [LC.x - LC.r - 1.5, LC.x + LC.r + 1.5, LC.z - LC.r / 1.3 - 1.5, LC.z + LC.r / 1.3 + 1.5], mirror: [0.5, 0.38],
    h: (x, z) => { const d = lakeD(x, z); return d < 0 ? Math.max(WY - 3.4, WY + 0.05 + d * 1.5) : WY + 0.05 + 0.5 * sm(0, 2.5, d) + roll(x, z) * sm(2, 6, d) + hills(x, z); },
    shots: [
      { t: 1, land: [0.6, 0.2], swim: [0.6, -1.5], p: { ...ST, rot: -0.45 }, face: -55, cam: [0.4, -1], el: 5, fill: 0.36, at: [-0.08, 0.17], sun: [150, 48] }, // its face in the water
      { t: 1, land: [-2, 1.2], swim: [-2, -1.4], p: ST, face: 140, cam: [-0.5, 1], el: 8, fill: 0.3, at: [-0.25, -0.1], sun: [-125, 52], boat: [11, 5] }, // the duck boat going by
      { t: 2, land: [0.4, 1], swim: [0.4, -1.3], p: { ...ST, sq: 0.95, lie: 1 }, face: 20, cam: [0.5, 0.9], el: 9, fill: 0.36, at: [0.2, -0.14], sun: [-9, 3.5] }, // till the sun went down
    ] },
  brook: { seed: 79, wd: brookD, zc: bz, fall: 1.4, plane: [BOARD[0], BOARD[1], -16, 6], mirror: [0.35, 0.3],
    h: (x, z) => { const d = brookD(x, z); return d < 0 ? Math.max(WY - 0.7, WY + 0.05 + d * 0.5) : WY + 0.05 + 0.45 * sm(0, 2, d) + roll(x, z) * sm(2, 6, d) + hills(x, z); },
    shots: [
      { t: 1, land: [-1.5, -0.7], swim: [-1.5, -1.3], p: { ...ST, rot: -0.2 }, face: -20, cam: [0.6, 1], el: 7, fill: 0.36, at: [0, 0.05], sun: [-130, 50] }, // its feet in the water
      { t: 1, land: [STEP, -2.25], swim: [STEP, -2.25], y: WY + 0.24, p: ST, face: 0, cam: [1, 0.6], el: 9, fill: 0.3, at: [0.08, 0], sun: [-60, 45] }, // across the stepping stones
      { t: 1, land: [3.5, 1.1], swim: [3.5, -1], p: { ...ST, sq: 0.95, lie: 1, shut: 1 }, face: 30, cam: [0.3, 1], el: 10, fill: 0.36, at: [0.05, -0.1], sun: [-140, 55] }, // asleep to the water's sound
    ] },
  flowers: { seed: 80, clear: 1.1,
    h: (x, z) => WY + 0.5 + roll(x, z) + hills(x, z),
    shots: [
      { t: 1, land: [0, 0], p: { ...ST, rot: -0.4 }, face: -10, cam: [0.5, 1], el: 6, fill: 0.36, at: [0.05, 0], sun: [-130, 52], add: 'yellow' }, // smelling the yellow flowers
      { t: 1, land: [-5, 3], p: { ...ST, rot: 0.3 }, face: 15, cam: [-0.4, 1], el: 6, fill: 0.36, at: [0.1, -0.08], sun: [-110, 50], add: 'butterfly' }, // after the butterflies
      { t: 2, land: [5, 1.5], p: ST, face: 0, cam: [0.2, 1], el: 24, fill: 0.36, at: [0, -0.05], sun: [-160, 20], add: 'petal' }, // a petal on its back
    ] },
  hill: { seed: 81, clouds: 1,
    h: (x, z) => WY + 0.3 + hillH(x, z) + 0.2 * roll(x, z) + hills(x, z) * 0.6,
    shots: [
      { t: 1, land: [HC.x, HC.z], p: { ...ST, rot: 0.15 }, face: -30, cam: [0.3, 1], el: 2, fill: 0.3, at: [0.05, -0.18], sun: [-120, 45] }, // in the wind on the top
      { t: 1, land: [5, 4.5], p: { ...ST, sq: 0.95, lie: 1, rot: -0.1 }, face: 35, cam: [0.5, 1], el: 6, fill: 0.36, at: [0, -0.05], sun: [-130, 50] }, // resting on the hillside
      { t: 2, land: [-3, 1], p: { ...ST, sq: 0.95, lie: 1, rot: 0.3 }, face: 10, cam: [-0.3, 1], el: 3, fill: 0.3, at: [0.05, -0.25], sun: [-150, 14] }, // counting the clouds
    ] },
  forest: { seed: 82, woods: 1,
    h: (x, z) => WY + 0.4 + roll(x, z) * 1.4 + hills(x, z) * 0.7,
    shots: [
      { t: 1, land: [0, 0], p: { ...ST, rot: -0.3 }, face: -15, cam: [0.4, 1], el: 8, fill: 0.36, at: [0, 0], sun: [-150, 60], add: 'acorn' }, // an acorn picked up
      { t: 1, land: [-6, 3], p: { ...ST, sq: 0.95, lie: 1 }, face: 20, cam: [0.2, 1], el: 9, fill: 0.32, at: [0.1, -0.12], sun: [160, 55], shade: [1.6, 1.2] }, // resting in a tree's shade
      { t: 1, land: [6, 2], p: { ...ST, rot: 0.1 }, face: 0, cam: [0.5, 1], el: 6, fill: 0.3, at: [0.18, 0], sun: [-120, 55], add: 'squirrel' }, // eye to eye with a squirrel
    ] },
  path: { seed: 83, path: 1,
    h: (x, z) => WY + 0.45 + roll(x, z) * sm(1, 4, pathD(x, z)) + hills(x, z),
    shots: [
      { t: 2, land: [px(2), 2], p: ST, face: 80, cam: [-0.25, 1], el: 7, fill: 0.24, at: [0, -0.12], sun: [-8, 6] }, // to the path's end
      { t: 1, land: [px(-4) + 1.3, -4], p: { ...ST, rot: 0.15 }, face: 60, cam: [-1, 0.35], el: 7, fill: 0.3, at: [-0.1, -0.05], sun: [-120, 50] }, // peeping over the fence
      { t: 1, land: [-3, 4], p: { ...ST, rot: -0.45 }, face: -20, cam: [0.4, 1], el: 9, fill: 0.36, at: [0.05, 0], sun: [-140, 55], add: 'clover' }, // a four-leaf clover
    ] },
};

// the bank's edge at x: out from the water's middle toward +z until the ground is d from the waterline (< 0: on the water)
const shore = (P, x, d) => { let z = P.zc(x); while (P.wd(x, z) < d && z < P.zc(x) + 20) z += 0.05; return z; };
// a shot's frame on the ground: the friend's spot, f the way the camera looks, r its right (unit [x, z]); and its sun
function frameOf(P, S, swim) {
  const [x, b] = swim && S.swim ? S.swim : S.land, n = Math.hypot(...S.cam), f = [-S.cam[0] / n, -S.cam[1] / n], r = [-f[1], f[0]];
  const deg = THREE.MathUtils.degToRad, [az, el] = S.sun.map(deg), h = [f[0] * Math.cos(az) + r[0] * Math.sin(az), f[1] * Math.cos(az) + r[1] * Math.sin(az)];
  return { x, z: P.wd ? shore(P, x, b) : b, f, r, sun: new THREE.Vector3(h[0] * Math.cos(el), Math.sin(el), h[1] * Math.cos(el)) };
}

// the sky the camera (and the water) sees: a dome in the photo's own colours (the light's env map, toyKit makeSkyEnv, is pale
// by design: it lights, it is not looked at), three bands up from the horizon, the sun's glow round it and its disc
const SKY = { 1: [0xeaf2ec, 0xbfdcef, 0x86bce8, 0xfff2d8], 2: [0xffb47c, 0xf29ba4, 0x7f7abd, 0xffe3a8] }; // horizon, a quarter up, top, glow
const raw = h => new THREE.Color().setHex(h, THREE.LinearSRGBColorSpace); // (drawn as given: no tone mapping on the dome)
const mat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });

function buildPlace(R, id) {
  const P = PL[id], scene = new THREE.Scene(), L = emptyL(), occupied = [], heightAt = P.h, wd = P.wd || (() => 9);
  let s = P.seed; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647; // the same place every time
  const K = kit(L, { rand, heightAt, occupied });
  // kept clear: each shot's way from the friend to its camera (nothing tall in it), round the friend (nothing at all), a low sun's way out over the far trees
  const shots = P.shots.flatMap(S => [frameOf(P, S, false), frameOf(P, S, true)]), lows = shots.filter((F, i) => P.shots[i >> 1].sun[1] < 25);
  const inWay = (x, z) => shots.some(F => { const dx = x - F.x, dz = z - F.z, a = -(dx * F.f[0] + dz * F.f[1]), b = Math.abs(dx * F.r[0] + dz * F.r[1]); return a > -2 && a < 34 && b < 2.6 + a * 0.16; });
  const near = (x, z, m) => shots.some(F => Math.hypot(x - F.x, z - F.z) < m);
  const sunWay = (x, z) => lows.some(F => { const dx = x - F.x, dz = z - F.z, h = Math.hypot(F.sun.x, F.sun.z); return (dx * F.sun.x + dz * F.sun.z) / h / Math.hypot(dx, dz) > Math.cos(0.3); });
  const free = (x, z, m) => wd(x, z) > m && !occupied.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.3);
  const C = h => new THREE.Color(h), gMid = C('#76b33c'), gBright = C('#9bcf48'), gDeep = C('#5c9a35'), gSlope = C('#4f8a30'), wet = C('#cdb27a'), bed = C('#d9c79a'), bedDeep = C('#8fa07a'),
    litter = C('#8a7a3e'), dirt = C('#d6b383'), dirtEdge = C('#b99a62');
  terrainMesh(scene, heightAt, occupied, (col, x, z, h, ny) => {
    const d = wd(x, z);
    col.copy(gMid).lerp(gBright, (0.5 + 0.5 * Math.sin(x * 0.23 + 0.7) * Math.cos(z * 0.19 - 0.4)) * 0.8).lerp(gDeep, 0.3 * sm(-1, 1, Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7)));
    col.lerp(gSlope, sm(0.93, 0.68, ny) * 0.6);
    if (P.woods) col.lerp(gDeep, 0.45).lerp(litter, 0.35 * sm(-0.3, 1, Math.sin(x * 1.3 + z * 0.4) * Math.cos(z * 1.1 - x * 0.3))); // the wood's floor: deeper, old leaves
    if (P.path) { const q = pathD(x, z); col.lerp(dirtEdge, sm(0.35, 0, q) * 0.8).lerp(dirt, sm(0, -0.25, q)); }
    if (P.wd) { col.lerp(wet, sm(0.6, 0.05, d) * 0.85); if (d < 0) col.copy(bed).lerp(bedDeep, sm(0, -2.5, d)); } // wet sand at the waterline, then the bed
  }, BOARD);
  const flowers = (n, x0, x1, z0, z1, ok, pal = flowerPal) => { for (let i = 0; i < n; i++) { const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0); if (free(x, z, 1) && ok(x, z)) flowerCluster(L, x, z, pal[Math.floor(rand() * pal.length)], (x, z) => free(x, z, 0.8) && ok(x, z), rand, K.jitter, heightAt); } };
  const clear = P.clear ?? 3;

  // made for a shot: stepping stones, the shade tree, the fence (before the rest, so it keeps clear of them)
  if (id === 'brook') for (let k = -2; k <= 2; k++) { const z = bz(STEP) + k * 1.0, x = STEP + (k % 2) * 0.15; occupied.push({ x, z, r: 0.5 }); L.rock.push({ x, y: WY - 0.1, z, s: [0.55, 0.36, 0.5], ry: k, c: K.jitter('#9c9486', 0.06) }); }
  if (id === 'forest') { const F = shots[2], [u, v] = P.shots[1].shade; K.tree(F.x + F.f[0] * u + F.r[0] * v, F.z + F.f[1] * u + F.r[1] * v, 1.5); }
  if (id === 'path') { // posts and two rails, as the meadow's (props.js fenceLine), along the path's right
    let prev = null;
    for (let z = 14; z > -40; z -= 1.6) { const x = px(z) + 1.9, y = heightAt(x, z); L.post.push({ x, y: y - 0.08, z, s: [1.15, 1.42, 1.15], ry: Math.PI / 2, c: K.jitter('#c88a4b', 0.04) }); occupied.push({ x, z, r: 0.35 });
      if (prev) { const span = Math.hypot(x - prev.x, z - prev.z), ry = -Math.atan2(z - prev.z, x - prev.x), rz = Math.atan2(y - prev.y, span); for (const yy of [0.6, 1.05]) L.rail.push({ x: (x + prev.x) / 2, y: (y + prev.y) / 2 + yy, z: (z + prev.z) / 2, s: [span, 1.2, 1.2], ry, rz, c: K.jitter('#d0955a', 0.04) }); }
      prev = { x, y, z }; }
  }
  // trees and pines: on the far rise and behind (seen from the water / the low camera); the wood everywhere
  const tree = (x, z) => free(x, z, 2) && !inWay(x, z) && !sunWay(x, z) && (!P.path || pathD(x, z) > 1.5) && (rand() < (P.woods ? 0.45 : 0.35) ? K.pine : K.tree)(x, z, 0.9 + rand() * 0.5);
  for (const [z0, z1] of [[-25, -36], [11, 22]]) for (let x = BOARD[0] + 1; x < BOARD[1] - 1; x += 2.2 + rand() * 2) tree(x, z0 + (z1 - z0) * rand());
  if (P.woods) for (let i = 0; i < 160; i++) tree(BOARD[0] + rand() * (BOARD[1] - BOARD[0]), -25 + rand() * 36);
  if (id === 'hill' || id === 'flowers' || id === 'path') for (let i = 0; i < 10; i++) { const x = BOARD[0] + rand() * (BOARD[1] - BOARD[0]), z = -22 + rand() * 30; if (!near(x, z, 9)) tree(x, z); } // a few on their own
  const bushes = P.woods ? 60 : 24;
  for (let i = 0; i < bushes; i++) { const x = -20 + rand() * 40, z = -20 + rand() * 30; if (free(x, z, 1) && !inWay(x, z) && !near(x, z, 2.5) && (!P.path || pathD(x, z) > 1)) K.bush(x, z, 0.8 + rand() * 0.5); }
  if (id === 'lake') {
    for (let i = 0; i < 40; i++) { const a = rand() * Math.PI * 2, k = LC.r + 2 + rand() * 2, x = LC.x + Math.cos(a) * k, z = LC.z + Math.sin(a) * k / 1.3; if (free(x, z, 1) && !inWay(x, z)) K.bush(x, z, 0.8 + rand() * 0.5); }
    for (let i = 0; i < 10; i++) { const x = LC.x + (rand() - 0.5) * 22, z = LC.z - 4 - rand() * 6; if (lakeD(x, z) > -0.2 && lakeD(x, z) < 0.8 && !inWay(x, z)) K.tuft(x, z); } // reeds on the far side
  }
  if (P.wd) for (let x = BOARD[0] + 3; x < BOARD[1] - 3; x += 3 + rand() * 4) { const z = shore(P, x, 0.05); if (wd(x, z) < 1 && !inWay(x, z) && !near(x, z, 2)) K.tuft(x, z); } // reeds where the near bank meets the water
  if (id === 'brook') for (let x = BOARD[0] + 3; x < BOARD[1] - 3; x += 4 + rand() * 4) { const z = bz(x) - bw(x) - 0.2; if (!inWay(x, z) && !near(x, z, 2)) K.tuft(x, z); } // and on its far bank
  if (id === 'brook') for (let i = 0; i < 30; i++) { const x = -18 + rand() * 36, z = bz(x) + (rand() - 0.5) * 2 * (bw(x) + 0.6); if (Math.abs(x - STEP) > 1.2 && !near(x, z, 1.5) && !inWay(x, z)) L.rock.push({ x, y: heightAt(x, z) - 0.05, z, s: 0.2 + rand() * 0.25, ry: rand() * 6, c: K.jitter('#a9a294', 0.08) }); } // pebbles and stones in the stream
  for (const [x, z, k] of [[-6.5, -2.5, 0.8], [7.5, -1.5, 0.6], [-11, -4, 1], [12, -6, 0.9]]) if (!inWay(x, z) && free(x, z, 0.5) && !near(x, z, 2)) K.rock(x, z, k);
  // flowers: a few round the meadows, the flower field full of them (up to the friend), few in the wood's shade
  const off = (x, z) => !near(x, z, clear) && (!P.path || pathD(x, z) > 0.4);
  if (id === 'flowers') { flowers(240, -22, 22, -24, 14, off); flowers(30, -10, 10, -6, 8, off, [['#ffd447', '#f08a24'], ['#ffffff', '#ffcf33']]); }
  else flowers(P.woods ? 6 : 26, -16, 16, -4, 14, off);
  for (let i = 0; i < (P.woods ? 900 : 1400); i++) { const x = BOARD[0] + rand() * (BOARD[1] - BOARD[0]), z = -30 + rand() * 50; if (free(x, z, 0.4) && !near(x, z, Math.min(clear, 2.5)) && (!P.path || pathD(x, z) > 0.1)) L.grass.push({ x, y: heightAt(x, z) - 0.03, z, s: 1 + rand() * 0.6, ry: rand() * 6, c: K.jitter('#5f9f36', 0.06) }); }
  finish(scene, L, { rand, occupied }); addReeds(scene, L);
  if (id === 'lake') { const pads = []; for (let i = 0; i < 40; i++) { const x = LC.x + (rand() - 0.5) * 22, z = LC.z + (rand() - 0.5) * 17, d = lakeD(x, z); if (d < -0.8 && d > -4 && !near(x, z, 3)) pads.push({ x, y: WY + 0.03, z, s: 0.6 + rand() * 0.5, ry: rand() * 6, c: K.jitter('#5fa83e', 0.08) }); } addPads(scene, pads); }
  if (P.clouds) { const cm = mat('#ffffff', { roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.25 }), g = new THREE.SphereGeometry(1, 20, 12); // toy clouds: lumps of round puffs, far up
    for (const [x, y, z, k] of [[-30, 22, -70, 5], [8, 28, -80, 6], [40, 20, -60, 4.5], [-55, 30, -40, 5], [25, 34, -45, 4]]) for (let j = 0; j < 5; j++) { const m = new THREE.Mesh(g, cm), q = j - 2; m.position.set(x + q * k * 0.75, y + (2 - Math.abs(q)) * k * 0.25, z + (rand() - 0.5) * k); m.scale.set(k * (0.9 - Math.abs(q) * 0.12), k * (0.75 - Math.abs(q) * 0.12), k * 0.7); scene.add(m); } }

  let water = null; const wu = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 7.3 }, uSun: { value: new THREE.Vector3() }, uLit: { value: new THREE.Color() }, uNight: { value: 0 }, uRain: { value: 0 }, uIce: { value: 0 }, uPond: { value: new THREE.Vector3() },
    uRefl: { value: null }, uRM: { value: new THREE.Matrix4() } };
  if (P.wd) { // the water: the pond's shader (its depth by a per-vertex edge, 1 at the bank), seeing the scene mirrored (uRefl, a pass of its own)
    const [x0, x1, z0, z1] = P.plane, wg = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) * 4), Math.round((z1 - z0) * 4)); wg.rotateX(-Math.PI / 2); wg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const wp = wg.attributes.position; wg.setAttribute('aFall', new THREE.Float32BufferAttribute(Array.from({ length: wp.count }, (_, i) => THREE.MathUtils.clamp(1 + wd(wp.getX(i), wp.getZ(i)) / P.fall, 0, 1.2)), 1));
    const RF = frag.replace('uniform float uTime;', 'uniform sampler2D uRefl; uniform mat4 uRM; uniform float uTime;')
      .replace('vec3 sky = mix(vec3(1.0, 0.91, 0.80), vec3(0.66, 0.83, 1.0), clamp(R.y * 1.3, 0.0, 1.0));', 'vec4 rq = uRM * vec4(vW, 1.0); vec3 sky = texture2D(uRefl, rq.xy / rq.w + n.xz * 0.03).rgb;')
      .replace('col = mix(col, sky, fres * 0.7 + 0.1);', `col = mix(col, sky, fres * ${P.mirror[0]} + ${P.mirror[1]});`).replace('mix(0.42, 0.8, depth)', 'mix(0.66, 0.92, depth)'); // still water: more mirror (the brook's shallower: its bed shows)
    water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: RF, defines: { POND: 1, BED: 1 }, uniforms: wu, fog: true, blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
    water.position.y = WY; water.renderOrder = 1; scene.add(water);
  }

  const su = { uSun: { value: new THREE.Vector3() }, uC: { value: [0, 1, 2, 3].map(() => new THREE.Color()) } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, uniforms: su,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uSun, uC[4];
      void main(){ float y = max(vD.y, 0.0), s = max(dot(normalize(vD), uSun), 0.0);
        vec3 c = mix(mix(uC[0], uC[1], smoothstep(0.0, 0.12, y)), uC[2], smoothstep(0.08, 0.6, y));
        c = mix(c, uC[3], pow(s, 10.0) * 0.75) + vec3(1.0, 0.97, 0.88) * smoothstep(0.99975, 0.9999, s);
        gl_FragColor = vec4(c, 1.0); }` }));
  dome.renderOrder = -1; scene.add(dome);

  const sun = new THREE.DirectionalLight(), fill = new THREE.DirectionalLight();
  sun.castShadow = true; sun.shadow.mapSize.setScalar(2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 80 });
  scene.add(sun, sun.target, fill);
  scene.fog = new THREE.Fog('#ffffff', P.woods ? 25 : 40, 170);
  const envs = new Map();
  // t: TIMES index; dir: toward the sun (each shot's own)
  const light = (t, dir) => {
    const T = TIMES[t], k = t + ':' + dir.toArray().map(v => v.toFixed(2));
    if (!envs.has(k)) envs.set(k, makeSkyEnv(R, dir, T)); scene.environment = envs.get(k);
    sun.color.set(T.col); sun.intensity = T.I * 1.05; su.uSun.value.copy(dir); wu.uSun.value.copy(dir);
    SKY[t].forEach((h, i) => su.uC.value[i].copy(raw(h)));
    wu.uLit.value.setRGB(...T.lit).lerp(new THREE.Color(1, 1, 1), 0.5);
    fill.color.set(T.col).lerp(new THREE.Color('#ffffff'), 0.5); fill.intensity = t === 2 ? 0.55 : 0.25;
    scene.fog.color.copy(raw(SKY[t][0])); // (fog is mixed in after the tone mapping: the horizon as drawn)
  };
  return { P, scene, water, wu, sun, fill, light, heightAt };
}

// ---- a shot's little things, put by the friend when it is shot (o: its spot { x, z, h: the ground's height fn, top: its highest point, f: the way the camera looks },
// nose: the way it looks [x, z], len: half its length, top(x, z): its back's height there)
function squirrel() { // a toy squirrel sitting up: round body and head, bead eyes, two ears, a big curled tail (no face lines, as the friends)
  const g = new THREE.Group(), b = new THREE.SphereGeometry(1, 20, 14), fur = mat('#c9773d'), pale = mat('#f2d7b0'), eye = mat('#141414', { roughness: 0.25 });
  const at = (m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(b, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  at(fur, 0, 0.2, 0, 0.17, 0.21, 0.16); at(pale, 0.07, 0.19, 0, 0.1, 0.15, 0.11); at(fur, 0.03, 0.47, 0, 0.14, 0.13, 0.13);
  for (const s of [-1, 1]) { at(fur, -0.02, 0.6, s * 0.08, 0.035, 0.07, 0.04); at(eye, 0.15, 0.5, s * 0.06, 0.022, 0.026, 0.022); at(fur, 0.09, 0.05, s * 0.09, 0.07, 0.05, 0.05); }
  [[-0.2, 0.12, 0.11], [-0.27, 0.3, 0.12], [-0.25, 0.48, 0.11], [-0.17, 0.6, 0.09]].forEach(([x, y, r]) => at(fur, x, y, 0, r, r * 1.05, r * 0.9));
  return g;
}
const ADD = {
  yellow: (o, nose, len) => { const g = new THREE.Group(), L = emptyL(); let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647; // a clump of yellow flowers at its nose
    flowerCluster(L, o.x + nose[0] * (len + 0.3), o.z + nose[1] * (len + 0.3), ['#ffd447', '#f08a24'], () => true, rand, h => h, o.h); finish(g, L, { rand, occupied: [] }); return g; },
  acorn: (o, nose, len) => { const g = decorModel('walk_acorn'), x = o.x + nose[0] * (len + 0.15), z = o.z + nose[1] * (len + 0.15); g.position.set(x, o.h(x, z) - 0.02, z); g.rotation.y = 0.6; g.scale.setScalar(1.6); return g; },
  clover: (o, nose, len) => { const g = new THREE.Group(), leaf = new THREE.SphereGeometry(1, 14, 8), m = mat('#6cc94a'), dark = mat('#4c9e38'), x = o.x + nose[0] * (len + 0.2), z = o.z + nose[1] * (len + 0.2);
    const one = (cx, cz, n, k, mm) => { const h = new THREE.Group(); h.position.set(cx, 0.16 * k, cz); g.add(h); // its leaves tipped toward the camera (flat, a low camera sees them edge on)
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.4; for (const d of [-0.35, 0.35]) { const l = new THREE.Mesh(leaf, mm), b = a + d * 0.5; l.position.set(Math.cos(b) * 0.075 * k, 0, Math.sin(b) * 0.075 * k); l.scale.set(0.06 * k, 0.012 * k, 0.045 * k); l.rotation.y = -b; l.castShadow = true; h.add(l); } }
      h.rotateOnWorldAxis(new THREE.Vector3(-o.f[1], 0, o.f[0]), 0.75);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * k, 0.012 * k, 0.16 * k, 5), dark); st.position.set(cx, 0.08 * k, cz); g.add(st); };
    one(0, 0, 4, 2.4, m); one(0.5, 0.3, 3, 1.5, dark); one(-0.45, 0.4, 3, 1.6, dark); one(0.2, -0.5, 3, 1.4, dark);
    g.position.set(x, o.h(x, z) - 0.03, z); return g; },
  squirrel: (o, nose, len) => { const g = squirrel(), u = len + 0.9, v = 0.35, x = o.x + nose[0] * u - nose[1] * v, z = o.z + nose[1] * u + nose[0] * v; // on a stump, looking back at it
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 18), mat('#9a6a3e')); stump.position.set(x, o.h(x, z) + 0.2, z); stump.castShadow = stump.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 18), mat('#e2b77d')); top.position.set(x, o.h(x, z) + 0.43, z);
    g.position.set(x, o.h(x, z) + 0.43, z); g.scale.setScalar(1.5); g.rotation.y = Math.atan2(nose[1], -nose[0]); const all = new THREE.Group(); all.add(stump, top, g); return all; },
  butterfly: (o, nose, len) => { const g = new THREE.Group(), wing = new THREE.CircleGeometry(0.26, 16).scale(1, 1.25, 1).translate(0.26, 0, 0).rotateX(-Math.PI / 2); // two, by its head (butterflies.js's wings)
    for (const [u, v, y, c, a] of [[0.2, -0.3, 0.05, '#ffd75e', 0.35], [0.65, 0.2, 0.35, '#ff9fbf', -0.3]]) { const b = new THREE.Group(), m = mat(c, { side: THREE.DoubleSide, roughness: 0.75 });
      for (const k of [1, -1]) { const w = new THREE.Mesh(wing, m); w.rotation.z = k * 1.05; w.scale.x = k; w.castShadow = true; b.add(w); }
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 2, 6), mat('#3a2a20')); body.rotation.x = Math.PI / 2; b.add(body);
      const x = o.x + nose[0] * (len + u) - nose[1] * v, z = o.z + nose[1] * (len + u) + nose[0] * v; b.position.set(x, o.top + y, z); b.rotation.set(0.15, a + Math.atan2(-o.f[1], o.f[0]), 0.1); g.add(b); } // side on to the camera: its wings up in a V
    return g; },
  petal: (o, nose, len, top) => { const x = o.x - nose[0] * len * 0.2, z = o.z - nose[1] * len * 0.2, p = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat('#f7a8c4', { roughness: 0.5 }));
    p.scale.set(0.22, 0.04, 0.16); p.position.set(x, top(x, z) + 0.015, z); p.rotation.set(0.1, 0.7, 0.12); p.castShadow = true; return p; },
};

// ---- the renderer (one, kept: the habitat's shared shapes and materials stay uploaded to it) and the shoot
let R, cur, gone = true, cocMat; // cur: the place being shot
const built = new Map(), place = id => built.get(id) ?? built.set(id, buildPlace(R, id)).get(id); // (kept: ponytail: six small scenes, a few MB; drop the least used if phones complain)
const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
function setup() {
  R?.dispose(); gone = false;
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W + 2 * M, H + 2 * M, false);
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
  const c = R.domElement, drop = () => { if (R?.domElement === c) gone = true; }; c.addEventListener('webglcontextlost', drop); c.addEventListener('webglcontextrestored', drop);
  built.clear();
  // the focus pass: r how far behind the focus, g how far in front (0 sharp, 1 the most blur)
  cocMat = new THREE.ShaderMaterial({ uniforms: { uF: { value: 1 }, uD: { value: 0.3 } }, vertexShader: `#include <common>
    varying float vZ; void main(){
    #include <begin_vertex>
    #include <project_vertex>
    vZ = -mvPosition.z; }`, fragmentShader: `uniform float uF, uD; varying float vZ;
    void main(){ float b = max(vZ - uF - uD, 0.0) / (uF * 1.6), f = max(uF - uD - vZ, 0.0) / (uF * 0.45);
      gl_FragColor = vec4(clamp(sqrt(b), 0.0, 1.0), clamp(f, 0.0, 1.0), 0.0, 1.0); }` });
}
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); // a pass a frame: the habitat keeps its frames
const keep = [nightGlow, snowNow, rainNow, windTime];
function render(cam, out) { // the habitat's shared uniforms as by a calm day for this pass, given back after
  const was = keep.map(u => u.value); nightGlow.value = snowNow.value = rainNow.value = 0; windTime.value = 3;
  R.render(cur.scene, cam); keep.forEach((u, i) => { u.value = was[i]; });
  if (out) { out.getContext('2d').drawImage(R.domElement, 0, 0); return out; }
}
// Reflector's mirror: the camera mirrored in the water, its projection's near plane on the water (three examples/objects/Reflector.js)
const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
function mirror(cam) {
  const m = cam.clone(), t = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld).add(cam.position);
  m.position.y = 2 * WY - cam.position.y; t.y = 2 * WY - t.y; m.up.set(0, -1, 0); m.lookAt(t); m.updateMatrixWorld(); m.updateProjectionMatrix();
  cur.wu.uRM.value.copy(BIAS).multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);
  const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WY).applyMatrix4(m.matrixWorldInverse), c = new THREE.Vector4(p.normal.x, p.normal.y, p.normal.z, p.constant), e = m.projectionMatrix.elements;
  const q = new THREE.Vector4((Math.sign(c.x) + e[8]) / e[0], (Math.sign(c.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
  c.multiplyScalar(2 / c.dot(q)); e[2] = c.x; e[6] = c.y; e[10] = c.z + 1 - 0.003; e[14] = c.w;
  return m;
}
const blur = (src, r) => { // a blurred copy (canvas filter; without it, down and up again)
  const c = cv(src.width, src.height), x = c.getContext('2d');
  if (r <= 0) x.drawImage(src, 0, 0);
  else if (FILTER) { x.filter = `blur(${r}px)`; x.drawImage(src, 0, 0); }
  else { const k = 1 + r / 2, s = cv(Math.ceil(src.width / k), Math.ceil(src.height / k)); s.getContext('2d').drawImage(src, 0, 0, s.width, s.height); x.drawImage(s, 0, 0, c.width, c.height); }
  return x.getImageData(M, M, W, H).data;
};
const FILTER = (() => { const x = cv(1, 1).getContext('2d'); x.filter = 'blur(2px)'; return x.filter === 'blur(2px)'; })();
const busy = { ms: 0 }; // main-thread time of the last shot (the 78 report)
const timed = f => { const t = performance.now(), v = f(); busy.ms += performance.now() - t; return v; };

async function shootNow(c) {
  const id = PL[c.pl] ? c.pl : 'lake', Q = PL[id], S = Q.shots[c.ln] ?? Q.shots[0];
  await Promise.all([loadModel(SP[c.sp].model), ...[].concat(c.acc || []).map(loadAcc), S.boat && loadModel(SP.duck.model)]);
  busy.ms = 0;
  if (gone) { timed(setup); await frame(); }
  if (!built.has(id)) { timed(() => place(id)); await frame(); } cur = built.get(id);
  const swim = !!Q.wd && MODELS[SP[c.sp].model].move === 'swim', P = frameOf(Q, S, swim), { x, z } = P, heightAt = cur.heightAt;
  const F = makeFigure(c.sp, c.v, c.st || 'adult', c.acc, c.c), fig = F.obj, a = THREE.MathUtils.degToRad(S.face);
  F.pose(swim ? { ...S.p, lie: 0 } : S.p); fig.position.set(x, S.y ?? (swim ? WY : heightAt(x, z)), z);
  const nose = [-P.r[0] * Math.cos(a) + P.f[0] * Math.sin(a), -P.r[1] * Math.cos(a) + P.f[1] * Math.sin(a)]; fig.rotation.y = Math.atan2(-nose[1], nose[0]); // (yaw θ: nose to cos θ, -sin θ)
  fig.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  const extra = [fig], made = [];
  if (S.boat) { // the "duck boat": a big yellow duck (the duck's own figure) on the water, going across
    const b = makeFigure('duck', 'solid', 'adult').obj, [u, v] = S.boat; b.scale.setScalar(2.2);
    b.position.set(x + P.f[0] * u + P.r[0] * v, WY, z + P.f[1] * u + P.r[1] * v);
    b.rotation.y = Math.atan2(P.r[1], -P.r[0]); // heading to the frame's left
    b.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); extra.push(b);
  }
  const box = new THREE.Box3().setFromObject(fig), mid = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), r = Math.max(size.x, size.z, size.y * 1.2) / 2;
  if (S.add) { // the line's little thing (ADD); top: the friend's back under (x, z), by a ray down onto it
    const ray = new THREE.Raycaster(), top = (x, z) => { ray.set(new THREE.Vector3(x, box.max.y + 1, z), new THREE.Vector3(0, -1, 0)); return ray.intersectObject(fig, true)[0]?.point.y ?? box.max.y; };
    const t = ADD[S.add]({ x, z, h: heightAt, top: box.max.y, f: P.f }, nose, Math.max(size.x, size.z) / 2, top); extra.push(t); made.push(t);
  }
  cur.scene.add(...extra);
  // the camera: low, from S.cam, the friend's middle at S.at in the frame, the frame fill wide
  const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), th = tv * W / H, D = r / (S.fill * th), el = THREE.MathUtils.degToRad(S.el);
  const dir = new THREE.Vector3(-P.f[0], 0, -P.f[1]), cam = new THREE.PerspectiveCamera(2 * THREE.MathUtils.radToDeg(Math.atan(tv * (H + 2 * M) / H)), (W + 2 * M) / (H + 2 * M), 0.1, 300);
  cam.position.copy(mid).addScaledVector(dir, D * Math.cos(el)); cam.position.y = Math.max(mid.y + D * Math.sin(el), Math.max(Q.wd ? WY : -9, heightAt(cam.position.x, cam.position.z)) + 0.6);
  const right = new THREE.Vector3(P.r[0], 0, P.r[1]);
  cam.lookAt(mid.clone().addScaledVector(right, -S.at[0] * 2 * D * th).add(new THREE.Vector3(0, -S.at[1] * 2 * D * tv, 0))); cam.updateMatrixWorld();
  const fp = new THREE.Vector3(x, 0, z); timed(() => { cur.light(S.t, P.sun.clone()); cur.sun.position.copy(P.sun).multiplyScalar(40).add(fp); cur.sun.target.position.copy(fp); cur.fill.position.copy(cam.position).sub(fp).add(new THREE.Vector3(0, 3, 0)); });
  try {
    R.compile(cur.scene, cam); // 91: not compileAsync: its timer reads each material's program, a material let go meanwhile threw 'isReady' of undefined, uncaught (inbox 49)
    const big = () => cv(W + 2 * M, H + 2 * M);
    // 1 the water's mirror, 2 the photo, 3 without the friend (what the blur behind it shows), 4 how far from the focus
    R.shadowMap.needsUpdate = true;
    if (cur.water) { await frame(); const mc = timed(() => { cur.water.visible = false; const o = render(mirror(cam), big()); cur.water.visible = true; return o; });
      cur.wu.uRefl.value?.dispose(); cur.wu.uRefl.value = new THREE.CanvasTexture(mc); }
    await frame(); const sharp = timed(() => render(cam, big()));
    await frame(); const bg = timed(() => { for (const o of extra) o.visible = o !== fig; const k = render(cam, big()); fig.visible = true; return k; });
    await frame(); const coc = timed(() => { cocMat.uniforms.uF.value = mid.applyMatrix4(cam.matrixWorldInverse).z * -1; cocMat.uniforms.uD.value = r * 0.55;
      cur.scene.overrideMaterial = cocMat; const k = render(cam, big()); cur.scene.overrideMaterial = null; return k.getContext('2d').getImageData(M, M, W, H).data; });
    // 5 put together: in focus the photo, behind the focus the friendless pass blurred more and more, in front the photo blurred
    return await compose(sharp, bg, coc);
  } finally { cur.scene.remove(...extra); for (const t of made) t.traverse(o => o.isInstancedMesh ? o.dispose() : o.isMesh && o.geometry.dispose()); } // (the little things' own shapes; the shared ones stay)
}
async function compose(sharp, bg, coc) {
  const d = [];
  for (const [s, r] of [[sharp, 0], [bg, BLUR / 3], [bg, BLUR * 2 / 3], [bg, BLUR], [sharp, BLUR / 2], [sharp, BLUR]]) { await frame(); d.push(timed(() => blur(s, r))); } // (a blur a frame)
  await frame(); return timed(() => mix(d.slice(0, 4), [d[0], d[4], d[5]], coc));
}
function mix(B, Fg, coc) {
  const out = cv(W, H), x = out.getContext('2d'), img = x.createImageData(W, H), o = img.data;
  for (let i = 0; i < o.length; i += 4) {
    const b = coc[i] / 255, f = coc[i + 1] / 255, L = f > b ? Fg : B, u = (f > b ? f : b) * (L.length - 1), k = Math.min(L.length - 2, Math.floor(u)), w = u - k, P = L[k], Q = L[k + 1];
    o[i] = P[i] + (Q[i] - P[i]) * w; o[i + 1] = P[i + 1] + (Q[i + 1] - P[i + 1]) * w; o[i + 2] = P[i + 2] + (Q[i + 2] - P[i + 2]) * w; o[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(60,30,10,0)'); g.addColorStop(1, 'rgba(60,30,10,0.28)'); // a lens's dark corners
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return out;
}
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/webp', q));
async function encode(c) { // ≤ 30 KB: WebP (JPEG where the browser cannot), less quality, then smaller
  for (let k = 1; ; k *= 0.85) {
    const s = k === 1 ? c : cv(Math.round(W * k), Math.round(H * k)); if (s !== c) s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
    for (const q of [0.82, 0.72, 0.62, 0.52]) { let b = await toBlob(s, q); if (b.type !== 'image/webp') b = await new Promise(r => s.toBlob(r, 'image/jpeg', q)); if (b.size <= 30720 || k < 0.5) return b; }
  }
}

// ---- kept: IndexedDB (a store of blobs by card); the session's object URLs
let dbP;
const db = () => dbP ??= new Promise((ok, no) => { const q = indexedDB.open('toyhabitat-photos', 1); q.onupgradeneeded = () => q.result.createObjectStore('p'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
const tx = (mode, f) => db().then(d => new Promise((ok, no) => { const t = d.transaction('p', mode), q = f(t.objectStore('p')); t.oncomplete = () => ok(q.result); t.onerror = t.onabort = () => no(t.error); }));
const key = c => `p1:${c.id}:${c.at}`; // p1: this look (a new one: p2, and the old pictures go at the next prune)
let line = Promise.resolve();
const urls = new Map();
// the card's picture as an image URL: kept, or shot now (one at a time)
export function cardPhoto(c) {
  const k = key(c);
  if (!urls.has(k)) urls.set(k, tx('readonly', s => s.get(k)).catch(() => null)
    .then(b => b || (line = line.catch(() => {}).then(() => shootNow(c)).then(encode)).then(b => (tx('readwrite', s => s.put(b, k)).catch(() => {}), b)))
    .then(b => URL.createObjectURL(b)).catch(e => { urls.delete(k); throw e; }));
  return urls.get(k);
}
export const photoStats = () => ({ busy: busy.ms }); // (the 78 report's numbers)
// the pictures of cards no longer kept (S.cards holds the last B.stroll.cards) go
export const prunePhotos = cards => { const keep = new Set(cards.map(key)); tx('readwrite', s => s.getAllKeys()).then(ks => ks.some(k => !keep.has(k)) && tx('readwrite', s => { for (const k of ks) if (!keep.has(k)) s.delete(k); })).catch(() => {}); };

// ---- the card: the photo on paper with the place's stamp, a postmark with the day, the line by hand, a paw for a name;
// tapped, its back (what it wrote). All drawn here: no outside art or fonts.
const NOTES = { // the back, by place and line (data.js PLACES)
  brook: ['물이 생각보다 차가워서 깜짝 놀랐어요. 그래도 발가락 사이로 물이 지나가는 게 간지러웠어요.',
    '돌이 다섯 개였어요. 가운데 돌이 조금 흔들려서 꾹 버티고 건넜어요.',
    '졸졸 소리를 듣다가 잠이 들었어요. 깨 보니 해가 한 뼘 움직여 있었어요.'],
  flowers: ['노란 꽃은 햇볕 냄새가 났어요. 코에 꽃가루가 묻어서 재채기를 했어요.',
    '나비가 앉았다 날았다 해서 계속 따라갔어요. 돌아보니 꽃밭 한가운데였어요.',
    '꽃잎 하나가 등에 내려앉았어요. 떨어질까 봐 집까지 천천히 걸어왔어요.'],
  hill: ['꼭대기는 바람이 세서 귀가 다 넘어갔어요. 저 멀리 우리 집도 보였어요.',
    '한 발 헛디뎠는데 그대로 데굴데굴 굴렀어요. 어지러웠지만 또 하고 싶어요.',
    '누워서 구름을 셌어요. 하나는 꼭 알처럼 생겼어요. 일곱까지 세다가 잊어버렸어요.'],
  forest: ['반들반들한 도토리를 찾았어요. 모자까지 쓴 걸로요. 꼭 쥐고 왔어요.',
    '큰 나무 밑은 시원했어요. 나뭇잎 사이로 햇빛이 동전처럼 떨어졌어요.',
    '다람쥐가 그루터기 위에서 나를 봤어요. 나도 가만히 봤어요. 누가 먼저 움직였는지는 비밀이에요.'],
  lake: ['물이 거울처럼 잔잔해서 내 얼굴이 또렷하게 보였어요. 생각보다 동그랗더라고요.',
    '커다란 오리배가 천천히 지나갔어요. 손을 흔들었는데 대답은 없었어요. 그래도 좋았어요.',
    '해가 호수 너머로 넘어갈 때까지 안 일어났어요. 물이 주황색이 됐다가 보라색이 됐어요.'],
  path: ['오솔길 끝에는 또 다른 길이 있었어요. 다음엔 거기까지 가 볼래요.',
    '울타리 너머에는 키 큰 풀이 바람에 누웠다 일어났다 했어요. 넘어가지는 않았어요.',
    '네잎클로버를 찾았어요! 진짜예요. 잎을 네 번 세어 봤어요.'],
};
const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
const hand = (s, k) => s.split(' ').map((w, j) => `<span class="w">${[...w].map((ch, i) => `<span style="--r:${((rnd(k + j, i) - 0.5) * 7).toFixed(1)}deg;--y:${((rnd(i, k + j) - 0.5) * 2.4).toFixed(1)}px">${ch}</span>`).join('')}</span>`).join(' ');
const PAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15.5" rx="5.2" ry="4.4"/><ellipse cx="5.6" cy="9.6" rx="2" ry="2.6" transform="rotate(-18 5.6 9.6)"/><ellipse cx="9.6" cy="6" rx="2" ry="2.7"/><ellipse cx="14.4" cy="6" rx="2" ry="2.7"/><ellipse cx="18.4" cy="9.6" rx="2" ry="2.6" transform="rotate(18 18.4 9.6)"/></svg>';
const STAMP = { lake: '<rect width="56" height="66" fill="#fde3c4"/><rect width="56" height="30" fill="#f6b98a"/><circle cx="38" cy="26" r="7" fill="#ff9a52"/><path d="M0 30 Q14 22 28 29 T56 27 V36 H0Z" fill="#6aa553"/><ellipse cx="28" cy="42" rx="25" ry="7" fill="#5e9fd1"/><rect x="18" y="40" width="20" height="1.6" rx=".8" fill="#ffd6a8" opacity=".8"/><path d="M8 50 v-12 M10 50 v-10 M12 50 v-13" stroke="#4f8a30" stroke-width="1.4"/><ellipse cx="8" cy="37.5" rx="1" ry="2.6" fill="#8b5a2b"/><ellipse cx="12" cy="36.5" rx="1" ry="2.6" fill="#8b5a2b"/><text x="28" y="61" font-size="8" text-anchor="middle" fill="#7a4a2a" font-weight="700">호숫가</text>',
  brook: '<rect width="56" height="66" fill="#e3f1f4"/><path d="M0 26 Q16 20 30 25 T56 23 V54 H0Z" fill="#7cbc40"/><path d="M0 36 Q14 31 28 37 T56 35 V45 Q42 41 28 46 T0 46Z" fill="#7cc3e6"/><path d="M8 40 q4 -2 8 0 M30 42 q4 -2 8 0" stroke="#e8f6fb" stroke-width="1.2" fill="none"/><ellipse cx="20" cy="41" rx="3.6" ry="1.8" fill="#b9b2a4"/><ellipse cx="28" cy="39.5" rx="3.4" ry="1.7" fill="#c6bfb1"/><ellipse cx="36" cy="41.5" rx="3.6" ry="1.8" fill="#b9b2a4"/><text x="28" y="61" font-size="8" text-anchor="middle" fill="#2f6a7a" font-weight="700">시냇가</text>',
  flowers: '<rect width="56" height="66" fill="#fff4cf"/><path d="M0 30 Q18 25 34 29 T56 28 V52 H0Z" fill="#8bc64a"/>' + [[9, 36, '#ffd447'], [20, 42, '#f7a8c4'], [31, 35, '#ffffff'], [42, 43, '#ffd447'], [48, 34, '#b9a0f2'], [14, 47, '#ffffff'], [36, 48, '#f7a8c4']].map(([x, y, c]) => `<g fill="${c}">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(x + 2.4 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(y + 2.4 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="1.7"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="1.3" fill="#f08a24"/>`).join('') + '<g transform="translate(40 17) rotate(-12)"><ellipse cx="-3" cy="0" rx="3.2" ry="4" fill="#ff9fbf"/><ellipse cx="3" cy="0" rx="3.2" ry="4" fill="#ff9fbf"/><rect x="-.6" y="-3.5" width="1.2" height="7" rx=".6" fill="#3a2a20"/></g><text x="28" y="61" font-size="8" text-anchor="middle" fill="#8a5a1a" font-weight="700">꽃밭</text>',
  hill: '<rect width="56" height="66" fill="#d6ebf8"/><g fill="#ffffff"><circle cx="13" cy="15" r="4.5"/><circle cx="19" cy="12" r="5.5"/><circle cx="25" cy="15" r="4.2"/><circle cx="41" cy="22" r="3"/><circle cx="45" cy="20" r="3.6"/><circle cx="49" cy="22" r="2.8"/></g><path d="M-4 52 Q10 24 28 24 T60 52Z" fill="#7cbc40"/><path d="M-4 52 Q20 36 60 46 V52Z" fill="#6daf3b"/><rect x="27" y="17" width="2" height="7" fill="#8a5733"/><circle cx="28" cy="15" r="4.5" fill="#5c9a35"/><text x="28" y="61" font-size="8" text-anchor="middle" fill="#2f6a4a" font-weight="700">바람 언덕</text>',
  forest: '<rect width="56" height="66" fill="#eaf2dc"/><rect y="40" width="56" height="12" fill="#6b8f3a"/><g fill="#8a5733"><rect x="9" y="26" width="3" height="16"/><rect x="41" y="24" width="3" height="18"/></g><circle cx="10.5" cy="22" r="8" fill="#6daf3b"/><circle cx="42.5" cy="19" r="9" fill="#7cbc40"/><path d="M26 41 L19 41 L26 14 L33 41Z" fill="#4f8a30"/><g transform="translate(32 46) rotate(20)"><ellipse cx="0" cy="1.5" rx="2.6" ry="3.2" fill="#c98a4b"/><path d="M-3 0 Q0 -3.4 3 0Z" fill="#7a5232"/></g><text x="28" y="61" font-size="8" text-anchor="middle" fill="#3f5a20" font-weight="700">숲길</text>',
  path: '<rect width="56" height="66" fill="#fde9cf"/><path d="M0 28 Q20 24 56 27 V52 H0Z" fill="#8bc64a"/><path d="M26 28 Q30 28 31 30 Q28 38 38 52 H16 Q26 38 25 30Z" fill="#d6b383"/><g stroke="#c88a4b" stroke-width="1.5"><path d="M44 30 v8 M49 32 v9 M54 34 v10"/><path d="M43 33 L56 37 M43 36.5 L56 41" stroke-width="1.1"/></g><text x="28" y="61" font-size="7.2" text-anchor="middle" fill="#7a4a2a" font-weight="700">들판 오솔길</text>',
};
const when = t => { const d = new Date(t); return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`; };
const POST = (pl, t) => `<svg class="ppost" viewBox="0 0 120 60" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="30" cy="30" r="24"/><circle cx="30" cy="30" r="19" stroke-width="1"/>${[18, 26, 34, 42].map(y => `<path d="M58 ${y} q8 -4 16 0 t16 0 t16 0 t12 0"/>`).join('')}</g><g fill="currentColor" text-anchor="middle" font-weight="700"><text x="30" y="24" font-size="8">${pl}</text><text x="30" y="35" font-size="10">${when(t)}</text><text x="30" y="45" font-size="6.5">토이브룩</text></g></svg>`;
// c: the card, line: its line (stroll.js cardLine), meta: place · hours · date · what it brought
export const photoCard = (c, line, meta, place) => `<figure class="pcard photo"><div class="pflip">
<div class="pfront"><div class="pshot"><img alt="${c.nm}"><span class="pdev">사진 뽑는 중…</span>${c.new ? '<i>NEW</i>' : ''}</div>
<div class="pstamp"><svg viewBox="0 0 56 66" aria-hidden="true">${STAMP[c.pl] ?? ''}</svg></div>${POST(place, c.at)}
<p class="phand">${hand(line, c.id)}</p><p class="ppaw">${c.nm} ${PAW}</p><span class="pturn">뒷면 ↻</span></div>
<div class="pback"><div class="pmsg"><p class="pnote">${hand(NOTES[c.pl]?.[c.ln] ?? '', c.id + 7)}</p><p class="ppaw">${c.nm} ${PAW}</p></div>
<div class="paddr"><small>받는 사람</small><p>${hand('토이브룩', c.id + 3)}</p><p>${hand('우리 집', c.id + 5)}</p></div><small class="pmeta">${meta}</small><span class="pturn">앞면 ↻</span></div>
</div></figure>`;
