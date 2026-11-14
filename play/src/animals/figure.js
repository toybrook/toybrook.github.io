// A species' figure in one variant and colour at one stage: the model's baked meshes in the variant's materials, legs
// placed and swung if the model has them, a secret accessory (if the animal has one) at its stage's attach slot,
// a legendary's own item (LEGEND_ITEMS) at its slot, and the variant's effects round it (a legendary's `effect`: FX below).
// Everything is read from MODELS / SPECIES / ACCESSORIES in data.js; nothing here knows a species.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import { MODELS, ACCESSORIES, LEGEND_ITEMS, EV_ACC } from '../game/data.js';
import { SP, variantOf } from '../game/rules.js';
import { toyMat, windTime, nightGlow } from '../habitat/toyKit.js';
import { variantMats, eyeMat, wear, texBody, meshyMat, patched } from './materials.js';
import { calm } from '../config.js';
import { fetched } from '../ui/loadbar.js'; // 26-1: how much of each model file has arrived (the loading bar)

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), url = f => new URL('../../' + f, import.meta.url).href;
// 27-3: the release build's glbs are meshopt-packed with quantized positions (tools/glb-pack.mjs): back to plain floats in
// the model's own space (the node carries the de-quantizing scale), so everything below reads them as the baked files
const floats = (o, g = o.geometry) => {
  for (const [k, a] of Object.entries(g.attributes)) if (a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array)) {
    const f = new Float32Array(a.count * a.itemSize), get = ['getX', 'getY', 'getZ', 'getW'];
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a[get[c]](i);
    g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  if (!o.matrixWorld.equals(new THREE.Matrix4())) g.applyMatrix4(o.matrixWorld);
  return g;
};
export async function meshes(file) {
  const i = fetched.push(0) - 1; let gltf;
  try { gltf = await loader.loadAsync(url(file), e => { if (e.total) fetched[i] = e.loaded / e.total; }); } finally { fetched[i] = 1; }
  const geo = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => { if (o.isMesh) { geo[o.material.name] = floats(o); if (o.material.map) geo[o.material.name].userData.map = o.material.map; } }); // 82: a painted body (Meshy)
  return geo;
}
// _op = pattern space for materials.js: model position / body height, x centred, legs where they stand.
// So a pattern covers every figure the same way however big its body is.
function withOp(geo, H, cx, off = [0, 0, 0], sz = 1) { // sz -1: a mirrored copy
  const p = geo.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { a[i * 3] = (p.getX(i) + off[0] - cx) / H; a[i * 3 + 1] = (p.getY(i) + off[1]) / H; a[i * 3 + 2] = (p.getZ(i) * sz + off[2]) / H; }
  geo.setAttribute('_op', new THREE.BufferAttribute(a, 3));
  return geo;
}

