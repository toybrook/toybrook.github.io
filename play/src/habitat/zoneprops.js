// 28-1 what stands in each 땅 넓히기 zone (zones.js): the planting every strip gets (the back shelf's forest on a side strip,
// trees, bushes, rocks, flowers and grass at the zone's own mix) and the zone's own things. Only the zones open now: the one
// under mist stays bare. Its own random per zone, so the first board and the other zones come out as before. The trees,
// bushes, rocks and flowers are natives (ring: the zone's step, rules.js addNatives); the zone's fixtures are part of the board.
// inbox 34: each zone's landmark, big enough to read when the camera flies there (the grove's old tree, the fork's waterwheel,
// the orchard's rows, the lookout's gazebo and telescope, the mushroom path's giant toadstools, the reeds' banks, the falls'
// spray, the sandbar's shells and driftwood, the lotus pond, the isle's long bridge, the swamp's fog and stumps, the snow's
// blue pillars and sparkling ice), and a small wooden sign with the zone's name at its entrance (설정 「구역 팻말 보이기」).
import * as THREE from 'three';
import { strip, inRect, polyD, poolAt, ORCHARD_ROWS, S129, Z143, z143on, SOAK, REVEAL, fore143, otherWater } from './zones.js';
import { sfx } from '../ui/sound.js';
import { ZONES, UNIT, NAT_K } from '../game/data.js';

const S = UNIT; // inbox 42 A: the old board's metres -> the world's
import { PREFS } from '../config.js';
import { kit, emptyL, flowerPal, flowerCluster, addPads, addReeds, decorModel, part, halo, partGeos } from './meadow/props.js';
import { toyMat, instanced, lathe, roundedBox, skyLit, nightGlow } from './toyKit.js';
import { fireflies } from './daylight.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import { addSway, merge } from './toyKit.js'; // 143 B
import { sand143fore, falls143fore } from './zones.js'; // 143 B the sandbar, the falls
import { bake, flowMat } from './meadow/props.js';
import { rainbowMesh, weatherNow } from './weather.js'; // 143 B the falls' bow

// per 100 m²: trees, bushes, rocks, flower clusters; grass: the share of the first board's density
const DRIFT_PAL = [0, 3, 4]; // the flower hill's three colours (flowerPal: white, pink, yellow)
const MIX = {
  flowerhill: { tree: 0, bush: 0.3, rock: 0.2, fl: 4, drift: 6, grass: 1 }, grove: { tree: 0, bush: 1.0, rock: 0.6, fl: 0.6, grass: 1 },
  fork: { tree: 0.3, bush: 0.8, rock: 0.4, fl: 2.2, grass: 1 }, orchard: { tree: 0, bush: 0.1, rock: 0.1, fl: 0.6, grass: 0.5 },
  lookout: { tree: 0.1, bush: 0.5, rock: 0.6, fl: 3, grass: 1 }, mushroom: { tree: 1.6, bush: 0.8, rock: 0.3, fl: 0.3, grass: 0.8 },
  reeds: { tree: 0.1, bush: 0.4, rock: 0.2, fl: 0.6, grass: 0.8 }, falls: { tree: 0.3, bush: 0.6, rock: 0.8, fl: 1, grass: 1 },
  sandbar: { tree: 0, bush: 0.1, rock: 0.2, fl: 0, grass: 0.1 }, lotus: { tree: 0.2, bush: 0.5, rock: 0.3, fl: 1.5, grass: 1 },
  isle: { tree: 0.3, bush: 0.6, rock: 0.4, fl: 2, grass: 1 }, swamp: { tree: 0, bush: 0.4, rock: 0.2, fl: 0, grass: 0.5 },
  conifer: { tree: 2.4, rock: 0.4 }, sled: { tree: 0.4, rock: 0.4 }, pillars: { tree: 0.1, rock: 0.5 },
  hotspring: { tree: 0.5, rock: 0.3 }, cave: { tree: 0.4, rock: 0.6 }, iceplate: { tree: 0, rock: 0 }, // nothing on the ice
  // 14-3 the dino jungle (tree: its tree ferns; fern: low ground ferns, kit fern)
  fernwood: { tree: 1.4, bush: 0.6, rock: 0.3, fl: 0.3, grass: 1, fern: 6 }, cliffs: { tree: 0.2, bush: 0.4, rock: 0.8, fl: 0.4, grass: 0.8, fern: 1.5 },
  riverbed: { tree: 0.3, bush: 0.6, rock: 0.4, fl: 0.8, grass: 1, fern: 2 }, bigdig: { tree: 0, bush: 0.1, rock: 0.3, fl: 0, grass: 0.1 },
  mudflat: { tree: 0.2, bush: 0.4, rock: 0.2, fl: 0, grass: 0.5, fern: 1.5 }, springs: { tree: 0.4, bush: 0.5, rock: 0.4, fl: 0.6, grass: 0.8, fern: 2 },
};
// 143 B (?z143=1): the reeds' own beds stand where the mix's trees, bushes, rocks and flowers went (grass only)
const MIX143 = { reeds: { tree: 0, bush: 0, rock: 0, fl: 0, grass: 0.8 } };
const GREENS = ['#6aa83a', '#7cb843', '#5e9c35'];
// 141 D (?s129=4): a flat natural stone, faceted: planes cutting a ball (a flat top a little tilted, a flat bottom, seven sides
// leaning in and out), their edges a little round (a soft min of the planes: a toy's, not sharp). One, cached like partGeos (lives
// as long as the page, as those do: no dispose)
let SLAB = null;
const slabGeo = () => SLAB ??= (() => { const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position, v = new THREE.Vector3(), k = 0.06;
  const N = [[0, 1, 0.12, 0.5], [0.08, -1, 0, 0.55], ...Array.from({ length: 7 }, (_, i) => { const a = i / 7 * 6.283 + 0.35 * Math.sin(i * 2.3); return [Math.cos(a), 0.35 * Math.sin(i * 1.7 + 1), Math.sin(a), 0.8 + 0.12 * Math.sin(i * 3.1)]; })]
    .map(([x, y, z, o]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l, o]; });
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); let e = 0; for (const [x, y, z, o] of N) { const c = v.x * x + v.y * y + v.z * z; if (c > 0.02) e += Math.exp(-o / c / k); }
    v.multiplyScalar(Math.min(1.2, -k * Math.log(e))); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; })();
