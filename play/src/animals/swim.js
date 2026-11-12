// Swimmers (MODELS move: 'swim'): drift round the pond on a circle of their own, bob, leave ripples. Someone ahead:
// slide over to another circle (lane) and pass. ctx: { scene, pond: { x, z, r, k (z stretch, default 0.9), lanes ([min, max] x r, default [0.15, 0.6]) }, water (surface y), heightAt, crowd (crowd.js) }
// Dropped from the nest menu onto the grass, it hops over to the pond first. 28-2: now and then it hops off to a fountain near
// by (play.js) to paddle round in it a while, then hops back.
import * as THREE from 'three';
import { dress } from './figure.js';
import { DROP, dropPose, dropFrom, dangle } from './growth.js';
import { free, blocked } from './crowd.js';
import { MODELS } from '../game/data.js';
import { SP } from '../game/rules.js';
import { choose, start, pose as playPose, leave, due } from './play.js';

const ripGeo = new THREE.RingGeometry(0.55, 0.65, 40); ripGeo.rotateX(-Math.PI / 2);

export function createActor(ctx, rec) {
  const { scene, pond, water } = ctx, look = dress(rec), root = new THREE.Group();
  root.add(look.obj); scene.add(root);
  let a = 0, rr = 0, poke = 0, rush = 0, rT = Math.random() * 0.8;
  const sp = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.06), ripples = [], [L0, L1] = pond.lanes ?? [0.15, 0.6]; // lanes: the circles' range (x pond.r)
  const spot = (A, R) => { const r = pond.r * R + 1.2; return [pond.x + Math.cos(A) * r, pond.z + Math.sin(A) * r * (pond.k ?? 0.9)]; };
  const at = (v = new THREE.Vector3()) => { const [x, z] = spot(a, rr); return v.set(x, water, z); };
  const yawAt = A => -A - Math.sign(sp) * Math.PI / 2; // facing the way it swims
  const M = MODELS[SP[rec.species].model], body = { x: 0, z: 0, yaw: 0 }, fit = () => { body.r = M[look.stage].r; body.seg = M[look.stage].seg; };
  fit(); ctx.crowd.add(body);
  const place = () => { for (let k = 0; k < 40; k++) { a = Math.random() * Math.PI * 2; rr = L0 + 0.05 + Math.random() * (L1 - L0 - 0.05); if (free(ctx.crowd, body, ...spot(a, rr), yawAt(a))) break; } lane = rr; }; // a free spot on the water
  let lane; place();
  // one step round the pond (and toward its lane); false if that bumps into someone
  const move = (A, R) => { if (blocked(ctx.crowd, body, ...spot(A, R), yawAt(A))) return false; a = A; rr = R; return true; };
  at(root.position); Object.assign(body, { x: root.position.x, z: root.position.z, yaw: yawAt(a) });
  // the ripples spread and fade (also while it is out of the water)
  const fade = dt => { for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i]; rp.life += dt; const k = rp.life / 2.4;
    rp.m.scale.setScalar((1 + k * 2.2) * rp.m.userData.s); rp.m.material.opacity = 0.6 * (1 - k);
    if (k >= 1) { scene.remove(rp.m); rp.m.material.dispose(); ripples.splice(i, 1); }
  } };
  let land = null; // { x, z, t, dur, q }: on the grass after a drop (q: inbox 42 E, put down on a fountain: hops to it)
  let held = null, now = 0; // inbox 42 E: { x, z } held up there (habitat.js carry)
  let play = null; // 28-2: { q (play.js), x, z (from), t, dur }: hopping to the fountain (q.A set: in it)
  const me = () => { const S = M[look.stage]; return { sp: rec.species, swim: true, s: S.s, reach: body.seg[1] + body.r, back: body.r - body.seg[0], w: 2 * body.r, L: body.seg[1] - body.seg[0] + 2 * body.r, h: S.h * S.s, fig: look.fig }; };
  const home = (x, z) => { place(); const p = at(); land = { x, z, t: DROP.end, dur: DROP.end + Math.max(0.6, Math.hypot(p.x - x, p.z - z) / 3.2) }; }; // hop back to the water
  const unplay = () => { if (play) { leave(play.q); play = null; } };
  const api = {
    rec, look, obj: root, pickTarget: root, position: root.position,
    hold: false, // true while it hatches: stays put
    rest: () => at(),
    drop(x, z, from = 0) { unplay(); held = null; place();
      // inbox 42 E: carried and let go: its place on the water nearest there (on the water: the lane under it), if free
      const k = pond.k ?? 0.9, A = Math.atan2((z - pond.z) / k, x - pond.x), R = THREE.MathUtils.clamp((Math.hypot(x - pond.x, (z - pond.z) / k) - 1.2) / pond.r, L0, L1);
      if (from) for (let j = 0; j < 21; j++) { const B = A + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 0.1; if (free(ctx.crowd, body, ...spot(B, R), yawAt(B))) { a = B; rr = lane = R; break; } } // or a little round
      const p = at(), t0 = dropFrom(from); land = { x, z, t: t0, dur: DROP.end + Math.max(0.6, Math.hypot(p.x - x, p.z - z) / 3.2) }; },
    water: 'swim',
    carry(x, z) { unplay(); land = null; held = { x, z }; },
    use(st) { const q = land && choose({ play: [st], night: ctx.night }, api, { ...me(), T: now }, land.x, land.z, 99); if (q) land.q = q; return q ? [land.x, land.z] : null; },
    poke() { poke = 0.6; },
    // on the camera's line to the followed animal (habitat.js; n: the line's side normal, d: how far off it, signed): swim on
    // faster for a while and slide to the lane that takes it further off that side
    shoo(nx, nz, d) {
      if (api.hold || land || play || rush > 0) return;
      const [x0, z0] = spot(a, rr), [x1, z1] = spot(a, rr + 0.1);
      lane = THREE.MathUtils.clamp(rr + (((x1 - x0) * nx + (z1 - z0) * nz) * d > 0 ? 0.25 : -0.25), L0, L1); rush = 2.5;
    },
    update(dt, t) {
      look.update(dt); fade(dt); now = t;
      if (held) { const d = dangle(t, a); root.position.set(held.x, Math.max(ctx.heightAt(held.x, held.z), water) + DROP.carry, held.z); root.rotation.x = d.roll; root.rotation.z = d.rot;
        look.fig.pose({ sq: 1, rot: 0, gait: 'still', ph: 0 }); Object.assign(body, { x: held.x, z: held.z }); fit(); return; }
      if (play) { // 28-2: over to the fountain in hops, paddle round in it (play.js poses it), then back
        const { q } = play; play.t += dt; let o;
        if (!q.A) { const k = Math.min(1, play.t / play.dur), hops = Math.max(2, Math.round(play.dur / 0.32)), x = play.x + (q.ax - play.x) * k, z = play.z + (q.az - play.z) * k;
          o = { x, z, y: Math.max(ctx.heightAt(x, z), water) + Math.sin(((k * hops) % 1) * Math.PI) * 0.45, yaw: Math.atan2(-(q.az - play.z), q.ax - play.x), sq: 1, rot: 0, gait: 'still', ph: 0 };
          if (k >= 1) { start(q, x, z, o.yaw, t); play.t = 0; } }
        else o = playPose(q, play.t, t);
        root.position.set(o.x, o.y ?? ctx.heightAt(o.x, o.z) + (o.lift || 0), o.z); root.rotation.set(0, o.yaw, 0); look.fig.pose(o);
        Object.assign(body, { x: o.x, z: o.z, yaw: o.yaw }); fit();
        if (o.end || q.st.gone) { unplay(); home(o.x, o.z); }
        return;
      }
      if (land) { // fall, bounce, then hop to its place on the water
        land.t += dt; const p = at(), k = Math.max(0, (land.t - DROP.end) / (land.dur - DROP.end)), hops = Math.max(2, Math.round((land.dur - DROP.end) / 0.32));
        const d = land.t < DROP.end ? dropPose(land.t) : { lift: Math.sin(((k * hops) % 1) * Math.PI) * 0.45, sq: 1 };
        if (land.q && land.t >= DROP.end) { const q = land.q; play = { q, x: land.x, z: land.z, t: 0, dur: Math.max(0.6, Math.hypot(q.ax - land.x, q.az - land.z) / 3.2) }; land = null; return; } // inbox 42 E: on to the fountain
        const x = land.x + (p.x - land.x) * Math.min(1, k), z = land.z + (p.z - land.z) * Math.min(1, k);
        root.position.set(x, (k < 1 ? Math.max(ctx.heightAt(x, z), water) : water) + d.lift, z);
        if (k > 0) root.rotation.y = Math.atan2(-(p.z - land.z), p.x - land.x);
        root.rotation.x = root.rotation.z = 0; look.fig.pose({ sq: d.sq, rot: 0, gait: 'still', ph: 0 });
        if (k >= 1) { land = null; look.fig.pose({ sq: 1, rot: 0, gait: 'still', ph: 0 }); }
        Object.assign(body, { x, z, yaw: root.rotation.y }); fit(); // on the grass others step round it too
        return;
      }
      if (!api.hold && rush <= 0 && ctx.play?.length && Math.random() < dt / (due(ctx, t, me()) ? 10 : 40)) { // 28-2: a fountain within 18 (with room): off it goes
        const q = choose(ctx, api, { ...me(), T: t }, root.position.x, root.position.z, 18);
        if (q) { play = { q, x: root.position.x, z: root.position.z, t: 0, dur: Math.max(0.6, Math.hypot(q.ax - root.position.x, q.az - root.position.z) / 3.2) }; return; }
      }
      if (!api.hold) {
        const v = rush > 0 ? 3 : (1 - 0.5 * (ctx.night ?? 0)) * (1 + 0.7 * (ctx.rain ?? 0)); rush -= dt; // 21-1: drifts slower at night; 21-2: swims about more in the rain
        const nr = rr + THREE.MathUtils.clamp(lane - rr, -0.3 * v * dt, 0.3 * v * dt);
        if (!move(a + dt * sp * v, nr) && (!move(a, nr) || Math.abs(lane - rr) < 0.01) && Math.random() < dt * 2) // blocked ahead (and aside): try another lane
          lane = THREE.MathUtils.clamp(rr + (Math.random() < 0.5 ? -0.25 : 0.25), L0, L1);
      }
      at(root.position); Object.assign(body, { x: root.position.x, z: root.position.z, yaw: yawAt(a) }); fit();
      let lift = Math.sin(t * 2.2 + a * 3) * 0.04;
      if (poke > 0) { poke -= dt; lift += Math.sin((0.6 - poke) / 0.6 * Math.PI) * (look.stage === 'adult' ? 0.6 : 0.4); }
      root.position.y += lift;
      root.rotation.y = yawAt(a);
      root.rotation.z = Math.sin(t * 1.7 + a) * 0.06; root.rotation.x = Math.cos(t * 1.3 + a) * 0.05;
      rT += dt;
      if (rT > 0.8 && root.visible) {
        rT = 0; const m = new THREE.Mesh(ripGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
        m.position.set(root.position.x, water + 0.03, root.position.z); m.renderOrder = 2; m.userData.s = look.stage === 'adult' ? 1 : 0.6; scene.add(m); ripples.push({ m, life: 0 });
      }
    },
    body,
    dispose() { unplay(); ctx.crowd.delete(body); scene.remove(root); for (const rp of ripples) { scene.remove(rp.m); rp.m.material.dispose(); } },
  };
  return api;
}
