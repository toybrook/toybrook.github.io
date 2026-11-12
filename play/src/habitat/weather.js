// 21-2 weather: clear, rain, fog, and a rainbow for a while after rain (25-1: snow in the snow habitat, and its night aurora). Each habitat has its own, worked out from the game
// clock (daylight.js gameHours) and the WEATHER table (config.js) alone: the same hour shows the same weather on every
// visit, nothing goes into the save, and nothing (odds, hearts, rewards) depends on it. 날씨 효과 끄기 (PREFS.weather
// false): always clear. Effects: rain streaks (one draw call, moved in the shader), rings on the water and the wet ground
// (rainNow: water.js, terrain.js), a grey sky (daylight.js overcast), fog (scene.fog), a rainbow band at the top of the view.
import * as THREE from 'three';
import { WEATHER, WEATHER_Q, PREFS, VIEW, QUALITY } from '../config.js';
import { gameHours } from './daylight.js';
import { rainNow, skyLit } from './toyKit.js';

const hash = (...k) => { let h = 2166136261; for (const n of k) { h = Math.imul(h ^ n, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; } return (h >>> 0) / 4294967296; };
const seedOf = id => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const ease = x => THREE.MathUtils.smoothstep(x, 0, 1);

// a game day's spells ({ from, to } in hours from its start, kind), the same every time for that habitat and day
const days = new Map();
export function day(hab, d) {
  const key = hab + d + (WEATHER.ev ? 'e' : ''); let S = days.get(key); if (S) return S;
  const odds = WEATHER.ev?.[hab] ?? WEATHER.by[hab] ?? WEATHER.odds, s = seedOf(hab), [a, b] = WEATHER.every, tot = Object.values(odds).reduce((x, y) => x + y); S = [];
  for (let t = 0, k = 0; t < 24; k++) {
    let to = t + a + (b - a) * hash(s, d, k, 1), r = hash(s, d, k, 2) * tot, kind;
    if (24 - to < a) to = 24 - t <= b ? 24 : t + (24 - t) / 2; // no stub at midnight: the day's last 1~3 h (or two halves of it)
    for (kind in odds) if ((r -= odds[kind]) < 0) break;
    S.push({ from: t, to, kind }); t = to;
  }
  if (days.size > 16) days.clear();
  days.set(key, S); return S;
}

// the weather at game hour gh: { kind, rain, snow, fog, bow } (0..1 each, fading in and out over WEATHER.fade at a change)
export function weatherAt(hab, gh) {
  const d = Math.floor(gh / 24), h = gh - d * 24, S = day(hab, d), i = S.findIndex(s => h < s.to), sp = S[i];
  const prev = i > 0 ? S[i - 1] : day(hab, d - 1).at(-1), next = i < S.length - 1 ? S[i + 1] : day(hab, d + 1)[0], F = WEATHER.fade;
  const amt = k => sp.kind !== k ? 0 : ease(Math.min(prev.kind === k ? 1 : (h - sp.from) / F, next.kind === k ? 1 : (sp.to - h) / F));
  const u = h - sp.from, bow = sp.kind === 'clear' && prev.kind === 'rain' ? ease(Math.min(u / F, (Math.min(WEATHER.rainbow, sp.to - sp.from) - u) / F)) : 0;
  return { kind: sp.kind, rain: amt('rain'), snow: amt('snow'), fog: amt('fog'), bow };
}
const CLEAR = { kind: 'clear', rain: 0, snow: 0, fog: 0, bow: 0 };
const fixed = k => ({ kind: k, rain: +(k === 'rain'), snow: +(k === 'snow'), fog: +(k === 'fog'), bow: +(k === 'rainbow') });
export function weatherNow(hab) {
  const wet = hab === 'snow' ? 'snow' : 'rain'; // 사진 모드's 비 is 눈 there (photo.js), and ?weather=rain|snow either way
  if (VIEW.weather) return fixed(VIEW.weather === 'rain' ? wet : VIEW.weather); // 24-1 사진 모드 (even with 날씨 효과 끄기: it was picked)
  if (!PREFS.weather) return CLEAR;
  if (WEATHER_Q) return fixed(WEATHER_Q === 'rain' || WEATHER_Q === 'snow' ? wet : WEATHER_Q);
  return weatherAt(hab, gameHours());
}

// rain streaks: N thin quads over the board, each falling and wrapping in the vertex shader (no work per frame on the CPU),
// turned to face the camera round the upright. The share of them shown follows the rain (aR < uRain)
const rainVert = `attribute vec3 aP; attribute float aR; uniform float uTime, uRain; varying float vA;
void main(){
  float H = 16.0, y = mod(aP.y - uTime * (11.0 + aR * 4.0), H);
  vec3 p = vec3(aP.x + y * 0.08, y - 1.0, aP.z), side = normalize(cross(vec3(0.0, 1.0, 0.0), cameraPosition - p) + vec3(1e-4, 0.0, 0.0));
  p += side * position.x + vec3(0.08, 1.0, 0.0) * position.y;
  vA = step(aR, uRain) * smoothstep(0.0, 1.5, y) * smoothstep(H, H - 2.0, y);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const rainFrag = `uniform vec3 uLit; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.88, 0.92, 1.0) * (0.35 + 0.65 * uLit), 0.34 * vA); }`;
function rainMesh(a, snow) { // a: the board and 2 round it, [x0, x1, z0, z1] (28-1; the first board's: 1400 drops); a bigger board, as many to the square
  const N = Math.round(1400 * (a[1] - a[0]) * (a[3] - a[2]) / 2480 * QUALITY.g.drops); // 26-3: fewer at 보통 / 낮음
  let s = 99; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; // its own random: Math.random's sequence stays as it was
  const pos = [], aP = [], aR = [], idx = [];
  for (let i = 0; i < N; i++) {
    const x = a[0] + rnd() * (a[1] - a[0]), y = rnd() * 16, z = a[2] + rnd() * (a[3] - a[2]), r = rnd();
    for (const [qx, qy] of snow ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-0.035, 0], [0.035, 0], [-0.035, 0.9], [0.035, 0.9]]) { pos.push(qx, qy, 0); aP.push(x, y, z); aR.push(r); }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aP', new THREE.Float32BufferAttribute(aP, 3));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 1)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: snow ? snowVert : rainVert, fragmentShader: snow ? snowFrag : rainFrag, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uRain: snow ? { value: 0 } : rainNow, uLit: skyLit } }));
  m.frustumCulled = false; m.renderOrder = 3; return m;
}

// 25-1 snow: soft round flakes drifting down and sideways, slower than rain, the same wrap in the vertex shader
const snowVert = `attribute vec3 aP; attribute float aR; uniform float uTime, uRain; varying float vA; varying vec2 vQ;
void main(){
  float H = 16.0, y = mod(aP.y - uTime * (1.1 + aR * 0.7), H);
  vec3 p = vec3(aP.x + 0.5 * sin(uTime * 0.7 + aR * 40.0) + y * 0.05, y - 1.0, aP.z + 0.4 * cos(uTime * 0.5 + aR * 30.0)), side = normalize(cross(vec3(0.0, 1.0, 0.0), cameraPosition - p) + vec3(1e-4, 0.0, 0.0));
  float s = 0.05 + 0.05 * fract(aR * 13.0); vQ = position.xy; p += (side * position.x + vec3(0.0, position.y, 0.0)) * s;
  vA = step(aR, uRain) * smoothstep(0.0, 1.5, y) * smoothstep(H, H - 2.0, y);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const snowFrag = `uniform vec3 uLit; varying float vA; varying vec2 vQ; void main(){ gl_FragColor = vec4(vec3(1.0) * (0.45 + 0.55 * uLit), 0.85 * vA * smoothstep(1.0, 0.4, length(vQ))); }`;

// 25-1 the snow's night aurora (for looking at only): green curtains rising into violet over the top of the view, far off,
// slowly folding and drifting (camera-held like the rainbow; the board in front hides it)
const auroraFrag = `uniform float uAur, uTime; varying vec2 vU;
  float h1(float n){ return fract(sin(n) * 43758.5453); } float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
  void main(){ float t = uTime * 0.04, x = vU.x * 7.0 + 1.6 * n1(vU.x * 2.0 + t) + 0.6 * sin(vU.y * 2.0 + t * 3.0);
    float cur = pow(n1(x * 1.7 + t * 2.0), 3.0) * 0.8 + 0.25 * n1(x * 9.0 - t * 5.0), band = smoothstep(0.0, 0.25, vU.y) * smoothstep(1.0, 0.45, vU.y) * smoothstep(0.0, 0.15, vU.x) * smoothstep(1.0, 0.85, vU.x);
    vec3 c = mix(vec3(0.25, 1.0, 0.6), vec3(0.65, 0.4, 1.0), smoothstep(0.35, 0.9, vU.y));
    gl_FragColor = vec4(c, uAur * 0.5 * cur * band); }`;
function auroraMesh() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAur: { value: 0 }, uTime: { value: 0 } }, fragmentShader: auroraFrag,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }' }));
  m.frustumCulled = false; m.renderOrder = -1; return m;
}

