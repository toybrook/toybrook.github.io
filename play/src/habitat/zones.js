// 28-1 땅 넓히기 구역: the board grows one strip at a time. Every habitat's first board is x -18..18, z -29..29; step n adds
// ZONES[hab][n-1] (data.js), a strip w wide along one side of the board as it was. Rects are [x0, x1, z0, z1].
// The back (-z) never grows: the shelf / forest there is not walked on. Pure: the layouts, props and rules read it.
// Each zone also has its own ground (SHAPES below): hills, a sled ramp, ice pillars, pools and rills, coloured patches, and the
// spots animals go to there (walk.js ctx.spots). zoneSet(hab, top) gathers those of the zones built (open or under mist);
// the habitat's layout adds them to its height field, its walkable ground and its colours, its water (meadow water.js) draws
// the pools and rills, and zoneprops.js builds what stands there.
import { ZONES, UNIT } from '../game/data.js';

// inbox 42 A: everything below in the old board's metres, times S (the zones' widths too; a pool's r, a rill's or a path's w
// stay, so the wider board has more open ground round them)
const S = UNIT;
export const BOARD0 = [-18, 18, -29, 29].map(v => v * S);
const SIDE = { '+x': [1, 1], '-x': [0, -1], '+z': [3, 1] };
// the board after step L (0: the first board)
export function rectAt(hab, L) {
  const r = [...BOARD0];
  for (const z of ZONES[hab].slice(0, L)) { const [i, s] = SIDE[z.side]; r[i] += s * z.w * S; }
  return r;
}
// zone k (1..6) of hab: its strip r, and pos(u, v) in it: u across, from the old edge (0) out (1); v along, back to front
// (±x sides) or left to right (+z)
export function strip(hab, k) {
  const z = ZONES[hab][k - 1], a = rectAt(hab, k - 1), b = rectAt(hab, k);
  const r = z.side === '+x' ? [a[1], b[1], b[2], b[3]] : z.side === '-x' ? [b[0], a[0], b[2], b[3]] : [b[0], b[1], a[3], b[3]];
  const pos = (u, v) => z.side === '+x' ? [r[0] + u * (r[1] - r[0]), r[2] + v * (r[3] - r[2])]
    : z.side === '-x' ? [r[1] - u * (r[1] - r[0]), r[2] + v * (r[3] - r[2])]
    : [r[0] + v * (r[1] - r[0]), r[2] + u * (r[3] - r[2])];
  return { ...z, k, r, pos, cx: (r[0] + r[1]) / 2, cz: (r[2] + r[3]) / 2 };
}
export const inRect = (r, x, z, m = 0) => x > r[0] + m && x < r[1] - m && z > r[2] + m && z < r[3] - m;
// how far x, z is inside r (< 0: outside)
export const edgeOf = (r, x, z) => Math.min(x - r[0], r[1] - x, z - r[2], r[3] - z);
// the 땅 넓히기 step the ground at x, z came with (0: the first board; 9: past every step)
export function ringIn(hab, x, z) { for (let k = 0; k <= ZONES[hab].length; k++) if (inRect(rectAt(hab, k), x, z)) return k; return 9; }
export const midOf = r => [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2];

const sm = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const segD = (x, z, [x1, z1], [x2, z2]) => {
  const dx = x2 - x1, dz = z2 - z1, t = Math.min(1, Math.max(0, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - x1 - dx * t, z - z1 - dz * t);
};
export const polyD = (x, z, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, segD(x, z, pts[i - 1], pts[i])); return m; };
// a moulded bank, as the meadow's (layout.js bankDepth): flat bed, steep start, rounded shoulder; d from the middle, w its half-width.
// The waterline (the dip = 0.55 over flat ground) is 0.4 in from w
const bank = (d, w) => { const t = Math.min(1, Math.max(0, (d - (w - 0.9)) / 1.5)); return 1.25 * (1 - t) * (1 - t); };

// ---- what each zone has, in its strip (s = strip(hab, k)): u across, v along (see strip) ----
// hill: a smooth bump h high, a across and b along (top: the share of it that stays flat); ramp: the sled hill, h high at its
// top end; col: a low flat-topped pillar; pool: a round hollow of water r (waterline r - 0.4) or, len, a long one (a capsule
// along z), hot: shallow and warm, isle: an island of that radius in it (iz, ilen: off the middle, long) with a strip of land
// (spit) under its bridge; rill: a little stream along pts; fall: water running down a ridge (drawn only); flat: the hills
// smoothed out; tint: the ground coloured c (rect r, ellipse, or a band rw either side of pts; pat: a pattern over it);
// path: a trodden path (c: its colour); spot: where animals go, act rest (stands or grazes a while), nap, bath (in the hot
// pool), slide (the penguin's belly slide to `to`)
const at = (s, u, v) => s.pos(u, v);
const H = (s, u, v, a, b, h, o) => { const [x, z] = at(s, u, v), X = s.side === '+z'; a *= S; b *= S; return { t: 'hill', x, z, rx: X ? b : a, rz: X ? a : b, h, ...o }; };
const POOL = (s, u, v, r, o) => { const [x, z] = at(s, u, v); return { t: 'pool', x, z, r, ...o }; };
const SPOT = (s, u, v, act, o) => { const [x, z] = at(s, u, v); return { t: 'spot', x, z, act, ...o }; };
const TINT = (s, u, v, a, b, c, k = 1, o) => { const [x, z] = at(s, u, v), X = s.side === '+z'; a *= S; b *= S; return { t: 'tint', x, z, rx: X ? b : a, rz: X ? a : b, c, a: k, ...o }; };
const RECT = (r, c, k = 1, o) => ({ t: 'tint', r, c, a: k, ...o }); // a: how strong (f.k is the zone's step)
// inbox 34 the zone's face: its own ground over the whole strip (a side strip's from the back shelf's foot). inbox 67-3: no
// crisp line any more, the edge blends over e: 3 m (the zone still reads by its trees and landmark)
const FACE = (s, c, k = 1, o) => RECT([s.r[0], s.r[1], s.side === '+z' ? s.r[2] : -23.4 * S, s.r[3]], c, k, { e: 3, ...o });
const hash = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };
// a pattern: a share p of the ground (cells `cell` m wide, or each point of the grid) in one of cols
const speck = (cols, p, cell) => (x, z) => { const n = cell ? hash(Math.floor(x / cell), Math.floor(z / cell)) : hash(x, z); return n < p ? cols[Math.floor(n / p * cols.length)] : null; };
// the orchard's floor: a soil furrow under each row of trees (rows: m from the strip's edge x0), mown stripes between
const mown = (x0, rows) => (x, z) => { const u = x - x0; for (const c of rows) if (Math.abs(u - c) < 0.45 + 0.04 * Math.sin(z * 2.1)) return '#9c6b43'; return Math.floor(u / 0.7) % 2 ? '#a7d65e' : null; };
export const ORCHARD_ROWS = [1.6, 4, 6.4].map(v => v * S); // zoneprops.js plants the trees on the furrows
const SAND = '#e6cf98', ICE = '#bfdff0', ROCK = '#9c978e', PATH = '#e6c48c', SNOWROCK = '#8e9097';
const GRAVEL = speck(['#e2dccd', '#8d867a', '#cfc4ad', '#a39a8a'], 0.6);
const P = pts => pts.map(([x, z, ...o]) => [x * S, z * S, ...o]); // a list of points (and spots) in the old board's metres
const SP = l => P(l).map(([x, z, act, o]) => ({ t: 'spot', x, z, act, ...o }));
const FORK = P([[-14.6, 32.6], [-10, 34.2], [-5, 33.4], [0, 34.3], [5.9, 33.7], [10.5, 34.2], [12.4, 33.7]]);
// 129 (?s129=1|2, a trial: the release build sets S129 = 0, tools/build-web.mjs): the hot spring as rock steps, its milky jade
// water (jade: meadow/water.js HOT) spilling from pool to pool down a notch in each rim (chute) and a fall. 1: three pools down
// the rock; 2: a small one up on the rock and a big one, a wooden deck before it, more lanterns. Laid out from the strip's middle
// (a +x strip: z runs along it); zoneprops.js builds the deck, the fence, the lanterns and the buckets where these say.
// 139-3 (=3): the ground itself rises into a snowy hill and the spring runs down it, each pool on its own ledge (shelf)
// 140 (=4): 3 again, the top pool really up the hill, pools out of round (wob), rock on the steep between them (zones.js),
// loose natural stones round them, thick slow steam (zoneprops.js)
const S129Q = 0; // release build: ?s129 off (the wide spring of 149 is S129 = 4)
export const S129 = S129Q || 4; // 149: the wide spring (144 C, =4) is the release; ?s129=1|2|3 still show the old trials
export const S129T = S129Q; // 149: the 넓히는 순간 (habitat.js) stays behind the flag
export const SOAK = new Map(); // 129: who soaks in the spring now, rec.id -> its head's top (walk.js), for the little puffs (zoneprops.js)
export const REVEAL = { k: 0, skip: null }; // 129 넓히는 순간 (?s129, ?z143): the zone being opened, for its fixtures to pop up (habitat.js sets it round the build, zoneprops.js reads it)
// 143 (?z143=1, a trial: the release build sets Z143 = 0, tools/build-web.mjs): the meadow's zones made again one at a time, each
// with a landmark read from the home view, its own fixtures and a thing only the animals there do, opened with 129's 넓히는 순간.
// Now the flower hill (flowerhill143), the small wood (grove143) and the fork (fork143); the reeds and the sandbar come under this flag next
export const Z143 = 0; // release build: the 143 zone trial stays off
const SOAKD = { polarBear: 0.78, seal: 0.71, arcticFox: 0.63, reindeer: 0.63 }, SOAKERS = Object.keys(SOAKD), // how much of each is under the water: to just under its eyes (measured: the eyes' bottom x the sleep's squash - 0.05)
  MOSS = speck(['#6d8a4a', '#5f7d44', '#8a8580'], 0.45, 0.55);
