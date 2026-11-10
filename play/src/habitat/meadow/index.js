// Meadow habitat: assembles props, terrain and water. Animals are the player's, placed by habitat.js.
import * as layout from './layout.js';
import { buildTerrain } from './terrain.js';
import { buildWater, zoneWater } from './water.js';
import { inRect } from '../zones.js';
import { buildProps, decorModel } from './props.js';

// level: 땅 넓히기 step (21-3b), top: the step whose band is built round it, under mist
export function buildMeadow(scene, ui, sunDir, level = 0, top = level) {
  layout.setLevel(level, top); // the board's size; the lists below start empty
  const P = buildProps(scene), ground = buildTerrain(scene); // props fill layout.occupied (terrain bakes contact shadows from it, animals avoid it)
  const updWater = buildWater(scene, sunDir), updZone = zoneWater(scene, sunDir, layout.heightAt, layout.Z); // 28-1: the zones' pools, rills and falls

  // everything an animal behaviour (src/animals/<move>.js) may ask of the habitat
  const ctx = {
    scene, heightAt: layout.heightAt, walkable: layout.walkable, pathClear: layout.pathClear, bridgeEnds: layout.bridgeEnds, deckAt: layout.deckAt,
    onSleepTick: ui.zzz, pond: layout.pond, water: layout.WATER_Y + 0.04, shelter: layout.occupied.filter(o => o.h >= 3 && o.z > -22), // 21-2: trees and roofs for the rain (walk.js)
    spawn: () => { const O = layout.O; for (let k = 0; ; k++) { const x = O[0] + 3 + Math.random() * (O[1] - O[0] - 6), z = -20 + Math.random() * (O[3] - 23); if (layout.walkable(x, z) || k > 200) return [x, z]; } },
    spots: layout.Z.spots.filter(s => s.k <= level), // 28-1: the open zones' spots (walk.js)
  };
  // 서식지 꾸미기: the placed props (layout.decor), where one may stand, its look, how high it sits
  const decor = { list: layout.decor, placeable: layout.placeable, model: decorModel, y: (x, z, water) => water ? ctx.water : layout.heightAt(x, z) };
  // the camera's floor (ground, water, bridge deck) and the props it keeps out of (habitat.js guard)
  const floor = (x, z) => Math.max(layout.heightAt(x, z), layout.waterY(z), layout.deckAt(x, z));
  // built: the board as built, [x0, x1, z0, z1] (28-1); unit: saved decor x, z -> here (habitat.js)
  // 22-1: natives: the trees, bushes, rocks and flowers the board came with, for the save (rings: the 땅 넓히기 steps built
  // open), grass: the clumps habitat.js hides under them, ground: terrain.js's paint, paintable: where 땅 칠하기 may paint
  // (open grass: off the water, the back shelf and the board's rim)
  const paintable = (x, z) => inRect(layout.O, x, z, 0.5) && z > layout.CLIFF_Z + 0.6 && layout.Z.wd(x, z, true) > 0.2
    && layout.dist2D(layout.sPts, x, z) > layout.SW + 0.2 && Math.hypot(x - layout.pond.x, z - layout.pond.z) > layout.pond.r + 0.2;
  return { ctx, decor, floor, solid: layout.occupied, update(dt, t) { updWater(t); updZone(t); P.zone.update(t, ctx); }, built: layout.R, unit: 1,
    natives: { list: P.natives, rings: level + 1 }, grass: P.grass, ground, paintable };
}
