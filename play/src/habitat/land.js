// inbox 42 B 울타리·끼임: which walkable ground joins which. ok(x, z) on a 0.5 grid over the board, 4-connected into lands; links:
// pairs of spots joined another way (a bridge's two landings: one land, though no cell path). A ring of fences closed all round is a
// land of its own. A gap counts as open only if a walker fits through: ok keeps 0.6 off a fence and r + 0.6 off a prop, so an open
// gap is 1.7 or more across, wider than the widest body (the horse, 1.1). habitat.js ctx.land makes it again when the props change.
export function landOf([x0, x1, z0, z1], ok, links = [], s = 0.5) {
  const nx = Math.floor((x1 - x0) / s) + 1, nz = Math.floor((z1 - z0) / s) + 1, N = nx * nz, lab = new Int32Array(N).fill(-1), q = new Int32Array(N), size = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (ok(x0 + i * s, z0 + j * s)) lab[j * nx + i] = -2;
  const nbr = (k, f) => { const i = k % nx; if (i > 0) f(k - 1); if (i < nx - 1) f(k + 1); if (k >= nx) f(k - nx); if (k < N - nx) f(k + nx); };
  for (let c = 0; c < N; c++) if (lab[c] === -2) {
    const L = size.length; let h = 0, t = 0; q[t++] = c; lab[c] = L;
    while (h < t) nbr(q[h++], n => { if (lab[n] === -2) { lab[n] = L; q[t++] = n; } });
    size.push(t);
  }
  const at = k => [x0 + (k % nx) * s, z0 + Math.floor(k / nx) * s];
  const cell = (x, z) => { const i = Math.round((x - x0) / s), j = Math.round((z - z0) / s); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  // the nearest cell (rings out to R) with a land where test(x, z, land) holds: [x, z, land, cell]
  function near(x, z, test = () => true, R = 2 * Math.max(nx, nz)) {
    const ci = Math.round((x - x0) / s), cj = Math.round((z - z0) / s);
    for (let r = 0; r <= R; r++) {
      let best = null, bd = Infinity;
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const k = j * nx + i, L = lab[k]; if (L < 0) continue;
        const [px, pz] = at(k), d = Math.hypot(px - x, pz - z); if (d < bd && test(px, pz, L)) { best = [px, pz, L, k]; bd = d; }
      }
      if (best) return best;
    }
    return null;
  }
  const id = (x, z) => { const k = cell(x, z); return k >= 0 && lab[k] >= 0 ? lab[k] : near(x, z, undefined, 2)?.[2] ?? -1; }; // a step off the grid: the land beside it
  // linked lands are one (union-find over the links' two ends)
  const up = size.map((_, i) => i), root = L => L < 0 ? -1 : up[L] === L ? L : (up[L] = root(up[L]));
  for (const [a, b] of links) { const p = root(id(a.x, a.z)), r = root(id(b.x, b.z)); if (p >= 0 && r >= 0 && p !== r) up[p] = r; }
  const area = new Map(); size.forEach((n, L) => area.set(root(L), (area.get(root(L)) || 0) + n * s * s));
  const main = [...area].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
  return {
    id, root, main, near, area: L => area.get(root(L)) || 0, cells: L => size[L] * s * s,
    // a spot anywhere on land L (a far walk); null: none found
    spot(L) { if (!(size[L] > 0)) return null; for (let t = 0; t < 60; t++) { const k = Math.floor(Math.random() * N); if (lab[k] === L) return at(k); } return null; },
    // a way from a to b over the cells of one land, the bends only (clear(x1, z1, x2, z2): a straight leg may be walked); ends off
    // the grid's land are taken to the nearest cell of it. null: another land (or a bridge between: walk.js crosses those itself)
    route(ax, az, bx, bz, clear) {
      const A = near(ax, az, undefined, 3), k = cell(bx, bz), on = k >= 0 && lab[k] >= 0; // inbox 42 C: b off the land (a seat by a prop): the nearest cell of a's land, 3 m round (was any land's, 1.5 m)
      const B = A && (on ? lab[k] === A[2] && near(bx, bz, undefined, 0) : near(bx, bz, (x, z, L) => L === A[2], 6)); if (!B) return null;
      const from = new Int32Array(N).fill(-1); let h = 0, t = 0; q[t++] = A[3]; from[A[3]] = A[3];
      while (h < t && from[B[3]] < 0) { const k = q[h++]; nbr(k, n => { if (from[n] < 0 && lab[n] === A[2]) { from[n] = k; q[t++] = n; } }); }
      if (from[B[3]] < 0) return null;
      const pts = []; for (let k = B[3]; k !== A[3]; k = from[k]) pts.push(at(k)); pts.reverse();
      if (Math.hypot(bx - B[0], bz - B[1]) > 1e-6 && clear(B[0], B[1], bx, bz)) pts.push([bx, bz]);
      const out = []; let cx = ax, cz = az;
      for (let i = 0; i < pts.length;) { let j = pts.length - 1; while (j > i && !clear(cx, cz, ...pts[j])) j--; out.push(pts[j]); [cx, cz] = pts[j]; i = j + 1; }
      return out;
    },
  };
}
