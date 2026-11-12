import * as THREE from 'three';
import { R, S, Z, SW, sPts, pPts, pond, paddock, dist2D, heightAt, occupied, CLIFF_Z, stream, rand as meadowRand } from './layout.js';
import { toyMat, roundedBox, worldColor, glslColor, instanced, rainNow, snowNow, SNOW_RGB } from '../toyKit.js';
import { BRUSHES } from '../../game/data.js';

// distance from the board edge where the turf ends (edge rounding is 1.2 wide: ~0.6 of turf height stays green)
const TURF = 0.5;
const sm = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// Board side reads as a diorama cut: thin turf (terrain edge, see TURF), brown soil with stones pressed into it, wooden plinth.
// Layers are drawn per pixel from world height, so the bands stay crisp on the rounded box.
const SOIL_BOT = -4.3, BASE_BOT = -6.15;
// Soil colour along a side face (s runs along the faces, y = world height). Shared by the base box
// and the terrain's rounded edge, so the cut reads as one band of earth under a thin turf.
const SOIL = `float s = vWp.x + vWp.z;
    float m = vnoise(vec2(s, vWp.y) * 2.2) * 0.6 + vnoise(vec2(s, vWp.y) * 7.0) * 0.4;
    vec3 c = mix(${glslColor('#8f5631')}, ${glslColor('#a8693c')}, m);
    c = mix(c, ${glslColor('#6e3f24')}, smoothstep(-2.6, ${SOIL_BOT.toFixed(2)}, vWp.y) * 0.55);  // darker deeper down
    c = mix(c, ${glslColor('#c48a55')}, step(0.93, vnoise(vec2(s, vWp.y) * 11.0)) * 0.6);        // grit`;
// rand: the layout's seeded random (stones); spill: leave the front face clear where the meadow stream runs down it;
// r: the board [x0, x1, z0, z1] (28-1: it grows a zone a side with 땅 넓히기)
export function buildBase(scene, rand = meadowRand, spill = true, r = R) {
  const bw = r[1] - r[0], bd = r[3] - r[2], cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
  const S = 'float s = vWp.x + vWp.z;'; // runs along every side face
  const soil = worldColor(toyMat('#ffffff', { roughness: 0.75 }), `${SOIL}
    diffuseColor.rgb = c;`);
  const wood = worldColor(toyMat('#ffffff', { roughness: 0.55 }), `${S}
    float y = vWp.y + 0.12 * vnoise(vec2(s * 0.35, 1.0));
    float grain = 0.5 + 0.5 * sin(y * 46.0 + vnoise(vec2(s * 0.6, y * 5.0)) * 5.0);
    vec3 c = mix(${glslColor('#b57643')}, ${glslColor('#c98a52')}, grain * 0.7 + vnoise(vec2(s * 0.2, y * 2.0)) * 0.3);
    float seam = 1.0 - smoothstep(0.0, 0.035, abs(vWp.y - ${((SOIL_BOT + BASE_BOT) / 2).toFixed(3)}));  // plank joint
    diffuseColor.rgb = c * (1.0 - 0.45 * seam);`);
  const TOP = -1.45, sh1 = TOP - SOIL_BOT, sh2 = SOIL_BOT - BASE_BOT; // sharp box whose top tucks under the terrain shoulder (a rounded top showed as a roll)
  const top = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.06, sh1, bd + 0.06), soil);
  top.position.set(cx, TOP - sh1 / 2, cz); top.receiveShadow = true; scene.add(top);
  const bot = new THREE.Mesh(roundedBox(bw + 0.2, sh2, bd + 0.2, 0.3, 3), wood);
  bot.position.set(cx, SOIL_BOT - sh2 / 2, cz); bot.receiveShadow = true; scene.add(bot);

  // round stones half-buried in the soil face (one draw call). Not in front of the spilling stream.
  const e = stream.getPointAt(1), tn = stream.getTangentAt(1), spillX = spill ? e.x + tn.x * (r[3] + 0.05 - e.z) / tn.z : Infinity;
  const stones = [], x0 = r[0] - 0.05, x1 = r[1] + 0.05, z0 = r[2] - 0.05, z1 = r[3] + 0.05;
  const faces = [[x0, z0, x1, z0, 0, -1], [x1, z0, x1, z1, 1, 0], [x1, z1, x0, z1, 0, 1], [x0, z1, x0, z0, -1, 0]];
  for (const [x1, z1, x2, z2, ox, oz] of faces) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (let u = 1.0; u < len - 1.0; u += 0.7 + rand() * 1.1) {
      const x = x1 + (x2 - x1) * u / len, z = z1 + (z2 - z1) * u / len;
      if (oz > 0 && Math.abs(x - spillX) < 3.2) continue;
      const r = 0.16 + rand() * 0.24, y = -2.6 - rand() * (-2.6 - SOIL_BOT + 0.35);
      stones.push({ x: x - ox * r * 0.45, y, z: z - oz * r * 0.45, s: [r * (1 + rand() * 0.5), r * (0.7 + rand() * 0.3), r], ry: ox ? Math.PI / 2 : 0, rz: (rand() - 0.5) * 0.6, c: new THREE.Color(['#b9b2a6', '#a59f95', '#c7c0b2', '#8f8a82'][Math.floor(rand() * 4)]).offsetHSL(0, 0, (rand() - 0.5) * 0.06).getHex() });
    }
  }
  scene.add(instanced(new THREE.SphereGeometry(1, 12, 8), toyMat('#ffffff', { roughness: 0.5 }), stones, { cast: false }));

  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(90,55,30,0.45)'); gr.addColorStop(1, 'rgba(90,55,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(bw * 1.9, bd * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.set(cx, BASE_BOT - 0.15, cz); scene.add(sh);
}

// Fake value noise for colour mottling (deterministic, cheap).
const n2 = (x, z) => Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) * Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.3);

