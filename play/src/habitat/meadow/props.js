// Meadow props, all from the shared toy kit so they share one lighting/gloss look.
// Repeated things are InstancedMesh (one draw call per kind) to keep phones at 60fps.
import * as THREE from 'three';
import { S, BW0 as BW, BD0 as BD, O, Z, SW, stream, pond, bridgeT, bP, bN, BL, bridgeArch as arch, paddock, fences, heightAt, occupied, freeBase as free, free as freeOpen, rand, dist2D, sPts0 as sPts, CLIFF_Z, WATER_Y } from './layout.js';
import { ringIn } from '../zones.js';
import { zoneProps } from '../zoneprops.js';
import { toyMat, roundedBox, merge, lathe, addSway, instanced, windTime, nightGlow } from '../toyKit.js';
import { QUALITY, thin, calm } from '../../config.js';
import { G as PLAY, newPlay, propTick } from '../../animals/play.js';
import { playing } from '../../ui/sound.js';
import { PIECES, ARCH } from '../train.js';
import { shape } from '../stamps.js';
import { PROPS, NAT_K } from '../../game/data.js';

const pickOf = arr => arr[Math.floor(rand() * arr.length)];
// inbox 42 A: the board spread by S (layout.js): spots below in the old board's metres times S, counts by its area
const n2 = n => Math.round(n * S * S);
const jitter = (hex, amt) => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); return c.setHSL(hsl.h + (rand() - 0.5) * amt * 0.1, hsl.s, THREE.MathUtils.clamp(hsl.l + (rand() - 0.5) * amt, 0, 1)).getHex(); };

// inbox 42 D: under a tree of scale s (tree below; a moved one, habitat.js): the leaves' underside 1.66 s up, the trunk 0.62 s round at
// its foot, the crown out to 1.95 s (blobCluster: its middle 2.9 s up, 1.55 s round, 0.8 of that high)
export const treeCover = s => ({ y: 1.66 * s, core: 0.62 * s, r: 1.95 * s });
export const emptyL = () => ({ canopy: [], trunk: [], pine: [], snow: [], rock: [], pebble: [], post: [], rail: [], grass: [], petal: [], centre: [], stem: [], head: [] });
export const flowerPal = [['#ffffff', '#ffcf33'], ['#ffffff', '#ffcf33'], ['#b9a0f2', '#ffd447'], ['#f7a8c4', '#ffe066'], ['#ffd447', '#f08a24'], ['#9d86e8', '#fff1a8']];
// 22-1: the trees, bushes, rocks and wildflower clusters the board came with are props now (S.props nat: 1; habitat/nature.js
// draws them). The build still plants them in turn with the same random, so the rest of the board comes out as before, but
// into a scratch list N.Ls, and notes { prop, x, z, s, v: seed for their look, ring: the 땅 넓히기 step they came with }.
// Their footprints keep the later planting off them, then leave occupied (grass grows under them; nature.js hides it).
const vOf = (x, z) => ((Math.round(x * 100) * 73856093) ^ (Math.round(z * 100) * 19349663)) >>> 0;
// hab: whose 땅 넓히기 steps give the ring (zones.js ringIn)
export function natives(occupied, hab) {
  const list = [], Ls = emptyL(), out = [];
  const ring = (x, z) => ringIn(hab, x, z);
  return { list, Ls,
    add(prop, put, x, z, s) { const n = occupied.length; put(x, z, s); if (occupied[n]) occupied[n].nat = 1; list.push({ prop, x, z, s, v: vOf(x, z), ring: ring(x, z) }); },
    flowers(x, z, pi) { const v = vOf(x, z); list.push({ prop: 'wildflowers', x, z, s: 1, v: v - v % 6 + pi, ring: ring(x, z) }); },
    bare(fn) { for (let i = occupied.length - 1; i >= 0; i--) if (occupied[i].nat) out.push(...occupied.splice(i, 1)); fn(); occupied.push(...out.splice(0)); }, // fn() without them
    done() { for (let i = occupied.length - 1; i >= 0; i--) if (occupied[i].nat) occupied.splice(i, 1); return list; },
  };
}

// The first board's props (BW, BD, free, sPts: that board's, so it comes out the same after 땅 넓히기), then the open zones' (zoneprops.js)
export function buildProps(scene) {
  const L = emptyL(), N = natives(occupied, 'meadow');
  const { tree, pine, rock, tuft } = kit(L, { rand, heightAt, occupied }), nk = kit(N.Ls, { rand, heightAt, occupied });

  // back shelf forest: mostly pines with a few round trees
  for (let i = 0; i < n2(90); i++) {
    const x = (-17 + rand() * 34) * S, z = (-28.4 + rand() * 3.6) * S;
    if (z > CLIFF_Z - 1.4 || !free(x, z, 1.0)) continue;
    rand() < 0.7 ? pine(x, z, 0.85 + rand() * 0.45) : tree(x, z, 0.85 + rand() * 0.3);
  }
  [[-14.5, -6], [-13.5, 4], [14, -7], [15.5, 3], [-14.5, 20], [14.5, 25], [11.5, -20.5], [-2.5, 24.5], [-15.5, 12], [16, 15], [3.5, -15]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 1.5)) N.add('tree', nk.tree, x, z, 1 + rand() * 0.3); });
  [[-16, -12], [-3, -20], [16.2, -1], [-16.5, 27], [-6, 27.2], [16.5, 9], [-16.2, 1], [1, 11.5], [12.5, -14]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 0.9)) N.add('bush', nk.bush, x, z, 0.9 + rand() * 0.4); });

  const sideOf = (t, side, off) => { const p = stream.getPointAt(t), tn = stream.getTangentAt(t); return { x: p.x - tn.z * side * off, z: p.z + tn.x * side * off }; };
  for (let i = 0; i < Math.round(30 * S); i++) {
    const t = rand(); if (Math.abs(t - bridgeT) < 0.05) continue;
    const q = sideOf(t, rand() < 0.5 ? -1 : 1, SW + 0.35 + rand() * 0.5);
    if (Math.abs(q.x) < BW / 2 - 1 && Math.abs(q.z) < BD / 2 - 1) rock(q.x, q.z, 0.35 + rand() * 0.45);
  }
  for (let i = 0; i < 10; i++) { const a = rand() * 6.28, r = pond.r + 0.35 + rand() * 0.3; rock(pond.x + Math.cos(a) * r, pond.z + Math.sin(a) * r, 0.3 + rand() * 0.35); }
  for (let i = 0; i < n2(7); i++) { const x = (-15 + rand() * 30) * S, z = (-20 + rand() * 46) * S; if (free(x, z, 1)) N.add('rock', nk.rock, x, z, 0.55 + rand() * 0.5); }
  // rock ledge along the cliff, bigger stones flanking the waterfall
  for (let x = -17.2 * S; x < 17.4 * S; x += 0.9 + rand() * 0.6) {
    const z = CLIFF_Z - 0.55 + (rand() - 0.5) * 0.7, ds = dist2D(sPts, x, z);
    if (ds < SW - 0.1) continue;
    rock(x, z, ds < SW + 1.5 ? 0.85 + rand() * 0.35 : 0.5 + rand() * 0.45);
  }
  // pebbles on the stream and pond bed (seen through the water)
  for (let i = 0; i < Math.round(170 * S); i++) {
    const t = rand(), q = sideOf(t, rand() < 0.5 ? -1 : 1, rand() * (SW - 0.5));
    if (Math.abs(q.x) > BW / 2 - 0.8 || Math.abs(q.z) > BD / 2 - 0.8) continue;
    L.pebble.push({ x: q.x, y: heightAt(q.x, q.z) + 0.02, z: q.z, s: [0.16 + rand() * 0.16, 0.08, 0.13 + rand() * 0.12], ry: rand() * 6, c: jitter(pickOf(['#c9b991', '#a8a39a', '#b7c2bc', '#d8cfb8']), 0.08) });
  }
  for (let i = 0; i < 40; i++) { const a = rand() * 6.28, r = rand() * (pond.r - 0.8), x = pond.x + Math.cos(a) * r, z = pond.z + Math.sin(a) * r; L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.18 + rand() * 0.15, 0.08, 0.15 + rand() * 0.1], ry: rand() * 6, c: jitter(pickOf(['#c9b991', '#a8a39a', '#b7c2bc']), 0.08) }); }

  // ---------- fences ----------
  function fenceLine(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.6)), ry = -Math.atan2(z2 - z1, x2 - x1);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = heightAt(x, z);
      L.post.push({ x, y: y - 0.08, z, s: [1.15, 1.42, 1.15], ry, c: jitter('#c88a4b', 0.04) }); occupied.push({ x, z, r: 0.35 }); // inbox 42 C2: 1.05 -> 1.5 m (0.44 H)
      if (prev) {
        const span = Math.hypot(x - prev.x, z - prev.z), rz = Math.atan2(y - prev.y, span);
        for (const yy of [0.6, 1.05]) L.rail.push({ x: (x + prev.x) / 2, y: (y + prev.y) / 2 + yy, z: (z + prev.z) / 2, s: [span, 1.2, 1.2], ry, rz, c: jitter('#d0955a', 0.04) });
      }
      prev = { x, y, z };
    }
  }
  for (const f of fences) fenceLine(...f);

  // ---------- bridge (built in its own frame: x across the stream, z along it) ----------
  {
    const th = Math.atan2(-bN.z, bN.x), X = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), Z = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
    const at = (lx, ly, lz) => ({ x: bP.x + X.x * lx + Z.x * lz, y: ly, z: bP.z + X.z * lx + Z.z * lz });
    const planks = [];
    for (let i = 0; i < 11; i++) { const u = i / 10 - 0.5, p = at(u * BL, arch(u), 0); planks.push({ ...p, ry: th, rz: -Math.atan(-8 * u * 0.62 / BL), c: jitter('#c98c52', 0.06) }); }
    scene.add(instanced(roundedBox(0.58, 0.16, 2.9, 0.06, 2), toyMat('#ffffff', { roughness: 0.5 }), planks));
    const railGeos = [];
    for (const lz of [-1.35, 1.35]) { // inbox 42 C2: 2.3 -> 2.9 wide (two horses side by side: 2 x 1.06 m), the rails 0.78 -> 1.0 high
      const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12 - 0.5, p = at(u * BL * 0.88, arch(u * 0.88) + 1.0, lz); pts.push(new THREE.Vector3(p.x, p.y, p.z)); }
      railGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.08, 8, false));
      for (let i = 0; i < 5; i++) { const u = (i / 4 - 0.5) * 0.88, p = at(u * BL, arch(u) - 0.05, lz); L.post.push({ ...p, s: [0.8, 1.02, 0.8], ry: th, c: '#c88a4b' }); }
    }
    const rails = new THREE.Mesh(merge(railGeos), toyMat('#c88a4b', { roughness: 0.5 })); rails.castShadow = true; scene.add(rails);
  }

  // ---------- cottage (barn) + hay ----------
  {
    const g = new THREE.Group(), cream = toyMat('#f6ecd9', { roughness: 0.55 }), red = toyMat('#d9573f', { roughness: 0.38 }), wood = toyMat('#9b6237', { roughness: 0.5 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    add(roundedBox(4.2, 2.5, 3.4, 0.25, 3), cream, 0, 1.25, 0);
    const tri = new THREE.Shape(); tri.moveTo(-1.95, 0); tri.lineTo(0, 1.45); tri.lineTo(1.95, 0); tri.lineTo(-1.95, 0);
    const gable = new THREE.ExtrudeGeometry(tri, { depth: 3.0, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 }); gable.translate(0, 0, -1.5);
    add(gable, cream, 0, 2.4, 0);
    const a = Math.atan2(1.45, 1.95), slabL = 2.95, ridgeY = 2.4 + 1.45 + 0.16;
    const slabs = [-1, 1].map(s => { const sg = roundedBox(slabL, 0.3, 4.1, 0.13, 2); sg.rotateZ(-s * a); sg.translate(s * Math.cos(a) * slabL / 2 + s * Math.sin(a) * 0.15, ridgeY - Math.sin(a) * slabL / 2 + Math.cos(a) * 0.15 - 0.15, 0); return sg; });
    const ridge = new THREE.CapsuleGeometry(0.17, 4.0, 4, 10); ridge.rotateX(Math.PI / 2); ridge.translate(0, ridgeY + 0.08, 0);
    add(merge([...slabs, ridge]), red, 0, 0, 0);
    const door = new THREE.Shape(); door.moveTo(-0.6, 0); door.lineTo(-0.6, 1.1); door.absarc(0, 1.1, 0.6, Math.PI, 0, true); door.lineTo(0.6, 0); door.lineTo(-0.6, 0);
    add(new THREE.ExtrudeGeometry(door, { depth: 0.08, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 12 }), wood, 0, 0.02, 1.68);
    add(new THREE.TorusGeometry(0.34, 0.08, 8, 20), wood, 0, 3.05, 1.62);
    add(new THREE.CircleGeometry(0.3, 20), toyMat('#5c3d2a', { roughness: 0.3 }), 0, 3.05, 1.6);
    const bx = paddock.x - 4.4, bz = paddock.z - 0.5;
    g.scale.setScalar(2); g.position.set(bx, heightAt(bx, bz), bz); scene.add(g); // inbox 42 C2: twice as big (ridge 8.2 m, 2.4 H; was 0.9 H)
    // barn (roof overhang 2.45 x 2.05, eaves ~2.3 high) and hay stack (1.4 x 2.6, 1.85 high): circles for
    // props and contact shadow, boxes for the horses (see walkable)
    const hay = lathe([[0, -0.55], [0.5, -0.55], [0.6, -0.45], [0.62, -0.3], [0.62, 0.3], [0.6, 0.45], [0.5, 0.55], [0, 0.55]], 16); hay.rotateZ(Math.PI / 2); hay.scale(1.3, 1.3, 1.3);
    const hayM = instanced(hay, toyMat('#ffffff', { roughness: 0.65 }), [[bx + 6.3, bz + 1.4, 0.3], [bx + 6.7, bz - 0.4, -0.2], [bx + 6.5, bz + 0.5, 0.1, 1.5]].map(([x, z, ry, lift]) => ({ x, y: heightAt(x, z) + 0.78 + (lift || 0), z, ry, c: '#e8c35a' })));
    scene.add(hayM);
    occupied.push({ x: bx, z: bz, r: 5.8, h: 9, box: [4.9, 4.1, 5.2], cover: { y: 9, core: 5.8, r: Infinity, side: true }, fade: [[g]] }, { x: bx + 6.5, z: bz + 0.5, r: 1.6, h: 2.8, box: [0.8, 1.7, 2.6], fade: [[hayM, 0, 3]] });
  }

  // ---------- pond plants ----------
  {
    const pads = [];
    for (let i = 0; i < 9; i++) { const a = rand() * 6.28, r = 1.2 + rand() * (pond.r - 2.2); pads.push({ x: pond.x + Math.cos(a) * r, y: WATER_Y + 0.06, z: pond.z + Math.sin(a) * r, s: 0.7 + rand() * 0.5, ry: rand() * 6, c: jitter('#5fa83e', 0.08) }); }
    addPads(scene, pads);
    pads.slice(0, 3).forEach(p => L.petal.push({ x: p.x, y: p.y + 0.12, z: p.z, s: 1.9, ry: rand(), c: '#f7a8c4' }) || L.centre.push({ x: p.x, y: p.y + 0.16, z: p.z, s: 1.5, c: '#ffd447' }));
    [[pond.x - pond.r + 0.1, pond.z - 1.5], [pond.x + 1.8, pond.z + pond.r - 0.4], [pond.x + pond.r - 0.3, pond.z - 2.2]].forEach(([x, z]) => tuft(x, z));
    [0.62, 0.3].forEach(t => { const q = sideOf(t, 1, SW - 0.2); tuft(q.x, q.z); });
    addReeds(scene, L);
  }

  // ---------- front-left corner (left of the stream): fallen logs, mushrooms, bushes ----------
  {
    const X0 = -16.6 * S, X1 = -8.5 * S, Z0 = 12.5 * S, Z1 = 26.8 * S;
    const spot = (r, x0 = X0, x1 = X1, z0 = Z0, z1 = Z1) => { for (let k = 0; k < 60; k++) { const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0); if (free(x, z, r)) return [x, z]; } return null; };
    const logs = [], stems = [], caps = [], spots = [];
    const mushrooms = (x, z) => {
      for (let i = 0, n = 3 + Math.floor(rand() * 3); i < n; i++) {
        const px = x + (rand() - 0.5) * 0.9, pz = z + (rand() - 0.5) * 0.9, y = heightAt(px, pz) - 0.02, s = 0.75 + rand() * 0.7, ry = rand() * 6;
        stems.push({ x: px, y, z: pz, s, ry });
        caps.push({ x: px, y, z: pz, s, ry, c: jitter(pickOf(['#e2513b', '#d9462f', '#e2513b', '#c98a4a']), 0.05) });
        for (let k = 0; k < 4; k++) { const a = ry + k * 1.7, r = (k ? 0.17 : 0.02) * s; spots.push({ x: px + Math.cos(a) * r, y: y + (k ? 0.39 : 0.445) * s, z: pz + Math.sin(a) * r, s: [0.045 * s, 0.018 * s, 0.045 * s], ry: a, rz: k ? 0.6 : 0 }); }
      }
      occupied.push({ x, z, r: 0.75 });
    };
    for (let i = 0; i < 2; i++) {
      const q = spot(1.6); if (!q) continue;
      const [x, z] = q, len = 1.8 + rand() * 0.8, ry = rand() * Math.PI;
      logs.push({ x, y: heightAt(x, z) + 0.24, z, s: [len, 1, 1], ry });
      occupied.push({ x, z, r: len * 0.5 + 0.35 });
      const m = spot(0.5, x - 1.8, x + 1.8, z - 1.8, z + 1.8); if (m) mushrooms(...m); // mushrooms like the damp wood
    }
    for (let i = 0; i < 4; i++) { const q = spot(1.1); if (q) N.add('bush', nk.bush, q[0], q[1], 0.8 + rand() * 0.45); }
    for (let i = 0; i < 3; i++) { const q = spot(0.6); if (q) mushrooms(...q); }

    const logGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 14, 3); logGeo.rotateZ(Math.PI / 2);
    { const p = logGeo.attributes.position, n = logGeo.attributes.normal, cols = [];
      const bark = new THREE.Color('#8a5733'), cut = new THREE.Color('#e3b97f'), core = new THREE.Color('#c48c55'), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const end = Math.abs(n.getX(i)) > 0.5, r = Math.hypot(p.getY(i), p.getZ(i));
        if (!end) { const k = 1 + 0.05 * Math.sin(Math.atan2(p.getZ(i), p.getY(i)) * 7 + p.getX(i) * 5); p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k); c.copy(bark).multiplyScalar(0.85 + 0.15 * Math.sin(Math.atan2(p.getZ(i), p.getY(i)) * 7)); }
        else c.copy(r > 0.01 ? cut : core); // cut end: pale rim, darker heartwood
        cols.push(c.r, c.g, c.b);
      }
      logGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); logGeo.computeVertexNormals(); }
    const stemGeo = lathe([[0.07, 0], [0.085, 0.05], [0.072, 0.18], [0.06, 0.29], [0, 0.3]], 12);
    const capGeo = lathe([[0, 0.255], [0.08, 0.265], [0.2, 0.25], [0.25, 0.29], [0.24, 0.35], [0.18, 0.41], [0.09, 0.44], [0, 0.45]], 16);
    scene.add(instanced(logGeo, toyMat('#ffffff', { vertexColors: true, roughness: 0.7 }), logs));
    scene.add(instanced(stemGeo, toyMat('#f3e8d2', { roughness: 0.6 }), stems, { cast: false }));
    scene.add(instanced(capGeo, toyMat('#ffffff', { roughness: 0.38 }), caps));
    scene.add(instanced(new THREE.SphereGeometry(1, 8, 5), toyMat('#fff8ec', { roughness: 0.5 }), spots, { cast: false }));
  }

  // ---------- flowers + grass ----------
  for (let cl = 0; cl < n2(40); cl++) {
    const cx = (-16.5 + rand() * 33) * S, cz = (-22 + rand() * 49) * S; if (!free(cx, cz, 0.4)) continue;
    const pi = Math.floor(rand() * flowerPal.length); N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rand, jitter);
  }
  N.bare(() => { for (let i = 0; i < n2(9000) && L.grass.length < n2(2200); i++) {
    const x = (-17.6 + rand() * 35.2) * S, z = (-28.6 + rand() * 57.2) * S;
    if (Math.abs(x) > BW / 2 - 0.4 || Math.abs(z) > BD / 2 - 0.4) continue;
    const ds = dist2D(sPts, x, z), dp = Math.hypot(x - pond.x, z - pond.z);
    const bank = (ds > SW - 0.1 && ds < SW + 0.7) || (dp > pond.r - 0.1 && dp < pond.r + 0.6);
    if (!bank && !free(x, z, 0)) continue;
    if (bank && rand() < 0.6) continue;
    L.grass.push({ x, y: heightAt(x, z) - 0.03, z, s: bank ? 1.6 + rand() * 0.6 : 0.8 + rand() * 0.6, big: bank, ry: rand() * 6, c: jitter(bank ? '#4f9032' : pickOf(['#6aa83a', '#7cb843', '#5e9c35']), 0.06) });
  } });
  const zp = zoneProps(scene, 'meadow', { L, N, heightAt, occupied, free: freeOpen, O, Z, back: CLIFF_Z - 1.4, cliff: CLIFF_Z });
  const list = N.done();
  return { natives: list, zone: zp, ...finish(scene, L, { rand, occupied }) };
}
// seven flowers round cx, cz, a grass clump at each; ok(x, z, 0): where one may grow
export function flowerCluster(L, cx, cz, [pc, cc], ok, rand, jitter, h = heightAt) {
  for (let j = 0; j < 7; j++) {
    const x = cx + (rand() - 0.5) * 1.8, z = cz + (rand() - 0.5) * 1.8; if (!ok(x, z, 0)) continue;
    const y = h(x, z) + 0.3 + rand() * 0.08, s = 0.85 + rand() * 0.4, rx = (rand() - 0.5) * 0.4, rz = (rand() - 0.5) * 0.4;
    L.petal.push({ x, y, z, s, ry: rand() * 6, rx, rz, c: pc }); L.centre.push({ x, y: y + 0.03 * s, z, s, c: cc });
    L.grass.push({ x, y: h(x, z) - 0.03, z, s: 1.3, ry: rand() * 6, c: jitter('#5f9f36', 0.05) });
  }
}

