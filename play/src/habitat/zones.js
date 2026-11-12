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
// inbox 34 the zone's face: its own ground over the whole strip (a side strip's from the back shelf's foot), the edge crisp
// (e: 0.6 m) so the zone reads from above at a glance
const FACE = (s, c, k = 1, o) => RECT([s.r[0], s.r[1], s.side === '+z' ? s.r[2] : -23.4 * S, s.r[3]], c, k, { e: 0.6, ...o });
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
const SHAPES = {
  meadow: {
    flowerhill: s => [FACE(s, '#93cf4c', 0.85, { pat: speck(['#ff9ec4', '#ffe066', '#ffffff', '#c9a8f0', '#ff9a6b'], 0.42, 0.42) }), // a carpet of flowers
      H(s, 0.5, 0.6, 3.6, 6.5, 2.8), H(s, 0.42, 0.22, 2.6, 3.4, 1.2), // the hill twice as high, its outline seen from the side
      SPOT(s, 0.5, 0.56, 'rest'), SPOT(s, 0.5, 0.62, 'nap'), SPOT(s, 0.42, 0.22, 'rest'), SPOT(s, 0.6, 0.75, 'rest')],
    grove: s => [FACE(s, '#4b7a30', 0.85, { pat: speck(['#6f9a3c', '#3b6326', '#5a8a34'], 0.35, 0.3) }), H(s, 0.55, 0.55, 2.8, 5, 0.5), // moss under the trees
      TINT(s, 0.55, 0.52, 3.4, 9, '#34562a', 0.5), // the old tree's shade
      SPOT(s, 0.25, 0.32, 'rest'), SPOT(s, 0.7, 0.45, 'nap'), SPOT(s, 0.3, 0.62, 'rest'), SPOT(s, 0.65, 0.86, 'rest')],
    fork: () => [{ t: 'tint', pts: FORK, rw: 3.2, c: '#b8ad98', a: 0.9, pat: GRAVEL }, { t: 'tint', x: 14 * S, z: 33.5 * S, rx: 4.2, rz: 3.4, c: '#b8ad98', a: 0.9, pat: GRAVEL }, // gravel banks
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
    hotspring: s => [POOL(s, 0.5, 0.5, 2.9, { hot: 1 }), TINT(s, 0.5, 0.5, 3.6, 3.6, SNOWROCK, 0.55),
      SPOT(s, 0.45, 0.48, 'bath', { r: 0.6 }), SPOT(s, 0.55, 0.53, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.42, 'bath', { r: 0.6 }), SPOT(s, 0.5, 0.25, 'rest'), SPOT(s, 0.5, 0.75, 'rest')],
    cave: s => [H(s, 0.6, 0.42, 3.0, 4.6, 10, { rock: 1 }), // inbox 42 C2: 3.2 -> 10 (3H), its mouth at its foot (zoneprops.js)
      TINT(s, 0.6, 0.42, 3.2, 4.8, SNOWROCK, 1, { steep: 1 }), // a round rock hill, the cave's mouth on its front (+z: toward the camera)
      SPOT(s, 0.52, 0.5, 'nap'), SPOT(s, 0.66, 0.5, 'nap'), SPOT(s, 0.25, 0.25, 'rest'), SPOT(s, 0.25, 0.7, 'rest')],
    iceplate: () => [{ t: 'flat', r: [-27, 27, 38.6, 44.2].map(v => v * S) }, RECT([-26, 26, 39.2, 43.6].map(v => v * S), ICE, 1), // under the ice sheet (zoneprops.js)
      ...SP([[-21, 40.5, 'slide', { to: [-11 * S, 42.4 * S] }], [-3, 42.4, 'slide', { to: [7 * S, 40.2 * S] }], [12, 40.4, 'slide', { to: [22 * S, 42.6 * S] }],
      [-29.5, 41, 'rest'], [29.5, 41.2, 'rest'], [0, 38, 'nap']])],
  },
};
// the island's spit: from the island out to the pool's front end (inbox 34; a round one's: to the old-edge side, u = 0), as
// wide as the planks on it
const SPIT = 0.55;
function spitOf(f, s) { if (f.len) return [[f.x, f.iz ?? f.z], [f.x, f.z + f.len / 2 + f.r + 0.4]]; const [x, z] = at(s, 0.02, 0.5); return [[f.x, f.z], [x + (x - f.x) * 0.02, z]]; }
// a pool's distance from its middle line (a capsule along z, len long; a round pool's: from its middle), its island's
const pd = (f, x, z) => Math.hypot(x - f.x, Math.max(0, Math.abs(z - f.z) - (f.len || 0) / 2));
const idd = (f, x, z) => Math.hypot(x - f.x, Math.max(0, Math.abs(z - (f.iz ?? f.z)) - (f.ilen || 0) / 2));
// a point r from pool f's middle line, t (0..1) round it from +x: [x, z, and the middle line's point it is out from]
export function poolAt(f, t, r) {
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
  const water = [...pools, ...rills];
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
    spots: of('spot').map(f => ({ x: f.x, z: f.z, r: f.r ?? 1.2, act: f.act, to: f.to, zone: f.zone, k: f.k })),
    perches: of('col').map(f => ({ x: f.x, z: f.z })),
    // how far to the nearest zone water (big when none near)
    wd(x, z, hot = false) { let m = 99; for (const f of water) if ((hot || !f.hot) && near(f, x, z, 6)) m = Math.min(m, wd1(f, x, z)); return m; },
    // on an island or its spit (the wd says water round it; the pond's walkable lets animals on over the bridge)
    walkIn(x, z) { for (const f of pools) if (f.isle && (idd(f, x, z) < f.isle - 0.3 || polyD(x, z, f.spit) < 0.4)) return true; return false; },
    // the hills, ramps and pillars (added to the ground)
    lift(x, z) {
      let h = 0;
      for (const f of hills) {
        if (f.t === 'hill') { const dx = (x - f.x) / f.rx, dz = (z - f.z) / f.rz; const q = Math.hypot(dx, dz); if (q < 1) h += f.h * sm(f.top ? (1 - q) / (1 - f.top) : 1 - q); }
        else if (f.t === 'ramp') { const ax = Math.abs(x - f.x); if (ax < f.rx + 2.2 && z > f.z0 - 4 && z < f.z1) h += f.h * sm((f.rx + 1.1 - ax) / 2.2) * (z < f.z0 ? sm(1 - (f.z0 - z) / 4) : sm((f.z1 - z) / (f.z1 - f.z0))); }
        else { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 0.6) h += f.h * sm((f.r + 0.25 - d) / 0.5); }
      }
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
      return m;
    },
    // the zone colours on the ground: tints (steep: only on the slopes; pat: a pattern's colours over it) and the paths
    tint(col, x, z, ny, C) {
      for (const f of tints) {
        let w;
        if (f.r) { if (!inRect(f.r, x, z, -1)) continue; w = sm(edgeOf(f.r, x, z) / (f.e ?? 1.6) + 0.1 * Math.sin(x * 1.3 + z * 0.7)); }
        else if (f.pts) { const d = polyD(x, z, f.pts); if (d > f.rw + 0.3) continue; w = sm((f.rw - d) / 1.2 + 0.1 * Math.sin(x * 1.3 + z * 0.7)); }
        else { const e = 1 - Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz); if (e <= 0) continue; w = sm(e / 0.3 + 0.12 * Math.sin(x * 1.7 + z * 1.1)); }
        if (f.steep) w *= sm((0.94 - ny) / 0.14);
        if (w <= 0) continue;
        let c = f.col ??= C(f.c);
        if (f.pat) { const p = f.pat(x, z); if (p) c = (f.pc ??= {})[p] ??= C(p); }
        col.lerp(c, w * f.a);
      }
      for (const f of paths) { const d = polyD(x, z, f.pts) + 0.06 * Math.sin(x * 3 + z * 2); if (d < f.w + 0.3) col.lerp(f.rim ??= C('#cfa66c'), sm((f.w + 0.2 - d) / 0.2)).lerp(f.col ??= C(f.c ?? PATH), sm((f.w - 0.1 - d) / 0.25)); }
    },
  };
  return Z;
}
