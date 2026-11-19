// 14-1 신수: the 불갈기 천리마's figure (data.js MYTHIC, baked by tools/bake-mythic.mjs). Not a SPECIES, so not figure.js's
// makeFigure: one model, its own materials (matte vinyl coat, gold harness, a 단청 saddle cloth) and its fire, a translucent
// resin in three layers (white core, yellow, orange outside: a fresnel ramp), embers and, at night, a warm pool of light.
// Rearing pivots the body on the hind hips (hinge); the front legs paw, the mane flares (inbox 66-0: A, no wings, for good;
// the ?m89 pilot below has wings again only because inbox 159 A asks for them).
import * as THREE from 'three';
import { MYTHIC, sized } from '../game/data.js';
import { meshes } from './figure.js';
import { windTime } from '../habitat/toyKit.js';
import { eyeMat } from './materials.js';
import { calm } from '../config.js';

const M = MYTHIC[0].model;
export const MS = sized('firemane', 'adult', M); // s, r, seg in world units (crowd.js), legs in model units
let G = null, loading = null;
export const loadMyth = () => loading ??= meshes(M.file).then(g => { G = g; }); // 166: data.js MYTHIC[0] model.file = myth_firemane157.glb

const fireMat = (core, mid, rim, a0 = 0.96, a1 = 0.72) => new THREE.ShaderMaterial({
  uniforms: { uT: windTime, uW: { value: 1 }, uF: { value: 0 }, uN: { value: 0 }, uA: { value: new THREE.Color(rim) }, uB: { value: new THREE.Color(mid) }, uC: { value: new THREE.Color(core) } },
  vertexShader: `uniform float uT, uW, uF; varying vec3 vN, vV;
    void main() { vec3 p = position + normal * (uW * 0.014 * sin(uT * 6.0 + position.y * 11.0 + position.x * 7.0) + uF * 0.06);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uA, uB, uC; uniform float uN; varying vec3 vN, vV;
    void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      vec3 c = mix(mix(uC, uB, smoothstep(0.0, 0.28, f)), uA, smoothstep(0.3, 0.72, f));
      gl_FragColor = vec4(c * (0.92 + 0.25 * uN), mix(${a0.toFixed(2)}, ${a1.toFixed(2)}, f));
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false, // not tone-mapped: ACES would wash the resin's oranges out to cream
});
export const dot = (c0, c1) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, c0); r.addColorStop(1, c1); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// obj stands at its hooves; pose(p) as figure.js's ({ gait 'still' | 'walk' | 'trot' | 'run', ph, lie, rear, flare });
// tick(night 0..1) each frame
export const makeMyth = () => make157(); // 166: the 157 look public (0.84.1, user OK 11/19); the 14-1 figure and myth_firemane.glb retired

// ---- 157 C 불갈기 천리마 다시 (?m89 시범 until 166: public since 0.84.1) ----
// myth_firemane157.glb (tools/bake-firemane157.mjs; pilot89_firemane157.glb until 166): the same body and legs (MS, the size, the hinge, the hips hold). Things you
// could hold, no painted pattern: the coat a deep red lacquer (옻칠: a clearcoat over a red that deepens toward the outline, as
// light goes further through the layers there; an ember faintly lit inside it, more at night); gilt tack: the bridle, breast
// collar, girth, spine and haunch straps gold inlaid in the lacquer (평탈, STRAP157), gilt-bronze bosses and 행엽, and on each flank
// a 말다래 with a flying horse raised on it (the 천마총 천마도's motif drawn anew);
// gold hooves (an ember at each step: habitat/myth.js); the mane and tail glass flames, each mass its own piece
// (_thickness = its number + root 0 .. tip 1), white-hot inside cooling to red at the tips, rippling slowly, drawn with depth so
// they stay apart; small sparks drifting up off the tips (more at night); the warm pool at night as before.
// 159 A (inbox 159 A, 157 C read as 「a red horse with gold bands」): a 천마 — a pair of spread glass flame wings on the shoulders
// (5 feathers each), the crest 6 longer flames from the forehead to the withers, a long streaming tail, the flame cuffs back (glass
// now); the lacquer a deep oxblood under a mirror coat (MIRROR157: a studio softbox, a strip light and the horizon in it, so it reads as a
// polished lacquer ware, not red paint), the inlaid gold brighter with a dark hairline; at night the gilt keeps its colour (a
// faint glow only, the relief's shading stays); more sparks, off the wing tips too.
// 160 B (inbox 160 B: 「몸이 아직 무광 빨강 덩어리, 날개가 덤불처럼 뭉침, 얼굴이 밋밋」): the lacquer a step deeper and glossier, its
// mirror long streaks (two long bar lights: they run along the barrel, neck and legs as on lacquer ware), not small softbox stickers;
// gold flame vines inlaid raised on the neck and haunch (VINE160, the 백록's silver cloud lines' way: metal, not paint), glowing a
// little as the kintsugi seams; a warm orange rim light on the body's outline near the mane, wings and tail (the fire lighting it);
// the wings' five feathers apart (the bake), each white-hot inside to red at its tip, clearer, a darker red edge between them; the
// public figure's red jewel back on the browband, a small gilt-bronze upright behind it (the bake), an ember's glint in each eye;
// a few more sparks.
// 162 A (inbox 162 A): the mirror bands broad and soft-edged (they read as cracked white lines on the head and neck: MIRROR157), the
// gold vines half as wide again, raised more and glossier (VINE_BODY160: home distance), the wing feathers denser glass with a deeper
// red edge, each a shade off its neighbour (and in the bake: further apart, narrower).
// The same pose() as the figure above (kept apart so the public one is untouched; on the user's OK it replaces that one).
// the gilt straps, gold inlaid flush in the lacquer (평탈), drawn per pixel so their edges are clean: the bands
// tools/bake-firemane157.mjs prints (model units) — rings [centre, axis, R, r], the cheek strap [a, b, r] (+z, mirrored), ellipsoids [c, r]
const STRAP157 = [[[[1.0168, 1.8425, 0], [0.8496, -0.5274, 0], 0.2514, 0.045], [[0.6432, 1.94, 0], [0.9536, 0.3011, 0], 0.27, 0.04], [[1.0103, 2.1516, 0], [0.6309, 0.7759, 0], 0.2, 0.035], [[0.4712, 1.3075, 0], [0.5067, 0.8621, 0], 0.4, 0.05]], [[[0.6432, 1.8514, 0.2953], [1.0168, 1.8425, 0.2597], 0.035]], [[[-0.03, 1.2, 0], [0.04, 2, 2]], [[-0.54, 1.7, 0], [0.51, 0.5, 0.032]], [[-0.62, 1.1432, 0], [0.62, 0.045, 0.6]]]];
const v3 = v => `vec3(${v.map(x => x.toFixed(4)).join(', ')})`;
const STRAP_GLSL = `float tor157(vec3 q, vec3 a, float R, float r) { float h = dot(q, a); return length(vec2(length(q - a * h) - R, h)) - r; }
float cap157(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
float ell157(vec3 q, vec3 r) { float k0 = length(q / r), k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / k1; }
float strap157(vec3 p) { return ${[...STRAP157[0].map(([c, a, R, r]) => `tor157(p - ${v3(c)}, ${v3(a)}, ${R.toFixed(4)}, ${r.toFixed(4)})`),
  ...STRAP157[1].map(([a, b, r]) => `cap157(vec3(p.xy, abs(p.z)), ${v3(a)}, ${v3(b)}, ${r.toFixed(4)})`),
  ...STRAP157[2].map(([c, r]) => `ell157(p - ${v3(c)}, ${v3(r)})`)].reduce((s, x) => `min(${s}, ${x})`)}; }
`;
// the hooves: gold below the leg's hoof line, per pixel too (the bake's leg/hoof split followed its triangles: a sawtooth edge)
const HOOF_GLSL = `float strap157(vec3 p) { return p.y + ${(M.legs.hip - 0.1).toFixed(4)}; }\n`; // leg-local (pivot at the hip): -(len - hoof) of bake-firemane157.mjs's leg
// 160 B the flame vines, drawn in the side view (model units; both flanks, 백록 LINES155C's way): a turtle from p heading h (degrees)
// walking arcs [length, turn deg], each point [x, y, half width]. A tongue: a curl of n quarter turns (radius r0 x g^k, dir +1 ccw /
// -1 cw) leaving heading hf, then its body; a stem is a tongue whose flames (flameOff) leave it past its curl (its first 35 %)
const turtle160 = (p, h, arcs, w) => { const tot = arcs.reduce((s, [l]) => s + l, 0), out = [[...p, w(0)]]; let L = 0; h *= Math.PI / 180;
  for (const [len, turn] of arcs) { const t = turn * Math.PI / 180, k = Math.max(1, Math.ceil(Math.max(Math.abs(t) / 0.28, len / 0.03)));
    for (let i = 0; i < k; i++) { h += t / k / 2; p = [p[0] + Math.cos(h) * len / k, p[1] + Math.sin(h) * len / k]; h += t / k / 2; L += len / k; out.push([...p, w(L / tot)]); } }
  return out; };
const stem160 = (p, n, r0, g, dir, hf, body, W) => { const s = turtle160(p, hf - dir * 90 * n, [...Array.from({ length: n }, (_, k) => [r0 * g ** k * Math.PI / 2, dir * 90]), ...body],
  t => W * (t < 0.25 ? 0.45 + 0.55 * t / 0.25 : t < 0.6 ? 1 : Math.max(0.12, 1 - (t - 0.6) / 0.4))); s.c = Math.round(s.length * 0.35); return s; };
const flameOff160 = (stem, f, h, body, W) => turtle160(stem[stem.c + Math.round(f * (stem.length - 1 - stem.c))].slice(0, 2), h, body,
  t => W * (t < 0.2 ? 0.7 + 1.5 * t : Math.max(0.1, 1 - ((t - 0.2) / 0.8) ** 1.2))); // a belly a fifth of the way out, then to a point
const HS160 = stem160([-0.36, 1.32], 3, 0.024, 1.5, 1, 185, [[0.12, 10], [0.12, -20], [0.1, 15]], 0.022);
const NS160 = stem160([0.6, 1.47], 3, 0.024, 1.5, -1, 96, [[0.1, 10], [0.1, -14], [0.1, 22]], 0.022);
const LINES160 = [
  // haunch: a stem from a curl behind the 말다래, waving back above the haunch strap, two flames rising up and back off it
  HS160, flameOff160(HS160, 0.25, 108, [[0.08, 24], [0.07, -18], [0.07, 34]], 0.019), flameOff160(HS160, 0.6, 118, [[0.07, 24], [0.06, -18], [0.06, 34]], 0.017),
  // neck: a stem rising from a curl above the breast collar toward the poll, two flames off it back toward the mane
  NS160, flameOff160(NS160, 0.2, 150, [[0.07, 20], [0.06, -16], [0.05, 30]], 0.017), flameOff160(NS160, 0.6, 150, [[0.06, 20], [0.05, -16], [0.05, 30]], 0.015),
];
// GLSL: the nearest line (ld past its edge, lo from its middle, lw its half width), each run of 8 segments only inside its own box
// 162 A (「금 선이 집 거리에서 안 보임」): every line 1.5 times as wide (VW162)
const f160 = v => v.toFixed(4), VW162 = 1.5;
const VINE160 = `void seg160(vec2 q, vec2 a, float aw, vec2 b, float bw, inout float ld, inout vec2 lo, inout float lw) { vec2 ab = b - a; float h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 o = q - a - ab * h; float w = mix(aw, bw, h), d = length(o) - w; if (d < ld) { ld = d; lo = o; lw = w; } }
float vine160(vec2 q, out vec2 lo, out float lw) { float ld = 9.0; lo = vec2(0.0); lw = 0.01;
${LINES160.flatMap(L => Array.from({ length: Math.ceil((L.length - 1) / 8) }, (_, j) => L.slice(j * 8, j * 8 + 9))).map(C => {
  const xs = C.map(v => v[0]), ys = C.map(v => v[1]), m = 0.11; // 162 A: past the widest line + its halo (0.035) and seat (160 B review: 0.06 cut them)
  return `  if (q.x > ${f160(Math.min(...xs) - m)} && q.x < ${f160(Math.max(...xs) + m)} && q.y > ${f160(Math.min(...ys) - m)} && q.y < ${f160(Math.max(...ys) + m)}) {\n`
    + C.slice(1).map((b, i) => `    seg160(q, vec2(${f160(C[i][0])}, ${f160(C[i][1])}), ${f160(C[i][2] * VW162)}, vec2(${f160(b[0])}, ${f160(b[1])}), ${f160(b[2] * VW162)}, ld, lo, lw);`).join('\n') + '\n  }\n'; }).join('')}  return ld; }
`;
// k: the gold wire (at least 0.6 px wide far off, gone where it would only shimmer; flanks only), raised: its normal leans out across it
// (a round wire catching the light on its sides), a dark seat under it (darkest below: its shadow); a faint kintsugi glow (uV160)
const VINE_BODY160 = `{ vec3 on = normalize(vN160); vec2 q = vP157.xy, lo; float lw, fq = max(length(fwidth(q)), 1e-4), side = smoothstep(0.2, 0.45, abs(on.z)) * (1.0 - smoothstep(0.035, 0.07, fq));
  if (side > 0.0) { float ld = vine160(q, lo, lw), we = max(lw, 0.6 * fq), dW = ld - (we - lw);
    float k = (1.0 - smoothstep(-0.5 * fq, 0.5 * fq, dW)) * side * (1.0 - g157), lowS = 0.45 + 0.55 * (1.0 - smoothstep(-0.6, 0.2, lo.y / max(length(lo), 1e-5)));
    float gr = (1.0 - smoothstep(0.0, 0.01 + fq, dW)) * (1.0 - k) * lowS * side * (1.0 - g157), halo = (1.0 - smoothstep(0.0, 0.035, dW)) * (1.0 - k) * side * (1.0 - g157);
    float uu = clamp(length(lo) / max(lw, 1e-4), 0.0, 1.0), tilt = k * (1.0 - smoothstep(0.4, 0.9, fq / lw));
    vec3 o3 = vec3(lo / max(length(lo), 1e-5), 0.0); o3 -= on * dot(on, o3); vec3 tn = normalMatrix * o3, dn = tn / max(length(tn), 1e-5) * uu * 0.9 * tilt; // 162 A: unit (normalMatrix carries 1/scale: 160 B's 1.2 was about 0.5)
    normal = normalize(normal + dn); clearcoatNormal = normalize(clearcoatNormal + dn);
    diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.6 * gr), vec3(1.0, 0.64, 0.18), k); metalnessFactor = mix(metalnessFactor, 1.0, k); roughnessFactor = mix(roughnessFactor, 0.12, k);
    totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - k) + vec3(1.0, 0.6, 0.16) * (k * 0.5 + halo * 0.1) * uV160 * (0.8 + 0.2 * sin(uT157 * 1.4 - (q.x + q.y) * 14.0));
    g157 = max(g157, k); } }
