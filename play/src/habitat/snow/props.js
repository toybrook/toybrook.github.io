// Snow props: the meadow's planting kit (meadow/props.js kit / natives / finish) on the snow layout. Snowy pines along the
// back and in the corners, big stones round the mounds' feet and on the bank (a cap of snow on each), ice chips on the water.
import * as THREE from 'three';
import { S, O, Z, pond, shoreR, isle, mounds, heightAt, occupied, free, rand, WATER_Y } from './layout.js';
import { zoneProps } from '../zoneprops.js';
import { kit, emptyL, natives, finish } from '../meadow/props.js';
import { toyMat, instanced } from '../toyKit.js';

const n2 = n => Math.round(n * S * S);
export function buildProps(scene) {
  const L = emptyL(), N = natives(occupied, 'snow');
  const { snowpine: pine, rock: stone } = kit(L, { rand, heightAt, occupied }), nk = kit(N.Ls, { rand, heightAt, occupied });
  const caps = [];
  const rock = (x, z, s) => { stone(x, z, s); const r = L.rock.at(-1); caps.push({ x: r.x, y: r.y + r.s[1] * 0.78, z: r.z, s: [r.s[0] * 0.7, r.s[1] * 0.32, r.s[2] * 0.7], ry: r.ry, c: '#f6f9fc' }); };
  const onPond = (a, s) => { const r = shoreR(a) + s; return [pond.x + Math.cos(a) * r, pond.z + Math.sin(a) * r]; };

  // the back: a row of snowy pines (part of the board)
  for (let i = 0; i < n2(80); i++) {
    const x = (-17 + rand() * 34) * S, z = (-28.4 + rand() * 4.2) * S;
    if (free(x, z, 1.0)) pine(x, z, 0.85 + rand() * 0.5);
  }
  // the mounds: big stones round the foot, an open gap on the side toward the pond (the owl's way up)
  for (const m of mounds) {
    const gap = Math.atan2(pond.z - m.z, pond.x - m.x), n = Math.round(7 * m.r / 3);
    for (let i = 0; i < n; i++) {
      const a = gap + 0.75 + i / (n - 1) * (2 * Math.PI - 1.5) + (rand() - 0.5) * 0.2, d = m.r * (0.78 + rand() * 0.12);
      rock(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, (0.55 + rand() * 0.4) * Math.min(1, m.h));
    }
  }
  // pines in the corners and along the sides (the natives: moved, cut and planted again by the player)
  [[-14.5, -20.5], [14.2, -20.6], [8.6, -21.6], [-13.5, 24.5], [-15.4, 14.5], [15, 25.8], [15.4, 10.5], [-15.6, -5.5]]
    .forEach(([x, z]) => { x *= S; z *= S; if (free(x, z, 1.4)) N.add('snowpine', nk.snowpine, x, z, 0.9 + rand() * 0.35); });
  // stones on the bank, a few out in the snow
  for (let i = 0; i < Math.round(14 * S); i++) rock(...onPond(rand() * 6.28, 0.4 + rand() * 0.5), 0.3 + rand() * 0.35);
  for (let i = 0; i < n2(7); i++) { const x = (-15 + rand() * 30) * S, z = (-20 + rand() * 46) * S; if (free(x, z, 1)) N.add('rock', nk.rock, x, z, 0.4 + rand() * 0.45); }

  // ice chips: flat broken pieces floating off the shore and round the floes
  const chips = [];
  for (let i = 0; i < n2(30); i++) {
    const [x, z] = onPond(rand() * 6.28, -0.9 - rand() * 5.5); if (isle(x, z) < 0.5) continue;
    const s = 0.25 + rand() * 0.45; chips.push({ x, y: WATER_Y + 0.05, z, s: [s * (1 + rand() * 0.5), 0.1, s], ry: rand() * 6, c: rand() < 0.5 ? '#eef7fb' : '#dcedf5' });
  }
  scene.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 6), toyMat('#ffffff', { roughness: 0.18 }), chips, { cast: false }));
  scene.add(instanced(new THREE.SphereGeometry(1, 14, 8), toyMat('#ffffff', { roughness: 0.62 }), caps, { cast: false }));

  const zp = zoneProps(scene, 'snow', { L, N, heightAt, occupied, free, O, Z, back: -24.2 });
  const list = N.done();
  return { natives: list, zone: zp, ...finish(scene, L, { rand, occupied }) };
}
