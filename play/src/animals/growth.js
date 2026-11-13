// Growth stages shared by every species: 알 -> 새끼 -> 성체. The egg wears its rarity's material
// (materials.js eggMat); hatching = wobble, crack, break (shells fly and vanish), under 2 s.
// 69-1 부화 5박자 (same length): wobble -> cracks run over it -> they light up in the rarity's own colour (the real result,
// nest.js passes it) -> it breaks -> the friend (nest.js: the figure, then the card).
import * as THREE from 'three';
import { toyMat } from '../habitat/toyKit.js';
import { wear } from './materials.js';

export const STAGE_NAME = { egg: '알', baby: '새끼', adult: '성체' };
export const HATCH = { crack: 0.45, glow: 0.8, pop: 1.15, end: 1.85 }; // seconds after the tap (69-1: crack 0.75 -> 0.45, glow new)

// Egg profile: blunt, slightly wider bottom. Height 1.2, base at y=0.
const H = 1.2, R = 0.44, CAP = 0.62 * Math.PI, WEDGES = 5;
const prof = (a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (a1 - a0) * i / n; return new THREE.Vector2(Math.sin(a) * R * (1 + 0.1 * Math.cos(a)), (1 - Math.cos(a)) * H / 2);
});
// Patterns are object-space, so the pieces keep the whole egg's coordinates (shards spin in a wrapper group).
// _thickness: distance through the egg along the normal, for the glass tint (same attribute the baked figures
// carry). About the width everywhere on an egg; one value, so no ring around the middle is thicker than the ends.
function piece(a0, a1, seg, phi0 = 0, phiL = Math.PI * 2) {
  const g = new THREE.LatheGeometry(prof(a0, a1), seg, phi0, phiL);
  g.setAttribute('_thickness', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(0.9), 1));
  g.setAttribute('_op', new THREE.BufferAttribute(g.attributes.position.array.map(v => v / H), 3)); // pattern space (materials.js): height 1
  return g;
}
const EGG = (() => {
  const whole = piece(0, Math.PI, 36);
  const parts = [piece(CAP, Math.PI, 36)];
  for (let w = 0; w < WEDGES; w++) parts.push(piece(0, CAP, 8, w * Math.PI * 2 / WEDGES, Math.PI * 2 / WEDGES));
  // centre each shard on its own origin so it spins around itself; remember where it sat and where it flies
  const shards = parts.map((g, i) => {
    g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
    const dir = i === 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(c.x, 0.35, c.z).normalize();
    return { g, c, dir };
  });
  // straw nest: lumpy flat ring
  const nest = new THREE.TorusGeometry(0.46, 0.15, 8, 24); nest.rotateX(Math.PI / 2);
  const np = nest.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), z = np.getZ(i), k = 1 + 0.06 * Math.sin(Math.atan2(z, x) * 9) + 0.04 * Math.sin(x * 23 + z * 17); np.setXYZ(i, x * k, np.getY(i) * (0.8 + 0.2 * k), z * k); }
  nest.computeVertexNormals();
  // 69-1 금: zigzag seams just over the shell where the shards part (the cap's ring, the wedges' edges), drawn in as they run
  const on = (a, f, k = 1.012) => { const r = prof(a, a, 1)[0]; return new THREE.Vector3(r.x * Math.sin(f) * k, r.y, r.x * Math.cos(f) * k); };
  const tube = pts => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), pts.length * 3, 0.014, 5);
  const ring = Array.from({ length: 41 }, (_, i) => on(CAP + (i % 2 ? 0.05 : -0.05), i / 40 * Math.PI * 2));
  const seams = [tube(ring), ...Array.from({ length: WEDGES }, (_, w) => tube(Array.from({ length: 9 }, (_, i) => on(CAP - i / 8 * 0.62 * CAP, w * Math.PI * 2 / WEDGES + (i % 2 ? 0.06 : -0.06) * (i ? 1 : 0)))))];
  return { whole, shards, nest, seams };
})();
const nestMat = toyMat('#c79a5c', { roughness: 0.85 });
const ss = THREE.MathUtils.smoothstep;
// 69-1 예고 빛: how much of the rarity's light shows at t (the seams, and nest.js's glow behind the egg)
export const glowAt = t => ss(t, HATCH.glow, HATCH.glow + 0.15) * (1 - ss(t, HATCH.pop + 0.05, HATCH.pop + 0.45));
const SEAM = new THREE.Color('#5a3f2a');

