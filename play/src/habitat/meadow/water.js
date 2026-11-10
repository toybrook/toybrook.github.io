// Stream + pond water. One stylised shader: sky reflection (fresnel), sun glints, flowing ripples,
// soft foam at the banks and on the falls. No extra render passes, so it stays cheap on phones.
import * as THREE from 'three';
import { R, SW, streamLine, pond, waterY, edgeRound, CLIFF_Z, WATER_Y } from './layout.js';
import { toyMat, instanced, skyLit, nightGlow, rainNow } from '../toyKit.js';
import { poolAt } from '../zones.js';

export const vert = `
attribute float aFall; varying vec2 vUv; varying vec3 vW; varying float vFall;
#include <fog_pars_vertex>
void main(){ vUv = uv; vFall = aFall; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; vec4 mvPosition = viewMatrix * w; // (P*V)*w as before 21-2; mvPosition only for the fog
#include <fog_vertex>
}`;
export const frag = `
uniform float uTime; uniform vec3 uSun; uniform vec3 uPond; uniform vec3 uLit; uniform float uNight; uniform float uRain;
varying vec2 vUv; varying vec3 vW; varying float vFall;
#include <fog_pars_fragment>
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float hgt(vec2 a, vec2 b){ return vn(a) + vn(b) * 0.5; }
void main(){
#ifdef POND
#ifdef BED
  float edge = vFall; // a pond with its own bed (pond/water.js): 1 at the waterline, 0 where it is deep
#else
  float edge = length(vW.xz - uPond.xy) / uPond.z;
#endif
  vec2 a = vW.xz * 0.8 + vec2(uTime * 0.10, uTime * 0.06), b = vW.xz * 1.7 - vec2(uTime * 0.07, -uTime * 0.11);
  float fall = 0.0;
#else
  float edge = abs(vUv.y), fall = vFall;
  float sp = 0.8 + fall * 3.5;
  vec2 a = vec2(vUv.x * 0.7 - uTime * sp, vUv.y * 1.4), b = vec2(vUv.x * 1.6 - uTime * sp * 1.4, vUv.y * 2.8 + 3.0);
#endif
  float e = 0.06, h0 = hgt(a, b);
  vec3 n = normalize(vec3((h0 - hgt(a + vec2(e, 0.0), b + vec2(e, 0.0))) * 1.2, 1.0, (h0 - hgt(a + vec2(0.0, e), b + vec2(0.0, e))) * 1.2));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(vec3(1.0, 0.91, 0.80), vec3(0.66, 0.83, 1.0), clamp(R.y * 1.3, 0.0, 1.0));
  float spec = pow(max(dot(R, uSun), 0.0), 160.0);
  float depth = 1.0 - smoothstep(0.1, 0.95, edge);
  vec3 col = mix(vec3(0.58, 0.88, 0.86), vec3(0.24, 0.62, 0.84), depth);
#ifdef COLD
  // 25-1 the snow's ice pond: colder, deeper blue-teal, and a white winter sky in it
  col = mix(vec3(0.66, 0.86, 0.9), vec3(0.12, 0.4, 0.6), depth); sky = mix(vec3(0.94, 0.96, 1.0), vec3(0.72, 0.84, 0.98), clamp(R.y * 1.3, 0.0, 1.0));
#endif
  col = mix(col, sky, fres * 0.7 + 0.1);
  col += spec * 1.6 * vec3(1.0, 0.96, 0.86);
  float fn = vn(a * 2.3 + 11.0);
#ifdef POND
  float band = smoothstep(0.66, 0.72, h0 / 1.5) * (1.0 - smoothstep(0.72, 0.82, h0 / 1.5));
  col += band * 0.22;
  float foam = smoothstep(0.97, 1.07, edge + fn * 0.05) * 0.55; // thin, faint rim
  float streak = 0.0;
#else
  // glints: short bright streaks stretched along the flow (long in u, narrow across v), drifting downstream
  float gl = smoothstep(0.8, 0.93, vn(vec2(vUv.x * 0.9 - uTime * sp * 1.15, vUv.y * 7.0))) * (1.0 - fall);
  col += gl * (0.25 + 0.35 * fres + spec) * vec3(1.0, 0.98, 0.92);
  // falls: a band of falling white streaks over a paler sheet, not a solid white blanket
  float streak = smoothstep(0.45, 0.8, vn(vec2(vUv.y * 9.0, vUv.x * 0.45 - uTime * sp * 0.55))) * smoothstep(0.15, 0.6, fall);
  col = mix(col, vec3(0.8, 0.93, 0.98), smoothstep(0.1, 0.6, fall) * 0.5);
  col = mix(col, vec3(0.98, 1.0, 1.0), streak * 0.75);
  float foam = smoothstep(0.9, 1.06, edge + fn * 0.12) + smoothstep(0.75, 1.0, fall + fn * 0.3 - 0.15) * 0.6;
#endif
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.85);
  float alpha = max(max(mix(0.42, 0.8, depth), max(foam * 0.92, streak * 0.9)), fres * 0.75);
#ifdef MURK
  // inbox 34 the swamp's pools: dark olive water, hardly see-through
  col = mix(col, vec3(0.19, 0.23, 0.12) * (0.85 + 0.5 * fres) + spec * 0.5, 0.78 - foam * 0.4); alpha = max(alpha, 0.9);
#endif
  col *= uLit; // 21-1: the hour's light (daylight.js); white by day
#ifdef BED
  // inbox 17: the pond's pale shallows (rim, round the islands) darken at night like the deep water: the night light once
  // more on their colour, and a little less see-through (the pale sand under them showed through grey). uNight = 0 by day: unchanged
  col *= mix(vec3(1.0), uLit, 0.6 * uNight * (1.0 - depth)); alpha = mix(alpha, max(alpha, 0.7), uNight * (1.0 - depth) * (1.0 - foam));
#endif
  // 21-1 night: small stars twinkling on the water, one per cell of a grid, each on its own beat
  vec2 gq = vW.xz * 1.6, gi = floor(gq); float gh = hash(gi);
  float tw = pow(max(0.0, sin(uTime * (1.2 + gh * 2.0) + gh * 40.0)), 10.0) * step(0.8, gh) * smoothstep(0.22, 0.0, length(fract(gq) - 0.5 - (vec2(hash(gi + 7.0), hash(gi + 3.0)) - 0.5) * 0.4));
  col += uNight * tw * (1.0 - foam) * vec3(1.6, 1.65, 1.8);
  // 21-2 rain: rings spreading where drops land, one per cell of two offset grids, each on its own beat (more cells as it rains harder)
  if (uRain > 0.0) for (int j = 0; j < 2; j++) {
    vec2 rq = vW.xz * 0.85 + float(j) * vec2(0.5, 0.37), ri = floor(rq) + float(j) * 31.0; float rh = hash(ri + 17.0), age = fract(uTime * (0.55 + rh * 0.35) + rh * 7.0);
    float d = length(fract(rq) - 0.25 - vec2(hash(ri + 5.0), hash(ri + 9.0)) * 0.5), ring = smoothstep(0.045, 0.0, abs(d - age * 0.3)) * (1.0 - age);
    col += step(1.0 - uRain * 0.85, hash(ri + 31.0)) * ring * (1.0 - foam) * 0.55 * uLit;
  }
  gl_FragColor = vec4(col, alpha);
#include <fog_fragment>
}`;

