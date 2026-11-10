// 21-1 time of day: four light setups (morning 5-9, day 9-17, sunset 17-20, night 20-5), each one fading in over
// FADE (20 game minutes) from the one before. Only for looking at: nothing here touches the save, odds or rewards.
import * as THREE from 'three';
import { makeSkyEnv, nightGlow, skyLit } from './toyKit.js';
import { TIME_MODE, CYCLE_MINUTES, HOUR, PREFS, VIEW } from '../config.js';
import { now as clock } from '../game/clock.js';

// the game clock: game hours since 1970 (TIME_MODE 'real': the device's local time; 'cycle': a day every CYCLE_MINUTES).
// The only clock: the time of day below and the weather (weather.js) are both read off it
export function gameHours(now = clock()) {
  return TIME_MODE === 'cycle' ? now / 60000 / CYCLE_MINUTES * 24 : now / 36e5 - new Date(now).getTimezoneOffset() / 60;
}
// the hour now, 0..24: 사진 모드's (VIEW), ?hour=H (shots), then the settings' 항상 낮, then the game clock
export function hourNow(now = clock()) {
  if (VIEW.hour != null) return VIEW.hour;
  if (HOUR != null) return ((HOUR % 24) + 24) % 24;
  if (PREFS.time === 'day') return 12;
  return ((gameHours(now) % 24) + 24) % 24;
}

// sun: toward the sun (the moon at night); col, I: its light. top / hor / gnd / glow: the env map's sky (toyKit.js).
// bg: the canvas gradient behind the board. fog: the fog's colour (weather). lit: the water's tint. night: 0..1 for
// glowing materials, fireflies and sleepier animals. 'day' is exactly the look from before 21-1.
export const TIMES = [
  { id: 'morning', from: 5, sun: [26, 30, -16], col: '#ffd8b0', I: 1.9, top: [0.60, 0.72, 0.95], hor: [1.0, 0.86, 0.76], gnd: [0.36, 0.44, 0.24], glow: [1.0, 0.80, 0.64],
    bg: ['#fdf0e4', '#f6dccd', '#e8c2ad'], fog: '#f3dccd', lit: [1.0, 0.97, 0.95], night: 0 },
  { id: 'day', from: 9, sun: [-22, 40, -14], col: '#ffe6c4', I: 2.1, top: [0.50, 0.66, 0.92], hor: [1.0, 0.84, 0.66], gnd: [0.36, 0.44, 0.22], glow: [1.0, 0.86, 0.62],
    bg: ['#fbe9d0', '#f1d3ae', '#e2b98c'], fog: '#f1d3ae', lit: [1, 1, 1], night: 0 },
  { id: 'sunset', from: 17, sun: [-34, 15, -6], col: '#ffa468', I: 1.8, top: [0.50, 0.44, 0.72], hor: [1.0, 0.64, 0.44], gnd: [0.32, 0.32, 0.20], glow: [1.0, 0.56, 0.30],
    bg: ['#fcd8bc', '#efad8e', '#bb7f84'], fog: '#e9a98e', lit: [1.0, 0.82, 0.70], night: 0.15 },
  { id: 'night', from: 20, sun: [14, 36, -24], col: '#93a6ff', I: 0.38, top: [0.07, 0.10, 0.24], hor: [0.15, 0.17, 0.33], gnd: [0.04, 0.05, 0.06], glow: [0.30, 0.34, 0.55],
    bg: ['#3e4a76', '#2b355c', '#181e3a'], fog: '#2b355c', lit: [0.30, 0.36, 0.58], night: 1 },
];
const FADE = 1 / 3, STEPS = 12; // the env map and shadows are redrawn STEPS times per fade, not every frame