const HEAP = [[0.95, 0.15, 0.42], [-0.85, -0.1, 0.32], [0.55, -0.6, 0.2], [1.5, -0.2, 0.15], [-0.45, 0.65, 0.2], [-1.35, 0.3, 0.13]]; // 141 D a heap's stones round its big one: along, out (x its size), size
let soft = null; // a soft round spot (fog, steam, mist; 14-3: the volcano's smoke, dino/props.js)
export const softTex = () => { if (soft) return soft; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return soft = new THREE.CanvasTexture(c); };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// hab: 'meadow' | 'pond' | 'snow' | 'dino'; o: { L, N (natives), heightAt, occupied, free (the open ground now), O (the open rect),
// Z (zoneSet), back (the back forest's front edge), cliff (meadow: the cliff's foot, for its rock ledge) }
export function zoneProps(scene, hab, o) {
  const { L, N, heightAt, occupied, free, O, Z, back } = o, snow = hab === 'snow', dino = hab === 'dino';
  const Lr = emptyL(), pads = [], fruit = [], caps = [], slabs = [], crystals = [], ups = [], orchard = [], shake = [], fx = [], shells = [], signs = [];
  const nearSpot = (x, z, m) => Z.spots.some(s => Math.hypot(x - s.x, z - s.z) < s.r + m);
  const popK = S129 || Z143 ? REVEAL.k : 0, pop = { t0: null, quiet: false, rocks: [], slabs: [], caps: [] }, sm = u => (u = Math.min(1, Math.max(0, u))) * u * (3 - 2 * u); // 129: the zone just opened (its fixtures pop up)
  const popIn = t => pop.t0 == null ? 0 : sm((t - pop.t0 - 0.9) / 1.6); // its steam comes up with them
  for (let k = 1; k <= ZONES[hab].length; k++) {
    const s = strip(hab, k); if (!inRect(O, s.cx, s.cz)) continue;
    let sd = 7919 * k + (hab === 'pond' ? 31 : snow ? 57 : dino ? 71 : 3); const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
    const K = kit(L, { rand: rnd, heightAt, occupied }), nk = kit(N.Ls, { rand: rnd, heightAt, occupied }), R = kit(Lr, { rand: rnd, heightAt, occupied });
    const { pickOf, jitter } = K, r = s.r, A = (r[1] - r[0]) * (r[3] - r[2]), mix = Z143 && MIX143[s.id] || MIX[s.id], at = (u, v) => s.pos(u, v);
    const ok = (x, z, m) => free(x, z, m) && !nearSpot(x, z, m + 0.3);
    const place = (n, okf, put) => { for (let i = 0, c = 0; c < n && i < n * 60; i++) { const x = r[0] + rnd() * (r[1] - r[0]), z = r[2] + rnd() * (r[3] - r[2]); if (okf(x, z)) { put(x, z); c++; } } };
    const rock = (x, z, sc) => { K.rock(x, z, sc); if (snow) { const q = L.rock.at(-1); caps.push({ x: q.x, y: q.y + q.s[1] * 0.78, z: q.z, s: [q.s[0] * 0.7, q.s[1] * 0.32, q.s[2] * 0.7], ry: q.ry, c: '#f6f9fc' }); } };
    const put = (g, x, z, ry = 0, rr = 1, y = heightAt(x, z), h = 1.2) => { g.position.set(x, y, z); g.rotation.y = ry; g.userData.zk = k; scene.add(g); fx.push(g); occupied.push({ x, z, r: rr, h }); return g; };
    const fixture = (id, ...a) => put(decorModel(id), ...a);
    // n points d0..d1 out from a pool's middle line (a capsule's too), fn(x, z, the way out)
    const ringOf = (f, n, d0, d1, fn) => { for (let i = 0; i < n; i++) { const [x, z, cx, cz] = poolAt(f, (i + rnd() * 0.4) / n, d0 + rnd() * (d1 - d0)); fn(x, z, Math.atan2(z - cz, x - cx)); } };
    const pools = Z.pools.filter(f => f.zone === s.id), wl = f => f.r - (f.hot ? 0.7 : 0.4), WA = [...Z.pools, ...Z.rills];
    const waterAt = f => { let y = Infinity, ye = Infinity; for (let i = 0; i < 32; i++) { const [x, z] = poolAt(f, i / 32, wl(f)), h = heightAt(x, z); y = Math.min(y, h); if (f.even && !otherWater(WA, f, x, z)) ye = Math.min(ye, h); } return (ye < Infinity ? ye : y) + 0.02; }; // 143 even: as meadow/water.js
    const pad = (x, y, z, i) => pads.push({ x, y: y + 0.015 + (i % 6) * 0.004, z, s: 0.6 + rnd() * 0.45, ry: rnd() * 6, c: jitter('#5fa83e', 0.08) }); // stepped a hair: no flicker where two overlap

    // the back shelf of a side strip: its forest goes on
    if (s.side !== '+z') {
      place(Math.round((r[1] - r[0]) * (back - r[2]) * 0.2), (x, z) => z < back && free(x, z, 1.0), (x, z) => snow ? K.snowpine(x, z, 0.85 + rnd() * 0.5) : dino ? (rnd() < 0.7 ? K.treefern(x, z, 0.85 + rnd() * 0.4) : K.tree(x, z, 0.85 + rnd() * 0.3)) : rnd() < 0.7 ? K.pine(x, z, 0.85 + rnd() * 0.45) : K.tree(x, z, 0.85 + rnd() * 0.3));
      if (o.cliff != null) for (let x = r[0] + 0.5; x < r[1] - 0.4; x += 0.9 + rnd() * 0.6) rock(x, o.cliff - 0.55 + (rnd() - 0.5) * 0.7, 0.5 + rnd() * 0.45);
    }
    const low = (m, x, z) => z > back + 2.4 && ok(x, z, m);
    const tree = (x, z, sc) => snow ? N.add('snowpine', nk.snowpine, x, z, sc) : dino ? N.add('treefern', nk.treefern, x, z, sc) : N.add('tree', nk.tree, x, z, sc);
    // 14-3: d0..d1 out from a rill (either side), n times: fn(x, z)
    const banks = (f, n, d0, d1, fn) => { for (let i = 0; i < n; i++) { const P = f.pts, j = Math.floor(rnd() * (P.length - 1)), dx = P[j + 1][0] - P[j][0], dz = P[j + 1][1] - P[j][1], l = Math.hypot(dx, dz), t = rnd(), sg = rnd() < 0.5 ? -1 : 1, d = d0 + rnd() * (d1 - d0);
      fn(P[j][0] + dx * t - dz / l * sg * d, P[j][1] + dz * t + dx / l * sg * d); } };
    const stump = (x, z) => { L.trunk.push({ x, y: heightAt(x, z) - 0.05, z, s: [0.95, 0.3 + rnd() * 0.12, 0.95], ry: rnd() * 6, c: jitter('#6e4a2e', 0.05) }); occupied.push({ x, z, r: 0.6, h: 0.6 }); };
    // 143: the ground's lowest round a thing (sunk to it: no edge in the air on a slope); heaps of half sunk stones (141 D's flat
    // ones: a big one, mid and small ones at its feet), on the zone's own stream r3
    const lowest = (x, z, m) => Math.min(heightAt(x, z), heightAt(x + m, z), heightAt(x - m, z), heightAt(x, z + m), heightAt(x, z - m));
    const pennant = (x, z, ph) => { const g = new THREE.Group(); // q1: a pole, a gold knob, a pennant fluttering in the wind (not merged: it moves; the lookout's, the sled hill's)
      part(g, new THREE.CylinderGeometry(0.035, 0.045, 2.4, 8), '#a07848', 0, 1.2, 0); part(g, new THREE.SphereGeometry(0.07, 10, 8), '#ffd54a', 0, 2.44, 0);
      const pn = new THREE.Group(); pn.position.set(0, 2.18, 0); g.add(pn);
      part(pn, new THREE.ConeGeometry(0.22, 0.75, 3), '#f07a6a', 0.38, 0, 0, { rz: -Math.PI / 2 }).scale.z = 0.25;
      g.position.set(x, heightAt(x, z), z); scene.add(g); occupied.push({ x, z, r: 0.3, h: 2.4 });
      ups.push(t => { pn.rotation.y = 0.5 + Math.sin(t * 1.7 + ph) * 0.35 + Math.sin(t * 5.3) * 0.06; pn.rotation.x = Math.sin(t * 7.1 + ph) * 0.12; }); return g; };
    const heaps = (F, r3, j3) => { const slab = (x, z, sc, big) => { const sx = sc * (1.05 + r3() * 0.35), sy = sc * (0.6 + r3() * 0.2), sz = sc * (0.8 + r3() * 0.25), h0 = heightAt(x, z), y = Math.max(lowest(x, z, 0.7 * Math.max(sx, sz)), h0 - 0.4 * sy) - 0.05 * sy; // half sunk (as the spring's)
        slabs.push({ x, y, z, s: [sx, sy, sz], ry: r3() * 6.283, rx: big ? 0 : (r3() - 0.5) * 0.3, rz: big ? 0 : (r3() - 0.5) * 0.3, c: j3(big ? '#aaa499' : sc > 0.3 ? '#bdb6a9' : '#a09a8f', 0.05) });
        if (k === popK) pop.slabs.push(slabs.length - 1); if (big) occupied.push({ x, z, r: 0.8 * Math.max(sx, sz), h: 0.6 * sy }); };
      for (const f of F.filter(f => f.t === 'heap143')) { const a0 = r3() * 6.283, ux = Math.cos(a0), uz = Math.sin(a0); slab(f.x, f.z, f.sc, true);
        for (const [a, b, q] of HEAP) { if (r3() < 0.2) continue; const s2 = q * f.sc * (0.85 + r3() * 0.3); if (s2 >= 0.14) slab(f.x + (ux * a - uz * b) * f.sc, f.z + (uz * a + ux * b) * f.sc, s2, false); } } };
    const on3 = z143on(s.id), z3 = on3 && s.id === 'flowerhill', H3 = on3 && (z3 || s.id === 'grove') && Z.F.find(f => f.zone === s.id && f.t === 'hill'); // 143: the flower hill's own bushes, stones and flowers (own.flowerhill), the mix's grass only;
    const fore = (x, z) => H3 && Math.abs(x - H3.x) < H3.rx + 2 && z > H3.z - H3.rz - 3 && z < H3.z + H3.rz + 9; // and its trees (the small wood's, its bushes, rocks and flowers too) not on the hill nor in front of it (the view)
    const f3 = on3 && s.id === 'fork', fore3 = (x, z) => f3 ? fore143(x, z) : fore(x, z); // 143 B the fork: no trees or bushes in its middle (the cottage, the wheel), no strewn rocks (heaps); low flowers stay
    const b3 = Z143 && s.id === 'sandbar', w3 = Z143 && s.id === 'falls', m3 = Z143 && s.id === 'mushroom' && Z.F.filter(f => f.zone === s.id && (f.t === 'house143' || f.t === 'glow143')); // q1: and none in front of the mushroom house or the glowing toadstools
    const d3 = Z143 && s.id === 'sled' && Z.F.find(f => f.zone === s.id && f.t === 'ramp'); // q1: and none on the sled hill's run, its steps or its run-out
    const e3 = Z143 && s.id === 'fernwood' && Z.F.filter(f => f.zone === s.id && (f.t === 'bigfern143' || f.t === 'bed143')), clear3 = (x, z) => e3.some(f => Math.hypot(x - f.x, z - f.z) < (f.bed ? 4.5 : 7)); // q1: a clearing round the giant fern and its leaf beds
    const fore4 = (x, z) => b3 ? sand143fore(x, z) : w3 ? falls143fore(x, z) : m3 ? m3.some(f => Math.abs(x - f.x) < 4.5 && z > (f.z ?? 61.5) - 2) : d3 ? Math.abs(x - d3.x) < 3 && z > d3.z0 - 1.5 && z < d3.z1 + 6 : e3 ? clear3(x, z) : fore3(x, z); // 143 B the sandbar: no bushes or strewn rocks in its middle; the falls: no trees either before the cliff
    // the zone's own things first (the mix fills round them)
    const own = {
      // 143 (?z143=1, zones.js flowerhill143): three rings of tall flower bushes round the hill (a green mound, its top all blooms:
      // yellow at the foot, pink, lavender near the top; r 0.95: walked round, up the mown lane), the big tree on the top with a
      // swing off a branch, beehives and a lantern, a basket of flowers, a low fence, heaps of half sunk stones, fireflies at night.
      // Its own stream (the strip's planting keeps rnd's)
      flowerhill() { if (!on3) return;
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), j3 = K3.jitter;
        const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), hill = one('hill'), lane = F.find(f => f.t === 'tint' && f.pts).pts, tr = one('tree143'), sw = one('swing143');
        K3.tree(tr.x, tr.z, tr.sc); occupied.at(-1).r = 1.0; // walked round close (its crown stays the camera's cover)
        { const y0 = heightAt(tr.x, tr.z) + 1.45 * tr.sc * NAT_K.tree, dx = sw.x - tr.x, dz = sw.z - tr.z, D = Math.hypot(dx, dz) + 0.45, ry = Math.atan2(-dz, dx), gs = heightAt(sw.x, sw.z), ay = Math.max(y0 + 0.1, gs + 2.3), up = Math.atan2(ay - y0, D);
          const b = new THREE.Group(); part(b, new THREE.CylinderGeometry(0.08, 0.15, Math.hypot(D, ay - y0), 8), '#9a6438', D / 2, (ay - y0) / 2 + 0.06, 0, { rz: up - Math.PI / 2 }); // the branch, out over the swing and up a little
          part(b, new THREE.SphereGeometry(0.32, 12, 9), '#7cbc40', D + 0.05, ay - y0 + 0.22, 0); put(b, tr.x, tr.z, ry, 0, y0); occupied.pop();
          const g = new THREE.Group(), pv = new THREE.Group(), lr = ay - gs - 0.5, rope = new THREE.CylinderGeometry(0.025, 0.025, lr, 6); g.position.set(sw.x, ay, sw.z); g.rotation.y = ry; g.add(pv); scene.add(g); // the swing: two ropes, a plank; sways (per build: freed with the scene)
          for (const x of [-0.33, 0.33]) part(pv, rope, '#efe2bf', x, -lr / 2, 0);
          part(pv, roundedBox(0.84, 0.08, 0.34, 0.03), '#c98c52', 0, -lr, 0); occupied.push({ x: sw.x, z: sw.z, r: 0.6, h: 1 });
          ups.push((t, ctx) => { pv.rotation.x = 0.07 * Math.sin(t * 1.4); const f = k === popK ? Math.max(1e-3, popIn(t)) : 1; if (f !== g.scale.x) { g.scale.setScalar(f); if (f === 1 && ctx) ctx.shade = true; } }); }
        { const f = one('hives'), g = new THREE.Group(), skep = lathe([[0, 0], [0.32, 0], [0.34, 0.1], [0.33, 0.2], [0.3, 0.3], [0.25, 0.4], [0.17, 0.48], [0.08, 0.53], [0, 0.55]], 18); // two straw skeps on a plank stand
          part(g, roundedBox(1.9, 0.08, 0.62, 0.03), '#b07a48', 0, 0.44, 0); for (const x of [-0.8, 0.8]) for (const z of [-0.22, 0.22]) part(g, roundedBox(0.09, 0.44, 0.09, 0.03), '#8a5a34', x, 0.22, z);
          const rid = [[0.13, 0.338], [0.26, 0.31], [0.38, 0.25], [0.47, 0.16]].map(([y, q]) => [y, new THREE.TorusGeometry(q, 0.024, 6, 22)]), door = new THREE.CircleGeometry(0.075, 12, 0, Math.PI);
          for (const x of [-0.55, 0.55]) { part(g, skep, '#e3a944', x, 0.48, 0); for (const [y, q] of rid) part(g, q, '#c98a2e', x, 0.48 + y, 0, { rx: Math.PI / 2 }); part(g, door, '#5a3a1e', x, 0.49, 0.345); }
          put(g, f.x, f.z, -0.3, 1.1, lowest(f.x, f.z, 0.9), 1.1); }
        { const f = one('lantern143'); fixture('lantern', f.x, f.z, 0, 0.35, undefined, 2).scale.setScalar(1.3); } // the hives' lantern (lit at night)
        { const f = one('basket'), g = new THREE.Group(), bl = new THREE.SphereGeometry(1, 10, 7); // a basket of picked flowers (the orchard's, full of blooms)
          part(g, lathe([[0, 0], [0.22, 0], [0.3, 0.08], [0.34, 0.26], [0.31, 0.29], [0.27, 0.22], [0, 0.22]], 18), '#c9965f'); part(g, new THREE.TorusGeometry(0.3, 0.03, 6, 16, Math.PI), '#b5863a', 0, 0.28, 0);
          for (const [x, y, z, c] of [[0, 0.33, 0, '#f59ac0'], [0.13, 0.3, 0.08, '#ffd84a'], [-0.13, 0.3, 0.06, '#fff4ea'], [0.06, 0.3, -0.13, '#b79cf0'], [-0.09, 0.3, -0.1, '#f59ac0'], [0.15, 0.29, -0.05, '#fff4ea']]) part(g, bl, c, x, y, z).scale.set(0.09, 0.07, 0.09);
          put(g, f.x, f.z, 0.5, 0.45, undefined, 0.6).scale.setScalar(1.4); }
        for (const f of F.filter(f => f.t === 'fence143')) { const g = new THREE.Group(), post = roundedBox(0.12, 0.8, 0.12, 0.04), P = []; // a low wooden fence, posts 1.25 apart, two rails
          for (let i = 1; i < f.pts.length; i++) { const a = f.pts[i - 1], b = f.pts[i], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.25)); for (let j = i > 1 ? 1 : 0; j <= n; j++) P.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
          P.forEach(([x, z], i) => { const y = heightAt(x, z); part(g, post, '#c88a4b', x, y + 0.36, z); occupied.push({ x, z, r: 0.3, h: 0.8 }); if (!i) return;
            const [x0, z0] = P[i - 1], y0 = heightAt(x0, z0), l = Math.hypot(x - x0, z - z0), ry = Math.atan2(-(z - z0), x - x0), rz = Math.atan2(y - y0, l);
            for (const h of [0.32, 0.62]) part(g, roundedBox(l + 0.1, 0.07, 0.05, 0.02), '#d9a05e', (x + x0) / 2, (y + y0) / 2 + h, (z + z0) / 2, { ry, rz }); });
          g.userData.zk = k; scene.add(g); fx.push(g); }
        heaps(F, r3, j3);
        const occ = [], bush = (x, z, c) => { const R = 0.68 + r3() * 0.1, y = lowest(x, z, 0.75 * R) + 0.5 * R, n0 = L.canopy.length; // a tall flower bush (1.2 m): a green mound under a dome of blooms
          L.canopy.push({ x, y, z, s: [R, 0.85 * R, R], c: j3('#5f9e35', 0.05) });
          for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + r3() * 0.5, el = 0.2 + r3() * 0.7; L.canopy.push({ x: x + Math.cos(a) * Math.cos(el) * R * 0.8, y: y + Math.sin(el) * R * 0.72, z: z + Math.sin(a) * Math.cos(el) * R * 0.8, s: R * (0.34 + r3() * 0.1), c: j3(c, 0.06) }); }
          L.canopy.push({ x, y: y + 0.8 * R, z, s: 0.42 * R, c: j3(c, 0.06) }); occ.push({ x, z, r: 0.95, h: 1.3, fade: [['canopy', n0, L.canopy.length - n0]] }); };
        for (const [q, c] of [[0.86, '#ffd84a'], [0.66, '#f59ac0'], [0.47, '#b79cf0']]) { const ds = a => q * Math.hypot(hill.rx * Math.sin(a), hill.rz * Math.cos(a)), a0 = r3() * 6.283; // bands round the hill, 1.35 m apart (the bands touch: the hill all flowers)
          for (let a = a0; a < a0 + 6.283 - 1.0 / ds(a); a += 1.35 / ds(a)) { const e = q + (r3() - 0.5) * 0.03, x = hill.x + Math.cos(a) * hill.rx * e, z = hill.z + Math.sin(a) * hill.rz * e;
            if (polyD(x, z, lane) > 2.0 && Math.hypot(x - sw.x, z - sw.z) > 1.5 && inRect(r, x, z, 0.7) && free(x, z, 0.1) && !nearSpot(x, z, 0.5)) bush(x, z, c); } }
        occupied.push(...occ); // after all three (the bands' bushes may touch; the rest keep clear of them)
        const ff = fireflies(scene, { walkable: () => true, heightAt }, 30, () => [hill.x + (r3() - 0.5) * 2 * hill.rx, hill.z + (r3() - 0.5) * 2 * hill.rz]); // over the flowers at night
        ups.push((t, ctx) => ff(t, ctx?.night ?? 0)); },
      // 143 (?z143=1, zones.js grove143): one big old tree (2.3, its trunk 1.15 x as thick) on the ground's gentle rise, sunk to
      // its lowest foot; four roots out of the trunk's foot lobes over the ground into it; a hollow in the trunk facing the view
      // (a glow and fireflies there at night); a bench, stumps, mushroom clusters, leaf piles, a heap of half sunk stones. The
      // native trees round it as before but none on the rise nor in front of it (the view: fore). Its own stream (rnd as before)
      grove() { if (on3) {
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), j3 = K3.jitter;
        const F = Z.F.filter(f => f.zone === s.id), all = t => F.filter(f => f.t === t), o = all('oak143')[0], sc = o.sc * NAT_K.tree, dr = o.door, B = '#9a6438';
        K3.tree(o.x, o.z, o.sc); occupied.at(-1).r = 3.4; // walked round past its roots (its crown stays the camera's cover)
        const LB = [dr + Math.PI / 4, dr - Math.PI / 4, dr + 3 * Math.PI / 4, dr - 3 * Math.PI / 4], y0 = Math.min(heightAt(o.x, o.z), ...LB.map(a => heightAt(o.x + Math.cos(a) * 3.6, o.z + Math.sin(a) * 3.6))) - 0.08;
        Object.assign(L.trunk.at(-1), { y: y0, s: [1.15 * sc, sc, 1.15 * sc], ry: Math.PI / 4 - dr }); // its foot lobes (partGeos) on the four roots, a hollow between two of them
        const g = new THREE.Group(), up = new THREE.Vector3(0, 1, 0), knob = new THREE.SphereGeometry(1, 12, 9);
        const seg = (a, b, r0, r1) => { const d = b.clone().sub(a), m = part(g, new THREE.CylinderGeometry(r1, r0, d.length(), 14), B, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.quaternion.setFromUnitVectors(up, d.normalize()); };
        for (const a of LB) { const c = Math.cos(a), sn = Math.sin(a), d = Math.cos(a - dr) > 0 ? 3.3 : 3.6, P = (q, y) => new THREE.Vector3(c * q, y, sn * q), gy = q => heightAt(o.x + c * q, o.z + sn * q) - y0; // a root: out of the trunk, over the ground, into it
          const A = P(0.7, 2.1), M = P(d, gy(d) + 0.32), E = P(d + 1.2, gy(d + 1.2) - 0.2);
          seg(A, M, 0.55, 0.36); seg(M, E, 0.36, 0.16); part(g, knob, B, M.x, M.y, M.z).scale.setScalar(0.37);
          occupied.push({ x: o.x + M.x, z: o.z + M.z, r: 0.6, h: 0.7 }, { x: o.x + (M.x + E.x) / 2, z: o.z + (M.z + E.z) / 2, r: 0.4, h: 0.4 }); }
        { const Y = heightAt(o.x + Math.cos(dr) * 2, o.z + Math.sin(dr) * 2) - y0 + 1.75, R = 1.15 * sc * (0.34 - 0.1 * (Y / sc - 0.3)), h = new THREE.Group(); // the hollow (its flat face: the lathe's 12 sides)
          h.position.set(Math.cos(dr) * R, Y, Math.sin(dr) * R); h.rotation.y = Math.PI / 2 - dr; g.add(h);
          part(h, new THREE.CircleGeometry(1, 24), '#2e1d10', 0, 0, 0.01, { rx: -0.1 }).scale.set(0.5, 0.66, 1);
          part(h, new THREE.TorusGeometry(1, 0.15, 8, 28), '#b07a48', 0, 0, 0.03, { rx: -0.1 }).scale.set(0.55, 0.72, 0.6);
          halo(h, '#ffd27a', 2.4, 0, 0, 0.35); // a soft glow in it at night
          const q = R + 1.2, hx = o.x + Math.cos(dr) * q, hz = o.z + Math.sin(dr) * q, ff = fireflies(scene, { walkable: () => true, heightAt }, 16, () => [hx + (r3() - 0.5) * 3, hz + (r3() - 0.5) * 3]);
          ups.push((t, ctx) => ff(t, ctx?.night ?? 0)); }
        put(g, o.x, o.z, 0, 0, y0, 1); occupied.pop(); g.userData.zk = 0; // with the tree (no pop on 129's opening: the tree has none)
        for (const f of all('bench143')) fixture('bench', f.x, f.z, Math.atan2(o.x - f.x, o.z - f.z), 1.0, undefined, 1.0); // looking at the old tree
        for (const f of all('stump143')) { L.trunk.push({ x: f.x, y: lowest(f.x, f.z, 0.5 * f.sc) - 0.05, z: f.z, s: [1.2 * f.sc, (0.26 + r3() * 0.1) * f.sc, 1.2 * f.sc], ry: r3() * 6, c: j3('#6e4a2e', 0.05) }); occupied.push({ x: f.x, z: f.z, r: 0.85 * f.sc, h: 0.7 }); }
        for (const f of all('shrooms143')) fixture('mushrooms', f.x, f.z, r3() * 6, 0.6, undefined, 0.5).scale.setScalar(1.3);
        const LEAF = ['#d9853b', '#c4622d', '#e0a840', '#b8662e'], ball = new THREE.SphereGeometry(1, 14, 9);
        for (const f of all('leaves143')) { const lg = new THREE.Group(); // a pile of fallen leaves: soft flat blobs, autumn colours
          for (let i = 0; i < 9; i++) { const a = i / 8 * 6.283 + r3() * 0.6, d = i ? 0.3 + r3() * 0.4 : 0, q = (i ? 0.3 : 0.5) + r3() * 0.08; part(lg, ball, LEAF[i % 4], Math.cos(a) * d, q * 0.08, Math.sin(a) * d).scale.set(q, q * 0.28, q * 0.85); }
          put(lg, f.x, f.z, r3() * 6, 0, lowest(f.x, f.z, 0.8 * f.sc), 0.4).scale.setScalar(f.sc); occupied.pop(); } // walked through
        heaps(F, r3, j3);
        const nk3 = kit(N.Ls, { rand: r3, heightAt, occupied });
        for (const [u, v] of [[0.3, 0.16], [0.65, 0.28], [0.3, 0.42], [0.35, 0.72], [0.7, 0.78], [0.4, 0.93]]) { const [cx, cz] = at(u, v); for (let i = 0; i < 4; i++) { const x = cx + (r3() - 0.5) * 3.2, z = cz + (r3() - 0.5) * 3.2; if (low(0.9, x, z) && !fore(x, z)) N.add('tree', nk3.tree, x, z, 0.95 + r3() * 0.4); } }
        return; }
        const [bx, bz] = at(0.55, 0.55); K.tree(bx, bz, 1.8); // the big old tree on its mossy rise
        for (const [u, v] of [[0.3, 0.16], [0.65, 0.28], [0.3, 0.42], [0.35, 0.72], [0.7, 0.78], [0.4, 0.93]]) { const [cx, cz] = at(u, v); for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.2, z = cz + (rnd() - 0.5) * 3.2; if (low(0.9, x, z)) tree(x, z, 0.95 + rnd() * 0.4); } }
        for (let i = 0; i < 3; i++) place(1, (x, z) => low(0.6, x, z), (x, z) => fixture('mushrooms', x, z, rnd() * 6, 0.6, undefined, 0.5)); },
      // 143 B (?z143=1, zones.js fork143): on the island between the arms a cottage (a stone foot down into the banks, cream walls,
      // its gable to the view, a red-brown roof, a chimney, windows lit at night), beside it in A a big waterwheel (R 2.5, the old
      // one's 1.8) turning with the stream on an axle from a stone pier on the island to a post on the far bank; four stepping
      // stones over B on the path (each one's top and whether it stands in the water written into the ford spots: walk.js hops
      // them), a little arched plank bridge over A, heaps of half sunk stones, reeds and lily pads in the pools, fireflies over the
      // water at night. Its own stream (the strip's planting keeps rnd's)
      fork() { if (on3) {
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), j3 = K3.jitter, R3 = kit(Lr, { rand: r3, heightAt, occupied });
        const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), [fA, fB] = Z.rills.filter(f => f.zone === s.id), wood = '#8a5a34', ball = new THREE.SphereGeometry(1, 10, 8);
        const lv = (f, x, z) => { let m = Infinity, q = null; const P = f.pts, w = f.w - 0.4; // a rill's water there (meadow/water.js: the lower waterline across at its nearest point, its own banks)
          for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1], dx = P[i][0] - ax, dz = P[i][1] - az, l = Math.hypot(dx, dz), e = Math.max(0, Math.min(l, ((x - ax) * dx + (z - az) * dz) / l)), px = ax + dx / l * e, pz = az + dz / l * e, d = Math.hypot(x - px, z - pz);
            if (d < m) { m = d; q = [[px - dz / l * w, pz + dx / l * w], [px + dz / l * w, pz - dx / l * w]]; } }
          const own = q.filter(([a, b]) => !otherWater(WA, f, a, b)); return Math.min(...(own.length ? own : q).map(([a, b]) => heightAt(a, b))) + 0.03; };
        { const c = one('cottage143'), g = new THREE.Group(), ph = new THREE.Shape(), fz = 1.4; // the cottage, its gable to the view (the front wall at z 1.38)
          part(g, roundedBox(4.3, 0.9, 3.1, 0.08), '#bdb6a9', 0, -0.3, 0, { mat: { roughness: 0.55 } }); // its stone foot
          [[-1.9, 0], [1.9, 0], [1.9, 2.0], [0, 3.2], [-1.9, 2.0]].forEach(([x, y], i) => i ? ph.lineTo(x, y) : ph.moveTo(x, y));
          part(g, new THREE.ExtrudeGeometry(ph, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }).translate(0, 0, -1.3), '#fff1d6', 0, 0.15, 0);
          for (const sg of [-1, 1]) part(g, roundedBox(2.75, 0.18, 3.2, 0.06), '#a9553a', sg * 1.04, 2.89, 0, { rz: -sg * 0.563 }); // the roof, over the walls' slope (1.2 up in 1.9)
          part(g, roundedBox(0.72, 1.3, 0.08, 0.03), '#9a5f3a', 0.75, 0.8, fz); part(g, ball, '#e8c35a', 0.98, 0.8, fz + 0.06).scale.setScalar(0.05); // the door
          part(g, roundedBox(0.78, 0.78, 0.06, 0.03), wood, -0.85, 1.35, fz); part(g, roundedBox(0.6, 0.6, 0.06, 0.02), '#ffd27a', -0.85, 1.35, fz + 0.02, { lit: true }); // a window (lit at night), its cross
          part(g, roundedBox(0.06, 0.6, 0.06, 0.02), wood, -0.85, 1.35, fz + 0.05); part(g, roundedBox(0.6, 0.06, 0.06, 0.02), wood, -0.85, 1.35, fz + 0.05); halo(g, '#ffd27a', 2.2, -0.85, 1.35, fz + 0.3);
          part(g, roundedBox(0.9, 0.16, 0.24, 0.04), '#b07a48', -0.85, 0.88, fz + 0.12); // its box of flowers
          for (const [x, cl] of [[-1.15, '#f59ac0'], [-0.94, '#ffd84a'], [-0.74, '#fff4ea'], [-0.55, '#f59ac0']]) part(g, ball, cl, x, 1.0, fz + 0.12).scale.setScalar(0.1);
          part(g, new THREE.CircleGeometry(0.28, 20), '#ffd27a', 0, 2.55, fz - 0.01, { lit: true }); part(g, new THREE.TorusGeometry(0.3, 0.05, 6, 20), wood, 0, 2.55, fz); // a round window up in the gable
          part(g, roundedBox(0.06, 0.66, 0.66, 0.03), wood, 1.99, 1.35, 0); part(g, roundedBox(0.06, 0.5, 0.5, 0.02), '#ffd27a', 2.01, 1.35, 0, { lit: true }); // one on the wheel's side
          part(g, roundedBox(0.42, 1.2, 0.42, 0.05), '#b5654a', -1.0, 3.05, -0.5); part(g, roundedBox(0.52, 0.12, 0.52, 0.04), '#9c5340', -1.0, 3.66, -0.5); // the chimney
          put(g, c.x, c.z, 0, 2.3, heightAt(c.x, c.z), 3.4); occupied.pop(); occupied.push({ x: c.x, z: c.z, r: 2.3, h: 3.4, box: [2.15, 1.55] }); }
        { const w = one('wheel143'), Rw = 2.5, hy = lv(fA, w.x, w.z) - 0.35 + Rw, wg = new THREE.Group(), sp = new THREE.Group(), kw = new THREE.Group(); // the waterwheel, its axle across A, its foot in the water
          wg.position.set(w.x, hy, w.z); wg.add(sp); scene.add(wg); // turns (per build: freed with the scene)
          for (const z of [-0.36, 0.36]) { part(kw, new THREE.TorusGeometry(Rw * 0.94, 0.09, 8, 48), '#a8703f', 0, 0, z); part(kw, new THREE.TorusGeometry(Rw * 0.5, 0.06, 6, 32), '#a8703f', 0, 0, z);
            for (let i = 0; i < 4; i++) part(kw, roundedBox(Rw * 1.88, 0.1, 0.1, 0.03), '#a8703f', 0, 0, z, { rz: i * Math.PI / 4 }); }
          for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; part(kw, roundedBox(0.72, 0.09, 0.86, 0.03), '#c98c52', Math.cos(a) * Rw * 0.84, Math.sin(a) * Rw * 0.84, 0, { rz: a }); } // the paddles
          part(kw, new THREE.CylinderGeometry(0.34, 0.34, 0.95, 16), '#7f7c79', 0, 0, 0, { rx: Math.PI / 2 });
          sp.add(mergeByMat([kw]));
          ups.push((t, ctx) => { sp.rotation.z = t * 0.45; const f = k === popK ? Math.max(1e-3, popIn(t)) : 1; if (f !== wg.scale.x) { wg.scale.setScalar(f); if (f === 1 && ctx) ctx.shade = true; } }); // its foot going with the stream
          const ax = new THREE.Group(), gp = lowest(w.x, w.z - 1.55, 0.4), gq = lowest(w.x, w.z + 1.45, 0.25); // the axle on a stone pier (the island's side) and a post
          part(ax, new THREE.CylinderGeometry(0.1, 0.1, 3.1, 10), '#7f7c79', 0, 0, -0.05, { rx: Math.PI / 2 });
          part(ax, roundedBox(0.8, hy - gp + 0.45, 0.8, 0.1), '#bdb6a9', 0, (gp - 0.15 + hy + 0.3) / 2 - hy, -1.55, { mat: { roughness: 0.55 } });
          part(ax, roundedBox(0.32, hy - gq + 0.3, 0.32, 0.06), wood, 0, (gq - 0.1 + hy + 0.2) / 2 - hy, 1.45);
          put(ax, w.x, w.z, 0, 0, hy, 0); occupied.pop(); }
        for (const p of F.find(f => f.t === 'spot' && f.act === 'ford').ford) { const [x, z] = p, wet = polyD(x, z, fB.pts) < fB.w - 0.4, top = wet ? Math.max(lv(fB, x, z) + 0.18, heightAt(x, z) + 0.1) : heightAt(x, z) + 0.1; // the stepping stones
          const sx = 0.5 + r3() * 0.12, sy = wet ? 1.3 : 0.45; slabs.push({ x, y: top - 0.48 * sy, z, s: [sx, sy, sx * (0.85 + r3() * 0.15)], ry: r3() * 6.283, c: j3('#b3ada1', 0.05) }); if (k === popK) pop.slabs.push(slabs.length - 1);
          p[2] = top; p[3] = wet ? 1 : 0; } // to both spots (the same stones)
        { const b = one('bridge143'), g = new THREE.Group(), L0 = Math.hypot(0.225, 1), ux = 0.225 / L0, uz = 1 / L0, Lb = 4.6, plank = roundedBox(1.3, 0.08, 0.4, 0.03), post = roundedBox(0.1, 0.7, 0.1, 0.03); // a little arched plank bridge over A, along the path
          const e0 = heightAt(b.x - ux * Lb / 2, b.z - uz * Lb / 2), e1 = heightAt(b.x + ux * Lb / 2, b.z + uz * Lb / 2), yAt = q => e0 + (e1 - e0) * (q / Lb + 0.5) + 0.5 * Math.sin((q / Lb + 0.5) * Math.PI) + 0.05; // q: along it from its middle
          const tilt = (q0, q1) => -Math.atan((yAt(q1) - yAt(q0)) / (q1 - q0));
          for (let i = 0; i < 11; i++) { const q = (i / 10 - 0.5) * (Lb - 0.4); part(g, plank, i % 2 ? '#c98c52' : '#b97d47', 0, yAt(q), q, { rx: tilt(q - 0.2, q + 0.2) }); }
          const Q = [-(Lb / 2 - 0.3), 0, Lb / 2 - 0.3];
          for (const x of [-0.6, 0.6]) Q.forEach((q, i) => { part(g, post, wood, x, yAt(q) + 0.38, q); if (i) { const q0 = Q[i - 1]; part(g, roundedBox(0.07, 0.07, q - q0 + 0.1, 0.02), '#a8703f', x, (yAt(q0) + yAt(q)) / 2 + 0.68, (q0 + q) / 2, { rx: tilt(q0, q) }); } });
          put(g, b.x, b.z, Math.atan2(ux, uz), 0, 0, 0); occupied.pop(); }
        heaps(F, r3, j3);
        for (const p of pools) { for (let i = 0; i < 7; i++) { const [x, z] = poolAt(p, (i + r3() * 0.5) / 7, wl(p) - 0.2 + r3() * 0.5); if (!otherWater(WA, p, x, z)) R3.tuft(x, z); } // reeds round the pools (not where the arm comes in)
          const y2 = waterAt(p); for (let i = 0; i < 4; i++) { const a = r3() * 6.28, d = r3() * (wl(p) - 0.8); pads.push({ x: p.x + Math.cos(a) * d, y: y2 + 0.015 + i * 0.004, z: p.z + Math.sin(a) * d, s: 0.6 + r3() * 0.45, ry: r3() * 6, c: j3('#5fa83e', 0.08) }); } }
        const ff = fireflies(scene, { walkable: () => true, heightAt }, 24, () => [-6 + r3() * 26, 45 + r3() * 8]); // over the water at night
        ups.push((t, ctx) => ff(t, ctx?.night ?? 0));
        return; }
        const f = Z.rills.find(q => q.zone === s.id), P = f.pts, w = f.w - 0.4;
        const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; };
        const water = (x, z, nx, nz) => Math.min(heightAt(x + nx * w, z + nz * w), heightAt(x - nx * w, z - nz * w)) + 0.03;
        { const [x, z] = P[4], [nx, nz] = nrm(P[3], P[5]); fixture('stepping', x, z, Math.atan2(-nz, nx), 0.4, water(x, z, nx, nz), 0.3).scale.setScalar(1.35); occupied.pop(); } // big stones across: walked over
        { const [nx, nz] = nrm(P[2], P[3]), px = (P[2][0] + P[3][0]) / 2, pz = (P[2][1] + P[3][1]) / 2, Rw = 1.8, cx = px - nx * 0.75, cz = pz - nz * 0.75, hy = water(px, pz, nx, nz) + Rw - 0.15;
          const wg = new THREE.Group(), k = new THREE.Group(), spin = new THREE.Group(); wg.position.set(cx, hy, cz); wg.rotation.y = Math.atan2(nx, nz); scene.add(wg); // a little wooden waterwheel, its axle across the stream
          for (const z of [-0.17, 0.17]) { part(k, new THREE.TorusGeometry(Rw * 0.86, 0.05, 6, 24), '#a8703f', 0, 0, z); for (let i = 0; i < 4; i++) part(k, roundedBox(Rw * 1.7, 0.05, 0.05, 0.02), '#a8703f', 0, 0, z, { rz: i * Math.PI / 4 }); }
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(k, roundedBox(0.5, 0.1, 0.42, 0.03), '#c98c52', Math.cos(a) * Rw * 0.78, Math.sin(a) * Rw * 0.78, 0, { rz: a }); }
          part(k, new THREE.CylinderGeometry(0.12, 0.12, 0.46, 12), '#8a5a34', 0, 0, 0, { rx: Math.PI / 2 });
          spin.add(mergeByMat([k])); wg.add(spin); ups.push(t => { spin.rotation.z = -t * 0.7; });
          const ax = new THREE.Group(), gy = heightAt(px - nx * 1.75, pz - nz * 1.75), hp = hy - gy + 0.2; // the axle out to a post on the far bank
          part(ax, new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), '#8a5a34', 0, 0, -0.75, { rx: Math.PI / 2 });
          part(ax, roundedBox(0.2, hp, 0.2, 0.05), '#8a5a34', 0, gy - hy + hp / 2 - 0.05, -1.0);
          put(ax, cx, cz, wg.rotation.y, 0.1, hy, 0.1); occupied.pop(); occupied.push({ x: px - nx * 1.75, z: pz - nz * 1.75, r: 0.35, h: hp });
        }
        for (let i = 0; i < 14; i++) { const j = Math.floor(rnd() * (P.length - 1)), [nx, nz] = nrm(P[j], P[j + 1]), t = rnd(), sg = rnd() < 0.5 ? -1 : 1, d = f.w + 0.3 + rnd() * 0.5;
          const x = P[j][0] + (P[j + 1][0] - P[j][0]) * t + nx * sg * d, z = P[j][1] + (P[j + 1][1] - P[j][1]) * t + nz * sg * d; if (free(x, z, 0.3) && !nearSpot(x, z, 0)) rock(x, z, 0.25 + rnd() * 0.3); } // pebbles on the gravel banks
        for (const p of pools) { ringOf(p, 5, wl(p) - 0.2, wl(p) + 0.3, (x, z) => R.tuft(x, z)); const y2 = waterAt(p); for (let i = 0; i < 4; i++) { const a = rnd() * 6.28, d = rnd() * (wl(p) - 0.8); pad(p.x + Math.cos(a) * d, y2, p.z + Math.sin(a) * d, i); } } },
      orchard() { // the trees in rows on the furrows (zones.js ORCHARD_ROWS), heavy with big fruit; a ladder and a basket in the lanes
        const OT = Z143 ? Z.F.filter(f => f.zone === s.id && f.t === 'otree143') : [];
        for (let z = -19 * S; z <= 29.1 * S; z += 4.8 * S) for (const c of ORCHARD_ROWS) { const x = r[0] + c, sc = 0.7; if (!free(x, z, 0)) continue; // inbox 42 C2: 0.58 -> 0.7 (x NAT_K.tree: 1.6H)
          const n0 = L.canopy.length, f0 = fruit.length; K.tree(x, z, sc, 5); const top = L.canopy[n0]; orchard.push({ x, z, y: top.y, fr: 1.7 * sc * NAT_K.tree }); // fr: past the crown's edge
          for (let j = 0; j < 5; j++) { const a = rnd() * 6.28, el = -0.1 + rnd() * 0.6, R2 = top.s[0] * 1.3; fruit.push({ x: x + Math.cos(a) * Math.cos(el) * R2, y: top.y + Math.sin(el) * R2 * 0.85, z: z + Math.sin(a) * Math.cos(el) * R2, s: 0.2, c: jitter('#e04a35', 0.06) }); }
          const ot = OT.find(f => Math.hypot(f.x - x, f.z - z) < 0.5); // q1: one shaken (its crown's blobs and fruit, below; its own footprint smaller: up to the trunk)
          if (ot) { occupied.at(-1).r = 0.75; shake.push({ f: ot, T: orchard.at(-1), k: 'canopy', c: [n0, L.canopy.length], q: [f0, fruit.length], b: new Map(), t0: null }); } }
        const lad = new THREE.Group(), lk = new THREE.Group(); lk.rotation.x = -0.32; lad.add(lk); // leaning into the tree behind it
        for (const x of [-0.22, 0.22]) part(lk, roundedBox(0.07, 2.0, 0.07, 0.03), '#b07a48', x, 1.0, 0);
        for (let i = 0; i < 5; i++) part(lk, roundedBox(0.44, 0.05, 0.05, 0.02), '#b07a48', 0, 0.3 + i * 0.35, 0);
        put(lad, 30 * S + 0.3, 5 * S + 1.25, 0, 0.4, undefined, 2); // inbox 42 A: just behind the tree at (30, 5) old metres
        const bk = new THREE.Group(), bx = 31.3 * S, bz = 12.2 * S;
        part(bk, lathe([[0, 0], [0.22, 0], [0.3, 0.08], [0.34, 0.26], [0.31, 0.29], [0.27, 0.22], [0, 0.22]], 18), '#c9965f');
        part(bk, new THREE.TorusGeometry(0.3, 0.03, 6, 16, Math.PI), '#b5863a', 0, 0.28, 0);
        put(bk, bx, bz, 0.6, 0.45, undefined, 0.6);
        for (const [dx, dz] of [[0, 0], [0.12, 0.1], [-0.12, 0.08], [0.02, -0.13]]) fruit.push({ x: bx + dx, y: heightAt(bx, bz) + 0.3 + (dx ? 0 : 0.08), z: bz + dz, s: 0.13, c: jitter('#e04a35', 0.06) });
        if (!Z143) return; // q1: wooden crates of apples in the lanes (one, two stacked, or two and one beside), on the zone's own stream
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter;
        const W = 0.64, D = 0.46, Hc = 0.36, crate = (g, x, y, z, ry, c) => { const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
          part(b, roundedBox(W, 0.04, D, 0.015), '#b8844f', 0, 0.02, 0);
          for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) part(b, roundedBox(0.055, Hc, 0.055, 0.02), '#a8743f', px * (W / 2 - 0.03), Hc / 2, pz * (D / 2 - 0.03));
          for (const y2 of [0.1, 0.27]) { for (const sz of [1, -1]) part(b, roundedBox(W, 0.12, 0.03, 0.012), '#c9965f', 0, y2, sz * (D / 2 - 0.012));
            for (const sx of [1, -1]) part(b, roundedBox(0.03, 0.12, D - 0.03, 0.012), '#c9965f', sx * (W / 2 - 0.012), y2, 0); }
          g.updateMatrixWorld(true); const v = new THREE.Vector3();
          for (let i = 0; i < 6; i++) { v.set((i % 3 - 1) * 0.19 + (r3() - 0.5) * 0.03, Hc - 0.02 + r3() * 0.03, (i < 3 ? -1 : 1) * 0.1).applyMatrix4(b.matrixWorld); fruit.push({ x: v.x, y: v.y, z: v.z, s: 0.105, c: j3(c, 0.06) }); }
          v.set((r3() - 0.5) * 0.2, Hc + 0.08, 0).applyMatrix4(b.matrixWorld); fruit.push({ x: v.x, y: v.y, z: v.z, s: 0.105, c: j3(c, 0.06) }); }; // one on top
        for (const f of Z.F.filter(q => q.zone === s.id && q.t === 'crates143')) { const g = new THREE.Group(), y = lowest(f.x, f.z, 0.45), ry = r3() * 6.283;
          g.position.set(f.x, y, f.z); g.rotation.y = ry;
          crate(g, 0, 0, 0, 0, '#e04a35'); if (f.n > 1) crate(g, 0.02, Hc + 0.005, 0.01, (r3() - 0.5) * 0.3, '#e8b23a'); if (f.n > 2) crate(g, W + 0.12, 0, 0.05, 0.2 + r3() * 0.2, '#9cc43c');
          g.position.set(0, 0, 0); g.rotation.y = 0; put(g, f.x, f.z, ry, f.n > 2 ? 0.95 : 0.55, y, f.n > 1 ? 0.8 : 0.4); } },
      lookout() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id); // on the flat top: a little gazebo and a telescope looking out
        fixture('gazebo', h.x, h.z - 0.8, 0, 2.1, undefined, 4.6).scale.setScalar(1.15); // inbox 42 C2: 0.85 -> 1.15 (hill and gazebo 3H)
        const tg = new THREE.Group(), leg = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 6);
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; part(tg, leg, '#8a5a34', Math.cos(a) * 0.14, 0.42, Math.sin(a) * 0.14, { rz: Math.cos(a) * 0.22, rx: -Math.sin(a) * 0.22 }); }
        part(tg, new THREE.SphereGeometry(0.07, 10, 8), '#5a4636', 0, 0.88, 0);
        const tilt = Math.PI / 2 - 0.3, ex = -Math.sin(tilt), ey = Math.cos(tilt);
        part(tg, new THREE.CylinderGeometry(0.1, 0.07, 0.8, 14), '#5a7fb0', 0, 0.98, 0, { rz: tilt });
        part(tg, new THREE.CylinderGeometry(0.108, 0.108, 0.08, 14), '#ffd54a', ex * 0.34, 0.98 + ey * 0.34, 0, { rz: tilt });
        put(tg, h.x + 1.0, h.z + 2.4, 0.5, 0.4, undefined, 1.2);
        if (Z143) { // q1 (zones.js lookout143): stone steps up the path's slope, a flag on the top, a lantern where the path comes up. Its own stream
          let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter;
          const one = t => Z.F.find(f => f.zone === s.id && f.t === t), pa = Z.paths.find(q => q.zone === s.id).pts;
          for (let i = 1; i < pa.length; i++) { const [ax, az] = pa[i - 1], [bx, bz] = pa[i], l = Math.hypot(bx - ax, bz - az); // a flat stone every 0.85 where it climbs, half sunk: a step
            for (let d = 0.4; d < l; d += 0.85) { const x = ax + (bx - ax) * d / l, z = az + (bz - az) * d / l, gy = heightAt(x, z), sl = Math.abs(heightAt(x, z + 0.4) - heightAt(x, z - 0.4)) / 0.8;
              if (sl < 0.12) continue; const sx = 0.42 + r3() * 0.06, sy = 0.16;
              slabs.push({ x, y: Math.max(lowest(x, z, 0.3), gy - 0.06) - 0.02, z, s: [sx, sy, 0.3 + r3() * 0.04], ry: Math.atan2(bx - ax, bz - az) + (r3() - 0.5) * 0.2, c: j3('#bdb6a9', 0.05) }); } }
          { const f = one('flag143'); pennant(f.x, f.z, r3() * 6); }
          { const f = one('lantern143'); fixture('lantern', f.x, f.z, 0, 0.35, undefined, 2).scale.setScalar(1.3); } } },
      mushroom() { const f = Z.paths.find(q => q.zone === s.id), zOf = x => { let zc = 0, best = 99; for (let z = r[2]; z < r[3]; z += 0.2) { const d = polyD(x, z, f.pts); if (d < best) { best = d; zc = z; } } return zc; };
        for (let x = r[0] + 3, i = 0; x < r[1] - 2; x += 6, i++) { // glowing toadstool lamps along the path, either side
          out: for (const sg of i % 2 ? [1, -1] : [-1, 1]) for (const dx of [0, 1, -1]) { const X = x + dx, z = zOf(X) + sg * (f.w + 0.9); if (!ok(X, z, 0.3)) continue; fixture('mushlamp', X, z, rnd() * 6, 0.5, undefined, 1.4).scale.setScalar(1.6); break out; } }
        const big = []; // q1: the giant toadstools [x, z, h]
        for (let x = r[0] + 4, j = 0; x < r[1] - 3; x += 7, j++) for (const dx of [0, 1.5, -1.5, 3]) { // giant toadstools, taller than the animals
          const X = x + dx, z = zOf(X) - (f.w + 2.6); if (!ok(X, z, 1.4)) continue; const hh = (4.4 + rnd() * 1.4) * (Z143 ? 1.15 : 1); put(bigShroom(hh, j % 2 === 0), X, z, rnd() * 6, 0.95, undefined, 4.4); // inbox 42 C2: x1.7 (1.5-2H)
          if (Z143) { occupied.at(-1).cover = { y: 0.72 * hh - 0.05, core: 0.12 * hh, r: 0.5 * hh }; big.push([X, z, hh]); } break; } // q1: a rain shelter (its cap: walk.js shelter; core: the stem at body height). x1.15: a pig or a sheep fits under most, a horse under the tallest
        if (!Z143) return; // q1 (zones.js mushroom143): a door and a lit window in one toadstool's stem, two big glowing toadstools to lie round at night, stumps, rings, leaves. Its own stream
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter;
        const all = t => Z.F.filter(q => q.zone === s.id && q.t === t), hx = all('house143')[0].x;
        if (big.length) { const [X, Z0, hh] = big.reduce((a, b) => Math.abs(b[0] - hx) < Math.abs(a[0] - hx) ? b : a), sr = 0.11 * hh, g = new THREE.Group(), R1 = sr * 1.22, R2 = sr * 1.03, gy = heightAt(X, Z0 + R1 + 0.2), y0 = heightAt(X, Z0) - gy; // the house: faces the view (+z) whatever the stem's turn; y0: the stem's foot over the door's
          const cap = new THREE.CapsuleGeometry(1, 1, 4, 14), ball = new THREE.SphereGeometry(1, 14, 10);
          part(g, cap, '#c9965f', 0, 0.43, R1 - 0.03).scale.set(0.33, 0.32, 0.08); // the frame, the door in it (a round topped plank door), a gold knob
          part(g, cap, '#8a5a34', 0, 0.42, R1 + 0.01).scale.set(0.27, 0.26, 0.07);
          part(g, ball, '#ffd54a', 0.14, 0.42, R1 + 0.08).scale.setScalar(0.04);
          part(g, ball, '#ffd27a', 0, y0 + 2.0, R2, { lit: true }).scale.set(0.17, 0.17, 0.05); // a round window, lit by night
          part(g, new THREE.TorusGeometry(0.17, 0.035, 8, 20), '#8a5a34', 0, y0 + 2.0, R2 + 0.02);
          part(g, ball, '#b8b2a6', 0, 0.02, R1 + 0.42).scale.set(0.34, 0.07, 0.24); // a step stone
          put(g, X, Z0, 0, 0, gy - 0.02); occupied.pop(); }
        for (const q of all('glow143')) fixture('mushlamp', q.x, q.z, r3() * 6, 0.6, undefined, 2.2).scale.setScalar(3.2); // lie round them at night (under the cap's rim)
        for (const q of all('stump143')) { L.trunk.push({ x: q.x, y: lowest(q.x, q.z, 0.5 * q.sc) - 0.05, z: q.z, s: [1.2 * q.sc, (0.26 + r3() * 0.1) * q.sc, 1.2 * q.sc], ry: r3() * 6, c: j3('#6e4a2e', 0.05) }); occupied.push({ x: q.x, z: q.z, r: 0.85 * q.sc, h: 0.7 }); }
        for (const q of all('shrooms143')) fixture('mushrooms', q.x, q.z, r3() * 6, 0.6, undefined, 0.5).scale.setScalar(1.3);
        const LEAF = ['#d9853b', '#c4622d', '#e0a840', '#b8662e'], ball = new THREE.SphereGeometry(1, 14, 9);
        for (const q of all('leaves143')) { const lg = new THREE.Group(); // a pile of fallen leaves (as the grove's), walked through
          for (let i = 0; i < 9; i++) { const a = i / 8 * 6.283 + r3() * 0.6, d = i ? 0.3 + r3() * 0.4 : 0, w = (i ? 0.3 : 0.5) + r3() * 0.08; part(lg, ball, LEAF[i % 4], Math.cos(a) * d, w * 0.08, Math.sin(a) * d).scale.set(w, w * 0.28, w * 0.85); }
          put(lg, q.x, q.z, r3() * 6, 0, lowest(q.x, q.z, 0.8 * q.sc), 0.4).scale.setScalar(q.sc); occupied.pop(); } },
      reeds() { if (Z143) return reeds143z(); for (const f of Z.rills.filter(q => q.zone === s.id)) for (let i = 1; i < f.pts.length; i++) { // reeds thick along every channel
          const a = f.pts[i - 1], b = f.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
          for (let d = 0; d < l; d += 0.6) for (const sg of [-1, 1]) { if (rnd() < 0.25) continue; const e = f.w - 0.25 + rnd() * 0.3, x = a[0] + dx / l * d + nx * sg * e, z = a[1] + dz / l * d + nz * sg * e; if (!nearSpot(x, z, 0.2)) R.tuft(x, z); } }
        place(40, (x, z) => ok(x, z, 0.3) && Z.wd(x, z) < 2.6, (x, z) => R.tuft(x, z)); },
      // 143 B (?z143=1, zones.js falls143): the cliff and its shoulder (no one climbs), stones round their feet and the pool's rim
      // (none on the fall), a mossy lip out of the cliff's front with a thin stream off it to stand under (spot shower), the
      // landing's spray bigger, a little rainbow over the pool on a clear day, heaps of stones, bushes and tufts. Its own stream
      falls() { if (Z143) {
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), R3 = kit(Lr, { rand: r3, heightAt, occupied });
        const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), hs = F.filter(f => f.t === 'hill'), p = pools[0], fl = Z.falls.find(q => q.zone === s.id), dry = (x, z, m) => polyD(x, z, [fl.from, fl.to]) > m;
        for (const h of hs) occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h });
        const lp = one('lip143'), [tx, tz] = lp.to, j3 = K3.jitter, out = Z.spots.find(q => q.zone === s.id && q.act === 'spray'), sh = (x, z) => polyD(x, z, [[tx, tz], [out.x, out.z]]) > 1.2; // the shower's corner and the way out of it stay open
        hs.forEach((h, j) => { for (let i = 0, n = j ? 7 : 14; i < n; i++) { const a = i / n * 6.283 + r3() * 0.3, x = h.x + Math.cos(a) * h.rx * 1.02, z = h.z + Math.sin(a) * h.rz * 0.98;
          if (ok(x, z, 0.4) && dry(x, z, 1.4) && sh(x, z)) { rock(x, z, 0.55 + r3() * 0.6); if (k === popK) pop.rocks.push(L.rock.length - 1); } } }); // round the cliff's feet, bigger than the old
        ringOf(p, 7, wl(p) + 0.1, wl(p) + 0.7, (x, z) => { if (free(x, z, 0.3) && dry(x, z, 1.2) && sh(x, z)) { rock(x, z, 0.3 + r3() * 0.3); if (k === popK) pop.rocks.push(L.rock.length - 1); } }); // the rim
        { const gy = heightAt(tx, tz), H0 = 2.55, D = Math.hypot(tx - lp.x, tz - lp.z), g = new THREE.Group(), moss = '#6b9640', st = '#8e8a80'; // the lip: a flat stone out of the cliff over the corner, moss on it, held on two stacked ones
          part(g, slabGeo(), st, -D * 0.8 - 0.3, H0 + 0.17, 0).scale.set(D * 0.8 + 0.55, 0.4, 0.9); // its back end deep in the cliff
          part(g, new THREE.SphereGeometry(1, 16, 9), moss, -D * 0.6 - 0.1, H0 + 0.4, 0).scale.set(D * 0.6 + 0.3, 0.1, 0.7);
          for (const [x, y, z, sc] of [[-0.3, H0 + 0.44, 0.5, 0.17], [-0.7, H0 + 0.44, -0.5, 0.14]]) part(g, new THREE.SphereGeometry(1, 10, 7), moss, x, y, z).scale.set(sc, sc * 0.7, sc); // moss over its edge
          for (const [y, a] of [[0.35, 1.0], [1.2, 0.86], [2.05, 0.74]]) part(g, slabGeo(), st, -D * 0.9 - 0.25, y, 0, { ry: y }).scale.set(a, 0.9, a); // the stones it rests on, stacked against the cliff
          part(g, new THREE.CylinderGeometry(0.11, 0.16, H0 + 0.05, 10, 1, true), null, 0.05, (H0 + 0.05) / 2, 0, { m: flowMat(1) }); // the stream off its tip, down to the ground (an animal under it hides its middle)
          put(bake(g), tx, tz, Math.atan2(-(tz - lp.z), tx - lp.x), 0, gy, 0); occupied.pop(); occupied.push({ x: lp.x, z: lp.z, r: 0.9, h: 3 });
          spray(tx, gy, tz, 10, 0.75); }
        { const dx = fl.from[0] - p.x, dz = fl.from[1] - p.z, l = Math.hypot(dx, dz); spray(p.x + dx / l * (wl(p) - 0.3), waterAt(p), p.z + dz / l * (wl(p) - 0.3), 20, 1.5); } // the landing: bigger
        { const b = one('bow143'), m = rainbowMesh(), R0 = 2.7; m.position.set(b.x, waterAt(p) - 0.15, b.z); m.rotation.y = 0.25; scene.add(m); // a small bow in the spray, turned to face the camera (ctx.az) (per build: freed with the scene)
          let w = 1, tw = -9; ups.push((t, ctx) => { if (t - tw > 1) { tw = t; const q = weatherNow(hab); w = 1 - Math.max(q.rain, q.fog, q.snow); } // a clear day's (looked at once a second)
            const f = k === popK ? popIn(t) : 1, a = 1.6 * w * f * (1 - (ctx?.night ?? 0)); m.visible = a > 0.01; if (ctx?.az != null) m.rotation.y = Math.PI / 2 - ctx.az; m.scale.setScalar(R0 * Math.max(1e-3, f)); m.material.uniforms.uBow.value = a; }); }
        heaps(F, r3, j3);
        for (const [x, z, sc] of [[-38.6, -9.4, 1.0], [-27.6, -14.2, 0.9], [-38.2, 0.8, 0.85], [-27.4, 0.6, 0.8]]) if (free(x, z, 0.6)) K3.bush(x, z, sc); // bushes at the corners
        ringOf(p, 9, wl(p) - 0.3, wl(p) + 0.3, (x, z) => { if (dry(x, z, 1.2)) R3.tuft(x, z); });
        return; }
        const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id); occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h }); // inbox 42 C2: no one climbs the 11 m cliff (the camera keeps out too)
        for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + rnd() * 0.3, x = h.x + Math.cos(a) * h.rx * 1.02, z = h.z + Math.sin(a) * h.rz * 0.98; if (free(x, z, 0.4) && !nearSpot(x, z, 0.3)) rock(x, z, 0.5 + rnd() * 0.5); }
        for (const p of pools) { ringOf(p, 4, wl(p) + 0.1, wl(p) + 0.6, (x, z) => { if (free(x, z, 0.3)) rock(x, z, 0.3 + rnd() * 0.25); });
          const fl = Z.falls.find(q => q.zone === s.id), dx = fl.from[0] - p.x, dz = fl.from[1] - p.z, l = Math.hypot(dx, dz); spray(p.x + dx / l * (wl(p) - 0.3), waterAt(p), p.z + dz / l * (wl(p) - 0.3)); } },
      // 143 B (?z143=1, zones.js sandbar143): a big driftwood log up the dune's west shoulder (a trumpet foot, two low roots, two
      // broken limbs, a darker heart on the break), a parasol leaf on a tall stem on the dune's top, a sandcastle by the tide pool (three bucket towers, a
      // wall and door, a little flag), three small heaps of shells, a heap of half sunk stones and a few tufts at the pool. Each
      // fixture's parts baked to one vertex-colour mesh (meadow/props.js bake: all of them about one draw). Its own stream
      sandbar() { if (Z143) {
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter, R3 = kit(Lr, { rand: r3, heightAt, occupied });
        const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), ball = new THREE.SphereGeometry(1, 14, 10), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
        const aim = (m, x, y, z) => { m.quaternion.setFromUnitVectors(Y, v.set(x, y, z).normalize()); return m; };
        { const d = one('drift143'), [bx, bz] = d.to, Ld = Math.hypot(bx - d.x, bz - d.z), ya = heightAt(d.x, d.z) + 0.35, yb = heightAt(bx, bz) + 0.3, wd = '#bfb09a', kn = '#8f7a5c';
          const g = new THREE.Group(), tr = new THREE.Group(), r1 = Ld - 0.02; tr.rotation.z = Math.atan2(yb - ya, Ld); g.add(tr); // along tr's x, from its foot up the shoulder
          part(tr, lathe([[0, 0], [0.82, 0.02], [0.86, 0.12], [0.7, 0.4], [0.6, 0.9], [0.56, 2.4], [0.57, 3.2], [0.47, 5], [0.4, Ld - 0.3], [0.36, Ld - 0.05], [0.31, Ld], [0, Ld]], 16), wd, 0, 0, 0, { rz: -Math.PI / 2 }); // a trumpet foot like the meadow trees', a swell in its middle, its far end broken off flat
          part(tr, new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), kn, r1, 0, 0, { rz: -Math.PI / 2 }); // the darker heart on the break
          for (const z of [0.75, -0.75]) { v.set(-0.75, -0.3, z).normalize(); aim(part(tr, new THREE.CapsuleGeometry(0.2, 0.55, 3, 10), wd, v.x * 0.55, -0.15 + v.y * 0.55, v.z * 0.55), v.x, v.y, v.z); } // two roots back from its foot, low on the sand
          for (const [x, l, dx, dy, dz] of [[2.6, 1.1, 0.7, 0.75, 0.3], [4.6, 0.9, 0.8, 0.15, -0.6]]) { v.set(dx, dy, dz).normalize(); aim(part(tr, new THREE.CylinderGeometry(0.11, 0.17, l, 10), wd, x + v.x * l / 2, v.y * l / 2, v.z * l / 2), v.x, v.y, v.z); } // two broken limbs, one up, one out along the sand
          put(bake(g), d.x, d.z, Math.atan2(-(bz - d.z), bx - d.x), 0, ya, 0); occupied.pop();
          for (let u = 0; u <= Ld; u += 1.2) occupied.push({ x: d.x + (bx - d.x) * u / Ld, z: d.z + (bz - d.z) * u / Ld, r: 0.65, h: 0.9 }); }
        { const p = one('parasol143'), g = new THREE.Group(), b = new THREE.Group(), H0 = 2.4, ln = 0.1, L = H0 + 0.75; // the parasol leaf: a domed lens (shut, so one side), a paler midrib along its top
          part(g, new THREE.CylinderGeometry(0.08, 0.12, L, 10), '#6aa23e', Math.sin(ln) * (L / 2 - 0.3), Math.cos(ln) * (L / 2 - 0.3), 0, { rz: -ln });
          b.position.set(Math.sin(ln) * H0, Math.cos(ln) * H0, 0); b.rotation.set(0.15, 0, -0.06); g.add(b);
          part(b, lathe([[0, 0.42], [0.5, 0.32], [0.85, 0.08], [1, -0.14], [0.97, -0.07], [0.85, 0.16], [0.5, 0.43], [0, 0.54]], 24), '#7cbf4a').scale.set(1.7, 1, 1.3); // domed, its rim drooping
          const R = 2.94, arc = 2 * Math.asin(1.4 / R); part(b, new THREE.TorusGeometry(R, 0.035, 5, 24, arc), '#b9e07a', 0, 0.55 - R, 0, { rz: Math.PI / 2 - arc / 2 });
          aim(part(b, new THREE.ConeGeometry(0.11, 0.36, 8), '#7cbf4a', 1.74, -0.19, 0), 1, -0.5, 0); // its tip
          put(bake(g), p.x, p.z, 0.25, 0.4, heightAt(p.x, p.z), 2.9); }
        { const c = one('castle143'), g = new THREE.Group(), sa = '#d9b97c', sb = '#e2c48a', tw = new THREE.CylinderGeometry(0.3, 0.38, 1, 14), mer = roundedBox(0.13, 0.13, 0.13, 0.03); // the sandcastle, its door to the view
          part(g, lathe([[0, 0], [1.25, 0], [1.2, 0.12], [0.95, 0.26], [0, 0.3]], 20), sa, 0, -0.08, 0);
          for (const [x, z, h] of [[0, -0.35, 1.05], [-0.6, 0.25, 0.7], [0.6, 0.25, 0.7]]) { part(g, tw, sb, x, 0.2 + h / 2, z).scale.y = h; // bucket towers, merlons round their tops
            for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4; part(g, mer, sb, x + Math.cos(a) * 0.24, 0.26 + h, z + Math.sin(a) * 0.24, { ry: -a }); } }
          part(g, roundedBox(1.1, 0.42, 0.24, 0.05), sb, 0, 0.4, 0.25); part(g, roundedBox(0.26, 0.32, 0.05, 0.03), '#9c7a50', 0, 0.36, 0.38); // the wall, its door
          part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), '#a07848', 0, 1.52, -0.35); part(g, new THREE.ConeGeometry(0.14, 0.32, 3), '#f07a6a', 0.17, 1.68, -0.35, { rz: -Math.PI / 2 }).scale.z = 0.3; // the flag
          put(bake(g), c.x, c.z, -0.15, 1.2 * c.sc, lowest(c.x, c.z, 1), 1.3).scale.setScalar(c.sc); }
        const pal = ['#f4b9ad', '#fbe9d2', '#f3cfa6'], cone = lathe([[0, 0], [0.05, 0.04], [0.11, 0.12], [0.14, 0.2], [0.12, 0.27], [0.07, 0.34], [0.03, 0.42], [0, 0.47]], 12);
        for (const f of F.filter(f => f.t === 'shells143')) { const g = new THREE.Group(), c0 = Math.floor(r3() * 3); // a scallop or two and a conch, walked over
          for (const [x, z, sc, i] of [[0, 0, 1.25, 0], [0.42, 0.22, 1, 1]]) { const q = new THREE.Group(); q.position.set(x, 0, z); q.rotation.y = r3() * 6.283; q.scale.setScalar(sc); g.add(q);
            for (let j = -2; j <= 2; j++) part(q, ball, pal[(c0 + i) % 3], Math.sin(j * 0.32) * 0.1, 0.035, Math.cos(j * 0.32) * 0.1, { ry: j * 0.32 }).scale.set(0.05, 0.045, 0.13);
            part(q, roundedBox(0.14, 0.05, 0.06, 0.02), pal[(c0 + i) % 3], 0, 0.025, -0.02); }
          part(g, cone, pal[(c0 + 2) % 3], -0.42, 0.11, 0.24, { rz: -Math.PI / 2, ry: r3() }); part(g, ball, '#f4b9ad', -0.22, 0.12, 0.33).scale.set(0.1, 0.06, 0.05);
          put(bake(g), f.x, f.z, r3() * 6.283, 0, heightAt(f.x, f.z), 0).scale.setScalar(1.4); occupied.pop(); }
        heaps([{ t: 'heap143', x: 13.4, z: 47.0, sc: 0.7 }], r3, j3); // stones at the tide pool's back, tufts at its side
        for (const a of [0.3, 0.9, -0.4]) R3.tuft(13 + Math.cos(a) * 2.2, 49.4 + Math.sin(a) * 2.2);
        return; }
        for (let i = 0; i < 3; i++) place(1, (x, z) => ok(x, z, 1.1), (x, z) => put(drift(), x, z, rnd() * 6, 0.9, heightAt(x, z) - 0.04, 0.5)); // bleached driftwood
        for (let i = 0; i < 30; i++) { const [x, z] = at(0.12 + rnd() * 0.76, 0.05 + rnd() * 0.9); if (free(x, z, 0) && !nearSpot(x, z, -0.4)) shells.push({ x, y: heightAt(x, z) + 0.01, z, s: [0.2 + rnd() * 0.08, 0.08, 0.17 + rnd() * 0.06], ry: rnd() * 6, c: pickOf(['#f6c9c0', '#fff1df', '#f3d9b8', '#f2b8a8']) }); }
        for (let i = 0; i < 70; i++) { const [x, z] = at(0.15 + rnd() * 0.7, 0.05 + rnd() * 0.9); if (free(x, z, 0)) L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.14 + rnd() * 0.14, 0.07, 0.12 + rnd() * 0.1], ry: rnd() * 6, c: jitter(pickOf(['#d8cfb8', '#c9b991', '#b7c2bc', '#efe4c8']), 0.08) }); }
        for (const p of pools) ringOf(p, 3, wl(p) - 0.3, wl(p) + 0.2, (x, z) => R.tuft(x, z)); },
      // 143 B (?z143=1, zones.js lotus143): three giant pads, their rims turned up (one instanced mesh: each floats on the water and
      // sinks a little under a turtle on it, P.dip: walk.js; up out of the water on the reveal), lotus flowers standing on stems
      // and two buds (baked: about one draw), small pads, reeds at the pond's two ends, a little arched plank bridge across its
      // middle, two heaps of half sunk stones, fireflies over the water at night. Its own stream
      lotus() { if (Z143) {
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter, R3 = kit(Lr, { rand: r3, heightAt, occupied });
        const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), P = pools[0], y0 = waterAt(P), w = wl(P), G = F.filter(f => f.t === 'gpad143'), b = one('bridge143');
        const clear = (x, z, m) => G.every(g => Math.hypot(x - g.x, z - g.z) > g.r + m) && Math.abs(z - b.z) > 0.9 + m;
        { const geo = lathe([[0, -0.02], [0.92, -0.02], [1.02, 0.04], [1.04, 0.13], [1, 0.14], [0.96, 0.05], [0.9, 0.03], [0, 0.03]], 40); // the giant pads (per build: freed with the scene)
          const Q = G.map(g => { g.y = y0 + 0.06; g.dip = 0; return { x: g.x, y: y0 + 0.03, z: g.z, s: [g.r, 1, g.r], ry: r3() * 6.283, c: j3('#5aa23a', 0.05), g, d: -1, f: k === popK ? 0 : 1 }; });
          const im = instanced(geo, toyMat('#ffffff', { roughness: 0.4 }), Q, { cast: false }); scene.add(im);
          ups.push(t => { let ch = false; Q.forEach((q, i) => { const f = k === popK && pop.t0 != null ? easeB(Math.max(0, (t - pop.t0 - 1.0 - 0.25 * i) / 0.5)) : q.f; if (f === q.f && q.g.dip === q.d) return; q.f = f; q.d = q.g.dip; ch = true;
            _e.set(0, q.ry, 0); im.setMatrixAt(i, _m.compose(_p.set(q.x, q.y - q.d, q.z), _q.setFromEuler(_e), _s.set(q.s[0] * Math.max(1e-3, f), 1, q.s[2] * Math.max(1e-3, f)))); }); if (ch) im.instanceMatrix.needsUpdate = true; }); }
        const pet = new THREE.SphereGeometry(1, 10, 7), lotusF = (x, z, c, h, sc) => { const g = new THREE.Group(); // a cup of petals on a stem (two rings, the inner more upright), a yellow seed head
          part(g, new THREE.CylinderGeometry(0.03, 0.035, h, 6), '#5d9a3a', 0, h / 2, 0);
          for (const [n, tl, rr, cc] of [[8, 0.75, 0.13, c], [6, 0.35, 0.07, '#fde3ec']]) for (let i = 0; i < n; i++) { const a = (i + (n === 6 ? 0.5 : 0)) / n * 6.283, q = new THREE.Group(); q.rotation.y = -a; q.position.y = h; g.add(q);
            const m = part(q, pet, cc, rr, 0.14, 0, { rz: -tl }); m.scale.set(0.07, 0.2, 0.11); }
          part(g, new THREE.CylinderGeometry(0.09, 0.06, 0.08, 10), '#f2c94c', 0, h + 0.1, 0);
          put(bake(g), x, z, r3() * 6.283, 0, y0, 0).scale.setScalar(sc); occupied.pop(); };
        const bud = (x, z, h) => { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.025, 0.03, h, 6), '#5d9a3a', 0, h / 2, 0); part(g, new THREE.SphereGeometry(1, 10, 8), '#f49ac0', 0, h + 0.12, 0).scale.set(0.09, 0.16, 0.09);
          put(bake(g), x, z, 0, 0, y0, 0); occupied.pop(); };
        const inW = (m) => { for (let i = 0; i < 40; i++) { const [x, z] = poolAt(P, r3(), r3() * (w - m)); if (clear(x, z, 0.5)) return [x, z]; } return null; };
        for (let i = 0; i < 7; i++) { const p = inW(0.7); if (p) lotusF(p[0], p[1], i % 3 === 2 ? '#fff4f0' : '#f49ac0', 0.3 + r3() * 0.3, 1.3 + r3() * 0.4); }
        for (let i = 0; i < 2; i++) { const p = inW(0.7); if (p) bud(p[0], p[1], 0.45 + r3() * 0.2); }
        for (let i = 0; i < 18; i++) { const p = inW(0.5); if (!p) continue; pads.push({ x: p[0], y: y0 + 0.015 + (i % 6) * 0.004, z: p[1], s: 0.7 + r3() * 0.5, ry: r3() * 6, c: j3('#5fa83e', 0.08) });
          if (i < 4) { L.petal.push({ x: p[0], y: y0 + 0.13, z: p[1], s: 2.1, ry: r3(), c: '#f7a8c4' }); L.centre.push({ x: p[0], y: y0 + 0.17, z: p[1], s: 1.5, c: '#ffd447' }); } }
        for (let i = 0; i < 26; i++) { const [x, z] = poolAt(P, r3(), w - 0.3 + r3() * 0.7); if (Math.abs(z - P.z) > P.len / 2 - 3) R3.tuft(x, z); } // reeds at its two ends
        { const g = new THREE.Group(), Lb = 7.4, n = 18, plank = roundedBox(1.3, 0.08, Lb / n + 0.02, 0.03), post = roundedBox(0.1, 0.7, 0.1, 0.03), wood = '#9a6438'; // the bridge, along x (q: along it from its middle)
          const e0 = heightAt(b.x - Lb / 2, b.z), e1 = heightAt(b.x + Lb / 2, b.z), yAt = q => e0 + (e1 - e0) * (q / Lb + 0.5) + 0.75 * Math.sin((q / Lb + 0.5) * Math.PI) + 0.05;
          const tilt = (q0, q1) => -Math.atan((yAt(q1) - yAt(q0)) / (q1 - q0));
          for (let i = 0; i <= n; i++) { const q = (i / n - 0.5) * (Lb - 0.4); part(g, plank, i % 2 ? '#c98c52' : '#b97d47', 0, yAt(q), q, { rx: tilt(q - 0.2, q + 0.2) }); }
          const Q = [-(Lb / 2 - 0.3), -Lb / 4, 0, Lb / 4, Lb / 2 - 0.3];
          for (const x of [-0.6, 0.6]) Q.forEach((q, i) => { part(g, post, wood, x, yAt(q) + 0.38, q); if (i) { const q0 = Q[i - 1]; part(g, roundedBox(0.07, 0.07, q - q0 + 0.1, 0.02), '#a8703f', x, (yAt(q0) + yAt(q)) / 2 + 0.68, (q0 + q) / 2, { rx: tilt(q0, q) }); } });
          put(g, b.x, b.z, Math.PI / 2, 0, 0, 0); occupied.pop(); for (const sg of [-1, 1]) occupied.push({ x: b.x + sg * (Lb / 2 - 0.4), z: b.z, r: 1.0, h: 1 }); } // its ends: walked round
        heaps(F, r3, j3);
        const ff = fireflies(scene, { walkable: () => true, heightAt }, 16, () => [P.x + (r3() - 0.5) * 7, P.z + (r3() - 0.5) * P.len]); // over the water at night
        ups.push((t, ctx) => ff(t, ctx?.night ?? 0));
        return; }
        for (const p of pools) { const y = waterAt(p), w = wl(p); // one big pond full of pads and flowers
        for (let i = 0; i < 60; i++) { const a = rnd() * 6.28, d = rnd() * (w - 0.6), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d + (rnd() - 0.5) * (p.len || 0); pad(x, y, z, i);
          if (i < 20) { L.petal.push({ x, y: y + 0.12, z, s: 2.1, ry: rnd(), c: pickOf(['#f7a8c4', '#fff4f0', '#f49ac0']) }); L.centre.push({ x, y: y + 0.16, z, s: 1.5, c: '#ffd447' }); } }
        ringOf(p, 20, w - 0.2, w + 0.3, (x, z) => R.tuft(x, z)); } },
      isle() { const p = pools.find(q => q.isle), [a, b] = p.spit, L0 = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0, ry = Math.atan2(-uz, ux), planks = [], posts = [];
        for (let d = (p.ilen || 0) / 2 + p.isle - 0.1, i = 0; d < L0 - 0.2; d += 0.36, i++) { const x = a[0] + ux * d, z = a[1] + uz * d, y = heightAt(x, z); planks.push({ x, y: y + 0.06, z, ry: ry + Math.PI / 2 + (rnd() - 0.5) * 0.08, c: jitter('#b57a45', 0.06) });
          if (i % 4 === 0) for (const sg of [-1, 1]) posts.push({ x: x - uz * sg * 0.6, y: y + 0.25, z: z + ux * sg * 0.6, c: '#8a5a34' }); } // a long bridge, posts along it
        scene.add(instanced(new THREE.BoxGeometry(1.25, 0.1, 0.28), toyMat('#ffffff', { roughness: 0.55 }), planks));
        if (posts.length) scene.add(instanced(roundedBox(0.1, 0.5, 0.1, 0.03), toyMat('#ffffff', { roughness: 0.6 }), posts));
        const iz = p.iz ?? p.z; K.bush(p.x - 0.95, iz + 1.6, 0.6); rock(p.x + 1.0, iz + 0.5, 0.3);
        { const sx = p.x, sz = iz - 1.8, g0 = heightAt(sx, sz); // inbox 42 C2: the island's rock, three stacked (8.4 m, 2.5H)
          for (const [y, a, b, c] of [[-0.3, 1.3, 3.0, 1.2], [3.1, 1.0, 2.6, 0.95], [6.2, 0.7, 1.9, 0.65]]) L.rock.push({ x: sx + (rnd() - 0.5) * 0.2, y: g0 + y, z: sz + (rnd() - 0.5) * 0.2, s: [a, b, c], ry: rnd() * 6, c: jitter(pickOf(['#bdb6a9', '#aaa499', '#c9c2b4']), 0.05) });
          occupied.push({ x: sx, z: sz, r: 1.0, h: 8.4 }); }
        ringOf({ x: p.x, z: iz, len: p.ilen }, 8, p.isle + 0.4, p.isle + 0.9, (x, z) => { if (polyD(x, z, p.spit) > 1) R.tuft(x, z); }); },
      swamp() { for (const p of pools) ringOf(p, 6, wl(p) - 0.4, wl(p) + 0.2, (x, z) => R.tuft(x, z));
        place(7, (x, z) => ok(x, z, 0.6), stump); // old stumps
        place(3, (x, z) => ok(x, z, 0.5), (x, z) => { L.trunk.push({ x, y: heightAt(x, z) - 0.05, z, s: [0.6, 1.25, 0.6], ry: rnd() * 6, c: jitter('#6b5a48', 0.05) }); occupied.push({ x, z, r: 0.5, h: 3 }); }); // bare dead trunks
        fog(r[0] + 3, r[1] - 3, r[2] + 1, r[3] - 1);
        const ff = fireflies(scene, { walkable: (x, z) => Z.wd(x, z) > 0.3, heightAt }, 44, () => [r[0] + 2 + rnd() * (r[1] - r[0] - 4), r[2] + 1 + rnd() * (r[3] - r[2] - 2)]);
        ups.push((t, ctx) => ff(t, ctx?.night ?? 0)); },
      conifer() { for (const [u, v] of [[0.3, 0.12], [0.65, 0.32], [0.35, 0.6], [0.7, 0.82], [0.3, 0.97]]) { const [cx, cz] = at(u, v); for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.2, z = cz + (rnd() - 0.5) * 3.2; if (low(1.3, x, z)) tree(x, z, 0.85 + rnd() * 0.45); } }
        if (!Z143) return; // q1: the firs one shakes the snow off (their tiers and snow shiver: shake, below; one comes up to the trunk), log piles, snowy stumps
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), j3 = K3.jitter, all = t => Z.F.filter(q => q.zone === s.id && q.t === t);
        for (const f of all('spine143')) { const p0 = L.pine.length, n0 = L.snow.length; K3.snowpine(f.x, f.z, 1.05); occupied.at(-1).r = 0.75; const tk = L.trunk.at(-1); shake.push({ f, k: 'pine', c: [p0, p0 + 1], c2: [n0, n0 + 1], yb: tk.y + 2.3 * tk.s[1], b: new Map(), t0: null }); } // yb: the lowest boughs (the trunk's top)
        for (const q of all('stump143')) { const y = lowest(q.x, q.z, 0.5 * q.sc) - 0.05, sy = (0.26 + r3() * 0.1) * q.sc; // a cut stump, a cap of snow on it
          L.trunk.push({ x: q.x, y, z: q.z, s: [1.2 * q.sc, sy, 1.2 * q.sc], ry: r3() * 6, c: j3('#6e4a2e', 0.05) }); caps.push({ x: q.x, y: y + 2.3 * sy, z: q.z, s: [0.4 * q.sc, 0.09, 0.4 * q.sc], ry: 0, c: '#f6f9fc' }); occupied.push({ x: q.x, z: q.z, r: 0.85 * q.sc, h: 0.7 }); }
        for (const q of all('print143')) caps.push({ x: q.x, y: heightAt(q.x, q.z) - 0.004, z: q.z, s: [0.07, 0.016, 0.09], ry: q.ry, c: '#a9bcd4' }); // the pawprints: shallow blue-grey dents
        const bark = new THREE.CylinderGeometry(0.17, 0.17, 1.5, 12), cut = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12); // a pile of cut logs, three, two, one, their pale ends out, snow along the top
        for (const q of all('logs143')) { const g = new THREE.Group(), y = lowest(q.x, q.z, 0.8);
          for (const [n, row] of [[3, 0], [2, 1], [1, 2]]) for (let i = 0; i < n; i++) { const lz = (i - (n - 1) / 2) * 0.35, ly = 0.17 + row * 0.3, sh = (r3() - 0.5) * 0.12;
            part(g, bark, '#8a5a34', sh, ly, lz, { rz: Math.PI / 2 }); for (const e of [-1, 1]) part(g, cut, '#e3b97f', sh + e * 0.755, ly, lz, { rz: Math.PI / 2 }); }
          put(g, q.x, q.z, q.ry, 0.9, y, 0.8); const c = Math.cos(q.ry), sn = Math.sin(q.ry);
          for (const [lz, ly, w] of [[0, 0.92, 0.66], [-0.21, 0.62, 0.55], [0.21, 0.62, 0.55], [-0.4, 0.32, 0.5], [0.4, 0.32, 0.5]]) caps.push({ x: q.x + sn * lz, y: y + ly, z: q.z + c * lz, s: [w, 0.07, 0.13], ry: q.ry, c: '#f6f9fc' }); } },
      sled() { const f = Z.F.find(q => q.t === 'ramp' && q.zone === s.id); if (!Z143) return void fixture('sled', f.x + 1.6, f.z1 + 1.2, 0.4, 0.8, undefined, 0.5);
        // q1 (zones.js sled143): the sled off the steps' foot, the flag, a snowman by the run-out, the steps: a plank across the lane every
        // 0.9 m, half sunk (one walks over them: not in occupied), a ridge of snow pushed up behind each. Its own stream
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, one = t => Z.F.find(q => q.zone === s.id && q.t === t);
        fixture('sled', f.x - 2.6, f.z1 + 1.4, -0.3, 0.8, undefined, 0.5);
        { const q = one('flag143'); pennant(q.x, q.z, r3() * 6); } { const q = one('snowman143'); fixture('snowman', q.x, q.z, -0.35, 0.6, undefined, 1.4); }
        const st = one('steps143'), plank = roundedBox(1.0, 0.12, 0.2, 0.04), g = new THREE.Group(); g.userData.zk = k; scene.add(g); fx.push(g); // one group: two woods, two draws
        for (let i = 0, z = st.z1; z > st.z0; i++, z -= 0.9) { const y = heightAt(st.x, z), sl = (heightAt(st.x, z - 0.3) - heightAt(st.x, z + 0.3)) / 0.6;
          part(g, plank, i % 2 ? '#946c40' : '#a07848', st.x + (r3() - 0.5) * 0.06, y + 0.01, z, { rx: Math.atan(sl) }); // (no yaw: on the mesh it would come before the tilt, a twisted plank)
          caps.push({ x: st.x, y: y - 0.02, z: z - 0.16, s: [0.48, 0.07, 0.1], ry: 0, c: '#f6f9fc' }); } },
      pillars() { const c0 = crystals.length; for (const f of Z.F.filter(q => q.t === 'col' && q.zone === s.id)) { const a0 = rnd() * 6.283; // tall blue ice pillars round each ice mound (its top stays the owl's perch)
        for (let j = 0; j < 4; j++) { const big = j < 2, a = a0 + j * 1.3 + rnd() * 0.3, d = f.r + (big ? 0.6 : 0.35), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = big ? 0.85 + rnd() * 0.2 : 0.5, hh = big ? 7.5 + rnd() * 3 : 2.2 + rnd() * 1; // inbox 42 C2: x3 / x2 (big 2.2-3.1H)
          crystals.push({ x, y: heightAt(x, z) + hh * 0.45, z, s: [sc, hh, sc], rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12, ry: rnd() * 6, c: pickOf(['#9fd0f0', '#7fc0ec', '#b5ddf5']) });
          if (big) occupied.push({ x, z, r: 0.85, h: hh }); } }
        if (!Z143) return; // q1 (zones.js pillars143): the glassy slabs (a breath fogs one when sniffed), drifts and crystals at the pillars' feet. Its own stream
        let s3 = 1450 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; };
        const g = new THREE.Group(), ball = new THREE.SphereGeometry(1, 14, 10), SN = '#f4f8fb', ICEC = '#dff2fa';
        const xg = mergeGeometries([new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0), new THREE.ConeGeometry(1, 0.45, 6).translate(0, 1.225, 0)]), xm = new THREE.MeshStandardMaterial({ color: '#a8e4ff', emissive: '#4fb0ff', emissiveIntensity: 0.3, roughness: 0.15 });
        const cluster = (x, z, n, sc) => { const y0 = lowest(x, z, 0.3); for (let i = 0; i < n; i++) { const t = i / n * 6.283 + r3(), d = i ? 0.16 * sc : 0, hh = (i ? 0.45 + r3() * 0.3 : 0.95) * sc; // as the cave's: a tall one, smaller ones leaning out
          part(g, xg, '', x + Math.cos(t) * d, y0 - 0.05, z + Math.sin(t) * d, { m: xm, rx: Math.sin(t) * (i ? 0.35 : 0.06), rz: -Math.cos(t) * (i ? 0.35 : 0.06), ry: r3() }).scale.set(0.09 * sc, hh, 0.09 * sc); } };
        for (const p of crystals.slice(c0)) { if (p.s[1] < 5) continue; // at each tall pillar's foot: a drift heaped on its west side, a cluster of crystals off its east
          part(g, ball, SN, p.x - 0.75, lowest(p.x - 0.75, p.z, 0.5) - 0.05, p.z + 0.1, { ry: r3() * 0.6 - 0.3 }).scale.set(0.95 + r3() * 0.3, 0.42 + r3() * 0.12, 0.8);
          part(g, ball, SN, p.x - 1.4, lowest(p.x - 1.4, p.z, 0.4) - 0.04, p.z + 0.35, { ry: r3() }).scale.set(0.6, 0.22, 0.5);
          for (const a0 of [0, 2.4, -2.4]) { const a = a0 + (r3() - 0.5) * 1.2, x = p.x + Math.cos(a) * 1.3, z = p.z + Math.sin(a) * 1.3; // the first free of three sides
            if (free(x, z, 0.3) && !nearSpot(x, z, 0.4)) { cluster(x, z, 3 + Math.floor(r3() * 2), 0.9 + r3() * 0.5); break; } } }
        const pm = new THREE.MeshStandardMaterial({ color: '#a8dcf4', emissive: '#6fbde3', emissiveIntensity: 0.2, roughness: 0.04, metalness: 0.15 }), glint = roundedBox(0.2, 1.5, 0.03, 0.01), glint2 = roundedBox(0.09, 0.9, 0.03, 0.01);
        for (const m of Z.F.filter(q => q.t === 'mirror143' && q.zone === s.id)) { const y = lowest(m.x, m.z, 1.2) - 0.1, sl = new THREE.Group(); // a frosted frame round a pane of clear ice smooth as glass (two shines across it, as a toy mirror's), a lip on top, icicles under it
          part(sl, roundedBox(2.3, 2.9, 0.3, 0.1), ICEC, 0, 1.45, 0, { mat: { roughness: 0.15 } }); part(sl, roundedBox(1.85, 2.35, 0.38, 0.06), '', 0, 1.4, 0, { m: pm });
          for (const sd of [-1, 1]) { part(sl, glint, SN, -0.35, 1.75, sd * 0.195, { rz: -0.6 }); part(sl, glint2, SN, 0.05, 1.95, sd * 0.195, { rz: -0.6 }); }
          part(sl, roundedBox(2.5, 0.22, 0.56, 0.1), ICEC, 0, 2.95, 0, { mat: { roughness: 0.15 } }); part(sl, roundedBox(2.2, 0.16, 0.46, 0.08), SN, 0, 3.1, 0);
          for (const sd of [-1, 1]) for (const u of [-0.95, -0.6, -0.3, 0.05, 0.4, 0.75]) { const ln = 0.16 + r3() * 0.3; part(sl, new THREE.ConeGeometry(0.045 + ln * 0.05, ln, 6), ICEC, u + (r3() - 0.5) * 0.12, 2.84 - ln / 2, sd * 0.24, { rx: Math.PI, mat: { roughness: 0.15 } }); }
          for (const [u, w] of [[-1.25, 0.5], [1.2, 0.45], [0.2, 0.35]]) part(sl, ball, SN, u, 0, (r3() - 0.5) * 0.4, { ry: r3() }).scale.set(w, 0.22, w * 0.8); // snow at its foot
          sl.position.set(m.x, y, m.z); sl.rotation.y = m.ry; g.add(sl);
          for (const sd of [-0.7, 0.7]) occupied.push({ x: m.x + Math.cos(m.ry) * sd, z: m.z - Math.sin(m.ry) * sd, r: 0.95, h: 3 }); // its ends (the middle in front stays open: the spot)
          const fog = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); // the breath on the ice
          fog.rotation.y = m.ry; fog.visible = false; scene.add(fog); let t0 = null;
          ups.push(t => { if (m.fog) { const q = m.fog; m.fog = null; fog.position.set(q.x + m.nx * 0.22, heightAt(q.x, q.z) + (q.y ?? 0.6), q.z + m.nz * 0.22); t0 = t + 1.0; } // a breath out against it, a mist that fades
            const e = t0 == null ? 9 : t - t0; fog.visible = e > 0 && e < 4.5; if (!fog.visible) return; fog.material.opacity = 0.9 * Math.min(1, e / 0.4) * (1 - Math.max(0, (e - 1.5) / 3)); fog.scale.setScalar(0.6 + Math.min(1, e / 0.6) * 0.5); }); }
        put(bake(g), 0, 0, 0, 0, 0, 0); occupied.pop(); },
      hotspring() { if (S129) return spring129(); const p = pools[0]; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + rnd() * 0.15, d = p.r - 0.15; K.rock(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.32 + rnd() * 0.2); occupied.pop(); }
        steam(p.x, waterAt(p), p.z, wl(p)); },
      cave() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id), x = h.x, z = h.z + h.rz * 0.9, y = Math.min(heightAt(x, z), heightAt(x - 2.6, z), heightAt(x + 2.6, z)); // inbox 42 C2: at the 10 m hill's foot, twice as big
        occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h }); // no one climbs the rock
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rnd() * 0.3, rx = h.x + Math.cos(a) * h.rx * 1.02, rz = h.z + Math.sin(a) * h.rz * 0.98; if (Math.abs(a - Math.PI / 2) > (Z143 ? 1.0 : 0.6) && free(rx, rz, 0.4) && !nearSpot(rx, rz, 0.3)) rock(rx, rz, 0.6 + rnd() * 0.6); }
        if (Z143) { const C = Z.F.find(q => q.t === 'cave143' && q.zone === s.id), R = 3.0, L = 1.2; // q1 (zones.js cave143): a rock hood out of the hill's foot, its mouth to the view, the inside seen. Its own stream
          let s3 = 1440 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; };
          const y = Math.min(...[[0, -0.4], [-1.3, -1.4], [1.3, -1.4], [0, -2.2]].map(([a, b]) => heightAt(C.x + a, C.z + b))) - 0.04, at3 = (a, b) => heightAt(C.x + a, C.z + b) - y;
          const shell = (r, tl, c0) => { const tb = new THREE.CylinderGeometry(r, r, L, 28, 1, true, Math.PI - tl / 2, tl), cp = new THREE.SphereGeometry(r, 28, 10, Math.PI, Math.PI, 0, c0); // a half tube to the mouth, a quarter ball behind it
            tb.rotateX(Math.PI / 2); tb.translate(0, 0, -L / 2); cp.translate(0, 0, -L); return mergeGeometries([tb, cp]); };
          const g = new THREE.Group(), ball = new THREE.SphereGeometry(1, 14, 10), hood = shell(R, Math.PI, Math.PI / 2), ICEC = '#dff2fa';
          part(g, hood, '#8e9097', 0, 0, 0, { mat: { roughness: 0.75 } }); part(g, hood, '#2a3a50', 0, 0, 0, { mat: { roughness: 0.9, side: THREE.BackSide } }); // rock out, dark blue in
          part(g, shell(R + 0.07, 1.6, 0.8), '#f4f8fb', 0, 0, 0, { mat: { roughness: 0.8 } }); // snow on its top
          for (const [a, b, w] of [[-1.1, -0.6, 0.7], [0.9, -1.7, 0.8], [-0.4, -3.0, 0.65], [1.6, -0.2, 0.5]]) part(g, ball, '#f4f8fb', a, Math.sqrt(Math.max(0, R * R - a * a - Math.max(0, -b - L) ** 2)) + 0.02, b).scale.set(w, 0.16, w * 0.8); // lumps of it
          part(g, new THREE.TorusGeometry(R + 0.02, 0.36, 10, 28, Math.PI), '#9a9da5', 0, -0.08, 0.02); // the mouth's rim
          part(g, new THREE.TorusGeometry(R + 0.12, 0.27, 8, 16, 1.7), '#f4f8fb', 0, 0.06, 0.02, { rz: Math.PI / 2 - 0.85 }); // snow on it
          part(g, ball, '#4a5870', 0, 0.02, -(L + R) / 2 - 0.3, { mat: { roughness: 0.95 } }).scale.set(R - 0.7, 0.04, (L + R) / 2 - 0.7); // the dark floor, well in
          for (const a0 of [-0.78, -0.4, 0.02, 0.37, 0.74]) { const a = Math.PI / 2 + a0 + (r3() - 0.5) * 0.12, ln = 0.26 + r3() * 0.38; // icicles, uneven (a full even row read as teeth)
            part(g, new THREE.ConeGeometry(0.08 + ln * 0.06, ln, 6), ICEC, Math.cos(a) * (R - 0.28), Math.sin(a) * (R - 0.28) - ln / 2, 0.14, { rx: Math.PI, mat: { roughness: 0.15 } }); }
          const xg = mergeGeometries([new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0), new THREE.ConeGeometry(1, 0.45, 6).translate(0, 1.225, 0)]), xm = new THREE.MeshStandardMaterial({ color: '#a8e4ff', emissive: '#4fb0ff', emissiveIntensity: 0.55, roughness: 0.15 });
          const crystals3 = (a, b, n, sc) => { const y0 = at3(a, b); for (let i = 0; i < n; i++) { const t = i / n * 6.283 + r3(), d = i ? 0.16 * sc : 0, hh = (i ? 0.45 + r3() * 0.3 : 0.95) * sc; // blue ice crystals, a tall one and smaller round it, leaning out
            part(g, xg, '', a + Math.cos(t) * d, y0 - 0.05, b + Math.sin(t) * d, { m: xm, rx: Math.sin(t) * (i ? 0.35 : 0.06), rz: -Math.cos(t) * (i ? 0.35 : 0.06), ry: r3() }).scale.set(0.09 * sc, hh, 0.09 * sc); } };
          crystals3(-1.2, -2.7, 5, 1.1); crystals3(1.0, -3.0, 4, 1.25); crystals3(0.1, -3.5, 3, 0.8); // at its back, glowing blue
          halo(g, '#7fc8ff', 3.2, 0, 1.0, -2.6); // and by night a soft blue glow
          crystals3(-3.9, 0.7, 4, 0.8); crystals3(4.4, 1.5, 3, 0.65); // a few out by its mouth
          put(bake(g), C.x, C.z, 0, 0, y, 0); occupied.pop();
          for (const [a, b] of [[-3.1, -0.4], [3.1, -0.4], [-3.0, -1.9], [3.0, -1.9], [-2.4, -3.3], [2.4, -3.3], [0, -4.1]]) occupied.push({ x: C.x + a, z: C.z + b, r: 1.0, h: 3 }); // its walls: in by the mouth only
          rock(C.x - 4.3, C.z - 3.3, 0.75); rock(C.x + 4.4, C.z - 3.6, 0.85); return; } // snow capped stones by it
        const g = new THREE.Group(), dark = toyMat('#2b3039', { roughness: 0.9 }), rim = toyMat('#8e9097', { roughness: 0.6 }), ice = toyMat('#dff2fa', { roughness: 0.15 });
        const mg = new THREE.CircleGeometry(2.6, 24, 0, Math.PI); mg.scale(1, 1.1, 1); mg.rotateY(Math.PI / 2); g.add(new THREE.Mesh(mg, dark)); // the dark mouth, facing out
        const arch = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.4, 8, 24, Math.PI), rim); arch.rotation.y = Math.PI / 2; arch.scale.set(1, 1.1, 1); arch.position.x = 0.05; g.add(arch);
        for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i - 1) * 0.4, ic = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32 + rnd() * 0.16, 6), ice); ic.rotation.x = Math.PI; ic.position.set(0.2, Math.sin(a) * 2.6 * 1.1 - 0.3, Math.cos(a) * 2.5); g.add(ic); } // three short icicles (a full row read as teeth)
        g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
        g.position.set(x, y - 0.2, z - 0.3); g.rotation.y = -Math.PI / 2; scene.add(g); occupied.push({ x, z, r: 2.0, h: 3.2 }); },
      iceplate() { const [x0, x1, z0, z1] = Z.F.find(q => q.t === 'tint' && q.r && q.zone === s.id).r, w = (x1 - x0) / 2, d = (z1 - z0) / 2, R = 1.4, sh = new THREE.Shape(); // a glossy sheet of blue ice (a tint on snow read as snow)
        sh.moveTo(-w + R, -d); sh.lineTo(w - R, -d); sh.quadraticCurveTo(w, -d, w, -d + R); sh.lineTo(w, d - R); sh.quadraticCurveTo(w, d, w - R, d); sh.lineTo(-w + R, d); sh.quadraticCurveTo(-w, d, -w, d - R); sh.lineTo(-w, -d + R); sh.quadraticCurveTo(-w, -d, -w + R, -d);
        const g = new THREE.ShapeGeometry(sh, 4); g.rotateX(-Math.PI / 2); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, m = new THREE.Mesh(g, toyMat('#5fb0e6', { roughness: 0.1 }));
        const y = Math.max(...[x0, cx, x1].flatMap(x => [z0, cz, z1].map(z => heightAt(x, z)))) + 0.03; m.position.set(cx, y, cz); m.receiveShadow = true; scene.add(m);
        const cracks = []; for (let i = 0; i < 26; i++) cracks.push({ x: x0 + 1 + rnd() * (2 * w - 2), y: y + 0.008, z: z0 + 0.6 + rnd() * (2 * d - 1.2), s: [0.8 + rnd() * 1.4, 1, 1], ry: rnd() * 6, c: '#eaf8ff' }); // pale cracks in it
        scene.add(instanced(new THREE.BoxGeometry(1, 0.01, 0.045), toyMat('#ffffff', { roughness: 0.3 }), cracks, { cast: false }));
        const glint = mergeGeometries([new THREE.BoxGeometry(0.5, 0.02, 0.05), new THREE.BoxGeometry(0.05, 0.02, 0.5)]), gl = [], n = 120; // little stars that twinkle on it
        for (let i = 0; i < n; i++) gl.push({ x: x0 + 0.6 + rnd() * (2 * w - 1.2), z: z0 + 0.4 + rnd() * (2 * d - 0.8), ph: rnd() * 6.28, sp: 0.8 + rnd() * 0.8 });
        const im = new THREE.InstancedMesh(glint, new THREE.MeshBasicMaterial({ color: '#ffffff' }), n); im.frustumCulled = false; scene.add(im);
        ups.push(t => { im.material.color.copy(skyLit.value); for (let i = 0; i < n; i++) { const q = gl[i], k = Math.max(0, Math.sin(t * q.sp + q.ph)) ** 6; _q.setFromAxisAngle(_p.set(0, 1, 0), q.ph + t * 0.3); im.setMatrixAt(i, _m.compose(_p.set(q.x, y + 0.02, q.z), _q, _s.setScalar(k * 1.5 + 0.001))); } im.instanceMatrix.needsUpdate = true; });
        if (!Z143) return; // q1 (zones.js iceplate143): the holes (a fish leaps when one looks in), the hut, a rod and a bucket, a sled and its tracks. Its own stream
        let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, all = t => Z.F.filter(q => q.zone === s.id && q.t === t);
        const ball = new THREE.SphereGeometry(1, 14, 10), DW = '#6e4426', holes = all('hole143'), hut = all('hut143')[0];
        holes.forEach((H, i) => { const g = new THREE.Group();
          part(g, new THREE.CircleGeometry(H.r, 24), '#163f62', 0, 0.012, 0, { rx: -Math.PI / 2 }); // the dark water
          for (let j = 0; j < 10; j++) { const a = j / 10 * 6.283 + r3() * 0.3, w = 0.17 + r3() * 0.07; part(g, ball, '#eef8fd', Math.cos(a) * (H.r + 0.1), 0.015, Math.sin(a) * (H.r + 0.1), { ry: -a }).scale.set(w * 0.8, 0.06 + r3() * 0.04, w); } // a rim of chipped ice
          if (!i) { const rod = new THREE.Group(); rod.position.set(0.1, 0, -0.88); rod.rotation.y = Math.PI / 2; g.add(rod); // behind it (the spots at its sides): a rod leaned over the hole on a lump of snow, its line down in it; a bucket
            part(rod, ball, '#f4f9fc', 0, 0.06, 0).scale.set(0.2, 0.14, 0.2); part(rod, new THREE.CylinderGeometry(0.014, 0.02, 1.15, 6), '#c0392b', -0.4, 0.42, 0, { rz: 1.05 });
            part(rod, new THREE.CylinderGeometry(0.004, 0.004, 0.62, 4), '#f6f6f6', -0.9, 0.38, 0); part(rod, ball, '#ffffff', -0.9, 0.08, 0).scale.setScalar(0.035); // the line, a float
            part(g, new THREE.CylinderGeometry(0.15, 0.12, 0.24, 14), '#5c8fc4', -0.75, 0.12, -0.7); part(g, new THREE.TorusGeometry(0.15, 0.014, 6, 16), '#3f6f9e', -0.75, 0.24, -0.7, { rx: Math.PI / 2 }); }
          put(bake(g), H.x, H.z, 0, 0, y, 0); occupied.pop();
          const mv = new THREE.Group(), fish = new THREE.Group(), ring = part(mv, new THREE.TorusGeometry(1, 0.06, 5, 20), '#eaf6fd', 0, 0, 0, { rx: Math.PI / 2 }); // a fish to leap, a ring spreading on the water
          part(fish, ball, '#f29a4a', 0, 0, 0).scale.set(0.15, 0.075, 0.055); part(fish, new THREE.ConeGeometry(0.07, 0.12, 4), '#f29a4a', -0.17, 0, 0, { rz: Math.PI / 2 }).scale.z = 0.4;
          for (const sz of [-1, 1]) part(fish, ball, '#1d1d1d', 0.09, 0.02, sz * 0.045).scale.setScalar(0.014);
          mv.add(fish); mv.position.set(H.x, y + 0.02, H.z); mv.visible = false; scene.add(mv); H.mv = { mv, fish, ring, a: r3() * 6.283 }; });
        ups.push(t => { for (const H of holes) { const M = H.mv; if (H.bite) { H.bite = 0; H.t0 = t + 0.7; M.a += 1.3; } const e = H.t0 == null ? 9 : t - H.t0; M.mv.visible = e > 0 && e < 1.7; if (!M.mv.visible) continue; // 0.7 s after the head goes down
          const f = Math.min(1, e), c = e < 1 ? e / 0.6 : (e - 1) / 0.6; M.fish.visible = e < 1; M.mv.rotation.y = M.a; M.fish.position.set((f - 0.5) * H.r * 1.3, Math.sin(f * Math.PI) * 0.6, 0); M.fish.rotation.z = (0.5 - f) * 2.6; // out, an arc, back in
          M.ring.visible = c < 1; M.ring.scale.setScalar(0.08 + c * (H.r - 0.1)); } });
        { const g = new THREE.Group(), WD = '#9a6a40', RF = '#c95a44', gab = new THREE.Shape(); gab.moveTo(-0.85, 0); gab.lineTo(0.85, 0); gab.lineTo(0, 0.62); gab.closePath(); // the hut: on two skids, its gable, door and window to the view
          const ge = new THREE.ExtrudeGeometry(gab, { depth: 1.4, bevelEnabled: false }); ge.translate(0, 0, -0.7);
          for (const sx of [-0.62, 0.62]) part(g, roundedBox(0.12, 0.1, 1.65, 0.03), DW, sx, 0.05, 0);
          part(g, roundedBox(1.7, 1.4, 1.4, 0.05), WD, 0, 0.8, 0); part(g, ge, WD, 0, 1.5, 0);
          for (const sg of [-1, 1]) { const a = -sg * 0.63, nx = sg * Math.sin(0.63), ny = Math.cos(0.63); // the roof (its slope 0.63, out along its normal), snow on it
            part(g, roundedBox(1.2, 0.09, 1.62, 0.03), RF, sg * 0.425 + nx * 0.05, 1.81 + ny * 0.05, 0, { rz: a });
            part(g, roundedBox(1.04, 0.07, 1.48, 0.03), '#f6f9fc', sg * 0.425 + nx * 0.11, 1.81 + ny * 0.11, 0, { rz: a }); }
          part(g, roundedBox(0.5, 0.95, 0.06, 0.02), DW, -0.32, 0.6, 0.71); part(g, ball, '#ffd54a', -0.14, 0.6, 0.75).scale.setScalar(0.035); // the door, its knob
          part(g, roundedBox(0.46, 0.46, 0.04, 0.02), DW, 0.42, 0.95, 0.7); part(g, roundedBox(0.36, 0.36, 0.04, 0.02), '#ffd27a', 0.42, 0.95, 0.715, { lit: true }); // a window, lit by night
          part(g, new THREE.BoxGeometry(0.36, 0.03, 0.02), DW, 0.42, 0.95, 0.74); part(g, new THREE.BoxGeometry(0.03, 0.36, 0.02), DW, 0.42, 0.95, 0.74);
          part(g, new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), '#4a4a50', 0.45, 2.05, -0.35); part(g, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), '#3a3a40', 0.45, 2.34, -0.35); // the stovepipe
          put(bake(g), hut.x, hut.z, 0, 1.2, y, 2.4); }
        fixture('sled', hut.x - 1.9, hut.z + 0.35, 0.12, 0.6, y, 0.5);
        const tr = [], P = [[x0 + 1.5, z1 - 0.8], [-22, z0 + 0.8], [-2, z1 + 0.6], [hut.x - 2.35, hut.z + 0.35]], B = (u, i) => { const v = 1 - u; return v * v * v * P[0][i] + 3 * u * v * v * P[1][i] + 3 * u * u * v * P[2][i] + u * u * u * P[3][i]; };
        for (let u = 0; u < 1; u += 0.006) { const px = B(u, 0), pz = B(u, 1), dx = B(u + 0.003, 0) - B(u - 0.003, 0), dz = B(u + 0.003, 1) - B(u - 0.003, 1), l = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx); // the sled's tracks: in from the west, an S over the ice to it
          for (const sd of [-0.26, 0.26]) tr.push({ x: px - dz / l * sd, y: y + 0.01, z: pz + dx / l * sd, s: [0.5, 1, 1], ry, c: '#e4f4fc' }); }
        scene.add(instanced(new THREE.BoxGeometry(1, 0.01, 0.09), toyMat('#ffffff', { roughness: 0.3 }), tr, { cast: false })); },
      // ---- 14-3 the dino jungle ----
      fernwood() { if (Z143) { // q1 (zones.js fernwood143): first (the groves keep off them) the giant fern, the leaf beds and their heaps, the log, the nest. Its own stream
          let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, K3 = kit(L, { rand: r3, heightAt, occupied }), j3 = K3.jitter, all = t => Z.F.filter(q => q.zone === s.id && q.t === t);
          for (const f of all('bigfern143')) { K3.treefern(f.x, f.z, 2.4); occupied.at(-1).r = 1.2; } // its trunk only blocks; its cover (a dry spot in the rain) as it is
          const g = new THREE.Group(), ball = new THREE.SphereGeometry(1, 16, 10), LF = ['#5fa83c', '#4e8a36', '#6aa640'];
          const blade = (G, x, y, z, a, len, w, c, tilt = 0) => part(G, ball, c, x, y, z, { ry: a, rz: tilt }).scale.set(len, 0.06, w); // a frond lying flat, its length along a
          for (const B of all('bed143')) { const y = lowest(B.x, B.z, 1.4); // a bed of fronds: a ring of long ones laid out like a star, short ones over their middle, two dry brown ones
            for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + r3() * 0.3, d = 1.0 + r3() * 0.2; blade(g, B.x + Math.cos(a) * d, y + 0.03 + i * 0.006, B.z - Math.sin(a) * d, a, 1.15 + r3() * 0.25, 0.34, j3(i % 4 === 3 ? '#a8864a' : LF[i % 3], 0.05), 0.05); }
            for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + r3(); blade(g, B.x + Math.cos(a) * 0.4, y + 0.1, B.z - Math.sin(a) * 0.4, a, 0.75, 0.26, j3(LF[(i + 1) % 3], 0.05)); }
            // the heap over a sleeper (walk.js sets B.who): three leafy mounds along its back, dropped on as it settles, sliding off as it gets up
            const hp = new THREE.Group(), hs = new THREE.Group(), dome = new THREE.SphereGeometry(1, 20, 10, 0, 6.283, 0, Math.PI / 2); hp.add(hs);
            for (const [z0, rx, c] of [[0, 0, '#5a9e3a'], [-0.4, -0.45, '#4e8a36'], [0.4, 0.45, '#66a842']]) part(hs, dome, c, 0, 0, z0, { rx }).scale.set(1, z0 ? 0.8 : 1, z0 ? 0.6 : 0.8);
            for (let i = 0; i < 6; i++) blade(hs, -0.7 + i * 0.28, 0.97, (i % 2 ? 0.2 : -0.2), (i % 2 ? 1 : -1) * 0.9, 0.42, 0.13, j3(LF[i % 3], 0.05)); // fronds strewn on top
            hp.visible = false; scene.add(hp); let on = 0, tl = 0;
            ups.push(t => { const W = B.who, a = W?.a, here = a && a.obj.parent && a.state === 'sleep' && Math.hypot(a.position.x - B.x, a.position.z - B.z) < 1.2, dt = Math.min(0.1, Math.max(0, t - tl)); tl = t;
              if (here) { if (W.t0 == null) W.t0 = t; on = Math.min(1, Math.max(on, (t - W.t0 - 0.7) / 0.5)); } else { on = Math.max(0, on - dt / 0.4); if (W && !on) B.who = null; }
              hp.visible = on > 0; if (!hp.visible) return; const e = on * on * (3 - 2 * on), L0 = W.seg[1] * 0.55, L1 = -W.seg[0] * 0.9 + W.r * 0.3; // over its back from mid chest to the root of its tail, the head out
              hp.position.set(a.position.x, y, a.position.z); hp.rotation.y = a.obj.rotation.y; hs.position.x = (L0 - L1) / 2; hs.scale.set((L0 + L1) / 2 * (0.7 + 0.3 * e), Math.max(W.r * 1.75, W.ht * 0.7) * e, W.r * 1.3 * (0.7 + 0.3 * e)); }); } // as long as its back and up its flanks (a tall back too), about as wide as its belly
          for (const f of all('log143')) { const lg = new THREE.Group(), y = lowest(f.x, f.z, 1.6); // a fallen log, moss on its back, its cut ends pale with rings, a fern or two by it
            part(lg, new THREE.CylinderGeometry(0.42, 0.46, 3.4, 16), '#7a5232', 0, 0.36, 0, { rz: Math.PI / 2 });
            for (const sd of [-1, 1]) { part(lg, new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), '#d8b27a', sd * 1.71, 0.36, 0, { rz: Math.PI / 2 }); part(lg, new THREE.TorusGeometry(0.22, 0.025, 6, 20), '#b88a54', sd * 1.735, 0.36, 0, { ry: Math.PI / 2 }); }
            for (const [u, w] of [[-0.9, 0.6], [0.2, 0.75], [1.0, 0.45]]) part(lg, ball, j3('#6aa640', 0.05), u, 0.72, (r3() - 0.5) * 0.15, { ry: r3() }).scale.set(w, 0.16, 0.36);
            part(lg, new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), '#7a5232', 0.5, 0.62, 0.3, { rx: -0.8 }); // a broken off branch stub
            lg.position.set(f.x, y, f.z); lg.rotation.y = f.ry; g.add(lg);
            for (const d of [-1.2, 0, 1.2]) occupied.push({ x: f.x + Math.cos(f.ry) * d, z: f.z - Math.sin(f.ry) * d, r: 0.6, h: 0.8 });
            for (const sd of [-1, 1]) K3.fern(f.x + Math.cos(f.ry) * sd * 2.1, f.z - Math.sin(f.ry) * sd * 2.1 + 0.4, 1.4); }
          for (const f of all('nest143')) fixture('dinonest', f.x, f.z, r3() * 6, 1.4, lowest(f.x, f.z, 1) - 0.05, 0.6).scale.setScalar(1.6);
          put(bake(g), 0, 0, 0, 0, 0, 0); occupied.pop(); }
        for (const [u, v] of [[0.3, 0.15], [0.7, 0.3], [0.35, 0.5], [0.7, 0.68], [0.3, 0.84], [0.6, 0.97]]) { const [cx, cz] = at(u, v); // thick groves of tree ferns
          for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.4, z = cz + (rnd() - 0.5) * 3.4; if (low(1.3, x, z) && !(e3 && clear3(x, z))) tree(x, z, 0.9 + rnd() * 0.45); } } },
      cliffs() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id); occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h }); // no one climbs the rock
        for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + rnd() * 0.3, x = h.x + Math.cos(a) * h.rx * 1.02, z = h.z + Math.sin(a) * h.rz * 0.98; if (free(x, z, 0.4) && !nearSpot(x, z, 0.3)) rock(x, z, 0.5 + rnd() * 0.5); }
        for (const f of Z.F.filter(q => q.t === 'col' && q.zone === s.id)) for (let j = 0; j < 3; j++) { const a = rnd() * 6.283, x = f.x + Math.cos(a) * (f.r + 0.6), z = f.z + Math.sin(a) * (f.r + 0.6); if (free(x, z, 0.3)) rock(x, z, 0.28 + rnd() * 0.22); } }, // the pterosaur's rock stacks: stones at their feet
      riverbed() { const f = Z.rills.find(q => q.zone === s.id);
        banks(f, 18, f.w + 0.3, f.w + 0.8, (x, z) => { if (free(x, z, 0.3) && !nearSpot(x, z, 0)) rock(x, z, 0.25 + rnd() * 0.3); }); // stones on the gravel banks
        banks(f, 26, f.w - 0.3, f.w + 0.2, (x, z) => { if (!nearSpot(x, z, 0.2)) R.tuft(x, z); }); }, // reeds at the water's edge
      bigdig() { // the dig: a huge rib cage standing in the sand, a horned skull and leg bones lying about (the fossil props, bigger)
        { const [x, z] = at(0.62, 0.3); fixture('ribs', x, z, 0.3, 2.5, undefined, 2.3).scale.setScalar(1.6); }
        { const [x, z] = at(0.5, 0.58); fixture('fos_skull', x, z, -0.6, 1.4, heightAt(x, z) - 0.08, 1).scale.setScalar(1.4); }
        for (const [u, v, ry] of [[0.25, 0.22, 0.4], [0.75, 0.62, 2.0], [0.3, 0.7, -0.8]]) { const [x, z] = at(u, v); if (free(x, z, 0.8)) fixture('fos_bone', x, z, ry, 0.8, heightAt(x, z) - 0.05, 0.4); }
        for (let i = 0; i < 60; i++) { const [x, z] = at(0.1 + rnd() * 0.8, 0.12 + rnd() * 0.85); if (free(x, z, 0)) L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.14 + rnd() * 0.14, 0.07, 0.12 + rnd() * 0.1], ry: rnd() * 6, c: jitter(pickOf(['#c8a870', '#a89070', '#e2cfa0']), 0.08) }); } },
      mudflat() { for (const p of pools) ringOf(p, 7, wl(p) - 0.4, wl(p) + 0.2, (x, z) => R.tuft(x, z)); place(4, (x, z) => ok(x, z, 0.6), stump); },
      springs() { for (const p of pools) { for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + rnd() * 0.15, d = p.r - 0.15; K.rock(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.3 + rnd() * 0.2); occupied.pop(); }
        steam(p.x, waterAt(p), p.z, wl(p)); } },
    };
    function bigShroom(h, red) { // a giant toadstool: cream stem, a wide domed cap (red with cream dots, or tan)
      const g = new THREE.Group(), R = 0.5 * h, hs = 0.78 * h, sr = 0.11 * h;
      part(g, lathe([[0, 0], [sr * 1.35, 0], [sr * 1.1, hs * 0.25], [sr, hs * 0.7], [sr * 0.95, hs], [0, hs]], 14), '#f6ead6');
      part(g, lathe([[0, hs - 0.06 * h], [R, hs - 0.06 * h], [R * 1.02, hs], [R * 0.85, hs + 0.2 * h], [R * 0.45, hs + 0.33 * h], [0, hs + 0.36 * h]], 22), red ? '#e8604a' : '#d9944a');
      if (red) { const dot = new THREE.SphereGeometry(0.06 * h, 10, 6); for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, q = i ? (i % 2 ? 0.62 : 0.38) : 0; part(g, dot, '#fff4e6', Math.cos(a) * q * R, hs + (i ? (i % 2 ? 0.275 : 0.336) : 0.36) * h, Math.sin(a) * q * R).scale.set(1, 0.5, 1); } }
      return g;
    }
    function drift() { // a pale, sea-worn branch with one stub
      const g = new THREE.Group(), l = 1.4 + rnd() * 0.6;
      part(g, new THREE.CapsuleGeometry(0.13, l, 4, 10), '#c9b9a0', 0, 0.12, 0, { rz: Math.PI / 2 });
      part(g, new THREE.CapsuleGeometry(0.07, 0.5, 3, 8), '#d6c8b0', l * 0.2, 0.2, 0.2, { rz: Math.PI / 2 - 0.5, ry: -0.7 });
      return g;
    }
    function spray(x, y, z, n = 14, sc = 1) { // white droplets bubbling up where the fall lands (143 B: n, sc; pops up with the zone)
      const P = [], im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), toyMat('#ffffff', { roughness: 0.3, transparent: true, opacity: 0.85 }), n); im.frustumCulled = false; scene.add(im);
      for (let i = 0; i < n; i++) P.push({ a: rnd() * 6.28, ph: i / n, d: 0.2 + rnd() * 0.5 });
      ups.push(t => { const f = Z143 && k === popK ? popIn(t) : 1; for (let i = 0; i < n; i++) { const q = P[i], u = (t * 0.9 + q.ph) % 1; im.setMatrixAt(i, _m.compose(_p.set(x + Math.cos(q.a) * q.d * sc * (0.4 + u), y + 0.1 + Math.sin(u * Math.PI) * 0.55 * sc, z + Math.sin(q.a) * q.d * sc * (0.4 + u)), _q.identity(), _s.setScalar((0.06 + 0.16 * (1 - u)) * sc * f))); } im.instanceMatrix.needsUpdate = true; });
    }
    function fog(x0, x1, z0, z1) { // low fog over the swamp, seen by day too: soft flat puffs in two layers, drifting
      const n = 14, P = [], geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ map: softTex(), color: '#eef2ea', transparent: true, opacity: 0.55, depthWrite: false }), im = new THREE.InstancedMesh(geo, mat, n * 2);
      im.renderOrder = 2; im.frustumCulled = false; scene.add(im);
      const top = (x, z) => Math.max(...[[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].map(([dx, dz]) => heightAt(x + dx, z + dz))); // over the pools' rims, not down in them
      for (let i = 0; i < n * 2; i++) { const x = x0 + ((i % n) + 0.5) / n * (x1 - x0) + (rnd() - 0.5) * 2, z = z0 + rnd() * (z1 - z0); P.push({ x, z, y: top(x, z) + (i < n ? 0.35 : 0.75), s: 5 + rnd() * 3, ph: rnd() * 6.28 }); }
      const c0 = new THREE.Color('#eef2ea');
      ups.push(t => { mat.color.copy(c0).multiply(skyLit.value); for (let i = 0; i < P.length; i++) { const q = P[i]; im.setMatrixAt(i, _m.compose(_p.set(q.x + Math.sin(t * 0.07 + q.ph) * 1.5, q.y + Math.sin(t * 0.2 + q.ph) * 0.05, q.z + Math.cos(t * 0.05 + q.ph) * 0.6), _q.identity(), _s.set(q.s, 1, q.s * 0.6))); } im.instanceMatrix.needsUpdate = true; });
    }
    // 129 (?s129 trial; zones.js spring129): the pools' rims of dark wet rock (snow on top), a gap where the water spills, big
    // capped rocks round the steps' feet and down the falls' sides; stone lanterns lit at night, a plank deck, a low bamboo fence,
    // stacked wooden buckets; slow thick steam over each pool (one mesh, steam129) and a little puff over each head in it
    function spring129() {
      const F = Z.F.filter(f => f.zone === s.id), falls = F.filter(f => f.t === 'fall'), V3 = S129 >= 3, V4 = S129 === 4, stone = (x, z, sc) => { K.rock(x, z, sc); const q = L.rock.at(-1); q.c = jitter(V3 ? '#948e86' : '#66625e', 0.05); occupied.pop(); if (k === popK) pop.rocks.push(L.rock.length - 1);
        if (V3) { caps.push({ x: q.x, y: q.y + q.s[1] * 0.8, z: q.z, s: [q.s[0] * 0.62, q.s[1] * 0.26, q.s[2] * 0.62], ry: q.ry, c: '#f6f9fc' }); if (k === popK) pop.caps.push([caps.length - 1, L.rock.length - 1]); } }; // warm: wet, no snow on it (129: pops up); 139-3: lighter, a snow cap that pops with it
      const gap = (x, z) => falls.some(f => Math.hypot(x - f.from[0], z - f.from[1]) < 1.0 || Math.hypot(x - f.to[0], z - f.to[1]) < 0.9);
      // 141 D (V4): flat faceted stones (slabGeo) half sunk in the ground, in heaps on the water's edge, not strewn round it: in
      // each a big flat one (snow on it), a mid one or two and small ones at their feet; the rim between the heaps bare
      let s4 = 4141 + k; const r4 = () => { s4 = (s4 * 16807) % 2147483647; return (s4 - 1) / 2147483646; }; // 141 D: the V4 stones' own stream (the trees and the rest keep theirs)
      const way = (x, z) => F.some(f => f.soak && polyD(x, z, [[f.x, f.z], f.soak.out]) < 1.3); // not on a soaker's way in and out
      const slab4 = (x, z, sc, big, keep) => { const sx = sc * (1.05 + r4() * 0.35), sy = sc * (0.6 + r4() * 0.2), sz = sc * (0.8 + r4() * 0.25), h0 = heightAt(x, z), m = 0.7 * Math.max(sx, sz);
        const lo = Math.min(h0, heightAt(x + m, z), heightAt(x - m, z), heightAt(x, z + m), heightAt(x, z - m)), y = Math.max(lo, h0 - 0.4 * sy) - 0.05 * sy; // its middle at the ground's lowest under it: half in
        const q = { x, y, z, s: [sx, sy, sz], ry: r4() * 6.283, rx: big ? 0 : (r4() - 0.5) * 0.3, rz: big ? 0 : (r4() - 0.5) * 0.3, c: jitter(big ? '#7c776f' : sc > 0.3 ? '#6f6b64' : '#625e58', 0.06) };
        slabs.push(q); if (k === popK) pop.slabs.push(slabs.length - 1); if (keep) occupied.push({ x, z, r: 0.8 * Math.max(sx, sz), h: 0.6 * sy });
        if (big) { caps.push({ x, y: y + sy * 0.44, z, s: [sx * 0.55, sy * 0.16, sz * 0.55], ry: q.ry, c: '#f6f9fc' }); if (k === popK) pop.caps.push([caps.length - 1, slabs.length - 1, slabs]); } };
      const heap = (x, z, sc, ux, uz, nx, nz, keep) => { slab4(x, z, sc, true, keep);
        for (const [a, b, f] of HEAP) { if (r4() < 0.2) continue; const px = x + (ux * a + nx * b) * sc, pz = z + (uz * a + nz * b) * sc; const s2 = f * sc * (0.85 + r4() * 0.3); if (s2 >= 0.14 && !gap(px, pz) && !way(px, pz)) slab4(px, pz, s2, false); } }; // 141 D: no loose chips under 0.14
      if (V4) for (const p of pools) { const n = p.r > 3 ? 3 : 2; let t = r4();
        for (let i = 0; i < n; i++, t += (0.8 + r4() * 0.4) / n) { const sc = 0.85 + r4() * 0.4 + (p.r > 3 ? 0.2 : 0);
          for (let j = 0; j < 4; j++, t += 0.05) { const [x, z] = poolAt(p, t, wl(p) + 0.5 + sc * 0.3); if (gap(x, z) || way(x, z)) continue;
            const l = Math.hypot(x - p.x, z - p.z), nx = (x - p.x) / l, nz = (z - p.z) / l; heap(x, z, sc, -nz, nx, nx, nz); break; } } }
      else for (const p of pools) { const n = Math.round(p.r * 5.5); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rnd() * 0.15, d = p.r - 0.42 + rnd() * 0.22, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (!gap(x, z)) stone(x, z, 0.2 + rnd() * 0.14); } }
      for (const f of falls) { const dx = f.to[0] - f.from[0], dz = f.to[1] - f.from[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; // the fall's sides: rock steps
        for (const t of [0.25, 0.6]) for (const sd of [-1, 1]) { if (V4) continue; const x = f.from[0] + dx * t + nx * sd * 0.9, z = f.from[1] + dz * t + nz * sd * 0.9; stone(x, z, 0.32 + rnd() * 0.16); }
        if (V4) { const sd = r4() < 0.5 ? 1 : -1; for (const [t, o, sc] of [[0.15, 1.4, 0.75 + r4() * 0.2], [0.6, 1.2, 0.5 + r4() * 0.12]]) heap(f.from[0] + dx * t + nx * sd * o, f.from[1] + dz * t + nz * sd * o, sc, dx / l, dz / l, nx * sd, nz * sd); } } // 141 D: a heap by the lip on one side, a smaller one lower down
      for (const f of F.filter(f => f.t === 'boulder')) if (free(f.x, f.z, 0.3)) { if (!V4) rock(f.x, f.z, f.sc); else { const a = r4() * 6.283; heap(f.x, f.z, f.sc, Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), true); } } // 139-3: capped boulders and pines set by hand on the hill (zones.js spring139)
      for (const f of F.filter(f => f.t === 'pine')) if (free(f.x, f.z, 0.8)) tree(f.x, f.z, f.sc);
      if (!V3) for (const h of F.filter(f => f.t === 'hill')) for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + rnd() * 0.4, x = h.x + Math.cos(a) * h.rx * 0.97, z = h.z + Math.sin(a) * h.rz * 0.97;
        if (!gap(x, z) && !pools.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 0.9) && free(x, z, 0.6)) rock(x, z, 0.55 + rnd() * 0.3); }
      const ball = new THREE.SphereGeometry(1, 12, 8), ST = '#a9a59e', WOOD = ['#c99a62', '#b98a54'];
      for (const f of F.filter(f => f.t === 'lantern')) { const g = new THREE.Group(); // a stone lantern: base, post, a ledge, the lit firebox, a hipped roof with snow on it
        part(g, new THREE.CylinderGeometry(0.3, 0.36, 0.14, 8), ST, 0, 0.07, 0); part(g, new THREE.CylinderGeometry(0.11, 0.13, 0.7, 8), ST, 0, 0.49, 0);
        part(g, roundedBox(0.56, 0.1, 0.56, 0.04), ST, 0, 0.89, 0); part(g, roundedBox(0.4, 0.34, 0.4, 0.05), ST, 0, 1.11, 0);
        for (const ry of [0, Math.PI / 2]) part(g, new THREE.BoxGeometry(0.42, 0.15, 0.2), '#ffd27a', 0, 1.12, 0, { lit: true, ry });
        part(g, new THREE.ConeGeometry(0.5, 0.32, 4), ST, 0, 1.44, 0, { ry: Math.PI / 4 }); part(g, ball, '#f6f9fc', 0, 1.5, 0).scale.set(0.3, 0.09, 0.3); part(g, ball, ST, 0, 1.63, 0).scale.setScalar(0.07);
        halo(g, '#ffcf7a', 2.2, 0, 1.12, 0); put(g, f.x, f.z, rnd() * 0.6, 0.45, heightAt(f.x, f.z) - 0.04, 1.7); }
      for (const f of F.filter(f => f.t === 'deck')) { const [x0, x1, z0, z1] = f.r, g = new THREE.Group(), y = Math.max(...[[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].map(([x, z]) => heightAt(x, z)));
        for (let z = z0 + 0.2, i = 0; z < z1 - 0.1; z += 0.4, i++) part(g, roundedBox(x1 - x0, 0.06, 0.36, 0.02), WOOD[i % 2], 0, 0.01, z - (z0 + z1) / 2);
        for (const sx of [-1, 1]) part(g, roundedBox(0.14, 0.12, z1 - z0, 0.03), '#9c7044', sx * ((x1 - x0) / 2 - 0.1), -0.05, 0); // the beams under it
        put(g, (x0 + x1) / 2, (z0 + z1) / 2, 0, 0, y + 0.02); occupied.pop(); } // walked on (a hair over the ground)
      const cane = [0.62, 0.67, 0.72].map(hh => new THREE.CylinderGeometry(0.055, 0.06, hh, 7));
      for (const f of F.filter(f => f.t === 'fence')) { const g = new THREE.Group(); g.userData.zk = k; scene.add(g); fx.push(g); // a low bamboo fence: canes, two rails along every four
        for (let i = 1; i < f.pts.length; i++) { const [ax, az] = f.pts[i - 1], [bx, bz] = f.pts[i], l = Math.hypot(bx - ax, bz - az), n = Math.round(l / 0.18), ry = -Math.atan2(bz - az, bx - ax), rail = new THREE.CylinderGeometry(0.035, 0.035, l / n * 4 + 0.06, 6);
          const P = j => [ax + (bx - ax) * j / n, az + (bz - az) * j / n];
          for (let j = 0; j <= n; j++) { const [x, z] = P(j), hh = 0.62 + (j % 3) * 0.05; part(g, cane[j % 3], j % 2 ? '#b9c06a' : '#a9b25c', x, heightAt(x, z) + hh / 2 - 0.05, z); if (j % 4 === 0) occupied.push({ x, z, r: 0.45, h: 0.7 }); }
          for (let j = 0; j + 4 <= n; j += 4) { const [x, z] = P(j + 2), y = heightAt(x, z); for (const hy of [0.22, 0.48]) part(g, rail, '#8d9a4a', x, y + hy, z, { rz: Math.PI / 2, ry }); } } }
      const tub = lathe([[0, 0], [0.16, 0], [0.19, 0.24], [0.165, 0.245], [0.15, 0.05], [0, 0.05]], 16);
      for (const f of F.filter(f => f.t === 'buckets')) { const g = new THREE.Group(); // two tubs, one upside down on them, a ladle leaning on it
        part(g, tub, WOOD[0], -0.2, 0, 0); part(g, tub, WOOD[1], 0.2, 0, 0.02); part(g, tub, WOOD[0], 0, 0.5, 0, { rx: Math.PI });
        for (const [x, y] of [[-0.2, 0.06], [0.2, 0.06], [0, 0.44]]) part(g, new THREE.CylinderGeometry(0.185, 0.185, 0.03, 16), '#7a5a3a', x, y + 0.1, 0);
        part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), '#d8b47a', 0.36, 0.3, 0.12, { rz: 0.35 }); part(g, new THREE.CylinderGeometry(0.07, 0.06, 0.08, 10), '#d8b47a', 0.25, 0.05, 0.12);
        put(g, f.x, f.z, rnd() * 6, 0.45, heightAt(f.x, f.z) - 0.02, 0.6); }
      steam129(V3, V4);
    }
    function steam129(V3, V4) { // (139-3 V3: white, starts higher and narrower: only columns going up, nothing lying on the rocks) over each pool 2-4 slow columns, 5 puffs each (9 s up 5 m, 1.2 -> 4 m wide); 8 small ones over the heads in it
      const cols = [];
      for (const p of pools) { const n = V4 ? (p.r > 2.3 ? 3 : 2) : Math.max(2, Math.min(4, Math.round(p.r))), y = waterAt(p); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rnd(), d = (0.3 + 0.5 * rnd()) * wl(p); cols.push({ x: p.x + Math.cos(a) * d, y, z: p.z + Math.sin(a) * d, ph: rnd() }); } }
      const PER = V4 ? 6 : 5, N = cols.length * PER + 8, aA = new THREE.InstancedBufferAttribute(new Float32Array(N), 1), geo = new THREE.PlaneGeometry(1, 1); geo.setAttribute('aA', aA);
      const color = { value: new THREE.Color() }, mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: softTex() }, color },
        vertexShader: `attribute float aA; varying float vA; varying vec2 vUv;
#include <fog_pars_vertex>
void main() { vUv = uv; vA = aA; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); mvPosition.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA; varying vec2 vUv;
#include <fog_pars_fragment>
void main() { ${V4 ? 'vec2 p = vUv * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard; float l = clamp(dot(vec3(p, sqrt(1.0 - r2)), vec3(-0.42, 0.7, 0.58)), 0.0, 1.0); float e = 1.0 - r2; gl_FragColor = vec4(color * mix(vec3(0.9, 0.92, 0.96), vec3(1.06), l), e * e * vA); // 140: each puff soft, lit top-left (seen on the white snow); no hard rim or dark side, or they read as grey balls\n' : `gl_FragColor = vec4(color * ${V3 ? 'mix(vec3(0.86, 0.9, 0.96), vec3(1.06), smoothstep(0.0, 0.75, vUv.y))' : 'mix(vec3(0.83, 0.87, 0.93), vec3(1.04), smoothstep(0.1, 0.8, vUv.y))'}, texture2D(map, vUv).a * vA); // shaded under: a puff, not a smear`}
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}` });
      const im = new THREE.InstancedMesh(geo, mat, N); im.renderOrder = 2; im.frustumCulled = false; scene.add(im);
      const white = new THREE.Color('#f4f6f8'), warm = new THREE.Color('#ffc98a'), A = aA.array, fin = t => k === popK ? popIn(t) : 1;
      ups.push((t, ctx) => {
        color.value.copy(white).multiply(skyLit.value).lerp(warm, (V4 ? 0.4 : 0.3) * nightGlow.value); // lit by the sky; at night a little warm from the lanterns
        const th = (1 + 0.5 * Math.min(1, ctx?.rain || 0)) * fin(t); let i = 0; // cold wet air: thicker
        for (const c of cols) for (let j = 0; j < PER; j++, i++) { const u = (t / (V4 ? 14 : 9) + c.ph + j / PER) % 1, w = Math.sin(t * 0.13 + c.ph * 6) * 0.6 * u;
          if (V4) { const sz = 1.1 + u * 2.4; im.setMatrixAt(i, _m.compose(_p.set(c.x + w * 0.4, c.y + 1.3 + u * 7, c.z + w * 0.2), _q.identity(), _s.set(sz, sz * 1.35, 1))); A[i] = 0.8 * th * sm((u - 0.03) / 0.15) * (1 - u) ** 1.3; continue; } // 140: thick, slow, each puff shaded round (lit top-left)
          if (V3) { im.setMatrixAt(i, _m.compose(_p.set(c.x + w * 0.5, c.y + 0.9 + u * 6, c.z + w * 0.2), _q.identity(), _s.set(0.7 + u * 1.9, (0.7 + u * 1.9) * 1.5, 1))); A[i] = 0.85 * th * sm((u - 0.04) / 0.2) * (1 - u) ** 1.3; continue; }
          im.setMatrixAt(i, _m.compose(_p.set(c.x + w, c.y + 0.5 + u * 6, c.z + w * 0.4), _q.identity(), _s.setScalar(1.1 + u * 2.2))); A[i] = 0.6 * th * sm(u / 0.15) * (1 - u) ** 1.2; }
        let h = 0;
        for (const q of SOAK.values()) for (let j = 0; j < 2 && h < 8; j++, h++, i++) { const u = (t / 2.6 + j / 2 + h * 0.37) % 1;
          im.setMatrixAt(i, _m.compose(_p.set(q.x, q.y + 0.05 + u * 0.8, q.z), _q.identity(), _s.setScalar(0.3 + u * 0.6))); A[i] = 0.5 * Math.sin(u * Math.PI); }
        for (; i < N; i++) A[i] = 0;
        im.instanceMatrix.needsUpdate = true; aA.needsUpdate = true;
      });
    }
    function steam(px, py, pz, pr) { // little puffs rising off the warm water, growing and fading
      const tex = softTex(), puffs = [];
      for (let i = 0; i < 9; i++) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }), sp = new THREE.Sprite(m); sp.renderOrder = 2; scene.add(sp); const a = rnd() * 6.28, d = rnd() * pr * 0.8; puffs.push({ sp, x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d, ph: i / 9 }); }
      ups.push(t => { for (const p of puffs) { const u = (t / 4 + p.ph) % 1; p.sp.position.set(p.x + Math.sin(u * 3 + p.ph * 9) * 0.2, py + 0.2 + u * 1.6, p.z); p.sp.scale.setScalar(0.6 + u * 1.3); p.sp.material.opacity = 0.5 * Math.sin(u * Math.PI); } });
    }
    // 143 B (?z143=1, zones.js reeds143): tall reed beds (2.4-3.4 m, two to three ducks high: a wall seen from afar, not a low
    // band like the grass), thick on the channel's east bank and round its two pockets (the swimmers hide there; thin on the
    // camera's side, so one is seen in them), in clumps on the west bank; cattails on the waterlines; a zigzag boardwalk on piles
    // over the channel (high enough to swim under), a dock with a lantern and the little boat, the duck's nest on its mound, heaps
    // of half sunk stones, fireflies over the water at night. The reeds and the cattails one instanced mesh each (they sway; on
    // 129's opening they grow up, from the old ground's side outward). Its own stream (the strip's planting keeps rnd's)
    function reeds143z() {
      let s3 = 1430 + k; const r3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; }, j3 = kit(L, { rand: r3, heightAt, occupied }).jitter;
      const F = Z.F.filter(f => f.zone === s.id), one = t => F.find(f => f.t === t), [ch, ...pk] = Z.rills.filter(q => q.zone === s.id), P = ch.pts, cw = ch.w - 0.4;
      // the channel's middle at z (its points run down z); its water there (as meadow/water.js's ribbon)
      const cx = z => { let i = 1; while (i < P.length - 1 && P[i][1] < z) i++; const a = P[i - 1], b = P[i], t = Math.min(1, Math.max(0, (z - a[1]) / (b[1] - a[1]))); return a[0] + (b[0] - a[0]) * t; };
      const lvl = z => { const c = cx(z); return Math.min(heightAt(c - cw, z), heightAt(c + cw, z)) + 0.03; };
      const walk = one('walk143').pts, nest = one('nest143'), dock = one('dock143'), boat = one('boat143'), dk = [[dock.x, dock.z], [cx(dock.z) - cw + 0.9, dock.z]];
      heaps(F, r3, j3);
      { const g = new THREE.Group(), twig = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), egg = new THREE.SphereGeometry(1, 12, 9); // the duck's nest: a ring of dry reeds, twigs on its rim, three eggs (swim.js: the duck sits in it)
        part(g, new THREE.TorusGeometry(0.42, 0.17, 8, 20), '#a8814a', 0, 0.1, 0, { rx: Math.PI / 2 }).scale.set(1, 1, 0.65);
        part(g, new THREE.CircleGeometry(0.4, 16), '#7a5a34', 0, 0.06, 0, { rx: -Math.PI / 2 });
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + r3() * 0.4; part(g, twig, i % 2 ? '#9a7444' : '#c4a066', Math.cos(a) * 0.45, 0.18, Math.sin(a) * 0.45, { ry: -a - Math.PI / 2 + (r3() - 0.5) * 0.8, rz: Math.PI / 2 - 0.12 }); }
        for (const [x, z, a] of [[0.07, 0.05, 0.3], [-0.1, 0.03, 2.1], [0.02, -0.11, 4.0]]) part(g, egg, '#f6efdc', x, 0.13, z, { ry: a, rz: Math.PI / 2 - 0.2 }).scale.set(0.085, 0.11, 0.085);
        put(g, nest.x, nest.z, r3() * 6, 0.55, lowest(nest.x, nest.z, 0.6) - 0.03, 0.4); }
      // the boardwalk and the dock: planks across the way every 0.3 m, over the water high enough to swim under, piles under every
      // fourth there (the dock's end: two tall mooring posts). Walked over and under: not in occupied
      const WOOD = ['#c98c52', '#b9804a'], plank = roundedBox(1.15, 0.07, 0.26, 0.025), pile = new THREE.CylinderGeometry(0.07, 0.08, 1, 8), g = new THREE.Group(); g.userData.zk = k; scene.add(g); fx.push(g);
      const deck = (pts, end) => { for (let i = 1, j = 0; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l, ry = Math.atan2(-uz, ux) + Math.PI / 2;
        for (let d = i > 1 ? 0.3 : 0.15; d < l; d += 0.3, j++) { const x = ax + ux * d, z = az + uz * d, gy = heightAt(x, z), y = Math.max(gy + 0.05, lvl(z) + 0.7 - 0.6 * Math.max(0, polyD(x, z, P) - ch.w)), last = end && d + 0.3 >= l;
          part(g, plank, WOOD[j % 2], x, y, z, { ry: ry + (r3() - 0.5) * 0.06 });
          if ((j % 4 === 2 || last) && y - gy > 0.2) for (const sg of [-1, 1]) { const px = x - uz * sg * 0.5, pz = z + ux * sg * 0.5, py = heightAt(px, pz) - 0.3, top = y + (last ? 0.75 : 0.3); part(g, pile, '#8a5a34', px, (py + top) / 2, pz).scale.y = top - py; } } } };
      deck(walk); deck(dk, true);
      fixture('lantern', dock.x + 0.3, dock.z - 0.8, 0, 0.35, undefined, 2);
      fixture('boat', boat.x, boat.z, 0.25 - (Math.PI / 2 - 0.35), 1.0, lvl(boat.z) + 0.02, 0.5).scale.setScalar(1.2); // moored off the dock's end, along the channel (r 1.0: the swimmers go round)
      // the reed clump (three stems, a tan plume each, a leaf) and the cattail clump (two stems, a brown head and a tip each, two
      // leaves): each part made upright from 0, then leaned and turned; their colours in the vertices (x the instance's)
      const col = (geo, hex) => { const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
      const M4 = new THREE.Matrix4(), E = new THREE.Euler(), stem = (H, lean, yaw, ox, oz, parts) => { M4.makeRotationFromEuler(E.set(0, yaw, lean, 'YZX')).setPosition(ox, 0, oz); return parts.map(p => p.applyMatrix4(M4)); };
      const blade = (h, y, a, c) => col(new THREE.ConeGeometry(0.05, 1, 3, 1, true).scale(1, h, 0.3).translate(0, h / 2, 0).rotateZ(0.5).rotateY(a).translate(0, y, 0), c);
      const reedGeo = merge([[3.0, 0, 0, 0.06, 0], [2.7, 0.14, 0.1, 0.1, 2.2], [2.4, -0.12, 0.12, 0.12, 4.2]].flatMap(([H, ox, oz, lean, yaw]) => stem(H, lean, yaw, ox, oz, [
        col(new THREE.CylinderGeometry(0.018, 0.03, H, 3, 1, true).translate(0, H / 2, 0), '#9aa95a'),
        col(new THREE.SphereGeometry(1, 6, 4).translate(0, 1, 0).scale(0.1, 0.34, 0.1).rotateZ(0.55).translate(0, H - 0.08, 0), '#c9a46c'), blade(1.1, H * 0.3, yaw + 1, '#86a24a')])));
      const tailGeo = merge([[1.9, 0, 0, 0.05, 0], [1.6, 0.12, -0.08, 0.1, 3]].flatMap(([H, ox, oz, lean, yaw]) => stem(H, lean, yaw, ox, oz, [
        col(new THREE.CylinderGeometry(0.016, 0.024, H, 3, 1, true).translate(0, H / 2, 0), '#5d9a3a'), col(new THREE.CapsuleGeometry(0.06, 0.3, 1, 6).translate(0, H - 0.25, 0), '#8b5a2b'),
        col(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 3, 1, true).translate(0, H + 0.06, 0), '#6d8a3a'), blade(1.3, 0.05, yaw + 0.5, '#5d9a3a'), blade(1.1, 0.05, yaw + 2.6, '#6aa840')])));
      // where: not on the boardwalk, the dock, the nest, the boat, a spot, a heap (all its stones); a pocket's camera side (seen: a swimmer in it shows)
      const HP = F.filter(f => f.t === 'heap143');
      const out = (x, z, m) => polyD(x, z, walk) > 0.95 + m && polyD(x, z, dk) > 1.0 + m && Math.hypot(x - nest.x, z - nest.z) > 2.6 && Math.hypot(x - boat.x, z - boat.z) > 1.8 && !nearSpot(x, z, 0.5)
        && !HP.some(h => Math.hypot(x - h.x, z - h.z) < 2.2 * (h.sc || 1) + m) && !occupied.some(o => o.r > 0.25 && Math.hypot(x - o.x, z - o.z) < o.r + m);
      const seen = (x, z, m) => pk.some(q => polyD(x, z, q.pts) < q.w + m && z > q.pts.at(-1)[1] - 0.2), T = [], C = [], occ = [], TINT = ['#ffffff', '#f6f1e2', '#eef5dc', '#fbf3e6'];
      // the reeds on a 0.72 m grid (jittered): the east bank a wall (thin on a pocket's camera side, low in front by the boat), the
      // west bank in thick clumps along the water (none further off: lone stalks read as weeds). The wall's deep part kept to (r 1.0 every 1.6 m: no one walks into it; off the water)
      for (let gx = r[0] + 0.4; gx < r[1] - 1.3; gx += 0.72) for (let gz = back + 1; gz < r[3] - 1; gz += 0.72) {
        const x = gx + (r3() - 0.5) * 0.6, z = gz + (r3() - 0.5) * 0.6, w = Z.wd(x, z), c = cx(z), east = x > c + ch.w - 0.2 || z < P[0][1] + 3, pc = east && seen(x, z, 2.6);
        if (w < 0.15 || !inRect(r, x, z, 0.3) || !out(x, z, 0.3)) continue;
        const p = !east ? (Math.abs(x - c) < 3.4 && Math.sin(z * 0.55) + 0.6 * Math.sin(z * 0.23 + 1.3) > 0.1 ? 0.85 : 0) : pc ? 0.35 : z > 35 ? 0.25 : 0.9;
        if (r3() >= p) continue;
        T.push({ x, y: lowest(x, z, 0.25) - 0.05, z, s: pc ? 0.55 + r3() * 0.1 : east ? 0.85 + r3() * 0.3 : 0.65 + r3() * 0.25, ry: r3() * 6.283, rx: (r3() - 0.5) * 0.08, rz: (r3() - 0.5) * 0.08, c: TINT[Math.floor(r3() * 4)] });
        if (east && !pc && w > 1.7 && !occ.some(o => Math.hypot(x - o.x, z - o.z) < 1.6)) occ.push({ x, z, r: 1.0, h: 3 }); }
      for (const f of [ch, ...pk]) for (let i = 1; i < f.pts.length; i++) { const [ax, az] = f.pts[i - 1], [bx, bz] = f.pts[i], l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l, nz = (bx - ax) / l, w0 = f.w - 0.4; // cattails on the waterlines
        for (let d = 0; d < l; d += 0.5) for (const sg of [-1, 1]) { if (r3() > 0.45) continue; const e = w0 + 0.05 + r3() * 0.45, x = ax + (bx - ax) * d / l + nx * sg * e, z = az + (bz - az) * d / l + nz * sg * e;
          if (Z.wd(x, z) < 0 || !inRect(r, x, z, 0.3) || seen(x, z, 1.0) || !out(x, z, 0.1)) continue; C.push({ x, y: lowest(x, z, 0.2) - 0.04, z, s: 0.85 + r3() * 0.3, ry: r3() * 6.283, rx: 0, rz: 0, c: TINT[Math.floor(r3() * 4)] }); } }
      occupied.push(...occ);
      const mat = addSway(toyMat('#ffffff', { roughness: 0.75, vertexColors: true }), 0.03, 1.0), ims = [[reedGeo, T], [tailGeo, C]].map(([geo, Q]) => { const im = instanced(geo, mat, Q); scene.add(im); return [im, Q]; }); // per build (freed with the scene)
      if (k === popK) { let done = false; // 129: up out of the ground, from the old ground's side outward (as its fixtures pop), then their shadows
        const pose = f => { let left = 0; for (const [im, Q] of ims) { Q.forEach((q, i) => { const v = f(q); left += v !== 1; _e.set(q.rx, q.ry, q.rz); im.setMatrixAt(i, _m.compose(_p.set(q.x, q.y, q.z), _q.setFromEuler(_e), _s.set(q.s, q.s * Math.max(1e-3, v), q.s))); }); im.instanceMatrix.needsUpdate = true; } return left; };
        pose(() => 0); ups.push((t, ctx) => { if (done) return; const left = pose(q => { const u = (t - pop.t0 - 1.0 - (q.x - r[0]) / (r[1] - r[0]) * 1.4) / 0.5; return u <= 0 ? 0 : easeB(u); }); if (!left) { done = true; if (ctx) ctx.shade = true; } }); }
      const ff = fireflies(scene, { walkable: () => true, heightAt }, 28, () => { const z = -26 + r3() * 60; return [cx(z) + (r3() - 0.3) * 4, z]; }); // over the channel at night
      ups.push((t, ctx) => ff(t, ctx?.night ?? 0));
    }
    own[s.id]?.();
    // the zone's sign: near its edge with the old board, facing the camera, on open ground
    const su = s.side === '+z' ? 0.15 : 0.12, sv = s.side === '+z' ? [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74] : [0.7, 0.62, 0.54, 0.46, 0.38, 0.3];
    const g3 = z143on(s.id) && Z.F.find(f => f.zone === s.id && f.t === 'sign143'); // 143 B: the fork's own, where the home view sees it (its middle is water)
    if (g3) { signs.push({ x: g3.x, z: g3.z, y: heightAt(g3.x, g3.z), ry: 0, name: ZONES[hab][k - 1].name }); occupied.push({ x: g3.x, z: g3.z, r: 0.9, h: 1.4 }); }
    else sign: for (const u of [su, su + 0.12]) for (const v of sv) { const [x, z] = at(u, v); if (!free(x, z, 0.9) || nearSpot(x, z, 0.4)) continue;
      signs.push({ x, z, y: heightAt(x, z), ry: s.side === '+x' ? -0.4 : s.side === '-x' ? 0.4 : 0, name: ZONES[hab][k - 1].name }); occupied.push({ x, z, r: 0.9, h: 1.4 }); break sign; }
    // the mix (a side strip's front part, or the whole of a +z strip)
    const n = v => Math.round(A / 100 * (v || 0));
    if (mix.tree) place(n(mix.tree), (x, z) => low(1.5, x, z) && !(w3 || m3 || d3 || e3 ? fore4 : fore3)(x, z), (x, z) => tree(x, z, (snow ? 0.85 : 1) + rnd() * 0.35));
    if (mix.bush && !z3) place(n(mix.bush), (x, z) => low(0.9, x, z) && !fore4(x, z), (x, z) => N.add('bush', nk.bush, x, z, 0.9 + rnd() * 0.4));
    if (mix.rock && !z3 && !f3 && !(S129 === 4 && s.id === 'hotspring')) place(n(mix.rock), // 141 D: no strewn rocks round the spring (its stones are in heaps)
       (x, z) => low(1, x, z) && !fore4(x, z), (x, z) => snow ? rock(x, z, 0.4 + rnd() * 0.45) : N.add('rock', nk.rock, x, z, 0.55 + rnd() * 0.5));
    if (mix.fern) place(n(mix.fern), (x, z) => low(0.5, x, z), (x, z) => K.fern(x, z, 0.8 + rnd() * 0.5)); // 14-3
    if (z3) { /* own.flowerhill has its own */ } else if (mix.fl && mix.drift) { // inbox 67-3 the flower hill: no carpet. Drifts of small flower bushes in the grass, one colour
      // each (of three), thick at a drift's middle and thinning out, sparse toward the strip's edges
      const z0 = Math.max(r[2], back + 2.4), D = Array.from({ length: mix.drift }, (_, i) => ({ x: r[0] + 2 + rnd() * (r[1] - r[0] - 4), z: z0 + 2 + rnd() * (r[3] - z0 - 4), pi: DRIFT_PAL[i % DRIFT_PAL.length] }));
      const near = (x, z) => D.reduce((b, d) => { const g = Math.exp(-((x - d.x) ** 2 + (z - d.z) ** 2) / (2 * (2.2 * UNIT) ** 2)); return g > b.g ? { g, d } : b; }, { g: 0, d: D[0] });
      const edge = (x, z) => Math.min(1, Math.max(0, Math.min(x - r[0], r[1] - x, z - z0, r[3] - z) / (3 * UNIT)));
      place(n(mix.fl), (x, z) => low(0.4, x, z) && rnd() < near(x, z).g * edge(x, z), (cx, cz) => { const pi = near(cx, cz).d.pi; N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rnd, jitter, heightAt); });
    } else if (mix.fl) place(n(mix.fl), (x, z) => low(0.4, x, z) && !fore(x, z), (cx, cz) => { const pi = Math.floor(rnd() * flowerPal.length); N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rnd, jitter, heightAt); });
    if (mix.grass) N.bare(() => place(Math.round(A * 1.1 * mix.grass), (x, z) => inRect(r, x, z, 0.4), (x, z) => {
      const w = Z.wd(x, z), bank = w > -0.1 && w < 0.7;
      if ((!bank && !free(x, z, 0)) || (bank && rnd() < 0.6)) return;
      L.grass.push({ x, y: heightAt(x, z) - 0.03, z, s: bank ? 1.6 + rnd() * 0.6 : 0.8 + rnd() * 0.6, big: bank, ry: rnd() * 6, c: jitter(bank ? '#4f9032' : pickOf(GREENS), 0.06) });
    }));
  }
  if (Lr.stem.length) addReeds(scene, Lr);
  if (pads.length) addPads(scene, pads);
  const fruitM = fruit.length ? instanced(new THREE.SphereGeometry(1, 10, 7), toyMat('#ffffff', { roughness: 0.35 }), fruit, { cast: false }) : null; if (fruitM) scene.add(fruitM);
  const capM = caps.length ? instanced(new THREE.SphereGeometry(1, 14, 8), toyMat('#ffffff', { roughness: 0.62 }), caps, { cast: false }) : null; if (capM) scene.add(capM);
  const slabM = slabs.length ? instanced(slabGeo(), partGeos().mat.rock, slabs) : null; if (slabM) scene.add(slabM); // 141 D: the spring's flat stones (the rocks' own material: snow on their tops in snow)
  if (crystals.length) scene.add(instanced(new THREE.CylinderGeometry(0.6, 1, 1, 6), toyMat('#ffffff', { roughness: 0.12, transparent: true, opacity: 0.88 }), crystals));
  if (shells.length) scene.add(instanced(new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), toyMat('#ffffff', { roughness: 0.4 }), shells, { cast: false }));
  if (orchard.length) ups.push(drops(scene, orchard, heightAt));
  // q1 과수원 나무 흔들기 (?z143=1): one butts the trunk (walk.js treeshake sets f.shake: where it stands, its facing): the crown's
  // blobs and fruit shiver side to side a while (instances moved off where they were and back; one made see-through, zeroed by
  // habitat.js, is left alone), and a fruit drops beside it (drops' drop), on the view's side, as the shiver ends
  // q1 침엽수 숲 눈 털기: a fir's tiers and their snow shiver the same way, and as the butts end a puff of snow falls off its boughs
  // onto the one at its trunk (clumps that drop, lie a moment and melt away: one InstancedMesh for the zone); it shakes it off (walk.js)
  if (shake.length) { const D = orchard.length ? ups.at(-1).drop : null, mv = (im, [i0, i1], b, dx, dz) => { if (!im) return; for (let i = i0; i < i1; i++) { im.getMatrixAt(i, _m); const e = _m.elements; if (!e[0] && !e[5]) continue;
      const p = b.get(i) ?? b.set(i, [e[12], e[14]]).get(i); e[12] = p[0] + dx; e[14] = p[1] + dz; im.setMatrixAt(i, _m); } im.instanceMatrix.needsUpdate = true; };
    const PUFF = 14, puff = [], puffM = shake.some(q => q.c2) ? new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), toyMat('#f6f9fc', { roughness: 0.62 }), PUFF * 2) : null; let lt = null;
    if (puffM) { puffM.count = 0; puffM.visible = false; puffM.frustumCulled = false; scene.add(puffM); } // as the zone's other meshes: gone with the habitat (habitat.js dispose: its GL context lost)
    ups.push(t => { const dt = Math.min(0.1, Math.max(0, t - (lt ?? t))); lt = t; for (const q of shake) { if (q.f.shake && q.t0 == null) { q.who = q.f.shake; q.t0 = t; q.dropped = false; } q.f.shake = null; if (q.t0 == null) continue;
      const u = t - q.t0, e = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.5) / 1.7))), dx = 0.13 * e * Math.sin(u * 31), dz = 0.07 * e * Math.sin(u * 23 + 1);
      mv(L.mesh?.[q.k], q.c, q.b, dx, dz); if (q.q) mv(fruitM, q.q, q.b2 ??= new Map(), dx * 1.3, dz * 1.3); if (q.c2) mv(L.mesh?.snow, q.c2, q.b3 ??= new Map(), dx, dz);
      if (q.c2 && !q.dropped && u > 1.0) { q.dropped = true; const w = q.who; for (let i = 0; i < PUFF && puff.length < PUFF * 2; i++) { const a = Math.random() * 6.283, d = Math.random() * 0.75;
        const x = w.x + Math.cos(a) * d, z = w.z + Math.sin(a) * d, s2 = 0.07 + Math.random() * 0.08; puff.push({ x, y: q.yb + Math.random() * 0.25, z, g: heightAt(x, z) + s2 * 0.5, v: -Math.random() * 0.6, s: s2, t: 0 }); } }
      else if (!q.c2 && !q.dropped && u > 1.9) { q.dropped = true; const w = q.who, fx = Math.cos(w.yaw), fz = -Math.sin(w.yaw), sg = fx >= 0 ? 1 : -1; // to its side, toward the view (+z)
        D(q.T, w.x - fz * sg * 0.95 + fx * 0.2, w.z + fx * sg * 0.95 + fz * 0.2, t); }
      if (u > 2.3) q.t0 = null; }
      if (!puffM || !puff.length && !puffM.visible) return; for (let i = puff.length - 1; i >= 0; i--) { const p = puff[i]; // falls, lies 0.9 s, melts 0.6 s
        if (p.y > p.g) { p.v -= 9.8 * dt; p.y = Math.max(p.g, p.y + p.v * dt); } else if ((p.t += dt) > 1.5) puff.splice(i, 1); }
      puff.forEach((p, i) => { const k = p.s * Math.min(1, (1.5 - p.t) / 0.6); puffM.setMatrixAt(i, _m.makeScale(k, k * 0.8, k).setPosition(p.x, p.y, p.z)); });
      puffM.count = puff.length; puffM.visible = puff.length > 0; puffM.instanceMatrix.needsUpdate = true; }); }
  // 129 넓히는 순간: the opened zone's fixtures each merged on their own, from nothing up past full and back (one after another
  // from the old ground's side outward, as the mist draws back), a 「통」 each; the rest as one
  const popG = popK ? fx.filter(g => g.userData.zk === popK && !new THREE.Box3().setFromObject(g).isEmpty()) : [], rest = popG.length ? fx.filter(g => !popG.includes(g)) : fx;
  if (rest.length) scene.add(mergeByMat(rest));
  const [ax, sg1] = popK ? { '+x': ['x', 1], '-x': ['x', -1], '+z': ['z', 1], '-z': ['z', -1] }[strip(hab, popK).side] : [], pops = popG.map(g => { const b = new THREE.Box3().setFromObject(g), m = mergeByMat([g]);
    for (const c of [...g.children]) m.attach(c); g.removeFromParent(); scene.add(m); // what it kept (a lantern's halo) goes with it
    return { m, P: new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2), f: 0 }; }).sort((a, b) => (a.P[ax] - b.P[ax]) * sg1);
  const grow = (q, f) => { q.f = f; f = Math.max(1e-3, f); q.m.scale.setScalar(f); q.m.position.copy(q.P).multiplyScalar(1 - f); };
  pops.forEach(q => grow(q, 0));
  if (popK) REVEAL.skip = () => { pop.t0 = -1e9; pop.quiet = true; }; // a tap: all of it at once (habitat.js)
  const easeB = u => u >= 1 ? 1 : 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2; // back-ease out: past full and back
  const popUp = (t, ctx) => pops.forEach((q, i) => { if (q.f === 1) return; const u = (t - pop.t0 - 1.3 - 0.18 * i) / 0.45; if (u <= 0) return;
    if (!q.f && !pop.quiet) sfx('pop'); grow(q, easeB(u)); if (q.f === 1 && ctx) ctx.shade = true; }); // settled: its shadow (habitat.js)
  const R = pop.rocks, RS = pop.slabs, rockUp = (t, ctx) => { const im = L.mesh?.rock; if (!im) return; let left = 0; const n = R.length + RS.length; // the rim's stones round each pool in turn, 0.9-2.1 s (the curtain is off at 0.5)
    const one = (m, q, j, i) => { const u = (t - pop.t0 - 0.9 - 1.2 * i / n) / 0.35; left += u < 1; _e.set(q.rx || 0, q.ry, q.rz || 0);
      m.setMatrixAt(j, _m.compose(_p.set(q.x, q.y, q.z), _q.setFromEuler(_e), _s.set(...q.s).multiplyScalar(q.f = Math.max(1e-3, u <= 0 ? 0 : easeB(u))))); };
    R.forEach((j, i) => one(im, L.rock[j], j, i)); RS.forEach((j, i) => one(slabM, slabs[j], j, R.length + i)); // 141 D: the flat stones too
    for (const [ci, j, S] of pop.caps) { const c = caps[ci], q = (S || L.rock)[j]; _e.set(0, c.ry, 0); capM.setMatrixAt(ci, _m.compose(_p.set(q.x, q.y + (c.y - q.y) * q.f, q.z), _q.setFromEuler(_e), _s.set(...c.s).multiplyScalar(q.f))); } // 139-3: its cap with it
    if (pop.caps.length) capM.instanceMatrix.needsUpdate = true;
    im.instanceMatrix.needsUpdate = true; if (slabM) slabM.instanceMatrix.needsUpdate = true; if (!left) { R.length = RS.length = 0; if (ctx) ctx.shade = true; } };
  const sg = signs.length ? signBoards(signs) : null; if (sg) scene.add(sg);
  return { update: (t, ctx) => { if (sg) sg.visible = PREFS.signs !== false; if (pop.t0 == null) pop.t0 = t; if (pops.length) popUp(t, ctx); if (R.length || RS.length) rockUp(t, ctx); for (const u of ups) u(t, ctx); } };
}

// the zone signs: two posts and a board each (merged), the names on one canvas, its text planes one mesh
function signBoards(list) {
  const g = new THREE.Group(), boards = [], lines = list.map(q => { const t = q.name; if (t.length <= 6) return [t]; let best = -1; // longer: split at the space nearest the middle
    for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (best < 0 || Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2))) best = i; return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)]; });
  const cell = ls => ls.length > 1 ? 200 : 128, H = lines.reduce((a, ls) => a + cell(ls), 0), c = document.createElement('canvas'); c.width = 512; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#4a2e1a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 70px system-ui, sans-serif';
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geos = []; let y0 = 0;
  list.forEach((q, i) => { const ls = lines[i], ch = cell(ls), bh = ls.length > 1 ? 0.8 : 0.55, top = 0.5 + bh, k = new THREE.Group();
    ls.forEach((t, j) => x.fillText(t, 256, y0 + ch / 2 + (j - (ls.length - 1) / 2) * 82, 490));
    for (const sx of [-0.7, 0.7]) part(k, roundedBox(0.1, top, 0.1, 0.03), '#8a5a34', sx, top / 2 - 0.05, -0.03);
    part(k, roundedBox(1.8, bh, 0.1, 0.04), '#c98c52', 0, 0.5 + bh / 2, 0);
    k.position.set(q.x, q.y, q.z); k.rotation.y = q.ry; boards.push(k);
    const pg = new THREE.PlaneGeometry(1.6, ch / 320), uv = pg.attributes.uv; for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (y0 + (1 - uv.getY(v)) * ch) / H);
    pg.translate(0, 0.5 + bh / 2, 0.052); k.updateMatrixWorld(true); geos.push(pg.applyMatrix4(k.matrixWorld)); y0 += ch; });
  g.add(mergeByMat(boards));
  const tm = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.8 })); tm.receiveShadow = true; g.add(tm);
  return g;
}

// 과수원: every 25-40 s a fruit drops from one of the trees, into the lane before or behind it (just past its footprint fr, where an
// animal can stand; 3 on the ground at most), and the nearest animal comes and eats it, running (habitat.js ctx.sendNear: the
// nearest idle one, walk.js send 'eat'); one no one came for shrinks away after 20 s (40 s while one is on its way)
function drops(scene, trees, heightAt) {
  const geo = new THREE.SphereGeometry(0.2, 10, 7), mat = toyMat('#e04a35', { roughness: 0.35 }), F = [];
  let next = -1;
  const drop = (T, x, z, t) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.position.set(x, T.y, z); scene.add(m);
    F.push({ m, x, z, t0: t, y0: T.y - 0.4, gy: heightAt(x, z) + 0.18, end: 0, eaten: false }); };
  const up = (t, ctx) => {
    if (next < 0) next = t + 10 + Math.random() * 10;
    if (t > next && F.length < 3) {
      next = t + 25 + Math.random() * 15;
      const T = trees[Math.floor(Math.random() * trees.length)], a = (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2 + (Math.random() - 0.5) * 0.8, d = T.fr + 0.15 + Math.random() * 0.3, x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
      drop(T, x, z, t);
    }
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i], k = t - f.t0, fall = Math.sqrt(2 * (f.y0 - f.gy) / 9.8);
      if (k < fall) { f.m.position.y = f.y0 - 4.9 * k * k; continue; }
      const b = k - fall; f.m.position.y = f.gy + Math.max(0, Math.sin(Math.min(1, b / 0.35) * Math.PI)) * 0.25 * (1 - Math.min(1, b / 0.35)); // one small bounce
      if (!f.end) f.end = t + (ctx?.sendNear?.(f.x, f.z, 'eat', { fast: true, done: ok => { if (ok) f.eaten = true; } }) ? 40 : 20);
      const s = f.eaten ? 0 : Math.min(1, (f.end - t) / 0.6);
      if (s <= 0) { scene.remove(f.m); F.splice(i, 1); } else f.m.scale.setScalar(s);
    }
  };
  up.drop = (T, x, z, t) => { if (F.length < 5) drop(T, x, z, t); }; // q1: a shaken tree's (zoneprops.js shake)
  return up;
}

// the fixtures never move: their meshes, baked to world space, become one mesh a material (a mushroom lamp alone was 8 draws);
// the night halos (sprites) stay where they are
function mergeByMat(gs) {
  const by = new Map(), out = new THREE.Group(), sps = new Map();
  for (const g of gs) { g.updateMatrixWorld(true); const ms = []; g.traverse(c => { if (c.isMesh) ms.push(c); else if (c.isSprite) (sps.get(c.material) || sps.set(c.material, []).get(c.material)).push(c); });
    for (const m of ms) { const geo = m.geometry.clone().applyMatrix4(m.matrixWorld), k = m.material.uuid + Object.keys(geo.attributes).sort() + !!geo.index;
      (by.get(k) || by.set(k, { mat: m.material, geos: [] }).get(k)).geos.push(geo); m.removeFromParent(); } }
  for (const { mat, geos } of by.values()) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = m.receiveShadow = true; out.add(m); }
  for (const l of sps.values()) if (l.length > 1) out.add(haloQuads(l));
  return out;
}
// inbox 34: the fixtures' halos (meadow/props.js halo: a sprite is a draw each) of one colour as one mesh, its quads turned to the
// camera in the vertex shader, the same look (additive, faded in with the night)
function haloQuads(sps) {
  const m0 = sps[0].material, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { map: { value: m0.map }, color: { value: m0.color }, uNight: nightGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * length(instanceMatrix[0].xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float uNight; varying vec2 vUv;
void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(color * t.rgb, t.a * 0.75 * uNight);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` }), sps.length);
  sps.forEach((s, i) => { im.setMatrixAt(i, s.matrixWorld); s.removeFromParent(); });
  im.renderOrder = 3; im.frustumCulled = false; return im;
}