// Sent out from the nest menu: falls in from above, lands with a squash ("퐁"), one small bounce. t = seconds since the drop.
export const DROP = { fall: 0.45, end: 0.95, h: 6, carry: 1.2 }; // inbox 42 E: carry, how high one held up hangs
// the drop's time when it is `lift` up (a carried one let go falls from there, not from DROP.h)
export const dropFrom = lift => lift > 0 ? DROP.fall * Math.sqrt(Math.max(0, 1 - lift / DROP.h)) : 0;
// inbox 42 E: held up, a little dangle (rot: nose up +, roll: about its length)
export const dangle = (t, ph = 0) => ({ rot: -0.05 + Math.sin(t * 2.1 + ph) * 0.05, roll: Math.sin(t * 3.2 + ph) * 0.13 });
export function dropPose(t) {
  if (t < DROP.fall) { const k = t / DROP.fall; return { lift: DROP.h * (1 - k * k), sq: 1.06 }; }
  const k = Math.min(1, (t - DROP.fall) / (DROP.end - DROP.fall));
  return { lift: Math.sin(k * Math.PI) * 0.5, sq: k < 0.18 ? 0.78 + k / 0.18 * 0.22 : 1 };
}

// mat: the rarity body material (shared, so a hatching egg compiles no new shader). light: the colour the seams light up in
// (69-1: the rarity that really came out; none: they stay dark)
export function makeEgg(mat, light) {
  const group = new THREE.Group(), pivot = new THREE.Group();
  const nest = new THREE.Mesh(EGG.nest, nestMat); group.add(nest, pivot);
  nest.renderOrder = 4; // after glass: the back of the nest seen through a glass egg read as a line of liquid half-way up
  pivot.position.y = 0.06;
  const whole = wear(new THREE.Mesh(EGG.whole, mat)); pivot.add(whole);
  const shards = EGG.shards.map(s => { const m = new THREE.Group(), o = wear(new THREE.Mesh(s.g, mat)); o.position.copy(s.c).negate(); m.add(o); m.position.copy(s.c); m.visible = false; pivot.add(m); return m; });
  const seamMat = new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }), lit = light ? new THREE.Color(light).lerp(new THREE.Color('#fff'), 0.35) : SEAM;
  const seams = EGG.seams.map((g, i) => { const m = new THREE.Mesh(g, seamMat); m.visible = false; m.userData.d = i ? 0.06 + i * 0.03 : 0; pivot.add(m); return m; });
  return {
    group,
    // t = seconds since the tap. Returns true once the shell is gone.
    hatch(t) {
      if (t < HATCH.pop) { // wobble (builds up, rocks on the base), easing into a tremble while the seams run and light up
        const k = ss(t, 0, 0.15), c = ss(t, HATCH.crack - 0.08, HATCH.crack + 0.08);
        pivot.rotation.z = (0.2 * Math.sin(t * 22) * k) * (1 - c) + 0.05 * Math.sin(t * 70) * c; pivot.rotation.x = 0.08 * Math.sin(t * 17) * k * (1 - c);
        for (const m of seams) { // 금: each seam drawn in from its start (the ring first, then the edges down the sides)
          const q = ss(t, HATCH.crack + m.userData.d, HATCH.glow), n = m.geometry.index.count, r = 6 * m.geometry.parameters.radialSegments;
          m.visible = q > 0; m.geometry.setDrawRange(0, Math.ceil(q * n / r) * r);
        }
        seamMat.color.copy(SEAM).lerp(lit, glowAt(t)); // 예고 빛: the seams take the rarity's light
        return false;
      }
      whole.visible = false; for (const m of seams) m.visible = false;
      EGG.shards.forEach((s, i) => { // break: pop outwards and up along the seams, tumble, shrink away
        const m = shards[i], u = t - HATCH.pop; m.visible = true;
        m.position.copy(s.c).addScaledVector(s.dir, 1.5 * u); m.position.y += 2.6 * u - 5.5 * u * u;
        m.rotation.set(s.dir.z * u * 9, 0, -s.dir.x * u * 9);
        m.scale.setScalar(1 - ss(u, 0.3, HATCH.end - HATCH.pop));
      });
      pivot.rotation.set(0, 0, 0);
      nest.scale.setScalar(1 - ss(t, HATCH.pop + 0.2, HATCH.end));
      return t >= HATCH.end;
    },
  };
}
