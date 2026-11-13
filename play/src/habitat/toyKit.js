// Shared "toy figure" look: one material recipe, one sky environment, a few rounded shapes.
// Every prop in every habitat should be built from these so lighting and gloss match.
import * as THREE from 'three';

// Soft glossy plastic. Per-instance colour: pass '#ffffff' and use InstancedMesh.setColorAt.
export const toyMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...o });

// Sky gradient + warm sun glow, prefiltered so all standard materials pick up the same
// ambient light and reflections. Replaces a hemisphere light.
// 21-1: the night's 0..1 (daylight.js) for glowing materials (materials.js, figure.js halos, water sparkles), and the light's
// tint on the water (its shader has no lights of its own)
export const nightGlow = { value: 0 }, skyLit = { value: new THREE.Color(1, 1, 1) };
// 21-2: how hard it rains now, 0..1 (weather.js): rings on the water (water.js), the wet ground (terrain.js)
export const rainNow = { value: 0 };
// 15-2 첫눈: snow lying on the ground, the grass tips, the trees' and rocks' tops, the pond edges' thin ice (0..1; weather.js sets it
// from WEATHER.cover, 0 in the snow habitat). Always in the shaders (no rebuild when it comes); 0: as before
export const snowNow = { value: 0 }, SNOW_RGB = 'vec3(0.95, 0.965, 0.99)';
export function snowTop(sh) { // the faces turned up go white with it (view-space normal against the world's up)
  sh.uniforms.uSnow = snowNow;
  sh.fragmentShader = 'uniform float uSnow;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  diffuseColor.rgb = mix(diffuseColor.rgb, ${SNOW_RGB}, uSnow * smoothstep(0.3, 0.65, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));`);
}
// the env map: a sky sphere (sky: { top, hor, gnd, glow } as [r, g, b], from daylight.js; none = the day's) blurred by PMREM
const pmrems = new WeakMap(), DAY_SKY = { top: [0.50, 0.66, 0.92], hor: [1.0, 0.84, 0.66], gnd: [0.36, 0.44, 0.22], glow: [1.0, 0.86, 0.62] };
const v3 = a => new THREE.Vector3(...a);
export function makeSkyEnv(renderer, sunDir, sky = DAY_SKY) {
  const s = new THREE.Scene(), u = { uSun: { value: sunDir.clone().normalize() }, uTop: { value: v3(sky.top) }, uHor: { value: v3(sky.hor) }, uGnd: { value: v3(sky.gnd) }, uGlow: { value: v3(sky.glow) } };
  const geo = new THREE.SphereGeometry(10, 32, 16), mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: u,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uSun, uTop, uHor, uGnd, uGlow;
      void main(){
        float y = vD.y;
        vec3 c = y > 0.0 ? mix(uHor, uTop, pow(y, 0.55)) : mix(uHor * 0.7, uGnd, pow(-y, 0.35));
        c += uGlow * pow(max(dot(vD, uSun), 0.0), 24.0) * 3.0;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  s.add(new THREE.Mesh(geo, mat));
  let pm = pmrems.get(renderer); if (!pm) pmrems.set(renderer, pm = new THREE.PMREMGenerator(renderer)); // kept: its blur shader compiles once
  const rt = pm.fromScene(s, 0.03), tex = rt.texture; geo.dispose(); mat.dispose();
  tex.dispose = () => rt.dispose(); // 67-2: the texture alone frees nothing (it is the target's): each light step left a 768×1024 one behind
  return tex;
}

// Box with all edges rounded (radius r). Smooth normals, like a moulded part.
export function roundedBox(w, h, d, r = 0.15, seg = 3) {
  const n = seg * 2 + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const p = g.attributes.position, nr = g.attributes.normal, half = [w / 2, h / 2, d / 2];
  const u = [0, 0, 0], inner = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    for (let a = 0; a < 3; a++) {
      const f = Math.round((p.getComponent(i, a) + 0.5) * n), H = half[a], R = Math.min(r, H);
      u[a] = f <= seg ? -H + R * (f / seg) : f >= seg + 1 ? H - R + R * ((f - seg - 1) / seg) : 0;
      inner[a] = THREE.MathUtils.clamp(u[a], -(H - R), H - R);
    }
    const dx = u[0] - inner[0], dy = u[1] - inner[1], dz = u[2] - inner[2], L = Math.hypot(dx, dy, dz);
    if (L > 1e-6) { p.setXYZ(i, inner[0] + dx / L * r, inner[1] + dy / L * r, inner[2] + dz / L * r); nr.setXYZ(i, dx / L, dy / L, dz / L); }
    else p.setXYZ(i, u[0], u[1], u[2]);
  }
  return g;
}

// Concatenate geometries (attributes present in all of them). For building one instanced part from several pieces.
export function merge(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(parts[0].attributes)) {
    if (!parts.every(g => g.attributes[name])) continue;
    const arr = new Float32Array(parts.reduce((s, g) => s + g.attributes[name].array.length, 0)); let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].attributes[name].itemSize));
  }
  return out;
}

// Lathe from [radius, y] pairs (smooth, closed by the profile itself).
export const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Gentle wind sway in the vertex shader; amount grows with local height (position.y).
// Shared uniform so one clock drives every swaying material.
export const windTime = { value: 0 };
export function addSway(mat, amp, freq = 1.3, snow = false) { // snow: 15-2 snowTop as well
  mat.onBeforeCompile = sh => { if (snow) snowTop(sh);
    sh.uniforms.uWind = windTime;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float hk = max(position.y, 0.0);
      transformed.x += sin(uWind * ${freq.toFixed(2)} + ip.x * 0.35 + ip.z * 0.21) * ${amp.toFixed(3)} * hk;
      transformed.z += cos(uWind * ${(freq * 0.8).toFixed(2)} + ip.x * 0.23 - ip.z * 0.3) * ${(amp * 0.6).toFixed(3)} * hk;`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp + freq + (snow ? 's' : '');
  return mat;
}

// Fill an InstancedMesh from a list of { x, y, z, s (scale number or [sx,sy,sz]), ry, rx, rz, c (colour) }.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function instanced(geo, mat, items, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  items.forEach((it, i) => {
    _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e);
    const s = it.s ?? 1; Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.setScalar(s);
    im.setMatrixAt(i, _m.compose(_p.set(it.x, it.y, it.z), _q, _s));
    if (it.c !== undefined) im.setColorAt(i, _c.set(it.c));
  });
  im.count = items.length; im.castShadow = cast; im.receiveShadow = receive; im.visible = items.length > 0; // 67-2: none here: no draw call
  im.computeBoundingSphere();
  return im;
}

// Value noise for shaders (0..1). Shared so every patched material uses the same pattern.
export const GLSL_NOISE = `
float hash12(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
`;
// Linear-space vec3 literal from a CSS colour, for colours written into GLSL.
export const glslColor = hex => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
// Recolour a standard material per pixel from its world position (vWp). glsl edits diffuseColor.rgb.
export function worldColor(mat, glsl) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWp;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + glsl);
  };
  mat.customProgramCacheKey = () => glsl;
  return mat;
}
