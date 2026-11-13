// Animals never overlap. Every actor keeps its body { x, z, yaw, r, seg } in ctx.crowd (a Set habitat.js makes).
// Seen from above a body fits in a capsule: the line seg = [back, front] along its facing (model x), thickened by r
// (MODELS[model][stage], measured from the GLBs). One circle round a long body would waste half the pond.
// free: nobody's capsule touches mine at this spot. blocked: this step would bring me into someone's AND closer to
// them (stepping away is always allowed, so two that start overlapping can part); it returns that someone, or null.
const line = (b, x = b.x, z = b.z, yaw = b.yaw) => { const c = Math.cos(yaw), s = -Math.sin(yaw); return [x + c * b.seg[0], z + s * b.seg[0], x + c * b.seg[1], z + s * b.seg[1]]; };
const toSeg = (px, pz, [ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const side = (ax, az, bx, bz, px, pz) => (bx - ax) * (pz - az) - (bz - az) * (px - ax);
function gap(A, B) { // between two lines; 0 if they cross
  if (side(...A, B[0], B[1]) * side(...A, B[2], B[3]) < 0 && side(...B, A[0], A[1]) * side(...B, A[2], A[3]) < 0) return 0;
  return Math.min(toSeg(A[0], A[1], B), toSeg(A[2], A[3], B), toSeg(B[0], B[1], A), toSeg(B[2], B[3], A));
}
// 69-2 쓰다듬기: which third of the capsule (along its facing) the world point x, z is over: 'head' front, 'rump' back, else 'back'.
// hd [u, y]: where its head is (MODELS attach.head, world units: along its facing, over its feet). A head that is not out in front
// (an upright penguin, owl, a baby duck) is told by height instead: y, the point's height over its feet, up near the head's
export function partAt(b, x, z, y = 0, hd = null) { const u = (x - b.x) * Math.cos(b.yaw) - (z - b.z) * Math.sin(b.yaw), k = (b.seg[1] - b.seg[0] + 2 * b.r) / 3, f = b.seg[1] + b.r - k;
  return (hd && hd[0] <= f ? y > hd[1] * 0.85 : u > f) ? 'head' : u < b.seg[0] - b.r + k ? 'rump' : 'back'; }
export const gapTo = (b, ax, az, bx, bz) => gap(line(b), [ax, az, bx, bz]); // from b's capsule line to the line a-b
// inbox 36: too far apart to touch (centre to centre past both reaches): no need to look closer
const reach = b => Math.max(-b.seg[0], b.seg[1]) + b.r, far = (o, me, x, z) => (x - o.x) ** 2 + (z - o.z) ** 2 >= (reach(o) + reach(me)) ** 2;
export const free = (crowd, me, x, z, yaw = me.yaw) => { const L = line(me, x, z, yaw); for (const o of crowd) if (o !== me && !far(o, me, x, z) && gap(L, line(o)) < o.r + me.r) return false; return true; };
export function blocked(crowd, me, x, z, yaw = me.yaw) {
  const L = line(me, x, z, yaw); let now;
  for (const o of crowd) { if (o === me || far(o, me, x, z)) continue; const O = line(o), d = gap(L, O); if (d < o.r + me.r && d < gap(now ??= line(me), O)) return o; }
  return null;
}
// two horses side by side touch at 2r apart; nose to tail at the sum of their reaches
export function selfCheck() {
  const h = { x: 0, z: 0, yaw: 0, r: 0.5, seg: [-1, 1] }, o = { ...h }, set = new Set([h, o]);
  const at = (x, z, yaw = 0) => { Object.assign(o, { x, z, yaw }); return free(set, h, 0, 0); };
  console.assert(!at(0, 0.9) && at(0, 1.1) && !at(2.9, 0) && at(3.1, 0) && !at(0, 0, Math.PI / 2) && at(2, 2, Math.PI / 2), 'crowd.selfCheck');
  Object.assign(o, { x: 0, z: 0.9, yaw: 0 }); console.assert(!blocked(set, h, 0, -0.1) && blocked(set, h, 0, 0.1), 'crowd.selfCheck blocked');
  return 'ok';
}