export function buildWater(scene, sunDir) {
  const uTime = { value: 0 };
  const mk = defines => new THREE.ShaderMaterial({
    // Alpha-blended, but flagged opaque (CustomBlending, renderOrder 1 = after the ground) so three
    // also draws it into the glass refraction buffer; transparent objects are left out of that pass.
    vertexShader: vert, fragmentShader: frag, transparent: false, blending: THREE.CustomBlending, fog: true, // 21-2: fogged as the rest
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, defines,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime, uSun: { value: sunDir }, uLit: skyLit, uNight: nightGlow, uRain: rainNow, uPond: { value: new THREE.Vector3(pond.x, pond.z, pond.r - 0.35) } }
  });

  // --- stream ribbon: follows the shelf and drops down the cliff. At the front edge it necks into a thin
  // stream that runs down the side of the board (soil face, then the wooden base) into a small puddle on the table.
  const half = SW + 0.2, vis = SW - 0.35, THIN = 0.42, F = R[3];
  const line = [];
  const N = 360;
  for (const { p, tn } of streamLine(N)) { // 21-3b: on a wider board, carried on straight to its edge
    const k = THREE.MathUtils.smoothstep(F - p.z, 0.15, 2.2);
    // while necking, the ribbon turns square to the edge so it folds over cleanly instead of twisting into a flap
    // the soil box top (-1.45, terrain.js) stands above the rounded edge, so the water rides over it instead of diving in
    line.push({ x: p.x, z: p.z, y: Math.max(edgeRound(waterY(p.z), p.x, p.z), -1.45) + 0.04, tx: tn.x * k, tz: tn.z * k + (1 - k), w: THIN + (half - THIN) * k, k });
  }
  const sx = line[line.length - 1].x; // soil face is at F + 0.03 (y > -4.3), wooden base at F + 0.1 with a rounded top; table at -6.3
  for (const [dz, y, w] of [[0.07, -1.5, 0.4], [0.08, -1.9, 0.36], [0.08, -2.5, 0.33], [0.08, -4.15, 0.28], [0.17, -4.45, 0.27], [0.16, -5.85, 0.25], [0.34, -6.2, 0.33], [0.62, -6.31, 0.42]])
    line.push({ x: sx, y, z: F + dz, tx: 0, tz: 1, w, k: 0, side: true });
  const vtx = [], uv = [], fall = [], idx = [];
  let u = 0;
  line.forEach((q, i) => {
    let slope = 0;
    if (i > 0) { const pr = line[i - 1], dxz = Math.hypot(q.x - pr.x, q.z - pr.z); u += Math.hypot(dxz, q.y - pr.y); slope = Math.abs(q.y - pr.y) / Math.max(dxz, 1e-3); }
    const nx = -q.tz, nz = q.tx, L = Math.hypot(nx, nz), vy = 0.75 + (half / vis - 0.75) * q.k; // thin part: no white foam edges
    const f = THREE.MathUtils.clamp((slope - 0.25) * 0.9, 0, q.side ? 0.6 : 1); // thin part stays clear blue with streaks, not a white sheet
    for (const s of [-1, 1]) { vtx.push(q.x + nx / L * s * q.w, q.y, q.z + nz / L * s * q.w); uv.push(u, s * vy); fall.push(f); }
    if (i < line.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sg.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1)); sg.setIndex(idx);
  const streamMesh = new THREE.Mesh(sg, mk({})); streamMesh.renderOrder = 1; scene.add(streamMesh);

  // --- pond
  const pg = new THREE.CircleGeometry(pond.r + 0.25, 56); pg.rotateX(-Math.PI / 2);
  pg.setAttribute('aFall', new THREE.Float32BufferAttribute(new Float32Array(pg.attributes.position.count), 1));
  const pondMesh = new THREE.Mesh(pg, mk({ POND: 1 })); pondMesh.position.set(pond.x, WATER_Y + 0.04, pond.z); pondMesh.renderOrder = 1; scene.add(pondMesh);
  // puddle where the thin stream lands: same water look, small and slightly lumpy
  const PR = 0.95, pud = { x: sx + 0.1, z: F + 0.95 }, dg = new THREE.CircleGeometry(PR, 28);
  { const p = dg.attributes.position; for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), r = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5); p.setXY(i, p.getX(i) * r * 1.25, p.getY(i) * r); } }
  dg.rotateX(-Math.PI / 2); dg.setAttribute('aFall', new THREE.Float32BufferAttribute(new Float32Array(dg.attributes.position.count), 1));
  const pudMat = mk({ POND: 1 }); pudMat.uniforms.uPond.value.set(pud.x, pud.z, PR * 1.1);
  const pudMesh = new THREE.Mesh(dg, pudMat); pudMesh.position.set(pud.x, -6.27, pud.z); pudMesh.renderOrder = 1; scene.add(pudMesh);

  // --- spray where the water lands (foot of the cliff fall, and a little where the thin stream meets the puddle):
  // slow-pulsing foam puffs plus droplets that rise, drift downstream and shrink away, looping. One draw call.
  let land = line[0];
  for (const q of line) { if (q.z > CLIFF_Z + 0.2) { land = q; break; } }
  const puffs = [], drops = [];
  [{ x: land.x, y: WATER_Y + 0.05, z: land.z, w: 2.6, n: 7, s: 1 }, { x: sx, y: -6.24, z: F + 0.4, w: 0.45, n: 3, s: 0.4 }].forEach(L => {
    for (let i = 0; i < L.n; i++) puffs.push({ x: L.x + (Math.random() - 0.5) * L.w, y: L.y, z: L.z + (Math.random() - 0.3) * 0.9 * L.s, s: (0.22 + Math.random() * 0.2) * L.s, ph: Math.random() * 6 });
    for (let i = 0; i < L.n * 2; i++) drops.push({ L, ox: (Math.random() - 0.5) * L.w * 0.9, vx: (Math.random() - 0.5) * 0.8 * L.s, vz: (0.4 + Math.random() * 0.8) * L.s, up: (0.7 + Math.random() * 0.6) * L.s, s: (0.09 + Math.random() * 0.08) * L.s, ph: Math.random() });
  });
  const foam = instanced(new THREE.SphereGeometry(1, 14, 10), toyMat('#ffffff', { roughness: 0.3, transparent: true, opacity: 0.9 }), [...puffs, ...drops].map(() => ({ x: 0, y: 0, z: 0 })), { cast: false, receive: false });
  foam.renderOrder = 2; foam.frustumCulled = false; scene.add(foam);
  const m = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();

  return t => {
    uTime.value = t;
    puffs.forEach((p, i) => { const k = 0.75 + 0.35 * Math.sin(t * 5 + p.ph); foam.setMatrixAt(i, m.compose(v.set(p.x, p.y + 0.05 * Math.sin(t * 4 + p.ph), p.z), q4, sc.set(p.s * k * 1.3, p.s * k * 0.6, p.s * k))); });
    drops.forEach((d, i) => {
      const u = (t / 1.1 + d.ph) % 1, k = d.s * (1 - u) * (0.6 + u);
      foam.setMatrixAt(puffs.length + i, m.compose(v.set(d.L.x + d.ox + d.vx * u, d.L.y + 0.05 + d.up * (1.3 * u - u * u), d.L.z + d.vz * u), q4, sc.setScalar(Math.max(k, 1e-4))));
    });
    foam.instanceMatrix.needsUpdate = true;
  };
}

