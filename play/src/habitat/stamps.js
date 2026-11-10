// 28-6 지형 도장: the stamps standing on the board now ({ x, z, r, h }: h up at its middle, < 0 a dip), added to each layout's
// heightAt (so the ground mesh, the props, the animals' feet and the camera all see them). habitat.js keeps the list.
export const stamps = [];
const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
// a mound: round topped, easing out to nothing at r; a dip: a flat floor, its rim rising from 0.45 r
export const shape = (h, t) => t >= 1 ? 0 : h > 0 ? h * (1 - t * t) ** 2 : h * (1 - sm((t - 0.45) / 0.55));
export function bump(x, z) {
  let y = 0;
  for (const s of stamps) { const dx = x - s.x, dz = z - s.z; if (Math.abs(dx) < s.r && Math.abs(dz) < s.r) y += shape(s.h, Math.hypot(dx, dz) / s.r); }
  return y;
}
