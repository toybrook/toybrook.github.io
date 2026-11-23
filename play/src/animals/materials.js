// Variant looks, each written once and keyed by the ids data.js uses (SHARED_VARIANTS and `extra` ids, legendary
// `mat`, RARITIES[].egg.mat), and painted in one of the variant's colours (data.js `colors` / a species' `palette`).
// One material set per look + colour, shared by every species: 유리 맑은 on a duck and on a horse is the same
// material and shader. Only commons also take the species' own accent / hoof colours.
// Patterns are in object space: the _op attribute (position / figure height, x centred; set by figure.js and
// growth.js), so they need no UVs, run on from body to legs, and fall the same way on any body.
// Every mesh that wears one of these goes through wear(mesh) (fake glass needs a per-draw hook).
import * as THREE from 'three';
import { toyMat, windTime, nightGlow } from '../habitat/toyKit.js';
import { QUALITY } from '../config.js';
import { SHARED_VARIANTS, X230 } from '../game/data.js';
import { SP, RAR, variantOf, colorOf } from '../game/rules.js';
import { mergeGeometries, mergeVertices } from '../../vendor/utils/BufferGeometryUtils.js';

export const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });

// { body, accent, hoof } of a species' variant in colour cId (none or unknown = its first colour).
// A legendary's look is its `mat`, any other variant's its id. over: look id -> the look to wear instead (84: MODELS meshy, on a Meshy body),
export function variantMats(spId, vId, cId, over) {
  const v = variantOf(spId, vId), c = colorOf(spId, vId, cId), id = v?.mat || v?.id || 'solid', o = over?.[id];
  return looks(o ?? id, v?.rarity === 'common' ? { ...SP[spId].colors, ...c } : c ?? {});
}
// 82: a common on a body with its own texture (the Meshy figures, data.js meshyStages): the texture as it is, the commons' plastic
const painted = new WeakMap();
export const texBody = map => { if (!painted.has(map)) { const m = toyMat('#ffffff', { map }); rim(m); painted.set(map, m); } return painted.get(map); };
// 86-1: a common on a Meshy body painted with patches (MODELS patches: the cow): its texture's base wears the variant's own common
// look (colour and pattern, as on every body), the brown patches its accent (as the SDF cow's patch mesh did; where and what shape
// as painted), the pink nose and inner ears as painted; the texture's own light and dark kept on both. Linear texels: brown has
// almost no blue for its green (cream and pink about 0.8), pink little green for its red (cream 0.77)
const patchedBy = new WeakMap();
export function patched(map, m) {
  if (!patchedBy.has(m.body)) {
    const c = m.body.clone(), prev = m.body.onBeforeCompile, k = m.body.customProgramCacheKey(), u = { value: m.accent.color };
    c.userData = m.body.userData; c.map = map;
    c.onBeforeCompile = (sh, r) => { prev.call(c, sh, r); sh.uniforms.uPatch = u;
      sh.fragmentShader = 'uniform vec3 uPatch;\n' + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 tx = texture2D(map, vMapUv);').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float L = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722)), s = 1.0 - smoothstep(0.25, 0.6, tx.b / max(tx.g, 1e-4)), pk = (1.0 - s) * (1.0 - smoothstep(0.5, 0.65, tx.g / max(tx.r, 1e-4)));
  diffuseColor.rgb = mix(mix(diffuseColor.rgb * min(L / 0.65, 1.15), uPatch * min(L / 0.085, 1.5), s), tx.rgb, pk); }`); };
    c.customProgramCacheKey = () => k + '-patch';
    patchedBy.set(m.body, c);
  }
  return patchedBy.get(m.body);
}
// 84: a non-common look on a Meshy body: its scanned normals turn past the silhouette in the creases, and the looks' edge
// terms draw a dotted dark outline there: a clone that turns those normals back to face the eye a little (the SDF figures
// sharing the look keep theirs)
const meshied = new WeakMap();
export function meshyMat(m) {
  if (!meshied.has(m)) {
    const c = m.clone(), prev = m.onBeforeCompile, k = m.customProgramCacheKey();
    c.userData = m.userData; // onDraw / order (clone() would JSON-copy and drop the functions)
    c.onBeforeCompile = (sh, r) => { prev.call(c, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
{ vec3 vdF = normalize(vViewPosition); float dF = dot(normal, vdF); if (dF < 0.15) { normal = normalize(normal + vdF * (0.15 - dF)); nonPerturbedNormal = normal; } }`); };
    c.customProgramCacheKey = () => k + '-meshy';
    if (clearMats.includes(m)) clearMats.push(c); // glassLite drops its refraction too
    meshied.set(m, c);
  }
  return meshied.get(m);
}
// the body material of an egg of this rarity (its own colours, else the first colour of that look)
export const eggMat = rarity => { const e = RAR[rarity].egg; return looks(e.mat, e.colors ?? SHARED_VARIANTS.find(v => v.id === e.mat)?.colors?.[0]).body; };

const cache = new Map();
function looks(id, colors = {}) {
  if (!LOOKS[id]) { console.warn(`no material "${id}" yet, using gold`); id = 'gold'; }
  const k = id + JSON.stringify(colors);
  if (!cache.has(k)) { const set = LOOKS[id](colors); for (const m of Object.values(set)) { lift154(m, DARK154[id + '.' + colors.id]); rim(m); } cache.set(k, set); }
  return cache.get(k);
}
// 154 E: the shared looks' darkest colours (eye vs the body round it under 1.5 : 1 on the hatch card) read as a black blob
// in the nest's and codex's studio light: a little light of their own (a floor and a soft edge band in the body's own hue,
// a velvet-like sheen), so the black eyes and the outline show. Only these sets: every other colour keeps its program.
// [floor, more as it turns away, the edge band]: velvet the full band (its fuzz catching the light), the others a floor and a faint edge
// (black chrome less, a mirror; burgundy less, it has its own red). Dimmed by night in the habitat only (HAB89): the nest and the codex
// draw in the studio's light whatever the hour (nightGlow is the habitat's)
const V154 = [0.026, 0.02, 0.3], O154 = [0.032, 0.04, 0.12];
const DARK154 = { 'velvet.wine': V154, 'velvet.green': V154, 'velvet.navy': V154, 'chrome.black': [0.024, 0.03, 0.12], 'leather.burgundy': [0.014, 0.03, 0.1],
  'leather.black': O154, 'xstitch.gold': O154 };
const lifted = new WeakSet();
function lift154(m, w) {
  if (!w || !m?.isMaterial || lifted.has(m)) return; lifted.add(m); const [a, b, c] = w.map(x => x.toFixed(3));
  const prev = m.onBeforeCompile, k0 = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r); sh.uniforms.uHab154 = HAB89; sh.fragmentShader = 'uniform float uHab154;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float e5 = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); vec3 c5 = mix(diffuseColor.rgb / max(max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), 0.02), vec3(1.0), 0.2);
  totalEmissiveRadiance += c5 / max(dot(c5, vec3(0.2126, 0.7152, 0.0722)), 0.4) * (${a} + ${b} * e5 + ${c} * e5 * e5 * e5) * (1.0 - 0.7 * uNight * uHab154); }`);
  };
  m.customProgramCacheKey = () => k0 + '-lift154-' + w.join('-');
}
// inbox 63: a very faint light rim (fresnel) seen from far, so a figure reads on the wide board. habitat.js sets RIM.value
// round its own render only (0 near and for every other render: thumbs, the nest). A look whose shader has no lit end skips it.
export const RIM = { value: 0 };
const rimmed = new WeakSet();
function rim(m) {
  if (!m?.isMaterial || rimmed.has(m)) return; rimmed.add(m);
  const prev = m.onBeforeCompile, k0 = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r); sh.uniforms.uRim = RIM; const f = sh.fragmentShader;
    if (!f.includes('#include <dithering_fragment>') || !f.includes('vViewPosition')) return;
    sh.fragmentShader = 'uniform float uRim;\n' + f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uRim > 0.0) { float rn = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); gl_FragColor.rgb += uRim * rn * rn * rn * vec3(1.0, 0.97, 0.88); }');
  };
  m.customProgramCacheKey = () => k0 + '-rim';
}

// Put a figure mesh on screen with its material's needs: fake glass grabs the screen right before
// its first draw of the frame, and draws after every other figure so glass shows them behind it.
export function wear(mesh, renderOrder = 2) {
  const hook = mesh.material.userData.onDraw;
  mesh.renderOrder = mesh.material.userData.order ?? (hook ? renderOrder + 1 : renderOrder); // order: a material that must draw at its own place (71-2 BONE)
  if (hook) mesh.onBeforeRender = hook;
  return mesh;
}

// ---- shader plumbing: every look is a few lines of GLSL run after the normal is known, with
// p = _op (pattern space) and on = object normal; they may change diffuseColor, roughnessFactor, normal, totalEmissiveRadiance.
const GLSL3 = `
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm3(vec3 p) { return 0.5 * vn3(p) + 0.25 * vn3(p * 2.03 + 1.7) + 0.125 * vn3(p * 4.01 + 3.1) + 0.0625 * vn3(p * 8.1 + 5.3); }
// cells: x = distance to the nearest point, y = to the second nearest, z = a random number for the nearest cell
vec3 cells(vec3 p) { vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z), r = o + h33(i + o) * 0.85 + 0.075 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h31(i + o + 0.5); } else if (d < d2) d2 = d; }
  return vec3(sqrt(d1), sqrt(d2), id); }
// offset to the nearest cell point (the slope of a shallow dimple centred there)
vec3 dimple(vec3 p) { vec3 i = floor(p), f = fract(p), best = vec3(9.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 o = vec3(x, y, z), d = o + h33(i + o) * 0.8 + 0.1 - f; if (dot(d, d) < dot(best, best)) best = d; }
  return best; }
// view-dependent rainbow, for shell, pearl and soap film
vec3 rainbow(float h) { return 0.5 + 0.5 * cos(6.2832 * (h + vec3(0.0, 0.33, 0.67))); }
`;
const opVaryings = sh => {
  sh.vertexShader = 'attribute vec3 _op;\nvarying vec3 vOp;\nvarying vec3 vOn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp = _op; vOn = normal;');
  sh.fragmentShader = 'varying vec3 vOp;\nvarying vec3 vOn;\n' + sh.fragmentShader;
};
// uniforms from { name: '#hex' (a colour) | number | texture }, and their GLSL declarations
const uniformsOf = uniforms => {
  const u = Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, { value: typeof v === 'string' ? new THREE.Color(v) : v }]));
  return { u, decl: Object.entries(u).map(([k, { value: v }]) => `uniform ${v.isColor ? 'vec3' : v.isTexture ? 'sampler2D' : 'float'} ${k};\n`).join('') };
};
// m gets the GLSL `body` (and uniforms). key = one shader program per look: the same key must always mean the same GLSL.
// o.studio (0..1): how much of the reflection is the photo studio's (STUDIO) instead of the habitat sky's; the body may
// change it per pixel (lookStudio). Polished metal needs it: the sky env is soft and even, so gold in it reads as flat yellow.
function look(m, key, body, uniforms = {}, o = {}) {
  const { u, decl } = uniformsOf(uniforms), pale = m.userData.pale, st = o.studio != null, nk = NIGHT_LOOK[key];
  m.onBeforeCompile = sh => {
    if (pale) unGreen(sh);
    opVaryings(sh); Object.assign(sh.uniforms, u, { uTime: windTime, uNight: nightGlow });
    let f = sh.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n{ vec3 p = vOp, on = normalize(vOn), vdir = normalize(vViewPosition); float nv = clamp(dot(normal, vdir), 0.0, 1.0);\n${body}\n${typeof nk === 'string' ? nk : nk ? `totalEmissiveRadiance *= 1.0 + uNight * ${nk.toFixed(2)};` : ''}\n}`);
    if (st) f = f.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + STUDIO_MIX);
    sh.fragmentShader = 'uniform mat3 normalMatrix;\nuniform float uTime;\nuniform float uNight;\n' + decl + GLSL3 + (st ? STUDIO + `float lookStudio = ${o.studio.toFixed(2)};\n` : '') + f;
  };
  m.customProgramCacheKey = () => 'look-' + key + (pale ? '-pale' : '') + (st ? '-s' + o.studio.toFixed(2) : '');
  return m;
}
// 스튜디오 반사: a photo studio round the figure, in world directions: a grey floor that lightens toward the horizon,
// a dark band just above it, a big bright softbox overhead and two upright strip lights (warm key, cool fill). Mirrors
// pick its edges up as crisp light / dark lines that slide over the body as it turns.
const STUDIO = `vec3 studioEnv(vec3 r) {
  vec3 c = mix(vec3(0.1, 0.095, 0.09), vec3(0.55, 0.52, 0.48), smoothstep(-0.7, 0.0, r.y));
  c *= 1.0 - 0.8 * smoothstep(0.02, 0.1, r.y) * (1.0 - smoothstep(0.25, 0.45, r.y));
  c += vec3(3.2, 3.1, 2.9) * smoothstep(0.55, 0.75, r.y);
  vec2 h = normalize(r.xz + vec2(1e-4)); float up = smoothstep(-0.25, -0.05, r.y) * (1.0 - smoothstep(0.45, 0.6, r.y));
  c += vec3(2.6, 2.4, 2.1) * smoothstep(0.93, 0.97, dot(h, normalize(vec2(0.75, 0.6)))) * up;
  c += vec3(1.1, 1.25, 1.5) * smoothstep(0.95, 0.98, dot(h, normalize(vec2(-0.8, -0.5)))) * up;
  return c; }
`;
const STUDIO_MIX = `{ radiance = mix(radiance, studioEnv(inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix)), lookStudio);
#ifdef USE_CLEARCOAT
  clearcoatRadiance = mix(clearcoatRadiance, studioEnv(inverseTransformDirection(reflect(-geometryViewDir, geometryClearcoatNormal), viewMatrix)), lookStudio);
#endif
}`;
// 흰 몸 (19-1): white shows every tint of the light it gets, and the sky env's lower half is grass green (toyKit
// makeSkyEnv), so a sheep's or a cow's belly read green. A body this pale (every sRGB channel above 0.82) takes most
// of the colour out of its ambient light; the warm sun still lights it. The habitats' lighting is not changed.
const unGreen = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>',
  '#include <lights_fragment_maps>\niblIrradiance = mix(iblIrradiance, vec3(dot(iblIrradiance, vec3(0.3, 0.59, 0.11))), 0.8);'); };
const toyBody = hex => {
  const m = toyMat(hex);
  if ([1, 3, 5].every(i => parseInt(hex.slice(i, i + 2), 16) > 209)) { m.userData.pale = true; m.onBeforeCompile = unGreen; m.customProgramCacheKey = () => 'pale'; }
  return m;
};
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, ...o });
const plain = (body, c) => ({ body, accent: toyMat(c.accent), hoof: toyMat(c.hoof || c.accent), beak: c.beak && toyMat(c.beak), horn: c.horn && toyMat(c.horn),
  nostril: c.nostril && toyMat(c.nostril), ...Object.fromEntries(Object.entries(c.paint || {}).map(([k, v]) => [k, toyMat(v)])) }); // paint: MODELS' paints layers (figure.js)
const same = m => ({ body: m, accent: m, hoof: m });
// how much the sun faces this point (0 with no sun): GLSL lines, `normal` is the view-space normal
const SUN = `float sun = 0.0;
#if NUM_DIR_LIGHTS > 0
  sun = max(dot(normal, directionalLights[0].direction), 0.0);
#endif
`;

// ---- 일반: the scenery's plastic (toyKit) in the colour's `body`; the pattern is painted in `second` ----
const TWOTONE = `float e = 0.36 + 0.025 * sin(p.x * 14.0) + 0.02 * sin(p.z * 11.0 + 1.0), w = fwidth(p.y) + 0.003;
  diffuseColor.rgb = mix(uSecond, diffuseColor.rgb, smoothstep(e - w, e + w, p.y));`; // the lower part, with a soft wave in the edge
const SPOTS = `vec3 c = cells(p * 6.0 + 3.1); float r = 0.26 + 0.12 * c.z, w = fwidth(c.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSecond, step(0.22, c.z) * (1.0 - smoothstep(r - w, r + w, c.x)));`; // round spots, a few cells left plain
const STRIPES = `float u = (p.x + 0.55 * p.y) * 5.0 + 0.45 * vn3(p * 2.6 + 1.3), s = abs(fract(u) - 0.5) * 2.0, w = fwidth(u) * 2.0 + 0.01;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSecond, 1.0 - smoothstep(0.38 - w, 0.38 + w, s));`; // slanted bands: across a body, round a leg
// 그라데이션: `body` at the top running smoothly into `second` at the feet; lit like 단색
const GRADIENT = `diffuseColor.rgb = mix(uSecond, diffuseColor.rgb, smoothstep(0.05, 0.95, p.y));`;

// ---- 희귀 ----
// Clear materials (유리, 젤리, 글리터 레진, 비눗방울 펄, 스테인드글라스). Light left after passing through is
// tint^thickness (per-vertex _thickness, baked by tools/sdf-bake.mjs). Two ways to see through, picked by QUALITY.glass:
//  fake (default): copy the screen once, right before the first clear draw of the frame, and sample it bent by the normal.
//  real: three.js transmission, which renders every opaque object a second time into a buffer (plain tinted glass:
//        the pre/post patterns below are fake-mode only).
// The shape is carried by the edge, not the colour: a bright Fresnel rim on the outline, and just inside it a dark
// band where real glass bends the view away. Both are measured by s = sin(angle to the view), which runs 0 -> 1 from
// the middle to the outline, so they keep their share of the figure at any zoom. The bend is in world units (vRefr
// turns it into screen uv), so a far figure only shows what is right behind it.
// pre: GLSL that may set `tint` / `inner` per pixel; post: GLSL that may change gl_FragColor. Both see p (= _op),
// rd (the view ray in pattern space, pointing into the body), vn, nv, fr, bg (the scene behind), pass, rim.
// nrm: GLSL run once the normal is known (sees vOp, may tilt `normal`: cut facets bend both the light and the view).
const SKY = 'vec3(0.97, 0.88, 0.75)'; // the page gradient behind a transparent canvas (tools pages), where the copy is empty
// 21-1 밤 발광: by night (nightGlow, daylight.js; the cabinet's and codex's 밤에 보기) these looks glow more; the rest stay as
// they are (commons, clear glass, plain jelly, glazes, metals). look(): its own emissive x (1 + night x K), or its own GLSL. clear(): added
// after its post, in screen colour (the scene seen through them is dark at night, so they would go dark with it)
const NIGHT_LOOK = { glow: 1.2, najeon: 0.8, pearl: 0.8, galaxy: 0.8, jade: 1.0, fortune: 0.6, cotton: 0.8, opal: 1.0, cowopal: 1.0, palejade: 1.2, coral: 0.8,
  moonstone: 1.2, frost: 1.0, yuzu: 0.8, dawn: 1.0, aurora: 1.2, glacier: 0.8, moonpearl: 1.0, starlight: 1.0, lantern: 1.5, snowspirit: 1.0,
  lava: 0.8, lavacrystal: 0.8, malachite: 1.0, sunstone: 1.0, storm: 1.0, amber86: 1.0, // dino legendaries (71-2, 86-2)
  // (GLSL instead of K: its own glow is too faint to scale; by night its silver ripples and rim light up)
  moonwater: 'totalEmissiveRadiance = totalEmissiveRadiance * (1.0 + uNight * 1.5) + uNight * (vec3(0.7, 0.78, 1.0) * rip * 0.45 + uBase * 0.9 * pow(1.0 - nv, 2.0));' };
const AMBER_NIGHT = 'gl_FragColor.rgb += uNight * 0.7 * uTint * (0.3 + 0.7 * nv) * (1.0 - fr);', CRYSTAL_NIGHT = 'gl_FragColor.rgb += uNight * vec3(0.55, 0.75, 1.0) * (0.12 + 0.3 * pow(nv, 2.0)) * (1.0 - fr);';
const AMETHYST_NIGHT = 'gl_FragColor.rgb += uNight * vec3(0.5, 0.25, 1.0) * (0.12 + 0.3 * pow(nv, 2.0)) * (1.0 - fr);';
const NIGHT_CLEAR = {
  stained: 'gl_FragColor.rgb += uNight * 0.5 * pane * (0.5 + 0.5 * (1.0 - nv)) * (1.0 - lead) * (1.0 - fr);', // the panes like a lit window, the lead stays dark
  bubble: 'gl_FragColor.rgb += uNight * (film * 0.18 + 0.08) * (0.3 + 0.7 * pow(1.0 - nv, 1.5));',
  glitter: 'gl_FragColor.rgb += uNight * 0.8 * gs * (1.0 - fr);',
  amber: AMBER_NIGHT, honey: AMBER_NIGHT, crystal: CRYSTAL_NIGHT, crystalwing: CRYSTAL_NIGHT,
  amberbone: AMBER_NIGHT, nebula: 'gl_FragColor.rgb += uNight * vec3(0.25, 0.18, 0.7) * (0.2 + 0.4 * nv) * (1.0 - fr);', // 71-2
  amethyst: AMETHYST_NIGHT, amethystgem: AMETHYST_NIGHT, lavagem: 'gl_FragColor.rgb += uNight * vec3(1.0, 0.36, 0.05) * (0.15 + 0.3 * pow(nv, 2.0)) * (1.0 - fr);',
};
const clearMats = [];
// bend: how far the view bends (x (1 + thickness)); rimK: the white outline's strength
function clear({ key, tint, absorb = 1.6, inner = '#000000', dark = 0.62, color = '#000000', rough = 0.08, coat = 0, neutral = 0, pre = '', post = '', nrm = '', uniforms = {}, extra = {}, bend = 0.12, rimK = 0.75 }) {
  const T = new THREE.Color(tint), I = new THREE.Color(inner), C = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: rough, metalness: 0, ior: 1.5, specularIntensity: 1, clearcoat: coat, clearcoatRoughness: 0.08, ...extra });
  const thick = sh => {
    sh.vertexShader = 'attribute float _thickness;\nattribute vec3 _op;\nvarying float vThick;\nvarying vec3 vOp;\nvarying vec3 vRay;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvThick = _thickness; vOp = _op; vRay = inverse(mat3(modelMatrix)) * ((modelMatrix * vec4(transformed, 1.0)).xyz - cameraPosition);');
    sh.fragmentShader = 'varying float vThick;\nvarying vec3 vOp;\nvarying vec3 vRay;\n' + sh.fragmentShader;
  };
  m.customProgramCacheKey = () => 'clear-' + key;
  if (QUALITY.glass === 'real') {
    Object.assign(m, { transmission: 1, thickness: 1, attenuationColor: T, attenuationDistance: 1 / absorb });
    if (C.getHex()) m.color.copy(C).lerp(new THREE.Color('#ffffff'), 0.5);
    m.onBeforeCompile = sh => {
      thick(sh);
      sh.fragmentShader = sh.fragmentShader.replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment
        .replace('material.thickness = thickness;', 'material.thickness = thickness * vThick;')
        .replace('material.transmissionAlpha = mix', `transmitted.rgb += (1.0 - transmitted.a) * pow(${SKY}, vec3(2.2)); transmitted.a = 1.0; material.transmissionAlpha = mix`));
    };
    clearMats.push(m);
    return m;
  }
  m.color.copy(C); // black = no diffuse: what you see is reflections + the bent screen copy
  const { u, decl } = uniformsOf(uniforms);
  m.onBeforeCompile = sh => {
    thick(sh);
    Object.assign(sh.uniforms, u, { uScreen: grab.tex, uInvRes: grab.invRes, uTint: { value: T }, uInner: { value: I }, uTime: windTime, uNight: nightGlow });
    sh.vertexShader = 'varying vec2 vRefr;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRefr = 0.5 * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) / max(-mvPosition.z, 0.1);');
    if (nrm) sh.fragmentShader = 'uniform mat3 normalMatrix;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n{ ${nrm} }`);
    sh.fragmentShader = 'uniform sampler2D uScreen;\nuniform vec2 uInvRes;\nuniform vec3 uTint;\nuniform vec3 uInner;\nuniform float uTime;\nuniform float uNight;\nvarying vec2 vRefr;\n' + decl + GLSL3 + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { vec3 vn = normalize(normal), p = vOp, rd = normalize(vRay), tint = uTint, inner = uInner;
      float nv = clamp(dot(vn, normalize(vViewPosition)), 0.0, 1.0), s = sqrt(1.0 - nv * nv);
      float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
${pre}
      vec2 suv = clamp(gl_FragCoord.xy * uInvRes - vn.xy * vRefr * (${bend.toFixed(2)} + ${bend.toFixed(2)} * vThick), 0.0, 1.0);
      vec4 bg = texture2D(uScreen, suv);
      bg.rgb += (1.0 - bg.a) * ${SKY};
      bg.rgb = mix(bg.rgb, vec3(dot(bg.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.97, 1.0, 1.05), ${neutral.toFixed(2)}); // neutral: the scene behind loses its colour
      // band widths in s, but never thinner than a few pixels (fwidth(s) = s per pixel), so a far figure keeps its outline
      float px = fwidth(s), rimW = clamp(1.5 * px, 0.03, 0.25), bandW = clamp(3.0 * px, 0.15, 0.45), r0 = 1.0 - rimW;
      float dark = smoothstep(r0 - bandW, r0 - 0.15 * bandW, s), rim = smoothstep(r0, r0 + 0.7 * rimW, s);
      vec3 pass = pow(max(tint, vec3(0.001)), vec3(vThick * nv * ${absorb.toFixed(2)}));
      vec3 see = (bg.rgb * pass + inner * (1.0 - pass)) * (1.0 - ${dark.toFixed(2)} * dark) * (1.0 - fr);
      gl_FragColor = vec4(gl_FragColor.rgb * (1.0 - 0.5 * dark * (1.0 - rim)) + see + vec3(1.0, 0.98, 0.94) * ${rimK.toFixed(2)} * rim, 1.0);
${post}
${NIGHT_CLEAR[key] ?? ''}
      }`);
  };
  m.userData.onDraw = grabScreen;
  return m;
}
// One screen copy per renderer (the codex thumbnails draw with a second one); the shared uniforms are pointed
// at the right copy right before each draw.
const grab = { tex: { value: null }, invRes: { value: new THREE.Vector2() } }, grabs = new WeakMap(), at = new THREE.Vector2();
function grabScreen(renderer) {
  if (renderer.getRenderTarget()) return; // only the on-screen pass
  let g = grabs.get(renderer); if (!g) grabs.set(renderer, g = { tex: null, invRes: new THREE.Vector2(), frame: -1 });
  const f = renderer.info.render.frame;
  if (g.frame !== f) {
    g.frame = f;
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (!g.tex || g.tex.image.width !== w || g.tex.image.height !== h) {
      g.tex?.dispose(); g.tex = new THREE.FramebufferTexture(w, h); g.tex.minFilter = g.tex.magFilter = THREE.LinearFilter;
      g.invRes.set(1 / w, 1 / h);
    }
    renderer.copyFramebufferToTexture(at, g.tex);
  }
  grab.tex.value = g.tex; grab.invRes.value.copy(g.invRes);
}
// Cheaper glass for slow devices (real glass only): drop the refraction pass, plain see-through.
// Called by the adaptive-quality step in habitat.js before it lowers resolution; false = nothing to drop.
export function glassLite() {
  for (const m of clearMats) { m.transmission = 0; m.transparent = true; m.opacity = 0.62; m.depthWrite = false; m.needsUpdate = true; }
  return clearMats.length > 0;
}
// 젤리: one colour makes the rest: what passes is tinted by it, a deeper glow of it inside, a trace of it as diffuse
const jelly = (key, hex, o = {}) => { const t = new THREE.Color(hex);
  return clear({ key, tint: t, absorb: 1.3, inner: t.clone().multiplyScalar(0.75), dark: 0.35, color: t.clone().multiplyScalar(0.025), rough: 0.3, coat: 1, ...o }); };
// 야광: fluorescent plastic lit from inside, bright in sun and shade alike (a little brighter in shade), breathing
// slowly; a soft glow spills round the body (figure.js halo shell, the look's `halo` colour)
const GLOW = SUN + `diffuseColor.rgb = mix(diffuseColor.rgb * 0.45, vec3(0.6), 0.12 * pow(1.0 - nv, 2.0)); // dim diffuse: the colour comes from the glow, so it stays vivid
  vec3 gc = max(mix(vec3(dot(uGlow, vec3(0.333))), uGlow, 1.4), 0.0); // the glow is the body colour, but saturated (phosphor)
  totalEmissiveRadiance += gc * (0.8 - 0.2 * sun) * (0.75 + 0.25 * nv) * (0.92 + 0.08 * sin(uTime * 1.6)) * (0.9 + 0.2 * vn3(p * 5.0));`;
// 글리터 레진: clear resin with flakes floating in it, at three depths along the view ray (so they shift against
// each other as the figure turns). Each flake is a dim speck that flashes bright when its own tilt catches the eye.
const GLITTER = `vec3 gs = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        vec3 c = cells((p + rd * (0.025 + 0.045 * float(i))) * 24.0 + float(i) * 7.3);
        float flake = step(0.4, c.z) * (1.0 - smoothstep(0.13, 0.13 + 1.5 * fwidth(c.x), c.x));
        float flash = smoothstep(0.75, 1.0, fract(c.z * 37.0 + dot(vn, vec3(2.3, 1.7, 3.1)) * 1.3));
        gs += uGlitter * flake * (0.45 + 2.4 * flash) * (1.0 - 0.25 * float(i));
      }
      gl_FragColor.rgb += gs * (1.0 - fr);`;
// 호박 젤리 (오리 전용, 시험용 예시): a small leaf inside, drawn where the view ray crosses the body's middle plane
// (pattern z = 0), so it sits deep in the jelly and slides with the angle; edge-on it thins to a line, like a real one.
const LEAF = `float rz = abs(rd.z) < 0.03 ? (rd.z < 0.0 ? -0.03 : 0.03) : rd.z;
      vec2 q = mat2(0.8, 0.6, -0.6, 0.8) * ((p + rd * (-p.z / rz)).xy - vec2(-0.03, 0.36));
      float x = q.x / 0.34, w = 0.11 * sin(3.1416 * clamp(x + 0.5, 0.0, 1.0)) * (1.0 - 0.3 * x), aa = fwidth(q.y) + 0.002;
      float blade = (1.0 - smoothstep(w - aa, w + aa, abs(q.y))) * step(abs(x), 0.5);
      float stem = (1.0 - smoothstep(0.006, 0.006 + aa, abs(q.y))) * step(-0.62, x) * step(x, -0.5);
      float rib = (1.0 - smoothstep(0.004, 0.004 + aa, abs(q.y))) * step(abs(x), 0.45);
      vec3 leaf = mix(vec3(0.1, 0.24, 0.04), vec3(0.3, 0.46, 0.08), smoothstep(-0.5, 0.5, x)) * (1.0 - 0.4 * rib);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, leaf * (0.45 + 0.4 * bg.rgb) * (1.0 - fr), max(blade, stem) * step(rd.z * p.z, 0.0) * 0.95);`;
// 대리석 — 후보(업데이트용): out of the launch list (16-2), kept for a later update. White stone, grey veins that
// wander (warped sine bands) plus a finer second set, polished
const MARBLE = `float n = fbm3(p * 2.2 + 7.0), v = abs(sin((p.x * 1.4 + p.y * 2.3 - p.z * 0.6 + n * 3.2) * 3.14159));
  float n2 = fbm3(p * 5.0 + 2.0), v2 = abs(sin((p.y * 3.0 - p.x * 1.7 + n2 * 4.0) * 3.14159));
  float vein = 1.0 - smoothstep(0.0, 0.07 + fwidth(v), v), fine = 1.0 - smoothstep(0.0, 0.035 + fwidth(v2), v2);
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.96 + 0.04 * n), uVein, max(vein * 0.8, fine * 0.45));`;

// ---- glazes (청자 희귀, 청화백자·자개 영웅) ----
// a very faint glint: tiny points that light up only at some angles (they twinkle as the figure turns)
const GLINT = `vec3 gc = cells(p * 30.0); float gw = fract(gc.z * 17.0 + dot(normal, vec3(2.3, 1.7, 3.1)));
  totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * step(0.9, gc.z) * smoothstep(0.82, 1.0, gw) * (1.0 - smoothstep(0.05, 0.09 + fwidth(gc.x), gc.x)) * 1.6;`;
// 청자: pale jade glaze, thick and glossy, with crackle (빙렬): fine lines along cell edges at two sizes
const CELADON = `vec3 a = cells(p * 6.0), b = cells(p * 15.0 + 4.0);
  float ea = a.y - a.x, eb = b.y - b.x;
  float crack = 1.0 - smoothstep(0.0, 0.012 + fwidth(ea), ea), fine = 1.0 - smoothstep(0.0, 0.015 + fwidth(eb), eb);
  diffuseColor.rgb *= (0.93 + 0.07 * vn3(p * 3.0)) * (1.0 - 0.2 * crack) * (1.0 - 0.09 * fine);` + GLINT;
// 자개: lacquer with inlaid mother-of-pearl: clustered cell-shaped shell pieces with thin gaps,
// each piece a pastel rainbow that shifts with the viewing angle
const NAJEON = `vec3 c = cells(p * 13.0); float cl = vn3(p * 2.4 + 5.0);
  float piece = step(1.1 - cl * 1.1, c.z) * smoothstep(0.06, 0.06 + fwidth(c.y - c.x) * 1.5, c.y - c.x);
  vec3 shell = mix(vec3(0.8, 0.86, 0.92), rainbow(c.z * 2.7 + nv * 1.6 + p.y * 1.5), 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, shell, piece);
  roughnessFactor = mix(roughnessFactor, 0.14, piece);
  totalEmissiveRadiance += shell * 0.14 * piece;` + GLINT;
// 청화백자: ink painted under a thick glossy glaze. A tileable motif (vines, peonies, cloud curls; no bands)
// laid on triplanar, so it flows over the body.
const BLUEWHITE = `vec3 tw = pow(abs(on), vec3(6.0)); tw /= tw.x + tw.y + tw.z; vec3 tq = p * 0.87;
  diffuseColor.rgb *= (texture2D(uMotif, tq.zy) * tw.x + texture2D(uMotif, tq.xz + 0.37) * tw.y + texture2D(uMotif, tq.xy) * tw.z).rgb;` + GLINT;
// 비눗방울 펄: a clear body under a soap film: rainbow bands that swirl over it and run as the angle changes,
// strongest toward the outline. Unlike 무지개 진주 (opaque nacre) the scene shows through the middle.
const BUBBLE = `float sw = fbm3(p * 2.2 + vec3(0.0, p.x * 1.5, 0.0));
      vec3 film = rainbow(sw * 2.6 + nv * 1.5 + p.y * 0.8), sat = film - dot(film, vec3(0.333));
      gl_FragColor.rgb += (film * 0.5 + sat * 1.2) * (0.1 + 0.7 * pow(1.0 - nv, 1.6)) * (1.0 - 0.5 * rim);`;
// 스테인드글라스: pieces of gem-coloured glass (cells, each one of a / b / c / d) held by thin dark lead lines,
// lit from inside (every piece glows in its colour, a little more toward the outline) and deeper where the sun hits
const STAINED_PRE = `vec3 sc = cells(p * 4.5 + 1.3); float edge = sc.y - sc.x;
      vec3 pane = sc.z < 0.25 ? uA : sc.z < 0.5 ? uB : sc.z < 0.75 ? uC : uD;
      tint = pane; inner = pane * 0.6;`;
const STAINED = SUN.replace('normal,', 'vn,') + `gl_FragColor.rgb += pane * (0.4 + 0.3 * (1.0 - nv) + 0.6 * sun * sqrt(pane)) * (0.85 + 0.3 * vn3(p * 9.0)) * (1.0 - fr);
      float lead = 1.0 - smoothstep(0.022, 0.022 + 1.2 * fwidth(edge), edge);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.09, 0.085, 0.08) + 0.4 * fr + 0.1 * sun, lead);`;

// ---- 전설 (one look per legendary `mat`; species pick theirs in data.js) ----
// 금 — 후보(업데이트용): no species has it since 16-2 (one legendary each); still the legendary egg's shell.
const GOLD = `vec3 d = dimple(p * 10.0); d -= on * dot(d, on); normal = normalize(normal + normalMatrix * d * 0.05);`; // polished, faint hammer dimples
// 무지개 진주: nacre with a rainbow that flows slowly up over the body and runs as the angle changes (view-space
// normal, so turning the figure or the camera moves the colours), lit a little from inside so it carries at home
// distance; on top of three.js thin-film iridescence and a strong pearl sheen
const PEARL = `float fl = uTime * 0.07;
  vec3 rb = rainbow(nv * 1.4 + dot(normal, vec3(0.9, 0.55, 0.0)) * 0.7 + p.y * 1.3 + p.x * 0.5 - fl + 0.3 * vn3(p * 3.0 + fl));
  rb = max(mix(vec3(dot(rb, vec3(0.333))), rb, 1.5), 0.0);
  diffuseColor.rgb *= mix(vec3(1.0), 0.35 + 0.85 * rb, 0.95); roughnessFactor = 0.1;
  totalEmissiveRadiance += rb * (0.24 + 0.3 * pow(1.0 - nv, 2.0));`;
// 은하수: deep night blue with purple, blue and pink clouds drifting slowly, lit from inside, and stars at two
// sizes that twinkle (the big ones carry at home distance)
const GALAXY = `vec3 dr = vec3(uTime * 0.02, uTime * 0.035, 0.0); float n = fbm3(p * 2.5 + 1.0 + dr), m = fbm3(p * 5.0 - 3.0 - dr);
  vec3 col = mix(vec3(0.015, 0.015, 0.06), vec3(0.24, 0.06, 0.48), smoothstep(0.32, 0.68, n));
  col = mix(col, vec3(0.05, 0.28, 0.7), smoothstep(0.48, 0.76, m) * 0.75);
  col += vec3(0.75, 0.15, 0.5) * smoothstep(0.3, 0.5, n * m) * 0.6;
  vec3 s = cells(p * 24.0), b = cells(p * 9.0 + 2.0);
  float star = (1.0 - smoothstep(0.03, 0.07 + fwidth(s.x), s.x)) * step(0.55, s.z);
  float big = (1.0 - smoothstep(0.04, 0.1 + fwidth(b.x), b.x)) * step(0.72, b.z) * (0.55 + 0.45 * sin(uTime * 2.2 + b.z * 60.0));
  diffuseColor.rgb = col;
  totalEmissiveRadiance += col * 0.8 + vec3(1.0, 0.95, 0.85) * (star * (1.0 + 3.0 * (s.z - 0.55)) + big * 3.0);`;
// 옥토끼 비취 (토끼): clear green jade, cloudy with paler drifts, lit softly from inside (brightest where we look
// straight in, thinner toward the outline, breathing slowly); the silver moondust is figure.js
const JADE = `float n = fbm3(p * 3.0 + 2.0), m = fbm3(p * 7.0 - 1.0 + vec3(0.0, uTime * 0.02, 0.0));
  vec3 deep = vec3(0.02, 0.36, 0.17), light = vec3(0.3, 0.8, 0.48), col = mix(deep, light, smoothstep(0.3, 0.75, n));
  col = mix(col, vec3(0.75, 0.96, 0.82), smoothstep(0.6, 0.85, m) * 0.3);
  diffuseColor.rgb = col * 0.45; roughnessFactor = 0.07;
  totalEmissiveRadiance += mix(deep, light, 0.55 + 0.45 * n) * (0.12 + 0.38 * pow(nv, 1.5)) * (0.9 + 0.1 * sin(uTime * 1.2));
  // 134: the legendary's tell (the rare 청자 is pale green glossy too): the drifts seen again deeper inside (shifted
  // against the view, so they slide as it turns), a soft light round the outline, gold caps on the ear tips and the toes
  vec3 vo = normalize(vdir * normalMatrix); float n2 = fbm3((p + vo * 0.14) * 4.0 + 7.0);
  totalEmissiveRadiance += mix(deep, light, n2) * smoothstep(0.42, 0.75, n2) * 0.6 * nv + vec3(0.3, 1.0, 0.55) * pow(1.0 - nv, 2.5) * 0.75;
  float ga = fwidth(p.y) * 1.5, gk = max(smoothstep(0.94, 0.94 + ga, p.y), 1.0 - smoothstep(0.04, 0.04 + ga, p.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.57, 0.1), gk); roughnessFactor = mix(roughnessFactor, 0.2, gk); metalnessFactor = gk; lookStudio = 0.85 * gk; totalEmissiveRadiance *= 1.0 - 0.9 * gk;`;
// 황금 복돼지 (돼지, 가칭; inbox 10): polished gold all over, snout disc and hoof bands too, in the studio reflection; a
// very faint relief of cloud curls (uCloud: height, laid on triplanar) only a mirror shows; the coins round it are figure.js
const FORTUNE = `vec3 tw = pow(abs(on), vec3(6.0)); tw /= tw.x + tw.y + tw.z; vec3 tq = p * 1.3;
  float h = (texture2D(uCloud, tq.zy) * tw.x + texture2D(uCloud, tq.xz + 0.37) * tw.y + texture2D(uCloud, tq.xy) * tw.z).r;
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) * 0.005); // raised where h is high (three.js bump mapping)
  totalEmissiveRadiance += vec3(1.0, 0.72, 0.3) * 0.08 * pow(1.0 - nv, 2.0);`;
// 새벽 노을 (닭, 임시): feathers in dawn colours (orange -> pink -> purple and back) flowing slowly up over the body,
// lit a little from inside; the rising sparks are figure.js
const DAWN = `float f = p.y * 3.2 - p.x * 0.9 - uTime * 0.08 + 0.35 * fbm3(p * 2.5 + vec3(0.0, uTime * 0.05, 0.0)), k = abs(fract(f * 0.5) * 2.0 - 1.0);
  vec3 col = mix(mix(vec3(1.0, 0.42, 0.04), vec3(1.0, 0.18, 0.42), smoothstep(0.1, 0.5, k)), vec3(0.45, 0.16, 0.85), smoothstep(0.55, 0.95, k));
  diffuseColor.rgb = col * 0.7; roughnessFactor = 0.35;
  totalEmissiveRadiance += col * (0.14 + 0.3 * pow(1.0 - nv, 2.0));`;
// 구름 솜사탕 (양, 가칭): soft pastel candy floss, pink and sky blue clouds with a little lilac drifting slowly over the
// wool, matte with a sheen, lit a little from inside; the cloud puffs round it are figure.js
const COTTON = `vec3 dr = vec3(0.0, uTime * 0.04, uTime * 0.03); float f = fbm3(p * 2.2 + dr), g = fbm3(p * 4.5 - 2.0 - dr);
  vec3 col = mix(vec3(1.0, 0.7, 0.84), vec3(0.6, 0.8, 1.0), smoothstep(0.38, 0.62, f));
  col = mix(col, vec3(0.84, 0.72, 1.0), smoothstep(0.55, 0.8, g) * 0.6);
  diffuseColor.rgb = col; roughnessFactor = 0.75;
  totalEmissiveRadiance += col * (0.16 + 0.25 * pow(1.0 - nv, 1.5));`;
// 밀키 오팔 (소, 가칭): milky white opal with soft patches of colour fire (uFire: how much) that change as the angle
// changes (each cell its own colour; view-space normal, so turning the figure or the camera plays them)
const OPAL = `{ vec3 c = cells(p * 5.0); float n = fbm3(p * 2.0 + 3.0), a = dot(normal, vec3(0.6, 0.7, 0.2));
  vec3 fire = rainbow(c.z * 2.0 + nv * 1.2 + a * 0.8 + uTime * 0.03);
  float flash = smoothstep(0.3, 0.95, 0.5 + 0.5 * sin(c.z * 37.0 + nv * 5.0 + a * 3.0 + uTime * 0.25));
  vec3 milk = uMilk * mix(vec3(0.92, 0.93, 0.97), vec3(0.99, 0.96, 0.91), n);
  diffuseColor.rgb = mix(milk, fire, flash * uFire); roughnessFactor = 0.1;
  totalEmissiveRadiance += fire * flash * 0.6 * uFire + milk * 0.06; }`;
// 검은 오팔 (the cow's patches, inbox 12): the patches are drawn here, not by the model's paint, so they are round:
// three on the body (shoulder and rump this side, one big one on the other) and one behind each eye round the ear,
// smooth edged (a little wobble). The ears and the tail tuft are black too (uAcc 1: the model's accent, there by
// position). In them: near black with small soft spots of blue, green and orange fire that shift as the angle changes
// (value noise, no cells, the normal untouched). Out of them: the milky opal (OPAL). Body and accent run the same code
// with the same settings, so the seam between the two meshes never shows.
const COWOPAL = `${OPAL}
  vec3 q = vec3(p.x, p.y, abs(p.z)); float wob = 0.4 * (vn3(p * 4.5 + 2.0) - 0.5) + 0.08 * (vn3(p * 11.0) - 0.5); // a soft lumpy outline, not a dot
  #define BLOB(v, c, r) (1.0 - length((v - c) / r))
  float bl = max(max(BLOB(p, vec3(0.06, 0.6, 0.25), vec3(0.17, 0.18, 0.15)), BLOB(p, vec3(-0.41, 0.63, 0.2), vec3(0.15, 0.15, 0.15))),
                 max(BLOB(p, vec3(-0.17, 0.6, -0.25), vec3(0.21, 0.17, 0.15)), BLOB(q, vec3(0.25, 0.87, 0.15), vec3(0.11, 0.12, 0.12)))) + wob;
  float ear = uAcc * max(step(0.2, abs(p.z)) * step(0.75, p.y), step(p.y, 0.42) * step(p.x, -0.48)); // the ears, the tail tuft
  float k = max(smoothstep(-fwidth(bl) - 0.01, fwidth(bl) + 0.01, bl), ear), a = dot(normal, vec3(0.6, 0.7, 0.2));
  #define FIRE(t) (fract(t) < 0.333 ? mix(vec3(0.1, 0.45, 1.0), vec3(0.1, 0.9, 0.45), fract(t) * 3.0) : fract(t) < 0.667 ? mix(vec3(0.1, 0.9, 0.45), vec3(1.0, 0.45, 0.08), fract(t) * 3.0 - 1.0) : mix(vec3(1.0, 0.45, 0.08), vec3(0.1, 0.45, 1.0), fract(t) * 3.0 - 2.0))
  float s1 = smoothstep(0.55, 0.92, vn3(p * 21.0 + 1.0)), s2 = smoothstep(0.6, 0.95, vn3(p * 38.0 + 5.0)) * (1.0 - s1), hz = 0.06 * vn3(p * 6.0 - 1.0);
  float g1 = 0.35 + 0.65 * smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(vn3(p * 6.0) * 12.0 + nv * 6.0 + a * 4.0 + uTime * 0.3));
  vec3 fire = FIRE(vn3(p * 5.0 + 3.0) * 2.0 + nv * 1.5 + a * 1.2 + uTime * 0.03) * (s1 * g1 + hz) + FIRE(vn3(p * 9.0 - 2.0) * 2.0 - nv * 1.2 + a * 0.9 + 0.4) * s2 * 0.7; // spots, and a faint haze of the same fire round them
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.022, 0.035) + fire * 0.35, k); roughnessFactor = mix(0.1, 0.06, k);
  totalEmissiveRadiance = mix(totalEmissiveRadiance, fire * 0.9, k);`;
// ---- pond legendaries (19-2, names 가칭; inbox 10) ----
// 용궁 산호 (거북): the shell polished red-pink coral cut into hexagon plates (seen from above, centred on the shell's
// top), each edged in a thin gold line (in the studio reflection); in each plate the coral's fine pores and faint growth
// rings round its middle, paler toward the outline (inbox 12: not flat brick red). Three small pearls domed on the
// back's middle line only. The rising bubbles round it are figure.js. The head, legs and tail are pale jade
// (PALEJADE), the shell's rim gold.
const CORAL = `vec2 u = (p.xz - vec2(-0.2, 0.0)) / 0.34, hs = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(u, u - vec2(0.5, 1.0)) / hs.xyxy) + 0.5, hq = vec4(u - hc.xy * hs, u - (hc.zw + 0.5) * hs);
  vec2 g = dot(hq.xy, hq.xy) < dot(hq.zw, hq.zw) ? hq.xy : hq.zw; // from this plate's centre
  float hd = max(dot(abs(g), vec2(0.5, 0.8660254)), abs(g.x)), aa = fwidth(hd) + 0.004; // 0 in the middle, 0.5 on the edge
  vec2 pq = u - vec2(clamp(floor(u.x + 0.5), -1.0, 1.0), 0.0); // from the nearest of the three pearls on the middle line
  float line = smoothstep(0.47 - aa, 0.47 + aa, hd) * smoothstep(-0.1, 0.25, on.y + 0.3), pearl = (1.0 - smoothstep(0.1 - aa, 0.1 + aa, length(pq))) * step(0.3, on.y);
  vec3 d = dimple(p * 46.0); float dl = length(d), pore = 1.0 - smoothstep(0.1, 0.2 + fwidth(dl), dl); d -= on * dot(d, on);
  vec3 tb = vec3(pq.x, 0.0, pq.y) * pearl * 6.0; tb -= on * dot(tb, on);
  normal = normalize(normal + normalMatrix * (-d * 0.12 * pore * (1.0 - line - pearl) + tb));
  float ring = 0.5 + 0.5 * sin(hd * 46.0 + 3.0 * vn3(p * 9.0)), gr = fbm3(p * 7.0 + 1.0);
  diffuseColor.rgb = vec3(0.8, 0.08, 0.1) * (0.9 + 0.14 * ring + 0.2 * (gr - 0.5)); // linear: about #e6505a
  diffuseColor.rgb *= 1.0 - 0.4 * pore;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.34, 0.38), 0.35 * pow(1.0 - nv, 2.0)); roughnessFactor = 0.2;
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.97, 0.95, 0.93), rainbow(nv * 1.4 + p.x * 3.0), 0.22), pearl);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.36), line); metalnessFactor = line; roughnessFactor = mix(roughnessFactor, 0.08, max(line, pearl)); lookStudio = line;
  totalEmissiveRadiance += vec3(1.0, 0.42, 0.45) * 0.08 * (1.0 - line) * (1.0 - 0.5 * pore) + vec3(1.0, 0.97, 0.95) * pearl * 0.25;`;
// pale jade (the coral turtle's head, legs and tail): soft milky green with paler drifts, lit a little from inside
const PALEJADE = `float n = fbm3(p * 3.0 + 2.0); vec3 col = mix(vec3(0.62, 0.84, 0.68), vec3(0.82, 0.95, 0.84), smoothstep(0.35, 0.7, n));
  diffuseColor.rgb = col * 0.8; roughnessFactor = 0.12;
  totalEmissiveRadiance += col * (0.08 + 0.16 * pow(nv, 1.5));`;
// 달빛 물결 (수달): matte night-sky navy (inbox 12: a step brighter), and on it, faint, silver ripples: two or three rings round a point, here
// and there (no bands), spreading slowly; the silver fireflies round it are figure.js. uBase: the colour (body / cream)
const MOONWATER = `vec3 c = cells(p * 4.0 + 1.3); float rr = c.x * 6.0 - uTime * 0.12 - c.z * 5.0;
  float ring = 1.0 - smoothstep(0.0, 0.18 + 2.0 * fwidth(rr), abs(fract(rr) - 0.5) * 2.0);
  float rip = ring * (1.0 - smoothstep(0.12, 0.42, c.x)) * step(0.4, c.z);
  diffuseColor.rgb = mix(uBase * (0.92 + 0.16 * fbm3(p * 3.0)), vec3(0.72, 0.78, 0.92), rip * 0.21); roughnessFactor = mix(0.6, 0.4, rip); metalnessFactor = rip * 0.15;
  totalEmissiveRadiance += vec3(0.7, 0.78, 1.0) * rip * 0.075 + uBase * 0.35 * pow(1.0 - nv, 2.0);`;
// 초승달 조약돌 (the moon otter's item): a silver pebble glowing softly from inside, breathing slowly, faint craters
const MOONSTONE = `float n = fbm3(p * 9.0);
  diffuseColor.rgb *= 0.9 + 0.1 * n;
  totalEmissiveRadiance += vec3(0.8, 0.87, 1.0) * (0.42 + 0.07 * sin(uTime * 1.5)) * (0.75 + 0.25 * nv) * (0.9 + 0.1 * n);`;
// 눈꽃 수정 (백조): clear ice crystal (fake glass), lit a little from inside, most where we look straight in, and frosted
// toward the outline; on the wings the feather tips are cut gems: facets (each cell tilts the normal its own way) with
// bright edges. No cracks. The beak and feet are frosted ice (FROST); the snowflakes falling round it are figure.js
const CRYSTAL_POST = `gl_FragColor.rgb += vec3(0.55, 0.75, 1.0) * (0.07 + 0.14 * pow(nv, 2.0)) * (1.0 - fr);
      float frost = smoothstep(0.6, 0.97, s) * (0.5 + 0.5 * fbm3(p * 16.0));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.96, 1.0), frost * 0.45);`;
const FACETS = `vec3 p = vOp; float tipK = smoothstep(0.0, -0.22, p.x); vec3 c = cells(p * 9.0), t = h33(vec3(c.z * 97.0)) - 0.5;
  normal = normalize(normal + normalMatrix * t * 1.1 * tipK);`;
const FACET_EDGE = `{ float tipK = smoothstep(0.0, -0.22, p.x); vec3 fc = cells(p * 9.0); float fe = fc.y - fc.x;
      gl_FragColor.rgb += vec3(0.85, 0.93, 1.0) * (1.0 - smoothstep(0.0, 0.035 + fwidth(fe), fe)) * 0.55 * tipK; }`;
const FROST = `diffuseColor.rgb *= 0.9 + 0.14 * fbm3(p * 20.0); totalEmissiveRadiance += vec3(0.5, 0.65, 0.9) * 0.12;`;
// 유자 (the yuzu capybara's item): yuzu yellow, glossy, with the fine pores of the peel and a warm glow
const YUZU = `vec3 d = dimple(p * 24.0); d -= on * dot(d, on); normal = normalize(normal + normalMatrix * d * 0.06);
  diffuseColor.rgb *= 0.9 + 0.2 * fbm3(p * 2.5 + 3.0); roughnessFactor = 0.24;
  totalEmissiveRadiance += vec3(1.0, 0.7, 0.25) * (0.08 + 0.22 * pow(1.0 - nv, 2.0));`;
// 꿀빛 젤리 (the yuzu capybara): honey-yuzu jelly (inbox 12: near-yellow amber, a step less orange) glowing inside, most where we look straight in
const HONEY = `gl_FragColor.rgb *= mix(vec3(1.0), vec3(1.0, 0.86, 0.5), 0.5 * (1.0 - fr)); // honey all through: thin legs too, not lemon
      gl_FragColor.rgb += vec3(1.0, 0.64, 0.12) * (0.06 + 0.22 * pow(nv, 1.5)) * (1.0 - fr);`;
// ---- 25-1 설원 전설 (가칭) ----
// 오로라 빛 (펭귄): deep night-blue vinyl and on it slow aurora curtains, green rising into violet, drifting up and
// lit from inside. uK: how much aurora (the white front only a little)
const AURORA = `float t = uTime * 0.05, f = p.x * 1.6 + 0.5 * fbm3(p * 1.8 + vec3(0.0, t, t)), band = fbm3(vec3(f * 2.0, p.y * 0.6 - t * 2.0, p.z * 1.5));
  float cur = smoothstep(0.45, 0.75, band) * (0.6 + 0.4 * sin(p.y * 10.0 + f * 6.0 - uTime * 0.3));
  vec3 ac = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.35, 1.0), smoothstep(0.3, 1.2, p.y + 0.3 * band));
  vec3 col = mix(diffuseColor.rgb, ac, cur * uK); diffuseColor.rgb = col * 0.75; roughnessFactor = 0.2;
  totalEmissiveRadiance += ac * cur * uK * 0.5 + col * 0.06 * pow(1.0 - nv, 2.0);`;
// 빙하 얼음 (북극곰): glossy glacier ice, deep blue where we look in and pale toward the outline, with white crack lines
// between big cells and a blue glow inside
const GLACIER = `vec3 c = cells(p * 3.5 + 0.7); float e = c.y - c.x, crack = 1.0 - smoothstep(0.0, 0.03 + fwidth(e), e);
  vec3 col = mix(vec3(0.88, 0.97, 1.0), vec3(0.42, 0.72, 0.9), smoothstep(0.2, 0.95, nv) * (0.85 + 0.15 * c.z));
  diffuseColor.rgb = mix(col, vec3(0.97, 1.0, 1.0), crack * 0.7) * 0.85; roughnessFactor = mix(0.12, 0.35, crack);
  totalEmissiveRadiance += vec3(0.3, 0.6, 0.95) * (0.06 + 0.16 * pow(nv, 2.0)) * (1.0 - crack) + vec3(0.9, 0.97, 1.0) * crack * 0.12;`;
// 달 진주 (물범): a silvery lilac pearl (thin-film shimmer from the material) with soft drifts and a moonlit rim
const MOONPEARL = `float n = fbm3(p * 4.0 + 5.0);
  diffuseColor.rgb *= mix(vec3(0.9, 0.88, 1.0), vec3(1.0), n);
  totalEmissiveRadiance += vec3(0.72, 0.78, 1.0) * (0.04 + 0.3 * pow(1.0 - nv, 2.5));`;
// 별빛 (북극여우): snow-white vinyl (gold-tipped where the accent is) sprinkled with tiny gold stars, each twinkling on its own
const STARLIGHT = `vec3 c = cells(p * 16.0); float tw = 0.5 + 0.5 * sin(uTime * (1.0 + 2.0 * c.z) + c.z * 40.0);
  float star = (1.0 - smoothstep(0.05, 0.12 + fwidth(c.x), c.x)) * step(0.72, c.z) * tw;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.72, 0.25), star); roughnessFactor = mix(0.32, 0.15, star); metalnessFactor = star * 0.6;
  totalEmissiveRadiance += vec3(1.0, 0.8, 0.38) * star * 0.8 + diffuseColor.rgb * 0.04 * pow(1.0 - nv, 2.0);`;
// 겨울 등불 (순록): warm amber lit from inside like a paper lantern, flickering a little; the ruff a cream glow. uGlow: its light
const LANTERN = `float fl = 0.88 + 0.08 * sin(uTime * 7.0 + p.y * 3.0) * sin(uTime * 3.1) + 0.04 * vn3(vec3(uTime * 2.0, p.y * 4.0, 0.0));
  float n = fbm3(p * 3.0 - vec3(0.0, uTime * 0.15, 0.0));
  diffuseColor.rgb *= 0.88 + 0.2 * n; roughnessFactor = 0.3;
  totalEmissiveRadiance += uGlow * fl * (0.12 + 0.3 * pow(nv, 1.5)) * (0.8 + 0.4 * n);`;
// 눈의 정령 (흰올빼미): pale blue-white, a frosty breath drifting over it, a cold rim and little frost glints
const SPIRIT = `vec3 c = cells(p * 12.0 + 2.0); float gl = (1.0 - smoothstep(0.04, 0.1 + fwidth(c.x), c.x)) * step(0.6, c.z) * (0.5 + 0.5 * sin(uTime * 2.0 + c.z * 30.0));
  float n = fbm3(p * 2.5 + vec3(0.0, uTime * 0.04, 0.0));
  diffuseColor.rgb *= mix(vec3(0.84, 0.91, 1.0), vec3(1.0), n); roughnessFactor = 0.22;
  totalEmissiveRadiance += vec3(0.6, 0.8, 1.0) * (0.05 + 0.28 * pow(1.0 - nv, 2.0)) + vec3(0.9, 0.97, 1.0) * gl * 0.7;`;
// ---- 공룡 전설. p: object space / figure height (p.y 0 at the feet, 1 at the top). 71-2: 트리케라톱스·브라키오·스테고·티라노는
// Legends8 / Tier_fox_rex 시안대로, 안킬로·프테라는 두 안씩(A가 data.js에 걸림, 채팅 확인 대기) ----
// 용암 바위 (스테고사우루스): black rock in rounded lumps (bump: high in each cell's middle, down at the cracks) with glowing
// orange cracks between them, each piece breathing on its own; the plates are glowing crystals (LAVA_CRYSTAL, gems: MODELS legend)
const LAVA = `vec3 c = cells(p * 5.5 + 1.3 + 0.5 * vec3(vn3(p * 3.0), vn3(p * 3.0 + 7.0), 0.0)); float e = c.y - c.x, crack = 1.0 - smoothstep(0.0, 0.022 + fwidth(e), e), h = smoothstep(0.0, 0.3, e);
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) * 0.06);
  float pulse = 0.75 + 0.25 * sin(uTime * 1.2 + c.z * 12.0), n = fbm3(p * 9.0);
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.7 + 0.6 * n), vec3(0.9, 0.25, 0.03), crack); roughnessFactor = mix(0.6, 0.3, crack);
  totalEmissiveRadiance += vec3(1.0, 0.3, 0.03) * crack * pulse * 0.9 + vec3(1.0, 0.2, 0.02) * 0.3 * (1.0 - smoothstep(0.0, 0.08, e)) * pulse;`;
// cut crystal, opaque, lit from inside: each facet (cell) tilts the normal its own way; deep red toward the outline, orange-gold
// where we look straight in
const LAVA_CRYSTAL = `vec3 c = cells(p * 16.0), t = h33(vec3(c.z * 97.0)) - 0.5; normal = normalize(normal + normalMatrix * t * 0.6);
  float fe = c.y - c.x, edge = 1.0 - smoothstep(0.0, 0.03 + fwidth(fe), fe), f = pow(clamp(dot(normal, vdir), 0.0, 1.0), 2.0);
  diffuseColor.rgb *= 0.18; roughnessFactor = 0.3;
  totalEmissiveRadiance += mix(vec3(0.1, 0.006, 0.0), vec3(0.6, 0.08, 0.005), f * f) * (0.4 + 0.45 * c.z) + vec3(1.0, 0.32, 0.03) * pow(f, 6.0) * 0.6 + vec3(1.0, 0.3, 0.04) * edge * 0.15;`;
// clear gem lit from inside (col, k: its glow), the cut edges (where the normal turns fast) catching the light
const GEM_GLOW = (col, k) => `gl_FragColor.rgb += ${col} * (${k} + 0.4 * pow(nv, 2.0)) * (1.0 - fr);
      { float ed = clamp(length(fwidth(vn)) / max(length(fwidth(vViewPosition)), 1e-5) * 0.012 - 0.2, 0.0, 1.0); gl_FragColor.rgb += mix(${col}, vec3(1.0), 0.5) * ed * 0.35; }`;
// 자수정 볏 (트리케라톱스): polished grey stone (fine dark and pale specks, soft mottling); the frill is purple amethyst
// (clear, cut facets, lit from inside) crowned by crystal points (gems: MODELS legend)
const GRAYSTONE = `float n = fbm3(p * 3.0 + 4.0); vec3 c = cells(p * 38.0), d = cells(p * 17.0 + 3.0);
  float sp = (1.0 - smoothstep(0.12, 0.2 + fwidth(c.x), c.x)) * step(0.55, c.z), lt = (1.0 - smoothstep(0.15, 0.25 + fwidth(d.x), d.x)) * step(0.8, d.z);
  diffuseColor.rgb *= (0.86 + 0.24 * n) * (1.0 - 0.4 * sp); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.89, 0.87), lt * 0.25); roughnessFactor = 0.22;`;
const FACETS_ALL = `vec3 c = cells(vOp * 14.0), t = h33(vec3(c.z * 97.0)) - 0.5; normal = normalize(normal + normalMatrix * t * 0.9);`;
const FACET_EDGE_ALL = `{ vec3 fc = cells(p * 14.0); float fe = fc.y - fc.x; gl_FragColor.rgb += vec3(0.95, 0.88, 1.0) * (1.0 - smoothstep(0.0, 0.03 + fwidth(fe), fe)) * 0.45; }`;
// 은하 (브라키오사우루스): deep blue-violet clear body; inside it a spiral galaxy on the middle plane (where the view ray
// crosses pattern z = 0, so it sits deep in the body and slides with the angle), drifting nebula and stars at three depths, twinkling
const NEBULA = `{ float rz = abs(rd.z) < 0.05 ? (rd.z < 0.0 ? -0.05 : 0.05) : rd.z;
      vec2 q = (p + rd * (-p.z / rz)).xy - vec2(-0.08, 0.4); q = mat2(0.94, 0.34, -0.34, 0.94) * q; q.y *= 1.7;
      float r = length(q), a = atan(q.y, q.x), arm = pow(0.5 + 0.5 * cos(2.0 * a - 6.0 * log(r + 0.015) - uTime * 0.15), 2.5) * smoothstep(0.3, 0.04, r);
      vec3 gal = (vec3(0.45, 0.4, 1.0) * arm * 1.4 + vec3(1.0, 0.85, 0.95) * exp(-r * r * 260.0) * 1.6) * step(rd.z * p.z, 0.0);
      vec3 dr = vec3(uTime * 0.02, uTime * 0.03, 0.0); float n = fbm3((p + rd * 0.06) * 2.6 + dr), m = fbm3((p + rd * 0.1) * 4.5 - 3.0 - dr);
      vec3 neb = vec3(0.32, 0.1, 0.62) * smoothstep(0.4, 0.75, n) + vec3(0.1, 0.3, 0.85) * smoothstep(0.5, 0.8, m) * 0.7 + vec3(0.8, 0.2, 0.55) * smoothstep(0.32, 0.5, n * m) * 0.35;
      vec3 st = vec3(0.0);
      for (int i = 0; i < 3; i++) { vec3 c = cells((p + rd * (0.02 + 0.05 * float(i))) * (26.0 - 6.0 * float(i)) + float(i) * 5.1);
        st += (1.0 - smoothstep(0.03, 0.07 + fwidth(c.x), c.x)) * step(0.45, c.z) * (0.55 + 0.45 * sin(uTime * (1.5 + 2.0 * c.z) + c.z * 50.0)) * (1.6 - 0.4 * float(i)); }
      gl_FragColor.rgb += (gal + neb * (0.5 + 0.5 * nv) + vec3(0.95, 0.95, 1.0) * st) * (1.0 - fr); }`;
// 호박 속 골격 (티라노사우루스): deep honey amber, glowing from inside (most where we look straight in), a little cloudy; the cream
// skeleton (MODELS legend) is drawn over it where the amber is the front surface (BONE: stencil), so it stays cream, not orange
const AMBERBONE = `gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.66, 0.4), 0.7 * (1.0 - fr));
      gl_FragColor.rgb += vec3(0.95, 0.62, 0.15) * (0.04 + 0.3 * pow(nv, 2.0)) * (0.8 + 0.4 * fbm3(p * 4.0 + 1.0)) * (1.0 - fr);`;
// the bones: cream, a little warm glow; drawn after the amber (order 3.5, before the eyes), without the depth test but only
// where the amber wrote its stencil (it is the front surface there), blended 88 % over it so its gloss shows a little
const BONE = () => Object.assign(phys('#fff0d4', { roughness: 0.5, emissive: '#ffb860', emissiveIntensity: 0.25, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, opacity: 0.88,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc }), { userData: { order: 3.5 } });
// 84 → 86-2 (the Meshy rex): clear honey with the skeleton inside it, in plain transparency (no screen copy, no stencil; 85's copy
// read brown and cloudy, the bones smudged). Drawn as the opaque things: the body's far wall (wall: its back faces), glowing orange,
// brightest where we look straight in, and the bones (bone: tools/meshy-bones.mjs, every vertex inside the body) with depth, so the
// near ribs hide the far ones and every bar keeps its edge. Then the honey front over them, front faces only, without depth: under
// half solid in the middle, nearly solid and bright at the outline (fresnel). Only the toes' tips dark brown (their lowest 4.5 %)
const TOE = 'smoothstep(0.045, 0.012, p.y)';
const AMBER86 = `float toe = ${TOE}, fe = pow(1.0 - nv, 2.5);
      diffuseColor.rgb = mix(vec3(0.24, 0.09, 0.0), vec3(0.04, 0.012, 0.002), toe);
      diffuseColor.a = mix(mix(0.45, 0.97, fe), 0.95, toe);
      totalEmissiveRadiance += (vec3(1.0, 0.46, 0.02) * (0.2 + 0.2 * nv * nv) + vec3(1.0, 0.78, 0.3) * 0.8 * fe) * (1.0 - toe);`;
const amberWall86 = () => new THREE.ShaderMaterial({ side: THREE.BackSide,
  vertexShader: 'attribute vec3 _op; varying vec3 vN, vV, vOp; void main() { vOp = _op; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `varying vec3 vN, vV, vOp; void main() { vec3 p = vOp; float nv = abs(dot(normalize(vN), normalize(vV))), toe = ${TOE};
    gl_FragColor = vec4(mix(vec3(0.72, 0.3, 0.0), vec3(1.0, 0.6, 0.06), nv * nv) * mix(1.0, 0.2, toe), 1.0); }` });
const amber86 = () => ({ ...same(look(phys('#ffc860', { roughness: 0.2, specularIntensity: 0.4, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, depthWrite: false }), 'amber86', AMBER86)),
  wall: amberWall86(), bone: phys('#fbe2b0', { roughness: 0.45, emissive: '#ffd8a0', emissiveIntensity: 0.3 }), noEye: true });
// 84 홍칠 (the Meshy fox's legendary): deep red lacquer under a mirror clearcoat, drawn on in thin gold lines (patternTex
// lacq: the line work only, G and B), the flower and leaf faces (R) a shade deeper red. Triplanar in pattern space, sized and
// placed as tools/pilot72.js lays it on the same body; the gold reflects the studio
const LACQUER = `vec3 tw = pow(abs(on), vec3(4.0)); tw /= tw.x + tw.y + tw.z; vec3 tp = p * 1.467 + vec3(-0.040, 0.05, 0.3);
  vec3 ink = texture2D(uPat, tp.zy * vec2(sign(on.x), 1.0) + vec2(0.37, 0.11)).rgb * tw.x + texture2D(uPat, tp.xz + vec2(0.61, 0.29)).rgb * tw.y + texture2D(uPat, tp.xy * vec2(sign(-on.z), 1.0)).rgb * tw.z;
  float gv = max(ink.g, ink.b), gw = clamp(fwidth(gv), 0.03, 0.3), fw = clamp(fwidth(ink.r), 0.03, 0.3);
  float gold = smoothstep(0.38 - gw, 0.38 + gw, gv), face = smoothstep(0.4 - fw, 0.4 + fw, ink.r) * (1.0 - gold);
  diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.3 * face), vec3(1.0, 0.7, 0.25), gold);
  roughnessFactor = mix(roughnessFactor, 0.2, gold); metalnessFactor = mix(metalnessFactor, 1.0, gold); lookStudio = mix(lookStudio, 0.85, gold);`;
// ---- 안킬로사우루스 두 안 (A 공작석, B 청동) ----
// A 공작석 갑옷: polished malachite, bands of deep and pale green round nodules (cells), wavy; uK darker for the armour knobs; the club gold
const MALACHITE = `float w = fbm3(p * 3.0 + 2.0); vec3 c = cells(p * 2.2 + 0.7 + 0.35 * w); float r = (c.x + 0.25 * w) * 7.0 + c.z * 3.0 + 0.3 * fbm3(p * 9.0);
  vec3 col = mix(vec3(0.0, 0.16, 0.07), vec3(0.12, 0.55, 0.3), smoothstep(0.15, 0.95, 0.5 + 0.5 * sin(r * 6.2832))) * uK;
  diffuseColor.rgb = col; roughnessFactor = 0.12;
  totalEmissiveRadiance += col * 0.06 + vec3(0.4, 1.0, 0.7) * 0.05 * pow(1.0 - nv, 2.0);`;
// B 청동 갑옷: an old bronze cast: verdigris (blue-green patina, mottled) with patches rubbed back to polished bronze (studio reflection);
// the armour knobs and the club all polished bronze
const VERDIGRIS = `float n = fbm3(p * 6.0 + 2.0), m = smoothstep(0.58, 0.72, fbm3(p * 3.0 - 1.0));
  diffuseColor.rgb = mix(vec3(0.07, 0.32, 0.26) * (0.6 + 0.8 * n), vec3(0.62, 0.36, 0.14), m); metalnessFactor = m; roughnessFactor = mix(0.7, 0.22, m); lookStudio = m * 0.8;`;
// ---- 프테라노돈 두 안 (A 선스톤, B 폭풍) ----
// A 선스톤: peach-orange sunstone, a warm glow inside, full of copper flakes that flash as the angle changes; uK darker parts; the beak gold
const SUNSTONE = `float n = fbm3(p * 3.0 + 1.0); vec3 col = mix(vec3(0.5, 0.07, 0.01), vec3(0.75, 0.2, 0.04), n) * uK;
  vec3 c = cells(p * 55.0); float flake = step(0.25, c.z) * (1.0 - smoothstep(0.14, 0.14 + 1.5 * fwidth(c.x), c.x));
  float flash = smoothstep(0.7, 1.0, fract(c.z * 37.0 + dot(normal, vec3(2.3, 1.7, 3.1)) * 1.3));
  diffuseColor.rgb = mix(col * 0.6, vec3(0.9, 0.45, 0.15), flake * flash); roughnessFactor = 0.14;
  totalEmissiveRadiance += col * (0.08 + 0.25 * pow(nv, 1.5)) + vec3(1.0, 0.55, 0.2) * flake * flash * 1.6;`;
// B 폭풍: dark slate-blue storm cloud, drifting, with glowing electric-blue veins that flicker
const STORM = `float n = fbm3(p * 3.0 + vec3(0.0, uTime * 0.05, 0.0)), v = abs(fbm3(p * 5.0 + 2.0) - 0.5), bolt = 1.0 - smoothstep(0.0, 0.018 + fwidth(v), v);
  float fl = 0.55 + 0.45 * sin(uTime * 3.0 + p.x * 9.0) * sin(uTime * 1.7 + p.y * 5.0);
  diffuseColor.rgb = mix(vec3(0.02, 0.025, 0.06), vec3(0.08, 0.1, 0.2), n); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.5, 1.0), bolt); roughnessFactor = 0.25;
  totalEmissiveRadiance += vec3(0.15, 0.6, 1.0) * bolt * fl * 1.6 + vec3(0.3, 0.45, 0.9) * 0.12 * pow(1.0 - nv, 2.0);`;
// polished metal in the studio reflection (inbox 10: gold horns and hooves, the rose gold flamingo, onyx)
const shine = (hex, rough = 0.15) => look(phys(hex, { roughness: rough, metalness: 1 }), 'shine', '', {}, { studio: 0.85 });

const glaze = (col, key, body) => look(phys(col, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.015, specularIntensity: 1 }), key, body);
// ---- 별자리 거북 (103, public) and its helpers. The other 89-4~111 looks (from docs/concepts/Tier_fox_rex.jpg, Legends8.jpg)
// were dropped in 114 (user 2026-11-17); they are in git 598fc3a. SH: a crisp edge at t, a pixel or two wide;
// GILD: gold leaf where k (polished, in the studio's reflection: the look needs o.studio)
const SH89 = '#define SH(v, t) smoothstep((t) - clamp(fwidth(v), 0.03, 0.3), (t) + clamp(fwidth(v), 0.03, 0.3), v)\n';
const GILD89 = '#define GILD(k) { float gk = (k); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.57, 0.1), gk); roughnessFactor = mix(roughnessFactor, 0.2, gk); metalnessFactor = mix(metalnessFactor, 1.0, gk); lookStudio = mix(lookStudio, 0.85, gk); totalEmissiveRadiance *= 1.0 - 0.9 * gk; }\n';
// 97: habitat.js sets HAB89 to 1 round its own render (0 for its photos and every other render: the codex, the cabinet,
// postcards = the full look); a look wrapped in hab89 can drop its fine detail there
export const HAB89 = { value: 0 };
const hab89 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.uHab = HAB89; sh.fragmentShader = 'uniform float uHab;\n' + sh.fragmentShader; }; return m; };
// 100: a bold cloud motif (motif100: one cloud, white on black, 2 : 1) laid flat on a flank: CLOUD(q), q from (-1, -0.5) to (1, 0.5)
// over the drawing (black outside it); SH(CLOUD(q), 0.45) its crisp edge
const CLOUD100 = '#define CLOUD(q) texture2D(uMotif, clamp((q) * vec2(0.5, 1.0) + 0.5, 0.0, 1.0)).r\n';
// 별자리 거북 (L5)'s shell (100): four constellations (stars joined by thin gold lines) round the dome, the stars glowing; a few
// small stars between them (not in the habitat). s: the direction from inside the shell, on a sphere
// 101: the cross (read as a cross / plus sign) now a triangle with a tail, the W an uneven rising chain (no letters); the lines gold
// (a little gold glow only: they read white), the stars as bright as before
const STAR100 = (() => {
  const shapes = [[[[0, 0], [0.14, 0.03], [0.27, 0], [0.38, 0.06], [0.42, 0.2], [0.3, 0.25]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 3]]],
    [[[0, 0], [0.09, 0.12], [0.22, 0.09], [0.3, 0.2], [0.44, 0.15]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
    [[[0, 0], [0.12, 0.1], [0.24, 0.02], [0.12, -0.1], [0.32, -0.12]], [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]]],
    [[[0, 0.12], [0.16, 0.21], [0.11, 0.01], [0.25, -0.06], [0.4, -0.03]], [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4]]]];
  const groups = [[0.3, 1.15, 0.3], [2.6, 0.75, -0.4], [1.45, 0.55, 0.2], [-1.5, 0.6, -0.2]]; // az (0 = to the head), elevation, turn
  const v3 = a => `vec3(${a.map(x => x.toFixed(4)).join(', ')})`, nrm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let g = '';
  groups.forEach(([az, el, rot], i) => {
    const c = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)], t1 = nrm(cross([0, 1, 0], c)), t2 = cross(c, t1), [pts, segs] = shapes[i];
    const st = pts.map(([x, y]) => { const a = 1.5 * (x - 0.2), b = 1.5 * (y - 0.06), u = a * Math.cos(rot) - b * Math.sin(rot), v = a * Math.sin(rot) + b * Math.cos(rot); return nrm(c.map((k, j) => k + u * t1[j] + v * t2[j])); });
    for (const a of st) g += `ds = min(ds, distance(s, ${v3(a)}));\n`;
    for (const [a, b] of segs) g += `{ vec3 n = ${v3(nrm(cross(st[a], st[b])))}; if (dot(cross(${v3(st[a])}, s), n) > 0.0 && dot(cross(s, ${v3(st[b])}), n) > 0.0) dl = min(dl, abs(dot(s, n))); }\n`;
  });
  return SH89 + GILD89 + `vec3 s = normalize((p - vec3(-0.2, 0.3, 0.0)) / vec3(0.75, 0.6, 0.6)); float ds = 9.0, dl = 9.0;\n${g}
  float px = length(fwidth(s)), lw = max(0.012, 0.6 * px), ln = 1.0 - smoothstep(lw - px, lw + px, dl), core = 1.0 - smoothstep(0.022 - px, 0.022 + px, ds);
  GILD(max(ln, core)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.5, 0.06), ln * (1.0 - core)); lookStudio *= 1.0 - 0.8 * ln;
  totalEmissiveRadiance += vec3(1.0, 0.5, 0.08) * ln * 0.45 + vec3(1.0, 0.78, 0.42) * (core * 4.0 + 1.5 * pow(smoothstep(0.09, 0.0, ds), 2.0));
  if (uHab < 0.5) { vec3 c = cells(s * 16.0); totalEmissiveRadiance += vec3(1.0, 0.9, 0.7) * 3.0 * (1.0 - smoothstep(0.03, 0.03 + 1.5 * fwidth(c.x), c.x)) * step(0.75, c.z); }`;
})();
// 별자리 거북 (L5)'s rim (100): a gold band (gold edges, gold cloud scrolls round it between them, as the public coral's gold rim);
// 101: 15 scrolls round instead of 18, smaller, clear of the edges (squeezed and run together they read as letters from afar),
// their spacing and width a little irregular, each a little up or down; the gold edges moved to where the band shows (v -0.12 .. 0.44; at 0.75 they were out of sight)
// the legs: a small gold cloud on each side of each leg
const RIM100 = SH89 + GILD89 + CLOUD100 + `float th = atan(p.z, p.x + 0.2), a = th * 2.3873 + 0.22 * sin(th * 3.0 + 1.0) + 0.08 * sin(th * 7.0 + 2.0), v = (p.y - 0.31) / 0.1;
  float h = fract(sin(floor(a) * 12.9898) * 43758.5);
  GILD(max(SH(CLOUD(vec2((fract(a) * 2.0 - 1.0) / (0.72 + 0.22 * h), (v - 0.15) * 2.2 + 0.12 * (h - 0.5))), 0.45), max(smoothstep(-0.1, -0.14, v), smoothstep(0.42, 0.46, v))));`;
const TBODY100 = SH89 + GILD89 + CLOUD100 + `float u = fract(atan(on.z, on.x) * 0.4775) * 2.0 - 1.0;
  GILD(SH(CLOUD(vec2(u, (p.y - 0.15) / 0.13)), 0.45) * smoothstep(0.32, 0.27, p.y) * (1.0 - smoothstep(0.6, 0.9, abs(on.y))));`;
// ---- 115 시범 (?m89 only: data.js M89 adds them as new slots; nothing public): rabbit and sheep looks made from code, no concept art.
// BUMP115(h, k): tilt the normal by a height h (three.js bump mapping, as FORTUNE), k its depth in world units
const BUMP115 = `#define BUMP115(h, k) { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1); normal = normalize(abs(det) * normal - sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) * (k)); }\n`;
// 솜사탕 토끼: sky blue at the feet into candy pink at the ears, soft and matte; sugar grains that catch the light (gone when
// they would be under a pixel or two, so the habitat sees the plain gradient and no shimmer)
const CANDY115 = BUMP115 + `float g = smoothstep(0.2, 0.8, p.y + 0.04 * sin(p.x * 9.0 + p.z * 7.0));
  vec3 col = mix(vec3(0.36, 0.62, 1.0), vec3(1.0, 0.36, 0.62), g);
  vec3 s = cells(p * 38.0); float vis = 1.0 - smoothstep(0.2, 0.5, fwidth(p.y) * 38.0);
  float gr = (1.0 - smoothstep(0.07, 0.13 + fwidth(s.x), s.x)) * step(0.5, s.z) * vis;
  float tw = pow(0.5 + 0.5 * sin(uTime * 2.0 + s.z * 60.0 + dot(normal, vec3(3.0, 2.0, 1.0)) * 5.0), 4.0);
  diffuseColor.rgb = mix(col, vec3(1.0), 0.6 * gr); roughnessFactor = mix(0.55, 0.12, gr);
  totalEmissiveRadiance += col * (0.05 + 0.25 * pow(1.0 - nv, 1.5)) + vec3(1.0, 0.97, 0.92) * gr * (0.3 + 1.8 * tw);
  if (uHab < 0.5) { // 118 detail (codex, close, photos): spun-sugar fluff in the surface, a second finer sugar dust
    float fl = fbm3(p * vec3(70.0, 22.0, 70.0)); BUMP115(fl, 0.006)
    vec3 s2 = cells(p * 95.0); float g2 = (1.0 - smoothstep(0.05, 0.1 + fwidth(s2.x), s2.x)) * step(0.6, s2.z);
    diffuseColor.rgb *= 0.92 + 0.16 * fl; totalEmissiveRadiance += vec3(1.0, 0.95, 1.0) * g2 * (0.4 + 1.2 * pow(0.5 + 0.5 * sin(uTime * 3.0 + s2.z * 80.0), 6.0)); }`;
// 박하사탕 토끼: glossy white hard candy with red bands spiralling round it (round a vertical axis: a pinwheel where it comes out
// on top), a thin pink line on each side of a band; a little light from inside
const MINT115 = `float u = atan(p.z, p.x + 0.05) / 6.2832 * 7.0 + p.y * 2.4, s = abs(fract(u) - 0.5) * 2.0, w = fwidth(u) * 2.0 + 0.01;
  float red = 1.0 - smoothstep(0.34 - w, 0.34 + w, s), pink = smoothstep(0.5 - w, 0.5 + w, s) * (1.0 - smoothstep(0.62 - w, 0.62 + w, s));
  vec3 col = mix(mix(vec3(1.0, 0.98, 0.96), vec3(1.0, 0.6, 0.7), pink), vec3(0.86, 0.06, 0.18), red);
  diffuseColor.rgb = col; roughnessFactor = 0.08;
  totalEmissiveRadiance += col * (0.05 + 0.12 * pow(1.0 - nv, 2.0));
  if (uHab < 0.5) { // 118 detail: the bands seen again a little deeper inside the candy (shifted along the view), and tiny air bubbles
    vec3 q = p - vdir * 0.035; float u2 = atan(q.z, q.x + 0.05) / 6.2832 * 7.0 + q.y * 2.4, s2 = abs(fract(u2) - 0.5) * 2.0;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.1, 0.2), 0.3 * (1.0 - smoothstep(0.28, 0.4, s2)) * (1.0 - red));
    vec3 b = cells(p * 30.0 - vdir * 0.06); float bub = (1.0 - smoothstep(0.03, 0.06, b.x)) * step(0.82, b.z), ring = smoothstep(0.035, 0.05, b.x) * (1.0 - smoothstep(0.05, 0.07, b.x)) * step(0.82, b.z);
    totalEmissiveRadiance += vec3(1.0) * (bub * 0.15 + ring * 0.5);
    // 120: one more step of candy gloss (a coated sweet): a soft window of light mirrored on top, a bright wet edge
    vec3 rf = reflect(-vdir, normal); float win = smoothstep(0.42, 0.5, rf.y) * (1.0 - smoothstep(0.78, 0.86, rf.y)) * smoothstep(-0.2, 0.3, rf.z);
    totalEmissiveRadiance += vec3(1.0, 0.99, 0.97) * (0.55 * win + 0.22 * pow(1.0 - nv, 3.0)); }`;
// 반딧불 토끼: dusk teal velvet, a little lighter on the back, with round cream dots; by night (uNight) each dot lights
// yellow-green with a soft halo, each breathing on its own beat
const FIREFLY115 = `vec3 col = mix(vec3(0.1, 0.2, 0.26), vec3(0.24, 0.4, 0.42), smoothstep(0.1, 0.9, p.y));
  vec3 c = cells(p * 7.0 + 1.7); float r = 0.17 + 0.07 * c.z, w = fwidth(c.x), on1 = step(0.25, c.z);
  float d = on1 * (1.0 - smoothstep(r - w, r + w, c.x)), halo = on1 * (1.0 - smoothstep(r, r * 2.8, c.x));
  float pulse = 0.55 + 0.45 * sin(uTime * (1.1 + c.z) + c.z * 40.0);
  float day = 1.0 - smoothstep(0.1, 0.5, uNight); // 120: by day the dots a little milky and lifted, a velvet sheen on the edges
  diffuseColor.rgb = mix(col, mix(vec3(0.98, 0.94, 0.64), vec3(1.0, 0.98, 0.9), 0.55 * day), d); roughnessFactor = 0.65;
  totalEmissiveRadiance += vec3(0.86, 1.0, 0.36) * (d * (0.12 + uNight * 2.4 * pulse) + halo * uNight * 0.45 * pulse) + col * uNight * 0.12
    + day * (vec3(1.0, 0.99, 0.92) * d * 0.16 + vec3(0.55, 0.82, 0.78) * pow(1.0 - nv, 2.2) * 0.3);
  if (uHab < 0.5) { // 118 detail: velvet mottle, each dot with a bright core and a soft rim, a fine pollen of tiny lights
    float m = fbm3(p * 26.0); diffuseColor.rgb *= mix(0.86 + 0.28 * m, 1.0, d);
    float core = d * (1.0 - smoothstep(0.0, r, c.x)); vec3 t = cells(p * 42.0 + 3.1); float pol = (1.0 - smoothstep(0.03, 0.06 + fwidth(t.x), t.x)) * step(0.72, t.z) * (1.0 - d);
    totalEmissiveRadiance += vec3(1.0, 1.0, 0.7) * core * (0.25 + uNight * 2.0 * pulse) + vec3(0.7, 1.0, 0.5) * pol * (0.25 + 1.2 * uNight) * (0.5 + 0.5 * sin(uTime * 2.3 + t.z * 70.0)); }`;
// 뭉게구름 양: white wool in round cloud lumps (bump), cool lilac in the hollows and underneath, bright on top; a warm gold edge
// (Fresnel) strongest at sunset (uNight about 0.15, daylight.js TIMES), a faint one by day, a silver one by night
const CLOUD115 = BUMP115 + `vec3 c = cells(p * 6.5 + 0.7); float h = 1.0 - smoothstep(0.0, 0.9, c.x);
  float lit = clamp(0.55 * h + 0.7 * p.y, 0.0, 1.0), e = pow(1.0 - nv, 1.8);
  diffuseColor.rgb = mix(vec3(0.42, 0.48, 0.92), vec3(1.0, 0.99, 0.97), smoothstep(0.3, 0.9, lit)); roughnessFactor = 0.8;
  BUMP115(h, 0.05 * (1.0 - smoothstep(0.3, 0.8, fwidth(p.y) * 6.5)))
  float dusk = smoothstep(0.03, 0.13, uNight) * (1.0 - smoothstep(0.35, 0.7, uNight));
  // 120 「노을 받은 구름」: the gold only on the side facing the sun (a wash over that side, brighter at its edge), not a rim round every lump
  ${SUN} float sunSide = smoothstep(0.0, 0.6, sun), gold = dusk * sunSide;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(1.0, 0.7, 0.36), 0.75 * gold);
  totalEmissiveRadiance += vec3(1.0, 0.98, 0.95) * 0.06 + vec3(1.0, 0.56, 0.18) * (gold * (0.3 + 1.4 * e) + 0.3 * e * sunSide * (1.0 - dusk)) + vec3(0.7, 0.78, 1.0) * e * 0.5 * uNight;
  if (uHab < 0.5) { // 118 detail: small puffs on the big lumps and a soft fluff sheen, the edge a touch wispy
    float sm = fbm3(p * 26.0), fz = vn3(p * 140.0); BUMP115(sm + 0.15 * fz, 0.014)
    diffuseColor.rgb *= 0.94 + 0.1 * sm; totalEmissiveRadiance += vec3(1.0, 0.98, 1.0) * e * 0.12 * fz; }`;
// 뜨개 니트 양: a chunky knit sweater: columns of V stitches, rows in rings round the body (red and navy stripe rows on cream),
// each row raised (bump) with dark gaps. Round the body the columns follow the angle; on the chest and the tail end (where that
// angle would stretch them) they are laid flat across instead; they fade to flat colour when too small to see, the stripes stay
const KNIT115 = BUMP115 + `#define KST115(A, V, H, VV) { float fu_ = fract(A) - 0.5; VV = (V) + abs(fu_) * 0.9; float fv_ = fract(VV); H = sqrt(max(sin(3.1416 * fv_), 0.0)) * smoothstep(0.02, 0.1, abs(fu_)) * (1.0 - 0.6 * smoothstep(0.38, 0.5, abs(fu_))); }
  float ha, hx, va, vx, wx = smoothstep(0.55, 0.8, abs(on.x)); KST115(atan(p.z, p.y - 0.58) / 6.2832 * 26.0, p.x * 14.0, ha, va) KST115(p.z * 14.0, p.y * 14.0, hx, vx)
  float h = mix(ha, hx, wx), v = mix(va, p.x * 14.0, wx), row = floor(v);
  float vis = 1.0 - smoothstep(0.35, 0.8, fwidth(p.x * 14.0) + fwidth(p.y * 14.0));
  float k = mod(row, 6.0); vec3 col = k < 1.0 ? vec3(0.8, 0.13, 0.16) : k > 2.5 && k < 3.5 ? vec3(0.13, 0.2, 0.44) : vec3(0.96, 0.9, 0.78);
  diffuseColor.rgb = col * mix(1.0, 0.55 + 0.45 * h, vis); roughnessFactor = 0.9;
  BUMP115(h, 0.025 * vis)
  if (uHab < 0.5) { // 118 detail: a soft wool fuzz over the stitches, a little deeper shade in the gaps
    float fz = vn3(p * 160.0); BUMP115(h + 0.1 * fz, 0.01 * vis)
    diffuseColor.rgb *= mix(1.0, 0.85 + 0.15 * smoothstep(0.0, 0.5, h), vis); totalEmissiveRadiance += col * pow(1.0 - nv, 2.0) * 0.12 * fz; }`;
// 밤하늘 양: navy wool (soft mottle, lighter on top) with small stars and a few bigger ones twinkling; by night the stars and
// a blue edge light up. Stars too small to see fade out (the big ones carry at home distance)
const NIGHTSKY115 = `vec3 col = mix(vec3(0.05, 0.07, 0.2), vec3(0.14, 0.18, 0.42), smoothstep(0.2, 0.95, p.y)) * (0.85 + 0.3 * fbm3(p * 5.0));
  vec3 s = cells(p * 12.0), b = cells(p * 5.0 + 2.0);
  float star = (1.0 - smoothstep(0.05, 0.09 + fwidth(s.x), s.x)) * step(0.3, s.z) * (1.0 - smoothstep(0.3, 0.7, fwidth(p.y) * 12.0));
  float big = (1.0 - smoothstep(0.07, 0.12 + fwidth(b.x), b.x)) * step(0.5, b.z) * (0.6 + 0.4 * sin(uTime * 2.0 + b.z * 50.0));
  diffuseColor.rgb = mix(col, vec3(1.0, 0.95, 0.8), max(star, big)); roughnessFactor = 0.85;
  totalEmissiveRadiance += col * 0.15 + vec3(1.0, 0.95, 0.82) * (star * 0.8 + big * 1.6) * (1.0 + 1.5 * uNight) + vec3(0.4, 0.55, 1.0) * pow(1.0 - nv, 2.5) * 0.5 * uNight;
  if (uHab < 0.5) { // 118 detail: a milky way band across the back (dust and violet glow), star dust too fine for the habitat
    float mw = exp(-pow(dot(p - vec3(0.0, 0.62, 0.0), normalize(vec3(0.45, 1.0, 0.6))) * 6.0, 2.0)) * (0.55 + 0.45 * fbm3(p * 9.0));
    vec3 t = cells(p * 46.0 + 5.0); float dust = (1.0 - smoothstep(0.03, 0.06 + fwidth(t.x), t.x)) * step(0.45 - 0.35 * mw, t.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.26, 0.6), 0.45 * mw);
    totalEmissiveRadiance += vec3(0.55, 0.45, 1.0) * mw * (0.25 + 0.3 * uNight) + vec3(1.0, 0.96, 0.9) * dust * (0.6 + 1.0 * uNight); }`;
// ---- 116 신수 구미호 ①②③ (?m89, inbox 116; no concept): the 116 arctic fox with nine brush tails of its own (MODELS legend
// pilot89_gumiho116: tools/bake-pilot89.mjs gumiho). _thickness = tail x 2 + how far along it (0 on the body): each tail sways on
// its own beat, most at the tip; vTail (0 body .. 1 tip) lets a look colour the tips
const SWAY116 = `vec3 sway116(float ti, float t) { float w = pow(smoothstep(0.1, 1.0, t), 1.6);
  return w * (vec3(0.0, 0.06, 0.0) * sin(uTime * (1.0 + 0.12 * ti) + ti * 2.1) + vec3(0.02, 0.0, 0.07) * sin(uTime * (0.8 + 0.1 * ti) + ti * 1.3)); }\n`;
// still: vTail 0, no sway (the legs)
const sway116 = (m, still) => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.uTime = windTime;
    sh.vertexShader = 'uniform float uTime;\nattribute float _thickness;\nvarying float vTail;\n' + SWAY116 + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n{ float ti = floor(_thickness * 0.5); vTail = _thickness - 2.0 * ti; transformed += sway116(ti, vTail); }');
    sh.fragmentShader = 'varying float vTail;\n' + sh.fragmentShader; };
  m.customProgramCacheKey = () => k + (still ? '-still116' : '-sway116'); return m; };
const pale116 = m => { m.userData.pale = true; return m; }; // white: the sky's green out of its ambient light (unGreen)
// a fine glint that turns with the view (codex only, uHab 0): GLITTER116(scale, colour, amount)
const GLITTER116 = `#define GLITTER116(S, C, A) { vec3 gc = cells(p * (S)); totalEmissiveRadiance += (C) * (A) * (1.0 - uHab) * step(0.9, gc.z) * (1.0 - smoothstep(0.05, 0.05 + 1.5 * fwidth(gc.x), gc.x)) * pow(max(0.0, sin(dot(normal, vec3(11.0, 8.0, 6.0)) + gc.z * 50.0)), 8.0); }\n`;
// ① 여우불: white; each tail from half way a soft sky blue, violet at the very end, a little glow by night;
// codex: a thin pearl film on the tips that shifts with the view, frost glints on them
const FOXFIRE116 = GLITTER116 + `float tl = smoothstep(0.42, 1.0, vTail), vt = smoothstep(0.72, 1.0, vTail);
  vec3 tip = mix(vec3(0.55, 0.76, 1.0), vec3(0.66, 0.5, 1.0), vt);
  diffuseColor.rgb = mix(diffuseColor.rgb, tip, tl * 0.8);
  totalEmissiveRadiance += tip * tl * tl * (0.06 + 0.4 * uNight);
  if (uHab < 0.5) { vec3 film = 0.5 + 0.5 * cos(6.2832 * (nv * 1.6 + p.y * 0.8 + vec3(0.0, 0.33, 0.67)));
    totalEmissiveRadiance += film * pow(1.0 - nv, 2.0) * tl * 0.22; GLITTER116(90.0, vec3(0.85, 0.92, 1.0), 3.0 * tl) }`;
// ② 방울: moon silver (blue-grey below, brighter on the back, a silver-blue rim, by night a moonlit edge); codex: moon dust
const SILVER116 = GLITTER116 + `float rim = pow(1.0 - nv, 2.4);
  diffuseColor.rgb *= mix(vec3(0.8, 0.83, 0.92), vec3(1.0), smoothstep(0.2, 0.75, p.y));
  totalEmissiveRadiance += vec3(0.72, 0.8, 1.0) * rim * (0.12 + 0.55 * uNight);
  GLITTER116(110.0, vec3(0.9, 0.94, 1.0), 2.2)`;
// the bell: polished gold, a ridge round its middle, a slot across its foot ending in a round hole (on: its own normal);
// codex: gold sparkle
const BELL116 = `float d = abs(on.y + 0.05), slot = (1.0 - smoothstep(0.1, 0.14, abs(on.z))) * smoothstep(-0.45, -0.6, on.y), hole = smoothstep(-0.9, -0.97, on.y), cut = max(slot, hole);
  diffuseColor.rgb *= 1.0 - 0.45 * (1.0 - smoothstep(0.03, 0.06, d));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.02, 0.0), cut); roughnessFactor = mix(roughnessFactor, 0.9, cut); metalnessFactor = 1.0 - cut;
  if (uHab < 0.5) { vec3 gc = cells(p * 160.0); totalEmissiveRadiance += vec3(1.0, 0.85, 0.5) * 4.0 * (1.0 - cut) * step(0.7, gc.z) * (1.0 - smoothstep(0.08, 0.3, gc.x)) * pow(max(0.0, sin(dot(normal, vec3(11.0, 8.0, 6.0)) + gc.z * 50.0)), 8.0); }`;
// ③ 여우구슬: pearl white (a faint film of pink, gold and sky at the edges that moves with the view), the tips a breath of pink;
// codex: nacre (soft cloudy flecks of the film all over)
const PEARL116 = `float tl = smoothstep(0.55, 1.0, vTail); vec3 film = 0.5 + 0.5 * cos(6.2832 * (nv * 1.3 + p.y * 0.6 + vec3(0.0, 0.33, 0.67)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.8, 0.88), tl * 0.75);
  totalEmissiveRadiance += film * pow(1.0 - nv, 2.5) * 0.2;
  if (uHab < 0.5) { float n = fbm3(p * 14.0); totalEmissiveRadiance += film * smoothstep(0.55, 0.8, n) * 0.08 + vec3(1.0, 0.95, 0.85) * pow(1.0 - nv, 4.0) * 0.1; }`;
// a look's own parts (figure.js m.parts): the plain fox's body and ear patches (one tail) out, the nine-tailed one (legend) stays;
// the extra parts made once per body file, in a Group (merge leaves them)
const parts116 = (extra, made = new WeakMap()) => (body, G, S) => {
  for (const o of [...body.children]) if (o.geometry === G.body || o.geometry === G.accent) body.remove(o);
  const geo = G.legend.g116body; if (!geo) return;
  if (!made.has(geo)) { geo.computeBoundingBox(); made.set(geo, extra(geo.boundingBox)); }
  const g = new THREE.Group(); for (const [gg, mat, ord] of made.get(geo)) { const o = wear(new THREE.Mesh(gg, mat), ord); o.frustumCulled = false; g.add(o); } body.add(g); };
const tag116 = (g, c, t) => { const n = g.attributes.position.count;
  g.setAttribute('aC', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => c).flat(), 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(new Array(n).fill(t), 1)); return g; };
// three foxfires drifting slowly round the tails (a blue flame, a white heart, a soft glow behind; one draw each)
const FLAME116 = Array.from({ length: 14 }, (_, i) => { const t = i / 13; return new THREE.Vector2(Math.max(0.001, 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.05)), 0.7) * (1 - t * 0.6)), t); });
const DRIFT116 = `uniform float uTime, uR, uK; attribute vec3 aC; attribute float aT;
vec3 drift116(float i) { float t = uTime * 0.3 + i * 2.09; return aC + vec3(cos(t), 0.5 * sin(t * 1.6 + i), sin(t)) * uR; }\n`;
const flameMat116 = (inner, k) => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uR: { value: k * 0.9 }, uK: { value: k } }, transparent: true, depthWrite: false, blending: inner ? THREE.AdditiveBlending : THREE.NormalBlending,
  vertexShader: DRIFT116 + `varying float vY; varying vec3 vN, vV;
    void main() { vec3 p = position; vY = p.y; float s = p.y * p.y, u = uTime${inner ? ' * 1.1 + 1.3' : ''} + aT * 1.7;
      p.x += sin(u * 7.0 + p.y * 9.0) * 0.06 * s; p.z += cos(u * 6.0 + p.y * 8.0) * 0.05 * s; p.y *= 1.0 + 0.08 * sin(u * 9.0);
      vec4 mv = modelViewMatrix * vec4(drift116(aT) + p * uK * ${inner ? 'vec3(0.5, 0.62, 0.5)' : 'vec3(1.0, 1.25, 1.0)'}, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vY; varying vec3 vN, vV;
    void main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6), y = clamp(vY, 0.0, 1.0);
      vec3 c = ${inner ? 'mix(vec3(0.9, 0.97, 1.0), vec3(0.55, 0.7, 1.0), y)' : 'mix(vec3(0.3, 0.55, 1.0), vec3(0.5, 0.35, 1.0), y)'};
      gl_FragColor = ${inner ? 'vec4(c * f * (1.0 - y * 0.75) * 1.3, 1.0)' : 'vec4(c, clamp(f * 1.6, 0.0, 1.0) * (1.0 - y * 0.55))'}; }` });
const glow116 = (vs, k, size, col) => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uR: { value: k * 0.9 }, uK: { value: k }, uNight: nightGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: vs + `varying vec2 vUv; void main() { vec4 mv = modelViewMatrix * vec4(${size[0]}, 1.0); mv.xy += position.xy * uK * ${size[1]}; vUv = uv; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uNight; varying vec2 vUv;
    void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(${col}) * (0.45 + 0.5 * uNight) * pow(max(0.0, 1.0 - r), 2.2), 1.0); }` });
const foxfire116 = parts116(b => {
  const sz = b.getSize(new THREE.Vector3()), k = 0.11 * b.max.y, at = (x, y, z) => [b.min.x + x * sz.x, y * b.max.y, z * sz.z / 2];
  const C = [at(0.05, 0.98, 0.7), at(0.0, 0.62, -0.8), at(0.3, 1.08, -0.3)];
  const each = mk => mergeGeometries(C.map((c, i) => tag116(mk(), c, i)));
  return [[each(() => new THREE.PlaneGeometry(1, 1)), glow116(DRIFT116, k, ['drift116(aT) + vec3(0.0, 0.35 * uK, 0.0)', '2.6'], '0.35, 0.5, 1.0'), 5],
    [each(() => new THREE.LatheGeometry(FLAME116, 16)), flameMat116(false, k), 5], [each(() => new THREE.LatheGeometry(FLAME116, 12)), flameMat116(true, k), 5]];
});
// the fox bead: a pearl hovering before the chest, bobbing and circling a little; a warm light turning inside it (codex: a
// second swirl crossing it and a travelling spark), a soft glow round it, stronger by night
const BEAD116 = `uniform float uTime, uK; attribute vec3 aC; attribute float aT; vec3 hover116() { return aC + vec3(cos(uTime * 0.7) * 0.5, sin(uTime * 1.1) * 0.45, sin(uTime * 0.7) * 0.5) * uK; }\n`;
const beadMat116 = k => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uK: { value: k }, uNight: nightGlow, uHab: HAB89 },
  vertexShader: BEAD116 + `varying vec3 vN, vV, vO; void main() { vO = normal; vec4 mv = modelViewMatrix * vec4(hover116() + position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime, uNight, uHab; varying vec3 vN, vV, vO;
    void main() { vec3 n = normalize(vN); float nv = clamp(dot(n, normalize(vV)), 0.0, 1.0), fr = pow(1.0 - nv, 2.0);
      float a = atan(vO.z, vO.x), sw = 0.5 + 0.5 * sin(a * 2.0 + vO.y * 4.0 - uTime * 1.3), sw2 = uHab > 0.5 ? 1.0 : 0.6 + 0.8 * (0.5 + 0.5 * sin(a * 3.0 - vO.y * 6.0 + uTime * 0.9));
      vec3 film = 0.5 + 0.5 * cos(6.2832 * (nv * 1.2 + vec3(0.0, 0.33, 0.67)));
      vec3 c = vec3(1.0, 0.96, 0.9) * (0.62 + 0.25 * n.y) + vec3(1.0, 0.78, 0.4) * pow(nv, 3.0) * (0.3 + 0.35 * sw * sw2 + 0.5 * uNight) + film * fr * 0.45;
      if (uHab < 0.5) c += vec3(1.0, 0.95, 0.85) * pow(max(0.0, sin(dot(vO, vec3(9.0, 7.0, 5.0)) + uTime * 2.0)), 40.0) * 0.8;
      gl_FragColor = vec4(c, 1.0); }` });
const bead116 = parts116(b => {
  const h = b.max.y, k = 0.1 * h / 2.3, c = [b.max.x + 0.0 * h, 0.47 * h, 0];
  return [[tag116(new THREE.SphereGeometry(k, 32, 24), c, 0), beadMat116(k), 2], [tag116(new THREE.PlaneGeometry(1, 1), c, 0), glow116(BEAD116, k, ['hover116()', '5.0'], '1.0, 0.82, 0.55'), 5]];
});
const plain116 = parts116(() => []); // just the plain fox's body out
// the body material twice: on the tails (swaying) and on the legs (still: their _thickness is the wall's, not a tail's)
const gumiho116 = (mk, accent, more) => ({ body: sway116(hab89(mk()), true), g116body: sway116(hab89(mk())), g116cord: sway116(hab89(mk())), accent, g116accent: sway116(accent.clone()), beak: toyMat('#2a2628'), ...more });
// ---- 125-D 신수 구미호 다시 (?m89, inbox 125 D; 116·121 dropped). MODELS legend pilot89_gumiho125 (tools/bake-pilot89.mjs
// gumiho125: nine long flame-brush tails in three layers). 안1 gumiho125a: red cord and gold bell on the three outer tails;
// 안2 gumiho125b: none. Both: 1.25x the fox (a wrapper round the body: pose() still scales the body itself), a red flick from
// each eye's corner up toward the ear and a flame on the brow (painted in model space: each body file its own material, the
// eye from G.eye), gold eyes with a slit, red-rose inner ears, the tips white -> lilac -> blue and lit (more by night), a soft
// glow on each tip, three blue foxfires circling the body and a faint ring of light at the feet
const SWAY125 = `vec3 sway125(float ti, float t) { float w = pow(smoothstep(0.06, 1.0, t), 1.5), ph = uTime * (0.62 + 0.08 * ti) + ti * 2.3 - t * 2.4;
  return w * (vec3(0.0, 0.09, 0.0) * sin(ph) + vec3(0.04, 0.0, 0.12) * sin(ph * 0.83 + ti * 1.1)); }\n`; // a slow wave running out along each tail, its own beat
// one: all the tails on one beat (132's blades meet: their own beats would tear the seams)
const sway125 = (m, still, one) => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.uTime = windTime;
    sh.vertexShader = (sh.vertexShader.includes('uniform float uTime;') ? '' : 'uniform float uTime;\n') + 'attribute float _thickness;\nvarying float vTail, vTi;\n' + SWAY125 + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\n{ float ti = floor(_thickness * 0.5); vTail = _thickness - 2.0 * ti; vTi = ti;${still ? ' vTail = 0.0;' : ` transformed += sway125(${one ? '4.0' : 'ti'}, vTail);`} }`);
    sh.fragmentShader = 'varying float vTail, vTi;\n' + sh.fragmentShader; };
  m.customProgramCacheKey = () => k + (still ? '-still125' : one ? '-one125' : '-sway125'); return m; };
// the tips: white to lilac from half way, blue at the very end, lit a little by day and more by night; codex: 116's film and frost
const TAIL125 = GLITTER116 + `float tl = smoothstep(0.5, 1.0, vTail), vt = smoothstep(0.76, 1.0, vTail);
  vec3 tip = mix(vec3(0.62, 0.48, 1.0), vec3(0.22, 0.46, 1.0), vt);
  diffuseColor.rgb = mix(diffuseColor.rgb, tip, tl * 0.88);
  totalEmissiveRadiance += tip * pow(tl, 1.5) * (0.2 + 0.75 * uNight);
  if (uHab < 0.5) { vec3 film = 0.5 + 0.5 * cos(6.2832 * (nv * 1.6 + p.y * 0.8 + vec3(0.0, 0.33, 0.67)));
    totalEmissiveRadiance += film * pow(1.0 - nv, 2.0) * tl * 0.2; GLITTER116(90.0, vec3(0.85, 0.92, 1.0), 3.0 * tl) }`;
// the face (model space q; uEye = the +z eye's centre, uFace = H, cx, scale): a red flick from above the eye's front, along its
// top and up and back toward the ear, tapering to a point; a three-tongued flame on the brow. Crisp edges (fwidth)
const FACE125 = `{ vec3 q = vec3(p.x * uFace.x + uFace.y, p.y * uFace.x, abs(p.z) * uFace.x), E = uEye; float s = uFace.z, mk = 0.0;
  vec2 d = (q.xy - E.xy) / s - vec2(0.035, 0.055), dir = normalize(vec2(-0.97, 0.24));
  float u = dot(d, dir), v = dot(d, vec2(dir.y, -dir.x)) - 1.9 * max(u, 0.0) * max(u, 0.0), L = 0.2;
  float w = u < 0.0 ? 0.026 * sqrt(max(0.0, 1.0 - u * u / 0.0007)) : 0.026 * pow(max(0.0, 1.0 - u / L), 0.8);
  float dd = abs(v) - w + 0.003; mk = max(mk, (1.0 - smoothstep(-fwidth(dd), fwidth(dd), dd)) * smoothstep(0.25, 0.4, abs(on.z)));
  float fu = (q.y - E.y) / s - 0.05, fz = q.z / s, h = 0.2;
  float u1 = fu / h, w1 = u1 < 0.0 ? 0.048 * sqrt(max(0.0, 1.0 - u1 * u1 / 0.09)) : 0.048 * pow(max(0.0, 1.0 - u1), 1.1);
  float u2 = (fu - 0.02) / (h * 0.5), w2 = u2 < 0.0 ? 0.0 : 0.022 * pow(max(0.0, 1.0 - u2), 1.1) * sqrt(min(1.0, u2 * 4.0));
  float f = min(fz - w1, abs(fz - 0.052 - 0.04 * max(u2, 0.0)) - w2) + 0.003; // + 0.003: no hairline where a width runs out to 0
  mk = max(mk, (1.0 - smoothstep(-fwidth(f), fwidth(f), f)) * step(E.x - 0.25 * s, q.x) * smoothstep(0.1, 0.3, on.x + on.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.03, 0.04), mk); totalEmissiveRadiance *= 1.0 - mk; totalEmissiveRadiance += vec3(0.5, 0.02, 0.03) * mk * 0.25 * uNight; }`;
const tail125 = face => sway125(hab89(look(pale116(phys('#fafaf7', { roughness: 0.55 })), face ? 'face125' : 'tail125', TAIL125 + (face ? FACE125 : ''), face || {})), !face && face !== undefined);
// gold eyes, a dark slit standing in each (from the eye's own normal: no pattern space on the bead)
const EYE125 = (() => { const m = phys('#e9a826', { roughness: 0.12, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vOn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOn = normal;');
    sh.fragmentShader = 'varying vec3 vOn;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 on = normalize(vOn), f = normalize(vec3(0.44, 0.3, 0.85 * sign(on.z))), sd = normalize(cross(vec3(0.0, 1.0, 0.0), f)), up = cross(f, sd);
  float a = dot(on, sd), b = dot(on, up), e = (a * a) / 0.012 + (b * b) / 0.3, k = (1.0 - smoothstep(1.0 - fwidth(e), 1.0 + fwidth(e), e)) * step(0.0, dot(on, f));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.015, 0.01), k); }`); };
  m.customProgramCacheKey = () => 'eye125'; return m; })();
// three foxfires (116's flames) circling the body slowly, a little up and down (an ellipse round the body's middle)
const ORBIT125 = `uniform float uTime, uR, uK; attribute vec3 aC; attribute float aT;
vec3 drift116(float i) { float t = uTime * 0.32 + i * 2.0944; return aC + vec3(cos(t) * uR * 1.3, 0.3 * sin(t * 1.3 + i * 1.7) * uK, sin(t) * uR); }\n`;
const orbit125 = (m, R) => { if (m.vertexShader.startsWith(DRIFT116)) m.vertexShader = ORBIT125 + m.vertexShader.slice(DRIFT116.length); m.uniforms.uR.value = R; return m; };
// a soft glow on each tail tip, swaying with it
const tipMat125 = (k, one) => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uK: { value: k }, uNight: nightGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'uniform float uTime, uK; attribute vec3 aC; attribute float aT; varying vec2 vUv; varying float vI;\n' + SWAY125 +
    `void main() { vec4 mv = modelViewMatrix * vec4(aC + sway125(${one ? '4.0' : 'aT'}, 1.0), 1.0); mv.xy += position.xy * uK; vUv = uv; vI = aT; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime, uNight; varying vec2 vUv; varying float vI;
    void main() { float r = length(vUv - 0.5) * 2.0, a = pow(max(0.0, 1.0 - r), 2.4) * (0.3 + 0.7 * uNight) * (0.85 + 0.15 * sin(uTime * 1.7 + vI * 2.3));
      gl_FragColor = vec4(vec3(0.5, 0.6, 1.0) * a, 1.0); }` });
// the ring at the feet: lies on the ground (outside the body: it does not squash or lie down); blue tint by day, light by night
const ringMat125 = R => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uR: { value: R }, uNight: nightGlow }, transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: 'uniform float uR; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x * uR, 0.0, -position.y * uR, 1.0); }',
  fragmentShader: `uniform float uTime, uNight; varying vec2 vUv;
    void main() { float r = length(vUv - 0.5) * 2.0, a = exp(-pow((r - 0.86) / 0.06, 2.0)) + 0.35 * exp(-pow((r - 0.62) / 0.035, 2.0)) + 0.12 * (1.0 - smoothstep(0.0, 0.86, r));
      a *= 0.85 + 0.15 * sin(uTime * 1.2 - r * 6.0);
      gl_FragColor = vec4(vec3(0.42, 0.6, 1.0) * a * (0.22 + 0.9 * uNight), a * 0.3 * (1.0 - 0.7 * uNight)); }` }); // faint by day
// per body file: its face material, the effect meshes ([geometry, material, renderOrder]) and the ring
const made125 = new WeakMap();
const make125 = (geo, G, S, mk = tail125, one = false) => {
  const b = G.body.boundingBox, H = b.max.y, cx = (b.min.x + b.max.x) / 2, e = G.eye.attributes.position, E = [0, 0, 0]; let n = 0;
  for (let i = 0; i < e.count; i++) if (e.getZ(i) > 0) { E[0] += e.getX(i); E[1] += e.getY(i); E[2] += e.getZ(i); n++; }
  const face = mk({ uEye: new THREE.Color().setRGB(E[0] / n, E[1] / n, E[2] / n), uFace: new THREE.Color().setRGB(H, cx, 1) }, geo);
  const th = geo.attributes._thickness, pos = geo.attributes.position, tip = [];
  for (let i = 0; i < th.count; i++) { const v = th.getX(i), ti = Math.floor(v / 2), t = v - 2 * ti; if (t > 0 && (!tip[ti] || t > tip[ti][1])) tip[ti] = [[pos.getX(i), pos.getY(i), pos.getZ(i)], t]; }
  const k = 0.12 * H, mid = [(b.min.x + b.max.x) / 2 - 0.05 * H, 0.47 * H, 0], fires = mk => mergeGeometries([0, 1, 2].map(i => tag116(mk(), mid, i)));
  const fx = [[fires(() => new THREE.PlaneGeometry(1, 1)), glow116(ORBIT125, k, ['drift116(aT) + vec3(0.0, 0.35 * uK, 0.0)', '2.6'], '0.35, 0.5, 1.0'), 5],
    [fires(() => new THREE.LatheGeometry(FLAME116, 16)), flameMat116(false, k), 5], [fires(() => new THREE.LatheGeometry(FLAME116, 12)), flameMat116(true, k), 5],
    [mergeGeometries(tip.map(([c], i) => tag116(new THREE.PlaneGeometry(1, 1), c, i))), tipMat125(0.45 * k, one), 5]];
  for (const [, m] of fx) if (m.uniforms.uR) orbit125(m, 0.42 * H);
  return { face, fx, ring: [new THREE.PlaneGeometry(2, 2), ringMat125(0.62 * H), 5] };
};
const partsOf = (key, mk, one) => (body, G, S) => {
  for (const o of [...body.children]) if (o.geometry === G.body || o.geometry === G.accent) body.remove(o);
  const geo = G.legend[key]; if (!geo) return;
  if (!made125.has(geo)) made125.set(geo, make125(geo, G, S, mk, one));
  const X = made125.get(geo);
  for (const o of body.children) { if (o.geometry === geo) o.material = X.face; if (o.geometry === G.eye) o.material = EYE125; }
  const g = new THREE.Group(); for (const [gg, mat, ord] of X.fx) { const o = wear(new THREE.Mesh(gg, mat), ord); o.frustumCulled = false; g.add(o); } body.add(g);
  const root = body.parent, w = new THREE.Group(); w.scale.setScalar(1.25); root.remove(body); w.add(body); root.add(w); // 1.25x the fox
  const ring = wear(new THREE.Mesh(X.ring[0], X.ring[1]), X.ring[2]); ring.frustumCulled = false; ring.scale.setScalar(S.s); ring.position.y = 0.012; w.add(ring);
};
const parts125 = partsOf('g125body', tail125);
const gumiho125 = bell => { const tail = tail125(), ear = phys('#e26a72', { roughness: 0.5 });
  return { body: tail125(false), hoof: tail125(false), g125body: tail, g125cord: bell ? sway125(hab89(phys('#c0141e', { roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ff6070') }))) : tail,
    accent: ear, g125accent: ear, beak: toyMat('#2a2628'), parts: parts125,
    ...bell && { g125bell: sway125(hab89(look(phys('#e8b030', { roughness: 0.22, metalness: 1 }), 'bell116', BELL116, {}, { studio: 0.7 }))) } }; };
// ---- 132-B 신수 구미호 3차 (?m89, inbox 132 B; 125d 안2's face, eyes, tips, foxfires and ring). MODELS legend pilot89_gumiho132w|n
// (tools/bake-pilot89.mjs gumiho132: nine carved blades from one root, fanned 150 / 110 deg). Made like the carousel horse: white
// porcelain gloss (clearcoat), each blade's long edges gilt (where its normal turns across the fan: the blade's own fan angle
// from vTi), a red cloud outlined in gold on each flank, a gold necklace (painted in the bake, g132gold) with a gold bell and a
// red tassel, gold ankle bands; no cords on the tails
const P132 = () => pale116(phys('#fbfaf6', { roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.04 }));
// the blades are one surface (they meet in the bake), so their own edges are gone: a gilt line where one blade turns into the
// next, found from the fan angle round the root (uRoot, pattern space): u = the blade number there, a line at each half
const EDGE132 = `{ float u = degrees(atan(p.z - uRoot.z, p.y - uRoot.y)) / (uSpread / 8.0) + 4.0, g = abs(fract(u) - 0.5), w = fwidth(u);
  GILD((1.0 - smoothstep(0.045, 0.045 + 1.5 * w, g)) * smoothstep(0.06, 0.14, vTail) * step(0.001, vTail)) }`;
// the clouds (side view, both flanks, pattern space): three round lobes on a flat foot, red, a gold outline and a gold curl in
// the middle lobe; a big one on the flank, a small one on the haunch. Crisp at any size (their own fwidth, not SH's floor)
const CLOUD132 = `{ float cs = 0.0, side = smoothstep(0.35, 0.55, abs(on.z)) * step(vTail, 0.001);
  for (int k = 0; k < 2; k++) { float sc = k == 0 ? 0.12 : 0.07; vec2 q = (p.xy - (k == 0 ? vec2(0.1, 0.5) : vec2(-0.13, 0.58))) / sc;
    float d = min(min(length(q - vec2(-0.55, 0.0)) - 0.4, length(q - vec2(0.0, 0.2)) - 0.52), length(q - vec2(0.55, 0.0)) - 0.4);
    d = max(d, -(q.y + 0.3)) * sc; float aa = fwidth(d), fill = (1.0 - smoothstep(-aa, aa, d)) * side;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.07, 0.09), fill);
    vec2 c1 = q - vec2(0.0, 0.2); float cu = abs(length(c1) - 0.26) * sc - 0.005, ol = abs(d) - 0.006;
    cs = max(cs, max((1.0 - smoothstep(-fwidth(ol), fwidth(ol), ol)) * side, (1.0 - smoothstep(-fwidth(cu), fwidth(cu), cu)) * step(-0.1, c1.y) * fill)); }
  GILD(cs) }`;
const ANKLE132 = `GILD((1.0 - SH(abs(p.y - 0.075), 0.011)) * step(0.0, p.y))`;
// geo (the legend body): uRoot = where the tails start, the middle of their first few vertices
const root132 = geo => { const th = geo.attributes._thickness, op = geo.attributes._op, r = [0, 0, 0]; let n = 0;
  for (let i = 0; i < th.count; i++) { const v = th.getX(i); if (v > 0 && v - 2 * Math.floor(v / 2) < 0.05) { r[0] += op.getX(i); r[1] += op.getY(i); r[2] += op.getZ(i); n++; } }
  n ||= 1; return new THREE.Color().setRGB(r[0] / n, r[1] / n, 0); }; // z 0: the fan is symmetric (n 0: no tails, no NaN)
const tail132 = spread => (face, geo) => sway125(hab89(look(P132(), face ? 'face132' : 'tail132', SH89 + GILD89 + TAIL125 + (face ? EDGE132 + FACE125 + CLOUD132 : ''),
  { ...face, uSpread: spread, ...face && { uRoot: root132(geo) } }, { studio: 0.2 })), !face && face !== undefined, true);
// 137-C 구미호 4차 (?m89&g132=4, MODELS legend pilot89_gumiho137; bake-pilot89.mjs gumiho137): the same body, but nine round tails
// apart, meeting only at the root, so no gilt lines between them; instead a thin gold rim along each tail's edge (where its surface
// turns away from the eye), from past the root to before the lit tip; each tail on its own beat (they no longer meet)
const RIM137 = `GILD((1.0 - smoothstep(0.34, 0.46, nv)) * smoothstep(0.3, 0.45, vTail) * (1.0 - smoothstep(0.68, 0.85, vTail)))`;
const tail137 = (face, geo) => sway125(hab89(look(P132(), face ? 'face137' : 'tail137', SH89 + GILD89 + TAIL125 + RIM137 + (face ? FACE125 + CLOUD132 : ''), face || {}, { studio: 0.2 })), !face && face !== undefined);
const gumiho132 = (spread, mk = tail132(spread), one = true) => { const ear = phys('#e26a72', { roughness: 0.5 }), legs = hab89(look(P132(), 'leg132', SH89 + GILD89 + ANKLE132, {}, { studio: 0.2 })),
    gold = hab89(look(phys('#e8b030', { roughness: 0.2, metalness: 1 }), 'bell116', BELL116, {}, { studio: 0.7 }));
  return { body: legs, hoof: legs, g132body: mk(), g132gold: hab89(look(phys('#e8b030', { roughness: 0.2, metalness: 1 }), 'gold132', '', {}, { studio: 0.7 })), g132bell: gold,
    g132tassel: phys('#c0141e', { roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ff6070') }), accent: ear, g132accent: ear, beak: toyMat('#2a2628'), parts: partsOf('g132body', mk, one) }; };
const LOOKS = { // c = the colour entry (its values: body, second, tint, ink, ...)
  solid: c => plain(toyBody(c.body), c),
  twotone: c => plain(look(toyBody(c.body), 'twotone', TWOTONE, { uSecond: c.second }), c),
  spots: c => plain(look(toyBody(c.body), 'spots', SPOTS, { uSecond: c.second }), c),
  stripes: c => plain(look(toyBody(c.body), 'stripes', STRIPES, { uSecond: c.second }), c),
  gradient: c => plain(look(toyBody(c.body), 'gradient', GRADIENT, { uSecond: c.second }), c),
  glass: c => same(clear({ key: 'glass', tint: c.tint, neutral: 0.8 })), // clear all over, beak and mane included; grass behind shows grey, not green
  jelly: c => same(jelly('jelly', c.body)),
  amber: c => { const j = jelly('jelly', c.body); return { body: jelly('amber', c.body, { post: LEAF }), accent: j, hoof: j }; },
  glow: c => ({ ...same(look(phys(c.body, { roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.25 }), 'glow', GLOW, { uGlow: c.body })), halo: c.body }),
  glitter: c => same(clear({ key: 'glitter', tint: c.tint, absorb: 1.2, dark: 0.5, rough: 0.1, coat: 1, neutral: 0.5, post: GLITTER, uniforms: { uGlitter: c.glitter } })),
  // glazes: glossier than plastic (thick clearcoat, sharp highlight) + GLINT
  celadon: c => { const accent = glaze(c.accent, 'celadon', CELADON); return { body: glaze(c.body, 'celadon', CELADON), accent, hoof: accent }; },
  bluewhite: c => { const accent = phys(c.ink, { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.015 });
    return { body: look(phys('#ffffff', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.015 }), 'bluewhite', BLUEWHITE, { uMotif: motifTex(c.ink) }), accent, hoof: accent }; },
  najeon: c => same(look(phys(c.body, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.012 }), 'najeon', NAJEON)),
  bubble: c => same(clear({ key: 'bubble', tint: c.tint, absorb: 0.8, dark: 0.45, rough: 0.05, post: BUBBLE, // no clearcoat: that whitened it toward pearl
    extra: { iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 800] } })),
  stained: c => same(clear({ key: 'stained', tint: '#ffffff', absorb: 1.4, dark: 0.3, rough: 0.1, coat: 1, pre: STAINED_PRE, post: STAINED, uniforms: { uA: c.a, uB: c.b, uC: c.c, uD: c.d } })),
  marble: () => same(look(phys('#cdbea6', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'marble', MARBLE, { uVein: '#4d443c' })), // 후보(업데이트용)
  gold: () => { const accent = look(phys('#f1b64a', { roughness: 0.16, metalness: 1 }), 'gold', GOLD); // 후보(업데이트용) + the legendary egg
    return { body: look(phys('#ffc75a', { roughness: 0.13, metalness: 1 }), 'gold', GOLD), accent, hoof: accent }; },
  pearl: () => same(look(phys('#f6efea', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [250, 650], sheen: 1, sheenColor: new THREE.Color('#ffd3e6') }), 'pearl', PEARL)),
  galaxy: () => same(look(phys('#101030', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 }), 'galaxy', GALAXY)),
  jade: () => same(look(phys('#5fb88a', { roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0, sheenColor: new THREE.Color('#d8ffe8') }), 'jade', JADE, {}, { studio: 0 })),
  fortune: () => { const g = shine('#ffc75a');
    return { body: look(phys('#ffc75a', { roughness: 0.15, metalness: 1 }), 'fortune', FORTUNE, { uCloud: cloudTex() }, { studio: 0.85 }), accent: g, hoof: g, beak: shine('#e8a640', 0.3) }; },
  cotton: () => same(look(phys('#ffd0e4', { roughness: 0.75, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }), 'cotton', COTTON)),
  opal: () => { const o = (milk, fire) => look(phys('#f2f2f6', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), 'opal', OPAL, { uMilk: milk, uFire: fire }), g = shine('#ffc75a'),
      cow = acc => look(phys('#f2f2f6', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), 'cowopal', COWOPAL, { uMilk: '#ffffff', uFire: 0.35, uAcc: acc });
    return { body: cow(0), accent: cow(1), // white opal, round black opal patches (COWOPAL)
      beak: o('#ffd6d6', 0.25), nostril: phys('#2a2224', { roughness: 0.15, clearcoat: 1 }), horn: g, hoof: g }; },
  coral: () => { const jade = look(phys('#bfe3c8', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }), 'palejade', PALEJADE);
    return { body: jade, hoof: jade, accent: look(phys('#d93a30', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 }), 'coral', CORAL, {}, { studio: 0 }), horn: shine('#ffc75a') }; },
  moonwater: () => { const o = base => look(phys('#ffffff', { roughness: 0.6 }), 'moonwater', MOONWATER, { uBase: base }), body = o('#28386e');
    return { body, accent: o('#6676a0'), hoof: body, beak: toyMat('#14161e'),
      item: { body: look(phys('#e4ebf6', { roughness: 0.22, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }), 'moonstone', MOONSTONE), accent: body, halo: '#dce6ff' } }; }, // the paws holding it are the otter's
  crystal: () => { const ice = look(phys('#d6e8f8', { roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'frost', FROST), o = { tint: '#cfe6ff', absorb: 1.0, inner: '#9cc8ff', dark: 0.45, rough: 0.05, coat: 1, neutral: 0.6 };
    return { body: clear({ key: 'crystal', ...o, post: CRYSTAL_POST }), wing: clear({ key: 'crystalwing', ...o, nrm: FACETS, post: CRYSTAL_POST + FACET_EDGE }),
      accent: ice, hoof: ice, beak: ice, nostril: phys('#2a3550', { roughness: 0.1, clearcoat: 1 }) }; },
  rosegold: () => { const g = shine('#ffb6c2', 0.22); // 로즈골드 (플라밍고): bright pink gold; the beak paler, its tip black onyx; petals round it (figure.js)
    return { body: g, accent: g, hoof: g, beak: shine('#ffdce2', 0.22), nostril: look(phys('#050507', { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }), 'onyx', '', {}, { studio: 1 }) }; },
  yuzu: () => { const j = hex => jelly('honey', hex, { absorb: 2.4, post: HONEY }); // 유자 온천 (카피바라): honey jelly, a yuzu on its head (item), steam and small yuzus round it (figure.js)
    return { body: j('#f2bc34'), accent: j('#dc9a2a'), hoof: j('#c07a22'),
      item: { body: look(phys('#ffcc2a', { roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.1 }), 'yuzu', YUZU), accent: toyMat('#5a9a3a'), center: toyMat('#6a5a2a') } }; },
  dawn: () => same(look(phys('#ff9a6a', { roughness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.2, sheen: 0, sheenColor: new THREE.Color('#ffd0e0') }), 'dawn', DAWN)),
  // 25-1 snow. beak: the dark nose / beak mesh (a legendary's falls back to its hoof, the body here)
  aurora: () => { const a = (hex, k) => look(phys(hex, { roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'aurora', AURORA, { uK: k });
    return { body: a('#1a2850', 1), accent: a('#e8f6f2', 0.35), hoof: toyMat('#2a2a34'), beak: phys('#f2b04a', { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }) }; },
  glacier: () => ({ ...same(look(phys('#ffffff', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }), 'glacier', GLACIER)), beak: phys('#2a3550', { roughness: 0.1, clearcoat: 1 }) }),
  moonpearl: () => ({ ...same(look(phys('#e8ecf4', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.5, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 600] }), 'moonpearl', MOONPEARL)),
    beak: phys('#2a2a36', { roughness: 0.1, clearcoat: 1 }) }),
  starlight: () => { const s = hex => look(phys(hex, { roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.15 }), 'starlight', STARLIGHT), body = s('#f4f6ff');
    return { body, accent: s('#e8c878'), hoof: body, beak: phys('#2a2628', { roughness: 0.12, clearcoat: 1 }) }; },
  lantern: () => { const l = (hex, glow) => look(phys(hex, { roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.2 }), 'lantern', LANTERN, { uGlow: glow });
    return { body: l('#f0a24a', '#ff9a3a'), accent: l('#fff0d0', '#fff0c8'), hoof: toyMat('#5a3a28'), horn: shine('#ffc75a'), beak: phys('#4a3022', { roughness: 0.2, clearcoat: 0.6 }) }; }, // the nose dark brown, not red
  snowspirit: () => { const d = phys('#3a4a66', { roughness: 0.1, clearcoat: 1 });
    return { body: look(phys('#eef4ff', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'snowspirit', SPIRIT), accent: look(phys('#c4d6f0', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'snowspirit', SPIRIT), hoof: d, beak: d }; },
  // dino. horn: the horns, the plates and spikes, the tail club; beak: the pterosaur's; gem / bone: MODELS legend meshes (figure.js)
  lava: () => { const r = look(phys('#2a2422', { roughness: 0.55 }), 'lava', LAVA), cr = look(phys('#c8300a', { roughness: 0.3, specularIntensity: 0.35 }), 'lavacrystal', LAVA_CRYSTAL);
    return { ...same(r), horn: cr, gem: clear({ key: 'lavagem', tint: '#ff6a1a', absorb: 7.0, inner: '#c02000', dark: 0.3, color: '#300800', rough: 0.05, coat: 1, post: GEM_GLOW('vec3(1.0, 0.36, 0.05)', '0.25') }) }; },
  amethyst: () => { const st = hex => look(phys(hex, { roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.08 }), 'graystone', GRAYSTONE), body = st('#a8a6aa'),
      o = { tint: '#a868ff', absorb: 6.0, inner: '#5a18b0', dark: 0.35, color: '#1c0838', rough: 0.05, coat: 1 };
    return { body, horn: st('#bdbbbe'), hoof: st('#8a888c'), accent: clear({ key: 'amethyst', ...o, nrm: FACETS_ALL, post: GEM_GLOW('vec3(0.55, 0.25, 1.0)', '0.12') + FACET_EDGE_ALL }),
      gem: clear({ key: 'amethystgem', ...o, post: GEM_GLOW('vec3(0.55, 0.25, 1.0)', '0.12') }) }; },
  nebula: () => same(clear({ key: 'nebula', tint: '#4a3ad0', absorb: 3.0, inner: '#2a1690', dark: 0.3, color: '#06041a', rough: 0.06, coat: 1, post: NEBULA })),
  amberbone: () => ({ ...same(clear({ key: 'amberbone', tint: '#ffcc66', absorb: 1.4, inner: '#8a5200', dark: 0.3, color: '#140600', rough: 0.1, coat: 1, post: AMBERBONE,
      extra: { stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp } })), bone: BONE() }),
  // 84, worn instead on the Meshy bodies (data.js MODELS meshy): the rex's glass thicker with a stronger outline, the amber rex, the lacquer fox
  glass84rex: c => same(clear({ key: 'glass84rex', tint: c.tint, neutral: 0.8, absorb: 2.1, dark: 0.7, rimK: 1.0, bend: 0.2 })),
  amber84: amber86, // noEye: the skull's socket instead of the bead
  lacquer: () => same(look(phys('#9a1008', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.008 }), 'lacquer', LACQUER, { uPat: patternTex(1024, true) }, { studio: 0.6 })),
  malachite: () => { const m = k => look(phys('#2a8a5a', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }), 'malachite', MALACHITE, { uK: k });
    return { body: m(1), accent: m(0.6), hoof: m(0.5), horn: shine('#ffc75a') }; },
  bronze: () => { const b = shine('#c8864a', 0.25);
    return { body: look(phys('#2e8a72', { roughness: 0.6 }), 'verdigris', VERDIGRIS, {}, { studio: 0 }), accent: b, horn: b, hoof: b }; },
  sunstone: () => { const s = k => look(phys('#ff8a50', { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }), 'sunstone', SUNSTONE, { uK: k }), body = s(1);
    return { body, wing: body, accent: s(0.75), hoof: s(0.6), beak: shine('#ffc75a') }; },
  storm: () => { const b = look(phys('#1a2034', { roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1 }), 'storm', STORM);
    return { ...same(b), wing: b, beak: shine('#d8dee8', 0.2) }; },
  // 103 별자리 거북 (public)
  star89: () => { const k = '#0c0c10', o = { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }, u = { uMotif: motif100() }, legs = look(phys(k, o), 'tbody100', TBODY100, u, { studio: 0 });
    return { body: legs, hoof: legs, accent: hab89(look(phys(k, o), 'star100', STAR100, {}, { studio: 0 })), horn: look(phys(k, o), 'rim100', RIM100, u, { studio: 0 }) }; },
  // 115 시범 (?m89 only), the rabbit's and the sheep's new slots
  candy115: () => ({ ...same(hab89(look(phys('#ffd8e8', { roughness: 0.55, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }), 'candy115', CANDY115))), accent: phys('#ff9ec0', { roughness: 0.5 }) }),
  mint115: () => ({ ...same(hab89(look(phys('#ffffff', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }), 'mint115', MINT115, {}, { studio: 0.3 }))), accent: phys('#e0203c', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }) }),
  firefly115: () => ({ ...same(hab89(look(phys('#24404a', { roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color('#9fd8c0') }), 'firefly115', FIREFLY115))), accent: phys('#e6f29a', { roughness: 0.5, emissive: '#b8f040', emissiveIntensity: 0.25 }) }),
  cloud115: () => ({ body: hab89(look(phys('#ffffff', { roughness: 0.8, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }), 'cloud115', CLOUD115)), accent: phys('#f1ece6', { roughness: 0.5 }), hoof: phys('#9a9cb0', { roughness: 0.45 }) }),
  knit115: () => ({ body: hab89(look(phys('#ffffff', { roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color('#fff4e0') }), 'knit115', KNIT115)), accent: phys('#efe0c6', { roughness: 0.55 }), hoof: phys('#77706a', { roughness: 0.45 }) }),
  nightsky115: () => ({ body: hab89(look(phys('#1a2250', { roughness: 0.85, sheen: 0.8, sheenColor: new THREE.Color('#8aa0ff') }), 'nightsky115', NIGHTSKY115)), accent: phys('#e8e4f2', { roughness: 0.5 }), hoof: phys('#3a3550', { roughness: 0.4 }) }),
  // 116 신수 구미호 ①②③ (?m89): data.js M89 (arcticFox legendary, MODELS legend)
  gumiho116a: () => { const L = gumiho116(() => look(pale116(phys('#f9f7f2', { roughness: 0.55 })), 'foxfire116', FOXFIRE116), phys('#d4cbe6', { roughness: 0.5 }));
    return { ...L, hoof: L.body, parts: foxfire116 }; },
  gumiho116b: () => { const silver = () => look(phys('#c9d0dc', { roughness: 0.34, metalness: 0.35, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color('#eef4ff') }), 'silver116', SILVER116);
    const L = gumiho116(silver, phys('#9aa2b4', { roughness: 0.4, metalness: 0.3 }));
    return { ...L, hoof: L.body, parts: plain116, g116cord: sway116(phys('#c0141e', { roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ff6070') })),
      g116bell: sway116(hab89(look(phys('#e8b030', { roughness: 0.22, metalness: 1 }), 'bell116', BELL116, {}, { studio: 0.7 }))) }; },
  // 121 ①+② 섞기 (?m89, user's pick from 116): ①'s white matte body, sky-to-violet tips and three foxfires, with ②'s red cord
  // and gold bell on every tail (②'s silver body dropped: dark grey on a night habitat); the tails gathered (pilot89_gumiho121)
  gumiho121: () => { const L = LOOKS.gumiho116a(), B = LOOKS.gumiho116b(); return { ...L, g116cord: B.g116cord, g116bell: B.g116bell }; },
  gumiho116c: () => { const L = gumiho116(() => look(pale116(phys('#fbf8f4', { roughness: 0.42, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffe6f2') })), 'pearl116', PEARL116), phys('#f2d0dc', { roughness: 0.45 }));
    return { ...L, hoof: L.body, parts: bead116 }; },
  // 125-D 신수 구미호 안1 (cord and bell on the three outer tails) / 안2 (none) (?m89): data.js M89, MODELS legend pilot89_gumiho125
  gumiho125a: () => gumiho125(true),
  gumiho125b: () => gumiho125(false),
  // 132-B 구미호 3차, the fan wide (150 deg) / narrow (110 deg) (?m89&g132=w|n): data.js M89, MODELS legend pilot89_gumiho132w|n
  gumiho132w: () => gumiho132(150),
  gumiho132n: () => gumiho132(110),
  // 137-C 구미호 4차 (?m89&g132=4): nine round tails apart in 3D, a gold rim on each, each its own sway; MODELS legend pilot89_gumiho137
  gumiho137: () => gumiho132(0, tail137, false),
};
// ---- 125-B 티라노 (?m89 시범; data.js M89: MODELS.tRex.m89 = { solid: 'rex125' }, the commons only): the commons' plain vinyl
// + its 'stripe' paint (the body colour darker, so the orange and purple commons get their own) and the 'mouth' paint; in the
// codex and close up (uHab 0) small round scales pressed into the vinyl (cells: raised a little, a groove between), gone
// before they would shimmer; finer on the belly. The habitat sees the plain vinyl.
const REX125 = BUMP115 + `if (uHab < 0.5) { vec3 sc = cells(p * uScale); float fade = 1.0 - smoothstep(0.1, 0.3, fwidth(p.y) * uScale);
  float h = smoothstep(0.0, 0.45, sc.y - sc.x);
  BUMP115(h, uDepth * fade)
  diffuseColor.rgb *= 1.0 - 0.05 * (1.0 - h) * fade; }`;
const rex125 = (hex, scale) => hab89(look(toyBody(hex), 'rex125', REX125, { uScale: scale, uDepth: 0.0045 }));
LOOKS.rex125 = c => { const L = plain(rex125(c.body, 46), c);
  return { ...L, stripe: rex125('#' + new THREE.Color(c.body).lerp(new THREE.Color('#1e1a12'), 0.42).getHexString(), 46), ...c.paint?.belly && { belly: rex125(c.paint.belly, 64) } }; };
// ---- 161 A 공룡 다듬기 1차 / 163 A 방향 다시 (?m89 시범; data.js M89: MODELS.triceratops|stegosaurus.m89 = { solid: 'dino163' },
// the commons only): the plain vinyl a little darker on the back, lighter (toward cream) where the surface faces down low on the body
// (the belly, the throat and under the jaw, under the tail; not under the brows: p.y over ~0.42 of the height), a soft edge on the
// lower flanks; the legs (the body material) only under their soles. No painted pattern; the horns, claws, spikes keep theirs;
// the stegosaurus' public 'belly' paint mesh (its other looks colour it) here the body's own material, so its belly is the shader's.
// 163: the beak is the body's own surface (one shape with the face): ivory (colors.beak, else hoof) faded in by the body's _fade
// (figure.js, data.js fade: soft across a plane over the snout's front), no edge (171 A: the pteranodon's beak its own 'beak' mesh,
// these looks giving it the body's material: the same fade)
const DINO163 = `float b = (1.0 - smoothstep(-0.8, -0.25, on.y)) * (1.0 - smoothstep(0.3, 0.42, p.y));
  float d = smoothstep(0.2, 0.9, on.y + 0.3 * (p.y - 0.5));
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, uBelly, b) * (1.0 - 0.16 * d), uBeak, vFade);`;
const fade163 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = sh => { prev(sh);
  sh.vertexShader = 'attribute float _fade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = _fade;');
  sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader; }; return m; };
// 165 A: the pteranodon's wing membrane (the wing's 'wingSpot' group, tools/bake-dino163.mjs; figure.js draws it in accent, the
// crest's colour) on these commons a plain vinyl a tone darker than the body (176: the folded wing must read over the flank; 165 A /
// 171 A had it lighter, toward cream: x0.55 in linear, about x0.77 in sRGB, the body's own hue); the other looks keep it their accent
const memb163 = c => { const membrane = toyMat('#' + new THREE.Color(c.body).multiplyScalar(0.55).getHexString());
  return { membrane, parts: (r, G) => { const s = new Set(G.wings.map(w => w.spot)); r.traverse(x => { if (x.isMesh && s.has(x.geometry)) x.material = membrane; }); } }; };
// 171 A: beak: the pteranodon's beak its own mesh (figure.js fades it as the body); dino163b: the brachiosaurus' cream neck-front
// stripe (its public belly paint) kept
const dino163 = keep => c => { const L = plain(fade163(look(toyBody(c.body), 'dino163', DINO163, { uBelly: '#' + new THREE.Color(c.body).lerp(new THREE.Color('#f2e6c4'), 0.45).getHexString(), uBeak: c.beak || c.hoof || c.accent })), c);
  return { ...L, ...!keep && L.belly && { belly: L.body }, beak: L.body, ...memb163(c) }; };
LOOKS.dino163 = dino163(false); LOOKS.dino163b = dino163(true);
// 163 A review: the other four commons (data.js M89 m89.twotone ...): their public pattern as it is, the same ivory beak fade on top
for (const [k, P] of [['twotone', TWOTONE], ['spots', SPOTS], ['stripes', STRIPES], ['gradient', GRADIENT]])
  LOOKS[k + '163'] = c => { const L = plain(fade163(look(toyBody(c.body), k + '163', P + '\n  diffuseColor.rgb = mix(diffuseColor.rgb, uBeak, vFade);', { uSecond: c.second, uBeak: c.beak || c.hoof || c.accent })), c); return { ...L, beak: L.body, ...memb163(c) }; };

// 황금 복돼지 relief: cloud curls (a scalloped cloud with a curl at each end) as a height map in the red channel, lines
// blurred into soft ridges. Tiles: everything is drawn at 9 offsets. Canvas only, no image files.
function cloudTex() {
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, W); g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = g.lineJoin = 'round';
  const curl = (x, y, r, dir) => { g.beginPath(); for (let a = 0; a <= 9.5; a += 0.2) { const k = r * (1 - a / 11); g.lineTo(x + Math.cos(a * dir) * k, y + Math.sin(a * dir) * k); } g.stroke(); };
  const cloud = (x, y, s) => {
    g.beginPath(); g.arc(x - 22 * s, y, 14 * s, Math.PI, Math.PI * 1.9); g.arc(x, y - 6 * s, 18 * s, Math.PI * 1.15, Math.PI * 1.85); g.arc(x + 22 * s, y, 14 * s, Math.PI * 1.1, 0); g.stroke();
    g.beginPath(); g.moveTo(x - 36 * s, y); g.lineTo(x + 36 * s, y); g.stroke();
    curl(x - 36 * s, y + 8 * s, 8 * s, -1); curl(x + 36 * s, y + 8 * s, 8 * s, 1);
  };
  for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) for (const [x, y, s] of [[64, 70, 1], [190, 150, 0.9], [100, 215, 0.75]]) cloud(x + ox, y + oy, s);
  const out = document.createElement('canvas'); out.width = out.height = W;
  const o = out.getContext('2d'); o.filter = 'blur(3px)'; o.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(o.filter === 'blur(3px)' ? out : c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

// 100: one bold cloud (cloudTex's, bigger and with a curl in its middle bump), white on black, 256 x 128, a little blurred so its
// edge can be cut crisp at any size (CLOUD100). Canvas only, no image files
let motif;
function motif100() {
  if (motif) return motif;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), s = 2.6, x = 128, y = 72;
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = g.lineJoin = 'round';
  const curl = (cx, cy, r, dir) => { g.beginPath(); for (let a = 0; a <= 9.5; a += 0.2) { const k = r * (1 - a / 11); g.lineTo(cx + Math.cos(a * dir) * k, cy + Math.sin(a * dir) * k); } g.stroke(); };
  g.beginPath(); g.arc(x - 22 * s, y, 14 * s, Math.PI, Math.PI * 1.9); g.arc(x, y - 6 * s, 18 * s, Math.PI * 1.15, Math.PI * 1.85); g.arc(x + 22 * s, y, 14 * s, Math.PI * 1.1, 0); g.stroke();
  g.beginPath(); g.moveTo(x - 36 * s, y); g.lineTo(x + 36 * s, y); g.stroke();
  curl(x - 36 * s, y + 8 * s, 8 * s, -1); curl(x + 36 * s, y + 8 * s, 8 * s, 1); curl(x, y - 6 * s, 9 * s, 1);
  const out = document.createElement('canvas'); out.width = 256; out.height = 128;
  const o = out.getContext('2d'); o.filter = 'blur(1.5px)'; o.drawImage(c, 0, 0);
  return motif = new THREE.CanvasTexture(o.filter === 'blur(1.5px)' ? out : c);
}

// Seeded so every load paints the same pattern.
const lcg = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// 청화백자 motif in one ink ('#rrggbb'). Tiles in both directions: everything is drawn at 9 offsets. Canvas only, no image files.
function motifTex(hex) {
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d'), R = lcg(7), [ir, ig, ib] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  g.fillStyle = '#f3f5f0'; g.fillRect(0, 0, W, W);
  const ink = a => `rgba(${ir},${ig},${ib},${a})`;
  const wrap = fn => { for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
  const spiral = (x, y, r, turns, dir = 1) => {
    g.beginPath();
    for (let a = 0; a <= turns * Math.PI * 2; a += 0.15) { const k = r * (1 - a / (turns * Math.PI * 2 + 1.2)); g.lineTo(x + Math.cos(a * dir) * k, y + Math.sin(a * dir) * k); }
    g.stroke();
  };
  g.lineCap = g.lineJoin = 'round';
  // two winding vines (period = tile width) that never run straight, so nothing reads as a band
  const vines = [x => 120 + 52 * Math.sin(x / W * Math.PI * 2) + 14 * Math.sin(x / W * Math.PI * 6), x => 376 + 52 * Math.sin(x / W * Math.PI * 2 + 2.4) + 14 * Math.sin(x / W * Math.PI * 6 + 1)];
  const flowers = [];
  wrap(() => vines.forEach((stem, vi) => {
    g.strokeStyle = ink(0.9); g.lineWidth = 3.4;
    g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, stem(x)); g.stroke();
    for (let x = 12 + vi * 9; x < W; x += 26) { // leaves, alternating sides
      const s = Math.round(x / 26) % 2 ? 1 : -1, y = stem(x), ang = Math.atan2(stem(x + 2) - stem(x - 2), 4) + s * 0.9;
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = ink(0.72);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(9, -6 * s, 19, 0); g.quadraticCurveTo(9, 6 * s, 0, 0); g.fill(); g.restore();
    }
  }));
  vines.forEach((stem, vi) => { for (let k = 0; k < 3; k++) { const x = (k + 0.25 + vi * 0.5) * W / 3; flowers.push([x, stem(x) + (k % 2 ? 10 : -10)]); } });
  wrap(() => {
    for (const [x, y] of flowers) { // peony: wash, petal arcs, dark heart
      g.fillStyle = ink(0.28); g.beginPath(); g.arc(x, y, 27, 0, 7); g.fill();
      g.strokeStyle = ink(0.9); g.lineWidth = 2.3;
      for (let p = 0; p < 7; p++) { const a = p / 7 * Math.PI * 2 + R() * 0.3; g.beginPath(); g.arc(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 10.5, a - 1.6, a + 1.6); g.stroke(); }
      for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 + 0.3; g.beginPath(); g.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, a - 1.4, a + 1.4); g.stroke(); }
      g.fillStyle = ink(0.88); g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
    }
    for (let k = 0; k < 4; k++) { // cloud curls in the gaps between the vines
      const x = (k + 0.6) * W / 4, y = k % 2 ? 248 : W - 10;
      g.fillStyle = ink(0.2); for (const [dx, r] of [[-18, 11], [0, 16], [18, 11]]) { g.beginPath(); g.arc(x + dx, y + (dx ? 3 : 0), r, 0, 7); g.fill(); }
      g.strokeStyle = ink(0.88); g.lineWidth = 2.2;
      spiral(x, y, 14, 1.6); spiral(x - 19, y + 4, 9, 1.3, -1); spiral(x + 19, y + 4, 9, 1.3);
    }
  });
  // the ink bleeds slightly into the glaze in the kiln: soften everything a touch
  const out = document.createElement('canvas'); out.width = out.height = W;
  const o = out.getContext('2d'); o.filter = 'blur(0.8px)'; o.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(o.filter === 'blur(0.8px)' ? out : c); // Safari < 18 has no ctx.filter
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

// 79-1 / 84: the 청화 / 홍칠 drawing (tools/pilot72.js; the game's lacquer fox). Canvas only, no image files.
// Three channels: R the wash (light fill of flowers and leaves), G the flowers' line work, B the vines and leaf outlines.
// Porcelain: white -> cobalt by R, -> deep cobalt by G and B (linear colours: the shader runs before the output encoding). Lacquer: gold by R and B, G etched dark into the gold.
const rand = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const texCache = {};
// lacq (84, the fox's lacquer): the same drawing in lines two-thirds as wide and one leaf per bend instead of two: thin gold, more red between
export function patternTex(S = 1024, lacq = false) {
  const key = S + (lacq ? 'l' + lacq : ''); if (texCache[key]) return texCache[key];
  const C = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.lineCap = g.lineJoin = 'round'; return g; });
  const [W, L, V] = C, R = rand(11), u = S / 1024, w = u * (lacq === true ? 0.65 : lacq || 1); // u: sizes, w: line widths (lacq a number: 89's wider gold)
  const each = f => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { for (const g of C) { g.save(); g.translate(dx, dy); } f(); for (const g of C) g.restore(); } };
  const lobes = (g, x, y, r, n, rr, a0, grow = 0) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; g.moveTo(x + Math.cos(a) * r + rr + grow, y + Math.sin(a) * r); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, rr + grow, 0, Math.PI * 2); } g.fill(); };
  function peony(x, y, r, a0) {
    for (const [k, n] of [[1, 8], [0.62, 7], [0.32, 6]]) { // three rings of petals, each outlined over the last
      const pr = r * k * 0.42, pc = r * k * 0.62, lw = 5 * w;
      L.fillStyle = '#fff'; lobes(L, x, y, pc, n, pr, a0 + k, lw); L.fillStyle = '#000'; lobes(L, x, y, pc, n, pr, a0 + k);
      W.fillStyle = k === 1 ? '#c8c8c8' : '#ffffff'; lobes(W, x, y, pc, n, pr, a0 + k);
      V.fillStyle = '#000'; lobes(V, x, y, pc, n, pr, a0 + k, lw);
      L.strokeStyle = '#fff'; L.lineWidth = 2.6 * w; // petal veins, a brush stroke from the middle out
      for (let i = 0; i < n; i++) for (const s of [-0.18, 0, 0.18]) { const a = a0 + k + i / n * Math.PI * 2 + s;
        L.beginPath(); L.moveTo(x + Math.cos(a) * pc * 0.55, y + Math.sin(a) * pc * 0.55); L.lineTo(x + Math.cos(a) * (pc + pr * 0.55), y + Math.sin(a) * (pc + pr * 0.55)); L.stroke(); }
    }
    L.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; L.beginPath(); L.arc(x + Math.cos(a) * r * 0.1, y + Math.sin(a) * r * 0.1, 3.4 * u, 0, 7); L.fill(); }
  }
  function leaf(x, y, len, a) {
    const p = (s, t) => [x + Math.cos(a) * s - Math.sin(a) * t, y + Math.sin(a) * s + Math.cos(a) * t], shape = g => { g.beginPath(); g.moveTo(...p(0, 0)); g.quadraticCurveTo(...p(len * 0.45, len * 0.32), ...p(len, 0)); g.quadraticCurveTo(...p(len * 0.45, -len * 0.32), ...p(0, 0)); };
    V.strokeStyle = '#fff'; V.lineWidth = 5 * w; shape(V); V.stroke(); V.fillStyle = '#000'; shape(V); V.fill();
    W.fillStyle = '#c8c8c8'; shape(W); W.fill(); L.fillStyle = '#000'; shape(L); L.fill();
    V.lineWidth = 2.4 * w; V.beginPath(); V.moveTo(...p(0, 0)); V.quadraticCurveTo(...p(len * 0.5, len * 0.06), ...p(len * 0.92, 0)); V.stroke();
  }
  function vine(pts) { // a brush line through the points with leaves and curls along it
    V.strokeStyle = '#fff'; V.lineWidth = 10 * w; V.beginPath(); V.moveTo(...pts[0]);
    for (let i = 1; i < pts.length - 1; i++) V.quadraticCurveTo(...pts[i], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    V.lineTo(...pts.at(-1)); V.stroke();
    for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i], a = Math.atan2(pts[i + 1][1] - y, pts[i + 1][0] - x);
      leaf(x, y, (80 + R() * 40) * u, a + (i % 2 ? 1 : -1) * (0.6 + R() * 0.4));
      const [mx, my] = [(x + pts[i + 1][0]) / 2, (y + pts[i + 1][1]) / 2], ll = (60 + R() * 30) * u; if (!lacq) leaf(mx, my, ll, a - (i % 2 ? 1 : -1) * (0.8 + R() * 0.3));
      if (i % 2) { V.lineWidth = 4.5 * w; V.beginPath(); let px = x, py = y; V.moveTo(px, py); for (let t = 0; t < 20; t++) { const aa = a - (i % 4 ? 1 : -1) * (1.6 + t * 0.32), rr = (30 - t * 1.3) * u; px += Math.cos(aa) * rr * 0.32; py += Math.sin(aa) * rr * 0.32; V.lineTo(px, py); } V.stroke(); }
    }
  }
  const F = [[0.22, 0.26, 0.2], [0.72, 0.66, 0.21], [0.74, 0.14, 0.11], [0.2, 0.8, 0.12], [0.48, 0.47, 0.08]].map(([x, y, r]) => [x * S, y * S, r * S]);
  each(() => {
    vine([[F[0][0], F[0][1]], [0.42 * S, 0.3 * S], [0.5 * S, 0.47 * S], [0.6 * S, 0.58 * S], [F[1][0], F[1][1]]]);
    vine([[F[1][0], F[1][1]], [0.88 * S, 0.5 * S], [0.86 * S, 0.3 * S], [F[2][0], F[2][1]]]);
    vine([[F[0][0], F[0][1]], [0.1 * S, 0.45 * S], [0.24 * S, 0.6 * S], [F[3][0], F[3][1]]]);
    vine([[F[3][0], F[3][1]], [0.4 * S, 0.88 * S], [0.58 * S, 0.84 * S], [F[1][0], F[1][1]]]);
    vine([[F[2][0], F[2][1]], [0.6 * S, 0.06 * S], [0.42 * S, 0.12 * S], [F[0][0], F[0][1]]]);
    vine([[F[4][0], F[4][1]], [0.58 * S, 0.3 * S], [0.62 * S, 0.2 * S], [F[2][0], F[2][1]]]);
    vine([[F[4][0], F[4][1]], [0.36 * S, 0.62 * S], [0.3 * S, 0.7 * S], [F[3][0], F[3][1]]]);
    vine([[F[1][0], F[1][1]], [0.92 * S, 0.86 * S], [1.08 * S, 0.9 * S], [F[3][0] + S, F[3][1]]]);
    vine([[F[3][0], F[3][1]], [0.12 * S, 0.98 * S], [0.1 * S, 1.12 * S], [F[0][0], F[0][1] + S]]);
  });
  each(() => F.forEach(([x, y, r], i) => peony(x, y, r, i * 0.7)));
  const out = document.createElement('canvas'); out.width = out.height = S; const o = out.getContext('2d'), img = o.createImageData(S, S), d = [0, 1, 2].map(i => C[i].getImageData(0, 0, S, S).data);
  for (let i = 0; i < S * S * 4; i += 4) { img.data[i] = d[0][i]; img.data[i + 1] = d[1][i]; img.data[i + 2] = d[2][i]; img.data[i + 3] = 255; }
  o.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
  return texCache[key] = t;
}

// ---- 128 전설 2번째 (?m89 시범; data.js LEGEND128): the meadow's second legendary set. Only the parts each animal has change
// (tiers.md). hab89: the habitat (uHab 1) drops the fine detail; fn128 adds the shared GLSL below.
// fl128: the nearest of points scattered through space (dimple, GLSL3) as an offset in the plane of the surface (n: its
// normal) from that point, and a random number for it. petals128: a flower of np petals, radius R, > 0 inside; notch: the
// cleft at each petal's tip (cherry blossom)
const FN128 = `vec3 fl128(vec3 q, vec3 n) { vec3 d = dimple(q), t1 = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))), t2 = cross(n, t1);
  return vec3(-dot(d, t1), -dot(d, t2), h31(floor(q + d))); }
// fe128: fl128 and the height of a heap of round puffs, one round each point (the highest wins: no seam, a crease between)
vec4 fe128(vec3 q, vec3 n) { vec3 i = floor(q), f = fract(q), d = vec3(9.0); float h = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 o = vec3(x, y, z), r = o + h33(i + o) * 0.8 + 0.1 - f; float e = dot(r, r); if (e < dot(d, d)) d = r; h = max(h, sqrt(max(0.0, 1.0 - e / 0.5))); }
  vec3 t1 = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))), t2 = cross(n, t1);
  return vec4(-dot(d, t1), -dot(d, t2), h31(floor(q + d)), h); }
float petals128(vec2 v, float R, float np, float notch, float rot) { float a = atan(v.y, v.x) + rot, f = fract(a * np / 6.2832) - 0.5;
  return R * (0.45 + 0.55 * sqrt(max(0.0, 1.0 - 4.0 * f * f)) - notch * (1.0 - smoothstep(0.0, 0.09, abs(f)))) - length(v); }
`;
const fn128 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', FN128 + 'void main() {'); }; return m; };
const L128 = (m, key, body, u = {}, o = {}) => fn128(hab89(look(m, key, body, u, o)));
// 회전목마 말: cream enamel, glossy. A rose-pink saddle cloth over the back with a scalloped hem, a gold border and pinstripe, a red
// seat edged in gold on top and a painted rose on each flank; small gold bulbs at the hem's points that light up at night; a sky-blue
// ribbon round the base of the neck edged in gold; close up, small painted flowers on the rump and the shoulder
const CAROUSEL128 = SH89 + GILD89 + '#define AA(v, t) smoothstep((t) - fwidth(v) - 1e-4, (t) + fwidth(v) + 1e-4, v)\n' + `float az = abs(p.z);
  vec3 col = mix(vec3(0.99, 0.96, 0.91), vec3(1.0, 0.9, 0.93), 0.5 * smoothstep(0.3, 0.9, 1.0 - nv));
  float sx = (p.x + 0.12) / 0.2, u = (p.x + 0.32) / 0.4 * 5.0, f = fract(u) * 2.0 - 1.0, hem = 0.47 - 0.045 * sqrt(max(0.0, 1.0 - f * f));
  float e = min((1.0 - abs(sx)) * 0.2, p.y - hem), cloth = AA(e, 0.0), st = min(on.y - 0.55, (0.72 - abs(sx)) * 0.4), seat = cloth * AA(st, 0.0);
  col = mix(col, mix(vec3(0.97, 0.6, 0.7), vec3(0.75, 0.1, 0.18), seat), cloth);
  float gold = cloth * max(1.0 - AA(e, 0.016), AA(e, 0.027) * (1.0 - AA(e, 0.034)));
  gold = max(gold, cloth * AA(st, -0.035) * (1.0 - AA(st, 0.0)));
  vec2 rc = (p.xy - vec2(-0.12, 0.585)) / 0.052; float rr = length(rc), ra = atan(rc.y, rc.x), side = AA(az, 0.1);
  float rose = (1.0 - SH(rr, 1.0)) * side, swirl = 0.5 + 0.5 * sin(ra * 2.0 + rr * 13.0);
  col = mix(col, mix(vec3(0.82, 0.16, 0.36), vec3(1.0, 0.62, 0.72), swirl * smoothstep(1.0, 0.3, rr)), rose);
  float lv = (1.0 - SH(length((rc - vec2(1.25, -0.45)) / vec2(0.75, 0.35)), 1.0)) + (1.0 - SH(length((rc - vec2(-1.25, -0.45)) / vec2(0.75, 0.35)), 1.0));
  col = mix(col, vec3(0.3, 0.62, 0.36), min(lv, 1.0) * side * (1.0 - rose));
  vec2 bq = vec2((fract(u + 0.5) - 0.5) * 0.08, p.y - 0.47); float bulb = (1.0 - AA(length(bq), 0.013)) * step(abs(sx), 1.05) * step(0.02, az);
  vec2 n2 = normalize(vec2(0.6, 0.8)); float s = dot(p.xy - vec2(0.13, 0.66), n2) - 0.025 * az / 0.15, rib = (1.0 - AA(abs(s), 0.032)) * step(0.0, p.x);
  col = mix(col, vec3(0.55, 0.78, 0.97), rib); gold = max(gold, rib * AA(abs(s), 0.024));
  float ring = (1.0 - AA(abs(p.y - 0.13), 0.012)) * step(p.y, 0.4); gold = max(gold, ring);
  if (uHab < 0.5) {
    float m = max(1.0 - SH(length((p.xy - vec2(-0.4, 0.56)) / vec2(0.1, 0.09)), 1.0), 1.0 - SH(length((p.xy - vec2(0.08, 0.47)) / vec2(0.07, 0.06)), 1.0)) * side * (1.0 - cloth);
    vec3 fq = fl128(p * 34.0, on); float fp = AA(petals128(fq.xy, 0.36, 5.0, 0.0, fq.z * 6.28), 0.0) * m * step(0.2, fq.z), fr = length(fq.xy);
    vec3 fc = fq.z < 0.47 ? vec3(1.0, 0.62, 0.76) : fq.z < 0.74 ? vec3(0.72, 0.62, 0.98) : vec3(1.0, 0.86, 0.4);
    col = mix(col, mix(fc, vec3(1.0, 0.78, 0.25), 1.0 - AA(fr, 0.09)), fp);
    vec3 rq = fl128(p * 60.0 + 4.0, on); float rf = AA(petals128(rq.xy, 0.36, 5.0, 0.0, rq.z * 6.28), 0.0) * rib * step(0.45, rq.z);
    col = mix(col, rq.z < 0.72 ? vec3(1.0, 0.7, 0.8) : vec3(1.0, 0.95, 0.6), rf);
  }
  diffuseColor.rgb = col; gold = max(gold, bulb);
  GILD(gold * (1.0 - bulb * uNight));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.9, 0.6), bulb * uNight);
  totalEmissiveRadiance += vec3(1.0, 0.78, 0.4) * bulb * (0.1 + uNight * 2.5);`;
// its mane and tail: gold leaf carved in curls (a spiral groove round each; gone where it would shimmer), the gold leaf's fine
// crackle close up
const CURL128 = GILD89 + BUMP115 + `float fade = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 16.0);
  vec3 f = fl128(p * 16.0, on); float r = length(f.xy), an = atan(f.y, f.x);
  float h = mix(0.3, 0.5 + 0.5 * cos(6.2832 * (r * 4.0 - an / 6.2832 + f.z)), 1.0 - smoothstep(0.35, 0.5, r));
  BUMP115(h, 0.006 * fade)
  GILD(1.0); diffuseColor.rgb *= mix(1.0, 0.5 + 0.5 * h, fade);
  if (uHab < 0.5) { vec3 c = cells(p * 70.0); diffuseColor.rgb *= 1.0 - 0.15 * fade * (1.0 - smoothstep(0.0, 0.06, c.y - c.x)); }`;
// 민들레 홀씨 양: the wool a dandelion clock: round seed heads packed together (each a dome, warm grey between them), silver sheen, a
// faint light of its own (brighter at night); close up each head's fine pappus rays round a small brown seed, a second finer layer
// between; a ring of green bracts along the wool's lower edge
const DANDELION128 = SH89 + BUMP115 + `float fade = 1.0 - smoothstep(0.15, 0.5, fwidth(p.y) * 10.0);
  vec4 f = fe128(p * 10.0, on); float r = length(f.xy), an = atan(f.y, f.x), dome = f.w, seam = smoothstep(0.1, 0.35, f.w);
  vec3 col = mix(vec3(0.9, 0.91, 0.86), vec3(1.0, 1.0, 0.98), mix(1.0, smoothstep(0.0, 0.6, dome), fade));
  BUMP115(dome, 0.035 * fade)
  if (uHab < 0.5) {
    float ray = pow(abs(cos(an * 8.0 + f.z * 9.0)), 24.0) * smoothstep(0.5, 0.1, r) * smoothstep(0.02, 0.08, r) * seam;
    vec4 g = fe128(p * 26.0 + 3.0, on); float rg = length(g.xy), ray2 = pow(abs(cos(atan(g.y, g.x) * 7.0 + g.z * 9.0)), 20.0) * smoothstep(0.45, 0.08, rg) * smoothstep(0.02, 0.06, rg) * smoothstep(0.1, 0.35, g.w) * seam;
    col = mix(col, vec3(1.0), max(ray, ray2 * 0.7) * fade);
    col *= 1.0 - 0.16 * (1.0 - max(ray, ray2)) * smoothstep(0.1, 0.4, r) * fade;
    col = mix(col, vec3(0.55, 0.4, 0.22), (1.0 - smoothstep(0.03, 0.05, r)) * fade * seam);
  }
  float bu = fract(atan(p.z, p.x + 0.05) * 2.2) * 2.0 - 1.0, br = SH(0.31 + 0.1 * (1.0 - abs(bu)) - p.y, 0.0);
  diffuseColor.rgb = mix(col, vec3(0.5, 0.68, 0.34), br); totalEmissiveRadiance += vec3(0.07, 0.07, 0.065) * (0.6 + 0.4 * dome) * (1.0 - br) * (1.0 + uNight * 3.0);`;
// 벚꽃 토끼: white at the belly into pale cherry pink up the back; the ears a flowering branch: dark bark (streaked lengthwise) with
// five-petal blossoms (a cleft at each tip, deeper pink at the heart, yellow stamens), dense on the ears (the accent: uAcc 1; the nose
// under the ears stays pink); the tail a ball of blossoms; close up, a few fallen petals on the body
const SAKURA128 = SH89 + BUMP115 + `float ear = smoothstep(0.75, 0.79, p.y), tail = smoothstep(-0.3, -0.34, p.x) * (1.0 - ear);
  vec3 col = mix(vec3(1.0, 0.96, 0.97), vec3(0.96, 0.62, 0.74), smoothstep(0.05, 0.6, p.y + 0.15 * on.y));
  col = mix(col, mix(vec3(0.3, 0.16, 0.1), vec3(0.52, 0.3, 0.2), fbm3(p * vec3(34.0, 5.0, 34.0))), ear);
  vec3 f = fl128(p * 24.0, on); float r = length(f.xy), bl = SH(petals128(f.xy, 0.48, 5.0, 0.07, f.z * 6.28), 0.0) * max(ear * step(f.z, 0.93), tail);
  vec3 pc = mix(vec3(1.0, 0.82, 0.9), vec3(0.93, 0.45, 0.62), 1.0 - smoothstep(0.0, 0.24, r));
  pc = mix(pc, vec3(1.0, 0.86, 0.35), (1.0 - SH(abs(r - 0.13), 0.022)) * step(0.6, fract((atan(f.y, f.x) + f.z * 6.28) * 0.7958)));
  col = mix(col, pc, bl);
  col = mix(col, vec3(0.95, 0.55, 0.66), uAcc * (1.0 - ear));
  BUMP115(bl * (0.6 + 0.4 * smoothstep(0.44, 0.1, r)), 0.005)
  { vec3 g = fl128(p * 8.0 + 5.0, on); float a = g.z * 6.28; vec2 v = mat2(cos(a), sin(a), -sin(a), cos(a)) * g.xy;
    float pt = (1.0 - SH(length(v / vec2(0.13, 0.19)), 1.0)) * (1.0 - SH(length((v - vec2(0.0, 0.17)) / vec2(0.05, 0.06)), 1.0) * 0.0) * step(g.z, 0.55) * (1.0 - ear) * (1.0 - tail) * (1.0 - uAcc);
    col = mix(col, mix(vec3(1.0, 0.97, 0.98), vec3(0.9, 0.36, 0.56), smoothstep(-0.04, 0.16, v.y + 0.08)), pt); BUMP115(pt, 0.003) }
  diffuseColor.rgb = col;`;
// 토피어리 돼지: a clipped hedge: small pointed leaves packed in every direction (two layers close up, one in the habitat), each its own
// green with a lighter midrib, dark gaps between; small white, pink and yellow flowers here and there. uAcc 1 (the snout's disc): a
// lighter green, finer, no flowers
const TOPIARY128 = SH89 + BUMP115 + `float fade = 1.0 - smoothstep(0.15, 0.5, fwidth(p.y) * uS);
  #define LEAF128(F, H, ID, MR) { float a_ = F.z * 6.2832; vec2 v_ = mat2(cos(a_), sin(a_), -sin(a_), cos(a_)) * F.xy; float w_ = 0.2 * (1.0 - v_.y * v_.y / 0.2025); \
    float l_ = step(abs(v_.y), 0.45) * (1.0 - abs(v_.x) / max(w_, 1e-3)); if (l_ > 0.0 && 0.4 + 0.6 * l_ > H) { H = 0.4 + 0.6 * l_; ID = F.z; MR = 1.0 - smoothstep(0.0, 0.025, abs(v_.x)); } }
  float h = 0.0, id = 0.0, mr = 0.0; vec3 f = fl128(p * uS, on); LEAF128(f, h, id, mr)
  if (uHab < 0.5) { vec3 g = fl128(p * uS + 17.3, on); LEAF128(g, h, id, mr) }
  vec3 col = mix(vec3(0.16, 0.4, 0.13), vec3(0.44, 0.68, 0.24), fract(id * 7.13)) * mix(1.0, 0.6 + 0.4 * h, fade);
  col = mix(col, vec3(0.04, 0.12, 0.05), (1.0 - step(0.01, h)) * fade);
  col = mix(col, col * 1.35 + 0.05, mr * fade * step(0.01, h) * 0.6);
  col = mix(col, vec3(0.55, 0.78, 0.4), uAcc * 0.5);
  float hb = h;
  if (uAcc < 0.5) { vec3 q = fl128(p * 7.0 + 9.0, on); float fp = SH(petals128(q.xy, 0.2, 5.0, 0.0, q.z * 6.28), 0.0) * step(0.6, q.z), fr = length(q.xy);
    float c = fract(q.z * 13.7); col = mix(col, mix(c < 0.4 ? vec3(1.0, 0.98, 0.95) : c < 0.75 ? vec3(1.0, 0.68, 0.8) : vec3(1.0, 0.86, 0.3), vec3(1.0, 0.75, 0.2), 1.0 - SH(fr, 0.05)), fp);
    hb = max(hb * fade, fp * 1.2); }
  BUMP115(hb, 0.012)
  diffuseColor.rgb = col;`;
// 꽃밭 얼룩소: glossy white; the patches (밀키 오팔's places and outline, COWOPAL) a wildflower meadow: green grass streaked with
// blades, packed with flowers: white daisies, yellow buttercups, pink, violet and sky-blue ones (a second smaller layer close
// up). The ears and the tail tuft too (uAcc 1, there by position)
const FLOWERCOW128 = SH89 + BUMP115 + `vec3 q = vec3(p.x, p.y, abs(p.z)); float wob = 0.4 * (vn3(p * 4.5 + 2.0) - 0.5) + 0.08 * (vn3(p * 11.0) - 0.5);
  #define BLOB(v, c, r) (1.0 - length((v - c) / r))
  float bl = max(max(BLOB(p, vec3(0.06, 0.6, 0.25), vec3(0.17, 0.18, 0.15)), BLOB(p, vec3(-0.41, 0.63, 0.2), vec3(0.15, 0.15, 0.15))),
                 max(BLOB(p, vec3(-0.17, 0.6, -0.25), vec3(0.21, 0.17, 0.15)), BLOB(q, vec3(0.25, 0.87, 0.15), vec3(0.11, 0.12, 0.12)))) + wob + 0.12;
  bl = max(bl, max(BLOB(p, vec3(0.24, 0.56, 0.27), vec3(0.12, 0.12, 0.15)), BLOB(p, vec3(-0.12, 0.8, 0.0), vec3(0.16, 0.08, 0.14))) + wob + 0.05);
  float ear = uAcc * max(step(0.2, abs(p.z)) * step(0.75, p.y), step(p.y, 0.42) * step(p.x, -0.48));
  float gt = 0.07 + 0.08 * vn3(vec3(p.x * 150.0, 0.0, p.z * 150.0)), grass = (1.0 - uAcc) * (1.0 - SH(p.y, gt)) * step(p.y, 0.3);
  bl = max(bl, grass * 2.0 - 1.0);
  float k = max(SH(bl, 0.0), ear), rim = (1.0 - k) * SH(bl, -0.09);
  vec3 gr = mix(vec3(0.16, 0.42, 0.12), vec3(0.4, 0.66, 0.2), vn3(p * vec3(90.0, 14.0, 90.0)));
  float sc = uHab < 0.5 ? 20.0 : 14.0; vec3 f = fl128(p * sc, on); float r = length(f.xy), c = fract(f.z * 11.3);
  float fp = SH(petals128(f.xy, 0.4, c < 0.3 ? 9.0 : 5.0, 0.0, f.z * 6.28), 0.0) * step(0.18, f.z);
  vec3 fc = c < 0.3 ? vec3(1.0, 0.99, 0.96) : c < 0.5 ? vec3(1.0, 0.84, 0.18) : c < 0.68 ? vec3(1.0, 0.56, 0.74) : c < 0.84 ? vec3(0.66, 0.5, 0.95) : vec3(0.5, 0.74, 1.0);
  fc = mix(fc, c < 0.3 ? vec3(1.0, 0.78, 0.15) : vec3(1.0, 0.95, 0.7), 1.0 - SH(r, 0.1));
  vec3 m = mix(gr, fc, fp); float hh = fp;
  if (uHab < 0.5) { vec3 g = fl128(p * 40.0 + 7.0, on); float c2 = fract(g.z * 5.7), fp2 = SH(petals128(g.xy, 0.36, 5.0, 0.0, g.z * 6.28), 0.0) * step(0.35, g.z) * (1.0 - fp);
    m = mix(m, c2 < 0.5 ? vec3(1.0, 0.98, 0.95) : c2 < 0.75 ? vec3(1.0, 0.88, 0.3) : vec3(1.0, 0.64, 0.8), fp2); hh = max(hh, fp2 * 0.6); }
  vec3 dq = fl128(p * 26.0 + 11.0, on); float dr = length(dq.xy), dz = SH(petals128(dq.xy, 0.42, 10.0, 0.0, dq.z * 6.28), 0.0) * rim * step(0.3, dq.z);
  vec3 sq = fl128(p * 9.0 + 3.0, on); float sr = length(sq.xy), sd = SH(petals128(sq.xy, 0.3, 8.0, 0.0, sq.z * 6.28), 0.0) * (1.0 - k) * (1.0 - rim) * step(0.82, sq.z);
  if (sd > dz) { dz = sd; dr = sr * 1.4; }
  float hk = max(hh * k, dz * 0.8); BUMP115(hk, 0.006)
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, m, k), mix(vec3(1.0), vec3(1.0, 0.8, 0.2), 1.0 - SH(dr, 0.12)), dz); roughnessFactor = mix(roughnessFactor, 0.45, k);`;
// 풍향계 닭: weathervane brass, polished (the studio's reflection): feathers engraved in rows of rounded ends toward the tail, each
// with a shaft line, a green-brown patina in the grooves; larger on the wings (uS)
const VANE128 = BUMP115 + `float fade = 1.0 - smoothstep(0.12, 0.4, fwidth(p.y) * uS);
  vec2 g = vec2(-p.x * 1.1 + 0.2 * p.y, p.y) * uS; float row = floor(g.y); g.x += 0.5 * mod(row, 2.0); vec2 c = vec2(fract(g.x) - 0.5, fract(g.y));
  float arc = 0.15 + 0.6 * sqrt(max(0.0, 1.0 - 4.0 * c.x * c.x)), gv = 1.0 - smoothstep(0.02, 0.12, abs(c.y - arc));
  gv = max(gv, (1.0 - smoothstep(0.0, 0.035, abs(c.x))) * step(arc, c.y) * 0.7);
  float head = smoothstep(0.12, 0.2, p.x) * smoothstep(0.72, 0.8, p.y); gv *= (1.0 - head) * fade;
  float ng = -gv; BUMP115(ng, 0.004)
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.36, 0.22), gv * 0.75); roughnessFactor = mix(roughnessFactor, 0.6, gv);
  diffuseColor.rgb *= 0.92 + 0.12 * vn3(p * 9.0);`;
// its comb (and wattle, the accent): copper, cut as an arrow's fletching: barbs slanting back from a shaft along the middle
const FLETCH128 = BUMP115 + `float fade = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 60.0);
  float b = abs(fract(p.x * 55.0 + abs(p.z) * 75.0) - 0.5) * 2.0, gv = (1.0 - smoothstep(0.0, 0.25, b)) * fade, shf = 1.0 - smoothstep(0.004, 0.008, abs(p.z));
  gv = max(gv, shf); float ng = -gv; BUMP115(ng, 0.003)
  diffuseColor.rgb *= 1.0 - 0.45 * gv;`;
Object.assign(NIGHT_LOOK, { dandelion128: 1.5 });
// ---- 127 새 공유 재질 11개 (?m89 시범; data.js SHARED127, wave 1|2|3). Triplanar-free: all in pattern space p, no UVs.
// Each comes in two levels like 128 (hab89 uHab: 1 in the habitat drops the fine detail, 0 = the codex close-up, 118).
// uAcc 1: the accent (beak, hooves) keeps the material but drops the motifs. WET127: the rain (habitat.js sets it round
// its render), more dew drops in the rain.
export const WET127 = { value: 0 };
const wet127 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.uWet = WET127; sh.fragmentShader = 'uniform float uWet;\n' + sh.fragmentShader; }; return m; };
// fl127: fl128 plus how far the point is off the surface (.w). A point far off it still throws a motif onto the surface, but
// cut by its neighbours' cells (half flowers): the motifs below show only for points near the surface
const FN127 = `vec4 fl127(vec3 q, vec3 n) { vec3 d = dimple(q), t1 = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))), t2 = cross(n, t1);
  return vec4(-dot(d, t1), -dot(d, t2), h31(floor(q + d)), abs(dot(d, n))); }
`;
const L127 = (m, key, body, u = {}, o = {}) => { const r = L128(m, key, body, u, o), prev = r.onBeforeCompile;
  r.onBeforeCompile = (sh, x) => { prev.call(r, sh, x); sh.fragmentShader = sh.fragmentShader.replace('void main() {', FN127 + 'void main() {'); }; return r; };
const dk = (h, k) => '#' + new THREE.Color(h).multiplyScalar(k).getHexString();
const AA127 = '#define AA(v, t) smoothstep((t) - fwidth(v) - 1e-4, (t) + fwidth(v) + 1e-4, v)\n';
// wood grain: growth rings round the x axis (long grain down the body, the rings' ends on the chest and the rump), the
// latewood band in uGrain; close up, fibres along the grain and open pores
const GRAIN127 = `float gfade = 1.0 - smoothstep(0.3, 0.8, fwidth(p.y) * 40.0);
  float gr = length(vec2(p.y - 0.42, p.z * 1.3)) * 14.0 + fbm3(p * vec3(1.2, 5.0, 5.0) + 3.0) * 2.4 + 0.4 * sin(p.x * 3.0), ring = fract(gr);
  float late = mix(0.35, smoothstep(0.5, 0.78, ring) * (1.0 - smoothstep(0.9, 1.0, ring)), gfade);
  vec3 wood = mix(diffuseColor.rgb, uGrain, late * 0.8);
  if (uHab < 0.5) { wood *= mix(1.0, 0.9 + 0.16 * vn3(p * vec3(3.0, 140.0, 140.0)), gfade);
    wood = mix(wood, uGrain * 0.7, step(0.84, vn3(p * vec3(18.0, 220.0, 220.0) + 9.0)) * 0.35 * gfade); }`;
const WOOD127 = GRAIN127 + `diffuseColor.rgb = wood;`;
// 플로킹 (137 B): deep velvet. The pile catches the light at grazing angles (a bright, paler rim that fades in slowly) and
// swallows it face on (the middle much darker); a thin fuzzy bloom of its own light just on the silhouette (not by night,
// or it would glow like 야광); close up, the fuzz speckle
const VELVET127 = `float rim = 1.0 - nv, g = smoothstep(0.05, 0.95, rim);
  vec3 lit = mix(diffuseColor.rgb * 3.2, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * 3.0 + 0.2), 0.4);
  float fz = uHab < 0.5 ? 0.7 + 0.6 * vn3(p * 260.0) : 1.0;
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.5, lit, pow(g, 1.6)) * mix(1.0, fz, 0.35);
  totalEmissiveRadiance += lit * pow(rim, 4.0) * 0.6 * fz * (1.0 - uNight);
  roughnessFactor = 1.0;`;
// 대리석: the kept 16-2 marble, in this colour; close up, a fine crystal sparkle in the stone
const MARBLE127 = `float n = fbm3(p * 1.8 + 7.0), v = abs(sin((p.x * 1.2 + p.y * 2.0 - p.z * 0.5 + n * 3.6) * 3.14159));
  float n2 = fbm3(p * 4.5 + 2.0), v2 = abs(sin((p.y * 2.6 - p.x * 1.5 + n2 * 4.5) * 3.14159));
  float vein = pow(1.0 - smoothstep(0.0, 0.22 + fwidth(v), v), 2.0), fine = pow(1.0 - smoothstep(0.0, 0.08 + fwidth(v2), v2), 2.0);
  vec3 ground = diffuseColor.rgb * (0.93 + 0.1 * fbm3(p * 3.0 + 1.0));
  diffuseColor.rgb = mix(ground, uVein, max(vein * 0.75, fine * 0.16));
  if (uHab < 0.5) { vec3 cg = cells(p * 90.0); diffuseColor.rgb *= 0.97 + 0.06 * cg.z; }`;
// 이슬 코팅 (137 B): a glossy candy body covered evenly in clear water drops (two layers of scattered points, so no bald
// patches): each a dome, a white glint up-left, the light gathered on its far side, a darker rim. In the rain (uWet) a
// third layer of smaller drops, and the drops a little bigger
const DEW127 = BUMP115 + `float hh = 0.0, drop = 0.0; vec2 u = vec2(0.0);
  for (int i = 0; i < 3; i++) { if (i == 2 && uWet <= 0.0) break;
    float S = i == 2 ? 10.0 : 6.0; vec4 d = fl127(p * S + float(i) * 5.3, on); float r = length(d.xy);
    float R = (0.24 + 0.1 * fract(d.z * 7.0)) * (1.0 + 0.15 * uWet), m = (1.0 - smoothstep(R - 0.01 - fwidth(r), R, r)) * step(0.1, d.z) * step(d.w, 0.32);
    m *= (i == 2 ? uWet : 1.0) * (1.0 - uAcc); float h = sqrt(max(0.0, 1.0 - r * r / (R * R))) * m;
    if (h > hh) { hh = h; drop = m; u = d.xy / R; } }
  BUMP115(hh, 0.02)
  float ur = length(u), gl = 1.0 - smoothstep(0.2 + 0.08 * uHab, 0.36 + 0.12 * uHab, length(u - vec2(-0.35, 0.4)));
  vec3 c = diffuseColor.rgb * mix(1.2, 0.6, smoothstep(0.5, 1.0, ur));
  c += diffuseColor.rgb * 0.6 * (1.0 - smoothstep(0.0, 0.5, length(u - vec2(0.3, -0.35))));
  diffuseColor.rgb = mix(diffuseColor.rgb, c, drop);
  roughnessFactor = mix(roughnessFactor, 0.02, drop);
  totalEmissiveRadiance += vec3(1.0) * drop * gl * 1.6;`;
// ---- 138 B: the six heroic looks again, no flowers, each its own trick and motif (inbox 138: 「꽃무늬 남발, 더 기발하게」).
// PL138: a flat stitch / bead / veneer grid that follows the body: the face whose axis the normal leans to most (F 0 the
// flanks ±z, 1 the chest and rump ±x, 2 the top and belly ±y). Where two faces meet the grid jumps: a panel seam, as on
// a real beaded or veneered toy.
const PL138 = '#define PL138(Q, F) { vec3 a_ = abs(on); F = a_.y >= max(a_.x, a_.z) ? 2.0 : a_.x >= a_.z ? 1.0 : 0.0; Q = F > 1.5 ? p.xz : F > 0.5 ? p.zy : p.xy; }\n';
// 분청 물고기 (143 A: 철화어문 분청 그릇): the body a buncheong bowl. 귀얄: white slip brushed round it in wavy horizontal
// strokes; where a stroke runs thin the bristles leave streaks of the grey clay (uClay) (at the home distance a grey wash
// in patches). Painted round it in iron (uInk) like the band on a jar: two big fish swimming along each flank (a big one
// high toward the rump, one low toward the chest, so any side view shows two), water weeds on the chest side and the rump,
// a pair of wavy water lines low and high. Placed round the body (the angle round the upright axis, the body's length
// stretched to its width, and the height), so every species carries them on its torso; not on the head end (x > 0.24),
// the top and belly faces or where the surface bends tightly (muzzle, ear, leg, tail). Close up the fish's scale arcs,
// eye ring and gill left in the slip. The accent (mane, hooves, beak) plain slip a shade darker
const BUNFISH138 = AA127 + BUMP115 + `float fade = 1.0 - smoothstep(0.3, 0.7, fwidth(p.y) * 20.0);
  float yb = p.y + 0.02 * sin(p.x * 7.0 + p.z * 5.0) + 0.012 * sin(p.x * 17.0 - p.z * 11.0);
  float tight = smoothstep(11.0, 15.0, length(fwidth(on)) / max(length(fwidth(p)), 1e-5));
  float br = vn3(vec3(p.x * 1.4, yb * 150.0, p.z * 1.4)), thin = smoothstep(0.36, 0.76, vn3(vec3(p.x * 2.4 + 3.0, yb * 7.0, p.z * 2.4))) * (1.0 - 0.6 * tight);
  vec3 col = diffuseColor.rgb;
  if (uAcc < 0.5) {
    float clay = mix(thin * 0.62, (1.0 - AA(br, 0.12 + thin * 0.72)) * (0.4 + 0.6 * thin), fade);
    float lg = smoothstep(5.0, 8.0, max(length(dFdx(on)) / max(length(dFdx(p)), 1e-5), length(dFdy(on)) / max(length(dFdy(p)), 1e-5))) * (1.0 - smoothstep(0.42, 0.52, p.y));
    clay *= 1.0 - 0.9 * max(lg, 1.0 - smoothstep(0.2, 0.32, p.y));
    col = mix(col * (0.96 + 0.05 * br), uClay, clay * 0.8);
    float m = smoothstep(0.88, 0.62, abs(on.y)) * (1.0 - tight) * (1.0 - smoothstep(0.24, 0.34, p.x)) * (1.0 - lg);
    float ph = atan(p.z * 2.2, p.x + 0.05), ink = 0.0, lw = mix(0.035, 0.06, uHab);
    for (int k = 0; k < 4; k++) { float sd = k < 2 ? 1.0 : -1.0, lo = float(k == 0 || k == 2), pc = sd * mix(2.25, 1.45, lo), dr = sd * (lo > 0.5 ? -1.0 : 1.0), S = mix(0.26, 0.22, lo), yc = mix(0.6, 0.38, lo);
      vec2 u = vec2((mod(ph - pc + 3.1416, 6.2832) - 3.1416) * 0.32 * dr, p.y - yc) / S; u.y -= 0.1 * sin(u.x * 1.6 + 0.6 + float(k));
      float xq = (u.x - 0.12) / 0.88, wob = 0.05 * (vn3(vec3(u * 7.0, float(k))) - 0.5), ry = 0.34 * sqrt(max(0.0, 1.0 - xq * xq)) * mix(0.6, 1.0, smoothstep(-0.7, 0.1, u.x));
      float d = abs(u.y) - ry + step(ry, 0.001), t = -0.72 - u.x, fx = abs(u.x + 0.02);
      d = min(d, max(max(-t - 0.06, t - 0.42), max(abs(u.y) - 0.06 - t * 0.95, (t - 0.2) * 1.3 - abs(u.y))));
      d = min(d, max(max(u.y - ry - 0.18 * (1.0 - fx / 0.34), -u.y), fx - 0.34));
      d = min(d, max(max(-u.y - ry - 0.13 * (1.0 - abs(u.x - 0.22) / 0.13), u.y), abs(u.x - 0.22) - 0.13));
      float e = length(u - vec2(0.68, 0.09)), res = max((1.0 - AA(abs(length(u - vec2(1.0, 0.0)) - 0.42), lw)) * step(0.45, u.x) * step(abs(u.y), ry - 0.03), 1.0 - AA(abs(e - 0.07), lw * 0.8));
      if (uHab < 0.5) { vec2 sc = vec2(fract(u.x * 5.0 + 0.5 * floor(u.y * 6.0)) - 0.5, fract(u.y * 6.0));
        res = max(res, (1.0 - AA(abs(length(sc * vec2(1.0, 0.8)) - 0.42), 0.05)) * step(abs(u.y), ry - 0.06) * step(-0.55, u.x) * step(u.x, 0.45) * fade * 0.6); }
      ink = max(ink, (1.0 - AA(d + wob, 0.0)) * (0.82 + 0.18 * vn3(vec3(u.x * 2.5, u.y * 35.0, 2.0))) * (1.0 - res * 0.9)); }
    float fa = abs(ph), fr = step(1.7, fa), wc = mix(0.6, 2.78, fr), wa = (fa - wc) * 0.32, y0 = mix(0.44, 0.2, fr);
    for (int k = 0; k < 3; k++) { float fk = float(k), yt = y0 + 0.24 + 0.05 * fk - 0.07 * step(1.5, fk), a = clamp((p.y - y0) / (yt - y0), 0.0, 1.0);
      float xc = (fk - 1.0) * 0.035 + 0.03 * sin(p.y * 21.0 + fk * 2.0 + wc) * a + 0.05 * a * a * (fk - 1.0);
      ink = max(ink, (1.0 - AA(abs(wa - xc), mix(0.009, 0.014, uHab) * (1.0 - 0.75 * a))) * step(y0, p.y) * step(p.y, yt) * 0.9); }
    for (int k = 0; k < 4; k++) { float fk = float(k), y0 = (k < 2 ? 0.2 : 0.72) + 0.026 * mod(fk, 2.0) + 0.01 * sin(ph * 14.0 + fk * 1.3);
      ink = max(ink, (1.0 - AA(abs(p.y - y0), mix(0.0035, 0.006, uHab))) * 0.85); }
    col = mix(col, uInk, ink * m); }
  BUMP115(br, 0.0012 * fade * (1.0 - uAcc))
  diffuseColor.rgb = col;`;
// 쪽매 나무: veneer pieces, light (uLight), dark (uDark) and between (mixed), glued edge to edge, every piece its own grain
// and a shade lighter or darker; a different classic pattern on each face: tumbling blocks (a hexagon cut into three
// rhombi, a little cube each) on the flanks, a herringbone along the back, triangles on the chest and rump. Close up the
// glue lines and the grain
const MARQ138 = PL138 + AA127 + `float fade = 1.0 - smoothstep(0.3, 0.8, fwidth(p.y) * 30.0), F, tone = 1.0, gg = p.y * 40.0, edge = 1.0, pid = 0.5; vec2 Q; PL138(Q, F)
  if (uAcc < 0.5) {
    if (F > 1.5) { vec2 w = mat2(0.7071, -0.7071, 0.7071, 0.7071) * Q * 16.0, c = floor(w); float k = mod(c.x + c.y, 4.0);
      vec2 o = k < 2.0 ? vec2(c.x - k, c.y) : vec2(c.x, c.y - k + 2.0), l = w - o, sz = k < 2.0 ? vec2(2.0, 1.0) : vec2(1.0, 2.0);
      edge = min(min(l.x, sz.x - l.x), min(l.y, sz.y - l.y)); tone = k < 2.0 ? 0.0 : 1.0; gg = (k < 2.0 ? l.y : l.x) * 5.0; pid = h31(vec3(o, k < 2.0 ? 1.0 : 2.0)); }
    else if (F > 0.5) { vec2 a = Q * 14.0; float v = a.y * 1.1547, u = a.x - 0.5 * v; vec2 c = floor(vec2(u, v)), f = vec2(u, v) - c; float up = step(f.x + f.y, 1.0);
      edge = min(min(f.x, f.y), min(min(1.0 - f.x, 1.0 - f.y), abs(1.0 - f.x - f.y) * 0.7071)) * 0.866; tone = 1.0 - up; gg = (up > 0.5 ? a.y : a.y * 0.5 - a.x * 0.866) * 5.0; pid = h31(vec3(c, up + 3.0)); }
    else { vec2 s = vec2(1.0, 1.7320508), uv = Q * 12.0; vec4 hc = floor(vec4(uv, uv - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
      vec4 h = vec4(uv - hc.xy * s, uv - (hc.zw + 0.5) * s); bool na = dot(h.xy, h.xy) < dot(h.zw, h.zw); vec2 l = na ? h.xy : h.zw, hid = na ? hc.xy : hc.zw + 0.5;
      float an = atan(l.y, l.x), reg = an > 0.5236 && an < 2.618 ? 0.0 : an > -1.5708 && an <= 0.5236 ? 2.0 : 1.0, ra = reg * 2.0944 + 1.5708;
      edge = 0.5 - max(abs(l.x), dot(abs(l), vec2(0.5, 0.8660254)));
      for (int i = 0; i < 3; i++) { float ang = 0.5236 + float(i) * 2.0944; vec2 dr = vec2(cos(ang), sin(ang)); edge = min(edge, dot(l, dr) > 0.0 ? abs(l.x * dr.y - l.y * dr.x) : length(l)); }
      tone = reg * 0.5; gg = dot(l, vec2(cos(ra), sin(ra))) * 5.0; pid = h31(vec3(hid, reg + 5.0)); } }
  vec3 wc = mix(uLight, uDark, tone) * (0.88 + 0.24 * pid);
  float gs = 0.5 + 0.5 * sin(gg * 3.0 + 5.0 * fbm3(p * 5.0 + pid * 17.0)); wc *= mix(0.95, 0.86 + 0.18 * gs, fade);
  if (uHab < 0.5) wc *= mix(1.0, 0.92 + 0.12 * vn3(vec3(gg * 9.0, pid * 30.0, p.y * 20.0)), fade);
  wc = mix(wc, uDark * 0.3, (1.0 - AA(edge, 0.035)) * mix(0.45, 0.9, fade));
  diffuseColor.rgb = wc;`;
// 십자수 (142): a sampler on aida cloth (the body's colour: woven blocks, a hole at every corner, countable close up), the
// motifs in set places, not scattered: a big pixel heart (uT1, a paler highlight) on each flank, a zigzag border (uT1
// between two uT2 rows) round the legs, a diamond border (uT3) round the neck, two-colour stripes on the tail, small stars
// (uT3) and checks (uT2) on the back. 30 stitches to the body height, so the heart and the borders still read at the home
// camera (there the stitches merge into flat pixels). Close up each stitch a raised X of twisted thread, the top leg over
// the under one, a soft shadow on the cloth round it and the cloth showing at the corners; uGold 1: metallic gold thread
const XST138 = PL138 + AA127 + BUMP115 + `float fade = 1.0 - smoothstep(0.3, 0.7, fwidth(p.y) * 30.0), dxs = fade * (1.0 - uHab), F; vec2 Q; PL138(Q, F)
  vec2 g = Q * 30.0, c = floor(g), f = g - c - 0.5, af = abs(f); float id = 0.0, tight = step(13.0 * length(fwidth(p)), length(fwidth(on)));
  if (uAcc < 0.5) {
    if (F < 0.5) { vec2 h = vec2(c.x + 6.0, 19.0 - c.y);
      if (h.x > -0.5 && h.x < 8.5 && h.y > -0.5 && h.y < 7.5) {
        float bits = h.y < 0.5 ? 198.0 : h.y < 1.5 ? 495.0 : h.y < 3.5 ? 511.0 : h.y < 4.5 ? 254.0 : h.y < 5.5 ? 124.0 : h.y < 6.5 ? 56.0 : 16.0;
        if (mod(floor(bits / exp2(h.x)), 2.0) > 0.5) id = h.x > 0.5 && h.y > 0.5 && h.x + h.y < 3.5 ? 4.0 : 1.0; } }
    if (F < 1.5 && c.y > 2.5 && c.y < 8.5) { float r = c.y - 3.0; id = r < 0.5 || r > 4.5 ? 2.0 : abs(r - 1.0 - abs(mod(c.x, 6.0) - 3.0)) < 0.5 ? 1.0 : 0.0; }
    if (F < 1.5 && p.x > 0.15 && c.y > 14.5 && c.y < 19.5) { float r = c.y - 15.0; id = r < 0.5 || r > 3.5 ? 2.0 : abs(abs(r - 2.0) + abs(mod(c.x, 4.0) - 2.0) - 1.0) < 0.5 ? 3.0 : 0.0; }
    if (p.x < -0.3 && p.y > 0.3 && tight > 0.5) { float m = mod(c.y, 3.0); id = m < 0.5 ? 2.0 : m < 1.5 ? 3.0 : 0.0; }
    if (F > 1.5 && on.y > 0.0 && p.y > 0.45) { vec2 t = mod(c, 10.0), T = floor(c / 10.0), s = t - 2.0;
      if (mod(T.x + T.y, 2.0) < 0.5) { if (s.x > -0.5 && s.x < 4.5 && s.y > -0.5 && s.y < 4.5) {
          float bits = s.y < 0.5 ? 17.0 : s.y < 1.5 ? 10.0 : s.y < 2.5 ? 14.0 : s.y < 3.5 ? 31.0 : 4.0; if (mod(floor(bits / exp2(s.x)), 2.0) > 0.5) id = 3.0; } }
      else { s = t - 3.0; if (s.x > -0.5 && s.x < 3.5 && s.y > -0.5 && s.y < 3.5 && mod(s.x + s.y, 2.0) < 0.5) id = 2.0; } } }
  float sc = step(0.5, id);
  vec3 th = id < 1.5 ? uT1 : id < 2.5 ? uT2 : id < 3.5 ? uT3 : mix(uT1, vec3(1.0), 0.45);
  float hole = 1.0 - AA(length(0.5 - af), 0.12), blk = 1.0 - smoothstep(0.3, 0.5, max(af.x, af.y)), wv = 0.5 + 0.5 * sin(g.x * 12.566) * sin(g.y * 12.566);
  vec3 cl = diffuseColor.rgb * mix(1.0, (0.88 + 0.12 * blk + 0.06 * wv) * (1.0 - 0.45 * hole), dxs);
  float w = 0.16, d1 = abs(f.x - f.y) * 0.7071, d2 = abs(f.x + f.y) * 0.7071, en = 1.0 - AA(max(af.x, af.y), 0.43);
  float a2 = (1.0 - AA(d2, w)) * en, xs = max((1.0 - AA(d1, w)) * en, a2);
  float rr = mix(sqrt(max(0.0, 1.0 - d1 * d1 / (w * w))) * 0.85, sqrt(max(0.0, 1.0 - d2 * d2 / (w * w))), a2);
  float al = a2 > 0.5 ? f.x - f.y : f.x + f.y, ac = a2 > 0.5 ? f.x + f.y : f.x - f.y, tw = 0.8 + 0.2 * sin((al * 3.5 + ac * 2.0) * 4.4429);
  vec3 tc = th * mix(1.0, (0.55 + 0.45 * rr) * tw * mix(0.8, 1.0, a2), dxs);
  cl *= mix(1.0, 1.0 - 0.35 * sc * (1.0 - AA(min(d1, d2), w + 0.13)) * (1.0 - xs), dxs);
  float cov = sc * mix(0.92, xs, fade);
  diffuseColor.rgb = mix(cl, tc, cov);
  float hh = sc * xs * (0.6 + 0.4 * rr * mix(0.8, 1.0, a2) + 0.1 * tw) + (1.0 - sc) * (0.15 * blk - 0.3 * hole); BUMP115(hh, 0.004 * dxs)
  roughnessFactor = mix(roughnessFactor, mix(0.5, 0.3, uGold), cov); metalnessFactor = mix(metalnessFactor, uGold, cov);
  totalEmissiveRadiance += th * pow(rr, 6.0) * cov * 0.08 * dxs;`;
// 마블링 종이 (143 A: ebru): marbled paper as it is made: drops of paint (uC1, uC2, a ring of the other round each, a thin
// ring of paper in the middle) floated on the paper colour (here and there a wash of uC3), their edges pressed into thin
// veins; a stylus swirled through them (curls round centres on a grid, each its own way round, fading to nothing at the
// grid cell's edge so no seam), the fbm wobble on top, then a comb drawn up the body and a second one down between its
// teeth (every drop pulled into a feather, its tip on the tooth). No straight zigzag: the feathers' barbs bend. Matte
// paper, its fibres close up
const MARB138 = AA127 + `float fade = 1.0 - smoothstep(0.3, 0.8, fwidth(p.y) * 30.0);
  vec3 q = p * 4.5;
  float tx = q.x * 1.6 + 0.35 * sin(q.y * 1.3 + q.z * 1.1), t1 = abs(fract(tx) - 0.5), t2 = 0.5 - t1;
  q.y -= fade * 0.6 * (exp(-t1 * 10.0) - exp(-t2 * 10.0));
  vec3 qs = q * 0.42, ci = floor(qs), lc = fract(qs) - 0.5, r = (lc - (h33(ci) - 0.5) * 0.2) / 0.42; float sid = h31(ci);
  float th = (sid < 0.42 ? 10.0 : sid < 0.84 ? -10.0 : 0.0) * exp(-dot(r, r) * 1.0) * (1.0 - smoothstep(0.28, 0.46, max(max(abs(lc.x), abs(lc.y)), abs(lc.z))));
  float cs = cos(th), sn = sin(th); q += r * (cs - 1.0) + cross(on, r) * sn + on * dot(on, r) * (1.0 - cs);
  q += 0.45 * vec3(fbm3(q * 0.55) - 0.5, fbm3(q * 0.55 + 7.0) - 0.5, 0.0);
  vec3 c = cells(q), g = diffuseColor.rgb; float id = c.z, rg = c.x, r0 = 0.29 + 0.2 * abs(id - 0.5);
  vec3 k1 = id < 0.45 ? uC1 : uC2, k2 = id < 0.45 ? uC2 : uC1, col = id > 0.62 ? uC3 : g;
  col = mix(col, k2, 1.0 - AA(rg, r0 + 0.09));
  col = mix(col, k1, 1.0 - AA(rg, r0));
  col = mix(col, g, (1.0 - AA(abs(rg - r0 * 0.5), 0.025)) * fade);
  col = mix(col, uC1 * 0.8 + g * 0.1, (1.0 - AA(c.y - c.x, 0.035)) * 0.7);
  col = uAcc > 0.5 ? g : col;
  if (uHab < 0.5) { float fb = fbm3(p * vec3(30.0, 8.0, 30.0)); col *= 0.95 + 0.08 * fb; }
  diffuseColor.rgb = col; roughnessFactor = 0.85;`;
// 두드린 동판 (141 C): copper hammered all over with a round-faced hammer: every blow a round shallow bowl, the bowls summed
// (each falls off smoothly to its rim, so no sharp ridge where they meet) and each holds a small round reflection. The
// patina (dull verdigris) lies softly in the bowls' bottoms, in uPat of them (녹청: nearly all, and a darker old metal)
const HAM138 = AA127 + `float fade = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 26.0);
  vec3 q = p * 26.0, qi = floor(q), qf = fract(q), gs = vec3(0.0); float hs = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z), r = o + h33(qi + o) * 0.6 + 0.2 - qf; r -= on * dot(r, on);
    float id = h31(qi + o + 0.5), R = 0.52 + 0.14 * fract(id * 7.3), k = max(0.0, 1.0 - dot(r, r) / (R * R));
    hs += k * k; gs += r * (4.0 * k / (R * R)); }
  normal = normalize(normal + normalMatrix * gs * 0.06 * fade);
  float pat = smoothstep(0.88 - 0.55 * uPat, 0.98 - 0.55 * uPat, fbm3(p * 4.0 + 3.0)) * smoothstep(0.45, 0.9, hs) * 0.9 * (1.0 - uAcc);
  vec3 col = diffuseColor.rgb * mix(1.0, 0.8, uPat * 0.5) * (1.0 - 0.06 * fade * min(hs, 1.0));
  diffuseColor.rgb = mix(col, vec3(0.13, 0.31, 0.24) * (0.85 + 0.3 * vn3(q * 2.0)), pat);
  metalnessFactor = mix(metalnessFactor, 0.0, pat); roughnessFactor = mix(roughnessFactor, 0.85, pat); lookStudio *= 1.0 - pat;`;
// 비즈 공예: the whole body in rows of small glass seed beads (brick stagger, a dark thread in the gaps), bands of twelve
// rows: two solid rows (uB1), a row of sawtooth triangles (uB2), dots (uB3) on the ground colour. uRain 1: each band a
// hue further round the rainbow (the triangles the opposite hue). Each bead a glass barrel: bright middle, dark rim, a
// highlight; a few twinkle as the figure turns
const BEADS138 = PL138 + AA127 + BUMP115 + `float fade = 1.0 - smoothstep(0.25, 0.6, fwidth(p.y) * 40.0), F; vec2 Q; PL138(Q, F)
  vec2 g = Q * vec2(36.0, 40.0); float row = floor(g.y); g.x += 0.5 * mod(row, 2.0); float cl = floor(g.x);
  vec2 f = fract(g) - 0.5, af = abs(f) / vec2(0.47, 0.42); float r = pow(af.x * af.x * af.x + af.y * af.y * af.y, 0.3333);
  float br = mod(row, 12.0), bn = floor(row / 12.0), z = abs(mod(cl, 8.0) - 4.0);
  vec3 c1 = uRain > 0.5 ? rainbow(bn * 0.19) : uB1, c2 = uRain > 0.5 ? rainbow(bn * 0.19 + 0.5) : uB2, c = diffuseColor.rgb;
  float dm = mod(cl, 6.0); if (uAcc < 0.5) { if (br < 3.0) c = c1; else if (br < 8.0) { if (z <= 6.0 - br) c = c2; } else if (br > 8.5 && (dm < 1.0 || br == 10.0 && dm > 4.5)) c = uB3; }
  float bead = 1.0 - AA(r, 0.9), dome = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
  vec3 bc = c * mix(1.0, 0.5 + 0.7 * dome, fade);
  diffuseColor.rgb = mix(c * mix(0.75, 0.3, fade), bc, mix(1.0, bead, fade));
  float hh = dome * bead; BUMP115(hh, 0.004 * fade)
  float hl = (1.0 - smoothstep(0.08, 0.22, length(f - vec2(-0.14, 0.12)))) * bead * fade;
  float tw = step(0.93, h31(vec3(cl, row, F + 0.5))) * pow(max(0.0, sin(dot(normal, vec3(11.0, 8.0, 6.0)) + h31(vec3(row, cl, 3.0)) * 50.0)), 8.0);
  totalEmissiveRadiance += vec3(1.0) * (hl * 0.25 + tw * hl * mix(3.0, 1.5, uHab));
  roughnessFactor = mix(0.5, roughnessFactor, bead);`;
// ---- 146 (inbox 146): two raised craft looks in place of 분청 물고기 and 마블링 종이 (retired: data.js RETIRED146; their GLSL
// above stays). Both are things you could run a finger over, not pictures (inbox 146: the passed four are all raised).
// fn146: put GLSL functions before main (as fn128)
const fn146 = (m, code) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', code + 'void main() {'); }; return m; };
// coil146: the paper coils near q (coil cells; J: how far each centre may stray per axis, 0 in y keeps them in rows), each a
// strip of paper rolled up and stood on its edge on the card (round, or pinched to a teardrop toward a random tip), height H,
// radius about 0.6 cells (rs: a scale; overlapping coils meet flat, as packed coils press together).
// D: the eye's slide across the surface per unit of height (parallax), L: the light's. The coil the eye meets first wins (the
// highest hit: its top, else its outer wall); between coils the card, in the coils' cast shadows.
// a: x = the hit's height / H (-1: the card), y = how far out on the coil (0 middle, 1 rim), z = the angle round it, w = the
// wall's light. b: x = the coil's random number, y = the card's shadow, z = the card's gap to the nearest coil, w = cluster
const QFN146 = `void coil146(vec3 q, vec3 n, vec3 D, vec3 L, vec3 J, float cs, float rs, out vec4 a, out vec4 b) {
  vec3 qi = floor(q), qf = fract(q); float best = -1.0, sh = 0.0, gap = 9.0; a = vec4(-1.0, 1.0, 0.0, 1.0); b = vec4(0.0, 0.0, 9.0, 0.5);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z), ci = qi + o, cp = o + 0.5 + (h33(ci) - 0.5) * J, r = qf - cp; float w = dot(r, n); r -= n * w;
    float id = h31(ci + 0.37), R = (0.56 + 0.08 * h31(ci + 5.1)) * rs, R2 = R * R - 0.3 * w * w; if (R2 < 0.03 || abs(w) > 0.62) continue;
    float Re = sqrt(R2), H = 0.22 + 0.06 * h31(ci + 9.7), tear = step(0.62, id) * 0.45;
    vec3 tp = h33(ci + 2.3) - 0.5 + n.yzx * 0.01; tp = normalize(tp - n * dot(tp, n) + 1e-5); vec3 bt = cross(n, tp);
    vec3 dl = L * H; float t = clamp(-dot(r, dl) / max(dot(dl, dl), 1e-5), 0.0, 1.0); sh = max(sh, 1.0 - smoothstep(Re - 0.12, Re + 0.03, length(r + dl * t)));
    gap = min(gap, length(r) - Re);
    vec3 dh = D * H, yy = r + dh; float al = dot(yy, tp), ac = dot(yy, bt), al2 = al > 0.0 ? al / (1.0 + tear) : al, u2 = clamp(al2 / Re, 0.0, 1.0);
    float rho = length(vec2(al2, ac / (1.0 - 0.8 * tear * u2 * u2))) / Re, ht = -1.0;
    if (rho < 1.0) ht = H;
    else { float A = dot(dh, dh), B = dot(r, dh), C = dot(r, r) - Re * Re, dsc = B * B - A * C;
      if (dsc >= 0.0 && A > 1e-5) { float u = (-B + sqrt(dsc)) / max(A, 1e-5); if (u >= 0.0 && u <= 1.0) { ht = u * H * 0.999; yy = r + dh * u; al = dot(yy, tp); ac = dot(yy, bt); rho = 1.0; } } }
    float sc = ht < H ? ht : H + 0.5 * (1.0 - rho); // tops over walls; two tops: the nearer middle (packed coils press flat)
    if (sc > best) { best = sc; float wl = dot(yy, L) / (Re * max(length(L), 0.35));
      a = vec4(ht / H, rho, atan(ac, al), ht < H ? 0.55 + 0.45 * clamp(wl, -1.0, 1.0) : 1.0); b.x = id; b.w = vn3((qi + cp) * cs) + 0.3 * (id - 0.5); } }
  b.y = sh; b.z = gap; }
`;
// 페이퍼 퀼링: the body covered in paper quilling on a card (the material's colour): coils of strip stood on edge, packed close
// (11 to the body height on the torso, round ones and teardrops, a little uneven in height), small ones in rows round the legs
// (20 to the height, below a strip run round on edge at y 0.27). Each coil's top the strip's spiral (a dark gap between the
// turns, a hole in the middle), its outer wall where the eye sees past it (lit on the light's side), and a shadow cast on the
// card. Colours in clusters over the body: uQ1..uQ3 (uRain 1: pastel rainbow; uGold 1: gold foil strips, metal). The accent
// (mane, hooves, beak) all in uQA
const QUILL146 = AA127 + BUMP115 + `float fade = 1.0 - smoothstep(0.2, 0.5, fwidth(p.y) * 9.0), dx = fade * (1.0 - 0.7 * uHab);
  vec3 vo = normalize(vdir * normalMatrix), lo = normalize(normalize(vec3(-0.35, 0.8, 0.55)) * normalMatrix);
  float vn = max(dot(vo, on), 0.45), ln = max(dot(lo, on), 0.35); vec3 D = (vo - on * dot(vo, on)) / vn, L = (lo - on * dot(lo, on)) / ln;
  float y0 = 0.27, band = 1.0 - AA(abs(p.y - y0), 0.009), leg = step(p.y, y0); vec4 a, b;
  if (leg > 0.5) coil146(p * 20.0, on, D, L, vec3(0.3, 0.0, 0.3), 0.0, 0.85, a, b); else coil146(p * 11.0, on, D, L, vec3(0.45), 0.1, 1.0, a, b);
  float coil = step(0.0, a.x), k = b.w + 0.25 * (b.x - 0.5);
  vec3 sc = k < 0.42 ? uQ1 : k < 0.62 ? uQ2 : uQ3;
  if (uRain > 0.5) sc = mix(rainbow(b.w * 1.6 + 0.2 * b.x), vec3(1.0), 0.22);
  if (uAcc > 0.5) sc = uQA * (0.92 + 0.16 * b.x);
  vec3 card = uAcc > 0.5 ? uQA * 0.45 : diffuseColor.rgb;
  float fw = fwidth(a.y), nt = clamp(0.2 / max(fw, 1e-4), 2.0, mix(7.0, 5.0, leg)); // far off fewer, wider turns (the coil still reads)
  float s = a.y * nt + a.z / 6.2832, sf = 1.0 - smoothstep(0.35, 0.6, fw * nt);
  float turn = abs(fract(s) - 0.5) * 2.0, gp = (1.0 - AA(1.0 - turn, 0.1)) * step(0.14, a.y) * sf * dx, hole = 1.0 - AA(a.y, 0.12);
  float topf = step(0.999, a.x), ridge = 1.0 - AA(turn, 0.4);
  vec3 col = sc * mix(1.0, mix(0.62, 1.06, ridge), dx * topf * sf * step(0.14, a.y));
  col *= 1.0 - topf * max(gp * 0.4, hole * 0.6);
  col *= mix(1.0, a.w, 1.0 - topf);
  col *= mix(1.0, 0.82, (1.0 - topf) * (1.0 - smoothstep(0.0, 0.25, a.x)));
  col *= 1.0 - 0.18 * topf * smoothstep(0.85, 1.0, a.y);
  vec3 bg = card * (1.0 - 0.6 * b.y) * mix(0.3, 0.9, smoothstep(0.0, 0.2, b.z));
  col = mix(bg, col, coil);
  col = mix(col, (uAcc > 0.5 ? uQA : uQ1) * mix(0.8, 1.1, AA(p.y, y0 + 0.002)), band);
  diffuseColor.rgb = col;
  float hh = mix(mix(0.0, a.x - 0.25 * gp - 0.5 * hole * topf, coil), 1.0, band); BUMP115(hh, 0.0015 * dx)
  float met = uGold * max(coil, band); metalnessFactor = met; roughnessFactor = mix(roughnessFactor, 0.3, met); lookStudio = 0.75 * met;`;
// 가죽 공예: a toy sewn from leather panels (the material's colour, each panel a shade off): a seam along the spine, one round
// the neck (x 0.22), a cuff round the legs and lower body (y 0.22), an oval panel laid on each flank. Every seam a lap seam: the
// upper panel's cut edge stands up (its thickness a dark burnished band, uEdge) and throws a shadow on the lower one; beside it
// a groove and a saddle stitch, raised slanted stitches every 0.02 (uThread; uGold 1: gold thread), a hole at each end. In the
// oval: a pressed double border, a basketweave stamp and a round medallion with an eight-point compass star. All over a fine
// pebble grain and a few soft creases; a soft sheen. The accent (mane, hooves, beak) plain leather a shade darker, no seams
const LEATHER146 = AA127 + BUMP115 + `float fade = 1.0 - smoothstep(0.2, 0.55, fwidth(p.y) * 30.0), dx = fade * (1.0 - 0.6 * uHab);
  float tight = smoothstep(11.0, 15.0, length(fwidth(on)) / max(length(fwidth(p)), 1e-5)), ds = 9.0, ph = 0.0, stamp = 0.0, hh = 0.0, thr = 0.0;
  vec3 col = diffuseColor.rgb;
  if (uAcc < 0.5) {
    if (on.y > 0.35 && p.x < 0.22 && p.y > 0.3) { ds = p.z; ph = p.x; }
    float d2 = p.x - 0.22; if (p.y > 0.3 && abs(d2) < abs(ds)) { ds = -d2; ph = abs(on.z) > abs(on.y) ? p.y : p.z; }
    float d3 = p.y - 0.22; if (abs(d3) < abs(ds)) { ds = d3; ph = abs(on.z) > abs(on.x) ? p.x : p.z; }
    vec2 v = vec2(p.x + 0.02, p.y - 0.53), rr = vec2(0.22, 0.13); float sd = (length(v / rr) - 1.0) * 0.13, side = step(0.55, abs(on.z)) * (1.0 - step(0.5, tight)) * step(0.3, p.y);
    if (side > 0.5 && abs(sd) < abs(ds)) { ds = -sd; ph = atan(v.y / rr.y, v.x / rr.x) * 0.175; }
    float pnl = (p.z > 0.0 ? 1.0 : 2.0) + (p.x > 0.22 ? 3.0 : 0.0) + (p.y < 0.22 ? 5.0 : 0.0) + (side > 0.5 && sd < 0.0 ? 7.0 : 0.0);
    col *= 0.93 + 0.14 * h31(vec3(pnl, 1.0, 2.0));
    // the lap: ds > 0 the upper panel (its edge at 0), < 0 the lower
    float up = AA(ds, 0.0), edge = up * (1.0 - AA(ds, mix(0.0045, 0.006, uHab))), shd = (1.0 - up) * (1.0 - smoothstep(0.0, 0.012, -ds));
    col *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.03, abs(ds)));
    col = mix(col, uEdge, edge); col *= 1.0 - 0.45 * shd;
    float gv = (1.0 - AA(abs(ds - 0.017), mix(0.0018, 0.003, uHab))) * dx; col *= 1.0 - 0.3 * gv;
    // saddle stitch: one every 0.02 along the seam, slanted, raised, a hole at each end
    float u = fract(ph / 0.02) - 0.5, inrow = step(abs(ds - 0.017), 0.012); vec2 st = mat2(0.906, 0.423, -0.423, 0.906) * vec2(u, (ds - 0.017) / 0.02);
    thr = (1.0 - AA(length(vec2(max(abs(st.x) - 0.26, 0.0), st.y)), mix(0.11, 0.16, uHab))) * inrow; float tr = sqrt(max(0.0, 1.0 - st.y * st.y / 0.0121));
    float hol = (1.0 - AA(length(vec2(abs(st.x) - 0.36, st.y)), 0.07)) * dx * inrow * (1.0 - thr);
    col *= 1.0 - 0.6 * hol;
    col = mix(col, uThread * mix(1.0, 0.7 + 0.3 * tr, dx) * (0.9 + 0.1 * sin(st.x * 40.0 + st.y * 20.0)), thr);
    hh = 0.6 * up + thr * (0.8 + 0.6 * tr) - 0.4 * gv - 0.5 * hol;
    // the oval's stamp: a pressed double border, basketweave, the medallion and its star
    { // no branch round it: AA's fwidth needs the whole 2x2 quad (the mask is the last factor)
      float bl = max(1.0 - AA(abs(sd + 0.035), 0.003), 1.0 - AA(abs(sd + 0.043), 0.0015));
      vec2 g = v / 0.032, gc = floor(g), gf = fract(g); float ck = mod(gc.x + gc.y, 2.0), lu = ck > 0.5 ? gf.x : gf.y, lv = ck > 0.5 ? gf.y : gf.x;
      float bw = (1.0 - smoothstep(0.1, 0.25, abs(fract(lu * 3.0) - 0.5))) * smoothstep(0.03, 0.12, lv) * (1.0 - smoothstep(0.88, 0.97, lv));
      float mr = length(v), ma = atan(v.y, v.x), med = AA(mr, 0.062), ring = max(1.0 - AA(abs(mr - 0.062), 0.003), 1.0 - AA(abs(mr - 0.052), 0.0015));
      float sa = abs(mod(ma + 0.3927, 0.7854) - 0.3927), sr = mix(0.045, 0.016, smoothstep(0.0, 0.3927, sa)) * mix(1.0, 0.7, step(0.5, mod(floor((ma + 0.3927) / 0.7854), 2.0)));
      float star = 1.0 - AA(mr, sr);
      stamp = max(bl, max(bw * AA(sd, -0.035) * med * 0.8 * dx, max(ring * 0.9, star * 0.75))) * (1.0 - AA(sd, -0.008)) * side * step(sd, -0.004);
      col *= 1.0 - 0.38 * stamp; hh -= 0.7 * stamp; }
  } else col *= 0.92;
  // grain and creases
  vec3 cg = cells(p * 160.0); float peb = smoothstep(0.0, 0.5, cg.y - cg.x), cr = 1.0 - abs(vn3(p * vec3(14.0, 34.0, 14.0)) * 2.0 - 1.0);
  float crease = smoothstep(0.93, 0.99, cr) * smoothstep(0.45, 0.8, vn3(p * 5.0));
  col *= mix(1.0, (0.94 + 0.08 * peb) * (1.0 - 0.1 * crease), dx);
  diffuseColor.rgb = col;
  float bh = hh * 0.004 + (peb * 0.0012 - crease * 0.0015) * dx; BUMP115(bh, 1.0)
  roughnessFactor = mix(roughnessFactor, 0.62, stamp); metalnessFactor = uGold * thr; roughnessFactor = mix(roughnessFactor, 0.3, uGold * thr); lookStudio = 0.7 * uGold * thr;`;
Object.assign(LOOKS, {
  quilling: c => { const q = (b, a) => fn146(L127(phys(b, { roughness: 0.82, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }), 'quill146', QUILL146,
      { uQ1: c.q1, uQ2: c.q2, uQ3: c.q3, uQA: c.acc, uRain: c.rain ?? 0, uGold: c.gold ?? 0, uAcc: a }, { studio: 0 }), QFN146), accent = q(c.acc, 1);
    return { body: q(c.body, 0), accent, hoof: accent }; },
  leather: c => { const l = (b, a) => L127(phys(b, { roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.35 }), 'leather146', LEATHER146,
      { uThread: c.thread, uEdge: c.edge, uGold: c.gold ?? 0, uAcc: a }, { studio: 0 }), accent = l(dk(c.body, 0.85), 1);
    return { body: l(c.body, 0), accent, hoof: accent }; },
});
Object.assign(LOOKS, {
  wood: c => { const w = (b, g) => L127(phys(b, { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.12 }), 'wood127', WOOD127, { uGrain: g }), accent = w(dk(c.body, 0.82), dk(c.grain, 0.82));
    return { body: w(c.body, c.grain), accent, hoof: accent }; },
  chrome: c => same(shine(c.body, 0.04)),
  velvet: c => { const v = b => L127(phys(b, { roughness: 1, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(b).lerp(new THREE.Color('#ffffff'), 0.4) }), 'velvet127', VELVET127), accent = v(dk(c.body, 0.85));
    return { body: v(c.body), accent, hoof: accent }; },
  marble: c => same(L127(phys(c.body ?? '#efe7d8', { roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.08 }), 'marble127', MARBLE127, { uVein: c.vein ?? '#5e534a' })),
  dew: c => { const d = (b, a) => wet127(L127(phys(b, { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }), 'dew127', DEW127, { uAcc: a })), accent = d(dk(c.body, 0.85), 1);
    return { body: d(c.body, 0), accent, hoof: accent }; },
  bunfish: c => { const b = (col, a) => L127(phys(col, { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }), 'bunfish138', BUNFISH138, { uInk: c.ink, uClay: c.clay, uAcc: a }), accent = b(dk(c.body, 0.88), 1);
    return { body: b(c.body, 0), accent, hoof: accent }; },
  marquetry: c => { const w = a => L127(phys(c.light, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.2 }), 'marq138', MARQ138, { uLight: c.light, uDark: c.dark, uAcc: a }), accent = w(1);
    return { body: w(0), accent, hoof: accent }; },
  xstitch: c => { const x = (b, a) => L127(phys(b, { roughness: 0.9, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }), 'xst138', XST138, { uT1: c.t1, uT2: c.t2, uT3: c.t3 ?? c.t2, uGold: c.gold ?? 0, uAcc: a }), accent = x(dk(c.body, 0.85), 1);
    return { body: x(c.body, 0), accent, hoof: accent }; },
  marbled: c => { const m = (b, a) => L127(phys(b, { roughness: 0.85 }), 'marb138', MARB138, { uC1: c.c1, uC2: c.c2, uC3: c.c3, uAcc: a }), accent = m(dk(c.body, 0.88), 1);
    return { body: m(c.body, 0), accent, hoof: accent }; },
  hammered: c => { const k = (b, a) => L127(phys(b, { roughness: 0.26, metalness: 1 }), 'ham138', HAM138, { uPat: c.pat ?? 0.3, uAcc: a }, { studio: 0.6 }), accent = k(dk(c.body, 0.85), 1);
    return { body: k(c.body, 0), accent, hoof: accent }; },
  beads: c => { const g = (b, a) => L127(phys(b, { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }), 'beads138', BEADS138, { uB1: c.b1, uB2: c.b2, uB3: c.b3, uRain: c.rain ?? 0, uAcc: a }), accent = g(dk(c.body, 0.85), 1);
    return { body: g(c.body, 0), accent, hoof: accent }; },
});
Object.assign(LOOKS, {
  carousel128: () => ({ body: L127(phys('#fdf6ec', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }), 'carousel128', CAROUSEL128, {}, { studio: 0.2 }),
    accent: L127(phys('#ffc75a', { roughness: 0.2, metalness: 1 }), 'curl128', CURL128, {}, { studio: 0.85 }), hoof: shine('#ffc75a') }),
  dandelion128: () => ({ body: L127(phys('#ffffff', { roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#f4f8ff') }), 'dandelion128', DANDELION128),
    accent: phys('#f5dc7a', { roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.15 }), hoof: phys('#6a9450', { roughness: 0.4 }) }),
  sakura128: () => { const s = acc => L127(phys('#ffffff', { roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.2 }), 'sakura128', SAKURA128, { uAcc: acc });
    const body = s(0); return { body, accent: s(1), hoof: body }; },
  topiary128: () => { const t = (acc, s) => L127(phys('#4a8a3a', { roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#c8f0a0') }), 'topiary128', TOPIARY128, { uAcc: acc, uS: s });
    return { body: t(0, 26), accent: t(1, 40), beak: phys('#1e3418', { roughness: 0.6 }), hoof: phys('#c0643a', { roughness: 0.55 }) }; },
  flowercow128: () => { const c = acc => L127(phys('#fbf8f2', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 }), 'flowercow128', FLOWERCOW128, { uAcc: acc });
    return { body: c(0), accent: c(1), beak: phys('#f4a8b0', { roughness: 0.3, clearcoat: 0.6 }), nostril: phys('#3a2a2c', { roughness: 0.2 }), horn: phys('#9cc87a', { roughness: 0.25, clearcoat: 0.8 }), hoof: phys('#a8683e', { roughness: 0.35, clearcoat: 0.5 }) }; },
  vane128: () => { const b = s => L127(phys('#d6a048', { roughness: 0.3, metalness: 1 }), 'vane128', VANE128, { uS: s }, { studio: 0.85 });
    return { body: b(22), wing: b(15), accent: L127(phys('#d8603a', { roughness: 0.28, metalness: 1 }), 'fletch128', FLETCH128, {}, { studio: 0.85 }), beak: shine('#e8b858', 0.22), hoof: shine('#b07a38', 0.3) }; },
});
// ---- 152 B 신수 유니콘 (160 A 공개; data.js MYTHIC152, below the gumiho): the carousel horse (131: kept as its base) as it is, the same
// materials (carousel128's own objects), with a horn on its brow and a pair of carved gold-leaf wings on its withers; 1.2x the horse.
// Horn: a pearl cone twisted in two strands (3 turns), gold in the grooves, its tip lit at night (and a soft glow sprite there).
// Wings: one shape (a fan of seven long round-ended feathers under two rows of small coverts, the leading edge a smooth arm), the
// left one its mirror; folded back along the withers, pose({ wings: 1 }) spread up and out, a small lift at a walk (figure.js own.pose).
// One horn / wing / glow geometry, material and texture for every unicorn (made once and kept, like the looks' own materials); dispose152 frees them (no caller yet: nothing tears the looks down).
const TW152 = 6 * Math.PI, NF152 = 7, DA152 = 0.19, FA152 = 0.26 + DA152 / 2, FE152 = 0.26 - (NF152 - 0.5) * DA152, R0152 = 1 - DA152 / 2, RE152 = 0.5 * R0152;
// the wing's outline round its root (radius at angle f in its plane; x the span, y the leading edge): the fan's feathers (k 0 the
// longest, at the top), the arm above it and the inner edge below falling back to a small hub; the shader finds its feathers the same way
const R152 = f => f > FA152 ? 0.11 + (R0152 - 0.11) * Math.exp(-2 * (f - FA152)) : f < FE152 ? 0.11 + (RE152 - 0.11) * Math.exp(-4.4 * (FE152 - f))
  : (() => { const k = (FA152 - f) / DA152, q = 2 * (k % 1) - 1; return (1 - 0.5 * (k / NF152) ** 1.2) * (1 - DA152 / 2 * (1 - Math.sqrt(Math.max(0, 1 - q * q)))); })();
const g152 = v => v.toFixed(4);
const HORN152 = SH89 + GILD89 + `float c = cos(2.0 * atan(p.z, p.x) - ${g152(TW152)} * p.y);
  diffuseColor.rgb = mix(vec3(1.0, 0.94, 0.93), vec3(0.99, 0.97, 0.92), 0.5 + 0.5 * c);
  totalEmissiveRadiance += rainbow(nv * 1.3 + p.y * 0.8) * pow(1.0 - nv, 2.0) * 0.22;
  GILD((1.0 - SH(c, -0.45)) * (1.0 - SH(p.y, 0.88)));
  float tip = smoothstep(0.55, 1.0, p.y); totalEmissiveRadiance += vec3(1.0, 0.86, 0.6) * tip * tip * uNight * 2.4;`;
// p: the wing's own unit space. k: the feather (fan angle), s: 0 at the root to 1 at the outline. Long feathers: a rounded ridge each with
// a raised shaft, grooves between; over their roots a row of coverts two to a feather, by the root a row three to one (the arm and the inner
// edge past them smooth); the grooves darker (old gilt), gone where they would shimmer; close up the gold leaf's crackle
const WING152 = GILD89 + BUMP115 + `float f = atan(p.y, p.x); f += step(f, ${g152(FE152 - 1.5)}) * 6.2832;
  float k = (${g152(FA152)} - f) / ${g152(DA152)}, q = 2.0 * fract(k) - 1.0, fan = step(0.0, k) * step(k, ${NF152}.0), fk = fwidth(k);
  float R = f > ${g152(FA152)} ? 0.11 + ${g152(R0152 - 0.11)} * exp(-2.0 * (f - ${g152(FA152)})) : f < ${g152(FE152)} ? 0.11 + ${g152(RE152 - 0.11)} * exp(-4.4 * (${g152(FE152)} - f))
    : (1.0 - 0.5 * pow(clamp(k / ${NF152}.0, 0.0, 1.0), 1.2)) * (1.0 - ${g152(DA152 / 2)} * (1.0 - sqrt(max(0.0, 1.0 - q * q))));
  float s = length(p.xy) / R, fs = fwidth(s), fade = 1.0 - smoothstep(0.25, 0.7, fs * 14.0);
  float q2 = 2.0 * fract(k * 2.0 + 0.5) - 1.0, q3 = 2.0 * fract(k * 3.0) - 1.0;
  float e2 = mix(1.5, 0.6 - 0.08 * (1.0 - sqrt(max(0.0, 1.0 - q2 * q2))), fan), e3 = 0.34 - 0.05 * (1.0 - sqrt(max(0.0, 1.0 - q3 * q3)));
  float l1 = step(e2, s), l3 = step(s, e3), l2 = (1.0 - l1) * (1.0 - l3);
  float qq = l1 * q + l2 * q2 * fan + l3 * q3, aa = fk * (2.0 * l1 + 4.0 * l2 + 6.0 * l3), dome = sqrt(max(0.0, 1.0 - qq * qq));
  float gv = smoothstep(0.84 - aa, 0.84 + aa, abs(qq));
  gv = max(gv, (1.0 - smoothstep(0.012, 0.012 + 1.5 * fs, abs(s - e2))) * fan + (1.0 - smoothstep(0.012, 0.012 + 1.5 * fs, abs(s - e3))));
  float sh = (1.0 - smoothstep(0.035, 0.035 + 2.0 * aa, abs(q))) * l1 * smoothstep(0.04, 0.1, s - e2) * (1.0 - smoothstep(0.82, 0.92, s));
  gv = min(gv, 1.0) * fade; float h = (0.5 * dome + 0.4 * sh) * fade - gv;
  BUMP115(h, 0.005)
  GILD(1.0); diffuseColor.rgb *= (1.0 - 0.55 * gv) * mix(1.0, 0.8 + 0.2 * dome, fade);
  if (uHab < 0.5) { vec3 c = cells(p * 60.0); diffuseColor.rgb *= 1.0 - 0.15 * fade * (1.0 - smoothstep(0.0, 0.06, c.y - c.x)); }`;
// the wing: a thin lens round that outline (thickest at the root, a rounded edge), cupped a little toward +z; _op its own unit space
const wingGeo152 = () => {
  const fs = [], seg = (a, b, n) => { for (let i = 0; i < n; i++) fs.push(a + (b - a) * i / n); }, f0 = FE152 - 1.5;
  seg(f0, FE152, 18);
  for (let n = NF152 - 1; n >= 0; n--) for (let i = 0; i < 16; i++) fs.push(FA152 - (n + (1 - Math.cos(Math.PI * (16 - i) / 16)) / 2) * DA152); // each feather's end, close at its notches
  seg(FA152, FA152 + 1.8, 36); seg(FA152 + 1.8, f0 + 2 * Math.PI, 10);
  const J = 8, M = fs.length, pos = [], idx = [], at = (r, f, side) => { const R = R152(f) * r, h = 0.07 * (1 - 0.55 * Math.min(R, 1)) * Math.sqrt(Math.max(0, 1 - r * r));
    pos.push(R * Math.cos(f), R * Math.sin(f), 0.08 * R * R + side * h / 2); };
  // rows: the top's centre, its rings 1..J-1, the shared rim (J), the bottom's rings J-1..1, its centre
  at(0, 0, 1); for (let j = 1; j < J; j++) for (const f of fs) at(Math.sin(Math.PI / 2 * j / J), f, 1);
  for (const f of fs) at(1, f, 0); for (let j = J - 1; j >= 1; j--) for (const f of fs) at(Math.sin(Math.PI / 2 * j / J), f, -1);
  const last = pos.length / 3; at(0, 0, -1);
  const row = r => 1 + r * M, rows = 2 * J - 1; // ring rows 0..rows-1
  for (let i = 0; i < M; i++) { const i2 = (i + 1) % M; idx.push(0, row(0) + i, row(0) + i2, last, row(rows - 1) + i2, row(rows - 1) + i);
    for (let r = 0; r < rows - 1; r++) { const a = row(r) + i, b = row(r) + i2, c = row(r + 1) + i, d = row(r + 1) + i2; idx.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.setAttribute('_op', g.attributes.position.clone()); g.computeVertexNormals(); return g;
};
let made152 = null;
const make152 = () => {
  const prof = [new THREE.Vector2(0, 0)], N = 48;
  for (let i = 0; i <= N; i++) { const t = i / N; prof.push(new THREE.Vector2(i === N ? 0 : 0.13 * (1 - t) ** 0.85 * (1 - 0.15 * t), t)); }
  const horn = mergeVertices(new THREE.LatheGeometry(prof, 32).deleteAttribute('uv').deleteAttribute('normal')), hp = horn.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), k = 1 + 0.16 * Math.cos(2 * Math.atan2(z, x) - TW152 * y) * (1 - 0.5 * y); hp.setXYZ(i, x * k, y, z * k); }
  horn.setAttribute('_op', hp.clone()); horn.computeVertexNormals();
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,232,1)'); gr.addColorStop(0.25, 'rgba(255,228,165,.55)'); gr.addColorStop(1, 'rgba(255,212,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const X = { horn, wing: wingGeo152(), tex, glow: new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    hornMat: hab89(look(phys('#fbf6ee', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 }), 'horn152', HORN152, {}, { studio: 0.3 })),
    wingMat: hab89(look(phys('#ffc75a', { roughness: 0.2, metalness: 1 }), 'wing152', WING152, {}, { studio: 0.85 })) };
  rim(X.hornMat); rim(X.wingMat); return X;
};
export const dispose152 = () => { if (made152) for (const v of Object.values(made152)) v.dispose(); made152 = null; };
// where they go on this stage's body (model units): the horn on the brow just before the eyes, in the forelock; the wings at the withers
const at152 = new WeakMap(), each152 = (geo, fn) => { const a = geo.attributes.position, ix = geo.index?.array, n = ix ? ix.length : a.count;
  for (let j = 0; j < n; j++) { const i = ix ? ix[j] : j; fn(a.getX(i), a.getY(i), a.getZ(i)); } };
const anchors152 = (G, S) => at152.get(G.body) ?? at152.set(G.body, (() => {
  let lo = 9, hi = -9, hy = -9, wz = 0; each152(G.eye, (x, y, z) => { if (z > 0) { lo = Math.min(lo, x); hi = Math.max(hi, x); } });
  const hx = (lo + hi) / 2 + 0.03, b = S.attach.back.p, wx = b[0] + 0.05;
  for (const g of [G.body, G.accent]) if (g) each152(g, (x, y, z) => { if (Math.abs(x - hx) < 0.03 && Math.abs(z) < 0.05) hy = Math.max(hy, y); });
  each152(G.body, (x, y, z) => { if (Math.abs(x - wx) < 0.05 && y > b[1] - 0.12) wz = Math.max(wz, Math.abs(z)); });
  return { horn: [hx, hy - 0.06, 0], wing: [wx, b[1] - 0.04, 0.8 * wz] };
})()).get(G.body);
// the wing's turn: x its span, n the side its +z faces (inward: the leading edge up). Folded: back and up along the withers, leaning
// out a little; spread: up and out, the leading edge forward
const turn152 = (x, n) => { const X = new THREE.Vector3(...x).normalize(), Z = new THREE.Vector3(...n); Z.addScaledVector(X, -Z.dot(X)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, new THREE.Vector3().crossVectors(Z, X), Z)); };
const FOLD152 = turn152([-Math.cos(0.45), Math.sin(0.45), 0.3], [0, -0.15, -1]), OPEN152 = turn152([-0.3, 0.85, 0.45], [0.8, 0.05, -0.6]);
const parts152 = (body, G, S) => {
  const X = made152 ??= make152(), A = anchors152(G, S);
  const horn = new THREE.Group(), hm = wear(new THREE.Mesh(X.horn, X.hornMat)), glow = new THREE.Sprite(X.glow);
  horn.position.fromArray(A.horn); horn.rotation.z = -0.6; hm.scale.setScalar(0.6); hm.receiveShadow = true;
  glow.position.y = 0.97; glow.scale.setScalar(0.32); glow.renderOrder = 5; glow.raycast = () => {}; // rays without a camera (the postcard's) would throw on a Sprite
  glow.onBeforeRender = () => { X.glow.opacity = 0.85 * nightGlow.value; };
  hm.add(glow); horn.add(hm); body.add(horn);
  const ws = S.attach.back.p[1] / 1.506; // the wings by the back's height: the foal's a little smaller (0.88)
  const wings = [1, -1].map(k => { const o = new THREE.Group(), r = new THREE.Group(), w = wear(new THREE.Mesh(X.wing, X.wingMat));
    o.position.set(A.wing[0], A.wing[1], A.wing[2] * k); o.scale.z = k; w.scale.setScalar(ws); w.receiveShadow = true; r.add(w); o.add(r); body.add(o); return r; });
  const open = t => { for (const r of wings) r.quaternion.slerpQuaternions(FOLD152, OPEN152, t); };
  open(0);
  const root = body.parent, w = new THREE.Group(); w.scale.setScalar(1.2); root.remove(body); w.add(body); root.add(w); // 1.2x the horse
  return { pose: p => open(Math.min(1, (p.wings || 0) + (p.gait === 'walk' ? 0.07 + 0.07 * Math.sin(p.ph * Math.PI * 4) : 0))) };
};
LOOKS.unicorn152 = () => ({ ...looks('carousel128'), parts: parts152 });

// ---- 134 A 전설 2번째 다시 (?m89 시범; data.js LEGEND134): the whole body turns into another thing, its colours far from the
// animal's own and from its first legendary. Two levels like 128 (uHab 1, the habitat: the fine detail goes).
// 삼채 도자 말: an old three-colour glaze (green, amber, cream) run down from the back in streaks, darker where it pooled (the runs'
// grooves, the drip ends); below the drips the bare buff clay of the lower legs, matte; close up, the glaze's fine crackle
const SANCAI134 = SH89 + `float st = vn3(vec3(p.x * 26.0, p.y * 1.4, p.z * 26.0)), st2 = vn3(vec3(p.x * 11.0, p.y * 0.7 + 3.0, p.z * 11.0));
  float g = fbm3(vec3(p.x * 2.4, p.y * 0.55, p.z * 2.4) + 9.0) + 0.24 * (st - 0.5) + 0.1 * (st2 - 0.5);
  float wg = SH(0.4 - g, 0.0), wa = SH(g - 0.5, 0.0);
  vec3 col = vec3(0.95, 0.88, 0.7) * (1.0 - wg - wa) + vec3(0.1, 0.42, 0.17) * wg + vec3(0.74, 0.37, 0.05) * wa;
  float fr = 0.3 + 0.08 * (st2 - 0.5) - 0.13 * pow(st, 3.0), e = p.y - fr, gz = SH(e, 0.0), pool = gz * (1.0 - smoothstep(0.0, 0.045, e));
  col *= 1.0 - 0.2 * (1.0 - st) - 0.35 * pool;
  if (uHab < 0.5) { vec3 c = cells(p * 55.0); col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.04, c.y - c.x)) * gz; }
  diffuseColor.rgb = mix(vec3(0.84, 0.66, 0.48), col, gz); roughnessFactor = mix(0.8, 0.07, gz); lookStudio = 0.5 * gz; // glaze glints, bare clay feet stay dull`;
// its mane and tail: carved in parallel grooves across the crest, amber glaze pooled dark in them
const SANMANE134 = BUMP115 + `float fade = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 30.0);
  float h = 0.5 + 0.5 * cos(6.2832 * (dot(p.xy, vec2(0.64, 0.77)) * 30.0 + 1.5 * vn3(p * 7.0)));
  BUMP115(h, 0.012 * fade)
  diffuseColor.rgb = mix(vec3(0.72, 0.38, 0.07), vec3(0.32, 0.13, 0.02), (1.0 - h) * mix(0.4, 0.9, fade));`;
// 수국 양: the wool hydrangea heads packed together, blue on one side shading to violet and pink on the other (a little apart per
// head), dark leaves in the gaps; close up each head small four-petal florets, darker between them, a pale eye in each
const HYDRANGEA134 = SH89 + BUMP115 + `float fade = 1.0 - smoothstep(0.15, 0.5, fwidth(p.y) * 7.0);
  vec4 f = fe128(p * 7.0, on); float seam = smoothstep(0.08, 0.3, f.w), t = clamp(vn3(p * 2.2 + 1.0) * 1.6 - 0.3 + 0.8 * (f.z - 0.5), 0.0, 1.0);
  vec3 col = t < 0.5 ? mix(vec3(0.32, 0.5, 0.95), vec3(0.6, 0.44, 0.9), t * 2.0) : mix(vec3(0.6, 0.44, 0.9), vec3(0.97, 0.6, 0.8), t * 2.0 - 1.0);
  col *= mix(1.0, 0.78 + 0.22 * smoothstep(0.1, 0.8, f.w), fade); float h = f.w;
  if (uHab < 0.5) {
    vec4 g = fl127(p * 44.0, on); float rg = length(g.xy), fp = SH(petals128(g.xy, 0.5, 4.0, 0.03, g.z * 6.28), 0.0) * step(g.w, 0.3) * seam;
    col = mix(col * 0.62, col * (0.92 + 0.16 * g.z) + 0.12 * (1.0 - smoothstep(0.0, 0.3, rg)), fp);
    col = mix(col, vec3(0.98, 0.96, 0.8), (1.0 - SH(rg, 0.045)) * fp * 0.6); h += fp * 0.25;
  }
  col = mix(vec3(0.14, 0.34, 0.13), col, seam); BUMP115(h, 0.03 * fade)
  diffuseColor.rgb = col;`;
// 색동 토끼: 색동 bands (red, yellow, green, blue, pink) wound round the body and the ears, a gold line between each, glossy lacquer
const SAEKDONG134 = GILD89 + `float b = p.y * 14.0 + 0.3, i = mod(floor(b), 5.0), fb = fract(b), fw = max(fwidth(p.y), 1e-4);
  vec3 col = i < 0.5 ? vec3(0.72, 0.03, 0.08) : i < 1.5 ? vec3(0.98, 0.68, 0.03) : i < 2.5 ? vec3(0.03, 0.46, 0.22) : i < 3.5 ? vec3(0.06, 0.22, 0.7) : vec3(0.95, 0.36, 0.56);
  float e = min(fb, 1.0 - fb) / 14.0, gl = mix(1.0 - smoothstep(0.004 - fw, 0.004 + fw, e), 0.11, smoothstep(0.003, 0.012, fw));
  diffuseColor.rgb = col; roughnessFactor = 0.12; GILD(gl)`;
// 수박 돼지: watermelon rind, jagged dark green stripes on light green running nose to tail; the ears' insides and the snout (uAcc 1:
// its disc) cut flesh, red with black seeds, a white rind ring round the disc's face and green on its rim
const MELON134 = SH89 + `#define SEEDS(S) { vec4 sd = fl127(p * S, on); float a_ = sd.z * 6.28; vec2 v_ = mat2(cos(a_), sin(a_), -sin(a_), cos(a_)) * sd.xy; \\
    float s_ = (1.0 - SH(length(vec2(v_.x / (0.09 + 0.05 * smoothstep(-0.16, 0.16, v_.y)), v_.y / 0.17)), 1.0)) * step(sd.w, 0.3) * step(0.25, sd.z); \\
    flesh = mix(flesh, vec3(0.06, 0.04, 0.04), s_); }
  float a = atan(p.z, p.y - 0.36) / 6.2832, w = 0.05 * sin(p.x * 28.0 + a * 60.0) + 0.06 * (vn3(p * 30.0) - 0.5) + 0.14 * (fbm3(p * vec3(1.5, 4.0, 4.0)) - 0.5);
  float s = abs(fract(a * 11.0 + w) - 0.5) * 2.0, dark = SH(0.5 - s, 0.0);
  vec3 col = mix(vec3(0.58, 0.77, 0.34), vec3(0.07, 0.29, 0.11), dark) * (0.9 + 0.14 * vn3(p * vec3(14.0, 50.0, 50.0)));
  vec3 flesh = mix(vec3(0.96, 0.22, 0.27), vec3(0.98, 0.45, 0.45), smoothstep(0.3, 0.9, vn3(p * 12.0)) * 0.5); SEEDS(30.0)
  float face = uAcc * SH(on.x, 0.72), white = uAcc * SH(on.x, 0.52) * (1.0 - face);
  float ear = (1.0 - uAcc) * step(0.8, p.y) * SH(abs(p.z), 0.1) * SH(on.x, 0.15); // the ears' front faces (the crown between them stays rind)
  col = mix(col, vec3(0.95, 0.96, 0.84), white); col = mix(col, flesh, max(face, ear));
  diffuseColor.rgb = col; roughnessFactor = mix(0.22, 0.35, max(face, ear));`;
// 딸기우유 소: pale strawberry-milk pink, glossy, a milky sheen; where its patches go, strawberries (rounder at the top, a point
// below): red, lighter toward the calyx, yellow seeds set in small pits, a green calyx of five sepals on top. The ears and the
// tail tuft (uAcc 1) small strawberries
const BERRYCOW134 = SH89 + BUMP115 + `float wob = 0.05 * (vn3(p * 9.0 + 2.0) - 0.5), k = -9.0, cal = 0.0, top = 0.0;
  #define BERRY(C, R) { vec3 d_ = p - C; float h_ = R * 1.2, y_ = d_.y / h_, w_ = R * (0.55 + 0.45 * smoothstep(-1.0, 0.5, y_)); \\
    float b_ = 1.0 - length(vec2(d_.x / w_, y_)) + wob - 9.0 * step(0.22, abs(d_.z)); if (b_ > k) { k = b_; top = y_; \\
      vec2 v_ = vec2(d_.x, d_.y - h_ * 0.78) / R; float r_ = length(v_), an_ = atan(v_.x, -v_.y); \\
      cal = max(step(r_, 0.52 * pow(abs(cos(an_ * 2.5)), 2.0) + 0.1) * step(-0.25, -v_.y + 0.4), (1.0 - step(0.06, abs(v_.x))) * step(0.0, v_.y) * step(v_.y, 0.22)); } }
  BERRY(vec3(0.06, 0.58, 0.26), 0.17) BERRY(vec3(-0.4, 0.6, 0.22), 0.15) BERRY(vec3(-0.17, 0.58, -0.26), 0.2) BERRY(vec3(0.3, 0.62, -0.25), 0.12)
  float ear = uAcc * max(step(0.2, abs(p.z)) * step(0.75, p.y), step(p.y, 0.42) * step(p.x, -0.48));
  float m = max(SH(k, 0.0), ear); cal *= SH(k, 0.0) * (1.0 - ear);
  vec4 sd = fl127(p * 34.0, on); float sr = length(sd.xy), seed = (1.0 - SH(sr / 0.11, 1.0)) * step(sd.w, 0.3) * (1.0 - cal), pit = (1.0 - SH(sr / 0.2, 1.0)) * step(sd.w, 0.3) * (1.0 - cal);
  vec3 berry = mix(vec3(0.82, 0.06, 0.12), vec3(0.97, 0.36, 0.36), smoothstep(0.2, 0.9, top) * (1.0 - ear) * 0.6);
  berry = mix(berry * (1.0 - 0.3 * pit), vec3(1.0, 0.85, 0.3), seed);
  berry = mix(berry, mix(vec3(0.2, 0.55, 0.18), vec3(0.38, 0.72, 0.3), smoothstep(0.0, 0.6, on.y)), cal);
  BUMP115((seed - pit) * m * 0.4 + cal * 0.6 * m, 0.004)
  vec3 milk = mix(vec3(0.93, 0.52, 0.6), vec3(0.88, 0.38, 0.48), smoothstep(0.7, 0.15, p.y) * 0.7); // linear (sRGB ~ #f7c0cc to #f0a6b6)
  diffuseColor.rgb = mix(milk, berry, m); roughnessFactor = mix(0.22, 0.12, m);`;
Object.assign(LOOKS, {
  sancai134: () => ({ body: L127(phys('#f1e3c0', { roughness: 0.07 }), 'sancai134', SANCAI134, {}, { studio: 0 }),
    accent: L127(phys('#b86a14', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }), 'sanmane134', SANMANE134), hoof: phys('#dcbf98', { roughness: 0.85 }) }),
  hydrangea134: () => ({ body: L127(phys('#9a8ae8', { roughness: 0.55, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }), 'hydrangea134', HYDRANGEA134),
    accent: phys('#8cc66a', { roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.12 }), hoof: phys('#3e6a34', { roughness: 0.35, clearcoat: 0.5 }) }),
  saekdong134: () => { const b = L127(phys('#e04050', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }), 'saekdong134', SAEKDONG134, {}, { studio: 0 });
    return { body: b, accent: shine('#ffc75a', 0.18), hoof: b }; },
  watermelon134: () => { const w = acc => L127(phys('#5a9a40', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.08 }), 'watermelon134', MELON134, { uAcc: acc });
    return { body: w(0), accent: w(1), beak: phys('#14100e', { roughness: 0.2, clearcoat: 0.8 }), hoof: phys('#1e3a1a', { roughness: 0.3, clearcoat: 0.5 }) }; },
  berrycow134: () => { const c = acc => L127(phys('#ffd8e2', { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.7, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffffff') }), 'berrycow134', BERRYCOW134, { uAcc: acc });
    return { body: c(0), accent: c(1), beak: phys('#f79ab2', { roughness: 0.25, clearcoat: 0.8 }), nostril: phys('#8a3048', { roughness: 0.3 }), horn: phys('#f8ecd2', { roughness: 0.2, clearcoat: 1 }), hoof: phys('#c8304a', { roughness: 0.2, clearcoat: 0.8 }) }; },
});

// ---- 141 B 전설 2번째 「빛 재질」 (?m89 시범; data.js LEGEND141): the first legendaries' language (clear, lit from inside, gem,
// polished gold, sparkle), no painted pattern. Two levels like 128 (uHab 1, the habitat: the fine sparkle grows coarser).
// gold141 (the clear looks' gold parts, in their post: screen colour): polished gold in the studio's reflection (STUDIO, renamed)
const FN141 = STUDIO.replace('studioEnv', 'studio141') + `vec3 gold141(vec3 n, vec3 v) { vec3 g = vec3(1.0, 0.6, 0.14) * (0.15 + 0.85 * studio141(inverseTransformDirection(reflect(-v, n), viewMatrix)));
  return pow(g / (1.0 + 0.45 * g), vec3(0.4545)); }
vec3 facet141(vec3 n, out float id, out float e) { // the ruby's cut: n (object space) to the nearest of 24 directions (a Fibonacci sphere:
  float b = -2.0, b2 = -2.0; vec3 d = n; id = 0.0;   // even, not regular), so each facet is flat and its edges straight; e: how far from an edge
  for (int i = 0; i < 24; i++) { float y = 1.0 - (float(i) + 0.5) / 12.0, r = sqrt(1.0 - y * y), a = float(i) * 2.39996; vec3 c = vec3(r * cos(a), y, r * sin(a));
    float k = dot(n, c); if (k > b) { b2 = b; b = k; d = c; id = float(i); } else if (k > b2) b2 = k; }
  e = b - b2; return d; }
`;
// gold141t: the clear looks' gold parts drawn after the glass (the transparent pass, opacity 1), so they are not in its screen copy:
// a far hoof seen through a near leg read as a floating band (the far glass leg is not in the copy)
const gold141t = () => Object.assign(shine('#ffc75a'), { transparent: true });
const C141 = o => hab89(clear(o)), fn141 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', FN141 + 'void main() {'); }; return m; };
// 수정 유리 말: clear crystal, a pale sky blue where it is thick (the tint); inside, a few thin veins of rainbow light (seen a little
// deeper than the surface, so they slide as it turns), the prism's colours split along the outline, small glints flashing near the edge
const CRYSTAL141 = `float t_ = uTime * 0.05; vec3 q_ = p + rd * 0.09;
      float w1 = fbm3(q_ * 1.7 + vec3(0.0, t_, t_ * 0.6)), w2 = fbm3(q_ * 2.6 - vec3(t_, 1.0, 2.0));
      float wisp = (1.0 - smoothstep(0.0, 0.03 + 1.5 * fwidth(w1), abs(w1 - 0.48))) * smoothstep(0.42, 0.55, w2) * (1.0 - fr);
      vec3 rb = rainbow(w2 * 2.2 + p.y * 1.4 - t_);
      gl_FragColor.rgb += see * (rb * 1.4 - 1.0) * wisp * 0.5 + rb * wisp * 0.16 + vec3(0.55, 0.78, 1.0) * (0.02 + 0.05 * pow(nv, 2.0)) * (1.0 - fr);
      vec3 pc = rainbow(s * 4.0 + p.y * 2.0 + dot(vn, vec3(0.6, 0.4, 0.0)) - t_);
      gl_FragColor.rgb += ((pc - 0.5) * 0.55 + 0.04) * smoothstep(0.72, 0.9, s) * (1.0 - smoothstep(0.93, 0.99, s)) * (1.0 - rim);
      vec3 gc = cells(p * mix(28.0, 10.0, uHab)); float tw = pow(max(0.0, sin(uTime * (1.0 + 2.0 * gc.z) + gc.z * 60.0)), 8.0);
      gl_FragColor.rgb += vec3(1.0, 0.98, 0.94) * 1.5 * tw * step(0.62, gc.z) * (1.0 - smoothstep(0.07, 0.07 + 1.5 * fwidth(gc.x), gc.x)) * smoothstep(0.3, 0.8, s);`;
// 금 이음 양: black porcelain, mirror glazed (each wool lump a round highlight), mended with gold: lacquer-gold seams wandering over
// it (where a smooth noise crosses one level, a little jagged), finer branches off them close up, glowing softly and breathing.
// uAcc 1 (the face and the legs): the main seams only
const KINTSUGI141 = SH89 + GILD89 + `float j_ = 0.06 * (vn3(p * 14.0) - 0.5) + 0.025 * (vn3(p * 37.0) - 0.5);
  float f1 = fbm3(p * 1.6 + 3.0), f2 = fbm3(p * 2.7 - 1.3), n1 = f1 + j_, n2 = f2 + j_ * 1.3, c1 = abs(n1 - 0.5), c2 = abs(n2 - 0.5);
  float pw_ = max(length(fwidth(p)), 1e-5), w1 = max(min(0.011 * fwidth(f1) / pw_, 0.025), 1.2 * fwidth(n1)), w2 = max(min(0.007 * fwidth(f2) / pw_, 0.016), fwidth(n2));
  float k1 = 1.0 - smoothstep(0.5 * w1, w1, c1), k2 = (1.0 - smoothstep(0.5 * w2, w2, c2)) * (1.0 - smoothstep(0.03, 0.14, c1)) * (1.0 - uAcc) * (1.0 - uHab);
  float cr = max(k1, k2 * 0.85), halo = (1.0 - smoothstep(w1, w1 * 4.0, c1)) * (1.0 - cr);
  diffuseColor.rgb = mix(vec3(0.008, 0.008, 0.011), vec3(0.03, 0.03, 0.036), uAcc); roughnessFactor = 0.07; // the face a shade lighter: the black bead eyes show on it
  GILD(cr)
  totalEmissiveRadiance += vec3(1.0, 0.6, 0.16) * (cr * 0.5 + halo * 0.08) * (0.8 + 0.2 * sin(uTime * 1.4 - n1 * 14.0));`;
// 루비 토끼: a cut ruby: big flat facets following the body (its normal snapped to 24 directions, facet141), straight edges; each
// facet lit its own way from inside (bright clear red to dark wine, changing as it turns) and flashing whole when it meets the light.
// Lit red from inside. No white outline (rimK 0): a hairline glint on the true silhouette. Gold caps on the ear tips and the toes
// (by height, as the jade rabbit's), smooth
const RUBY141_GK = 'max(smoothstep(0.93, 0.95, P.y), 1.0 - smoothstep(0.035, 0.055, P.y))';
const RUBY141_NRM = `float gk_ = ${RUBY141_GK.replace(/P/g, 'vOp')}, id_, e_; vec3 d_ = facet141(normalize(normal * normalMatrix), id_, e_), v_ = normalize(vViewPosition), sn = normalize(normalMatrix * d_);
  sn = normalize(sn + v_ * max(0.0, 0.25 - dot(sn, v_))); // a facet turned away at the silhouette still faces us a little (no grey band of sky there)
  normal = normalize(mix(normal, sn, 1.0 - gk_));`;
const RUBY141 = `float gk141 = ${RUBY141_GK.replace(/P/g, 'p')};
      { vec3 v_ = normalize(vViewPosition), n0 = normalize(vNormal); float fid, fe; vec3 fd = facet141(normalize(n0 * normalMatrix), fid, fe);
        float lum = smoothstep(0.35, 0.97, 0.5 + 0.5 * sin(dot(fd, -rd) * 7.0 + h31(vec3(fid * 13.7 + 1.0)) * 6.2832));
        float fl = pow(max(dot(reflect(-v_, vn), normalize(vec3(-0.45, 0.75, 0.5))), 0.0), 10.0), ed = 1.0 - smoothstep(0.0, 1.5 * fwidth(fe), fe);
        float nv0 = abs(dot(n0, v_)), sil = 1.0 - smoothstep(0.0, 1.5 * fwidth(nv0), nv0);
        vec3 ruby = mix(vec3(0.04, 0.0, 0.01), vec3(0.6, 0.0, 0.07), lum) * (0.4 + 0.5 * nv) + vec3(1.0, 0.04, 0.14) * 0.28 * pow(nv0, 4.0); // + the light inside (smooth, across the facets)
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb - see * 0.85 + ruby * (1.0 - fr) + vec3(1.0, 0.82, 0.86) * (fl * 0.9 + ed * 0.18 + sil * 0.35), 1.0 - gk141);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gold141(vn, v_), gk141); }`;
// 유리 저금통 돼지: clear glass with a pink blush; inside it, gold coins with a square hole lying in a heap on the belly (some flat,
// some leaning, one on its edge: where the view ray meets each coin's disc, the nearest wins), each glinting now and then and
// stirring a little; a gold-rimmed coin slot on the back
const PIGGY141 = `gl_FragColor.rgb += vec3(1.0, 0.55, 0.7) * (0.04 + 0.1 * pow(nv, 2.0)) * (1.0 - fr);
      float th141 = 9.0, ch141 = 0.0, cr141 = 0.0, cf141 = 0.0, ci141 = 0.0; vec2 cu141 = vec2(0.0);
      #define COIN141(C, N, I) { vec3 n_ = normalize(N), c_ = C + vec3(0.0, 0.003 * sin(uTime * 2.3 + I * 1.7), 0.0); float dn_ = dot(rd, n_); \\
        if (abs(dn_) > 0.02) { float t_ = dot(c_ - p, n_) / dn_; vec3 h_ = p + rd * t_ - c_; float r_ = length(h_) / 0.068; \\
          vec3 a_ = normalize(cross(n_, abs(n_.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))), b_ = cross(n_, a_); vec2 u_ = vec2(dot(h_, a_), dot(h_, b_)) / 0.068; \\
          if (t_ > 0.0 && t_ < th141 && r_ < 1.0 && max(abs(u_.x), abs(u_.y)) > 0.26) { th141 = t_; ch141 = 1.0; cr141 = r_; cf141 = abs(dn_); ci141 = I; cu141 = u_; } } }
      COIN141(vec3(-0.18, 0.3, 0.05), vec3(0.1, 1.0, 0.2), 0.0) COIN141(vec3(-0.05, 0.29, -0.06), vec3(0.3, 1.0, -0.1), 1.0)
      COIN141(vec3(0.08, 0.31, 0.04), vec3(-0.2, 0.9, 0.5), 2.0) COIN141(vec3(-0.1, 0.36, 0.09), vec3(0.2, 0.6, 1.0), 3.0)
      COIN141(vec3(0.02, 0.38, -0.08), vec3(-0.3, 0.5, -1.0), 4.0) COIN141(vec3(-0.26, 0.37, -0.03), vec3(0.8, 0.6, 0.3), 5.0)
      COIN141(vec3(0.15, 0.37, -0.02), vec3(-0.6, 0.4, 0.7), 6.0) COIN141(vec3(-0.13, 0.43, 0.0), vec3(0.1, 0.3, 1.0), 7.0)
      { float sq = max(abs(cu141.x), abs(cu141.y)), lip = smoothstep(0.78, 0.9, cr141) + (1.0 - smoothstep(0.26, 0.36, sq)) * 0.8;
        vec3 coin = mix(mix(vec3(0.62, 0.36, 0.06), vec3(1.0, 0.8, 0.34), 0.3 + 0.7 * cf141), vec3(1.0, 0.92, 0.6), lip * 0.6);
        coin += vec3(1.0, 0.95, 0.8) * 1.2 * pow(max(0.0, sin(uTime * 0.9 + ci141 * 2.4)), 30.0) * (1.0 - cr141);
        gl_FragColor.rgb += (coin * mix(vec3(1.0), pass, 0.5) * (1.0 - fr) * (1.0 - 0.5 * dark) - see) * ch141; }
      { float sd = length(vec2(max(abs(p.x + 0.04) - 0.07, 0.0), p.z)) - 0.016, aa = fwidth(sd) + 1e-4, top = smoothstep(0.73, 0.75, p.y);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gold141(vn, normalize(vViewPosition)), (1.0 - smoothstep(0.009, 0.009 + aa, sd)) * top);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.06, 0.03, 0.035), (1.0 - smoothstep(-aa, 0.0, sd)) * top); }`;
// 청금석 소: polished lapis lazuli, deep ultramarine clouded darker and lighter, strewn with gold (pyrite) flecks that twinkle as
// the angle changes; where its patches go (밀키 오팔's places, COWOPAL) and on the ears and the tail tuft (uAcc 1) a tone lighter
const LAPIS141 = SH89 + GILD89 + `float n = fbm3(p * 3.2 + 1.0), m = fbm3(p * 7.0 - 2.0);
  vec3 col = mix(vec3(0.008, 0.022, 0.16), vec3(0.025, 0.07, 0.4), smoothstep(0.3, 0.75, n)); col = mix(col, vec3(0.05, 0.12, 0.5), smoothstep(0.6, 0.85, m) * 0.5);
  vec3 q = vec3(p.x, p.y, abs(p.z)); float wob = 0.4 * (vn3(p * 4.5 + 2.0) - 0.5) + 0.08 * (vn3(p * 11.0) - 0.5);
  #define BLOB(v, c, r) (1.0 - length((v - c) / r))
  float bl = max(max(BLOB(p, vec3(0.06, 0.6, 0.25), vec3(0.17, 0.18, 0.15)), BLOB(p, vec3(-0.41, 0.63, 0.2), vec3(0.15, 0.15, 0.15))),
                 max(BLOB(p, vec3(-0.17, 0.6, -0.25), vec3(0.21, 0.17, 0.15)), BLOB(q, vec3(0.25, 0.87, 0.15), vec3(0.11, 0.12, 0.12)))) + wob;
  float ear = uAcc * max(step(0.2, abs(p.z)) * step(0.75, p.y), step(p.y, 0.42) * step(p.x, -0.48));
  col = mix(col, col + vec3(0.035, 0.085, 0.22), max(SH(bl, 0.0), ear));
  vec3 c = cells(p * mix(44.0, 20.0, uHab)), c2 = cells(p * 15.0 + 4.0);
  float g = max((1.0 - smoothstep(0.09, 0.09 + 1.5 * fwidth(c.x), c.x)) * step(0.45, c.z), (1.0 - smoothstep(0.08, 0.08 + 1.5 * fwidth(c2.x), c2.x)) * step(0.62, c2.z));
  float tw = pow(max(0.0, sin(dot(normal, vec3(9.0, 7.0, 5.0)) + c.z * 50.0 + uTime * (0.6 + c.z))), 6.0);
  diffuseColor.rgb = col; roughnessFactor = 0.1;
  totalEmissiveRadiance += col * 0.35 + vec3(0.2, 0.35, 1.0) * 0.12 * pow(1.0 - nv, 2.0);
  GILD(g)
  totalEmissiveRadiance += vec3(1.0, 0.6, 0.16) * g * (0.3 + 0.9 * tw);`;
Object.assign(NIGHT_LOOK, { kintsugi141: 1.5, lapis141: 1.0 });
Object.assign(NIGHT_CLEAR, { crystal141: CRYSTAL_NIGHT + 'gl_FragColor.rgb += uNight * rb * wisp * 0.3 * (1.0 - fr);', ruby141: 'gl_FragColor.rgb += uNight * vec3(1.0, 0.1, 0.2) * (0.15 + 0.3 * pow(nv, 2.0)) * (1.0 - fr) * (1.0 - gk141);',
  piggy141: 'gl_FragColor.rgb += uNight * (vec3(1.0, 0.55, 0.7) * (0.22 + 0.4 * pow(nv, 2.0)) * (1.0 - fr) + vec3(1.0, 0.8, 0.35) * ch141 * 0.35);' });
Object.assign(LOOKS, {
  crystal141: () => { const g = gold141t();
    return { body: C141({ key: 'crystal141', tint: '#b8dcff', absorb: 1.2, inner: '#4a7cb0', dark: 0.5, rough: 0.04, coat: 1, neutral: 0.75, bend: 0.2, rimK: 0.3, post: CRYSTAL141 }), accent: g, hoof: g }; },
  kintsugi141: () => { const k = acc => L127(phys('#0c0c10', { roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.02 }), 'kintsugi141', KINTSUGI141, { uAcc: acc }, { studio: 0.6 });
    return { body: k(0), accent: k(1), hoof: shine('#ffc75a') }; },
  ruby141: () => same(fn141(C141({ key: 'ruby141', tint: '#ff2040', absorb: 3.0, inner: '#600010', dark: 0.45, color: '#2a0008', rough: 0.05, neutral: 0.85, rimK: 0, nrm: RUBY141_NRM, post: RUBY141 }))),
  piggy141: () => { const g = fn141(C141({ key: 'piggy141', tint: '#ffd0dc', absorb: 1.3, inner: '#ffb0c8', dark: 0.4, rough: 0.05, coat: 1, neutral: 0.6, post: PIGGY141 }));
    return { body: g, accent: g, beak: phys('#d0607e', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), hoof: gold141t() }; },
  lapis141: () => { const c = acc => L127(phys('#1a3a9a', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), 'lapis141', LAPIS141, { uAcc: acc }, { studio: 0.35 }), g = shine('#ffc75a');
    return { body: c(0), accent: c(1), beak: c(0), nostril: phys('#060a1c', { roughness: 0.1, clearcoat: 1 }), horn: g, hoof: g }; },
});

// ---- 145 A 수정 유리 말 3차 (?m89 시범; data.js LEGEND141.horse). 144 B read as milky ice with a mane of broken shards, grey-blue
// by night. One clear crystal: the body and the legs cut like the ruby (the normal snapped to facet141's 24 directions: the scene
// behind breaks into shifted pieces, a facet flashes white when it meets the light, hairline white edges), the scene seen through
// keeping its colour (a faint sky tint only where it is thick), tiny spectral sparks deep in the facets; the mane and the tail
// smooth glass ribbons (the lumps' ups and downs smoothed out along the strand: one long soft sheen running down it, no dark band,
// no white outline, the ends clearer still); the hooves clear with a gold rim (the only gold). By night a soft moonlight rising
// inside and small stars twinkling there. One program for the three parts (key crystal145): uPart 0 body, 1 mane and tail, 2 hooves.
// AX145: the strand's run (the tail hangs back and down, p.x < -0.15; the mane runs up the neck)
const AX145 = P => `(${P}.x < -0.15 ? vec3(0.5, 0.866, 0.0) : vec3(0.66, 0.751, 0.0))`;
const O145 = { key: 'crystal145', tint: '#d4eaff', absorb: 1.3, inner: '#a8d0f4', dark: 0.3, rough: 0.03, neutral: 0.3, bend: 0.14, rimK: 0.35 };
const CRYSTAL145_NRM = `vec3 n_ = normalize(normal * normalMatrix), v_ = normalize(vViewPosition);
  if (uPart < 0.5) { float id_, e_; vec3 sn = normalize(normalMatrix * facet141(n_, id_, e_)); normal = normalize(sn + v_ * max(0.0, 0.25 - dot(sn, v_))); }
  else if (uPart < 1.5) { vec3 a_ = ${AX145('vOp')}; normal = normalize(normalMatrix * normalize(n_ - a_ * dot(n_, a_) * 0.9)); }`;
// the strand ends (the tail's lower end, the mane's free upper back edge) clearer: no tint
const CRYSTAL145_PRE = `float tp145 = abs(uPart - 1.0) < 0.5 ? (p.x < -0.15 ? 1.0 - smoothstep(0.15, 0.3, p.y) : smoothstep(0.55, 0.95, dot(normalize(normalize(vNormal) * normalMatrix), vec3(-0.751, 0.66, 0.0)))) : 0.0;
      tint = mix(tint, vec3(1.0), tp145);`;
const CRYSTAL145 = `vec3 v145 = normalize(vViewPosition), n145 = normalize(vNormal), spk145 = vec3(0.0); float tw145 = 0.0;
      float nv145 = abs(dot(n145, v145)), sil145 = 1.0 - smoothstep(0.0, 1.5 * fwidth(nv145) + 1e-4, nv145);
      float fl145 = pow(max(dot(reflect(-v145, vn), normalize(vec3(-0.45, 0.75, 0.5))), 0.0), 12.0); // the key light's glint (view space, as the ruby)
      if (uPart < 0.5) { // facets: each shows the scene behind shifted its own way (a cut stone breaks it into pieces), a shade lighter
        // or deeper; a facet flashes white as it meets a light; tiny spectral sparks at two depths; small stars (twinkling by night)
        float fid, fe; vec3 fd = facet141(normalize(n145 * normalMatrix), fid, fe);
        float lum = 0.5 + 0.5 * sin(dot(fd, -rd) * 7.0 + h31(vec3(fid * 13.7 + 3.0)) * 6.2832), few = fwidth(fe);
        vec4 b2 = texture2D(uScreen, clamp(suv + (vec2(h31(vec3(fid * 7.1 + 1.0)), h31(vec3(fid * 3.3 + 9.0))) - 0.5) * vRefr * 0.3, 0.0, 1.0));
        b2.rgb += (1.0 - b2.a) * ${SKY}; b2.rgb = mix(b2.rgb, vec3(dot(b2.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.97, 1.0, 1.05), ${O145.neutral.toFixed(2)});
        vec3 see2 = (b2.rgb * pass + inner * (1.0 - pass)) * (1.0 - ${O145.dark} * dark) * (1.0 - fr);
        float ed = (1.0 - smoothstep(0.0, 1.5 * few + 1e-4, fe)) * (1.0 - smoothstep(0.08, 0.2, few));
        float fl2 = pow(max(dot(reflect(-v145, vn), normalize(vec3(0.7, 0.35, 0.6))), 0.0), 16.0);
        vec3 rs = reflect(-v145, n145); // the light's shape across a lit facet (the smooth normal): a window of white, not the whole face
        fl145 *= 0.15 + 0.85 * smoothstep(0.72, 0.96, dot(rs, normalize(vec3(-0.45, 0.75, 0.5)))); fl2 *= 0.15 + 0.85 * smoothstep(0.72, 0.96, dot(rs, normalize(vec3(0.7, 0.35, 0.6))));
        float sc = mix(30.0, 15.0, uHab); vec3 c1 = cells((p + rd * 0.05) * sc), c2 = cells((p + rd * 0.12) * sc * 0.8 + 5.3);
        float r1 = max(0.2, 1.5 * fwidth(c1.x)), r2 = max(0.2, 1.5 * fwidth(c2.x)); // a point: never under a pixel or two (no shimmer far off)
        float k1 = step(0.25, c1.z) * (1.0 - smoothstep(0.3 * r1, r1, c1.x)) * pow(max(0.0, sin(dot(rd, vec3(7.0, 5.0, 9.0)) * 1.5 + c1.z * 40.0 + uTime * 0.6)), 2.0);
        float k2 = step(0.3, c2.z) * (1.0 - smoothstep(0.3 * r2, r2, c2.x)) * pow(max(0.0, sin(dot(rd, vec3(-6.0, 8.0, 5.0)) * 1.5 + c2.z * 50.0 + uTime * 0.5)), 2.0);
        float fd145 = (1.0 - smoothstep(0.6, 0.9, s)) * (1.0 - fr), ka = max(k1, k2 * 0.8) * fd145; // spectral: the colour itself, not added onto a light ground
        spk145 = (clamp((rainbow(c1.z * 5.0 + dot(rd, vec3(1.3, 0.7, 1.1))) - 0.2) * 1.5, 0.0, 1.0) * k1 + clamp((rainbow(c2.z * 7.0 - dot(rd, vec3(0.9, 1.2, 0.6))) - 0.2) * 1.5, 0.0, 1.0) * k2 * 0.8) * fd145;
        tw145 = step(0.3, c2.z) * (1.0 - smoothstep(0.0, 0.1, c2.x)) * pow(max(0.0, sin(uTime * (1.2 + c2.z) + c2.z * 60.0)), 8.0) * (1.0 - fr);
        gl_FragColor.rgb += see2 * mix(0.8, 1.15, lum) - see + vec3(1.0, 0.99, 0.97) * ((fl145 + fl2 * 0.55) * (1.0 - 0.4 * uNight) + ed * (0.12 + 0.05 * uNight) + sil145 * 0.15);
        gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - 0.85 * ka) + spk145 * 1.3 + ka * 0.15; }
      else if (uPart < 1.5) // ribbons: the dark band and the white outline taken back off, a soft sheen down the strand
        gl_FragColor.rgb += see * (1.0 / (1.0 - ${O145.dark} * dark) - 1.0) - vec3(1.0, 0.98, 0.94) * ${O145.rimK} * rim * 0.7
          + vec3(1.0, 0.99, 0.97) * (pow(max(dot(reflect(-v145, vn), normalize(vec3(-0.45, 0.75, 0.5))), 0.0), 5.0) * 0.3 + fl145 * 0.35) * (1.0 - 0.6 * tp145);
      else { // the hooves: a rim of polished gold round the top
        float w = max(0.005, 0.75 * fwidth(p.y)), gr = 1.0 - smoothstep(w, w + fwidth(p.y) + 1e-4, abs(p.y - 0.045));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gold141(vn, v145), gr); }`;
NIGHT_CLEAR.crystal145 = `if (uNight > 0.001) { float mr = fbm3(p * 3.0 - vec3(0.0, uTime * 0.15, 0.0)); // wisps of moonlight drifting up inside
        gl_FragColor.rgb += uNight * (vec3(0.72, 0.82, 1.0) * (0.08 + 0.22 * smoothstep(0.2, 0.9, vThick) + step(0.5, uPart) * step(uPart, 1.5) * 0.08 + 0.18 * pow(nv, 1.5) + 0.3 * smoothstep(0.45, 0.8, mr)) * (1.0 - fr) + spk145 * 0.8 + vec3(0.85, 0.93, 1.0) * tw145 * 1.4); }`;
LOOKS.crystal145 = () => { const c = part => fn141(C141({ ...O145, nrm: CRYSTAL145_NRM, pre: CRYSTAL145_PRE, post: CRYSTAL145, uniforms: { uPart: part } }));
  return { body: c(0), accent: c(1), hoof: c(2) }; };

// ---- 152 A 래브라도라이트 말, 153 A·155 A 다시 (?m89 시범; data.js LEGEND152): the horse's second legendary. Polished dark slate stone
// (opaque, clearcoat 0.4: one sharp reflection line). 155 A: no plates (153 A's knife-cut cell edges read as camouflage). The lamellae tilt
// (pn_ = surface normal + a smooth noise tilt) drifts across the body, so a flash is a soft bloom: a bright core fading through a wide halo to
// dark stone, neighbouring blooms' colours running into each other. Seen through a thin top layer (q_ = p a little behind the surface along
// the view, so the light moves inside the stone as the figure turns) with a dim blue layer deeper still (q2_), fine lamella streaks (st_,
// close up only) and a slow cloudiness (cl_). Colour: blue and peacock teal; past teal a thin green, then gold and orange, only in part, at
// some angles: in patches of a strong flash from the above-right light, and where the surface turns away (ob_); no gold on the chest (stops
// at teal, no bib). The emission is eased (1 - exp) so a core stays a saturated blue under ACES instead of washing out white, and the stone
// under a flash is dimmed. Below the belly the flash is almost off (leg_ 0.03: plain dark stone legs); uAcc 1 (mane, tail): shallower
// layer, darker stone, smaller blooms. Hooves polished silver. No purple or pink (not the galaxy horse)
const LAB152 = `vec3 vo_ = normalize(vdir * normalMatrix), q_ = p - vo_ * 0.045 * (1.0 - 0.4 * uAcc), q2_ = p - vo_ * 0.11;
  vec3 w_ = vec3(vn3(q_ * 1.6 + 4.0), vn3(q_ * 1.6 - 2.0), vn3(q_ * 1.6 + 9.0)) - 0.5, k_ = q_ * mix(2.2, 3.0, uAcc) + w_ * 1.2;
  vec3 pn_ = normalize(on + (vec3(vn3(k_ + 1.0), vn3(k_ + 17.0), vn3(k_ + 33.0)) - 0.5) * 2.2);
  vec3 h_ = normalize(normalize(vdir + normalize(vec3(-0.3, 0.35, 0.9))) * normalMatrix), g_ = normalize(normalize(vdir + normalize(vec3(0.5, 0.8, 0.3))) * normalMatrix);
  float a_ = dot(h_, pn_), b_ = dot(g_, pn_) * 0.97, d_ = 0.5 * (a_ + b_ + sqrt((a_ - b_) * (a_ - b_) + 0.004));
  vec3 pn2_ = normalize(on + (vec3(vn3(q2_ * 1.3 + 50.0), vn3(q2_ * 1.3 + 61.0), vn3(q2_ * 1.3 + 77.0)) - 0.5) * 2.2);
  float d2_ = max(dot(h_, pn2_), dot(g_, pn2_) * 0.97);
  float fz_ = (1.0 - smoothstep(0.3, 1.0, length(fwidth(p)) * 60.0)) * (1.0 - 0.6 * uHab);
  mat3 r_ = mat3(0.6, 0.8, 0.0, -0.48, 0.36, 0.8, 0.64, -0.48, 0.6);
  float cl_ = smoothstep(0.25, 0.7, fbm3(r_ * q_ * vec3(2.5, 2.5, 9.0) + 7.0)), st_ = mix(0.5, vn3(r_ * q_ * vec3(3.0, 3.0, 34.0) + 3.0), fz_);
  float core_ = smoothstep(0.8, 0.97, d_), halo_ = smoothstep(0.66, 0.9, d_), leg_ = mix(0.03, 1.0, smoothstep(0.2, 0.34, p.y));
  float fl = (halo_ * 0.3 + core_ * 0.8) * (0.55 + 0.45 * cl_) * (0.7 + 0.6 * st_) * leg_;
  float ob_ = smoothstep(0.2, 0.65, 1.0 - nv) * smoothstep(0.38, 0.6, vn3(q_ * 1.8 + 41.0));
  float t_ = clamp(0.04 + 0.4 * smoothstep(0.35, 0.75, fbm3(q_ * 1.4 + 20.0)) + 0.16 * (halo_ - core_) + 0.55 * smoothstep(0.0, 0.15, b_ - a_) * smoothstep(0.72, 0.92, b_) * smoothstep(0.35, 0.6, vn3(q_ * 1.2 + 63.0)) + 0.6 * ob_ + 0.08 * (st_ - 0.5), 0.0, 1.0);
  t_ = min(t_, mix(1.0, 0.45, smoothstep(0.15, 0.25, p.x) * smoothstep(0.3, 0.55, on.x) * smoothstep(0.26, 0.32, p.y) * (1.0 - smoothstep(0.56, 0.64, p.y))));
  vec3 col = mix(vec3(0.02, 0.1, 1.0), vec3(0.0, 0.33, 1.0), smoothstep(0.12, 0.3, t_)); col = mix(col, vec3(0.0, 0.62, 0.72), smoothstep(0.34, 0.5, t_));
  col = mix(col, vec3(0.3, 0.85, 0.25), smoothstep(0.55, 0.66, t_)); col = mix(col, vec3(1.0, 0.7, 0.08), smoothstep(0.68, 0.8, t_)); col = mix(col, vec3(1.0, 0.38, 0.04), smoothstep(0.88, 0.99, t_));
  vec3 base = mix(vec3(0.036, 0.04, 0.044), vec3(0.078, 0.084, 0.09), smoothstep(0.3, 0.72, fbm3(p * 3.5 + 2.0))) * mix(1.0, 0.75, uAcc);
  base *= 1.0 + 0.3 * (vn3(p * 60.0) - 0.5) * fz_;
  diffuseColor.rgb = base * (1.0 - 0.6 * min(fl, 1.0)) + col * fl * 0.04; roughnessFactor = 0.22;
  totalEmissiveRadiance += col * (1.0 - exp(-1.2 * fl)) * 0.75 + mix(col, vec3(0.55, 0.85, 1.0), 0.15) * core_ * core_ * 0.12 * leg_ + vec3(0.0, 0.1, 0.55) * smoothstep(0.75, 0.97, d2_) * 0.15 * leg_;`;
// by night the flashes a little brighter and a faint cool edge, so the dark stone keeps its outline
NIGHT_LOOK.labradorite152 = 'totalEmissiveRadiance = totalEmissiveRadiance * (1.0 + uNight * 0.3) + uNight * vec3(0.12, 0.3, 0.45) * 0.25 * pow(1.0 - nv, 2.0);';
LOOKS.labradorite152 = () => { const c = acc => L127(phys('#1a1f24', { roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.1 }), 'labradorite152', LAB152, { uAcc: acc }, { studio: 0.25 });
  return { body: c(0), accent: c(1), hoof: shine('#dfe3e8') }; };
// ---- 157 A 무지개 티타늄 말 (160 A 공개; data.js LEGEND157): the horse's third legendary. Anodised titanium (a coloured-metal keyring):
// a mirror metal whose tint (F0) runs smoothly round blue, purple, gold and teal. The phase t_ = how far a smoothed "whole body" normal
// (mo_: from the body centre, so the colour sweeps over the figure as it turns instead of ringing each leg) and the true normal face away
// from the eye, plus a drift tail to head (side on: teal, blue, purple, gold at the head). Smooth weights round the 4 keys, no noise: no
// plates, blotches or lines. A little emission in the same tint, so the reflection's dark bands keep their colour. uAcc 1 (mane, tail):
// one band deeper, navy to violet only. Hooves dark gunmetal. The chrome horse is the same metal untinted (silver)
// 159 B: the phase is warped (s_: quicker through purple, slower through teal) and the gold lobe weighted x4, so the four tints share the
// turntable evenly and the 3/4 front shows gold (purple 40% -> 27% of the figure, gold 12% -> 23%); the forelock (accent past p.x 0.27,
// adult and foal: in front of the ears, the top mane clump ends at 0.26) takes the body's tint, not navy
const TI157 = `vec3 mo_ = normalize(normalMatrix * (normalize((p - vec3(0.0, 0.55, 0.0)) * vec3(1.0, 1.5, 2.5)) + on * 0.5));
  float t_ = -0.08 + 0.3 * (1.0 - dot(mo_, vdir)) + 0.22 * (1.0 - nv) + 0.9 * p.x + 0.1 * p.y;
  float s_ = t_ + 0.6 * 0.159155 * sin(6.2832 * (t_ - 0.25));
  vec4 w_ = max(0.5 + 0.5 * cos(6.2832 * (s_ - vec4(0.0, 0.25, 0.5, 0.75))), 0.0); w_ *= w_; w_ *= w_; w_.z *= 4.0; w_ /= dot(w_, vec4(1.0));
  vec3 col = vec3(0.0, 0.45, 1.0) * w_.x + vec3(0.42, 0.08, 0.9) * w_.y + vec3(0.88, 0.4, 0.015) * w_.z + vec3(0.0, 0.62, 0.5) * w_.w;
  float a_ = uAcc * (1.0 - smoothstep(0.26, 0.28, p.x));
  col = mix(col, mix(vec3(0.02, 0.035, 0.32), vec3(0.17, 0.04, 0.42), 0.5 + 0.5 * cos(6.2832 * t_)), a_);
  diffuseColor.rgb = col; roughnessFactor = mix(0.22, 0.3, a_);
  totalEmissiveRadiance += col * 0.06;`;
NIGHT_LOOK.titanium157 = 'totalEmissiveRadiance += uNight * col * (0.04 + 0.3 * pow(1.0 - nv, 2.0));'; // by night a faint rim in its own tint keeps the outline
LOOKS.titanium157 = () => { const c = acc => look(phys('#ffffff', { roughness: 0.22, metalness: 1 }), 'titanium157', TI157, { uAcc: acc }, { studio: 0.6 });
  return { body: c(0), accent: c(1), hoof: shine('#6a6e76', 0.26) }; };
// the set is made once and kept (as every look's); dispose157 frees it (no caller yet: nothing tears the looks down)
export const dispose157 = () => { for (const [k, s] of cache) if (k.startsWith('titanium157{')) { for (const m of new Set(Object.values(s))) m.dispose(); cache.delete(k); } };

// ---- 151 연못 전설 2번째 (160 A 공개; data.js LEGEND151): one more legendary for each pond species, in the 141 language (light: lit
// from inside, gem, polished metal, sparkle; no painted pattern, no clear crystal body). Colour and material apart from each one's first
// (무지개 진주, 별자리, 달빛 물결, 눈꽃 수정, 로즈골드, 유자 온천). uHab 1 (the habitat): the fine detail drops out.
// 흑진주 오리 (156 A): a black pearl, not an oil film: a deep near-black middle; the peacock overtone (green, peacock blue, aubergine,
// silver) only towards the outline and the edges of each round mass; soft satin highlights (a soft-edged window up-left of the view, a weak
// one low right, no studio mirror, low clearcoat) with a thin overtone fringe; a very fine nacre shimmer that fades with distance. The beak polished silver
const BPEARL151 = `float fz_ = 1.0 - smoothstep(0.3, 1.0, length(fwidth(p)) * 60.0), gn_ = vn3(p * 90.0) - 0.5;
  float w_ = fbm3(p * 1.3 + 5.0), e_ = 1.0 - nv, ov_ = smoothstep(0.2, 0.68, e_) * (1.0 - 0.25 * smoothstep(0.85, 1.0, e_));
  float lu_ = max(dot(normal, normalize(vdir + vec3(-0.55, 0.8, 0.0))), 0.0), l2_ = max(dot(normal, normalize(vdir + vec3(0.6, -0.35, 0.0))), 0.0);
  float f_ = fract(0.35 * dot(normal.xy, vec2(-0.6, 0.8)) + 0.7 * w_ + 0.15 * p.y - uTime * 0.02) * 4.0;
  vec3 G_ = vec3(0.04, 0.5, 0.28), B_ = vec3(0.02, 0.32, 0.5), A_ = vec3(0.3, 0.06, 0.26), S_ = vec3(0.55, 0.58, 0.64);
  vec3 pk151 = f_ < 1.0 ? mix(G_, B_, f_) : f_ < 2.0 ? mix(B_, A_, f_ - 1.0) : f_ < 3.0 ? mix(A_, S_, f_ - 2.0) : mix(S_, G_, f_ - 3.0);
  float co_ = smoothstep(0.88, 0.995, lu_), ha_ = pow(lu_, 6.0), sat_ = co_ * co_ * 0.7 + ha_ * 0.05 + smoothstep(0.95, 0.997, l2_) * 0.15;
  diffuseColor.rgb = mix(vec3(0.01, 0.011, 0.013), pk151 * 0.05, ov_); roughnessFactor = 0.35;
  totalEmissiveRadiance += pk151 * (ov_ * 0.5 + ha_ * 0.1 + smoothstep(0.82, 0.9, lu_) * (1.0 - smoothstep(0.9, 0.96, lu_)) * 0.22) * (0.94 + 0.12 * gn_ * fz_) + vec3(0.74, 0.75, 0.78) * sat_;`;
// 에메랄드 등껍질 거북: each shell plate a cut emerald (step cut: a flat table, two rings of bevels round it, each facet flat, lit its own
// way from inside, deep to bright green, flashing white when it meets the light), set in gold: gold seams between the plates. The plates
// are the model's (a top one, a ring of six, and twelve round the edge, where the shell dome has none): q is the shell's ellipsoid,
// shared by the adult and the baby (one material for both). The rim gold, the head and the legs pale gold
const EMERALD151 = GILD89 + AA127 + `vec3 s_ = normalize((p - vec3(-0.19, 0.31, 0.0)) / vec3(0.55, 0.5, 0.46)), n1 = vec3(0.0, 1.0, 0.0), n2 = n1; float b1 = -2.0, b2 = -2.0, id_ = 0.0;
  #define PLATE151(D, I) { vec3 d_ = D; float k_ = dot(s_, d_); if (k_ > b1) { b2 = b1; n2 = n1; b1 = k_; n1 = d_; id_ = I; } else if (k_ > b2) { b2 = k_; n2 = d_; } }
  PLATE151(vec3(0.0, 1.0, 0.0), 0.0)
  for (int i = 0; i < 6; i++) { float a = (float(i) + 0.5) * 1.0472; PLATE151(vec3(cos(a) * 0.581, 0.814, sin(a) * 0.581), 1.0 + float(i)) }
  for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; PLATE151(vec3(cos(a) * 0.955, 0.296, sin(a) * 0.955), 7.0 + float(i)) }
  float e_ = b1 - b2, st_ = step(0.022, e_) + step(0.05, e_) * (1.0 - uHab); // 0 the outer bevel, 1 the inner, 2 the table
  vec3 tn = normalize(n1 / vec3(0.71, 0.63, 0.59)), fn = normalize(tn + normalize(n2 - n1) * (st_ < 0.5 ? 0.55 : st_ < 1.5 ? 0.25 : 0.0));
  normal = normalize(normalMatrix * fn); nv = clamp(dot(normal, vdir), 0.0, 1.0);
  float fid = id_ * 3.0 + st_, lum = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(dot(fn, normalize(vdir * normalMatrix)) * 8.0 + h31(vec3(fid * 13.7 + 1.0)) * 6.2832));
  float fl = pow(max(dot(reflect(-vdir, normal), normalize(vec3(-0.45, 0.75, 0.5))), 0.0), 12.0), jd = 0.75 + 0.5 * fbm3(p * 9.0 + id_ * 3.0) * (1.0 - uHab);
  float ed = max(1.0 - AA(abs(e_ - 0.022), 0.0015), (1.0 - AA(abs(e_ - 0.05), 0.0015)) * (1.0 - uHab)); // the facet edges, hairlines
  vec3 em = mix(vec3(0.0, 0.02, 0.006), vec3(0.0, 0.42, 0.12), lum) * jd * (0.45 + 0.55 * nv);
  diffuseColor.rgb = vec3(0.004, 0.035, 0.016); roughnessFactor = 0.04;
  totalEmissiveRadiance += em + vec3(0.8, 1.0, 0.88) * (fl * 0.9 + ed * 0.08);
  GILD(1.0 - AA(e_, 0.007))`;
// 금박 레진 수달: pale honey-amber resin, clear (fake glass), and inside it the point: crinkled flakes of gold leaf at three depths (each at its
// own tilt, a crumpled foil catching the light in patches) and a few small air bubbles (a thin bright ring, a highlight dot). uAcc 1 (the
// cream patches): paler resin, fewer flakes. The nose a dark amber bead
const RESIN151 = `vec3 v151 = normalize(vViewPosition), fc151 = vec3(0.0); float fa151 = 0.0;
      for (int i = 0; i < 3; i++) { float fi = float(i);
        vec3 q = (p + rd * (0.03 + 0.07 * fi)) * mix(5.0, 4.2, uHab) * (1.0 + 0.2 * fi) + fi * 7.3, c = cells(q);
        float r = (0.24 + 0.16 * c.z) * (0.5 + 1.0 * vn3(q * 2.8 + c.z * 17.0)), w = fwidth(c.x) + 1e-4; // torn, crinkled outlines
        float f = step(mix(0.6, 0.85, uAcc), c.z) * (1.0 - smoothstep(r - w, r + w, c.x)) * (1.0 - fa151);
        vec3 fo = normalize(normalize(vn * normalMatrix) + (h33(vec3(c.z * 97.0, c.z * 41.0 + 3.0, c.z * 13.0 + 7.0)) * 2.0 - 1.0) * 0.8 + (vec3(vn3(q * 6.0), vn3(q * 6.0 + 3.1), vn3(q * 6.0 + 6.7)) - 0.5) * 1.6);
        fc151 += max(gold141(normalize(normalMatrix * fo), v151), vec3(0.86, 0.68, 0.24)) * mix(vec3(1.0), pass, 0.1 * fi) * (1.0 - 0.1 * fi) * f; fa151 += f; }
      vec3 bc = cells((p + rd * 0.05) * mix(30.0, 18.0, uHab) + 11.0); float br = 0.12 + 0.2 * fract(bc.z * 13.0), bw = fwidth(bc.x) + 1e-4;
      float bub = step(0.8, bc.z) * (1.0 - smoothstep(br - bw, br + bw, bc.x)) * (1.0 - fa151), bring = bub * smoothstep(br * 0.5, br, bc.x); // a bubble: a thin bright ring, a clear middle
      gl_FragColor.rgb += ((fc151 - see * fa151) + vec3(1.0, 0.97, 0.9) * (bring * 0.45 + bub * 0.05)) * (1.0 - fr);
      gl_FragColor.rgb += vec3(1.0, 0.6, 0.2) * (0.06 + 0.14 * pow(nv, 2.0)) * (1.0 - fr) * (1.0 - fa151);`; // 155 B1: deeper honey by day
// 흑요석 백조 (155 B2): rainbow obsidian: a black mirror with violet, blue, green and gold bands rising round inside it (a little deeper than the
// surface, seen through a window that moves with the view), a few shallow shell-like chips (rippled scoops, a faint edge; the tilt eases off at the edge and the ripple where it would
// shimmer; the wing material skips the chips). Wing tips silver (uWing), the beak red
const OBSIDIAN151 = AA127 + `vec3 i_ = floor(p * 6.5), f_ = fract(p * 6.5), d_ = vec3(9.0); float id_ = 0.0, e2_ = 9.0;
  if (uWing < 0.5) for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 o = vec3(x, y, z), r = o + h33(i_ + o) * 0.85 + 0.075 - f_; float rr = dot(r, r); if (rr < dot(d_, d_)) { e2_ = dot(d_, d_); d_ = r; id_ = h31(i_ + o + 0.5); } else e2_ = min(e2_, rr); }
  float cf_ = step(0.7, id_) * (1.0 - uWing), ce_ = cf_ * AA(sqrt(e2_) - length(d_), 0.06); vec3 dt_ = d_ - on * dot(d_, on); float rg_ = cf_ * (1.0 - AA(sqrt(e2_) - length(d_), 0.05));
  normal = normalize(normal + normalMatrix * dt_ * ce_ * (1.2 + 0.6 * sin(length(d_) * 40.0) * (1.0 - smoothstep(0.5, 1.5, fwidth(length(d_)) * 40.0)))); nonPerturbedNormal = normal; nv = clamp(dot(normal, vdir), 0.0, 1.0);
  vec3 vo_ = normalize(vdir * normalMatrix), q_ = p - vo_ * 0.06 + dt_ * cf_ * 0.06;
  float r_ = length((q_ - vec3(-0.05, 0.42, 0.0)) / vec3(0.55, 0.4, 0.3)) + 0.18 * fbm3(q_ * 2.5 + 3.0);
  vec3 h_ = normalize(normalize(vdir + normalize(vec3(-0.3, 0.45, 0.85))) * normalMatrix);
  float sh_ = smoothstep(0.35, 0.9, dot(h_, normalize(on + (vec3(vn3(q_ * 2.0 + 1.0), vn3(q_ * 2.0 + 7.0), vn3(q_ * 2.0 + 13.0)) - 0.5) * 1.6)));
  float bd_ = smoothstep(0.3, 0.85, 0.5 + 0.5 * cos(r_ * 6.2832 * 3.0));
  float g_ = fract(r_ * 1.5 + dot(vo_, vec3(0.3, 0.15, 0.2))) * 4.0; vec3 V_ = vec3(0.5, 0.15, 1.0), U_ = vec3(0.05, 0.35, 1.0), E_ = vec3(0.1, 0.85, 0.4), Y_ = vec3(1.0, 0.7, 0.15);
  vec3 rb151 = g_ < 1.0 ? mix(V_, U_, g_) : g_ < 2.0 ? mix(U_, E_, g_ - 1.0) : g_ < 3.0 ? mix(E_, Y_, g_ - 2.0) : mix(Y_, V_, g_ - 3.0);
  diffuseColor.rgb = vec3(0.006, 0.006, 0.007); roughnessFactor = 0.05;
  totalEmissiveRadiance += vec3(0.05, 0.048, 0.052) * pow(1.0 - nv, 2.5) + rb151 * (1.0 - exp(-1.8 * bd_ * sh_)) * 0.55 + vec3(0.75, 0.77, 0.82) * rg_ * (0.05 + 0.15 * sh_);
  float tk_ = uWing * AA(-p.x, 0.05 + 0.03 * (p.y - 0.43));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.93, 0.95), tk_); roughnessFactor = mix(roughnessFactor, 0.13, tk_); metalnessFactor = mix(metalnessFactor, 1.0, tk_); lookStudio = mix(lookStudio, 0.85, tk_);
  totalEmissiveRadiance *= 1.0 - tk_;`;
// 네온 플라밍고: deep indigo-violet glass (opaque, glossy, a faint violet depth inside) and a pink neon tube: one runs along the midline (the
// flamingo's side outline: back, the neck's curve, head, breast), and the outline itself glows pink as a lit edge. Seen by day, bright by night
const NEON151 = `float z_ = abs(p.z), tw = 0.022, tb = fwidth(p.z) + 1e-4; // 155 B1: brighter tube, a pink glass-highlight core, a wider soft spill
  float tube151 = 1.0 - smoothstep(tw - tb, tw + tb, z_), core = 1.0 - smoothstep(0.0, tw * 0.45 + tb, z_), spill151 = 1.0 - smoothstep(tw, tw * 3.5, z_);
  float s_ = sqrt(1.0 - nv * nv), px = fwidth(s_), rw = clamp(2.5 * px, 0.05, 0.3), rim151 = smoothstep(1.0 - 2.0 * rw, 1.0 - 0.5 * rw, s_);
  diffuseColor.rgb = vec3(0.012, 0.006, 0.04); roughnessFactor = 0.06;
  totalEmissiveRadiance += vec3(0.02, 0.008, 0.08) * (0.3 + 0.7 * nv) * (1.0 - tube151)
    + vec3(1.0, 0.16, 0.55) * (tube151 * 2.4 + rim151 * 1.3 + spill151 * 0.45) + vec3(1.0, 0.72, 0.9) * core * 1.1;
  diffuseColor.rgb *= 1.0 - tube151;`;
// 문스톤 카피바라 (156 B): moonstone: warm milky stone, a little translucent (soft light from inside, its edges lit through, a cool pale rim),
// and the blue adularescence as one broad soft band of light (155 B2's fbm billows read as mould): it runs along the body (x) over the
// back and upper flanks, where the body's cross-section faces a light from the front-above (so it glides across as the body turns), its
// edges a wide gaussian, drifting slowly (+-0.25 rad, ~52 s); the legs keep out of it. A soft milky glow by night, the band brighter.
// uAcc 1 (the muzzle, the ears) a shade greyer. The hoof bands the same milky stone (silver read as plastic legs)
const MOON151 = `vec3 h_ = normalize(normalize(vdir + normalize(vec3(-0.2, 0.55, 0.8))) * normalMatrix);
  float a_ = 0.25 * sin(uTime * 0.12), ly_ = length(on.yz); vec2 c_ = normalize(h_.yz + vec2(0.05, 0.0));
  c_ = vec2(c_.x * cos(a_) - c_.y * sin(a_), c_.x * sin(a_) + c_.y * cos(a_));
  float ag_ = acos(clamp(dot(on.yz / max(ly_, 1e-3), c_), -1.0, 1.0)) / 0.66, ad151 = smoothstep(0.0, 0.9, exp(-ag_ * ag_)) * smoothstep(0.2, 0.75, ly_) * smoothstep(0.32, 0.5, p.y);
  vec3 milk = mix(vec3(0.96, 0.87, 0.76), vec3(1.0, 0.95, 0.88), smoothstep(-0.6, 0.8, on.y)) * mix(1.0, 0.94, uAcc);
  float th_ = 1.0 - nv, rm_ = smoothstep(0.35, 1.0, th_); vec3 mk151 = milk * (0.5 * (0.8 + 0.2 * nv) + 0.12 * th_ * th_) + vec3(0.9, 0.93, 1.0) * 0.16 * rm_ * rm_, bl151 = vec3(0.02, 0.12, 1.0) * 1.6;
  diffuseColor.rgb = milk * mix(0.27, 0.17, rm_) * (1.0 - 0.9 * ad151); roughnessFactor = mix(0.2, 0.4, ad151);
  totalEmissiveRadiance += mix(mk151, bl151, ad151);`;
Object.assign(NIGHT_LOOK, {
  blackpearl151: 'totalEmissiveRadiance = totalEmissiveRadiance * (1.0 + uNight * 0.4) + uNight * pk151 * 0.15 * pow(1.0 - nv, 2.0);',
  emerald151: 1.0,
  obsidian151: 'totalEmissiveRadiance += uNight * vec3(0.3, 0.32, 0.4) * 0.25 * pow(1.0 - nv, 3.0) * (1.0 - tk_);', // a faint cool edge: the black keeps its outline
  neon151: 'totalEmissiveRadiance += uNight * (vec3(1.0, 0.16, 0.55) * (tube151 * 1.8 + rim151 * 1.2 + spill151 * 0.5) + vec3(0.1, 0.04, 0.3) * 0.3);',
  moonstone151: 'totalEmissiveRadiance += uNight * (bl151 * ad151 * 1.0 + mk151 * (1.0 - ad151) * 0.35);', // a soft milky glow by night, the band of blue brighter
});
NIGHT_CLEAR.resin151 = 'gl_FragColor.rgb += uNight * (vec3(1.0, 0.68, 0.28) * (0.12 + 0.3 * pow(nv, 2.0)) * (1.0 - fr) * (1.0 - fa151) + fc151 * 0.35);';
Object.assign(LOOKS, {
  blackpearl151: () => { const s = shine('#dfe3e8');
    return { body: look(phys('#1c1d22', { roughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.3 }), 'blackpearl151', BPEARL151), accent: s, hoof: s }; },
  emerald151: () => { const g = shine('#f2dca0', 0.2);
    return { body: g, hoof: g, accent: hab89(look(phys('#0a5a2c', { roughness: 0.04, specularIntensity: 0.45 }), 'emerald151', EMERALD151, {}, { studio: 0.25 })), horn: shine('#ffc75a') }; },
  resin151: () => { const r = acc => fn141(C141({ key: 'resin151', tint: '#f7b858', absorb: 1.9, inner: '#9a5418', dark: 0.4, rough: 0.04, coat: 1, neutral: 0.8, rimK: 0.45, nrm: '/* 151: normalMatrix (the flakes) */', post: RESIN151, uniforms: { uAcc: acc } }));
    return { body: r(0), accent: r(1), hoof: r(0), beak: phys('#3a1c06', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }) }; },
  obsidian151: () => { const o = w => look(phys('#050506', { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }), 'obsidian151', OBSIDIAN151, { uWing: w }, { studio: 1 }), b = o(0);
    return { body: b, accent: b, hoof: b, nostril: b, wing: o(1), beak: phys('#d8402e', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }) }; },
  neon151: () => { const n = look(phys('#120a2a', { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }), 'neon151', NEON151, {}, { studio: 0.4 });
    return { body: n, accent: n, hoof: n, beak: n, nostril: phys('#07040f', { roughness: 0.06, clearcoat: 1 }) }; },
  moonstone151: () => { const m = acc => look(phys('#c8ccd4', { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenRoughness: 0.4, sheenColor: new THREE.Color('#fff2e4') }), 'moonstone151', MOON151, { uAcc: acc }, { studio: 0.3 });
    const b = m(0); return { body: b, accent: m(1), beak: phys('#3c4048', { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 }), hoof: b }; },
});
// ---- 152 C 신수 백록, 155 C 다시 (160 A 공개; data.js 152 C): the reindeer adult with its own legend file (tools/bake-baengnok152.mjs:
// slimmer body and legs, a big smooth antler, a silver cord and bell, 155 C a silver bridle with jade beads and a small light bead on
// each antler tip; head and ears the reindeer's, so its eyes and nose stay). 155 C (inbox: "흰 순록 색만 바꾼 것처럼 보임"):
// body white porcelain (clearcoat gloss) with two cloud lines of raised silver inlay on each flank (as the kintsugi seams: metal,
// not paint) and a very pale celadon toward the feet; the antler white jade turning blue-green jade upward, lit from inside by day,
// its tips glowing; bridle, cord, bell and hooves silver. 1.3x the reindeer (a wrapper, as 125-D). Frost flowers bloom on the ground
// under its feet and fade (world-placed: a walk leaves a short trail); by night a soft moonlight round the body
const P152 = () => pale116(phys('#f7f8f7', { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.14 }));
// the cloud lines, drawn in the side view (model units; both flanks): a turtle walking arcs [length, turn] from p, each point
// [x, y, half width]. A cloud: a curl of n quarter arcs (r0 x g^k, counter-clockwise) ending heading hf, then its tail.
// 159 C (「집 거리에서 거의 안 보임」): the wire 1.5x as wide (0.017 -> 0.0255)
const W155C = 0.0255, ramp155C = (t, a, b, e) => W155C * (t < a ? 0.55 + 0.45 * t / a : 1 - e * Math.max(0, t - b) / (1 - b));
const curl155C = (n, r0, g, dir) => Array.from({ length: n }, (_, k) => [r0 * g ** k * Math.PI / 2, dir * Math.PI / 2]);
const cloud155C = (p, n, r0, g, dir, hf, tail, w) => {
  const arcs = [...curl155C(n, r0, g, dir), ...tail], tot = arcs.reduce((s, [l]) => s + l, 0), out = [[...p, w(0)]]; let h = hf - dir * n * Math.PI / 2, L = 0;
  for (const [len, turn] of arcs) { const k = Math.max(1, Math.ceil(Math.max(Math.abs(turn) / 0.28, len / 0.035)));
    for (let i = 0; i < k; i++) { h += turn / k / 2; p = [p[0] + Math.cos(h) * len / k, p[1] + Math.sin(h) * len / k]; h += turn / k / 2; L += len / k; out.push([...p, w(L / tot)]); } }
  return out; };
const LINES155C = [
  // haunch: a curl, its tail forward along the lower flank, a small hook up at its end
  cloud155C([-0.47, 1.33], 5, 0.026, 1.5, 1, 0, [[0.2, 0.15], [0.25, -0.35], [0.2, 0.25], ...curl155C(3, 0.05, 0.7, 1)], t => ramp155C(t, 0.12, 0.9, 0)),
  // shoulder: a smaller curl, its tail back along the upper flank, thinning to its end
  cloud155C([0.32, 1.31], 4, 0.026, 1.55, 1, Math.PI, [[0.2, 0.12], [0.25, -0.22], [0.12, -0.1]], t => ramp155C(t, 0.15, 0.6, 0.75)),
];
// GLSL: the nearest line (ld: distance past its edge, lo: offset from its middle, lw: its half width there), each run of 8 segments
// only inside its own box (0.07 round it: past that nothing is drawn). q = the side view in model units (the reindeer adult's _op:
// x / 2.0676 about 0.2615); fq, side before them, so all of it is skipped off the flanks
const f155C = v => v.toFixed(4);
// 159 C: small jade dots at the lines' ends (the haunch line's tail end and the eye of its curl, the shoulder line's tail end), each a
// little wider than the wire there: [x, y, radius] in the side view
const DOTS159 = [[...LINES155C[0].at(-1).slice(0, 2), 0.04], [...LINES155C[0][0].slice(0, 2), 0.036], [...LINES155C[1].at(-1).slice(0, 2), 0.036]];
const Q155C = '#define SEG155C(ax, ay, aw, bx, by, bw) { vec2 a_ = vec2(ax, ay), ab_ = vec2(bx, by) - a_; float h_ = clamp(dot(q - a_, ab_) / dot(ab_, ab_), 0.0, 1.0); vec2 o_ = q - a_ - ab_ * h_; float w_ = mix(aw, bw, h_), d_ = length(o_) - w_; if (d_ < ld) { ld = d_; lo = o_; lw = w_; } }\n'
  + 'vec2 q = vec2(p.x * 2.0676 + 0.2615, p.y * 2.0676), lo = vec2(0.0), jo = vec2(0.0); float ld = 9.0, lw = 0.01, jd = 9.0, jr = 1.0;\n'
  + 'float fq = max(length(fwidth(q)), 1e-4), side = smoothstep(0.2, 0.45, abs(on.z)) * (1.0 - smoothstep(0.035, 0.07, fq));\n';
const SEG155C = 'if (side > 0.0) {\n' + LINES155C.flatMap(L => Array.from({ length: Math.ceil((L.length - 1) / 8) }, (_, j) => L.slice(j * 8, j * 8 + 9))).map(C => {
  const xs = C.map(v => v[0]), ys = C.map(v => v[1]), m = 0.07;
  return `if (q.x > ${f155C(Math.min(...xs) - m)} && q.x < ${f155C(Math.max(...xs) + m)} && q.y > ${f155C(Math.min(...ys) - m)} && q.y < ${f155C(Math.max(...ys) + m)}) {\n`
    + C.slice(1).map((b, i) => `SEG155C(${[...C[i], ...b].map(f155C).join(', ')})`).join('\n') + '\n}\n'; }).join('')
  + DOTS159.map(([x, y, r]) => `{ vec2 o_ = q - vec2(${f155C(x)}, ${f155C(y)}); float d_ = length(o_) - ${f155C(r)}; if (d_ < jd) { jd = d_; jo = o_; jr = ${f155C(r)}; } }`).join('\n') + '\n}\n';
// k: the silver (a pixel-wide edge; at least 0.6 px wide far off, gone past a size where it would only shimmer; flanks only, not where
// the side view runs along the surface); gr: a fine dark groove just outside it (white on white: the wire reads by its seat).
// Close up its normal leans out across it (a raised round wire catching the light on its sides). By night it shines moon-white.
// 159 C: the seat wider and darker, darkest under the wire (lowS: its shadow, so it reads raised), the lean 1.2 (0.9); the jade
// dots (jd, jo, jr: as ld, lo, lw) domed the same way, jade (pale at the middle, deep at the rim), faintly lit, more by night
// The calf (seg ''): no lines (its rounder body is not the side view they were drawn on), porcelain and celadon only
const body155C = seg => Q155C + seg + `float we = max(lw, 0.6 * fq), dW = ld - (we - lw);
  float k =(1.0 - smoothstep(-0.5 * fq, 0.5 * fq, dW)) * side, lowS = 0.45 + 0.55 * (1.0 - smoothstep(-0.6, 0.2, lo.y / max(length(lo), 1e-5)));
  float jk = (1.0 - smoothstep(-0.5 * fq, 0.5 * fq, jd)) * side;
  float gr = max((1.0 - smoothstep(0.0, 0.012 + fq, dW)) * (1.0 - k) * lowS, (1.0 - smoothstep(0.0, 0.01 + fq, jd)) * (1.0 - jk)) * side;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.88, 0.8), 0.85 * (1.0 - smoothstep(0.1, 0.95, q.y))) * (1.0 - 0.45 * gr); // 156 C: white at the belly, a pale celadon growing down the legs
  totalEmissiveRadiance += vec3(0.86, 0.93, 1.0) * (0.035 + 0.12 * pow(1.0 - nv, 2.0));
  float u = clamp(length(lo) / max(lw, 1e-4), 0.0, 1.0), tilt = k * (1.0 - smoothstep(0.4, 0.9, fq / lw)), ju = clamp(length(jo) / jr, 0.0, 1.0);
  vec3 o3 = vec3(lo / max(length(lo), 1e-5), 0.0); o3 -= on * dot(on, o3); normal = normalize(normal + normalMatrix * o3 * u * 1.2 * tilt * (1.0 - jk));
  vec3 j3 = vec3(jo / max(length(jo), 1e-5), 0.0); j3 -= on * dot(on, j3); normal = normalize(normal + normalMatrix * j3 * ju * 1.3 * jk * (1.0 - smoothstep(0.4, 0.9, fq / jr)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.95), k); metalnessFactor = k * (1.0 - jk); roughnessFactor = mix(roughnessFactor, 0.18, k); lookStudio = mix(lookStudio, 0.9, k * (1.0 - jk)); // a jade dot over a wire's end: jade, not silver
  vec3 jc = mix(vec3(0.42, 0.86, 0.64), vec3(0.04, 0.4, 0.28), 0.45 + 0.5 * ju);
  diffuseColor.rgb = mix(diffuseColor.rgb, jc, jk); roughnessFactor = mix(roughnessFactor, 0.08, jk);
  totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - k) + vec3(0.85, 0.93, 1.0) * k * uNight * 0.9;
  totalEmissiveRadiance = mix(totalEmissiveRadiance, jc * (0.12 + 0.6 * uNight), jk);`;
NIGHT_LOOK.baengnok152 = NIGHT_LOOK.baengnok152calf = 'totalEmissiveRadiance += uNight * vec3(0.86, 0.93, 1.0) * (0.24 + 0.32 * pow(1.0 - nv, 2.0)) * (1.0 - max(k, jk));'; // by night a soft moon-white from within
// the antler: white jade at its root turning blue-green jade toward the tips (drifts in it), lit from inside (most where we look in,
// the drifts again deeper inside sliding as it turns, a soft light round its outline); each tip glowing (_thickness = 2 x its tip
// number + how near that tip: vTip), much more by night
const HORN155C = `float hy = smoothstep(0.88, 1.3, p.y), n = fbm3(p * 9.0 + 4.0), m = fbm3(p * 16.0 - 2.0 + vec3(0.0, uTime * 0.02, 0.0));
  vec3 col = mix(vec3(0.84, 0.94, 0.9), vec3(0.05, 0.43, 0.46), clamp(hy + 0.3 * (n - 0.5), 0.0, 1.0)); // 156 C: a step deeper blue-green jade (read as jade from the house)
  col = mix(col, vec3(0.97, 1.0, 0.98), smoothstep(0.6, 0.85, m) * 0.2);
  diffuseColor.rgb = col * 0.5; roughnessFactor = 0.1;
  totalEmissiveRadiance += col * (0.2 + 0.35 * pow(nv, 1.5));
  vec3 vo = normalize(vdir * normalMatrix); float n2 = fbm3((p + vo * 0.05) * 14.0 + 7.0);
  totalEmissiveRadiance += col * smoothstep(0.45, 0.75, n2) * 0.4 * nv + mix(vec3(0.75, 1.0, 0.9), vec3(0.3, 0.85, 0.78), hy) * pow(1.0 - nv, 2.5) * 0.35;\n`;
const TIP155C = `float tp = smoothstep(0.35, 0.95, vTip); totalEmissiveRadiance += vec3(0.5, 0.95, 0.88) * pow(tp, 2.0) * (0.3 + 0.8 * uNight);`; // the calf's antler (its own SDF one): no tips marked, no tip light
NIGHT_LOOK.baengnok152horn = NIGHT_LOOK.baengnok152calfhorn = 0.6;
const tip152 = m => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    sh.vertexShader = 'attribute float _thickness;\nvarying float vTip;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = _thickness - 2.0 * floor(_thickness * 0.5);');
    sh.fragmentShader = 'varying float vTip;\n' + sh.fragmentShader; };
  m.customProgramCacheKey = () => k + '-tip152'; return m; };
// the light beads on the tips: pale jade-white lit from inside, each twinkling on its own; the bridle's beads: deep green jade, cloudy, lit inside
const BEAD155C = `float tw = 0.8 + 0.2 * sin(uTime * 2.3 + p.x * 31.0 + p.z * 17.0);
  diffuseColor.rgb = vec3(0.86, 1.0, 0.95) * 0.6; roughnessFactor = 0.12;
  totalEmissiveRadiance += vec3(0.75, 1.0, 0.92) * (0.5 + 0.4 * pow(nv, 2.0)) * tw * (1.0 + 1.8 * uNight);`;
const JADE155C = `float n = fbm3(p * 60.0 + 3.0); vec3 col = mix(vec3(0.04, 0.4, 0.28), vec3(0.42, 0.86, 0.64), smoothstep(0.3, 0.75, n));
  diffuseColor.rgb = col * 0.5; roughnessFactor = 0.06;
  totalEmissiveRadiance += col * (0.15 + 0.35 * pow(nv, 1.5)) + vec3(0.4, 1.0, 0.7) * pow(1.0 - nv, 2.5) * 0.35;`;
NIGHT_LOOK.jade155C = 1.0;
// frost flowers: N152 quads on the ground, each a six-armed crystal with side branches; uF[i] = its world place (xyz) and birth (w).
// 155 C: bigger, longer-lived, crisp: ice blue by day with a white line down each arm (white alone was lost on the snow), glowing by night.
// Every position is 0 (the corners are in aQ): Box3.setFromObject (thumbs, codex, cabinet, postcard framing) sees one point at the
// feet's middle, and a shadow pass (postcard3d sets castShadow on every mesh) draws nothing
// 157 B: a small silver cloud (상운) under the feet too while it walks, in turn with the flowers: slot i holds a cloud when cloud157(i)
// (each foot's own slots, every 4th, flower, cloud, flower, cloud: it never gets both at once); a cloud lives LIFE157 (159 C: 2.6 s, 1.7) and stands with its
// flat bottom toward the camera; standing still, only flowers (put skips the cloud slots)
const N152 = 16, LEGZ152 = 0.22, LIFE155C = 3.4, LIFE157 = 2.6, cloud157 = i => (i + (i >> 2)) % 2; // LEGZ152: the legend file's legs stand 0.22 from the middle (the reindeer's 0.25)
// lifetimes: the flowers' geometry and material and the two glow materials are shared for the page (as the looks); dispose155C frees
// them (no caller yet: nothing tears the looks down). The four leg clones hang on G (G.legs152, the ready cache) and live as long as G's own geometries
let frost152 = null, glow155C = null;
const frostOf152 = () => frost152 ??= (() => {
  const g = new THREE.BufferGeometry(), q = [], ix = [];
  for (let i = 0; i < N152; i++) { for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.push(x, y, i); ix.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(q.length), 3)); g.setAttribute('aQ', new THREE.Float32BufferAttribute(q, 3)); g.setIndex(ix);
  const m = new THREE.ShaderMaterial({ uniforms: { uF: { value: Array.from({ length: N152 }, () => new THREE.Vector4(0, 0, 0, -99)) }, uS: { value: 0.1 }, uTime: windTime, uNight: nightGlow },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    extensions: { derivatives: true }, // fwidth on a WebGL1 fallback (WebGL2 ignores it)
    vertexShader: `uniform vec4 uF[${N152}]; uniform float uS, uTime; attribute vec3 aQ; varying vec2 vQ; varying float vA, vK;
      void main() { float aI = aQ.z, kc = mod(aI + floor(aI * 0.25), 2.0); vec4 f = uF[int(aI + 0.5)]; float life = mix(${LIFE155C.toFixed(1)}, ${LIFE157.toFixed(1)}, kc), age = uTime - f.w, on = step(0.0, age) * step(age, life);
        vA = on * (1.0 - smoothstep(life - mix(1.2, 1.0, kc), life, age)); vQ = aQ.xy; vK = kc;
        float r = f.w * 7.3 + aI * 1.7, c = cos(r), s = sin(r);
        if (kc > 0.5) { vec2 dc = normalize(cameraPosition.xz - f.xz + vec2(1e-4)); c = dc.y; s = dc.x; } // the cloud's bottom (-y) toward the camera
        vec2 q = mat2(c, s, -s, c) * aQ.xy * uS * mix(1.0, 0.6, kc) * (0.35 + 0.65 * smoothstep(0.0, mix(0.45, 0.25, kc), age)) * on;
        gl_Position = projectionMatrix * viewMatrix * vec4(f.xyz + vec3(q.x, 0.0, -q.y), 1.0); }`, // -q.y: the quads face up (front side)
    fragmentShader: `uniform float uNight; varying vec2 vQ; varying float vA, vK;
      void main() { if (vK > 0.5) { // 157 B: three round puffs on a flat bottom, a curl in the big one; silver, a steel-blue line round it
          vec2 p = vQ, cc = vec2(0.02, 0.06), u = p - cc;
          float d = max(min(min(length(p - vec2(-0.44, -0.14)) - 0.32, length(p - vec2(0.04, 0.08)) - 0.46), length(p - vec2(0.48, -0.12)) - 0.3), -0.42 - p.y);
          float cu = u.y > 0.0 ? abs(length(u) - 0.22) : abs(length(u - vec2(0.11, 0.0)) - 0.11); // the outer half up, the inner half down: a curl
          float fw = fwidth(d) + 1e-4, fc = fwidth(cu) + 1e-4, fill = 1.0 - smoothstep(-fw, fw, d);
          float ln = max(1.0 - smoothstep(0.04 - fw, 0.04 + fw, abs(d + 0.05)), 1.0 - smoothstep(0.035 - fc, 0.035 + fc, cu));
          float a = fill * vA; if (a < 0.01) discard;
          vec3 c = mix(vec3(0.9, 0.93, 0.98), mix(vec3(0.32, 0.46, 0.74), vec3(0.55, 0.72, 1.0), uNight), ln); // 159 C: by night 2.2x (1.0x), the line paler blue
          gl_FragColor = vec4(c * a * (1.0 + 2.2 * uNight), a * (0.95 - 0.3 * uNight)); return; }
        float r = length(vQ), k = 1.0471976, an = mod(atan(vQ.y, vQ.x) + k * 0.5, k) - k * 0.5; vec2 p = vec2(cos(an), abs(sin(an))) * r;
        vec2 e = vec2(0.5, 0.866), d1 = p - vec2(0.45, 0.0), d2 = p - vec2(0.7, 0.0);
        float d = min(length(p - vec2(clamp(p.x, 0.0, 0.92), 0.0)), min(length(d1 - e * clamp(dot(d1, e), 0.0, 0.26)), length(d2 - e * clamp(dot(d2, e), 0.0, 0.15))));
        float fw = fwidth(d) + 1e-4, w = 0.06 * (1.0 - 0.4 * r), arm = 1.0 - smoothstep(w, w + 1.2 * fw, d), mid = 1.0 - smoothstep(0.3 * w, 0.3 * w + 1.2 * fw, d), core = 1.0 - smoothstep(0.0, 0.14, r);
        float a = max(arm, core * 0.85) * vA; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.32, 0.62, 1.0), vec3(0.97, 0.99, 1.0), max(mid, core));
        gl_FragColor = vec4(c * a * (1.0 + 1.2 * uNight), a * (0.92 - 0.5 * uNight)); }` });
  return { g, m }; })();
// a soft light round a mesh (as figure.js haloMat: the mesh again blown up w along its normals, back faces, added on): (day + night x
// uNight) of rgb; while that is 0 the shell folds to one point (nothing drawn)
const halo155C = (rgb, w, day, night, mask = '1.0') => new THREE.ShaderMaterial({ uniforms: { uNight: nightGlow }, side: THREE.BackSide, transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  vertexShader: `uniform float uNight; varying vec2 vF; void main() { float k = ${day.toFixed(2)} + ${night.toFixed(2)} * uNight; vec4 mv = modelViewMatrix * vec4(position + normal * ${w.toFixed(3)}, 1.0);
    vF = vec2(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), k * (${mask})); gl_Position = k > 0.001 ? projectionMatrix * mv : vec4(0.0, 0.0, 0.0, 1.0); }`,
  fragmentShader: `varying vec2 vF; void main() { gl_FragColor = vec4(vec3(${rgb.map(v => v.toFixed(2)).join(', ')}) * pow(vF.x, 3.5) * vF.y, 1.0); }` });
// (the moon's: not round the ears and the head's sides: thin flaps whose blown-up shell stands off the head as a pale box)
const glowOf155C = () => glow155C ??= { moon: halo155C([0.78, 0.88, 1.0], 0.12, 0, 1.0, '1.0 - smoothstep(0.14, 0.2, abs(position.z)) * smoothstep(1.76, 1.84, position.y)'), bead: halo155C([0.75, 1.0, 0.95], 0.05, 0.14, 1.4) };
// 157 B: the eyes (deep: black-navy, darker in the middle, a small four-pointed star of light high on the front, a little brighter by
// night) and by night a very small moonlight bead between the antlers (a camera-facing quad, every position 0: Box3 sees its
// middle, a shadow pass nothing; folded to a point by day), shared for the page as the flowers
let orn157 = null;
const ornOf157 = () => orn157 ??= (() => {
  const eye = phys('#06070d', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  eye.onBeforeCompile = sh => { sh.uniforms.uNight = nightGlow; sh.vertexShader = 'varying vec3 vOn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOn = normal;');
    sh.fragmentShader = 'uniform float uNight;\nvarying vec3 vOn;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 on = normalize(vOn), f = normalize(vec3(0.5, 0.3, 0.81 * sign(on.z))), g = normalize(vec3(0.6, 0.65, 0.8 * sign(on.z))), sd = normalize(cross(vec3(0.0, 1.0, 0.0), g)), up = cross(g, sd);
  diffuseColor.rgb = mix(vec3(0.035, 0.05, 0.11), vec3(0.006, 0.006, 0.01), smoothstep(0.35, 0.9, dot(on, f)));
  float st = sqrt(abs(dot(on, sd))) + sqrt(abs(dot(on, up))), fw = fwidth(st) + 1e-4, k = (1.0 - smoothstep(0.4 - fw, 0.4 + fw, st)) * step(0.0, dot(on, g));
  totalEmissiveRadiance += vec3(0.85, 0.92, 1.0) * k * (0.7 + 0.9 * uNight); }`); };
  eye.customProgramCacheKey = () => 'eye157';
  const moonG = new THREE.BufferGeometry();
  moonG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); moonG.setAttribute('aQ', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2)); moonG.setIndex([0, 1, 2, 0, 2, 3]);
  const moonM = new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uNight: nightGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uNight; attribute vec2 aQ; varying vec2 vQ; varying float vK;
      void main() { vK = smoothstep(0.0, 0.6, uNight); vQ = aQ; vec4 mv = modelViewMatrix * vec4(0.0, 0.02 * sin(uTime * 1.1), 0.0, 1.0);
        mv.xy += aQ * 0.2 * length(modelViewMatrix[0].xyz); /* 159 C: 0.2 (0.11) */ gl_Position = uNight > 0.01 ? projectionMatrix * mv : vec4(0.0, 0.0, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying float vK;
      void main() { float r = length(vQ), core = 1.0 - smoothstep(0.17, 0.23, r), glow = pow(max(0.0, 1.0 - r), 2.2) * 0.9;
        gl_FragColor = vec4(vec3(0.86, 0.93, 1.0) * (core * 1.6 + glow) * vK, 1.0); }` });
  return { eye, moonG, moonM }; })();
export const dispose155C = () => { for (const v of [frost152?.g, frost152?.m, glow155C?.moon, glow155C?.bead, orn157?.eye, orn157?.moonG, orn157?.moonM]) v?.dispose(); frost152 = glow155C = orn157 = null; };
// one figure's flowers: its own uF values put on the shared material before its draw. A new one every 0.45 s while it walks
// (0.15 of its body unit since the last), else every 1.4 s, at the next foot; the first draw (and a jump in time) seeds all four
// (157 B: walking, the clouds in their slots between; still, the cloud slots skipped). 159 C (「구름과 서리꽃 겹침」): each kind its own
// ring of slots; walking, the kind wanted swaps after each mark (flower, cloud, flower...); a mark never lands on a live one of the
// other kind (within FAR159 x uS: the flower's arm 0.95 + the cloud's half width 0.47): then nothing this beat (the next foot tries
// again, the same kind) - at any pace they take turns along the trail, at least that far apart, and never stack. The marks are big
// (a flower 2 x 0.95 uS across) and live long, so the trail is sparser than 157 B's: at the walk (1.3 u/s) about one mark every 1.6 s
const FAR159 = 1.43, RING159 = [0, 1].map(k => Array.from({ length: N152 }, (_, i) => i).filter(i => cloud157(i) === k));
const frostMesh152 = (w, legs, S) => {
  const { g, m } = frostOf152(), o = new THREE.Mesh(g, m), F = Array.from({ length: N152 }, () => new THREE.Vector4(0, 0, 0, -99)), v = new THREE.Vector3(), at = new THREE.Vector3();
  let t0 = null, last = 0, foot = 0, sc = 1, want = 0; const nx = [0, 0];
  const free = (k, t) => F.every((f, i) => cloud157(i) === k || !(t >= f.w && t - f.w <= (k ? LIFE155C : LIFE157)) || Math.hypot(f.x - v.x, f.z - v.z) > FAR159 * 0.65 * sc);
  const put = (t, walk) => { legs[foot++ % legs.length].localToWorld(v.set(0, -S.legs.hip, 0));
    const k = walk ? want : 0; if (!free(k, t)) return;
    F[RING159[k][nx[k]++ % RING159[k].length]].set(v.x, w.matrixWorld.elements[13] + 0.01 * sc, v.z, t); if (walk) want = 1 - k; };
  o.renderOrder = 5; o.frustumCulled = false; o.raycast = () => {};
  o.onBeforeRender = () => {
    const t = windTime.value; sc = w.matrixWorld.getMaxScaleOnAxis() * S.s;
    if (t !== t0) {
      const fresh = t0 === null || t < t0 || t - t0 > 5; t0 = t;
      const walk = w.getWorldPosition(v).distanceTo(at) > 0.15 * sc, due = fresh || t - last > (walk ? 0.45 : 1.4);
      if (fresh) for (let i = 0; i < 4; i++) put(t - 0.5 - 0.35 * i, false); else if (due) put(t, walk);
      if (due) { last = t; w.getWorldPosition(at); }
    }
    m.uniforms.uF.value.forEach((u, i) => u.copy(F[i])); m.uniforms.uS.value = 0.65 * sc; m.uniformsNeedUpdate = true; };
  return o; };
// the reindeer's body, ruff and antler out, the legend file's in (figure.js adds them: the look has their materials); its thinner
// leg on the four leg bones, set 0.22 out; the moonlight round the body and the glow round the tip beads; then 1.3x and the frost
// flowers (the calf: 156 C its own legend file too, baengnok152_baby: the calf's body without the collar, a small jade antler,
// cord and bell, in the look as bn152calf / bn152calfhorn; its legs the reindeer calf's in `calf`, no cloud lines, no tip light)
const parts152C = (body, G, S, mat, calf, horn, calfHorn) => {
  const L = G.legend, legs = body.children.filter(o => o.userData.front !== undefined);
  if (L.bn152body || L.bn152calf) for (const o of [...body.children]) if (o.geometry && (o.geometry === G.body || o.geometry === G.accent || o.geometry === G.horn)) body.remove(o);
  const O = ornOf157(); for (const o of body.children) if (o.geometry === G.eye) o.material = O.eye; // 157 B: the starlit eyes (adult and calf)
  if (!L.bn152body) body.traverse(o => { if (o.material === mat) o.material = calf; else if (o.material === horn) o.material = calfHorn; });
  else {
    const H = G.body.boundingBox.max.y, mine = G.legs152 ??= G.legs.map(({ x, z }) => [L.bn152leg, L.bn152hoof].map(geo => { const c = geo.clone(), op = c.attributes._op;
      for (let i = 0; i < op.count; i++) op.setXYZ(i, op.getX(i) + x / H, op.getY(i) + S.legs.hip / H, op.getZ(i) + Math.sign(z) * LEGZ152 / H);
      return c; }));
    legs.forEach((g, i) => { g.position.z = Math.sign(G.legs[i].z) * LEGZ152; g.children[0].geometry = mine[i][0]; if (g.children[1]) g.children[1].geometry = mine[i][1]; });
    const X = glowOf155C();
    for (const [geo, hm] of [[L.bn152body, X.moon], [L.bn152bead, X.bead]]) if (geo) { const h = new THREE.Mesh(geo, hm); h.renderOrder = 5; h.raycast = () => {}; body.add(h); }
    // 157 B: the night's moonlight bead between the antlers, 0.62 of the way up them, over their middle (the adult only: the calf's are small)
    if (L.bn152horn) { const hb = L.bn152horn.boundingBox ?? (L.bn152horn.computeBoundingBox(), L.bn152horn.boundingBox), mb = new THREE.Mesh(O.moonG, O.moonM);
      mb.position.set((hb.min.x + hb.max.x) / 2, hb.min.y + 0.62 * (hb.max.y - hb.min.y), 0); mb.renderOrder = 5; mb.frustumCulled = false; mb.raycast = () => {}; body.add(mb); }
  }
  const root = body.parent, w = new THREE.Group(); w.scale.setScalar(1.3); root.remove(body); w.add(body); root.add(w); // 1.3x the reindeer
  if (legs.length) w.add(frostMesh152(w, legs, S));
};
const BELL152 = BELL116.replace('vec3(1.0, 0.85, 0.5)', 'vec3(0.9, 0.95, 1.0)'); // the silver bell: a cool glint, not the gold bell's warm one
// 157 B: the 노리개 under the bell sways a little about its top (_thickness: how far below it), one slow swing, a smaller one sideways
const sway157 = m => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.uTime = windTime;
    sh.vertexShader = 'uniform float uTime;\nattribute float _thickness;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.xz += _thickness * vec2(0.12 * sin(uTime * 1.9), 0.07 * sin(uTime * 1.3 + 1.0));'); };
  m.customProgramCacheKey = () => k + '-sway157'; return m; };
NIGHT_LOOK.njade157 = 1.0;
LOOKS.baengnok152 = () => { const body = look(P152(), 'baengnok152', body155C(SEG155C), {}, { studio: 0.25 }), calf = look(P152(), 'baengnok152calf', body155C(''), {}, { studio: 0.25 }),
    jade = () => phys('#e8f4ee', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    horn = tip152(look(jade(), 'baengnok152horn', HORN155C + TIP155C, {}, { studio: 0.3 })), calfHorn = look(jade(), 'baengnok152calfhorn', HORN155C.replace('smoothstep(0.88, 1.3, p.y)', 'smoothstep(0.92, 1.16, p.y)'), {}, { studio: 0.3 }); // 156 C: its antler about 0.94..1.18 of its height, the jade ramp 0.92..1.16 (the adult's 0.96..1.43): white jade at the root to the deep jade at its tips, as the adult's
  const silver = shine('#e8ecf2', 0.2); // the bridle's, and 157 B the antler rings' (one draw)
  return { body, accent: body, horn, hoof: shine('#e2e6ec', 0.22), beak: toyMat('#5f5658'), bn152body: body, bn152horn: horn,
    bn152cord: shine('#e4e8ee'), bn152bell: hab89(look(phys('#dde2e8', { roughness: 0.2, metalness: 1 }), 'bell152', BELL152, {}, { studio: 0.7 })),
    bn152bridle: silver, bn157ring: silver,
    bn157jade: sway157(look(phys('#2a8a6a', { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }), 'njade157', JADE155C, {}, { studio: 0.3 })),
    bn157tassel: sway157(look(phys('#a3121c', { roughness: 0.55, sheen: 1, sheenColor: '#ff7a68', sheenRoughness: 0.45 }), 'tassel157', '')), bn152jade: look(phys('#2a8a6a', { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }), 'jade155C', JADE155C, {}, { studio: 0.3 }),
    bn152bead: look(phys('#f0fff8', { roughness: 0.12, clearcoat: 1 }), 'bead155C', BEAD155C), bn152calf: calf, bn152calfhorn: calfHorn, parts: (b, G, S) => parts152C(b, G, S, body, calf, horn, calfHorn) }; };

// ---- 183 B 설원 전설 2번째 ① 다시 (?m89 시범; data.js LEGEND163; 184: 183 B's 안 2 of each, 안 1 gone): 백금 북극곰,
// 청동 순록 with nothing added (163 D ~ 182's aurora, collar, pear gem, frost beads, gold ring, bell and garnet nose gone): only the
// material and the way it is cut or engraved, as the ruby rabbit (cut gem + gold rim) and the
// emerald turtle (gold frame + gem) read. Each one draw (+ the eyes; the bear's enamel nose its own).
// facet183(n, N): n (object space) to the nearest of N directions over the +z half (a Fibonacci hemisphere), mirrored to -z: each
// facet flat and its edges straight, both flanks cut alike (a ridge down the back and the face's middle); id the facet (the same on
// both flanks), e how far from its edge (the best match less the second, the mirror facet over the ridge counted)
const FN183 = `vec3 facet183(vec3 n, int N, out float id, out float e) {
  vec3 m = vec3(n.xy, abs(n.z)), d = m; float b = -2.0, b2 = -2.0; id = 0.0;
  for (int i = 0; i < 32; i++) { if (i >= N) break; float z = (float(i) + 0.5) / float(N), r = sqrt(1.0 - z * z), a = float(i) * 2.39996;
    vec3 c = vec3(r * cos(a), r * sin(a), z); float t = dot(m, c); if (t > b) { b2 = b; b = t; d = c; id = float(i); } else if (t > b2) b2 = t; }
  e = min(b - b2, 2.0 * m.z * d.z); d.z *= n.z < 0.0 ? -1.0 : 1.0; return d; }
`;
const fn183 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('void main() {', FN183 + 'void main() {'); }; return m; };
// 백금 북극곰 「털결 각인 백금」 (183 B 안 2): the bear's own soft round body, its fur engraved as shallow grooves: one short tapered
// stroke per cell of a grid 1/40 of the height, through a point of its own, laid on the surface along the fur (back and a little down, down the
// legs), turned a little each; only the points near the surface draw. In the grooves the silver darkened (oxidised: a warm grey, dull),
// the raised places between them a mirror. The face's front, the muzzle and the soles smooth polish (no lines round the eyes); the
// strokes fade out where they would be under a pixel (the habitat: a plain mirror a shade greyer). uHx, uHy, uHr: the head (pattern space).
// The grooves' slope worked out from the stroke itself (184; not BUMP115's screen differences, one per 2x2 pixels: seen very close, the
// grooves' lit rims went in steps): the deepest stroke's slope in the surface (q_ space), to view space over Hw_ (view units a unit of
// p, the same everywhere on a figure), the normal tilted by it as BUMP115 does for a groove 0.0015 deep
const PLAT183B = `vec3 F_ = mix(vec3(-1.0, -0.25, 0.0), vec3(-0.15, -1.0, 0.0), smoothstep(0.3, 0.2, p.y));
  F_ = normalize(F_ - on * dot(F_, on) + vec3(0.0, 0.0, 1e-4)); vec3 S_ = cross(on, F_), q_ = p * 40.0, i_ = floor(q_), gq_ = vec3(0.0); float h_ = 0.0, fw_ = length(fwidth(q_));
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 c_ = i_ + vec3(x, y, z), r_ = h33(c_), o_ = q_ - c_ - r_; float a_ = dot(o_, F_), L_ = 0.7 + 0.3 * r_.x, k_ = (r_.y - 0.5) * 0.5, s_ = dot(o_, S_) + a_ * k_, u_ = a_ / L_;
    float w_ = 0.15 * (1.0 - u_ * u_) + 0.6 * fw_, t_ = min(abs(s_) / w_, 1.0), dv_ = step(abs(u_), 1.0) * (1.0 - smoothstep(0.3, 0.5, abs(dot(o_, on)))), v_ = (1.0 - t_ * t_ * (3.0 - 2.0 * t_)) * dv_;
    if (v_ > h_) { h_ = v_; gq_ = -6.0 * t_ * (1.0 - t_) * dv_ * (sign(s_) * (S_ + F_ * k_) + t_ * 0.3 * u_ / L_ * F_) / w_; } }
  float hd_ = length(vec3(p.x - uHx, p.y - uHy, p.z)), sm_ = max(max(smoothstep(uHr, uHr * 0.7, hd_) * smoothstep(-0.2, 0.3, on.x), smoothstep(uHx + 0.06, uHx + 0.12, p.x)), smoothstep(0.035, 0.015, p.y));
  float fa_ = (1.0 - sm_) * (1.0 - smoothstep(0.15, 0.4, fw_)), g_ = h_ * fa_, Hw_ = (length(dFdx(vViewPosition)) + length(dFdy(vViewPosition))) / (length(dFdx(p)) + length(dFdy(p)) + 1e-9);
  vec3 gv_ = normalMatrix * gq_; gv_ = gv_ - normal * dot(gv_, normal); normal = normalize(normal + gv_ * (0.0015 * 40.0 * fa_ * length(gq_) / (max(length(normalMatrix * gq_), 1e-9) * Hw_)));
  nv = clamp(dot(normal, vdir), 0.0, 1.0);
  diffuseColor.rgb = mix(vec3(0.93, 0.91, 0.87), vec3(0.36, 0.33, 0.3), g_) * (1.0 - 0.06 * (1.0 - sm_) * (1.0 - fa_));
  metalnessFactor = 1.0; roughnessFactor = mix(0.05, 0.5, g_); lookStudio = mix(1.0, 0.6, g_);`;
// 청동 순록 「면 컷 청동 조각」 (183 B 안 2): the same slim body cut into big flat facets, each facet its own bronze, a little warmer (red
// gold) or cooler (olive brown), a shade lighter or darker and its own sheen, so the facets stand apart in depth; the edges only a faint
// line (bright lines all round read a giraffe's net), the antler tips a little brighter, the hollows darker (_thickness, < 0), the hooves
// darker. The cut: each pixel's normal turned to its facet's (the turn added to the skinned normal, so a walking leg keeps its facets; a
// facet turned away at the silhouette still faces us a little, as the ruby's: no dark band of floor there): the nearest of 12 directions
// a flank (facet183), then (184) cut again by parallel planes, each piece tilted its own way (uTilt): across the body (uSlab a unit of
// height, both flanks alike: the flat back's one big facet and the barrel's long strips in pieces nearer one size) and, below uLegY, across
// the legs (uSlabL: their long strips cut into short facets, a cut stone's column). By night (184) the facets' own tints drawn together,
// the arrises fainter, less of the studio's softbox in them (lookStudio 0.8 to 0.5) and the facets turned from it lifted a little in their
// own colour (NIGHT_LOOK, uLift): the softbox's white facets beside the dark ones read a giraffe's patches by night
const BRONZE183U = { uSlab: 3.5, uSlabL: 9.0, uLegY: 0.27, uTilt: 0.35, uLift: 0.15 };
const BRONZE183B = `float id183, e183, n_ = uNight; vec3 d183 = facet183(on, 12, id183, e183), pm_ = vec3(p.xy, abs(p.z));
  float sa_ = dot(pm_, vec3(0.95, 0.12, 0.28)) * uSlab + 0.31, sb_ = dot(pm_, vec3(0.12, 0.98, 0.15)) * uSlabL + 0.67, lg_ = step(p.y, uLegY);
  float cid_ = floor(sa_) + lg_ * (17.0 * floor(sb_) + 301.0);
  vec3 tl_ = h33(vec3(cid_, id183, 5.0)) - 0.5; tl_.z *= p.z < 0.0 ? -1.0 : 1.0; d183 = normalize(d183 + uTilt * (tl_ - d183 * dot(tl_, d183)));
  vec3 sn183 = normalize(normal + normalMatrix * (d183 - on));
  normal = normalize(sn183 + vdir * max(0.0, 0.25 - dot(sn183, vdir))); nv = clamp(dot(normal, vdir), 0.0, 1.0);
  float ed183 = 1.0 - smoothstep(0.0, 0.003 + 1.5 * fwidth(e183), e183);
  float t_ = mix(h31(vec3(id183, 4.0, 7.0)), 0.5, 0.6 * n_), k_ = mix(h31(vec3(id183, 2.0, 5.0)), 0.5, 0.6 * n_), tip_ = max(vT183, 0.0), oc_ = max(-vT183, 0.0);
  vec3 br_ = mix(vec3(0.54, 0.31, 0.14), vec3(0.4, 0.28, 0.15), t_) * (0.9 + 0.2 * k_) * mix(1.0, 0.55, smoothstep(0.065, 0.05, p.y)) * (1.0 - 0.4 * smoothstep(0.2, 0.6, oc_));
  diffuseColor.rgb = mix(br_, vec3(0.95, 0.7, 0.4), max(ed183 * 0.35 * (1.0 - 0.6 * n_), smoothstep(0.4, 0.9, tip_) * 0.6));
  metalnessFactor = 1.0; roughnessFactor = mix(0.14 + 0.2 * k_, 0.1, ed183); lookStudio = 0.8 - 0.3 * n_;`;
Object.assign(NIGHT_LOOK, {
  plat183b: 'totalEmissiveRadiance += uNight * vec3(0.72, 0.8, 0.95) * (0.03 + 0.1 * pow(1.0 - nv, 2.0)) * (1.0 - g_);',
  bronze183b: 'totalEmissiveRadiance += uNight * (br_ * uLift + vec3(1.0, 0.72, 0.4) * 0.05 * ed183);', // 184: the facets turned from the softbox lifted (the bronze's own colour)
});
// _thickness to the bronze's GLSL as vT183
const vt183 = m => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    sh.vertexShader = 'attribute float _thickness;\nvarying float vT183;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvT183 = _thickness;');
    sh.fragmentShader = 'varying float vT183;\n' + sh.fragmentShader; };
  m.customProgramCacheKey = () => k + '-vt183'; return m; };
// the bronze reindeer's parts: the reindeer's body, ruff and antler out, the legend file's in (figure.js adds them: the look has
// r183body / r183horn and the calf's r183calfbody / r183calfhorn), its leg and hoof on the four leg bones (pivot at the hip as the
// reindeer's: the bones stay). The leg copies made once per leg position (their _op differs), kept in L183, freed by dispose163. (Without the legend file, not under ?m89, the look is not given: nothing to swap)
const L183 = new Map();
const parts183 = (body, G, S) => { const L = G.legend, pre = L.r183body ? 'r183' : 'r183calf'; if (!L[pre + 'leg']) return;
  for (const o of [...body.children]) if (o.geometry && (o.geometry === G.body || o.geometry === G.accent || o.geometry === G.horn)) body.remove(o);
  const H = G.body.boundingBox.max.y, mine = L183.get(L[pre + 'leg']) ?? L183.set(L[pre + 'leg'], G.legs.map(({ x, z }) => [L[pre + 'leg'], L[pre + 'hoof']].map(geo => {
    const c = geo.clone(), op = c.attributes._op; for (let i = 0; i < op.count; i++) op.setXYZ(i, op.getX(i) + x / H, op.getY(i) + S.legs.hip / H, op.getZ(i) + z / H); return c; }))).get(L[pre + 'leg']);
  body.children.filter(o => o.userData.front !== undefined).forEach((g, i) => { g.children[0].geometry = mine[i][0]; if (g.children[1]) g.children[1].geometry = mine[i][1]; });
};
Object.assign(LOOKS, {
  plat183b: () => { const mk = h => look(phys('#ffffff', { roughness: 0.05, metalness: 1 }), 'plat183b', PLAT183B, h, { studio: 1 });
    const b = mk({ uHx: 0.453, uHy: 0.83, uHr: 0.17 }), cub = mk({ uHx: 0.32, uHy: 0.75, uHr: 0.21 }); // the head (pattern space): the adult's, the cub's
    return { body: b, accent: b, hoof: b, cub, beak: phys('#17171a', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
      parts: (r, G, S) => { if (S.legs.hip < 0.5) r.traverse(o => { if (o.material === b) o.material = cub; }); } }; }, // the cub (hip 0.39; the adult's 0.76)
  bronze183b: () => { const b = vt183(fn183(look(phys('#ffffff', { roughness: 0.3, metalness: 1 }), 'bronze183b', BRONZE183B, BRONZE183U, { studio: 0.85 })));
    return { body: b, accent: b, hoof: b, horn: b, beak: b, r183body: b, r183horn: b, r183calfbody: b, r183calfhorn: b, parts: parts183 }; }, // one material (184: the calf's own was 183 B 안 1's wear heights)
});
// ---- 163 D ② (?m89 시범): 흑요석 은테 펭귄, 블랙 오팔 물범 (both again in 165 D).
// 흑요석 은테 펭귄 (165 D, again; not black plastic): the back, head and flippers rainbow obsidian: a black mirror (studio 1) with violet
// and green sheens inside it, at two depths along the view ray (they drift against the surface as it turns: glass depth), strong at low
// angles, faint face on. The front moonstone, not white plastic: milky stone, bluish grey toward its edges, a little light from inside,
// and one streak of blue adularescence down the belly (where the belly's turn round the upright body faces a light from the front-above,
// slanting with the height: it glides across as the penguin turns). Silver only round the flippers (uWing 1: where the normal turns along
// the flipper's flat, |on.z| < 0.42); the eyes plain black beads (the 163 bezel gone), beak and feet polished silver. The moonstone
// carried 0.065 of the height round the flanks past the modelled edge, nothing at the throat (_t163 below). On the crown
// (on.y over 0.4..0.75) the black's reflections at 0.06 (spec165 below): seen from above it mirrored the studio's top box as a grey
// disc ringed by the dark band (a quarter still left rings); the lights' own small highlight stays
const OBS165 = AA127 + `float bk_ = 1.0 - uWing, por163 = bk_ * (1.0 - AA(vT163.x, vT163.y)), sv163 = uWing * (1.0 - AA(abs(on.z), 0.42)), th_ = 1.0 - nv;
  vec3 vo_ = normalize(vdir * normalMatrix), q1_ = p - vo_ * 0.04, q2_ = p - vo_ * 0.11;
  float s1_ = fbm3(q1_ * vec3(2.5, 8.0, 2.5) + 4.0), s2_ = fbm3(q2_ * vec3(2.0, 6.0, 2.0) + 9.0);
  vec3 V_ = vec3(0.5, 0.14, 0.95), E_ = vec3(0.06, 0.75, 0.4);
  vec3 rb165 = (mix(V_, E_, smoothstep(0.4, 0.6, s1_)) * smoothstep(0.55, 0.8, abs(s1_ - 0.5) * 2.0 + 0.4) + mix(E_, V_, smoothstep(0.4, 0.6, s2_)) * 0.3) * (0.015 + 0.5 * pow(th_, 2.2));
  vec3 h_ = normalize(normalize(vdir + normalize(vec3(-0.3, 0.5, 0.8))) * normalMatrix); float tl_ = (p.y - 0.45) * 0.9;
  vec2 hz_ = normalize(h_.xz + vec2(1e-4, 0.0)), oz_ = on.xz / max(length(on.xz), 1e-3), hr_ = vec2(hz_.x * cos(tl_) - hz_.y * sin(tl_), hz_.x * sin(tl_) + hz_.y * cos(tl_));
  float ag_ = acos(clamp(dot(oz_, hr_), -1.0, 1.0)), ad165 = (exp(-ag_ * ag_ / 0.08) + 0.25 * exp(-ag_ * ag_ / 0.4)) * smoothstep(0.3, 0.7, length(on.xz)) * por163;
  vec3 mk165 = mix(vec3(0.5, 0.52, 0.58), vec3(0.88, 0.87, 0.85), smoothstep(0.15, 0.85, nv)) * (0.8 + 0.4 * fbm3(q2_ * 4.0 + 2.0)), bl165 = vec3(0.1, 0.3, 1.0) * 1.3;
  diffuseColor.rgb = mix(vec3(0.006, 0.006, 0.008), mk165 * 0.1 * (1.0 - 0.8 * min(ad165, 1.0)), por163); roughnessFactor = mix(0.05, 0.14, por163); lookStudio = mix(1.0, 0.35, por163);
  spec165 = mix(1.0, 0.06, smoothstep(0.4, 0.75, on.y) * (1.0 - por163));
  totalEmissiveRadiance += mix(vec3(0.05, 0.048, 0.055) * pow(th_, 2.5) + rb165, mk165 * (0.26 + 0.1 * th_) * (1.0 - 0.85 * min(ad165, 1.0)) + bl165 * ad165, por163);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.94, 0.96), sv163); roughnessFactor = mix(roughnessFactor, 0.12, sv163); metalnessFactor = sv163;
  lookStudio = mix(lookStudio, 0.85, sv163); totalEmissiveRadiance *= 1.0 - sv163; spec165 = mix(spec165, 1.0, sv163);`;
// spec165: the reflections (the environment's and the clear coat's, after the studio's mix) scaled per pixel: 1 = as they are
const spec165 = m => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('float lookStudio', 'float spec165 = 1.0;\nfloat lookStudio').replace('#include <lights_fragment_end>', `{ radiance *= spec165;
#ifdef USE_CLEARCOAT
  clearcoatRadiance *= spec165;
#endif
}
#include <lights_fragment_end>`); };
  m.customProgramCacheKey = () => k + '-spec165'; return m; };
// 블랙 오팔 물범 (165 D, again): black opal, the blue-black stone the most of it (inbox 165 D: 60 % or more black; 163's "40 % fire"
// dropped). Small fragments (cells, warped so they are not a lattice) in clusters (fbm + the fragment's own id), each with its own
// facing (a random direction): it flashes only where the mirror direction (object space) lines up with it, so which fragments light
// and their hue change with the angle, never a fixed pattern. Hues soft (a third toward grey): blue, teal, green, violet, a rare
// orange; each flash brighter in a band across it (play of colour), the dark fragments a faint tint. The stone's reflections at 0.45
// (spec165): the env's grey haze would lift the black. The nose polished gold (the gold point beside the stone, as the ruby rabbit's
// ear tips and the emerald turtle's rims)
const BOPAL165 = `vec3 w_ = vec3(fbm3(p * 2.5 + 1.0), fbm3(p * 2.5 + 7.0), fbm3(p * 2.5 + 13.0)) - 0.5;
  vec3 c_ = cells(p * 15.0 + w_ * 2.5), vo_ = normalize(vdir * normalMatrix), fd_ = normalize(h33(vec3(c_.z * 91.0, 3.0, 7.0)) - 0.5);
  float m163 = smoothstep(0.47, 0.5, 0.6 * fbm3(p * 5.0 + w_ + 3.0) + 0.4 * c_.z), al_ = dot(reflect(-vo_, on), fd_);
  float g_ = fract(c_.z * 3.7 + al_ * 0.5) * 5.0;
  vec3 B_ = vec3(0.12, 0.35, 0.95), T_ = vec3(0.05, 0.62, 0.6), G_ = vec3(0.2, 0.7, 0.3), V_ = vec3(0.5, 0.25, 0.9), O_ = vec3(0.9, 0.45, 0.12);
  vec3 fire163 = g_ < 1.0 ? mix(B_, T_, g_) : g_ < 2.0 ? mix(T_, G_, g_ - 1.0) : g_ < 3.0 ? mix(G_, B_, g_ - 2.0) : g_ < 4.0 ? mix(B_, V_, g_ - 3.0) : mix(V_, g_ > 4.8 ? O_ : V_, smoothstep(4.8, 5.0, g_));
  fire163 = mix(fire163, vec3(dot(fire163, vec3(0.3, 0.55, 0.15))), 0.33);
  float fl163 = m163 * (0.05 + 0.95 * smoothstep(0.45, 0.85, al_)) * (0.45 + 0.55 * smoothstep(-0.6, 0.8, sin(dot(p, fd_) * 70.0 + al_ * 5.0))) * smoothstep(0.0, 0.05, c_.y - c_.x);
  diffuseColor.rgb = vec3(0.012, 0.016, 0.035) + fire163 * 0.04 * fl163; roughnessFactor = 0.06;
  totalEmissiveRadiance += fire163 * fl163 * 0.7 + vec3(0.02, 0.03, 0.08) * pow(1.0 - nv, 2.0); spec165 = 0.45;`;
Object.assign(NIGHT_LOOK, {
  obsidian163: 'totalEmissiveRadiance += uNight * ((rb165 * 0.5 + vec3(0.3, 0.32, 0.4) * 0.2 * pow(th_, 3.0)) * (1.0 - por163) * (1.0 - sv163) + (mk165 * 0.25 + bl165 * ad165 * 0.8) * por163);', // the black keeps its outline and its sheen, the moonstone a soft glow, its streak brighter
  blackopal163: 'totalEmissiveRadiance += uNight * fire163 * fl163 * 0.5;', // the fire brighter by night
});
// _t163 (the penguin's body and front, per stage G): copies of the two meshes (cloned once per geometry). d: the distance in pattern space to the
// nearest vertex the two share (the modelled edge), + on the body, - on the front; W: how far the moonstone reaches past it, by that edge
// vertex's height under the edge's top (0.065 on the flanks, 0 at the throat)
const T163 = new Map();
const tux163 = G => { let c = T163.get(G.body); if (c) return c;
  const B = G.body, A = G.accent, key = (P, i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
  const inB = new Set(Array.from(B.index.array, i => key(B.attributes.position, i))), edge = [];
  for (const i of new Set(A.index.array)) if (inB.has(key(A.attributes.position, i))) edge.push(A.attributes._op.getX(i), A.attributes._op.getY(i), A.attributes._op.getZ(i));
  let top = 0; for (let j = 1; j < edge.length; j += 3) top = Math.max(top, edge[j]);
  const field = (g, s) => { const o = g.attributes._op, t = new Float32Array(o.count * 2);
    for (const i of new Set(g.index.array)) { let best = 1e9, by = 0; const x = o.getX(i), y = o.getY(i), z = o.getZ(i);
      for (let j = 0; j < edge.length; j += 3) { const d = (x - edge[j]) ** 2 + (y - edge[j + 1]) ** 2 + (z - edge[j + 2]) ** 2; if (d < best) { best = d; by = edge[j + 1]; } }
      t[i * 2] = s * Math.sqrt(best); t[i * 2 + 1] = 0.065 * (1 - THREE.MathUtils.smoothstep(by, top - 0.3, top - 0.02)); }
    return t; };
  const cp = (g, t) => { const n = g.clone(); n.setAttribute('_t163', new THREE.BufferAttribute(t, 2)); return n; };
  c = { body: cp(B, field(B, 1)), accent: cp(A, field(A, -1)) }; T163.set(B, c); return c; };
// the flippers (w) have no _t163: zeros in the fragment shader instead (everything that reads it is uWing 0 there)
const tuxv163 = (m, w) => { const prev = m.onBeforeCompile, k = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    if (w) { sh.fragmentShader = 'const vec2 vT163 = vec2(0.0);\n' + sh.fragmentShader; return; }
    sh.vertexShader = 'attribute vec2 _t163;\nvarying vec2 vT163;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvT163 = _t163;');
    sh.fragmentShader = 'varying vec2 vT163;\n' + sh.fragmentShader; };
  m.customProgramCacheKey = () => k + (w ? '-t163w' : '-t163'); return m; };
Object.assign(LOOKS, {
  obsidian163: () => { const o = w => spec165(tuxv163(look(phys('#050506', { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }), 'obsidian163', OBS165, { uWing: w }, { studio: 1 }), w)), body = o(0), s = shine('#e6e9ee', 0.12);
    return { body, accent: body, wing: o(1), hoof: s, beak: s,
      parts: (r, G) => { if (!G.accent?.index) return; const c = tux163(G); // (a body without the modelled front: plain obsidian)
        r.traverse(x => { if (x.isMesh && x.material === body) x.geometry = x.geometry === G.body ? c.body : x.geometry === G.accent ? c.accent : x.geometry; }); } }; },
  blackopal163: () => { const b = spec165(look(phys('#05060c', { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }), 'blackopal163', BOPAL165, {}, { studio: 0.5 }));
    return { body: b, accent: b, hoof: b, horn: b, nostril: b, beak: shine('#ffc75a', 0.1) }; },
});
// ---- 163 D ③ (?m89 시범): 로즈쿼츠 여우, 은 세공 올빼미.
// 로즈쿼츠 여우: rose quartz, milky and opaque (inbox 163 D: no clear crystal body): a polished pink stone (clear coat over a satin
// stone; the studio's soft boxes in the coat), its milk soft clouds at two depths along the view ray (they drift against the surface
// as it turns: depth without seeing through), a little light scattered back from inside (more at the edges), a few frost glints.
// Only the tail tip lit from inside (the tail ends at -0.65 both stages, the hind legs stand near -0.06 / -0.12): a faint pink spill
// from -0.32, the tip (from -0.45) a vivid hot pink (the stone's own colour and the studio's reflections let go there, so the light
// is not washed out; a moderate strength: ACES turns a stronger pink to white), a pale core at the very end, breathing slowly; and a
// soft halo quad round the tip (tipOf163 below). uAcc 1 (the ear tips; the baby's back line) a deeper rose. The nose a polished garnet.
// 165 D: a thin champagne-gold trim (polished metal under the clear coat, no light from inside) on the ear tips (the top 2.8 % of the
// height: only the ears reach it, both stages) and round the paws' edge (the lowest 3 %: the body and tail stop above 0.058; its
// normal turned out and up, a bevel catching the studio's top light rather than mirroring the floor)
const ROSE163 = AA127 + `vec3 ri_ = normalize(-vdir * normalMatrix);
  float v1_ = fbm3(p * vec3(2.5, 4.0, 2.5) + ri_ * 0.05 + 3.0), v2_ = fbm3(p * vec3(4.0, 2.5, 4.0) + ri_ * 0.14 + 11.0), th_ = 1.0 - nv;
  float cl163 = smoothstep(0.38, 0.74, v1_) * 0.6 + smoothstep(0.42, 0.8, v2_) * 0.4;
  float tl163 = smoothstep(-0.32, -0.56, p.x), tip163 = smoothstep(-0.45, -0.62, p.x), co163 = smoothstep(-0.58, -0.67, p.x), br163 = 0.9 + 0.1 * sin(uTime * 1.3);
  vec3 g_ = cells(p * 42.0); float fr163 = (1.0 - smoothstep(0.0, 0.07 + fwidth(g_.x), g_.x)) * step(0.93, g_.z) * max(0.0, 0.4 + 0.6 * sin(uTime * (0.8 + g_.z) + g_.z * 50.0)) * (1.0 - tl163);
  vec3 pk163 = mix(vec3(0.8, 0.34, 0.42), vec3(0.96, 0.74, 0.78), cl163) * mix(1.0, 0.8, uAcc);
  diffuseColor.rgb = pk163 * 0.66 * (1.0 - 0.95 * tip163); roughnessFactor = mix(0.34, 0.7, tip163); lookStudio = 0.5 * (1.0 - tip163);
  totalEmissiveRadiance += pk163 * (0.07 + 0.08 * nv + 0.16 * th_ * th_) * (1.0 - tip163) + vec3(1.0, 0.9, 0.95) * fr163 * 0.5
    + (vec3(1.0, 0.06, 0.3) * (tl163 * tl163 * 0.45 + tip163 * (0.85 + 0.4 * nv)) + vec3(1.0, 0.45, 0.68) * co163 * (0.5 + 1.0 * nv)) * br163;
  float pw_ = 1.0 - AA(p.y, 0.03), gk165 = max(AA(p.y, 0.972), pw_);
  normal = normalize(mix(normal, normalMatrix * normalize(vec3(on.x, 0.6, on.z)), pw_ * 0.8));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.74, 0.42), gk165); metalnessFactor = gk165; roughnessFactor = mix(roughnessFactor, 0.16, gk165);
  lookStudio = mix(lookStudio, 0.85, gk165); totalEmissiveRadiance *= 1.0 - gk165;`;
// 은 세공 올빼미: silver filigree (openwork): the feathers silver wire scales in offset rows round the body's upright axis (16 round, the
// rows half a scale apart, each scale's rim a twisted wire, a coiled wire spiral in each scale with a bead at its heart); between the
// wires the figure is open and a soft ivory light shows from inside. The wires round (the normal turned across each wire's width), the
// light dimmer next to them (shade). Far off (a wire under a pixel) the pattern goes to its mix. On the crown (the axis) the rows close:
// plain polished silver there. uAcc 1 (the owl's dark flecks): oxidised silver, less light. The beak polished onyx, the talons silver
const FILI163 = AA127 + `float ax_ = max(length(p.xz - vec2(0.07, 0.0)), 1e-4), fz_ = (1.0 - smoothstep(0.012, 0.035, length(fwidth(p)))) * smoothstep(0.03, 0.08, ax_);
  vec2 q_ = vec2(atan(p.z, p.x - 0.07) / 6.2832 * 16.0, p.y * 16.0 / (6.2832 * 0.27) * mix(1.0, 0.5, uWing));
  float r0_ = floor(q_.y * 2.0), kv_ = -1e3; vec2 cv_ = q_;
  for (int i = -1; i <= 2; i++) { float k_ = r0_ + float(i), o_ = 0.5 * mod(k_, 2.0);
    for (int j = -1; j <= 1; j++) { vec2 c_ = vec2(floor(q_.x - o_ + 0.5) + float(j) + o_, k_ * 0.5); if (k_ > kv_ && length(q_ - c_) < 0.55) { kv_ = k_; cv_ = c_; } } }
  vec2 e_ = q_ - cv_, gd_ = -e_ / max(length(e_), 1e-4); float d_ = 0.55 - length(e_), an_ = atan(e_.y, e_.x);
  for (int i = 1; i <= 2; i++) { float k_ = kv_ + float(i), o_ = 0.5 * mod(k_, 2.0);
    for (int j = -1; j <= 1; j++) { vec2 c_ = vec2(floor(q_.x - o_ + 0.5) + float(j) + o_, k_ * 0.5), f_ = q_ - c_; float s_ = length(f_) - 0.55; if (s_ < d_) { d_ = s_; an_ = atan(f_.y, f_.x); gd_ = f_ / max(length(f_), 1e-4); } } }
  vec2 l_ = e_ + vec2(0.0, 0.17); float rs_ = max(length(l_), 1e-4), x_ = rs_ / 0.085 - atan(l_.y, l_.x) / 6.2832, sp_ = abs(fract(x_) - 0.5) * 0.085;
  float sh_ = abs(e_.x), w1_ = 1.0 - AA(d_, 0.06), w2_ = uWing > 0.5 ? (1.0 - AA(sh_, 0.024)) * (1.0 - AA(e_.y, 0.3)) : max((1.0 - AA(sp_, 0.022)) * (1.0 - AA(rs_, 0.27)), 1.0 - AA(rs_, 0.045));
  float sv163 = mix(0.5, max(w1_, w2_), fz_);
  // the wire's round: tilt across its width (0 on the ridge, 1 at its edges), toward the outside of the wire
  vec2 tg_ = w1_ >= w2_ ? gd_ * clamp(d_ / 0.06, 0.0, 1.0) : uWing > 0.5 ? vec2(sign(e_.x) * clamp(sh_ / 0.024, 0.0, 1.0), 0.0)
    : rs_ < 0.045 ? l_ / 0.045 : l_ / rs_ * sign(fract(x_) - 0.5) * clamp(sp_ / 0.022, 0.0, 1.0);
  vec3 tq_ = vec3(-p.z, 0.0, p.x - 0.07) / ax_ * tg_.x + vec3(0.0, tg_.y, 0.0); tq_ -= on * dot(on, tq_);
  normal = normalize(normal + normalMatrix * tq_ * 0.9 * fz_ * max(w1_, w2_)); nv = clamp(dot(normal, vdir), 0.0, 1.0);
  float gp163 = (1.0 - sv163) * mix(0.55, smoothstep(0.06, 0.16, min(d_, uWing > 0.5 ? sh_ + 0.036 : rs_ < 0.27 ? sp_ + 0.04 : 1.0)), fz_) * mix(1.0, 0.45, uAcc);
  float rope_ = mix(1.0, 0.86 + 0.14 * cos(an_ * 43.0), fz_ * step(w2_, w1_));
  diffuseColor.rgb = mix(vec3(0.16, 0.155, 0.15), mix(vec3(0.93, 0.93, 0.94), vec3(0.3, 0.31, 0.34), uAcc) * rope_, sv163);
  metalnessFactor = sv163; roughnessFactor = mix(0.6, mix(0.14, 0.24, uAcc), sv163); lookStudio = 0.85 * sv163;
  totalEmissiveRadiance += vec3(1.0, 0.86, 0.64) * gp163 * 0.75;`;
// the tail tip's light spilling past its outline: one camera-facing quad at the tip's middle (the body's last 0.06 of its height at the
// back), added on, a soft pink fading out, brighter by night, breathing with the tip. As 155 C's frost flowers every position is that
// point (the corners in aQ): Box3 (thumbs, codex, framing) sees a point inside the body, a shadow pass draws nothing. The body in
// front of the tip hides the quad's middle, so the light shows round the tip. One quad per body geometry (TIP163), freed by dispose163
const TIP163 = new Map();
const tipOf163 = G => { let g = TIP163.get(G.body); if (g) return g;
  const p = G.body.attributes.position, b = G.body.boundingBox, H = b.max.y, c = [0, 0, 0]; let n = 0;
  for (let i = 0; i < p.count; i++) if (p.getX(i) < b.min.x + 0.06 * H) { c[0] += p.getX(i); c[1] += p.getY(i); c[2] += p.getZ(i); n++; }
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => c.map(v => v / n)), 3));
  const R = 0.3 * H; g.setAttribute('aQ', new THREE.Float32BufferAttribute([-1, -1, R, 1, -1, R, 1, 1, R, -1, 1, R], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  TIP163.set(G.body, g); return g; };
const tipGlow163 = () => new THREE.ShaderMaterial({ uniforms: { uTime: windTime, uNight: nightGlow }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, // adds light, leaves alpha
  vertexShader: 'attribute vec3 aQ; varying vec2 vQ; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xy += aQ.xy * aQ.z * length(modelViewMatrix[1].xyz); vQ = aQ.xy; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform float uTime, uNight; varying vec2 vQ; void main() { float a = pow(max(0.0, 1.0 - length(vQ)), 2.0) * (0.9 + 0.9 * uNight) * (0.9 + 0.1 * sin(uTime * 1.3)); gl_FragColor = vec4(vec3(1.0, 0.15, 0.45) * a, 1.0); }' });
Object.assign(NIGHT_LOOK, {
  rosequartz163: 'totalEmissiveRadiance += uNight * (pk163 * 0.03 * (1.0 - tl163) * (1.0 - gk165) + vec3(1.0, 0.25, 0.5) * (tl163 * 0.25 + tip163 * 0.6) + vec3(1.0, 0.7, 0.8) * co163 * 0.4);', // the tail tip a lamp by night, the stone a faint pink
  filigree163: 'totalEmissiveRadiance += uNight * vec3(1.0, 0.78, 0.46) * gp163 * 1.1;', // the light inside brighter by night
});
Object.assign(LOOKS, {
  rosequartz163: () => { const r = acc => look(phys('#ffffff', { roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05 }), 'rosequartz163', ROSE163, { uAcc: acc }, { studio: 0.5 }), body = r(0), glow163 = tipGlow163();
    return { body, accent: r(1), hoof: body, beak: phys('#4a0f20', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), glow163,
      parts: (root, G) => { const o = new THREE.Mesh(tipOf163(G), glow163); o.renderOrder = 5; o.frustumCulled = false; const g = new THREE.Group(); g.add(o); root.add(g); } }; }, // in a group: merge() leaves it
  filigree163: () => { const f = (acc, w) => look(phys('#ffffff', { roughness: 0.2, metalness: 1 }), 'filigree163', FILI163, { uAcc: acc, uWing: w }, { studio: 0.85 }), body = f(0, 0), spot163 = f(1, 1);
    return { body, accent: f(1, 0), wing: f(0, 1), spot163, hoof: shine('#e6e9ee', 0.12), beak: phys('#16161b', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }),
      parts: (r, G) => { const s = new Set(G.wings.map(w => w.spot)); r.traverse(x => { if (x.isMesh && s.has(x.geometry)) x.material = spot163; }); } }; }, // the wing flecks: the wing's feathers
});
// the sets are made once and kept (as every look's); dispose163 frees them and the copies (no caller yet: nothing tears the looks down)
export const dispose163 = () => { for (const [k, s] of cache) if (/^((obsidian|blackopal|rosequartz|filigree)163|(plat|bronze)183b)\{/.test(k)) { for (const m of new Set(Object.values(s))) m.dispose?.(); cache.delete(k); }
  for (const v of L183.values()) for (const p of v) for (const g of p) g.dispose(); L183.clear(); for (const g of TIP163.values()) g.dispose(); TIP163.clear(); for (const c of T163.values()) { c.body.dispose(); c.accent.dispose(); } T163.clear(); };
// ---- 192 A 「전설」 기준으로 다시 (?m89 시범; data.js LEGEND192, ?m89&leg192=a|b one pair): the polar bear and the reindeer, two
// concepts each, on their own bodies (the bear's public body; 183 B's reindeer body and legs, parts183), nothing added: the body, the
// antler, the fur's tips made the concept. The bear's two are clear() glass (fake mode: the screen copy bent through them).
// 빙산 곰: the body an iceberg: above a wavy line (uSn of the height: the cub's head sits lower) snow-white crystal, opaque (the glass's
// own see-through taken back out in post: lit = (out - see - rim) / its dark band), cut in small flat facets (each cell's normal its own
// tilt) with points of glitter; just under the line milky ice; below it clear sea-ice blue, deeper and clearer toward the feet (tint and
// inner by height), a few small bubbles in it (not in the habitat: there under a pixel). By night the ice glows a soft cyan from inside,
// the snow takes the moon. Not the 빙하 얼음 bear's (an opaque pale ice netted with cracks): no cracks, the scene seen through it
const ICE192W = 'float w_ = 0.09 * (vn3(P_ * 6.0) - 0.5) + 0.04 * (vn3(P_ * 19.0 + 4.0) - 0.5), sn_ = smoothstep(uSn - 0.03, uSn + 0.03, P_.y + w_), mk_ = smoothstep(uSn - 0.26, uSn - 0.01, P_.y + w_) * (1.0 - sn_);';
const ICE192_NRM = `vec3 P_ = vOp; ${ICE192W}
  vec3 cc_ = cells(P_ * mix(30.0, 13.0, uHab)), tl_ = normalMatrix * (h33(vec3(cc_.z * 91.0, 3.0, 7.0)) - 0.5);
  normal = normalize(normal + tl_ * (0.55 * sn_ + 0.3 * mk_));
  diffuseColor.rgb = vec3(0.93, 0.955, 0.98) * sn_; roughnessFactor = mix(roughnessFactor, 0.5, sn_);
  float tw_ = pow(max(0.0, sin(uTime * (0.8 + 2.0 * cc_.z) + cc_.z * 60.0)), 8.0) * step(0.72, cc_.z) * (1.0 - smoothstep(0.07, 0.07 + 1.5 * fwidth(cc_.x), cc_.x));
  totalEmissiveRadiance += vec3(1.0, 0.99, 0.96) * 1.6 * tw_ * sn_;`;
const ICE192 = `vec3 P_ = p; ${ICE192W}
      vec3 rc_ = vec3(1.0, 0.98, 0.94) * 0.5 * rim /* 0.5 = iceberg192's rimK (LOOKS): change both together */, lit_ = (gl_FragColor.rgb - see - rc_) / (1.0 - 0.5 * dark * (1.0 - rim));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, lit_ + rc_ * 0.3, sn_);
      gl_FragColor.rgb += (vec3(0.72, 0.86, 0.95) * (0.42 + 0.2 * nv) - see * 0.65) * mk_;
      gl_FragColor.rgb += vec3(0.08, 0.42, 0.68) * 0.14 * pow(nv, 2.0) * (1.0 - sn_) * (1.0 - fr);
      if (uHab < 0.5) { vec3 bc_ = cells((p + rd * 0.05) * 26.0 + 5.0); float bb_ = step(0.86, bc_.z) * (1.0 - smoothstep(0.06, 0.06 + 1.5 * fwidth(bc_.x), bc_.x)) * (1.0 - sn_ - mk_);
        gl_FragColor.rgb += vec3(0.85, 0.95, 1.0) * 0.3 * bb_ * (1.0 - fr); }`;
const ICE192_PRE = `{ float y_ = smoothstep(0.05, 1.0, p.y / uSn); tint = mix(vec3(0.12, 0.55, 0.86), vec3(0.62, 0.88, 0.98), y_); inner = mix(vec3(0.02, 0.17, 0.38), vec3(0.3, 0.6, 0.8), y_); }`;
// 극야 곰: the deep night sky: navy glass, darkest on the back, a lighter steel-blue low down (the sky at the horizon); on the fur's
// tips the frost: a broken silver edge along the outline, and cold points of starlight there and along the top, each twinkling on its
// own (white-blue dots with a soft halo: no lines between them, no gold: not 별자리 거북's or the 별빛 fox's). A small snow crystal at
// each step (snowMesh192); by night the frost and the stars brighter. rimK 0: the frost is its outline.
// 198 A: read at game distance as the night sky, not "a dark blue bear": the frost edge wider (never under ~3 px: px = fwidth(s)) and
// brighter, whole far off, broken by its noise near (no white sticker line; the inner frost patches only near the edge); the horizon (hz_)
// a glowing steel-blue to teal band from the belly down to the feet; a few big stars (bq_: round on the screen, on the back and upper
// flanks, never under ~2 px, twinkling 0.3..1, so two or three always show) over the fine ones (those a little bigger, brighter); the eyes
// one small white catchlight (pnEye198)
const PN192_PRE = `tint = mix(vec3(0.16, 0.3, 0.62), vec3(0.06, 0.14, 0.42), smoothstep(0.1, 0.75, p.y)); inner = mix(vec3(0.04, 0.08, 0.24), vec3(0.006, 0.014, 0.06), smoothstep(0.08, 0.7, p.y));`;
const PN192 = `float aa_ = length(fwidth(p)); // far off (a pixel spans more of p) the fine noise fades to its mean: no shimmer at game distance
  float fn_ = mix(vn3(p * 48.0), 0.5, smoothstep(0.005, 0.012, aa_)) + 0.3 * mix(vn3(p * 130.0), 0.5, smoothstep(0.0015, 0.004, aa_)), fq_ = clamp(3.0 * px, 0.07, 0.32);
      float fz_ = max(smoothstep(1.0 - fq_, 1.0 - 0.4 * fq_, s) * (0.55 + 0.45 * smoothstep(0.35, 0.7, fn_)), 0.7 * smoothstep(0.86, 0.97, s) * smoothstep(0.55, 0.8, fn_)), hz_; // 201 A: the cub (uCub 1) half the frost on its face and neck (x past the chest, above the legs), none on the tail nub
      fz_ *= 1.0 - uCub * (0.5 * smoothstep(0.12, 0.24, p.x) * smoothstep(0.45, 0.6, p.y) + (1.0 - smoothstep(-0.6, -0.54, p.x)) * smoothstep(0.42, 0.5, p.y) * (1.0 - smoothstep(0.14, 0.24, abs(p.z))));
      hz_ = smoothstep(0.62, 0.2, p.y) * (1.0 - fz_);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(0.27, 0.45, 0.74), vec3(0.22, 0.68, 0.76), smoothstep(0.42, 0.06, p.y)) * (0.7 + 0.4 * nv), 0.55 * hz_) + vec3(0.72, 0.84, 1.0) * fz_ * 0.62;
      vec3 st_ = cells(p * mix(32.0, 14.0, uHab)); float wt_ = 0.2 + 0.8 * max(smoothstep(0.45, 0.92, s), smoothstep(0.25, 0.9, vn.y));
      float pt_ = step(1.0 - 0.4 * wt_, st_.z), tw_ = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * (0.7 + 1.5 * st_.z) + st_.z * 40.0), 3.0), fw_ = fwidth(st_.x) + 1e-4;
      float core_ = 1.0 - smoothstep(0.08, 0.08 + 1.5 * fw_, st_.x), halo_ = pow(max(0.0, 1.0 - st_.x / 0.32), 3.0);
      // the big stars: a 2D cell grid on p.xz (4 cells a unit, one point in each, some lit) on the back and the upper flanks (dark navy,
      // p.y > ~0.7: scattered, not one row along the spine), none on the head. Measured round ON THE SCREEN (198 A review: discs on the
      // surface came out as flat glossy ovals): bj_ = det of the screen-to-cell map (dFdx/dFdy of bq_), bs_ the screen pixels to the point,
      // bd_ back in cells (pixels x bk_, the cells a pixel). Radius 0.12 of a cell (~2 css px at the home view), never under ~2 px far off;
      // the glow (bh_) 0.3 of a cell. Twinkle 0.3..1 over 2.4..4.5 s (the core 1.2: no longer clipped at its low)
      vec2 bq_ = p.xz * 4.0 + 3.7, bf_ = fract(bq_), bx_ = dFdx(bq_), by_ = dFdy(bq_); float bj_ = bx_.x * by_.y - bx_.y * by_.x; bj_ = abs(bj_) < 1e-9 ? 1e-9 : bj_;
      float bd_ = 1e12, bz_ = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec3 bh3_ = h33(vec3(floor(bq_) + vec2(i, j), 5.0)); vec2 bo_ = vec2(i, j) + 0.2 + 0.6 * bh3_.xy - bf_;
        vec2 bs_ = vec2(by_.y * bo_.x - by_.x * bo_.y, bx_.x * bo_.y - bx_.y * bo_.x) / bj_; float be_ = dot(bs_, bs_); if (be_ < bd_) { bd_ = be_; bz_ = bh3_.z; } }
      float bw_ = sqrt(abs(bj_)); bd_ = sqrt(bd_) * bw_; float br_ = max(0.12 * clamp(bw_ * 60.0, 0.4, 1.0), 2.0 * bw_); // near (a cell over ~60 px) the core shrinks to 0.4: a point of light in its glow, not a painted dot
      float bp_ = step(0.5, bz_) * smoothstep(0.66, 0.8, p.y) * (1.0 - smoothstep(0.3, 0.42, p.x));
      float bt_ = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * (0.9 + 1.4 * bz_) + bz_ * 53.0), 2.0), bc_ = 1.0 - smoothstep(br_ - 1.5 * bw_, br_, bd_), bh_ = pow(max(0.0, 1.0 - bd_ / 0.3), 3.0);
      // 201 A: the big stars a very faint sky blue (core and glow), told from the white snowflakes; the fine ones as they were
      gl_FragColor.rgb += (vec3(0.86, 0.93, 1.0) * pt_ * tw_ * (core_ * 2.0 + halo_ * 0.7) + bp_ * bt_ * (vec3(0.7, 0.87, 1.0) * bc_ * 1.2 + vec3(0.5, 0.76, 1.0) * bh_ * 0.6)) * (1.0 - 0.5 * fr);`;
Object.assign(NIGHT_CLEAR, {
  iceberg192: 'gl_FragColor.rgb += uNight * (vec3(0.12, 0.55, 0.9) * (0.12 + 0.3 * pow(nv, 2.0)) * (1.0 - sn_) + vec3(0.5, 0.65, 0.95) * 0.1 * sn_) * (1.0 - fr);',
  polarnight192: 'gl_FragColor.rgb += uNight * (vec3(0.72, 0.84, 1.0) * (fz_ * 0.45 + pt_ * tw_ * core_ * 0.9) + vec3(0.58, 0.8, 1.0) * bp_ * bt_ * (bc_ + 0.4 * bh_) + vec3(0.08, 0.4, 0.5) * 0.25 * hz_ + vec3(0.1, 0.16, 0.45) * 0.14 * pow(nv, 2.0) * (1.0 - fr));',
});
// the snow crystals: as the 백록's frost flowers (frostOf152: N quads, every position 0, the corners in aQ, shared for the page), smaller
// (uS 0.3 of the body unit: a paw's width), simpler (six arms, one pair of side twigs), silver-white with a pale blue edge, gone in
// LIFE192; one at each step while it walks (every 0.38 s if it moved 0.12 of its body unit), four on its first draw (a still photo shows
// them), none standing. dispose192 frees the shared geometry and material
const N192 = 8, LIFE192 = 2.2;
let snow192 = null;
const snowOf192 = () => snow192 ??= (() => {
  const g = new THREE.BufferGeometry(), q = [], ix = [];
  for (let i = 0; i < N192; i++) { for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.push(x, y, i); ix.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(q.length), 3)); g.setAttribute('aQ', new THREE.Float32BufferAttribute(q, 3)); g.setIndex(ix);
  const m = new THREE.ShaderMaterial({ uniforms: { uF: { value: Array.from({ length: N192 }, () => new THREE.Vector4(0, 0, 0, -99)) }, uS: { value: 0.1 }, uTime: windTime, uNight: nightGlow },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, extensions: { derivatives: true },
    vertexShader: `uniform vec4 uF[${N192}]; uniform float uS, uTime; attribute vec3 aQ; varying vec2 vQ; varying float vA;
      void main() { vec4 f = uF[int(aQ.z + 0.5)]; float age = uTime - f.w, on = step(0.0, age) * step(age, ${LIFE192.toFixed(1)});
        vA = on * (1.0 - smoothstep(${(LIFE192 - 0.8).toFixed(1)}, ${LIFE192.toFixed(1)}, age)); vQ = aQ.xy;
        float r = f.w * 7.3 + aQ.z * 1.7, c = cos(r), s = sin(r);
        vec2 q = mat2(c, s, -s, c) * aQ.xy * uS * (0.4 + 0.6 * smoothstep(0.0, 0.3, age)) * on;
        gl_Position = projectionMatrix * viewMatrix * vec4(f.xyz + vec3(q.x, 0.0, -q.y), 1.0); }`,
    fragmentShader: `uniform float uNight; varying vec2 vQ; varying float vA;
      void main() { float r = length(vQ), k = 1.0471976, an = mod(atan(vQ.y, vQ.x) + k * 0.5, k) - k * 0.5; vec2 p = vec2(cos(an), abs(sin(an))) * r, e = vec2(0.5, 0.866), d1 = p - vec2(0.5, 0.0);
        float d = min(length(p - vec2(clamp(p.x, 0.0, 0.9), 0.0)), length(d1 - e * clamp(dot(d1, e), 0.0, 0.24)));
        float fw = fwidth(d) + 1e-4, w = 0.07 * (1.0 - 0.4 * r), arm = 1.0 - smoothstep(w, w + 1.2 * fw, d), core = 1.0 - smoothstep(0.0, 0.16, r);
        float a = max(arm, core * 0.85) * vA; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.6, 0.74, 1.0), vec3(0.97, 0.99, 1.0), max(1.0 - smoothstep(0.0, 0.5 * w + fw, d), core));
        gl_FragColor = vec4(c * a * (1.0 + 1.6 * uNight), a * (0.9 - 0.5 * uNight)); }` });
  return { g, m }; })();
const snowMesh192 = (w, legs, S) => {
  const { g, m } = snowOf192(), o = new THREE.Mesh(g, m), F = Array.from({ length: N192 }, () => new THREE.Vector4(0, 0, 0, -99)), v = new THREE.Vector3(), at = new THREE.Vector3();
  let t0 = null, last = 0, foot = 0, slot = 0, sc = 1; const hind = legs.filter(l => !l.userData.front);
  const put = (t, l = legs[foot++ % legs.length], k = 0) => { for (let r = w; r; r = r.parent) if (r.userData.wet !== undefined) { if (r.userData.wet) return; break; } // swimming (walk.js marks it): no prints on the water
    l.localToWorld(v.set(-k, -S.legs.hip, 0)); F[slot++ % N192].set(v.x, w.matrixWorld.elements[13] + 0.01 * sc, v.z, t); };
  o.renderOrder = 5; o.frustumCulled = false; o.raycast = () => {};
  o.onBeforeRender = () => {
    const t = windTime.value; sc = w.matrixWorld.getMaxScaleOnAxis() * S.s;
    if (t !== t0) {
      const fresh = t0 === null || t < t0 || t - t0 > 5; t0 = t;
      if (fresh) { for (let i = 0; i < 4; i++) put(t - 0.3 - 0.4 * i, hind[i % hind.length] ?? legs[0], 0.5 + 0.45 * (i >> 1) + 0.2 * (i & 1)); last = t; w.getWorldPosition(at); } // the first draw: the last few steps behind the hind feet (under the paws they would hide)
      else if (t - last > 0.38) { if (w.getWorldPosition(v).distanceTo(at) > 0.12 * sc) put(t); last = t; w.getWorldPosition(at); }
    }
    m.uniforms.uF.value.forEach((u, i) => u.copy(F[i])); m.uniforms.uS.value = 0.3 * sc; m.uniformsNeedUpdate = true; };
  return o; };
// 상고대 순록: the antler a winter tree's bare branch (its own file, pilot89_reindeer192: crooked twigs, forked) with rime frost on it:
// dark bark, white feathery rime on the tops and the windward (front) side, the forks' hollows bare (_thickness < 0), and on the twigs'
// ends (_thickness > 0) clear ice crystals: pale ice blue, glassy, cut in small facets, glinting in turn, glowing by night. The body the
// same winter: a smoky cool grey coat, darker down the legs (a trunk), a white rime fringe along the topline (where the coat faces
// up), a hoar dusting below it on the back, shoulders and flanks (hz_), glints in both. Nose and eyes as the reindeer's
const RIME192B = `float n_ = fbm3(p * 8.0), f_ = mix(fbm3(p * vec3(70.0, 30.0, 70.0)), 0.47, smoothstep(0.0015, 0.006, length(fwidth(p)))); // the fine rime noise fades to its mean far off (no shimmer)
  vec3 col_ = mix(vec3(0.085, 0.082, 0.09), vec3(0.15, 0.145, 0.155), n_) * mix(0.55, 1.0, smoothstep(0.04, 0.3, p.y));
  float up_ = dot(on, normalize(vec3(0.2, 1.0, 0.0))) + 0.3 * (f_ - 0.5) + 0.12 * (n_ - 0.5), rm_ = smoothstep(0.62, 0.9, up_), hz_ = smoothstep(0.1, 0.62, up_) * smoothstep(0.2, 0.5, p.y) * (1.0 - rm_);
  diffuseColor.rgb = mix(mix(col_, vec3(0.5, 0.56, 0.64), 0.45 * hz_ * f_), vec3(0.9, 0.93, 0.97) * (0.9 + 0.1 * f_), rm_); roughnessFactor = mix(0.62, 0.5, rm_);
  vec3 c_ = cells(p * mix(55.0, 24.0, uHab)); float tw_ = pow(max(0.0, sin(uTime * (0.8 + 2.0 * c_.z) + c_.z * 60.0)), 8.0) * step(0.75, c_.z) * (1.0 - smoothstep(0.06, 0.06 + 1.5 * fwidth(c_.x), c_.x));
  totalEmissiveRadiance += vec3(1.0, 0.99, 0.96) * 1.4 * tw_ * max(rm_, hz_);`;
const RIME192H = `float tip_ = max(vT183, 0.0), oc_ = max(-vT183, 0.0), aa_ = length(fwidth(p)), n_ = mix(fbm3(p * 40.0), 0.47, smoothstep(0.0025, 0.01, aa_)), f_ = mix(fbm3(p * vec3(70.0, 28.0, 70.0)), 0.47, smoothstep(0.0015, 0.006, aa_)); // far off: to the mean (no shimmer)
  vec3 bark_ = mix(vec3(0.085, 0.07, 0.062), vec3(0.2, 0.16, 0.135), n_) * (1.0 - 0.35 * smoothstep(0.1, 0.5, oc_));
  float rm_ = smoothstep(-0.05, 0.4, dot(on, normalize(vec3(0.5, 0.85, 0.0))) + 0.55 * (f_ - 0.5)) * (1.0 - smoothstep(0.1, 0.45, oc_));
  float ice_ = smoothstep(0.3, 0.6, tip_);
  vec3 c_ = cells(p * mix(80.0, 36.0, uHab));
  normal = normalize(normal + normalMatrix * (h33(vec3(c_.z * 77.0, 1.0, 9.0)) - 0.5) * 0.7 * ice_); nv = clamp(dot(normal, vdir), 0.0, 1.0);
  diffuseColor.rgb = mix(mix(bark_, vec3(0.9, 0.935, 0.97) * (0.88 + 0.12 * f_), rm_), vec3(0.42, 0.66, 0.82), ice_);
  roughnessFactor = mix(mix(0.72, 0.5, rm_), 0.04, ice_); lookStudio = 0.4 * ice_;
  float tw_ = pow(max(0.0, sin(uTime * (0.9 + 2.2 * c_.z) + c_.z * 60.0)), 8.0) * step(0.6, c_.z) * (1.0 - smoothstep(0.07, 0.07 + 1.5 * fwidth(c_.x), c_.x));
  totalEmissiveRadiance += vec3(0.55, 0.82, 1.0) * ice_ * (0.1 + 0.3 * pow(1.0 - nv, 2.0)) + vec3(1.0, 0.99, 0.96) * tw_ * (1.8 * ice_ + 0.6 * rm_);`;
// 등불 순록: 183 B's antler in amber: dark resin at its rim, a warm honey light deep inside where you look into it (nv), stirring
// slowly in swirls along the branch, brighter toward the tips (_thickness > 0), dimmer in the forks (< 0), a few small dark inclusions,
// breathing gently; by night much brighter (NIGHT_LOOK). The body a deep cocoa satin, the legs darker, and the antler's light on the
// head, neck and back near its base (uB: the base in pattern space, the calf's own; uR how far): a warm glow there, more by night. Not
// the 겨울 등불 reindeer's (all of it an orange lantern, a gold antler): only the antler is lit. The nose its own colour (#4a4034 since 201 B; HOLD192, so it ships only if HOLD192 is lifted)
const AMB192B = `vec3 q_ = vec3(p.x, p.y, abs(p.z)) - vec3(uBx, uBy, uBz), o_ = vec3(on.x, on.y, on.z * sign(p.z + 1e-5)); float d_ = length(q_);
  diffuseColor.rgb = mix(vec3(0.11, 0.064, 0.042), vec3(0.18, 0.108, 0.07), fbm3(p * 6.0)) * mix(0.62, 1.0, smoothstep(0.04, 0.3, p.y)); roughnessFactor = 0.42;
  float bo_ = exp(-d_ * d_ / (2.2 * uR * uR)) * (0.3 + 0.7 * clamp(dot(o_, -q_ / max(d_, 1e-4)), 0.0, 1.0));
  totalEmissiveRadiance += vec3(1.0, 0.52, 0.16) * bo_ * 0.16 * (0.92 + 0.08 * sin(uTime * 0.8));`;
const AMB192H = `float tip_ = max(vT183, 0.0), oc_ = max(-vT183, 0.0), sw_ = fbm3(p * vec3(8.0, 15.0, 8.0) - vec3(0.0, uTime * 0.04, 0.0)), co_ = pow(nv, 1.6);
  vec3 c_ = cells(p * 30.0 + 2.0); float inc_ = step(0.84, c_.z) * (1.0 - smoothstep(0.05, 0.05 + 1.5 * fwidth(c_.x), c_.x));
  float br_ = (0.2 + 1.1 * sw_) * (0.8 + 0.6 * smoothstep(0.1, 0.9, tip_)) * (1.0 - 0.55 * smoothstep(0.1, 0.6, oc_)) * (0.88 + 0.12 * sin(uTime * 0.8 + p.y * 4.0));
  diffuseColor.rgb = vec3(0.05, 0.012, 0.002); roughnessFactor = 0.16;
  totalEmissiveRadiance += mix(vec3(0.3, 0.06, 0.005), mix(vec3(1.0, 0.42, 0.04), vec3(1.0, 0.78, 0.4), co_ * sw_), co_) * br_ * (0.06 + 0.55 * co_) * (1.0 - 0.75 * inc_) * (1.0 - 0.6 * pow(1.0 - nv, 2.0));`;
Object.assign(NIGHT_LOOK, {
  rime192: 'totalEmissiveRadiance += uNight * vec3(0.55, 0.7, 1.0) * rm_ * 0.1;',
  rime192horn: 'totalEmissiveRadiance += uNight * (vec3(0.4, 0.75, 1.0) * ice_ * 0.55 + vec3(0.6, 0.75, 1.0) * rm_ * 0.07);',
  amberlamp192: 'totalEmissiveRadiance += uNight * vec3(1.0, 0.52, 0.16) * bo_ * 0.9;',
  amberlamp192horn: 3.2,
});
const unGreen192 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); unGreen(sh); }; return m; }; // the snow's white without the grass's green
const cub192 = (b, c) => (r, G, S) => { if (S.legs.hip < 0.5) r.traverse(o => { if (o.material === b) o.material = c; }); }; // the cub / calf its own uniforms (hip: the cub 0.39, the calf 0.46; adults 0.76, 0.86)
Object.assign(LOOKS, {
  iceberg192: () => { const ice = sn => unGreen192(C141({ key: 'iceberg192', tint: '#7fc8ee', absorb: 2.2, inner: '#1d5f94', dark: 0.5, rough: 0.06, neutral: 0.8, bend: 0.16, rimK: 0.5,
      uniforms: { uSn: sn }, pre: ICE192_PRE, nrm: ICE192_NRM, post: ICE192 })), b = ice(0.6), cub = ice(0.52);
    return { body: b, accent: b, hoof: b, cub, beak: phys('#1c2433', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), parts: cub192(b, cub) }; },
  polarnight192: () => { const pn = c => hab89(clear({ key: 'polarnight192', tint: '#3a5cb0', absorb: 2.6, inner: '#0b1440', dark: 0.35, color: '#03050f', rough: 0.1, coat: 1, neutral: 0.9, bend: 0.14, rimK: 0, uniforms: { uCub: c }, pre: PN192_PRE, post: PN192 })), b = pn(0), cub = pn(1); // 201 A: the cub its own (uCub)
    const eye = eyeMat.clone(); eye.customProgramCacheKey = () => 'eye198'; // 198 A: one small white catchlight, fixed to the view a little up-left of the bead's middle (the bead turns under it; set in so the bead shows only its front cap: nearer the middle, or it hides)
    eye.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(0.85, 0.92, 1.0) * 1.4 * smoothstep(0.95, 0.972, dot(normal, normalize(vec3(-0.2, 0.3, 0.93))));`); };
    return { ...same(b), cub, beak: phys('#0e1220', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), pnEye198: eye, // in the set: dispose192 frees it
      parts: (body, G, S) => { cub192(b, cub)(body, G, S); const legs = body.children.filter(o => o.userData.front !== undefined); if (legs.length) body.parent.add(snowMesh192(body.parent, legs, S));
        for (const o of body.children) if (o.material === eyeMat) o.material = eye; } }; },
  rime192: () => { const b = hab89(look(phys('#ffffff', { roughness: 0.6 }), 'rime192', RIME192B)), h = vt183(hab89(look(phys('#ffffff', { roughness: 0.6 }), 'rime192horn', RIME192H, {}, { studio: 0 })));
    return { body: b, accent: b, hoof: toyMat('#2a2426'), beak: toyMat('#4a4034'), r183body: b, r183calfbody: b, r192horn: h, r192calfhorn: h, parts: parts183 }; },
  amberlamp192: () => { const mk = (x, y, z, r) => look(phys('#ffffff', { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 }), 'amberlamp192', AMB192B, { uBx: x, uBy: y, uBz: z, uR: r });
    const b = mk(0.299, 0.957, 0.063, 0.24), calf = mk(0.186, 0.944, 0.09, 0.26), h = vt183(look(phys('#ffffff', { roughness: 0.16, specularIntensity: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.05 }), 'amberlamp192horn', AMB192H, {}, { studio: 0.2 }));
    return { body: b, accent: b, calf, hoof: toyMat('#3a2a22'), beak: toyMat('#4a4034'), r183body: b, r183calfbody: calf, r183horn: h, r183calfhorn: h,
      parts: (body, G, S) => { parts183(body, G, S); cub192(b, calf)(body, G, S); } }; }, // uB: 183 B's antler base (0.88, 1.98, 0.13), the calf's (0.5, 1.68, 0.16), less cx over H
});
// the sets are made once and kept (as every look's); dispose192 frees them and the snow crystals' shared geometry and material (no caller
// yet, as dispose163: nothing tears the looks down; the 183 leg copies are dispose163's L183)
export const dispose192 = () => { for (const [k, s] of cache) if (/^(iceberg|polarnight|rime|amberlamp)192\{/.test(k)) { for (const m of new Set(Object.values(s))) m.dispose?.(); cache.delete(k); }
  snow192?.g.dispose(); snow192?.m.dispose(); snow192 = null; };

// ---- 230 C1 (?x230 trial only; expansion-230.md 16장): 12 material swatches + the 백자 sample (13 looks, 14 entries with the rimless 법랑) on bodies we already have (data.js X230V). All GLSL,
// no texture. Not in any pool, egg or save; dispose230 frees the sets (and takes the two clear ones out of clearMats)
// thk230: the baked thickness (the _thickness attribute clear() reads) as vThk230, for the wax's thin parts
const thk230 = m => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
  sh.vertexShader = 'attribute float _thickness;\nvarying float vThk230;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvThk230 = _thickness;');
  sh.fragmentShader = 'varying float vThk230;\n' + sh.fragmentShader; }; return m; };
// M1 법랑: thick glossy enamel in one colour; uChip 1: a small navy rim round the very top (ear tips) and a few tiny chips of black iron
const ENAMEL230 = AA127 + `if (uChip > 0.5) { float t = AA(p.y, uTop); vec3 c = cells(p * 16.0 + 3.0); float chip = step(0.955, c.z) * (1.0 - AA(c.x, 0.15)) * (1.0 - t);
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, uNavy, t), vec3(0.03, 0.03, 0.035), chip); roughnessFactor = mix(roughnessFactor, 0.55, chip); }`;
// M9 무쇠 주물: black matte iron, sand-cast pebbling; worn to bright metal only on the high, rubbed places (top, toes)
const IRON230 = BUMP115 + `float fd = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 60.0), h = vn3(p * 90.0) * 0.6 + vn3(p * 37.0 + 2.0) * 0.4;
  BUMP115(h * fd, 0.0035)
  float wr = smoothstep(0.84, 0.9, fbm3(p * 7.0 + 1.0) + 0.12 * max(on.y, 0.0) + 0.4 * (1.0 - smoothstep(0.0, 0.05, p.y)));
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.88 + 0.24 * h * fd), uWorn, wr * 0.8);
  metalnessFactor = mix(0.45, 1.0, wr); roughnessFactor = mix(0.82, 0.3, wr); lookStudio = mix(0.15, 0.7, wr);`;
// M3 온도 변색: colour A by day, B at night and in rain; the change creeps in in blotches, low parts first (the cold ground)
const THERMO230 = `float t = clamp(max(uNight, uWet) * 1.15 - 0.075, 0.0, 1.0), f = fbm3(p * 3.2 + 4.0) * 0.7 + (1.0 - p.y) * 0.3;
  diffuseColor.rgb = mix(uA, uB, smoothstep(f - 0.12, f + 0.12, t * 1.4 - 0.2));`;
// M17 옹기: dark brown ash glaze, glossy, pooling darker in runs, thinning to rust at the edges; speckled close up; soles bare clay
const ONGGI230 = `float fd = 1.0 - smoothstep(0.25, 0.6, fwidth(p.y) * 40.0), pool = fbm3(p * vec3(2.0, 6.0, 2.0) + 1.3);
  vec3 col = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, smoothstep(0.45, 0.75, pool));
  col = mix(col, uEdge, 0.6 * pow(1.0 - nv, 2.0) * (1.0 - smoothstep(0.35, 0.7, pool)));
  if (uHab < 0.5) col *= 1.0 - 0.3 * step(0.93, vn3(p * 160.0)) * fd;
  float clay = 1.0 - smoothstep(0.035, 0.06, p.y); diffuseColor.rgb = mix(col, uClay, clay); roughnessFactor = mix(roughnessFactor, 0.85, clay);`;
// M21 바다 유리: frosted bottle glass worn by the waves: a milky skin over the green, fine pits; never ice blue
const SEA230 = `float pit = vn3(p * 60.0) * vn3(p * 23.0 + 5.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFrost * (0.7 + 0.3 * nv) * (0.9 + 0.15 * pit) * (1.0 - 0.6 * uNight), 0.5 * (1.0 - fr));`;
// M22 유리 구슬: clear glass with three coloured ribbons twisting round the long axis head to tail (more than one turn), a little
// inside the surface (they shift as the figure turns)
const BEAD230 = `vec3 q = p + rd * 0.06; float ph = atan(q.z, q.y - uAx) / 6.2832 + q.x * 1.6, aw = clamp(fwidth(ph), 0.002, 0.03), rib = 0.0; vec3 rc = vec3(0.0);
  for (int i = 0; i < 3; i++) { float d = abs(fract(ph - float(i) / 3.0 + 0.5) - 0.5), k = 1.0 - smoothstep(0.05 - aw, 0.05 + aw, d);
    rc += k * (i == 0 ? uR1 : i == 1 ? uR2 : uR3); rib += k; }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, rc * (0.55 + 0.45 * nv) * (1.0 - 0.6 * uNight), min(rib, 1.0) * 0.9 * (1.0 - fr));`;
// M25 밀랍: honey wax, soft and cloudy; light comes through where the body is thin (ears, tail). Not at night (no glow: 겨울 등불's)
const WAX230 = `float thin = 1.0 - smoothstep(0.12, 0.3, vThk230); diffuseColor.rgb *= 0.9 + 0.16 * fbm3(p * 5.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, min(uWax * 1.25, vec3(1.0)), 0.45 * thin);
  totalEmissiveRadiance += uWax * (0.03 + 0.9 * thin) * (0.6 + 0.4 * (1.0 - nv)) * (1.0 - 0.9 * uNight);`;
// M10 인쇄 양철: thin printed tin in bands round the body (red with cream pinstripes, cream with navy stars, navy with gold gears),
// gold lines between; the two halves crimped together down the middle (bare tin). uAcc 1: one print colour, no motif
const TIN230 = AA127 + BUMP115 + `if (uAcc < 0.5) { float fd = 1.0 - smoothstep(0.3, 0.7, fwidth(p.y) * 30.0), by = p.y * 7.0, band = mod(floor(by), 3.0), fy = fract(by);
  vec2 c = vec2(fract((atan(p.z, p.x) / 6.2832 + 0.5) * 18.0) - 0.5, fy - 0.5); float r = length(c), a = atan(c.y, c.x);
  vec3 col; float m;
  if (band < 0.5) { col = uRed; m = 1.0 - AA(abs(abs(fy - 0.5) - 0.28), 0.03); col = mix(col, uCream, m * fd); }
  else if (band < 1.5) { float fs = abs(fract(a * 5.0 / 6.2832 + 0.25) - 0.5) * 2.0; m = AA(0.3 * (0.42 + 0.58 * (1.0 - fs) * (1.0 - fs)) - r, 0.0); col = mix(uCream, uNavy, m * fd); }
  else { float R = 0.27 + 0.07 * step(0.5, fract(a * 8.0 / 6.2832)); m = AA(R - r, 0.0) * AA(r, 0.09); col = mix(uNavy, uGold, m * fd); }
  col = mix(col, uGold, (1.0 - AA(min(fy, 1.0 - fy), 0.04)) * fd);
  float sm = 1.0 - AA(abs(p.z), 0.012);
  diffuseColor.rgb = mix(col, vec3(0.78, 0.78, 0.8), sm); metalnessFactor = mix(metalnessFactor, 1.0, sm); roughnessFactor = mix(roughnessFactor, 0.22, sm);
  BUMP115(sm * (0.5 + 0.5 * sin(p.x * 220.0)), 0.003) }`;
// M11 거울 조각: small square mirror tiles all over (each tilted its own way, so they flash one by one), dark grout between
const MIRROR230 = PL138 + `float F; vec2 Q; PL138(Q, F) vec2 g = Q * 30.0, gi = floor(g), gf = fract(g) - 0.5;
  float aa = fwidth(g.x) + fwidth(g.y) + 1e-4, fd = 1.0 - smoothstep(0.3, 0.6, aa), e = 0.5 - max(abs(gf.x), abs(gf.y)), gr = (1.0 - smoothstep(0.06, 0.06 + aa, e)) * fd;
  normal = normalize(normal + normalMatrix * (h33(vec3(gi, F * 7.0)) - 0.5) * 0.35 * (1.0 - gr));
  diffuseColor.rgb = mix(diffuseColor.rgb, uGrout, gr); metalnessFactor = 1.0 - gr; roughnessFactor = mix(0.04, 0.7, gr); lookStudio *= 1.0 - gr;`;
// M18 테라초: a pale ground with angular stone chips of three sizes in six colours, ground flat and polished; the chips crisp
// (each an inset cell, so straight edges); the smaller ones fade out before they turn to mud far off
const TERRAZZO230 = AA127 + `vec3 col = diffuseColor.rgb * (0.97 + 0.05 * vn3(p * 40.0));
  for (int i = 0; i < 3; i++) { float s = i == 0 ? 9.0 : i == 1 ? 21.0 : 46.0; vec3 c = cells(p * s + float(i) * 13.1);
    float ch = step(i == 0 ? 0.7 : i == 1 ? 0.5 : 0.4, fract(c.z * 3.7)) * AA(c.y - c.x, 0.22 + 0.16 * fract(c.z * 11.3)) * (1.0 - smoothstep(0.25, 0.6, fwidth(p.y) * s * 1.2));
    float k = fract(c.z * 5.3) * 6.0; vec3 cc = k < 1.0 ? uT1 : k < 2.0 ? uT2 : k < 3.0 ? uT3 : k < 4.0 ? uT4 : k < 5.0 ? uT5 : vec3(0.9);
    col = mix(col, cc * (0.92 + 0.12 * fract(c.z * 17.0)), ch); }
  diffuseColor.rgb = col;`;
// M24 나무·레진 이음: wood (as 원목) and blue resin poured between in diagonal bands (four or five over back, belly and legs):
// the resin deep blue in the middle of a band and face on, lighter at its edges and grazing, cloudy, a few tiny bubbles close up
const WRESIN230 = GRAIN127 + `float s = p.x * 2.6 + p.y * 1.8 + 0.15 * fbm3(p * 3.0), d = abs(fract(s) - 0.5), aa = fwidth(s) + 1e-4, r = 1.0 - smoothstep(0.16 - aa, 0.16 + aa, d);
  vec3 rc = mix(uLight, uDeep, clamp(0.7 * (0.16 - d) / 0.16 + 0.3 * nv, 0.0, 1.0)) * (0.85 + 0.3 * fbm3(p * 8.0));
  rc = mix(rc, vec3(0.85), step(0.965, vn3(p * 120.0)) * 0.5 * (1.0 - uHab));
  diffuseColor.rgb = mix(wood, rc, r); roughnessFactor = mix(roughnessFactor, 0.04, r);
  totalEmissiveRadiance += uLight * 0.06 * r * (1.0 - nv) * (1.0 - 0.5 * uNight);`;
// M28 라탄 엮음: cane strips woven like a basket over and under, one family along the body, one round it (round the long axis, a
// whole number of strips round: no seam); dark gaps between. The strips along pinch where the axis meets the surface (chest, rump)
const RATTAN230 = BUMP115 + `float fd = 1.0 - smoothstep(0.25, 0.6, fwidth(p.y) * 30.0);
  vec2 w = vec2(p.x * 26.0, (atan(p.z, p.y - uAx) / 6.2832 + 0.5) * 48.0), c = floor(w), f = fract(w);
  float pA = max(0.0, 1.0 - pow(abs(f.y - 0.5) / 0.44, 2.0)), pB = max(0.0, 1.0 - pow(abs(f.x - 0.5) / 0.44, 2.0));
  float hA = pA * (1.0 + 0.5 * cos(3.1416 * (w.x - 0.5 - c.y))), hB = pB * (1.0 - 0.5 * cos(3.1416 * (w.y - 0.5 - c.x))), h = max(hA, hB);
  vec3 col = mix(uA, uB, step(hA, hB)) * (0.75 + 0.25 * min(h, 1.0));
  diffuseColor.rgb = mix(mix(uGap, col, smoothstep(0.05, 0.25, h)), (uA + uB) * 0.45, 1.0 - fd);
  BUMP115(h * fd, 0.004)`;
// M19 백자 (inbox 232 F R13, a sample): milky white glaze, faintly blue-grey where it runs thick (the foot, under the curves); no crackle
// (청자 has it), no drawing (청화백자), no navy rim or chips (법랑)
const BAEKJA230 = `float pool = 0.6 * (1.0 - smoothstep(0.0, 0.16, p.y)) + 0.4 * smoothstep(0.2, -0.6, on.y);
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.975 + 0.035 * vn3(p * 2.2)), uPool, 0.55 * pool);`;
if (X230) Object.assign(LOOKS, {
  baekja230: c => { const b = col => look(pale116(phys(col, { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 })), 'baekja230', BAEKJA230, { uPool: c.pool }), m = b(c.body), acc = b(dk(c.body, 0.96));
    return { body: m, accent: m, hoof: acc, beak: acc, horn: acc }; },
  enamel230: c => { const e = (col, rim) => look(([1, 3, 5].every(i => parseInt(col.slice(i, i + 2), 16) > 209) ? pale116 : x => x)(phys(col, { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 })),
    'enamel230', ENAMEL230, { uNavy: c.navy, uChip: rim, uTop: 0.93 }), b = e(c.body, c.rim), n = e(c.navy, 0);
    return { body: b, accent: b, hoof: c.rim ? n : b, beak: n }; },
  castiron230: c => { const m = look(phys(c.body, { roughness: 0.82, metalness: 0.45 }), 'iron230', IRON230, { uWorn: c.worn }, { studio: 0.15 }); return same(m); },
  thermo230: c => { const t = (a, b) => wet127(look(phys(a, { roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3 }), 'thermo230', THERMO230, { uA: a, uB: b })), acc = t(dk(c.a, 0.8), dk(c.b, 0.8));
    return { body: t(c.a, c.b), accent: acc, hoof: acc }; },
  onggi230: c => { const o = b => hab89(look(phys(b, { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }), 'onggi230', ONGGI230, { uEdge: c.edge, uClay: c.clay })), acc = o(dk(c.body, 0.85));
    return { body: o(c.body), accent: acc, hoof: acc, horn: acc }; },
  seaglass230: c => same(clear({ key: 'seaglass230', tint: c.tint, absorb: 2.0, rough: 0.55, neutral: 0.7, rimK: 0.3, bend: 0.06, dark: 0.4, color: dk(c.frost, 0.2), uniforms: { uFrost: c.frost }, post: SEA230 })),
  beeswax230: c => { const w = b => thk230(look(phys(b, { roughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(c.wax) }), 'wax230', WAX230, { uWax: c.wax })), acc = w(dk(c.body, 0.92));
    return { body: w(c.body), accent: acc, hoof: acc }; },
  tinprint230: c => { const t = (b, a) => look(phys(b, { roughness: 0.28, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.08 }), 'tin230', TIN230,
      { uRed: c.red, uCream: c.cream, uNavy: c.navy, uGold: c.gold, uAcc: a }, { studio: 0.4 }), gold = t(c.gold, 1);
    return { body: t(c.red, 0), accent: t(c.red, 1), hoof: gold, beak: gold }; },
  mirror230: c => { const m = b => look(phys(b, { roughness: 0.04, metalness: 1 }), 'mirror230', MIRROR230, { uGrout: c.grout }, { studio: 1 }), acc = m(dk(c.body, 0.85));
    return { body: m(c.body), accent: acc, hoof: acc, beak: phys('#111114', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }) }; },
  terrazzo230: c => { const t = b => look(phys(b, { roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.06 }), 'terrazzo230', TERRAZZO230,
      { uT1: '#c8664a', uT2: '#7fa07a', uT3: '#5a6f94', uT4: '#d9a640', uT5: '#3a3634' }), b = t(c.body);
    return { body: b, accent: b, hoof: t(dk(c.body, 0.55)), beak: b, horn: b }; },
  woodresin230: c => { const w = (b, g) => L127(phys(b, { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.12 }), 'wresin230', WRESIN230, { uGrain: g, uDeep: c.deep, uLight: c.light }), acc = w(dk(c.body, 0.82), dk(c.grain, 0.82));
    return { body: w(c.body, c.grain), accent: acc, hoof: phys(c.deep, { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }) }; },
  rattan230: c => { const r = k => look(phys(c.a, { roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.4 }), 'rattan230', RATTAN230, { uA: dk(c.a, k), uB: dk(c.b, k), uGap: c.gap, uAx: 0.45 }), acc = r(0.85);
    return { body: r(1), accent: acc, hoof: phys('#6a4a2a', { roughness: 0.6 }) }; },
});
// marblebead230 is a clear look too (its uAx: the long axis' height, as rattan's)
if (X230) LOOKS.marblebead230 = c => same(clear({ key: 'marblebead230', tint: '#eaf4f0', absorb: 0.8, coat: 1, neutral: 0.8, uniforms: { uR1: c.r1, uR2: c.r2, uR3: c.r3, uAx: 0.42 }, post: BEAD230 }));
// ---- 233 A (inbox 233, ?x230 trial only): the five that read as 「색만 바꾼 것」 once more, each with a mark that says the material at a
// glance, and M22 with one twisted core inside instead of ribbons on the skin. New slots (data.js X230V 14..19): the 230 ones stay as they were.
// M1 법랑 2: no rim; one deep glossy enamel colour with a faint orange-peel wave (the thick glaze's reflections ripple), and a very few chips
// on the thin edges (ear tips, tail) and the soles: black iron in the middle, the white ground coat in a ring round it
const ENAMEL233 = BUMP115 + `BUMP115(vn3(p * 16.0) + 0.5 * vn3(p * 31.0 + 4.0), 0.0012)
  vec3 c = cells(p * 11.0 + 7.0); float zone = max(1.0 - smoothstep(0.14, 0.34, vThk230), 1.0 - smoothstep(0.02, 0.06, p.y)), pick = step(0.62, fract(c.z * 7.3)) * zone;
  float r = 0.2 + 0.12 * fract(c.z * 3.1), aw = fwidth(c.x) + 1e-4, hole = pick * (1.0 - smoothstep(r - aw, r + aw, c.x)), ring = pick * (1.0 - smoothstep(r + 0.08 - aw, r + 0.08 + aw, c.x)) - hole;
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, vec3(0.9, 0.89, 0.85), ring), vec3(0.05, 0.05, 0.055), hole);
  roughnessFactor = mix(roughnessFactor, 0.65, hole + 0.4 * ring); lookStudio *= 1.0 - hole;`;
// M9 무쇠 2: sand-cast: a coarse pebbled skin with casting pits (a much bigger bump than 230's), grey-black speckle; worn bright on the high
// places; a little rust on the thin edges and the soles, broken up
const IRON233 = BUMP115 + `float fd = 1.0 - smoothstep(0.2, 0.6, fwidth(p.y) * 30.0), h = vn3(p * 55.0) * 0.55 + vn3(p * 21.0 + 2.0) * 0.45, pit = smoothstep(0.66, 0.82, vn3(p * 30.0 + 9.0));
  BUMP115((h - 0.9 * pit) * fd, 0.009)
  vec3 base = diffuseColor.rgb * (0.75 + 0.6 * h * fd);
  float wr = smoothstep(0.78, 0.86, fbm3(p * 6.0 + 1.0) + 0.15 * max(on.y, 0.0));
  float edge = max(1.0 - smoothstep(0.1, 0.3, vThk230), 1.0 - smoothstep(0.0, 0.05, p.y)), rust = edge * smoothstep(0.42, 0.6, fbm3(p * 9.0 + 3.0));
  vec3 rc = mix(vec3(0.4, 0.16, 0.07), vec3(0.72, 0.36, 0.14), vn3(p * 40.0));
  diffuseColor.rgb = mix(mix(base, uWorn, wr * 0.7), rc, rust);
  metalnessFactor = mix(mix(0.5, 1.0, wr), 0.0, rust); roughnessFactor = mix(mix(0.86, 0.35, wr), 1.0, rust); lookStudio = mix(mix(0.12, 0.6, wr), 0.0, rust);`;
// M3 온도 변색 2: warm on top, cold below, and the change between them runs through the in-between hues (gold, teal: a mood ring's sweep),
// wavy and blotched; by night (or rain) the cold climbs up the body. Four stops, so it never reads as the common two-colour 그라데이션
const THERMO233 = `float t = clamp(max(uNight, uWet), 0.0, 1.0), f = p.y + 0.22 * (fbm3(p * 3.0 + 4.0) - 0.5), e = mix(0.42, 0.92, t), k = smoothstep(e - 0.26, e + 0.26, f);
  vec3 c1 = vec3(0.22, 0.68, 0.7), c2 = vec3(0.98, 0.8, 0.3);
  diffuseColor.rgb = k < 0.33 ? mix(uB, c1, k / 0.33) : k < 0.66 ? mix(c1, c2, (k - 0.33) / 0.33) : mix(c2, uA, (k - 0.66) / 0.34);`;
// M25 밀랍 2: light from inside (the thick middle a deeper amber, the edges and thin parts glowing: the 「속빛」), and wax runs down from the top
// in a few columns round the body, each ending in a round bead, raised and paler
const WAX233 = BUMP115 + `float thin = 1.0 - smoothstep(0.1, 0.45, vThk230), fd = 1.0 - smoothstep(0.3, 0.7, fwidth(p.y) * 30.0);
  float R = length(p.xz) + 0.02, u = (atan(p.z, p.x) / 6.2832 + 0.5) * 14.0, ci = floor(u), fu = fract(u) - 0.5, rr = h31(vec3(ci, 3.0, 1.0));
  float yE = 0.9 - 0.42 * fract(rr * 7.1), cw = 6.2832 * R / 14.0, side = 1.0 - smoothstep(0.55, 0.85, abs(on.y));
  float run = step(0.45, rr) * smoothstep(yE - 0.005, yE + 0.005, p.y) * (1.0 - smoothstep(0.016, 0.024, abs(fu) * cw));
  float bead = step(0.45, rr) * (1.0 - smoothstep(0.028, 0.036, length(vec2(fu * cw, (p.y - yE) * 0.8))));
  float drip = max(run, bead) * side * fd;
  BUMP115(drip, 0.008)
  diffuseColor.rgb *= (0.9 + 0.14 * fbm3(p * 5.0)) * mix(1.0, 0.72, smoothstep(0.7, 1.8, vThk230) * nv);
  diffuseColor.rgb = mix(diffuseColor.rgb, min(uWax * 1.3, vec3(1.0)), 0.22 * thin + 0.8 * drip);
  roughnessFactor = mix(roughnessFactor, 0.12, drip);
  totalEmissiveRadiance += uWax * (0.12 + 0.45 * thin + 0.2 * drip) * (0.45 + 0.55 * pow(1.0 - nv, 1.5)) * (1.0 + 0.5 * uNight);`;
// M21 바다 유리 2: frosted all over (matte, milky, not see-through: only a faint shadow of what is behind), lit softly from above, thin
// parts glowing with the light through, fine pits; no bright glass rim
const SEA233 = `float pit = vn3(p * 70.0) * vn3(p * 26.0 + 5.0);
  vec3 fro = uFrost * (0.55 + 0.3 * nv + 0.2 * vn.y) * (0.92 + 0.12 * pit) + uFrost * 0.3 * (1.0 - smoothstep(0.15, 0.6, vThick));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fro * (1.0 - 0.6 * uNight), 0.42 + 0.4 * smoothstep(0.1, 0.7, vThick));`;
// M22 유리 구슬 2: clear glass with ONE twisted core inside (a flat ribbon through the long axis, turning as it runs head to tail, its two
// halves two colours), seen through the glass by marching the view ray in; nothing on the skin
const BEAD233 = `vec3 rc = vec3(0.0); float hit = 0.0, at = 0.0, sp = 0.0;
  for (int i = 0; i < 28; i++) { float t = 0.008 + float(i) * 0.018; vec3 q = p + rd * t; vec2 d = vec2(q.y - uAx, q.z);
    float r = length(d), R = uCore * (1.0 - smoothstep(0.38, 0.72, abs(q.x))), a = atan(d.y, d.x) - q.x * uTw, s = sin(a) * r;
    if (hit < 0.5 && i > 0 && r < R && s * sp <= 0.0) { hit = 1.0; at = t; rc = cos(a) > 0.0 ? uR1 : uR2; } sp = s; }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, rc * (0.6 + 0.4 * nv) * (1.0 - 0.6 * uNight), hit * 0.88 * (1.0 - fr) * (1.0 - 0.5 * at / 0.5));`;
if (X230) Object.assign(LOOKS, {
  enamel233: c => { const e = col => thk230(look(phys(col, { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }), 'enamel233', ENAMEL233, {}, { studio: 0.45 })), b = e(c.body);
    return { body: b, accent: b, hoof: b, beak: e(dk(c.body, 0.7)) }; },
  castiron233: c => same(thk230(look(phys(c.body, { roughness: 0.86, metalness: 0.5 }), 'iron233', IRON233, { uWorn: c.worn }, { studio: 0.12 }))),
  thermo233: c => { const t = (a, b) => wet127(look(phys(a, { roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3 }), 'thermo233', THERMO233, { uA: a, uB: b }));
    return same(t(c.a, c.b)); },
  beeswax233: c => { const w = b => thk230(look(phys(b, { roughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(c.wax) }), 'wax233', WAX233, { uWax: c.wax })), acc = w(dk(c.body, 0.92));
    return { body: w(c.body), accent: acc, hoof: acc }; },
  seaglass233: c => same(clear({ key: 'seaglass233', tint: c.tint, absorb: 1.4, rough: 0.85, neutral: 0.85, rimK: 0.1, bend: 0.03, dark: 0.12, color: dk(c.frost, 0.15), uniforms: { uFrost: c.frost }, post: SEA233 })),
  marblebead233: c => same(clear({ key: 'marblebead233', tint: '#eaf4f0', absorb: 0.8, coat: 1, neutral: 0.8, uniforms: { uR1: c.r1, uR2: c.r2, uAx: 0.42, uCore: 0.11, uTw: 7.0 }, post: BEAD233 })),
});
export const dispose230 = () => { for (const [k, s] of cache) if (/^[a-z]+23[03]\{/.test(k)) {
  for (const m of new Set(Object.values(s))) { if (!m?.isMaterial) continue; const i = clearMats.indexOf(m); if (i >= 0) clearMats.splice(i, 1); m.dispose(); }
  cache.delete(k); } };
// ---- 198 C 순록 둘 다 다시 (?m89 시범; data.js LEGEND198; 192 A's two kept, HOLD192): 183 B's body, legs and antler as they are, only
// their look. 백야 순록: the white night's sky in the antler: milky, half see-through (HORN155C's way: a pale diffuse, lit from inside
// most where we look straight in, the drifts seen again deeper), bright apricot at the root, pink, then lavender toward the tips
// (uHy, uHl: the antler's height in pattern space, the calf's own), a soft light on the tips (_thickness > 0) seen by day. The body a
// warm light cream, snow-lit satin: the back warmed by the low sun, the underside's shade lavender (snow under that sky), the outline
// lit pink low to lavender high (the sky at the edge, strong: what carries it at game distance) with a pink satin sheen, a faint light
// of its own (never grey in the shade); the legs running down a long soft ramp into a pale sunset (peach, then rose at the feet; uLeg:
// the legs' top in pattern space, adult 0.4 / calf 0.21), pale rose-gold metal hooves. The nose a
// darker brown (#4a4034) than the species' #5a4034: beside the cream that one rendered reddish (198c.md)
// 201 B 다듬기 (판정 B 1~4): the antler's outer third lit by day too (tip colour + emissive, halo201 a faint haze round it, no bloom),
// the cream warmer (no white plastic), a faint apricot down the spine, the sunset at the feet a step deeper; hooves and nose as they were
const WN198B = `float lg_ = smoothstep(0.0, 1.0, 1.0 - p.y / uLeg), n_ = fbm3(p * 5.0); // (sRGB about: cream #f1d0aa (198: #f5dfbf), peach #ffa273, rose #ed7995)
  vec3 cr_ = mix(vec3(0.84, 0.58, 0.34), vec3(0.92, 0.68, 0.46), n_), ss_ = mix(vec3(1.0, 0.36, 0.17), vec3(0.85, 0.19, 0.3), smoothstep(0.5, 1.0, lg_)); // 201 B: warmer (was 0.88 0.69 0.46 / 0.94 0.78 0.58), the sunset a step deeper (was 1.0 0.46 0.26 / 0.9 0.3 0.42)
  cr_ = mix(cr_, vec3(0.58, 0.48, 0.95), 0.38 * (1.0 - smoothstep(-0.6, 0.5, on.y))); // snow-light: the flanks' and underside's shade lavender, as snow's under that sky
  cr_ = mix(cr_, vec3(1.0, 0.66, 0.5), 0.3 * smoothstep(0.55, 1.0, on.y)); // and the back warmed by the low sun
  cr_ = mix(cr_, vec3(1.0, 0.45, 0.2), 0.55 * smoothstep(0.45, 0.9, on.y) * (1.0 - smoothstep(0.03, 0.14, abs(p.z))) * (1.0 - smoothstep(uSx - 0.1, uSx, p.x))); // 201 B: a faint apricot down the spine (not on the head: uSx)
  diffuseColor.rgb = mix(cr_, ss_, smoothstep(0.05, 0.85, lg_)); roughnessFactor = 0.42; // a long soft ramp down the legs
  vec3 sk_ = mix(vec3(1.0, 0.5, 0.6), vec3(0.6, 0.45, 1.0), smoothstep(0.45, 1.1, p.y)); // the white night's sky in the satin's edge: pink low, lavender high
  totalEmissiveRadiance += diffuseColor.rgb * 0.05 + sk_ * 1.0 * pow(1.0 - nv, 1.6);`;
const WN198H = `float tip_ = max(vT183, 0.0), oc_ = max(-vT183, 0.0), aa_ = length(fwidth(p)), h_ = clamp((p.y - uHy) / uHl + 0.25 * tip_, 0.0, 1.0);
  float bw_ = max(1.75 * fwidth(h_), 0.026); // 202 C: three bands, a step more saturated; 205 A: edges 3.5 px soft (202: 2 px, fwidth and 0.015) (201: apricot 1 0.45 0.1, pink 1 0.24 0.46, lavender 0.42 0.28 1 in long ramps)
  vec3 g_ = mix(mix(vec3(1.0, 0.5, 0.02), vec3(1.0, 0.1, 0.38), smoothstep(0.33 - bw_, 0.33 + bw_, h_)), vec3(0.34, 0.14, 1.0), smoothstep(0.62 - bw_, 0.62 + bw_, h_)); // gold (the low sun), pink, lavender
  float m_ = mix(fbm3(p * 16.0 - 2.0 + vec3(0.0, uTime * 0.02, 0.0)), 0.47, smoothstep(0.004, 0.012, aa_)); // far off: to the mean (no shimmer)
  vec3 col_ = mix(g_, vec3(1.0, 0.9, 0.95), smoothstep(0.62, 0.85, m_) * 0.12);
  diffuseColor.rgb = col_ * 0.55; roughnessFactor = 0.12;
  totalEmissiveRadiance += col_ * (0.45 + 0.35 * pow(nv, 1.5)) * (1.0 - 0.35 * smoothstep(0.1, 0.6, oc_)) * (0.7 + 0.3 * uNight); // 202 C: by day 0.7 so the bands keep their colour, by night as 201
  vec3 vo_ = normalize(vdir * normalMatrix); float n2_ = mix(fbm3((p + vo_ * 0.05) * 14.0 + 7.0), 0.47, smoothstep(0.004, 0.012, aa_));
  totalEmissiveRadiance += g_ * smoothstep(0.45, 0.75, n2_) * 0.25 * nv + g_ * pow(1.0 - nv, 2.5) * 0.3;
  float tg_ = smoothstep(0.4, 0.8, tip_); vec3 tc_ = mix(vec3(1.0, 0.36, 0.72), vec3(0.62, 0.42, 1.0), smoothstep(0.6, 1.0, h_)); // 201 B: the outer third only, rose to lavender, its core near white: a light by day too
  diffuseColor.rgb = mix(diffuseColor.rgb, tc_, tg_); totalEmissiveRadiance += mix(tc_, vec3(1.0), 0.3 * tg_ * uNight) * tg_ * 2.0 * (0.4 + 0.6 * uNight) * (1.0 + 0.1 * sin(uTime * 1.1 + p.y * 9.0));`; // 205 A: by day the tip light 0.4 and no white in it (the lavender shows), by night as 202
// 차로아이트 순록 (2안): charoite, the violet stone of Sakha (the reindeer herders' land), polished: deep violet to a brighter violet in
// big slow swirls (a warped fbm), fine pale lilac fibres along them (lines ~2 px wide on screen wherever the swirl is flat or steep:
// a band of sin() would spread into pale blots where the fbm flattens), and the stone's silk sheen (chatoyancy): a soft light on the
// fibres that slides as it turns (their phase moves with nv); far off the fibres fade to their mean (no shimmer). The antler the same
// stone with light in it, violet to lilac toward the tips. Black polished hooves (the stone's black needles). Not a night sky: no
// points, no blue; not ice
const CH198 = `vec3 q_ = p * uSc + 1.2 * vec3(fbm3(p * 2.0), fbm3(p * 2.0 + 5.2), fbm3(p * 2.0 + 9.1));
  float sw_ = fbm3(q_), u_ = sw_ * 40.0 + p.y * 25.0, fa_ = smoothstep(0.35, 1.0, fwidth(u_)), fb_ = mix(1.0 - smoothstep(0.0, max(2.0 * fwidth(u_), 1e-4), abs(sin(u_))), 0.06, fa_), ch_ = mix(smoothstep(0.55, 1.0, sin(u_ * 0.5 + 7.0 * nv)), 0.2, fa_);`;
const CH198B = `${CH198}
  vec3 col_ = mix(vec3(0.075, 0.012, 0.21), vec3(0.27, 0.075, 0.6), smoothstep(0.3, 0.72, sw_)); // (linear: sRGB #4d1a7e to #8f4dc9)
  col_ = mix(col_, vec3(0.62, 0.45, 0.9), fb_ * 0.35);
  diffuseColor.rgb = col_; roughnessFactor = 0.2;
  totalEmissiveRadiance += vec3(0.5, 0.3, 1.0) * ch_ * 0.16 * (0.4 + 0.6 * nv) + col_ * 0.05;`;
const CH198H = `${CH198}
  float tip_ = max(vT183, 0.0), oc_ = max(-vT183, 0.0), h_ = clamp((p.y - uHy) / uHl + 0.3 * tip_, 0.0, 1.0);
  vec3 col_ = mix(vec3(0.2, 0.05, 0.48), vec3(0.62, 0.42, 1.0), h_);
  diffuseColor.rgb = col_ * (0.45 + 0.25 * fb_); roughnessFactor = 0.12;
  totalEmissiveRadiance += col_ * (0.12 + 0.34 * pow(nv, 1.5)) * (0.8 + 0.4 * sw_) * (1.0 - 0.4 * smoothstep(0.1, 0.6, oc_)) + vec3(0.5, 0.3, 1.0) * ch_ * 0.14
    + vec3(0.75, 0.6, 1.0) * pow(smoothstep(0.3, 0.9, tip_), 2.0) * 0.4;`;
Object.assign(NIGHT_LOOK, {
  whitenight198: 'totalEmissiveRadiance += uNight * diffuseColor.rgb * 0.16;', // the white night: by night it stays softly light
  whitenight198horn: 1.5, charoite198: 1.0, charoite198horn: 1.6,
});
// 201 B: a very faint light round the antler's outer third (_thickness: the tips 1, 0.5 about a third down the tine), by day too: as
// figure.js haloMat (the mesh blown up along its normals, back faces) but laid over as a pale rose tint (premultiplied: on white snow
// a light only added would not show), by night added on. No bloom. One for the page, made when first worn; dispose198 frees it
let halo201 = null;
const haloOf201 = () => halo201 ??= new THREE.ShaderMaterial({ uniforms: { uNight: nightGlow }, side: THREE.BackSide, transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  vertexShader: `attribute float _thickness; varying vec2 vF; void main() { float t = smoothstep(0.4, 0.8, _thickness); vec4 mv = modelViewMatrix * vec4(position + normal * 0.07 * t, 1.0);
    vF = vec2(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), t); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uNight; varying vec2 vF; void main() { if (vF.y < 0.01) discard; float a = pow(vF.x, 2.5) * vF.y;
    gl_FragColor = vec4(vec3(1.0, 0.5, 0.85) * a * (0.45 + 0.9 * uNight), a * 0.5 * (1.0 - 0.6 * uNight)); }` });
const halo201On = (...hs) => body => { const o = body.children.find(c => hs.includes(c.material)); if (!o) return; const x = new THREE.Mesh(o.geometry, haloOf201()); x.renderOrder = 5; o.add(x); };
const hornAt198 = (key, B, o, u, a, c) => [a, c].map(([y, l]) => vt183(look(phys('#ffffff', o), key, B, { ...u, uHy: y, uHl: l }, { studio: 0.2 }))); // the adult's and the calf's (uHy, uHl)
Object.assign(LOOKS, {
  whitenight198: () => { const mk = (l, x) => { const m = phys('#ffffff', { roughness: 0.42, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color('#f6c6ec') }); m.userData.pale = true; return look(m, 'whitenight198', WN198B, { uLeg: l, uSx: x }); };
    const b = mk(0.4, 0.2), calf = mk(0.21, 0.12), [h, ch] = hornAt198('whitenight198horn', WN198H, { roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.06 }, {}, [0.92, 0.62], [0.9, 0.34]);
    return { body: b, accent: b, calf, hoof: shine('#ffd6bc', 0.3), beak: toyMat('#4a4034'), r183body: b, r183calfbody: calf, r202horn: h, r202calfhorn: ch, // 202 C: its own antler (reindeer202_*), 183 B's left off
      parts: (body, G, S) => { parts183(body, G, S); cub192(b, calf)(body, G, S); halo201On(h, ch)(body); } }; },
  charoite198: () => { const b = look(phys('#ffffff', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }), 'charoite198', CH198B, { uSc: 2.8 }, { studio: 0.15 });
    const [h, ch] = hornAt198('charoite198horn', CH198H, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }, { uSc: 4.0 }, [0.92, 0.62], [0.9, 0.34]);
    return { body: b, accent: b, hoof: phys('#16121c', { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 }), beak: toyMat('#4a4034'), r183body: b, r183calfbody: b, r183horn: h, r183calfhorn: ch, parts: parts183 }; },
});
// 201 B: 겨울 등불 under ?m89 with the reindeer's nose #4a4034 (data.js MODELS.reindeer.m89; the public 'lantern' as it is)
LOOKS.lantern201 = c => ({ ...LOOKS.lantern(c), beak: phys('#4a4034', { roughness: 0.2, clearcoat: 0.6 }) }); // (its own beak never drawn: nothing to free)
// as dispose192: no caller yet (nothing tears the looks down); the 183 leg copies are dispose163's L183
export const dispose198 = () => { for (const [k, s] of cache) if (/^((whitenight|charoite)198|lantern201)\{/.test(k)) { for (const m of new Set(Object.values(s))) m.dispose?.(); cache.delete(k); }
  halo201?.dispose(); halo201 = null; };
