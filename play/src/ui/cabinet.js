// 진열장: a 3D cabinet per habitat, one shelf per species, one spot per variant (codex order). A variant in the codex
// stands there as its figure, in the colour picked for it (tap it: the colours seen so far); one not found yet is a
// faint silhouette. A full shelf gets gold trim and sparkles; a full cabinet a star on top. Figures sway slowly.
// The cabinet fits the screen's width; a shelf with more figures than fit slides sideways on its own (drag along it),
// its overflowing end faded. Drag up and down for more shelves. Its own small renderer, running only while open (the
// habitat pauses meanwhile); three.js frustum culling skips figures off screen, clipping cuts any past the side boards.
import * as THREE from 'three';
import * as G from '../game/game.js';
import { HABITATS } from '../game/data.js';
import { codexCells, colorsOf, displayColor, variantsOf, key } from '../game/rules.js';
import { studio, nightLights } from './thumbs.js';
import { makeFigure, loadModel } from '../animals/figure.js';
import { toyMat, roundedBox } from '../habitat/toyKit.js';
import { DEBUG, calm } from '../config.js';

const el = document.getElementById('cab');
const SX = 1.5, SY = 1.9, FIT = 1.1, COLS = 3.5; // spot width, shelf height, a figure's box, spots across the screen
const W = COLS * SX + 0.5, EDGE = W / 2 + 0.25; // the cabinet's inside width; its outer edge (side boards) = the screen's edges
const silMat = new THREE.MeshBasicMaterial({ color: '#cdb895', transparent: true, opacity: 0.45, depthWrite: false });
const wood = toyMat('#a8703f', { roughness: 0.55 }), panel = toyMat('#f6e2c2', { roughness: 0.85 }), gold = toyMat('#f5c542', { roughness: 0.22, metalness: 0.9 });
const swatch = c => c.second ?? Object.values(c).find(v => typeof v === 'string' && v[0] === '#') ?? '#ccc';
const sparkTex = (() => { const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,225,120,.8)'); gr.addColorStop(1, 'rgba(255,210,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fffbe8'; g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4); return new THREE.CanvasTexture(cv); })();
// the fade over a shelf's end that has more figures past it: the back panel's colour, solid at the side board, clear inward
const fadeMat = Object.assign(panel.clone(), { transparent: true, depthWrite: false, opacity: 0.92, alphaMap: (() => {
  const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 1 }), g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 1); return new THREE.CanvasTexture(cv); })() });
const fadeGeo = new THREE.PlaneGeometry(0.75, SY - 0.14);
// figures are cut at the side boards' insides (only here: the habitat's renderer leaves local clipping off)
const clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), W / 2), new THREE.Plane(new THREE.Vector3(1, 0, 0), W / 2)];

let night = false; // 21-1 밤에 보기: this screen only, off each time it opens
let st = null, tab = HABITATS[0].id, hab = null, live = false, sel = null, built = '', figs = [], fx = [], star = null, bounds = null, shelves = [], topOf = null;
const offs = {}; // how far each shelf is slid (tab + row), kept while the game runs
const sig = () => JSON.stringify([tab, codexCells(tab).map(c => G.S.codex[c.key] ? (displayColor(G.S, c.key) ?? 1) + (G.S.codex[c.key].adult == null ? 'b' : '') : 0)]);

export function openCabinet(habId, api) {
  tab = habId || tab; hab = api; sel = null; el.hidden = false; hab?.setActive(false);
  el.innerHTML = `<div class="chead"><b>진열장</b><span id="cabn"></span><button class="back" data-night>밤에 보기</button><button class="back" data-close>닫기</button></div>
<div class="ctabs">${HABITATS.map(h => `<button data-tab="${h.id}"${h.id === tab ? ' class="on"' : ''}${G.S.unlocked.includes(h.id) || codexCells(h.id).some(c => G.S.codex[c.key]) ? '' : ' disabled'}>${h.name}</button>`).join('')}</div>
<div class="cview" id="cview">${DEBUG ? '<p class="cfps" id="cfps"></p>' : ''}</div><div class="cchips" id="cchips"><p>피규어를 누르면 본 색 중에서 고를 수 있어요</p></div>`;
  if (!st) setup();
  night = false; setNight();
  el.querySelector('#cview').prepend(st.R.domElement);
  resize(); built = ''; topOf = null; build();
  if (!live) { live = true; st.last = performance.now(); requestAnimationFrame(frame); }
}
function close() { el.hidden = true; live = false; hab?.setActive(true); }

