// 28-2 소품 쓰기: what an animal does with a play prop, and how the prop moves while it is used.
// A placed play prop's state st is its model's userData.play (newPlay; meadow/props.js). habitat.js adds x, z, rot, y, r (its
// footprint) and lists it in ctx.play; taken up, it is marked gone. seats: who has each one (on the way there or on it), on:
// who sits on it now, parts: what its tick moves. walk.js (and swim.js, the fountain) calls choose now and then (USES in
// data.js: which species uses which; FIT: one too big for it passes it by), walks to the spot it gives (ax, az), then calls
// start and pose every frame until pose says end. Poses: x, z, yaw and y (world; none: on the ground, lift above it),
// rot (nose up +), sq, gait, ph as walk.js's own, zz: dozing (the zzz)
import * as THREE from 'three';
import { USES } from '../game/data.js';
import { calm } from '../config.js';
import { nightGlow } from '../habitat/toyKit.js';
import { CARS } from '../habitat/train.js';

const smooth = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k, turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// a point (or a heading) in the prop's own frame -> the world (habitat.js turns a prop by rot about y)
const W = (st, lx, lz) => { const c = Math.cos(st.rot), s = Math.sin(st.rot); return [st.x + lx * c + lz * s, st.z - lx * s + lz * c]; };
const yawOf = (st, dx, dz) => { const c = Math.cos(st.rot), s = Math.sin(st.rot); return Math.atan2(dx * s - dz * c, dx * c + dz * s); };
const local = (st, x, z) => { const c = Math.cos(st.rot), s = Math.sin(st.rot), dx = x - st.x, dz = z - st.z; return [dx * c - dz * s, dx * s + dz * c]; };
const still = { rot: 0, sq: 1, gait: 'still', ph: 0 };
const at = (st, lx, ly, lz, yaw, o) => { const [x, z] = W(st, lx, lz); return { ...still, x, z, y: st.y + ly, yaw, ...o }; };

// the models' numbers (meadow/props.js builds them from these): heights over the ground, along the prop's own x / z
export const G = {
  swing: { pivot: 3.3, rope: 2.6, half: 1.35 }, // the bar, the ropes (to the seat's top), the legs at x ±half
  slide: { top: 1.55, deck: -0.95, z0: -0.45, z1: 1.45, y1: 0.24, lip: 1.85, back: -1.62 }, // the deck (its top, its middle), the chute from z0 down to z1 (y1 high), the lip's end, the ladder's foot
  seesaw: { pivot: 0.62, arm: 1.9, tilt: 0.24, seat: 0.19 }, // the hub, the seats along x, the most it tips, the seat pads' top over the hub
  hammock: { pivot: 1.5, sag: 0.9, half: 2.1, cloth: 1.85, hz: 0.55 }, // the ropes' line, the cloth's low middle under it, the posts at x ±half, the cloth's ends, its ends' half width (its middle: a quarter more)
  fountain: { water: 0.34, ring: 1.55, rim: 2.6, top: 2.25 }, // the basin's water, the circle bathers paddle round, the rim, the bowl's lip the drops fall from (inbox 35: 1.5 times as wide)
  ball: { r: 0.38 },
};
// the most a user may measure (world: w across, L nose to tail, h tall; MODELS of its stage) to fit on it
const FIT = { swing: { w: 1.05, h: 2.4 }, slide: { w: 1.7, h: 2.6 }, seesaw: { L: 2.4 }, hammock: { L: 4.2, w: 1.9 }, ball: { L: 3.6 }, fountain: { L: 3.0 }, train: { L: 2.6, w: 1.5 } };
const fits = (kind, me) => { const f = FIT[kind] ?? {}; return !(me.w > f.w || me.h > f.h || me.L > f.L); };
const USE = Object.fromEntries(Object.entries(USES).map(([sp, s]) => [sp, s.split(' ')]));

