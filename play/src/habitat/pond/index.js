// Pond habitat (19-2): assembles props, terrain and water. Animals are the player's, placed by habitat.js.
import * as layout from './layout.js';
import { buildTerrain } from './terrain.js';
import { buildWater } from './water.js';
import { zoneWater } from '../meadow/water.js';
import { inRect } from '../zones.js';
import { buildProps } from './props.js';
import { decorModel } from '../meadow/props.js';
import { dist2D } from '../meadow/layout.js';

// level: 땅 넓히기 step (21-3b), top: the step whose band is built round it, under mist
export function buildPond(scene, ui, sunDir, level = 0, top = level) {
  layout.setLevel(level, top); // the board's size; the lists below start empty
  const P = buildProps(scene), ground = buildTerrain(scene); // props fill layout.occupied (terrain bakes contact shadows from it, animals avoid it)
  const updWater = buildWater(scene, sunDir), updZone = zoneWater(scene, sunDir, layout.heightAt, layout.Z); // 28-1: the zones' water
  // as the meadow's ctx (meadow/index.js), plus wet / waterSpot for the animals that go into the water (walk.js)
  const ctx = {
    scene, heightAt: layout.heightAt, walkable: layout.walkable, pathClear: layout.pathClear, bridgeEnds: layout.bridgeEnds, deckAt: layout.deckAt,
    onSleepTick: ui.zzz, pond: layout.pond, water: layout.WATER_Y + 0.04, wet: layout.wet, waterSpot: layout.waterSpot, shore: layout.shore,
    shelter: layout.occupied.filter(o => o.h >= 3 && o.z > -22), // 21-2: trees and roofs for the rain (walk.js)
    spawn: () => { const O = layout.O; for (let k = 0; ; k++) { const x = O[0] + 2 + Math.random() * (O[1] - O[0] - 4), z = -22 + Math.random() * (O[3] - 24); if (layout.mainland(x, z) || k > 200) return [x, z]; } },
    spots: layout.Z.spots.filter(s => s.k <= level), // 28-1: the open zones' spots (walk.js)
    landing: [layout.hill.x, layout.hill.z], // babies from the nest land on the grass hill (habitat.js drop), never on an island
  };
  const decor = { list: layout.decor, placeable: layout.placeable, model: decorModel, y: (x, z, water) => water ? ctx.water : layout.heightAt(x, z) };
  const floor = (x, z) => Math.max(layout.heightAt(x, z), layout.waterY(z), layout.deckAt(x, z)); // the camera stays over the water too
  // built: the board as built, [x0, x1, z0, z1] (28-1); unit: saved decor x, z -> here (habitat.js)
  // 22-1 as the meadow's; the pond's natives all come with the first board (its spread board re-plants by its own counts),
  // and 땅 칠하기 paints the land round the water only (shore > 0.3: the grass band, not the water or the islands)
  const paintable = (x, z) => inRect(layout.O, x, z, 1.8) && layout.shore(x, z) > 0.3 && layout.Z.wd(x, z, true) > 0.2 && dist2D(layout.sPts, x, z) > layout.SW + 0.2;
  return { ctx, decor, floor, solid: layout.occupied, update(dt, t) { updWater(t); updZone(t); P.zone.update(t, ctx); }, built: layout.R, unit: 1,
    natives: { list: P.natives, rings: level + 1 }, grass: P.grass, ground, paintable };
}
