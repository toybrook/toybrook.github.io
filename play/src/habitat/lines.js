import * as THREE from 'three';
import { toyMat, instanced } from './toyKit.js';
import { BRUSHES } from '../game/data.js';

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

export function linesLayer(scene, y, U) {
  let meshes = [];
  return {
    // paint: { 'i,j': brush }; the cells it stands in, [x, z] (habitat.js: a spot each, so animals go round and props keep off)
    set(paint) {
      for (const m of meshes) { scene.remove(m); m.dispose(); } meshes = [];
      const at = (i, j) => paint[`${i},${j}`], posts = [], rails = [], stones = [], cells = [];
      const join = (b, i, j, di, dj, f) => { if (at(i + di, j + dj) !== b) return; if (di && dj && (at(i + di, j) === b || at(i, j + dj) === b)) return; f((i + 0.5) * U, (j + 0.5) * U, (i + di + 0.5) * U, (j + dj + 0.5) * U); };
      for (const k in paint) {
        const b = paint[k]; if (b !== FENCE && b !== WALL) continue;
        const [i, j] = k.split(',').map(Number), x = (i + 0.5) * U, z = (j + 0.5) * U, g = y(x, z); cells.push([x, z]);
        if (b === FENCE) {
          posts.push({ x, y: g - 0.04, z, c: '#c88a4b' });
          for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) join(b, i, j, di, dj, (xa, za, xb, zb) => {
            const ya = y(xa, za), yb = y(xb, zb), d = Math.hypot(xb - xa, zb - za), ry = Math.atan2(-(zb - za), xb - xa), rz = Math.atan2(yb - ya, d), len = Math.hypot(d, yb - ya);
            for (const h of [0.58, 1.02]) rails.push({ x: (xa + xb) / 2, y: (ya + yb) / 2 + h, z: (za + zb) / 2, ry, rz, s: [len, 1, 1], c: '#d0955a' });
          });
        } else {
          const r = h01(i, j); // a big stone on the cell, a smaller one on top of it
          stones.push({ x, y: g + 0.27, z, s: [0.4, 0.33, 0.4], ry: r * 3, c: STONES[Math.floor(r * 4)] }, { x, y: g + 0.75, z, s: [0.3, 0.22, 0.3], ry: r * 5, c: STONES[(Math.floor(r * 4) + 1) % 4] });
          for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) join(b, i, j, di, dj, (xa, za, xb, zb) => {
            const d = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(d / 0.54) - 1), ry = Math.atan2(-(zb - za), xb - xa);
            for (let k = 0; k <= n; k++) for (const top of [0, 1]) {
              if (!top && !k) continue; const t = (k + (top ? 0.5 : 0)) / (n + 1); // the bottom row between the big stones, the top row between the bottom's
              const sx = xa + (xb - xa) * t, sz = za + (zb - za) * t, q = h01(sx * 3.1, sz * 1.7);
              stones.push({ x: sx, y: y(sx, sz) + (top ? 0.63 : 0.22), z: sz, ry, s: top ? [0.25, 0.2, 0.24] : [0.3, 0.24, 0.28], c: STONES[Math.floor(q * 4)] });
            }
          });
        }
      }
      for (const [g, items] of [[POST, posts], [RAIL, rails], [STONE, stones]]) if (items.length) { const m = instanced(g, mat, items); scene.add(m); meshes.push(m); }
      return cells;
    },
  };
}
