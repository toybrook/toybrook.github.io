// 28-1 what stands in each 땅 넓히기 zone (zones.js): the planting every strip gets (the back shelf's forest on a side strip,
// trees, bushes, rocks, flowers and grass at the zone's own mix) and the zone's own things. Only the zones open now: the one
// under mist stays bare. Its own random per zone, so the first board and the other zones come out as before. The trees,
// bushes, rocks and flowers are natives (ring: the zone's step, rules.js addNatives); the zone's fixtures are part of the board.
// inbox 34: each zone's landmark, big enough to read when the camera flies there (the grove's old tree, the fork's waterwheel,
// the orchard's rows, the lookout's gazebo and telescope, the mushroom path's giant toadstools, the reeds' banks, the falls'
// spray, the sandbar's shells and driftwood, the lotus pond, the isle's long bridge, the swamp's fog and stumps, the snow's
// blue pillars and sparkling ice), and a small wooden sign with the zone's name at its entrance (설정 「구역 팻말 보이기」).
import * as THREE from 'three';
import { strip, inRect, polyD, poolAt, ORCHARD_ROWS } from './zones.js';
import { ZONES, UNIT, NAT_K } from '../game/data.js';

const S = UNIT; // inbox 42 A: the old board's metres -> the world's
import { PREFS } from '../config.js';
import { kit, emptyL, flowerPal, flowerCluster, addPads, addReeds, decorModel, part } from './meadow/props.js';
import { toyMat, instanced, lathe, roundedBox, skyLit, nightGlow } from './toyKit.js';
import { fireflies } from './daylight.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';

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
const GREENS = ['#6aa83a', '#7cb843', '#5e9c35'];
let soft = null; // a soft round spot (fog, steam, mist; 14-3: the volcano's smoke, dino/props.js)
export const softTex = () => { if (soft) return soft; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return soft = new THREE.CanvasTexture(c); };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// hab: 'meadow' | 'pond' | 'snow' | 'dino'; o: { L, N (natives), heightAt, occupied, free (the open ground now), O (the open rect),
// Z (zoneSet), back (the back forest's front edge), cliff (meadow: the cliff's foot, for its rock ledge) }
export function zoneProps(scene, hab, o) {
  const { L, N, heightAt, occupied, free, O, Z, back } = o, snow = hab === 'snow', dino = hab === 'dino';
  const Lr = emptyL(), pads = [], fruit = [], caps = [], crystals = [], ups = [], orchard = [], fx = [], shells = [], signs = [];
  const nearSpot = (x, z, m) => Z.spots.some(s => Math.hypot(x - s.x, z - s.z) < s.r + m);
  for (let k = 1; k <= ZONES[hab].length; k++) {
    const s = strip(hab, k); if (!inRect(O, s.cx, s.cz)) continue;
    let sd = 7919 * k + (hab === 'pond' ? 31 : snow ? 57 : dino ? 71 : 3); const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
    const K = kit(L, { rand: rnd, heightAt, occupied }), nk = kit(N.Ls, { rand: rnd, heightAt, occupied }), R = kit(Lr, { rand: rnd, heightAt, occupied });
    const { pickOf, jitter } = K, r = s.r, A = (r[1] - r[0]) * (r[3] - r[2]), mix = MIX[s.id], at = (u, v) => s.pos(u, v);
    const ok = (x, z, m) => free(x, z, m) && !nearSpot(x, z, m + 0.3);
    const place = (n, okf, put) => { for (let i = 0, c = 0; c < n && i < n * 60; i++) { const x = r[0] + rnd() * (r[1] - r[0]), z = r[2] + rnd() * (r[3] - r[2]); if (okf(x, z)) { put(x, z); c++; } } };
    const rock = (x, z, sc) => { K.rock(x, z, sc); if (snow) { const q = L.rock.at(-1); caps.push({ x: q.x, y: q.y + q.s[1] * 0.78, z: q.z, s: [q.s[0] * 0.7, q.s[1] * 0.32, q.s[2] * 0.7], ry: q.ry, c: '#f6f9fc' }); } };
    const put = (g, x, z, ry = 0, rr = 1, y = heightAt(x, z), h = 1.2) => { g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); fx.push(g); occupied.push({ x, z, r: rr, h }); return g; };
    const fixture = (id, ...a) => put(decorModel(id), ...a);
    // n points d0..d1 out from a pool's middle line (a capsule's too), fn(x, z, the way out)
    const ringOf = (f, n, d0, d1, fn) => { for (let i = 0; i < n; i++) { const [x, z, cx, cz] = poolAt(f, (i + rnd() * 0.4) / n, d0 + rnd() * (d1 - d0)); fn(x, z, Math.atan2(z - cz, x - cx)); } };
    const pools = Z.pools.filter(f => f.zone === s.id), wl = f => f.r - (f.hot ? 0.7 : 0.4);
    const waterAt = f => { let y = Infinity; for (let i = 0; i < 32; i++) { const [x, z] = poolAt(f, i / 32, wl(f)); y = Math.min(y, heightAt(x, z)); } return y + 0.02; };
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
    // the zone's own things first (the mix fills round them)
    const own = {
      grove() { const [bx, bz] = at(0.55, 0.55); K.tree(bx, bz, 1.8); // the big old tree on its mossy rise
        for (const [u, v] of [[0.3, 0.16], [0.65, 0.28], [0.3, 0.42], [0.35, 0.72], [0.7, 0.78], [0.4, 0.93]]) { const [cx, cz] = at(u, v); for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.2, z = cz + (rnd() - 0.5) * 3.2; if (low(0.9, x, z)) tree(x, z, 0.95 + rnd() * 0.4); } }
        for (let i = 0; i < 3; i++) place(1, (x, z) => low(0.6, x, z), (x, z) => fixture('mushrooms', x, z, rnd() * 6, 0.6, undefined, 0.5)); },
      fork() { const f = Z.rills.find(q => q.zone === s.id), P = f.pts, w = f.w - 0.4;
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
        for (let z = -19 * S; z <= 29.1 * S; z += 4.8 * S) for (const c of ORCHARD_ROWS) { const x = r[0] + c, sc = 0.7; if (!free(x, z, 0)) continue; // inbox 42 C2: 0.58 -> 0.7 (x NAT_K.tree: 1.6H)
          const n0 = L.canopy.length; K.tree(x, z, sc, 5); const top = L.canopy[n0]; orchard.push({ x, z, y: top.y, fr: 1.7 * sc * NAT_K.tree }); // fr: past the crown's edge
          for (let j = 0; j < 5; j++) { const a = rnd() * 6.28, el = -0.1 + rnd() * 0.6, R2 = top.s[0] * 1.3; fruit.push({ x: x + Math.cos(a) * Math.cos(el) * R2, y: top.y + Math.sin(el) * R2 * 0.85, z: z + Math.sin(a) * Math.cos(el) * R2, s: 0.2, c: jitter('#e04a35', 0.06) }); } }
        const lad = new THREE.Group(), lk = new THREE.Group(); lk.rotation.x = -0.32; lad.add(lk); // leaning into the tree behind it
        for (const x of [-0.22, 0.22]) part(lk, roundedBox(0.07, 2.0, 0.07, 0.03), '#b07a48', x, 1.0, 0);
        for (let i = 0; i < 5; i++) part(lk, roundedBox(0.44, 0.05, 0.05, 0.02), '#b07a48', 0, 0.3 + i * 0.35, 0);
        put(lad, 30 * S + 0.3, 5 * S + 1.25, 0, 0.4, undefined, 2); // inbox 42 A: just behind the tree at (30, 5) old metres
        const bk = new THREE.Group(), bx = 31.3 * S, bz = 12.2 * S;
        part(bk, lathe([[0, 0], [0.22, 0], [0.3, 0.08], [0.34, 0.26], [0.31, 0.29], [0.27, 0.22], [0, 0.22]], 18), '#c9965f');
        part(bk, new THREE.TorusGeometry(0.3, 0.03, 6, 16, Math.PI), '#b5863a', 0, 0.28, 0);
        put(bk, bx, bz, 0.6, 0.45, undefined, 0.6);
        for (const [dx, dz] of [[0, 0], [0.12, 0.1], [-0.12, 0.08], [0.02, -0.13]]) fruit.push({ x: bx + dx, y: heightAt(bx, bz) + 0.3 + (dx ? 0 : 0.08), z: bz + dz, s: 0.13, c: jitter('#e04a35', 0.06) }); },
      lookout() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id); // on the flat top: a little gazebo and a telescope looking out
        fixture('gazebo', h.x, h.z - 0.8, 0, 2.1, undefined, 4.6).scale.setScalar(1.15); // inbox 42 C2: 0.85 -> 1.15 (hill and gazebo 3H)
        const tg = new THREE.Group(), leg = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 6);
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; part(tg, leg, '#8a5a34', Math.cos(a) * 0.14, 0.42, Math.sin(a) * 0.14, { rz: Math.cos(a) * 0.22, rx: -Math.sin(a) * 0.22 }); }
        part(tg, new THREE.SphereGeometry(0.07, 10, 8), '#5a4636', 0, 0.88, 0);
        const tilt = Math.PI / 2 - 0.3, ex = -Math.sin(tilt), ey = Math.cos(tilt);
        part(tg, new THREE.CylinderGeometry(0.1, 0.07, 0.8, 14), '#5a7fb0', 0, 0.98, 0, { rz: tilt });
        part(tg, new THREE.CylinderGeometry(0.108, 0.108, 0.08, 14), '#ffd54a', ex * 0.34, 0.98 + ey * 0.34, 0, { rz: tilt });
        put(tg, h.x + 1.0, h.z + 2.4, 0.5, 0.4, undefined, 1.2); },
      mushroom() { const f = Z.paths.find(q => q.zone === s.id), zOf = x => { let zc = 0, best = 99; for (let z = r[2]; z < r[3]; z += 0.2) { const d = polyD(x, z, f.pts); if (d < best) { best = d; zc = z; } } return zc; };
        for (let x = r[0] + 3, i = 0; x < r[1] - 2; x += 6, i++) { // glowing toadstool lamps along the path, either side
          out: for (const sg of i % 2 ? [1, -1] : [-1, 1]) for (const dx of [0, 1, -1]) { const X = x + dx, z = zOf(X) + sg * (f.w + 0.9); if (!ok(X, z, 0.3)) continue; fixture('mushlamp', X, z, rnd() * 6, 0.5, undefined, 1.4).scale.setScalar(1.6); break out; } }
        for (let x = r[0] + 4, j = 0; x < r[1] - 3; x += 7, j++) for (const dx of [0, 1.5, -1.5, 3]) { // giant toadstools, taller than the animals
          const X = x + dx, z = zOf(X) - (f.w + 2.6); if (!ok(X, z, 1.4)) continue; put(bigShroom(4.4 + rnd() * 1.4, j % 2 === 0), X, z, rnd() * 6, 0.95, undefined, 4.4); break; } }, // inbox 42 C2: x1.7 (1.5-2H)
      reeds() { for (const f of Z.rills.filter(q => q.zone === s.id)) for (let i = 1; i < f.pts.length; i++) { // reeds thick along every channel
          const a = f.pts[i - 1], b = f.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
          for (let d = 0; d < l; d += 0.6) for (const sg of [-1, 1]) { if (rnd() < 0.25) continue; const e = f.w - 0.25 + rnd() * 0.3, x = a[0] + dx / l * d + nx * sg * e, z = a[1] + dz / l * d + nz * sg * e; if (!nearSpot(x, z, 0.2)) R.tuft(x, z); } }
        place(40, (x, z) => ok(x, z, 0.3) && Z.wd(x, z) < 2.6, (x, z) => R.tuft(x, z)); },
      falls() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id); occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h }); // inbox 42 C2: no one climbs the 11 m cliff (the camera keeps out too)
        for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + rnd() * 0.3, x = h.x + Math.cos(a) * h.rx * 1.02, z = h.z + Math.sin(a) * h.rz * 0.98; if (free(x, z, 0.4) && !nearSpot(x, z, 0.3)) rock(x, z, 0.5 + rnd() * 0.5); }
        for (const p of pools) { ringOf(p, 4, wl(p) + 0.1, wl(p) + 0.6, (x, z) => { if (free(x, z, 0.3)) rock(x, z, 0.3 + rnd() * 0.25); });
          const fl = Z.falls.find(q => q.zone === s.id), dx = fl.from[0] - p.x, dz = fl.from[1] - p.z, l = Math.hypot(dx, dz); spray(p.x + dx / l * (wl(p) - 0.3), waterAt(p), p.z + dz / l * (wl(p) - 0.3)); } },
      sandbar() { for (let i = 0; i < 3; i++) place(1, (x, z) => ok(x, z, 1.1), (x, z) => put(drift(), x, z, rnd() * 6, 0.9, heightAt(x, z) - 0.04, 0.5)); // bleached driftwood
        for (let i = 0; i < 30; i++) { const [x, z] = at(0.12 + rnd() * 0.76, 0.05 + rnd() * 0.9); if (free(x, z, 0) && !nearSpot(x, z, -0.4)) shells.push({ x, y: heightAt(x, z) + 0.01, z, s: [0.2 + rnd() * 0.08, 0.08, 0.17 + rnd() * 0.06], ry: rnd() * 6, c: pickOf(['#f6c9c0', '#fff1df', '#f3d9b8', '#f2b8a8']) }); }
        for (let i = 0; i < 70; i++) { const [x, z] = at(0.15 + rnd() * 0.7, 0.05 + rnd() * 0.9); if (free(x, z, 0)) L.pebble.push({ x, y: heightAt(x, z) + 0.02, z, s: [0.14 + rnd() * 0.14, 0.07, 0.12 + rnd() * 0.1], ry: rnd() * 6, c: jitter(pickOf(['#d8cfb8', '#c9b991', '#b7c2bc', '#efe4c8']), 0.08) }); }
        for (const p of pools) ringOf(p, 3, wl(p) - 0.3, wl(p) + 0.2, (x, z) => R.tuft(x, z)); },
      lotus() { for (const p of pools) { const y = waterAt(p), w = wl(p); // one big pond full of pads and flowers
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
      conifer() { for (const [u, v] of [[0.3, 0.12], [0.65, 0.32], [0.35, 0.6], [0.7, 0.82], [0.3, 0.97]]) { const [cx, cz] = at(u, v); for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.2, z = cz + (rnd() - 0.5) * 3.2; if (low(1.3, x, z)) tree(x, z, 0.85 + rnd() * 0.45); } } },
      sled() { const f = Z.F.find(q => q.t === 'ramp' && q.zone === s.id); fixture('sled', f.x + 1.6, f.z1 + 1.2, 0.4, 0.8, undefined, 0.5); },
      pillars() { for (const f of Z.F.filter(q => q.t === 'col' && q.zone === s.id)) { const a0 = rnd() * 6.283; // tall blue ice pillars round each ice mound (its top stays the owl's perch)
        for (let j = 0; j < 4; j++) { const big = j < 2, a = a0 + j * 1.3 + rnd() * 0.3, d = f.r + (big ? 0.6 : 0.35), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = big ? 0.85 + rnd() * 0.2 : 0.5, hh = big ? 7.5 + rnd() * 3 : 2.2 + rnd() * 1; // inbox 42 C2: x3 / x2 (big 2.2-3.1H)
          crystals.push({ x, y: heightAt(x, z) + hh * 0.45, z, s: [sc, hh, sc], rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12, ry: rnd() * 6, c: pickOf(['#9fd0f0', '#7fc0ec', '#b5ddf5']) });
          if (big) occupied.push({ x, z, r: 0.85, h: hh }); } } },
      hotspring() { const p = pools[0]; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + rnd() * 0.15, d = p.r - 0.15; K.rock(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.32 + rnd() * 0.2); occupied.pop(); }
        steam(p.x, waterAt(p), p.z, wl(p)); },
      cave() { const h = Z.F.find(q => q.t === 'hill' && q.zone === s.id), x = h.x, z = h.z + h.rz * 0.9, y = Math.min(heightAt(x, z), heightAt(x - 2.6, z), heightAt(x + 2.6, z)); // inbox 42 C2: at the 10 m hill's foot, twice as big
        occupied.push({ x: h.x, z: h.z, r: 0.7 * Math.min(h.rx, h.rz), h: h.h }); // no one climbs the rock
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rnd() * 0.3, rx = h.x + Math.cos(a) * h.rx * 1.02, rz = h.z + Math.sin(a) * h.rz * 0.98; if (Math.abs(a - Math.PI / 2) > 0.6 && free(rx, rz, 0.4) && !nearSpot(rx, rz, 0.3)) rock(rx, rz, 0.6 + rnd() * 0.6); }
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
        ups.push(t => { im.material.color.copy(skyLit.value); for (let i = 0; i < n; i++) { const q = gl[i], k = Math.max(0, Math.sin(t * q.sp + q.ph)) ** 6; _q.setFromAxisAngle(_p.set(0, 1, 0), q.ph + t * 0.3); im.setMatrixAt(i, _m.compose(_p.set(q.x, y + 0.02, q.z), _q, _s.setScalar(k * 1.5 + 0.001))); } im.instanceMatrix.needsUpdate = true; }); },
      // ---- 14-3 the dino jungle ----
      fernwood() { for (const [u, v] of [[0.3, 0.15], [0.7, 0.3], [0.35, 0.5], [0.7, 0.68], [0.3, 0.84], [0.6, 0.97]]) { const [cx, cz] = at(u, v); // thick groves of tree ferns
          for (let i = 0; i < 4; i++) { const x = cx + (rnd() - 0.5) * 3.4, z = cz + (rnd() - 0.5) * 3.4; if (low(1.3, x, z)) tree(x, z, 0.9 + rnd() * 0.45); } } },
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
    function spray(x, y, z) { // white droplets bubbling up where the fall lands
      const n = 14, P = [], im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), toyMat('#ffffff', { roughness: 0.3, transparent: true, opacity: 0.85 }), n); im.frustumCulled = false; scene.add(im);
      for (let i = 0; i < n; i++) P.push({ a: rnd() * 6.28, ph: i / n, d: 0.2 + rnd() * 0.5 });
      ups.push(t => { for (let i = 0; i < n; i++) { const q = P[i], u = (t * 0.9 + q.ph) % 1; im.setMatrixAt(i, _m.compose(_p.set(x + Math.cos(q.a) * q.d * (0.4 + u), y + 0.1 + Math.sin(u * Math.PI) * 0.55, z + Math.sin(q.a) * q.d * (0.4 + u)), _q.identity(), _s.setScalar(0.06 + 0.16 * (1 - u)))); } im.instanceMatrix.needsUpdate = true; });
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
    function steam(px, py, pz, pr) { // little puffs rising off the warm water, growing and fading
      const tex = softTex(), puffs = [];
      for (let i = 0; i < 9; i++) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }), sp = new THREE.Sprite(m); sp.renderOrder = 2; scene.add(sp); const a = rnd() * 6.28, d = rnd() * pr * 0.8; puffs.push({ sp, x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d, ph: i / 9 }); }
      ups.push(t => { for (const p of puffs) { const u = (t / 4 + p.ph) % 1; p.sp.position.set(p.x + Math.sin(u * 3 + p.ph * 9) * 0.2, py + 0.2 + u * 1.6, p.z); p.sp.scale.setScalar(0.6 + u * 1.3); p.sp.material.opacity = 0.5 * Math.sin(u * Math.PI); } });
    }
    own[s.id]?.();
    // the zone's sign: near its edge with the old board, facing the camera, on open ground
    const su = s.side === '+z' ? 0.15 : 0.12, sv = s.side === '+z' ? [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74] : [0.7, 0.62, 0.54, 0.46, 0.38, 0.3];
    sign: for (const u of [su, su + 0.12]) for (const v of sv) { const [x, z] = at(u, v); if (!free(x, z, 0.9) || nearSpot(x, z, 0.4)) continue;
      signs.push({ x, z, y: heightAt(x, z), ry: s.side === '+x' ? -0.4 : s.side === '-x' ? 0.4 : 0, name: ZONES[hab][k - 1].name }); occupied.push({ x, z, r: 0.9, h: 1.4 }); break sign; }
    // the mix (a side strip's front part, or the whole of a +z strip)
    const n = v => Math.round(A / 100 * (v || 0));
    if (mix.tree) place(n(mix.tree), (x, z) => low(1.5, x, z), (x, z) => tree(x, z, (snow ? 0.85 : 1) + rnd() * 0.35));
    if (mix.bush) place(n(mix.bush), (x, z) => low(0.9, x, z), (x, z) => N.add('bush', nk.bush, x, z, 0.9 + rnd() * 0.4));
    if (mix.rock) place(n(mix.rock), (x, z) => low(1, x, z), (x, z) => snow ? rock(x, z, 0.4 + rnd() * 0.45) : N.add('rock', nk.rock, x, z, 0.55 + rnd() * 0.5));
    if (mix.fern) place(n(mix.fern), (x, z) => low(0.5, x, z), (x, z) => K.fern(x, z, 0.8 + rnd() * 0.5)); // 14-3
    if (mix.fl && mix.drift) { // inbox 67-3 the flower hill: no carpet. Drifts of small flower bushes in the grass, one colour
      // each (of three), thick at a drift's middle and thinning out, sparse toward the strip's edges
      const z0 = Math.max(r[2], back + 2.4), D = Array.from({ length: mix.drift }, (_, i) => ({ x: r[0] + 2 + rnd() * (r[1] - r[0] - 4), z: z0 + 2 + rnd() * (r[3] - z0 - 4), pi: DRIFT_PAL[i % DRIFT_PAL.length] }));
      const near = (x, z) => D.reduce((b, d) => { const g = Math.exp(-((x - d.x) ** 2 + (z - d.z) ** 2) / (2 * (2.2 * UNIT) ** 2)); return g > b.g ? { g, d } : b; }, { g: 0, d: D[0] });
      const edge = (x, z) => Math.min(1, Math.max(0, Math.min(x - r[0], r[1] - x, z - z0, r[3] - z) / (3 * UNIT)));
      place(n(mix.fl), (x, z) => low(0.4, x, z) && rnd() < near(x, z).g * edge(x, z), (cx, cz) => { const pi = near(cx, cz).d.pi; N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rnd, jitter, heightAt); });
    } else if (mix.fl) place(n(mix.fl), (x, z) => low(0.4, x, z), (cx, cz) => { const pi = Math.floor(rnd() * flowerPal.length); N.flowers(cx, cz, pi); flowerCluster(N.Ls, cx, cz, flowerPal[pi], free, rnd, jitter, heightAt); });
    if (mix.grass) N.bare(() => place(Math.round(A * 1.1 * mix.grass), (x, z) => inRect(r, x, z, 0.4), (x, z) => {
      const w = Z.wd(x, z), bank = w > -0.1 && w < 0.7;
      if ((!bank && !free(x, z, 0)) || (bank && rnd() < 0.6)) return;
      L.grass.push({ x, y: heightAt(x, z) - 0.03, z, s: bank ? 1.6 + rnd() * 0.6 : 0.8 + rnd() * 0.6, big: bank, ry: rnd() * 6, c: jitter(bank ? '#4f9032' : pickOf(GREENS), 0.06) });
    }));
  }
  if (Lr.stem.length) addReeds(scene, Lr);
  if (pads.length) addPads(scene, pads);
  if (fruit.length) scene.add(instanced(new THREE.SphereGeometry(1, 10, 7), toyMat('#ffffff', { roughness: 0.35 }), fruit, { cast: false }));
  if (caps.length) scene.add(instanced(new THREE.SphereGeometry(1, 14, 8), toyMat('#ffffff', { roughness: 0.62 }), caps, { cast: false }));
  if (crystals.length) scene.add(instanced(new THREE.CylinderGeometry(0.6, 1, 1, 6), toyMat('#ffffff', { roughness: 0.12, transparent: true, opacity: 0.88 }), crystals));
  if (shells.length) scene.add(instanced(new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), toyMat('#ffffff', { roughness: 0.4 }), shells, { cast: false }));
  if (orchard.length) ups.push(drops(scene, orchard, heightAt));
  if (fx.length) scene.add(mergeByMat(fx));
  const sg = signs.length ? signBoards(signs) : null; if (sg) scene.add(sg);
  return { update: (t, ctx) => { if (sg) sg.visible = PREFS.signs !== false; for (const u of ups) u(t, ctx); } };
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
  return (t, ctx) => {
    if (next < 0) next = t + 10 + Math.random() * 10;
    if (t > next && F.length < 3) {
      next = t + 25 + Math.random() * 15;
      const T = trees[Math.floor(Math.random() * trees.length)], a = (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2 + (Math.random() - 0.5) * 0.8, d = T.fr + 0.15 + Math.random() * 0.3, x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.position.set(x, T.y, z); scene.add(m);
      F.push({ m, x, z, t0: t, y0: T.y - 0.4, gy: heightAt(x, z) + 0.18, end: 0, eaten: false });
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
