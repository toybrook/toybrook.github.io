// Pond ground: the meadow's board base and terrain mesh (meadow/terrain.js), with the pond's colours.
import * as THREE from 'three';
import { heightAt, occupied, rand, waterY, shore, isle, sPts, SW, S, R, Z } from './layout.js';
import { dist2D } from '../meadow/layout.js';
import { buildBase, terrainMesh } from '../meadow/terrain.js';

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const n2 = (x, z) => Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) * Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.3);

export function buildTerrain(scene) {
  buildBase(scene, rand, false, R);
  const C = s => new THREE.Color(s);
  const gBright = C('#9bcf48'), gMid = C('#76b33c'), gDeep = C('#5c9a35'), gSun = C('#b4d95a'), gSlope = C('#4f8a30'), gForest = C('#5a9136');
  const wetSand = C('#cdb27a'), bedSand = C('#d9c79a'), bedDeep = C('#93a87e'), bedDark = C('#3f7480');
  // inbox 27: as the snow (inbox 26): the deep bed was under the soil box's flat top (-1.45, meadow/terrain.js buildBase),
  // whose soil pattern runs along x + z, so it showed through the deep water as diagonal streaks. The mesh stops just over
  // it (BED); its colour, the water's depth (water.js), the pond's shape and the animals still go by the real heightAt.
  const BED = -1.4;
  return terrainMesh(scene, (x, z) => Math.max(heightAt(x, z), BED), occupied, (col, x, z, h, ny) => {
    h = heightAt(x, z);
    const big = 0.5 + 0.5 * Math.sin(x * 0.23 + 0.7) * Math.cos(z * 0.19 - 0.4);
    col.copy(gMid).lerp(gBright, big * 0.8).lerp(gDeep, sm(n2(x, z) * 0.5 + 0.1) * 0.35);
    col.lerp(gSun, sm((h - 0.25) / 0.7) * 0.4);
    if (z < -24 * S) col.lerp(gForest, 0.55);
    col.lerp(gSlope, sm((0.93 - ny) / 0.25) * 0.6);
    Z.tint(col, x, z, ny, C); // 28-1: the zones' own ground
    // by height over the water: wet sand at the waterline, sandy then greenish bed under it, darker and nearer the water's
    // colour the deeper it is. Only by the pond and the stream (wet): a low hollow in the grass further off stays grass.
    // inbox 12: the islands' slopes showed through the water as pale cones (the water is clear where it is under ~1.3 deep):
    // by an island (isl: its slope, waterline to the floor 1.7 out) the dark starts just under the waterline. The shore's
    // shallow rim keeps its sand
    const u = h - waterY(z), wet = 1 - sm((Math.min(shore(x, z), dist2D(sPts, x, z) - SW, Z.wd(x, z, true)) - 0.4) / 0.8), isl = 1 - sm((isle(x, z) - 1.8) / 0.8);
    col.lerp(wetSand, sm((0.3 - u) / 0.25) * 0.85 * wet);
    if (u < 0) col.lerp(bedSand, wet).lerp(bedDeep, sm(-u / 1.2) * wet).lerp(bedDark, Math.max(sm((-u - 0.3) / 1.3) * 0.85, sm((-u - 0.05) / 0.8) * 0.9 * isl) * wet);
  }, R, S);
}