// 0.5 s hop from where it came (q.A) onto s (the seat now: it moves with the prop), on it until end, then a hop off to E
const jump = (a, b, k, H) => { const e = smooth(k); return { ...still, x: lerp(a.x, b.x, e), z: lerp(a.z, b.z, e), y: lerp(a.y, b.y, e) + Math.sin(k * Math.PI) * H, yaw: a.yaw + turn(a.yaw, b.yaw) * Math.min(1, k * 2), gait: 'jump', ph: k * 0.999 }; };
function onOff(q, t, s, E, end) {
  if (t < 0.5) return jump(q.A, s, t / 0.5, 0.8);
  if (t < end && !q.off) { q.st.on[q.i] = true; return s; }
  q.st.on[q.i] = false; q.off ??= { ...s, t };
  const k = (t - q.off.t) / 0.55; return k >= 1 ? { ...still, ...E, end: true } : jump(q.off, E, k, 0.7);
}
const out = (st, me, d = 0.15) => st.r + Math.max(me.reach, me.back) + d; // a spot clear of its footprint
const ring = (n, st, i, me, d) => { const a = i / n * Math.PI * 2, R = st.r + me.reach + d; return W(st, Math.cos(a) * R, Math.sin(a) * R); };

// each kind: n seats; spot(st, i, me, x, z): where it walks to (world); dur(q); pose(q, t, T): t since it got there, T the clock
const K = {
  swing: { n: 1, dur: () => 4.5 + Math.random() * 2,
    spot: (st, i, me) => W(st, 0, -out(st, me)), // behind it: hops on facing the front, off forward
    pose(q, t) { const { st, me } = q, g = G.swing, a = st.ang || 0;
      const s = at(st, 0, g.pivot - g.rope * Math.cos(a), -g.rope * Math.sin(a), yawOf(st, 0, 1), { rot: -a }); // the seat's front dips at the back of the swing
      return onOff(q, t, s, at(st, 0, 0, out(st, me, 0.1), s.yaw), q.D); } },
  slide: { n: 1, dur: () => 3.3,
    spot: (st, i, me) => W(st, 0, -out(st, me)),
    pose(q, t) { const { st, me } = q, g = G.slide, f = yawOf(st, 0, 1), P = (z, y, o) => at(st, 0, y, z, f, o);
      st.on[q.i] = t > 0.9 && t < 2.75; // on the deck or the chute
      const top = P(g.deck, g.top), mid = P(g.back + 0.1, g.top * 0.55), sl = Math.atan2(g.top - g.y1, g.z1 - g.z0), pen = me.W?.slide; // the penguin goes down on its belly
      const lean = e => pen ? { rot: -1.3 * e, gait: 'slide', y: me.s * 0.46 * e } : { rot: -sl * e };
      const L = (z, y, e) => { const o = lean(e); return P(z, y + (o.y || 0), { ...o, y: undefined }); };
      if (t < 0.45) return jump(q.A, mid, t / 0.45, 0.5); // up the ladder: two hops
      if (t < 0.9) return jump(mid, top, (t - 0.45) / 0.45, 0.5);
      if (t < 1.3) return { ...top, sq: 1 + 0.03 * Math.sin((t - 0.9) * 30) }; // a wiggle at the top
      if (t < 1.5) { const k = (t - 1.3) / 0.2; return L(lerp(g.deck, g.z0, k), g.top, smooth(k)); }
      if (t < 2.35) { const e = ((t - 1.5) / 0.85) ** 2; return L(lerp(g.z0, g.z1, e), lerp(g.top, g.y1, e), 1); } // faster and faster
      if (t < 2.75) { const k = (t - 2.35) / 0.4, e = 1 - (1 - k) ** 2; return L(lerp(g.z1, g.lip + 0.4, e), lerp(g.y1, 0, e), 1 - smooth(k)); }
      const k = Math.min(1, (t - 2.75) / 0.55), end = P(g.lip + 0.4, 0); // a happy jump
      return { ...end, y: end.y + Math.sin(k * Math.PI) * 0.8, gait: 'jump', ph: k * 0.999, end: k >= 1 }; } },
  seesaw: { n: 2, dur: () => 7.5, // alone: waits this long for a second one
    spot: (st, i, me) => W(st, (i ? -1 : 1) * out(st, me), 0),
    pose(q, t, T) { const { st, i } = q, g = G.seesaw, s = i ? -1 : 1, th = st.th || 0;
      const seat = at(st, s * g.arm * Math.cos(th), g.pivot + s * g.arm * Math.sin(th) + g.seat, 0, yawOf(st, -s, 0), { rot: -s * th }); // faces the other end
      return onOff(q, t, seat, { ...q.A, yaw: q.A.yaw + Math.PI }, st.ride0 != null ? st.ride0 + 5.5 - q.T0 : q.D); } },
  campfire: { n: 6, ring: true, dur: q => q.night > 0.3 ? 10 + Math.random() * 6 : 5 + Math.random() * 3,
    spot: (st, i, me) => ring(6, st, i, me, 0.15), pose: (q, t, T) => sit(q, t, T) },
  feeder: { n: 5, ring: true, dur: () => 5 + Math.random() * 3,
    spot: (st, i, me) => ring(5, st, i, me, 0.05), pose: (q, t, T) => sit(q, t, T) },
  fountain: { n: 2, dur: () => 4 + Math.random() * 2.5,
    spot: (st, i, me, x, z) => { const a = Math.atan2(z - st.z, x - st.x), R = out(st, me); return [st.x + Math.cos(a) * R, st.z + Math.sin(a) * R]; }, // the side it comes from
    pose(q, t, T) { const { st, i, me } = q, g = G.fountain, a = (st.ph || 0) + i * Math.PI, R = out(st, me), b = (T + q.ph) % 1.4;
      const s = { ...still, x: st.x + Math.cos(a) * g.ring, z: st.z + Math.sin(a) * g.ring, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), rot: 0.05 * Math.sin(T * 6 + q.ph), ...!me.swim && { gait: 'walk', ph: T * 0.7 }, // paddles (wades) round the column
        y: st.y + (me.swim ? g.water : 0.12) + Math.sin(T * 5 + i * 2) * 0.03 + (b < 0.35 ? Math.sin(b / 0.35 * Math.PI) * 0.25 : 0) }; // and now and then a splash
      return onOff(q, t, s, { x: st.x + Math.cos(a) * R, z: st.z + Math.sin(a) * R, y: st.y, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) }, q.D); } },
  hammock: { n: 1, dur: () => 8 + Math.random() * 5,
    spot: (st, i, me, x, z) => W(st, 0, (local(st, x, z)[1] < 0 ? -1 : 1) * out(st, me)), // the side it comes from
    pose(q, t, T) { const { st } = q, g = G.hammock, a = st.sw || 0, k = smooth(Math.max(0, Math.min(1, (t - 0.45) / 0.6, (q.D - t) / 0.5))); // inbox 35: lies down (legs folded), eyes shut, and gets up before the hop off
      // inbox 36: its body's middle on the cloth's low middle, its belly a little down in the cloth (the cloth gives under it:
      // propTick), the bigger it is the deeper; st.lay is how it lies there (give). Too long for the posts (seal): its head kept
      // 0.3 inside them, its low tail out past the other end
      const { me } = q, Y = -g.sag - Math.min(0.35, Math.max(0, (me.L - 2.6) * 0.2) + Math.max(0, (me.w - 1.2) * 0.3)), c = (me.reach - me.back) / 2 + Math.max(0, me.L / 2 - g.half + 0.3);
      const L = st.lay ??= {}; Object.assign(L, { k, under: me.fig?.under(), lx: -q.dir * c, dir: q.dir, y: Y, wide: Math.max(1, (me.w / 2 + 0.05) / (g.hz * 1.25)) });
      const s = at(st, -q.dir * c, g.pivot + Y * Math.cos(a), Y * Math.sin(a), yawOf(st, q.dir, 0), { sq: 0.95 - Math.sin(T * 1.4 + q.ph) * 0.015, lie: k, shut: t > 1.5 && t < q.D - 0.6, zz: t > 1.5 }); // lies along it, naps
      return onOff(q, t, s, { ...q.A, yaw: q.A.yaw + Math.PI }, q.D); } },
  ball: { n: 1, dur: q => 2 * q.T1 + 0.55,
    spot: (st, i, me, x, z) => { const d = Math.hypot(x - st.x, z - st.z) || 1, R = me.reach + G.ball.r + 0.1; return [st.x + (x - st.x) / d * R, st.z + (z - st.z) / d * R]; },
    pose(q, t) { const { st } = q; st.on[0] = t < 2 * q.T1;
      if (t >= 2 * q.T1) { const k = Math.min(1, (t - 2 * q.T1) / 0.55); st.bx = st.x; st.bz = st.z; // home again: a happy jump
        return { ...still, x: q.A.x, z: q.A.z, yaw: q.A.yaw, lift: Math.sin(k * Math.PI) * 0.7, gait: 'jump', ph: k * 0.999, end: k >= 1 }; }
      // a figure of eight: one loop to each side, the ball just ahead of its nose, back where it lay after each
      const j = t < q.T1 ? 0 : 1, u = (t - j * q.T1) / q.T1 * Math.PI * 2, sg = j ? -q.side : q.side, { d, p, R, c } = q;
      const vx = d[0] * Math.cos(u) + sg * p[0] * Math.sin(u), vz = d[1] * Math.cos(u) + sg * p[1] * Math.sin(u);
      st.bx = st.x + R * (d[0] * Math.sin(u) + sg * p[0] * (1 - Math.cos(u))); st.bz = st.z + R * (d[1] * Math.sin(u) + sg * p[1] * (1 - Math.cos(u)));
      return { ...still, x: st.bx - vx * c, z: st.bz - vz * c, yaw: Math.atan2(-vz, vx), gait: 'walk', ph: t * 1.4, sq: 1 + Math.abs(Math.sin(t * 9)) * 0.02 }; },
    start(q) { const { st, A } = q, L = Math.hypot(st.x - A.x, st.z - A.z) || 1; q.d = [(st.x - A.x) / L, (st.z - A.z) / L]; q.p = [-q.d[1], q.d[0]];
      q.c = L; q.R = 0.75; q.T1 = 2 * Math.PI * q.R / 1.4; q.side = Math.random() < 0.5 ? 1 : -1; } },
  // 28-4 장난감 기차 (habitat.js: st.train the train, st.board(me, x, z) a spot beside a straight track, st.q who waits at or rides
  // each wagon; train.js stops there). Waits beside the track facing it, hops into its wagon when that stops by it, rides round
  // (looking the way it goes) and is let off where it got on (or, after 2 minutes, the next spot near), hops off facing away
  train: { n: 3, dur: () => 300,
    spot: (st, i, me, x, z) => !me.swim && i < st.wagons ? st.board?.(me, x, z) ?? null : null, // swimmers (swim.js) keep to the pond
    start(q) { q.step = 'wait'; q.st.q[q.i] = q; q.A.y = q.at.A[1]; },
    pose(q, t) { const { st, i, A, at } = q, car = st.train?.cars[i + 1], dt = Math.min(0.1, t - (q.lt ?? t)); q.lt = t;
      if (!car || st.q[i] !== q) return { ...still, x: A.x, z: A.z, yaw: A.yaw, end: true }; // the train went, or it was not let on in time
      const seat = () => ({ ...still, x: car.x, z: car.z, y: car.y + CARS.floor, yaw: q.ry, rot: car.slope * Math.cos(turn(q.ry, car.dir)) });
      if (q.step === 'wait') { if (t > 90) return { ...still, x: A.x, z: A.z, yaw: at.yaw, end: true }; // waited long enough
        return { ...still, x: A.x, z: A.z, yaw: A.yaw + turn(A.yaw, at.yaw) * smooth(Math.min(1, t / 0.6)) }; }
      if (q.step === 'board') { q.tb ??= t; q.ry = car.dir; const k = (t - q.tb) / 0.5;
        if (k >= 1) { q.step = 'ride'; q.odo = st.train.odo; q.t0 = t; st.on[i] = true; } else return jump({ ...A, yaw: at.yaw }, seat(), k, 0.8); }
      if (q.step === 'ride') { q.ry += turn(q.ry, car.dir) * Math.min(1, dt * 3);
        if (!q.due && st.train.odo - q.odo > 8) q.due = true;
        if (t - q.t0 > 120 && !q.far) { q.far = true; const b = st.board(q.me, car.x, car.z); if (b) { q.at = b[2]; q.A = { x: b[0], z: b[1], y: b[2].A[1], yaw: b[2].yaw }; } }
        return seat(); }
      if (q.step === 'alight') { q.ta ??= t; const k = (t - q.ta) / 0.55, E = { x: A.x, z: A.z, y: q.at.A[1], yaw: q.at.yaw + Math.PI }; st.on[i] = false;
        if (k >= 1) { q.step = 'done'; return { ...still, ...E, end: true }; } return jump(q.from ??= seat(), E, k, 0.7); }
      return { ...still, x: A.x, z: A.z, yaw: at.yaw + Math.PI, end: true }; } },
};
// by the campfire or the feeder: stays where it got to, turns to the middle; eats (head down, the chicken pecks) or sits and
// warms itself, swaying a little (late at night half of them nod off)
function sit(q, t, T) {
  const { st, A, me } = q, f = Math.atan2(-(st.z - A.z), st.x - A.x), g = Math.min(1, t / 0.5, Math.max(0, (q.D - t) / 0.5));
  const o = { ...still, x: A.x, z: A.z, yaw: A.yaw + turn(A.yaw, f) * smooth(Math.min(1, t / 0.6)), end: t >= q.D }; st.on[q.i] = !o.end;
  if (st.kind === 'feeder') o.rot = (me.W?.rest === 'peck' ? -(0.08 + 0.35 * Math.pow(Math.max(0, Math.sin(T * 8 + q.ph)), 6)) : -(0.16 + Math.sin(T * 3 + q.ph) * 0.03)) * g;
  else if (q.doze && t > q.D * 0.4) Object.assign(o, { sq: 0.95 - Math.sin(T * 1.4 + q.ph) * 0.015, zz: true });
  else { const up = me.W?.rest === 'sit'; o.rot = (up ? 0.08 : 0.03 + 0.02 * Math.sin(T * 0.9 + q.ph)) * g; o.sq = 1 + (up ? 0.05 : 0) * g; }
  return o;
}

