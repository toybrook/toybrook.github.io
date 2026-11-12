// Walkers (MODELS move: 'walk'; MODELS[].walk: hop share, trot, rest): wander, hop, graze (or sit / peck), sleep, cross the bridge one at a time, keep out of each other's way.
// ctx: { scene, heightAt, walkable, pathClear, bridgeEnds, deckAt, onSleepTick(obj), spawn: () => [x, z], crowd (crowd.js), onBridge (who is on it:
// one at a time) }; a pond's also water (surface y), wet(x, z, kind), waterSpot(kind, x, z), shore(x, z) for the ones that go in (MODELS walk.water)
import * as THREE from 'three';
import { dress } from './figure.js';
import { DROP, dropPose, dropFrom, dangle } from './growth.js';
import { free, blocked } from './crowd.js';
import { MODELS, UNIT } from '../game/data.js';
import { SP } from '../game/rules.js';
import { choose, start, pose as playPose, leave, due } from './play.js';

const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(40,40,10,0.55)'); gr.addColorStop(1, 'rgba(40,40,10,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const shGeo = new THREE.PlaneGeometry(2.2, 1.2);
// 26-9: the walkers' blobs in a scene are one InstancedMesh (one draw, not one each); a blob's alpha rides in its instance
// colour's red. It doubles when full; a free slot is a zero matrix
const blobMat = Object.assign(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  { onBeforeCompile: s => { s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.r;'); } });
const blobs = new WeakMap(), ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
export function blobSlot(scene) { // 28-4: the train's cars take one too
  let B = blobs.get(scene);
  if (!B?.free.length) {
    const n = B ? B.n * 2 : 32, mesh = new THREE.InstancedMesh(shGeo, blobMat, n);
    mesh.instanceMatrix.array.fill(0); mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); mesh.frustumCulled = false;
    if (B) { mesh.instanceMatrix.array.set(B.mesh.instanceMatrix.array); mesh.instanceColor.array.set(B.mesh.instanceColor.array); scene.remove(B.mesh); B.mesh.dispose(); }
    B ??= { free: [] }; for (let i = n - 1; i >= (B.n ?? 0); i--) B.free.push(i);
    B.mesh = mesh; B.n = n; scene.add(mesh); blobs.set(scene, B);
  }
  const i = B.free.pop(), put = (m, a) => { B.mesh.setMatrixAt(i, m); B.mesh.instanceColor.setX(i, a); B.mesh.instanceMatrix.needsUpdate = B.mesh.instanceColor.needsUpdate = true; };
  return { set: (o, a) => { o.updateMatrix(); put(o.matrix, a); }, free: () => { put(ZERO, 0); B.free.push(i); } };
}
const smooth = k => k * k * (3 - 2 * k);
const ringGeo = new THREE.RingGeometry(0.4, 0.56, 32); ringGeo.rotateX(-Math.PI / 2);
export const ROOM = 12; // inbox 42 B: the least land (m²) to be left on: a 4 across ring's worth, room for a walk (less: unstick takes it out)

export function createActor(ctx, rec) {
  const { scene, heightAt, walkable, pathClear } = ctx, look = dress(rec), root = new THREE.Group();
  root.add(look.obj); scene.add(root);
  const M = MODELS[SP[rec.species].model], W = { hop: 0.4, trot: 1, pace: 1, roam: 0.5, ...M.walk, ...!ctx.wet && { water: null } }, body = { x: 0, z: 0, yaw: -Math.PI / 2 + (Math.random() - 0.5) * 2 }, fit = () => { body.r = M[look.stage].r; body.seg = M[look.stage].seg; };
  fit(); ctx.crowd.add(body);
  let [x, z] = ctx.spawn();
  // a water animal keeps to the waterside: within 3 of the shore line, or in the pond (inbox 7)
  const home = (x, z) => !W.water || ctx.shore(x, z) < 3, near = (x, z) => home(x, z) || ctx.shore(x, z) < ctx.shore(h.x, h.z) - 1; // dropped far off: each walk takes it closer
  for (let k = 0; k < 40 && !(free(ctx.crowd, body, x, z) && home(x, z)); k++) [x, z] = ctx.spawn();
  for (let k = 0; k < 60 && !walkable(x, z); k++) { x = THREE.MathUtils.clamp(x + (Math.random() - 0.5) * 6, -15 * UNIT, 15 * UNIT); z = THREE.MathUtils.clamp(z + (Math.random() - 0.5) * 6, -21 * UNIT, 26 * UNIT); }
  // inbox 42 B: never inside a closed fence (nor a pocket between props): on the board's main land (the user's own drop may put it there)
  // inbox 53: unless a hand put it in one (rec.home) that is still a land of its own, ROOM or more: in there
  const land = () => ctx.land?.(W.water || ''), L0 = land(), hm = L0 && rec.home ? L0.root(L0.id(...rec.home)) : -1;
  if (hm >= 0 && hm !== L0.main && L0.area(hm) >= ROOM) [x, z] = L0.near(...rec.home, (px, pz, L) => L0.root(L) === hm && free(ctx.crowd, body, px, pz)) ?? rec.home;
  else if (L0 && L0.root(L0.id(x, z)) !== L0.main) [x, z] = L0.near(x, z, (px, pz, L) => L0.root(L) === L0.main && free(ctx.crowd, body, px, pz) && home(px, pz)) ?? [x, z];
  const sh = new THREE.Object3D(), blob = blobSlot(scene); sh.rotation.x = -Math.PI / 2;
  const h = { x, z, yaw: body.yaw, face: body.yaw, state: 'idle', t: 0, dur: 1 + Math.random() * 2, sx: x, sz: z, tx: x, tz: z, ph: Math.random() * 6, wait: 0 };
  Object.assign(body, { x, z }); root.position.set(x, heightAt(x, z), z); // inbox 43: where it stands from the start (the first view frames the friends before a frame runs)
  root.rotation.y = h.yaw; root.rotation.order = 'YXZ';
  const pose = { sq: 1, rot: 0, gait: 'still', ph: 0 };
  // inbox 42 D 첨벙: a ring of water on the ground where it lands, spreading and fading (as a swimmer's ripples)
  const drops = [], splash = () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.set(h.x, heightAt(h.x, h.z) + 0.07, h.z); m.renderOrder = 2; m.userData.s = M[look.stage].s; scene.add(m); drops.push(m); };
  const rings = dt => { for (let i = drops.length - 1; i >= 0; i--) { const m = drops[i], k = (m.userData.t = (m.userData.t || 0) + dt) / 0.9;
    m.scale.setScalar((0.6 + 1.6 * k) * m.userData.s); m.material.opacity = 0.7 * (1 - k); if (k >= 1) { scene.remove(m); m.material.dispose(); drops.splice(i, 1); } } };

  // a place to head for: free now, and not by a bridge landing (whoever stands there would hold up the one crossing)
  // where it may go: dry ground, and for a water animal (walk.water 'swim' / 'wade') the pond as ctx.wet sees it
  const ok = W.water ? (x, z) => walkable(x, z) || ctx.wet(x, z, W.water) : walkable;
  const open = (x, z) => free(ctx.crowd, body, x, z, Math.atan2(-(z - h.z), x - h.x)) && ctx.bridgeEnds.every(e => Math.hypot(e.x - x, e.z - z) > 2.5);
  const go = (state, tx, tz, speed) => { if (state === 'cross') h.at = h.now; h.ghost = false; h.state = state; h.sp = speed; h.wait = 0; h.cut = h.stuck = null; h.slide = false; h.sx = h.x; h.sz = h.z; h.tx = tx; h.tz = tz; h.t = 0; h.dur = Math.max(1, Math.hypot(tx - h.x, tz - h.z) / (state === 'hop' ? speed : speed * W.pace)); }; // W.pace: a slow walker (the cow)
  function pick() {
    const r = Math.random();
    if (h.after) { const f = h.after; h.after = null; f(true); } // 28-1: done what it was sent for (the orchard's fruit: eaten)
    const was = h.shel; h.shel = null; // inbox 42 D: under a tree's crown (off its walkable ground) when the rain stops: out from under it first
    if (was?.cover && !(ctx.rain > 0.3) && !ok(h.x, h.z)) { const a = Math.atan2(h.z - was.z, h.x - was.x), d = was.r + 0.8; return go('walk', was.x + Math.cos(a) * d, was.z + Math.sin(a) * d, 1.3); }
    if (h.goal && toward()) return; // 28-1: on its way to a zone's spot, or sent (api.send)
    if (h.goal) { h.state = 'idle'; h.t = 0; h.dur = 0.5; return; } // inbox 42 C: no free step just now: again in a moment (toward gives up after n), never a second goal over it (its kept seat would stay kept)
    if (h.soc && social()) return; // inbox 42 C: with another (follows, leads, runs, waits)
    if (ctx.night && Math.random() < 0.45 * ctx.night) { h.tuck = W.oneLeg && Math.random() < W.oneLeg; h.state = 'sleep'; h.t = 0; h.dur = 6 + Math.random() * 6; return; } // 21-1: dozes more (and longer) at night
    if (ctx.rain > 0.3 && !W.water && (shelter() || rainy())) return; // 21-2: a land animal waits out the rain under a tree or a roof (inbox 42 D: one it fits under; none: plays in the rain)
    if (!(ctx.rain > 0.3) && Math.random() < 0.07 && startSocial()) return; // inbox 42 C 동물끼리
    if (h.atSet) { const k = h.atSet === 'perch' ? 2.5 : 1; h.atSet = false; h.state = Math.random() < 0.6 * k ? 'graze' : 'idle'; h.t = 0; h.dur = (3 + Math.random() * 4) * k; return; } // 23-2: got there: stays a while
    if (ctx.play?.length) { const m = me(); if (Math.random() < (due(ctx, h.now, m, st => !m.can || m.can(st.x, st.z)) ? 0.7 : 0.2) + 0.15 * (ctx.night || 0) && toPlay()) return; } // 28-2 소품 쓰기 (more by night: the campfire); inbox 42 C: 7 -> 20%, 70% while one of its kind waits (due)
    if (ctx.sets?.length && Math.random() < 0.3 && toSet()) return; // 23-2 세트 보너스: likes to play by a whole set
    if (ctx.spots?.length && Math.random() < 0.12) { // 28-1: to a spot of a zone (zones.js: a bench, the hot spring, the sled hill's top) within 20
      const q = ctx.spots.filter(s => Math.hypot(s.x - h.x, s.z - h.z) < 20 && home(s.x, s.z) && (s.act !== 'slide' || W.slide || Math.random() < 0.3) && Math.random() < (s.w ?? 1));
      if (q.length) { const s = q[Math.floor(Math.random() * q.length)], a = Math.random() * 6.28, d = Math.random() * s.r;
        h.goal = { x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, act: s.act, to: s.to, n: 4 }; if (toward()) return; }
    }
    // now and then: hop to the nearer bridge landing (if the way is clear), then walk over to the other one
    if (!ctx.onBridge && !W.water && ctx.bridgeEnds.length && (r < 0.08 || Math.random() < 0.3 && over())) { // inbox 42 C: or a prop of its kind waits over the bridge
      const [a, b] = ctx.bridgeEnds, near = Math.hypot(a.x - h.x, a.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? a : b, far = near === a ? b : a;
      const d = Math.hypot(near.x - h.x, near.z - h.z);
      if (d < 0.5) { ctx.onBridge = h; return go('cross', far.x, far.z, 1.3); }
      if (d < 11 && pathClear(h.x, h.z, near.x, near.z, ok)) { ctx.onBridge = h; W.hop ? go('hop', near.x, near.z, 3.2) : go('walk', near.x, near.z, 1.3); h.then = far; return; }
      if (r >= 0.08) { h.goal = { x: near.x, z: near.z, act: 'bridge', far, n: 6 }; if (toward()) return; h.goal = null; } // far off: along its land to the landing first
    }
    // 25-1 the owl (walk.perch): now and then hops up onto a rock top near by (ctx.perches, the snow's mounds) and sits there
    // a long while (pick's atSet). It never flies: only a perch it can hop to along the ground. Trees are not perches
    if (W.perch && ctx.perches?.length && Math.random() < W.perch) for (const q of [...ctx.perches].sort(() => Math.random() - 0.5)) {
      const d = Math.hypot(q.x - h.x, q.z - h.z);
      if (d > 0.6 && d < 14 && open(q.x, q.z) && pathClear(h.x, h.z, q.x, q.z, ok)) { go('hop', q.x, q.z, 3.2); h.atSet = 'perch'; return; }
    }
    if (r < W.roam) {
      if (W.water && Math.random() < W.wet + (1 - W.wet) * 0.7 * (ctx.rain || 0)) for (let k = 0; k < 10; k++) { const q = ctx.waterSpot(W.shallow ? 'wade' : W.water, h.x, h.z); if (q && open(...q) && pathClear(h.x, h.z, ...q, ok)) return go('walk', ...q, 1.3); } // into the water (walks in, never hops)
      if (Math.random() < 0.15) { const R = land(), q = R?.spot(R.id(h.x, h.z)); // inbox 42 B: now and then far off on its own land (round props, out by the gate)
        if (q && near(...q) && open(...q)) { h.goal = { x: q[0], z: q[1], act: 'roam', n: 4 }; if (toward()) return; h.goal = null; } }
      for (let k = 0; k < 25; k++) { const nx = h.x + (Math.random() - 0.5) * 14, nz = h.z + (Math.random() - 0.5) * 12; if (walkable(nx, nz) && near(nx, nz) && open(nx, nz) && pathClear(h.x, h.z, nx, nz, ok)) {
        // 25-1 the penguin (walk.slide): a long walk over dry ground now and then as a belly slide, faster (2.4/s)
        if (W.slide && Math.random() < W.slide && Math.hypot(nx - h.x, nz - h.z) > 3 && pathClear(h.x, h.z, nx, nz)) { go('walk', nx, nz, 2.4 / W.pace); h.slide = true; return; }
        return Math.random() < W.hop && (!W.water || pathClear(h.x, h.z, nx, nz)) ? go('hop', nx, nz, 3.2) : go('walk', nx, nz, 1.3); } } } // out of the water: walks
    h.tuck = W.oneLeg && Math.random() < W.oneLeg; // this rest on one leg (the flamingo)
    if (r < 0.78) { h.state = 'graze'; h.t = 0; h.dur = 2.5 + Math.random() * 3; return; }
    if (r < 0.9) { h.state = 'sleep'; h.t = 0; h.dur = 4 + Math.random() * 3; return; }
    h.state = 'idle'; h.t = 0; h.dur = 1.5 + Math.random() * 2;
  }
  // 21-2 in the rain: to the nearest tree or roof (ctx.shelter), a few steps at a time, then stays by it (rests, grazes). inbox 42 D:
  // only one it fits: a gazebo's roof as before (under: shorter than the eaves, between two posts, inside the ring); a tree's crown
  // or a platform (cover: y the room under it, higher than it; core the trunk; r how far it reaches): on a ring round the trunk
  // its own length out, under the cover; a building (cover.side: y its height, taller than it): by its wall on the front (+z, the
  // camera's) side. As many as fit round the ring or under the roof (o.at: who keeps a place, till when). false: none (rainy).
  // inbox 42 C2 (animals x0.75, trees x1.6: under a crown or roof they were hidden): on the side toward the camera (ctx.az), at the
  // crown's edge (its body mostly out: from above the crown or the platform would hide it) or the roof's rim; the camera turned, it walks round after its rest
  function shelter() {
    const m = M[look.stage], H = m.h * m.s - m.sink, reach = Math.max(-body.seg[0], body.seg[1]) + body.r, room = o => o.under.r - reach, can = me().can;
    const ring = o => Math.max(o.cover.core + reach + 0.15, o.cover.side ? 0 : o.cover.r - 0.3 * reach), az = ctx.az ?? Math.PI / 2, faces = o => Math.cos(Math.atan2(h.z - o.z, h.x - o.x) - az) > 0.4;
    const fits = o => o.under ? H < o.under.h && 2 * body.r < o.under.gap && room(o) > 0.05 : !!o.cover && H < o.cover.y && ring(o) <= o.cover.r;
    const cap = o => o.under ? Math.max(1, Math.floor(0.6 * Math.PI * o.under.r ** 2 / (4 * body.r * reach))) : Math.floor((o.cover.side ? Math.PI : 2 * Math.PI) * ring(o) / (2 * body.r + 0.3));
    const taken = o => { let n = 0; for (const [a, T] of o.at ??= new Map()) if (a !== api && T > h.now) n++; return n; };
    const S = ctx.shelter.filter(o => fits(o) && taken(o) < cap(o)).map(o => { const D = Math.hypot(o.x - h.x, o.z - h.z); return { o, D, k: (o.under ? D : Math.abs(D - ring(o))) - (o.placed ? 3 : 0) }; }).sort((a, b) => a.k - b.k); // a prop the player put down draws them from a little farther than a tree
    if (!S.length || S[0].D > 40) return false;
    const { o, D } = S[0]; o.at.set(api, h.now + 12); h.shel = o; // its place kept while it heads there or stays
    if ((o.under ? D < room(o) : Math.abs(D - ring(o)) < 0.6) && faces(o)) { h.state = Math.random() < 0.6 ? 'graze' : 'sleep'; h.t = 0; h.dur = 3 + Math.random() * 3; h.tuck = false; return true; } // rests (unstick: a rest is not lost)
    const inC = (x, z) => { const d = Math.hypot(x - o.x, z - o.z); return !o.under && !o.cover.side && d < o.cover.r && d > o.cover.core + body.r; }, by = (x, z) => ok(x, z) || inC(x, z); // into a crown: off the walkable ground
    for (let k = 0; k < 9; k++) {
      const u = !!o.under, a = az + (Math.random() - 0.5) * 1.8, r = u ? room(o) * (0.6 + 0.4 * Math.random()) : ring(o);
      let x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
      // 23-2: beneath a roof only by a gap between its posts: outside the ring, first to the mouth of the nearest gap (or the next one)
      const ms = u && o.mouths && D > o.under.r ? o.mouths.map(q => [q, Math.hypot(q[0] - h.x, q[1] - h.z)]).sort((p, q) => p[1] - q[1]) : null;
      if (ms && ms[0][1] > 0.3) [x, z] = ms[k % 2][0];
      const L = Math.hypot(x - h.x, z - h.z);
      if (L > 9) { x = h.x + (x - h.x) / L * 8; z = h.z + (z - h.z) / L * 8; }
      if (by(x, z) && (!can || can(x, z)) && open(x, z) && pathClear(h.x, h.z, x, z, by)) { go('walk', x, z, 1.5); return true; }
    }
    return false;
  }
  // inbox 42 D 비 즐기기: no shelter it fits (or all of them full): now and then shakes itself off, splashes in a puddle (little
  // hops, a ring of water at each), or two or three come and doze close beside it (startSocial's nap: 'huddle'); else wanders on
  function rainy() {
    const r = Math.random(), still = (s, d) => { h.state = s; h.t = 0; h.dur = d; h.spl = 0; return true; };
    if (r < 0.15) return still('shake', 1.3);
    if (r < 0.3 && walkable(h.x, h.z)) return still('splash', 1.8);
    return r < 0.45 && startSocial('huddle');
  }
  // 23-2: to a spot by one of the props of a whole set (ctx.sets); far off, a few steps that way (it stays a while once there,
  // h.atSet). false: no way found
  function toSet() {
    for (let k = 0; k < 8; k++) {
      const o = ctx.sets[Math.floor(Math.random() * ctx.sets.length)], a = Math.atan2(h.z - o.z, h.x - o.x) + (Math.random() - 0.5) * 2.4, r = o.r + body.r + 0.3 + Math.random() * 1.2;
      let x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r; const L = Math.hypot(x - h.x, z - h.z), far = L > 9;
      if (far) { x = h.x + (x - h.x) / L * 8; z = h.z + (z - h.z) / L * 8; }
      if (ok(x, z) && open(x, z) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, 1.2); h.atSet = !far; return true; }
    }
    return false;
  }
  // 28-2: to a play prop its species uses and it fits (play.js choose: the seat is kept for it); false: none, or no way there
  const me = () => { const S = M[look.stage], R = land(), lab = (x, z) => { const k = R.id(x, z); return k >= 0 && R.area(k) >= ROOM ? k : R.near(x, z, (a, b, L) => R.area(L) >= ROOM, 6)?.[2] ?? -1; }, mine = R && lab(h.x, h.z); return { T: h.now, can: R && ((x, z) => lab(x, z) === mine), lab: R && lab, mine, // inbox 42 C: this side of a bridge (toward walks one land, walk.js crosses by itself; a seat in a prop's kept-off ring, or it standing in one, or a pocket too small to stand in: the land 3 m round)
     sp: rec.species, W, swim: false, s: S.s, reach: body.seg[1] + body.r, back: body.r - body.seg[0], w: 2 * body.r, L: body.seg[1] - body.seg[0] + 2 * body.r, h: S.h * S.s, fig: look.fig }; };
  function toPlay() {
    const q = choose(ctx, api, me(), h.x, h.z); if (!q) return false;
    h.goal = { x: q.ax, z: q.az, act: 'play', q, n: 6, fast: q.late, done: ok => ok || leave(q) }; if (toward()) return true; // inbox 42 C: to one left waiting: runs
    h.goal = null; leave(q); return false;
  }
  // inbox 42 C 동물끼리: now and then with others near by (walkers on its own land, free: not on a prop, sent, asleep or with
  // another): 따라 걷기 (walks behind one), 무리 걷기 (the same kind side by side behind it), 술래잡기 (two run, the one caught runs
  // after), 코 맞대기 인사 (walks up nose to nose with one that waits), 모여서 낮잠 (two or three come and sleep beside it; by night
  // only this). h.soc its part: { kind: lead, tail, tag, wait; o the other's api; until }. ctx.onSocial(kind, apis): it happened
  const reachOf = b => Math.max(-b.seg[0], b.seg[1]) + b.r;
  const pals = () => { const R = land(), mine = R?.id(h.x, h.z), out = [];
    for (const b of ctx.crowd) if (b.pal && b !== body && b.pal.free() && Math.hypot(b.x - h.x, b.z - h.z) < 20 && walkable(b.x, b.z) && (!R || R.id(b.x, b.z) === mine)) out.push(b.pal);
    return out.sort(() => Math.random() - 0.5); };
  const over = () => { const R = land(), m = me(), L = R ? R.root(m.mine) : -1; return L >= 0 && due(ctx, h.now, m, st => !m.can(st.x, st.z) && R.root(m.lab(st.x, st.z)) === L); }; // inbox 42 C: one of its kind waits on the bridge's other side
  const say = (kind, os) => ctx.onSocial?.(kind, [api, ...os]); // 13-2 놀이 장면 (habitat.js -> ui): the apis (rec, body)
  function startSocial(only) { // only: 'huddle' (inbox 42 D: in the rain, the nap)
    if (!walkable(h.x, h.z)) return false;
    const all = pals(), T = h.now, same = all.filter(o => o.rec.species === rec.species), P = all.filter(o => Math.hypot(o.body.x - h.x, o.body.z - h.z) < (only ? 20 : 12)), o = P[0]; // its own kind come from further (in the rain's huddle, any from 20)
    const kinds = only || ctx.night ? ['nap'] : [...P.length ? ['follow', 'tag', 'greet'] : [], ...P.length > 1 ? ['nap', 'nap'] : [], ...same.length ? ['herd', 'herd'] : []];
    if (!kinds.length) return false; const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind === 'follow') { if (!o.join({ kind: 'lead', until: T + 14 })) return false; h.soc = { kind: 'tail', o, until: T + 14 }; say('follow', [o]); return social(); }
    if (kind === 'herd') { // two beside it, a third behind
      const F = same.slice(0, 3).filter((f, i) => f.join({ kind: 'tail', o: api, until: T + 20, side: i < 2 ? (i ? -1 : 1) * (body.r + f.body.r + 0.35) : 0, back: i < 2 ? 0.3 : null }));
      if (!F.length) return false; h.soc = { kind: 'lead', until: T + 20 }; say('herd', F); return social(); }
    if (kind === 'tag') { if (!o.join({ kind: 'tag', o: api, it: false, until: T + 15 })) return false;
      h.soc = { kind: 'tag', o, it: true, until: T + 15, from: T + 1.2 }; say('tag', [o]); h.state = 'jump'; h.t = 0; h.dur = 0.55; return true; } // a hop: off we go
    if (kind === 'greet') { const b = o.body, d = Math.hypot(h.x - b.x, h.z - b.z) || 1, D = body.seg[1] + body.r + b.seg[1] + b.r + 0.05;
      if (!o.join({ kind: 'wait', o: api, until: T + 10 })) return false;
      h.goal = { x: b.x + (h.x - b.x) / d * D, z: b.z + (h.z - b.z) / d * D, act: 'greet', o, D, n: 4, done: ok => { if (!ok && o.soc?.o === api) o.soc = null; } };
      if (toward()) return true; h.goal = null; o.soc = null; return false; }
    // nap: a spot for each beside it (side by side, facing as it does), free of the others and of each other
    const c = Math.cos(body.yaw), sn = -Math.sin(body.yaw), got = [], who = [];
    for (const f of P.slice(0, 3)) for (const k of [1, -1, 2, -2]) {
      const sd = Math.sign(k) * (body.r + f.body.r + 0.08 + (Math.abs(k) - 1) * (2 * f.body.r + 0.1)), x = h.x - sn * sd, z = h.z + c * sd;
      if (walkable(x, z) && free(ctx.crowd, f.body, x, z, body.yaw) && got.every(q => Math.hypot(q[0] - x, q[1] - z) > q[2] + f.body.r + 0.05)) { got.push([x, z, f.body.r, f]); break; }
    }
    if (got.length < (only ? 1 : 2)) return false; // the rain's huddle: one beside it will do
    let n = 0; for (const [x, z, , f] of got) if (f.send(x, z, 'nap', { yaw: body.yaw, dur: 14 + Math.random() * 4, done: ok => { if (ok && ++n === Math.min(2, got.length)) say(only || 'nap', who); } })) who.push(f);
    h.tuck = false; h.state = 'sleep'; h.t = 0; h.dur = 18 + Math.random() * 4; return true;
  }
  // its part, when it picks what next; false: over (the time is up, the other is gone, or no way on)
  function social() {
    const s = h.soc, o = s.o, T = h.now;
    if (T > s.until || (o && !ctx.crowd.has(o.body))) { h.soc = null; return false; }
    const idle = (d, face) => { if (face != null) h.face = face; h.state = 'idle'; h.t = 0; h.dur = d; return true; };
    if (s.kind === 'wait') return idle(0.4, Math.atan2(-(o.body.z - h.z), o.body.x - h.x)); // turns to the one coming to greet it
    if (s.kind === 'lead') { // walks on, a few steps at a time, much the way it faces
      for (let k = 0; k < 20; k++) { const a = h.yaw + (Math.random() - 0.5) * (k < 10 ? 1.2 : 6), d = 3 + Math.random() * 3, x = h.x + Math.cos(a) * d, z = h.z - Math.sin(a) * d;
        if (walkable(x, z) && near(x, z) && open(x, z) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, 1.1); return true; } }
      h.soc = null; return false; }
    const b = o.body, d = Math.hypot(b.x - h.x, b.z - h.z);
    if (s.kind === 'tail') { // to its place behind (or beside) the one it follows
      const c = Math.cos(b.yaw), sn = -Math.sin(b.yaw), back = s.back ?? b.r - b.seg[0] + body.seg[1] + body.r + 0.4, side = s.side || 0;
      const x = b.x - c * back - sn * side, z = b.z - sn * back + c * side, L = Math.hypot(x - h.x, z - h.z);
      if (L < 0.5) return idle(0.3, b.yaw);
      const f = Math.min(1, 3.5 / L), tx = h.x + (x - h.x) * f, tz = h.z + (z - h.z) * f;
      if (ok(tx, tz) && pathClear(h.x, h.z, tx, tz, ok)) { go('walk', tx, tz, L > 2 ? 1.8 : 1.2); return true; }
      h.soc = null; return false; }
    // tag: it runs at the other (caught: the other is it, after a moment); the other runs off, away from it
    const touch = reachOf(body) + reachOf(b) + 0.3;
    if (s.it) { if (T < s.from) return idle(0.2, Math.atan2(-(b.z - h.z), b.x - h.x)); if (d < touch) return tagged();
      const f = Math.min(4, d - touch * 0.6) / d, tx = h.x + (b.x - h.x) * f, tz = h.z + (b.z - h.z) * f;
      if (ok(tx, tz) && pathClear(h.x, h.z, tx, tz, ok)) { go('walk', tx, tz, 2.4); return true; } h.soc = null; return false; }
    for (let k = 0; k < 16; k++) { const a = Math.atan2(h.z - b.z, h.x - b.x) + (Math.random() - 0.5) * (k < 8 ? 1.6 : 4), L = 3 + Math.random() * 3, x = h.x + Math.cos(a) * L, z = h.z + Math.sin(a) * L;
      if (walkable(x, z) && near(x, z) && open(x, z) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, 2); return true; } }
    return idle(0.3); // cornered: waits to be caught
  }
  function tagged() { const s = h.soc, os = s.o.soc; if (os?.o !== api) { h.soc = null; return false; }
    s.it = false; os.it = true; os.from = h.now + 1.5; s.n = os.n = (s.n || 0) + 1; if (s.n >= 4) s.until = os.until = h.now + 1; // a few rounds
    s.o.poke(); h.state = 'jump'; h.t = 0; h.dur = 0.55; return true; }
  const endPlay = () => { if (!h.play) return; leave(h.play); h.play = null; if (h.state === 'play') { h.state = 'idle'; h.t = 0; h.dur = 0.8 + Math.random(); } };
  // 28-1: toward h.goal, 8 a walk (a way round if the straight one is blocked); there, what the spot is for: rest (grazes a
  // while), nap, bath (dozes in the hot spring), slide (the penguin slides down the sled hill: walk.slide), eat (the orchard's
  // fruit), run (a new zone's first visitors: a happy jump). false: no way found (gives up after n tries)
  function toward() {
    const g = h.goal, L = Math.hypot(g.x - h.x, g.z - h.z);
    if (L < (g.act === 'eat' ? 1.3 : 0.6)) { h.goal = null; return arrive(g); } // eat: the fruit lies at the tree's rim, the head reaches it
    if (--g.n < 0 || (g.s = (g.s || 0) + 1) > 24) { h.goal = null; g.done?.(false); return false; } // no way, or going round and round
    // inbox 42 B: no straight way: along its land (land.js: round the props, in and out by a fence's gap), 8 at most a walk; at the
    // way's end (the land nearest the spot): there. No way (behind a closed fence, or on another land): gives up now
    const R = land();
    if (R && !pathClear(h.x, h.z, g.x, g.z, ok)) {
      while (g.via?.length && Math.hypot(g.via[0][0] - h.x, g.via[0][1] - h.z) < 0.7) g.via.shift();
      if (g.via && !g.via.length) { h.goal = null; return arrive(g); }
      if (!g.via || !pathClear(h.x, h.z, ...g.via[0], ok)) g.via = R.route(h.x, h.z, g.x, g.z, (a, b, c, d) => pathClear(a, b, c, d, ok));
      if (!g.via) { h.goal = null; g.done?.(false); return false; }
      if (!g.via.length) { h.goal = null; return arrive(g); }
      const [x, z] = g.via[0], d = Math.hypot(x - h.x, z - h.z), f = Math.min(1, 8 / d); g.n++;
      go('walk', h.x + (x - h.x) * f, h.z + (z - h.z) * f, g.fast ? 2.4 : 1.3); return true;
    }
    for (let k = 0; k < 10; k++) {
      const a = Math.atan2(g.z - h.z, g.x - h.x) + (k ? (Math.random() - 0.5) * 0.35 * k : 0), d = Math.min(L, 8) * (k ? 0.6 + Math.random() * 0.4 : 1);
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (ok(x, z) && (k || open(x, z)) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, g.fast ? 2.4 : 1.3); if (k || L > 8) g.n++; return true; }
    }
    return false;
  }
  function arrive(g) {
    const T = (a, b) => a + Math.random() * (b - a);
    if (g.act === 'play') { h.play = start(g.q, h.x, h.z, h.yaw, h.now); ctx.onPlay?.(g.q); h.state = 'play'; h.t = 0; h.pk = 0; return true; } // 28-2: on it (update's play)
    if (g.act === 'slide' && g.to && W.slide) { go('walk', g.to[0], g.to[1], 2.4 / W.pace); h.slide = true; return true; }
    if (g.act === 'run') { h.state = 'jump'; h.t = 0; h.dur = 0.55; return true; }
    if (g.act === 'bridge') { if (ctx.onBridge) { h.state = 'idle'; h.t = 0; h.dur = 1; } else { ctx.onBridge = h; go('cross', g.far.x, g.far.z, 1.3); } return true; } // inbox 42 C: at the landing: over (one at a time)
    if (g.act === 'eat') { h.after = g.done; h.state = 'graze'; h.t = 0; h.dur = 3; return true; }
    if (g.act === 'greet') { const o = g.o, b = o.body; h.state = 'idle'; h.t = 0; h.dur = 0.5; // inbox 42 C 코 맞대기: the other still waits for it: nose to nose
      if (o.soc?.kind === 'wait' && o.soc.o === api && Math.hypot(b.x - h.x, b.z - h.z) < g.D + 1) { h.face = Math.atan2(-(b.z - h.z), b.x - h.x); h.state = 'nuzzle'; h.dur = 1.8; o.nuzzle(h.x, h.z); say('greet', [o]); }
      else if (o.soc?.o === api) o.soc = null; return true; }
    if (g.yaw != null) h.face = g.yaw; // inbox 42 C 모여서 낮잠: side by side, facing as the first one does
    h.state = g.act === 'nap' || g.act === 'bath' ? 'sleep' : Math.random() < 0.6 ? 'graze' : 'idle'; h.t = 0;
    h.dur = g.dur ?? (g.act === 'bath' ? T(8, 12) : g.act === 'nap' ? T(6, 10) : T(4, 8)); g.done?.(true); return true;
  }
  // blocked (by an animal or a prop): head somewhere else at once, a spot whose first step is free; none: look again in 0.5 s
  function detour() {
    if (h.then) { h.then = null; ctx.onBridge = null; } // gave up on the bridge
    // inbox 42 C: on the way to a toy, held up by it or its players 2 m off: on from here (the pose takes it to the seat). Going
    // somewhere: a short step round that gets no farther from it (was 2.5-8.5 m any way: it went to and fro and never got there)
    const g = h.goal, D = g && Math.hypot(g.x - h.x, g.z - h.z); if (g?.act === 'play' && D < 2) { h.goal = null; return arrive(g); }
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = g ? 1.5 + Math.random() * 3 : 2.5 + Math.random() * 6, nx = h.x + Math.cos(a) * d, nz = h.z + Math.sin(a) * d;
      if ((k > 20 || near(nx, nz) && (!g || Math.hypot(g.x - nx, g.z - nz) < D + 1)) && open(nx, nz) && pathClear(h.x, h.z, nx, nz, ok) && !blocked(ctx.crowd, body, h.x + Math.cos(a) * 0.05, h.z + Math.sin(a) * 0.05)) return go('walk', nx, nz, 1.3);
    }
    h.state = 'idle'; h.t = 0; h.dur = 0.5; h.stuck = true;
    if ((h.fail = (h.fail || 0) + 1) >= 3) unstick();
  }
  // inbox 42 B 끼임: no way round 3 times running, 20 s on the go without getting anywhere, standing in a prop, or on a pocket of land
  // too small to stand in: a hop (through whoever is in the way) to the nearest free spot of its own land; no room there (a fence
  // closed too tight): to the nearest of the board's main land, outside, and a note once (ctx.cramped)
  function unstick() {
    h.fail = h.lost = 0; h.shel = null; const R = land(); if (!R) return;
    const here = R.id(h.x, h.z), mine = here >= 0 && R.area(here) >= ROOM ? R.root(here) : -1, step = ok(h.x, h.z) ? 1.2 : 0;
    const by = (L, f) => R.near(h.x, h.z, (x, z, M) => R.root(M) === L && Math.hypot(x - h.x, z - h.z) > step && (!f || free(ctx.crowd, body, x, z) && open(x, z)));
    let q = mine >= 0 ? by(mine, 1) || by(mine, 0) : null; // its own land, crowded or not: never out of a closed fence while there is room in it
    if (mine < 0) { q = by(R.main, 1); if (q && here >= 0 && R.root(here) !== R.main) ctx.cramped?.(); }
    if (!q) return;
    if (h.then) { h.then = null; ctx.onBridge = null; }
    h.goal?.done?.(false); h.goal = null; go('hop', q[0], q[1], 3.2); h.ghost = true;
  }
  // in the way of one crossing the bridge: move off (resting or strolling only)
  body.yield = () => { if (!api.hold && ['idle', 'graze', 'sleep', 'walk'].includes(h.state)) detour(); };
  // crossing, held up: off the deck end the crossing and go round; on the deck turn back
  const giveUp = () => { if (ctx.deckAt(h.x, h.z) > -Infinity) return go('cross', h.sx, h.sz, 1.3); ctx.onBridge = null; detour(); };
  // move to fraction k of the way; false (and no move) if that walks into someone. h.face: where it wants to look;
  // h.yaw: where it looks now (drawn and collided with), turning toward h.face below
  const step = k => {
    const nx = h.sx + (h.tx - h.sx) * k, nz = h.sz + (h.tz - h.sz) * k, dx = nx - h.x, dz = nz - h.z;
    if (!h.ghost && (h.by = blocked(ctx.crowd, body, nx, nz))) return false;
    if (dx * dx + dz * dz > 1e-8) { h.face = Math.atan2(-dz, dx); body.at = h.now; } // body.at: when it last moved
    h.x = body.x = nx; h.z = body.z = nz; return true;
  };
  // h.low: resting in the water a swimmer lies down (sinks by its leg length, no deeper than it floats); a shallow one (the capybara)
  // sinks to its float depth, half under even on the shallow rim (the rest of it is hidden under the bed)
  const ground = () => { const g = Math.max(heightAt(h.x, h.z), ctx.deckAt(h.x, h.z)), S = M[look.stage];
    return W.water === 'swim' ? Math.max(g - (h.low || 0), ctx.water - W.float * S.h * S.s) : g; };

  const api = {
    rec, look, obj: root, pickTarget: root, position: root.position,
    hold: false, // true while it hatches: stands still where the egg is
    rest: () => new THREE.Vector3(h.x, ground(), h.z),
    drop(x, z, from = 0) { endPlay(); h.soc = null; h.x = h.tx = x; h.z = h.tz = z; h.then = null; if (ctx.onBridge === h) ctx.onBridge = null; h.state = 'drop'; h.t = dropFrom(from); }, // out of the nest menu, onto this spot (inbox 42 E: from: let go that high up)
    water: W.water, // inbox 42 E: where else it may be put down (habitat.js carry)
    // inbox 42 E 꾹 눌러 옮기기: held up over x, z (habitat.js); whatever it was doing or going to is dropped
    carry(x, z) { if (h.state !== 'carry') { endPlay(); h.goal?.done?.(false); h.goal = h.after = h.soc = h.shel = null; h.stuck = false; h.fail = 0; if (h.then || ctx.onBridge === h) { h.then = null; if (ctx.onBridge === h) ctx.onBridge = null; } h.state = 'carry'; }
      h.x = h.tx = x; h.z = h.tz = z; h.t = 0; },
    // inbox 42 E: put down on the play prop st: to its seat now (play.js choose, that prop only), if it fits and the seat is on its land
    use(st) { const q = choose({ play: [st], night: ctx.night }, api, me(), h.x, h.z, 99); if (!q) return null; if (ok(q.ax, q.az)) { h.x = h.tx = q.ax; h.z = h.tz = q.az; } // lands at its seat (kept for it): on at once
      h.goal = { x: q.ax, z: q.az, act: 'play', q, n: 6, done: ok => ok || leave(q) }; return [h.x, h.z]; },
    // on the camera's line to the followed animal (habitat.js; n: the line's side normal, d: how far off it, signed): walk off
    // to the near side, a body length clear of the line (the far side, or further, if that's taken)
    shoo(nx, nz, d) {
      if (api.hold || h.now < (h.shoo || 0) || !['idle', 'graze', 'sleep', 'walk'].includes(h.state)) return;
      h.shoo = h.now + 1.5; const reach = body.r + Math.max(-body.seg[0], body.seg[1]) + 0.6, s = d < 0 ? -1 : 1;
      for (const [sg, k] of [[s, 1], [-s, 1], [s, 1.6], [-s, 1.6]]) {
        const m = sg * reach * k - d, x = h.x + nx * m, z = h.z + nz * m;
        if (ok(x, z) && open(x, z) && pathClear(h.x, h.z, x, z, ok)) { if (h.then) { h.then = null; ctx.onBridge = null; } return go('walk', x, z, 1.6); }
      }
    },
    // 28-1: go to x, z (walking, fast: running) and do act there (toward / arrive above); done(ok) when there (eat: when eaten) or given up
    // (28-2 act 'play': q, the seat play.js choose kept for it)
    send(x, z, act, { fast = false, done, to, q, yaw, dur } = {}) {
      if (api.hold || !['idle', 'graze', 'sleep', 'walk', 'hop'].includes(h.state)) return false;
      if (h.then) { h.then = null; ctx.onBridge = null; } h.goal?.done?.(false); h.after = null; h.soc = null;
      h.goal = { x, z, act, to, fast, done, q, yaw, dur, n: 6 }; if (!toward()) { h.state = 'idle'; h.t = 0; h.dur = 0.4; } return true;
    },
    busy: () => !!h.goal || !!h.after || !!h.play,
    // inbox 42 C: free to join another (social): not held, sent, on a prop, with another, asleep or on the bridge
    free: () => !api.hold && !h.goal && !h.after && !h.play && !h.soc && !h.shel && !h.then && ctx.onBridge !== h && ['idle', 'graze', 'walk'].includes(h.state),
    join(s) { if (!api.free()) return false; h.soc = s; h.stuck = false; h.state = 'idle'; h.t = 0; h.dur = 0; return true; }, // its part, from its next pick
    get soc() { return h.soc; }, set soc(v) { h.soc = v; },
    get state() { return h.state; }, // 13-0: what it is doing (sound.js: steps, breath asleep, bites grazing)
    nuzzle(x, z) { h.soc = null; h.face = Math.atan2(-(z - h.z), x - h.x); h.state = 'nuzzle'; h.t = 0; h.dur = 1.8; },
    poke() { if (h.play) { h.pk = 0.5; return; } // 28-2: on a prop, a little bounce (it stays on)
      if (h.state === 'cross') h.back = { t: h.t, dur: h.dur }; else if (h.then) { h.then = null; ctx.onBridge = null; } h.state = 'jump'; h.t = 0; h.dur = 0.55; }, // on the bridge it carries on after the jump; on the way there it gives up
    update(dt, t) {
      look.update(dt);
      let lift = 0, sq = 1, rot = 0, gait = 'still', ph = 0, tuck = 0, py = null, lie = 0, shut = false, roll = 0; // py: 28-2 on a prop, its height (world)
      if (api.hold) { endPlay(); h.soc = h.shel = null; h.state = 'idle'; h.t = 0; h.then = null; if (ctx.onBridge === h) ctx.onBridge = null; }
      h.t += dt; h.now = t;
      // inbox 42 B: what unstick watches. On the go (walk, hop, idle) the time since it was last 1.5 from a spot (a rest pauses it);
      // every 2 s: standing in a prop or wall, or on a pocket of land too small for a walk (ROOM)
      if (h.ax == null || Math.hypot(h.x - h.ax, h.z - h.az) > 1.5) { h.ax = h.x; h.az = h.z; h.lost = 0; }
      else if (!api.hold && ['walk', 'hop', 'idle'].includes(h.state) && (h.lost = (h.lost || 0) + dt) > 20) unstick();
      if ((h.chk = (h.chk ?? Math.random() * 2) - dt) < 0) { h.chk = 2; const R = land();
        if (R && !api.hold && ['walk', 'idle', 'graze', 'sleep'].includes(h.state) && !(ctx.deckAt(h.x, h.z) > -Infinity) && (!ok(h.x, h.z) && !h.shel?.cover || R.area(R.id(h.x, h.z)) < ROOM)) unstick(); }
      if (h.state === 'hop') { const k = Math.min(1, h.t / h.dur), hops = Math.max(2, Math.round(h.dur / 0.32)), hp = (k * hops) % 1;
        if (!step(k)) { h.sx = h.tx = h.x; h.sz = h.tz = h.z; h.cut ??= (Math.floor(k * hops) + 1) / hops; if (h.then) { h.then = null; ctx.onBridge = null; } } // someone in the way: land this hop, then go round
        lift = Math.sin(hp * Math.PI) * 0.45; sq = 1 + (hp < 0.12 || hp > 0.88 ? -0.07 : 0.03); rot = Math.sin(hp * Math.PI * 2) * -0.05; gait = 'hop'; ph = hp; if (h.cut && k >= h.cut) detour(); else if (k >= 1) { if (h.then) { go('cross', h.then.x, h.then.z, 1.3); h.then = null; } else { h.state = 'idle'; h.t = 0; h.dur = 0.8 + Math.random() * 1.5; } } }
      else if (h.state === 'cross' || h.state === 'walk') { // walking, never hopping: a small step bob and sway only
        const k = Math.min(1, h.t / h.dur);
        if (!step(k)) { h.t -= dt; h.wait += dt; // someone in the way: stop
          if (h.soc?.it && h.by === h.soc.o.body && h.now >= h.soc.from) tagged(); // inbox 42 C 술래잡기: caught
          else if (h.state === 'walk') { if (h.wait > 0.6) detour(); } // soon go round
          else if (h.wait > 0.6) { // crossing: whoever came later gives way. The other one, if it got there after this one set off over the bridge (and is a walker); else, or if it is still there at 1.5 s, this one
            const o = h.by, later = o.yield && o.at > h.at;
            if (later && h.wait - dt <= 0.6) o.yield(); else if (!later || h.wait > 1.5) giveUp(); } }
        else {
          h.wait = 0; const S = M[look.stage], f = (W.stride ? Math.PI * 1.3 * W.pace / (2 * 0.38 * S.legs.hip * S.s) : 7 * W.trot) * h.sp / 1.3; // stride: a hoof on the ground moves back as fast as the body goes on (1.3/s; 0.38 = the leg swing, figure.js); h.sp: faster legs when running (28-1)
          if (W.hop >= 1) { const hp = (h.t / 0.36) % 1; lift = Math.sin(hp * Math.PI) * 0.3; sq = hp < 0.12 || hp > 0.88 ? 0.95 : 1.02; gait = 'hop'; ph = hp; } // a hopper hops even at walking pace
          if (h.slide) { const e = smooth(Math.max(0, Math.min(1, h.t / 0.35, (h.dur - h.t) / 0.35))); rot = -1.3 * e; lift = 0.46 * S.s * e; gait = 'slide'; } // on its belly, feet trailing (figure.js)
          else if (W.lope && !(heightAt(h.x, h.z) < ctx.water - 0.06)) { const s = Math.sin(h.t * f * 0.5); lift = Math.abs(s) * 0.06 * S.s; rot = s * 0.06; sq = 1 - Math.abs(s) * 0.03; gait = 'walk'; } // the seal humps along on land
          else if (W.hop < 1) { sq = 1 + Math.abs(Math.sin(h.t * f)) * 0.02; rot = Math.sin(h.t * f) * 0.02; gait = 'walk'; ph = h.t * f / (2 * Math.PI); // one stride per two bobs
            if (W.stride) { const a = 0.38 * Math.sin(h.t * f); lift = -S.s * sq * Math.max(0, S.legs.hip * (1 - Math.cos(a)) - S.legs.foot * Math.abs(Math.sin(a))); } } // a long leg swung out rises off the ground: sink the body until the hoof's low edge touches
          if (k >= 1 && h.then) { go('cross', h.then.x, h.then.z, 1.3); h.then = null; }
          else if (k >= 1) {
            h.fail = 0; h.state = 'idle'; h.t = 0; h.dur = h.goal?.fast || h.soc ? 0.05 : 1 + Math.random() * 1.5; // 28-1: running to a new zone: on at once (inbox 42 C: with another, too)
            if (ctx.onBridge === h) { // off the bridge: walk on a few steps so the landing is clear for the next one
              ctx.onBridge = null; const dx = h.tx - h.sx, dz = h.tz - h.sz, d = Math.hypot(dx, dz) || 1, nx = h.x + dx / d * 3, nz = h.z + dz / d * 3;
              if (pathClear(h.x, h.z, nx, nz, ok)) go('walk', nx, nz, 1.3);
            }
          }
        } }
      else if (h.state === 'graze') { const g = Math.sin(Math.min(1, h.t / 0.5) * Math.PI / 2) * (h.t > h.dur - 0.5 ? (h.dur - h.t) / 0.5 : 1);
        if (h.tuck) tuck = g; // stands still on one leg, head up
        else if (h.low > 0.05) rot = 0.04 * g; // lying in the water: chin up
        else if (W.rest === 'sit') { rot = 0.08 * g; sq = 1 + 0.05 * g; } // sits up tall (leans back: rotation.z + is nose up)
        else if (W.rest === 'peck') rot = -(0.08 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 8 + h.ph)), 6)) * g; // quick pecks at the ground
        else rot = -(0.16 + Math.sin(t * 3 + h.ph) * 0.03) * g;
        if (h.t >= h.dur) pick(); }
      else if (h.state === 'sleep') { sq = 0.95 - Math.sin(t * 1.4 + h.ph) * 0.015; if (h.tuck) tuck = Math.min(1, h.t / 0.5, (h.dur - h.t) / 0.5); if (h.t >= h.dur) pick(); if (Math.random() < dt * 0.5) ctx.onSleepTick(root); }
      else if (h.state === 'play') { const o = playPose(h.play, h.t, t); // 28-2 소품 쓰기 (play.js poses it: where, how high, how)
        h.x = o.x; h.z = o.z; h.yaw = h.face = o.yaw; py = o.y ?? null; lift = o.lift || 0; ({ sq, rot, gait, ph } = o); lie = o.lie || 0; shut = !!o.shut;
        if (h.pk > 0) { h.pk -= dt; const b = Math.sin(Math.max(0, h.pk) / 0.5 * Math.PI) * 0.3; if (py != null) py += b; else lift += b; }
        if (o.zz && Math.random() < dt * 0.5) ctx.onSleepTick(root);
        if (o.end || h.play.st.gone) endPlay(); }
      else if (h.state === 'nuzzle') { const k = Math.min(1, h.t / h.dur); rot = -0.12 * Math.sin(k * Math.PI * 3) ** 2; sq = 1 + 0.025 * Math.sin(k * Math.PI * 2); // inbox 42 C 코 맞대기: three little nose dips
        if (k >= 1) { h.state = 'idle'; h.t = 0; h.dur = 0.8 + Math.random(); } }
      else if (h.state === 'shake' || h.state === 'splash') { const k = Math.min(1, h.t / h.dur); // inbox 42 D 비 즐기기
        if (h.state === 'shake') { const e = Math.sin(k * Math.PI); roll = Math.sin(h.t * 30) * 0.2 * e; sq = 1 + 0.03 * e; } // 몸 털기: a quick side to side shake
        else { const hp = (h.t / 0.45) % 1, n = Math.floor(h.t / 0.45); lift = Math.sin(hp * Math.PI) * 0.22 * M[look.stage].s; sq = hp < 0.15 || hp > 0.85 ? 0.95 : 1.02; gait = 'jump'; ph = hp * 0.999; // 첨벙: little hops
          if (n > h.spl) { h.spl = n; splash(); } } // a ring of water as it lands
        if (k >= 1) { h.state = 'idle'; h.t = 0; h.dur = 0.6 + Math.random(); } }
      else if (h.state === 'drop') { ({ lift, sq } = dropPose(h.t)); if (h.t >= DROP.end) { h.state = 'idle'; h.t = 0; h.dur = h.goal ? 0.1 : 1.2; } } // inbox 42 E: put down on a prop: on to it at once
      else if (h.state === 'carry') { lift = DROP.carry; ({ rot, roll } = dangle(t, h.ph)); }
      else if (h.state === 'jump') { const k = Math.min(1, h.t / h.dur); lift = Math.sin(k * Math.PI) * 1.1; rot = Math.sin(k * Math.PI * 2) * 0.1; gait = 'jump'; ph = k * 0.999; if (k >= 1) { if (h.back) { h.state = 'cross'; h.t = h.back.t; h.dur = h.back.dur; h.back = null; } else { h.state = 'idle'; h.t = 0; h.dur = 1 + Math.random(); } } }
      else { sq = 1 + Math.sin(t * 2 + h.ph) * 0.012; rot = Math.sin(t * 0.9 + h.ph) * 0.02; if (h.t >= h.dur && !api.hold) (h.stuck ? detour : pick)(); }
      const d = Math.atan2(Math.sin(h.face - h.yaw), Math.cos(h.face - h.yaw)), yaw = h.yaw + d * Math.min(1, dt * 7);
      if (!blocked(ctx.crowd, body, h.x, h.z, yaw)) h.yaw = yaw; // turn the short way, eased, but not into someone
      Object.assign(body, { x: h.x, z: h.z, yaw: h.yaw }); fit();
      if (W.water === 'swim') { const S = M[look.stage], lie = ['graze', 'sleep', 'idle'].includes(h.state) && heightAt(h.x, h.z) < ctx.water - 0.06 && ctx.deckAt(h.x, h.z) === -Infinity ? (W.shallow ? Math.max(0, heightAt(h.x, h.z) - ctx.water + W.float * S.h * S.s) : (S.legs?.hip ?? 0) * S.s) : 0; // the seal: no legs
        h.low = (h.low || 0) + (lie - (h.low || 0)) * Math.min(1, dt * 1.5); }
      const gy = ground(); if (py != null) lift = py - gy;
      const bed = heightAt(h.x, h.z), wet = W.water && ctx.deckAt(h.x, h.z) === -Infinity && bed < ctx.water - 0.06; // in the pond: no shadow on the water
      if (wet && gy > bed + 0.01) lift += Math.sin(t * 2.2 + h.ph) * 0.04; // afloat: bobs like the ducks
      root.position.set(h.x, gy + lift, h.z);
      root.rotation.y = h.yaw; root.rotation.x = roll; // roll: about its length (YXZ)
      rings(dt);
      Object.assign(pose, { sq, rot, gait, ph, tuck, lie, shut }); look.fig.pose(pose);
      const lx = (body.seg[1] - body.seg[0] + 2 * body.r) / 3.47, lz = body.r / 0.56; // sized off the crowd capsule (the 17-1 adult horse's = 1)
      sh.position.set(h.x, gy + 0.05, h.z); sh.scale.set(lx * (1 - lift * 0.2), lz * (1 - lift * 0.2), 1);
      sh.rotation.z = root.rotation.y; // the blob follows the body's length
      blob.set(sh, root.visible && !wet ? Math.max(0.25, 1 - lift * 0.8) : 0);
    },
    body,
    dispose() { endPlay(); h.soc = null; for (const m of drops) { scene.remove(m); m.material.dispose(); } if (h.goal?.q) leave(h.goal.q); scene.remove(root); blob.free(); if (ctx.onBridge === h) ctx.onBridge = null; ctx.crowd.delete(body); },
  };
  pick(); body.pal = api; // inbox 42 C: others find it in ctx.crowd (its first pick once api is made: toPlay hands it on)
  return api;
}
