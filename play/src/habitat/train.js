// 28-4 장난감 기차: the rail pieces' tracks, the network they make, and the clockwork train that runs on it. No three.js here
// (habitat.js draws the pieces and the train from these numbers; check-eggs runs selfCheck in node).
// A piece lies on a 4x4 tile (the bridge on two) turned by rot (a quarter turn at a time) like any prop: its point (lx, lz) is
// (x + lx c + lz s, z - lx s + lz c) in the world. Its tracks run between the middles of the tile's edges, so pieces on
// neighbouring tiles meet end to end. Where two pieces meet is a node; a fork's two tracks share one (a switch).
import { gapTo } from '../animals/crowd.js';

export const TILE = 4, ARCH = 0.8; // the bridge's deck rises this much in its middle
const line = (ax, az, bx, bz) => u => [ax + (bx - ax) * u, az + (bz - az) * u];
const arc = (cx, cz, r, a0, a1) => u => { const a = a0 + (a1 - a0) * u; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
const STRAIGHT = { f: line(-2, 0, 2, 0), len: 4, straight: true }, CURVE = { f: arc(-2, 2, 2, -Math.PI / 2, 0), len: Math.PI };
export const PIECES = { rail: [STRAIGHT], railcurve: [CURVE], railfork: [STRAIGHT, CURVE], railbridge: [{ f: line(-4, 0, 4, 0), len: 8, arch: true }] };
export const SPEED = { max: 1.6, acc: 1.2, dec: 2.5 }, CARS = { engine: 2.3, wagon: 2, gap: 0.3, floor: 0.5, rail: 0.14 }; // floor: a rider's feet over the rail top

const key = (x, z) => `${Math.round(x * 4)},${Math.round(z * 4)}`, STEP = 0.25;
// pieces: [{ uid, prop, x, z, rot }] placed; hy(x, z): the ground's height. Each track: points every STEP (x, y, z: the ground
// under it, the bridge's arched deck), its ends' nodes a, b
export function tracksOf(pieces, hy) {
  const out = [];
  for (const p of pieces) (PIECES[p.prop] ?? []).forEach((T, k) => {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), W = ([lx, lz]) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
    const n = Math.ceil(T.len / STEP), pts = new Float32Array(3 * (n + 1)), [ax, az] = W(T.f(0)), [bx, bz] = W(T.f(1)), ya = hy(ax, az), yb = hy(bx, bz);
    for (let i = 0; i <= n; i++) { const u = i / n, [x, z] = W(T.f(u)); pts.set([x, T.arch ? ya + (yb - ya) * u + ARCH * Math.sin(Math.PI * u) ** 2 : hy(x, z), z], 3 * i); }
    out.push({ id: `${p.uid}:${k}@${p.x},${p.z},${Math.round(p.rot / (Math.PI / 2)) & 3}`, uid: p.uid, n, pts, len: T.len, a: key(ax, az), b: key(bx, bz), straight: !!T.straight });
  });
  return out;
}
// inbox 42 F-4: every end of the pieces' tracks ({ x, z, open }: open = no other piece meets it there; a fork's two tracks
// share one end), how many are open, and whether some way round closes (the train's loop)
export function railEnds(pieces) {
  const tr = tracksOf(pieces, () => 0), at = new Map();
  for (const t of tr) for (const [k, i] of [[t.a, 0], [t.b, t.n]]) { if (!at.has(k)) at.set(k, { u: new Set(), x: t.pts[3 * i], z: t.pts[3 * i + 2] }); at.get(k).u.add(t.uid); }
  const ends = [...at.values()].map(o => ({ x: o.x, z: o.z, open: o.u.size < 2 }));
  return { ends, open: ends.filter(e => e.open).length, loop: network(tr).loop };
}
// inbox 52: the turn a held piece (prop) takes to join the open ends (railEnds) its tile meets: cands, where it goes at each quarter
// turn ({ x, z, rot }); the one joining the most, then the one whose other end comes nearest another open end (toward closing a
// loop), then the one nearest base (the way it was turned). null: none joins
export function joinTurn(prop, cands, open, base) {
  const at = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.1, b = Math.round(base / (Math.PI / 2)) & 3; let best = null;
  cands.forEach((c, q) => {
    const ends = railEnds([{ uid: 'h', prop, ...c }]).ends, n = ends.filter(e => open.some(o => at(o, e))).length; if (!n) return;
    const rest = open.filter(o => !ends.some(e => at(o, e))), loose = ends.filter(e => !open.some(o => at(o, e)));
    const s = [-n, loose.length && rest.length ? Math.round(10 * Math.min(...loose.flatMap(e => rest.map(o => Math.hypot(o.x - e.x, o.z - e.z))))) : 0, Math.min((q - b) & 3, (b - q) & 3)];
    const i = best ? s.findIndex((v, k) => v !== best.s[k]) : 0; if (!best || i >= 0 && s[i] < best.s[i]) best = { s, rot: c.rot }; // the first that differs decides
  });
  return best?.rot ?? null;
}
// the point d along tr from its a end (clamped), into o = [x, y, z]
function sample(tr, d, o = [0, 0, 0]) {
  const k = Math.max(0, Math.min(tr.n, d / tr.len * tr.n)), i = Math.min(tr.n - 1, Math.floor(k)), f = k - i, P = tr.pts, j = 3 * i;
  o[0] = P[j] + (P[j + 3] - P[j]) * f; o[1] = P[j + 1] + (P[j + 4] - P[j + 1]) * f; o[2] = P[j + 2] + (P[j + 5] - P[j + 2]) * f; return o;
}