// the rainbow: a pale band arching over the top of the view, far off (only the board in front hides it)
function rainbowMesh() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96, 1, 0, Math.PI), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uBow: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uBow; varying vec2 vP;
      void main(){ float k = (length(vP) - 0.92) / 0.08, a = atan(vP.y, vP.x), h = (1.0 - k) * 0.78;
        vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        gl_FragColor = vec4(mix(c, vec3(1.0), 0.3), uBow * 0.42 * sin(k * 3.1416) * smoothstep(0.0, 0.5, a) * smoothstep(3.1416, 2.64, a)); }` }));
  m.frustumCulled = false; m.renderOrder = -1; return m;
}

// a habitat's weather: now() -> the weather (also its overcast, gray, for daylight.js), draw(t, w, L) every frame
export function weather(scene, camera, controls, habId, area = [-20, 20, -31, 31]) {
  let rain = null, bow = null, flakes = null, aur = null;
  const fog = scene.fog = new THREE.Fog('#ffffff', 1e4, 2e4); // always there (no shader rebuild when fog comes); this far off it fogs nothing
  return {
    now() { const w = weatherNow(habId); w.gray = Math.max(w.rain, w.snow * 0.45, w.fog * 0.6); return w; },
    draw(t, w, L) {
      rainNow.value = w.rain;
      if (w.rain > 0 && !rain) scene.add(rain = rainMesh(area));
      if (rain) { rain.visible = w.rain > 0; rain.material.uniforms.uTime.value = t; }
      if (w.snow > 0 && !flakes) scene.add(flakes = rainMesh(area, true));
      if (flakes) { const u = flakes.material.uniforms; flakes.visible = w.snow > 0; u.uTime.value = t; u.uRain.value = w.snow; }
      const au = habId === 'snow' ? L.night * (1 - Math.max(w.snow, w.fog)) : 0; // the aurora: the snow's clear nights
      if (au > 0.02 && !aur) scene.add(aur = auroraMesh());
      if (aur) { aur.visible = au > 0.02; if (aur.visible) { const hh = 250 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
        aur.position.copy(camera.position); aur.quaternion.copy(camera.quaternion); aur.translateZ(-250); aur.translateY(hh * 0.62); aur.scale.set(hw * 2.4, hh * 0.9, 1);
        aur.material.uniforms.uAur.value = au; aur.material.uniforms.uTime.value = t; } }
      const d = camera.position.distanceTo(controls.target);
      if (w.fog > 0) { fog.near = d * (0.7 + 2.5 * (1 - w.fog)); fog.far = fog.near + d * (0.8 + 4 * (1 - w.fog)); } else { fog.near = 1e4; fog.far = 2e4; }
      if (w.bow > 0 && !bow) scene.add(bow = rainbowMesh());
      if (bow) {
        bow.visible = w.bow > 0; if (!bow.visible) return;
        // 250 off, through the view's sides at 55% of the way up and its middle at 86%
        const hh = 250 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect, dy = hh * 0.31, R = (hw * hw + dy * dy) / (2 * dy);
        bow.position.copy(camera.position); bow.quaternion.copy(camera.quaternion); bow.translateZ(-250); bow.translateY(hh * 0.86 - R); bow.scale.setScalar(R);
        bow.material.uniforms.uBow.value = w.bow * (1 - 0.6 * L.night);
      }
    },
  };
}
