// Pond + spring stream water: the meadow's water shader (meadow/water.js). The pond surface is a disc whose aFall carries
// the depth under it (BED: 1 at the waterline, 0 where deep), so the shallow rim and the island's edge read paler with foam.
import * as THREE from 'three';
import { pond, shore, shoreR, stream, SW, waterY, heightAt, WATER_Y } from './layout.js';
import { vert, frag } from '../meadow/water.js';
import { skyLit, nightGlow, rainNow, snowNow } from '../toyKit.js';

export function buildWater(scene, sunDir) {
  const uTime = { value: 0 };
  const mk = defines => new THREE.ShaderMaterial({ // as in the meadow: alpha-blended but flagged opaque, drawn after the ground
    vertexShader: vert, fragmentShader: frag, transparent: false, blending: THREE.CustomBlending, fog: true,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, defines,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime, uSun: { value: sunDir }, uLit: skyLit, uNight: nightGlow, uRain: rainNow, uIce: snowNow, uPond: { value: new THREE.Vector3() } }
  });
  const Y = WATER_Y + 0.04, fallOf = (x, z) => 1 - THREE.MathUtils.clamp((WATER_Y - heightAt(x, z)) / 1.4, 0, 1) + Math.max(0, heightAt(x, z) - WATER_Y);

  // --- pond: rings out to just past the shore (under the bank there)
  const NA = 96, NR = 30, vtx = [], fall = [], idx = [];
  vtx.push(pond.x, Y, pond.z); fall.push(fallOf(pond.x, pond.z));
  for (let j = 1; j <= NR; j++) for (let i = 0; i < NA; i++) {
    const a = i / NA * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const R = shoreR(a) + 0.5; // edge: 0.5 past the shore line, under the bank
    const x = pond.x + dx * R * j / NR, z = pond.z + dz * R * j / NR; vtx.push(x, Y, z); fall.push(fallOf(x, z));
    const c = 1 + (j - 1) * NA + i, n = 1 + (j - 1) * NA + (i + 1) % NA;
    if (j === 1) idx.push(0, n, c); else idx.push(c - NA, n - NA, n, c - NA, n, c);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vtx.length / 3 * 2), 2));
  pg.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1)); pg.setIndex(idx);
  const pondMesh = new THREE.Mesh(pg, mk({ POND: 1, BED: 1 })); pondMesh.renderOrder = 1; scene.add(pondMesh);

  // --- stream ribbon from the spring to the pond (stops where it meets the pond surface)
  const half = SW + 0.3, vy = half / SW, sv = [], suv = [], sf = [], si = [];
  let u = 0, prev = null, n = 0;
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, p = stream.getPointAt(t), tn = stream.getTangentAt(t);
    if (shore(p.x, p.z) < -0.4) break;
    const y = waterY(p.z) + 0.04;
    if (prev) u += Math.hypot(p.x - prev.x, p.z - prev.z, y - prev.y);
    for (const s of [-1, 1]) { sv.push(p.x - tn.z * s * half, y, p.z + tn.x * s * half); suv.push(u, s * vy); sf.push(0); }
    if (n) { const a = (n - 1) * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    prev = { x: p.x, z: p.z, y }; n++;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
  sg.setAttribute('aFall', new THREE.Float32BufferAttribute(sf, 1)); sg.setIndex(si);
  const streamMesh = new THREE.Mesh(sg, mk({})); streamMesh.renderOrder = 1; scene.add(streamMesh);

  return t => { uTime.value = t; };
}