const ready = {}, loading = {}, accGeo = {}, accLoading = {};
// 26-1: a secret accessory is fetched the first time a figure wears it (most players have none for a long while)
// (never fails: offline, the figure goes without it and dress() puts it on once it is fetched later)
// 15-2: event wear (EV_ACC) is a secret accessory's shape (base) in its own colours; geometry is kept by the shape
const gk = k => EV_ACC[k]?.base ?? k, AC = k => ACCESSORIES[k] ?? (EV_ACC[k] && ACCESSORIES[EV_ACC[k].base] && { ...ACCESSORIES[EV_ACC[k].base], ...EV_ACC[k] });
export const loadAcc = k => { const b = gk(k); return ACCESSORIES[b] ? accLoading[b] ??= meshes(ACCESSORIES[b].file).then(g => { accGeo[b] = g; }, () => { delete accLoading[b]; }) : Promise.resolve(); };
// Load a model's stage GLBs once (all its files at the same time); habitats await this for the species they hold.
// 27-2: a failed one (offline) is asked again next time — it stayed failed until a reload, so the habitat never opened once back online
export const loadModel = id => loading[id] ??= (async () => {
  const M = MODELS[id], out = {}, stages = Object.keys(M.files);
  // the legendary items this model's species hold, loaded with it
  const items = [...new Set(Object.values(SP).filter(s => s.model === id).flatMap(s => (s.legendary || []).map(l => l.item)).filter(k => LEGEND_ITEMS[k]))];
  const [itemGeo, geos, legendGeos] = await Promise.all([Promise.all(items.map(async k => [k, await meshes(LEGEND_ITEMS[k].file)])).then(Object.fromEntries), Promise.all(stages.map(st => meshes(M.files[st]))),
    Promise.all(stages.map(st => M.legend?.[st] && meshes(M.legend[st])))]); // 71-2: one legendary's own parts (MODELS legend): the amber rex's bones, crystals
  for (const [i, stage] of stages.entries()) {
    const g = geos[i], S = M[stage];
    g.body.computeBoundingBox(); const b = g.body.boundingBox, H = b.max.y, cx = (b.min.x + b.max.x) / 2; g.body.userData.len = (b.max.x - b.min.x) / H; // 85-3: the amber's tail (materials.js)
    withOp(g.body, H, cx); if (g.accent) withOp(g.accent, H, cx); if (g.beak) withOp(g.beak, H, cx); if (g.horn) withOp(g.horn, H, cx); if (g.nostril) withOp(g.nostril, H, cx);
    for (const k of M.paints || []) if (g[k]) withOp(g[k], H, cx); // more painted colour layers on the body (the penguin's face and ear patches)
    // one leg geometry per leg position (its _op differs)
    g.legs = !S.legs ? [] : S.legs.x.flatMap(x => [S.legs.z, -S.legs.z].map(z => ({ x, z,
      leg: withOp(g.leg.clone(), H, cx, [x, S.legs.hip, z]), hoof: g.hoof && withOp(g.hoof.clone(), H, cx, [x, S.legs.hip, z]),
      bone: legendGeos[i]?.legbone && withOp(legendGeos[i].legbone.clone(), H, cx, [x, S.legs.hip, z]) })));
    g.legend = Object.fromEntries(Object.entries(legendGeos[i] || {}).filter(([k]) => k !== 'legbone').map(([k, geo]) => [k, withOp(geo, H, cx)]));
    // a bird's wings: their own parts, pivot at the shoulder (so a short flight can flap them); the -z one mirrors the +z one
    const at = k => [S.wing[0], S.wing[1], S.wing[2] * k];
    g.wings = !S.wing ? [] : [1, -1].map(k => ({ k, geo: withOp(g.wing.clone(), H, cx, at(k), k), spot: g.wingSpot && withOp(g.wingSpot.clone(), H, cx, at(k), k) })); // spot: the accent on it (the snowy owl's)
    // items: moved to their slot here, so their pattern space runs on from the body's (the otter's paws in its look)
    g.items = {};
    for (const k of items) {
      const sl = S.attach?.[LEGEND_ITEMS[k].slot]; if (!sl) continue;
      const mx = new THREE.Matrix4().compose(new THREE.Vector3(...sl.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...sl.r)), new THREE.Vector3().setScalar(sl.s));
      g.items[k] = Object.fromEntries(Object.entries(itemGeo[k]).map(([n, geo]) => [n, withOp(geo.clone().applyMatrix4(mx), H, cx)]));
    }
    out[stage] = g;
  }
  ready[id] = out;
})().catch(e => { delete loading[id]; throw e; });

