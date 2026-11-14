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
import { SHARED_VARIANTS } from '../game/data.js';
import { SP, RAR, variantOf, colorOf } from '../game/rules.js';

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
  if (!cache.has(k)) { const set = LOOKS[id](colors); for (const m of Object.values(set)) rim(m); cache.set(k, set); }
  return cache.get(k);
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
  totalEmissiveRadiance += mix(deep, light, 0.55 + 0.45 * n) * (0.12 + 0.38 * pow(nv, 1.5)) * (0.9 + 0.1 * sin(uTime * 1.2));`;
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
  jade: () => same(look(phys('#5fb88a', { roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0, sheenColor: new THREE.Color('#d8ffe8') }), 'jade', JADE)),
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
};

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
  const key = S + (lacq ? 'l' : ''); if (texCache[key]) return texCache[key];
  const C = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.lineCap = g.lineJoin = 'round'; return g; });
  const [W, L, V] = C, R = rand(11), u = S / 1024, w = lacq ? u * 0.65 : u; // u: sizes, w: line widths
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
