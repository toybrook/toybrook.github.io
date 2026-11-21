// 195 B-8 1-2 흩뿌리기·디테일 붓, 붓 포기 (?yard, docs/decor-redesign.md 5-2 ②, 5-3 ④): the yard's scattered bits (game/scatter.js
// S.scatter: 조약돌, 낙엽, 이끼, 작은 버섯, 꽃잎) and the low tufts on the 풀숲·물가 brushes' cells (data.js BRUSHES tuft), one
// InstancedMesh a shape, small low-poly shapes of our own in the board's vinyl. Nothing here is in the way (no spot, no body), no
// shadow cast. The shapes and materials are made once and shared (as wildLayer.js); set() and dispose() let go of the meshes
// (the shared shapes and materials, LK, stay for the page's life: a fixed few, as wildLayer.js's; 135-5's one exception here).
import * as THREE from 'three';
import { makeGrassClump, grassMat } from '../meadow/props.js';
import { instanced, toyMat, addSway } from '../toyKit.js';
import { BRUSHES } from '../../game/data.js';
import { SCATTER } from './fine.js';

let LK = null;
const looks = () => LK ??= (() => {
  const white = o => toyMat('#ffffff', o), lo = new THREE.SphereGeometry(1, 7, 4), dome = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const stem = new THREE.CylinderGeometry(0.035, 0.045, 1, 5); stem.translate(0, 0.5, 0);
  const reed = new THREE.CylinderGeometry(0.03, 0.04, 1, 5); reed.translate(0, 0.5, 0);
  return { geo: { pebble: lo, leaf: lo, moss: dome, stem, cap: dome, petal: lo, grass: makeGrassClump(4), reed, head: new THREE.CapsuleGeometry(0.07, 0.22, 1, 5) },
    mat: { pebble: white({ roughness: 0.55 }), leaf: white({ roughness: 0.6 }), moss: white({ roughness: 0.85 }), stem: white({ roughness: 0.6 }), cap: white({ roughness: 0.5 }),
      petal: white({ roughness: 0.5 }), grass: grassMat(), reed: addSway(white({ roughness: 0.6 }), 0.05, 1.1), head: white({ roughness: 0.55 }) } };
})();
const PEB = ['#bdb5a5', '#a9a294', '#cfc8bb'], LEAF = ['#d98a3e', '#c9622f', '#e2b04a'], MOSS = ['#6d9b3a', '#7aa845', '#5f8f34'], CAP = ['#e0473a', '#b5763f'], PET = ['#f7a8c4', '#ffffff', '#f2c4dc'];
const SIZE = [0.8, 1, 1.25], KIND = SCATTER.map(s => s.id), TUFT = BRUSHES.map(b => b.tuft || null);
const rnd = s => () => (s = s * 16807 % 2147483647) / 2147483647;
const seed = (a, b, c) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0) % 2147483646 + 1;

// H: the ground's height; U: a cell
export function scatterLayer(scene, H, U) {
  let meshes = [], sig = '';
  const clear = () => { for (const m of meshes) { scene.remove(m); m.dispose(); } meshes = []; };
  return {
    // list: S.scatter (or a stroke as it goes, habitat.js); paint: the yard's paint ({ 'i,j': brush }) for the tufts
    set(list = [], paint = {}) {
      const tufts = Object.keys(paint).filter(k => TUFT[paint[k]]), s = list.join(',') + '|' + tufts.map(k => k + ':' + paint[k]).join(';');
      if (s === sig) return; sig = s; clear();
      const L = { pebble: [], leaf: [], moss: [], stem: [], cap: [], petal: [], grass: [], reed: [], head: [] };
      for (let p = 0; p + 4 < list.length; p += 5) {
        const [k, x2, z2, rot, sz] = list.slice(p, p + 5), r = rnd(seed(x2, z2, k * 8 + rot)), f = SIZE[sz] ?? 1, ry = rot * Math.PI / 4;
        const cx = (x2 + 0.5) * U / 2, cz = (z2 + 0.5) * U / 2, at = m => { const x = cx + (r() - 0.5) * m * U, z = cz + (r() - 0.5) * m * U; return [x, H(x, z), z]; };
        switch (KIND[k]) {
          case 'pebble': for (let n = 0; n < 2; n++) { const [x, y, z] = at(0.35), w = (0.13 + r() * 0.06) * f; L.pebble.push({ x, y: y + 0.02, z, s: [w, w * 0.55, w * 0.8], ry: ry + n * 2, c: PEB[(n + rot) % 3] }); } break;
          case 'leaf': for (let n = 0; n < 2; n++) { const [x, y, z] = at(0.4), w = 0.15 * f; L.leaf.push({ x, y: y + 0.02, z, s: [w, 0.018, w * 0.55], ry: ry + n * 1.3, rx: (r() - 0.5) * 0.3, c: LEAF[(n + rot) % 3] }); } break;
          case 'moss': { const [x, y, z] = at(0.2), w = (0.26 + r() * 0.1) * f; L.moss.push({ x, y: y - 0.02, z, s: [w, 0.09 * f, w * 0.85], ry, c: MOSS[rot % 3] }); break; }
          case 'shroom': for (let n = 0; n < 2; n++) { const [x, y, z] = at(0.3), h = (0.13 + r() * 0.08) * f, w = (0.09 + r() * 0.04) * f;
            L.stem.push({ x, y: y - 0.02, z, s: [f, h, f], c: '#f3e6cf' }); L.cap.push({ x, y: y + h - 0.035, z, s: [w, w * 0.75, w], ry, c: CAP[(n + rot) % 2] }); } break;
          case 'petal': for (let n = 0; n < 3; n++) { const [x, y, z] = at(0.45), w = 0.07 * f; L.petal.push({ x, y: y + 0.015, z, s: [w, 0.012, w * 0.65], ry: ry + n * 2.1, c: PET[(n + rot) % 3] }); } break;
        }
      }
      for (const key of tufts) {
        const t = TUFT[paint[key]], [i, j] = key.split(',').map(Number), r = rnd(seed(i, j, paint[key])), cx = (i + 0.5) * U, cz = (j + 0.5) * U;
        for (let n = 0; n < t.per; n++) { const x = cx + (r() - 0.5) * 0.75 * U, z = cz + (r() - 0.5) * 0.75 * U, y = H(x, z);
          if (t.kind === 'grass') L.grass.push({ x, y: y - 0.03, z, s: (1.1 + r() * 0.4) * t.h, ry: r() * 6, c: '#5f9f36' });
          else for (let q = 0; q < 3; q++) { const hh = (0.8 + r() * 0.4) * t.h, rz = (r() - 0.5) * 0.3, ox = x + (q - 1) * 0.08;
            L.reed.push({ x: ox, y, z: z + (r() - 0.5) * 0.1, s: [1, hh, 1], rz, c: '#5d9a3a' }); L.head.push({ x: ox + Math.sin(-rz) * hh, y: y + hh, z, rz, c: '#8b5a2b' }); } }
      }
      const { geo, mat } = looks();
      for (const kd in L) if (L[kd].length) { const m = instanced(geo[kd], mat[kd], L[kd], { cast: false }); scene.add(m); meshes.push(m); }
    },
    count: () => meshes.reduce((n, m) => n + m.count, 0), // check: instances drawn
    dispose() { clear(); sig = ''; },
  };
}
