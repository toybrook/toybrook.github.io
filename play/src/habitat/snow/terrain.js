// Snow ground: the meadow's board base and terrain mesh (meadow/terrain.js), snow-white. Blue-grey in the hollows and
// the shade side, bare grey stone on the mounds' steeper flanks, pale ice-blue at the waterline, the bed a cold teal.
import * as THREE from 'three';
import { heightAt, occupied, rand, waterY, shore, isle, mound, R, Z, S } from './layout.js';
import { buildBase, terrainMesh } from '../meadow/terrain.js';

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const n2 = (x, z) => Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) * Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.3);

export function buildTerrain(scene) {
  buildBase(scene, rand, false, R);
  const C = s => new THREE.Color(s);
  const snow = C('#eef2f7'), snowLit = C('#fbfcfe'), snowBlue = C('#cfdbea'), stone = C('#9a9a9e'), stoneDark = C('#7d7f86');
  const rim = C('#d6e8f0'), bedPale = C('#b9d6dc'), bedDeep = C('#6f9fb0'), bedDark = C('#2f5f73'), floe = C('#e4f1f7');
  // inbox 26: the deep bed (to -2.2) was under the soil box's flat top (-1.45, meadow/terrain.js buildBase), so the box's
  // soil, whose pattern runs along x + z, showed through the deep water as diagonal streaks. The mesh stops just over it
  // (BED); its colour, the water's depth (water.js) and the animals still go by the real heightAt.
  const BED = -1.4;
  return terrainMesh(scene, (x, z) => Math.max(heightAt(x, z), BED), occupied, (col, x, z, h, ny) => {
    h = heightAt(x, z);
    const big = 0.5 + 0.5 * Math.sin(x * 0.23 + 0.7) * Math.cos(z * 0.19 - 0.4);
    col.copy(snow).lerp(snowLit, big * 0.6).lerp(snowBlue, sm(n2(x, z) * 0.5 + 0.1) * 0.35);
    col.lerp(snowBlue, sm((0.95 - ny) / 0.2) * 0.5); // drifts' shade sides
    Z.tint(col, x, z, ny, C); // 28-1: the zones' own ground (ice, bare rock)
    const m = mound(x, z); col.lerp(stone, sm((0.9 - ny) / 0.12) * sm(m / 0.25) * 0.85).lerp(stoneDark, sm((0.78 - ny) / 0.1) * sm(m / 0.25) * 0.5); // the mounds' flanks: stone through the snow
    // by height over the water, as the pond's: a pale icy rim at the waterline, the bed teal and darker the deeper.
    // A floe: flat pale ice on top, its edge (the slope under the water) dark at once
    const u = h - waterY(), wet = 1 - sm((Math.min(shore(x, z), Z.wd(x, z, true)) - 0.4) / 0.8), fl = 1 - sm((isle(x, z) + 0.1) / 0.3);
    col.lerp(rim, sm((0.3 - u) / 0.25) * 0.85 * wet);
    if (u < 0) col.lerp(bedPale, wet).lerp(bedDeep, sm(-u / 1.2) * wet).lerp(bedDark, Math.max(sm((-u - 0.3) / 1.3) * 0.85, sm((-u - 0.05) / 0.6) * 0.9 * (1 - sm((isle(x, z) - 1.8) / 0.8))) * wet);
    else col.lerp(floe, fl);
  }, R, S, { lum: 0.8 });
}