// (u = 1: b itself, so the steady day is exactly the old numbers)
const lerp = (a, b, u) => u === 1 ? b : a.map((x, i) => x + (b[i] - x) * u), cA = new THREE.Color(), cB = new THREE.Color();
const mixHex = (a, b, u) => u === 1 ? b : '#' + cA.set(a).lerp(cB.set(b), u).getHexString();
// the light at hour h: the setup that began last (and how long ago), mixed with the one before while it fades in
export function lightAt(h) {
  let i = 0, ago = 99;
  TIMES.forEach((T, k) => { const d = (h - T.from + 24) % 24; if (d < ago) { ago = d; i = k; } });
  const step = Math.round(Math.min(1, ago / FADE) * STEPS), u = THREE.MathUtils.smoothstep(step / STEPS, 0, 1), A = TIMES[(i + 3) % 4], B = TIMES[i];
  const L = { key: i * 100 + step, id: B.id, night: u === 1 ? B.night : A.night + (B.night - A.night) * u, I: u === 1 ? B.I : A.I + (B.I - A.I) * u, col: mixHex(A.col, B.col, u), fog: mixHex(A.fog, B.fog, u),
    bg: A.bg.map((c, k) => mixHex(c, B.bg[k], u)) };
  for (const k of ['sun', 'top', 'hor', 'gnd', 'glow', 'lit']) L[k] = lerp(A[k], B[k], u);
  return L;
}

// 21-2 overcast (weather.js: rain, fog): g of the way to a grey sky. The colours lose most of their colour and a little
// light, the sun dims. g = 0: the light as it is
const ga = (a, g) => { const y = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11; return a.map(x => (x + (y - x) * 0.6 * g) * (1 - 0.12 * g)); };
const gh = (c, g) => { cA.set(c); return '#' + cA.setRGB(...ga([cA.r, cA.g, cA.b], g)).getHexString(); };
export function overcast(l, g) {
  if (!g) return l;
  const o = { ...l, I: l.I * (1 - 0.35 * g), col: gh(l.col, g), fog: gh(l.fog, g), bg: l.bg.map(c => gh(c, g)) };
  for (const k of ['top', 'hor', 'glow', 'lit']) o[k] = ga(l[k], g);
  return o;
}
const GREY = 6; // the overcast moves in GREY steps (each one redraws the env map, as a time fade step does)

// a habitat's lights follow the clock: sun, env map, background, fog colour, water tint, the glow uniform.
// paint(bg): repaints the canvas background. Returns update(g) -> the light now (call it every frame with the weather's
// overcast 0..1; it only rebuilds when the light has moved a step).
export function daylight(renderer, scene, sun, sunDir, paint) {
  let key = null, L = null;
  return (g = 0) => {
    const s = Math.round(g * GREY), l0 = lightAt(hourNow()), l = overcast(l0, s / GREY);
    if (l0.key * 10 + s !== key) {
      key = l0.key * 10 + s; L = l;
      sunDir.set(...l.sun).normalize(); sun.position.copy(sunDir).multiplyScalar(60); sun.color.set(l.col); sun.intensity = l.I;
      scene.environment?.dispose(); scene.environment = makeSkyEnv(renderer, sunDir, l);
      paint(l.bg); scene.fog?.color.set(l.fog); skyLit.value.setRGB(...l.lit); renderer.shadowMap.needsUpdate = true;
    }
    nightGlow.value = L.night; // every frame: the cabinet's 밤에 보기 may have changed it while this habitat was paused
    return L;
  };
}

// fireflies over the grass at night: n soft dots that drift and blink (one draw call; hidden by day)
export function fireflies(scene, ctx, n = 36, pick = () => [(Math.random() - 0.5) * 24, 3 + (Math.random() - 0.5) * 34]) { // pick: where to try (inbox 34: the swamp)
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), F = [];
  for (let i = 0; i < n; i++) {
    let x = 0, z = 3;
    for (let k = 0; k < 40; k++) { [x, z] = pick(); if (ctx.walkable(x, z)) break; }
    F.push({ x, z, y: ctx.heightAt(x, z) + 0.5 + Math.random() * 1.8, p: Math.random() * 6.28, s: 0.5 + Math.random() * 0.6 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
  return (t, night) => {
    pts.visible = night > 0.02; if (!pts.visible) return;
    F.forEach((f, i) => {
      pos[i * 3] = f.x + Math.sin(t * 0.3 * f.s + f.p) * 1.2; pos[i * 3 + 1] = f.y + Math.sin(t * 0.7 * f.s + f.p * 2) * 0.35; pos[i * 3 + 2] = f.z + Math.cos(t * 0.25 * f.s + f.p) * 1.2;
      const b = night * Math.pow(0.5 + 0.5 * Math.sin(t * 1.6 * f.s + f.p * 3), 2);
      col[i * 3] = 0.85 * b; col[i * 3 + 1] = 1.0 * b; col[i * 3 + 2] = 0.45 * b;
    });
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
  };
}
