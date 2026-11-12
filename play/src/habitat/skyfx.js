// 16-2 특별한 하늘, drawn: stars (the season's constellation faint among them), the moon in its real phase, and on the night's
// roll (game/sky.js, handed in by ui.skyNow) falling stars, an aurora in its colour and a comet. All in one group held 250
// in front of the camera (like weather.js's rainbow): the board in front hides it, so it shows over the horizon, mostly in
// 하늘 보기 (the camera tipped up, ui/sky.js). Group units: the view's half height; x runs ±aspect. Overcast hides it all.
// Reduce motion (calm): fewer, slower falling stars, the aurora barely moves, the comet stands still.
import * as THREE from 'three';
import { calm } from '../config.js';

const add = THREE.AdditiveBlending;
// the season's constellations: stars [x, y, size] in a box ~0.5 wide, lines between them (by index)
const SHAPES = {
  dipper: { s: [[0, 0, 1], [0.1, 0.03, 1], [0.19, 0.02, 1], [0.27, -0.01, 1], [0.29, -0.11, 1], [0.4, -0.13, 1], [0.41, -0.02, 1]], l: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3] },
  cygnus: { s: [[0.2, 0.2, 1.3], [0.2, 0.08, 1], [0.2, -0.04, 0.9], [0.2, -0.2, 1], [0.04, 0.12, 0.9], [0.36, 0.12, 0.9]], l: [0, 1, 1, 2, 2, 3, 4, 1, 1, 5] },
  pegasus: { s: [[0, 0, 1], [0.24, 0.01, 1], [0.25, -0.22, 1], [0.01, -0.21, 1], [0.38, 0.1, 0.8], [0.48, 0.16, 0.8]], l: [0, 1, 1, 2, 2, 3, 3, 0, 1, 4, 4, 5] },
  orion: { s: [[0.02, 0.2, 1.3], [0.3, 0.2, 1], [0.12, 0, 0.9], [0.16, 0.01, 0.9], [0.2, 0.02, 0.9], [0, -0.2, 1], [0.32, -0.18, 1.3]], l: [0, 2, 1, 4, 2, 3, 3, 4, 2, 5, 4, 6] },
};
const AU = { green: [[0.25, 1.0, 0.6], [0.65, 0.4, 1.0]], pink: [[1.0, 0.45, 0.7], [0.7, 0.4, 1.0]], violet: [[0.6, 0.4, 1.0], [0.95, 0.5, 1.0]], red: [[1.0, 0.22, 0.25], [1.0, 0.5, 0.65]] };