`;
// 160 B the fire lights the body: a warm orange rim on its outline where it faces the flames (a line along the crest from the tail's root
// over the withers to the poll, a little above the topline, and the wings' roots), uF160 its strength
const RIM160 = `{ vec3 on = normalize(vN160), p = vP157; vec2 a = vec2(-0.7, 1.78), b = vec2(0.05, 1.86), c = vec2(0.62, 2.45);
  vec2 ab = b - a, bc = c - b, pa = a + ab * clamp(dot(p.xy - a, ab) / dot(ab, ab), 0.0, 1.0), pb = b + bc * clamp(dot(p.xy - b, bc) / dot(bc, bc), 0.0, 1.0);
  vec3 lp = vec3(length(p.xy - pa) < length(p.xy - pb) ? pa : pb, 0.0), wl = vec3(-0.1, 1.95, 0.42 * sign(p.z)); // the crest's nearest point, the wing on this side
  float dl = length(lp - p), dw = length(wl - p), nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float lit = max(smoothstep(-0.1, 0.7, dot(on, (lp - p) / max(dl, 1e-4))) * (1.0 - smoothstep(0.15, 0.7, dl)), smoothstep(-0.1, 0.7, dot(on, (wl - p) / max(dw, 1e-4))) * (1.0 - smoothstep(0.2, 0.75, dw)));
  totalEmissiveRadiance += vec3(1.0, 0.4, 0.07) * uF160 * lit * pow(1.0 - nv, 1.8) * (1.0 - g157); }