// Planting helpers on a layout's height field, seeded random and prop list (the pond's props.js uses them too).
// Each pushes instances into L (finish() turns them into one InstancedMesh per kind) and footprints into occupied.
export function kit(L, { rand, heightAt, occupied }) {
  const pickOf = arr => arr[Math.floor(rand() * arr.length)];
  const jitter = (hex, amt) => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); return c.setHSL(hsl.h + (rand() - 0.5) * amt * 0.1, hsl.s, THREE.MathUtils.clamp(hsl.l + (rand() - 0.5) * amt, 0, 1)).getHex(); };
  const leafPal = ['#7cbc40', '#8bc64a', '#6daf3b', '#93cc52'];
  function blobCluster(cx, cy, cz, R, base, n = 9) {
    L.canopy.push({ x: cx, y: cy, z: cz, s: [R * 0.92, R * 0.8, R * 0.92], c: jitter(base, 0.04) });
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand() * 0.5, el = (i % 3) * 0.5 - 0.25 + rand() * 0.25;
      const r = R * (0.42 + rand() * 0.14);
      L.canopy.push({ x: cx + Math.cos(a) * Math.cos(el) * R * 0.7, y: cy + Math.sin(el) * R * 0.62, z: cz + Math.sin(a) * Math.cos(el) * R * 0.7, s: r, c: jitter(base, 0.07) });
    }
    for (let i = 0; i < 3; i++) { const a = rand() * 6.28; L.canopy.push({ x: cx + Math.cos(a) * R * 0.3, y: cy + R * 0.7, z: cz + Math.sin(a) * R * 0.3, s: R * (0.4 + rand() * 0.1), c: jitter(base, 0.05) }); }
  }
  // inbox 42 D: the room under a tree's crown (walk.js shelter): y its lowest leaves, core the trunk, r how far the crown reaches
  function tree(x, z, s, n) { // n: the crown's blobs round the middle one (9; inbox 34: the small orchard trees 5)
    s *= NAT_K.tree; // inbox 42 C2: everything below (crown, room under it, footprint) as big
    const h = heightAt(x, z), t = L.trunk.length, c = L.canopy.length;
    L.trunk.push({ x, y: h - 0.05, z, s: [s, s, s], ry: rand() * 6, c: jitter('#9a6438', 0.05) });
    blobCluster(x, h + 2.9 * s, z, 1.55 * s, pickOf(leafPal), n);
    occupied.push({ x, z, r: 1.7 * s, h: 4.8 * s, cover: treeCover(s), fade: [['trunk', t, 1], ['canopy', c, L.canopy.length - c]] }); // h: how tall (the camera keeps out, habitat.js guard); fade: its instances (see-through when it hides the followed animal)
  }
  function pine(x, z, s) {
    s *= NAT_K.pine;
    const h = heightAt(x, z);
    L.trunk.push({ x, y: h - 0.05, z, s: [s * 0.7, s * 0.5, s * 0.7], ry: rand() * 6, c: '#8a5a34' });
    L.pine.push({ x, y: h, z, s: [s, s * (0.95 + rand() * 0.2), s], ry: rand() * 6, c: jitter('#4f9046', 0.05) });
    occupied.push({ x, z, r: 1.3 * s, h: 3.6 * s, fade: [['trunk', L.trunk.length - 1, 1], ['pine', L.pine.length - 1, 1]] });
  }
  // 25-1 the snow's pine: the same tiers in a deeper green, each tier's top under a cap of snow (L.snow, the same transform)
  function snowpine(x, z, s) {
    s *= NAT_K.pine;
    const h = heightAt(x, z), ry = rand() * 6, sy = s * (0.95 + rand() * 0.2);
    L.trunk.push({ x, y: h - 0.05, z, s: [s * 0.7, s * 0.5, s * 0.7], ry, c: '#7a5232' });
    L.pine.push({ x, y: h, z, s: [s, sy, s], ry, c: jitter('#3d7448', 0.05) });
    L.snow.push({ x, y: h, z, s: [s, sy, s], ry, c: '#f6f9fc' });
    occupied.push({ x, z, r: 1.3 * s, h: 3.6 * s, fade: [['trunk', L.trunk.length - 1, 1], ['pine', L.pine.length - 1, 1], ['snow', L.snow.length - 1, 1]] });
  }
  function bush(x, z, s) { s *= NAT_K.bush; const h = heightAt(x, z); const c = L.canopy.length; blobCluster(x, h + 0.35 * s, z, 0.75 * s, pickOf(leafPal), 6); occupied.push({ x, z, r: 0.9 * s, h: 1.25 * s, fade: [['canopy', c, L.canopy.length - c]] }); } // h: its top (the guard's default 1.2 let a camera sit just over a big one)

  const rockPal = ['#bdb6a9', '#aaa499', '#c9c2b4', '#a09a8f'];
  function rock(x, z, s, y) {
    s *= NAT_K.rock;
    L.rock.push({ x, y: (y ?? heightAt(x, z)) + s * 0.12, z, s: [s * (1 + rand() * 0.3), s * (0.55 + rand() * 0.25), s * (0.85 + rand() * 0.2)], ry: rand() * 6, c: jitter(pickOf(rockPal), 0.05) });
    occupied.push({ x, z, r: s * 1.05, h: s, fade: [['rock', L.rock.length - 1, 1]] });
  }
  const tuft = (x, z) => { for (let i = 0; i < 4; i++) { const px = x + (rand() - 0.5) * 0.8, pz = z + (rand() - 0.5) * 0.8, y = heightAt(px, pz), hh = 1.1 + rand() * 0.5, rz = (rand() - 0.5) * 0.15; L.stem.push({ x: px, y, z: pz, s: [1, hh, 1], rz }); L.head.push({ x: px + Math.sin(-rz) * hh, y: y + hh * 1.0, z: pz, rz }); } }; // a reed tuft
  return { pickOf, jitter, tree, pine, snowpine, bush, rock, tuft };
}
export function addPads(scene, pads) { // lily pads (notched discs) floating on the water
  const padGeo = new THREE.CircleGeometry(0.55, 20, 0.35, Math.PI * 2 - 0.7); padGeo.rotateX(-Math.PI / 2);
  scene.add(instanced(padGeo, toyMat('#ffffff', { roughness: 0.35 }), pads, { cast: false }));
}
export function addReeds(scene, L) { // L.stem / L.head from kit().tuft
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 1, 5); stemGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.CapsuleGeometry(0.085, 0.3, 2, 6); // inbox 34: half the triangles (the reed bed has 1000+) headGeo.translate(0, 0.0, 0);
  const M = { stem: instanced(stemGeo, addSway(toyMat('#5d9a3a', { roughness: 0.6 }), 0.05, 1.1), L.stem), head: instanced(headGeo, toyMat('#8b5a2b', { roughness: 0.55 }), L.head) };
  scene.add(M.stem, M.head); return M; // the pond fades them (its reeds are in occupied)
}
// the shapes and materials, made once (22-1: nature.js draws the natives with the same ones)
let PG = null;
export function partGeos() {
  if (PG) return PG;
  const sphere = new THREE.SphereGeometry(1, 14, 9);
  const trunkGeo = lathe([[0.62, 0], [0.45, 0.08], [0.34, 0.3], [0.29, 0.8], [0.27, 1.6], [0.3, 2.3], [0.0, 2.45]], 12);
  { const p = trunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.4 * Math.max(0, Math.cos(4 * Math.atan2(z, x))) * Math.max(0, 1 - y / 0.45); p.setXYZ(i, x * k, y, z * k); } trunkGeo.computeVertexNormals(); }
  const pineGeo = lathe([[0, 0.7], [1.3, 0.8], [1.36, 0.95], [0.62, 1.45], [1.05, 1.5], [1.1, 1.64], [0.48, 2.12], [0.8, 2.17], [0.84, 2.3], [0.12, 3.1], [0.0, 3.15]], 16);
  // the snow on a pine's tiers (25-1): each tier's upper slope with a shell of snow a little over it, its lower lip in soft
  // scallops (the pine's profile above: [r, y] from each tier's rim to where the next one starts)
  const snowGeo = merge([[[1.36, 0.95], [0.62, 1.45]], [[1.1, 1.64], [0.48, 2.12]], [[0.84, 2.3], [0.12, 3.1]]].map(([[r0, y0], [r1, y1]], i) => {
    const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy), nr = dy / l, ny = -dr / l, at = (t, o) => [r0 + dr * t + nr * o, y0 + dy * t + ny * o], t0 = i === 2 ? 0.25 : 0.32;
    const g = lathe([at(t0, -0.04), at(t0 - 0.02, 0.05), at(t0 + 0.06, 0.09), at(0.6, 0.08), at(0.97, 0.07), [0, y1 + (i === 2 ? 0.1 : 0.06)]], 16), p = g.attributes.position, rl = at(t0, 0)[0];
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), w = (Math.hypot(x, z) / rl) ** 4; p.setY(k, p.getY(k) - w * (0.03 + 0.05 * Math.sin(7 * Math.atan2(z, x) + i * 2))); }
    g.computeVertexNormals(); return g;
  }));
  const rockGeo = new THREE.SphereGeometry(1, 16, 11);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.1 * Math.sin(3 * x + 1) * Math.sin(2.5 * y + 2) * Math.sin(3.2 * z); if (y < -0.35) y = -0.35 + (y + 0.35) * 0.3; p.setXYZ(i, x * k, y * k, z * k); } rockGeo.computeVertexNormals(); }
  const postGeo = lathe([[0.14, 0], [0.14, 0.86], [0.12, 0.97], [0.07, 1.03], [0, 1.05]], 10);
  const railGeo = new THREE.CapsuleGeometry(0.075, 1, 3, 8); railGeo.rotateZ(Math.PI / 2);
  const petalGeo = merge(Array.from({ length: 5 }, (_, i) => { const g = new THREE.SphereGeometry(0.1, 7, 5); g.scale(1, 0.35, 0.6); g.translate(0.11, 0, 0); g.rotateY(i / 5 * Math.PI * 2); return g; }));
  const centreGeo = new THREE.SphereGeometry(0.07, 8, 6); centreGeo.scale(1, 0.6, 1);
  const white = o => toyMat('#ffffff', o);
  return PG = { geo: { canopy: sphere, trunk: trunkGeo, pine: pineGeo, snow: snowGeo, rock: rockGeo, post: postGeo, rail: railGeo, petal: petalGeo, centre: centreGeo, pebble: new THREE.SphereGeometry(1, 12, 7) },
    mat: { canopy: addSway(white({ roughness: 0.5 }), 0.035, 1.2), trunk: white({ roughness: 0.55 }), pine: addSway(white({ roughness: 0.5 }), 0.02, 1.0), snow: addSway(white({ roughness: 0.62 }), 0.02, 1.0), rock: white({ roughness: 0.42 }), plain: white({ roughness: 0.5 }), centre: white({ roughness: 0.4 }) } };
}
// one InstancedMesh per kind of L, then the fade lists' kind names (in occupied) turn into those meshes
export function finish(scene, L, { rand, occupied }) {
  const { geo, mat } = partGeos();
  const M = { canopy: instanced(geo.canopy, mat.canopy, L.canopy), trunk: instanced(geo.trunk, mat.trunk, L.trunk), pine: instanced(geo.pine, mat.pine, L.pine), rock: instanced(geo.rock, mat.rock, L.rock) };
  scene.add(M.canopy, M.trunk, M.pine);
  if (L.snow.length) scene.add(M.snow = instanced(geo.snow, mat.snow, L.snow)); // 25-1: the snow's pines
  for (const o of occupied) if (o.fade) for (const p of o.fade) if (typeof p[0] === 'string') p[0] = M[p[0]];
  scene.add(M.rock);
  scene.add(instanced(geo.pebble, mat.plain, L.pebble, { cast: false }));
  scene.add(instanced(geo.post, mat.plain, L.post));
  scene.add(instanced(geo.rail, mat.plain, L.rail));
  scene.add(instanced(geo.petal, mat.plain, L.petal, { cast: false }));
  scene.add(instanced(geo.centre, mat.centre, L.centre, { cast: false }));
  // three clump shapes (3, 4, 5 leaves) so the field doesn't repeat; one material, three draw calls.
  // 26-3 그래픽 품질: 보통 3 clumps of 4, 낮음 every other one and one leaf less per clump (2, 3, 4)
  L.grass = thin(L.grass, QUALITY.g.grass);
  const gm = grassMat(), byN = [[], [], []];
  L.grass.forEach(g => byN[g.big ? 2 : Math.floor(rand() * 3)].push(g));
  const grass = byN.map((items, i) => instanced(makeGrassClump(3 + QUALITY.g.leaf + i), gm, items, { cast: false }));
  scene.add(...grass); return { grass }; // 22-1: habitat.js hides the clumps under a native and on a painted path
}

// A clump of n pointed leaves. Each leaf is folded along a raised midrib (V cross-section), so it has
// volume from every side. Normals lean up so grass lights like the ground under it.
export function makeGrassClump(n) {
  const pos = [], col = [], S = 3; // 3 rows per leaf: 10 triangles (4 rows was 14 and looked the same from play distance)
  for (let b = 0; b < n; b++) {
    const a = b / n * Math.PI * 2 + 0.3 + (b % 2) * 0.4, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const H = 0.36 + ((b * 7) % 3) * 0.08, W = 0.075, lean = 0.1 + (b % 3) * 0.05;
    const rows = [];
    for (let j = 0; j <= S; j++) {
      const t = j / S, w = W * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI / 2) * (1 - t * 0.3), off = 0.03 + lean * t * t, y = H * t;
      const cx = dx * off, cz = dz * off, rib = w * 0.55; // midrib pushed outward
      rows.push([[cx - px * w, y, cz - pz * w], [cx + dx * rib, y + rib * 0.3, cz + dz * rib], [cx + px * w, y, cz + pz * w], 0.8 + 0.38 * t]);
    }
    for (let j = 0; j < S; j++) {
      const r0 = rows[j], r1 = rows[j + 1], c0 = r0[3], c1 = r1[3];
      for (const side of [0, 1]) { // left half (edge -> rib) and right half (rib -> edge)
        const A = r0[side], B = r0[side + 1], C = r1[side], D = r1[side + 1];
        const tri = j === S - 1 ? [[A, c0], [B, c0], [C, c1]] : [[A, c0], [B, c0], [C, c1], [B, c0], [D, c1], [C, c1]];
        for (const [v, c] of tri) { pos.push(...v); col.push(c, c, c); }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const nm = g.attributes.normal; // flat-shaded facets from the fold, tipped toward the sky
  for (let i = 0; i < nm.count; i++) { const y = Math.abs(nm.getY(i)); nm.setXYZ(i, nm.getX(i) * 0.45, y * 0.45 + 1, nm.getZ(i) * 0.45); }
  g.normalizeNormals();
  return g;
}

// Grass wind: tips bend more than the base (height squared) and slow gusts roll across the field.
// Both faces keep the upward normal (no dark undersides when a leaf is seen from behind).
export function grassMat() {
  const m = toyMat('#ffffff', { roughness: 0.75, vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz;
      float hk = position.y * position.y * 2.4;
      float gust = 0.6 + 0.4 * sin(uWind * 0.55 - ip.x * 0.09 - ip.z * 0.05);
      transformed.x += (sin(uWind * 1.8 + ip.x * 0.4 + ip.z * 0.23) * 0.16 + 0.12 * gust) * hk;
      transformed.z += cos(uWind * 1.4 + ip.x * 0.21 - ip.z * 0.33) * 0.1 * hk;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (smoothstep(0.5, 1.2, length(vViewPosition)) < fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453)) discard;`); // a leaf right at the camera (a low view on a bank) dissolves instead of filling the screen
  };
  m.customProgramCacheKey = () => 'grass3';
  return m;
}

// Decor props the player buys (data.js PROPS, 서식지 꾸미기): one small toy each, base at y = 0, front to +z, inside its r.
const decorMats = {};
const dm = (c, o) => decorMats[c + (o ? JSON.stringify(o) : '')] ??= toyMat(c, o);
// 21-3 lights: a glowing part only glows by night (emissive x nightGlow; by day it is plain vinyl), with a soft halo sprite
// (additive, faded in with the night too). No real lights and no bloom: cheap on phones.
const NIGHT = sh => { sh.uniforms.uNight = nightGlow; sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader; };
const litSh = sh => { NIGHT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight;'); };
const lit = c => decorMats['lit' + c] ??= Object.assign(toyMat(c, { emissive: c, emissiveIntensity: 1.3, roughness: 0.4 }), { onBeforeCompile: litSh });
// inbox 35: a flame glows a little by day as well (more by night)
const fireMat = c => decorMats['fire' + c] ??= Object.assign(toyMat(c, { emissive: c, emissiveIntensity: 1, roughness: 0.5 }), { onBeforeCompile: sh => { NIGHT(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.3 + 1.2 * uNight;'); } });
// 22-2: the greenhouse's glass, lit softly from inside by night (c: the glow); the lighthouse's beam (additive, by night only);
// water running (fall: down a ribbon) or rippling out from a pool's middle, light bands on the shared wind clock (no sound).
// 26-10: the beam fades out towards its far end (vD: how far from the lamp, the cones' tip being the group's middle) and
// at its sides (where the cone turns edge-on), so neither reads as a hard line
const glassLit = c => decorMats['glass' + c] ??= Object.assign(toyMat('#e6f4f2', { transparent: true, opacity: 0.38, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.75 }), { onBeforeCompile: litSh });
const beamMat = c => decorMats['beam' + c] ??= Object.assign(new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  { onBeforeCompile: sh => { NIGHT(sh); const v = 'varying float vD; varying vec3 vN, vV;\n';
    sh.vertexShader = v + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvD = length(position); vN = normalMatrix * normal; vV = -mvPosition.xyz;');
    sh.fragmentShader = v + sh.fragmentShader.replace('#include <opaque_fragment>',
      'diffuseColor.a *= 0.3 * uNight * (1.0 - smoothstep(0.4, 2.65, vD)) * smoothstep(0.05, 0.55, abs(dot(normalize(vN), normalize(vV))));\n#include <opaque_fragment>'); } });
const flowMat = fall => decorMats['flow' + fall] ??= Object.assign(toyMat('#8fd3f0', { roughness: 0.15, side: THREE.DoubleSide }), {
  onBeforeCompile: sh => { sh.uniforms.uWind = windTime;
    sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = 'uniform float uWind;\nvarying vec3 vP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float fl = ${fall ? 'vP.y * 2.6 + sin(vP.x * 9.0) * 0.12' : '-length(vP.xz) * 3.2'};
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), smoothstep(0.6, 1.0, fract(fl + uWind * 1.2)) * 0.55);`); },
  customProgramCacheKey: () => 'flow' + fall });
