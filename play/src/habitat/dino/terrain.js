// Dino jungle ground: the meadow's board base and terrain mesh (meadow/terrain.js) as the pond's (pond/terrain.js), a deeper,
// lusher green with darker fern-shade patches. The mud wallow dark wet brown, the fossil dig pale sand with a darker dug floor,
// grey-brown rock on the mounds' steeper flanks, sand at the lagoon's waterline, the bed teal and darker the deeper.
import * as THREE from 'three';
import { heightAt, occupied, rand, waterY, shore, mound, inMud, inDig, R, Z, S } from './layout.js';
import { buildBase, terrainMesh } from '../meadow/terrain.js';

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const n2 = (x, z) => Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) * Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.3);

export function buildTerrain(scene) {
  buildBase(scene, rand, false, R);
  const C = s => new THREE.Color(s);
  const gMid = C('#6aa640'), gBright = C('#86bb48'), gDeep = C('#4e8a36'), gForest = C('#467c30'), gSlope = C('#3f7a2c');
  const mudRim = C('#7a5636'), mudWet = C('#5e4028'), sand = C('#e2c890'), dug = C('#c8a870'), stone = C('#8a8478'), stoneDark = C('#6e685e');
  const wetSand = C('#cdb27a'), bedSand = C('#d4c494'), bedDeep = C('#7fa88a'), bedDark = C('#2f6f72');
  const BED = -1.4; // as the snow's and the pond's (inbox 26/27): the mesh stops just over the soil box's top
  return terrainMesh(scene, (x, z) => Math.max(heightAt(x, z), BED), occupied, (col, x, z, h, ny) => {
    h = heightAt(x, z);
    const big = 0.5 + 0.5 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 - 0.8);
    col.copy(gMid).lerp(gBright, big * 0.55).lerp(gDeep, sm(n2(x, z) * 0.5 + 0.1) * 0.5);
    if (z < -24 * S) col.lerp(gForest, 0.6);
    col.lerp(gSlope, sm((0.93 - ny) / 0.25) * 0.55);
    Z.tint(col, x, z, ny, C); // the zones' own ground
    const m = mound(x, z); col.lerp(stone, sm((0.9 - ny) / 0.12) * sm(m / 0.25) * 0.85).lerp(stoneDark, sm((0.78 - ny) / 0.1) * sm(m / 0.25) * 0.5); // the mounds' flanks
    const d = inDig(x, z); col.lerp(sand, d * 0.95).lerp(dug, sm(d * 1.6 - 0.6) * 0.6 * (0.6 + 0.4 * n2(x * 1.7, z * 1.7))); // the dig: sand, the dug floor darker
    const md = inMud(x, z); col.lerp(mudRim, sm(md * 3) * 0.9).lerp(mudWet, sm(md * 2 - 0.5)); // the wallow: wet brown, darker in
    const u = h - waterY(), wet = 1 - sm((Math.min(shore(x, z), Z.wd(x, z, true)) - 0.4) / 0.8);
    col.lerp(wetSand, sm((0.3 - u) / 0.25) * 0.85 * wet);
    if (u < 0) col.lerp(bedSand, wet).lerp(bedDeep, sm(-u / 1.2) * wet).lerp(bedDark, sm((-u - 0.3) / 1.3) * 0.85 * wet);
  }, R, S);
}
