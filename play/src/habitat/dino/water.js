// The lagoon's water: the snow's disc (snow/water.js) in the meadow's water shader as the pond's (no COLD).
import * as THREE from 'three';
import { pond, shoreR, heightAt, WATER_Y } from './layout.js';
import { vert, frag } from '../meadow/water.js';
import { skyLit, nightGlow, rainNow, snowNow } from '../toyKit.js';

export function buildWater(scene, sunDir) {
  const uTime = { value: 0 };
  const mat = new THREE.ShaderMaterial({ // as the pond's: alpha-blended but flagged opaque, drawn after the ground
    vertexShader: vert, fragmentShader: frag, transparent: false, blending: THREE.CustomBlending, fog: true,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, defines: { POND: 1, BED: 1 },
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime, uSun: { value: sunDir }, uLit: skyLit, uNight: nightGlow, uRain: rainNow, uIce: snowNow, uPond: { value: new THREE.Vector3() } }
  });
  const Y = WATER_Y + 0.04, fallOf = (x, z) => 1 - THREE.MathUtils.clamp((WATER_Y - heightAt(x, z)) / 1.4, 0, 1) + Math.max(0, heightAt(x, z) - WATER_Y);
  const NA = 96, NR = 30, vtx = [pond.x, Y, pond.z], fall = [fallOf(pond.x, pond.z)], idx = [];
  for (let j = 1; j <= NR; j++) for (let i = 0; i < NA; i++) {
    const a = i / NA * Math.PI * 2, R = shoreR(a) + 0.5, x = pond.x + Math.cos(a) * R * j / NR, z = pond.z + Math.sin(a) * R * j / NR;
    vtx.push(x, Y, z); fall.push(fallOf(x, z));
    const c = 1 + (j - 1) * NA + i, n = 1 + (j - 1) * NA + (i + 1) % NA;
    if (j === 1) idx.push(0, n, c); else idx.push(c - NA, n - NA, n, c - NA, n, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vtx.length / 3 * 2), 2));
  g.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.renderOrder = 1; scene.add(m);
  return t => { uTime.value = t; };
}