`;
// 159 A the mirror coat: what the clearcoat mirrors besides the scene's soft sky — a softbox up and left of the viewer and a strip light
// overhead (fixed to the view, as a studio's: every pose shows them, crisp-edged), and a sharp horizon (world: sky above, ground
// dark below), the lights times a Fresnel kept at a quarter face-on (a polished lacquer box's look, not the thin physical 4 %). uR157 their light
// 160 B (「사진에서 한눈에 칠기로」): the softbox read as small stickers; instead two long bar lights. A bar's reflection runs the length of
// a round limb lying across it (a cylinder mirrors only the directions square to its axis): one wide and low ahead-above (a streak along
// the barrel's upper flank, the croup and the neck's side), one tall to the left (down the legs, the chest's and rump's rounded
// ends), and the strip overhead longer (along the back's top). Crisp edges (fwidth), soft ends; the sky's horizon brighter
// 162 A (「반사 줄이 금 간 흰 선으로 보임」): on the head, neck and legs (tight curves) a band of the lights' directions lands on a thin
// strip of coat, and a crisp edge there (a plateau, then a 2-pixel smoothstep: fwidth of an interpolated normal is one value per
// triangle, so the edge stepped at every triangle's border) drew the facets as cracks. Now each light a soft bell across its width
// (exp(-d²), its width never under a pixel's: farther off wider and dimmer, the same light in all), its ends long fades: a broad bright band blurring at its edges, as bright at its middle;
// the mirror normal a little flattened toward the view (0.3: wider bands on tight curves, the facets' wobble less); the horizon soft
// too; and the coat baked finer (bake-firemane157.mjs: 6400 -> 14000 triangles; at 6400 the bands still bent at the facets)
// 163 B (「반사가 창틀 같은 네모 격자」): the grid was these lights themselves — a long horizontal bar, a tall vertical one and a
// strip above cross on a round muzzle or cheek as a window's frame (the scene's sky env has no grid: a smooth dome, a round sun).
// Now two round softboxes (a key up and left, a smaller fill to the right), each a disc with a soft rim (exp(-q²): flat-ish middle,
// no hard edge for the facets to show in; its size never under a pixel's, wider farther off and dimmer by as much); the horizon
// term a soft dusk toward the outline (no line); the sky env mirrored blurred (LACQ_ENV163: its horizon was a crisp step)
const MIRROR157 = `{ vec3 nm = normalize(mix(geometryClearcoatNormal, geometryViewDir, 0.3)), rv = reflect(-geometryViewDir, nm), rw = (vec4(rv, 0.0) * viewMatrix).xyz; // view, world
  float fr = (0.3 + 0.7 * pow(1.0 - dotNVcc, 4.0)) * material.clearcoat, front = smoothstep(-0.05, 0.2, rv.z), fw = length(fwidth(rv));
  vec3 d1 = rv - normalize(vec3(-0.5, 0.62, 0.6)), d2 = rv - normalize(vec3(0.62, 0.22, 0.75));
  float s1 = 0.18 + fw * fw, s2 = 0.08 + fw * fw, q1 = dot(d1, d1) / s1, q2 = dot(d2, d2) / s2; // squared radii 0.42², 0.28² (chord)
  float box = 1.5 * 0.18 / s1 * exp(-q1 * q1) + 0.7 * 0.08 / s2 * exp(-q2 * q2);
  float sky = smoothstep(-0.35, 0.45, rw.y) * (0.25 + 0.35 * max(rw.y, 0.0)) * pow(1.0 - dotNVcc, 1.6); // toward the outline only: the red stays deep
  outgoingLight += uR157 * (fr * front * box + sky * material.clearcoat); }`;
const LACQ_ENV163 = `#include <lights_fragment_maps>
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular ) && defined( USE_CLEARCOAT )
  clearcoatRadiance = getIBLRadiance( geometryViewDir, geometryClearcoatNormal, 0.35 ); // 163 B: the sky in the coat soft, not a crisp horizon line
