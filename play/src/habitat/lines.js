import * as THREE from 'three';
import { toyMat, instanced, lathe } from './toyKit.js';
import { BRUSHES, THEMES } from '../game/data.js';

// 28-6 울타리·돌담: the paint's cells of a standing brush (BRUSHES stand) drawn as one fence or wall that joins itself: a post
// in each fence cell and two rails to each fence cell beside it; round stones stacked two high along a wall, a bigger one on each
// cell. A cell only corner to corner with another is joined across the corner when no cell beside both is one already. On the
// ground's slope (y: the ground's height). Instanced, so a few draw calls however long. Colours as the fence prop's (props.js).
const FENCE = BRUSHES.findIndex(b => b.id === 'fenceline'), WALL = BRUSHES.findIndex(b => b.id === 'wall');
// inbox 42 C2: x1.6 tall (1.34 m, 0.4 of a grown horse), a wall x1.5
const POST = new THREE.LatheGeometry([[0.12, 0], [0.12, 1.12], [0.1, 1.25], [0.06, 1.33], [0, 1.34]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
const RAIL = new THREE.CapsuleGeometry(0.065, 0.9, 3, 8).rotateZ(Math.PI / 2); // 1 long, along x
const STONE = new THREE.SphereGeometry(1, 12, 8), mat = toyMat('#ffffff', { roughness: 0.55 });
const STONES = ['#c9c1b0', '#b8b2a6', '#a8a39a', '#bdb5a5'];
const h01 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// 194-7 (?th194) 숲속 오두막: the theme's two joining pieces and its detail brush, drawn the same way (a few instanced sets however long).
// 통나무 울타리 (logfence): log posts with a pale end-grain disc and a darker heart on top, two log rails to each logfence beside it; a
// post where the line ends, turns or branches is a bigger log, the posts by a gate taller still with a red mushroom cap; moss and small
// mushrooms here and there (hashed, the same every time). 통나무 울타리 문 (loggate): no post of its own, the opening between the posts
// beside it, a leaf hung on each, standing open (animals walk through: not a spot). 디딤돌 길 (stepstone): a flat stone on each cell and
// one between it and each stepstone beside it. 낙엽 (leaves): a handful of cupped leaves strewn over the cell and a little past it, no
// shadow. The theme's colours (data.js THEMES). Shapes made once, the first time one is drawn (none without the flag); kept like POST
const LOGF = BRUSHES.findIndex(b => b.id === 'logfence'), GATE = BRUSHES.findIndex(b => b.id === 'loggate');
const STEP = BRUSHES.findIndex(b => b.id === 'stepstone'), LEAF = BRUSHES.findIndex(b => b.id === 'leaves');
const TP = THEMES[0].pal, shade = (c, l, s = 0) => '#' + new THREE.Color(c).offsetHSL(0, s, l).getHexString();
let K = null;
function kit() {
  if (K) return K;
  const leaf = new THREE.BufferGeometry(), v = [], ix = []; // a cupped leaf along +x, 1 long: 6 x 3 grid, the sides curled up
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 2; b++) { const u = a / 5, w = 0.34 * Math.pow(Math.sin(Math.PI * u), 0.75), q = b - 1; v.push(u, 0.16 * q * q + 0.1 * u * u, q * w); }
  for (let a = 0; a < 5; a++) for (let b = 0; b < 2; b++) { const o = a * 3 + b; ix.push(o, o + 1, o + 3, o + 1, o + 4, o + 3); }
  leaf.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); leaf.setIndex(ix); leaf.computeVertexNormals();
  return K = {
    post: lathe([[1.14, 0], [1.02, 0.05], [1, 1], [0, 1]], 10), // a log standing: s [r, h, r] (209 A: one ring fewer, the same side)
    cap: lathe([[0.9, -0.03], [0.9, 0.015], [0.75, 0.045], [0, 0.055]], 10), // its sawn end (s r): pale end grain
    heart: lathe([[0.44, 0.04], [0.34, 0.06], [0, 0.066]], 8), // the darker heart of it
    rail: new THREE.CylinderGeometry(1, 1, 1, 8, 1).rotateZ(Math.PI / 2), // a log lying (closed: a gate's battens show their ends), 1 long along x: s [len, r, r]
    blob: new THREE.SphereGeometry(1, 8, 5), // moss; a gate's knob
    mush: lathe([[0, 0], [0.9, 0.03], [0.96, 0.25], [0.55, 0.56], [0, 0.64]], 8), // a mushroom's cap (209 A: fewer rings and sides)
    stem: lathe([[0.5, 0], [0.42, 0.6], [0.36, 1], [0, 1]], 6),
    paling: lathe([[1, 0], [1, 0.9], [0.7, 0.97], [0, 1]], 8), // a gate's upright: s [r, h, r]
    stone: lathe([[0, 0], [1, 0.2], [0.8, 0.75], [0, 1]], 20), // a flat stone: s [rx, h, rz]
    rbox: (() => { const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position; // 195 B-8: a rounded box (a hedge), each axis |v|^0.45
      for (let n = 0; n < p.count; n++) for (let a = 0; a < 3; a++) { const v = p.getComponent(n, a); p.setComponent(n, a, Math.sign(v) * Math.abs(v) ** 0.45); }
      g.computeVertexNormals(); return g; })(),
    leaf, mat: toyMat('#ffffff', { roughness: 0.55 }), leafMat: toyMat('#ffffff', { roughness: 0.6, side: THREE.DoubleSide }),
  };
}
const STONES2 = [TP.stone, shade(TP.stone, 0.05), shade(TP.stone, -0.05), shade(TP.stone, 0.02, -0.04)];
const LEAVES = [TP.point, '#e0843a', TP.light, shade(TP.main, 0.12), '#e9a640'];
const MOSS = [TP.sub, shade(TP.sub, -0.06), shade(TP.sub, 0.05)];

