// 182 ④ 나의 뜰 (?yard): assembles the flat board (layout.js), its ground and, on the 'board' base (184 ④: the default), a toy
// play board: a wooden frame round the open land, the land still to come a pale tray floor, and a wooden tray under it all, in the
// colours of the UI's wooden shelf (src/ui183.css: --wood, --woodD, --cream; its inset white line as a cream bead). Matte, no
// grain. No props or natives of its own and no water to swim in: what stands here is the player's (habitat.js decor).
import * as THREE from 'three';
import * as layout from './layout.js';
import * as fine from './fine.js'; // 195 B-8 1-2 세밀 배치 (habitat.js, decor.js: habitat.fine)
import { scatterLayer } from './scatter.js';
import { buildBase, terrainMesh } from '../meadow/terrain.js';
import { decorModel } from '../meadow/props.js';
import { edgeOf } from '../zones.js';
import { toyMat, roundedBox } from '../toyKit.js';
import { mergeGeometries } from '../../../vendor/utils/BufferGeometryUtils.js';

const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const n2 = (x, z) => Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) * Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.3);
const CC = h => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
// 물 붓 (brush 11, terrain uPC.a, a texel per cell): pale shallow water with a wobbly edge, lighter at its rim, a faint ripple
const WATER = `
    { vec2 wq = vWp.xz / uU + (vec2(vnoise(vWp.xz * 1.1), vnoise(vWp.xz * 1.1 + 4.0)) - 0.5) * 0.45;
      if (texture2D(uPC, (wq - uPO) / uPN).a > 0.5) {
        float rim = 4.0 - texture2D(uPC, (wq + vec2(0.35, 0.0) - uPO) / uPN).a - texture2D(uPC, (wq - vec2(0.35, 0.0) - uPO) / uPN).a
          - texture2D(uPC, (wq + vec2(0.0, 0.35) - uPO) / uPN).a - texture2D(uPC, (wq - vec2(0.0, 0.35) - uPO) / uPN).a;
        float sh = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / LUM, 0.7, 1.1);
        vec3 w = mix(${CC('#5fa9c8')}, ${CC('#a9dcea')}, clamp(rim, 0.0, 1.0) * 0.8) * (0.96 + 0.08 * vnoise(vWp.xz * vec2(0.8, 3.0)));
        diffuseColor.rgb = w * sh; } }`;

// 209 A / 210: the open land's grain, no objects (the yard stays empty): faint soft patches a touch lighter (221 C ②: #fffbe0 -> #f3fade, less yellow, grass-ward) or deeper, and short
// blade streaks in two ways, patch by patch (no swirl), on the grass only (not the tray floor or rim outside O), drawn before the paint, the paths
// and the water so whatever the player paints covers it. No fade with distance (the meadow's near mottle fades out by 34 m).
const grain = O => `
    { float eo = min(min(vWp.x - ${O[0].toFixed(2)}, ${O[1].toFixed(2)} - vWp.x), min(vWp.z - ${O[2].toFixed(2)}, ${O[3].toFixed(2)} - vWp.z));
      float gm = smoothstep(-0.05, 0.3, eo);
      float m = vnoise(vWp.xz * 0.32) * 0.6 + vnoise(vWp.xz * 0.9 + 5.0) * 0.4;
      vec2 q1 = vec2(vWp.x * 0.94 + vWp.z * 0.34, vWp.z * 0.94 - vWp.x * 0.34), q2 = vec2(vWp.x * 0.6 - vWp.z * 0.8, vWp.z * 0.6 + vWp.x * 0.8);
      float bl = mix(vnoise(vec2(q1.x * 2.6, q1.y * 12.0)), vnoise(vec2(q2.x * 2.6, q2.y * 12.0) + 7.0), smoothstep(0.35, 0.65, vnoise(vWp.xz * 0.21 + 11.0)));
      float sp = step(0.86, vnoise(vWp.xz * 6.0 + 3.0));
      vec3 tint = mix(${CC('#e6f2dc')}, ${CC('#f3fade')}, smoothstep(0.3, 0.7, m)) * 1.04;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tint * (0.96 + 0.08 * bl - 0.04 * sp), gm); }`;