// the network: next(tr, dir) the ways on from the end of tr reached going dir (+1: toward b), another piece's tracks there;
// group the connected tracks the train runs on (one with a closed loop, else the longest); loop: some group has one
export function network(tracks) {
  const at = new Map(), byId = new Map(tracks.map(t => [t.id, t]));
  for (const tr of tracks) for (const [e, k] of [[0, tr.a], [1, tr.b]]) { if (!at.has(k)) at.set(k, []); at.get(k).push([tr, e]); }
  const next = (tr, dir) => (at.get(dir > 0 ? tr.b : tr.a) ?? []).filter(([o]) => o.uid !== tr.uid).map(([o, e]) => ({ tr: o, dir: e ? -1 : 1 }));
  const up = new Map(), find = k => { while (up.get(k) !== k) k = up.get(k); return k; };
  for (const k of at.keys()) up.set(k, k);
  for (const tr of tracks) up.set(find(tr.a), find(tr.b));
  const groups = new Map();
  for (const tr of tracks) { const r = find(tr.a); if (!groups.has(r)) groups.set(r, { tracks: [], len: 0 }); const g = groups.get(r); g.tracks.push(tr); g.len += tr.len; }
  // a loop: going on along the tracks (never back the way it came) some way leads round to where it started
  const loopy = g => { const S = new Map(), id = (tr, d) => tr.id + d;
    for (const tr of g.tracks) for (const d of [1, -1]) {
      if (S.has(id(tr, d))) continue; S.set(id(tr, d), 1); const stack = [[tr, d, next(tr, d), 0]];
      while (stack.length) { const top = stack[stack.length - 1];
        if (top[3] >= top[2].length) { S.set(id(top[0], top[1]), 2); stack.pop(); continue; }
        const { tr: t2, dir: d2 } = top[2][top[3]++], s = S.get(id(t2, d2));
        if (s === 1) return true; if (!s) { S.set(id(t2, d2), 1); stack.push([t2, d2, next(t2, d2), 0]); } } }
    return false; };
  const gs = [...groups.values()]; for (const g of gs) g.loop = loopy(g);
  const group = gs.sort((p, q) => (q.loop - p.loop) || (q.len - p.len))[0] ?? null;
  return { tracks, byId, next, group, loop: gs.some(g => g.loop) };
}

