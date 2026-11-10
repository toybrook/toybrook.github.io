// Pond props: the meadow's planting kit (meadow/props.js kit / addPads / addReeds / finish) on the pond layout,
// plus the log bridge. Same toy materials and instancing as the meadow.
import * as THREE from 'three';
import { S, O, Z, SW, stream, pond, shore, shoreR, isle, islands, bridgeT, bP, bN, BL, bridgeArch as arch, heightAt, occupied, free, rand, waterY, WATER_Y, deckY } from './layout.js';
import { zoneProps } from '../zoneprops.js';
import { BOARD0, inRect } from '../zones.js';
import { kit, addPads, addReeds, finish, emptyL, natives, flowerPal, flowerCluster } from '../meadow/props.js';
import { toyMat, merge, instanced } from '../toyKit.js';

// 21-3b: on a board spread by S (땅 넓히기, layout.js), every spot below spreads by S and the counts by its area (props keep their size)
const n2 = n => Math.round(n * S * S);
export function buildProps(scene) {
  // 22-1: the corner trees and bushes, the stones in the grass and the flower clusters are props (meadow/props.js natives();
  // all ring 0: the pond's spread board re-plants them by its own counts, so a later step does not add more)
  const L = emptyL(), N = natives(occupied, 'pond');
  const { pickOf, jitter, tree, pine, bush, rock, tuft: clump } = kit(L, { rand, heightAt, occupied }), nk = kit(N.Ls, { rand, heightAt, occupied });
  // a reed clump here is also in occupied, small (r 0.25: no contact shadow, no wall for the animals) for the camera
  // only: kept out of it, and it fades when it hides the followed animal (habitat.js), like the trees
  const tuft = (x, z) => { const i = L.stem.length; clump(x, z); occupied.push({ x, z, r: 0.25, h: 1.7, fade: [['stem', i, 4], ['head', i, 4]] }); };
  const onPond = (a, s) => { const r = shoreR(a) + s; return [pond.x + Math.cos(a) * r, pond.z + Math.sin(a) * r]; };
  const sideOf = (t, side, off) => { const p = stream.getPointAt(t), tn = stream.getTangentAt(t); return [p.x - tn.z * side * off, p.z + tn.x * side * off]; };

  // the spring: big mossy stones round the stream's head, in the edge of the forest
  { const p = stream.getPointAt(0); for (let i = 0; i < 7; i++) { const a = -0.3 - i / 6 * (Math.PI + 0.6), r = SW + 0.5 + rand() * 0.3; rock(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r * 0.9, 0.7 + rand() * 0.45); } }
  // back forest: pines with a few round trees
  for (let i = 0; i < n2(90); i++) {
    const x = (-17 + rand() * 34) * S, z = (-28.4 + rand() * 4.2) * S;
    if (!free(x, z, 1.0)) continue;
    rand() < 0.7 ? pine(x, z, 0.85 + rand() * 0.45) : tree(x, z, 0.85 + rand() * 0.3);
  }
  // round trees and bushes in the corners and on the hill (inbox 10: the side rims stay open, the shore animals' way round)
  [[-14.5, -20.5], [14.2, -20.6], [8.6, -21.4], [-13, 24], [-15.2, 15.5], [14.6, 25.8]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 1.5)) N.add('tree', nk.tree, x, z, 1 + rand() * 0.3); });
  [[-11, -21.6], [2.5, -21.8], [-9.5, 26.4], [-15.6, 21.5], [16, -16.5], [9, 26.6], [-16.2, 8.5]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 0.9)) N.add('bush', nk.bush, x, z, 0.9 + rand() * 0.4); });

  // stones on the bank, along the stream, a few in the grass
  for (let i = 0; i < Math.round(16 * S); i++) { const a = rand() * 6.28; if (Math.sin(a) < -0.85 && Math.abs(Math.cos(a)) < 0.4) continue; rock(...onPond(a, 0.3 + rand() * 0.4), 0.3 + rand() * 0.4); } // not at the stream mouth
  for (let i = 0; i < Math.round(16 * S); i++) { const t = 0.08 + rand() * 0.8; if (Math.abs(t - bridgeT) < 0.08) continue; rock(...sideOf(t, rand() < 0.5 ? -1 : 1, SW + 0.45 + rand() * 0.4), 0.3 + rand() * 0.35); }
  for (let i = 0; i < n2(6); i++) { const x = (-15 + rand() * 30) * S, z = (-20 + rand() * 46) * S; if (free(x, z, 1)) N.add('rock', nk.rock, x, z, 0.5 + rand() * 0.45); }
  // the grass in front of the pond (inbox 7): a few small stones and tall grass clumps, flowers below; nothing else
  for (let i = 0; i < n2(5); i++) { const x = (-13 + rand() * 26) * S, z = (20.5 + rand() * 5.5) * S; if (free(x, z, 0.6)) N.add('rock', nk.rock, x, z, 0.28 + rand() * 0.3); }
  for (let i = 0; i < n2(6); i++) {
    const cx = (-13 + rand() * 26) * S, cz = (20.5 + rand() * 5.5) * S; if (!free(cx, cz, 0.5)) continue;
    for (let j = 0; j < 8; j++) { const x = cx + (rand() - 0.5) * 0.9, z = cz + (rand() - 0.5) * 0.9; L.grass.push({ x, y: heightAt(x, z) - 0.03, z, s: 1.5 + rand() * 0.6, big: true, ry: rand() * 6, c: jitter('#4f9032', 0.06) }); }
  }
  // the islands: a bush and stones on a grassy mound, reeds at the edge, kept to the back so the front of the top is open
  // ground (walkable, inbox 10)
  { const [I, J] = islands;
    bush(I.x - 0.3 * S, I.z - 0.75 * S, 0.8);
    [[1.05, -0.45, 0.5], [-1.1, 0.2, 0.36], [0.45, -1.2, 0.32], [-0.85, -1.05, 0.28]].forEach(([dx, dz, s]) => rock(I.x + dx * S, I.z + dz * S, s));
    tuft(I.x + 1.45 * S, I.z + 0.95 * S); tuft(I.x - 1.5 * S, I.z - 0.6 * S);
    rock(J.x + 0.45 * S, J.z - 0.35 * S, 0.42); rock(J.x - 0.35 * S, J.z - 0.6 * S, 0.28); tuft(J.x + 0.95 * S, J.z + 0.7 * S); }

  // pebbles on the pond and stream beds (seen through the water)
  for (let i = 0; i < Math.round(110 * S); i++) {
    const [x, z] = onPond(rand() * 6.28, -0.2 - rand() * 2.2); if (isle(x, z) < 0.3) continue;
    L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.16 + rand() * 0.16, 0.08, 0.13 + rand() * 0.12], ry: rand() * 6, c: jitter(pickOf(['#c9b991', '#a8a39a', '#b7c2bc', '#d8cfb8']), 0.08) });
  }
  for (let i = 0; i < Math.round(60 * S); i++) {
    const [x, z] = sideOf(rand(), rand() < 0.5 ? -1 : 1, rand() * (SW - 0.3)); if (shore(x, z) < -0.4) continue;
    L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.15 + rand() * 0.15, 0.08, 0.13 + rand() * 0.1], ry: rand() * 6, c: jitter(pickOf(['#c9b991', '#a8a39a', '#b7c2bc']), 0.08) });
  }

  // reeds along the shallow shelf (mostly at the back and sides so the front view stays open), lily pads on the water
  for (const a of [3.6, 3.9, 4.4, 5.3, 5.65, 0.15, 2.7, 1.0, 0.55, 2.25, 3.25, 4.1, 4.85, 5.95]) { const [x, z] = onPond(a + (rand() - 0.5) * 0.1, -0.6 - rand() * 1.0); tuft(x, z); }
  [0.62, 0.3, 0.12].forEach(t => tuft(...sideOf(t, t > 0.3 ? 1 : -1, SW - 0.1)));
  const R = addReeds(scene, L); for (const o of occupied) if (o.fade) for (const p of o.fade) if (R[p[0]]) p[0] = R[p[0]];
  const pads = [];
  for (let i = 0; i < n2(26); i++) {
    const a = rand() * 6.28, [x, z] = onPond(a, -1.4 - rand() * 4.5); if (isle(x, z) < 0.8) continue;
    pads.push({ x, y: WATER_Y + 0.06, z, s: 0.7 + rand() * 0.55, ry: rand() * 6, c: jitter('#5fa83e', 0.08) });
  }
  for (let i = 0; i < Math.round(18 * S); i++) { const [x, z] = onPond(rand() * 6.28, -0.9 - rand() * 1.5); pads.push({ x, y: WATER_Y + 0.06, z, s: 0.6 + rand() * 0.4, ry: rand() * 6, c: jitter('#5fa83e', 0.08), band: true }); } // and along the shelf
  addPads(scene, pads);
  pads.filter((p, i) => i % (p.band ? 3 : 4) === 0).forEach(p => { L.petal.push({ x: p.x, y: p.y + 0.12, z: p.z, s: 1.9, ry: rand(), c: pickOf(['#f7a8c4', '#fff4f0', '#f7a8c4']) }); L.centre.push({ x: p.x, y: p.y + 0.16, z: p.z, s: 1.5, c: '#ffd447' }); });

  // ---------- log bridge: round logs laid across the walk (corduroy), two side logs as rails ----------
  {
    const th = Math.atan2(-bN.z, bN.x), X = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), Z = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
    const at = (lx, ly, lz) => ({ x: bP.x + X.x * lx + Z.x * lz, y: ly, z: bP.z + X.z * lx + Z.z * lz });
    const base = deckY(0) - arch(0) - 0.1, logs = [], n = Math.round(13 * S);
    for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5, p = at(u * BL, base + arch(u) - 0.09, 0); logs.push({ ...p, ry: th, rz: -Math.atan(-8 * u * 0.32 / BL), s: [1, 1, 0.95 + rand() * 0.1], c: jitter('#a8703f', 0.07) }); }
    const logGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.0, 12); logGeo.rotateX(Math.PI / 2);
    scene.add(instanced(logGeo, toyMat('#ffffff', { roughness: 0.6 }), logs));
    const sides = [];
    for (const lz of [-0.95, 0.95]) {
      const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12 - 0.5, p = at(u * BL * 1.04, base + arch(u) + 0.12, lz); pts.push(new THREE.Vector3(p.x, p.y, p.z)); }
      sides.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 10, false));
    }
    const rails = new THREE.Mesh(merge(sides), toyMat('#8a5733', { roughness: 0.65 })); rails.castShadow = rails.receiveShadow = true; scene.add(rails);
  }

  // ---------- flowers + grass ----------
  for (let cl = 0; cl < n2(34); cl++) {
    const cx = (-16.5 + rand() * 33) * S, cz = (-22 + rand() * 49) * S; if (!free(cx, cz, 0.4)) continue;
    const pi = Math.floor(rand() * flowerPal.length); N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rand, jitter, heightAt);
  }
  N.bare(() => { for (let i = 0; i < n2(9000) && L.grass.length < n2(2200); i++) {
    const x = (-17.6 + rand() * 35.2) * S, z = (-28.6 + rand() * 57.2) * S;
    if (!inRect(BOARD0, x, z, 0.4)) continue;
    const h = heightAt(x, z), u = h - waterY(z), isl = isle(x, z) < -0.5;
    const bank = (u > 0.02 && u < 0.45) || isl; // tall grass at the waterline and on the island
    if (!bank && !free(x, z, 0)) continue;
    if (bank && rand() < 0.6) continue;
    L.grass.push({ x, y: h - 0.03, z, s: bank ? 1.6 + rand() * 0.6 : 0.8 + rand() * 0.6, big: bank, ry: rand() * 6, c: jitter(bank ? '#4f9032' : pickOf(['#6aa83a', '#7cb843', '#5e9c35']), 0.06) });
  } });
  const zp = zoneProps(scene, 'pond', { L, N, heightAt, occupied, free, O, Z, back: -24.2 });
  const list = N.done();
  return { natives: list, zone: zp, ...finish(scene, L, { rand, occupied }) };
}