function setNight() {
  nightLights(st.S, night); st.R.setClearColor(night ? '#262d4a' : '#e9d2ae', 1);
  st.hemi.color.set(night ? '#8e9ad0' : '#fff6e8'); st.hemi.groundColor.set(night ? '#3a3550' : '#b48a5c'); st.hemi.intensity = night ? 0.35 : 0.6; silMat.color.set(night ? '#69709a' : '#cdb895');
  const b = el.querySelector('[data-night]'); if (b) b.textContent = night ? '낮에 보기' : '밤에 보기';
}
function setup() {
  const S = studio(), { R, scene } = S; R.setClearColor('#e9d2ae', 1);
  R.localClippingEnabled = true;
  const hemi = new THREE.HemisphereLight('#fff6e8', '#b48a5c', 0.6); scene.add(hemi);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 200), root = new THREE.Group(); scene.add(root);
  st = { S, R, scene, cam, root, hemi, last: 0, fN: 0, fT: 0 };
  // drag sideways = slide the shelf under the finger, up and down = more shelves; a tap picks a figure
  let down = null; const cv = R.domElement; cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => { const s = shelfAt(e); down = { x: e.clientX, y: e.clientY, cy: cam.position.y, s, off: s?.g.position.x, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 6) down.moved = true;
    const k = 2 * (cam.position.z - 0.1) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / cv.clientHeight; // world units per pixel at the figures
    if (down.s) slide(down.s, down.off + dx * k);
    look(down.cy + dy * k);
  });
  cv.addEventListener('pointerup', e => { if (down && !down.moved) tap(e); down = null; });
}
function look(y) { // keep the view on the cabinet (it is as wide as the screen: only up and down)
  if (!bounds) return;
  const b = bounds, cam = st.cam, hh = cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(0, b.top - b.bot <= 2 * hh ? (b.top + b.bot) / 2 : THREE.MathUtils.clamp(y, b.bot + hh, b.top - hh), cam.position.z);
  cam.lookAt(0, cam.position.y, 0);
}
// a shelf's figures slide between its first and its last at the inside edges; a fade shows at an end with more past it
function slide(s, x) {
  s.g.position.x = offs[s.key] = THREE.MathUtils.clamp(x, s.min, 0);
  s.fades[0].visible = s.g.position.x < -0.01; s.fades[1].visible = s.g.position.x > s.min + 0.01;
}
function resize() {
  const v = el.querySelector('#cview'), w = v.clientWidth, h = v.clientHeight;
  st.R.setPixelRatio(Math.min(devicePixelRatio, 2)); st.R.setSize(w, h); st.cam.aspect = w / h; st.cam.updateProjectionMatrix();
  st.cam.position.z = 0.9 + EDGE / Math.tan(THREE.MathUtils.degToRad(st.cam.fov / 2)) / st.cam.aspect; // the side boards' fronts at the screen's edges
}