// ---- the train: engine + wagons in a row along path (the tracks under it and a little ahead, each run one way), the front of
// the row at pos along it. rev: backing (it came to an end and turned back: the engine is at the rear now). Runs on, slows to
// a stop at an end, before someone in the way (toot: they step aside) and where a rider gets on or off (stops: play.js)
const total = T => T.path.reduce((s, p) => s + p.tr.len, 0);
const flip = path => path.slice().reverse().map(p => ({ tr: p.tr, dir: -p.dir }));
function grow(T, net, ahead) { // the path on to `ahead` past the front (a switch: each way in turn)
  let L = total(T); T.end = false;
  while (L - T.pos < ahead) {
    const last = T.path[T.path.length - 1], ways = net.next(last.tr, last.dir);
    if (!ways.length) { T.end = true; return; }
    const n = last.dir > 0 ? last.tr.b : last.tr.a, i = (T.sw.get(n) ?? 0) % ways.length; if (ways.length > 1) T.sw.set(n, i + 1);
    T.path.push(ways[i]); L += ways[i].tr.len;
  }
}
const LOOK = 6;
// put a train with `wagons` wagons on net's group (behind a track's end, then on along it); null: it doesn't fit there
export function newTrain(net, wagons) {
  const lens = [CARS.engine, ...Array(wagons).fill(CARS.wagon)], c = []; let s = 0;
  for (const L of lens) { c.push(s + L / 2); s += L + CARS.gap; }
  const T = { lens, c, L: s - CARS.gap, path: [], pos: 0, v: 0, rev: false, wait: 0, stuck: 0, toot: 0, odo: 0, sw: new Map(), cars: lens.map(() => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, dir: 0, slope: 0 })) };
  const g = net.group; if (!g || g.len < T.L + 0.3) return null;
  for (const tr0 of [...g.tracks.filter(t => t.straight), ...g.tracks.filter(t => !t.straight)]) {
    T.path = [{ tr: tr0, dir: -1 }]; T.pos = 0; grow(T, net, T.L); T.path = flip(T.path); T.pos = total(T); // behind its b end, as far as the train is long
    if (T.pos < T.L) { grow(T, net, T.L - T.pos + 0.3); T.pos = T.L; } // an end behind it: on along from there
    if (total(T) >= T.L) { T.sw.clear(); grow(T, net, LOOK); place(T); return T; }
  }
  return null;
}
// keep it on the new network (same pieces where it is: on as it was; ahead of it: up to the first piece gone). false: a piece
// under it went (habitat.js puts a new one on)
export function moveTo(T, net) {
  let s = 0;
  for (let i = 0; i < T.path.length; i++) {
    const p = T.path[i], tr = net.byId.get(p.tr.id), len = p.tr.len;
    if (!tr) {
      if (s + len <= T.pos - T.L) { T.path.splice(0, i + 1); T.pos -= s + len; s = 0; i = -1; continue; } // behind it: let go
      if (s < T.pos) return false; T.path.length = i; break;
    }
    p.tr = tr; s += len;
  }
  if (!T.path.length) return false;
  grow(T, net, LOOK); return true;
}
const onPath = (T, s, o) => { let i = 0; for (; i < T.path.length - 1 && s > T.path[i].tr.len; i++) s -= T.path[i].tr.len; const { tr, dir } = T.path[i]; return sample(tr, dir > 0 ? s : tr.len - s, o); };
const carAt = (T, i) => T.rev ? T.pos - T.L + T.c[i] : T.pos - T.c[i]; // car i's middle along the path (the engine is car 0)
const p1 = [0, 0, 0], p2 = [0, 0, 0];
function place(T) { // each car between its two wheel sets: x, y, z, yaw (it faces +x), pitch; dir / slope: the way the train goes
  T.lens.forEach((len, i) => {
    const s = carAt(T, i), b = len * 0.3; onPath(T, s + b, p1); onPath(T, s - b, p2);
    const dx = p1[0] - p2[0], dz = p1[2] - p2[2], car = T.cars[i];
    car.x = (p1[0] + p2[0]) / 2; car.y = (p1[1] + p2[1]) / 2 + CARS.rail; car.z = (p1[2] + p2[2]) / 2;
    car.dir = Math.atan2(-dz, dx); car.slope = Math.atan2(p1[1] - p2[1], Math.hypot(dx, dz));
    car.yaw = T.rev ? car.dir + Math.PI : car.dir; car.pitch = T.rev ? -car.slope : car.slope;
  });
}
// where a stop is asked for (play.js: q.step 'wait' to get on, q.due to get off at q.at): how far car 1 + i has to go to it
function stopAt(T, q) {
  const s0 = carAt(T, q.i + 1); let s = 0;
  for (const { tr, dir } of T.path) { if (tr.id === q.at.tr) { const d = s + (dir > 0 ? q.at.u : tr.len - q.at.u) - s0; if (d > -0.05) return d; } s += tr.len; }
  return Infinity;
}
// one frame: crowd the bodies to keep from (its own and the bridges' are marked .rail), st its play.js state (q: who is on or
// waiting at each wagon). Returns 'toot' when it hoots at someone in the way
export function stepTrain(T, net, dt, crowd, st) {
  grow(T, net, LOOK); let ev = null;
  const L = total(T), qs = (st?.q ?? []).filter(Boolean);
  const hop = qs.filter(q => q.step === 'board' || q.step === 'alight'); // someone hopping on or off: it waits (4 s at most)
  if (hop.length && (T.hold = (T.hold || 0) + dt) < 4) { T.v = 0; place(T); return null; }
  if (hop.length) for (const q of hop) st.q[q.i] = null; T.hold = 0;
  let lim = T.end ? L - T.pos : Infinity;
  for (const q of qs) if (q.step === 'wait' || q.due) { const d = stopAt(T, q); if (2 * SPEED.dec * (d + T.v * dt) + 0.05 >= T.v * T.v) lim = Math.min(lim, Math.max(0, d)); }
  // someone on the track ahead (2 along, as wide as the cars and a little more; not a rider, nor the train or a bridge): it
  // stops that far short of them
  const h = onPath(T, T.pos, [0, 0, 0]), m = onPath(T, T.pos + 1, [0, 0, 0]), f = onPath(T, T.pos + 2, [0, 0, 0]), W = 0.7; let by = null;
  for (const b of crowd) {
    if (b.rail || Math.abs(b.x - h[0]) > 4 || Math.abs(b.z - h[2]) > 4 || T.cars.some((c, i) => Math.hypot(b.x - c.x, b.z - c.z) < T.lens[i] / 2 - 0.2)) continue;
    if (gapTo(b, h[0], h[2], m[0], m[2]) < b.r + W || gapTo(b, m[0], m[2], f[0], f[2]) < b.r + W) { lim = Math.min(lim, Math.max(0, gapTo(b, h[0], h[2], h[0], h[2]) - b.r - W)); by = b; }
  }
  T.toot -= dt;
  if (by && T.toot <= 0) { T.toot = 2; by.yield?.(); ev = 'toot'; }
  T.stuck = by && T.v < 0.05 ? T.stuck + dt : 0;
  T.v = Math.max(0, Math.min(T.v + SPEED.acc * dt, SPEED.max, Math.sqrt(2 * SPEED.dec * Math.max(0, lim))));
  const d = Math.min(T.v * dt, Math.max(0, lim)); T.pos += d; T.odo += d;
  for (const q of qs) if ((q.step === 'wait' || q.due) && Math.abs(stopAt(T, q)) < 0.04 && T.v < 0.3) { T.v = 0; q.step = q.due ? 'alight' : 'board'; q.due = false; }
  // at an end (or held up 8 s): a moment's wait, then back the other way
  if ((T.end && L - T.pos < 0.02) || T.stuck > 8) { T.v = 0; if ((T.wait += dt) > 1) { T.path = flip(T.path); T.pos = L - (T.pos - T.L); T.rev = !T.rev; T.wait = T.stuck = 0; grow(T, net, LOOK); } }
  else T.wait = 0;
  while (T.path.length > 1 && T.path[0].tr.len < T.pos - T.L - 0.5) { T.pos -= T.path[0].tr.len; T.path.shift(); } // the track left behind
  place(T); return ev;
}
// a spot beside a straight track of the train's group (its middle) for a rider of size me (reach: nose from its middle) near
// x, z, ok(x, z): ground it may stand on. [x, z, at] (at: the track, how far along, where it stands, its height, facing the track)
export function boardAt(net, me, x, z, ok, hy) {
  let best = null, bd = Infinity; const o = [0, 0, 0], o2 = [0, 0, 0], D = 0.75 + me.reach + 0.15;
  for (const tr of net.group?.tracks ?? []) {
    if (!tr.straight) continue;
    const u = tr.len / 2; sample(tr, u, o); sample(tr, u + 0.5, o2);
    const tx = (o2[0] - o[0]) / 0.5, tz = (o2[2] - o[2]) / 0.5;
    for (const sd of [1, -1]) {
      const ax = o[0] - tz * sd * D, az = o[2] + tx * sd * D, d = Math.hypot(ax - x, az - z);
      if (d >= bd || !ok(ax, az)) continue;
      let clear = true; // nothing else of the network within reach of its tail
      for (const t of net.tracks) { if (t === tr) continue; for (let i = 0; i < t.pts.length && clear; i += 3) clear = Math.hypot(t.pts[i] - ax, t.pts[i + 2] - az) > 0.75 + Math.max(me.reach, me.back) + 0.1; if (!clear) break; }
      if (clear) { bd = d; best = [ax, az, { tr: tr.id, u, A: [ax, hy(ax, az), az], yaw: Math.atan2(-(o[2] - az), o[0] - ax) }]; }
    }
  }
  return best;
}

