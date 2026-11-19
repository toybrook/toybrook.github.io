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
// 150 (user OK 11/18): the flower hill, the small wood and the fork are public (no flag); the others still under ?z143=1
export const PUB143 = new Set(['flowerhill', 'grove', 'fork']), z143on = id => Z143 || PUB143.has(id);
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
// 150: the small wood's rise and the ground in front of it (zoneprops.js fore: its new natives stand back from there): off(x, z) in
// world m, for rules.js clear143 (the old natives there go once)
export const grove143off = () => { const s = strip('meadow', ZONES.meadow.findIndex(z => z.id === 'grove') + 1), H = grove143(s).find(f => f.t === 'hill');
  return (x, z) => inRect(s.r, x, z) && Math.abs(x - H.x) < H.rx + 2 && z > H.z - H.rz - 3 && z < H.z + H.rz + 9; };
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
// 143 B the reeds (?z143=1, the pond's step 1): one wide channel down the strip's length (swim: the swimmers go in it, pond/layout.js
// wet; ends: its dead ends, meadow/water.js), two short pockets off it east (side: from inside its water, square to it, meadow/water.js lays their water) into the tall reed wall (zoneprops.js reeds143z: reeds 2.4-3.4 m, cattails) where a turtle,
// an otter or a capybara swims in and hides a while (reedswim, to: the pocket's end: walk.js); a zigzag boardwalk over it, a dock
// with a little boat at the front, a duck's nest on a low mound on the west bank (nest: swim.js, the duck or swan hops up and sits),
// heaps of half sunk stones. World metres (the strip x 27..39)
function reeds143(s) {
  const sp = (act, x, z, o) => ({ t: 'spot', x, z, act, ...o }), put = (t, x, z, o) => ({ t, x, z, ...o }), SWIMMERS = ['turtle', 'otter', 'capybara'];
  return [FACE(s, '#7b6a44', 0.8, { pat: speck(['#6a5a38', '#8d7d52', '#5f7f3a'], 0.35, 0.3) }),
    { t: 'rill', pts: [[33.6, -28.5], [32.4, -22], [34.0, -14], [32.6, -6], [32.0, 2], [33.4, 10], [34.2, 18], [33.2, 26], [32.6, 34], [33.0, 39]], w: 1.7, swim: 1, ends: 1 },
    { t: 'rill', pts: [[34.04, -8.428], [35.124, -8.238], [36.2, -8.7]], w: 1.3, swim: 1, side: 1 }, { t: 'rill', pts: [[34.892, 20.524], [35.885, 20.648], [36.55, 21.3]], w: 1.3, swim: 1, side: 1 },
    { t: 'hill', x: 29.6, z: 8.6, rx: 2.4, rz: 3.4, h: 0.6, top: 0.4 }, { t: 'hill', x: 36.7, z: 4.5, rx: 1.5, rz: 7, h: 0.5 }, // the nest's mound; a low rise under the reed wall
    sp('reedswim', 33.3, -8.3, { r: 0.4, to: [35.95, -8.5], who: SWIMMERS }), sp('reedswim', 33.8, 21.6, { r: 0.4, to: [36.3, 21.0], who: SWIMMERS }),
    sp('nest', 29.6, 8.6, { r: 0.3, who: ['duck', 'swan'] }), sp('rest', 30.0, -14), sp('rest', 30.2, 28),
    { t: 'walk143', pts: [[28.4, 13.0], [31.4, 15.4], [34.4, 13.2], [36.4, 15.0]] }, put('dock143', 30.2, 33.0), put('boat143', 32.7, 35.6),
    put('nest143', 29.6, 8.6), put('heap143', 30.0, -21.5, { sc: 1.2 }), put('heap143', 29.0, -5.5, { sc: 0.9 }), put('heap143', 29.2, 24.4, { sc: 0.85 })];
}
// 143 B: where the reeds zone is (the strip): rules.js clear143reeds (the old natives in it go once)
export const reeds143off = () => { const r = strip('pond', ZONES.pond.findIndex(z => z.id === 'reeds') + 1).r; return (x, z) => inRect(r, x, z); };
// 143 B the sandbar (?z143=1, the pond's step 3): a broad low dune across the strip's middle, one big bleached driftwood log lying
// on its west shoulder, a small tide pool to the east in a wet ring; on the dune a parasol leaf (the landmark the camera aims at),
// by the pool a sandcastle, three little heaps of shells (zoneprops.js). Animals lie on their bellies in the sun (sun, facing to)
// and dig in the sand with their front paws, a few grains flying (sanddig, facing to: walk.js). In world m (the strip is z 43.5-55.5)
export function sandbar143(s) {
  const sp = (act, [x, z], o) => ({ t: 'spot', x, z, act, ...o }), put = (t, [x, z], o) => ({ t, x, z, ...o });
  const sun = ['turtle', 'otter', 'capybara'], dig = ['otter', 'capybara', 'turtle'];
  return [FACE(s, SAND, 1, { pat: speck(['#f3e4b8', '#d9c088'], 0.4) }),
    { t: 'hill', x: -3, z: 49.2, rx: 11, rz: 4.2, h: 1.1, top: 0.4 }, { t: 'tint', x: -3, z: 49.0, rx: 7.5, rz: 2.6, c: '#f2e2b4', a: 0.7, fo: 0.5 }, // the dune, its dry crest paler
    { t: 'tint', x: 13, z: 49.4, rx: 3.9, rz: 3.6, c: '#c4a46c', a: 0.85, fo: 0.45 }, { t: 'pool', x: 13, z: 49.4, r: 2.1 }, // the tide pool in its wet ring
    sp('sun', [-1.4, 49.9], { r: 0.3, to: [0.3, 54], who: sun }), sp('sun', [3.8, 50.3], { r: 0.3, to: [5.5, 54], who: sun }),
    sp('sanddig', [6.2, 51.4], { r: 0.3, to: [8.6, 52.0], who: dig }), sp('sanddig', [-14.6, 49.0], { r: 0.3, to: [-12.5, 50.6], who: dig }),
    sp('rest', [-24, 50.5]), sp('rest', [20.5, 48.5]),
    put('drift143', [-12.5, 50.6], { to: [-5, 49.4] }), put('parasol143', [1, 48.4], { aim: 1.4 }), put('castle143', [8.6, 52.0], { sc: 1.2 }),
    put('shells143', [-8.6, 52.4]), put('shells143', [16.2, 51.6]), put('shells143', [3.2, 52.9]), put('sign143', [-17, 46.5])];
}
// the sandbar's middle: no strewn natives there (zoneprops.js); the old ones there go once (rules.js clear143, the pond's)
export const sand143fore = (x, z) => x > -18 && x < 17 && z > 43.5 && z < 55.5; // only the sandbar strip (the swamp at step 6 lies behind it)
// 143 B the lotus marsh (?z143=1, the pond's step 4): the long pond made wider, three giant pads in it big enough to sit on (gpad143:
// the landmark; zoneprops.js lotus floats them and dips one under its weight), lotus flowers standing on stems, small pads, reeds at
// its ends, a little arched plank bridge across its middle. A turtle swims to a giant pad's rim, climbs on and lies there a while,
// eyes shut, the pad sunk a little (pad, to: the pad: walk.js). The pond is swum in (swim143: pond/layout.js swimD, the pool's own
// middle line). World m (the strip x 39..51)
export function lotus143(s) {
  const sp = (act, x, z, o) => ({ t: 'spot', x, z, act, ...o }), put = (t, x, z, o) => ({ t, x, z, ...o }), P = { t: 'pool', x: 45, z: 4, r: 3.6, len: 28 };
  const G = [put('gpad143', 44.1, -5.2, { r: 1.35 }), put('gpad143', 46.0, 7.6, { r: 1.55, aim: 1.3 }), put('gpad143', 44.3, 14.6, { r: 1.25 })];
  return [FACE(s, '#6f8c4c', 0.8, { pat: speck(['#5d7a3c', '#86a35a'], 0.3, 0.4) }), { t: 'flat', r: [s.r[0], s.r[1], P.z - 17, P.z + 17] }, P,
    { t: 'swim143', pts: [[P.x, P.z - P.len / 2], [P.x, P.z + P.len / 2]], w: P.r, swim: 1 }, ...G, // the swimmers' water (as a channel's)
    ...G.map((g, i) => { const a = [0.5, 2.6, -0.6][i], d = g.r + 0.45; return sp('pad', g.x + Math.cos(a) * d, g.z + Math.sin(a) * d, { r: 0.2, to: g, who: ['turtle'] }); }), // at its rim, in the water
    sp('rest', 40.2, -9), sp('rest', 49.8, 2), sp('nap', 40.3, 12), sp('rest', 49.6, 20),
    put('bridge143', 45, 1.2), put('heap143', 49.6, -11.5, { sc: 0.8 }), put('heap143', 40.3, 22.5, { sc: 0.7 }), put('sign143', 40.4, 25.5)];
}
// 143 B: the old natives in the marsh's (wider) water or at its rim go once (rules.js clear143, the pond's; the bridge's ends stand at the rim)
export const lotus143off = () => { const s = strip('pond', ZONES.pond.findIndex(z => z.id === 'lotus') + 1), P = lotus143(s).find(f => f.t === 'pool');
  return (x, z, r) => inRect(s.r, x, z) && pd(P, x, z) - P.r < 0.6 + r; };