// a ribbon of water from the lip of the falls (y 1.34, z 0.08) curving down into the pool (y 0.06, z 0.63), narrowing a little
function fallGeo() {
  const pos = [], idx = [], n = 12;
  for (let i = 0; i <= n; i++) { const s = i / n, y = 1.28 * (1 - s) + 0.06, z = 0.08 + 0.55 * Math.sqrt(s), w = 0.2 - 0.04 * s; pos.push(-w, y, z, w, y, z); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
let haloTex = null;
const haloT = () => haloTex ??= (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x2 = c.getContext('2d'), gr = x2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function halo(g, color, size, x, y, z) {
  const m = decorMats['halo' + color] ??= Object.assign(new THREE.SpriteMaterial({ map: haloT(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    { onBeforeCompile: sh => { NIGHT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= 0.75 * uNight;\n#include <opaque_fragment>'); } });
  const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.setScalar(size); sp.renderOrder = 3; g.add(sp); return sp;
}
export function part(g, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, o.m || (o.lit ? lit(color) : dm(color, o.mat))); m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
export function decorModel(id) {
  const g = new THREE.Group();
  if (id === 'hay') { // two round bales, one leaning on the other, with a band each
    const bale = lathe([[0, -0.42], [0.36, -0.42], [0.44, -0.34], [0.46, -0.2], [0.46, 0.2], [0.44, 0.34], [0.36, 0.42], [0, 0.42]], 16);
    for (const [x, y, z, ry] of [[-0.25, 0.46, 0.1, 0.2], [0.32, 0.46, -0.15, -0.3]]) {
      part(g, bale, '#e8c35a', x, y, z, { rz: Math.PI / 2, ry, mat: { roughness: 0.75 } });
      part(g, new THREE.TorusGeometry(0.465, 0.035, 6, 20), '#b5863a', x, y, z, { ry: ry + Math.PI / 2 });
    }
  } else if (id === 'trough') { // wooden trough on two legs, water inside
    part(g, roundedBox(1.4, 0.42, 0.7, 0.1), '#a8703f', 0, 0.42, 0);
    part(g, roundedBox(1.22, 0.06, 0.52, 0.03), '#7cc6e8', 0, 0.606, 0, { mat: { roughness: 0.15 } }); // 28-3: its top 6 mm over the box's (they were level and flickered)
    for (const x of [-0.5, 0.5]) part(g, roundedBox(0.16, 0.3, 0.8, 0.05), '#8a5a34', x, 0.15, 0);
  } else if (id === 'lily') { // a lily pad with its notch and one pink flower (floats: y = the water)
    part(g, new THREE.CylinderGeometry(0.68, 0.68, 0.05, 24, 1, false, 0.35, Math.PI * 2 - 0.7), '#5fae4a', 0, 0.02, 0);
    const petal = lathe([[0, 0], [0.09, 0.05], [0.1, 0.16], [0, 0.26]], 8);
    for (let i = 0; i < 6; i++) part(g, petal, '#ff9cc4', 0.2 + Math.cos(i) * 0.05, 0.06, 0.1 + Math.sin(i) * 0.05, { rz: 0.55 * Math.cos(i * 1.047), rx: 0.55 * Math.sin(i * 1.047) });
    part(g, new THREE.SphereGeometry(0.06, 10, 8), '#ffd54a', 0.2, 0.12, 0.1);
  } else if (id === 'duckhouse') { // a little house on a step, round door to the front, red roof
    part(g, roundedBox(1.3, 0.12, 1.2, 0.05), '#c9a47a', 0, 0.06, 0);
    part(g, roundedBox(1.0, 0.72, 0.9, 0.08), '#fff1d6', 0, 0.48, 0);
    for (const s of [-1, 1]) part(g, roundedBox(0.66, 0.08, 1.12, 0.04), '#d9573f', s * 0.29, 1.0, 0, { rz: -s * 0.62 });
    part(g, new THREE.CircleGeometry(0.2, 18), '#5a3a26', 0, 0.42, 0.451);
  } else if (id === 'flowers') { // a soil bed with flowers in three colours
    part(g, lathe([[0, 0], [0.82, 0], [0.86, 0.06], [0.8, 0.12], [0, 0.12]], 20), '#8a5f3c', 0, 0, 0, { mat: { roughness: 0.9 } });
    const head = new THREE.SphereGeometry(0.11, 10, 8), stem = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5);
    const cols = ['#ff8fb3', '#ffd54a', '#fff7ee'];
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, d = i ? 0.22 + (i % 4) * 0.14 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.26 + (i % 3) * 0.07;
      part(g, stem, '#5fa04a', x, 0.12 + h / 2, z, {}).scale.y = h / 0.3;
      part(g, head, cols[i % 3], x, 0.14 + h, z);
    }
  } else if (id === 'bench') { // wooden bench: seat, back, four legs
    part(g, roundedBox(1.6, 0.1, 0.48, 0.04), '#b07a48', 0, 0.46, 0);
    part(g, roundedBox(1.6, 0.34, 0.08, 0.04), '#b07a48', 0, 0.78, -0.2, { rx: -0.12 });
    for (const x of [-0.65, 0.65]) for (const z of [-0.16, 0.16]) part(g, roundedBox(0.1, 0.42, 0.1, 0.03), '#7a5232', x, 0.21, z);
  } else if (id === 'fence') { // a short length of the meadow's fence: three round-topped posts, two rails
    // inbox 42 C2: taller (0.96 -> 1.34 m, 0.4 H), the length kept so a 0.71 fence line still meets end to end
    const post = lathe([[0.12, 0], [0.12, 1.12], [0.1, 1.25], [0.06, 1.33], [0, 1.34]], 10), rail = new THREE.CapsuleGeometry(0.065, 1.7, 3, 8);
    for (const x of [-0.85, 0, 0.85]) part(g, post, '#c88a4b', x, 0, 0);
    for (const y of [0.58, 1.02]) part(g, rail, '#d0955a', 0, y, 0.04, { rz: Math.PI / 2 });
  } else if (id === 'path') { // flat stepping stones in a gentle bend (walked over: open)
    const stone = lathe([[0, 0], [0.26, 0], [0.3, 0.025], [0.29, 0.055], [0.22, 0.07], [0, 0.075]], 16);
    [[-0.78, 0.12, 1, 0.85], [-0.28, -0.08, 0.9, 1], [0.24, 0.1, 1.05, 0.9], [0.76, -0.06, 0.85, 0.95]].forEach(([x, z, sx, sz], i) =>
      part(g, stone, ['#d9d0bf', '#cfc6b4', '#e0d8c8', '#c9c1b0'][i], x, 0, z, { mat: { roughness: 0.6 } }).scale.set(sx, 1, sz));
  } else if (id === 'tulips') { // a round clay pot of tulips in three colours, two broad leaves
    part(g, lathe([[0, 0], [0.24, 0], [0.3, 0.26], [0.34, 0.28], [0.34, 0.34], [0.3, 0.35], [0, 0.35]], 18), '#d9774f', 0, 0, 0);
    part(g, new THREE.CylinderGeometry(0.29, 0.29, 0.02, 18), '#7a5232', 0, 0.335, 0);
    const cup = lathe([[0, 0], [0.07, 0.01], [0.1, 0.07], [0.095, 0.15], [0.07, 0.17], [0, 0.12]], 10), stem = new THREE.CylinderGeometry(0.02, 0.02, 1, 5), leaf = new THREE.SphereGeometry(1, 10, 6);
    [[0, 0, 0.42, '#ff6b6b'], [0.14, 0.07, 0.34, '#ffd54a'], [-0.13, 0.08, 0.36, '#ff9cc4'], [0.06, -0.14, 0.38, '#ffd54a'], [-0.08, -0.11, 0.3, '#ff6b6b']].forEach(([x, z, h, c]) => {
      part(g, stem, '#5fa04a', x, 0.34 + h / 2, z).scale.y = h; part(g, cup, c, x, 0.32 + h, z); });
    for (const s of [-1, 1]) part(g, leaf, '#5fae4a', s * 0.1, 0.48, 0.02, { rz: -s * 0.35 }).scale.set(0.05, 0.2, 0.09);
  } else if (id === 'tallgrass') { // a tuft of tall grass, two greens (the meadow's leaf clump, bigger)
    const clump = makeGrassClump(5), gm = { roughness: 0.75, vertexColors: true, side: THREE.DoubleSide };
    [[0, 0, 2.6, '#5e9c35', 0], [0.26, 0.12, 2.0, '#73b043', 1], [-0.24, 0.1, 2.2, '#6aa83a', 2], [0.04, -0.24, 1.9, '#73b043', 3]].forEach(([x, z, k, c, ry]) =>
      part(g, clump, c, x, -0.02, z, { ry, mat: gm }).scale.setScalar(k));
  } else if (id === 'stones') { // three round stones and two pebbles
    const st = new THREE.SphereGeometry(1, 16, 11);
    [[-0.2, 0.05, 0.42, 0.3, '#b8b2a6'], [0.3, -0.12, 0.3, 0.22, '#a8a39a'], [0.14, 0.32, 0.22, 0.16, '#c9c1b0'], [-0.5, -0.32, 0.11, 0.08, '#b8b2a6'], [0.52, 0.3, 0.09, 0.07, '#a8a39a']].forEach(([x, z, w, h, c]) =>
      part(g, st, c, x, h * 0.55, z, { mat: { roughness: 0.55 } }).scale.set(w, h, w * 0.9));
  } else if (id === 'mushrooms') { // a little ring of toadstools: red caps with white spots, one brown
    const stem = lathe([[0, 0], [0.07, 0], [0.06, 0.12], [0.05, 0.2], [0, 0.2]], 10), cap = lathe([[0, 0.2], [0.2, 0.19], [0.21, 0.22], [0.16, 0.3], [0.08, 0.34], [0, 0.35]], 16), dot = new THREE.SphereGeometry(0.03, 8, 6);
    [[0, 0, 1.5, '#e0473a'], [0.32, 0.12, 1, '#e0473a'], [-0.28, 0.2, 0.85, '#b5763f'], [0.08, -0.3, 0.7, '#e0473a']].forEach(([x, z, k, c]) => {
      part(g, stem, '#f6ead6', x, 0, z).scale.setScalar(k); part(g, cap, c, x, 0, z).scale.setScalar(k);
      if (c === '#e0473a') for (let i = 0; i < 4; i++) { const a = i * 1.7 + x * 3, r = i ? 0.13 : 0; part(g, dot, '#fff4e6', x + Math.cos(a) * r * k, (i ? 0.305 : 0.345) * k, z + Math.sin(a) * r * k).scale.setScalar(k); } });
  } else if (id === 'log') { // a fallen log: bark, pale rings at the ends, a sprig of leaves
    const L2 = 1.6, R = 0.27;
    part(g, new THREE.CylinderGeometry(R, R, L2, 16), '#8a5733', 0, R, 0, { rz: Math.PI / 2, mat: { roughness: 0.65 } });
    for (const s of [-1, 1]) { part(g, new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.04, 16), '#e2b77d', s * L2 / 2, R, 0, { rz: Math.PI / 2 }); part(g, new THREE.TorusGeometry(R * 0.55, 0.022, 6, 18), '#c9965f', s * (L2 / 2 + 0.02), R, 0, { ry: Math.PI / 2 }); }
    const lf = new THREE.SphereGeometry(1, 10, 6);
    for (const [a, c] of [[-0.5, '#5fae4a'], [0.5, '#73b043']]) part(g, lf, c, 0.25 + a * 0.12, R * 2 + 0.03, 0.02, { rz: a }).scale.set(0.12, 0.05, 0.08);
  } else if (id === 'lantern') { // a post lantern: a warm glowing body under a little roof
    part(g, new THREE.CylinderGeometry(0.2, 0.24, 0.08, 16), '#5a4636', 0, 0.04, 0);
    part(g, new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8), '#5a4636', 0, 0.55, 0);
    part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14), '#4a5a6a', 0, 1.03, 0);
    part(g, lathe([[0, 0], [0.12, 0], [0.17, 0.07], [0.18, 0.2], [0.15, 0.3], [0, 0.31]], 14), '#ffd27a', 0, 1.04, 0, { lit: true });
    part(g, lathe([[0, 0], [0.24, 0], [0.22, 0.04], [0.08, 0.15], [0.05, 0.2], [0, 0.22]], 14), '#4a5a6a', 0, 1.33, 0);
    halo(g, '#ffcf7a', 1.7, 0, 1.2, 0);
  } else if (id === 'jar') { // a glass jar on a stump, fireflies glowing inside, cork lid
    part(g, new THREE.CylinderGeometry(0.26, 0.3, 0.22, 14), '#a8703f', 0, 0.11, 0);
    part(g, new THREE.CylinderGeometry(0.24, 0.24, 0.02, 14), '#e2b77d', 0, 0.225, 0);
    const bug = new THREE.SphereGeometry(0.035, 8, 6);
    [[0.06, 0.38, 0.04], [-0.07, 0.48, -0.03], [0.02, 0.58, -0.07], [-0.03, 0.34, 0.08], [0.08, 0.52, 0.06]].forEach(([x, y, z]) => part(g, bug, '#d8ff6a', x, y, z, { lit: true }));
    part(g, lathe([[0, 0], [0.15, 0], [0.18, 0.04], [0.18, 0.36], [0.13, 0.42], [0.12, 0.46], [0, 0.46]], 16), '#dff2f2', 0, 0.23, 0, { mat: { transparent: true, opacity: 0.4, roughness: 0.25, depthWrite: false } });
    part(g, new THREE.CylinderGeometry(0.11, 0.12, 0.08, 12), '#c9965f', 0, 0.72, 0);
    halo(g, '#d8ff8a', 1.1, 0, 0.48, 0);
  } else if (id === 'mushlamp') { // a big toadstool whose cap glows by night
    part(g, lathe([[0, 0], [0.13, 0], [0.11, 0.2], [0.09, 0.45], [0, 0.45]], 12), '#f6ead6', 0, 0, 0);
    part(g, lathe([[0, 0.42], [0.36, 0.41], [0.37, 0.45], [0.3, 0.58], [0.16, 0.66], [0, 0.68]], 18), '#ffab85', 0, 0, 0, { lit: true });
    const dot = new THREE.SphereGeometry(0.04, 8, 6);
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, r = i % 2 ? 0.27 : 0.17; part(g, dot, '#fff4e6', Math.cos(a) * r, i % 2 ? 0.56 : 0.635, Math.sin(a) * r); }
    halo(g, '#ffb48a', 1.6, 0, 0.5, 0);
  } else if (id === 'starlamp') { // a star on a thin pole, glowing by night
    part(g, new THREE.CylinderGeometry(0.18, 0.22, 0.08, 14), '#6f7fa8', 0, 0.04, 0);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8), '#6f7fa8', 0, 0.58, 0);
    part(g, starGeo(0.27, 0.12), '#ffe066', 0, 1.35, 0, { lit: true });
    halo(g, '#ffe27a', 1.6, 0, 1.35, 0);
  } else if (id === 'att_sunflower') { // inbox 41 C 출석 선물: a sunflower on a tall stem, two leaves, its face to the front and a little up
    part(g, new THREE.CylinderGeometry(0.035, 0.045, 1.2, 8), '#5fa04a', 0, 0.6, 0);
    const lf = new THREE.SphereGeometry(1, 10, 6);
    for (const s of [-1, 1]) part(g, lf, '#5fae4a', s * 0.15, s > 0 ? 0.62 : 0.46, 0, { rz: s * 0.55 }).scale.set(0.18, 0.06, 0.1);
    const head = new THREE.Group(); head.position.set(0, 1.26, 0.04); head.rotation.x = -0.3; g.add(head);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; part(head, lf, '#ffd54a', Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0, { rz: a }).scale.set(0.13, 0.06, 0.035); }
    part(head, new THREE.CylinderGeometry(0.16, 0.16, 0.09, 20), '#8a5733', 0, 0, 0.02, { rx: Math.PI / 2 });
  } else if (id === 'att_birdhouse') { // 출석 선물: a little blue birdhouse on a post, a red roof, a round door and a perch
    part(g, roundedBox(0.1, 1.05, 0.1, 0.035), '#b07a48', 0, 0.525, 0);
    part(g, roundedBox(0.42, 0.4, 0.38, 0.05), '#7fc3e8', 0, 1.25, 0);
    for (const s of [-1, 1]) part(g, roundedBox(0.3, 0.05, 0.48, 0.02), '#e86a5a', s * 0.13, 1.53, 0, { rz: -s * 0.7 });
    part(g, new THREE.CircleGeometry(0.075, 16), '#5a3a26', 0, 1.28, 0.192);
    part(g, new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6), '#b07a48', 0, 1.16, 0.23, { rx: Math.PI / 2 });
  } else if (id === 'att_balloons') { // 출석 선물: three balloons on strings tied to a little weight; they sway together
    part(g, roundedBox(0.2, 0.12, 0.2, 0.04), '#5a6a7a', 0, 0.06, 0);
    const sw = new THREE.Group(); sw.position.y = 0.12; sw.userData.moves = true; g.add(sw);
    const ball = lathe([[0, -0.24], [0.1, -0.21], [0.17, -0.12], [0.2, 0], [0.19, 0.1], [0.13, 0.19], [0, 0.23]], 16), str = new THREE.CylinderGeometry(0.006, 0.006, 1, 4), up = new THREE.Vector3(0, 1, 0);
    [[-0.16, 1.3, 0.02, '#ff6b6b'], [0.17, 1.42, -0.04, '#5aa9e6'], [0.01, 1.62, 0.06, '#ffd54a']].forEach(([x, y, z, c]) => {
      const d = new THREE.Vector3(x, y - 0.26, z), L2 = d.length();
      part(sw, str, '#f1e4c8', x / 2, (y - 0.26) / 2, z / 2).scale.y = L2; sw.children.at(-1).quaternion.setFromUnitVectors(up, d.normalize());
      part(sw, ball, c, x, y, z, { rz: -x * 0.6 }); part(sw, new THREE.ConeGeometry(0.03, 0.05, 8), c, x, y - 0.26, z); });
    g.userData.tick = t => { sw.rotation.z = 0.05 * Math.sin(t * 0.7); sw.rotation.x = 0.03 * Math.sin(t * 0.53 + 1); };
  } else if (id === 'att_wcan') { // 출석 선물: a round watering can, its spout up to the front-right, a handle over the top
    part(g, lathe([[0, 0], [0.2, 0], [0.22, 0.04], [0.22, 0.3], [0.19, 0.34], [0, 0.34]], 18), '#5aa9e6', 0, 0, 0);
    part(g, new THREE.CapsuleGeometry(0.035, 0.36, 3, 8), '#5aa9e6', 0.3, 0.3, 0, { rz: -0.9 });
    part(g, new THREE.CylinderGeometry(0.07, 0.04, 0.06, 12), '#4a8fd0', 0.47, 0.44, 0, { rz: -0.9 });
    part(g, new THREE.TorusGeometry(0.15, 0.03, 8, 16, Math.PI), '#4a8fd0', -0.02, 0.34, 0);
  } else if (id === 'att_signpost') { // 출석 선물: a post with two pointed boards (no writing on them), a round cap
    part(g, roundedBox(0.12, 1.3, 0.12, 0.04), '#b07a48', 0, 0.65, 0);
    part(g, new THREE.SphereGeometry(0.08, 12, 9), '#ffd54a', 0, 1.32, 0);
    [[1.08, 0.25, '#fff1d6', 1], [0.8, -0.4, '#bfe3f2', -1]].forEach(([y, ry, c, s]) => { const b = new THREE.Group(); b.position.y = y; b.rotation.y = ry; g.add(b);
      part(b, roundedBox(0.6, 0.18, 0.05, 0.025), c, s * 0.24, 0, 0.08);
      part(b, roundedBox(0.127, 0.127, 0.05, 0.02), c, s * 0.54, 0, 0.08, { rz: Math.PI / 4 }); });
  } else if (id === 'att_cart') { // 출석 선물: a red flower cart: a box on four wheels, flowers in three colours, a handle to the right
    part(g, roundedBox(1.0, 0.3, 0.6, 0.06), '#e86a5a', -0.12, 0.42, 0);
    part(g, roundedBox(0.88, 0.04, 0.48, 0.02), '#8a5f3c', -0.12, 0.575, 0, { mat: { roughness: 0.9 } });
    const wheel = new THREE.CylinderGeometry(0.17, 0.17, 0.07, 18), hub = new THREE.SphereGeometry(0.045, 10, 8);
    for (const x of [-0.44, 0.2]) for (const z of [-1, 1]) { part(g, wheel, '#b07a48', x, 0.17, z * 0.33, { rx: Math.PI / 2 }); part(g, hub, '#ffd54a', x, 0.17, z * 0.375); }
    part(g, new THREE.CapsuleGeometry(0.03, 0.5, 3, 8), '#7a5232', 0.61, 0.35, 0, { rz: 1.15 });
    part(g, new THREE.CapsuleGeometry(0.03, 0.3, 3, 8), '#7a5232', 0.865, 0.235, 0, { rx: Math.PI / 2 });
    const head = new THREE.SphereGeometry(0.1, 12, 9), cols = ['#ff8fb3', '#ffd54a', '#fff7ee'];
    [[-0.45, -0.1], [-0.25, 0.12], [-0.05, -0.12], [0.15, 0.1], [-0.15, 0.02], [0.18, -0.12]].forEach(([x, z], i) => part(g, head, cols[i % 3], x, 0.66 + (i % 2) * 0.03, z));
  } else if (id === 'att_rainbow') { // 출석 선물: a small rainbow arch, five bands, its feet in two white clouds
    ['#ff6b6b', '#ffb44a', '#ffe066', '#7cc56a', '#5aa9e6'].forEach((c, i) => part(g, new THREE.TorusGeometry(0.78 - i * 0.1, 0.052, 10, 32, Math.PI), c, 0, 0.12, 0));
    const puff = new THREE.SphereGeometry(1, 14, 10);
    for (const s of [-1, 1]) [[0, 0.16, 0, 0.2], [0.14, 0.12, 0.06, 0.15], [-0.13, 0.11, -0.05, 0.15], [0.02, 0.28, 0.02, 0.14]].forEach(([x, y, z, k]) => part(g, puff, '#fff7ee', s * 0.58 + x, y, z).scale.setScalar(k));
  } else if (id === 'firstday') { // inbox 41 D 첫날 할 일 선물: a little round tree in a clay pot, a red band and bow round the pot
    part(g, lathe([[0, 0], [0.22, 0], [0.27, 0.3], [0.31, 0.32], [0.31, 0.38], [0.27, 0.39], [0, 0.39]], 18), '#d9774f', 0, 0, 0);
    part(g, new THREE.CylinderGeometry(0.26, 0.26, 0.02, 18), '#7a5232', 0, 0.375, 0);
    part(g, new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), '#8a5733', 0, 0.62, 0);
    const ball = new THREE.SphereGeometry(1, 16, 12);
    [[0, 1.0, 0, 0.3], [0.2, 0.88, 0.05, 0.2], [-0.19, 0.9, -0.03, 0.21], [0.03, 0.86, -0.18, 0.19]].forEach(([x, y, z, k], i) => part(g, ball, i % 2 ? '#73b043' : '#5fae4a', x, y, z).scale.setScalar(k));
    part(g, new THREE.TorusGeometry(0.285, 0.02, 6, 24), '#e5584a', 0, 0.22, 0, { rx: Math.PI / 2 });
    for (const s of [-1, 1]) part(g, ball, '#e5584a', s * 0.075, 0.22, 0.29, { rz: s * 0.35 }).scale.set(0.075, 0.045, 0.03);
    part(g, ball, '#e5584a', 0, 0.22, 0.3).scale.setScalar(0.032);
  } else if (id === 'swing') { // 28-2: an A-frame swing a rabbit, a piglet or a fox can ride (play.js G.swing); the seat sways, more with someone on
    const { pivot: H, rope: R, half: X } = PLAY.swing, k = 0.24, leg = roundedBox(0.16, H / Math.cos(k) + 0.06, 0.16, 0.06);
    for (const x of [-X, X]) { for (const s of [-1, 1]) part(g, leg, '#b07a48', x, H / 2, s * H / 2 * Math.tan(k), { rx: -s * k }); part(g, new THREE.SphereGeometry(0.15, 12, 9), '#ffd54a', x, H, 0); }
    part(g, new THREE.CapsuleGeometry(0.1, 2 * X, 4, 10), '#c88a4b', 0, H, 0, { rz: Math.PI / 2 });
    const seat = new THREE.Group(); seat.position.y = H; seat.userData.moves = true; g.add(seat);
    for (const x of [-0.5, 0.5]) part(seat, new THREE.CylinderGeometry(0.03, 0.03, R, 6), '#f1e4c8', x, -R / 2, 0);
    part(seat, roundedBox(1.15, 0.1, 0.55, 0.04), '#e86a5a', 0, -R - 0.05, 0);
    play(g, 'swing', { seat });
  } else if (id === 'gazebo') { // a little round gazebo: six posts, a dome roof; animals walk under it (open) and shelter there in the rain
    const k = new THREE.Group(), S = 1.5; k.scale.setScalar(S); g.add(k); // drawn at 1, built 1.5x: a rabbit, a chicken or a piglet fits under it
    part(k, new THREE.CylinderGeometry(1.32, 1.36, 0.05, 28), '#c9a47a', 0, 0.025, 0);
    const posts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; posts.push([Math.cos(a) * 1.12, Math.sin(a) * 1.12]); }
    for (const [x, z] of posts) part(k, new THREE.CylinderGeometry(0.07, 0.08, 1.75, 10), '#fff1d6', x, 0.9, z);
    part(k, lathe([[0, 0], [1.55, 0], [1.6, 0.06], [1.45, 0.22], [1.0, 0.5], [0.45, 0.72], [0, 0.78]], 28), '#e8735a', 0, 1.75, 0);
    part(k, new THREE.TorusGeometry(1.42, 0.06, 8, 32), '#fff1d6', 0, 1.79, 0, { rx: Math.PI / 2 });
    part(k, new THREE.SphereGeometry(0.11, 12, 9), '#ffd54a', 0, 2.58, 0);
    g.userData.posts = posts.map(([x, z]) => [x * S, z * S]); // crowd.js bodies (habitat.js): the animals go round the posts, not the whole gazebo
    g.userData.under = { h: 1.75 * S, r: 1.12 * S - 0.15, gap: 1.12 * S - 0.3 }; // walk.js: who fits beneath (shorter than the eaves, narrower than between two posts)
  } else if (id === 'boat') { // a small rowing boat with two seats and an oar; it bobs on the water
    const k = new THREE.Group(), b = new THREE.Group(); k.rotation.y = Math.PI / 2 - 0.35; k.add(b); g.add(k); b.userData.moves = true; // lies across the screen: end-on from the camera it read as a mirror
    const hull = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    part(b, hull, '#5a8fd0', 0, 0.12, 0, { mat: { side: THREE.DoubleSide } }).scale.set(0.5, 0.3, 1.0);
    part(b, new THREE.CircleGeometry(0.9, 24), '#e9d3a8', 0, 0.01, 0, { rx: -Math.PI / 2 }).scale.set(0.5, 1, 1); // a wooden floor inside, so it is not water-blue
    part(b, new THREE.TorusGeometry(1, 0.05, 8, 32), '#fff1d6', 0, 0.12, 0, { rx: Math.PI / 2 }).scale.set(0.5, 1.0, 1);
    for (const z of [-0.35, 0.3]) part(b, roundedBox(0.8, 0.06, 0.2, 0.025), '#c98c52', 0, 0.06, z);
    part(b, new THREE.CapsuleGeometry(0.03, 1.2, 3, 6), '#c98c52', 0.18, 0.12, 0, { rx: Math.PI / 2, rz: 0.12 });
    part(b, roundedBox(0.14, 0.03, 0.3, 0.012), '#c98c52', 0.24, 0.12, 0.72, { ry: 0.12 });
    g.userData.tick = t => { b.position.y = 0.025 * Math.sin(t * 1.3); b.rotation.z = 0.04 * Math.sin(t * 0.9); b.rotation.x = 0.025 * Math.sin(t * 1.1 + 1); };
  } else if (id === 'stepping') { // stepping stones across the water, their tops just above it (y = the water)
    const st = lathe([[0, -0.45], [0.3, -0.45], [0.33, 0], [0.31, 0.06], [0.24, 0.1], [0, 0.11]], 16);
    [[-1.0, 0.06, 1], [-0.5, -0.06, 0.92], [0, 0.04, 1.05], [0.5, -0.05, 0.9], [1.0, 0.05, 1]].forEach(([x, z, k], i) =>
      part(g, st, ['#b8b2a6', '#a8a39a', '#c0b9ac', '#a8a39a', '#b8b2a6'][i], x, 0, z, { mat: { roughness: 0.55 } }).scale.set(k, 1, k * 0.9));
  } else if (id === 'pinwheel') { // a pinwheel on a stick, four colours; it turns
    part(g, new THREE.CylinderGeometry(0.03, 0.035, 1.0, 8), '#f1e4c8', 0, 0.5, 0);
    const rot = new THREE.Group(); rot.position.set(0, 1.0, 0.06); rot.userData.moves = true; g.add(rot);
    const blade = new THREE.SphereGeometry(1, 12, 8);
    ['#ff6b6b', '#ffd54a', '#5aa9e6', '#7cc56a'].forEach((c, i) => { const a = i * Math.PI / 2; part(rot, blade, c, Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0, { rz: a + 0.5, ry: 0.35 }).scale.set(0.17, 0.09, 0.025); });
    part(rot, new THREE.SphereGeometry(0.045, 10, 8), '#fff1d6', 0, 0, 0.03);
    g.userData.tick = t => { rot.rotation.z = -t * 2.6; };
  } else if (id === 'vane') { // a weather vane: a pole, the four arms, an arrow on top that swings with the wind
    part(g, new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), '#5a6a7a', 0, 0.04, 0);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), '#5a6a7a', 0, 0.79, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; part(g, new THREE.CapsuleGeometry(0.018, 0.4, 2, 6), '#5a6a7a', Math.cos(a) * 0.2, 1.2, Math.sin(a) * 0.2, { rz: Math.PI / 2, ry: -a }); part(g, new THREE.SphereGeometry(0.04, 8, 6), '#f0c24a', Math.cos(a) * 0.42, 1.2, Math.sin(a) * 0.42); }
    const ar = new THREE.Group(); ar.position.y = 1.55; ar.userData.moves = true; g.add(ar);
    part(ar, new THREE.CapsuleGeometry(0.025, 0.7, 2, 6), '#f0c24a', 0, 0, 0, { rz: Math.PI / 2 });
    part(ar, new THREE.ConeGeometry(0.08, 0.18, 10), '#f0c24a', 0.45, 0, 0, { rz: -Math.PI / 2 });
    part(ar, roundedBox(0.2, 0.18, 0.03, 0.012), '#f0c24a', -0.4, 0.02, 0);
    part(g, new THREE.SphereGeometry(0.05, 10, 8), '#f0c24a', 0, 1.58, 0);
    g.userData.tick = t => { ar.rotation.y = 0.7 * Math.sin(t * 0.23) + 0.18 * Math.sin(t * 0.9); };
  } else if (id === 'mailbox') { // a round-topped mailbox on a post, a little flag on its side
    part(g, roundedBox(0.12, 0.8, 0.12, 0.04), '#b07a48', 0, 0.4, 0);
    part(g, roundedBox(0.34, 0.24, 0.52, 0.05), '#e0473a', 0, 0.9, 0);
    part(g, new THREE.CylinderGeometry(0.17, 0.17, 0.52, 18, 1, false, -Math.PI / 2, Math.PI), '#e0473a', 0, 1.0, 0, { rx: Math.PI / 2 });
    part(g, roundedBox(0.26, 0.2, 0.02, 0.01), '#fff1d6', 0, 0.92, 0.265);
    part(g, roundedBox(0.03, 0.3, 0.03, 0.01), '#5a4636', 0.19, 1.02, -0.1);
    part(g, roundedBox(0.03, 0.12, 0.16, 0.01), '#ffd54a', 0.19, 1.12, -0.03);
  // 22-2 큰 소품
  } else if (id === 'barn') { // a red barn: a gabled body, a brown roof, a big cream-framed door, a round loft window; animals shelter by it in the rain
    // inbox 42 C2: walls and gable taller (1.45/2.25 -> 1.85/2.95) so k 2.6 reaches 2.5H on a smaller footprint (k 3.3 left the meadow ~4 spots)
    part(g, roundedBox(3.0, 0.12, 2.6, 0.05), '#c9a47a', 0, 0.06, 0);
    const body = new THREE.ExtrudeGeometry(new THREE.Shape([[-1.25, 0], [1.25, 0], [1.25, 1.85], [0, 2.95], [-1.25, 1.85]].map(([x, y]) => new THREE.Vector2(x, y))),
      { depth: 1.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 }); body.translate(0, 0, -0.95);
    part(g, body, '#e0604a', 0, 0.12, 0);
    for (const s of [-1, 1]) part(g, roundedBox(2.04, 0.14, 2.4, 0.05), '#8a5a3a', s * 0.78, 2.57, 0, { rz: -s * 0.73 });
    part(g, new THREE.CapsuleGeometry(0.09, 2.3, 3, 8), '#fff1d6', 0, 3.2, 0, { rx: Math.PI / 2 });
    part(g, roundedBox(1.0, 1.4, 0.08, 0.03), '#fff1d6', 0, 0.82, 1.04);
    part(g, roundedBox(0.82, 1.25, 0.08, 0.03), '#b8432f', 0, 0.745, 1.07);
    part(g, new THREE.CircleGeometry(0.22, 20), '#fff1d6', 0, 2.45, 1.035); part(g, new THREE.CircleGeometry(0.15, 20), '#5a3a26', 0, 2.45, 1.04);
  } else if (id === 'windmill') { // a round cream tower under a red cap; four sails turn slowly
    part(g, new THREE.CylinderGeometry(0.95, 1.0, 0.1, 24), '#c9a47a', 0, 0.05, 0);
    part(g, lathe([[0, 0], [0.78, 0], [0.74, 0.6], [0.62, 1.8], [0.55, 2.4], [0.3, 2.42], [0, 2.42]], 24), '#fff1d6', 0, 0.1, 0);
    part(g, lathe([[0, 0], [0.66, 0], [0.64, 0.12], [0.5, 0.42], [0.25, 0.6], [0, 0.64]], 24), '#d9573f', 0, 2.48, 0);
    part(g, roundedBox(0.42, 0.62, 0.1, 0.04), '#8a5a34', 0, 0.41, 0.74); part(g, new THREE.CylinderGeometry(0.21, 0.21, 0.1, 16), '#8a5a34', 0, 0.72, 0.74, { rx: Math.PI / 2 });
    const bl = new THREE.Group(); bl.position.set(0, 2.62, 0.82); bl.userData.moves = true; g.add(bl);
    part(bl, new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), '#b07a48', 0, 0, -0.12, { rx: Math.PI / 2 }); part(bl, new THREE.SphereGeometry(0.12, 12, 9), '#b07a48', 0, 0, 0.06);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      part(bl, new THREE.CapsuleGeometry(0.035, 1.25, 3, 6), '#b07a48', c * 0.68, s * 0.68, 0.02, { rz: a - Math.PI / 2 });
      part(bl, roundedBox(0.34, 0.95, 0.04, 0.02), '#fff7ee', c * 0.78 - s * 0.17, s * 0.78 + c * 0.17, 0, { rz: a - Math.PI / 2 }); }
    g.userData.tick = t => { bl.rotation.z = -t * 0.45; };
  } else if (id === 'greenhouse') { // a glass house with an arched roof, three pots of leaves inside; by night it glows softly from within
    part(g, roundedBox(2.5, 0.12, 1.8, 0.05), '#c9a47a', 0, 0.06, 0);
    part(g, roundedBox(2.36, 0.4, 1.66, 0.06), '#fff1d6', 0, 0.32, 0);
    const leaf = new THREE.SphereGeometry(1, 12, 9);
    for (const [x, c] of [[-0.7, '#5fae4a'], [0, '#73b043'], [0.7, '#6aa83a']]) {
      part(g, lathe([[0, 0], [0.16, 0], [0.2, 0.22], [0.22, 0.24], [0, 0.24]], 14), '#d9774f', x, 0.52, 0);
      for (const [dx, dy, k] of [[0, 0.42, 0.24], [-0.13, 0.33, 0.16], [0.14, 0.35, 0.17]]) part(g, leaf, c, x + dx, 0.52 + dy, 0.02).scale.setScalar(k);
    }
    for (const x of [-0.5, 0.5]) part(g, new THREE.SphereGeometry(0.07, 10, 8), '#ffe27a', x, 1.78, 0, { lit: true });
    const glass = glassLit('#ffcf7a'), noShadow = m => { m.castShadow = false; };
    noShadow(part(g, roundedBox(2.3, 0.75, 1.6, 0.04), '', 0, 0.895, 0, { m: glass }));
    noShadow(part(g, new THREE.CylinderGeometry(0.8, 0.8, 2.3, 20, 1, true, 0, Math.PI), '', 0, 1.27, 0, { rz: Math.PI / 2, m: glass }));
    for (const s of [-1, 1]) noShadow(part(g, new THREE.CircleGeometry(0.8, 20, 0, Math.PI), '', s * 1.15, 1.27, 0, { ry: s * Math.PI / 2, m: glass }));
    for (const x of [-1.15, -0.38, 0.38, 1.15]) part(g, new THREE.TorusGeometry(0.8, 0.035, 6, 20, Math.PI), '#fff1d6', x, 1.27, 0, { ry: Math.PI / 2 });
    part(g, new THREE.CapsuleGeometry(0.035, 2.3, 2, 6), '#fff1d6', 0, 2.07, 0, { rz: Math.PI / 2 });
    for (const x of [-1.15, 1.15]) for (const z of [-0.8, 0.8]) part(g, roundedBox(0.07, 0.75, 0.07, 0.02), '#fff1d6', x, 0.895, z);
    halo(g, '#ffd98a', 2.6, 0, 1.1, 0);
  } else if (id === 'treehouse') { // a little house on a round platform round a tree trunk, a ladder up to it, the leaves above; animals shelter under it in the rain
    part(g, lathe([[0, 0], [0.5, 0], [0.4, 0.15], [0.33, 0.5], [0.3, 3.4], [0, 3.4]], 14), '#8a5733', 0, 0, 0, { mat: { roughness: 0.65 } });
    part(g, new THREE.CylinderGeometry(1.05, 1.05, 0.12, 20), '#c98c52', 0, 1.6, 0);
    part(g, roundedBox(1.2, 0.85, 1.0, 0.08), '#fff1d6', 0, 2.085, 0.05);
    for (const s of [-1, 1]) part(g, roundedBox(0.8, 0.09, 1.2, 0.04), '#d9573f', s * 0.33, 2.67, 0.05, { rz: -s * 0.62 });
    part(g, new THREE.CircleGeometry(0.2, 18), '#5a3a26', 0, 2.0, 0.551);
    part(g, new THREE.TorusGeometry(1.0, 0.04, 6, 28), '#b07a48', 0, 1.95, 0, { rx: Math.PI / 2 });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), '#b07a48', Math.cos(a), 1.8, Math.sin(a)); }
    for (const x of [-0.2, 0.2]) part(g, roundedBox(0.06, 1.7, 0.06, 0.02), '#b07a48', x, 0.82, 1.2, { rx: -0.15 });
    for (const y of [0.3, 0.65, 1.0, 1.35]) part(g, new THREE.CapsuleGeometry(0.025, 0.36, 2, 6), '#c98c52', 0, y, 1.2 - (y - 0.82) * 0.151, { rz: Math.PI / 2 });
    const blob = new THREE.SphereGeometry(1, 16, 12);
    part(g, blob, '#7cbc40', 0, 3.75, -0.1).scale.setScalar(1.05);
    for (let i = 0; i < 5; i++) { const a = i * 1.257 + 0.4; part(g, blob, ['#8bc64a', '#6daf3b'][i % 2], Math.cos(a) * 0.75, 3.55, Math.sin(a) * 0.75 - 0.1).scale.setScalar(0.6); }
    part(g, blob, '#93cc52', 0.1, 4.35, -0.05).scale.setScalar(0.6);
  } else if (id === 'well') { // a round stone well with water inside, a little red roof on two posts, a crank and a bucket
    part(g, lathe([[0.56, 0], [0.8, 0], [0.84, 0.06], [0.84, 0.58], [0.78, 0.66], [0.62, 0.66], [0.56, 0.6], [0.56, 0]], 22), '#c0b9ac', 0, 0, 0, { mat: { roughness: 0.55 } });
    part(g, new THREE.CylinderGeometry(0.57, 0.57, 0.04, 22), '#7cc6e8', 0, 0.42, 0, { mat: { roughness: 0.15 } });
    for (const s of [-1, 1]) { part(g, roundedBox(0.12, 1.5, 0.12, 0.04), '#b07a48', s * 0.7, 0.75, 0); part(g, roundedBox(0.72, 0.08, 1.15, 0.04), '#d9573f', s * 0.3, 1.66, 0, { rz: -s * 0.62 }); }
    part(g, new THREE.CapsuleGeometry(0.04, 1.3, 2, 6), '#8a5a34', 0, 1.25, 0, { rz: Math.PI / 2 });
    part(g, roundedBox(0.04, 0.22, 0.04, 0.015), '#8a5a34', 0.86, 1.15, 0);
    part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), '#f1e4c8', 0, 1.03, 0);
    part(g, lathe([[0, 0], [0.11, 0], [0.14, 0.2], [0.13, 0.21], [0, 0.21]], 12), '#a8703f', 0, 0.72, 0);
  } else if (id === 'arch') { // a garden arch: two cream posts and a round top, leaves and flowers climbing it; animals walk through it (open)
    for (const s of [-1, 1]) { part(g, roundedBox(0.3, 0.1, 0.36, 0.04), '#c9a47a', s * 0.9, 0.05, 0); part(g, roundedBox(0.14, 1.75, 0.2, 0.05), '#fff1d6', s * 0.9, 0.95, 0); }
    part(g, new THREE.TorusGeometry(0.9, 0.08, 8, 28, Math.PI), '#fff1d6', 0, 1.8, 0);
    const blob = new THREE.SphereGeometry(1, 12, 9), bud = new THREE.SphereGeometry(0.06, 8, 6);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI, x = Math.cos(a) * 0.9, y = 1.8 + Math.sin(a) * 0.9;
      part(g, blob, i % 2 ? '#6daf3b' : '#7cbc40', x, y, (i % 3 - 1) * 0.04).scale.setScalar(0.17 + (i % 3) * 0.02);
      if (i % 2 === 0) part(g, bud, i % 4 ? '#fff7ee' : '#ff9cc4', x * 1.05, y + 0.06, 0.15); }
    for (const s of [-1, 1]) for (const y of [0.55, 1.05, 1.45]) part(g, blob, '#7cbc40', s * (0.9 + (y > 1 ? 0.04 : -0.04)), y, 0.02).scale.setScalar(0.14);
    g.userData.posts = [[-0.9, 0], [0.9, 0]];
  } else if (id === 'picnic') { // a red-and-cream checked mat, a basket and a plate of fruit; walked over (open)
    const sq = roundedBox(0.4, 0.03, 0.4, 0.012);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) part(g, sq, (i + j) % 2 ? '#fff1d6' : '#e8735a', (i - 2) * 0.4, 0.015, (j - 1.5) * 0.4);
    part(g, lathe([[0, 0], [0.2, 0], [0.25, 0.2], [0.22, 0.2], [0.18, 0.04], [0, 0.04]], 14), '#c98c52', -0.45, 0.03, -0.25);
    part(g, new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), '#b07a48', -0.45, 0.23, -0.25);
    part(g, new THREE.SphereGeometry(0.08, 12, 9), '#e0473a', -0.4, 0.19, -0.22);
    part(g, new THREE.CylinderGeometry(0.2, 0.17, 0.03, 18), '#fff7ee', 0.4, 0.045, 0.2);
    part(g, new THREE.SphereGeometry(0.08, 12, 9), '#e0473a', 0.36, 0.13, 0.2); part(g, new THREE.SphereGeometry(0.075, 12, 9), '#ffb347', 0.47, 0.12, 0.25);
    part(g, lathe([[0, 0], [0.06, 0], [0.07, 0.12], [0.06, 0.12], [0.05, 0.02], [0, 0.02]], 10), '#5aa9e6', 0.05, 0.03, 0.45);
  } else if (id === 'falls') { // a pile of round rocks, water running down its front into a little pool (a flowing shader, no sound)
    const st = new THREE.SphereGeometry(1, 18, 12);
    [[0, 0.6, -0.35, 1.0, 0.75, 0.7, '#b8b2a6'], [0.12, 1.32, -0.42, 0.6, 0.4, 0.5, '#a8a39a'], [-0.75, 0.38, 0.05, 0.45, 0.38, 0.45, '#c0b9ac'],
      [0.78, 0.33, 0.1, 0.42, 0.33, 0.42, '#a8a39a'], [-0.45, 0.95, -0.6, 0.5, 0.45, 0.45, '#c0b9ac']].forEach(([x, y, z, sx, sy, sz, c]) =>
      part(g, st, c, x, y, z, { mat: { roughness: 0.55 } }).scale.set(sx, sy, sz));
    for (const [x, y, z, sx, sz] of [[0.12, 1.68, -0.42, 0.35, 0.3], [-0.5, 1.36, -0.6, 0.28, 0.25]]) part(g, st, '#73b043', x, y, z).scale.set(sx, 0.08, sz);
    part(g, fallGeo(), '', 0, 0, 0, { m: flowMat(1) }).castShadow = false;
    part(g, new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24), '', 0, 0.05, 0.66, { m: flowMat(0) }); // ripples from its own middle (flowMat: local x, z; one part, so bake() leaves it)
    part(g, new THREE.TorusGeometry(0.57, 0.07, 8, 28), '#c0b9ac', 0, 0.06, 0.66, { rx: Math.PI / 2, mat: { roughness: 0.55 } });
    for (const [x, z, k] of [[-0.1, 0.62, 0.08], [0.11, 0.66, 0.07], [0, 0.72, 0.06]]) part(g, new THREE.SphereGeometry(1, 10, 8), '#ffffff', x, 0.08, z).scale.setScalar(k);
  } else if (id === 'lighthouse') { // a little white lighthouse with two red bands on a rock in the pond; by night its lamp glows and a beam turns (y = the water)
    part(g, lathe([[0, -0.5], [0.85, -0.5], [0.95, -0.1], [0.85, 0.12], [0.6, 0.22], [0, 0.24]], 18), '#a8a39a', 0, 0, 0, { mat: { roughness: 0.55 } });
    part(g, new THREE.SphereGeometry(1, 14, 10), '#b8b2a6', 0.62, 0.02, 0.38, { mat: { roughness: 0.55 } }).scale.set(0.35, 0.22, 0.3);
    part(g, lathe([[0, 0], [0.42, 0], [0.38, 0.7], [0.32, 1.5], [0, 1.5]], 20), '#fff7ee', 0, 0.2, 0);
    part(g, new THREE.CylinderGeometry(0.395, 0.412, 0.3, 20), '#e0473a', 0, 0.7, 0); part(g, new THREE.CylinderGeometry(0.343, 0.366, 0.3, 20), '#e0473a', 0, 1.4, 0);
    part(g, roundedBox(0.2, 0.32, 0.06, 0.03), '#5a6a7a', 0, 0.38, 0.41);
    part(g, new THREE.CylinderGeometry(0.46, 0.46, 0.06, 20), '#4a5a6a', 0, 1.73, 0); part(g, new THREE.TorusGeometry(0.44, 0.025, 6, 24), '#4a5a6a', 0, 1.86, 0, { rx: Math.PI / 2 });
    part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), '#ffe27a', 0, 1.91, 0, { lit: true });
    part(g, lathe([[0, 0], [0.3, 0], [0.28, 0.05], [0.12, 0.22], [0, 0.26]], 16), '#e0473a', 0, 2.06, 0); part(g, new THREE.SphereGeometry(0.05, 8, 6), '#4a5a6a', 0, 2.34, 0);
    halo(g, '#ffe27a', 1.5, 0, 1.91, 0);
    const bm = new THREE.Group(); bm.position.y = 1.91; bm.userData.moves = true; g.add(bm);
    const cone = new THREE.ConeGeometry(0.5, 2.6, 16, 1, true).translate(0, -1.3, 0);
    for (const s of [-1, 1]) { const m = part(bm, cone, '', 0, 0, 0, { rz: s * Math.PI / 2, m: beamMat('#fff2b0') }); m.castShadow = m.receiveShadow = false; m.renderOrder = 3; }
    g.userData.tick = t => { bm.rotation.y = t * 0.5; };
  } else if (id === 'waterpav') { // a water pavilion: an eight-sided deck on stilts in the pond, four posts, a low rail, a teal roof (y = the water)
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; part(g, new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), '#8a5a34', Math.sin(a) * 1.6, -0.15, Math.cos(a) * 1.6);
      part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), '#fff1d6', Math.sin(a) * 1.6, 0.64, Math.cos(a) * 1.6); }
    part(g, new THREE.CylinderGeometry(1.95, 1.95, 0.06, 8), '#b07a48', 0, 0.27, 0); part(g, new THREE.CylinderGeometry(1.9, 1.9, 0.14, 8), '#c98c52', 0, 0.36, 0);
    part(g, new THREE.TorusGeometry(1.6, 0.045, 6, 8), '#fff1d6', 0, 0.85, 0, { rx: Math.PI / 2 });
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; part(g, roundedBox(0.14, 1.7, 0.14, 0.05), '#fff1d6', Math.sin(a) * 1.45, 1.28, Math.cos(a) * 1.45); }
    part(g, lathe([[0, 0], [2.15, 0], [2.2, 0.06], [1.9, 0.25], [1.2, 0.62], [0.5, 0.88], [0, 0.95]], 8), '#4fa3a8', 0, 2.13, 0);
    part(g, new THREE.TorusGeometry(2.05, 0.06, 6, 8), '#fff1d6', 0, 2.16, 0, { rx: Math.PI / 2 });
    part(g, new THREE.SphereGeometry(0.13, 12, 9), '#ffd54a', 0, 3.12, 0);
  } else if (id === 'mushroom') { // 42 F-2 a big toadstool to shelter under (cover): a cream stalk, a red cap with white dots, three little ones at its foot
    part(g, lathe([[0, 0], [0.72, 0], [0.66, 0.2], [0.55, 0.7], [0.5, 2.0], [0.5, 3.2], [0.56, 3.8], [0, 3.8]], 20), '#f3e6cf');
    const cap = [[0, 3.62], [2.25, 3.62], [2.5, 3.7]], Y = new THREE.Vector3(0, 1, 0), dot = new THREE.SphereGeometry(1, 12, 8);
    for (let j = 8; j >= 0; j--) { const th = j / 8 * Math.PI / 2; cap.push([2.6 * Math.sin(th), 3.75 + 1.6 * Math.cos(th)]); }
    part(g, lathe(cap, 32), '#e8735a'); part(g, new THREE.CylinderGeometry(2.28, 2.28, 0.05, 32), '#f5e6cf', 0, 3.61, 0);
    for (const [th, ph] of [[0.2, 1.0], [0.75, 0.4], [0.8, 1.55], [0.7, 2.7], [0.85, 3.8], [0.75, 5.0], [1.25, 1.0], [1.3, 2.2], [1.25, 3.3], [1.3, 4.4], [1.28, 5.6]]) {
      const s = Math.sin(th), m = part(g, dot, '#fff7ee', 2.6 * s * Math.cos(ph), 3.75 + 1.6 * Math.cos(th), 2.6 * s * Math.sin(ph));
      m.scale.set(0.3, 0.07, 0.3); m.quaternion.setFromUnitVectors(Y, new THREE.Vector3(s * Math.cos(ph) / 2.6, Math.cos(th) / 1.6, s * Math.sin(ph) / 2.6).normalize()); }
    for (const [x, z, k] of [[1.9, 1.5, 0.32], [2.35, 0.9, 0.22], [-2.0, 1.3, 0.26]]) {
      part(g, lathe([[0, 0], [0.3 * k, 0], [0.26 * k, 0.9 * k], [0, 0.9 * k]], 10), '#f3e6cf', x, 0, z);
      part(g, new THREE.SphereGeometry(0.75 * k, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), '#e8735a', x, 0.85 * k, z); }
  } else if (id === 'tunnel') { // 42 F-2 a grass hill with a round tunnel through it along z (play.js G.tunnel: the bevel makes its inside r 1.2 on walls 2.3 high), stone rims at its mouths, a dirt floor
    const T = PLAY.tunnel, hill = x => 4.6 * Math.max(0, 1 - (x / 3) ** 2) ** 0.6, sh = new THREE.Shape();
    const arc = (s, r, back) => { for (let i = 0; i <= 16; i++) { const a = (back ? 16 - i : i) / 16 * Math.PI; s.lineTo(r * Math.cos(a), T.wall + r * Math.sin(a)); } };
    const band = (r0, r1, d) => { const s = new THREE.Shape(); s.moveTo(r1, 0); arc(s, r1); s.lineTo(-r1, 0); s.lineTo(-r0, 0); arc(s, r0, true); s.lineTo(r0, 0);
      return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); };
    sh.moveTo(-3, 0); for (let i = 1; i <= 24; i++) sh.lineTo(-3 + i / 4, hill(-3 + i / 4));
    sh.lineTo(1.4, 0); arc(sh, 1.4); sh.lineTo(-1.4, 0);
    const hg = new THREE.ExtrudeGeometry(sh, { depth: T.len, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3 }).translate(0, 0, -T.len / 2), P = hg.attributes.position, N = hg.attributes.normal;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) * 3 / 3.2, y = P.getY(i); // the sides (not the ends, the floor or the hole): the hill's own slope
      if (Math.abs(N.getZ(i)) > 0.3 || y < 0.05 || Math.hypot(x, Math.max(0, y - T.wall)) < 1.75) continue;
      const u = Math.max(0.02, 1 - (x / 3) ** 2), n = new THREE.Vector3(4.6 * 0.6 * u ** -0.4 * 2 * x / 9, 1, 0).normalize(); N.setXYZ(i, n.x, n.y, n.z); }
    part(g, hg, '#86c24a');
    part(g, band(1.16, 1.26, T.len + 0.3), '#6b5a44');
    for (const s of [-1, 1]) part(g, band(1.15, 1.65, 0.35), '#c0b9ac', 0, 0, s * (T.len / 2 + 0.2), { mat: { roughness: 0.55 } });
    part(g, roundedBox(2.3, 0.04, T.len + 0.8, 0.02), '#c9a47a', 0, 0.02, 0);
    const bud = new THREE.SphereGeometry(0.16, 12, 8), top = x => hill(x * 3 / 3.2) + 0.2;
    for (const [x, z, c] of [[-0.9, -0.6, '#fff7ee'], [0.3, -1.7, '#ff9cc4'], [1.6, 1.5, '#fff7ee'], [-1.4, 1.2, '#ffd54a'], [0.4, 2.1, '#ff9cc4'], [2.0, 0.2, '#fff7ee']]) part(g, bud, c, x, top(x) + 0.02, z);
    play(g, 'tunnel', {});
  } else if (id === 'tower') { // 42 F-2 a lookout: a round cream tower, a stair winding once round it from the front (+z) up to a railed deck, a flag (play.js G.tower)
    const T = PLAY.tower, step = roundedBox(1.25, 0.16, 0.95, 0.05);
    part(g, new THREE.CylinderGeometry(T.drum, 1.7, T.top - 0.15, 28), '#fff1d6', 0, (T.top - 0.15) / 2, 0);
    part(g, new THREE.CylinderGeometry(1.63, 1.64, 0.25, 28), '#e8735a', 0, 3.2, 0);
    part(g, new THREE.CylinderGeometry(T.deck, T.deck, 0.15, 32), '#c98c52', 0, T.top - 0.075, 0);
    part(g, roundedBox(0.72, 1.15, 0.16, 0.05), '#8a5a34', 0, 0.575, 1.68);
    for (const a of [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9]) part(g, new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16), '#5a6a7a', Math.cos(a) * 1.66, 1.8, Math.sin(a) * 1.66, { rz: Math.PI / 2, ry: -a });
    for (let k = 0; k < 12; k++) if (k !== 3) { const a = k * Math.PI / 6; part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), '#fff1d6', Math.cos(a) * 1.75, T.top + 0.275, Math.sin(a) * 1.75); }
    part(g, new THREE.TorusGeometry(1.75, 0.06, 6, 40, Math.PI * 5 / 3).rotateX(Math.PI / 2).rotateY(-Math.PI * 2 / 3), '#5aa9e6', 0, T.top + 0.55, 0);
    for (let j = 0; j <= T.steps; j++) { const a = Math.PI / 2 + j / T.steps * Math.PI * 2, y = T.top * j / T.steps;
      part(g, step, '#c98c52', Math.cos(a) * 2.25, y - 0.08, Math.sin(a) * 2.25, { ry: -a }); // inner edge 1.63: against the drum
      if (j && j % 2 === 0 && j < T.steps) part(g, new THREE.CylinderGeometry(0.06, 0.06, y - 0.16, 6), '#8a5a34', Math.cos(a) * 2.75, (y - 0.16) / 2, Math.sin(a) * 2.75); }
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), '#8a5a34', 0, T.top + 0.75, -1.6);
    part(g, new THREE.ConeGeometry(0.22, 0.8, 4), '#e8735a', 0.4, T.top + 1.25, -1.6, { rz: -Math.PI / 2 }).scale.z = 0.2;
    part(g, new THREE.SphereGeometry(0.08, 10, 7), '#ffd54a', 0, T.top + 1.52, -1.6);
    play(g, 'tower', {});
  } else if (id === 'gym') { // 42 F-2 a big climbing frame: a ramp with cleats up to a railed deck under a blue roof, a long yellow slide down (play.js G.gym, along x)
    const Q = PLAY.gym, rail = '#5aa9e6';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, roundedBox(0.22, 4.3, 0.22, 0.06), '#e8735a', sx * 1.4, 2.15, sz * 1.4);
    part(g, roundedBox(2 * Q.half, 0.2, 2 * Q.half, 0.06), '#fff1d6', 0, Q.deck - 0.1, 0);
    part(g, new THREE.ConeGeometry(2.45, 1.3, 4), rail, 0, 4.95, 0, { ry: Math.PI / 4 }); part(g, new THREE.SphereGeometry(0.16, 12, 9), '#ffd54a', 0, 5.65, 0);
    for (const s of [-1, 1]) { part(g, roundedBox(3, 0.1, 0.1, 0.04), rail, 0, Q.deck + 0.6, s * 1.45);
      for (const x of [-1, -0.5, 0, 0.5, 1]) part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), rail, x, Q.deck + 0.3, s * 1.45); }
    const ramp = (x0, y0, x1, y1) => { const r = new THREE.Group(), L = Math.hypot(x1 - x0, y1 - y0); r.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); r.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.add(r); return [r, L]; };
    const [up, L1] = ramp(Q.foot, 0, -Q.half, Q.deck);
    part(up, roundedBox(L1 + 0.1, 0.12, 1.6, 0.04), '#c98c52', 0, -0.06, 0);
    for (let k = -2; k <= 2; k++) part(up, roundedBox(0.08, 0.06, 1.5, 0.02), '#a8703f', k * L1 / 5.5, 0.03, 0);
    for (const s of [-1, 1]) { part(up, roundedBox(L1, 0.08, 0.08, 0.03), rail, 0, 0.5, s * 0.82);
      for (const x of [-1, 1]) part(up, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), rail, x * L1 * 0.38, 0.25, s * 0.82); }
    const [dn, L2] = ramp(Q.half, Q.deck, Q.x1, Q.y1);
    part(dn, roundedBox(L2 + 0.08, 0.1, 1.5, 0.04), '#ffd54a', 0, -0.05, 0);
    for (const s of [-1, 1]) { part(dn, roundedBox(L2, 0.25, 0.06, 0.03), rail, 0, 0.08, s * 0.78);
      part(g, roundedBox(Q.lip - Q.x1 + 0.06, 0.25, 0.06, 0.03), rail, (Q.x1 + Q.lip) / 2, Q.y1 + 0.08, s * 0.78);
      part(g, new THREE.CylinderGeometry(0.06, 0.06, Q.y1 - 0.1, 6), '#e8735a', Q.x1, (Q.y1 - 0.1) / 2, s * 0.6); }
    part(g, roundedBox(Q.lip - Q.x1 + 0.06, 0.1, 1.5, 0.04), '#ffd54a', (Q.x1 + Q.lip) / 2, Q.y1 - 0.05, 0);
    play(g, 'gym', {});
  } else if (id === 'snowslide') { // 42 F-2 the snow's: a snow hill, snow steps up its back (-z), a blue ice chute with rails down its front (play.js G.snowslide)
    const Q = PLAY.snowslide, ice = '#a8d8f0', rail = '#5aa9e6';
    part(g, lathe([[0, 0], [2.6, 0], [2.5, 0.15], [2.1, 0.7], [1.6, 1.6], [1.1, 2.15], [0.9, Q.top], [0, Q.top]], 28), '#f2f6fa', 0, 0, 0, { mat: { roughness: 0.62 } }).scale.z = 1.1;
    for (let k = 0; k < Q.steps; k++) { const y = Q.top * (k + 1) / Q.steps; part(g, roundedBox(1.3, y, 0.5, 0.08), '#e3ecf5', 0, y / 2, Q.z0 + k * Q.dz, { mat: { roughness: 0.62 } }); }
    for (let i = 1; i < Q.chute.length; i++) { const [z0, y0] = Q.chute[i - 1], [z1, y1] = Q.chute[i], L = Math.hypot(z1 - z0, y1 - y0), c = new THREE.Group();
      c.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2); c.rotation.x = Math.atan2(y0 - y1, z1 - z0); g.add(c);
      part(c, roundedBox(1.5, 0.12, L + 0.06, 0.04), ice, 0, -0.06, 0, { mat: { roughness: 0.2 } });
      for (const s of [-1, 1]) part(c, roundedBox(0.08, 0.2, L + 0.06, 0.03), rail, s * 0.8, 0.06, 0); }
    play(g, 'snowslide', {});
  } else if (id === 'carousel') { // 42 F-2 a merry-go-round: four cushions on a turning floor round a yellow column under a striped canopy (play.js G.carousel; propTick turns 'top')
    const Q = PLAY.carousel, top = new THREE.Group(); top.userData.moves = true; g.add(top);
    part(g, new THREE.CylinderGeometry(Q.r + 0.15, Q.r + 0.25, 0.3, 32), '#c9a47a', 0, 0.15, 0);
    part(top, new THREE.CylinderGeometry(Q.r, Q.r, 0.22, 32), '#fff1d6', 0, 0.41, 0);
    part(top, new THREE.TorusGeometry(Q.r, 0.07, 6, 40), '#e8735a', 0, 0.41, 0, { rx: Math.PI / 2 });
    ['#e8735a', '#5aa9e6', '#ffd54a', '#7cbc40'].forEach((c, i) => part(top, new THREE.CylinderGeometry(0.55, 0.6, 0.12, 20), c, Math.cos(i * Math.PI / 2) * Q.seat, Q.y - 0.06, Math.sin(i * Math.PI / 2) * Q.seat));
    part(top, new THREE.CylinderGeometry(0.32, 0.38, Q.top - 0.52, 16), '#ffd54a', 0, (Q.top + 0.52) / 2, 0);
    for (let i = 0; i < 8; i++) { part(top, new THREE.ConeGeometry(2.5, 1.2, 3, 1, false, i * Math.PI / 4, Math.PI / 4), i % 2 ? '#fff1d6' : '#e8735a', 0, Q.top + 0.6, 0);
      part(top, new THREE.LatheGeometry([[2.38, Q.top - 0.3], [2.52, Q.top - 0.3], [2.53, Q.top + 0.02], [2.38, Q.top + 0.02], [2.38, Q.top - 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 6, i * Math.PI / 4, Math.PI / 4), i % 2 ? '#e8735a' : '#ffd54a');
      part(top, new THREE.SphereGeometry(0.1, 10, 7), '#ffd54a', Math.sin(i * Math.PI / 4) * 2.5, Q.top, Math.cos(i * Math.PI / 4) * 2.5); }
    part(top, new THREE.SphereGeometry(0.14, 12, 9), '#ffd54a', 0, Q.top + 1.32, 0);
    play(g, 'carousel', { top });
  } else if (id === 'balloon') { // 42 F-2 a tethered hot-air balloon: a wicker basket under a striped envelope, four ropes to pegs (play.js G.balloon; propTick lifts 'up', the ropes follow)
    const Q = PLAY.balloon, up = new THREE.Group(), ropes = [], wick = '#c98c52', rope = '#8a5a34', Y = new THREE.Vector3(0, 1, 0);
    up.userData.moves = true; g.add(up);
    const line = (p, a, b, r = 0.025) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), m = part(p, new THREE.CylinderGeometry(r, r, L, 5), rope, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      m.quaternion.setFromUnitVectors(Y, d.divideScalar(L)); return m; };
    part(g, new THREE.CylinderGeometry(2.0, 2.1, 0.1, 28), '#d9c39a', 0, 0.05, 0);
    part(up, roundedBox(2.3, 0.2, 2.3, 0.06), '#a8703f', 0, Q.floor - 0.1, 0);
    for (const s of [-1, 1]) { part(up, roundedBox(2.3, 0.85, 0.1, 0.04), wick, 0, 0.675, s * 1.1); part(up, roundedBox(0.1, 0.85, 2.3, 0.04), wick, s * 1.1, 0.675, 0);
      part(up, roundedBox(2.34, 0.12, 0.04, 0.02), '#e8735a', 0, 0.85, s * 1.16); part(up, roundedBox(0.04, 0.12, 2.34, 0.02), '#e8735a', s * 1.16, 0.85, 0); }
    part(up, new THREE.TorusGeometry(1.1 * Math.SQRT2, 0.08, 6, 4), '#8a5a34', 0, 1.12, 0, { rx: Math.PI / 2, rz: Math.PI / 4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) line(up, [sx * 1.05, 1.1, sz * 1.05], [sx * 0.4, 3.05, sz * 0.4]);
    part(up, new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12), '#5a6a7a', 0, 2.85, 0);
    const prof = new THREE.SplineCurve([[0.55, 3.0], [1.2, 3.4], [1.9, 4.1], [2.3, 4.9], [2.25, 5.6], [1.85, 6.3], [1.1, 6.85], [0, 7.05]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(24);
    for (let i = 0; i < 8; i++) part(up, new THREE.LatheGeometry(prof, 4, i * Math.PI / 4, Math.PI / 4), ['#e8735a', '#ffd54a', '#5aa9e6', '#fff1d6'][i % 4]);
    part(up, new THREE.TorusGeometry(0.55, 0.06, 6, 20), '#8a5a34', 0, 3.0, 0, { rx: Math.PI / 2 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { part(g, new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8), rope, sx * 1.6, 0.15, sz * 1.6);
      const t = new THREE.Group(); t.userData.moves = true; g.add(t); part(t, new THREE.CylinderGeometry(0.025, 0.025, 1, 5), rope);
      ropes.push({ g: t, p: [sx * 1.6, 0.3, sz * 1.6], c: [sx * 1.1, 1.0, sz * 1.1] }); }
    play(g, 'balloon', { up, ropes });
  } else if (id === 'waterwheel') { // 42 F-2 a mill: a cream house with a brown roof, a big wheel turning in a stone channel, water pouring onto it from a flume (shelter beside it)
    const hx = -0.75, wx = 1.15, wood = '#8a5a34', ph = new THREE.Shape(), wh = new THREE.Group();
    part(g, roundedBox(2.7, 0.12, 2.5, 0.04), '#c0b9ac', hx, 0.06, 0, { mat: { roughness: 0.55 } });
    [[-1.2, 0], [1.2, 0], [1.2, 2.0], [0, 2.8], [-1.2, 2.0]].forEach(([x, y], i) => i ? ph.lineTo(x, y) : ph.moveTo(x, y));
    part(g, new THREE.ExtrudeGeometry(ph, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }).translate(0, 0, -1.1), '#fff1d6', hx, 0.12, 0);
    for (const s of [-1, 1]) part(g, roundedBox(1.62, 0.14, 2.6, 0.05), '#8a5a3a', hx + s * 0.68, 2.64, 0, { rz: -s * 0.588 });
    part(g, roundedBox(0.6, 1.0, 0.08, 0.03), wood, hx - 0.3, 0.67, 1.2);
    part(g, roundedBox(0.6, 0.6, 0.06, 0.03), wood, hx + 0.55, 1.35, 1.2); part(g, roundedBox(0.44, 0.44, 0.06, 0.03), '#5a6a7a', hx + 0.55, 1.35, 1.215);
    part(g, roundedBox(1.5, 0.35, 3.8, 0.08), '#c0b9ac', wx, 0.175, 0, { mat: { roughness: 0.55 } });
    part(g, roundedBox(1.2, 0.04, 3.5, 0.02), '', wx, 0.355, 0, { m: flowMat(0) });
    wh.position.set(wx, 1.7, 0); wh.userData.moves = true; g.add(wh);
    for (const s of [-1, 1]) part(wh, new THREE.TorusGeometry(1.5, 0.07, 6, 32), wood, s * 0.22, 0, 0, { ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) part(wh, roundedBox(0.4, 3.0, 0.09, 0.03), '#a8703f', 0, 0, 0, { rx: i * Math.PI / 4 });
    for (let i = 0; i < 12; i++) { const b = i * Math.PI / 6; part(wh, roundedBox(0.5, 0.45, 0.06, 0.02), '#c98c52', 0, Math.cos(b) * 1.35, Math.sin(b) * 1.35, { rx: b }); }
    part(wh, new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12), '#7f7c79', 0, 0, 0, { rz: Math.PI / 2 });
    part(g, new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), '#7f7c79', 0.85, 1.7, 0, { rz: Math.PI / 2 });
    part(g, roundedBox(0.5, 0.06, 2.55, 0.02), '#a8703f', wx, 3.47, -1.025);
    for (const s of [-1, 1]) part(g, roundedBox(0.06, 0.18, 2.55, 0.02), '#a8703f', wx + s * 0.25, 3.56, -1.025);
    part(g, roundedBox(0.38, 0.03, 2.5, 0.01), '#8fd3f0', wx, 3.515, -1.025);
    part(g, roundedBox(0.14, 3.44, 0.14, 0.04), wood, wx, 1.72, -2.0);
    const f = part(g, fallGeo(), '', wx, 2.95, 0.25, { m: flowMat(1) }); f.scale.set(1.0, 0.35, 0.5); f.castShadow = false;
    g.userData.tick = t => { wh.rotation.x = t * 0.5; };
  } else if (id === 'snowman') { // 25-1 the snow's: two snowballs, bead eyes, a carrot nose, a red scarf with its end hanging
    const snow = { mat: { roughness: 0.62 } };
    part(g, new THREE.SphereGeometry(0.5, 20, 14), '#f6f9fc', 0, 0.44, 0, snow).scale.y = 0.92;
    part(g, new THREE.SphereGeometry(0.34, 20, 14), '#f6f9fc', 0, 1.1, 0, snow);
    for (const x of [-0.11, 0.11]) part(g, new THREE.SphereGeometry(0.04, 10, 8), '#1d1d22', x, 1.18, 0.3);
    part(g, new THREE.ConeGeometry(0.055, 0.26, 10), '#f08a2c', 0, 1.1, 0.44, { rx: Math.PI / 2 });
    part(g, new THREE.TorusGeometry(0.27, 0.07, 8, 20), '#d9473f', 0, 0.84, 0, { rx: Math.PI / 2 });
    part(g, roundedBox(0.13, 0.32, 0.06, 0.03), '#d9473f', 0.16, 0.7, 0.24, { rz: 0.15, ry: -0.5 });
    big(g);
  } else if (id === 'igloo') { // 25-1: a snow-block dome with two low ridges round it and a short arched tunnel to the front
    const snow = { mat: { roughness: 0.62 } };
    part(g, new THREE.SphereGeometry(1.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#f2f6fa', 0, 0, -0.15, snow);
    for (const [r, y] of [[1.17, 0.32], [1.01, 0.68]]) part(g, new THREE.TorusGeometry(r, 0.035, 6, 32), '#dfe8f1', 0, y, -0.15, { rx: Math.PI / 2 });
    const arch = new THREE.CylinderGeometry(0.5, 0.5, 0.75, 18, 1, false, -Math.PI / 2, Math.PI);
    part(g, arch, '#f2f6fa', 0, 0, 0.98, { rx: Math.PI / 2, ...snow }).scale.set(1, 1, 1.05);
    part(g, new THREE.CircleGeometry(0.36, 18, 0, Math.PI), '#3a4a5c', 0, 0, 1.36);
    big(g);
  } else if (id === 'sled') { // 25-1: a red wooden sled, three slats on two runners that curl up at the front, a pull rope
    const runner = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.72, 0.06], [0.45, 0.06], [0.68, 0.14], [0.74, 0.32], [0.6, 0.4]].map(([x, y]) => new THREE.Vector3(x, y, 0))), 24, 0.04, 6);
    for (const z of [-0.28, 0.28]) part(g, runner, '#6a6f78', 0, 0, z);
    for (const x of [-0.45, 0, 0.45]) part(g, roundedBox(0.08, 0.2, 0.08, 0.03), '#8a5a34', x, 0.15, -0.28), part(g, roundedBox(0.08, 0.2, 0.08, 0.03), '#8a5a34', x, 0.15, 0.28);
    for (const z of [-0.2, 0, 0.2]) part(g, roundedBox(1.3, 0.06, 0.16, 0.03), '#d0473a', -0.05, 0.28, z);
    part(g, new THREE.TorusGeometry(0.22, 0.02, 5, 14, Math.PI), '#e8d6a8', 0.78, 0.3, 0, { rz: -Math.PI / 2, ry: Math.PI / 2 });
  // 28-2 놀이 소품 (play.js: their numbers and how they move while used)
  } else if (id === 'slide') { // a deck on four posts, a ladder up its back, a yellow chute down its front that flattens out at the end
    const S = PLAY.slide, post = roundedBox(0.14, S.top, 0.14, 0.05), sl = Math.atan2(S.top - S.y1, S.z1 - S.z0), len = Math.hypot(S.top - S.y1, S.z1 - S.z0);
    for (const x of [-0.8, 0.8]) for (const z of [S.deck - 0.4, S.deck + 0.4]) part(g, post, '#e8735a', x, S.top / 2, z);
    part(g, roundedBox(1.9, 0.14, 1.0, 0.05), '#fff1d6', 0, S.top - 0.07, S.deck);
    for (const x of [-0.9, 0.9]) part(g, roundedBox(0.09, 0.32, 0.95, 0.04), '#5aa9e6', x, S.top + 0.16, S.deck);
    const z0 = S.back - 0.13, z1 = S.deck - 0.5, lk = Math.atan2(z1 - z0, S.top);
    for (const x of [-0.42, 0.42]) part(g, roundedBox(0.1, Math.hypot(z1 - z0, S.top) + 0.12, 0.1, 0.04), '#5aa9e6', x, S.top / 2, (z0 + z1) / 2, { rx: lk });
    for (let i = 1; i < 5; i++) part(g, roundedBox(0.84, 0.07, 0.1, 0.03), '#fff1d6', 0, i * S.top / 5, z0 + (z1 - z0) * i / 5);
    const ch = new THREE.Group(); ch.position.set(0, (S.top + S.y1) / 2, (S.z0 + S.z1) / 2); ch.rotation.x = sl; g.add(ch); // the chute, its top on the line play.js slides down
    part(ch, roundedBox(1.5, 0.1, len + 0.08, 0.04), '#ffd54a', 0, -0.05, 0);
    for (const x of [-0.78, 0.78]) part(ch, roundedBox(0.09, 0.24, len + 0.08, 0.04), '#5aa9e6', x, 0.04, 0);
    part(g, roundedBox(1.5, 0.1, S.lip - S.z1 + 0.05, 0.04), '#ffd54a', 0, S.y1 - 0.05, (S.z1 + S.lip) / 2);
    for (const x of [-0.78, 0.78]) part(g, roundedBox(0.09, 0.24, S.lip - S.z1 + 0.05, 0.04), '#5aa9e6', x, S.y1 + 0.04, (S.z1 + S.lip) / 2);
    for (const x of [-0.6, 0.6]) part(g, roundedBox(0.12, S.y1, 0.12, 0.04), '#e8735a', x, S.y1 / 2, S.z1);
    play(g, 'slide', {});
  } else if (id === 'seesaw') { // a green plank on a hub between two blue uprights, a red pad at each end; it tips to whoever sits on it
    const S = PLAY.seesaw;
    part(g, roundedBox(0.7, 0.12, 1.0, 0.05), '#c88a4b', 0, 0.06, 0);
    for (const z of [-0.42, 0.42]) part(g, roundedBox(0.18, S.pivot + 0.1, 0.12, 0.05), '#3d8fe0', 0, (S.pivot + 0.1) / 2, z);
    part(g, new THREE.CylinderGeometry(0.07, 0.07, 1.02, 10), '#f2e6d0', 0, S.pivot, 0, { rx: Math.PI / 2 });
    const plank = new THREE.Group(); plank.position.y = S.pivot; plank.userData.moves = true; g.add(plank); // inbox 35: longer, thicker, a yellow that stands out on the grass
    part(plank, roundedBox(2 * S.arm + 0.6, 0.18, 0.64, 0.07), '#ffc22e', 0, 0, 0);
    for (const x of [-S.arm, S.arm]) part(plank, roundedBox(0.82, 0.1, 0.74, 0.045), '#e8463c', x, S.seat - 0.05, 0);
    play(g, 'seesaw', { plank });
  } else if (id === 'campfire') { // a ring of round stones, three logs leaning together, a flame that flickers (and glows by night)
    const st = new THREE.SphereGeometry(1, 12, 9);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(g, st, i % 2 ? '#a8a39a' : '#c0b9ac', Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, { ry: -a, mat: { roughness: 0.55 } }).scale.set(0.18, 0.15, 0.22); }
    for (let i = 0; i < 3; i++) { const lg = new THREE.Group(); lg.rotation.y = i * 2.1 + 0.4; g.add(lg); part(lg, new THREE.CapsuleGeometry(0.075, 0.5, 3, 8), '#8a5a34', 0.19, 0.28, 0, { rz: 0.58 }); }
    // inbox 35: three layers of flame tongues over the logs, each layer its own flicker: three yellow ones low and leaning out,
    // three orange ones between and above them, a red tip in the middle on top; they glow a little by day too. By night a
    // bigger halo, a warm pool of light on the ground round it and sparks rising
    const flames = [['#ffc21a', 3, 0.11, 0.32, 0.19, 0.64, 0], ['#ff7a1a', 3, 0.06, 0.17, 0.16, 0.98, Math.PI / 3], ['#f0402a', 1, 0, 0, 0.15, 1.32, 0]].map(([c, n, d, lean, R, H, a0]) => {
      const f = new THREE.Group(); f.position.y = 0.16; f.userData.moves = true; g.add(f);
      for (let k = 0; k < n; k++) { const a = a0 + k / n * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * d, 0, -Math.sin(a) * d); t.rotation.set(0, a, -lean); f.add(t);
        part(t, lathe([[0, 0], [0.75 * R, 0.08 * H], [R, 0.28 * H], [0.85 * R, 0.55 * H], [0.45 * R, 0.8 * H], [0, H]], 12), '', 0, 0, 0, { m: fireMat(c) }); }
      return f; });
    halo(g, '#ffb35a', 4.4, 0, 0.75, 0);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.8, 32), decorMats.firePool ??= Object.assign(new THREE.MeshBasicMaterial({ map: haloTex, color: '#ff8030', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      { onBeforeCompile: sh => { NIGHT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= 0.8 * uNight;\n#include <opaque_fragment>'); } }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.renderOrder = 3; g.add(pool);
    const n = 14, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const sparks = new THREE.Points(sg, decorMats.spark ??= Object.assign(new THREE.PointsMaterial({ size: 0.32, map: haloTex, color: '#ffb048', vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      { onBeforeCompile: sh => { NIGHT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= uNight;\n#include <opaque_fragment>'); } }));
    sparks.frustumCulled = false; sparks.renderOrder = 3; g.add(sparks);
    play(g, 'campfire', { flames, sparks });
  } else if (id === 'feeder') { // a round wooden tub of grain on the ground, two dark bands round it
    part(g, lathe([[0, 0], [0.62, 0], [0.7, 0.05], [0.74, 0.4], [0.7, 0.46], [0.62, 0.44], [0.6, 0.12], [0, 0.12]], 22), '#b07a48', 0, 0, 0);
    for (const y of [0.12, 0.33]) part(g, new THREE.TorusGeometry(0.73, 0.03, 6, 26), '#8a5a34', 0, y, 0, { rx: Math.PI / 2 });
    part(g, new THREE.SphereGeometry(0.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f0d27a', 0, 0.3, 0).scale.y = 0.3;
    for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.12 + (i % 3) * 0.14; part(g, new THREE.SphereGeometry(0.05, 8, 6), i % 2 ? '#e8a33a' : '#9bcf6a', Math.cos(a) * r, 0.47 - r * r * 0.4, Math.sin(a) * r); }
    play(g, 'feeder', {});
  } else if (id === 'fountain') { // a round basin of rippling water, a column and a bowl in its middle that drops fall from
    const F = PLAY.fountain;
    part(g, lathe([[F.rim - 0.2, 0], [F.rim + 0.05, 0], [F.rim + 0.09, 0.38], [F.rim + 0.03, 0.48], [F.rim - 0.13, 0.48], [F.rim - 0.19, 0.42], [F.rim - 0.2, 0]], 32), '#f2e6d0', 0, 0, 0);
    part(g, new THREE.CylinderGeometry(F.rim - 0.19, F.rim - 0.19, 0.02, 32), '', 0, F.water, 0, { m: flowMat(0) }); // ripples from its middle (one part: bake leaves it)
    const c = new THREE.Group(); c.scale.setScalar(F.top / 1.8); g.add(c); // inbox 35: the basin 1.5 times as wide, the column and bowl a quarter bigger
    part(c, lathe([[0, 0], [0.32, 0], [0.27, 0.22], [0.17, 0.34], [0.15, 1.5], [0.2, 1.58], [0, 1.58]], 16), '#f2e6d0', 0, 0, 0);
    part(c, lathe([[0, 0], [0.2, 0], [0.52, 0.1], [0.62, 0.2], [0.58, 0.25], [0, 0.18]], 20), '#f2e6d0', 0, 1.55, 0);
    part(c, new THREE.CylinderGeometry(0.54, 0.54, 0.02, 20), '#8fd3f0', 0, 1.77, 0, { mat: { roughness: 0.15 } });
    part(c, lathe([[0, 0], [0.09, 0], [0.06, 0.18], [0.1, 0.24], [0, 0.3]], 10), '#f2e6d0', 0, 1.74, 0);
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), decorMats.drop ??= toyMat('#d6f1fb', { roughness: 0.1 }), 18); drops.frustumCulled = false; g.add(drops);
    play(g, 'fountain', { drops });
  } else if (id === 'hammock') { // a blue cloth slung between two posts by its ropes, its long edges curled up; it sways, more with someone in it
    const H = PLAY.hammock;
    for (const s of [-1, 1]) { part(g, roundedBox(0.2, H.pivot + 0.35, 0.2, 0.07), '#b07a48', s * H.half, (H.pivot + 0.35) / 2, 0); part(g, new THREE.SphereGeometry(0.14, 12, 9), '#ffd54a', s * H.half, H.pivot + 0.4, 0); part(g, roundedBox(0.5, 0.08, 0.5, 0.04), '#8a5a34', s * H.half, 0.04, 0); }
    const sling = new THREE.Group(); sling.position.y = H.pivot; sling.userData.moves = true; g.add(sling);
    part(sling, slingGeo(H.cloth, H.hz, H.sag), '#5aa9e6', 0, 0, 0, { mat: { side: THREE.DoubleSide } });
    for (const s of [-1, 1]) { part(sling, roundedBox(0.09, 0.09, 1.2, 0.04), '#c88a4b', s * H.cloth, 0, 0); part(sling, new THREE.CylinderGeometry(0.03, 0.03, H.half - H.cloth, 6), '#f1e4c8', s * (H.half + H.cloth) / 2, 0, 0, { rz: Math.PI / 2 }); }
    play(g, 'hammock', { sling });
  } else if (id === 'ball') { // a big ball in four colours; animals dribble it round and it rolls back (open: one small post where it lies)
    const ball = new THREE.Group(), spin = new THREE.Group(); ball.position.y = PLAY.ball.r; ball.userData.moves = spin.userData.moves = true; ball.add(spin); g.add(ball);
    ['#ff6b6b', '#ffd54a', '#5aa9e6', '#fff7ee'].forEach((c, i) => part(spin, new THREE.SphereGeometry(PLAY.ball.r, 16, 12, i * Math.PI / 2, Math.PI / 2), c));
    g.userData.posts = [[0, 0]];
    play(g, 'ball', { ball, spin });
  // 28-3 누르면 반응하는 소품: each has userData.tap (habitat.js calls it when the prop is tapped: what the prop itself does;
  // the sound, the tune and the animals are habitat.js's) and userData.tick (its motion, from the clock habitat.js passes)
  } else if (id === 'musicbox') { // 오르골: a pink box on four round feet, its lid open (a pale blue panel inside), a turning plate with a star on
    // it and a wind-up key at its side. While a tune plays (sound.js) the plate and the key turn and notes rise (not with 움직임 줄이기)
    for (const x of [-0.36, 0.36]) for (const z of [-0.24, 0.24]) part(g, new THREE.SphereGeometry(0.08, 10, 8), '#ffd54a', x, 0.08, z);
    part(g, roundedBox(0.95, 0.46, 0.7, 0.08), '#f6a6b8', 0, 0.36, 0);
    part(g, roundedBox(0.98, 0.07, 0.73, 0.03), '#fff1d6', 0, 0.36, 0);
    const lid = new THREE.Group(); lid.position.set(0, 0.59, -0.35); lid.rotation.x = -1.85; g.add(lid);
    part(lid, roundedBox(0.95, 0.09, 0.7, 0.04), '#f6a6b8', 0, 0.045, 0.35); part(lid, roundedBox(0.72, 0.02, 0.5, 0.01), '#bfe3f2', 0, -0.005, 0.37);
    const spin = new THREE.Group(); spin.position.set(0, 0.59, 0.06); spin.userData.moves = true; g.add(spin);
    part(spin, new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), '#fff1d6', 0, 0.02, 0);
    part(spin, new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8), '#f0c24a', 0, 0.14, 0);
    part(spin, starGeo(0.15, 0.065, 0.04, 0.025), '#ffd54a', 0, 0.34, 0);
    const key = new THREE.Group(); key.position.set(0.5, 0.36, 0); key.userData.moves = true; g.add(key);
    part(key, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), '#f0c24a', 0.05, 0, 0, { rz: Math.PI / 2 });
    for (const s of [-1, 1]) part(key, new THREE.SphereGeometry(0.09, 10, 8), '#f0c24a', 0.13, s * 0.09, 0).scale.set(0.3, 1, 0.8);
    const notes = [0, 1, 2].map(() => { const n = new THREE.Sprite(decorMats.note ??= new THREE.SpriteMaterial({ map: noteTex(), color: '#8a6ad8', transparent: true, depthWrite: false })); n.visible = false; g.add(n); return n; });
    let T = 0, on = 0;
    g.userData.tick = t => { const dt = Math.min(0.1, Math.max(0, t - T)); T = t; on += ((playing() ? 1 : 0) - on) * Math.min(1, dt * 3);
      spin.rotation.y += dt * 1.6 * on; key.rotation.x -= dt * 1.4 * on;
      notes.forEach((n, i) => { const k = (t * 0.4 + i / 3) % 1; n.visible = on > 0.05 && !calm(); n.position.set((i - 1) * 0.22 + Math.sin(k * 5 + i * 2) * 0.12, 0.85 + k * 1.2, 0.1); n.scale.setScalar(0.3 * on * Math.sin(k * Math.PI)); }); };
    g.userData.tap = () => true;
  } else if (id === 'bubbles') { // 비눗방울 기계: a sky-blue box on four feet, a yellow ring at its front with the fan behind it, a pink soap
    // bottle and a red button on top. A tap: bubbles blow out of the ring for two seconds, float up and drift, and pop
    for (const x of [-0.26, 0.26]) for (const z of [-0.18, 0.18]) part(g, roundedBox(0.12, 0.12, 0.12, 0.04), '#3d6fa8', x, 0.06, z);
    part(g, roundedBox(0.72, 0.5, 0.56, 0.1), '#5aa9e6', 0, 0.37, 0);
    part(g, new THREE.TorusGeometry(0.17, 0.045, 10, 24), '#ffd54a', 0, 0.38, 0.29);
    part(g, new THREE.CircleGeometry(0.16, 20), '#2f5f94', 0, 0.38, 0.285);
    for (let i = 0; i < 3; i++) part(g, roundedBox(0.04, 0.27, 0.01, 0.01), '#9fd0f5', 0, 0.38, 0.29, { rz: i * Math.PI / 3 });
    part(g, lathe([[0, 0], [0.1, 0], [0.11, 0.16], [0.07, 0.22], [0.05, 0.27], [0, 0.27]], 12), '#ff9cc4', -0.17, 0.62, -0.08);
    part(g, new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10), '#fff7ee', -0.17, 0.91, -0.08);
    part(g, new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e8463c', 0.18, 0.62, 0.06);
    const N = 24, B = [], bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), bubbleMat(), N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    bub.frustumCulled = false; bub.visible = false; bub.renderOrder = 3; g.add(bub);
    let T = 0;
    g.userData.tick = t => { T = t; if (!bub.visible) return;
      for (let i = 0; i < N; i++) { const b = B[i], a = b ? t - b.t0 : -1, k = b ? Math.min(1, a / 0.25, (b.life - a) / 0.12) : 0;
        if (b && a > b.life) B[i] = null;
        if (a < 0 || k <= 0) m.makeScale(0, 0, 0);
        else m.compose(v.set(b.dx * (1 - Math.exp(-a * 1.1)) + 0.1 * Math.sin(a * 2 + b.p), 0.38 + 0.3 * a + 0.08 * Math.sin(a * 2.8 + b.p), 0.35 + b.dz * (1 - Math.exp(-a * 1.1))), q, s.setScalar(b.r * k));
        bub.setMatrixAt(i, m); }
      bub.instanceMatrix.needsUpdate = true; if (B.every(b => !b)) bub.visible = false; };
    g.userData.tap = () => { for (let n = 0, i = 0; i < N && n < 14; i++) if (!B[i]) { B[i] = { t0: T + n * 0.14, life: 3.5 + Math.random() * 2.5, r: 0.09 + Math.random() * 0.1, dx: (Math.random() - 0.5) * 1.6, dz: 0.9 + Math.random() * 1.2, p: Math.random() * 6 }; n++; }
      bub.visible = true; return true; };
  } else if (id === 'lights') { // 꼬마전구 줄: two wooden posts, a green wire slung between them with eleven bulbs in five colours. A tap turns
    // them off (pale glass) or on (a little glow by day, bright by night with a soft halo each). Walked under (open: the two posts)
    const X = 2.2, P = 2.9, H = 2.72, sag = 0.45, wy = x => H - sag * (1 - (x / X) ** 2);
    for (const s of [-1, 1]) { part(g, roundedBox(0.44, 0.08, 0.44, 0.04), '#8a5a34', s * X, 0.04, 0); part(g, roundedBox(0.16, P, 0.16, 0.05), '#b07a48', s * X, P / 2, 0); part(g, new THREE.SphereGeometry(0.12, 12, 9), '#ffd54a', s * X, P + 0.02, 0); }
    part(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => { const x = -X + 2 * X * i / 16; return new THREE.Vector3(x, wy(x), 0); })), 40, 0.022, 5), '#5d7a4a', 0, 0, 0);
    const on = new THREE.Group(), off = new THREE.Group(), bulb = lathe([[0, 0], [0.06, 0.02], [0.085, 0.09], [0.07, 0.16], [0.045, 0.2], [0, 0.2]], 10), cols = ['#ffd54a', '#ff7a8a', '#7fd8a8', '#7fc4ff', '#ffa94d'];
    on.userData.moves = off.userData.moves = true; off.visible = false; g.add(on, off);
    const glow = [], gc = [];
    for (let i = 0; i < 11; i++) { const x = -1.85 + 3.7 * i / 10, y = wy(x) - 0.03, c = cols[i % 5];
      part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.07, 8), '#3d4a36', x, y, 0);
      part(on, bulb, '', x, y - 0.235, 0, { m: fireMat(c) }); part(off, bulb, '#f4efe2', x, y - 0.235, 0, { mat: { roughness: 0.3 } });
      glow.push(x, y - 0.14, 0); gc.push(...new THREE.Color(c).toArray()); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(glow, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    const pts = new THREE.Points(gg, decorMats.bulbGlow ??= Object.assign(new THREE.PointsMaterial({ size: 1.1, map: haloT(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      { onBeforeCompile: sh => { NIGHT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= 0.7 * uNight;\n#include <opaque_fragment>'); } }));
    pts.renderOrder = 3; on.add(pts);
    g.userData.posts = [[-X, 0], [X, 0]];
    g.userData.tap = () => { on.visible = !on.visible; off.visible = !on.visible; return true; };
  } else if (id === 'fireworks') { // 작은 폭죽: a wooden crate with three striped paper tubes. By night a tap sends up three small shells one after
    // another that burst into soft sparks and fade (no flash, no light cast). 움직임 줄이기: no rocket and no spreading, the sparks
    // show round where they would burst and fade gently. By day it does nothing (false: habitat.js says so)
    part(g, roundedBox(0.8, 0.3, 0.6, 0.06), '#c98c52', 0, 0.15, 0);
    part(g, roundedBox(0.82, 0.05, 0.62, 0.02), '#8a5a34', 0, 0.22, 0);
    const tubes = [[-0.22, 0.05, '#e8463c', 0.12], [0.02, -0.08, '#3d8fe0', 0], [0.24, 0.07, '#ffc22e', -0.12]];
    for (const [x, z, c, rz] of tubes) { const tb = new THREE.Group(); tb.position.set(x, 0.3, z); tb.rotation.z = rz; g.add(tb);
      part(tb, new THREE.CylinderGeometry(0.09, 0.09, 0.5, 14), c, 0, 0.25, 0);
      for (const y of [0.12, 0.34]) part(tb, new THREE.CylinderGeometry(0.093, 0.093, 0.06, 14), '#fff7ee', 0, y, 0);
      part(tb, new THREE.CircleGeometry(0.07, 12), '#3a2a20', 0, 0.501, 0, { rx: -Math.PI / 2 }); }
    const SH = 3, SP = 32, pos = new Float32Array(SH * (SP + 1) * 3), col = new Float32Array(pos.length), fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(fg, decorMats.spark2 ??= new THREE.PointsMaterial({ size: 0.6, map: haloT(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 3; g.add(pts);
    const dirs = Array.from({ length: SP }, (_, i) => { const y = 1 - 2 * (i + 0.5) / SP, r = Math.sqrt(1 - y * y), a = i * 2.39996; return [Math.cos(a) * r, y, Math.sin(a) * r]; }); // evenly round a sphere
    const cols = ['#ff8a9a', '#ffd86a', '#8fdcff', '#c3a8ff', '#9fe8a8'].map(c => new THREE.Color(c).multiplyScalar(0.85)), shells = [];
    const put = (j, x, y, z, k, c) => { pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; col[j * 3] = c.r * k; col[j * 3 + 1] = c.g * k; col[j * 3 + 2] = c.b * k; };
    let T = 0;
    g.userData.tick = t => { T = t; if (!pts.visible) return; let any = false;
      for (let s = 0; s < SH; s++) { const sh = shells[s], o = s * (SP + 1), a = sh ? t - sh.t0 : -1, rise = sh?.calm ? 0 : 0.9, b = a - rise, end = sh?.calm ? 1.9 : 1.6, [tx, tz] = tubes[s];
        if (!sh || a < 0 || b > end) { for (let j = 0; j <= SP; j++) put(o + j, 0, 0.5, 0, 0, cols[0]); if (sh && b > end) shells[s] = null; if (sh && a < 0) any = true; continue; }
        any = true; const X = tx + sh.dx, Z = tz + sh.dz;
        if (b < 0) { const e = 1 - (1 - a / rise) ** 2; put(o, tx + sh.dx * e, 0.8 + (sh.h - 0.8) * e, tz + sh.dz * e, 0.8, cols[1]); for (let j = 1; j <= SP; j++) put(o + j, X, sh.h, Z, 0, sh.c); continue; }
        put(o, X, sh.h, Z, 0, sh.c);
        const R = sh.calm ? 1.1 : 1.5 * (1 - Math.exp(-b * 3.5)), fall = sh.calm ? 0 : 0.35 * b * b, k = (sh.calm ? Math.min(1, b / 0.25) : 1) * (1 - b / end) ** 1.5;
        for (let j = 1; j <= SP; j++) { const d = dirs[j - 1]; put(o + j, X + d[0] * R, sh.h + d[1] * R - fall, Z + d[2] * R, k * (sh.calm ? 1 : 0.75 + 0.25 * Math.sin(t * 20 + j)), sh.c); } }
      fg.attributes.position.needsUpdate = fg.attributes.color.needsUpdate = true; if (!any) pts.visible = false; };
    g.userData.tap = () => { if (nightGlow.value < 0.35) return false;
      const c = calm(); for (let s = 0; s < SH; s++) shells[s] = { t0: T + s * 0.4, h: 4.6 + s * 0.7 + Math.random() * 0.5, dx: (Math.random() - 0.5) * 1.2, dz: (Math.random() - 0.5) * 1.2, c: cols[(Math.random() * cols.length) | 0], calm: c };
      pts.visible = true; return true; };
  } else if (id === 'pinhill') { // 바람개비 언덕: a low round grassy hill with a few flowers and five pinwheels on sticks of different heights.
    // They turn slowly in the breeze; a tap spins them hard for a few seconds (the five rotors: one InstancedMesh)
    const prof = [[0, 0.68], [0.3, 0.66], [0.75, 0.57], [1.15, 0.37], [1.42, 0.12], [1.48, 0]];
    const hAt = r => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i]; return h0 + (h1 - h0) * (r - r0) / (r1 - r0); } return 0; };
    part(g, lathe([[0, 0], ...prof.slice().reverse()], 28), '#8cc65a', 0, 0, 0, { mat: { roughness: 0.8 } });
    [[0.45, -0.1, '#ff9cc4'], [-0.35, 0.8, '#ffd54a'], [0.95, 0.6, '#fff7ee'], [-0.95, -0.35, '#ff9cc4'], [0.1, 1.05, '#fff7ee']].forEach(([x, z, c]) => part(g, new THREE.SphereGeometry(0.08, 10, 8), c, x, hAt(Math.hypot(x, z)) + 0.03, z));
    const at = [[-0.7, 0.2, 1.0, 0.35], [0.62, -0.45, 1.3, -0.3], [0.15, 0.6, 0.85, 0.1], [-0.2, -0.62, 1.45, 0.5], [0.9, 0.38, 0.95, -0.45]];
    for (const [x, z, h] of at) part(g, new THREE.CylinderGeometry(0.03, 0.035, h, 8), '#f1e4c8', x, hAt(Math.hypot(x, z)) + h / 2 - 0.05, z);
    const rot = new THREE.InstancedMesh(rotorGeo(), decorMats.rotor ??= toyMat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), at.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1.3, 1.3, 1.3);
    rot.castShadow = true; g.add(rot);
    const ang = at.map((_, i) => i * 1.3); let T = 0, kick = -99;
    g.userData.tick = t => { const dt = Math.min(0.1, Math.max(0, t - T)); T = t; const sp = 1.2 + 9 * Math.exp(-Math.max(0, t - kick) / 1.6);
      at.forEach(([x, z, h, ry], i) => { ang[i] += dt * sp * (1 + i * 0.07); m.compose(v.set(x + Math.sin(ry) * 0.06, hAt(Math.hypot(x, z)) + h - 0.05, z + Math.cos(ry) * 0.06), q.setFromEuler(e.set(0, ry, -ang[i])), one); rot.setMatrixAt(i, m); });
      rot.instanceMatrix.needsUpdate = true; };
    g.userData.tap = () => { kick = T; return true; };
  } else if (id === 'bell') { // 부르는 종: a little wooden frame under a red gable roof, a golden bell hanging from its bar. A tap swings it
    // (and habitat.js calls the animals near to come round it)
    for (const z of [-0.45, 0.45]) { part(g, roundedBox(0.34, 0.08, 0.34, 0.04), '#8a5a34', 0, 0.04, z); part(g, roundedBox(0.14, 1.9, 0.14, 0.05), '#b07a48', 0, 0.95, z); }
    part(g, new THREE.CapsuleGeometry(0.07, 0.9, 4, 10), '#c88a4b', 0, 1.82, 0, { rx: Math.PI / 2 });
    for (const s of [-1, 1]) part(g, roundedBox(0.52, 0.07, 1.25, 0.03), '#e8463c', s * 0.22, 2.03, 0, { rz: -s * 0.62 });
    const sw = new THREE.Group(); sw.position.set(0, 1.78, 0); sw.userData.moves = true; g.add(sw);
    part(sw, new THREE.TorusGeometry(0.05, 0.018, 6, 12), '#c99a2e', 0, -0.03, 0);
    part(sw, lathe([[0, -0.5], [0.24, -0.5], [0.27, -0.49], [0.25, -0.44], [0.18, -0.32], [0.15, -0.16], [0.09, -0.08], [0, -0.06]], 20), '#f0c24a', 0, 0, 0, { mat: { roughness: 0.3 } });
    part(sw, new THREE.SphereGeometry(0.06, 10, 8), '#8a5a34', 0, -0.52, 0);
    let T = 0, hit = -99;
    g.userData.tick = t => { T = t; const a = t - hit; sw.rotation.z = a < 3 ? 0.55 * Math.exp(-a / 0.9) * Math.sin(a * 7) : 0; };
    g.userData.tap = () => { hit = T; return true; };
  } else if (PIECES[id]) { // 28-4 장난감 기차: a rail piece on its 4x4 tile (its tracks: train.js PIECES, along local x), sleepers under two
    // round rails 1.1 apart, their tops at CARS.rail (0.14); the bridge's deck arches up ARCH in its middle. habitat.js lays it on the ground
    const sleeper = roundedBox(0.34, 0.07, 1.5, 0.03), yd = x => ARCH * Math.sin(Math.PI * (x + 4) / 8) ** 2;
    const tracks = { rail: [[u => [-2 + 4 * u, 0, 0], () => [0, 1], 4]], railbridge: [[u => [-4 + 8 * u, yd(-4 + 8 * u), 0], () => [0, 1], 8]] };
    const curve = [u => { const a = (u - 1) * Math.PI / 2; return [-2 + 2 * Math.cos(a), 0, 2 + 2 * Math.sin(a)]; }, u => { const a = (u - 1) * Math.PI / 2; return [Math.cos(a), Math.sin(a)]; }, Math.PI];
    tracks.railcurve = [curve]; tracks.railfork = [tracks.rail[0], curve];
    for (const [c, n, L] of tracks[id]) {
      for (let d = 0.4; d < L; d += 0.8) { const u = d / L, [x, y, z] = c(u), [nx, nz] = n(u), [x2, y2] = c(Math.min(1, u + 0.01)), [x1, y1] = c(u - 0.01);
        part(g, sleeper, '#b07a48', x, y + 0.035, z, { ry: Math.atan2(nx, nz), rz: id === 'railbridge' ? Math.atan2(y2 - y1, x2 - x1) : 0 }); }
      for (const k of [-0.55, 0.55]) { const m = Math.ceil(L * 2), pts = Array.from({ length: m + 1 }, (_, i) => { const [x, y, z] = c(i / m), [nx, nz] = n(i / m); return new THREE.Vector3(x + k * nx, y + 0.075, z + k * nz); });
        part(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), m * 2, 0.065, 6), '#9aa3ad', 0, 0, 0, { mat: { roughness: 0.35 } }); }
    }
    if (id === 'railfork') { // the switch: a little lever beside it
      part(g, roundedBox(0.3, 0.12, 0.3, 0.04), '#8a5a34', -1, 0.06, -1.15); part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), '#9aa3ad', -0.92, 0.3, -1.15, { rz: -0.4 });
      part(g, new THREE.SphereGeometry(0.09, 12, 9), '#e8463c', -0.84, 0.5, -1.15);
    }
    if (id === 'railbridge') { // a wooden deck under the sleepers, a red wall each side cut into a low arch underneath
      const prof = (top, bot) => { const sh = new THREE.Shape(), n = 24; for (let i = 0; i <= n; i++) sh[i ? 'lineTo' : 'moveTo'](-4 + 8 * i / n, top(-4 + 8 * i / n)); for (let i = n; i >= 0; i--) sh.lineTo(-4 + 8 * i / n, bot(-4 + 8 * i / n)); return sh; };
      part(g, new THREE.ExtrudeGeometry(prof(yd, x => yd(x) - 0.12), { depth: 1.7, bevelEnabled: false }), '#c88a4b', 0, 0, -0.85);
      const wall = new THREE.ExtrudeGeometry(prof(x => yd(x) + 0.32, x => Math.max(0, yd(x) - 0.42)), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
      for (const z of [0.9, -1.0]) part(g, wall, '#e8463c', 0, 0, z);
      g.userData.posts = [-3, -2, -1, 0, 1, 2, 3].map(x => [x, 0]); // nobody walks across it (nor along its deck)
    }
  } else if (id === 'icelamp') { // 25-1: a block of pale ice on a heap of snow, a warm light glowing inside it by night
    part(g, new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#f2f6fa', 0, 0, 0, { mat: { roughness: 0.62 } }).scale.y = 0.45;
    part(g, new THREE.SphereGeometry(0.1, 12, 9), '#ffd27a', 0, 0.42, 0, { lit: true });
    part(g, roundedBox(0.4, 0.46, 0.4, 0.06), '#d6eef7', 0, 0.42, 0, { m: glassLit('#ffc870') });
    halo(g, '#ffcf7a', 1.5, 0, 0.45, 0);
  } else if (id === 'table') { // 28-5 a round wooden table on one thick leg and a round foot (its top spots: data.js top)
    part(g, lathe([[0, 0], [0.78, 0], [0.8, 0.03], [0.79, 0.07], [0.76, 0.09], [0, 0.09]], 28), '#c88a4b', 0, 0.65, 0);
    part(g, lathe([[0, 0], [0.13, 0], [0.11, 0.15], [0.1, 0.5], [0.12, 0.65], [0, 0.65]], 14), '#a8703f', 0, 0, 0);
    part(g, lathe([[0, 0], [0.36, 0], [0.37, 0.03], [0.3, 0.07], [0, 0.08]], 20), '#a8703f', 0, 0, 0);
  } else if (id === 'shelf') { // 28-5 a low shelf: two open cubbies to the front (+z), a thick top, little round feet
    const W = 1.7, H = 0.84, D2 = 0.5;
    part(g, roundedBox(W, 0.08, D2, 0.03), '#c88a4b', 0, 0.88, 0);
    part(g, roundedBox(W - 0.06, 0.07, D2 - 0.04, 0.025), '#c88a4b', 0, 0.1, 0);
    for (const x of [-(W / 2 - 0.04), 0, W / 2 - 0.04]) part(g, roundedBox(0.08, H - 0.06, D2 - 0.02, 0.03), '#b07a48', x, 0.49, 0);
    part(g, roundedBox(W - 0.08, H - 0.12, 0.04, 0.015), '#a8703f', 0, 0.49, -D2 / 2 + 0.03);
    for (const x of [-0.72, 0.72]) for (const z of [-0.17, 0.17]) part(g, new THREE.SphereGeometry(0.06, 10, 8), '#8a5a34', x, 0.05, z);
  } else if (id === 'platform') { // 28-5 평상: a low wooden deck of four broad boards on four short legs, a rim round it
    const W = 2.1, D2 = 1.7;
    for (let i = 0; i < 4; i++) part(g, roundedBox(W - 0.08, 0.07, D2 / 4 - 0.025, 0.025), i % 2 ? '#d29a5c' : '#c88a4b', 0, 0.42, -D2 / 2 + D2 / 8 + i * D2 / 4);
    for (const s2 of [-1, 1]) { part(g, roundedBox(W, 0.1, 0.08, 0.03), '#a8703f', 0, 0.38, s2 * (D2 / 2 - 0.02)); part(g, roundedBox(0.08, 0.1, D2, 0.03), '#a8703f', s2 * (W / 2 - 0.02), 0.38, 0); }
    for (const x of [-0.9, 0.9]) for (const z of [-0.7, 0.7]) part(g, roundedBox(0.14, 0.36, 0.14, 0.04), '#8a5a34', x, 0.18, z);
  } else if (id === 'doll') { // 28-5 a roly-poly doll: a round red body that sits on its curve, a cream face, two bead eyes, no mouth
    part(g, new THREE.SphereGeometry(0.25, 20, 14), '#e5584a', 0, 0.24, 0).scale.set(1, 0.92, 0.95);
    part(g, new THREE.SphereGeometry(0.17, 18, 12), '#e5584a', 0, 0.56, 0);
    part(g, new THREE.SphereGeometry(0.13, 16, 12), '#fbe9d4', 0, 0.55, 0.065).scale.set(1, 0.95, 0.75);
    part(g, new THREE.SphereGeometry(0.13, 16, 12), '#fbe9d4', 0, 0.22, 0.12).scale.set(1, 1.05, 0.7);
    for (const x of [-0.05, 0.05]) part(g, new THREE.SphereGeometry(0.022, 10, 8), '#1d1a1a', x, 0.575, 0.16, { mat: { roughness: 0.25 } });
  } else if (['hillock', 'puddle', 'flowermound', 'rockmound'].includes(id)) {
    // 28-6 지형 도장: the ground itself takes the shape (stamps.js; habitat.js putProp sets each bit here on it). Its dome (userData.dome,
    // the same shape; the puddle: its rim) shows in the thumbnail and while held where it may not go, and is what a tap on it hits
    const P = PROPS.find(p => p.id === id), bit = (x, z) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.userData.moves = true; g.add(b); return b; }; // bake: one mesh a bit
    const dome = id === 'puddle' ? part(g, new THREE.RingGeometry(1.1, P.r, 32).rotateX(-Math.PI / 2), '#8a7356', 0, 0.03, 0, { mat: { roughness: 0.95 } })
      : part(g, lathe(Array.from({ length: 17 }, (_, i) => [(1 - i / 16) * P.r, shape(P.stamp, 1 - i / 16)]), 28), '#86b85c', 0, 0, 0, { mat: { roughness: 0.95 } });
    dome.userData.dome = dome.userData.flat = true;
    if (id === 'puddle') { // still water a little below the rim (where the dip comes up to it: 0.8 of the way out)
      const w = part(g, new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), '#6fb8e2', 0, P.stamp + 0.22, 0, { mat: { roughness: 0.3 } }); w.userData.flat = true; w.castShadow = false;
    } else if (id === 'flowermound') { // little clumps of the flower patch's flowers over the mound
      const stem = new THREE.CylinderGeometry(0.022, 0.022, 0.3, 5), head = new THREE.SphereGeometry(0.09, 10, 8), cols = ['#ff8fb3', '#ffd54a', '#fff7ee'];
      [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * 1.05 + 0.3) * 0.85, Math.sin(i * 1.05 + 0.3) * 0.85])].forEach(([x, z], c) => {
        const b = bit(x, z);
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + c, d = 0.13, fx = Math.cos(a) * d, fz = Math.sin(a) * d, h = 0.2 + ((i + c) % 3) * 0.06;
          part(b, stem, '#5fa04a', fx, h / 2, fz).scale.y = h / 0.3; part(b, head, cols[(i + c) % 3], fx, h + 0.04, fz); }
      });
    } else if (id === 'rockmound') { // three round rocks and two pebbles bedded in it
      const st = new THREE.SphereGeometry(1, 16, 11);
      [[0.1, -0.05, 0.5, 0.38, '#b8b2a6'], [0.62, 0.42, 0.3, 0.24, '#a8a39a'], [-0.55, 0.38, 0.34, 0.26, '#c9c1b0'], [-0.3, -0.62, 0.13, 0.1, '#a8a39a'], [0.5, -0.55, 0.11, 0.09, '#b8b2a6']].forEach(([x, z, w, h, c], i) =>
        part(bit(x, z), st, c, 0, h * 0.5, 0, { mat: { roughness: 0.55 }, ry: i }).scale.set(w, h, w * 0.88));
    }
  }
  return bake(g);
}
// 28-5 소품 색: the model's key colour (the most used vivid one, a plant's green only when nothing else is vivid; with nothing
// vivid, the most used one) turned to hex, and the colours near it with it (the same hue offset, saturation scaled, lightness
// shifted). Glowing, see-through and textured parts keep theirs. Its meshes' geometry and materials are copied first (shared).
// byArea (27-7b, the wood tones): "most used" by surface, not by vertices (a table's thick leg has more vertices than its top)
export function recolor(g, hex, byArea) {
  const SR = THREE.SRGBColorSpace, T = {}, h = {}, c = new THREE.Color(), parts = [], tally = new Map();
  new THREE.Color(hex).getHSL(T, SR);
  g.traverse(o => { const m = o.isMesh && o.material; if (m && !Array.isArray(m) && m.isMeshStandardMaterial && !m.map && !m.transparent && !m.emissive.getHex()) parts.push(o); });
  const each = (o, fn) => { const a = o.material.vertexColors && o.geometry.attributes.color; if (!a) return fn(o.material.color, o.geometry.attributes.position.count);
    for (let i = 0; i < a.count; i++) fn(c.setRGB(a.getX(i), a.getY(i), a.getZ(i)), 1, i, a); };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), area = o => { // each vertex: a third of its triangles' area
    const p = o.geometry.attributes.position, ix = o.geometry.index, w = new Float32Array(p.count), n = ix ? ix.count : p.count;
    for (let i = 0; i < n; i += 3) { const v = ix ? [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)] : [i, i + 1, i + 2];
      A.fromBufferAttribute(p, v[0]).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(p, v[1]).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(p, v[2]).applyMatrix4(o.matrixWorld);
      const s = B.sub(A).cross(C.sub(A)).length() / 6; for (const k of v) w[k] += s; }
    return w; };
  if (byArea) g.updateMatrixWorld(true);
  for (const o of parts) { const w = byArea && area(o); each(o, (col, n, i) => { const k = col.getHexString(SR); tally.set(k, (tally.get(k) || 0) + (!w ? n : i == null ? w.reduce((t, x) => t + x, 0) : w[i])); }); }
  const all = [...tally].map(([k, n]) => { new THREE.Color('#' + k).getHSL(h, SR); return { n, ...h }; }).filter(e => e.l > 0.12 && e.l < 0.93);
  const vivid = all.filter(e => e.s > 0.18), green = e => e.h > 65 / 360 && e.h < 170 / 360, other = vivid.filter(e => !green(e)), most = l => l.reduce((a, b) => b.n > a.n ? b : a, l[0]);
  const sum = l => l.reduce((t, e) => t + e.n, 0), K = other.length && sum(other) >= 0.15 * sum(vivid) ? most(other) : vivid.length ? most(vivid) : most(all);
  if (!K) return g;
  const hue = d => ((d % 1) + 1.5) % 1 - 0.5, cl = v => Math.min(1, Math.max(0, v)), kv = K.s > 0.18;
  const turn = col => { col.getHSL(h, SR); if (h.l <= 0.12 || h.l >= 0.93) return false;
    if (kv ? !(h.s > 0.12 && Math.abs(hue(h.h - K.h)) < 25 / 360) : !(h.s < 0.2 && Math.abs(h.l - K.l) < 0.25)) return false;
    col.setHSL(kv ? ((T.h + hue(h.h - K.h)) % 1 + 1) % 1 : T.h, cl(kv ? h.s * T.s / K.s : T.s + h.s - K.s), cl(h.l + T.l - K.l), SR); return true; };
  for (const o of parts) {
    if (o.material.vertexColors && o.geometry.attributes.color) { o.geometry = o.geometry.clone(); each(o, (col, n, i, a) => { if (turn(col)) a.setXYZ(i, col.r, col.g, col.b); }); }
    else { const m = o.material.clone(); if (turn(m.color)) o.material = m; else m.dispose(); }
  }
  return g;
}
// 28-4: the clockwork train's engine and its wagons (habitat.js runs them on the rails): along +x, the rail top at y 0 and the
// wheels on the rails; no face anywhere (the engine's front is a plain rounded cap). The engine's wind-up key turns at its back
// (userData.key). Nothing casts into the shadow map (drawn once): a blob under each car (habitat.js)
export function trainModel(kind, color) {
  const g = new THREE.Group(), DARK = '#4a4a55', GOLD = '#f0c24a', E = kind === 'engine', wheel = new THREE.CylinderGeometry(0.24, 0.24, 0.13, 18), hub = new THREE.SphereGeometry(0.08, 10, 8);
  for (const x of E ? [-0.62, 0.62] : [-0.55, 0.55]) for (const z of [-0.6, 0.6]) { part(g, wheel, '#d8443a', x, 0.22, z, { rx: Math.PI / 2 }); part(g, hub, GOLD, x, 0.22, z * 1.12); }
  part(g, roundedBox(E ? 2.1 : 1.9, 0.2, 1.05, 0.07), DARK, 0, 0.38, 0);
  for (const x of E ? [-1.08] : [-1, 1]) part(g, roundedBox(0.2, 0.1, 0.16, 0.04), DARK, x, 0.38, 0); // couplings
  if (E) {
    part(g, new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24), color, 0.3, 0.9, 0, { rz: Math.PI / 2 });
    part(g, new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), color, 0.95, 0.9, 0, { rz: -Math.PI / 2 }).scale.y = 0.35;
    part(g, new THREE.TorusGeometry(0.425, 0.04, 8, 28), GOLD, 0.95, 0.9, 0, { ry: Math.PI / 2 });
    part(g, lathe([[0, 0], [0.13, 0], [0.13, 0.26], [0.21, 0.4], [0.21, 0.5], [0, 0.5]], 16), DARK, 0.72, 1.2, 0);
    part(g, new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), GOLD, 0.25, 1.28, 0);
    part(g, roundedBox(0.8, 0.85, 1.1, 0.08), color, -0.62, 0.9, 0);
    for (const z of [-0.55, 0.55]) part(g, roundedBox(0.36, 0.3, 0.04, 0.03), '#fff4dc', -0.62, 1.08, z);
    part(g, roundedBox(1, 0.12, 1.28, 0.05), '#e8463c', -0.62, 1.39, 0);
    const key = g.userData.key = new THREE.Group(); key.position.set(-1.02, 0.95, 0); key.userData.moves = true; g.add(key);
    part(key, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), GOLD, -0.1, 0, 0, { rz: Math.PI / 2 });
    for (const y of [-0.13, 0.13]) part(key, new THREE.TorusGeometry(0.11, 0.045, 8, 16), GOLD, -0.24, y, 0, { ry: Math.PI / 2 });
  } else { // an open tub: its floor top at CARS.floor (0.5), walls to 0.8
    part(g, roundedBox(1.84, 0.08, 1.2, 0.04), color, 0, 0.46, 0);
    for (const z of [-0.55, 0.55]) part(g, roundedBox(1.84, 0.32, 0.1, 0.04), color, 0, 0.64, z);
    for (const x of [-0.87, 0.87]) part(g, roundedBox(0.1, 0.32, 1.2, 0.04), color, x, 0.64, 0);
  }
  bake(g); g.traverse(o => { o.castShadow = false; }); return g;
}
// 28-2: a play prop's state (play.js) and its motion
const play = (g, kind, parts) => { const st = g.userData.play = newPlay(kind, parts); g.userData.tick = t => propTick(st, t); };
// the hammock's cloth: from its two ends (x +-hx, y 0) down to a broad flat bottom sag below, its long edges (z +-hz) curled up
function slingGeo(hx, hz, sag) {
  const pos = [], idx = [], nx = 24, nz = 8; // inbox 36: finer (it gives under a body: play.js give), its middle a quarter wider than its ends
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const x = -hx + 2 * hx * i / nx, z = -hz + 2 * hz * j / nz, f = 1 - (x / hx) ** 4; pos.push(x, -sag * f + 0.22 * (z / hz) ** 2 * f, z * (1 + 0.25 * f)); }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
// a five-pointed star facing +z, centred on its depth (the star lamp's; the music box's smaller)
function starGeo(R, r, d = 0.06, b = 0.04) {
  const sh = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * k, Math.sin(a) * k); }
  return new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 }).translate(0, 0, -d / 2);
}
// 28-3: a music note (white: the sprite's colour tints it), soap bubbles (clear in the middle, a rainbow sheen at the edge),
// a pinwheel's four blades in four colours round a yellow hub (vertex colours: the five pinwheels are one InstancedMesh)
let noteT = null;
const noteTex = () => noteT ??= (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff';
  x.beginPath(); x.ellipse(24, 48, 11, 8, -0.4, 0, Math.PI * 2); x.fill(); x.fillRect(30, 10, 5, 38);
  x.beginPath(); x.moveTo(35, 10); x.quadraticCurveTo(52, 18, 48, 34); x.quadraticCurveTo(46, 24, 35, 22); x.fill(); return new THREE.CanvasTexture(c); })();
