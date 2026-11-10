// 22-1: the natives, the trees, bushes, rocks and wildflower patches a board came with, as props the player can move, cut and
// plant again (S.props nat: 1, { prop, s: size, v: seed of its look }). meadow/props.js plants them as before and notes where;
// here each is grown again from its seed with the same kit, shapes and materials, all of a board's in one InstancedMesh a kind.
import * as THREE from 'three';
import { kit, emptyL, flowerPal, flowerCluster, partGeos, makeGrassClump, grassMat } from './meadow/props.js';
import { instanced } from './toyKit.js';
import { QUALITY, thin } from '../config.js';

const KINDS = ['canopy', 'trunk', 'pine', 'snow', 'rock', 'petal', 'centre', 'grass'], FLAT = ['petal', 'centre', 'grass'];
const seeded = v => { let s = v % 2147483646 + 1; return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; };
const GM = {}; // by leaves per clump (26-3: 낮음 one less)
const looks = () => { const { geo, mat } = partGeos(), n = 4 + QUALITY.g.leaf; return GM[n] ??= { geo: { ...geo, grass: makeGrassClump(n) }, mat: { ...mat, petal: mat.plain, grass: grassMat() } }; };

// one native's instances (as kit() lists them) at X, Z turned by rot, on the ground H
export function grow({ prop, s = 1, v = 0 }, X = 0, Z = 0, rot = 0, H = () => 0) {
  const c = Math.cos(rot), n = Math.sin(rot), W = (x, z) => [X + x * c + z * n, Z - x * n + z * c];
  const L = emptyL(), rand = seeded(v), k = kit(L, { rand, heightAt: (x, z) => H(...W(x, z)), occupied: [] });
  if (prop === 'wildflowers') flowerCluster(L, 0, 0, flowerPal[v % 6], () => true, rand, k.jitter, (x, z) => H(...W(x, z)));
  else k[prop](0, 0, s);
  for (const kd of KINDS) for (const it of L[kd]) { [it.x, it.z] = W(it.x, it.z); it.ry = (it.ry || 0) + rot; }
  const g = QUALITY.g; L.grass = thin(L.grass, g.grass); L.petal = thin(L.petal, g.flower); L.centre = thin(L.centre, g.flower); // 26-3 (a petal and its centre go together)
  return L;
}
const meshesOf = (L, add) => { const M = {}, { geo, mat } = looks(); for (const k of KINDS) if (L[k].length) add(M[k] = instanced(geo[k], mat[k], L[k], { cast: !FLAT.includes(k) })); return M; };

// a board's natives: set(placed records, unit) draws them and gives uid -> fade list ([[mesh, first, count]], habitat.js);
// model(rec): one as a Group, for holding it; pick(hit): the uid a raycast hit belongs to
export function natureLayer(scene, H, U) {
  let meshes = [], fades = new Map();
  return {
    set(recs) {
      for (const m of meshes) { scene.remove(m); m.dispose(); } meshes = []; fades = new Map();
      const all = emptyL();
      for (const r of recs) {
        const L = grow(r, r.x * U, r.z * U, r.rot || 0, H), f = [];
        for (const k of KINDS) if (L[k].length) { f.push([k, all[k].length, L[k].length]); all[k].push(...L[k]); }
        fades.set(r.uid, f);
      }
      const M = meshesOf(all, m => { scene.add(m); meshes.push(m); });
      for (const f of fades.values()) for (const p of f) p[0] = M[p[0]];
      return fades;
    },
    model(rec) { const g = new THREE.Group(); meshesOf(grow(rec), m => g.add(m)); return g; },
    get meshes() { return meshes; },
    pick(hit) { for (const [uid, f] of fades) if (f.some(([m, i0, n]) => m === hit.object && hit.instanceId >= i0 && hit.instanceId < i0 + n)) return uid; return null; },
  };
}

// the board's grass clumps (meadow/props.js finish): hide(fn) zeroes those where fn(x, z), puts the rest back
export function grassMask(meshes) {
  const keep = meshes.map(m => m.instanceMatrix.array.slice());
  return hide => meshes.forEach((m, k) => {
    const a = m.instanceMatrix.array, o = keep[k];
    for (let i = 0; i < m.count; i++) { const h = hide(o[i * 16 + 12], o[i * 16 + 14]); for (let j = 0; j < 16; j++) a[i * 16 + j] = h === true ? 0 : o[i * 16 + j]; if (h && h !== true) a[i * 16 + 13] += h; } // 28-6 a number: raised by it
    m.instanceMatrix.needsUpdate = true;
  });
}