function spring129(s, v) {
  const [cx, cz] = at(s, 0.5, 0.5), p = (dx, dz) => [cx + dx, cz + dz], wl = q => q.r - 0.7;
  const hill = (dx, dz, rx, rz, h, top) => { const [x, z] = p(dx, dz); return { t: 'hill', x, z, rx, rz, h, top, rock: 1 }; };
  const pool = (dx, dz, r) => { const [x, z] = p(dx, dz); return { t: 'pool', x, z, r, hot: 1, jade: 1 }; };
  const spill = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L; // a's rim notched toward b, a fall into b
    return [{ t: 'chute', from: [a.x, a.z], to: [b.x - ux * (wl(b) - 0.3), b.z - uz * (wl(b) - 0.3)], d: 0.7 },
      { t: 'fall', from: [a.x + ux * wl(a), a.z + uz * wl(a)], to: [b.x - ux * wl(b), b.z - uz * wl(b)], w: 0.55, jade: 1 }]; };
  const rockFace = h => ({ t: 'tint', x: h.x, z: h.z, rx: h.rx + 0.4, rz: h.rz + 0.4, c: '#7d7872', a: 1, steep: 1 });
  const melt = q => ({ t: 'tint', x: q.x, z: q.z, rx: q.r + 2.4, rz: q.r + 2.4, c: '#57534f', a: 1, pat: MOSS }); // the snow melted round it: wet rock, moss
  const soak = (q, dx, dz, out) => ({ t: 'spot', x: q.x + dx, z: q.z + dz, act: 'bath', r: 0.35, soak: { d: SOAKD, out: p(...out), pool: q }, who: SOAKERS });
  const deck = r => [{ t: 'deck', r }, { t: 'flat', r: [r[0] - 1.6, r[1] + 1.6, r[2] - 1.6, r[3] + 1.6] }]; // the ground under it smoothed (no rolling)
  const sp = (act, dx, dz) => { const [x, z] = p(dx, dz); return { t: 'spot', x, z, act }; }, put = (t, dx, dz, o) => { const [x, z] = p(dx, dz); return { t, x, z, ...o }; };
  if (v === 2) {
    const T = hill(0.8, -7, 4.4, 4.2, 1.3, 0.65), A = pool(0.8, -7, 2.2), B = pool(-0.2, 1.6, 4.3);
    return [T, A, B, ...spill(A, B), rockFace(T), melt(A), melt(B),
      soak(B, -2, -0.2, [-2, 7.4]), soak(B, 2, 0.6, [2, 7.4]), soak(B, 0, -2.2, [-5.2, 1.6]), soak(A, 0, 0, [-2.2, -7]),
      sp('rest', -2, 8), sp('rest', 2, 8.2), ...deck([cx - 4, cx + 4, cz + 6.6, cz + 9]), { t: 'fence', pts: [p(4.5, -11), p(4.7, -1), p(4.5, 9)] },
      ...[[-4.4, 6.4], [3.6, 6.4], [-2.4, -10.2], [3.6, -3.8]].map(d => put('lantern', ...d)), put('buckets', 3.4, 8.6), put('buckets', -2.6, -4.4)];
  }
  const T0 = hill(0, -4.5, 6, 9, 1.4, 0.75), T1 = hill(0.5, -8, 4.4, 4.4, 1.4, 0.65), A = pool(0.5, -8, 2.3), B = pool(-0.4, -0.8, 2.6), C = pool(0, 7.3, 3.6);
  return [T0, T1, A, B, C, ...spill(A, B), ...spill(B, C), rockFace(T0), rockFace(T1), melt(A), melt(B), melt(C),
    soak(C, -1.9, 0.3, [-1.5, 11.8]), soak(C, 1.9, 0.6, [1.8, 11.8]), soak(C, 0, -1.9, [-4.5, 7.5]), soak(B, 0.2, 0.2, [3.6, -0.5]),
    sp('rest', -3, 14), sp('rest', 3, 15), ...deck([cx - 4.8, cx - 1.8, cz + 11.4, cz + 13.4]), { t: 'fence', pts: [p(4.4, 2), p(4.5, 11)] },
    put('lantern', -3.2, 10.6), put('lantern', 3.4, 4.2), put('buckets', 3.6, 12.4)];
}
// 139-3 (?s129=3): no board set on flat snow. Two smooth hills (a broad low one, a higher one behind) make one snowy rise
// that fades into the snowfield all round; the pools sit on ledges cut into it (shelf: the ground there held at the hills'
// height at its middle), the top one up on the rise, the middle one half way, the big one at the foot on the snowfield.
// Round each: wet pale stone under the rim stones, a moss collar, then clean snow (short soft fades: fo; no wide grey halo).
// The deck and the stone lanterns of 2 (one up by each pool), snowpines on the hill (pine), big capped rocks
// (boulder). Soak: leaning back against the rim, facing in, nose up (rot), the water at its chest (walk.js)
const ROCK4 = speck(['#8c8780', '#66625d'], 0.5, 0.5), SOAKD3 = { polarBear: 0.64, seal: 0.56, arcticFox: 0.56, reindeer: 0.68 },
  MOSS3 = speck(['#6f9446', '#8aab5c'], 0.5, 0.45);
