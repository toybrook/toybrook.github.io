// Dino jungle props: the meadow's planting kit (meadow/props.js kit / natives / finish) on the jungle layout, as the snow's
// (snow/props.js). Tree ferns along the back with a small toy volcano among them (a glowing crater, slow grey smoke), ferns and
// tall grass in the green, rocks round the mounds' feet and on the lagoon's bank, reeds and lily pads in it, a glossy mud disc in
// the wallow, and the fossil dig: half-buried bones, heaps of dug sand, four marker stakes with flags.
import * as THREE from 'three';
import { S, O, Z, pond, shoreR, mounds, mud, fossil, spots, heightAt, occupied, free, rand, waterY, WATER_Y } from './layout.js';
import { zoneProps, softTex } from '../zoneprops.js';
import { BOARD0, inRect } from '../zones.js';
import { kit, emptyL, natives, finish, addPads, addReeds, flowerPal, flowerCluster } from '../meadow/props.js';
import { toyMat, instanced, lathe, merge, skyLit } from '../toyKit.js';

const n2 = n => Math.round(n * S * S);
export function buildProps(scene) {
  const L = emptyL(), N = natives(occupied, 'dino');
  const { pickOf, jitter, treefern, tree, rock, fern, tuft: clump } = kit(L, { rand, heightAt, occupied }), nk = kit(N.Ls, { rand, heightAt, occupied });
  const tuft = (x, z) => { const i = L.stem.length; clump(x, z); occupied.push({ x, z, r: 0.25, h: 1.7, fade: [['stem', i, 4], ['head', i, 4]] }); }; // as the pond's reeds
  const onPond = (a, s) => { const r = shoreR(a) + s; return [pond.x + Math.cos(a) * r, pond.z + Math.sin(a) * r]; };
  const ups = [];

  // ---------- the volcano: a toy cone on the back shelf, a crater glowing orange, three lava runs, smoke ----------
  {
    const vx = -3 * S, vz = -27 * S, y0 = heightAt(vx, vz), g = new THREE.Group();
    const stone = toyMat('#8a7262', { roughness: 0.7 }), lava = toyMat('#ff7a2a', { roughness: 0.4, emissive: '#ff5a10', emissiveIntensity: 0.9 });
    const cone = new THREE.Mesh(lathe([[0, -1.2], [5.2, -1.2], [5.1, 0], [4.3, 1.1], [3.2, 3.2], [2.2, 5.4], [1.55, 7.0], [1.35, 7.5], [1.05, 7.45], [0.8, 6.9], [0, 6.9]], 40), stone);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), lava); top.rotation.x = -Math.PI / 2; top.position.y = 6.95;
    g.add(cone, top);
    for (const a of [0.35, 1.25, 2.4]) { // lava runs over the rim, down the side toward the camera
      const p = new THREE.Group(); p.rotation.y = Math.PI / 2 - a;
      for (const [r, y, l] of [[1.55, 6.7, 0.75], [2.15, 5.2, 0.6]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), lava); m.scale.set(0.14, l + (a % 1) * 0.3, 0.3); m.position.set(r + 0.06, y, 0); m.rotation.z = 0.38; p.add(m); }
      g.add(p);
    }
    g.scale.set(1, 1, 0.62); g.position.set(vx, y0 - 0.2, vz); g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); scene.add(g);
    occupied.push({ x: vx, z: vz, r: 5.2, h: 8 });
    const tex = softTex(), puffs = [], c0 = new THREE.Color('#a8a29a'), Y = y0 - 0.2 + 7.2;
    for (let i = 0; i < 7; i++) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: c0.clone() }), sp = new THREE.Sprite(m); sp.renderOrder = 2; scene.add(sp); puffs.push({ sp, ph: i / 7 }); }
    ups.push(t => { for (const p of puffs) { const u = (t / 9 + p.ph) % 1; p.sp.position.set(vx + Math.sin(u * 2 + p.ph * 7) * 0.4 + u * 2.2, Y + u * 6, vz + 0.4); p.sp.scale.setScalar(1.6 + u * 3.6); p.sp.material.color.copy(c0).multiply(skyLit.value); p.sp.material.opacity = 0.75 * Math.sin(Math.min(1, u * 1.4) * Math.PI) ** 0.7; } });
  }

  // the back: tree ferns with a few round trees (part of the board)
  for (let i = 0; i < n2(80); i++) {
    const x = (-17 + rand() * 34) * S, z = (-28.4 + rand() * 4.2) * S;
    if (!free(x, z, 1.0)) continue;
    rand() < 0.75 ? treefern(x, z, 0.85 + rand() * 0.4) : tree(x, z, 0.85 + rand() * 0.3);
  }
  // the mounds: big rocks round the foot, an open gap on the side toward the lagoon (the pterosaur's way up)
  for (const m of mounds) {
    const gap = Math.atan2(pond.z - m.z, pond.x - m.x), n = Math.round(7 * m.r / 3);
    for (let i = 0; i < n; i++) {
      const a = gap + 0.75 + i / (n - 1) * (2 * Math.PI - 1.5) + (rand() - 0.5) * 0.2, d = m.r * (0.78 + rand() * 0.12);
      rock(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, (0.55 + rand() * 0.4) * Math.min(1, m.h));
    }
  }
  // tree ferns and bushes in the corners and along the sides (the natives: moved, cut and planted again by the player)
  [[-14.5, -20.5], [14.2, -20.6], [3.5, -21.4], [-13.5, 24.5], [-15.4, 18.5], [15, 25.8], [15.4, 8.5], [-15.6, -5.5]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 1.4)) N.add('treefern', nk.treefern, x, z, 0.9 + rand() * 0.3); });
  [[-6.5, -21.6], [16, -14.5], [-9.5, 26.4], [9, 26.6], [-16.2, 7.5], [15.8, 1.5]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 0.9)) N.add('bush', nk.bush, x, z, 0.9 + rand() * 0.4); });
  // rocks on the bank, a few in the green
  for (let i = 0; i < Math.round(12 * S); i++) rock(...onPond(rand() * 6.28, 0.4 + rand() * 0.5), 0.3 + rand() * 0.35);
  for (let i = 0; i < n2(6); i++) { const x = (-15 + rand() * 30) * S, z = (-20 + rand() * 46) * S; if (free(x, z, 1)) N.add('rock', nk.rock, x, z, 0.45 + rand() * 0.45); }

  // ---------- the mud wallow: a glossy disc of mud over the dip's flat floor, tall grass round it ----------
  {
    const sh = new THREE.Shape(), R0 = mud.r - 1.25, n = 36;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = R0 + 0.18 * Math.sin(3 * a + 1) + 0.1 * Math.sin(7 * a); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(r, 0); }
    const geo = new THREE.ShapeGeometry(sh, 2); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, toyMat('#5a3a22', { roughness: 0.22 })); m.position.set(mud.x, heightAt(mud.x, mud.z) + 0.06, mud.z); m.receiveShadow = true; scene.add(m);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + rand() * 0.4, d = mud.r + 0.4 + rand() * 0.8, x = mud.x + Math.cos(a) * d, z = mud.z + Math.sin(a) * d; if (free(x, z, 0.3)) clump(x, z); }
  }
  // ---------- the fossil dig: bones half out of the sand, heaps of dug sand by the dig spots, stakes with little flags ----------
  {
    const bone = '#efe2c4', parts = [], digs = spots.filter(s => s.act === 'dig');
    const away = (x, z, m) => digs.every(s => Math.hypot(x - s.x, z - s.z) > s.r + m);
    const at = (a, f) => [fossil.x + Math.cos(a) * fossil.r * f, fossil.z + Math.sin(a) * fossil.r * f];
    // ribs: three arcs out of the sand in a row
    { const [x, z] = at(2.1, 0.55), y = heightAt(x, z) - 0.12; for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(0.62 - i * 0.08, 0.07, 8, 20, Math.PI); t.translate(0, 0, (i - 1) * 0.42); t.rotateY(0.5); t.translate(x, y, z); parts.push(t); }
      occupied.push({ x, z, r: 0.9, h: 0.7 }); }
    // two long bones lying flat, knobs at the ends
    for (const [a, f, ry] of [[4.0, 0.62, 0.7], [5.4, 0.45, -0.4]]) {
      const [x, z] = at(a, f); if (!away(x, z, 0.6)) continue; const y = heightAt(x, z) + 0.04, sh = new THREE.CapsuleGeometry(0.08, 0.8, 4, 10); sh.rotateZ(Math.PI / 2);
      const k = [-0.5, 0.5].flatMap(d => [-0.07, 0.07].map(e => { const s = new THREE.SphereGeometry(0.11, 10, 8); s.translate(d, 0, e); return s; }));
      const b = merge([sh, ...k]); b.rotateY(ry); b.translate(x, y, z); parts.push(b); occupied.push({ x, z, r: 0.6, h: 0.3 });
    }
    const bm = new THREE.Mesh(merge(parts), toyMat(bone, { roughness: 0.55 })); bm.castShadow = bm.receiveShadow = true; scene.add(bm);
    // dug sand in low heaps by each dig spot, pebbles over the floor
    for (const s of digs) for (let i = 0; i < 3; i++) { const a = rand() * 6.28, d = s.r + 0.3 + rand() * 0.3, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, r = 0.35 + rand() * 0.2;
      L.rock.push({ x, y: heightAt(x, z) - r * 0.2, z, s: [r * 1.3, r * 0.45, r], ry: rand() * 6, c: jitter('#d9bf8a', 0.05) }); }
    for (let i = 0; i < 40; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * fossil.r, x = fossil.x + Math.cos(a) * d, z = fossil.z + Math.sin(a) * d;
      L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.12 + rand() * 0.12, 0.07, 0.1 + rand() * 0.1], ry: rand() * 6, c: jitter(pickOf(['#c9b991', '#b8a07a', '#e0d0a8']), 0.08) }); }
    // marker stakes at four corners, a little orange flag on each
    const st = [], fl = [];
    for (let i = 0; i < 4; i++) { const a = 0.785 + i * Math.PI / 2, [x, z] = at(a, 1.0), y = heightAt(x, z);
      const p = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8); p.translate(x, y + 0.4, z); st.push(p);
      const f = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.32, -0.09, 0), new THREE.Vector3(0, -0.18, 0)]); f.computeVertexNormals(); f.translate(x + 0.04, y + 0.84, z); fl.push(f); }
    const sm = new THREE.Mesh(merge(st), toyMat('#b07a48', { roughness: 0.6 })); sm.castShadow = true; scene.add(sm);
    scene.add(new THREE.Mesh(merge(fl), toyMat('#f08a3a', { roughness: 0.5, side: THREE.DoubleSide })));
  }

  // reeds along the lagoon's shelf (back and sides, the front view open), lily pads on the water
  for (const a of [3.6, 3.9, 4.4, 5.3, 5.65, 0.15, 2.7, 1.0, 2.25, 3.25, 4.85, 5.95]) { const [x, z] = onPond(a + (rand() - 0.5) * 0.1, -0.6 - rand() * 1.0); tuft(x, z); }
  const RD = addReeds(scene, L); for (const o of occupied) if (o.fade) for (const p of o.fade) if (RD[p[0]]) p[0] = RD[p[0]];
  const pads = [];
  for (let i = 0; i < n2(18); i++) { const [x, z] = onPond(rand() * 6.28, -1.4 - rand() * 4.5); pads.push({ x, y: WATER_Y + 0.06, z, s: 0.7 + rand() * 0.55, ry: rand() * 6, c: jitter('#5fa83e', 0.08) }); }
  addPads(scene, pads);

  // ---------- ferns, a few flowers, grass ----------
  for (let i = 0; i < n2(70); i++) { const x = (-17 + rand() * 34) * S, z = (-23 + rand() * 50) * S; if (free(x, z, 0.5) && !spots.some(s => Math.hypot(x - s.x, z - s.z) < s.r + 1.5)) fern(x, z, 0.8 + rand() * 0.5); }
  for (let cl = 0; cl < n2(14); cl++) {
    const cx = (-16.5 + rand() * 33) * S, cz = (-22 + rand() * 49) * S; if (!free(cx, cz, 0.4)) continue;
    const pi = Math.floor(rand() * flowerPal.length); N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rand, jitter, heightAt);
  }
  N.bare(() => { for (let i = 0; i < n2(9000) && L.grass.length < n2(2200); i++) {
    const x = (-17.6 + rand() * 35.2) * S, z = (-28.6 + rand() * 57.2) * S;
    if (!inRect(BOARD0, x, z, 0.4) || spots.some(s => Math.hypot(x - s.x, z - s.z) < s.r + 2.2)) continue; // none on the mud or the dig
    const h = heightAt(x, z), u = h - waterY(), bank = u > 0.02 && u < 0.45;
    if (!bank && !free(x, z, 0)) continue;
    if (bank && rand() < 0.6) continue;
    L.grass.push({ x, y: h - 0.03, z, s: bank ? 1.6 + rand() * 0.6 : 0.9 + rand() * 0.7, big: bank, ry: rand() * 6, c: jitter(bank ? '#4f9032' : pickOf(['#5e9c35', '#4f9032', '#6aa83a']), 0.06) });
  } });
  const zp = zoneProps(scene, 'dino', { L, N, heightAt, occupied, free, O, Z, back: -24.2 * S });
  const list = N.done();
  return { natives: list, zone: { update: (t, ctx) => { zp.update(t, ctx); for (const u of ups) u(t); } }, ...finish(scene, L, { rand, occupied }) };
}