const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(roundedBox(w, h, d, Math.min(0.06, h / 2.2), 2), mat); m.position.set(x, y, z); return m; };
// a variant registered but never seen grown up stands as its baby (a little smaller)
function figure(c, sil) {
  const baby = !sil && G.S.codex[c.key]?.adult == null;
  const f = makeFigure(c.species.id, sil ? variantsOf(c.species)[0].id : c.variant.id, baby ? 'baby' : 'adult', null, sil ? null : displayColor(G.S, c.key)).obj; // a silhouette: the species' plain shape
  f.traverse(o => { if (sil && o.isMesh) { o.material = silMat; o.children.length = 0; } if (o.material) for (const m of [o.material].flat()) m.clippingPlanes = clip; });
  const b = new THREE.Box3().setFromObject(f), s = b.getSize(new THREE.Vector3()), k = FIT / Math.max(s.y, s.x * 0.72, s.z) * (baby ? 0.8 : 1);
  const g = new THREE.Group(); f.scale.setScalar(k); f.position.y = -b.min.y * k; g.add(f); return g;
}
async function build() {
  const want = sig(); if (want === built) return; built = want;
  const cells = codexCells(tab), sps = [...new Set(cells.map(c => c.species))];
  await Promise.all(sps.map(s => loadModel(s.model))); if (want !== sig()) return;
  st.root.clear(); figs = []; fx = []; star = null; shelves = [];
  const rows = sps.length;
  const top = rows * SY, all = cells.every(c => G.S.codex[c.key]);
  st.root.add(box(W + 0.5, top + 0.5, 0.2, panel, 0, top / 2 - 0.1, -0.85), box(0.25, top + 0.5, 1.8, wood, -W / 2 - 0.12, top / 2 - 0.1, 0),
    box(0.25, top + 0.5, 1.8, wood, W / 2 + 0.12, top / 2 - 0.1, 0), box(W + 0.8, 0.3, 1.9, wood, 0, top + 0.1, 0));
  sps.forEach((sp, row) => {
    const y = (rows - 1 - row) * SY, mine = cells.filter(c => c.species === sp), full = mine.every(c => G.S.codex[c.key]);
    st.root.add(box(W, 0.14, 1.7, wood, 0, y - 0.07, 0), box(W, 0.1, 0.08, full ? gold : wood, 0, y - 0.07, 0.86));
    st.root.add(plaque(`${sp.name} ${mine.filter(c => G.S.codex[c.key]).length}/${mine.length}`, -W / 2 + 0.9, y - 0.07, 0.92, full));
    const g = new THREE.Group(); st.root.add(g);
    mine.forEach((c, i) => {
      const got = !!G.S.codex[c.key], f = figure(c, !got), x = -W / 2 + 0.25 + SX * (i + 0.5);
      f.position.set(x, y, 0.1); f.userData = { c, got, ph: row * 1.7 + i * 0.9 }; g.add(f); figs.push(f);
    });
    const fades = [1, -1].map(s => { const m = new THREE.Mesh(fadeGeo, fadeMat); m.scale.x = s; m.position.set(-s * (W / 2 - 0.375), y + (SY - 0.14) / 2, 0.88); st.root.add(m); return m; });
    const s = { g, fades, y, min: Math.min(0, W - 0.5 - mine.length * SX), key: tab + row }; shelves.push(s); slide(s, offs[s.key] ?? 0);
    if (full) { // sparkles drifting up along the shelf
      const n = Math.round(W * 2.5), pos = new Float32Array(n * 3), pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: sparkTex, size: 0.32, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * W, y + Math.random() * SY * 0.8, 0.3 + Math.random() * 0.6], i * 3);
      pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.userData = { y, seed: row }; st.root.add(pts); fx.push(pts);
    }
  });
  if (all) { // the whole habitat: a gold star on top
    const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.28 : 0.62, a = Math.PI / 2 + i * Math.PI / 5; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    star = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }).center(), gold);
    star.position.set(0, top + 0.95, 0.2); st.root.add(star);
  }
  bounds = { top: top + (all ? 1.7 : 0.6), bot: -0.6 };
  if (topOf !== tab) { topOf = tab; look(1e9); } // a new tab (or just opened): start at the top; a rebuild (colour picked) stays put
  const have = cells.filter(c => G.S.codex[c.key]).length; el.querySelector('#cabn').textContent = `${have}/${cells.length}`;
  if (sel) pick(figs.find(f => f.userData.c.key === sel)); // keep the colour chips after a rebuild
}
function plaque(text, x, y, z, full) {
  const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 64 }), g = cv.getContext('2d');
  g.fillStyle = full ? '#f5c542' : '#fbf1e1'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill();
  g.fillStyle = '#5a3d24'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })); m.position.set(x, y, z); return m;
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), front = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.1), hitV = new THREE.Vector3();
function aim(e) { const r = st.R.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, st.cam); }
const shelfAt = e => { aim(e); return ray.ray.intersectPlane(front, hitV) && shelves.find(s => hitV.y >= s.y - 0.1 && hitV.y < s.y + SY - 0.1); };
function tap(e) {
  aim(e);
  const hit = ray.intersectObjects(figs, true)[0]; let o = hit?.object; while (o && !figs.includes(o)) o = o.parent;
  pick(o);
}
function pick(f) {
  const bar = el.querySelector('#cchips');
  if (!f) { sel = null; bar.innerHTML = '<p>피규어를 누르면 본 색 중에서 고를 수 있어요</p>'; return; }
  const { c, got } = f.userData; sel = c.key;
  if (!got) { bar.innerHTML = '<p>아직 못 찾은 변종이에요</p>'; return; }
  const all = colorsOf(c.species.id, c.variant.id), seen = G.S.colors[c.key] || [], cur = displayColor(G.S, c.key);
  const held = G.S.animals.filter(a => a.hold && key(a.species, a.variant) === c.key).length, kid = G.S.codex[c.key].adult == null;
  bar.innerHTML = `<p><b>${c.variant.name} ${c.species.name}</b> · 본 색 ${seen.length}/${all.length}${kid ? ' · 아직 새끼 모습만 봤어요' : ''}${held ? ` · 성장 멈춤 ${held}마리` : ''}</p><div>${all.filter(x => seen.includes(x.id))
    .map(x => `<button data-c="${x.id}"${x.id === cur ? ' class="on"' : ''}><u style="background:${swatch(x)}"></u>${x.name}</button>`).join('') || '<small>색이 하나뿐인 변종이에요</small>'}</div>`;
}