// st for a new model of a play prop (meadow/props.js: parts are its moving groups)
export const newPlay = (kind, parts) => ({ kind, parts, seats: Array(K[kind].n).fill(null), on: Array(K[kind].n).fill(false), q: Array(K[kind].n).fill(null) });
// a play prop for who (me: its species sp, W its walk flags, swim, s its scale; reach / back: nose / tail from its middle; w,
// L, h) near x, z (within far), weighted (two wanting the seesaw, a group at the feeder, the campfire by night); its seat is
// taken for who. null: none
export function choose(ctx, who, me, x, z, far = 22) {
  const kinds = USE[me.sp] ?? [], n = ctx.night || 0, list = [];
  for (const st of ctx.play ?? []) {
    if (st.gone || !kinds.includes(st.kind) || !fits(st.kind, me) || Math.hypot(st.x - x, st.z - z) > far || !st.seats.includes(null)) continue;
    const used = st.seats.filter(Boolean).length;
    list.push([st, st.kind === 'campfire' ? (n > 0.3 ? 4 : 0.3) * (1 + used) : st.kind === 'feeder' ? 1 + 2 * used : st.kind === 'seesaw' ? (used ? 8 : 1) : st.kind === 'hammock' && n > 0.3 ? 0.4 : st.kind === 'train' ? 0.6 : 1]);
  }
  let r = Math.random() * list.reduce((s, [, w]) => s + w, 0); const pick = list.find(([, w]) => (r -= w) < 0)?.[0];
  if (!pick) return null;
  const k = K[pick.kind], free = pick.seats.map((s, i) => s ? null : i).filter(i => i != null).map(i => [i, k.spot(pick, i, me, x, z)]).filter(f => f[1]); // 28-4: the train's spot may be none
  if (!free.length) return null;
  const [i, [ax, az, at]] = k.ring ? free.sort((a, b) => Math.hypot(a[1][0] - x, a[1][1] - z) - Math.hypot(b[1][0] - x, b[1][1] - z))[0] : free[0]; // round a ring: the seat on its side
  pick.seats[i] = who; return { st: pick, i, who, me, ax, az, at, night: n };
}
// got to (ax, az): x, z, yaw where it stands now, T the clock
export function start(q, x, z, yaw, T) {
  const k = K[q.st.kind]; Object.assign(q, { A: { x, z, y: q.st.y, yaw }, T0: T, ph: Math.random() * 6, dir: Math.random() < 0.5 ? 1 : -1, doze: q.night > 0.6 && Math.random() < 0.5, off: null });
  k.start?.(q); q.D = k.dur(q); return q;
}
export const pose = (q, t, T) => K[q.st.kind].pose(q, t, T);
// done, given up or cut short: the seat is free again (the ball rolls home)
export function leave(q) {
  const { st, i } = q; if (st.seats[i] === q.who) st.seats[i] = null; st.on[i] = false; if (st.q[i] === q) st.q[i] = null;
  if (st.kind === 'ball') st.bx = st.bz = undefined;
}

