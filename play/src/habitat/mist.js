// 21-3b 땅 넓히기: the next step's band round the board lies under mist (soft drifting white, as over the world map's closed
// places) until it is bought; then the mist draws back past the new ground (reveal). One draw call: a frame of three sheets
// over the band, laid on the ground (floor: habitat.js), the cover worked out per pixel from how far past the open ground it is.
import * as THREE from 'three';
import { skyLit } from './toyKit.js';

const vert = `attribute float aL; varying vec3 vW; varying float vL;
void main(){ vL = aL; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const frag = `uniform vec4 uOpen, uBuilt; uniform float uTime; uniform vec3 uLit; varying vec3 vW; varying float vL;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec2 p = vW.xz * 0.42 + vec2(uTime * 0.05, uTime * 0.03) + vL * 7.3;
  float c = 0.6 * n(p) + 0.4 * n(p * 2.3 - uTime * 0.04), w = (c - 0.5) * 1.6; // puffs: the edges wander
  float d = max(max(uOpen.x - vW.x, vW.x - uOpen.y), max(uOpen.z - vW.z, vW.z - uOpen.w)); // past the open ground
  float e = max(max(uBuilt.x - vW.x, vW.x - uBuilt.y), max(uBuilt.z - vW.z, vW.z - uBuilt.w)); // past the board
  float a = smoothstep(-0.8, 0.9, d + w) * (1.0 - smoothstep(0.3, 2.6, e + w)) * (0.4 + 0.6 * c);
  gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (0.3 + 0.7 * uLit), a * (0.62 - 0.1 * vL)); // at night it greys with the sky
}`;
const LAYERS = [0.5, 1.4, 2.3], CELL = 1, PAST = 3; // sheet heights over the ground; grid step; how far past the board it goes

// from / open: the open ground at the start / now; built: the board as built (28-1: rects [x0, x1, z0, z1], zones.js); floor(x, z): the ground
const grow = (r, m) => [r[0] - m, r[1] + m, r[2] - m, r[3] + m];
export function mist(scene, floor, open, built, from = open) {
  const inner = grow(from, -1), outer = grow(built, PAST), C = THREE.MathUtils.clamp;
  const nx = Math.ceil((outer[1] - outer[0]) / CELL), nz = Math.ceil((outer[3] - outer[2]) / CELL), X = i => outer[0] + i * (outer[1] - outer[0]) / nx, Z = j => outer[2] + j * (outer[3] - outer[2]) / nz;
  const y = []; // the ground under each grid point; past the board, the rim's (the board's edge rounds down under it)
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) y.push(floor(C(X(i), built[0] + 1.3, built[1] - 1.3), C(Z(j), built[2] + 1.3, built[3] - 1.3)));
  const pos = [], aL = [], idx = [], V = (nx + 1) * (nz + 1);
  LAYERS.forEach((dy, l) => {
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { pos.push(X(i), y[j * (nx + 1) + i] + dy, Z(j)); aL.push(l); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (X(i) > inner[0] && X(i + 1) < inner[1] && Z(j) > inner[2] && Z(j + 1) < inner[3]) continue; // inside: never misted
      const a = l * V + j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1)); g.setIndex(idx);
  const U = { uOpen: { value: new THREE.Vector4(...from) }, uBuilt: { value: new THREE.Vector4(...built) }, uTime: { value: 0 }, uLit: skyLit };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
  const last = open.every((v, i) => v === built[i]), to = last ? grow(open, PAST + 2) : open; // the last step: nothing left under mist once it has drawn back
  m.visible = !(last && from === open);
  let k = from === open ? 1 : 0, done; const T = 2.6; // the reveal's length (s)
  const tick = (t, dt) => {
    if (!m.visible) return;
    U.uTime.value = t;
    if (k < 1) { k = Math.min(1, k + dt / T); const u = k * k * (3 - 2 * k); U.uOpen.value.set(...from.map((v, i) => v + (to[i] - v) * u)); if (k === 1) { done(); if (last) m.visible = false; } }
  };
  tick.mesh = m; // 28-1: hidden for 넓히기 전과 비교 (habitat.js topView)
  tick.done = new Promise(r => { done = r; if (k === 1) r(); }); // inbox 17: once the mist has drawn back (main.js: 「땅을 넓혔어요」 then)
  return tick;
}