#endif`;
const lacquer157 = (s, u, key, sdf, more = '') => { // s: the figure's scale; u: uniforms shared by the coat and the legs; sdf: where the gold is (strap157 < 0), key its name; more: 160 B GLSL after the gold
  // 160 B: a step deeper red-black (159 A '#700c10'), the base glossier (0.6) with less of its own hazy sheen (the clear coat carries the reflections)
  const m = new THREE.MeshPhysicalMaterial({ color: '#5c090d', roughness: 0.42, specularIntensity: 0.5, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#ff4a14' });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vP157, vN160;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP157 = position; vN160 = normal;');
    sh.fragmentShader = 'uniform mat3 normalMatrix;\nuniform float uT157, uE157, uG157, uV160, uF160;\nuniform vec3 uR157;\nvarying vec3 vP157, vN160;\n' + sdf + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float g157 = 0.0;
      { float fv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(0.42, 0.07, 0.05), vec3(1.0), smoothstep(0.0, 0.85, fv)); // deeper, darker red toward the outline
        totalEmissiveRadiance *= uE157 * fv * fv * (0.7 + 0.3 * sin(uT157 * 0.8 + vP157.x * 3.1 + vP157.y * 2.3)); // an ember inside, breathing slowly
        float d = strap157(vP157), w = max(min(fwidth(d), length(fwidth(vP157))), 1e-5); // capped at the pixel's size: ell157 is steep on a thin strap's mid-plane (a faint line there otherwise)
        g157 = 1.0 - smoothstep(-w, w, d); // the gold, its edge antialiased
        float hb = ${(0.005 * s).toFixed(5)} * (1.0 - smoothstep(-0.012, 0.0, d)); // its edge a little raised: a 1.2 cm bevel (view units)
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition), r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        if (abs(det) > 1e-20) { vec3 sg = (dFdx(hb) * r1 + dFdy(hb) * r2) / det; normal = normalize(normal - sg); clearcoatNormal = normalize(clearcoatNormal - sg); }
        diffuseColor.rgb *= 1.0 - 0.6 * (1.0 - g157) * (1.0 - smoothstep(0.004, 0.004 + 2.0 * w, d)); // 159 A: a dark hairline round the gold, so its edge reads
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.52, 0.1), g157); metalnessFactor = mix(metalnessFactor, 1.0, g157); roughnessFactor = mix(roughnessFactor, 0.2, g157);
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(1.0, 0.62, 0.25) * uG157, g157); }
      ${more}`) // at night the gold catches the fire's light
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= 1.0 - 0.7 * g157;') // the gold: a thinner coat
      .replace('#include <lights_fragment_maps>', LACQ_ENV163)
      .replace('#include <opaque_fragment>', MIRROR157 + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'lacquer163' + key; // 163 B: new key (160 B and 162 A figures in the same scene must not lend theirs)
  return m;
};
const glass157 = () => new THREE.ShaderMaterial({
  uniforms: { uT: windTime, uW: { value: 1 }, uF: { value: 0 }, uN: { value: 0 } },
  vertexShader: `uniform float uT, uW, uF; attribute float _thickness; varying vec3 vN, vV; varying float vS, vM;
    void main() { float m = floor(_thickness), s = _thickness - m, w = uW * s * s; // the root still in the coat, the tip the freest
      vec3 p = position + normal * (0.016 * w * sin(uT * 2.2 + position.y * 6.0 + m * 1.9) + uF * 0.05 * s) + vec3(-0.04, 0.015, 0.0) * w * sin(uT * 1.1 + m * 2.3);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vS = s; vM = m; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT, uN; varying vec3 vN, vV; varying float vS, vM;
    void main() { vec3 n = normalize(vN), v = normalize(vV); float f = 1.0 - abs(dot(n, v)); // 0 facing us .. 1 at the outline
      float wg = step(8.5, vM) * step(vM, 19.0); // 160 B a wing feather (masses 9..18: bake-firemane157.mjs, after the crest's 6 and the tail's 3)
      float h = clamp(vS * mix(1.1, 1.05, wg) + mix(0.3, 0.15, wg) * f - 0.07 * sin(uT * 1.5 + vM * 2.1 - vS * 7.0), 0.0, 1.0); // heat: 0 the white core .. 1 the red tip (a feather's core whiter, wider)
      vec3 c = h < 0.35 ? mix(vec3(1.0, 0.95, 0.78), vec3(1.0, 0.7, 0.16), h / 0.35) : h < 0.7 ? mix(vec3(1.0, 0.7, 0.16), vec3(1.0, 0.32, 0.05), (h - 0.35) / 0.35) : mix(vec3(1.0, 0.32, 0.05), vec3(0.86, 0.12, 0.03), (h - 0.7) / 0.3);
      c *= mod(floor(vM + 0.5), 2.0) < 0.5 ? 1.0 : mix(0.88, 0.8, wg); // neighbouring masses a shade apart: never one lump (162 A: feathers more)
      float ed = wg * smoothstep(0.5, 0.9, f); // 160 B a feather's edge a deeper red, so each reads apart from the one behind it
      c = mix(c, vec3(0.78, 0.1, 0.03), 0.85 * ed);
      float sp = pow(max(dot(reflect(-v, n), normalize(vec3(-0.45, 0.8, 0.4))), 0.0), 60.0); // glass: a sharp highlight, a thin bright edge
      c += vec3(1.0, 0.95, 0.85) * (0.9 * sp + 0.22 * (1.0 - wg) * smoothstep(0.84, 0.98, f));
      gl_FragColor = vec4(c * (0.9 + 0.3 * uN), mix(0.66 + mix(0.24, 0.32, wg) * h, 0.97, f * f)); // glass: clearer face-on, dense at the outline and the cooled red tips (not pink); a feather as dense (162 A: 160 B's clearer feathers let the far wing and the crest show through: a bush)
      #include <colorspace_fragment>
    }`,
  transparent: true, // depthWrite on: one mass in front of another hides it (crisp, not smeared); not tone-mapped, as the fire above
});
function make157() {
  const s = MS.s, L = M.legs, root = new THREE.Group(), body = new THREE.Group(), hinge = new THREE.Group(), inner = new THREE.Group();
  body.scale.setScalar(s); root.add(body); hinge.position.set(L.x[1], L.hip, 0); inner.position.set(-L.x[1], -L.hip, 0); hinge.add(inner); body.add(hinge);
  const u = { uT157: windTime, uE157: { value: 0 }, uG157: { value: 0 }, uR157: { value: new THREE.Color(1, 1, 1) }, uV160: { value: 1 }, uF160: { value: 1.5 } };
  const coat = lacquer157(s, u, 'coat', STRAP_GLSL + VINE160, VINE_BODY160 + RIM160), legCoat = lacquer157(s, u, 'leg', HOOF_GLSL);
  const gilt = new THREE.MeshStandardMaterial({ color: '#e6ad48', metalness: 1, roughness: 0.24, emissive: '#ffb050', emissiveIntensity: 0 }); // 159 A: a golden glow at night, not orange
  const plate = new THREE.MeshStandardMaterial({ color: '#c08a3c', metalness: 1, roughness: 0.5, emissive: '#ffb050', emissiveIntensity: 0 }), fire = glass157();
  const gem = fireMat('#ffd2c2', '#f0352a', '#9e0c1c', 0.97, 0.9), eye = eyeMat.clone(); // 160 B the public figure's jewel, as it is; an ember's glint in each eye:
  eye.onBeforeCompile = sh => { sh.uniforms.uT157 = windTime; // a warm spot fixed to the view (the bead turns under it), a white-hot core, flickering a little
    sh.fragmentShader = 'uniform float uT157;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float e = dot(normal, normalize(vec3(-0.5, 0.62, 0.6))); totalEmissiveRadiance += (vec3(1.0, 0.32, 0.04) * 1.3 * smoothstep(0.94, 0.97, e) + vec3(1.0, 0.85, 0.5) * smoothstep(0.982, 0.994, e)) * (0.88 + 0.12 * sin(uT157 * 5.0)); }`); };
  eye.customProgramCacheKey = () => 'eye160';
  const mat = { body: coat, leg: legCoat, gilt, hoof: legCoat, plate, eye, fire, hooffire: fire, gem };
  const mesh = k => { const o = new THREE.Mesh(G[k], mat[k]); if (mat[k].transparent) o.renderOrder = 3; else o.castShadow = o.receiveShadow = true; return o; };
  for (const k of ['body', 'eye', 'plate', 'gilt', 'fire', 'gem']) inner.add(mesh(k));
  const legs = [L.x[0], L.x[1]].flatMap(x => [L.z, -L.z].map(z => { const g = new THREE.Group(); g.position.set(x, L.hip, z); g.add(mesh('leg'), mesh('hoof'), mesh('hooffire')); // 159 A: the flame cuff back
    g.userData = { front: x > 0, pair: (x > 0) === (z > 0) }; (x > 0 ? inner : body).add(g); return g; }));
  // sparks: off the flames' tips (the wings' too), drifting up and back, twinkling out (fewer when motion is calmed); brighter at night
  const th = G.fire.attributes._thickness, fp = G.fire.attributes.position, tips = [];
  for (let i = 0; i < th.count; i++) if (th.getX(i) % 1 > 0.7) (tips[th.getX(i) | 0] ||= []).push(i);
  // each flame its share (by vertex count the finely baked feathers would take four in five), the crest's and tail's (near the midline) twice
  const slots = tips.filter(Boolean).flatMap(t => Math.abs(fp.getZ(t[0])) < 0.3 ? [t, t] : [t]);
  const N = !slots.length ? 0 : calm() ? 20 : 76 /* 160 B: 159 A 16 / 56 */, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const seed = Array.from({ length: N }, (_, j) => { const t = slots[j % slots.length], i = t[Math.random() * t.length | 0]; return [Math.random(), fp.getX(i), fp.getY(i), fp.getZ(i), 1.6 + Math.random() * 1.4]; });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const embers = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.19, map: dot('rgba(255,250,225,1)', 'rgba(255,150,50,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; embers.renderOrder = 4; inner.add(embers);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: dot('rgba(255,190,110,1)', 'rgba(255,150,70,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.renderOrder = 1; root.add(pool);
  const bodyMin = 0.7;
  let night = 0;
  return {
    obj: root, embers, pool,
    pose(p) { // as makeMyth's
      const lie = p.lie || 0, rear = p.rear || 0, ph = p.ph || 0, sn = Math.sin(ph * Math.PI * 2), run = p.gait === 'run', trot = p.gait === 'trot' || p.gait === 'walk';
      body.position.y = -lie * (bodyMin - 0.12) * s + (run || trot ? Math.abs(sn) * (run ? 0.09 : 0.05) * s : 0);
      body.rotation.z = (p.rot || 0) + (run ? 0.05 * Math.sin(ph * Math.PI * 2 + 1) : 0);
      hinge.rotation.z = rear * 0.75;
      for (const leg of legs) {
        const { front, pair } = leg.userData;
        let a = 0;
        if (trot) a = (pair ? 1 : -1) * sn * (p.gait === 'walk' ? 0.38 : 0.5);
        else if (run) a = Math.sin(ph * Math.PI * 2 + (front ? 0 : 1.6) + (leg.position.z > 0 ? 0.35 : 0)) * 0.7;
        if (front) a += rear * (0.25 + 0.3 * Math.sin(ph * Math.PI * 4 + (leg.position.z > 0 ? 1.5 : 0)));
        leg.scale.set(1 - 0.9 * lie, (1 - 0.95 * lie) * (front ? 1 - 0.18 * rear : 1), 1 - 0.9 * lie);
        leg.rotation.z = (a - body.rotation.z) * (1 - lie) + lie * (front ? 1.3 : 1.5);
      }
      const fl = Math.max(p.flare || 0, rear);
      fire.uniforms.uF.value = fl; fire.uniforms.uW.value = calm() ? 0.3 : 1 + fl;
    },
    tick(t, n = night) {
      night = n; u.uE157.value = 0.03 + 0.07 * n; // 159 A: the ember inside dimmer (157: 0.25; 0.15 still read cherry), so the oxblood stays deep at night
      u.uG157.value = gilt.emissiveIntensity = plate.emissiveIntensity = 0.1 * n; // the gold catching the fire's light at night (159 A: 0.32 smeared it orange)
      u.uR157.value.setRGB(1 - 0.55 * n, 1 - 0.7 * n, 1 - 0.8 * n); // the mirror coat's reflection: a dim warm one at night
      fire.uniforms.uN.value = gem.uniforms.uN.value = n; pool.material.opacity = 0.55 * n; pool.visible = n > 0;
      u.uV160.value = 1 + 0.6 * n; u.uF160.value = 1.5 + 0.8 * n; // 160 B the vines' glow and the fire's rim light, more at night
      for (let i = 0; i < N; i++) { const [o, x, y, z, per] = seed[i], k = (t / per + o) % 1, f = Math.sin(Math.PI * k) ** 2 * (0.75 + 0.25 * Math.sin(t * 13 + i * 2.7)) * (0.4 + 0.6 * n);
        pos[i * 3] = x - 0.3 * k + 0.05 * Math.sin(t * 2.1 + i); pos[i * 3 + 1] = y + 0.9 * k; pos[i * 3 + 2] = z + 0.06 * Math.cos(t * 1.7 + i * 2);
        col[i * 3] = f; col[i * 3 + 1] = f * 0.8; col[i * 3 + 2] = f * 0.45; }
      pg.attributes.position.needsUpdate = pg.attributes.color.needsUpdate = true;
    },
    dispose() { for (const o of [coat, legCoat, gilt, plate, fire, gem, eye, pg, embers.material, embers.material.map, pool.geometry, pool.material, pool.material.map]) o.dispose(); }, // G (the loaded file) and eyeMat are shared (eye its clone)
  };
}