// the prop's own motion (its model's userData.tick): the swing swings (more with someone on), the seesaw tips to the one
// waiting and goes up and down with two, the hammock sways, the fountain's drops fall, the fire flickers, the ball rolls
const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _m = new THREE.Object3D();
// inbox 36: the hammock's cloth gives under who lies in it and wraps it, wider in its middle for a broad one; empty, it is back as
// it was. Its two ends stay on the bars. st.lay (the hammock pose's): k how far down it is, under its underside (figure.js), lx its
// root along the cloth, dir the way it faces (+-x), y its root's height (in the sling's frame), wide how much wider the cloth goes
function give(st) {
  if (!st.seats[0]) st.lay = null; // up and gone (or never came): the next one starts from the cloth as it was
  const L = st.lay, k = L ? L.k : 0, C = st.cloth ??= (() => { const m = st.parts.sling.children.find(o => o.isMesh && o.material.side === THREE.DoubleSide);
    m.geometry = m.geometry.clone(); const a = m.geometry.attributes.position; return { m, a, rest: a.array.slice(), hx: a.getX(a.count - 1) - 0.01, k: 0 }; })();
  if (Math.abs(k - C.k) < 0.002 && (k === 0) === (C.k === 0)) return;
  C.k = k; const p = C.a.array, R = C.rest, X = C.hx + 0.01, D = k ? Math.max(0, -L.y - G.hammock.sag) * k : 0; // the whole cloth a little deeper under a big one
  for (let i = 0; i < p.length; i += 3) { const x = R[i], end = Math.abs(x) >= C.hx, f = 1 - (x / X) ** 4, z = R[i + 2] * (end || !k ? 1 : 1 + (L.wide - 1) * k * f), y = R[i + 1] - D * f;
    const u = end || !k || !L.under ? Infinity : L.y + L.under((x - L.lx) * L.dir, z * L.dir) - 0.02; p[i + 1] = y + Math.min(0, u - y) * k; p[i + 2] = z; }
  C.a.needsUpdate = true; C.m.geometry.computeVertexNormals(); C.m.geometry.computeBoundingSphere();
}
export function propTick(st, t) {
  const dt = Math.min(0.1, Math.max(0, t - (st.t ?? t))), P = st.parts, ease = (v, to, k) => lerp(v, to, Math.min(1, dt * k)); st.t = t;
  if (st.kind === 'swing') { st.amp = ease(st.amp ?? 0.12, st.on[0] ? 0.42 : 0.12, 1.2); st.w = (st.w || 0) + dt * 1.9; P.seat.rotation.x = st.ang = st.amp * Math.sin(st.w); }
  else if (st.kind === 'hammock') { st.amp = ease(st.amp ?? 0.04, st.on[0] ? 0.1 : 0.04, 1); st.w = (st.w || 0) + dt * 1.1; P.sling.rotation.x = st.sw = st.amp * Math.sin(st.w); give(st); }
  else if (st.kind === 'seesaw') {
    const g = G.seesaw, both = st.on[0] && st.on[1];
    if (both) { if (st.ride0 == null) { st.ride0 = t; st.ph0 = Math.asin(THREE.MathUtils.clamp((st.th || 0) / g.tilt, -1, 1)); } st.th = g.tilt * Math.sin(2.2 * (t - st.ride0) + st.ph0); }
    else { st.ride0 = null; st.th = ease(st.th || 0, st.on[0] ? -g.tilt : st.on[1] ? g.tilt : 0, 6); } // one on: its end goes down
    P.plank.rotation.z = st.th;
  } else if (st.kind === 'fountain') {
    st.ph = (st.ph || 0) + dt * 0.45;
    for (let k = 0; k < P.drops.count; k++) { const a = k / P.drops.count * Math.PI * 2 + t * 0.2, u = (t * 1.1 + k * 0.37) % 1, r = lerp(0.75, 1.4, u), y0 = G.fountain.top, w = G.fountain.water;
      _m.position.set(Math.cos(a) * r, y0 + 0.3 * u - (y0 + 0.3 - w) * u * u, Math.sin(a) * r); _m.updateMatrix(); P.drops.setMatrixAt(k, _m.matrix); } // from the bowl's rim into the basin
    P.drops.instanceMatrix.needsUpdate = true;
  } else if (st.kind === 'campfire') { // inbox 35: each flame flickers and sways on its own; sparks rise by night (none with 움직임 줄이기)
    P.flames.forEach((f, i) => { const w = t * (8 + 2.3 * i) + i * 1.9; f.scale.set(1 + 0.06 * Math.sin(w * 1.2), 1 + 0.12 * Math.sin(w) + 0.06 * Math.sin(w * 1.7 + 1), 1 + 0.06 * Math.cos(w * 1.1)); f.rotation.set(0.08 * Math.sin(w * 0.55), 0, 0.08 * Math.cos(w * 0.45)); });
    const sp = P.sparks; sp.visible = nightGlow.value > 0.05 && !calm();
    if (sp.visible) { const p = sp.geometry.attributes.position, c = sp.geometry.attributes.color;
      for (let k = 0; k < p.count; k++) { const u = (t * 0.42 + k * 0.618) % 1, a = k * 2.4 + t * 0.6, r = 0.1 + 0.45 * u, f = Math.sin(u * Math.PI) * (0.65 + 0.35 * Math.sin(t * 13 + k * 3));
        p.setXYZ(k, Math.cos(a) * r + 0.2 * Math.sin(t * 1.3 + k), 1.0 + 2.6 * u, Math.sin(a) * r); c.setXYZ(k, f, f, f); }
      p.needsUpdate = c.needsUpdate = true; } }
  else if (st.kind === 'ball') {
    const [lx, lz] = st.bx != null ? local(st, st.bx, st.bz) : [ease(P.ball.position.x, 0, 3), ease(P.ball.position.z, 0, 3)], mx = lx - P.ball.position.x, mz = lz - P.ball.position.z, m = Math.hypot(mx, mz);
    if (m > 1e-5) { P.spin.quaternion.premultiply(_q.setFromAxisAngle(_a.set(mz / m, 0, -mx / m), m / G.ball.r)); P.ball.position.x = lx; P.ball.position.z = lz; }
  }
}
