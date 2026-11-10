// Walkers (MODELS move: 'walk'; MODELS[].walk: hop share, trot, rest): wander, hop, graze (or sit / peck), sleep, cross the bridge one at a time, keep out of each other's way.
// ctx: { scene, heightAt, walkable, pathClear, bridgeEnds, deckAt, onSleepTick(obj), spawn: () => [x, z], crowd (crowd.js), onBridge (who is on it:
// one at a time) }; a pond's also water (surface y), wet(x, z, kind), waterSpot(kind, x, z), shore(x, z) for the ones that go in (MODELS walk.water)
import * as THREE from 'three';
import { dress } from './figure.js';
import { DROP, dropPose } from './growth.js';
import { free, blocked } from './crowd.js';
import { MODELS } from '../game/data.js';
import { SP } from '../game/rules.js';
import { choose, start, pose as playPose, leave } from './play.js';

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

export function createActor(ctx, rec) {
  const { scene, heightAt, walkable, pathClear } = ctx, look = dress(rec), root = new THREE.Group();
  root.add(look.obj); scene.add(root);
  const M = MODELS[SP[rec.species].model], W = { hop: 0.4, trot: 1, pace: 1, roam: 0.5, ...M.walk, ...!ctx.wet && { water: null } }, body = { x: 0, z: 0, yaw: -Math.PI / 2 + (Math.random() - 0.5) * 2 }, fit = () => { body.r = M[look.stage].r; body.seg = M[look.stage].seg; };
  fit(); ctx.crowd.add(body);
  let [x, z] = ctx.spawn();
  // a water animal keeps to the waterside: within 3 of the shore line, or in the pond (inbox 7)
  const home = (x, z) => !W.water || ctx.shore(x, z) < 3, near = (x, z) => home(x, z) || ctx.shore(x, z) < ctx.shore(h.x, h.z) - 1; // dropped far off: each walk takes it closer
  for (let k = 0; k < 40 && !(free(ctx.crowd, body, x, z) && home(x, z)); k++) [x, z] = ctx.spawn();
  for (let k = 0; k < 60 && !walkable(x, z); k++) { x = THREE.MathUtils.clamp(x + (Math.random() - 0.5) * 6, -15, 15); z = THREE.MathUtils.clamp(z + (Math.random() - 0.5) * 6, -21, 26); }
  const sh = new THREE.Object3D(), blob = blobSlot(scene); sh.rotation.x = -Math.PI / 2;
  const h = { x, z, yaw: body.yaw, face: body.yaw, state: 'idle', t: 0, dur: 1 + Math.random() * 2, sx: x, sz: z, tx: x, tz: z, ph: Math.random() * 6, wait: 0 };
  Object.assign(body, { x, z });
  root.rotation.y = h.yaw;
  const pose = { sq: 1, rot: 0, gait: 'still', ph: 0 };

  // a place to head for: free now, and not by a bridge landing (whoever stands there would hold up the one crossing)
  // where it may go: dry ground, and for a water animal (walk.water 'swim' / 'wade') the pond as ctx.wet sees it
  const ok = W.water ? (x, z) => walkable(x, z) || ctx.wet(x, z, W.water) : walkable;
  const open = (x, z) => free(ctx.crowd, body, x, z, Math.atan2(-(z - h.z), x - h.x)) && ctx.bridgeEnds.every(e => Math.hypot(e.x - x, e.z - z) > 2.5);
  const go = (state, tx, tz, speed) => { if (state === 'cross') h.at = h.now; h.state = state; h.sp = speed; h.wait = 0; h.cut = h.stuck = null; h.slide = false; h.sx = h.x; h.sz = h.z; h.tx = tx; h.tz = tz; h.t = 0; h.dur = Math.max(1, Math.hypot(tx - h.x, tz - h.z) / (state === 'hop' ? speed : speed * W.pace)); }; // W.pace: a slow walker (the cow)
  function pick() {
    const r = Math.random();
    if (h.after) { const f = h.after; h.after = null; f(true); } // 28-1: done what it was sent for (the orchard's fruit: eaten)
    if (h.goal && toward()) return; // 28-1: on its way to a zone's spot, or sent (api.send)
    if (ctx.night && Math.random() < 0.45 * ctx.night) { h.tuck = W.oneLeg && Math.random() < W.oneLeg; h.state = 'sleep'; h.t = 0; h.dur = 6 + Math.random() * 6; return; } // 21-1: dozes more (and longer) at night
    if (ctx.rain > 0.3 && !W.water && ctx.shelter.length && shelter()) return; // 21-2: a land animal waits out the rain under a tree or a roof
    if (h.atSet) { const k = h.atSet === 'perch' ? 2.5 : 1; h.atSet = false; h.state = Math.random() < 0.6 * k ? 'graze' : 'idle'; h.t = 0; h.dur = (3 + Math.random() * 4) * k; return; } // 23-2: got there: stays a while
    if (ctx.play?.length && Math.random() < 0.07 + 0.15 * (ctx.night || 0) && toPlay()) return; // 28-2 소품 쓰기: now and then (more by night: the campfire)
    if (ctx.sets?.length && Math.random() < 0.3 && toSet()) return; // 23-2 세트 보너스: likes to play by a whole set
    if (ctx.spots?.length && Math.random() < 0.12) { // 28-1: to a spot of a zone (zones.js: a bench, the hot spring, the sled hill's top) within 20
      const q = ctx.spots.filter(s => Math.hypot(s.x - h.x, s.z - h.z) < 20 && home(s.x, s.z) && (s.act !== 'slide' || W.slide || Math.random() < 0.3));
      if (q.length) { const s = q[Math.floor(Math.random() * q.length)], a = Math.random() * 6.28, d = Math.random() * s.r;
        h.goal = { x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, act: s.act, to: s.to, n: 4 }; if (toward()) return; }
    }
    // now and then: hop to the nearer bridge landing (if the way is clear), then walk over to the other one
    if (r < 0.08 && !ctx.onBridge && !W.water && ctx.bridgeEnds.length) {
      const [a, b] = ctx.bridgeEnds, near = Math.hypot(a.x - h.x, a.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? a : b, far = near === a ? b : a;
      const d = Math.hypot(near.x - h.x, near.z - h.z);
      if (d < 0.5) { ctx.onBridge = h; return go('cross', far.x, far.z, 1.3); }
      if (d < 11 && pathClear(h.x, h.z, near.x, near.z, ok)) { ctx.onBridge = h; W.hop ? go('hop', near.x, near.z, 3.2) : go('walk', near.x, near.z, 1.3); h.then = far; return; }
    }
    // 25-1 the owl (walk.perch): now and then hops up onto a rock top near by (ctx.perches, the snow's mounds) and sits there
    // a long while (pick's atSet). It never flies: only a perch it can hop to along the ground. Trees are not perches
    if (W.perch && ctx.perches?.length && Math.random() < W.perch) for (const q of [...ctx.perches].sort(() => Math.random() - 0.5)) {
      const d = Math.hypot(q.x - h.x, q.z - h.z);
      if (d > 0.6 && d < 14 && open(q.x, q.z) && pathClear(h.x, h.z, q.x, q.z, ok)) { go('hop', q.x, q.z, 3.2); h.atSet = 'perch'; return; }
    }
    if (r < W.roam) {
      if (W.water && Math.random() < W.wet + (1 - W.wet) * 0.7 * (ctx.rain || 0)) for (let k = 0; k < 10; k++) { const q = ctx.waterSpot(W.shallow ? 'wade' : W.water, h.x, h.z); if (q && open(...q) && pathClear(h.x, h.z, ...q, ok)) return go('walk', ...q, 1.3); } // into the water (walks in, never hops)
      for (let k = 0; k < 25; k++) { const nx = h.x + (Math.random() - 0.5) * 14, nz = h.z + (Math.random() - 0.5) * 12; if (walkable(nx, nz) && near(nx, nz) && open(nx, nz) && pathClear(h.x, h.z, nx, nz, ok)) {
        // 25-1 the penguin (walk.slide): a long walk over dry ground now and then as a belly slide, faster (2.4/s)
        if (W.slide && Math.random() < W.slide && Math.hypot(nx - h.x, nz - h.z) > 3 && pathClear(h.x, h.z, nx, nz)) { go('walk', nx, nz, 2.4 / W.pace); h.slide = true; return; }
        return Math.random() < W.hop && (!W.water || pathClear(h.x, h.z, nx, nz)) ? go('hop', nx, nz, 3.2) : go('walk', nx, nz, 1.3); } } } // out of the water: walks
    h.tuck = W.oneLeg && Math.random() < W.oneLeg; // this rest on one leg (the flamingo)
    if (r < 0.78) { h.state = 'graze'; h.t = 0; h.dur = 2.5 + Math.random() * 3; return; }
    if (r < 0.9) { h.state = 'sleep'; h.t = 0; h.dur = 4 + Math.random() * 3; return; }
    h.state = 'idle'; h.t = 0; h.dur = 1.5 + Math.random() * 2;
  }
  // 21-2 in the rain: to the nearest tree or roof (ctx.shelter: props 3 or more high), a few steps at a time, then stays by
  // it (rests, grazes). false: none in reach (it wanders as it would)
  function shelter() {
    // under (21-3 정자): beneath the roof, for one that fits there (shorter than the eaves, between two posts, inside the ring); a bigger one stands beside it
    const m = M[look.stage], reach = Math.max(-body.seg[0], body.seg[1]) + body.r, room = o => o.under.r - reach;
    const fits = o => o.under && m.h * m.s - m.sink < o.under.h && 2 * body.r < o.under.gap && room(o) > 0.05;
    const S = ctx.shelter.map(o => { const u = fits(o), d = Math.hypot(o.x - h.x, o.z - h.z) - (u ? 0 : o.r); return { o, u, d, k: d - (o.placed ? 3 : 0) }; }).sort((a, b) => a.k - b.k); // a prop the player put down draws them from a little farther than a tree
    if (S[0].d < (S[0].u ? room(S[0].o) : 2)) { h.state = Math.random() < 0.6 ? 'graze' : 'idle'; h.t = 0; h.dur = 3 + Math.random() * 3; return true; }
    for (let k = 0; k < 9; k++) {
      const { o, u } = S[k % Math.min(3, S.length)], a = Math.atan2(h.z - o.z, h.x - o.x) + (Math.random() - 0.5) * 2, r = u ? Math.random() * room(o) : o.r + 0.5 + Math.random() * 1.2;
      let x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
      // 23-2: beneath a roof only by a gap between its posts: outside the ring, first to the mouth of the nearest gap (or the next one)
      const ms = u && o.mouths && Math.hypot(h.x - o.x, h.z - o.z) > o.under.r ? o.mouths.map(q => [q, Math.hypot(q[0] - h.x, q[1] - h.z)]).sort((p, q) => p[1] - q[1]) : null;
      if (ms && ms[0][1] > 0.3) [x, z] = ms[k % 2][0];
      const L = Math.hypot(x - h.x, z - h.z);
      if (L > 9) { x = h.x + (x - h.x) / L * 8; z = h.z + (z - h.z) / L * 8; }
      if (walkable(x, z) && open(x, z) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, 1.5); return true; }
    }
    return false;
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
  const me = () => { const S = M[look.stage]; return { sp: rec.species, W, swim: false, s: S.s, reach: body.seg[1] + body.r, back: body.r - body.seg[0], w: 2 * body.r, L: body.seg[1] - body.seg[0] + 2 * body.r, h: S.h * S.s, fig: look.fig }; };
  function toPlay() {
    const q = choose(ctx, api, me(), h.x, h.z); if (!q) return false;
    h.goal = { x: q.ax, z: q.az, act: 'play', q, n: 6, done: ok => ok || leave(q) }; if (toward()) return true;
    h.goal = null; leave(q); return false;
  }
  const endPlay = () => { if (!h.play) return; leave(h.play); h.play = null; if (h.state === 'play') { h.state = 'idle'; h.t = 0; h.dur = 0.8 + Math.random(); } };
  // 28-1: toward h.goal, 8 a walk (a way round if the straight one is blocked); there, what the spot is for: rest (grazes a
  // while), nap, bath (dozes in the hot spring), slide (the penguin slides down the sled hill: walk.slide), eat (the orchard's
  // fruit), run (a new zone's first visitors: a happy jump). false: no way found (gives up after n tries)
  function toward() {
    const g = h.goal, L = Math.hypot(g.x - h.x, g.z - h.z);
    if (L < (g.act === 'eat' ? 1.3 : 0.6)) { h.goal = null; return arrive(g); } // eat: the fruit lies at the tree's rim, the head reaches it
    if (--g.n < 0 || (g.s = (g.s || 0) + 1) > 24) { h.goal = null; g.done?.(false); return false; } // no way, or going round and round
    for (let k = 0; k < 10; k++) {
      const a = Math.atan2(g.z - h.z, g.x - h.x) + (k ? (Math.random() - 0.5) * 0.35 * k : 0), d = Math.min(L, 8) * (k ? 0.6 + Math.random() * 0.4 : 1);
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (ok(x, z) && (k || open(x, z)) && pathClear(h.x, h.z, x, z, ok)) { go('walk', x, z, g.fast ? 2.4 : 1.3); if (k || L > 8) g.n++; return true; }
    }
    return false;
  }
  function arrive(g) {
    const T = (a, b) => a + Math.random() * (b - a);
    if (g.act === 'play') { h.play = start(g.q, h.x, h.z, h.yaw, h.now); h.state = 'play'; h.t = 0; h.pk = 0; return true; } // 28-2: on it (update's play)
    if (g.act === 'slide' && g.to && W.slide) { go('walk', g.to[0], g.to[1], 2.4 / W.pace); h.slide = true; return true; }
    if (g.act === 'run') { h.state = 'jump'; h.t = 0; h.dur = 0.55; return true; }
    if (g.act === 'eat') { h.after = g.done; h.state = 'graze'; h.t = 0; h.dur = 3; return true; }
    h.state = g.act === 'nap' || g.act === 'bath' ? 'sleep' : Math.random() < 0.6 ? 'graze' : 'idle'; h.t = 0;
    h.dur = g.act === 'bath' ? T(8, 12) : g.act === 'nap' ? T(6, 10) : T(4, 8); g.done?.(true); return true;
  }
  // blocked (by an animal or a prop): head somewhere else at once, a spot whose first step is free; none: look again in 0.5 s
  function detour() {
    if (h.then) { h.then = null; ctx.onBridge = null; } // gave up on the bridge
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = 2.5 + Math.random() * 6, nx = h.x + Math.cos(a) * d, nz = h.z + Math.sin(a) * d;
      if ((k > 20 || near(nx, nz)) && open(nx, nz) && pathClear(h.x, h.z, nx, nz, ok) && !blocked(ctx.crowd, body, h.x + Math.cos(a) * 0.05, h.z + Math.sin(a) * 0.05)) return go('walk', nx, nz, 1.3);
    }
    h.state = 'idle'; h.t = 0; h.dur = 0.5; h.stuck = true;
  }
  // in the way of one crossing the bridge: move off (resting or strolling only)
  body.yield = () => { if (!api.hold && ['idle', 'graze', 'sleep', 'walk'].includes(h.state)) detour(); };
  // crossing, held up: off the deck end the crossing and go round; on the deck turn back
  const giveUp = () => { if (ctx.deckAt(h.x, h.z) > -Infinity) return go('cross', h.sx, h.sz, 1.3); ctx.onBridge = null; detour(); };
  pick();
  // move to fraction k of the way; false (and no move) if that walks into someone. h.face: where it wants to look;
  // h.yaw: where it looks now (drawn and collided with), turning toward h.face below
  const step = k => {
    const nx = h.sx + (h.tx - h.sx) * k, nz = h.sz + (h.tz - h.sz) * k, dx = nx - h.x, dz = nz - h.z;
    if ((h.by = blocked(ctx.crowd, body, nx, nz))) return false;
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
    drop(x, z) { endPlay(); h.x = h.tx = x; h.z = h.tz = z; h.then = null; if (ctx.onBridge === h) ctx.onBridge = null; h.state = 'drop'; h.t = 0; }, // out of the nest menu, onto this spot
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
    send(x, z, act, { fast = false, done, to, q } = {}) {
      if (api.hold || !['idle', 'graze', 'sleep', 'walk', 'hop'].includes(h.state)) return false;
      if (h.then) { h.then = null; ctx.onBridge = null; } h.goal?.done?.(false); h.after = null;
      h.goal = { x, z, act, to, fast, done, q, n: 6 }; if (!toward()) { h.state = 'idle'; h.t = 0; h.dur = 0.4; } return true;
    },
    busy: () => !!h.goal || !!h.after || !!h.play,
    poke() { if (h.play) { h.pk = 0.5; return; } // 28-2: on a prop, a little bounce (it stays on)
      if (h.state === 'cross') h.back = { t: h.t, dur: h.dur }; else if (h.then) { h.then = null; ctx.onBridge = null; } h.state = 'jump'; h.t = 0; h.dur = 0.55; }, // on the bridge it carries on after the jump; on the way there it gives up
    update(dt, t) {
      look.update(dt);
      let lift = 0, sq = 1, rot = 0, gait = 'still', ph = 0, tuck = 0, py = null, lie = 0, shut = false; // py: 28-2 on a prop, its height (world)
      if (api.hold) { endPlay(); h.state = 'idle'; h.t = 0; h.then = null; if (ctx.onBridge === h) ctx.onBridge = null; }
      h.t += dt; h.now = t;
      if (h.state === 'hop') { const k = Math.min(1, h.t / h.dur), hops = Math.max(2, Math.round(h.dur / 0.32)), hp = (k * hops) % 1;
        if (!step(k)) { h.sx = h.tx = h.x; h.sz = h.tz = h.z; h.cut ??= (Math.floor(k * hops) + 1) / hops; if (h.then) { h.then = null; ctx.onBridge = null; } } // someone in the way: land this hop, then go round
        lift = Math.sin(hp * Math.PI) * 0.45; sq = 1 + (hp < 0.12 || hp > 0.88 ? -0.07 : 0.03); rot = Math.sin(hp * Math.PI * 2) * -0.05; gait = 'hop'; ph = hp; if (h.cut && k >= h.cut) detour(); else if (k >= 1) { if (h.then) { go('cross', h.then.x, h.then.z, 1.3); h.then = null; } else { h.state = 'idle'; h.t = 0; h.dur = 0.8 + Math.random() * 1.5; } } }
      else if (h.state === 'cross' || h.state === 'walk') { // walking, never hopping: a small step bob and sway only
        const k = Math.min(1, h.t / h.dur);
        if (!step(k)) { h.t -= dt; h.wait += dt; // someone in the way: stop
          if (h.state === 'walk') { if (h.wait > 0.6) detour(); } // soon go round
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
            h.state = 'idle'; h.t = 0; h.dur = h.goal?.fast ? 0.05 : 1 + Math.random() * 1.5; // 28-1: running to a new zone: on at once
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
      else if (h.state === 'drop') { ({ lift, sq } = dropPose(h.t)); if (h.t >= DROP.end) { h.state = 'idle'; h.t = 0; h.dur = 1.2; } }
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
      root.rotation.y = h.yaw;
      Object.assign(pose, { sq, rot, gait, ph, tuck, lie, shut }); look.fig.pose(pose);
      const lx = (body.seg[1] - body.seg[0] + 2 * body.r) / 3.47, lz = body.r / 0.56; // sized off the crowd capsule (the 17-1 adult horse's = 1)
      sh.position.set(h.x, gy + 0.05, h.z); sh.scale.set(lx * (1 - lift * 0.2), lz * (1 - lift * 0.2), 1);
      sh.rotation.z = root.rotation.y; // the blob follows the body's length
      blob.set(sh, root.visible && !wet ? Math.max(0.25, 1 - lift * 0.8) : 0);
    },
    body,
    dispose() { endPlay(); if (h.goal?.q) leave(h.goal.q); scene.remove(root); blob.free(); if (ctx.onBridge === h) ctx.onBridge = null; ctx.crowd.delete(body); },
  };
  return api;
}