// 195 B-8 1-1 (?yard, the yard only: std) 이어지는 소품 (decor-redesign.md 5-3 ②). A line cell's shape from the cells beside it it
// joins (the four sides: the same brush or a 문; the corners: as join below): two opposite is straight, anything else (an end, a
// corner, a T, a cross, alone) a knot. Heights to 2's table (H 4.08): 울타리 0.41 H (posts x1.25, a knot's post thicker with a ball on
// top, the posts by a 문 taller), 돌담 0.30 H (x1.26, a cap stone on a knot or by a 문), 생울타리 0.45 H (a rounded box on each cell and
// one along each join, leafy lumps on top). 나무다리: a deck of planks across the way it goes, rails along each side with no bridge
// beside it (none at its open ends). 문: two leaves standing open from the line's posts beside it (fence, wall or hedge: dressed as
// that line), its own post where the line stops; two 문 side by side open as one 2-cell gate. 다리·문 cells: open spots (walked
// through, props keep off). Without the flag none of this is reached (the brushes are not there; std false)
const HEDGE = BRUSHES.findIndex(b => b.id === 'hedge'), BRIDGE = BRUSHES.findIndex(b => b.id === 'bridge'), DOOR = BRUSHES.findIndex(b => b.id === 'gate');
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], D4 = D8.slice(0, 4);
const joins = (at, i, j, b) => D8.filter(([a, c]) => { const n = at(i + a, j + c); return a && c ? n === b && at(i + a, j) !== b && at(i, j + c) !== b : n === b || n === DOOR; });
const knotOf = js => !(js.length === 2 && js[0][0] === -js[1][0] && js[0][1] === -js[1][1]);
const nextTo = (at, i, j, b) => D4.some(([a, c]) => at(i + a, j + c) === b);
const HH = 1.84, HEDGES = ['#6a9e47', '#74a84f', '#62943f'], WOOD = ['#c99a63', '#bf8f58', '#d1a46d'];