const starVert = `attribute float aS; uniform float uTime, uA, uPx; varying float vA;
  void main(){ vA = uA * (0.55 + 0.45 * sin(uTime * (0.6 + aS) + aS * 40.0)); gl_PointSize = uPx * aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const starFrag = `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), vA * smoothstep(0.5, 0.1, d)); }`;
const auFrag = `uniform float uAur, uTime; uniform vec3 uLo, uHi; varying vec2 vU;
  float h1(float n){ return fract(sin(n) * 43758.5453); } float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
  void main(){ float t = uTime * 0.04, x = vU.x * 7.0 + 1.6 * n1(vU.x * 2.0 + t) + 0.6 * sin(vU.y * 2.0 + t * 3.0);
    float cur = pow(n1(x * 1.7 + t * 2.0), 3.0) * 0.8 + 0.25 * n1(x * 9.0 - t * 5.0), band = smoothstep(0.0, 0.25, vU.y) * smoothstep(1.0, 0.45, vU.y) * smoothstep(0.0, 0.15, vU.x) * smoothstep(1.0, 0.85, vU.x);
    gl_FragColor = vec4(mix(uLo, uHi, smoothstep(0.35, 0.9, vU.y)), uAur * 0.5 * cur * band); }`;
const uvVert = 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// a streak: bright head at uv.x 1, fading tail
const streakFrag = `uniform float uA; varying vec2 vU; void main(){ float w = 1.0 - abs(vU.y - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), uA * pow(vU.x, 2.2) * w * w); }`;
// the moon: k = its age / the month; lit side by the phase (waxing: the right), the dark side faint
const moonFrag = `uniform float uK, uA; varying vec2 vU;
  void main(){ vec2 p = vU * 2.0 - 1.0; float r = length(p); if (r > 1.0) { float g = smoothstep(1.9, 1.0, r) * 0.18 * uA * step(0.45, uK) * step(uK, 0.55); gl_FragColor = vec4(0.9, 0.92, 1.0, g); return; }
    float c = cos(uK * 6.2832), e = sqrt(max(0.0, 1.0 - p.y * p.y)), x = uK < 0.5 ? p.x : -p.x, lit = smoothstep(-0.04, 0.04, x - c * e);
    gl_FragColor = vec4(mix(vec3(0.35, 0.38, 0.5), vec3(1.0, 0.97, 0.86), lit), uA * mix(0.25, 1.0, lit) * smoothstep(1.0, 0.94, r)); }`;
const mat = (frag, u, vert = uvVert) => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u, transparent: true, depthWrite: false, blending: add });

export function skyLayer(scene, camera, renderer) {
  const G = new THREE.Group(); G.renderOrder = -1; G.visible = false; scene.add(G);
  const part = m => { m.frustumCulled = false; m.renderOrder = -1; G.add(m); return m; };
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // stars: 160 over the top of the view (y 0~1), a fixed field
  const sp = [], ss = []; for (let i = 0; i < 160; i++) { sp.push((rnd() * 2 - 1) * 1.3, rnd() * 1.05 - 0.05, 0); ss.push(0.5 + rnd() * rnd() * 1.5); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.Float32BufferAttribute(ss, 1));
  const starU = { uTime: { value: 0 }, uA: { value: 0 }, uPx: { value: 3 } }, stars = part(new THREE.Points(sg, mat(starFrag, starU, starVert)));
  // the constellation: brighter stars and faint lines, one group per shape (only tonight's shown)
  const cons = {}, conU = { uTime: { value: 0 }, uA: { value: 0 }, uPx: { value: 3 } }, lineM = new THREE.LineBasicMaterial({ color: '#cfd8ff', transparent: true, opacity: 0, depthWrite: false, blending: add });
  for (const [id, C] of Object.entries(SHAPES)) {
    const g = new THREE.Group(); g.position.set(-0.75, 0.62, 0); g.visible = false; G.add(g); cons[id] = g;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(C.s.flatMap(([x, y]) => [x, y, 0]), 3)); pg.setAttribute('aS', new THREE.Float32BufferAttribute(C.s.map(x => 1.6 * x[2]), 1));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(C.l.flatMap(i => [C.s[i][0], C.s[i][1], 0]), 3));
    for (const o of [new THREE.Points(pg, mat(starFrag, conU, starVert)), new THREE.LineSegments(lg, lineM)]) { o.frustumCulled = false; o.renderOrder = -1; g.add(o); }
  }
  const moonU = { uK: { value: 0.5 }, uA: { value: 0 } }, moon = part(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(moonFrag, moonU)));
  moon.material.blending = THREE.NormalBlending;
  const auU = { uAur: { value: 0 }, uTime: { value: 0 }, uLo: { value: new THREE.Vector3() }, uHi: { value: new THREE.Vector3() } }, aur = part(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(auFrag, auU)));
  // the comet: a soft head and a long faint tail (a streak, head at its right end)
  const comet = new THREE.Group(); G.add(comet);
  const cTail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0), mat(streakFrag, { uA: { value: 0 } })); cTail.scale.set(0.42, 0.05, 1); cTail.rotation.z = Math.PI + 0.35;
  const cHead = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)).setAttribute('aS', new THREE.Float32BufferAttribute([3], 1)), mat(starFrag, { uTime: { value: 0 }, uA: { value: 0 }, uPx: { value: 3 } }, starVert));
  for (const o of [cTail, cHead]) { o.frustumCulled = false; o.renderOrder = -1; comet.add(o); }
  // falling stars: a pool, each { m, x, y, a (angle), v, life, age }
  const fall = Array.from({ length: 6 }, () => { const m = part(new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0), mat(streakFrag, { uA: { value: 0 } }))); m.visible = false; return { m, age: 9, life: 1 }; });
  let next = 0, asp = 1, on = false, shower = false;

  return {
    // t: seconds; T: ui.skyNow() ({ ev: events allowed, meteor, aurora, comet, moon (age), star (id) } or null); L: the light (night 0..1); gray: overcast
    draw(t, dt, T, L, gray) {
      const night = T ? L.night * (1 - Math.min(1, gray * 2)) : 0;
      on = G.visible = night > 0.02; if (!on) return;
      const hh = 250 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), slow = calm(); asp = camera.aspect;
      G.position.copy(camera.position); G.quaternion.copy(camera.quaternion); G.translateZ(-250); G.scale.setScalar(hh);
      const px = renderer.getPixelRatio() * renderer.domElement.clientHeight / 900; // star size: ~3 css px on a phone
      starU.uTime.value = conU.uTime.value = slow ? 0 : t; starU.uA.value = 0.75 * night; starU.uPx.value = conU.uPx.value = 3 * px;
      for (const [id, g] of Object.entries(cons)) g.visible = id === T.star;
      conU.uA.value = 0.95 * night; lineM.opacity = 0.16 * night;
      moon.position.set(asp * 0.55, 0.72, 0); moon.scale.setScalar(T.full ? 0.13 : 0.1); moonU.uK.value = T.moon / 29.530588853; moonU.uA.value = night;
      const ev = T.ev ? Math.min(1, 0.35 + L.night) * (1 - Math.min(1, gray * 2)) : 0; // from 18:00 (sunset light) on, full by night
      aur.visible = !!(ev && T.aurora); if (aur.visible) { const c = AU[T.aurora]; auU.uLo.value.set(...c[0]); auU.uHi.value.set(...c[1]); auU.uAur.value = ev * (T.boost || 1); auU.uTime.value = slow ? t * 0.15 : t;
        aur.position.set(0, 0.62, 0); aur.scale.set(asp * 2.4, 0.9, 1); }
      comet.visible = !!(ev && T.comet); if (comet.visible) { const u = slow ? 0.5 : (t / 140) % 1; comet.position.set(asp * (-0.9 + 1.5 * u), 0.82 - 0.12 * u, 0); cTail.material.uniforms.uA.value = 0.55 * ev; cHead.material.uniforms.uA.value = ev; cHead.material.uniforms.uPx.value = 3 * px; }
      shower = !!(ev && T.meteor);
      if (shower && (next -= dt) <= 0) { const f = fall.find(f => f.age >= f.life); next = slow ? 3 + 2 * Math.random() : 0.7 + Math.random() * 1.1;
        if (f) Object.assign(f, { x: asp * (Math.random() * 1.6 - 0.6), y: 0.55 + Math.random() * 0.4, a: Math.PI + 0.45 + Math.random() * 0.5, v: (slow ? 0.45 : 1.1) * (0.8 + Math.random() * 0.4), life: slow ? 1.6 : 0.9, age: 0 }); }
      for (const f of fall) { f.age += dt; f.m.visible = shower && f.age < f.life; if (!f.m.visible) continue;
        const k = f.age / f.life, d = f.v * f.age; f.m.position.set(f.x + Math.cos(f.a) * d, f.y + Math.sin(f.a) * d, 0); f.m.rotation.z = f.a; f.m.scale.set(0.3 * Math.min(1, k * 4), 0.012, 1);
        f.m.material.uniforms.uA.value = ev * Math.sin(Math.PI * Math.min(1, k * 1.2)); }
    },
    heads: () => fall.filter(f => f.m.visible).map(f => [(f.m.position.x - Math.cos(f.a) * f.m.scale.x * 0.3) / asp, f.m.position.y - Math.sin(f.a) * f.m.scale.x * 0.3]), // tests: the streaks on screen (ndc)
    // a tap at ndc (x, y): on a falling star's streak (with ~6% of the view's height to spare) -> true, it bursts
    tap(nx, ny) {
      if (!on || !shower) return false;
      const x = nx * asp, y = ny;
      for (const f of fall) { if (!f.m.visible) continue;
        const hx = f.m.position.x, hy = f.m.position.y, len = f.m.scale.x, tx = hx - Math.cos(f.a) * len, ty = hy - Math.sin(f.a) * len;
        const dx = hx - tx, dy = hy - ty, u = Math.max(0, Math.min(1, ((x - tx) * dx + (y - ty) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(x - tx - u * dx, y - ty - u * dy) < 0.12) { f.age = f.life; f.m.visible = false; return true; } }
      return false;
    },
  };
}