// 143 B the falls (?z143=1, the pond's step 2): the rock cliff as it was with a lower shoulder west of it (a wall, not a cone), the
// fall wider into a wider pool, moss on the cliff's top; off its east face a mossy lip juts out over the ground (zoneprops.js lip143)
// and a thin stream runs off it, the one an otter or a capybara stands under, the water on its back (shower, facing to: walk.js),
// then walks into the spray by the pool and shakes like a wet dog (spray: walk.js), drops flying. Big rocks in heaps, a rainbow
// over the pool by clear day (zoneprops.js bow143, the camera aims at it). World m (the strip x -39..-27)
const FUR = ['otter', 'capybara']; // the wet-dog shake is a furry one's (the turtle has the reeds and the sandbar)
export function falls143(s) {
  const sp = (act, [x, z], o) => ({ t: 'spot', x, z, act, ...o }), put = (t, [x, z], o) => ({ t, x, z, ...o }), out = [-30.1, -4.3];
  return [FACE(s, '#557f36', 0.85, { pat: speck(['#8e8a80', '#77736b', '#6b9640'], 0.35, 0.35) }), // moss and stones
    { t: 'hill', x: -33, z: -12.18, rx: 5.7, rz: 6.3, h: 11, rock: 1, top: 0.3 }, { t: 'hill', x: -36.4, z: -15.2, rx: 2.7, rz: 4.2, h: 7, rock: 1, top: 0.2 }, // the cliff, its shoulder
    { t: 'tint', x: -33, z: -12.18, rx: 6.0, rz: 6.6, c: ROCK, a: 1, steep: 1 }, { t: 'tint', x: -36.4, z: -15.2, rx: 3.0, rz: 4.5, c: ROCK, a: 1, steep: 1 },
    { t: 'tint', x: -33, z: -12.6, rx: 2.6, rz: 2.6, c: '#5f8a3a', a: 0.9, fo: 0.5 }, { t: 'tint', x: -29.6, z: -6.7, rx: 1.3, rz: 1.1, c: '#4f6a44', a: 0.7, fo: 0.5 }, // moss on the top; the wet ground under the stream
    { t: 'pool', x: -33, z: -1.6, r: 3.0 }, { t: 'fall', from: [-33, -12.18], to: [-33, -1.6], w: 1.8 },
    sp('shower', [-29.6, -6.75], { r: 0.15, to: out, who: FUR }), sp('spray', out, { r: 0.3, to: [-33, -2.6], who: FUR }),
    sp('rest', [-28.8, 2.5]), sp('rest', [-36.6, 10.44]), sp('nap', [-33, 21.75]), sp('rest', [-29.4, -24.36]),
    put('lip143', [-30.6, -8.1], { to: [-29.6, -6.75] }), put('bow143', [-32.2, -2.4], { aim: 1.3 }),
    put('heap143', [-28.6, -11.5], { sc: 1.2 }), put('heap143', [-37.2, -4.6], { sc: 1.0 }), put('heap143', [-35.6, 2.4], { sc: 0.8 })];
}
// the falls' cliff, pool and stream: no strewn natives there (zoneprops.js); the old ones there go once (rules.js clear143, the pond's)
export const falls143fore = (x, z) => x > -39 && x < -27 && z > -20 && z < 2;
// q1 the orchard (?z143=1): the rows as they were; four of the trees (otree143: zoneprops.js lets one come up to the trunk) each
// with a spot at its trunk, on the view's side, where one butts the trunk three times, the crown shakes and a fruit drops beside
// it, and the nearest one (most often itself) eats it (treeshake, to: the tree: walk.js); wooden crates of apples in the lanes.
// World m (the strip x 39..51; the rows at x 41.4, 45, 48.6, a tree every 7.2 from z -28.5)
function orchard143(s) {
  const sp = (act, x, z, o) => ({ t: 'spot', x, z, act, ...o }), put = (t, x, z, o) => ({ t, x, z, ...o });
  const T = [[41.4, 0.3], [41.4, 14.7], [45, -6.9], [45, 21.9]].map(([x, z]) => put('otree143', x, z)); // not the ladder's (45, 7.5)
  return [FACE(s, '#79b444', 0.9, { pat: mown(s.r[0], ORCHARD_ROWS) }), ...SP([[30, -2.2, 'rest'], [28.7, 7.4, 'nap'], [31.3, 21.8, 'rest']]), ...T,
    ...T.map(f => sp('treeshake', f.x - 1.45, f.z + 0.25, { r: 0.15, to: f })), // toward the old ground: seen side on from the view
    put('crates143', 43.2, 4.3, { n: 3 }), put('crates143', 43.2, 19.0, { n: 2 }), put('crates143', 46.8, -11.4, { n: 1 })];
}
// q1 the lookout (?z143=1): the hill as it was, its flat top a little wider (0.38 -> 0.46: room north of the gazebo); three spots
// on the top's west edge where one lies down, eyes open, chin up, looking out west (the sunset's way, the board's edge) a while,
// and by dusk calls two or three more to lie beside it (gaze, to: far west: walk.js); stone steps up the path's slope, a flag on
// the top, a lantern where the path comes up (zoneprops.js). World m (the strip x -51..-39; the hill at (-45, -3.9))
function lookout143(s) {
  return [FACE(s, '#b9c45a', 0.55), H(s, 0.5, 0.4, 4.4, 9.5, 6.5, { top: 0.46 }),
    { t: 'path', pts: P([[-29, 13], [-30.6, 9.5], [-29.3, 6], [-30.4, 3], [-30, 0.5]]), w: 0.7, c: '#c99a62' },
    ...SP([[-30.3, 0.8, 'rest'], [-29.7, -6, 'nap'], [-29.5, 4, 'rest'], [-29.5, 15, 'rest']]),
    ...[[-47.3, -2.0], [-47.0, 0.0], [-46.6, 2.0]].map(([x, z]) => ({ t: 'spot', x, z, act: 'gaze', r: 0.15, to: [-80, z] })),
    { t: 'flag143', x: -43.4, z: -2.6 }, { t: 'lantern143', x: -43.9, z: 1.4 }];
}
// q1 the mushroom path (?z143=1): the floor, path and spots as they were; the giant toadstools shelter the animals in the rain
// (zoneprops.js: their cover), one of them a little house (a door, a lit window); two big glowing toadstools in front of the
// path that the animals lie round at night (spots shade, to: the lamp, night: walk.js picks them only by night), stumps,
// toadstool rings and leaf piles. World m (the strip x -51..51, z 55.5..67.5; the path z 60..63)
function mushroom143(s) {
  const glow = (x, z) => [{ t: 'glow143', x, z }, ...[[1.6, 0.2], [-1.6, 0.2], [0, 1.6], [1.1, 1.2], [-1.1, 1.2]].map(([a, b]) => ({ t: 'spot', x: x + a, z: z + b, act: 'shade', r: 0.25, to: [x, z], night: 1 }))];
  return [FACE(s, '#5a6a35', 0.85, { pat: speck(['#d0782f', '#a9532a', '#e0b040', '#8a5a2b'], 0.32, 0.3) }),
    { t: 'path', pts: P([[-15.5, 41.6], [-8, 40.1], [0, 42], [8, 40.6], [16, 42.1], [24, 40.5], [31.5, 41.6]]), w: 0.9 },
    ...SP([[-11, 42.6, 'rest'], [-3, 39.4, 'nap'], [12, 43.2, 'rest'], [20, 38.8, 'nap'], [28, 43.2, 'rest']]),
    ...glow(-12, 63.3), ...glow(11, 63.3), { t: 'house143', x: 2 }, // the walkable ground ends at z ~65.3 (the bank)
    ...[[-21, 64.6, 1], [27, 64.6, 0.9], [-38, 64.4, 1.1]].map(([x, z, sc]) => ({ t: 'stump143', x, z, sc })),
    ...[[-7.6, 64.8], [15.6, 64.8], [-34, 64.8], [33, 64.9], [-1.5, 64.9]].map(([x, z]) => ({ t: 'shrooms143', x, z })),
    ...[[-24, 64.7, 1], [4.5, 64.8, 1], [21.5, 64.6, 0.9], [-44, 64.6, 1], [39, 64.6, 1]].map(([x, z, sc]) => ({ t: 'leaves143', x, z, sc }))];
}
// q1 the conifer wood (?z143=1): the groves and spots as they were; three firs at the wood's front edge (spine143: zoneprops.js
// lets one come up to the trunk) each with a spot on the view's side where one butts the trunk, the fir shivers, snow drops off
// its boughs onto it, and it shakes the snow off (treeshake, to: the fir, snow: walk.js); a trail of little pawprints in from the
// old ground to the middle fir, log piles and snowy stumps. World m (the strip x 27..39)
function conifer143(s) {
  const T = [[31, -9.5], [32, 1], [32.5, 17.5]].map(([x, z]) => ({ t: 'spine143', x, z, snow: 1 }));
  const prints = [], pts = [[24.6, 6.4], [26.4, 4.4], [28.2, 3.4], [30.3, 1.4]]; // a fox's: one line of small round prints, a little left, a little right
  for (let j = 0; j < pts.length - 1; j++) { const [x0, z0] = pts[j], [x1, z1] = pts[j + 1], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
    for (let d = 0; d < L; d += 0.42) { const w = (prints.length % 2 ? 0.09 : -0.09), t = d / L; prints.push({ t: 'print143', x: x0 + (x1 - x0) * t + nx * w, z: z0 + (z1 - z0) * t + nz * w, ry: Math.atan2(x1 - x0, z1 - z0) }); } } // little dents (zoneprops.js: the ground's tint is too coarse for them)
  return [SPOT(s, 0.3, 0.42, 'rest'), SPOT(s, 0.7, 0.62, 'nap'), SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.6, 0.2, 'rest'), ...T,
    ...T.map(f => ({ t: 'spot', x: f.x - 1.45, z: f.z + 0.25, act: 'treeshake', r: 0.15, to: f })), ...prints,
    { t: 'logs143', x: 29.8, z: -19.3, ry: 0.25 }, { t: 'logs143', x: 31.6, z: 33.4, ry: -0.3 },
    ...[[33.6, -26.2, 1], [33.4, 32.0, 0.85], [29.6, -1.2, 0.9]].map(([x, z, sc]) => ({ t: 'stump143', x, z, sc }))];
}
// q1 the sled hill (?z143=1): a real hill, higher (3.6 -> 5.5), its sides and back wider (e, b: the flanks no wall), a little
// shorter (its foot still in the strip's view); the tracks down it; up its +x side (the view's) a lane of plank steps (steps143:
// zoneprops.js) one walks back up. A slide spot's to carries up (the steps' foot and top): walk.js, slid down, walks to the steps,
// climbs them and slides again (two more at most). A flag on the top, a snowman by the run-out (zoneprops.js). World m (x -39..-27)
function sled143(s) {
  const [x, z0] = at(s, 0.5, 0.32), z1 = at(s, 0.5, 0.56)[1], lx = x + 1.7, up = [lx, z1 + 0.2, lx, z0 + 0.9];
  const to = (tx, tz) => Object.assign([tx, tz], { up }); // the run-out (an array, as before: walk.js slide)
  return [{ t: 'ramp', x, z0, z1, rx: 3.4, h: 5.5, e: 2.2, b: 7 }, ...[-0.55, 0.55].map(d => ({ t: 'tint', x: x + d - 0.5, z: (z0 + z1) / 2 + 1.5, rx: 0.16, rz: (z1 - z0) / 2 + 1.5, c: '#c4d4e6', a: 0.7 })),
    { t: 'tint', x: lx, z: (z0 + z1) / 2, rx: 0.5, rz: (z1 - z0) / 2, c: '#d3dde9', a: 0.6 }, { t: 'steps143', x: lx, z0: z0 + 0.6, z1: z1 + 0.4 }, // the trodden lane, its steps
    { t: 'spot', x: x - 0.5, z: z0 + 1.0, act: 'slide', to: to(x - 0.5, z1 + 2) }, { t: 'spot', x: x - 1.3, z: z0 + 2.0, act: 'slide', to: to(x - 1.1, z1 + 2.6) },
    { t: 'flag143', x: x - 2.0, z: z0 + 0.3 }, { t: 'snowman143', x: x + 2.4, z: z1 + 4.2 },
    { t: 'spot', x: x + 1, z: z1 + 6, act: 'rest' }, { t: 'spot', x: x - 1.5, z: z1 + 7, act: 'nap' }, SPOT(s, 0.5, 0.86, 'rest')];
}
// q1 the ice plate (?z143=1): the ice and its slides as they were; an ice-fishing hole in front of a little wooden hut at the ice's
// far edge (its door and window to the view), a smaller hole off west; by them spots to lie watching the hole, then a look down into
// it as a fish leaps out and back, then a happy hop (fish, to: the hole: walk.js, zoneprops.js); a sled by the hut, its tracks over the ice
const iceplate143 = () => { const A = { t: 'hole143', x: 14.2, z: 62.6, r: 0.42 }, B = { t: 'hole143', x: -10.5, z: 61.6, r: 0.34 };
  return [{ t: 'flat', r: [-27, 27, 38.6, 44.2].map(v => v * S) }, RECT([-26, 26, 39.2, 43.6].map(v => v * S), ICE, 1),
    ...SP([[-21, 40.5, 'slide', { to: [-11 * S, 42.4 * S] }], [-3, 42.4, 'slide', { to: [7 * S, 40.2 * S] }], [12, 40.4, 'slide', { to: [22 * S, 42.6 * S] }],
      [-29.5, 41, 'rest'], [29.5, 41.2, 'rest'], [0, 38, 'nap']]),
    A, B, { t: 'hut143', x: 14.6, z: 59.7 },
    { t: 'spot', x: 12.95, z: 62.85, act: 'fish', r: 0.15, to: A }, { t: 'spot', x: 15.45, z: 62.95, act: 'fish', r: 0.15, to: A }, { t: 'spot', x: -11.6, z: 62.2, act: 'fish', r: 0.15, to: B }];
};
// q1 the ice pillar field (?z143=1): the mounds, pillars and spots as they were; two broad ice slabs, their faces smooth as glass
// (zoneprops.js: a frosted lip, icicles under it), a spot before each: one sniffs at its face (its breath fogs it), starts back at
// the face in the ice, then lies a while gazing at it (peek, to: the slab: walk.js); drifts and ice crystals at the pillars' feet
const pillars143 = () => { const M = (x, z, ry) => ({ t: 'mirror143', x, z, ry, nx: Math.sin(ry), nz: Math.cos(ry) }), A = M(0, 49.6, -0.35), B = M(18, 49.3, 0.4);
  return [A, B, ...[A, B].map(m => ({ t: 'spot', x: m.x + m.nx * 1.4, z: m.z + m.nz * 1.4, act: 'peek', r: 0.15, to: m }))];
};
// q1 the ice cave (?z143=1): the rock hill as it was; at its foot a real cave you see into (zoneprops.js: a rock hood out of the
// hill, snow on it, icicles, blue ice crystals glowing at its back), its floor cut flat (the shelf, its blend under the hood);
// inside, spots to curl up and sleep, nose to the mouth (den: walk.js), by night too; the naps out in front. World m (the hill
// at (-46.2, -1.9), its foot at z ~5; the mouth at mz)
function cave143(s) {
  const h = H(s, 0.6, 0.42, 3.0, 4.6, 10, { rock: 1 }), mz = h.z + h.rz + 2.8, den =(x, z, n) => ({ t: 'spot', x, z, act: 'den', r: 0.15, to: [x, z + 8], night: n });
  return [h, TINT(s, 0.6, 0.42, 3.2, 4.8, SNOWROCK, 1, { steep: 1 }), { t: 'shelf', x: h.x, z: mz - 1.8, r: 2.0, e: 0.9, y: 0 }, { t: 'cave143', x: h.x, z: mz },
    ...[[-0.9, -1.1], [0.95, -1.3]].flatMap(([a, b]) => [den(h.x + a, mz + b), den(h.x + a, mz + b, 1)]),
    { t: 'spot', x: h.x + 1.8, z: mz + 2.4, act: 'nap' }, { t: 'spot', x: h.x - 2.0, z: mz + 2.8, act: 'nap' }, SPOT(s, 0.25, 0.25, 'rest'), SPOT(s, 0.25, 0.7, 'rest')];
}
// q1 the fern wood (?z143=1): the low rise as it was, a giant tree fern on it and its deep shade (zoneprops.js); under its fronds on
// the near side two beds of fallen fronds: one lies down on one and is heaped over with leaves, its head out (leafnap: walk.js,
// the heap zoneprops.js), by night too; a fallen mossy log, a nest of eggs a dino lies by, nose to it (den). World m (the rise at (33, 0))
function fernwood143(s) {
  const bed = (x, z, fz) => ({ t: 'bed143', x, z, fx: x - 0.6, fz, bed: 1 }), A = bed(30.4, -4, -9), B = bed(30.4, 4, 9), N = { t: 'nest143', x: 31, z: 12.4 };
  return [FACE(s, '#4e8a36', 0.85, { pat: speck(['#3f7a2c', '#5f9a3c', '#6aa640'], 0.35, 0.35) }), H(s, 0.5, 0.5, 2.8, 5, 0.6), TINT(s, 0.55, 0.5, 3.2, 3.2, '#2f5a22', 0.5),
    { t: 'bigfern143', x: 33.6, z: 0 }, A, B, { t: 'log143', x: 30.6, z: -23, ry: 0.45 }, N,
    ...[A, B].flatMap(b => [{ t: 'spot', x: b.x, z: b.z, act: 'leafnap', r: 0.15, to: b }, { t: 'spot', x: b.x, z: b.z, act: 'leafnap', r: 0.15, to: b, night: 1 }]),
    { t: 'spot', x: N.x, z: N.z - 2.6, act: 'den', r: 0.15, to: [N.x, N.z] },
    SPOT(s, 0.3, 0.3, 'rest'), SPOT(s, 0.35, 0.7, 'rest'), SPOT(s, 0.6, 0.9, 'rest')];
}
// q1 B the cliffs (?z143=1): the rock as it was with a shoulder either side of it (a ridge, a wall, not a lone cone), vines down
// its faces to the view, a pterosaur's twig nest of eggs on its top; the three rock stacks as they were, a twig nest on each (the
// pterosaur's perches: it sits in one); before the rock a low flat warm ledge where one lies flat in the sun (sun: walk.js);
// fallen stones in heaps at the foot (zoneprops.js). clr: no strewn trees, bushes or rocks that near. World m (the strip x -39..-27)
function cliffs143(s) {
  const h = H(s, 0.55, 0.38, 3.4, 4.4, 9, { rock: 1, top: 0.3 }), L = { t: 'hill', x: -29.6, z: -1.6, rx: 2.3, rz: 3.7, h: 0.75, rock: 1, top: 0.55, clr: 3.4 }, sun = (x, z) => ({ t: 'spot', x, z, act: 'sun', r: 0.2, to: [x + 6, z + 2], who: SOAKERS143 }); // not the pterosaur
  const sh = [{ t: 'hill', x: -35.1, z: -19.6, rx: 3.6, rz: 5.0, h: 6.2, rock: 1, top: 0.2 }, { t: 'hill', x: -35.6, z: -1.8, rx: 3.4, rz: 4.4, h: 4.6, rock: 1, top: 0.2 }];
  return [FACE(s, '#7e8a58', 0.6), h, ...sh, ...[h, ...sh].map(f => ({ t: 'tint', x: f.x, z: f.z, rx: f.rx + 0.3, rz: f.rz + 0.3, c: ROCK, a: 1, steep: 1 })),
    { t: 'tint', x: h.x, z: h.z, rx: 1.9, rz: 2.4, c: '#6f8a44', a: 0.85, fo: 0.5 }, // moss on the top, round the nest
    L, { t: 'tint', x: L.x, z: L.z, rx: L.rx + 0.15, rz: L.rz + 0.15, c: '#ada395', a: 1, fo: 0.15 }, sun(-29.4, -3.8), sun(-29.8, 0.6), { t: 'heap143', x: -32.5, z: -1.4, sc: 0.75 },
    ...[[0.3, 0.66], [0.7, 0.8], [0.35, 0.93]].flatMap(([u, v]) => { const [x, z] = at(s, u, v); return [{ t: 'col', x, z, r: 1.1, h: 1.4 }, { t: 'tint', x, z, rx: 2.2, rz: 2.2, c: ROCK, a: 0.8 }]; }),
    SPOT(s, 0.55, 0.6, 'rest'), SPOT(s, 0.55, 0.87, 'nap'), SPOT(s, 0.25, 0.18, 'rest'),
    { t: 'heap143', x: -29.0, z: -13.2, sc: 1.0, clr: 2.2 }, { t: 'heap143', x: -30.6, z: -24.6, sc: 0.85, clr: 2 }, { t: 'heap143', x: -31.6, z: 3.6, sc: 0.7, clr: 1.8 },
    { t: 'sign143', x: -28.3, z: 4.4 }];
}
// q1 B the riverbed (?z143=1): the stream as it was, a little wider (w 1.4 -> 1.8) in a broader gravel bed; four stepping stones
// over it where one hops across (ford: walk.js, zoneprops.js writes their tops), two quiet places where one lies on the far bank
// with its eyes on the water till a fish leaps (fish, to: the leap143: walk.js, zoneprops.js), a drink at the water's edge, a
// mossy log fallen across it, stone heaps, a sign. World m (the strip z 43.5..55.5; the stream's line at z 47.4..51.6)
function riverbed143() {
  const pts = P([[-24, 33.4], [-16, 31.6], [-8, 34.2], [0, 32.2], [8, 34.4], [16, 32.4], [24, 33.8]]), a = [6.69, 47.44], b = [5.31, 52.46];
  const ford = [[6.40, 48.50], [6.13, 49.47], [5.87, 50.43], [5.60, 51.40]], A = { t: 'leap143', x: -14, z: 50.65, r: 1.6 }, B = { t: 'leap143', x: 28, z: 49.3, r: 1.6 }; // ford: across its line (a normal to it); r: the nose stops at the water's edge (walk.js)
  return [{ t: 'tint', pts, rw: 3.6, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'rill', pts, w: 1.8 },
    ...SP([[-20, 30.8, 'rest'], [-4, 30.6, 'nap'], [12, 35.8, 'rest'], [20, 30.8, 'rest'], [4, 36.1, 'rest']]),
    { t: 'spot', x: a[0], z: a[1], act: 'ford', r: 0.3, to: b, ford, clr: 1.6 }, { t: 'spot', x: b[0], z: b[1], act: 'ford', r: 0.3, to: a, ford: [...ford].reverse(), clr: 1.6 },
    A, B, { t: 'spot', x: -14.87, z: 53.3, act: 'fish', r: 0.15, to: A, clr: 2 }, { t: 'spot', x: 27.5, z: 52.06, act: 'fish', r: 0.15, to: B, clr: 2 }, // on the far bank, facing the view over the water
    { t: 'spot', x: -3.9, z: 46.6, act: 'drink', r: 0.2, to: [-3.4, 48.4], clr: 1.4 },
    { t: 'log143', x: -34, z: 49.65, ry: 1.79, len: 5.2, clr: 2.6 }, // fallen across the stream (its line there runs at 0.22 rad)
    { t: 'heap143', x: 13.6, z: 54.0, sc: 0.8, clr: 1.8 }, { t: 'heap143', x: -23.5, z: 52.6, sc: 0.7, clr: 1.6 }, { t: 'sign143', x: 9.0, z: 45.6 }];
}
// q1 B the big dig (?z143=1): a shallow pit (darker) where a whole skeleton lies half dug out, its skull to the view, the back
// of it still deeper in the sand; a string grid on stakes round it; a spoil heap of sand beside it; the dig's camp at its front
// (a canvas tent, its lantern lit by night, crates, a bucket, a shovel, a sieve). One digging by the bones scratches a hole
// open and a bone shows in it, then the sand slides back (dig, to: the find143: walk.js, zoneprops.js). World m (the strip x 39..51)
function bigdig143(s) {
  const A = { t: 'find143', dg: 1, fx: 45.2, fz: 12.4 }, B = { t: 'find143', dg: 1, fx: 45.1, fz: 4.2 }; // fx, fz: one digs facing the bones (and the view)
  return [FACE(s, SAND, 1, { pat: speck(['#d9c088', '#f0ddb0', '#c8a870'], 0.4, 0.4) }), { t: 'flat', r: s.r },
    { t: 'hill', x: 45, z: 8, rx: 3.6, rz: 7.6, h: -0.45, top: 0.6 }, { t: 'tint', x: 45, z: 8, rx: 3.9, rz: 7.9, c: '#c29a62', a: 0.9, fo: 0.3, bare: [3.9, 7.9] }, // the pit
    { t: 'hill', x: 50.1, z: 13.2, rx: 1.3, rz: 2.4, h: 0.6 }, { t: 'tint', x: 50.1, z: 13.2, rx: 1.5, rz: 2.6, c: '#ead6a4', a: 0.8 }, // the spoil heap
    { t: 'bones143', x: 45, z: 8, clr: 8.6 }, { t: 'grid143', r: [41.1, 48.3, -0.1, 16.1] },
    { t: 'camp143', x: 47.2, z: 25, ry: -1.1, clr: 4.5 }, A, B, // its door to the view
    { t: 'spot', x: 48.0, z: 12.4, act: 'dig', r: 0.4, to: A }, { t: 'spot', x: 47.5, z: 4.2, act: 'dig', r: 0.4, to: B }, // by the neck, by the tail (the far side: in by the grid's gap)
    SPOT(s, 0.3, 0.88, 'rest'), SPOT(s, 0.72, 0.12, 'nap'), SPOT(s, 0.3, 0.62, 'rest'),
    { t: 'heap143', x: 49.6, z: -6, sc: 0.8, clr: 1.8 }, { t: 'heap143', x: 41.6, z: 36, sc: 0.7, clr: 1.6 }, { t: 'sign143', x: 41.2, z: 19.5 }];
}
// q1 B the mudflat (?z143=1): the two pools as they were, their water brown mud now (mud: water.js), bubbling and steaming a
// little; a wallow between them, a shallow dip of wet dark mud (bare: no grass in it) where one rolls longer and the mud flies
// (roll, to: the wal143: walk.js, zoneprops.js leaves its print in it); three-toed tracks in the mud from pool to wallow to
// pool; cattails thick on the pools' far sides; a half-sunk log; puddles that grow in the rain. World m (the strip x -51..-39)
// 162 B: the wallow a sheet of wet glossy mud (mire143: water.js, dark in the middle, paler to its rim); round it and the pools a
// ring of dry mud cracked into plates (crack143: zoneprops.js) on darker ground, no grass (bare); the tracks on a trodden mud path
function mudflat143(s) {
  const W = { t: 'wal143', mud: 1, x: -44.9, z: 5.2, clr: 5.2 }, P = [POOL(s, 0.5, 0.28, 2.4, { murk: 1, mud: 1 }), POOL(s, 0.45, 0.72, 2.6, { murk: 1, mud: 1 })];
  const T = [[[-42.6, 25.2], [-42.4, 20.5], [-43.2, 15.5], [-43.0, 10.4]], [[-43.2, 0.2], [-42.6, -4.6], [-43.1, -9.5], [-43.6, -13.2]]], dry = (x, z, rx, rz) => ({ t: 'tint', x, z, rx, rz, c: '#5a4530', a: 0.92, fo: 0.25, bare: [rx - 0.2, rz - 0.2] });
  return [FACE(s, '#6e5a3a', 0.85, { pat: speck(['#5e4a30', '#7a6440', '#56703a'], 0.4, 0.5) }), ...P,
    { t: 'hill', x: -44.9, z: 5.2, rx: 3.0, rz: 4.4, h: -0.28, top: 0.6 }, dry(-44.9, 5.2, 5.0, 6.7), { t: 'mire143', x: -44.9, z: 5.2, rx: 3.2, rz: 4.6 }, // the wallow
    ...P.map(p => dry(p.x, p.z, p.r + 1.6, p.r + 1.6)), { t: 'crack143', rings: [[-44.9, 5.2, 3.2, 4.6, 0.33], ...P.map(p => [p.x, p.z, p.r - 0.3, p.r - 0.3, 0.7])] },
    ...T.map(pts => ({ t: 'tint', pts, rw: 0.9, c: '#5e4832', a: 0.8, bare: 0.8 })),
    W, { t: 'spot', x: -45.0, z: 7.9, act: 'roll', r: 1.0, to: W }, { t: 'spot', x: -44.8, z: 2.5, act: 'roll', r: 1.0, to: W },
    ...T.map(pts => ({ t: 'track143', pts })), // pool to wallow to pool
    { t: 'mudlog143', x: -48.6, z: -4.2, ry: 1.25, clr: 2.4 }, { t: 'puddle143', pts: [[-41.6, 12.6, 0.7], [-47.6, 13.4, 0.55], [-41.4, -1.6, 0.6], [-48.3, 1.6, 0.5], [-46.8, 35.6, 0.6], [-42.2, -24.4, 0.55]] },
    SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.7, 0.14, 'nap'),
    { t: 'heap143', x: -49.6, z: 19.5, sc: 0.75, clr: 1.8 }, { t: 'heap143', x: -40.6, z: -33.5, sc: 0.7, clr: 1.6 }, { t: 'sign143', x: -40.4, z: 8.8 }];
}
// q1 B the springs (?z143=1): as the snow's hot spring A (139/140), three pools stepping down a dark volcanic rise (on ledges:
// shelf; each spills into the next: chute, fall), jade water; an ochre mineral crust round each, dark wet stone under the rim,
// bare rock down the falls; heaps of dark lava stones on the rims, basalt columns behind, a steaming vent with sulphur on it;
// one more pool on its own farther along. Thick slow steam (zoneprops.js steam129). Dinos bathe in them (bath). World m (the
// strip z 55.5..67.5, x -51..51; the home view looks in from +z: the rise behind the pools toward the river, -z)
const LAVA = speck(['#4a4542', '#625a54'], 0.5, 0.5), SOAKD143 = { triceratops: 0.28, stegosaurus: 0.3, ankylosaurus: 0.35, tRex: 0.35, brachiosaurus: 0.25 }, SOAKERS143 = Object.keys(SOAKD143); // no pterosaur
function springs143(s) {
  const cx = -8, cz = 61.5, wl = q => q.r - 0.7, pool = (x, z, r) => ({ t: 'pool', x, z, r, hot: 1, jade: 1, clr: r + 1.6 });
  const ring = (q, c, full, out, a, pat) => ({ t: 'tint', x: q.x, z: q.z, rx: q.r + out, rz: q.r + out, fo: (out - full) / (q.r + out), c, a, pat });
  const spill = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    return [{ t: 'chute', from: [a.x, a.z], to: [b.x - ux * (wl(b) - 0.3), b.z - uz * (wl(b) - 0.3)], d: 0.7 },
      { t: 'fall', from: [a.x + ux * wl(a), a.z + uz * wl(a)], to: [b.x - ux * wl(b), b.z - uz * wl(b)], w: 0.55, jade: 1 }]; };
  const Ht = { t: 'hill', x: cx - 9, z: cz - 1.5, rx: 6.5, rz: 4.2, h: 3.2, clr: 6 }, Hb = { t: 'hill', x: cx - 5, z: cz - 0.8, rx: 9, rz: 5.2, h: 1.6, clr: 7 };
  const A = pool(cx - 9.5, cz - 1.8, 1.9), B = pool(cx - 3.4, cz - 0.2, 2.4), C = pool(cx + 3.6, cz + 1.6, 3.3), D = pool(25.5, 62.4, 2.4), sp = spill(A, B).concat(spill(B, C));
  // in to the shoulders (soak: walk.js, as the snow's spring; d how much of it under the water), then out toward the open +z side
  const bath = (q, dx, dz) => ({ t: 'spot', x: q.x + dx, z: q.z + dz, act: 'bath', r: 0.4, soak: { d: SOAKD143, out: [q.x + dx, q.z + q.r + 0.6], pool: q }, who: SOAKERS143 });
  return [FACE(s, '#7a8a5a', 0.5), Ht, Hb, A, B, C, D, { t: 'shelf', x: A.x, z: A.z, r: A.r + 0.4, e: 1.6 }, { t: 'shelf', x: B.x, z: B.z, r: B.r + 0.4, e: 1.8, ex: 2.8, up: Math.atan2(A.z - B.z, A.x - B.x) }, ...sp,
    { t: 'tint', x: Ht.x, z: Ht.z, rx: Ht.rx + 0.4, rz: Ht.rz + 0.4, c: '#5e5853', a: 1, steep: 1, pat: LAVA }, { t: 'tint', x: Hb.x, z: Hb.z, rx: Hb.rx + 0.4, rz: Hb.rz + 0.4, c: '#5e5853', a: 0.9, steep: 1, pat: LAVA }, // the rise's dark rock where it is steep
    ...[A, B, C, D].flatMap(q => [ring(q, '#c79a58', 0.35, 1.2, 0.75), ring(q, '#5a534d', -0.3, 0.3, 0.85, LAVA)]), // an ochre crust, then dark wet stone under the rim
    ...sp.filter(f => f.t === 'fall').map(f => ({ t: 'tint', pts: [f.from, f.to], rw: 1.8, c: '#55504b', a: 0.9, pat: LAVA })), // bare wet rock down each fall
    bath(C, -1.3, 0.2), bath(C, 1.4, -0.3), bath(B, 0, 0), bath(A, 0, 0), bath(D, 0, 0),
    { t: 'col143', x: cx - 12.6, z: cz - 4.0, sc: 1.1, clr: 2.4 }, { t: 'col143', x: cx - 6.2, z: cz - 4.4, sc: 0.8, clr: 2 }, { t: 'col143', x: 29.2, z: 58.6, sc: 0.75, clr: 2 }, // basalt columns behind
    { t: 'vent143', x: 20.4, z: 59.4, clr: 2.4 }, // a steaming vent
    SPOT(s, 0.5, 0.1, 'rest'), SPOT(s, 0.5, 0.92, 'rest'), SPOT(s, 0.4, 0.65, 'nap'), { t: 'sign143', x: cx + 8.4, z: 65.6 }];
}
const SHAPES = {
  meadow: {
    flowerhill: s => z143on('flowerhill') ? flowerhill143(s) : [FACE(s, '#93cf4c', 0.35), // inbox 67-3 the meadow's own green: the flowers stand in it (zoneprops.js drifts), none painted
      H(s, 0.5, 0.6, 3.6, 6.5, 2.8), H(s, 0.42, 0.22, 2.6, 3.4, 1.2), // the hill twice as high, its outline seen from the side
      SPOT(s, 0.5, 0.56, 'rest'), SPOT(s, 0.5, 0.62, 'nap'), SPOT(s, 0.42, 0.22, 'rest'), SPOT(s, 0.6, 0.75, 'rest')],
    grove: s => z143on('grove') ? grove143(s) : [FACE(s, '#4b7a30', 0.85, { pat: speck(['#6f9a3c', '#3b6326', '#5a8a34'], 0.35, 0.3) }), H(s, 0.55, 0.55, 2.8, 5, 0.5), // moss under the trees
      TINT(s, 0.55, 0.52, 3.4, 9, '#34562a', 0.5), // the old tree's shade
      SPOT(s, 0.25, 0.32, 'rest'), SPOT(s, 0.7, 0.45, 'nap'), SPOT(s, 0.3, 0.62, 'rest'), SPOT(s, 0.65, 0.86, 'rest')],
    fork: s => z143on('fork') ? fork143(s) : [{ t: 'tint', pts: FORK, rw: 3.2, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'tint', x: 14 * S, z: 33.5 * S, rx: 4.2, rz: 3.4, c: '#b8ad98', a: 0.9, pat: GRAVEL }, // gravel banks
      { t: 'rill', pts: FORK, w: 1.5 }, { t: 'pool', x: 14 * S, z: 33.5 * S, r: 2.3 }, // wider; the stepping stones where the path crosses (zoneprops.js)
      ...SP([[-9, 30.8, 'rest'], [-6.5, 30.9, 'nap'], [2.5, 30.8, 'rest'], [18, 33.4, 'rest']])],
    orchard: s => Z143 ? orchard143(s) : [FACE(s, '#79b444', 0.9, { pat: mown(s.r[0], ORCHARD_ROWS) }), ...SP([[30, -2.2, 'rest'], [28.7, 7.4, 'nap'], [31.3, 21.8, 'rest']])], // in the lanes between the rows,
    lookout: s => Z143 ? lookout143(s) : [FACE(s, '#b9c45a', 0.55), H(s, 0.5, 0.4, 4.4, 9.5, 6.5, { top: 0.38 }), // a high hill, flat on top for the gazebo (inbox 42 C2: 3.4 -> 6.5, with the gazebo 3H)
      { t: 'path', pts: P([[-29, 13], [-30.6, 9.5], [-29.3, 6], [-30.4, 3], [-30, 0.5]]), w: 0.7, c: '#c99a62' }, // the dirt path up
      ...SP([[-30.3, 0.8, 'rest'], [-29.7, -6, 'nap'], [-29.5, 4, 'rest'], [-29.5, 15, 'rest']])],
    mushroom: s => Z143 ? mushroom143(s) : [FACE(s, '#5a6a35', 0.85, { pat: speck(['#d0782f', '#a9532a', '#e0b040', '#8a5a2b'], 0.32, 0.3) }), // fallen leaves on the forest floor
      { t: 'path', pts: P([[-15.5, 41.6], [-8, 40.1], [0, 42], [8, 40.6], [16, 42.1], [24, 40.5], [31.5, 41.6]]), w: 0.9 },
      ...SP([[-11, 42.6, 'rest'], [-3, 39.4, 'nap'], [12, 43.2, 'rest'], [20, 38.8, 'nap'], [28, 43.2, 'rest']])],
  },
  pond: {
    reeds: s => Z143 ? reeds143(s) : [FACE(s, '#7b6a44', 0.8, { pat: speck(['#6a5a38', '#8d7d52', '#5f7f3a'], 0.35, 0.3) }), // wet earth
      { t: 'rill', pts: P([[22.5, -22], [21.5, -14], [23.6, -6], [21.6, 2], [23.6, 10], [21.8, 18], [22.6, 25]]), w: 0.9 }, // channels between the reeds
      { t: 'rill', pts: P([[21.6, 2], [19.8, 5.5], [20.2, 9]]), w: 0.9 }, { t: 'rill', pts: P([[21.5, -14], [19.8, -17.5], [20.2, -21]]), w: 0.9 },
      ...SP([[24, -14, 'rest'], [19.4, -6, 'rest'], [24.2, 2, 'nap'], [19.4, 13, 'rest'], [24.4, 22, 'rest']])],
    falls: s => Z143 ? falls143(s) : [FACE(s, '#557f36', 0.85, { pat: speck(['#8e8a80', '#77736b', '#6b9640'], 0.35, 0.35) }), // moss and stones
      H(s, 0.5, 0.36, 3.8, 4.2, 11, { rock: 1, top: 0.3 }), TINT(s, 0.5, 0.36, 4.0, 4.4, ROCK, 1, { steep: 1 }), POOL(s, 0.5, 0.47, 2.4), // a rock cliff, its pool at its foot (inbox 42 C2: 6.2 -> 11, 3.3H)
      { t: 'fall', from: at(s, 0.5, 0.36), to: at(s, 0.5, 0.47), w: 1.3 }, SPOT(s, 0.15, 0.5, 'rest'), SPOT(s, 0.8, 0.62, 'rest'), SPOT(s, 0.5, 0.75, 'nap'), SPOT(s, 0.2, 0.22, 'rest')],
    sandbar: s => Z143 ? sandbar143(s) : [FACE(s, SAND, 1, { pat: speck(['#f3e4b8', '#d9c088'], 0.4) }), H(s, 0.5, 0.35, 2.4, 9, 0.3), POOL(s, 0.5, 0.7, 2.2),
      SPOT(s, 0.5, 0.22, 'nap'), SPOT(s, 0.45, 0.4, 'nap'), SPOT(s, 0.55, 0.52, 'rest'), SPOT(s, 0.4, 0.85, 'rest')],
    lotus: s => { if (Z143) return lotus143(s); const [x, z] = at(s, 0.5, 0.48); // one big pond, long down the strip
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
    conifer: s => Z143 ? conifer143(s) : [SPOT(s, 0.3, 0.42, 'rest'), SPOT(s, 0.7, 0.62, 'nap'), SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.6, 0.2, 'rest')],
    sled: s => Z143 ? sled143(s) : (() => { const [x, z0] = at(s, 0.5, 0.3), z1 = at(s, 0.5, 0.64)[1];
      return [{ t: 'ramp', x, z0, z1, rx: 2.6, h: 3.6 }, ...[-0.55, 0.55].map(d => ({ t: 'tint', x: x + d, z: (z0 + z1) / 2 + 1.5, rx: 0.16, rz: (z1 - z0) / 2 + 1.5, c: '#c4d4e6', a: 0.7 })), // sled tracks
        { t: 'spot', x, z: z0 + 1.2, act: 'slide', to: [x, z1 + 1.5] }, { t: 'spot', x: x + 0.8, z: z0 + 2.4, act: 'slide', to: [x - 0.6, z1 + 2] },
        { t: 'spot', x: x + 1, z: z1 + 3.5, act: 'rest' }, { t: 'spot', x: x - 1.5, z: z1 + 5, act: 'nap' }, SPOT(s, 0.5, 0.86, 'rest')]; })(),
    pillars: () => [...P([[-20, 31.6, 1.0, 0.8], [-14.5, 34.6, 0.9, 0.6], [-9, 31.2, 1.1, 0.9], [-3, 34.4, 0.9, 0.7], [3, 31.6, 1.0, 0.85], [9, 34.6, 0.95, 0.65], [14.5, 31.2, 1.05, 0.8], [20, 34.2, 0.9, 0.7]])
        .flatMap(([x, z, r, h]) => [{ t: 'col', x, z, r, h }, { t: 'tint', x, z, rx: r + 1.4, rz: r + 1.4, c: ICE, a: 0.75 }]), // each pillar on a round of ice
      ...SP([[-11.8, 33.2, 'rest'], [6, 33, 'nap'], [17.5, 32.8, 'rest']]), ...Z143 ? pillars143() : []],
    hotspring: s => S129 >= 3 ? spring139(s, S129) : S129 ? spring129(s, S129) : [POOL(s, 0.5, 0.5, 2.9, { hot: 1 }), TINT(s, 0.5, 0.5, 3.6, 3.6, SNOWROCK, 0.55),
      SPOT(s, 0.45, 0.48, 'bath', { r: 0.6 }), SPOT(s, 0.55, 0.53, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.42, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.25, 'rest'), SPOT(s, 0.5, 0.75, 'rest')],
    cave: s => Z143 ? cave143(s) : [H(s, 0.6, 0.42, 3.0, 4.6, 10, { rock: 1 }), // inbox 42 C2: 3.2 -> 10 (3H), its mouth at its foot (zoneprops.js)
      TINT(s, 0.6, 0.42, 3.2, 4.8, SNOWROCK, 1, { steep: 1 }), // a round rock hill, the cave's mouth on its front (+z: toward the camera)
      SPOT(s, 0.52, 0.5, 'nap'), SPOT(s, 0.66, 0.5, 'nap'), SPOT(s, 0.25, 0.25, 'rest'), SPOT(s, 0.25, 0.7, 'rest')],
    iceplate: () => Z143 ? iceplate143() : [{ t: 'flat', r: [-27, 27, 38.6, 44.2].map(v => v * S) }, RECT([-26, 26, 39.2, 43.6].map(v => v * S), ICE, 1), // under the ice sheet (zoneprops.js)
      ...SP([[-21, 40.5, 'slide', { to: [-11 * S, 42.4 * S] }], [-3, 42.4, 'slide', { to: [7 * S, 40.2 * S] }], [12, 40.4, 'slide', { to: [22 * S, 42.6 * S] }],
      [-29.5, 41, 'rest'], [29.5, 41.2, 'rest'], [0, 38, 'nap']])],
  },
  // 14-3 the dino jungle. dig: an animal paws at the sand a while (walk.js), now and then turning up a fossil (rules.js dig);
  // roll: wallows in the mud (as the snow pile's roll)
  dino: {
    fernwood: s => Z143 ? fernwood143(s) : [FACE(s, '#4e8a36', 0.85, { pat: speck(['#3f7a2c', '#5f9a3c', '#6aa640'], 0.35, 0.35) }), H(s, 0.5, 0.5, 2.8, 5, 0.6), // fern shade on a low rise
      SPOT(s, 0.3, 0.3, 'rest'), SPOT(s, 0.65, 0.5, 'nap'), SPOT(s, 0.35, 0.7, 'rest'), SPOT(s, 0.6, 0.9, 'rest')],
    cliffs: s => Z143 ? cliffs143(s) : [FACE(s, '#7e8a58', 0.6), H(s, 0.55, 0.38, 3.4, 4.4, 9, { rock: 1, top: 0.3 }), TINT(s, 0.55, 0.38, 3.6, 4.6, ROCK, 1, { steep: 1 }), // a rock hill (3H)
      ...[[0.3, 0.66], [0.7, 0.8], [0.35, 0.93]].flatMap(([u, v]) => { const [x, z] = at(s, u, v); return [{ t: 'col', x, z, r: 1.1, h: 1.4 }, { t: 'tint', x, z, rx: 2.2, rz: 2.2, c: ROCK, a: 0.8 }]; }), // rock stacks: the pterosaur's perches
      SPOT(s, 0.55, 0.6, 'rest'), SPOT(s, 0.55, 0.87, 'nap'), SPOT(s, 0.25, 0.18, 'rest')],
    riverbed: () => { if (Z143) return riverbed143(); const pts = P([[-24, 33.4], [-16, 31.6], [-8, 34.2], [0, 32.2], [8, 34.4], [16, 32.4], [24, 33.8]]);
      return [{ t: 'tint', pts, rw: 2.8, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'rill', pts, w: 1.4 },
        ...SP([[-20, 30.8, 'rest'], [-4, 30.6, 'nap'], [12, 35.8, 'rest'], [20, 30.8, 'rest'], [4, 36.1, 'rest']])]; },
    bigdig: s => Z143 ? bigdig143(s) : [FACE(s, SAND, 1, { pat: speck(['#d9c088', '#f0ddb0', '#c8a870'], 0.4, 0.4) }), { t: 'flat', r: s.r }, TINT(s, 0.5, 0.5, 2.6, 7, '#c8a870', 0.7), // the dug ground, darker
      SPOT(s, 0.35, 0.45, 'dig', { r: 1.6 }), SPOT(s, 0.62, 0.75, 'dig', { r: 1.6 }), SPOT(s, 0.3, 0.88, 'rest'), SPOT(s, 0.72, 0.12, 'nap')],
    mudflat: s => Z143 ? mudflat143(s) : [FACE(s, '#6e5a3a', 0.85, { pat: speck(['#5e4a30', '#7a6440', '#56703a'], 0.4, 0.5) }), POOL(s, 0.5, 0.28, 2.4, { murk: 1 }), POOL(s, 0.45, 0.72, 2.6, { murk: 1 }),
      TINT(s, 0.5, 0.5, 2.6, 4, '#5e4028', 0.8), // the wallow between the pools
      SPOT(s, 0.55, 0.5, 'roll', { r: 1.4 }), SPOT(s, 0.4, 0.48, 'roll', { r: 1.4 }), SPOT(s, 0.3, 0.9, 'rest'), SPOT(s, 0.7, 0.14, 'nap')],
    springs: s => Z143 ? springs143(s) : [FACE(s, '#7a8a5a', 0.5), ...[[0.5, 0.25, 2.4], [0.45, 0.52, 2.8], [0.55, 0.78, 2.4]].flatMap(([u, v, r]) => [POOL(s, u, v, r, { hot: 1 }), TINT(s, u, v, r / S + 0.8, r / S + 0.8, '#a39a8a', 0.6)]),
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
      else if (f.t === 'ramp') { const ax = Math.abs(x - f.x), e = f.e ?? 1.1, b = f.b ?? 4; if (ax < f.rx + 2 * e && z > f.z0 - b && z < f.z1) h += f.h * sm((f.rx + e - ax) / (2 * e)) * (z < f.z0 ? sm(1 - (f.z0 - z) / b) : sm((f.z1 - z) / (f.z1 - f.z0))); } // q1: e, b (the sides', the back's fall)
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
    spots: of('spot').map(f => ({ x: f.x, z: f.z, r: f.r ?? 1.2, act: f.act, to: f.to, zone: f.zone, k: f.k, soak: f.soak, who: f.who, ford: f.ford, night: f.night })), // 129: soak, who; 143: ford (the stones, walk.js); q1: night (only by night)
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
      for (const f of ramps) if (Math.abs(x - f.x) < f.rx + 2 * (f.e ?? 1) && z > f.z0 - (f.b ?? 4) && z < f.z1 + 1) k = Math.max(k, 0.8);
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
