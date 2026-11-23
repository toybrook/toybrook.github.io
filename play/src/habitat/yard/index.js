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
import { X230, FEST, YD247 } from '../../game/data.js';
import { $t } from '../../i18n/i18n.js';
// 230 C3 theme drafts · 230 C4 festival mockup: loaded only under ?x230 / ?fest (243 A Q3: both files left out of the build)
const { fest230 } = X230 ? await import('./fest230.js') : {};
if (X230 || FEST) await import('./props230.js');
import { edgeOf } from '../zones.js';
import { toyMat, roundedBox, instanced, snowTop, skyLit } from '../toyKit.js';
import { QUALITY } from '../../config.js';
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

const g1 = new THREE.Color('#8fc653'), g2 = new THREE.Color('#a6d462'), g3 = new THREE.Color('#7fb64a'), _w = new THREE.Color(), _l = new THREE.Color();
function grassAt(col, x, z) { // the open land's grass at x, z: a fresh even green, a few broad patches
  const big = 0.5 + 0.5 * Math.sin(x * 0.21 + 0.7) * Math.cos(z * 0.17 - 0.4);
  return col.copy(g1).lerp(g2, big * 0.7).lerp(g3, sm(n2(x, z) * 0.5 + 0.1) * 0.25).lerp(g2, sm(n2(x * 2.3 + 7, z * 2.3 - 3) * 0.5 + 0.5) * 0.18).lerp(g3, sm(n2(x * 4.7 - 2, z * 4.1 + 5) * 0.5 + 0.5) * 0.1); // two finer patches: the open land not one flat sheet
}
// 249 A: the land not opened yet, the grass faded: half way to its own grey, and darker
const WILD_GREY = 0.5, WILD_DARK = 0.8;
const wild = c => { const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return c.lerp(_l.setRGB(l, l, l), WILD_GREY).multiplyScalar(WILD_DARK); };
// 249 A (?yd247): past the board the land runs on, not a tray on a table: a ring of the same faded grass round R (from under the
// board's rounded shoulder, layout.js edgeRound 1.2 m: no seam, no cut), rising into low hills further out and paler with
// distance, and a few round trees on it. Two draw calls, no shadows; disposed with the board (buildYard's made)
const FAR = new THREE.Color('#d3d6b8'), AMB = 'vec3(2.8, 2.8, 3.0)'; // 250 A: the ring's ambient (a little blue: the sky), matched on screen to 249 A's standard material (noon, far view)
// 250 A: Lambert (half the screen at full pixel ratio: no GGX, no env map); the env map's ambient put back as AMB x the hour's light (skyLit)
function ringMat(o) {
  const mat = new THREE.MeshLambertMaterial(o);
  mat.onBeforeCompile = sh => { snowTop(sh); sh.uniforms.uAmb = skyLit; // 15-2 첫눈 on it too
    sh.fragmentShader = 'uniform vec3 uAmb;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse += ${AMB} * uAmb * BRDF_Lambert(diffuseColor.rgb);`); };
  return mat;
}
// 251 A: 낮음 (no ring, no trees): one flat floor of the ring's first colour from under the board's shoulder (where the ring starts)
// out 300 m, so the board does not float. One draw call; disposed with the board (buildYard's made)
function flat(scene, R) {
  const I = R.map((v, i) => v + (i % 2 ? -1.2 : 1.2)), E = 300, V = (x, z) => new THREE.Vector2(x, -z); // the shape's y is -z (laid down below)
  const s = new THREE.Shape([V(I[0] - E, I[2] - E), V(I[1] + E, I[2] - E), V(I[1] + E, I[3] + E), V(I[0] - E, I[3] + E)]);
  s.holes.push(new THREE.Path([V(I[0], I[2]), V(I[0], I[3]), V(I[1], I[3]), V(I[1], I[2])]));
  scene.add(new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), ringMat({ color: wild(grassAt(new THREE.Color(), 0, 0)) })));
}
function beyond(scene, R) {
  const I = R.map((v, i) => v + (i % 2 ? -1.2 : 1.2)), n = 24, K = 4 * n, c = new THREE.Color();
  const E = [0, 1.5, 3.5, 6, 9, 13, 18, 24, 32, 42, 55, 72, 95, 125, 165, 215, 280]; // ring offsets (m) past I (250 A: to 280, the camera's far is 300)
  const hill = (x, z, e) => sm((e - 14) / 70) * (3 + 9 * (0.5 + 0.5 * Math.sin(x * 0.033 + 1.3) * Math.cos(z * 0.029 - 0.6)));
  const at = (e, side, s) => { const x0 = I[0] - e, x1 = I[1] + e, z0 = I[2] - e, z1 = I[3] + e;
    return side === 0 ? [x0 + (x1 - x0) * s, z0] : side === 1 ? [x1, z0 + (z1 - z0) * s] : side === 2 ? [x1 - (x1 - x0) * s, z1] : [x0, z1 - (z1 - z0) * s]; };
  const pos = [], cols = [], idx = [];
  for (const e of E) for (let k = 0; k < K; k++) { const [x, z] = at(e, k / n | 0, k % n / n);
    pos.push(x, hill(x, z, e), z); wild(grassAt(c, x, z)).lerp(FAR, sm((e - 30) / 300) * 0.75); cols.push(c.r, c.g, c.b); }
  for (let j = 0; j < E.length - 1; j++) for (let k = 0; k < K; k++) { const a = j * K + k, b = j * K + (k + 1) % K; idx.push(a, b, a + K, b, b + K, a + K); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, ringMat({ color: '#ffffff', vertexColors: true })));
  // round trees: a trunk and a ball, merged with their colours, one instanced mesh; none close in front (the view comes from +z)
  const paint = (geo, hex) => { const cc = new THREE.Color(hex), a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([cc.r, cc.g, cc.b], i); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const parts = [paint(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 7).translate(0, 0.65, 0), '#7c6247'), paint(new THREE.SphereGeometry(1, 12, 9).scale(1, 1.15, 1).translate(0, 1.95, 0), '#6d8a57')];
  const tg = mergeGeometries(parts); for (const p of parts) p.dispose();
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, trees = [];
  for (let i = 0; i < 60; i++) { const side = rnd() * 4 | 0, e = Math.max(side === 2 ? 45 : 4, 4 + 80 * rnd() ** 1.8), [x, z] = at(e, side, rnd()), s = 1.6 + 2.2 * rnd();
    trees.push({ x, y: hill(x, z, e) - 0.1, z, s, ry: rnd() * 6.3, c: new THREE.Color().setHSL(0, 0, 0.85 + 0.15 * rnd()).getHex() }); }
  const tm = toyMat('#ffffff', { vertexColors: true, roughness: 0.8 }); tm.onBeforeCompile = snowTop;
  scene.add(instanced(tg, tm, trees, { cast: false, receive: false }));
}
// 247 A4 (?yd247): the next step's land (N past O) shown: low pegs round it, one instanced mesh, and 「다음에 넓힐 땅」 lying on its
// front strip (canvas text: one draw call). None at the last step
function nextLand(scene, O, N) {
  if (N.every((v, i) => v === O[i])) return;
  const at = [], w = N[1] - N[0], d = N[3] - N[2], n = Math.round(2 * (w + d) / 1.5);
  for (let i = 0; i < n; i++) { let s = i * 2 * (w + d) / n; const p = s < w ? [N[0] + s, N[2]] : (s -= w) < d ? [N[1], N[2] + s] : (s -= d) < w ? [N[1] - s, N[3]] : [N[0], N[3] - (s - w)];
    if (Math.abs(edgeOf(O, ...p)) > 0.8) at.push(p); } // not on the frame (a side the step does not move)
  const pegs = new THREE.InstancedMesh(roundedBox(0.26, 0.6, 0.26, 0.08, 2), toyMat(WOOD, { roughness: 0.7 }), at.length), m4 = new THREE.Matrix4();
  at.forEach(([x, z], i) => pegs.setMatrixAt(i, m4.makeTranslation(x, layout.heightAt(x, z) + 0.26, z))); pegs.castShadow = true; scene.add(pegs);
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 1024; c.height = 160;
  g.font = '600 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = WOODD; g.fillText($t('다음에 넓힐 땅'), 512, 84, 1000); // E-7 (bundle 2): moved to $t / en.js / ja.js now that it ships (247 A kept it here while a trial)
  const tw = Math.min(14, w - 3), label = new THREE.Mesh(new THREE.PlaneGeometry(tw, tw * 160 / 1024), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.8, depthWrite: false }));
  label.material.map.colorSpace = THREE.SRGBColorSpace; label.rotation.x = -Math.PI / 2; label.position.set((N[0] + N[1]) / 2, 0.06, (O[3] + N[3]) / 2); scene.add(label);
}
export function buildYard(scene, ui, sunDir, level = 0, top = level) {
  layout.setLevel(level, top);
  const before = new Set(scene.children), O = layout.O, board = layout.BASE === 'board', far = board && YD247; // 249 A: the land runs on past the board
  if (far) { if (QUALITY.gfx !== 'low') beyond(scene, layout.R); else flat(scene, layout.R); } else if (board) tray(scene, layout.R); else buildBase(scene, layout.rand, false, layout.R); // 250 A: 낮음: no ring, no trees (251 A: a flat floor)
  const C = s => new THREE.Color(s), haze = C('#c6d4ad'), floor = C(FLOOR), rim = C(WOOD);
  // the open land a fresh even grass; the closed ground paler as it goes out (meadow), or the tray's pale floor and wooden rim (board),
  // or (249 A, ?yd247) the same grass faded: duller and darker, the land not opened yet
  const ground = terrainMesh(scene, layout.heightAt, layout.occupied, (col, x, z) => {
    grassAt(col, x, z);
    const d = -edgeOf(O, x, z); // > 0: outside the open land
    if (far) { if (d > 0) col.lerp(wild(_w.copy(col)), sm(d / 0.4)); return; }
    if (d > 0) col.lerp(board ? floor : haze, board ? sm(d / 0.4) : 0.25 + 0.55 * sm(d / 9));
    if (board) col.lerp(rim, sm((1.3 - edgeOf(layout.R, x, z)) / 0.5)); // the tray's rounded rim (layout.js edgeRound: 1.2 m)
  }, layout.R, layout.S, { lum: 0.34, pre: grain(O), extra: WATER, k: 0.5 });
  if (board) frame(scene, O);
  if (far) nextLand(scene, O, layout.N);
  const made = scene.children.filter(o => !before.has(o)), fest = fest230?.(scene, O);
  const ctx = {
    scene, heightAt: layout.heightAt, walkable: layout.walkable, pathClear: layout.pathClear, bridgeEnds: [], deckAt: () => -Infinity,
    onSleepTick: ui.zzz, pond: null, water: -10, wet: () => false, waterSpot: () => null, shore: () => 0,
    shelter: [], perches: [], spawn: layout.spawn, spots: [], landing: [(O[0] + O[1]) / 2, (O[2] + O[3]) / 2 + 2],
  };
  const decor = { list: layout.decor, placeable: layout.placeable, model: decorModel, y: (x, z) => layout.heightAt(x, z) };
  return { ctx, decor, fine: { ...fine, scatterLayer }, floor: layout.heightAt, solid: layout.occupied, update(dt, t) { fest?.update(dt, t); if (fest?.shaded()) ctx.shade = true; }, built: layout.R, unit: layout.S, mistPad: board ? 1.5 : 0,
    natives: null, grass: [], ground, paintable: layout.paintable,
    dispose() { // 135 rule 5: what this board made (the shared prop models and the meadow's base stones' geometry cache aside)
      ground.dispose(); fest?.dispose();
      for (const o of made) { scene.remove(o); o.traverse(m => { if (m === ground.mesh) return; if (m.isInstancedMesh) m.dispose(); m.geometry?.dispose(); for (const x of [m.material].flat()) { x?.map?.dispose(); x?.dispose(); } }); }
    } };
}