export function linesLayer(scene, y, U, std = false) { // std: 195 B-8 (the yard, ?yard)
  let meshes = [];
  return {
    // paint: { 'i,j': brush }; the cells it stands in, [x, z, open, top] (195 B-8 1-2 top: a 돌담 cell's in the yard; habitat.js: a spot each, so animals go round and props keep off)
    set(paint) {
      for (const m of meshes) { scene.remove(m); m.dispose(); } meshes = [];
      const at = (i, j) => paint[`${i},${j}`], posts = [], rails = [], stones = [], cells = [];
      const T = { post: [], cap: [], heart: [], rail: [], blob: [], mush: [], stem: [], paling: [], stone: [], leaf: [], rbox: [] }; // 194-7 (rbox: 195 B-8)
      const join = (b, i, j, di, dj, f) => { if (at(i + di, j + dj) !== b) return; if (di && dj && (at(i + di, j) === b || at(i, j + dj) === b)) return; f((i + 0.5) * U, (j + 0.5) * U, (i + di + 0.5) * U, (j + dj + 0.5) * U); };
      for (const k in paint) {
        const b = paint[k]; if (b >= 0 && (b === LOGF || b === GATE || b === STEP || b === LEAF)) { theme(T, at, k, b, y, U, cells); continue; }
        if (b >= 0 && (b === HEDGE || b === BRIDGE || b === DOOR)) { yardPiece(T, at, k, b, y, U, cells); continue; } // 195 B-8
        if (b !== FENCE && b !== WALL) continue;
        const [i, j] = k.split(',').map(Number), x = (i + 0.5) * U, z = (j + 0.5) * U, g = y(x, z); cells.push([x, z]);
        const knot = std && knotOf(joins(at, i, j, b)), byD = std && nextTo(at, i, j, DOOR), K = std ? (b === FENCE ? 1.25 : 1.26) : 1; // 195 B-8
        if (b === FENCE) {
          if (!std) posts.push({ x, y: g - 0.04, z, c: '#c88a4b' });
          else { const sy = K * (byD ? 1.18 : knot ? 1.05 : 1), sr = byD ? 1.45 : knot ? 1.3 : 1; posts.push({ x, y: g - 0.04, z, s: [sr, sy, sr], c: '#c88a4b' });
            if (knot || byD) stones.push({ x, y: g - 0.04 + 1.34 * sy + 0.06, z, s: 0.1 * sr, c: '#e2b27a' }); }
          for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) join(b, i, j, di, dj, (xa, za, xb, zb) => {
            const ya = y(xa, za), yb = y(xb, zb), d = Math.hypot(xb - xa, zb - za), ry = Math.atan2(-(zb - za), xb - xa), rz = Math.atan2(yb - ya, d), len = Math.hypot(d, yb - ya);
            for (const h of [0.58 * K, 1.02 * K]) rails.push({ x: (xa + xb) / 2, y: (ya + yb) / 2 + h, z: (za + zb) / 2, ry, rz, s: [len, 1, 1], c: '#d0955a' });
          });
        } else {
          const r = h01(i, j); // a big stone on the cell, a smaller one on top of it
          stones.push({ x, y: g + 0.27 * K, z, s: [0.4, 0.33 * K, 0.4], ry: r * 3, c: STONES[Math.floor(r * 4)] }, { x, y: g + 0.75 * K, z, s: [0.3, 0.22 * K, 0.3], ry: r * 5, c: STONES[(Math.floor(r * 4) + 1) % 4] });
          if (knot || byD) stones.push({ x, y: g + 1.06 * K, z, s: [0.34, 0.15, 0.34], ry: r * 7, c: STONES[(Math.floor(r * 4) + 2) % 4] }); // 195 B-8: a cap stone
          if (std) cells[cells.length - 1].push(0, g + (knot || byD ? 1.06 * K + 0.15 : 0.97 * K)); // 195 B-8 1-2: its top (habitat.js: a small prop may stand there)
          for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) join(b, i, j, di, dj, (xa, za, xb, zb) => {
            const d = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(d / 0.54) - 1), ry = Math.atan2(-(zb - za), xb - xa);
            for (let k = 0; k <= n; k++) for (const top of [0, 1]) {
              if (!top && !k) continue; const t = (k + (top ? 0.5 : 0)) / (n + 1); // the bottom row between the big stones, the top row between the bottom's
              const sx = xa + (xb - xa) * t, sz = za + (zb - za) * t, q = h01(sx * 3.1, sz * 1.7);
              stones.push({ x: sx, y: y(sx, sz) + (top ? 0.63 : 0.22) * K, z: sz, ry, s: top ? [0.25, 0.2 * K, 0.24] : [0.3, 0.24 * K, 0.28], c: STONES[Math.floor(q * 4)] });
            }
          });
        }
      }
      for (const [g, items] of [[POST, posts], [RAIL, rails], [STONE, stones]]) if (items.length) { const m = instanced(g, mat, items); scene.add(m); meshes.push(m); }
      for (const n in T) if (T[n].length) { const k = kit(), m = instanced(k[n], n === 'leaf' ? k.leafMat : k.mat, T[n], n === 'leaf' || n === 'stone' ? { cast: false } : undefined); scene.add(m); meshes.push(m); }
      return cells;
    },
  };
}

