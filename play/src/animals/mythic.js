// 14-1 신수: the 불갈기 천리마's figure (data.js MYTHIC, baked by tools/bake-mythic.mjs). Not a SPECIES, so not figure.js's
// makeFigure: one model, its own materials (matte vinyl coat, gold harness, a 단청 saddle cloth) and its fire, a translucent
// resin in three layers (white core, yellow, orange outside: a fresnel ramp), embers and, at night, a warm pool of light.
// Rearing pivots the body on the hind hips (hinge); the front legs paw, the mane flares, variant B's wings open.
import * as THREE from 'three';
import { MYTHIC, sized } from '../game/data.js';
import { meshes } from './figure.js';
import { toyMat, windTime } from '../habitat/toyKit.js';
import { eyeMat } from './materials.js';
import { calm } from '../config.js';

export const WINGS = false; // 14-1 A/B: false = A (no wings), true = B (small folded flame wings at the shoulders, open when it rears)
const M = MYTHIC[0].model;
export const MS = sized('firemane', 'adult', M); // s, r, seg in world units (crowd.js), legs / wing in model units
let G = null, loading = null;
export const loadMyth = () => loading ??= meshes(M.file).then(g => { G = g; });

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

// wings: null = WINGS. obj stands at its hooves; pose(p) as figure.js's ({ gait 'still' | 'walk' | 'trot' | 'run', ph, lie, rear, flare });
// tick(night 0..1) each frame
export function makeMyth(wings = WINGS) {
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
  const wing = wings ? [1, -1].map(k => { const w = new THREE.Group(); w.position.set(M.wing[0], M.wing[1], M.wing[2] * k); w.scale.z = k; w.add(mesh('wing', fire)); w.userData.k = k; inner.add(w); return w; }) : [];
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
    obj: root, embers, pool, wings: wing.length,
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
      for (const w of wing) { const o = rear; w.rotation.set(w.userData.k * 1.05 * o, 0, -0.7 * o); }
    },
    tick(t, n = night) {
      night = n; coat.emissiveIntensity = 0.1 * n; fire.uniforms.uN.value = gem.uniforms.uN.value = n; pool.material.opacity = 0.55 * n;
      for (let i = 0; i < N; i++) { const [o, x, z, per] = seed[i], k = (t / per + o) % 1, f = Math.sin(Math.PI * k) * (0.6 + 0.4 * n);
        pos[i * 3] = x + 0.12 * Math.sin(t * 1.7 + i) - 0.4 * k; pos[i * 3 + 1] = 1.75 - 0.25 * Math.abs(x + 0.2) + k * 1.3; pos[i * 3 + 2] = z + 0.1 * Math.cos(t * 1.3 + i * 2);
        col[i * 3] = f; col[i * 3 + 1] = f * 0.75; col[i * 3 + 2] = f * 0.4; }
      pg.attributes.position.needsUpdate = pg.attributes.color.needsUpdate = true;
    },
  };
}