const accMats = {};
const accMat = (id, name, c = AC(id).colors[name] || '#ffffff') => (accMats[id + name] ??= !AC(id).glow?.includes(name) ? toyMat(c, { roughness: 0.5 })
  : Object.assign(toyMat(c, { roughness: 0.5, emissive: c, emissiveIntensity: 0.55 }), { onBeforeCompile: sh => { // `glow`: lit by night only (as props.js lit)
    sh.uniforms.uNight = nightGlow; sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight;'); } }));

// Effects round a legendary (its `effect`), sized in world units so they still read at home distance; windTime moves
// them (still in a thumbnail). motes: gold star motes (duck, horse); moondust: silver dust drifting (rabbit);
// coins: a few round coins with a square hole, turning slowly, now and then one glints (pig); sparks: sunset-coloured
// sparks rising (chicken); puffs: little pastel clouds drifting (sheep); twinkle: a few small stars in opal fire colours
// (cow). Pond: bubbles rising (turtle), silver fireflies (otter), snowflakes falling (swan), pink petals turning
// (flamingo), steam rising and yuzus bobbing (capybara). inbox 10: few and slow. sp: speed (1 = the first five's);
// rise / fall: they climb / sink through the body's height, fading in and out.
const FX = {
  motes: { n: 16, size: 0.6, frag: `float star = max(1.0 - smoothstep(0.0, 0.18, d.y) - d.x, 1.0 - smoothstep(0.0, 0.18, d.x) - d.y), core = 1.0 - smoothstep(0.0, 0.35, length(d));
      float a = clamp(max(star, core), 0.0, 1.0) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vec3(1.0, 0.82, 0.35), vec3(1.0, 1.0, 0.95), core), a);` },
  moondust: { n: 40, size: 0.42, frag: `float r = length(d), core = 1.0 - smoothstep(0.0, 0.3, r), a = min(1.0, (pow(max(0.0, 1.0 - r), 2.0) * 0.8 + core) * vA); if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vec3(0.72, 0.82, 1.0), vec3(1.0), core), a);` },
  coins: { n: 4, size: 0.6, solid: true, sp: 0.5, frag: `float w = abs(cos(vT * 1.4)), ww = max(w, 0.12); vec2 q = d / 0.7, ad = abs(d); float r = length(vec2(q.x / ww, q.y));
      bool coin = r <= 1.0 && max(abs(q.x) / ww, abs(q.y)) >= 0.3;
      float g = pow(max(0.0, sin(vT * 0.8 + vS * 17.0)), 60.0), star = g * clamp(max(1.0 - smoothstep(0.0, 0.07, ad.y) - ad.x, 1.0 - smoothstep(0.0, 0.07, ad.x) - ad.y), 0.0, 1.0);
      if (!coin && star < 0.04) discard;
      vec3 c = mix(vec3(0.78, 0.5, 0.1), vec3(1.0, 0.84, 0.38), smoothstep(0.95, 0.7, r) * (0.55 + 0.45 * w)) + vec3(1.0, 0.95, 0.8) * pow(w, 24.0) * 0.4;
      gl_FragColor = coin ? vec4(c + star * 1.5, 1.0) : vec4(1.0, 0.96, 0.82, star);` },
  sparks: { n: 18, size: 0.38, rise: true, frag: `float r = length(d), core = 1.0 - smoothstep(0.0, 0.35, r), a = min(1.0, (pow(max(0.0, 1.0 - r), 1.5) + core) * vA); if (a < 0.01) discard;
      vec3 c = vS < 0.34 ? vec3(1.0, 0.55, 0.18) : vS < 0.67 ? vec3(1.0, 0.42, 0.62) : vec3(0.72, 0.42, 1.0);
      gl_FragColor = vec4(mix(c, vec3(1.0, 0.95, 0.85), core * 0.6), a);` },
  puffs: { n: 12, size: 0.6, soft: true, frag: `float r = min(min(length(d - vec2(-0.36, 0.1)) / 0.42, length(d - vec2(0.36, 0.12)) / 0.42), min(length(d - vec2(0.0, -0.06)) / 0.56, length(vec2(d.x * 0.6, d.y + 0.24)) / 0.42));
      float a = (1.0 - smoothstep(0.75, 1.0, r)) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vS < 0.5 ? vec3(1.0, 0.8, 0.9) : vec3(0.8, 0.9, 1.0), vec3(1.0), smoothstep(1.0, 0.2, r) * 0.6), a * 0.9);` },
  twinkle: { n: 6, size: 0.5, sp: 0.6, frag: `float r = length(d), star = max(1.0 - smoothstep(0.0, 0.12, d.y) - d.x, 1.0 - smoothstep(0.0, 0.12, d.x) - d.y), core = 1.0 - smoothstep(0.0, 0.25, r);
      float a = clamp(max(star, core), 0.0, 1.0) * vA * vA; if (a < 0.01) discard;
      vec3 c = vS < 0.34 ? vec3(0.45, 0.75, 1.0) : vS < 0.67 ? vec3(0.5, 1.0, 0.7) : vec3(1.0, 0.72, 0.45);
      gl_FragColor = vec4(mix(c, vec3(1.0), core * 0.7), a);` },
  bubbles: { n: 8, size: 0.36, rise: true, soft: true, sp: 0.6, frag: `float r = length(d); if (r > 1.0) discard;
      float a = (smoothstep(0.55, 0.95, r) * 0.65 + 0.12 + (1.0 - smoothstep(0.0, 0.24, length(d - vec2(-0.35, -0.35)))) * 0.9) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vec3(0.72, 0.9, 1.0), vec3(1.0), smoothstep(0.7, 0.0, length(d - vec2(-0.35, -0.35)))), min(a, 1.0));` },
  fireflies: { n: 6, size: 0.42, sp: 0.5, frag: `float r = length(d), core = 1.0 - smoothstep(0.0, 0.18, r), a = (pow(max(0.0, 1.0 - r), 3.0) * 0.7 + core) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vec3(0.7, 0.8, 1.0), vec3(1.0), core), min(a, 1.0));` },
  snow: { n: 8, size: 0.44, fall: true, soft: true, sp: 0.6, frag: `float an = atan(d.y, d.x) + vT * 0.3, r = length(d), arm = abs(sin(3.0 * an)) * r;
      float f = max((1.0 - smoothstep(0.05, 0.11, arm)) * (1.0 - smoothstep(0.7, 0.9, r)), 1.0 - smoothstep(0.12, 0.22, r));
      float br = (1.0 - smoothstep(0.04, 0.09, abs(r - 0.5))) * (1.0 - smoothstep(0.1, 0.3, arm)); // a cross bar on each arm
      float a = clamp(max(f, br * 0.8), 0.0, 1.0) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vec3(0.8, 0.9, 1.0), vec3(1.0), f), a * 0.95);` },
  petals: { n: 6, size: 0.38, solid: true, frag: `float w = abs(cos(vT * 1.2)); vec2 q = vec2(d.x / max(w, 0.15), d.y);
      float r = length(vec2(q.x / (0.62 - 0.22 * q.y), (q.y + 0.05) / 0.9)); if (r > 1.0) discard;
      gl_FragColor = vec4(mix(vec3(0.93, 0.5, 0.6), vec3(1.0, 0.86, 0.86), smoothstep(1.0, 0.2, r) * (0.5 + 0.5 * w)), 1.0);` },
  steam: { n: 5, size: 0.7, rise: true, soft: true, sp: 0.6, frag: `float r = length(d), a = (1.0 - smoothstep(0.15, 1.0, r)) * (0.8 + 0.2 * sin(d.x * 6.0 + vT)) * vA * 0.5; if (a < 0.01) discard;
      gl_FragColor = vec4(1.0, 0.98, 0.95, a);` },
  yuzus: { n: 3, size: 0.4, solid: true, sp: 0.5, frag: `float r = length(d - vec2(0.0, -0.08)) / 0.78, leaf = length(vec2((d.x - 0.22) / 0.3, (d.y - 0.72) / 0.13));
      if (r > 1.0 && leaf > 1.0) discard;
      gl_FragColor = vec4(r <= 1.0 ? mix(vec3(0.93, 0.62, 0.08), vec3(1.0, 0.86, 0.3), smoothstep(1.0, 0.2, length(d - vec2(-0.25, 0.15)) / 0.8)) : vec3(0.35, 0.62, 0.2), 1.0);` },
};
const fxMats = {};
const fxMat = kind => fxMats[kind] ??= new THREE.ShaderMaterial({
  uniforms: { uTime: windTime, uPx: { value: 800 } }, transparent: true, depthWrite: FX[kind].solid || false, blending: FX[kind].solid || FX[kind].soft ? THREE.NormalBlending : THREE.AdditiveBlending,
  vertexShader: `uniform float uTime, uPx; attribute float seed; varying float vA, vS, vT;
    void main() { float T = uTime * ${(FX[kind].sp || 1).toFixed(2)}, t = T * (0.5 + 0.4 * seed) + seed * 40.0;
      vec3 p = position + vec3(0.1 * sin(t * 1.3), 0.16 * sin(t), 0.1 * cos(t * 1.1));
      ${FX[kind].rise ? 'float k = fract(T * 0.2 + seed * 7.3); p.y += k * 1.0 - 0.35; vA = sin(k * 3.1416);'
        : FX[kind].fall ? 'float k = fract(T * 0.2 + seed * 7.3); p.y += 0.75 - k * 1.2; vA = sin(k * 3.1416);' : 'vA = smoothstep(-0.2, 1.0, sin(t * 2.3 + seed * 9.0));'}
      vS = seed; vT = t; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = ${FX[kind].size} * projectionMatrix[1][1] * uPx / -mv.z; }`,
  fragmentShader: `varying float vA, vS, vT; void main() { vec2 d = abs(gl_PointCoord - 0.5) * 2.0;
      ${FX[kind].solid || FX[kind].soft ? 'd = (gl_PointCoord - 0.5) * 2.0;' : ''}${FX[kind].frag} }`,
});
function effect(kind, box) {
  const n = FX[kind].n, c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.62), pos = [], seed = [];
  for (let i = 0; i < n; i++) { // even round the body, seeded so every legendary looks the same
    const a = i / n * Math.PI * 2 + 0.4, y = ((i * 5) % n) / n - 0.35;
    pos.push(c.x + Math.cos(a) * h.x, c.y + y * h.y * 1.4, c.z + Math.sin(a) * h.z * 1.3); seed.push(i / n);
  }
  const g = new THREE.BufferGeometry(), m = fxMat(kind);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const pts = new THREE.Points(g, m); pts.renderOrder = 5; pts.frustumCulled = false;
  pts.onBeforeRender = r => { m.uniforms.uPx.value = r.getDrawingBufferSize(px).y * 0.5; };
  return pts;
}
const px = new THREE.Vector2();

// a look's `halo` (야광): a soft glow round the outline. The mesh again, blown up along its normals, back faces only,
// added on and fading out toward its edge (the part behind the body is hidden by it).
const haloMats = {};
const haloMat = (hex, w = 0.16) => haloMats[hex + w] ??= new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(hex) }, uNight: nightGlow }, side: THREE.BackSide, transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, // adds light, leaves alpha (see-through canvases stay see-through)
  vertexShader: `varying float vF; void main() { vec4 mv = modelViewMatrix * vec4(position + normal * ${w.toFixed(3)}, 1.0);
    vF = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uNight; varying float vF; void main() { gl_FragColor = vec4(uColor * pow(vF, 1.6) * 0.9 * (1.0 + uNight * 0.8), 1.0); }`, // 21-1: brighter at night
});