// 194-7: one theme cell into T (instanced items by shape); a logfence cell into cells (a spot: animals go round, props keep off)
function theme(T, at, k, b, y, U, cells) {
  const [i, j] = k.split(',').map(Number), x = (i + 0.5) * U, z = (j + 0.5) * U, g = y(x, z), r = h01(i, j), r2 = h01(j * 1.3, i * 0.7);
  const fg = (di, dj) => { const n = at(i + di, j + dj); return n === LOGF || n === GATE; };
  const moss = (mx, mz, my, s) => T.blob.push({ x: mx, y: my, z: mz, s, ry: r * 6, c: MOSS[Math.floor(r2 * 3)] });
  const mushroom = (mx, mz, s) => { const my = y(mx, mz); T.stem.push({ x: mx, y: my - 0.02, z: mz, s: [0.07 * s, 0.17 * s, 0.07 * s], c: TP.wood }); T.mush.push({ x: mx, y: my + 0.14 * s, z: mz, s: [0.13 * s, 0.12 * s, 0.13 * s], c: TP.point }); };
  if (b === LOGF) {
    cells.push([x, z]);
    const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, c]) => fg(a, c)), byGate = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => at(i + a, j + c) === GATE);
    const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]].filter(([a, c]) => at(i + a, j + c) === LOGF && at(i + a, j) !== LOGF && at(i, j + c) !== LOGF);
    const straight = !diag.length && orth.length === 2 && orth[0][0] === -orth[1][0] && orth[0][1] === -orth[1][1];
    const [pr, ph] = byGate ? [0.2, 1.69] : straight ? [0.15, 1.35] : [0.19, 1.5]; // inbox 194 / decor-redesign.md 2 (1.68); 209 A: 1.35, no wall beside a duck or a sheep (all x 0.8)
    T.post.push({ x, y: g - 0.04, z, s: [pr, ph, pr], ry: r * 6, c: shade(TP.main, (r - 0.5) * 0.06) });
    if (byGate) { T.mush.push({ x, y: g + ph - 0.05, z, s: [0.3, 0.26, 0.3], c: TP.point }); moss(x, z, g + ph - 0.1, [0.24, 0.07, 0.24]); }
    else { T.cap.push({ x, y: g + ph - 0.04, z, s: pr, c: TP.wood }); T.heart.push({ x, y: g + ph - 0.04, z, s: pr, c: shade(TP.wood, -0.1, -0.1) });
      if (r < 0.35) moss(x + pr * 0.25, z - pr * 0.2, g + ph, [pr * 0.6, pr * 0.32, pr * 0.55]); }
    if (r2 < 0.4) moss(x + (r - 0.5) * 0.3, z + 0.18, g + 0.02, [0.24, 0.1, 0.18]);
    if (r2 > 0.8) { mushroom(x + 0.24, z + 0.12, 1); mushroom(x + 0.33, z - 0.05, 0.7); }
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { // rails only to a logfence (not across a gate)
      if (at(i + di, j + dj) !== LOGF || di && dj && (at(i + di, j) === LOGF || at(i, j + dj) === LOGF)) continue;
      const xb = (i + di + 0.5) * U, zb = (j + dj + 0.5) * U, yb = y(xb, zb), d = Math.hypot(xb - x, zb - z), ry = Math.atan2(-(zb - z), xb - x), rz = Math.atan2(yb - g, d), len = Math.hypot(d, yb - g);
      for (const [h, q] of [[0.5, 0.02], [0.98, -0.02]]) T.rail.push({ x: (x + xb) / 2, y: (g + yb) / 2 + h, z: (z + zb) / 2, ry, rz, s: [len, 0.085, 0.085], c: shade(TP.main, q + (h01(xb, z + h) - 0.5) * 0.05) });
    }
  } else if (b === GATE) { // the opening between the posts beside it (along x or z), a leaf hung on each side's post, both open to the same side
    cells.push([x, z, 1]); // 195 B-8: an open spot (animals through, props keep off; 194-7 review)
    const ax = fg(1, 0) || fg(-1, 0) || !(fg(0, 1) || fg(0, -1)), e = ax ? [1, 0] : [0, 1], n = ax ? [0, 1] : [1, 0], A = 1.2; // open 69 degrees
    for (const s of [-1, 1]) {
      const nb = at(i + s * e[0], j + s * e[1]); if (nb === GATE) continue;
      let hx = x + s * e[0] * U, hz = z + s * e[1] * U, L = U - 0.3;
      if (nb !== LOGF) { hx = x + s * e[0] * U * 0.5; hz = z + s * e[1] * U * 0.5; L = U * 0.5 - 0.25; const py = y(hx, hz); // a gate at the line's end: its own post
        T.post.push({ x: hx, y: py - 0.04, z: hz, s: [0.2, 1.69, 0.2], c: TP.main }); T.mush.push({ x: hx, y: py + 1.64, z: hz, s: [0.3, 0.26, 0.3], c: TP.point }); }
      hx -= s * e[0] * 0.25; hz -= s * e[1] * 0.25; // the hinge, just off the post
      const w = [-s * e[0] * Math.cos(A) + n[0] * Math.sin(A), -s * e[1] * Math.cos(A) + n[1] * Math.sin(A)], p = [-w[1], w[0]], ry = Math.atan2(-w[1], w[0]);
      const at2 = (u, v) => [hx + w[0] * u + p[0] * v, hz + w[1] * u + p[1] * v], gy = y(...at2(L / 2, 0));
      for (let q = 0; q < 4; q++) { const u = 0.1 + q * (L - 0.18) / 3, [px, pz] = at2(u, 0); // the uprights, rising to the free end
        T.paling.push({ x: px, y: y(px, pz) - 0.03, z: pz, ry, s: [0.1, 0.96 + 0.19 * Math.sin(Math.PI / 2 * u / L), 0.085], c: shade(TP.wood, (h01(i + q, j + s) - 0.5) * 0.06) }); }
      for (const h of [0.34, 0.8]) { const [bx, bz] = at2(L / 2, 0.09); T.rail.push({ x: bx, y: gy + h, z: bz, ry, s: [L + 0.04, 0.068, 0.068], c: TP.main }); }
      const [cx, cz] = at2(L / 2, 0.1); T.rail.push({ x: cx, y: gy + 0.57, z: cz, ry, rz: Math.atan2(0.46, L - 0.2), s: [Math.hypot(L - 0.2, 0.46), 0.05, 0.05], c: TP.main }); // the brace
      for (const v of [-0.12, 0.17]) { const [kx, kz] = at2(L - 0.1, v); T.blob.push({ x: kx, y: gy + 0.68, z: kz, s: 0.065, c: TP.point }); } // a knob each side
    }
  } else if (b === STEP) {
    const U2 = U * 0.13, put = (sx, sz, s, q) => T.stone.push({ x: sx, y: y(sx, sz) - 0.035, z: sz, ry: q * 6.28, s: [s * (0.92 + 0.16 * q), 0.12 + 0.03 * q, s * (0.82 + 0.1 * (1 - q))], c: STONES2[Math.floor(q * 4)] });
    const cx = x + (r - 0.5) * U2 * 2, cz = z + (r2 - 0.5) * U2 * 2; put(cx, cz, 0.5, r);
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { // a smaller stone between it and the next
      if (at(i + di, j + dj) !== STEP || di && dj && (at(i + di, j) === STEP || at(i, j + dj) === STEP)) continue;
      const q = h01(i * 2 + di, j * 2 + dj); put(x + di * U / 2 + (q - 0.5) * U2, z + dj * U / 2 + (h01(j + dj, i) - 0.5) * U2, 0.3, q);
    }
    if (r2 < 0.3) moss(cx + 0.42, cz + 0.12, g, [0.16, 0.06, 0.12]); // a tuft at a stone's edge
    if (r > 0.55) { const q = h01(i + 3, j); T.stone.push({ x: x - 0.45 + q * 0.2, y: g - 0.01, z: z + 0.5 - q * 0.3, ry: q * 6, s: [0.09, 0.05, 0.07], c: STONES2[2] }); } // a pebble
  } else { // LEAF: strewn a little past the cell so a patch has no square edge; a few lie on another (higher, tipped)
    for (let q = 0; q < 7; q++) {
      const a = h01(i * 7 + q, j * 3.1), c = h01(i * 2.7, j * 7 + q), lx = x + (a - 0.5) * U * 1.15, lz = z + (c - 0.5) * U * 1.15, t = h01(lx, lz);
      T.leaf.push({ x: lx, y: y(lx, lz) + 0.015 + q * 0.004, z: lz, ry: t * 6.28, rx: (a - 0.5) * 0.5, rz: (c - 0.5) * 0.3, s: 0.19 + 0.1 * t, c: LEAVES[Math.floor(t * 5)] });
    }
  }
}

