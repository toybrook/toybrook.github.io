// 17-3 정원이 숨 쉬어요: what has grown by itself (game/wild.js H.g) drawn, one InstancedMesh a kind, small shapes of our own in
// the board's vinyl: 들꽃 (three flowers a cell, each with its grass clump; still a bud: a green knob), 이끼 (low soft domes),
// 버섯 (in the moss: a cream stem, a round red or brown cap, no spots), 갈대 (a tuft at the water), 수련 (notched pads on the
// water, now and then a pink flower). Nothing here is in the way: no spot in the decor list, no body (animals walk through).
import * as THREE from 'three';
import { partGeos, makeGrassClump, grassMat } from './meadow/props.js';
import { instanced, toyMat, addSway } from './toyKit.js';
import { QUALITY } from '../config.js';
import { BLOOMS, WILD, hash } from '../game/wild.js';

let LK = null;
const looks = () => LK ??= (() => {
  const { geo, mat } = partGeos(), white = o => toyMat('#ffffff', o);
  const stem = new THREE.CylinderGeometry(0.035, 0.045, 1, 6); stem.translate(0, 0.5, 0);
  const cap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const reed = new THREE.CylinderGeometry(0.03, 0.04, 1, 5); reed.translate(0, 0.5, 0);
  const pad = new THREE.CircleGeometry(0.42, 18, 0.35, Math.PI * 2 - 0.7); pad.rotateX(-Math.PI / 2);
  return { geo: { petal: geo.petal, centre: geo.centre, grass: makeGrassClump(4 + QUALITY.g.leaf), moss: geo.pebble, bud: geo.pebble, stem, cap, reed, head: new THREE.CapsuleGeometry(0.075, 0.26, 2, 6), pad },
    mat: { petal: mat.plain, centre: mat.centre, grass: grassMat(), moss: white({ roughness: 0.85 }), bud: white({ roughness: 0.6 }), stem: white({ roughness: 0.6 }), cap: white({ roughness: 0.5 }),
      reed: addSway(white({ roughness: 0.6 }), 0.05, 1.1), head: white({ roughness: 0.55 }), pad: white({ roughness: 0.35 }) } };
})();
const CAST = ['stem', 'cap', 'reed', 'head'], MOSS = ['#6d9b3a', '#7aa845', '#5f8f34'], CAP = ['#e0473a', '#b5763f'];
const rnd = s => () => (s = s * 16807 % 2147483647) / 2147483647;

// H: the ground's height; U: a cell; water: the water's height
export function wildLayer(scene, H, U, water) {
  let meshes = [];
  return {
    // g: H.g (null: none drawn), today: wild.js S.wild.d (a flower WILD.bud days old has bloomed)
    set(g, today) {
      for (const m of meshes) { scene.remove(m); m.dispose(); } meshes = [];
      if (!g) return;
      const L = { petal: [], centre: [], grass: [], moss: [], bud: [], stem: [], cap: [], reed: [], head: [], pad: [] };
      for (const k in g) {
        const [kind, col, born] = g[k], [i, j] = k.split(',').map(Number), r = rnd(hash(k) % 2147483646 + 1), cx = (i + 0.5) * U, cz = (j + 0.5) * U;
        const at = m => { const x = cx + (r() - 0.5) * 2 * m * U, z = cz + (r() - 0.5) * 2 * m * U; return [x, H(x, z), z]; };
        if (kind === 'f') {
          const open = today - born >= WILD.bud, [pc, cc] = BLOOMS[col].c;
          for (let n = 0; n < 3; n++) { const [x, y, z] = at(0.36);
            L.grass.push({ x, y: y - 0.03, z, s: open ? 1.25 : 0.95, ry: r() * 6, c: '#5f9f36' });
            if (!open) { L.bud.push({ x, y: y + 0.22, z, s: [0.055, 0.075, 0.055], c: '#86c24f' }); continue; }
            const s = 0.85 + r() * 0.35, fy = y + 0.3 + r() * 0.08;
            L.petal.push({ x, y: fy, z, s, ry: r() * 6, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4, c: pc }); L.centre.push({ x, y: fy + 0.03 * s, z, s, c: cc }); }
        } else if (kind === 'm' || kind === 'u') {
          for (let n = 0; n < (kind === 'u' ? 2 : 3); n++) { const [x, y, z] = at(0.3), w = 0.32 + r() * 0.16;
            L.moss.push({ x, y: y - 0.025, z, s: [w, 0.09 + r() * 0.04, w * (0.8 + r() * 0.3)], ry: r() * 6, c: MOSS[n % 3] }); }
          if (kind === 'u') for (let n = 0; n < 2; n++) { const [x, y, z] = at(0.3), h = 0.16 + r() * 0.1, w = 0.11 + r() * 0.05;
            L.stem.push({ x, y: y - 0.02, z, s: [1, h, 1] }); L.cap.push({ x, y: y + h - 0.04, z, s: [w, w * 0.75, w], ry: r() * 6, c: CAP[hash(k) % 2] }); }
        } else if (kind === 'r') {
          for (let n = 0; n < 4; n++) { const [x, y, z] = at(0.32), hh = 0.85 + r() * 0.45, rz = (r() - 0.5) * 0.2;
            L.reed.push({ x, y, z, s: [1, hh, 1], rz, c: '#5d9a3a' }); L.head.push({ x: x + Math.sin(-rz) * hh, y: y + hh, z, rz, c: '#8b5a2b' }); }
        } else if (kind === 'l') {
          for (let n = 0; n < 2; n++) { const x = cx + (r() - 0.5) * 0.9 * U, z = cz + (r() - 0.5) * 0.9 * U, s = 0.8 + r() * 0.4;
            L.pad.push({ x, y: water + 0.006 + n * 0.002, z, s, ry: r() * 6, c: n ? '#6bb852' : '#5fae4a' });
            if (n === 0 && hash(k) % 3 === 0) { L.petal.push({ x, y: water + 0.06, z, s: 0.8, ry: r() * 6, c: '#f7a8c4' }); L.centre.push({ x, y: water + 0.085, z, s: 0.8, c: '#ffe066' }); } }
        }
      }
      const { geo, mat } = looks();
      for (const kd in L) if (L[kd].length) { const m = instanced(geo[kd], mat[kd], L[kd], { cast: CAST.includes(kd) }); scene.add(m); meshes.push(m); }
    },
    get meshes() { return meshes; },
  };
}