// 26-9: one draw per material instead of one per part. The parts that share a material and draw order become one
// SkinnedMesh whose bones are the body, the legs and the wings (rigid: each vertex follows one), so pose() moves them as
// before. Left as they were: glass (it copies the screen and casts its view ray per mesh), parts with a glow child, the
// accessory, effects, and a model's legs that fold (oneLeg: a squashed bone would shade its normals wrong).
// ponytail: a figure thrown away without dress() (codex, cabinet) keeps its 1 KB bone texture until the renderer goes.
const mergedGeo = new Map(), glassy = m => m.customProgramCacheKey().startsWith('clear-');
function merge(body, joints) {
  const bones = [body, ...joints], sets = new Map();
  for (const [b, bone] of bones.entries()) for (const o of bone.children) {
    if (!o.isMesh || o.children.length || glassy(o.material)) continue;
    const k = o.material.uuid + '/' + o.renderOrder; if (!sets.has(k)) sets.set(k, []); sets.get(k).push([o, b]);
  }
  let sk = null;
  for (const parts of sets.values()) {
    if (parts.length < 2) continue;
    const key = parts.map(([o, b]) => o.geometry.uuid + b).join();
    let geo = mergedGeo.get(key);
    if (!geo) {
      geo = mergeGeometries(parts.map(([o, b]) => {
        const g = o.geometry.clone(), j = bones[b], n = g.attributes.position.count;
        if (b) g.translate(j.position.x, j.position.y, j.position.z);
        if (j.scale.z < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; } // the mirrored wing: its bone mirrors it, so it winds the other way
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => i % 4 ? 0 : b), 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 ? 0 : 1), 4));
        return g;
      }));
      if (!geo) continue; // parts that do not share attributes stay apart
      mergedGeo.set(key, geo);
    }
    sk ??= new THREE.Skeleton(bones, bones.map((j, i) => i ? new THREE.Matrix4().makeTranslation(-j.position.x, -j.position.y, -j.position.z) : new THREE.Matrix4()));
    const [o0] = parts[0], sm = new THREE.SkinnedMesh(geo, o0.material);
    sm.renderOrder = o0.renderOrder; sm.onBeforeRender = o0.onBeforeRender; sm.receiveShadow = true;
    sm.bind(sk, new THREE.Matrix4());
    // The parts stay where they were, hidden (userData.stand): Box3.setFromObject (the thumbnails, codex, cabinet, growth framing)
    // and a tap's raycast (it does not look at visible) find them posed as before. So the merged one gives Box3 a point inside
    // the body (and a ray nothing), and culls by the sphere round the parts (its own would read the bones before their first update)
    const box = new THREE.Box3(), m = new THREE.Matrix4();
    for (const [o, b] of parts) { o.updateMatrix(); bones[b].updateMatrix(); o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(b ? m.multiplyMatrices(bones[b].matrix, o.matrix) : o.matrix)); o.visible = false; o.userData.stand = true; }
    sm.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); sm.boundingBox = new THREE.Box3(sm.boundingSphere.center.clone(), sm.boundingSphere.center.clone());
    body.add(sm);
  }
  return sk;
}