// node: a ring of four curves (a closed loop) runs round and round on it; with one curve gone it backs at each end; it stops
// before someone on the track and where a rider waits
export function selfCheck() {
  const hy = () => 0, ring = [[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], uid) => {
    for (let r = 0; r < 4; r++) { const tr = tracksOf([{ uid, prop: 'railcurve', x, z, rot: r * Math.PI / 2 }], hy)[0], e = [tr.pts.slice(0, 3), tr.pts.slice(-3)];
      if (e.every(p => Math.hypot(p[0], p[2]) < 2.01)) return { uid, prop: 'railcurve', x, z, rot: r * Math.PI / 2 }; }
  });
  console.assert(ring.every(Boolean), 'train.selfCheck ring'); if (!ring.every(Boolean)) return 'fail';
  const on = (net, T) => T.cars.every(c => net.tracks.some(t => { for (let i = 0; i < t.pts.length; i += 3) if (Math.hypot(t.pts[i] - c.x, t.pts[i + 2] - c.z) < 0.35) return true; return false; }));
  const bad = new Set(), chk = (k, v) => { if (!v) bad.add(k); };
  let net = network(tracksOf(ring, hy)), T = newTrain(net, 2), vmax = 0; chk(0, net.loop && !!T && Math.abs(net.group.len - 4 * Math.PI) < 1e-6);
  for (let k = 0; T && k < 900; k++) { stepTrain(T, net, 1 / 30, [], null); vmax = Math.max(vmax, T.v); chk(1, !T.rev && on(net, T)); }
  chk(2, T.odo > 30 && vmax > SPEED.max - 0.01);
  const open = network(tracksOf(ring.slice(1), hy)), U = newTrain(open, 2); let flips = 0, was = false;
  for (let k = 0; U && k < 1800; k++) { stepTrain(U, open, 1 / 30, [], null); if (U.rev !== was) { flips++; was = U.rev; } chk(3, on(open, U)); }
  chk(4, !open.loop && flips >= 2);
  const fork = network(tracksOf([{ uid: 1, prop: 'rail', x: -2, z: 2, rot: 0 }, { uid: 2, prop: 'railfork', x: 2, z: 2, rot: 0 }, { uid: 3, prop: 'rail', x: 6, z: 2, rot: 0 }], hy));
  const fs = fork.byId, [r1, f0, f1] = [...fs.values()];
  chk(5, fork.next(r1, 1).length === 2 && fork.next(f0, -1).length === 1 && fork.next(f1, -1).length === 1 && fork.next(f0, 1).length === 1 && !fork.loop);
  T = newTrain(net, 2); const pig = { x: 0, z: 0, yaw: 0, r: 0.5, seg: [-0.5, 0.5], yield() { this.told = true; } };
  onPath(T, T.pos + 4, p1); pig.x = p1[0]; pig.z = p1[2];
  for (let k = 0; k < 200; k++) stepTrain(T, net, 1 / 30, [pig], null);
  onPath(T, T.pos, p1); chk(6, T.v < 0.01 && pig.told && gapTo(pig, p1[0], p1[2], p1[0], p1[2]) > pig.r + 0.2);
  T = newTrain(net, 2); const tr = net.group.tracks[2], q = { i: 1, step: 'wait', at: { tr: tr.id, u: 1 } }, st = { q: [null, q] };
  for (let k = 0; k < 900 && q.step === 'wait'; k++) stepTrain(T, net, 1 / 30, [], st);
  sample(tr, 1, p1); chk(7, q.step === 'board' && Math.hypot(T.cars[2].x - p1[0], T.cars[2].z - p1[2]) < 0.3);
  console.assert(!bad.size, 'train.selfCheck ' + [...bad]); return bad.size ? 'fail ' + [...bad] : 'ok';
}
