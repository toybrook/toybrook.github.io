import * as THREE from 'three';
import { instanced, nightGlow } from './toyKit.js';

// 194-7 (?th194, decor-redesign.md 5-3 ⑤): a lamp's light on the ground without a light: a soft disc under each lit prop, added on
// (additive, no depth write), fading out to its edge and in with the night (nightGlow). One instanced draw for every lamp.
// 195 B-8 1-3: fades into the fog as the ground does (the alpha, not the colour: added on); not drawn at all by day (night(n)).
// items: [{ x, y, z, s: radius, c: colour }]
export function glowLayer(scene) {
  const geo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uNight: nightGlow }, fog: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `varying vec2 vP; varying vec3 vC;
      #include <fog_pars_vertex>
      void main(){ vP = position.xz; vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
        #endif
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uNight; varying vec2 vP; varying vec3 vC;
      #include <fog_pars_fragment>
      void main(){ float a = pow(1.0 - smoothstep(0.0, 1.0, length(vP)), 1.6) * 0.4 * uNight;
        #ifdef USE_FOG
        #ifdef FOG_EXP2
        a *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
        a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        #endif
        gl_FragColor = vec4(vC, a);
        #include <colorspace_fragment>
      }`,
  });
  let mesh = null, lit = true;
  const drop = () => { if (mesh) { scene.remove(mesh); mesh.dispose(); mesh = null; } };
  return {
    set(items) { drop(); if (items.length) { mesh = instanced(geo, mat, items, { cast: false, receive: false }); mesh.renderOrder = 2; mesh.visible = lit; scene.add(mesh); } },
    night(n) { lit = n > 0.02; if (mesh) mesh.visible = lit; }, // every frame (habitat.js): by day no draw call
    dispose() { drop(); geo.dispose(); mat.dispose(); },
  };
}