// Needs loadModel(model) to have finished. stage: one of the model's `files` keys ('baby' | 'adult'). acc: a secret accessory id, or none.
// color: one of the variant's colour ids (none = its first).
export function makeFigure(spId, vId, stage, acc = null, color = null) {
  const sp = SP[spId], M = MODELS[sp.model], S = M[stage], G = ready[sp.model][stage], map = G.body.userData.map, m = variantMats(spId, vId, color, map && M.meshy, G.body.userData.len);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  body.scale.setScalar(S.s); body.position.y = -(S.sink || 0);
  const V = variantOf(spId, vId), skin = !map ? m.body : V?.rarity === 'common' ? (M.patches ? patched(map, m) : texBody(map)) : meshyMat(m.body); // 82: a common wears the body's own texture (86-1: recoloured); 84: another look, a clone without the dotted edge
  const mesh = (geo, mat, ord) => { const o = wear(new THREE.Mesh(geo, mat), ord); o.receiveShadow = true; // tree and barn shade land on it
    if (m.halo && (mat === m.body || mat === skin)) { const h = new THREE.Mesh(geo, haloMat(m.halo)); h.renderOrder = 5; o.add(h); }
    return o; };
  const eyes = mesh(G.eye, eyeMat, 4); body.add(mesh(G.body, skin), eyes); // eyes after glass: not doubled in its screen copy (alone in their material: merge leaves them)
  if (m.wall) body.add(mesh(G.body, m.wall)); if (m.noEye) eyes.visible = false; // 84 amber: its glowing far wall; no bead (the skull's socket)
  if (G.accent) body.add(mesh(G.accent, m.accent)); // none on an all-one-colour body (swan, flamingo)
  if (G.beak) body.add(mesh(G.beak, m.beak || m.hoof)); // a bird's beak (the hoof colour, like its feet), a pig's nostrils, a cow's nose (colors.beak)
  if (G.horn) body.add(mesh(G.horn, m.horn || m.body)); // a cow's horns (colors.horn)
  if (G.nostril) body.add(mesh(G.nostril, m.nostril || m.hoof)); // a cow's nostrils (in its nose mesh); the penguin's dark upper beak (colors.nostril)
  for (const k of M.paints || []) if (G[k]) body.add(mesh(G[k], m[k] || m.body)); // colors.paint[k]
  for (const [k, geo] of Object.entries(G.legend)) if (m[k]) body.add(mesh(geo, m[k])); // 71-2 MODELS legend, on the look that has a material for it (bone, gem)
  const wings = G.wings.map(({ k, geo, spot }) => { const w = new THREE.Group(); w.position.set(S.wing[0], S.wing[1], S.wing[2] * k); w.scale.z = k; w.add(mesh(geo, m.wing || m.body)); if (spot) w.add(mesh(spot, m.accent)); body.add(w); return w; });
  const legs = G.legs.map(({ x, z, leg, hoof, bone }) => {
    const g = new THREE.Group(); g.position.set(x, S.legs.hip, z); g.add(mesh(leg, m[M.legMat] || m.body)); if (hoof) g.add(mesh(hoof, m.hoof)); if (bone && m.bone) g.add(mesh(bone, m.bone));
    g.userData = { front: x > 0, pair: (x > 0) === (z > 0) }; // diagonal pairs move together at a walk
    body.add(g); return g;
  });
  for (const fx of [].concat(V?.effect || [])) if (FX[fx]) body.add(effect(fx, G.body.boundingBox));
  // acc: one id or a list (15-2: event wear first, then the secret one); one per slot, the first there wins
  const on = [], taken = new Set();
  for (const k of [].concat(acc || [])) { const A = AC(k); if (!A) continue; if (!accGeo[gk(k)]) { loadAcc(k); continue; } // not here yet: dress() puts it on when it is
    const at = S.attach?.[A.slot]; if (!at || taken.has(A.slot) || taken.has(A.also)) continue; taken.add(A.slot); if (A.also) taken.add(A.also); on.push([k, at]); }
  if (G.items[V?.item] && !taken.has(LEGEND_ITEMS[V.item].slot)) // the item in the look's materials (`item`; none = its body), unless a secret accessory has the slot
    for (const [name, geo] of Object.entries(G.items[V.item])) {
      const o = mesh(geo, m.item?.[name] || m.body, 3); body.add(o);
      if (name === 'body' && m.item?.halo) { const h = new THREE.Mesh(geo, haloMat(m.item.halo, 0.05)); h.renderOrder = 5; o.add(h); } // a glow round it
    }
  for (const [acc, at] of on) { // the accessory keeps its own colours, whatever the variant; a baby's slot is sized for a baby
    const f = sp.fit?.[gk(acc)] || {}, fit = { ...f, ...f[stage] }, a = new THREE.Group(); // data.js fit
    for (const [name, geo] of Object.entries(accGeo[gk(acc)])) a.add(mesh(geo, accMat(acc, name), 3));
    a.position.fromArray(at.p).add(new THREE.Vector3().fromArray(fit.p || [0, 0, 0]));
    a.rotation.fromArray(fit.r || at.r); a.scale.setScalar(at.s * (fit.s || 1));
    body.add(a);
  }
  const skeleton = merge(body, [...(M.walk?.oneLeg ? [] : legs), ...wings]);
  const down = Math.max(0, belly(G.body) * S.s - (S.sink || 0)); // inbox 35: lying down, the belly comes down to the feet's level
  return {
    obj: root, skeleton, under: () => underOf(G.body, S, down),
    // p: { sq (squash), rot (nose up +), gait: 'walk' | 'hop' | 'jump' | 'slide' | 'still', ph (cycles), tuck, lie (0..1: down on its belly, legs folded forward), shut (eyes closed) }
    pose(p) {
      const lie = p.lie || 0; body.position.y = -(S.sink || 0) - lie * down; eyes.geometry = p.shut ? shutEye(G.eye) : G.eye;
      body.scale.set(S.s * (2 - p.sq), S.s * p.sq, S.s * (2 - p.sq)); body.rotation.z = p.rot;
      const s = Math.sin(p.ph * Math.PI * 2), up = Math.sin((p.ph % 1) * Math.PI);
      // inbox 10: a waddle (M.waddle degrees; the penguin): the body rocks onto the standing foot, short steps, the flipper tips held out
      const wd = M.waddle && p.gait === 'walk' ? M.waddle * Math.PI / 180 : 0;
      if (M.waddle) { body.rotation.x = -wd * s; for (const w of wings) w.rotation.x = wd ? -w.scale.z * (0.16 + 0.1 * Math.abs(s)) : 0; }
      for (const leg of legs) {
        const { front, pair } = leg.userData;
        let a = 0;
        if (p.gait === 'walk') a = (pair ? 1 : -1) * s * (wd ? 0.2 : 0.38);
        else if (p.gait === 'hop') a = (front ? 1 : -1) * up * 0.55; // reach out in the air, under the body on the ground
        else if (p.gait === 'jump') a = (front ? 1 : -1) * up * 0.75;
        const k = p.tuck && leg.position.z > 0 ? p.tuck : 0; // tuck (0..1): this leg folds up under the body (the flamingo on one leg)
        leg.scale.set(1 - 0.9 * lie, (1 - 0.65 * k) * (1 - 0.95 * lie), 1 - 0.9 * lie); leg.rotation.z = (p.gait === 'slide' ? 0 : a - p.rot - 0.5 * k) * (1 - lie) + lie * (front ? 1.3 : 1.5); // legs stay upright when the body tips (grazing); 25-1 sliding on its belly they trail behind
      }
    },
  };
}