export function buildTerrain(scene) {
  buildBase(scene);
  const C = s => new THREE.Color(s);
  const gBright = C('#9bcf48'), gMid = C('#76b33c'), gDeep = C('#5c9a35'), gSun = C('#b4d95a'), gSlope = C('#4f8a30'), gForest = C('#5a9136');
  const path = C('#e6c48c'), pathEdge = C('#cfa66c'), dirt = C('#dcb57c'), wetSand = C('#cdb27a'), bedSand = C('#d9c79a'), bedDeep = C('#a3b48a');
  return terrainMesh(scene, heightAt, occupied, (col, x, z, h, ny) => {
    const ds = dist2D(sPts, x, z), dp = Math.hypot(x - pond.x, z - pond.z);
    // grass: broad patches + fine mottle + sunlit tops
    const big = 0.5 + 0.5 * Math.sin(x * 0.23 + 0.7) * Math.cos(z * 0.19 - 0.4);
    col.copy(gMid).lerp(gBright, big * 0.8).lerp(gDeep, sm(n2(x, z) * 0.5 + 0.1) * 0.35);
    col.lerp(gSun, sm((h - 0.25) / 0.7) * 0.4);
    if (z < CLIFF_Z - 0.6) col.lerp(gForest, 0.55);
    col.lerp(gSlope, sm((0.93 - ny) / 0.25) * 0.6);
    Z.tint(col, x, z, ny, C); // 28-1: the zones' own ground
    // paddock dirt with a wobbly edge
    const pdx = Math.abs(x - paddock.x) - paddock.w / 2 + 0.6, pdz = Math.abs(z - paddock.z) - paddock.d / 2 + 0.6;
    col.lerp(dirt, sm(-(Math.max(pdx, pdz) + n2(x * 2, z * 2) * 0.35) / 0.5) * 0.9);
    // path: sandy centre, darker rim
    const dpath = dist2D(pPts, x, z) + n2(x * 3, z * 3) * 0.06;
    if (ds > SW + 0.2) { col.lerp(pathEdge, sm((1.0 - dpath) / 0.2)); col.lerp(path, sm((0.8 - dpath) / 0.25)); }
    // water edges: wet sand at the waterline, sandy then greenish bed underwater
    const wd = Math.min(ds - (SW - 0.4), dp - (pond.r - 0.4), Z.wd(x, z, true)); // 0 at the waterline
    col.lerp(wetSand, sm((0.5 - wd) / 0.4) * 0.85);
    if (wd < 0) col.copy(bedSand).lerp(bedDeep, sm(-wd / 1.1));
  }, R, S);
}
// The board's ground: the height field as a grid (150 x 240 on the first board), coloured per vertex by color(col, x, z, h, normal y), darkened
// round the props (a contact shadow), with fine mottling close up and the soil cut at the rounded edge. (The pond's too.)
// 22-1: returns { mesh, setNatAO(spots), setPaint(cells), grid(on) }: the natives' contact shadows (they move), the painted ground
// (땅 칠하기: one texel per cell of U, cell i, j = floor(x / U), floor(z / U); brushes as data.js BRUSHES) and the 격자 lines.
// 25-1: B.g snow, B.b ice
const BRUSH_RGB = BRUSHES.map(b => new THREE.Color(b.c));
const v3 = c => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`, CC = h => v3(new THREE.Color(h));
const PAINT = `
    { vec2 pq = vWp.xz / uU + (vec2(vnoise(vWp.xz * 1.3), vnoise(vWp.xz * 1.3 + 9.0)) - 0.5) * 0.5;
      vec2 pt = (pq - uPO) / uPN; vec4 pa = texture2D(uPA, pt), pb = texture2D(uPB, pt); float pg = pb.r;
      if (pa.r + pa.g + pa.b + pa.a + pb.r + pb.g + pb.b > 0.01) {
        float sh = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / LUM, 0.62, 1.12); // keeps the slopes and contact shadows
        vec4 k = smoothstep(0.18, 0.72, pa); float kg = smoothstep(0.18, 0.72, pg); // inbox 67-3: a wide soft edge, no disc
        vec3 grass = ${v3(BRUSH_RGB[0])} * (0.92 + 0.16 * vnoise(vWp.xz * 0.9));
        vec3 sand = ${v3(BRUSH_RGB[2])} * (0.96 + 0.08 * vnoise(vWp.xz * 4.0));
        float gv = vnoise(vWp.xz * 9.0); vec3 gravel = ${v3(BRUSH_RGB[3])} * (0.82 + 0.3 * step(0.55, gv) - 0.12 * step(gv, 0.2));
        vec2 fc = floor(vWp.xz * 4.0), ff = fract(vWp.xz * 4.0) - 0.5; float fh = hash12(fc), fd = length(ff - (vec2(hash12(fc + 3.1), hash12(fc + 7.7)) - 0.5) * 0.4);
        vec3 fcol = fh > 0.93 ? ${CC('#fff7ee')} : fh > 0.86 ? ${CC('#ffd54a')} : fh > 0.79 ? ${CC('#ff9cc4')} : ${CC('#b9a0f2')};
        vec3 bloom = mix(${v3(BRUSH_RGB[4])}, fcol, (fh > 0.9 ? 0.6 : 0.0) * (1.0 - smoothstep(0.06, 0.14, fd))); // inbox 67-3: a few soft specks, not a painted carpet
        vec3 c = diffuseColor.rgb;
        c = mix(c, grass * sh, kg); c = mix(c, sand * sh, k.g); c = mix(c, gravel * sh, k.b); c = mix(c, bloom * sh, k.a);
        // 25-1 the snow's: fresh snow with a few glints, smooth pale ice (paler streaks, a crack line here and there)
        vec2 kb = smoothstep(0.18, 0.72, pb.gb); float sg = step(0.985, hash12(floor(vWp.xz * 14.0)));
        vec3 snow = ${v3(BRUSH_RGB[5])} * (0.97 + 0.05 * vnoise(vWp.xz * 1.5)) + sg * 0.12;
        float ck = 1.0 - smoothstep(0.0, 0.04, abs(vnoise(vWp.xz * 1.1 + 3.0) - 0.5)); vec3 ice = mix(${v3(BRUSH_RGB[6])}, ${CC('#eef8fc')}, 0.35 * vnoise(vWp.xz * 0.7) + 0.4 * ck);
        c = mix(c, snow * sh, kb.x); c = mix(c, ice * sh, kb.y);
        diffuseColor.rgb = c; } }`;
// 28-6 길 잇기: 흙길, 돌길, 나무판길 (uPC r, g, b; a texel per cell, not blended) drawn as a band through each cell that joins the
// paths beside it: a rounded square in the middle, an arm to each path cell next to it, the corner filled where three meet. Any
// two kinds join. The edge wobbles a little and has a darker rim. Stone: rows of rounded flags; planks: boards across the way.
const PATH = `
    { vec2 cq = vWp.xz / uU, cc = floor(cq), cp = cq - cc - 0.5, ct = (cc - uPO + 0.5) / uPN, tx = 1.0 / uPN;
      vec3 me = texture2D(uPC, ct).rgb;
      if (me.r + me.g + me.b > 0.5) {
        float e = PN(1.0, 0.0), w = PN(-1.0, 0.0), s = PN(0.0, 1.0), n = PN(0.0, -1.0);
        vec2 p = cp + (vec2(vnoise(vWp.xz * 2.7), vnoise(vWp.xz * 2.7 + 5.0)) - 0.5) * 0.07;
        float d = sdBox(p, vec2(0.0), vec2(0.16)) - 0.2;
        if (e > 0.5) d = min(d, sdBox(p, vec2(0.3, 0.0), vec2(0.3, 0.36)));
        if (w > 0.5) d = min(d, sdBox(p, vec2(-0.3, 0.0), vec2(0.3, 0.36)));
        if (s > 0.5) d = min(d, sdBox(p, vec2(0.0, 0.3), vec2(0.36, 0.3)));
        if (n > 0.5) d = min(d, sdBox(p, vec2(0.0, -0.3), vec2(0.36, 0.3)));
        if (e * s * PN(1.0, 1.0) > 0.5) d = min(d, sdBox(p, vec2(0.3, 0.3), vec2(0.3)));
        if (e * n * PN(1.0, -1.0) > 0.5) d = min(d, sdBox(p, vec2(0.3, -0.3), vec2(0.3)));
        if (w * s * PN(-1.0, 1.0) > 0.5) d = min(d, sdBox(p, vec2(-0.3, 0.3), vec2(0.3)));
        if (w * n * PN(-1.0, -1.0) > 0.5) d = min(d, sdBox(p, vec2(-0.3, -0.3), vec2(0.3)));
        float k = 1.0 - smoothstep(-0.015, 0.015, d * uU), rim = smoothstep(-0.1, -0.03, d * uU);
        float sh = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / LUM, 0.62, 1.12);
        vec3 c;
        if (me.g > 0.5) { // stone flags: rows of 0.5, every other one shifted half a stone
          vec2 q = vWp.xz * 2.0; q.x += mod(floor(q.y), 2.0) * 0.5; vec2 f = fract(q) - 0.5, id = floor(q);
          float g = length(max(abs(f) - 0.26, 0.0)) - 0.15;
          c = mix(${CC('#cfc8bb')} * (0.88 + 0.18 * hash12(id)), ${CC('#9b968d')}, smoothstep(-0.02, 0.02, g));
          c = mix(c, ${CC('#a8a296')}, rim * 0.55);
        } else if (me.b > 0.5) { // planks across the way (along an arm: the arm's way; the middle of a corner: the way it came)
          bool ax = (e + w > 0.5) && (abs(p.x) > abs(p.y) || n + s < 0.5);
          float u = (ax ? vWp.x : vWp.z) * 3.2, v = ax ? vWp.z : vWp.x, pk = floor(u);
          c = ${CC('#c99a63')} * (0.86 + 0.2 * hash12(vec2(pk, 3.0))) * (0.95 + 0.1 * vnoise(vec2(pk * 7.0, v * 6.0)));
          c = mix(c, ${CC('#83582f')}, 1.0 - smoothstep(0.0, 0.07, min(fract(u), 1.0 - fract(u))));
          c = mix(c, ${CC('#9a6a3d')}, rim * 0.6);
        } else c = mix(${v3(BRUSH_RGB[1])} * (0.95 + 0.1 * vnoise(vWp.xz * 5.0)), ${CC('#cfa66c')}, rim);
        diffuseColor.rgb = mix(diffuseColor.rgb, c * sh, k); } }`;
const GRID = `
    { vec2 gq = vWp.xz / uU, gd = abs(fract(gq - 0.5) - 0.5) / fwidth(gq);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (1.0 - min(min(gd.x, gd.y), 1.0)) * 0.4 * uGrid * (1.0 - smoothstep(18.0, 40.0, distance(cameraPosition, vWp)))); }`;
// 28-6 (PATH): a box's signed distance; a path cell beside this one (o: its offset in cells, ct and tx as there)
const SDF = `float sdBox(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
#define PN(a, b) step(0.5, dot(texture2D(uPC, ct + vec2(a, b) * tx).rgb, vec3(1.0)))
`;
// lum: the board's own ground brightness, which a painted cell's shade (slopes, contact shadows) is measured against (25-1: the snow's)
export function terrainMesh(scene, heightAt, occupied, color, r = R, U = 1, { lum = 0.3 } = {}) {
  const bw = r[1] - r[0], bd = r[3] - r[2];
  const tg = new THREE.PlaneGeometry(bw, bd, Math.round(120 * bw / 36), Math.round(192 * bd / 58)); tg.rotateX(-Math.PI / 2); tg.translate((r[0] + r[1]) / 2, 0, (r[2] + r[3]) / 2);
  const pos = tg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  tg.computeVertexNormals();
  const nor = tg.attributes.normal, cols = new Float32Array(pos.count * 3), aoK = new Float32Array(pos.count);
  const col = new THREE.Color();
  // occupied props cast a soft contact shadow (ambient occlusion) on the grass
  const ao = occupied.filter(o => o.r > 0.25);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    color(col, x, z, pos.getY(i), nor.getY(i));
    // contact shadow near trees/rocks/buildings
    let occ = 0;
    for (const o of ao) { const d = Math.hypot(o.x - x, o.z - z) / (o.r * 1.25); if (d < 1) occ = Math.max(occ, (1 - d) * (1 - d)); }
    col.multiplyScalar(aoK[i] = 1 - occ * 0.32);
    cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // close up, the vertex colours alone look smooth: add fine mottling and specks, faded out with distance
  const ground = worldColor(toyMat('#ffffff', { vertexColors: true, roughness: 0.82, envMapIntensity: 0.85 }), (PAINT + PATH).replaceAll('LUM', lum.toFixed(2)) + `
    float near = 1.0 - smoothstep(14.0, 34.0, distance(cameraPosition, vWp));
    float d = vnoise(vWp.xz * 2.3) * 0.55 + vnoise(vWp.xz * 7.5) * 0.45;
    float speck = step(0.9, vnoise(vWp.xz * 15.0 + 7.0));
    diffuseColor.rgb *= 1.0 + near * ((d - 0.5) * 0.2 - speck * 0.08);
    // the lower part of the rounded edge is the cut: soil, shaded just under the wavy turf line
    float e = min(min(vWp.x - ${r[0].toFixed(2)}, ${r[1].toFixed(2)} - vWp.x), min(vWp.z - ${r[2].toFixed(2)}, ${r[3].toFixed(2)} - vWp.z));
    float turf = e - (TURF + 0.06 * sin((vWp.x + vWp.z) * 2.3) + 0.08 * (vnoise(vec2((vWp.x + vWp.z) * 3.0, 0.0)) - 0.5));
    if (turf < 0.0) { ${SOIL}
      diffuseColor.rgb = c * (1.0 - 0.35 * smoothstep(-0.2, 0.0, turf)); }
    diffuseColor.rgb *= 1.0 - 0.2 * uWet; // 21-2: wet in the rain
    // 15-2 첫눈: lying snow in soft drifts (bare patches between), never on the cut
    float sn = uSnow * smoothstep(0.32, 0.58, vnoise(vWp.xz * 0.33) * 0.75 + d * 0.25 + 0.12) * step(0.0, turf);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${SNOW_RGB} * (0.94 + 0.06 * d), sn * 0.92);`.replace('TURF', TURF.toFixed(2)) + GRID);
  // the paint: two RGBA textures, a texel per cell (A: dirt, sand, gravel, bloom; B.r: grass), linear so a cell is a soft blob
  const i0 = Math.floor(r[0] / U), j0 = Math.floor(r[2] / U), nI = Math.ceil(r[1] / U) - i0, nJ = Math.ceil(r[3] / U) - j0;
  const tex = (f = THREE.LinearFilter) => { const t = new THREE.DataTexture(new Uint8Array(nI * nJ * 4), nI, nJ); t.magFilter = t.minFilter = f; t.needsUpdate = true; return t; };
  const U8 = { uPA: { value: tex() }, uPB: { value: tex() }, uPC: { value: tex(THREE.NearestFilter) }, uPO: { value: new THREE.Vector2(i0, j0) }, uPN: { value: new THREE.Vector2(nI, nJ) }, uU: { value: U }, uGrid: { value: 0 } };
  const wrap = ground.onBeforeCompile;
  ground.onBeforeCompile = sh => { wrap(sh); Object.assign(sh.uniforms, U8, { uWet: rainNow, uSnow: snowNow });
    sh.fragmentShader = 'uniform float uWet, uSnow, uU, uGrid;\nuniform sampler2D uPA, uPB, uPC;\nuniform vec2 uPO, uPN;\n' + SDF + sh.fragmentShader; };
  const terrain = new THREE.Mesh(tg, ground);
  terrain.receiveShadow = true; scene.add(terrain);
  const base = cols.slice(), occ = new Float32Array(pos.count), nx = tg.parameters.widthSegments, ny = tg.parameters.heightSegments;
  return { mesh: terrain,
    setNatAO(spots) { // as the bake above, for the natives (spots: { x, z, r } in world units)
      occ.fill(0);
      for (const o of spots) { const R = o.r * 1.25;
        const xa = Math.max(0, Math.floor((o.x - R - r[0]) / bw * nx)), xb = Math.min(nx, Math.ceil((o.x + R - r[0]) / bw * nx));
        const za = Math.max(0, Math.floor((o.z - R - r[2]) / bd * ny)), zb = Math.min(ny, Math.ceil((o.z + R - r[2]) / bd * ny));
        for (let iy = za; iy <= zb; iy++) for (let ix = xa; ix <= xb; ix++) {
          const i = iy * (nx + 1) + ix, d = Math.hypot(o.x - pos.getX(i), o.z - pos.getZ(i)) / R; if (d < 1) occ[i] = Math.max(occ[i], (1 - d) * (1 - d));
        } }
      for (let i = 0; i < pos.count; i++) { const k = 1 - occ[i] * 0.32; cols[i * 3] = base[i * 3] * k; cols[i * 3 + 1] = base[i * 3 + 1] * k; cols[i * 3 + 2] = base[i * 3 + 2] * k; }
      tg.attributes.color.needsUpdate = true;
    },
    setPaint(cells = {}) { // { 'i,j': brush index }
      const A = U8.uPA.value, B = U8.uPB.value, C = U8.uPC.value; A.image.data.fill(0); B.image.data.fill(0); C.image.data.fill(0);
      for (const k in cells) { const [i, j] = k.split(',').map(Number), b = cells[k], t = (j - j0) * nI + (i - i0);
        if (i < i0 || j < j0 || i - i0 >= nI || j - j0 >= nJ) continue;
        if (b === 0) B.image.data[t * 4] = 255; else if (b > 1 && b < 5) A.image.data[t * 4 + b - 1] = 255; else if (b === 5 || b === 6) B.image.data[t * 4 + b - 4] = 255;
        else if (b === 1 || b === 7 || b === 8) C.image.data[t * 4 + (b === 1 ? 0 : b - 6)] = 255; } // 28-6: the paths
      A.needsUpdate = B.needsUpdate = C.needsUpdate = true;
    },
    grid(on) { U8.uGrid.value = on ? 1 : 0; },
    // 28-6 지형 도장: the ground in the box [x0, z0, x1, z1] (world units) again from heightAt: heights, normals (as
    // computeVertexNormals: each vertex the sum of its triangles' area-weighted normals), colours (as built, with both shadows)
    reshape([x0, z0, x1, z1]) {
      const ix = x => THREE.MathUtils.clamp(Math.round((x - r[0]) / bw * nx), 0, nx), iz = z => THREE.MathUtils.clamp(Math.round((z - r[2]) / bd * ny), 0, ny);
      const xa = Math.max(0, ix(x0) - 1), xb = Math.min(nx, ix(x1) + 1), za = Math.max(0, iz(z0) - 1), zb = Math.min(ny, iz(z1) + 1), W = nx + 1;
      for (let iy = za; iy <= zb; iy++) for (let jx = xa; jx <= xb; jx++) { const i = iy * W + jx; pos.setY(i, heightAt(pos.getX(i), pos.getZ(i))); }
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), acc = new Map();
      const add = (i, v) => (acc.get(i) ?? acc.set(i, new THREE.Vector3()).get(i)).add(v);
      for (let iy = Math.max(0, za - 1); iy < Math.min(ny, zb + 1); iy++) for (let jx = Math.max(0, xa - 1); jx < Math.min(nx, xb + 1); jx++) {
        const A = jx + W * iy, B = jx + W * (iy + 1), C = jx + 1 + W * (iy + 1), D = jx + 1 + W * iy; // PlaneGeometry's two triangles (A, B, D), (B, C, D)
        for (const [p, q, s] of [[A, B, D], [B, C, D]]) { a.fromBufferAttribute(pos, p); b.fromBufferAttribute(pos, q); c.fromBufferAttribute(pos, s); n.subVectors(c, b).cross(a.sub(b)); add(p, n); add(q, n); add(s, n); }
      }
      for (let iy = za; iy <= zb; iy++) for (let jx = xa; jx <= xb; jx++) {
        const i = iy * W + jx; n.copy(acc.get(i)).normalize(); nor.setXYZ(i, n.x, n.y, n.z);
        color(col, pos.getX(i), pos.getZ(i), pos.getY(i), n.y); col.multiplyScalar(aoK[i]); const k = 1 - occ[i] * 0.32;
        base[i * 3] = col.r; base[i * 3 + 1] = col.g; base[i * 3 + 2] = col.b; cols[i * 3] = col.r * k; cols[i * 3 + 1] = col.g * k; cols[i * 3 + 2] = col.b * k;
      }
      pos.needsUpdate = nor.needsUpdate = tg.attributes.color.needsUpdate = true; tg.computeBoundingSphere(); tg.computeBoundingBox();
    },
  };
}