function spring139(s, v) {
  const [cx, cz] = at(s, 0.5, 0.5), p = (dx, dz) => [cx + dx, cz + dz], wl = q => q.r - 0.7, kk = (q, a) => q.wob ? wk(q, a) : 1; // 140: kk the rim out of round
  const hill = (dx, dz, rx, rz, h) => { const [x, z] = p(dx, dz); return { t: 'hill', x, z, rx, rz, h }; };
  const pool = (dx, dz, r, wob) => { const [x, z] = p(dx, dz); return wob ? { t: 'pool', x, z, r, hot: 1, jade: 1, wob } : { t: 'pool', x, z, r, hot: 1, jade: 1 }; };
  const shelf = (q, e, ex, up) => ({ t: 'shelf', x: q.x, z: q.z, r: (q.wob ? q.r * (1 + q.wob[0] + q.wob[2]) : q.r) + 0.4, e, ex, up }); // (140: round its widest; 141 D ex: e longer by up to ex away from the uphill side, up)
  const ring = (q, c, full, out, a, pat) => { const f = { t: 'tint', x: q.x, z: q.z, rx: q.r + out, rz: q.r + out, fo: (out - full) / (q.r + out), c, a, pat }; if (q.wob) f.q = q; return f; }; // full to `full` past the rim, gone at `out` (140 q: round the pool's own shape)
  const spill = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, ka = kk(a, Math.atan2(uz, ux)), kb = kk(b, Math.atan2(-uz, -ux));
    return [{ t: 'chute', from: [a.x, a.z], to: [b.x - ux * (wl(b) * kb - 0.3), b.z - uz * (wl(b) * kb - 0.3)], d: 0.7 },
      { t: 'fall', from: [a.x + ux * wl(a) * ka, a.z + uz * wl(a) * ka], to: [b.x - ux * wl(b) * kb, b.z - uz * wl(b) * kb], w: 0.55, jade: 1 }]; };
  const soak = (q, a, out, off = 1.3) => { const d = Math.max(0.9, wl(q) * kk(q, a) - off); return { t: 'spot', x: q.x + Math.cos(a) * d, z: q.z + Math.sin(a) * d, act: 'bath', r: 0.3, soak: { d: SOAKD3, rot: 0.3, in: 1, out: p(...out), pool: q }, who: SOAKERS }; }; // off: in from the water's edge (144 C: 0.9 round the wide pool, so more fit)
  const sp = (act, dx, dz) => { const [x, z] = p(dx, dz); return { t: 'spot', x, z, act }; }, put = (t, dx, dz, o) => { const [x, z] = p(dx, dz); return { t, x, z, ...o }; };
  if (v === 4) { // 140: the hill up to 5 m (the top pool on it), the pools out of round, bare rock on the steep down the falls, pines
    // leaning on the hill round and behind the top pools (a dark ground for the steam), more big capped rocks on it
    // 144 C: wider — the big pool 1.6x the water (r 3.4 -> 4.12), the middle one 1.3x (2.5 -> 2.75), both out toward -x (the zone's
    // far side), the low hill and the top one broader to hold them, the deck longer and deeper; six soak places round the big
    // pool's rim (two ways out, its sides; a bear takes two), two in the middle one; up to 6 soak at once (cap: walk.js)
    const Hb = hill(-0.4, -4.5, 9.5, 13, 2.4), Ht = hill(0.8, -12.5, 7.5, 7.5, 4.6), A = pool(1.0, -10.6, 2.1, [0.18, 0.6, 0.1, 2.1]),
      B = pool(-1.8, -2.6, 2.75, [0.17, 2.4, 0.11, 0.3]), C = pool(-1.3, 7.8, 4.12, [0.19, 1.3, 0.1, 4.0]), D = [cx - 4.8, cx + 2.8, cz + 13.0, cz + 16.0];
    const soak6 = (q, a, out) => { const f = soak(q, a, out, 0.9); f.soak.cap = 6; return f; };
    return [Hb, Ht, A, B, C, shelf(A, 1.6), shelf(B, 1.8, 2.8, Math.atan2(A.z - B.z, A.x - B.x)), ...spill(A, B), ...spill(B, C), // 141 D: the middle ledge eases down into the slope below it (no step at the hill's foot); the top one's sides stay steep
      ...[A, B, C].flatMap(q => [ring(q, '#7f9c55', 0.3, 0.9, 0.7, MOSS3), ring(q, '#8a847c', -0.3, 0.3, 0.8)]), // moss, then dark wet stone under the rim
      ...spill(A, B).concat(spill(B, C)).filter(f => f.t === 'fall').map(f => ({ t: 'tint', pts: [f.from, f.to], rw: 2.0, c: '#78736d', a: 0.9, pat: ROCK4 })), // bare wet rock down each fall, the snow back from it
      ...[2.74, -2.94, -2.43].map(a => soak6(C, a, [-5.6, 10.0])), ...[-1.16, -0.66, 0.45].map(a => soak6(C, a, [3.7, 9.9])), // six round the rim, none under the fall (a -1.6) nor by the deck; set by a search of crowd.js capsules: 4 of bear seal fox reindeer seal at once, 5 of the smaller
      soak6(B, -2.5, [-5.3, 0.0]), soak6(B, -0.6, [2.3, -1.0]), soak6(A, -1.57, [-2.6, -9]),
      sp('rest', -2.8, 14.4), sp('rest', 0.4, 14.6), sp('rest', 2.2, 14.3), { t: 'deck', r: D }, { t: 'flat', r: [D[0] - 1.6, D[1] + 1.6, D[2] - 1.6, D[3] + 1.6] },
      put('lantern', -5.4, 13.2), put('lantern', 3.6, 13.4), put('lantern', 3.2, -4.6), put('lantern', -2.4, -12.4), put('buckets', 3.7, 15.6),
      ...[[3.6, -15.4, 1.1], [-1.6, -16.0, 1.0], [1.2, -18.2, 0.95], [4.6, -9.4, 0.9], [-3.8, -8.6, 0.85], [-6.0, -4.6, 0.85], [-4.4, -13.6, 0.8], [4.8, 1.8, 0.75]].map(([dx, dz, sc]) => put('pine', dx, dz, { sc })),
      ...[[2.0, -7.0, 1.2], [-2.1, -6.0, 0.9]].map(([dx, dz, sc]) => put('boulder', dx, dz, { sc }))]; // 141 D: two heaps on the bare rock by the top fall (no more strewn over the snow)
  }
  const Hb = hill(0.6, -4, 8, 13, 1.8), Ht = hill(1.2, -13, 7, 8, 3.0), A = pool(1.2, -9.5, 2.0), B = pool(-0.8, -2.2, 2.4), C = pool(-0.6, 7.4, 3.3);
  const D = [cx - 3.4, cx + 2.4, cz + 11.2, cz + 13.4];
  return [Hb, Ht, A, B, C, shelf(A, 1.6), shelf(B, 1.8), ...spill(A, B), ...spill(B, C),
    ...[A, B, C].flatMap(q => [ring(q, '#7f9c55', 0.45, 1.0, 0.82, MOSS3), ring(q, '#a39c92', -0.3, 0.3, 0.75)]), // moss, then wet stone under the rim stones
    soak(C, -2.5, [-5, 7]), soak(B, -1.57, [3, -0.6]), soak(C, -0.5, [3.8, 6.4]), soak(A, -1.57, [-2.4, -8]), // the pools' back halves, in from the rim, facing the view: two far apart in the big one, one in each other (B is too small for two big ones)
    sp('rest', -2.4, 12.3), sp('rest', 1.4, 12.4), { t: 'deck', r: D }, { t: 'flat', r: [D[0] - 1.6, D[1] + 1.6, D[2] - 1.6, D[3] + 1.6] },
    put('lantern', -4.2, 11.4), put('lantern', 3.4, 11.6), put('lantern', 3.6, -2.4), put('lantern', -1.8, -11.2), put('buckets', 4.2, 12.6),
    ...[[3.8, -14.2, 1.05], [-1.6, -14.6, 0.9], [4.2, -7.2, 0.85], [-4.8, -8.6, 0.95], [-4.6, -0.4, 0.8], [4.6, 1.6, 0.75]].map(([dx, dz, sc]) => put('pine', dx, dz, { sc })),
    ...[[3.4, -5.4, 0.7], [-3.4, -4.6, 0.6], [2.2, 2.4, 0.55], [-3.2, 3.4, 0.5], [4.0, -12, 0.65], [-2.6, -12.6, 0.5]].map(([dx, dz, sc]) => put('boulder', dx, dz, { sc }))];
}
// 143 the flower hill (?z143=1): one high round hill (3.6 m, a flat top) where the strip meets the home view, three rings of tall
// flower bushes round it (zoneprops.js: yellow at the foot, pink, lavender near the top), a big tree with a swing on the top; a
// mown lane down its front-left side, where a sheep, a pig or a rabbit rolls down (tumble: walk.js); spots just off the flowers
// where one lies down and sniffs them (sniff, facing in); beehives with a lantern, a flower basket, a low fence, two heaps of stones.
// The lane (lx, lz: its way down from the top, toward the old ground and the view) keeps the flowers off it (zoneprops.js)
function flowerhill143(s) {
  const [cx, cz] = at(s, 0.475, 0.52), p = (dx, dz) => [cx + dx, cz + dz], lx = -0.666, lz = 0.746, L = (d, o = 0) => p(lx * d - lz * o, lz * d + lx * o); // o: off the lane, to its right going down
  const hill = { t: 'hill', x: cx, z: cz, rx: 5.4, rz: 8.2, h: 3.6, top: 0.3 }, rim = (a, q) => p(Math.cos(a) * hill.rx * q, Math.sin(a) * hill.rz * q);
  const sp = (act, [x, z], o) => ({ t: 'spot', x, z, act, ...o }), put = (t, [x, z], o) => ({ t, x, z, ...o });
  return [FACE(s, '#93cf4c', 0.35), hill,
    { t: 'tint', pts: [L(1.2), L(7.6)], rw: 1.0, c: '#b4dd74', a: 0.75 }, // the lane: mown short, lighter (the way up: the flowers stand 2 m off it)
    sp('tumble', L(1.7), { r: 0.4, to: L(8.2), who: ['sheep', 'pig', 'rabbit'] }), // the roll from the top to past the foot
    ...[1.15, 1.75].map(a => sp('sniff', rim(a, 1.06), { r: 0.25, to: [cx, cz] })), // just off the yellow ring (its bushes keep 1.35 clear), in front
    sp('rest', p(-1.6, 11.4)),
    put('tree143', p(0.8, -1.4), { sc: 1.05 }), put('swing143', p(-0.7, -0.3)), // the swing hangs off a branch out toward the old ground and the view (its seat side on)
    put('hives', p(3.1, 10.6)), put('lantern143', p(4.3, 9.9)), put('basket', L(8.6, -2.6)),
    { t: 'fence143', pts: [p(4.6, 7.4), p(4.8, 12.4), p(1.6, 13.0)] },
    put('heap143', p(-4.9, -2.6), { sc: 1.25 }), put('heap143', p(-4.4, 12.0), { sc: 1.0 }), put('heap143', p(4.4, -5.4), { sc: 0.85 })];
}
// 145 B: where the flower hill stands (the hill and its flower bands, the mown lane to the roll's end): off(x, z, r) in world m, for
// rules.js clear143 (the old natives on it go once)
export const hill143 = () => {
  const k = ZONES.meadow.findIndex(z => z.id === 'flowerhill') + 1, F = flowerhill143(strip('meadow', k)), h = F.find(f => f.t === 'hill');
  const lane = [...F.find(f => f.t === 'tint' && f.pts).pts, F.find(f => f.act === 'tumble').to];
  return Object.assign((x, z, r) => Math.hypot((x - h.x) / (h.rx + r), (z - h.z) / (h.rz + r)) < 1 || polyD(x, z, lane) < 1 + r, { h, lane });
};
// 143 the small wood (?z143=1): one big old tree (about twice the others) on a low round rise of the ground, its roots out over
// the ground and a hollow low in its trunk toward the view (door: which way, zoneprops.js); in front, in its shade, a ring of
// spots where one lies down for a nap and calls two or three near by to lie down round the tree too (shade, to: the trunk:
// walk.js); a bench facing it, stumps, toadstools, heaps of fallen leaves, a heap of half sunk stones. Its other trees stand
// back from it (zoneprops.js fore)
function grove143(s) { // the strip is 12 m across: the tree in its middle, the ring along it (x within 4.6 of it)
  const [cx, cz] = at(s, 0.5, 0.55), p = (dx, dz) => [cx + dx, cz + dz], to = [cx, cz];
  const sp = (act, [x, z], o) => ({ t: 'spot', x, z, act, ...o }), put = (t, [x, z], o) => ({ t, x, z, ...o });
  return [FACE(s, '#4b7a30', 0.85, { pat: speck(['#6f9a3c', '#3b6326', '#5a8a34'], 0.35, 0.3) }), { t: 'hill', x: cx, z: cz, rx: 5.6, rz: 7.5, h: 0.8, top: 0.4 },
    { t: 'tint', x: cx + 0.3, z: cz + 2.2, rx: 6, rz: 8.5, c: '#34562a', a: 0.5 }, // the old tree's shade
    ...[[2.2, 5.6], [4.4, 3.4], [-3.2, 5.0], [-0.8, 8.6], [-4.3, 1.6]].map(d => sp('shade', p(...d), { r: 0.3, to })), // between its roots, most in front (the crown hides the back)
    SPOT(s, 0.25, 0.32, 'rest'), SPOT(s, 0.65, 0.86, 'rest'),
    put('oak143', to, { sc: 2.3, door: 1.15 }), put('bench143', p(3.0, 9.6)), put('heap143', p(-4.0, 10.6), { sc: 1.0 }),
    ...[[-4.2, 8.4, 1.0], [4.3, 6.8, 0.85], [-4.2, -3.6, 1.1]].map(([dx, dz, sc]) => put('stump143', p(dx, dz), { sc })),
    ...[[-2.7, 1.7], [2.9, -1.3], [-2.3, 9.8], [4.6, 11.0]].map(d => put('shrooms143', p(...d))),
    ...[[0.6, 7.2, 1.0], [4.6, 9.0, 0.85], [-4.6, 6.8, 0.8], [3.4, -4.4, 0.9]].map(([dx, dz, sc]) => put('leaves143', p(dx, dz), { sc }))];
}
// 143 the fork (?z143=1): the meadow's stream splits at J and runs round a low island in the strip's middle, each arm into a round
// pool of its own (A along the front, toward the view; B behind it, along the old ground). On the island a cottage, its gable to
// the view (lit windows at night), and beside it on A a big waterwheel turning in the stream: both read from the home view
// (zoneprops.js). The old path crosses B on four stepping stones (ford: their middles; zoneprops.js adds each one's top and wet)
// and A on a little plank bridge. Animals hop over the stones (ford: walk.js, from one end to the other, to), drink at the water's
// edge (drink, facing to); heaps of half sunk stones on the banks. even: each water's level from its own banks, not where they
// run into the other's hollow (meadow/water.js). In world m (the strip is z 43.5-55.5; the path comes in at x 7.5 and leans +x)
function fork143() {
  const J = [-8, 48.8], A = [[-22.3, 48.5], [-15, 48.3], J, [-4, 51.2], [2, 52.3], [9, 52.5], [16, 52.1], [21, 51.0], [24, 50.4]], B = [[12, 46.3], [10.5, 46.0], [6, 45.6], [0.5, 45.8], [-4.5, 46.6], J];
  const ford = [[7.68, 44.3], [7.905, 45.3], [8.13, 46.3], [8.355, 47.3]], a = [7.45, 43.3], b = [8.58, 48.3]; // on the path's line
  const sp = (act, [x, z], o) => ({ t: 'spot', x, z, act, ...o }), put = (t, [x, z], o) => ({ t, x, z, ...o }), gr = o => ({ t: 'tint', c: '#b8ad98', a: 0.9, pat: GRAVEL, ...o });
  return [gr({ pts: A, rw: 2.6 }), gr({ pts: B, rw: 2.6 }), gr({ x: 25, z: 50.2, rx: 3.6, rz: 3.3 }), gr({ x: 13.5, z: 46.6, rx: 3.0, rz: 2.7 }), // gravel banks
    { t: 'rill', pts: A, w: 1.4, even: 1 }, { t: 'rill', pts: B, w: 1.4, even: 1 }, { t: 'pool', x: 25, z: 50.2, r: 2.3, even: 1 }, { t: 'pool', x: 13.5, z: 46.6, r: 1.7, even: 1 },
    { t: 'flat', r: [-3.6, 3.6, 46.4, 51.4] }, // the cottage's ground
    sp('ford', a, { r: 0.3, to: b, ford }), sp('ford', b, { r: 0.3, to: a, ford: [...ford].reverse() }), // the same stones either way
    sp('drink', [2.0, 43.7], { r: 0.3, to: [2.0, 45.75] }), sp('drink', [14, 50.1], { r: 0.3, to: [14, 52.2] }), sp('drink', [27.6, 48.6], { r: 0.3, to: [25, 50.2] }),
    sp('rest', [-14, 45.6]), sp('rest', [19.5, 47.6]),
    put('cottage143', [-1.2, 48.9]), put('wheel143', [2.9, 52.35], { aim: 1.2 }), put('bridge143', [9.53, 52.5]), put('sign143', [4.3, 44.1]), // the sign by the stones
    put('heap143', [-6.2, 45.2], { sc: 1.1 }), put('heap143', [4.6, 50.0], { sc: 0.9 }), put('heap143', [16.6, 49.6], { sc: 1.0 }), put('heap143', [-17, 46.0], { sc: 0.85 })];
}
// 143 even (fork143): where two waters run into each other their hollows overlap, the ground there lower than either's own bank.
// In another even water's hollow (W: the zone set's pools and rills; round pools only): such a water's level is taken from its
// banks out of it (meadow/water.js, zoneprops.js)
export const otherWater = (W, f, x, z) => W.some(q => q !== f && q.even && (q.t === 'rill' ? polyD(x, z, q.pts) - q.w : Math.hypot(x - q.x, z - q.z) - q.r) < 0.6);
// the fork's middle (x across, the strip's own z): no trees, bushes or strewn rocks there (the cottage and the wheel stay in view)
export const fore143 = (x, z) => x > -10 && x < 17 && z > 43.5;
// 149: where the wide spring's pools (to 0.4 past the rim), deck and falls are: off(x, z, r) in world m, for rules.js clear149
export const spring149off = () => {
  const F = spring139(strip('snow', ZONES.snow.findIndex(z => z.id === 'hotspring') + 1), 4);
  return (x, z, r) => F.some(f => f.t === 'pool' ? Math.hypot(x - f.x, z - f.z) - f.r * (1 + f.wob[0] + f.wob[2]) < 0.4 + r
    : f.t === 'flat' ? inRect(f.r, x, z, -r) : f.t === 'fall' && polyD(x, z, [f.from, f.to]) < 1 + r);
};
// 143 B: where the fork's new water is, its middle (fore143) and its strip: off(x, z, r, prop) in world m, for rules.js clear143 (the
// old natives in the water, a tree, bush or rock in the middle, a strewn rock anywhere in the strip go once; low flowers stay)
export const fork143off = () => {
  const s = strip('meadow', ZONES.meadow.findIndex(z => z.id === 'fork') + 1), W = fork143().filter(f => f.t === 'rill' || f.t === 'pool');
  return (x, z, r, prop) => W.some(f => (f.t === 'rill' ? polyD(x, z, f.pts) - f.w : Math.hypot(x - f.x, z - f.z) - f.r) < 0.4 + r) // to its water's rim (wd 0.8 off)
    || prop !== 'wildflowers' && inRect(s.r, x, z) && (prop === 'rock' || fore143(x, z));
};
const SHAPES = {
  meadow: {
    flowerhill: s => Z143 ? flowerhill143(s) : [FACE(s, '#93cf4c', 0.35), // inbox 67-3 the meadow's own green: the flowers stand in it (zoneprops.js drifts), none painted
      H(s, 0.5, 0.6, 3.6, 6.5, 2.8), H(s, 0.42, 0.22, 2.6, 3.4, 1.2), // the hill twice as high, its outline seen from the side
      SPOT(s, 0.5, 0.56, 'rest'), SPOT(s, 0.5, 0.62, 'nap'), SPOT(s, 0.42, 0.22, 'rest'), SPOT(s, 0.6, 0.75, 'rest')],
    grove: s => Z143 ? grove143(s) : [FACE(s, '#4b7a30', 0.85, { pat: speck(['#6f9a3c', '#3b6326', '#5a8a34'], 0.35, 0.3) }), H(s, 0.55, 0.55, 2.8, 5, 0.5), // moss under the trees
      TINT(s, 0.55, 0.52, 3.4, 9, '#34562a', 0.5), // the old tree's shade
      SPOT(s, 0.25, 0.32, 'rest'), SPOT(s, 0.7, 0.45, 'nap'), SPOT(s, 0.3, 0.62, 'rest'), SPOT(s, 0.65, 0.86, 'rest')],
    fork: s => Z143 ? fork143(s) : [{ t: 'tint', pts: FORK, rw: 3.2, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'tint', x: 14 * S, z: 33.5 * S, rx: 4.2, rz: 3.4, c: '#b8ad98', a: 0.9, pat: GRAVEL }, // gravel banks
      { t: 'rill', pts: FORK, w: 1.5 }, { t: 'pool', x: 14 * S, z: 33.5 * S, r: 2.3 }, // wider; the stepping stones where the path crosses (zoneprops.js)
      ...SP([[-9, 30.8, 'rest'], [-6.5, 30.9, 'nap'], [2.5, 30.8, 'rest'], [18, 33.4, 'rest']])],
    orchard: s => [FACE(s, '#79b444', 0.9, { pat: mown(s.r[0], ORCHARD_ROWS) }), ...SP([[30, -2.2, 'rest'], [28.7, 7.4, 'nap'], [31.3, 21.8, 'rest']])], // in the lanes between the rows,
    lookout: s => [FACE(s, '#b9c45a', 0.55), H(s, 0.5, 0.4, 4.4, 9.5, 6.5, { top: 0.38 }), // a high hill, flat on top for the gazebo (inbox 42 C2: 3.4 -> 6.5, with the gazebo 3H)
      { t: 'path', pts: P([[-29, 13], [-30.6, 9.5], [-29.3, 6], [-30.4, 3], [-30, 0.5]]), w: 0.7, c: '#c99a62' }, // the dirt path up
      ...SP([[-30.3, 0.8, 'rest'], [-29.7, -6, 'nap'], [-29.5, 4, 'rest'], [-29.5, 15, 'rest']])],
    mushroom: s => [FACE(s, '#5a6a35', 0.85, { pat: speck(['#d0782f', '#a9532a', '#e0b040', '#8a5a2b'], 0.32, 0.3) }), // fallen leaves on the forest floor
      { t: 'path', pts: P([[-15.5, 41.6], [-8, 40.1], [0, 42], [8, 40.6], [16, 42.1], [24, 40.5], [31.5, 41.6]]), w: 0.9 },
      ...SP([[-11, 42.6, 'rest'], [-3, 39.4, 'nap'], [12, 43.2, 'rest'], [20, 38.8, 'nap'], [28, 43.2, 'rest']])],
  },
  pond: {
    reeds: s => [FACE(s, '#7b6a44', 0.8, { pat: speck(['#6a5a38', '#8d7d52', '#5f7f3a'], 0.35, 0.3) }), // wet earth
      { t: 'rill', pts: P([[22.5, -22], [21.5, -14], [23.6, -6], [21.6, 2], [23.6, 10], [21.8, 18], [22.6, 25]]), w: 0.9 }, // channels between the reeds
      { t: 'rill', pts: P([[21.6, 2], [19.8, 5.5], [20.2, 9]]), w: 0.9 }, { t: 'rill', pts: P([[21.5, -14], [19.8, -17.5], [20.2, -21]]), w: 0.9 },
      ...SP([[24, -14, 'rest'], [19.4, -6, 'rest'], [24.2, 2, 'nap'], [19.4, 13, 'rest'], [24.4, 22, 'rest']])],
    falls: s => [FACE(s, '#557f36', 0.85, { pat: speck(['#8e8a80', '#77736b', '#6b9640'], 0.35, 0.35) }), // moss and stones
      H(s, 0.5, 0.36, 3.8, 4.2, 11, { rock: 1, top: 0.3 }), TINT(s, 0.5, 0.36, 4.0, 4.4, ROCK, 1, { steep: 1 }), POOL(s, 0.5, 0.47, 2.4), // a rock cliff, its pool at its foot (inbox 42 C2: 6.2 -> 11, 3.3H)
      { t: 'fall', from: at(s, 0.5, 0.36), to: at(s, 0.5, 0.47), w: 1.3 }, SPOT(s, 0.15, 0.5, 'rest'), SPOT(s, 0.8, 0.62, 'rest'), SPOT(s, 0.5, 0.75, 'nap'), SPOT(s, 0.2, 0.22, 'rest')],
    sandbar: s => [FACE(s, SAND, 1, { pat: speck(['#f3e4b8', '#d9c088'], 0.4) }), H(s, 0.5, 0.35, 2.4, 9, 0.3), POOL(s, 0.5, 0.7, 2.2),
      SPOT(s, 0.5, 0.22, 'nap'), SPOT(s, 0.45, 0.4, 'nap'), SPOT(s, 0.55, 0.52, 'rest'), SPOT(s, 0.4, 0.85, 'rest')],
    lotus: s => { const [x, z] = at(s, 0.5, 0.48); // one big pond, long down the strip
      return [FACE(s, '#6f8c4c', 0.8, { pat: speck(['#5d7a3c', '#86a35a'], 0.3, 0.4) }), { t: 'flat', r: [s.r[0], s.r[1], z - 15 * S, z + 15 * S] }, { t: 'pool', x, z, r: 2.9, len: 20 * S },
        SPOT(s, 0.5, 0.2, 'rest'), SPOT(s, 0.4, 0.12, 'rest'), SPOT(s, 0.5, 0.82, 'nap'), SPOT(s, 0.6, 0.94, 'rest')]; },
    isle: s => { const [x] = at(s, 0.5, 0); // a bigger island, its bridge long, to the front
      const iz = 2.5 * S; return [FACE(s, '#8ccf5a', 0.55), { t: 'pool', x, z: 4 * S, r: 3.5, len: 7 * S, isle: 1.6, iz, ilen: 2.6 },
        { t: 'spot', x, z: iz + 0.9, act: 'nap', r: 0.4 }, { t: 'spot', x: x - 0.5, z: iz, act: 'rest', r: 0.4 }, SPOT(s, 0.25, 0.3, 'rest'), SPOT(s, 0.3, 0.82, 'rest')]; }, // inbox 42 C2: the spots off the rock stack on the back end
    swamp: s => [FACE(s, '#4a4a2c', 0.9, { pat: speck(['#3d3d24', '#5a5a36', '#4f5a2e'], 0.4, 0.5) }), // dark mud, dark water
      ...P([[-22, 41, 2.2], [-4, 40.6, 2.4], [14, 41.4, 2.2]]).map(([x, z, r]) => ({ t: 'pool', x, z, r, murk: 1 })),
      ...SP([[-29, 41, 'rest'], [-18, 42.2, 'rest'], [-9, 39.6, 'nap'], [5, 42.6, 'rest'], [17.5, 39.2, 'nap'], [29, 40.6, 'rest']])],
  },
  snow: {
    conifer: s => [SPOT(s, 0.3, 0.42, 'rest'), SPOT(s, 0.7, 0.62, 'nap'), SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.6, 0.2, 'rest')],
    sled: s => { const [x, z0] = at(s, 0.5, 0.3), z1 = at(s, 0.5, 0.64)[1];
      return [{ t: 'ramp', x, z0, z1, rx: 2.6, h: 3.6 }, ...[-0.55, 0.55].map(d => ({ t: 'tint', x: x + d, z: (z0 + z1) / 2 + 1.5, rx: 0.16, rz: (z1 - z0) / 2 + 1.5, c: '#c4d4e6', a: 0.7 })), // sled tracks
        { t: 'spot', x, z: z0 + 1.2, act: 'slide', to: [x, z1 + 1.5] }, { t: 'spot', x: x + 0.8, z: z0 + 2.4, act: 'slide', to: [x - 0.6, z1 + 2] },
        { t: 'spot', x: x + 1, z: z1 + 3.5, act: 'rest' }, { t: 'spot', x: x - 1.5, z: z1 + 5, act: 'nap' }, SPOT(s, 0.5, 0.86, 'rest')]; },
    pillars: () => [...P([[-20, 31.6, 1.0, 0.8], [-14.5, 34.6, 0.9, 0.6], [-9, 31.2, 1.1, 0.9], [-3, 34.4, 0.9, 0.7], [3, 31.6, 1.0, 0.85], [9, 34.6, 0.95, 0.65], [14.5, 31.2, 1.05, 0.8], [20, 34.2, 0.9, 0.7]])
        .flatMap(([x, z, r, h]) => [{ t: 'col', x, z, r, h }, { t: 'tint', x, z, rx: r + 1.4, rz: r + 1.4, c: ICE, a: 0.75 }]), // each pillar on a round of ice
      ...SP([[-11.8, 33.2, 'rest'], [6, 33, 'nap'], [17.5, 32.8, 'rest']])],
    hotspring: s => S129 >= 3 ? spring139(s, S129) : S129 ? spring129(s, S129) : [POOL(s, 0.5, 0.5, 2.9, { hot: 1 }), TINT(s, 0.5, 0.5, 3.6, 3.6, SNOWROCK, 0.55),
      SPOT(s, 0.45, 0.48, 'bath', { r: 0.6 }), SPOT(s, 0.55, 0.53, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.42, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.25, 'rest'), SPOT(s, 0.5, 0.75, 'rest')],
    cave: s => [H(s, 0.6, 0.42, 3.0, 4.6, 10, { rock: 1 }), // inbox 42 C2: 3.2 -> 10 (3H), its mouth at its foot (zoneprops.js)
      TINT(s, 0.6, 0.42, 3.2, 4.8, SNOWROCK, 1, { steep: 1 }), // a round rock hill, the cave's mouth on its front (+z: toward the camera)
      SPOT(s, 0.52, 0.5, 'nap'), SPOT(s, 0.66, 0.5, 'nap'), SPOT(s, 0.25, 0.25, 'rest'), SPOT(s, 0.25, 0.7, 'rest')],
    iceplate: () => [{ t: 'flat', r: [-27, 27, 38.6, 44.2].map(v => v * S) }, RECT([-26, 26, 39.2, 43.6].map(v => v * S), ICE, 1), // under the ice sheet (zoneprops.js)
      ...SP([[-21, 40.5, 'slide', { to: [-11 * S, 42.4 * S] }], [-3, 42.4, 'slide', { to: [7 * S, 40.2 * S] }], [12, 40.4, 'slide', { to: [22 * S, 42.6 * S] }],
      [-29.5, 41, 'rest'], [29.5, 41.2, 'rest'], [0, 38, 'nap']])],
  },
  // 14-3 the dino jungle. dig: an animal paws at the sand a while (walk.js), now and then turning up a fossil (rules.js dig);
  // roll: wallows in the mud (as the snow pile's roll)
  dino: {
    fernwood: s => [FACE(s, '#4e8a36', 0.85, { pat: speck(['#3f7a2c', '#5f9a3c', '#6aa640'], 0.35, 0.35) }), H(s, 0.5, 0.5, 2.8, 5, 0.6), // fern shade on a low rise
      SPOT(s, 0.3, 0.3, 'rest'), SPOT(s, 0.65, 0.5, 'nap'), SPOT(s, 0.35, 0.7, 'rest'), SPOT(s, 0.6, 0.9, 'rest')],
    cliffs: s => [FACE(s, '#7e8a58', 0.6), H(s, 0.55, 0.38, 3.4, 4.4, 9, { rock: 1, top: 0.3 }), TINT(s, 0.55, 0.38, 3.6, 4.6, ROCK, 1, { steep: 1 }), // a rock hill (3H)
      ...[[0.3, 0.66], [0.7, 0.8], [0.35, 0.93]].flatMap(([u, v]) => { const [x, z] = at(s, u, v); return [{ t: 'col', x, z, r: 1.1, h: 1.4 }, { t: 'tint', x, z, rx: 2.2, rz: 2.2, c: ROCK, a: 0.8 }]; }), // rock stacks: the pterosaur's perches
      SPOT(s, 0.55, 0.6, 'rest'), SPOT(s, 0.55, 0.87, 'nap'), SPOT(s, 0.25, 0.18, 'rest')],
    riverbed: () => { const pts = P([[-24, 33.4], [-16, 31.6], [-8, 34.2], [0, 32.2], [8, 34.4], [16, 32.4], [24, 33.8]]);
      return [{ t: 'tint', pts, rw: 2.8, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'rill', pts, w: 1.4 },
        ...SP([[-20, 30.8, 'rest'], [-4, 30.6, 'nap'], [12, 35.8, 'rest'], [20, 30.8, 'rest'], [4, 36.1, 'rest']])]; },
    bigdig: s => [FACE(s, SAND, 1, { pat: speck(['#d9c088', '#f0ddb0', '#c8a870'], 0.4, 0.4) }), { t: 'flat', r: s.r }, TINT(s, 0.5, 0.5, 2.6, 7, '#c8a870', 0.7), // the dug ground, darker
      SPOT(s, 0.35, 0.45, 'dig', { r: 1.6 }), SPOT(s, 0.62, 0.75, 'dig', { r: 1.6 }), SPOT(s, 0.3, 0.88, 'rest'), SPOT(s, 0.72, 0.12, 'nap')],
    mudflat: s => [FACE(s, '#6e5a3a', 0.85, { pat: speck(['#5e4a30', '#7a6440', '#56703a'], 0.4, 0.5) }), POOL(s, 0.5, 0.28, 2.4, { murk: 1 }), POOL(s, 0.45, 0.72, 2.6, { murk: 1 }),
      TINT(s, 0.5, 0.5, 2.6, 4, '#5e4028', 0.8), // the wallow between the pools
      SPOT(s, 0.55, 0.5, 'roll', { r: 1.4 }), SPOT(s, 0.4, 0.48, 'roll', { r: 1.4 }), SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.7, 0.14, 'nap')],
    springs: s => [FACE(s, '#7a8a5a', 0.5), ...[[0.5, 0.25, 2.4], [0.45, 0.52, 2.8], [0.55, 0.78, 2.4]].flatMap(([u, v, r]) => [POOL(s, u, v, r, { hot: 1 }), TINT(s, u, v, r / S + 0.8, r / S + 0.8, '#a39a8a', 0.6)]),
      SPOT(s, 0.4, 0.52, 'bath', { r: 0.6 }), SPOT(s, 0.52, 0.525, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.25, 'bath', { r: 0.6 }), SPOT(s, 0.55, 0.78, 'bath', { r: 0.6 }),
      SPOT(s, 0.5, 0.1, 'rest'), SPOT(s, 0.5, 0.92, 'rest'), SPOT(s, 0.5, 0.38, 'nap'), SPOT(s, 0.5, 0.65, 'nap')],
  },
};
// the island's spit: from the island out to the pool's front end (inbox 34; a round one's: to the old-edge side, u = 0), as
// wide as the planks on it
const SPIT = 0.55;
function spitOf(f, s) { if (f.len) return [[f.x, f.iz ?? f.z], [f.x, f.z + f.len / 2 + f.r + 0.4]]; const [x, z] = at(s, 0.02, 0.5); return [[f.x, f.z], [x + (x - f.x) * 0.02, z]]; }
// a pool's distance from its middle line (a capsule along z, len long; a round pool's: from its middle), its island's
// 140 (?s129=4) wob: a round pool out of round (a natural one), its radius times wk at the angle round it
export const wk = (f, a) => 1 + f.wob[0] * Math.sin(2 * a + f.wob[1]) + f.wob[2] * Math.sin(3 * a + f.wob[3]);
const pd = (f, x, z) => f.wob ? Math.hypot(x - f.x, z - f.z) / wk(f, Math.atan2(z - f.z, x - f.x)) : Math.hypot(x - f.x, Math.max(0, Math.abs(z - f.z) - (f.len || 0) / 2));
const idd = (f, x, z) => Math.hypot(x - f.x, Math.max(0, Math.abs(z - (f.iz ?? f.z)) - (f.ilen || 0) / 2));
// a point r from pool f's middle line, t (0..1) round it from +x: [x, z, and the middle line's point it is out from]
export function poolAt(f, t, r) {
  if (f.wob) { const q = t * 2 * Math.PI, R = r * wk(f, q); return [f.x + Math.cos(q) * R, f.z + Math.sin(q) * R, f.x, f.z]; } // 140
  const L = f.len || 0, a = Math.PI * r; let s = (((t % 1) + 1) % 1) * (2 * a + 2 * L);
  if (s < a) { const q = s / r; return [f.x + Math.cos(q) * r, f.z + L / 2 + Math.sin(q) * r, f.x, f.z + L / 2]; }
  s -= a; if (s < L) return [f.x - r, f.z + L / 2 - s, f.x, f.z + L / 2 - s];
  s -= L; if (s < a) { const q = Math.PI + s / r; return [f.x + Math.cos(q) * r, f.z - L / 2 + Math.sin(q) * r, f.x, f.z - L / 2]; }
  s -= a; return [f.x + r, f.z - L / 2 + s, f.x, f.z - L / 2 + s];
}