// 195 B-8: a 생울타리, 나무다리 or 문 cell into T (see HEDGE above); its spot into cells ([x, z, 1]: open)
function yardPiece(T, at, k, b, y, U, cells) {
  const [i, j] = k.split(',').map(Number), x = (i + 0.5) * U, z = (j + 0.5) * U, g = y(x, z), r = h01(i, j);
  const hedgeBox = (bx, bz, hl, hh, ry, c) => T.rbox.push({ x: bx, y: y(bx, bz) + hh - 0.08, z: bz, ry, s: [hl, hh, 0.5], c });
  if (b === HEDGE) {
    cells.push([x, z]);
    const byD = nextTo(at, i, j, DOOR), hh = HH / 2 + (byD ? 0.08 : 0), c = HEDGES[Math.floor(r * 3)];
    hedgeBox(x, z, 0.52, hh, r * 0.2, c);
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { // a box along each join (to a hedge; not across a 문)
      if (at(i + di, j + dj) !== HEDGE || di && dj && (at(i + di, j) === HEDGE || at(i, j + dj) === HEDGE)) continue;
      const xb = (i + di + 0.5) * U, zb = (j + dj + 0.5) * U;
      hedgeBox((x + xb) / 2, (z + zb) / 2, Math.hypot(xb - x, zb - z) / 2, HH / 2 - 0.03, Math.atan2(-(zb - z), xb - x), HEDGES[Math.floor(h01(xb, zb) * 3)]);
    }
    for (let q = 0; q < (byD ? 1 : 2); q++) { const a = h01(i * 3 + q, j), lx = x + (a - 0.5) * 0.5, lz = z + (h01(j * 3, i + q) - 0.5) * 0.5; // leafy lumps on top
      T.blob.push({ x: lx, y: y(lx, lz) + 2 * hh - 0.14, z: lz, s: byD ? [0.42, 0.26, 0.42] : [0.3, 0.17, 0.28], ry: a * 6, c: shade(c, 0.04 + 0.03 * a) }); }
  } else if (b === BRIDGE) {
    cells.push([x, z, 1]);
    const has = (a, c) => at(i + a, j + c) === BRIDGE, wet = (a, c) => at(i + a, j + c) === 11, // alone: across the water it stands in (water both sides along x: the way runs along z)
      alongX = has(1, 0) || has(-1, 0) || !(has(0, 1) || has(0, -1)) && !(wet(1, 0) && wet(-1, 0)), yd = g + 0.1;
    for (const o of [-0.54, -0.18, 0.18, 0.54]) // planks across the way, on two beams along it
      T.rail.push({ x: x + (alongX ? o : 0), y: yd, z: z + (alongX ? 0 : o), ry: alongX ? Math.PI / 2 : 0, s: [U * 0.94, 0.06, 0.16], c: WOOD[Math.floor(h01(x + o, z - o) * 3)] });
    for (const o of [-0.42, 0.42]) T.rail.push({ x: x + (alongX ? 0 : o), y: yd - 0.1, z: z + (alongX ? o : 0), ry: alongX ? 0 : Math.PI / 2, s: [U, 0.07, 0.07], c: '#8a5a34' });
    for (const [a, c] of D4) { // a rail along a side with no bridge beside it, when the way runs past that side (not at an open end)
      if (has(a, c) || !(a ? !alongX || has(0, 1) || has(0, -1) : alongX)) continue;
      const ex = x + a * (U / 2 - 0.1), ez = z + c * (U / 2 - 0.1), ry = a ? Math.PI / 2 : 0;
      T.rail.push({ x: ex, y: yd + 0.62, z: ez, ry, s: [U, 0.05, 0.05], c: '#b07a48' }, { x: ex, y: yd + 0.32, z: ez, ry, s: [U, 0.035, 0.035], c: '#b07a48' });
      for (const t of [-1, 1]) { const ni = a ? 0 : t, nj = a ? t : 0; // a post at each end of it (the far end: the next bridge cell's, when its rail goes on)
        if (t === 1 && has(ni, nj) && at(i + ni + a, j + nj + c) !== BRIDGE) continue;
        const px = ex + (a ? 0 : t * (U / 2 - 0.08)), pz = ez + (a ? t * (U / 2 - 0.08) : 0);
        T.paling.push({ x: px, y: yd - 0.05, z: pz, s: [0.07, 0.74, 0.07], c: '#a06c3e' }); T.blob.push({ x: px, y: yd + 0.7, z: pz, s: 0.075, c: '#e2b27a' }); }
    }
  } else { // DOOR
    cells.push([x, z, 1]);
    const line = n => n === FENCE || n === WALL || n === HEDGE, ln = (a, c) => line(at(i + a, j + c)) || at(i + a, j + c) === DOOR;
    const ax = ln(1, 0) || ln(-1, 0) || !(ln(0, 1) || ln(0, -1)), e = ax ? [1, 0] : [0, 1], nv = ax ? [0, 1] : [1, 0], A = 1.2;
    let style = 0; // the line it is in (the first along its way, past a 2-cell gate's other half; none: a fence's)
    for (let d = 1; d <= 3 && !style; d++) for (const s of [-1, 1]) { const n = at(i + s * e[0] * d, j + s * e[1] * d); if (line(n)) { style = n; break; } }
    style ||= FENCE;
    const hedgy = style === HEDGE, pale = hedgy ? '#f3ecdc' : '#e2b27a', bar = hedgy ? '#d8cdb6' : '#c88a4b';
    for (const s of [-1, 1]) {
      const nb = at(i + s * e[0], j + s * e[1]); if (nb === DOOR) continue; // the other leaf of a 2-cell gate is that cell's
      let hx, hz, L;
      if (line(nb)) { const off = nb === HEDGE ? 0.56 : nb === WALL ? 0.44 : 0.22; hx = x + s * e[0] * (U - off); hz = z + s * e[1] * (U - off); L = U - off - 0.08; }
      else { const px = x + s * e[0] * U * 0.5, pz = z + s * e[1] * U * 0.5, py = y(px, pz); // the line stops here: its own post
        if (style === WALL) [[0.3, 0.38, 0.32], [0.82, 0.32, 0.24], [1.24, 0.3, 0.16]].forEach(([h, w, t], q) => T.blob.push({ x: px, y: py + h, z: pz, ry: r * 3 + q, s: [w, t, w], c: STONES[(Math.floor(r * 4) + q) % 4] }));
        else if (hedgy) T.rbox.push({ x: px, y: py + HH / 2, z: pz, s: [0.42, HH / 2 + 0.08, 0.42], c: HEDGES[0] });
        else { T.post.push({ x: px, y: py - 0.04, z: pz, s: [0.18, 1.95, 0.18], c: '#c88a4b' }); T.blob.push({ x: px, y: py + 1.97, z: pz, s: 0.15, c: '#e2b27a' }); }
        const pr = style === FENCE ? 0.2 : 0.44; hx = px - s * e[0] * pr; hz = pz - s * e[1] * pr; L = U * 0.5 - pr - 0.08; }
      const w = [-s * e[0] * Math.cos(A) + nv[0] * Math.sin(A), -s * e[1] * Math.cos(A) + nv[1] * Math.sin(A)], p = [-w[1], w[0]], ry = Math.atan2(-w[1], w[0]);
      const at2 = (u, v) => [hx + w[0] * u + p[0] * v, hz + w[1] * u + p[1] * v], gy = y(...at2(L / 2, 0));
      for (let q = 0; q < 4; q++) { const u = 0.1 + q * (L - 0.18) / 3, [px, pz] = at2(u, 0); // the uprights, rising to the free end
        T.paling.push({ x: px, y: y(px, pz) - 0.03, z: pz, ry, s: [0.1, 1.2 + 0.24 * Math.sin(Math.PI / 2 * u / L), 0.085], c: shade(pale, (h01(i + q, j + s) - 0.5) * 0.06) }); }
      for (const h of [0.42, 1.0]) { const [bx, bz] = at2(L / 2, 0.09); T.rail.push({ x: bx, y: gy + h, z: bz, ry, s: [L + 0.04, 0.068, 0.068], c: bar }); }
      const [cx, cz] = at2(L / 2, 0.1); T.rail.push({ x: cx, y: gy + 0.71, z: cz, ry, rz: Math.atan2(0.58, L - 0.2), s: [Math.hypot(L - 0.2, 0.58), 0.05, 0.05], c: bar }); // the brace
      for (const v of [-0.12, 0.17]) { const [kx, kz] = at2(L - 0.1, v); T.blob.push({ x: kx, y: gy + 0.85, z: kz, s: 0.065, c: '#8a5a34' }); } // a knob each side
    }
  }
}