// 28-1 the zones' water (zones.js zoneSet): every pool a disc at its own level (the lowest of its waterline) whose aFall
// carries the depth under it (BED, as the pond's), the rills ribbons along their beds, the falls ribbons down their rock.
// cold: the snow's colours (the hot spring keeps the warm ones). One draw call a pool / rill; built once per board.
// inbox 34: a long pool (len) is a capsule, its rings out from its middle line (zones.js poolAt); murk: the swamp's dark water
export function zoneWater(scene, sunDir, heightAt, Z, { cold = false } = {}) {
  const uTime = { value: 0 }, C = THREE.MathUtils.clamp;
  const mk = defines => new THREE.ShaderMaterial({ // as buildWater's
    vertexShader: vert, fragmentShader: frag, transparent: false, blending: THREE.CustomBlending, fog: true,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, defines,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime, uSun: { value: sunDir }, uLit: skyLit, uNight: nightGlow, uRain: rainNow, uPond: { value: new THREE.Vector3() } }
  });
  const add = (vtx, uv, fall, idx, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.renderOrder = 1; scene.add(m); return m;
  };
  const levels = [];
  for (const p of Z.pools) {
    const wl = p.r - (p.hot ? 0.7 : 0.4); let y = Infinity;
    const L = p.len || 0, NS = L ? 64 : 32;
    for (let i = 0; i < NS; i++) { const [x, z] = poolAt(p, i / NS, wl); y = Math.min(y, heightAt(x, z)); }
    y += 0.02; levels.push(y);
    const NR = 12, Ro = wl + 0.5, NA = L ? Math.max(48, Math.round((2 * Math.PI * Ro + 2 * L) / 0.6)) : 48, vtx = [], fall = [], idx = [];
    const fallOf = (x, z) => { const h = heightAt(x, z); return 1 - C((y - h) / 1.4, 0, 1) + Math.max(0, h - y); };
    for (let j = 0; j <= NR; j++) for (let i = 0; i < NA; i++) {
      const [ox, oz, cx, cz] = poolAt(p, i / NA, Ro), k = j / NR, x = cx + (ox - cx) * k, z = cz + (oz - cz) * k;
      vtx.push(x, y, z); fall.push(fallOf(x, z));
      if (j) { const c = j * NA + i, n = j * NA + (i + 1) % NA; idx.push(c - NA, n - NA, n, c - NA, n, c); }
    }
    const def = cold && !p.hot ? { POND: 1, BED: 1, COLD: 1 } : { POND: 1, BED: 1 };
    if (p.murk) def.MURK = 1;
    add(vtx, new Array(vtx.length / 3 * 2).fill(0), fall, idx, mk(def));
  }
  // a ribbon along pts (resampled every 0.25), y(x, z, i) its height, w its half-width, vis where the bank shows
  const ribbon = (pts, w, vis, y, slopeFall, mat) => {
    const P = [];
    for (let i = 1; i < pts.length; i++) {
      const [x1, z1] = pts[i - 1], [x2, z2] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.25));
      for (let j = i > 1 ? 1 : 0; j <= n; j++) P.push([x1 + (x2 - x1) * j / n, z1 + (z2 - z1) * j / n]);
    }
    const vtx = [], uv = [], fall = [], idx = [], vy = w / vis; let u = 0, py = 0;
    P.forEach(([x, z], i) => {
      const [ax, az] = P[Math.max(0, i - 1)], [bx, bz] = P[Math.min(P.length - 1, i + 1)], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
      const h = y(x, z, nx, nz); let f = 0;
      if (i) { const dxz = Math.hypot(x - P[i - 1][0], z - P[i - 1][1]); u += Math.hypot(dxz, h - py); if (slopeFall) f = C((Math.abs(h - py) / dxz - 0.25) * 0.9, 0, 1); }
      py = h;
      for (const s of [-1, 1]) { vtx.push(x + nx * s * w, h, z + nz * s * w); uv.push(u, s * vy); fall.push(f); }
      if (i < P.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    return add(vtx, uv, fall, idx, mat);
  };
  // rills: the water at the lower of the two waterlines across (its bed is bank(): the waterline 0.4 in from w)
  for (const f of Z.rills) {
    const wl = f.w - 0.4;
    ribbon(f.pts, wl + 0.2, wl, (x, z, nx, nz) => Math.min(heightAt(x + nx * wl, z + nz * wl), heightAt(x - nx * wl, z - nz * wl)) + 0.03, false, mk(cold ? { COLD: 1 } : {}));
  }
  // falls: down the rock from its top into the pool below, a little over the ground
  for (const f of Z.falls) {
    const [x1, z1] = f.from, [x2, z2] = f.to;
    let low = heightAt(x2, z2), best = Infinity; // the level of the pool it falls into
    Z.pools.forEach((p, i) => { const d = Math.hypot(p.x - x2, p.z - z2); if (d < best) { best = d; low = levels[i]; } });
    ribbon([[x1, z1], [x2, z2]], f.w, f.w * 0.75, (x, z) => Math.max(heightAt(x, z) + 0.07, low + 0.03), true, mk(cold ? { COLD: 1 } : {}));
  }
  return t => { uTime.value = t; };
}