// UI183 --wood #c48d58, --wood2 #a8733f, --woodD #6e4626, --cream #fff6e2 (a shade deeper here: lit from above they read as the UI)
const WOOD = '#c48d58', WOOD2 = '#a8733f', WOODD = '#6e4626', CREAM = '#fff3dc', FLOOR = '#ead8b4';
// rounded boxes [w, h, d, r, x, y, z] merged into one mesh (one draw call a colour); the pieces let go once merged
function merged(scene, parts, color) {
  const gs = parts.map(([w, h, d, r, x, y, z]) => roundedBox(w, h, d, r, 2).translate(x, y, z)), g = mergeGeometries(gs);
  for (const x of gs) x.dispose();
  const m = new THREE.Mesh(g, toyMat(color, { roughness: 0.7 })); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
}
// the frame round the open land O: a rounded rail, a cream bead along its inner top edge, a dark lip at its foot (the shelf's
// 0 3px 0 --woodD); the rail's ends overlap at the corners as a toy tray's do
function frame(scene, O) {
  const T = 0.62, H = 0.42, B = 0.13, cx = (O[0] + O[1]) / 2, cz = (O[2] + O[3]) / 2, w = O[1] - O[0], d = O[3] - O[2];
  const rail = [[w + 2 * T, H, T, 0.16, cx, H / 2 - 0.03, O[2] - T / 2], [w + 2 * T, H, T, 0.16, cx, H / 2 - 0.03, O[3] + T / 2],
    [T, H, d, 0.16, O[0] - T / 2, H / 2 - 0.03, cz], [T, H, d, 0.16, O[1] + T / 2, H / 2 - 0.03, cz]];
  const bead = [[w + 2 * B, H + 0.05, B, 0.06, cx, H / 2 - 0.01, O[2] - B / 2 + 0.01], [w + 2 * B, H + 0.05, B, 0.06, cx, H / 2 - 0.01, O[3] + B / 2 - 0.01],
    [B, H + 0.05, d, 0.06, O[0] - B / 2 + 0.01, H / 2 - 0.01, cz], [B, H + 0.05, d, 0.06, O[1] + B / 2 - 0.01, H / 2 - 0.01, cz]];
  const L = T + 0.14, lip = [[w + 2 * L, 0.2, L, 0.08, cx, 0.06, O[2] - L / 2], [w + 2 * L, 0.2, L, 0.08, cx, 0.06, O[3] + L / 2],
    [L, 0.2, d, 0.08, O[0] - L / 2, 0.06, cz], [L, 0.2, d, 0.08, O[1] + L / 2, 0.06, cz]];
  return [merged(scene, rail, WOOD), merged(scene, bead, CREAM), merged(scene, lip, WOODD)];
}
// the tray under the board R (in place of the meadow's soil and stones): its wooden side, tucked under the ground's rounded
// shoulder, and a darker, wider foot
function tray(scene, r) {
  const bw = r[1] - r[0], bd = r[3] - r[2], cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
  merged(scene, [[bw + 0.06, 2.6, bd + 0.06, 0.3, cx, -1.45 - 1.3, cz]], WOOD2);
  merged(scene, [[bw + 0.7, 0.55, bd + 0.7, 0.24, cx, -4.05 - 0.27, cz]], WOODD);
}

export function buildYard(scene, ui, sunDir, level = 0, top = level) {
  layout.setLevel(level, top);
  const before = new Set(scene.children), O = layout.O, board = layout.BASE === 'board';
  if (board) tray(scene, layout.R); else buildBase(scene, layout.rand, false, layout.R);
  const C = s => new THREE.Color(s), g1 = C('#8fc653'), g2 = C('#a6d462'), g3 = C('#7fb64a'), haze = C('#c6d4ad'), floor = C(FLOOR), rim = C(WOOD);
  // the open land a fresh even grass; the closed ground paler as it goes out (meadow), or the tray's pale floor and wooden rim (board)
  const ground = terrainMesh(scene, layout.heightAt, layout.occupied, (col, x, z) => {
    const big = 0.5 + 0.5 * Math.sin(x * 0.21 + 0.7) * Math.cos(z * 0.17 - 0.4);
    col.copy(g1).lerp(g2, big * 0.7).lerp(g3, sm(n2(x, z) * 0.5 + 0.1) * 0.25).lerp(g2, sm(n2(x * 2.3 + 7, z * 2.3 - 3) * 0.5 + 0.5) * 0.18).lerp(g3, sm(n2(x * 4.7 - 2, z * 4.1 + 5) * 0.5 + 0.5) * 0.1); // two finer patches: the open land not one flat sheet
    const d = -edgeOf(O, x, z); // > 0: outside the open land
    if (d > 0) col.lerp(board ? floor : haze, board ? sm(d / 0.4) : 0.25 + 0.55 * sm(d / 9));
    if (board) col.lerp(rim, sm((1.3 - edgeOf(layout.R, x, z)) / 0.5)); // the tray's rounded rim (layout.js edgeRound: 1.2 m)
  }, layout.R, layout.S, { lum: 0.34, pre: grain(O), extra: WATER, k: 0.5 });
  if (board) frame(scene, O);
  const made = scene.children.filter(o => !before.has(o));
  const ctx = {
    scene, heightAt: layout.heightAt, walkable: layout.walkable, pathClear: layout.pathClear, bridgeEnds: [], deckAt: () => -Infinity,
    onSleepTick: ui.zzz, pond: null, water: -10, wet: () => false, waterSpot: () => null, shore: () => 0,
    shelter: [], perches: [], spawn: layout.spawn, spots: [], landing: [(O[0] + O[1]) / 2, (O[2] + O[3]) / 2 + 2],
  };
  const decor = { list: layout.decor, placeable: layout.placeable, model: decorModel, y: (x, z) => layout.heightAt(x, z) };
  return { ctx, decor, fine: { ...fine, scatterLayer }, floor: layout.heightAt, solid: layout.occupied, update() {}, built: layout.R, unit: layout.S, mistPad: board ? 1.5 : 0,
    natives: null, grass: [], ground, paintable: layout.paintable,
    dispose() { // 135 rule 5: what this board made (the shared prop models and the meadow's base stones' geometry cache aside)
      ground.dispose();
      for (const o of made) { scene.remove(o); o.traverse(m => { if (m === ground.mesh) return; m.geometry?.dispose(); for (const x of [m.material].flat()) { x?.map?.dispose(); x?.dispose(); } }); }
    } };
}
