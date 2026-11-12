// Snow habitat (25-1): assembles props, terrain and water as the pond's (pond/index.js). Animals are placed by habitat.js.
import * as layout from './layout.js';
import { buildTerrain } from './terrain.js';
import { buildWater } from './water.js';
import { zoneWater } from '../meadow/water.js';
import { inRect } from '../zones.js';
import { buildProps } from './props.js';
import { decorModel } from '../meadow/props.js';

export function buildSnow(scene, ui, sunDir, level = 0, top = level) {
  layout.setLevel(level, top);
  const P = buildProps(scene), ground = buildTerrain(scene);
  const updWater = buildWater(scene, sunDir), updZone = zoneWater(scene, sunDir, layout.heightAt, layout.Z, { cold: true }); // 28-1: the zones' water
  // as the pond's ctx, no bridge; perches: the mounds' tops (the owl, walk.js)
  const ctx = {
    scene, heightAt: layout.heightAt, walkable: layout.walkable, pathClear: layout.pathClear, bridgeEnds: layout.bridgeEnds, deckAt: layout.deckAt,
    onSleepTick: ui.zzz, pond: layout.pond, water: layout.WATER_Y + 0.04, wet: layout.wet, waterSpot: layout.waterSpot, shore: layout.shore,
    shelter: layout.occupied.filter(o => o.cover && o.z > -22 * layout.S), perches: layout.perches,
    spawn: () => { const O = layout.O; for (let k = 0; ; k++) { const x = O[0] + 2 + Math.random() * (O[1] - O[0] - 4), z = -22 * layout.S + Math.random() * (O[3] - 2 + 22 * layout.S); if (layout.mainland(x, z) || k > 200) return [x, z]; } },
    spots: layout.Z.spots.filter(s => s.k <= level), // 28-1: the open zones' spots (walk.js)
    landing: layout.landing,
  };
  const decor = { list: layout.decor, placeable: layout.placeable, model: decorModel, y: (x, z, water) => water ? ctx.water : layout.heightAt(x, z) };
  const floor = (x, z) => Math.max(layout.heightAt(x, z), layout.WATER_Y);
  // 땅 칠하기: the snow round the pond (not the water or the floes)
  const paintable = (x, z) => inRect(layout.O, x, z, 1.8) && layout.shore(x, z) > 0.3 && layout.Z.wd(x, z, true) > 0.2;
  return { ctx, decor, floor, solid: layout.occupied, update(dt, t) { updWater(t); updZone(t); P.zone.update(t, ctx); }, built: layout.R, unit: layout.S,
    natives: { list: P.natives, rings: level + 1 }, grass: P.grass, ground, paintable };
}
