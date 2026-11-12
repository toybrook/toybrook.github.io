// Growth stages shared by every species: 알 -> 새끼 -> 성체. The egg wears its rarity's material
// (materials.js eggMat); hatching = wobble, crack, break (shells fly and vanish), under 2 s.
import * as THREE from 'three';
import { toyMat } from '../habitat/toyKit.js';
import { wear } from './materials.js';

export const STAGE_NAME = { egg: '알', baby: '새끼', adult: '성체' };
export const HATCH = { crack: 0.75, pop: 1.15, end: 1.85 }; // seconds after the tap

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
  return { whole, shards, nest };
})();
const nestMat = toyMat('#c79a5c', { roughness: 0.85 });
const ss = THREE.MathUtils.smoothstep;

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

// mat: the rarity body material (shared, so a hatching egg compiles no new shader).
export function makeEgg(mat) {
  const group = new THREE.Group(), pivot = new THREE.Group();
  const nest = new THREE.Mesh(EGG.nest, nestMat); group.add(nest, pivot);
  nest.renderOrder = 4; // after glass: the back of the nest seen through a glass egg read as a line of liquid half-way up
  pivot.position.y = 0.06;
  const whole = wear(new THREE.Mesh(EGG.whole, mat)); pivot.add(whole);
  const shards = EGG.shards.map(s => { const m = new THREE.Group(), o = wear(new THREE.Mesh(s.g, mat)); o.position.copy(s.c).negate(); m.add(o); m.position.copy(s.c); m.visible = false; pivot.add(m); return m; });
  return {
    group,
    // t = seconds since the tap. Returns true once the shell is gone.
    hatch(t) {
      if (t < HATCH.crack) { // wobble: builds up, rocks on the base
        const k = ss(t, 0, 0.15); pivot.rotation.z = 0.2 * Math.sin(t * 22) * k; pivot.rotation.x = 0.08 * Math.sin(t * 17) * k;
        return false;
      }
      whole.visible = false;
      EGG.shards.forEach((s, i) => {
        const m = shards[i]; m.visible = true;
        if (t < HATCH.pop) { m.position.copy(s.c).addScaledVector(s.dir, 0.035 * ss(t, HATCH.crack, HATCH.pop)); return; } // cracks open
        const u = t - HATCH.pop; // break: pop outwards and up, tumble, shrink away
        m.position.copy(s.c).addScaledVector(s.dir, 0.035 + 1.5 * u); m.position.y += 2.6 * u - 5.5 * u * u;
        m.rotation.set(s.dir.z * u * 9, 0, -s.dir.x * u * 9);
        m.scale.setScalar(1 - ss(u, 0.3, HATCH.end - HATCH.pop));
      });
      pivot.rotation.z = t < HATCH.pop ? 0.05 * Math.sin(t * 70) : 0;
      nest.scale.setScalar(1 - ss(t, HATCH.pop + 0.2, HATCH.end));
      return t >= HATCH.end;
    },
  };
}
