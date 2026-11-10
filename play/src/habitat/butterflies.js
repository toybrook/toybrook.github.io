// 23-2 세트 보너스 (looks only): over a habitat where a whole 소품 세트 stands, one small toy butterfly circles each prop
// of it by day (a set's own colour); at night they glow faintly and slow down, in the rain they are gone. One draw call
// (an InstancedMesh of wings, two a butterfly).
import * as THREE from 'three';

const COL = { garden: '#ff9fbf', ranch: '#ffd75e', woods: '#ff9c4a', water: '#7fd0ff', night: '#e6ff9a', play: '#c9a6ff', toys: '#ff9a7a' };
const MAX = 24;

export function butterflies(scene) {
  const wing = new THREE.CircleGeometry(0.15, 14).scale(1, 1.25, 1).translate(0.15, 0, 0).rotateX(-Math.PI / 2); // a round wing hinged at x = 0
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide, emissive: '#fff4c4', emissiveIntensity: 0 });
  const mesh = new THREE.InstancedMesh(wing, mat, MAX * 2), d = new THREE.Object3D(), c = new THREE.Color();
  mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh); d.rotation.order = 'YZX';
  let B = [];
  // sets: [{ id, spots: [{ x, y, z, r, h }] }] (the props of each whole set here)
  function set(sets) {
    B = sets.flatMap(s => s.spots.map(o => ({ o, set: s.id, p: Math.random() * 6.28, s: 0.8 + Math.random() * 0.4, dir: Math.random() < 0.5 ? 1 : -1 }))).slice(0, MAX);
    B.forEach((b, i) => { c.set(COL[b.set] || '#fff'); mesh.setColorAt(2 * i, c); mesh.setColorAt(2 * i + 1, c); });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = B.length * 2;
  }
  function tick(t, night, rain) {
    mesh.visible = B.length > 0 && rain < 0.3; if (!mesh.visible) return;
    const slow = 1 - 0.6 * night; mat.emissiveIntensity = 0.7 * night;
    B.forEach((b, i) => {
      const { o } = b, th = b.dir * (t * 0.7 * b.s * slow) + b.p, rr = o.r + 0.45 + 0.25 * Math.sin(t * 0.5 + b.p);
      d.position.set(o.x + Math.cos(th) * rr, o.y + Math.min(o.h, 2.2) * 0.55 + 0.6 + 0.3 * Math.sin(t * 1.3 * b.s + b.p), o.z + Math.sin(th) * rr);
      const yaw = Math.atan2(-Math.sin(th) * b.dir, Math.cos(th) * b.dir), a = 0.2 + 1.0 * Math.abs(Math.sin(t * 11 * b.s * slow + b.p));
      for (const k of [0, 1]) { d.rotation.set(0, yaw, k ? -a : a); d.scale.set(k ? -1 : 1, 1, 1); d.updateMatrix(); mesh.setMatrixAt(2 * i + k, d.matrix); }
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { set, tick };
}