function frame(now) {
  if (!live) return; requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - st.last) / 1000), t = now / 1000, still = calm(); st.last = now; // 27-7d 움직임 줄이기: no sway, rising sparkles or turning star
  for (const f of figs) f.rotation.y = -Math.PI / 2 + 0.45 + (still ? 0 : Math.sin(t * 0.5 + f.userData.ph) * 0.35);
  if (!still) for (const p of fx) { const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.25; if (y > p.userData.y + SY * 0.85) y = p.userData.y + 0.05; a.setY(i, y); } a.needsUpdate = true; p.material.opacity = 0.65 + 0.35 * Math.sin(t * 3 + p.userData.seed); }
  if (star && !still) star.rotation.y = t * 0.8;
  st.R.render(st.scene, st.cam);
  st.fN++; st.fT += dt;
  if (DEBUG && st.fT >= 1) { el.querySelector('#cfps').textContent = `FPS ${(st.fN / st.fT).toFixed(0)} · 드로콜 ${st.R.info.render.calls} · 피규어 ${figs.filter(f => f.userData.got).length} · 실루엣 ${figs.filter(f => !f.userData.got).length}`; st.fN = st.fT = 0; }
}

el.addEventListener('click', e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!b) return;
  if (d.close != null) close();
  else if (d.night != null) { night = !night; setNight(); }
  else if (d.tab) { tab = d.tab; sel = null; pick(null); el.querySelectorAll('.ctabs button').forEach(x => x.classList.toggle('on', x === b)); build(); }
  else if (d.c && sel && G.setDisplay(sel, d.c)) build();
});
addEventListener('resize', () => { if (!el.hidden && st) { resize(); look(st.cam.position.y); } });
G.on(() => { if (!el.hidden) build(); });