const bubbleMat = () => decorMats.bubble ??= Object.assign(toyMat('#eef8ff', { transparent: true, depthWrite: false, roughness: 0.1 }), { onBeforeCompile: sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));\n' +
    'outgoingLight += 0.35 * fr * (0.5 + 0.5 * cos(6.28 * (fr * 1.5 + vec3(0.0, 0.33, 0.67))));\ndiffuseColor.a = 0.1 + 0.55 * fr * fr;\n#include <opaque_fragment>'); } });
const tint = (geo, c) => { const k = new THREE.Color(c); geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geo.attributes.position.count }, () => [k.r, k.g, k.b]).flat(), 3)); return geo; };
function rotorGeo() {
  const blades = ['#ff6b6b', '#ffd54a', '#5aa9e6', '#7fd8a8'].map((c, i) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.3, 0.02); s.quadraticCurveTo(0.27, 0.2, 0.08, 0.26); s.lineTo(0, 0);
    return tint(new THREE.ShapeGeometry(s, 4).rotateZ(i * Math.PI / 2), c); });
  return merge([...blades, tint(new THREE.SphereGeometry(0.045, 10, 8).translate(0, 0, 0.02), '#ffd54a')]);
}
// inbox 26: the snowman and igloo looked small beside the other big props at the full view: their parts x1.25 (PROPS r with them)
const big = g => { for (const c of g.children) { c.position.multiplyScalar(1.25); c.scale.multiplyScalar(1.25); } };
// 22-2: the parts of a prop that never move become one mesh per material (a big prop has 20-60 parts: as many draw calls
// before). Sprites and a material's only part stay as they are. 26-9: the parts under a group marked userData.moves (sails, a
// beam) merge the same way inside that group, which still turns (the windmill's ten sail parts: two draws).
// 28-3: plain vinyl parts (no map, glow, see-through or shader hook) that differ only in colour merge too, the colour moved
// into the vertices (tint) on one white vertex-colour material: a prop is about one draw per surface finish, not per colour.
// The model is a fresh group at the origin, so each part's matrixWorld is its place in the model
const plain = m => m.isMeshStandardMaterial && !m.map && !m.vertexColors && !m.transparent && !m.emissive.getHex() && !Object.hasOwn(m, 'onBeforeCompile');
function bake(g) {
  g.updateMatrixWorld(true);
  const by = new Map(), inv = new THREE.Matrix4();
  g.traverse(o => { if (!o.isMesh) return; let own = g; for (let p = o.parent; p !== g; p = p.parent) if (p.userData.moves) { own = p; break; }
    const t = o.material, k = own.uuid + (plain(t) ? `v${t.roughness},${t.metalness},${t.side}` : t.uuid) + o.castShadow + o.renderOrder; by.has(k) ? by.get(k).push([o, own]) : by.set(k, [[o, own]]); });
  for (const list of by.values()) if (list.length > 1) {
    const [[o0, own]] = list, t = o0.material, v = list.some(([o]) => o.material !== t); inv.copy(own.matrixWorld).invert();
    const m = new THREE.Mesh(merge(list.map(([o]) => { const q = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv); return v ? tint(q, o.material.color) : q; })),
      v ? dm('#ffffff', { roughness: t.roughness, metalness: t.metalness, side: t.side, vertexColors: true }) : t);
    m.castShadow = o0.castShadow; m.receiveShadow = o0.receiveShadow; m.renderOrder = o0.renderOrder; for (const [o] of list) o.removeFromParent(); own.add(m);
  }
  return g;
}