// inbox 36: the body's lowest point in its middle half (front to back): a low tail or chin does not hold the belly up
const bellies = new WeakMap();
function belly(geo) {
  if (!bellies.has(geo)) { geo.boundingBox ?? geo.computeBoundingBox(); const b = geo.boundingBox, a = geo.attributes.position, m = (b.min.x + b.max.x) / 2, h = (b.max.x - b.min.x) / 4;
    let y = Infinity; for (let i = 0; i < a.count; i++) if (Math.abs(a.getX(i) - m) < h) y = Math.min(y, a.getY(i)); bellies.set(geo, y); }
  return bellies.get(geo);
}
// inbox 36: its body's underside lying down (lie 1, sq 0.95), in its root's frame (x front, z side; world units): the lowest
// point within about 0.2 of (u, v), Infinity past it. The hammock's cloth follows it (play.js give)
const unders = new WeakMap();
function underOf(geo, S, down) {
  if (!unders.has(geo)) {
    const b = geo.boundingBox, a = geo.attributes.position, sx = S.s * 1.05, y0 = -(S.sink || 0) - down, d = 0.08, x0 = b.min.x * sx, z0 = b.min.z * sx;
    const nx = Math.ceil((b.max.x - b.min.x) * sx / d) + 1, nz = Math.ceil((b.max.z - b.min.z) * sx / d) + 1, h = new Float32Array(nx * nz).fill(Infinity);
    for (let i = 0; i < a.count; i++) { const c = Math.floor((a.getX(i) * sx - x0) / d) * nz + Math.floor((a.getZ(i) * sx - z0) / d); h[c] = Math.min(h[c], y0 + a.getY(i) * S.s * 0.95); }
    unders.set(geo, (u, v) => { const i = Math.floor((u - x0) / d), j = Math.floor((v - z0) / d); let y = Infinity;
      for (let p = Math.max(0, i - 2); p <= Math.min(nx - 1, i + 2); p++) for (let q = Math.max(0, j - 2); q <= Math.min(nz - 1, j + 2); q++) y = Math.min(y, h[p * nz + q]);
      return y; });
  }
  return unders.get(geo);
}
// inbox 35: closed eyes: each bead squashed flat about its own middle (the eyes geometry holds both, one each side of z 0)
const shut = new WeakMap();
function shutEye(geo) {
  if (shut.has(geo)) return shut.get(geo);
  const g = geo.clone(), p = g.attributes.position, c = { 1: [0, 0], [-1]: [0, 0] };
  for (let i = 0; i < p.count; i++) { const k = c[p.getZ(i) < 0 ? -1 : 1]; k[0] += p.getY(i); k[1]++; }
  for (let i = 0; i < p.count; i++) { const [y, n] = c[p.getZ(i) < 0 ? -1 : 1], m = y / n; p.setY(i, m + (p.getY(i) - m) * 0.18); }
  g.computeVertexNormals(); shut.set(geo, g); return g;
}
const backOut = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2, smooth = k => k * k * (3 - 2 * k);
// growing up's light: a soft spark (glow and a small cross), drawn over the figure
let sparkTex = null;
const spark = () => sparkTex ??= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,253,236,1)'); gr.addColorStop(0.28, 'rgba(255,241,196,.7)'); gr.addColorStop(1, 'rgba(255,232,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,246,.85)'; g.fillRect(31, 7, 2, 50); g.fillRect(7, 31, 50, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const sprite = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark(), transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 20; return s; };
const tall = o => { const p = o.parent; p?.remove(o); const h = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y; p?.add(o); return h || 1; };
const GLINT = 0.45, GROW = 1.5; // s: sparkles first, then the growing
// The figure an animal record wears. Follows rec.stage. Growing up (inbox 14): a few sparkles, then over GROW seconds
// its height goes smoothly from the baby's to the adult's; halfway the shape swaps to the adult under a small burst of light.
export function dress(rec) {
  const obj = new THREE.Group(); let fig, stage, grow = -1, pop = -1, fx = null;
  // 26-10: the arctic fox's tail curls round one side only; every other one (odd id) is its mirror image, so in a habitat some
  // show the tail on the left (z is the figure's left-right). 85: the baby too, the same Meshy body: it grows up facing the same way
  const accs = () => [...rec.wear || [], rec.acc].filter(Boolean), key = () => accs().map(k => k + (accGeo[gk(k)] ? '' : '?')).join();
  const make = s => { const f = makeFigure(rec.species, rec.variant, s, accs(), rec.color); if (rec.species === 'arcticFox' && rec.id % 2) f.obj.scale.z = -1; return f; };
  let worn; const set = s => { if (fig) { obj.remove(fig.obj); fig.skeleton?.dispose(); } stage = s; worn = key(); fig = make(s); obj.add(fig.obj); };
  set(rec.stage);
  function start() { // heights of both shapes; the sparkles round the baby, the burst at its middle
    const hb = tall(fig.obj), next = make(rec.stage), ha = tall(next.obj);
    const g = new THREE.Group(), sparks = Array.from({ length: 6 }, (_, i) => { const s = sprite(), a = i / 6 * Math.PI * 2 + Math.random() * 0.6;
      s.userData = { x: Math.cos(a) * ha * 0.42, z: Math.sin(a) * ha * 0.42, y: ha * (0.25 + 0.6 * Math.random()), d: Math.random() * 0.25 }; g.add(s); return s; });
    const burst = sprite(); g.add(burst); obj.add(g);
    fx = { g, sparks, burst, hb, ha, next }; grow = 0; pop = -1;
  }
  return {
    obj, get fig() { return fig; }, get stage() { return stage; },
    appear() { pop = 0; obj.scale.setScalar(0.01); }, // out of the egg
    update(dt) {
      if (grow < 0 && key() !== worn) set(stage); // 26-1: an accessory came after it; 15-2: wear put on or taken off
      if (rec.stage !== stage && grow < 0) start();
      if (grow >= 0) {
        grow += dt; const { g, sparks, burst, hb, ha, next } = fx, k = Math.min(1, Math.max(0, (grow - GLINT) / GROW)), h = hb + (ha - hb) * smooth(k);
        if (k >= 0.5 && stage !== rec.stage) { obj.remove(fig.obj); fig.skeleton?.dispose(); fig = next; stage = rec.stage; obj.add(fig.obj); }
        const sc = h / (stage === rec.stage && fig === next ? ha : hb); obj.scale.setScalar(sc); g.scale.setScalar(1 / sc);
        for (const s of sparks) { const u = s.userData, t = Math.max(0, grow - u.d), on = Math.min(1, t / 0.15) * (1 - Math.min(1, Math.max(0, (grow - GLINT - 0.4) / 0.5)));
          s.position.set(u.x, u.y + t * ha * 0.12, u.z); s.scale.setScalar(ha * 0.16 * (0.7 + 0.3 * Math.sin(t * 18 + u.x))); s.material.opacity = on; }
        const b = Math.max(0, 1 - Math.abs(k - 0.5) / 0.2); // the burst: up and gone round the swap
        burst.position.set(0, h * 0.5, 0); burst.scale.setScalar(ha * (0.6 + (calm() ? 0.2 : 0.9) * b)); burst.material.opacity = smooth(b) * (calm() ? 0.35 : 1); // 26-3 움직임 줄이기: a small soft one
        if (grow >= GLINT + GROW) { obj.remove(g); for (const s of g.children) s.material.dispose(); fx = null; grow = -1; obj.scale.setScalar(1); }
      } else if (pop >= 0) { pop += dt; const k = Math.min(1, pop / 0.35); obj.scale.setScalar(Math.max(0.01, backOut(k))); if (k >= 1) pop = -1; }
    },
  };
}
