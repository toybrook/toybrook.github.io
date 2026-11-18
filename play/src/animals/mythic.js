// 14-1 신수: the 불갈기 천리마's figure (data.js MYTHIC, baked by tools/bake-mythic.mjs). Not a SPECIES, so not figure.js's
// makeFigure: one model, its own materials (matte vinyl coat, gold harness, a 단청 saddle cloth) and its fire, a translucent
// resin in three layers (white core, yellow, orange outside: a fresnel ramp), embers and, at night, a warm pool of light.
// Rearing pivots the body on the hind hips (hinge); the front legs paw, the mane flares (inbox 66-0: A, no wings, for good).
import * as THREE from 'three';
import { MYTHIC, sized, M89 } from '../game/data.js';
import { meshes } from './figure.js';
import { toyMat, windTime } from '../habitat/toyKit.js';
import { eyeMat } from './materials.js';
import { calm } from '../config.js';

const M = MYTHIC[0].model;
export const MS = sized('firemane', 'adult', M); // s, r, seg in world units (crowd.js), legs in model units
let G = null, loading = null;
export const loadMyth = () => loading ??= meshes(M89 ? FILE157 : M.file).then(g => { G = g; }); // 157 C: ?m89 the new look's file

const fireMat = (core, mid, rim, a0 = 0.96, a1 = 0.72) => new THREE.ShaderMaterial({
  uniforms: { uT: windTime, uW: { value: 1 }, uF: { value: 0 }, uN: { value: 0 }, uA: { value: new THREE.Color(rim) }, uB: { value: new THREE.Color(mid) }, uC: { value: new THREE.Color(core) } },
  vertexShader: `uniform float uT, uW, uF; varying vec3 vN, vV;
    void main() { vec3 p = position + normal * (uW * 0.014 * sin(uT * 6.0 + position.y * 11.0 + position.x * 7.0) + uF * 0.06);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uA, uB, uC; uniform float uN; varying vec3 vN, vV;
    void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      vec3 c = mix(mix(uC, uB, smoothstep(0.0, 0.28, f)), uA, smoothstep(0.3, 0.72, f));
      gl_FragColor = vec4(c * (0.92 + 0.25 * uN), mix(${a0.toFixed(2)}, ${a1.toFixed(2)}, f));
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false, // not tone-mapped: ACES would wash the resin's oranges out to cream
});
export const dot = (c0, c1) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, c0); r.addColorStop(1, c1); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// obj stands at its hooves; pose(p) as figure.js's ({ gait 'still' | 'walk' | 'trot' | 'run', ph, lie, rear, flare });
// tick(night 0..1) each frame
export function makeMyth() {
  if (M89) return make157();
  const s = MS.s, L = M.legs, root = new THREE.Group(), body = new THREE.Group(), hinge = new THREE.Group(), inner = new THREE.Group();
  body.scale.setScalar(s); root.add(body); hinge.position.set(L.x[1], L.hip, 0); inner.position.set(-L.x[1], -L.hip, 0); hinge.add(inner); body.add(hinge);
  const coat = toyMat('#c24a33', { emissive: '#ff6a3a', emissiveIntensity: 0 }), gold = new THREE.MeshStandardMaterial({ color: '#e2a93c', metalness: 0.5, roughness: 0.4 });
  const red = toyMat('#c8372a'), mat = { body: coat, leg: coat, accent: gold, gold, eye: eyeMat, cloth: toyMat('#2f7d6d'), border: red, tassel: red, cream: toyMat('#f3e6c6'), hoof: toyMat('#4a2c22') };
  const fire = fireMat('#fff2c0', '#ffb30f', '#ff4f0c', 0.93, 0.8), gem = fireMat('#ffd2c2', '#f0352a', '#9e0c1c', 0.97, 0.9);
  const mesh = (k, m = mat[k]) => { const o = new THREE.Mesh(G[k], m); if (m.transparent) o.renderOrder = 3; else { o.castShadow = o.receiveShadow = true; } return o; };
  for (const k of ['body', 'accent', 'eye', 'cloth', 'tassel', 'border', 'gold', 'cream']) inner.add(mesh(k));
  inner.add(mesh('fire', fire), mesh('gem', gem));
  const legs = [L.x[0], L.x[1]].flatMap(x => [L.z, -L.z].map(z => { const g = new THREE.Group(); g.position.set(x, L.hip, z); g.add(mesh('leg'), mesh('hoof'), mesh('hooffire', fire));
    g.userData = { front: x > 0, pair: (x > 0) === (z > 0) }; (x > 0 ? inner : body).add(g); return g; }));
  // embers: rise off the mane and back, fade out (fewer when motion is calmed)
  const N = calm() ? 8 : 24, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = Array.from({ length: N }, (_, i) => [Math.random(), -1.2 + 1.9 * Math.random(), (Math.random() - 0.5) * 0.5, 2 + Math.random() * 1.6]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const embers = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.36, map: dot('rgba(255,236,190,1)', 'rgba(255,120,40,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; embers.renderOrder = 4; inner.add(embers);
  // night: a warm pool of light on the ground round it (additive, no real light: no shader cost on the rest of the board)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: dot('rgba(255,190,110,1)', 'rgba(255,150,70,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.renderOrder = 1; root.add(pool);
  const bodyMin = 0.7; // the belly's lowest point in model units (bake print): lying down brings it near the ground
  let night = 0;
  return {
    obj: root, embers, pool,
    pose(p) {
      const lie = p.lie || 0, rear = p.rear || 0, ph = p.ph || 0, sn = Math.sin(ph * Math.PI * 2), run = p.gait === 'run', trot = p.gait === 'trot' || p.gait === 'walk';
      body.position.y = -lie * (bodyMin - 0.12) * s + (run || trot ? Math.abs(sn) * (run ? 0.09 : 0.05) * s : 0);
      body.rotation.z = (p.rot || 0) + (run ? 0.05 * Math.sin(ph * Math.PI * 2 + 1) : 0);
      hinge.rotation.z = rear * 0.75;
      for (const leg of legs) {
        const { front, pair } = leg.userData;
        let a = 0;
        if (trot) a = (pair ? 1 : -1) * sn * (p.gait === 'walk' ? 0.38 : 0.5);
        else if (run) a = Math.sin(ph * Math.PI * 2 + (front ? 0 : 1.6) + (leg.position.z > 0 ? 0.35 : 0)) * 0.7;
        if (front) a += rear * (0.25 + 0.3 * Math.sin(ph * Math.PI * 4 + (leg.position.z > 0 ? 1.5 : 0))); // on top of the hinge's 0.75: paws the air ahead of its chest
        leg.scale.set(1 - 0.9 * lie, (1 - 0.95 * lie) * (front ? 1 - 0.18 * rear : 1), 1 - 0.9 * lie);
        leg.rotation.z = (a - body.rotation.z) * (1 - lie) + lie * (front ? 1.3 : 1.5);
      }
      const fl = Math.max(p.flare || 0, rear);
      fire.uniforms.uF.value = fl; fire.uniforms.uW.value = calm() ? 0.3 : 1 + fl;
    },
    tick(t, n = night) {
      night = n; coat.emissiveIntensity = 0.1 * n; fire.uniforms.uN.value = gem.uniforms.uN.value = n; pool.material.opacity = 0.55 * n; pool.visible = n > 0; // 67-2: by day nothing to draw (a draw call saved)
      for (let i = 0; i < N; i++) { const [o, x, z, per] = seed[i], k = (t / per + o) % 1, f = Math.sin(Math.PI * k) * (0.6 + 0.4 * n);
        pos[i * 3] = x + 0.12 * Math.sin(t * 1.7 + i) - 0.4 * k; pos[i * 3 + 1] = 1.75 - 0.25 * Math.abs(x + 0.2) + k * 1.3; pos[i * 3 + 2] = z + 0.1 * Math.cos(t * 1.3 + i * 2);
        col[i * 3] = f; col[i * 3 + 1] = f * 0.75; col[i * 3 + 2] = f * 0.4; }
      pg.attributes.position.needsUpdate = pg.attributes.color.needsUpdate = true;
    },
  };
}

// ---- 157 C 불갈기 천리마 다시 (?m89 시범: the build sets M89 false, so the public figure above stays as it is until the user OKs) ----
// pilot89_firemane157.glb (tools/bake-firemane157.mjs): the same body and legs (MS, the size, the hinge, the hips hold). Things you
// could hold, no painted pattern: the coat a deep red lacquer (옻칠: a clearcoat over a red that deepens toward the outline, as
// light goes further through the layers there; an ember faintly lit inside it, more at night); gilt tack: the bridle, breast
// collar, girth, spine and haunch straps gold inlaid in the lacquer (평탈, STRAP157), gilt-bronze bosses and 행엽, and on each flank
// a 말다래 with a flying horse raised on it (the 천마총 천마도's motif drawn anew);
// gold hooves (an ember at each step: habitat/myth.js); the mane and tail glass flames, 4 + 3 masses each its own piece
// (_thickness = its number + root 0 .. tip 1), white-hot inside cooling to red at the tips, rippling slowly, drawn with depth so
// they stay apart; small sparks drifting up off the tips (more at night); the warm pool at night as before.
// The same pose() as the figure above (kept apart so the public one is untouched; on the user's OK it replaces that one).
const FILE157 = 'assets/models/pilot89_firemane157.glb';
// the gilt straps, gold inlaid flush in the lacquer (평탈), drawn per pixel so their edges are clean: the bands
// tools/bake-firemane157.mjs prints (model units) — rings [centre, axis, R, r], the cheek strap [a, b, r] (+z, mirrored), ellipsoids [c, r]
const STRAP157 = [[[[1.0168, 1.8425, 0], [0.8496, -0.5274, 0], 0.2514, 0.045], [[0.6432, 1.94, 0], [0.9536, 0.3011, 0], 0.27, 0.04], [[1.0103, 2.1516, 0], [0.6309, 0.7759, 0], 0.2, 0.035], [[0.4712, 1.3075, 0], [0.5067, 0.8621, 0], 0.4, 0.05]], [[[0.6432, 1.8514, 0.2953], [1.0168, 1.8425, 0.2597], 0.035]], [[[-0.03, 1.2, 0], [0.04, 2, 2]], [[-0.54, 1.7, 0], [0.51, 0.5, 0.032]], [[-0.62, 1.1432, 0], [0.62, 0.045, 0.6]]]];
const v3 = v => `vec3(${v.map(x => x.toFixed(4)).join(', ')})`;
const STRAP_GLSL = `float tor157(vec3 q, vec3 a, float R, float r) { float h = dot(q, a); return length(vec2(length(q - a * h) - R, h)) - r; }
float cap157(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
float ell157(vec3 q, vec3 r) { float k0 = length(q / r), k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / k1; }
float strap157(vec3 p) { return ${[...STRAP157[0].map(([c, a, R, r]) => `tor157(p - ${v3(c)}, ${v3(a)}, ${R.toFixed(4)}, ${r.toFixed(4)})`),
  ...STRAP157[1].map(([a, b, r]) => `cap157(vec3(p.xy, abs(p.z)), ${v3(a)}, ${v3(b)}, ${r.toFixed(4)})`),
  ...STRAP157[2].map(([c, r]) => `ell157(p - ${v3(c)}, ${v3(r)})`)].reduce((s, x) => `min(${s}, ${x})`)}; }
`;
// the hooves: gold below the leg's hoof line, per pixel too (the bake's leg/hoof split followed its triangles: a sawtooth edge)
const HOOF_GLSL = `float strap157(vec3 p) { return p.y + ${(M.legs.hip - 0.1).toFixed(4)}; }\n`; // leg-local (pivot at the hip): -(len - hoof) of bake-firemane157.mjs's leg
const lacquer157 = (s, u, key, sdf) => { // s: the figure's scale; u: uniforms shared by the coat and the legs; sdf: where the gold is (strap157 < 0), key its name
  const m = new THREE.MeshPhysicalMaterial({ color: '#8e0f0a', roughness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#ff4a14' });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vP157;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP157 = position;');
    sh.fragmentShader = 'uniform float uT157, uE157, uG157;\nvarying vec3 vP157;\n' + sdf + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float g157 = 0.0;
      { float fv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(0.42, 0.07, 0.05), vec3(1.0), smoothstep(0.0, 0.85, fv)); // deeper, darker red toward the outline
        totalEmissiveRadiance *= uE157 * fv * fv * (0.7 + 0.3 * sin(uT157 * 0.8 + vP157.x * 3.1 + vP157.y * 2.3)); // an ember inside, breathing slowly
        float d = strap157(vP157), w = max(min(fwidth(d), length(fwidth(vP157))), 1e-5); // capped at the pixel's size: ell157 is steep on a thin strap's mid-plane (a faint line there otherwise)
        g157 = 1.0 - smoothstep(-w, w, d); // the gold, its edge antialiased
        float hb = ${(0.005 * s).toFixed(5)} * (1.0 - smoothstep(-0.012, 0.0, d)); // its edge a little raised: a 1.2 cm bevel (view units)
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition), r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        if (abs(det) > 1e-20) { vec3 sg = (dFdx(hb) * r1 + dFdy(hb) * r2) / det; normal = normalize(normal - sg); clearcoatNormal = normalize(clearcoatNormal - sg); }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.79, 0.42, 0.065), g157); metalnessFactor = mix(metalnessFactor, 1.0, g157); roughnessFactor = mix(roughnessFactor, 0.26, g157);
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(1.0, 0.45, 0.12) * uG157, g157); }`) // at night the gold catches the fire's light
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= 1.0 - 0.7 * g157;'); // the gold: a thinner coat
  };
  m.customProgramCacheKey = () => 'lacquer157' + key;
  return m;
};
const glass157 = () => new THREE.ShaderMaterial({
  uniforms: { uT: windTime, uW: { value: 1 }, uF: { value: 0 }, uN: { value: 0 } },
  vertexShader: `uniform float uT, uW, uF; attribute float _thickness; varying vec3 vN, vV; varying float vS, vM;
    void main() { float m = floor(_thickness), s = _thickness - m, w = uW * s * s; // the root still in the coat, the tip the freest
      vec3 p = position + normal * (0.016 * w * sin(uT * 2.2 + position.y * 6.0 + m * 1.9) + uF * 0.05 * s) + vec3(-0.04, 0.015, 0.0) * w * sin(uT * 1.1 + m * 2.3);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vS = s; vM = m; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT, uN; varying vec3 vN, vV; varying float vS, vM;
    void main() { vec3 n = normalize(vN), v = normalize(vV); float f = 1.0 - abs(dot(n, v)); // 0 facing us .. 1 at the outline
      float h = clamp(vS * 1.1 + 0.3 * f - 0.07 * sin(uT * 1.5 + vM * 2.1 - vS * 7.0), 0.0, 1.0); // heat: 0 the white core .. 1 the red tip
      vec3 c = h < 0.35 ? mix(vec3(1.0, 0.95, 0.78), vec3(1.0, 0.7, 0.16), h / 0.35) : h < 0.7 ? mix(vec3(1.0, 0.7, 0.16), vec3(1.0, 0.32, 0.05), (h - 0.35) / 0.35) : mix(vec3(1.0, 0.32, 0.05), vec3(0.86, 0.12, 0.03), (h - 0.7) / 0.3);
      c *= mod(floor(vM + 0.5), 2.0) < 0.5 ? 1.0 : 0.88; // neighbouring masses a shade apart: never one lump
      float sp = pow(max(dot(reflect(-v, n), normalize(vec3(-0.45, 0.8, 0.4))), 0.0), 60.0); // glass: a sharp highlight, a thin bright edge
      c += vec3(1.0, 0.95, 0.85) * (0.9 * sp + 0.22 * smoothstep(0.84, 0.98, f));
      gl_FragColor = vec4(c * (0.9 + 0.3 * uN), mix(0.66 + 0.24 * h, 0.97, f * f)); // glass: clearer face-on, dense at the outline and the cooled red tips (not pink)
      #include <colorspace_fragment>
    }`,
  transparent: true, // depthWrite on: one mass in front of another hides it (crisp, not smeared); not tone-mapped, as the fire above
});
function make157() {
  const s = MS.s, L = M.legs, root = new THREE.Group(), body = new THREE.Group(), hinge = new THREE.Group(), inner = new THREE.Group();
  body.scale.setScalar(s); root.add(body); hinge.position.set(L.x[1], L.hip, 0); inner.position.set(-L.x[1], -L.hip, 0); hinge.add(inner); body.add(hinge);
  const u = { uT157: windTime, uE157: { value: 0 }, uG157: { value: 0 } }, coat = lacquer157(s, u, 'coat', STRAP_GLSL), legCoat = lacquer157(s, u, 'leg', HOOF_GLSL), gilt = new THREE.MeshStandardMaterial({ color: '#e6ad48', metalness: 1, roughness: 0.24, emissive: '#ff8a30', emissiveIntensity: 0 });
  const plate = new THREE.MeshStandardMaterial({ color: '#c08a3c', metalness: 1, roughness: 0.5, emissive: '#ff8a30', emissiveIntensity: 0 }), fire = glass157();
  const mat = { body: coat, leg: legCoat, gilt, hoof: legCoat, plate, eye: eyeMat, fire };
  const mesh = k => { const o = new THREE.Mesh(G[k], mat[k]); if (k === 'fire') o.renderOrder = 3; else o.castShadow = o.receiveShadow = true; return o; };
  for (const k of ['body', 'eye', 'plate', 'gilt', 'fire']) inner.add(mesh(k));
  const legs = [L.x[0], L.x[1]].flatMap(x => [L.z, -L.z].map(z => { const g = new THREE.Group(); g.position.set(x, L.hip, z); g.add(mesh('leg'), mesh('hoof'));
    g.userData = { front: x > 0, pair: (x > 0) === (z > 0) }; (x > 0 ? inner : body).add(g); return g; }));
  // sparks: off the flames' tips, drifting up and back, twinkling out (fewer when motion is calmed); brighter at night
  const th = G.fire.attributes._thickness, fp = G.fire.attributes.position, tips = [];
  for (let i = 0; i < th.count; i++) if (th.getX(i) % 1 > 0.7) tips.push(i);
  const N = !tips.length ? 0 : calm() ? 10 : 30, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const seed = Array.from({ length: N }, () => { const i = tips[Math.random() * tips.length | 0]; return [Math.random(), fp.getX(i), fp.getY(i), fp.getZ(i), 1.6 + Math.random() * 1.4]; });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const embers = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.17, map: dot('rgba(255,250,225,1)', 'rgba(255,150,50,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; embers.renderOrder = 4; inner.add(embers);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: dot('rgba(255,190,110,1)', 'rgba(255,150,70,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.renderOrder = 1; root.add(pool);
  const bodyMin = 0.7;
  let night = 0;
  return {
    obj: root, embers, pool,
    pose(p) { // as makeMyth's
      const lie = p.lie || 0, rear = p.rear || 0, ph = p.ph || 0, sn = Math.sin(ph * Math.PI * 2), run = p.gait === 'run', trot = p.gait === 'trot' || p.gait === 'walk';
      body.position.y = -lie * (bodyMin - 0.12) * s + (run || trot ? Math.abs(sn) * (run ? 0.09 : 0.05) * s : 0);
      body.rotation.z = (p.rot || 0) + (run ? 0.05 * Math.sin(ph * Math.PI * 2 + 1) : 0);
      hinge.rotation.z = rear * 0.75;
      for (const leg of legs) {
        const { front, pair } = leg.userData;
        let a = 0;
        if (trot) a = (pair ? 1 : -1) * sn * (p.gait === 'walk' ? 0.38 : 0.5);
        else if (run) a = Math.sin(ph * Math.PI * 2 + (front ? 0 : 1.6) + (leg.position.z > 0 ? 0.35 : 0)) * 0.7;
        if (front) a += rear * (0.25 + 0.3 * Math.sin(ph * Math.PI * 4 + (leg.position.z > 0 ? 1.5 : 0)));
        leg.scale.set(1 - 0.9 * lie, (1 - 0.95 * lie) * (front ? 1 - 0.18 * rear : 1), 1 - 0.9 * lie);
        leg.rotation.z = (a - body.rotation.z) * (1 - lie) + lie * (front ? 1.3 : 1.5);
      }
      const fl = Math.max(p.flare || 0, rear);
      fire.uniforms.uF.value = fl; fire.uniforms.uW.value = calm() ? 0.3 : 1 + fl;
    },
    tick(t, n = night) {
      night = n; u.uE157.value = 0.03 + 0.25 * n; u.uG157.value = gilt.emissiveIntensity = plate.emissiveIntensity = 0.32 * n; // the gold catching the fire's light at night
      fire.uniforms.uN.value = n; pool.material.opacity = 0.55 * n; pool.visible = n > 0;
      for (let i = 0; i < N; i++) { const [o, x, y, z, per] = seed[i], k = (t / per + o) % 1, f = Math.sin(Math.PI * k) ** 2 * (0.75 + 0.25 * Math.sin(t * 13 + i * 2.7)) * (0.4 + 0.6 * n);
        pos[i * 3] = x - 0.3 * k + 0.05 * Math.sin(t * 2.1 + i); pos[i * 3 + 1] = y + 0.9 * k; pos[i * 3 + 2] = z + 0.06 * Math.cos(t * 1.7 + i * 2);
        col[i * 3] = f; col[i * 3 + 1] = f * 0.8; col[i * 3 + 2] = f * 0.45; }
      pg.attributes.position.needsUpdate = pg.attributes.color.needsUpdate = true;
    },
    dispose() { for (const o of [coat, legCoat, gilt, plate, fire, pg, embers.material, embers.material.map, pool.geometry, pool.material, pool.material.map]) o.dispose(); }, // G (the loaded file) and eyeMat are shared
  };
}