// ---- the zones built on the board of step top: one object the layout reads ----
export function zoneSet(hab, top) {
  const F = [];
  for (let k = 1; k <= Math.min(top, ZONES[hab].length); k++) {
    const s = strip(hab, k);
    for (const f of SHAPES[hab][s.id](s)) { f.k = k; f.zone = s.id; if (f.isle) f.spit = spitOf(f, s); F.push(f); }
  }
  const of = t => F.filter(f => f.t === t);
  const ramps = of('ramp'), hills = [...of('hill'), ...ramps, ...of('col')], pools = of('pool'), rills = of('rill'), flats = of('flat'), tints = of('tint'), paths = of('path');
  const water = [...pools, ...rills], chutes = of('chute'), shelves = of('shelf');
  const hsum = (x, z) => { // the hills, ramps and pillars at x, z (lift adds the shelves)
    let h = 0;
    for (const f of hills) {
      if (f.t === 'hill') { const dx = (x - f.x) / f.rx, dz = (z - f.z) / f.rz; const q = Math.hypot(dx, dz); if (q < 1) h += f.h * sm(f.top ? (1 - q) / (1 - f.top) : 1 - q); }
      else if (f.t === 'ramp') { const ax = Math.abs(x - f.x); if (ax < f.rx + 2.2 && z > f.z0 - 4 && z < f.z1) h += f.h * sm((f.rx + 1.1 - ax) / 2.2) * (z < f.z0 ? sm(1 - (f.z0 - z) / 4) : sm((f.z1 - z) / (f.z1 - f.z0))); }
      else { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 0.6) h += f.h * sm((f.r + 0.25 - d) / 0.5); }
    }
    return h;
  };
  // signed distance to a pool's / rill's water (< 0: in it). hot: count the warm pools (only the colours and the hills do)
  const wd1 = (f, x, z) => {
    if (f.t === 'rill') return polyD(x, z, f.pts) - (f.w - 0.4);
    let e = pd(f, x, z) - (f.r - (f.hot ? 0.7 : 0.4));
    if (f.isle) e = Math.max(e, f.isle + 0.6 - idd(f, x, z), SPIT + 0.05 - polyD(x, z, f.spit));
    return e;
  };
  const near = (f, x, z, m) => f.t === 'rill' ? true : Math.abs(x - f.x) < f.r + m && Math.abs(z - f.z) < f.r + (f.len || 0) / 2 + m;
  const Z = {
    F, pools, rills, paths, top,
    falls: of('fall'),
    spots: of('spot').map(f => ({ x: f.x, z: f.z, r: f.r ?? 1.2, act: f.act, to: f.to, zone: f.zone, k: f.k, soak: f.soak, who: f.who, ford: f.ford })), // 129: soak, who; 143: ford (the stones, walk.js)
    perches: of('col').map(f => ({ x: f.x, z: f.z })),
    // how far to the nearest zone water (big when none near)
    wd(x, z, hot = false) { let m = 99; for (const f of water) if ((hot || !f.hot) && near(f, x, z, 6)) m = Math.min(m, wd1(f, x, z)); return m; },
    // on an island or its spit (the wd says water round it; the pond's walkable lets animals on over the bridge)
    walkIn(x, z) { for (const f of pools) if (f.isle && (idd(f, x, z) < f.isle - 0.3 || polyD(x, z, f.spit) < 0.4)) return true; return false; },
    // the hills, ramps and pillars (added to the ground); 139-3 a shelf: within r of it the hills held at their height at its
    // middle, blending back over e (a ledge cut into a slope)
    lift(x, z) {
      let h = hsum(x, z);
      for (const f of shelves) { const d = Math.hypot(x - f.x, z - f.z), e = f.ex ? f.e + f.ex * (1 - Math.cos(Math.atan2(z - f.z, x - f.x) - f.up)) / 2 : f.e; if (d < f.r + e) h += ((f.y ??= hsum(f.x, f.z)) - h) * sm((f.r + e - d) / e); }
      return h;
    },
    // how much the rolling hills are smoothed out (0..1)
    flat(x, z) {
      let k = 0;
      for (const f of flats) k = Math.max(k, sm(edgeOf(f.r, x, z) / 1.5));
      for (const f of ramps) if (Math.abs(x - f.x) < f.rx + 2 && z > f.z0 - 4 && z < f.z1 + 1) k = Math.max(k, 0.8);
      return k;
    },
    // the water's hollows (subtracted from the ground)
    dip(x, z) {
      let m = 0;
      for (const f of water) {
        if (!near(f, x, z, 2)) continue;
        if (f.t === 'rill') { m = Math.max(m, bank(polyD(x, z, f.pts), f.w)); continue; }
        let d = bank(pd(f, x, z), f.r) * (f.hot ? 0.75 : 1);
        if (f.isle) d *= Math.min(sm((idd(f, x, z) - f.isle) / 1.2), sm((polyD(x, z, f.spit) - SPIT + 0.2) / 0.8));
        m = Math.max(m, d);
      }
      for (const f of chutes) m = Math.max(m, f.d * (1 - sm((segD(x, z, f.from, f.to) - 0.4) / 0.45))); // 129: a pool's rim notched where it spills
      return m;
    },
    // the zone colours on the ground: tints (steep: only on the slopes; pat: a pattern's colours over it) and the paths
    tint(col, x, z, ny, C) {
      for (const f of tints) {
        let w;
        if (f.r) { if (!inRect(f.r, x, z, -1)) continue; w = sm(edgeOf(f.r, x, z) / (f.e ?? 1.6) + 0.1 * Math.sin(x * 1.3 + z * 0.7)); }
        else if (f.pts) { const d = polyD(x, z, f.pts); if (d > f.rw + 0.3) continue; w = sm((f.rw - d) / 1.2 + 0.1 * Math.sin(x * 1.3 + z * 0.7)); }
        else { const e = 1 - (f.q ? pd(f.q, x, z) / f.rx : Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz)); if (e <= 0) continue; w = sm(e / (f.fo ?? 0.3) + 0.12 * Math.sin(x * 1.7 + z * 1.1)); } // 139-3 fo: how far in it is full (a share of r)
        if (f.steep) w *= sm((0.94 - ny) / 0.14);
        if (w <= 0) continue;
        let c = f.col ??= C(f.c);
        if (f.pat) { const p = f.pat(x, z); if (p) c = (f.pc ??= {})[p] ??= C(p).lerp(f.col, 0.5); } // inbox 67-3: a pattern only half its colour, no patchwork
        col.lerp(c, w * f.a);
      }
      for (const f of paths) { const d = polyD(x, z, f.pts) + 0.06 * Math.sin(x * 3 + z * 2); if (d < f.w + 0.3) col.lerp(f.rim ??= C('#cfa66c'), sm((f.w + 0.2 - d) / 0.2)).lerp(f.col ??= C(f.c ?? PATH), sm((f.w - 0.1 - d) / 0.25)); }
    },
  };
  return Z;
}
