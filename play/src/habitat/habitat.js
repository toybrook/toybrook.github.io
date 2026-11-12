// Habitat viewer: renderer, camera, lights, the player's animals, taps, render loop. Only for watching: eggs and
// hatching live in the nest menu (ui/nest.js); a baby sent out from there drops in here (drop). Decor props the player
// placed (서식지 꾸미기) stand here too; decorate mode (ui/decor.js) moves one at a time (editProp).
// Knows no species: it loads the models of whoever lives in this habitat (data.js) and drives each with its
// model's behaviour (src/animals/<move>.js).
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { buildMeadow } from './meadow/index.js';
import { buildPond } from './pond/index.js';
import { buildSnow } from './snow/index.js';
import { rectAt, strip, zoneSet, BOARD0 } from './zones.js';
import { mist } from './mist.js';
import { windTime } from './toyKit.js';
import { daylight, fireflies, hourNow } from './daylight.js';
import { butterflies } from './butterflies.js';
import { weather, weatherNow } from './weather.js';
import { glassLite } from '../animals/materials.js';
import { natureLayer, grassMask } from './nature.js';
import { free, gapTo } from '../animals/crowd.js';
import { stamps, bump } from './stamps.js';
import { linesLayer } from './lines.js';
import { loadModel, loadAcc } from '../animals/figure.js';
import { DROP, STAGE_NAME, dropFrom } from '../animals/growth.js';
import { SPECIES, MODELS, PROPS, NATURE, BALANCE, SETS, SIZES, BRUSHES, sizeF, paletteOf, sizable } from '../game/data.js';
import { SP, variantOf, habitatOf, known, topAt } from '../game/rules.js';
import { QUALITY, DEBUG, PREFS, calm } from '../config.js';
import { ambience, sfx, music, playing, hear, pet } from '../ui/sound.js';
import { tracksOf, network, railEnds, joinTurn, newTrain, moveTo, stepTrain, boardAt, TILE, CARS } from './train.js';
import { trainModel, recolor, treeCover } from './meadow/props.js';
import { newPlay } from '../animals/play.js';
import { blobSlot, ROOM } from '../animals/walk.js';
import { landOf } from './land.js';

const BUILD = { meadow: buildMeadow, pond: buildPond, snow: buildSnow }; // scene of each habitat that is ready (HABITATS ready: true)
// 27-1: three hangs a 'dispose' listener from each renderer on every geometry, material and texture that renderer draws,
// and the listener holds the renderer's GL context. The shared (cached) ones outlive a habitat built again (main.js
// rebuild), so every old renderer stayed alive (+0.5 MB a rebuild). Each habitat notes what its renderer hangs while it
// draws (hooks) and takes it off in dispose().
let hooking = null;
const listen = THREE.EventDispatcher.prototype.addEventListener;
THREE.EventDispatcher.prototype.addEventListener = function (type, fn) { if (hooking && type === 'dispose') hooking.push([new WeakRef(this), fn]); return listen.call(this, type, fn); };
function hooks(renderer) {
  let list = [], max = 512;
  for (const k of ['render', 'compile']) { // 27-2: compile too (compileAsync before the curtain lifts)
    const f = renderer[k];
    renderer[k] = (...a) => {
      const was = hooking; hooking = list; let out; try { out = f.apply(renderer, a); } finally { hooking = was; }
      if (list.length > max) { list = list.filter(([r, f]) => r.deref()?.hasEventListener('dispose', f)); max = Math.max(512, list.length * 2); } // gone or let go already
      return out;
    };
  }
  return () => { for (const [r, f] of list) r.deref()?.removeEventListener('dispose', f); list = []; };
}

// ui: { zzz([x, y]), onCam(state: 'f' following / 'a' away from the start view / ''), tag(text, record), onTap('actor', record, x, y), onPropTap(uid), onEdit(ok),
//      onPaint(cells [[i, j]], brush) (22-1 땅 칠하기: a stroke just ended), onSweep(uids) (42 F-6 자연 정리: the natives in a box drawn), note(k, n) (23-2 도전 과제: 'lights' lit at night, 'roof' animals under one in the rain) }
// records: the saved animals now (guests staying here, rules.js settle, need their models too)
// 21-3b: level = the habitat's 땅 넓히기 step (the next one's band is built too, under mist); pose = the camera to start from
// (the habitat this one replaces, main.js); reveal = the mist draws back off the band just bought
const modelsOf = (habId, records) => [...new Set([...SPECIES.filter(s => s.habitat === habId), ...records.filter(r => habitatOf(r) === habId).map(r => SP[r.species])].filter(Boolean).map(s => s.model))];
// 26-1: the habitat the player will most likely open, fetched in a quiet moment after the first screen
export const prefetch = (habId, records) => Promise.all(modelsOf(habId, records).map(loadModel));

export async function startHabitat(container, ui, habId, records = [], { level = 0, pose = null, reveal = false } = {}) {
  const W = () => container.clientWidth, H = () => container.clientHeight;
  // 28-1: the open ground and the board as built, [x0, x1, z0, z1] (zones.js: each step adds a zone along one side)
  const top = Math.min(level + 1, BALANCE.expand.price.length), open = rectAt(habId, level), built = rectAt(habId, top);
  const panX = [open[0] + 6, open[1] - 6], panZ = [open[2] + 9, open[3] - 7]; // where the free camera may look (the first board: x +-12, z -20..22)
  const mid0 = new THREE.Vector3((open[0] + open[1]) / 2, 0, (open[2] + open[3]) / 2 + 3); // the home view's middle (the first board's: 0, 3)
  const ac = new AbortController(), sig = { signal: ac.signal }; let dead = false; // dispose(): every listener off, the loop stopped
  // Pixel ratio capped at 2 (a 3x phone renders 2.25x fewer pixels; the difference is hard to see on toys); 26-3: 보통 1.5, 낮음 1.25.
  // MSAA only on low-DPI screens: at 2x the pixels are small enough, and MSAA at 2x is the most expensive thing here.
  const G = QUALITY.g; // 26-3 그래픽 품질: read once a build (changing it in 설정 builds the habitat again, main.js)
  const devPR = () => (window.devicePixelRatio || 1) * (window.__stageScale || 1);
  const maxPR = () => Math.min(devPR(), G.pr);
  let pr = maxPR();
  const renderer = new THREE.WebGLRenderer({ antialias: devPR() < 2, alpha: true, powerPreference: 'high-performance' });
  const unhook = hooks(renderer);
  // inbox 49: the GL context lost and given back (an Android phone sending the app to the back): three makes its state again, but the board,
  // animals and props come back black (only the water drew). main.js builds this habitat again (under the cloud if it is on screen)
  // inbox 53: not given back in 3 s (the GPU busy elsewhere, or the browser dropped it for good): main.js builds it again on a new canvas
  let lostT = 0; // -1: the 3 s passed (a late restore is not built a second time)
  renderer.domElement.addEventListener('webglcontextlost', () => { clearTimeout(lostT); lostT = setTimeout(() => { if (dead) return; lostT = -1; ui.lostLong?.(habId); }, 3000); }, sig);
  renderer.domElement.addEventListener('webglcontextrestored', () => { if (lostT === -1) return; clearTimeout(lostT); ui.restored?.(habId); }, sig);
  renderer.setPixelRatio(pr);
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = G.shadow > 0; // 낮음: no shadow map (the animals' blob shadows stay)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.autoUpdate = false; // scenery is static: render the shadow map once (ducks/horses use blob shadows)
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // the board floats like a diorama on a table: the same apricot gradient as #habitat's CSS, but painted into the canvas.
  // Phone browsers in forced dark mode (Samsung Internet, Chrome auto-dark) turn the CSS one dark brown; WebGL pixels are left alone.
  const bgCan = document.createElement('canvas'), bgTex = new THREE.CanvasTexture(bgCan);
  bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex; // sRGB background skips tone mapping: colours match the CSS
  let bgNow = null;
  function paintBg(bg = bgNow) { // bg: three gradient stops (the time of day's, daylight.js)
    bgNow = bg;
    // inbox 40: a fixed size. It is drawn in 0..1 and stretched over the screen anyway; a size that followed the screen's shape
    // overflowed the texture made at the first size when the phone turned or the window changed (WebGL INVALID_VALUE)
    const w = 128, h = 256, c = bgCan.getContext('2d');
    bgCan.width = w; bgCan.height = h;
    c.setTransform(1.2 * w, 0, 0, 0.8 * h, 0.5 * w, 0.3 * h); // unit circle -> radial-gradient(120% 80% at 50% 30%)
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, bg[0]); g.addColorStop(0.55, bg[1]); g.addColorStop(1, bg[2]);
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2); bgTex.needsUpdate = true;
  }
  const sunDir = new THREE.Vector3(-22, 40, -14).normalize(); // the day's; daylight.js moves it with the hour (the water reads it too)

  const camera = new THREE.PerspectiveCamera(34, W() / H(), 0.5, 300);
  // home view: high and wide; distance chosen so the board's width less 6 (the first board: 30) fits any screen aspect
  const homeDir = new THREE.Vector3(0, 54, 47).normalize(), fitW = Math.max((open[1] - open[0]) / 2 - 3, ((open[3] - open[2]) / 2 - 3) * 15 / 26), kR = fitW / 15;
  const homeRadius = () => THREE.MathUtils.clamp(fitW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 60 * kR, 110 * kR);
  camera.far = Math.max(300, 160 * kR); camera.updateProjectionMatrix(); // inbox 42 A: the bigger board's far side, zoomed all the way out
  // inbox 43: the start view is near while few friends are out here (0-3: 0.6 of the whole board's distance), farther with each one
  // past 3 and each step the board was widened, at most the whole board (homeRadius: the farthest zoom out, 꾸미기 and the zone view)
  const homeFit = n => homeRadius() * THREE.MathUtils.clamp(0.6 + Math.max(0, n - 3) * 0.045 + level * 0.08, 0.6, 1);
  camera.position.copy(mid0).addScaledVector(homeDir, homeFit(records.filter(r => !r.stored && !r.pending && habitatOf(r) === habId).length));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(mid0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.maxDistance = homeRadius() * 1.15; // tilt, turn and the nearest distance are set every frame (band)
  // inbox 14: one finger / left drag turns round the target (360 deg), two fingers / right drag / Shift+drag move the view,
  // pinch / wheel zoom toward the point between the fingers / under the cursor (following: toward the animal). Decorating: mapping()
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.zoomToCursor = true;
  controls.update();
  // a mouse wheel's notch is spread over a few frames (a smooth zoom; OrbitControls gets the pieces, 2.5x as strong: a notch
  // alone is only 5%). Trackpads send small steps already; they go the same way.
  let wheel = null;
  container.addEventListener('wheel', e => {
    if (e.target !== renderer.domElement || !e.isTrusted) return;
    e.preventDefault(); e.stopPropagation();
    wheel = { d: (wheel?.d ?? 0) + e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1) * 2.5, x: e.clientX, y: e.clientY };
  }, { capture: true, passive: false, ...sig });
  function feedWheel(dt) {
    if (!wheel) return;
    const d = Math.abs(wheel.d) < 4 ? wheel.d : wheel.d * (1 - Math.exp(-dt * 14)); wheel.d -= d;
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: d, clientX: wheel.x, clientY: wheel.y, cancelable: true }));
    if (!wheel.d) wheel = null;
    if (focus) { zoomed = true; extra = 0; } // the user's distance now (the rEnd check runs before this)
  }

  // one warm sun from back-left so shadows fall toward the viewer; ambient comes from the sky env map
  const sun = new THREE.DirectionalLight('#ffe6c4', 2.1);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = G.shadow > 0;
  sun.shadow.mapSize.setScalar(G.shadow || 1024);
  const kS = Math.max(Math.max(-built[0], built[1]) / 18, Math.max(-built[2], built[3]) / 29); // the shadow (round the middle, 0, 0) covers the board as built
  Object.assign(sun.shadow.camera, { left: -34 * kS, right: 34 * kS, top: 40 * kS, bottom: -40 * kS, near: 1, far: 140 * kS });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun);
  const sky = weather(scene, camera, controls, habId, [built[0] - 2, built[1] + 2, built[2] - 2, built[3] + 2]); // 21-2: rain, fog, rainbow (before the light: it makes the fog the light colours)
  const light = daylight(renderer, scene, sun, sunDir, paintBg); light(sky.now().gray); // 21-1: sun, sky, background by the hour

  // only the models of this habitat's species (and of guests here) are fetched, and only now (or a moment before: prefetch)
  const models = modelsOf(habId, records), moves = {};
  await Promise.all([...models.map(async m => { await loadModel(m); moves[m] = await import(`../animals/${MODELS[m].move}.js`); }),
    ...records.filter(r => r.acc && habitatOf(r) === habId).map(r => loadAcc(r.acc))]); // 26-1: the secret accessories worn here
  stamps.length = 0; // 28-6: the terrain stamps of the habitat before (syncStamps puts this one's back)
  const habitat = BUILD[habId](scene, { zzz: obj => ui.zzz(project(obj)) }, sunDir, level, top);
  renderer.shadowMap.needsUpdate = true;
  const mistTick = mist(scene, habitat.floor, open, built, reveal && level > 0 ? rectAt(habId, level - 1) : open), U = habitat.unit; // U: saved decor x, z -> here
  const flies = habId === 'meadow' ? fireflies(scene, habitat.ctx) : null; // 21-1: fireflies over the meadow at night (the pond: sparkles on its water)
  habitat.ctx.crowd = new Set(); // every animal's body capsule, so they keep apart (crowd.js)
  const bugs = butterflies(scene); habitat.ctx.sets = []; habitat.ctx.play = [];
  // 13-2 놀이 장면: a friend got on a play prop (walk.js, swim.js) / friends did something together (walk.js): to ui/play.js
  habitat.ctx.onPlay = q => ui.scene?.({ prop: q.st.kind, sp: [q.who.rec.species], n: q.st.seats.filter(Boolean).length, night: q.night, who: [q.who] });
  habitat.ctx.onSocial = (social, who) => ui.scene?.({ social, night: habitat.ctx.night, who }); // 23-2 세트 보너스: butterflies, and animals wander to a whole set (walk.js); 28-2: the play props placed (play.js)

  // the player's animals: one actor per saved record that lives here and isn't in storage
  const actors = new Map();
  let homed = false;
  const make = rec => { const a = moves[SP[rec.species].model].createActor(habitat.ctx, rec); actors.set(rec.id, a); return a; };
  function sync(records) {
    const want = new Map(records.filter(r => !r.stored && !r.pending && known(r) && habitatOf(r) === habId && moves[SP[r.species].model]).map(r => [r.id, r]));
    for (const [id, a] of actors) if (want.get(id) !== a.rec) { a.dispose(); actors.delete(id); if (focus === a) overview(); } // gone, or a new save reused the id
    const sp = habitat.ctx.spawn, R = fitW * 0.4; // inbox 43: opening with 0-3 friends they start round the middle (where a new one lands), so the close first view has them all
    if (!homed && want.size <= 3) habitat.ctx.spawn = () => { for (let k = 0; k < 30; k++) { const p = sp(); if (Math.hypot(p[0] - mid0.x, p[1] - mid0.z) < R) return p; } return sp(); };
    for (const [id, r] of want) if (!actors.has(id)) make(r);
    habitat.ctx.spawn = sp;
    if (!homed) { homed = true; setHome(); if (!pose) { controls.target.copy(HOME.target); camera.position.copy(HOME.target).addScaledVector(homeDir, HOME.radius); controls.update(); } } // inbox 43: the start view on the friends
  }
  // 28-1: the animals free to be sent somewhere (walk.js send); the nearest one that can go sent to x, z (the orchard's fruit, zoneprops.js)
  const idle = () => [...actors.values()].filter(a => a.send && !a.hold && a.obj.visible && !a.busy());
  habitat.ctx.sendNear = (x, z, act, o) => { const d = a => Math.hypot(a.position.x - x, a.position.z - z); return idle().sort((p, q) => d(p) - d(q)).some(a => a.send(x, z, act, o)); }; // the nearest that can go (mid-jump or swimming: the next)
  // the spot nearest the middle of the screen (or at: [x, z]) where ok(x, z) holds (rings out from it), else the middle
  const flat = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mid = new THREE.Vector3();
  // inbox 42 C2: R, how far out (refit: the whole board, the rings past 16 m finer, so a big prop finds a gap)
  function nearest(ok, at, R = 40) { // 42 F-2: 40 (was 16), so a big prop taken out on the snow or the pond (its middle busy) still finds a spot
    if (at) mid.set(at[0], 0, at[1]);
    else { ray.setFromCamera(ndc.set(0, 0), camera); if (!ray.ray.intersectPlane(flat, mid)) mid.set(0, 0, 3); }
    for (let r = 0; r < R; r += 0.8) for (let k = 0, n = r < 16 ? 12 : Math.ceil(r * 8); k < n; k++) {
      const x = mid.x + Math.cos(k / n * Math.PI * 2) * r, z = mid.z + Math.sin(k / n * Math.PI * 2) * r;
      if (ok(x, z)) return [x, z];
    }
    return [mid.x, mid.z];
  }
  // a baby sent out from the nest menu (or one taken out of storage): "퐁" onto open grass near the middle of the screen
  // (the pond: on its grass hill, ctx.landing; never water, never on someone), dust where it lands
  function drop(rec, look = false) {
    const a = actors.get(rec.id) ?? make(rec);
    const [x, z] = nearest((x, z) => habitat.ctx.walkable(x, z) && free(habitat.ctx.crowd, a.body, x, z), habitat.ctx.landing);
    a.drop(x, z); puffs.push({ x, z, t: -DROP.fall, bits: null });
    if (look) peek(x, z);
  }
  // inbox 43: after 「서식지로 보내기」 (look) the camera goes near the new friend, stays ~3 s (1.5 s with 움직임 줄이기), then
  // glides back to where it was. A touch on the view, a follow, 꾸미기, 사진 모드 or the train camera ends it where it is.
  let peekT = 0, back0 = null;
  function peek(x, z) {
    if (decorOn || snapOn || focus || trainCam) return;
    off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
    back0 ??= { at: controls.target.clone(), radius: sph.radius, phi: sph.phi }; goingHome = false; peekT = DROP.fall + (calm() ? 1.5 : 3);
    aim = { at: new THREE.Vector3(THREE.MathUtils.clamp(x, ...panX), 0, THREE.MathUtils.clamp(z, ...panZ)), radius: Math.min(18, back0.radius), phi: 0.9 };
  }

  // ---- 서식지 꾸미기: placed props from the save (a mesh, a crowd.js body, a layout blocker each) ----
  const D = habitat.decor, PR = Object.fromEntries(PROPS.map(p => [p.id, p])), placed = new Map(); // uid -> { obj, body, spot, sig }
  // inbox 42 B: the lands walkers are on (land.js), by kind ('' dry ground; 'swim' / 'wade' with the water it goes in), made again
  // when the props change (D.list: placed props, fence and wall lines, the board's own trees)
  const lands = {}; let landSig = 0;
  habitat.ctx.land = (kind = '') => {
    let sg = D.list.length; for (const o of D.list) sg = (sg * 31 + o.x * 17 + o.z * 7 + o.r) % 1e9;
    if (sg !== landSig) { landSig = sg; for (const k in lands) delete lands[k]; }
    const c = habitat.ctx; return lands[kind] ??= landOf(open, kind ? (x, z) => c.walkable(x, z) || c.wet(x, z, kind) : c.walkable, c.bridgeEnds.length > 1 ? [c.bridgeEnds.slice(0, 2)] : []);
  };
  habitat.ctx.cramped = again => ui.cramped?.(again); // no room inside a closed fence: one put outside (walk.js unstick), said once
  let snapOn = false; // 24-1 사진 모드: a wider camera band (band)
  let propList = [], decorOn = false, ed = null, drag = null, pinch = null, back = null, carry = null; // carry: inbox 42 E, the animal held up { a, id, x, z, dx, dz }
  // ed: the prop being moved { uid, P, obj, x, z, rot, ok }; back: the camera before it was picked up
  // 22-1: the board's own trees, bushes, rocks and flowers (S.props nat: 1) drawn by nature.js, a spot each in D.list (props keep
  // off, animals go round the big ones, the camera guard and the fade see them) and a rain roof under each tree; the paint
  // (S.paint) on the ground; the grass clumps under both hidden (a native's footprint, a path, sand or gravel)
  const NAT = Object.fromEntries(NATURE.map(n => [n.id, n])), nature = natureLayer(scene, habitat.ctx.heightAt, U), mask = grassMask(habitat.grass || []);
  let natSig = null, natSpots = [], natRoofs = [], paintNow = {}, paintSig = '{}', grassDirty = true, gridOn = false, brush, stroke = null, press = null, skipTap = false, sweepOn = false, box = null; // box: inbox 42 F-6 자연 정리, the rectangle being drawn
  const hideGrass = (x, z) => { const b = paintNow[`${Math.floor(x / U)},${Math.floor(z / U)}`]; if ((b >= 1 && b <= 3) || b >= 5) return true; // 25-1: snow and ice too
    for (const o of natSpots) if (!o.open && Math.abs(o.x - x) < o.r && Math.abs(o.z - z) < o.r && Math.hypot(o.x - x, o.z - z) < o.r) return true;
    const y = bump(x, z); return y < -0.1 ? true : Math.abs(y) > 0.005 ? y : false; }; // 28-6: on a stamp, raised (or lowered) with it; in a puddle, gone
  // 28-6 울타리·돌담: the standing brushes' cells (lines.js), a spot each in the decor list: animals go round, props keep off
  const lines = linesLayer(scene, (x, z) => D.y(x, z), U); let lineSpots = [];
  function syncLines(p = paintNow) {
    for (const o of lineSpots) { const i = D.list.indexOf(o); if (i >= 0) D.list.splice(i, 1); }
    lineSpots = lines.set(p).map(([x, z]) => ({ x, z, r: 0.5 * U, h: 0.85, line: 1, fade: null })); D.list.push(...lineSpots); renderer.shadowMap.needsUpdate = true;
  }
  const showPaint = p => { habitat.ground.setPaint(p); syncLines(p); }; // a stroke as it goes (or dropped)
  // may a fence or wall go in the cell at x, z: nothing standing there (props, the board's own, animals), so none is walled in
  const standOk = (x, z) => D.list.every(o => o.line || o.water || Math.hypot(o.x - x, o.z - z) > (o.open && !o.rail ? 0.4 : o.r) + 0.2)
    && habitat.solid.every(o => Math.hypot(o.x - x, o.z - z) > (o.r || 0) + 0.2) && free(habitat.ctx.crowd, { x, z, yaw: 0, r: 1.1, seg: [0, 0] }, x, z);
  // 28-6 지형 도장: the placed stamps here (and the held one, where it may go) in stamps.js, so the layout's heightAt has them; the
  // ground where one came or went shaped again, the grass and the board's own flowers and trees there set on it again
  let stampSig = '[]';
  function syncStamps() {
    const st = propList.filter(p => p.placed && p.hab === habId && !p.nat && PR[p.prop]?.stamp && p.uid !== ed?.uid).map(p => ({ x: p.x * U, z: p.z * U, r: PR[p.prop].r, h: PR[p.prop].stamp }));
    if (ed?.P.stamp && ed.ok) st.push({ x: ed.x, z: ed.z, r: ed.P.r, h: ed.P.stamp });
    const sg = JSON.stringify(st); if (sg === stampSig) return; stampSig = sg;
    const key = s => `${s.x},${s.z},${s.r},${s.h}`, now = new Set(st.map(key)), was = new Set(stamps.map(key)), box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of [...stamps.filter(s => !now.has(key(s))), ...st.filter(s => !was.has(key(s)))]) { box[0] = Math.min(box[0], s.x - s.r); box[1] = Math.min(box[1], s.z - s.r); box[2] = Math.max(box[2], s.x + s.r); box[3] = Math.max(box[3], s.z + s.r); }
    stamps.splice(0, stamps.length, ...st); habitat.ground?.reshape(box); grassDirty = true; renderer.shadowMap.needsUpdate = true;
    if (natSpots.some(o => o.x > box[0] - o.r && o.x < box[2] + o.r && o.z > box[1] - o.r && o.z < box[3] + o.r)) natSig = null; // syncNat: their heights again
  }
  function syncNat(list) {
    // inbox 42 C2: a wildflower patch under a placed prop (on land) is not drawn while the prop stands there (placeable lets props over them)
    const props = list.filter(p => p.placed && p.hab === habId && !p.nat && PR[p.prop] && !PR[p.prop].water && p.on == null), under = p => NAT[p.prop].open && props.some(q => Math.hypot(q.x - p.x, q.z - p.z) * U < PR[q.prop].r * SZ(q));
    const nats = list.filter(p => p.nat && p.placed && p.hab === habId && NAT[p.prop] && p.uid !== ed?.uid && !under(p)), sg = nats.map(p => `${p.uid},${p.x},${p.z},${p.rot}`).join(';');
    if (sg === natSig) return; natSig = sg;
    for (const o of natSpots) { const i = D.list.indexOf(o); if (i >= 0) D.list.splice(i, 1); if (o.twin?.on) scene.remove(o.twin.g); }
    for (const r of natRoofs) habitat.ctx.shelter.splice(habitat.ctx.shelter.indexOf(r), 1);
    const fades = nature.set(nats);
    natSpots = nats.map(p => { const N = NAT[p.prop], k = p.s || 1; return { x: p.x * U, z: p.z * U, r: N.r * k, h: N.h * k, open: !!N.open, nat: 1, prop: p.prop, uid: p.uid, fade: N.open ? null : fades.get(p.uid) }; }); // a flower patch never fades
    natRoofs = natSpots.filter(o => o.prop === 'tree' && o.h >= 3 && o.z > -22 * U).map(o => ({ x: o.x, z: o.z, r: o.r, cover: treeCover(o.h / 4.8) })); // as the trees in ctx.shelter were
    D.list.push(...natSpots); habitat.ctx.shelter.push(...natRoofs);
    habitat.ground?.setNatAO(natSpots.filter(o => !o.open)); grassDirty = true; renderer.shadowMap.needsUpdate = true;
  }
  const putProp = (obj, x, z, rot, P) => { obj.position.set(x, D.y(x, z, P.water), z); obj.rotation.y = rot;
    if (P.stamp) for (const c of obj.children) { const u = c.userData, cx = c.position.x, cz = c.position.z; u.y0 ??= c.position.y; // 28-6: each flower or rock on the ground under it;
      c.position.y = u.flat ? u.y0 - bump(x, z) : u.y0 + D.y(x + cx * Math.cos(rot) + cz * Math.sin(rot), z - cx * Math.sin(rot) + cz * Math.cos(rot)) - obj.position.y; } }; // flat (the dome, the water): from the ground round it
  // 28-5: a prop's look as saved (c: its colour, sz: its size) and its size factor; the ground under what stands on top spot k of h
  const SZ = r => sizeF(r?.P ?? PR[r?.prop], r?.sz); // r: a record, or ed (its P)
  const build = (P, r) => { if (P.ring) { const g = new THREE.Group(); for (const [x, z, q] of RING) { const o = D.model('railcurve'); o.position.set(x, 0, z); o.rotation.y = q * Math.PI / 2; g.add(o); } return g; } // inbox 37 작은 고리
    const o = D.model(P.id), c = r?.c && paletteOf(P)?.[r.c]?.[1]; if (c) recolor(o, c, P.pal === 'wood'); const f = SZ(r); if (f !== 1) o.scale.multiplyScalar(f); o.traverse(m => { if (m.userData.dome) m.visible = false; }); return o; }; // 28-6: the ground is the stamp's shape
  const seatY = (h, k) => D.y(h.x * U, h.z * U, PR[h.prop].water) + topAt(h, k).y; // inbox 42 A: a prop's height is in metres (only x, z are saved in U)
  const unplace = e => { scene.remove(e.obj); for (const b of e.bodies) habitat.ctx.crowd.delete(b); for (const o of [e.spot, ...e.more ?? []]) { const i = D.list.indexOf(o); if (i >= 0) D.list.splice(i, 1); } if (e.roof) habitat.ctx.shelter.splice(habitat.ctx.shelter.indexOf(e.roof), 1); if (e.spot.twin?.on) scene.remove(e.spot.twin.g);
    const st = e.obj.userData.play, i = habitat.ctx.play.indexOf(st); if (st) st.gone = true; if (i >= 0) habitat.ctx.play.splice(i, 1); }; // 28-2: whoever is on it gets off
  // a placed prop's crowd.js bodies: itself, or (open: walked over or under) only its model's posts (userData.posts, turned with it)
  const bodiesOf = (P, obj, x, z, rot, f = 1) => !P.open ? [{ x, z, yaw: 0, r: P.r * f, seg: [0, 0] }] // 28-5 f: its size
    : (obj.userData.posts || []).map(([px, pz]) => ({ x: x + (px * Math.cos(rot) + pz * Math.sin(rot)) * f, z: z + (-px * Math.sin(rot) + pz * Math.cos(rot)) * f, yaw: 0, r: 0.15, seg: [0, 0] }));
  // 23-2: a spot just outside each gap between an open prop's posts, d from its middle: walk.js goes in from there (straight at it, a post was in the way)
  const mouths = (bs, x, z, d) => { const A = bs.map(b => Math.atan2(b.z - z, b.x - x)).sort((a, b) => a - b);
    return A.map((a, i) => (a + (i ? A[i - 1] : A[A.length - 1] - 2 * Math.PI)) / 2).map(g => [x + Math.cos(g) * d, z + Math.sin(g) * d]); };
  // 24-2: the 미리보기 of a 꾸미기 code (S.ghost: props not owned yet), see-through, only while decorating; nothing stands on them
  const ghosts = new THREE.Group(); ghosts.visible = false; scene.add(ghosts);
  let ghostNow = [], ghostSig = '[]';
  const seeThrough = m => Object.assign(m.clone(), { transparent: true, opacity: 0.42, depthWrite: false });
  function syncGhosts(list) {
    const sg = JSON.stringify(list); if (sg === ghostSig) return; ghostSig = sg; ghostNow = list;
    for (const o of [...ghosts.children]) { ghosts.remove(o); o.traverse(m => { if (m.material) [m.material].flat().forEach(x => x.dispose()); }); }
    for (const g of list) {
      const P = PR[g.prop]; if (!P) continue;
      const obj = build(P, g); obj.traverse(o => { o.castShadow = o.receiveShadow = false; if (o.material) o.material = Array.isArray(o.material) ? o.material.map(seeThrough) : seeThrough(o.material); });
      putProp(obj, g.x * U, g.z * U, g.rot, P); obj.position.y += g.y || 0; obj.traverse(m => { if (m.userData.dome) m.visible = true; }); ghosts.add(obj); // 28-5 y: on top of another prop; 28-6: a stamp's shape
    }
  }
  // 24-2: may each of items ({ prop, x, z } as saved) stand on the board as it is now, as if nothing were placed yet (each one let in
  // counts for those after it). The layout's decor list is emptied for the check and put back.
  // 26-6: skip (a Set of uids): the rest of the board stays, only those spots are left out (a group moved or turned together)
  function fitAll(items, skip) {
    const keep = D.list.splice(0); if (skip) D.list.push(...keep.filter(o => !skip.has(o.uid)));
    try {
      return items.map(it => {
        const N = NAT[it.prop], P = N ?? PR[it.prop]; if (!P) return false; if (it.sl) return true; // 28-5: on top of another prop (rules.js seats it)
        const x = it.x * U, z = it.z * U, home = !skip && N && natSpots.find(o => o.prop === it.prop && Math.hypot(o.x - x, o.z - z) < 0.5 * U); // a tree etc. where this board grew one: it stays (not for a group moved: it is checked like a prop)
        const r = N ? N.r * (it.s || 1) : P.r * SZ(it), ok = !!home || (P.rail ? railFits(P, x, z, it.rot ?? 0, true) : D.placeable(x, z, r, !!P.water));
        if (ok) D.list.push(...P.rail ? railSpots(P, x, z, it.rot ?? 0) : [{ x, z, r: home ? home.r : r, water: !!P.water, open: !!P.open, nat: N ? 1 : 0 }]); return ok;
      });
    } finally { D.list.splice(0, D.list.length, ...keep); }
  }
  // inbox 42 A: after the board grew (rules.js to11 sets S.refit), each placed prop of this board that no longer fits (in water,
  // a wall, off the board, on another) goes to the nearest spot it fits; a rail piece goes with its loop, by whole tiles; none:
  // into storage. Checked one by one as fitAll, the board's own trees and fences staying. -> [{ uid, x, z } (saved) | { uid, off }]
  function refit(list) {
    const mine = list.filter(p => p.placed && p.hab === habId && !p.nat && PR[p.prop] && p.on == null), out = [];
    const keep = D.list.splice(0); D.list.push(...keep.filter(o => o.nat || o.uid == null));
    const spots = (P, p, x, z) => P.rail ? railSpots(P, x, z, p.rot ?? 0) : [{ x, z, r: P.r * SZ(p), water: !!P.water, open: !!P.open }];
    const fit = (p, x, z) => { const P = PR[p.prop]; return P.rail ? railFits(P, x, z, p.rot ?? 0, true) : D.placeable(x, z, P.r * SZ(p), !!P.water); };
    try {
      const rails = mine.filter(p => PR[p.prop].rail), loops = []; // rail pieces in touching groups (a tile apart)
      for (const p of rails) { const near = loops.filter(g => g.some(q => Math.hypot((q.x - p.x) * U, (q.z - p.z) * U) < TILE * 1.6)); const g = [p, ...near.flat()]; for (const n of near) loops.splice(loops.indexOf(n), 1); loops.push(g); }
      for (const g of loops) { // as it is, else moved by whole tiles, rings out to 3
        let done = false;
        for (let r = 0; r <= 3 && !done; r++) for (let i = -r; i <= r && !done; i++) for (let j = -r; j <= r && !done; j++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
          const at = g.map(p => [p.x * U + i * TILE, p.z * U + j * TILE]), n0 = D.list.length;
          if (g.every((p, k) => { const ok = fit(p, ...at[k]); if (ok) D.list.push(...spots(PR[p.prop], p, ...at[k])); return ok; })) { done = true; if (i || j) g.forEach((p, k) => out.push({ uid: p.uid, x: +(at[k][0] / U).toFixed(4), z: +(at[k][1] / U).toFixed(4) })); }
          else D.list.length = n0; }
        if (!done) for (const p of g) out.push({ uid: p.uid, off: true });
      }
      for (const p of mine) { if (PR[p.prop].rail) continue;
        let x = p.x * U, z = p.z * U;
        if (!fit(p, x, z)) { [x, z] = nearest((x, z) => fit(p, x, z), [x, z], 150); if (!fit(p, x, z)) { out.push({ uid: p.uid, off: true }); continue; } out.push({ uid: p.uid, x: +(x / U).toFixed(4), z: +(z / U).toFixed(4) }); }
        D.list.push(...spots(PR[p.prop], p, x, z));
      }
    } finally { D.list.splice(0, D.list.length, ...keep); }
    return out;
  }
  function syncProps(list = propList, paint = paintNow, ghost = ghostNow) {
    // 28-7: a board put aside (the map, or 땅 넓히기 building the next board on the same shared layout lists) does not sync;
    // play.attach -> draw syncs it again when it is back. Before, the old board pushed its nature spots into the new board's list (unseen blockers)
    if (!active) return;
    propList = list; syncStamps(); syncNat(list); syncGhosts(ghost || []);
    const ps = JSON.stringify(paint || {}); if (ps !== paintSig) { paintSig = ps; paintNow = paint || {}; habitat.ground?.setPaint(paintNow); syncLines(); grassDirty = true; }
    const want = new Map(list.filter(p => p.placed && p.hab === habId && !p.nat && PR[p.prop] && p.uid !== ed?.uid && (p.on == null || p.on !== ed?.uid)).map(p => [p.uid, p])); // 28-5: what stands on the held one goes with it
    const sigOf = r => `${r.x},${r.z},${r.rot},${r.c || 0},${r.sz || 0},${r.on ?? ''},${r.sl ?? ''}`;
    let changed = false;
    for (const [uid, e] of placed) { const r = want.get(uid); if (!r || sigOf(r) !== e.sig) { unplace(e); placed.delete(uid); changed = true; } }
    for (const [uid, r] of want) if (!placed.has(uid)) {
      const P = PR[r.prop], obj = build(P, r), x = r.x * U, z = r.z * U, f = SZ(r), h = r.on != null && list.find(o => o.uid === r.on);
      putProp(obj, x, z, r.rot, P); if (P.rail) drape(obj, P, x, z, r.rot); if (h) obj.position.y = seatY(h, r.sl); scene.add(obj);
      const bodies = h ? [] : bodiesOf(P, obj, x, z, r.rot, f), un = P.open && obj.userData.under; // 28-5: one on top of another: no body, no spot of its own on the ground
      const tall = new THREE.Box3().setFromObject(obj).max.y - obj.position.y, cv = P.cover === 'side' ? { y: tall, core: P.r * f, r: Infinity, side: true } : P.cover ? { y: P.cover[0] * f, core: P.cover[1] * f, r: P.cover[2] * f } : null; // inbox 42 D (walk.js shelter)
      const e = { prop: P.id, light: !!P.light, obj, bodies, spot: { uid, x, z, r: P.r * f, water: !!P.water, open: !!P.open, h: tall, fade: [[obj]] }, sig: sigOf(r), top: !!h,
        roof: P.shelter && !h ? { x, z, r: P.r * f, under: un || null, mouths: un ? mouths(bodies, x, z, un.r + 0.9) : null, cover: cv, placed: true } : null }; // roof: a rain shelter for walk.js (under: who fits goes beneath it, by a mouth)
      if (P.rail) { for (const b of bodies) b.rail = true; [e.spot, ...e.more] = railSpots(P, x, z, r.rot).map(o => ({ ...o, uid, h: e.spot.h })); e.rail = { uid, prop: P.id, x, z, rot: r.rot }; } // 28-4
      const st = obj.userData.play; if (st) { Object.assign(st, { x, z, rot: r.rot, y: obj.position.y, r: P.r }); habitat.ctx.play.push(st); e.spot.play = st; } // 28-2 소품 쓰기 (play.js)
      for (const b of e.bodies) habitat.ctx.crowd.add(b); if (!e.top) D.list.push(e.spot, ...e.more ?? []); if (e.roof) habitat.ctx.shelter.push(e.roof); placed.set(uid, e); changed = true;
    }
    if (changed) { renderer.shadowMap.needsUpdate = true; syncSets(); syncTrain(); } // the shadow map is drawn once; props change it
    if (changed && playing() && ![...placed.values()].some(e => e.prop === 'musicbox')) music(true); // 28-3: the music box put away: its tune stops
  }
  // 23-2: the sets whole here (the first placed one of each of its props)
  function syncSets() {
    const es = [...placed.values()], one = id => es.find(e => e.prop === id);
    const sets = SETS.map(s => ({ id: s.id, spots: s.props.map(one) })).filter(s => s.spots.every(Boolean))
      .map(s => ({ id: s.id, spots: s.spots.map(e => ({ x: e.spot.x, z: e.spot.z, y: e.obj.position.y, r: e.spot.r, h: e.spot.h, water: e.spot.water })) }));
    habitat.ctx.sets = sets.flatMap(s => s.spots); bugs.set(sets);
  }
  // ---- 28-4 장난감 기차: rail pieces (PROPS rail) go on a grid of 4x4 tiles, one to a tile (the bridge on two, its middle on their
  // edge), a quarter turn at a time; nothing else goes on them (their spots, r 2 a tile). Closed into a loop once (main.js ui.train),
  // the clockwork train runs on them (train.js), backing at an end when the rails are broken
  function railAt(P, x, z, rot) { // where it snaps to near x, z, and its tiles' middles
    const g = v => (Math.floor(v / TILE) + 0.5) * TILE, e = v => Math.round(v / TILE) * TILE, ax = Math.abs(Math.sin(rot)) < 0.5; // ax: the bridge along x
    if (P.ring) { x = e(x); z = e(z); return { x, z, ring: true, tiles: RING.map(([a, b]) => [x + a, z + b]) }; } // inbox 37: its middle on a tile corner
    if (P.id !== 'railbridge') { x = g(x); z = g(z); return { x, z, ax, tiles: [[x, z]] }; }
    if (ax) { x = e(x); z = g(z); return { x, z, ax, tiles: [[x - 2, z], [x + 2, z]] }; }
    x = g(x); z = e(z); return { x, z, ax, tiles: [[x, z - 2], [x, z + 2]] };
  }
  // inbox 37 작은 고리: four curves round one middle (x, z from it, quarter turns), held and put down at once (rules.js placeRing)
  const RING_P = { id: 'railring', name: '작은 고리', rail: 4, ring: true, r: 4 }, RING = [[-2, -2, 1], [2, -2, 0], [2, 2, 3], [-2, 2, 2]];
  const railSpots = (P, x, z, rot) => railAt(P, x, z, rot).tiles.map(([tx, tz]) => ({ x: tx, z: tz, r: TILE / 2, open: true, water: false, rail: true, fade: null }));
  // may it go there (exact: x, z must be where it snaps to, a saved one): its tiles free of rails, open ground under a tile (the
  // bridge: at each end; its middle may cross the stream, a rill or a path; dry: up to the bank, where walkers keep off), no other prop near it
  // inbox 37: the board's own flowers and trees in the way of a 작은 고리 there (as placeable sees them on its tiles), put away when
  // it goes down; strict: none may be in the way (가까운 빈 자리로 looks for bare ground first)
  const ringNats = (x, z) => natSpots.filter(o => RING.some(([a, b]) => Math.hypot(o.x - x - a, o.z - z - b) <= (o.open ? 0.4 : o.r) + 1.5));
  function railFits(P, x, z, rot, exact, strict) {
    const A = railAt(P, x, z, rot); if (Math.abs(Math.sin(2 * rot)) > 0.01 || exact && Math.hypot(A.x - x, A.z - z) > 0.02) return false; // inbox 42 A: saved / U * U is off by up to 0.0075
    const off = P.ring && !strict ? ringNats(A.x, A.z) : [], keep = D.list.splice(0); D.list.push(...keep.filter(o => !o.rail && !off.includes(o)));
    try {
      if (A.tiles.some(([a, b]) => keep.some(o => o.rail && Math.abs(o.x - a) < 0.1 && Math.abs(o.z - b) < 0.1))) return false;
      if (P.id !== 'railbridge') return A.tiles.every(([a, b]) => D.placeable(a, b, 1.4, false, true));
      const [dx, dz] = A.ax ? [1, 0] : [0, 1];
      return [-4.2, 4.2].every(s => D.placeable(A.x + s * dx, A.z + s * dz, 0.3, false, true))
        && [-3.2, -1.6, 0, 1.6, 3.2].every(s => D.list.every(d => Math.hypot(d.x - A.x - s * dx, d.z - A.z - s * dz) > (d.nat && d.open ? 0.4 : d.r) + 1.1));
    } finally { D.list.splice(0, D.list.length, ...keep); }
  }
  // a placed rail piece laid on the ground, vertex by vertex (the bridge: straight from one landing to the other, its arch on top)
  function drape(obj, P, x, z, rot) {
    const c = Math.cos(rot), s = Math.sin(rot), y0 = obj.position.y, ya = D.y(x - 4 * c, z + 4 * s), yb = D.y(x + 4 * c, z - 4 * s);
    obj.traverse(m => { if (!m.isMesh) return; m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix), p = g.attributes.position; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
      for (let i = 0; i < p.count; i++) { const lx = p.getX(i), lz = p.getZ(i); p.setY(i, p.getY(i) - y0 + (P.id === 'railbridge' ? ya + (yb - ya) * (lx + 4) / 8 : D.y(x + lx * c + lz * s, z - lx * s + lz * c))); }
      g.computeBoundingSphere(); m.geometry = g; });
  }
  // the train: its cars (a model, a crowd body marked .rail, a blob each) and its play.js state (st: who waits beside a straight
  // piece to ride a wagon round, play.js K.train). Built again only when a piece under it goes (moveTo)
  const CAR_C = ['#3fae6a', '#ffc22e', '#5aa9e6', '#e8463c'], hy = (x, z) => D.y(x, z); // the engine green; the wagons yellow, blue, red
  let train = null, railSig = '', trainCam = false; const trainAim = { at: new THREE.Vector3(), radius: 9, phi: 1 };
  const boarding = net => (me, x, z) => boardAt(net, me, x, z, (ax, az) => habitat.ctx.walkable?.(ax, az) ?? true, hy);
  function dropTrain() {
    if (!train) return; for (const c of train.cars) { scene.remove(c.obj); c.blob.free(); habitat.ctx.crowd.delete(c.body); }
    const i = habitat.ctx.play.indexOf(train.st); train.st.gone = true; if (i >= 0) habitat.ctx.play.splice(i, 1); train = null;
  }
  function syncTrain() {
    const pcs = [...placed.values()].filter(e => e.rail).map(e => e.rail), sg = JSON.stringify(pcs); if (sg === railSig) return; railSig = sg; railDots();
    const net = network(tracksOf(pcs, hy)), on = ui.train ? ui.train(habId, net.loop) : net.loop;
    if (!on || !net.group) return dropTrain();
    const gt = net.group.tracks, mid = gt.reduce((m, t) => [m[0] + t.pts[0] / gt.length, m[1] + t.pts[2] / gt.length], [0, 0]);
    if (train && moveTo(train.T, net)) { train.net = net; Object.assign(train.st, { board: boarding(net), x: mid[0], z: mid[1] }); return; }
    dropTrain(); const T = newTrain(net, net.group.len >= 20 ? 3 : 2); if (!T) return;
    const cars = T.lens.map((L, i) => { const obj = trainModel(i ? 'wagon' : 'engine', CAR_C[i]), sh = new THREE.Object3D(), body = { x: 0, z: 0, yaw: 0, r: 0.6, seg: [0.6 - L / 2, L / 2 - 0.6], rail: true };
      sh.rotation.x = -Math.PI / 2; scene.add(obj); habitat.ctx.crowd.add(body); return { obj, sh, body, L, blob: blobSlot(scene) }; });
    const st = Object.assign(newPlay('train'), { train: T, wagons: T.lens.length - 1, board: boarding(net), x: mid[0], z: mid[1], y: hy(...mid), r: 0, rot: 0 });
    train = { T, net, cars, st }; habitat.ctx.play.push(st); placeCars();
  }
  function placeCars() {
    train.T.cars.forEach((c, i) => { const k = train.cars[i]; k.obj.position.set(c.x, c.y, c.z); k.obj.rotation.set(0, c.yaw, c.pitch); Object.assign(k.body, { x: c.x, z: c.z, yaw: c.yaw });
      k.sh.position.set(c.x, c.y - CARS.rail + 0.05, c.z); k.sh.rotation.z = c.yaw; k.sh.scale.set(k.L / 2, 1.1, 1); k.blob.set(k.sh, 0.8); });
    train.cars[0].obj.userData.key.rotation.x = -train.T.odo * 2.5; // the key turns as it runs
  }
  // inbox 42 F-4: a dot on each rail end while rails are laid (a rail held, or the 기차 tab open: rails(on)), green where two
  // pieces meet, red where one ends open (train.js railEnds; the held one counted where it is)
  const endG = new THREE.Group(), endGeo = new THREE.SphereGeometry(0.5, 16, 12), endMat = ['#4fcf5a', '#ff4545'].map(color => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false })),
    rimGeo = new THREE.SphereGeometry(0.66, 16, 12), rimMat = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false }); // a white rim so a dot reads on grass and on the rail
  scene.add(endG); let railView = false;
  const heldRails = () => !ed?.P.rail ? [] : ed.P.ring ? RING.map(([a, b, q]) => ({ uid: 'h' + q, prop: 'railcurve', x: ed.x + a, z: ed.z + b, rot: q * Math.PI / 2 })) : [{ uid: 'h', prop: ed.P.id, x: ed.x, z: ed.z, rot: ed.rot }];
  function railDots() {
    endG.clear(); if (!decorOn || !railView && !ed?.P.rail) return;
    for (const e of railEnds([...[...placed.values()].filter(e => e.rail).map(e => e.rail), ...heldRails()]).ends) {
      const m = new THREE.Mesh(endGeo, endMat[+e.open]), r = new THREE.Mesh(rimGeo, rimMat); m.position.set(e.x, hy(e.x, e.z) + 0.3, e.z); m.renderOrder = 6; r.renderOrder = 5; m.add(r); endG.add(m); }
  }
  // the marker under the prop being moved: green = it may go here, red = it may not (drawn over everything)
  const markMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthTest: false, depthWrite: false }), edgeMat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
  const mark = new THREE.Group(); mark.renderOrder = 5;
  mark.add(new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), markMat), new THREE.Mesh(new THREE.RingGeometry(0.9, 1.04, 40).rotateX(-Math.PI / 2), edgeMat));
  mark.children.forEach(m => { m.renderOrder = 5; });
  // 26-6 여러 개 고르기: a yellow ring under each one picked (picked(recs): the records, null: not picking; a long press does nothing then)
  const pickG = new THREE.Group(), pickMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.38, depthTest: false, depthWrite: false }), pickEdge = new THREE.MeshBasicMaterial({ color: '#ffd23f', depthTest: false, depthWrite: false });
  scene.add(pickG); let picking = false;
  function picked(recs) {
    picking = !!recs; pickG.clear();
    for (const r of recs || []) {
      const N = r.nat && NAT[r.prop], P = PR[r.prop], rr = N ? N.r * (r.s || 1) : P?.r * SZ(r), x = r.x * U, z = r.z * U; if (!rr) continue;
      const g = new THREE.Group(); g.add(new THREE.Mesh(mark.children[0].geometry, pickMat), new THREE.Mesh(mark.children[1].geometry, pickEdge)); g.children.forEach(m => { m.renderOrder = 5; });
      g.position.set(x, D.y(x, z, !N && P.water) + 0.06, z); g.scale.setScalar(rr); pickG.add(g);
    }
  }
  const fits = (P, x, z, f = 1) => P.rail ? railFits(P, x, z, ed?.rot ?? 0) : D.placeable(x, z, P.r * f, P.water) && free(habitat.ctx.crowd, { x, z, yaw: 0, r: P.r * f, seg: [0, 0] }, x, z);
  // 28-5 쌓기: the free top spot of a placed prop here nearest x, z (within reach), for a small prop held: { h (its record), k, x, z } or null
  function seatNear(x, z) {
    let best = null, bd = 1e9;
    for (const h of propList) if (h.placed && h.hab === habId && !h.nat && h.uid !== ed.uid && PR[h.prop]?.top) {
      const over = Math.hypot(h.x * U - x, h.z * U - z) < PR[h.prop].r * SZ(h); // 27-7b: anywhere over its top finds its free spot (a big table's spots are far apart)
      PR[h.prop].top.forEach((_, k) => {
        if (propList.some(o => o.placed && o.on === h.uid && o.sl === k && o.uid !== ed.uid)) return;
        const t = topAt(h, k), d = Math.hypot(t.x * U - x, t.z * U - z); if ((d < 0.6 || over) && d < bd) { bd = d; best = { h, k, x: t.x * U, z: t.z * U }; } });
    }
    return best;
  }
  const snap = v => gridOn ? (Math.floor(v / U) + 0.5) * U : v; // 격자 on: the middle of a cell
  // inbox 52: a rail piece held (not the ring) turns to join an open end of the placed rails its tile meets (train.js joinTurn);
  // away from open ends it is as turned (ed.base); ⟳90° on a tile keeps the hand's turn there (ed.hand) till it goes to another tile
  function railTurn(x, z) {
    const A0 = railAt(ed.P, x, z, ed.base), here = A0.x + ',' + A0.z; if (ed.hand === here) return; ed.hand = null;
    const open = railEnds([...placed.values()].filter(e => e.rail).map(e => e.rail)).ends.filter(e => e.open);
    ed.rot = joinTurn(ed.P.id, [0, 1, 2, 3].map(q => ({ ...railAt(ed.P, x, z, q * Math.PI / 2), rot: q * Math.PI / 2 })), open, ed.base) ?? ed.base;
  }
  function moveEdit(x, z) {
    if (ed.P.rail && !ed.P.ring) railTurn(x, z);
    const A = ed.P.rail && railAt(ed.P, x, z, ed.rot), st = ed.P.small && ed.sz !== 3 && seatNear(x, z); // 28-5: a small prop near a free top spot goes onto it (42 F-3: not at 아주 크게)
    if (A) ({ x, z } = A); else if (st) ({ x, z } = st); else { x = snap(x); z = snap(z); } // 28-4: a rail snaps to its tiles (it goes under the animals)
    Object.assign(ed, { x, z, ok: st ? true : fits(ed.P, x, z, SZ(ed)), on: st ? st.h.uid : null, sl: st ? st.k : null });
    if (ed.P.stamp) { syncStamps(); syncNat(propList); ed.obj.traverse(m => { if (m.userData.dome) m.visible = !ed.ok; }); } // 28-6
    putProp(ed.obj, x, z, ed.rot, ed.P); const y0 = st ? seatY(st.h, st.k) : ed.obj.position.y; ed.obj.position.y = y0 + 0.25; // lifted while held
    mark.position.set(x, y0 + 0.05, z); if (A?.ring) mark.scale.set(4.4, 1, 4.4); else if (A) mark.scale.set(A.tiles.length > 1 && A.ax ? 4 : 2, 1, A.tiles.length > 1 && !A.ax ? 4 : 2); else mark.scale.setScalar(st ? 0.35 * U : ed.P.r * SZ(ed));
    const c = ed.ok ? '#4fcf5a' : '#ff4545'; markMat.color.set(c); edgeMat.color.set(c);
    if (A) railDots(); ui.onEdit?.(ed.ok);
  }
  // pick up a prop: a placed one from its spot, one put away onto the open spot nearest the middle of the screen
  function editProp(rec, at, near) { // at: a 미리보기 ({ x, z, rot } as saved) a prop just taken out starts on; near: the same, but the open spot nearest it
    endEdit(); if (rec.placed) at = null;
    const N = rec.nat && NAT[rec.prop], P = N ? { id: rec.prop, name: N.name, r: N.r * (rec.s || 1), open: !!N.open } : rec.ring ? RING_P : PR[rec.prop], e = placed.get(rec.uid); if (!P) return;
    if (e) { unplace(e); placed.delete(rec.uid); renderer.shadowMap.needsUpdate = true; }
    ed = { uid: rec.uid, P, nat: !!N, rot: (at ?? near)?.rot ?? rec.rot ?? 0, c: N ? 0 : (at?.c ?? rec.c) || 0, sz: N ? 0 : (at?.sz ?? rec.sz) || 0 }; ed.base = ed.rot; ed.auto = !rec.placed && !at && !near; heldModel(rec); scene.add(mark); // 28-5 a 미리보기's look first
    if (N) syncNat(propList); else if (P.top) syncProps(); // its spot on the board goes while it is held; 28-5: what stands on it goes with it
    moveEdit(...(rec.placed ? [rec.x * U, rec.z * U] : at ? [at.x * U, at.z * U] : nearest((x, z) => fits(P, x, z, SZ(ed)), near && [near.x * U, near.z * U])));
    back ??= { at: controls.target.clone(), radius: camera.position.distanceTo(controls.target), phi: sph.setFromVector3(off.copy(camera.position).sub(controls.target)).phi };
    aim = { at: new THREE.Vector3(ed.x, 0, ed.z), radius: Math.min(camera.position.distanceTo(controls.target), HOME.wide * 0.45) }; goingHome = false; // glide a little closer
  }
  // inbox 37 가까운 빈 자리로: the held rail to the nearest open 8x8 (rail tiles, round where it is) a 작은 고리 fits in, the view
  // after it; a curve onto the corner of it its turn belongs to (so four make the ring). false: none on this board
  function room() {
    if (!ed) return false;
    if (!ed.P.rail) { // 27-7b: any prop held on a red spot goes to the open spot nearest it (snapped as moveEdit snaps)
      const ok = (x, z) => fits(ed.P, snap(x), snap(z), SZ(ed)), c = nearest(ok, [ed.x, ed.z]); if (!ok(...c)) return false;
      moveEdit(...c); aim = { at: new THREE.Vector3(ed.x, 0, ed.z), radius: camera.position.distanceTo(controls.target) }; goingHome = false; return true;
    }
    const c0 = [Math.round(ed.x / TILE), Math.round(ed.z / TILE)], at = [], q = Math.round(ed.rot / (Math.PI / 2)) % 4;
    for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) at.push([(c0[0] + i) * TILE, (c0[1] + j) * TILE]);
    at.sort((a, b) => Math.hypot(a[0] - ed.x, a[1] - ed.z) - Math.hypot(b[0] - ed.x, b[1] - ed.z)); // ponytail: 841 tries at most, on a tap
    const c = at.find(([x, z]) => railFits(RING_P, x, z, 0, false, true)) ?? at.find(([x, z]) => railFits(RING_P, x, z, 0)); if (!c) return false; // bare ground, else where flowers go
    const [dx, dz] = ed.P.ring ? [0, 0] : (ed.P.id === 'railcurve' && RING.find(t => t[2] === q)) || RING[0];
    moveEdit(c[0] + dx, c[1] + dz); aim = { at: new THREE.Vector3(c[0], 0, c[1]), radius: camera.position.distanceTo(controls.target) }; goingHome = false; return true;
  }
  function endEdit() { if (!ed) return; scene.remove(ed.obj, mark); ed = drag = null; syncProps(); railDots(); } // a placed one goes back where it was saved
  // 28-5: the held one's model as it looks now (ed.c, ed.sz), with what stands on it (records on it) riding on its top spots
  function heldModel(rec = propList.find(p => p.uid === ed.uid)) {
    if (ed.obj) scene.remove(ed.obj);
    const obj = ed.nat ? nature.model(rec) : build(ed.P, ed), f = SZ(ed);
    if (ed.P.top) for (const o of propList) if (o.placed && o.on === ed.uid && PR[o.prop]) {
      const m = build(PR[o.prop], o), t = ed.P.top[o.sl]; if (!t) continue;
      m.position.set(t[0], t[1], t[2]); m.rotation.y = (o.rot || 0) - (rec?.rot || 0); m.scale.multiplyScalar(1 / f); obj.add(m);
    }
    obj.traverse(o => { o.castShadow = false; }); obj.rotation.y = ed.rot; ed.obj = obj; scene.add(obj);
  }
  // drag the held prop: a press near it moves it (the camera doesn't pan then); elsewhere the camera pans as usual
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
  function groundAt(e) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(dragPlane, hitP);
  }
  container.addEventListener('pointerdown', e => {
    if (!ed || drag || e.target !== renderer.domElement) return;
    const [sx, sy] = project(ed.obj, 0.4); if (Math.hypot(sx - e.clientX, sy - e.clientY) > 70) return;
    dragPlane.constant = -(ed.obj.position.y - 0.25); const p = groundAt(e); if (!p) return;
    drag = { id: e.pointerId, dx: ed.x - p.x, dz: ed.z - p.z, at: [e.clientX, e.clientY] }; downAt = null; aim = null; e.stopPropagation(); // OrbitControls never sees it; the camera holds still under the finger
  }, { capture: true, ...sig });
  // a second finger while dragging: the prop stays put, the two fingers zoom (OrbitControls never saw the first one, so it is done here)
  container.addEventListener('pointerdown', e => {
    const one = drag ?? stroke ?? box; if (!one || e.pointerId === one.id) return;
    pinch = { [one.id]: one.at, [e.pointerId]: [e.clientX, e.clientY] }; drag = null; if (stroke) { stroke = null; showPaint(paintNow); } if (box) { box = null; sweepBox(); } e.stopPropagation(); // a stroke half done is dropped
  }, { capture: true, ...sig });
  const spread = () => { const [a, b] = Object.values(pinch); return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  const midOf = () => { const [a, b] = Object.values(pinch); return { clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 }; }, m0 = new THREE.Vector3();
  addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) { // inbox 25: once it really moves, the 꾸미기 panel folds to its head till the finger lifts (style.css .pdrag)
      const o = drag.o ??= drag.at; if (Math.hypot(e.clientX - o[0], e.clientY - o[1]) > 6) document.body.classList.add('pdrag');
      drag.at = [e.clientX, e.clientY]; const p = groundAt(e); if (p) moveEdit(p.x + drag.dx, p.z + drag.dz); }
    if (stroke && e.pointerId === stroke.id) { stroke.at = [e.clientX, e.clientY]; paintTo(e); }
    if (box && e.pointerId === box.id) { box.at = [e.clientX, e.clientY]; sweepBox(); }
    if (carry && e.pointerId === carry.id) { const p = groundHit(e); if (p) { carry.f = [p.x, p.z]; carry.a.carry(carry.x = p.x + carry.dx, carry.z = p.z + carry.dz); } }
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.at[0], e.clientY - press.at[1]) > 8) { clearTimeout(press.t); press = null; }
    if (pinch?.[e.pointerId]) { // two fingers: zoom by their spread, move the view with their middle
      const d0 = spread(); dragPlane.constant = 0; const a = groundAt(midOf()) && m0.copy(hitP); pinch[e.pointerId] = [e.clientX, e.clientY]; off.copy(camera.position).sub(controls.target);
      camera.position.copy(controls.target).add(off.setLength(THREE.MathUtils.clamp(off.length() * d0 / spread(), controls.minDistance, controls.maxDistance)));
      const b = a && groundAt(midOf()); if (b) { m0.sub(b).setY(0); controls.target.add(m0); camera.position.add(m0); } }
  }, sig);
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, e => {
    if (drag && e.pointerId === drag.id) { if (drag.long) controls.enabled = true; drag = null; }
    if (!drag) document.body.classList.remove('pdrag');
    if (pinch?.[e.pointerId]) pinch = null;
    if (press && e.pointerId === press.id) { clearTimeout(press.t); press = null; }
    if (carry && e.pointerId === carry.id) letGo();
    if (stroke && e.pointerId === stroke.id) { const c = [...stroke.cells.values()]; stroke = null; if (c.length) ui.onPaint?.(c, brush); }
    if (box && e.pointerId === box.id) { const u = sweepBox(); box = null; sweepBox(); if (u) ui.onSweep?.(u); }
  }, sig);
  container.addEventListener('pointerup', () => { controls.enabled = true; }, { capture: true, ...sig }); // a long press turned it off (below), before OrbitControls sees the up
  // 22-1 길게 눌러 옮기기: decorating, a finger held still 0.45 s on a prop (placed or the board's own) picks it up under it and
  // drags it at once; the camera stays put till the finger lifts
  function propUnder(e) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = [...placed.values()].map(p => p.obj), hit = ray.intersectObjects([...objs, ...nature.meshes], true)[0];
    if (hit && nature.meshes.includes(hit.object)) return nature.pick(hit);
    if (hit) return [...placed].find(([, p]) => { let o = hit.object; while (o && o !== p.obj) o = o.parent; return o; })?.[0] ?? null;
    const g = groundHit(e); if (!g) return null; // a wildflower patch is low: the ground in it counts
    let best = null, bd = 1e9; for (const o of natSpots) { const d = Math.hypot(o.x - g.x, o.z - g.z); if (o.open && d < o.r && d < bd) { bd = d; best = o.uid; } }
    return best;
  }
  function groundHit(e) { dragPlane.constant = 0; let p = groundAt(e); for (let i = 0; p && i < 3; i++) { dragPlane.constant = -habitat.floor(p.x, p.z); p = groundAt(e); } return p; } // on the ground's height, nearly
  container.addEventListener('pointerdown', e => {
    if (!decorOn || picking || sweepOn || brush !== undefined || drag || pinch || e.target !== renderer.domElement || !e.isPrimary) return;
    const at = [e.clientX, e.clientY], id = e.pointerId;
    press = { id, at, t: setTimeout(() => {
      press = null; if (pinch || drag || fingers !== 1) return;
      const uid = propUnder({ clientX: at[0], clientY: at[1] }); if (uid == null) return;
      ui.onPropTap?.(uid); if (!ed || ed.uid !== uid) return;
      dragPlane.constant = -(ed.obj.position.y - 0.25); const p = groundAt({ clientX: at[0], clientY: at[1] }); if (!p) return;
      drag = { id, dx: ed.x - p.x, dz: ed.z - p.z, at, long: true }; controls.enabled = false; skipTap = true; aim = null;
      if (PREFS.buzz) navigator.vibrate?.(15);
    }, 450) };
  }, { capture: true, ...sig });
  // inbox 42 E 꾹 눌러 옮기기: out of 꾸미기 and 사진 모드, a finger held still 0.45 s on an animal lifts it (DROP.carry up, dangling);
  // it follows the finger (the camera stays put) and drops where the finger lifts (its drop, from that high). No pat, no hearts.
  // Where it can't stand (water for a land animal, off the board, in a prop or on another animal): the nearest spot it can. On a
  // play prop it fits: on to it at once (its use)
  container.addEventListener('pointerdown', e => {
    if (decorOn || snapOn || carry || pinch || e.target !== renderer.domElement || !e.isPrimary) return;
    const at = { clientX: e.clientX, clientY: e.clientY }, id = e.pointerId;
    press = { id, at: [at.clientX, at.clientY], t: setTimeout(() => {
      press = null; if (pinch || carry || decorOn || snapOn || fingers !== 1) return;
      const { a } = actorAt(at), p = a?.carry && groundHit(at); if (!p) return;
      carry = { a, id, x: a.position.x, z: a.position.z, from: { x: a.position.x, z: a.position.z }, f: [p.x, p.z], dx: a.position.x - p.x, dz: a.position.z - p.z }; a.carry(carry.x, carry.z);
      controls.enabled = false; skipTap = true; aim = null; setFocus(null); ui.onCarry?.(); if (PREFS.buzz) navigator.vibrate?.(15);
    }, 450) };
  }, { capture: true, ...sig });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault(), sig); // a long press lifts (OrbitControls, off while carrying, no longer stops the phone's menu)
  Object.assign(renderer.domElement.style, { webkitTouchCallout: 'none', webkitUserSelect: 'none', userSelect: 'none' }); // iOS: no loupe or callout on a held finger
  // inbox 53: a kept spot inside a fence goes once that land joins the main one (a fence opened or taken away), gets under ROOM,
  // or the friend is on another land (walked out while it was open). Not while decorating: a fence lifted to be moved a cell
  let homeAt = 0;
  function penCheck() {
    for (const a of actors.values()) { const hm = a.rec.home; if (!hm || carry?.a === a) continue;
      const L = habitat.ctx.land(a.water || ''), M = L.root(L.id(...hm)), at = L.root(L.id(a.position.x, a.position.z));
      if (M < 0 || M === L.main || L.area(M) < ROOM || at >= 0 && at !== M) ui.onHome?.(a.rec.id, null); }
  }
  function letGo() {
    const { a, x, z, f } = carry, carry0 = carry.from, c = habitat.ctx; carry = null; controls.enabled = true; if (actors.get(a.rec.id) !== a) return; // gone meanwhile (put away)
    const L = c.land(a.water || ''), mine = (x, z, l) => l >= 0 && L.area(l) >= ROOM && free(c.crowd, a.body, x, z); // inbox 48: any land big enough to live on (inside a closed fence, an island): it lives there from then on
    const ok = (x, z) => (c.walkable(x, z) || !!a.water && !!c.wet?.(x, z, a.water)) && mine(x, z, L.id(x, z));
    const here = L.id(x, z), small = here >= 0 && L.area(here) < ROOM; // a pocket too small (a ring closed too tight; the finger in it or on its fence, land.js id: within 1 m): to the nearest spot from the finger, said every time
    const [nx, nz] = ok(x, z) ? [x, z] : L.near(x, z, mine) ?? [carry0.x, carry0.z], st = D.list.find(o => o.play && !o.play.gone && Math.min(Math.hypot(o.x - x, o.z - z), Math.hypot(o.x - f[0], o.z - f[1])) < o.r + 0.4)?.play; // it, or the finger, over a play prop (its spot: the size it is)
    if (small) c.cramped?.(true);
    const M = L.root(L.id(nx, nz)), pen = M >= 0 && M !== L.main && L.area(M) >= ROOM; // inbox 53: inside a closed fence: kept for next time
    if (pen || a.rec.home) ui.onHome?.(a.rec.id, pen ? [nx, nz] : null);
    a.drop(nx, nz, DROP.carry); const [px, pz] = st && a.use(st) || [nx, nz]; // on a play prop: by its seat (walk.js use)
    puffs.push({ x: px, z: pz, t: dropFrom(DROP.carry) - DROP.fall, bits: null }); sfx('place', DROP.fall - dropFrom(DROP.carry)); // 13-0: a plastic 톡 as it lands
  }
  // 13-0: what is underfoot at x, y, z (sound.js steps): a deck, shallow water (deeper: swimming, none), the paint, else the habitat's own
  const underfoot = (x, y, z) => { const c = habitat.ctx; if (c.deckAt(x, z) > y - 0.3) return 'wood'; const d = c.water - c.heightAt(x, z);
    if (d > 0.25) return null; if (d > 0.02) return 'water'; const b = paintNow[`${Math.floor(x / U)},${Math.floor(z / U)}`];
    return b === 8 ? 'wood' : b === 5 || b === 6 ? 'snow' : [1, 2, 3, 7].includes(b) ? 'dirt' : habId === 'snow' ? 'snow' : 'grass'; };
  // 22-1 땅 칠하기: one finger paints the cells it passes over (paintable ones; the eraser: any), shown at once, saved when it lifts
  container.addEventListener('pointerdown', e => {
    if (!decorOn || brush === undefined || stroke || pinch || e.target !== renderer.domElement) return;
    stroke = { id: e.pointerId, at: [e.clientX, e.clientY], cells: new Map(), last: null }; downAt = null; aim = null; e.stopPropagation(); paintTo(e);
  }, { capture: true, ...sig });
  function paintTo(e) {
    const g = groundHit(e); if (!g) return;
    const [x0, z0] = stroke.last ?? [g.x, g.z], n = Math.max(1, Math.ceil(Math.hypot(g.x - x0, g.z - z0) / (0.3 * U))); stroke.last = [g.x, g.z];
    let add = false;
    for (let k = 1; k <= n; k++) {
      const x = x0 + (g.x - x0) * k / n, z = z0 + (g.z - z0) * k / n, i = Math.floor(x / U), j = Math.floor(z / U), key = `${i},${j}`;
      if (stroke.cells.has(key) || (brush !== null && !habitat.paintable?.((i + 0.5) * U, (j + 0.5) * U))) continue;
      if (BRUSHES[brush]?.stand && !standOk((i + 0.5) * U, (j + 0.5) * U)) continue; // 28-6
      stroke.cells.set(key, [i, j]); add = true;
    }
    if (!add) return;
    const shown = { ...paintNow }; for (const k of stroke.cells.keys()) { if (brush === null) delete shown[k]; else shown[k] = brush; }
    showPaint(shown);
  }
  // inbox 42 F-6 자연 정리: one finger draws a rectangle on the screen; the board's own trees, bushes, rocks and flowers whose foot
  // is inside it get a yellow ring as it grows; on lifting, their uids go to ui.onSweep (decor.js asks, then puts them away)
  const boxEl = Object.assign(document.createElement('div'), { className: 'sweepbox', hidden: true }); container.appendChild(boxEl);
  container.addEventListener('pointerdown', e => {
    if (!decorOn || !sweepOn || box || pinch || e.target !== renderer.domElement) return;
    box = { id: e.pointerId, from: [e.clientX, e.clientY], at: [e.clientX, e.clientY] }; downAt = null; aim = null; e.stopPropagation(); sweepBox();
  }, { capture: true, ...sig });
  function sweepBox() { // draws the box (none: hidden) and rings what is in it; its uids (null: too small a box, or none)
    if (!box) { boxEl.hidden = true; picked(null); return null; }
    const [a, b] = [box.from, box.at], l = Math.min(a[0], b[0]), t = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
    const cr = container.getBoundingClientRect(), k = cr.width / container.offsetWidth || 1; // the PC phone frame is scaled (main.js)
    Object.assign(boxEl.style, { left: (l - cr.left) / k + 'px', top: (t - cr.top) / k + 'px', width: w / k + 'px', height: h / k + 'px' }); boxEl.hidden = w < 6 && h < 6;
    const v = new THREE.Vector3(), ins = natSpots.filter(o => { const [x, y] = project({ position: v.set(o.x, habitat.floor(o.x, o.z), o.z) }, 0); return x >= l && x <= l + w && y >= t && y <= t + h; });
    picked(ins.map(o => ({ nat: 1, prop: o.prop, s: o.r / NAT[o.prop].r, x: o.x / U, z: o.z / U }))); picking = false;
    return w < 12 || h < 12 || !ins.length ? null : ins.map(o => o.uid);
  }
  const decor = {
    mode(on) { decorOn = ghosts.visible = on; mapping(); endEdit(); picked(null); aim = back = null; overview(); brush = undefined; sweepOn = false; box = null; sweepBox(); gridOn = false; habitat.ground?.grid(false); railView = false; railDots(); }, // the camera tips toward top-down (steerCamera)
    edit: editProp, model: id => id === RING_P.id ? build(RING_P) : D.model(id), natModel: rec => nature.model(rec), room, clears: () => ed?.P.ring ? ringNats(ed.x, ed.z).length : 0,
    rotate(step = Math.PI / 12) { if (ed && !ed.P.ring) { if (ed.P.rail) step = Math.sign(step) * Math.PI / 2; /* 28-4: a quarter turn */ ed.rot = ((ed.rot + step) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (ed.P.rail) { ed.base = ed.rot; ed.hand = (A => A.x + ',' + A.z)(railAt(ed.P, ed.x, ed.z, ed.rot)); } moveEdit(ed.x, ed.z); } }, // inbox 52: the hand's turn // 28-5: 15 deg, or a little at a time (held down)
    // 28-5: the held one's colour (PALETTES index) and size (SIZES index): shown at once, saved with 놓기
    look({ c = ed?.c, sz = ed?.sz } = {}) { if (!ed || ed.nat) return null; const pal = paletteOf(ed.P); c = pal && c > 0 && c < pal.length ? c : 0; sz = sizable(ed.P) && sz > 0 && sz < SIZES.length ? sz : 0; // 28-5 the held one's look: set (rebuilt), or read (no args)
      if (c !== ed.c || sz !== ed.sz) { Object.assign(ed, { c, sz }); heldModel(); moveEdit(ed.x, ed.z); } return { c, sz }; },
    // 22-1: 격자 (snaps what is held to a cell's middle; the lines show), 땅 칠하기 (b: BRUSHES index, null: the eraser, undefined: off)
    grid(on) { gridOn = !!on; habitat.ground?.grid(gridOn || brush !== undefined); if (ed) moveEdit(ed.x, ed.z); },
    paint(b) { brush = b; if (b !== undefined) endEdit(); habitat.ground?.grid(gridOn || brush !== undefined); },
    sweep(on) { sweepOn = !!on; if (on) endEdit(); box = null; sweepBox(); }, // inbox 42 F-6 자연 정리 (a finger draws a box, not the camera)
    // where the held prop may go now: { uid, x, z, rot } or null (red). It is let go either way.
    confirm() { if (ed?.P.ring) { const r = ed.ok && { ring: true, x: +(ed.x / U).toFixed(4), z: +(ed.z / U).toFixed(4), cells: RING.map(([a, b, q]) => [+((ed.x + a) / U).toFixed(4), +((ed.z + b) / U).toFixed(4), q * Math.PI / 2]), clear: ringNats(ed.x, ed.z).map(o => o.uid) }; if (r) { endEdit(); back = null; } return r || null; } // inbox 37: its four curves
      const r = ed?.ok ? { uid: ed.uid, x: +(ed.x / U).toFixed(4), z: +(ed.z / U).toFixed(4), rot: ed.rot, ...!ed.nat && { c: ed.c, sz: ed.sz, on: ed.on ?? undefined, sl: ed.sl ?? undefined } } : null; if (r) { endEdit(); back = null; } return r; }, // x, z saved in the first board's units (28-5 with its look, on: on top of)
    cancel() { endEdit(); if (back) { aim = back; goingHome = false; } back = null; }, // the camera glides back to where it was before the pick-up
    // just put down at x, z: if the panel (its top at screen y = top) covers it, slide the view so it shows above the panel
    reveal(x, z, top) { // x, z as saved
      x *= U; z *= U; const [sx, sy] = project({ position: new THREE.Vector3(x, D.y(x, z), z) }, 0.4); if (sy < top - 30) return;
      const r = renderer.domElement.getBoundingClientRect(), q = groundAt({ clientX: sx, clientY: Math.max(r.top + 40, top - 70) }); if (!q) return;
      const T = controls.target; aim = { at: new THREE.Vector3(THREE.MathUtils.clamp(T.x + x - q.x, ...panX), 0, THREE.MathUtils.clamp(T.z + z - q.z, ...panZ)), radius: camera.position.distanceTo(controls.target), phi: sph.setFromVector3(off.copy(camera.position).sub(controls.target)).phi }; goingHome = false;
    },
    // inbox 52: the band of the screen the panel and its buttons leave (client y top..bottom), once the panel shows the held prop.
    // One just taken out (its spot picked by editProp, ed.auto) goes to the open spot nearest the band's middle that shows whole
    // in the band (its middle and four points at its radius); the view glides a little closer about it (it stays where it shows),
    // only as far as it still shows whole. None shows: it stays where editProp picked it, and the view slides it to the band's
    // middle on the way closer
    show(top, bottom) {
      if (!ed?.auto) return; ed.auto = false; const r = renderer.domElement.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (top + bottom) / 2;
      const ground = (sx, sy) => { ray.setFromCamera(ndc.set((sx - r.left) / r.width * 2 - 1, 1 - (sy - r.top) / r.height * 2), camera); return ray.ray.intersectPlane(flat, new THREE.Vector3()); };
      const g = ground(cx, cy); if (bottom - top < 80 || !g) return;
      const R = ed.P.r * SZ(ed), FOOT = [[R, 0], [-R, 0], [0, R], [0, -R]], L = r.left + 8, Rt = r.right - 8, Tp = top + 8, B = bottom - 8;
      const scr = (x, z) => project({ position: new THREE.Vector3(x, D.y(x, z), z) }, 0), inBand = ([sx, sy]) => sy > Tp && sy < B && sx > L && sx < Rt;
      const ok = (x, z) => inBand(scr(x, z)) && FOOT.every(([a, b]) => inBand(scr(x + a, z + b))) && fits(ed.P, x, z, SZ(ed)), c = nearest(ok, [g.x, g.z]), seen = ok(...c);
      if (seen) moveEdit(...c);
      const T = controls.target, P = new THREE.Vector3(ed.x, 0, ed.z), r0 = camera.position.distanceTo(T); let k = Math.min(1, HOME.wide * 0.45 / r0);
      if (seen) { const [px, py] = scr(ed.x, ed.z); // closer by k, what is d px from it shows about d / k px from it: keep the four points in
        for (const [a, b] of FOOT) { const [sx, sy] = scr(ed.x + a, ed.z + b), dx = sx - px, dy = sy - py; k = Math.max(k, dx > 0 ? dx / (Rt - px) : dx < 0 ? dx / (L - px) : 0, dy > 0 ? dy / (B - py) : dy < 0 ? dy / (Tp - py) : 0); } }
      const T1 = seen ? T.clone() : T.clone().add(P).sub(g); k = Math.min(1, k); // not seen: P shows where g did; then closer about P (it stays put on the screen)
      aim = { at: P.clone().add(T1.sub(P).multiplyScalar(k)), radius: r0 * k, phi: sph.setFromVector3(off.copy(camera.position).sub(T)).phi };
      aim.at.set(THREE.MathUtils.clamp(aim.at.x, ...panX), 0, THREE.MathUtils.clamp(aim.at.z, ...panZ)); goingHome = false;
    },
    get held() { return ed?.uid ?? null; },
    rails(on) { railView = !!on; railDots(); }, heldRails, // inbox 42 F-4: the rail ends' dots; the held rail pieces as laid now (world units)
    refit,
    fitAll, picked, unit: U, cellOk: (i, j) => !!habitat.paintable?.((i + 0.5) * U, (j + 0.5) * U), // 24-2 꾸미기 코드 불러오기
  };
  let puffs = [];
  const puffGeo = new THREE.SphereGeometry(0.22, 10, 8), puffMat = new THREE.MeshBasicMaterial({ color: '#f7ead2', transparent: true, depthWrite: false });
  function updPuffs(dt) {
    puffs = puffs.filter(p => {
      p.t += dt; if (p.t < 0) return true;
      if (!p.bits) p.bits = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(puffGeo, puffMat.clone()), ang = i / 7 * Math.PI * 2 + Math.random() * 0.4; m.userData.d = [Math.cos(ang), Math.sin(ang)]; scene.add(m); return m; });
      const k = Math.min(1, p.t / 0.6), y = habitat.ctx.heightAt(p.x, p.z);
      for (const m of p.bits) { const [dx, dz] = m.userData.d; m.position.set(p.x + dx * (0.5 + 1.3 * k), y + 0.15 + 0.4 * k, p.z + dz * (0.5 + 1.3 * k)); m.scale.setScalar(0.6 + 1.1 * k); m.material.opacity = 0.85 * (1 - k); }
      if (k < 1) return true;
      for (const m of p.bits) { scene.remove(m); m.material.dispose(); } return false;
    });
  }
  const label = a => `${a.rec.nm ? a.rec.nm + ' · ' : ''}${SP[a.rec.species].name} · ${variantOf(a.rec.species, a.rec.variant).name} · ${STAGE_NAME[a.look.stage]}`;
  const height = a => new THREE.Box3().setFromObject(a.look.obj).max.y - a.obj.position.y;

  // tap an animal: a pat, and the camera follows it. Twice quickly (inbox 14): 정면 on an animal, or the ground there to the middle.
  // A tap is one finger that didn't move; two-finger gestures never count.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let downAt = null, fingers = 0, multi = false, lastTap = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; multi = fingers++ > 0; if (watch && !snapOn) setFocus(null); }, sig); // 26-4 보러 가기: a touch lets go
  renderer.domElement.addEventListener('pointercancel', () => { fingers = Math.max(0, fingers - 1); multi = true; }, sig);
  renderer.domElement.addEventListener('pointerup', e => {
    const solo = !multi; if (--fingers <= 0) { fingers = 0; multi = false; }
    if (skipTap) { skipTap = false; return; }
    if (!solo || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const { a, hit, shown } = actorAt(e);
    if (decorOn) { // decorate mode: a tap picks up a placed prop (22-1: or a tree, bush, rock, flowers of the board's own), animals are left alone
      if (brush !== undefined || sweepOn) return;
      const uid = propUnder(e); if (uid != null) ui.onPropTap?.(uid);
      return;
    }
    // 28-3: a prop that does something when tapped (props.js userData.tap), with no animal in front of it
    const toys = [...placed.values()].filter(p => p.obj.userData.tap), th = toys.length ? ray.intersectObjects(toys.map(p => p.obj), true)[0] : null;
    if (th && !(hit && hit.distance < th.distance)) { let q = th.object; while (q && !toys.some(p => p.obj === q)) q = q.parent; const p = toys.find(p => p.obj === q); if (p) { tapProp(p, shown); return; } }
    const t = performance.now(), dbl = lastTap && t - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
    lastTap = dbl ? null : { t, x: e.clientX, y: e.clientY };
    if (dbl && a) { setFocus(a); front(); return; }
    if (dbl) { if (ray.ray.intersectPlane(flat, mid)) centre(mid); return; }
    if (a) { a.poke(); pet(a); setFocus(a); ui.onTap('actor', a.rec, e.clientX, e.clientY); }
  }, sig);
  // the animal under a screen point (hit: the ray's own hit; a: that one, or on a phone's small moving targets a near miss within ~32 px)
  function actorAt(e) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const shown = [...actors.values()].filter(a => a.obj.visible && !a.hold), hit = ray.intersectObjects(shown.map(a => a.pickTarget), true)[0];
    let o = hit?.object, a = null;
    while (o && !(a = shown.find(an => an.pickTarget === o))) o = o.parent;
    if (!a) { let best = 32; for (const an of shown) { const [sx, sy] = project(an.obj, 0.5 * height(an)), d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < best) { best = d; a = an; } } } // inbox 42 C2: the animals x0.75: its middle, a bit wider
    return { a, hit, shown };
  }

  // 28-3: the prop does its own part (props.js); here its sound, and for the music box the next tune (the animals near hop to it),
  // for the bell the animals near (up to six, not busy, with a way there) running over to stand by it. The fireworks by day: false, a note says why
  function tapProp(p, shown) {
    const { x, z } = p.spot, near = (a, r) => Math.hypot(a.position.x - x, a.position.z - z) < r;
    if (p.obj.userData.tap() === false) { sfx('undo'); ui.say?.('작은 폭죽은 밤에만 쏠 수 있어요'); return; }
    sfx(p.prop);
    if (p.prop === 'musicbox') { const n = music(); ui.say?.(n ? `오르골: ${n}${PREFS.mute || !PREFS.vAll || !PREFS.vAmb ? ' · 소리를 켜면 들려요' : ''}` : '오르골을 멈췄어요'); if (n) for (const a of shown) if (near(a, 14)) a.poke(); } // 27-7e: the sound off, it says why there is no tune
    if (p.prop === 'bell') { // up to 6 idle ones within 22 with a straight way there (pathClear: not over the stream, out of the paddock or through a
      // tree): each to the bell's side it is on, 2.4-3.3 off, and stays a while (walk.js arrive 'rest')
      const D = a => Math.hypot(a.position.x - x, a.position.z - z); let n = 0;
      for (const a of idle().filter(a => near(a, 22)).sort((a, b) => D(a) - D(b))) { if (n >= 6) break;
        const g = Math.atan2(a.position.z - z, a.position.x - x), R = 2.4 + (n % 2) * 0.9; // spread round the bell; straight at it if that side is blocked
        for (const d of [(n % 3 - 1) * 0.45, 0, (1 - n % 3) * 0.45]) { const tx = x + Math.cos(g + d) * R, tz = z + Math.sin(g + d) * R;
          if (habitat.ctx.pathClear(a.position.x, a.position.z, tx, tz)) { if (a.send(tx, tz, 'rest', { fast: true })) n++; break; } } } }
  }
  // camera: tap an animal -> glide in and follow it; a drag then circles it (360 deg) and pinch zooms, still following; moving
  // the view (two fingers / right drag) lets it go. "정면" -> round to its face (it fills ~40% of the screen height) and stay
  // there; "전체 보기" -> glide back to the start view (shown whenever the camera is away from it)
  const deg = THREE.MathUtils.degToRad, wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), smooth = k => k * k * (3 - 2 * k);
  const HOME = { target: mid0.clone(), radius: camera.position.distanceTo(controls.target), phi: 0.0, theta: 0, wide: homeRadius() };
  HOME.phi = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)).phi;
  // inbox 43: the home view (the start, 전체 보기). 1-3 friends out: on them, their middle, at homeFit or only as far as they all
  // show between the top bar and the bottom buttons; none or more: the board's middle, farther with each friend and each step
  const homeCam = new THREE.PerspectiveCamera(), fv = new THREE.Vector3();
  function setHome() {
    const as = [...actors.values()], n = as.length; HOME.target.copy(mid0); HOME.radius = homeFit(n); if (!n) return;
    const t = HOME.target; if (n <= 3) { t.set(0, 0, 0); for (const a of as) t.add(a.position); t.divideScalar(n).setY(0); t.x = THREE.MathUtils.clamp(t.x, ...panX); t.z = THREE.MathUtils.clamp(t.z, ...panZ); } // more: the board's middle, backed off till all are in
    homeCam.copy(camera);
    const shows = r => { homeCam.position.copy(t).addScaledVector(homeDir, r); homeCam.lookAt(t); homeCam.updateMatrixWorld(); return as.every(a => { fv.copy(a.position).project(homeCam); return Math.abs(fv.x) < 0.8 && fv.y > -0.55 && fv.y < 0.65; }); };
    while (HOME.radius < HOME.wide && !shows(HOME.radius)) HOME.radius = Math.min(HOME.radius * 1.08, HOME.wide);
  }
  if (pose) { controls.target.copy(pose.target); camera.position.copy(pose.position); controls.update(); } // the old board's view; the reveal glides out to this one's (below)
  let watch = false; // 26-4 보러 가기 (look): following until the screen is touched (사진 모드: drags circle it, as a tapped one)
  let focus = null, near = 6, lift = 0.8, glide = null, facing = false, goingHome = false, aim = null, tw = null; // aim: a point to glide to { at, radius, phi? }; tw: the 정면 move
  let extra = 0, zoomed = false, rEnd = 0; // following: distance added so a side view fits the screen; off once the user pinches
  const off = new THREE.Vector3(), sph = new THREE.Spherical(), want = new THREE.Vector3();
  const FRONT_PHI = deg(74), FRONT_FILL = 0.4, NEAR_FILL = 0.7, FRONT_T = 0.7; // 정면: 16 deg above, 40% of the screen height, over 0.7 s
  const faceOf = a => Math.atan2(Math.cos(a.obj.rotation.y), -Math.sin(a.obj.rotation.y)); // the angle round to its face (models face +x)
  // how far away the camera must be, looking from (phi, theta) at its middle, for the animal to fill `fill` of the screen height
  // (the corners of its parts' boxes projected; a few rounds, the size goes as 1/distance). Big or small, the same share of the screen.
  const fitCam = new THREE.PerspectiveCamera(), pts = [], at = new THREE.Vector3(), v3 = new THREE.Vector3();
  function fit(a, fill, phi, theta) {
    pts.length = 0; a.look.obj.updateMatrixWorld(true);
    a.look.obj.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || !o.visible && !o.userData.stand) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox;
      for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld)); });
    fitCam.copy(camera); at.set(a.position.x, a.position.y + lift, a.position.z);
    let d = 4 * lift + 2;
    for (let i = 0; i < 6; i++) {
      fitCam.position.copy(at).add(v3.setFromSphericalCoords(d, phi, theta)); fitCam.lookAt(at); fitCam.updateMatrixWorld();
      let lo = 1, hi = -1; for (const p of pts) { const y = v3.copy(p).project(fitCam).y; lo = Math.min(lo, y); hi = Math.max(hi, y); }
      d = Math.max(1.2 * lift, d * (hi - lo) / 2 / fill);
    }
    return d;
  }
  // following: nearest = where it fills 70% of the screen height, aim at its middle, start at 1.4x the nearest
  function setFocus(a) {
    if (a && a === focus) return; // a pat while following keeps the view
    focus = a; watch = false; trainCam = false; goingHome = false; facing = false; glide = tw = null; zoomed = false; extra = 0; // the camera stays put: its side room becomes plain distance
    if (a) { lift = 0.5 * height(a); near = fit(a, NEAR_FILL, FRONT_PHI, faceOf(a)); glide = { radius: 1.4 * near }; }
    controls.zoomToCursor = !a; // following: zoom toward the animal
  }
  function overview() { setFocus(null); aim = null; goingHome = true; setHome(); } // inbox 43: on the friends out now (as many as there are)
  // 정면: an eased move (slow start, slow stop) to its face over FRONT_T; after that it keeps to its face as it turns
  function front() {
    if (!focus) return;
    off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
    facing = true; glide = { radius: fit(focus, FRONT_FILL, FRONT_PHI, faceOf(focus)), phi: FRONT_PHI };
    tw = { t: 0, r: sph.radius, p: sph.phi, th: sph.theta, at: controls.target.clone() }; extra = 0;
  }
  // a double tap on the ground: that spot to the middle of the screen (stops following; distance and tilt stay)
  function centre(p) {
    setFocus(null); goingHome = false;
    off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
    aim = { at: new THREE.Vector3(THREE.MathUtils.clamp(p.x, ...panX), 0, THREE.MathUtils.clamp(p.z, ...panZ)), radius: sph.radius, phi: sph.phi };
  }
  let held = false, panned = 0; // a finger / button is down; how far this gesture has moved the target
  controls.addEventListener('start', () => { glide = tw = null; facing = false; panned = 0; if (!focus) { goingHome = false; aim = null; } peekT = 0; back0 = null; held = true; }); // user drag/zoom takes over
  controls.addEventListener('end', () => { held = false; });
  // decorating keeps the 16-4 mapping: one finger / left drag moves the view, right drag / two fingers turn
  function mapping() {
    const M = THREE.MOUSE, T = THREE.TOUCH;
    controls.mouseButtons = decorOn ? { LEFT: M.PAN, MIDDLE: M.DOLLY, RIGHT: M.ROTATE } : { LEFT: M.ROTATE, MIDDLE: M.DOLLY, RIGHT: M.PAN };
    controls.touches = decorOn ? { ONE: T.PAN, TWO: T.DOLLY_ROTATE } : { ONE: T.ROTATE, TWO: T.DOLLY_PAN };
  }
  // how far the camera may tip (polar angle, from straight above): 10-82 deg = 80-8 deg above the ground. Free view far out
  // (12-50 away) the lowest goes up to 20 deg above the board, so the board isn't seen edge-on from afar. Decorating keeps the
  // 16-4 band (64-38 deg above, nearest 10, turn 25 deg either side). Outside the band (mode changed) it eases in.
  // Nearest: following, where the animal fills 70% of the screen height; free view 6. 사진 모드: 4-88 deg, nearest 2.5 (eye level, close).
  const TURN = deg(25), DECOR = [0.45, 0.9], TOP = deg(10), LOWEST = deg(82);
  function band(dt) {
    off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
    const t = focus ? 0 : THREE.MathUtils.clamp((sph.radius - 12) / 38, 0, 1);
    const [lo, hi] = decorOn ? DECOR : snapOn ? [deg(4), deg(88)] : [TOP, LOWEST - deg(12) * t];
    const phi = sph.phi + (THREE.MathUtils.clamp(sph.phi, lo, hi) - sph.phi) * (1 - Math.exp(-dt * 6));
    if (phi !== sph.phi) { sph.phi = phi; camera.position.copy(controls.target).add(off.setFromSpherical(sph)); }
    controls.minPolarAngle = Math.min(lo, phi); controls.maxPolarAngle = Math.max(hi, phi); // the hard limits never snap it
    controls.minDistance = Math.min(snapOn ? 1.9 : focus ? near : decorOn ? 7.5 : 4.5, sph.radius); // inbox 42 C2: x0.75 with the animals
    const turn = decorOn ? Math.max(TURN, Math.abs(sph.theta)) : Infinity; controls.minAzimuthAngle = -turn; controls.maxAzimuthAngle = turn;
  }
  // the 전체 보기 button shows while following, or once the free camera has left the start view
  const away = () => controls.target.distanceTo(HOME.target) > 0.6 || Math.abs(camera.position.distanceTo(controls.target) - HOME.radius) > 2
    || off.copy(camera.position).sub(controls.target).normalize().dot(homeDir) < 0.998;
  let camState = null;
  function camUi() { const s = decorOn ? '' : focus ? 'f' : !goingHome && away() ? 'a' : ''; if (s !== camState) ui.onCam?.(camState = s); }
  // drawn only: the camera never shows the inside of the ground, the water, a tree or the barn. It is drawn from the
  // nearest clear point on its line to the target (or lifted off the ground); the real position stays, so zoom and turn feel the same.
  const real = new THREE.Vector3(), shown = new THREE.Vector3();
  // OrbitControls moves the camera in its own pointer handlers, between frames: put it back where it really is first, or the
  // drawn spot becomes the real one and, near a tree, pulls the camera in a little more every frame of a drag
  const unguard = () => { if (camera.position.equals(shown)) camera.position.copy(real); };
  for (const ev of ['pointerdown', 'pointermove']) container.addEventListener(ev, unguard, { capture: true, ...sig });
  function guard() {
    const C = camera.position, T = controls.target; real.copy(C);
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const o of [...habitat.solid, ...D.list]) {
        // a cylinder with a round top (inbox 14): coming down onto it from above, the push grows from nothing instead of
        // starting at full depth once below its top
        const dx = C.x - o.x, dz = C.z - o.z, R0 = o.r + 0.5; if (dx * dx + dz * dz >= R0 * R0) continue; // inbox 36: far off (the floor lookup costs)
        const up = C.y - habitat.floor(o.x, o.z) - (o.h ?? 1.2) - 0.3;
        if (o.water || (o.nat && o.open) || up >= R0 || (T.x - o.x) ** 2 + (T.z - o.z) ** 2 < R0 * R0) continue; // above it, or looking at something in it (22-1: or a flower patch)
        const R = up > 0 ? Math.sqrt(R0 * R0 - up * up) : R0, c = dx * dx + dz * dz - R * R;
        if (c >= -1e-6) continue; // outside
        const ex = T.x - C.x, ez = T.z - C.z, a = ex * ex + ez * ez, b = 2 * (ex * dx + ez * dz);
        C.lerp(T, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)); moved = true; // where the line to the target leaves the circle
      }
      if (!moved) break;
    }
    const f = habitat.floor(C.x, C.z) + 0.8; if (C.y < f) { C.y = f; camera.lookAt(T); }
    shown.copy(C);
  }
  // portrait phone, following: the more of its side faces the camera, the further back, so nose to tail fits 80% of the
  // screen width (the "정면" view, by the face, stays as it is)
  function sideFit(face) {
    const m = MODELS[SP[focus.rec.species].model][focus.look.stage], len = 2 * (m.r + Math.max(m.seg[1], -m.seg[0])); // the camera aims at its middle, so the longer end sets it (a cow's head end)
    return len * Math.abs(Math.sin(sph.theta - face)) / (1.6 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  }
  // following: a tree, pine, the barn, the hay or a placed prop (21-3: the gazebo's roof) on the line camera -> target (the guard's cylinder, r + 0.5 and h + 0.3)
  // fades to 0.25, and back over 0.3 s once clear. Meanwhile the prop is hidden (instances scaled to 0) and drawn as a twin
  // with cloned materials, made the first time and kept: depth first, then colour, so overlapping blobs read as one shell.
  // The shadow map isn't redrawn, so its shadow stays. Not in free view or decorating.
  const FADE = 0.25, ZERO = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4(), col = new THREE.Color();
  function twinOf(o) {
    if (o.twin) return o.twin;
    const tw = o.twin = { g: new THREE.Group(), mats: [], swap: [], k: 1, on: false };
    const copy = (m, i0 = 0, n = 1) => {
      for (const depth of [true, false]) {
        const mat = Object.assign(m.material.clone(), { transparent: true, colorWrite: !depth }); mat.onBeforeCompile = m.material.onBeforeCompile; // keeps the sway
        const t = m.isInstancedMesh ? new THREE.InstancedMesh(m.geometry, mat, n) : new THREE.Mesh(m.geometry, mat);
        if (m.isInstancedMesh) for (let i = 0; i < n; i++) { m.getMatrixAt(i0 + i, m4); t.setMatrixAt(i, m4); if (m.instanceColor) { m.getColorAt(i0 + i, col); t.setColorAt(i, col); } }
        else { t.matrixAutoUpdate = false; t.matrix.copy(m.matrixWorld); }
        t.renderOrder = depth ? 1.1 : 1.2; tw.g.add(t);
        if (depth) continue;
        tw.mats.push(mat);
        tw.swap.push(on => { if (!m.isInstancedMesh) return void (m.visible = on); for (let i = 0; i < n; i++) { if (on) t.getMatrixAt(i, m4); m.setMatrixAt(i0 + i, on ? m4 : ZERO); } m.instanceMatrix.needsUpdate = true; });
      }
    };
    for (const [m, i0, n] of o.fade) m.isInstancedMesh ? copy(m, i0, n) : m.traverse(c => c.isMesh && copy(c));
    return tw;
  }
  function hides(o, C, T) { // the segment C -> T passes through o's cylinder
    const R = o.r + 0.5, dx = C.x - o.x, dz = C.z - o.z, ex = T.x - C.x, ez = T.z - C.z;
    const a = ex * ex + ez * ez, b = 2 * (ex * dx + ez * dz), D = b * b - 4 * a * (dx * dx + dz * dz - R * R);
    if (a < 1e-9 || D <= 0) return false;
    const t0 = Math.max(0, (-b - Math.sqrt(D)) / (2 * a)), t1 = Math.min(1, (-b + Math.sqrt(D)) / (2 * a));
    if (t0 >= t1) return false;
    const y0 = habitat.floor(o.x, o.z), ya = C.y + (T.y - C.y) * t0, yb = C.y + (T.y - C.y) * t1;
    return Math.max(ya, yb) > y0 && Math.min(ya, yb) < y0 + o.h + 0.3;
  }
  // following: another animal between the camera and the followed one steps (or swims) aside (walk.js / swim.js shoo), in any habitat
  function clearView() {
    if (!focus || decorOn) return;
    const C = camera.position, T = controls.target, ex = T.x - C.x, ez = T.z - C.z, L2 = ex * ex + ez * ez;
    if (L2 < 1e-6) return;
    const L = Math.sqrt(L2), nx = -ez / L, nz = ex / L, F = focus.position.y;
    for (const a of actors.values()) {
      if (a === focus || !a.shoo || !a.obj.visible) continue;
      const b = a.body, k = ((b.x - C.x) * ex + (b.z - C.z) * ez) / L2;
      if (k <= 0 || k >= 0.97 || gapTo(b, C.x, C.z, T.x, T.z) > b.r + focus.body.r) continue;
      if (C.y + (F - C.y) * k > a.obj.position.y + height(a) + 0.1) continue; // even the line to its feet passes over it
      a.shoo(nx, nz, (b.x - T.x) * nx + (b.z - T.z) * nz);
    }
  }
  function fadeProps(dt) {
    const on = focus && !decorOn;
    for (const o of [...habitat.solid, ...D.list]) {
      if (!o.fade) continue;
      const want = on && !o.play?.seats.includes(focus) && hides(o, camera.position, controls.target) ? FADE : 1; // 28-2: not the play prop it is on
      if (want === 1 && !o.twin?.on) continue;
      const tw = twinOf(o);
      if (!tw.on) { tw.on = true; scene.add(tw.g); tw.swap.forEach(f => f(false)); }
      tw.k = want < tw.k ? Math.max(want, tw.k - dt * 2.5) : Math.min(want, tw.k + dt * 2.5); // 1 <-> 0.25 in 0.3 s
      for (const m of tw.mats) m.opacity = tw.k;
      if (tw.k === 1) { tw.on = false; scene.remove(tw.g); tw.swap.forEach(f => f(true)); }
    }
  }
  let ramp = 0, lastGoal = null; // a new glide starts softly (0.35 s) instead of at full speed
  function steerCamera(dt) {
    if (!focus && !goingHome && !aim) { lastGoal = null; return; }
    const key = focus ? glide : aim ?? (decorOn ? 'decor' : HOME); if (key !== lastGoal) { lastGoal = key; ramp = 0; }
    ramp = Math.min(1, ramp + dt / 0.35);
    const k = calm() ? 1 : (1 - Math.exp(-dt * 3.2)) * (key ? smooth(ramp) : 1); // frame-rate independent ease (26-3 움직임 줄이기: a cut)
    if (focus) want.set(focus.position.x, focus.position.y + lift, focus.position.z); else want.copy(aim ? aim.at : HOME.target);
    const goal = focus ? glide : aim ? { radius: aim.radius, phi: aim.phi ?? 0.5 } : decorOn ? { radius: HOME.wide * 0.85, phi: 0.5, theta: 0 } : HOME; // decorating: closer, more from above
    off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
    const face = focus && faceOf(focus);
    if (facing) goal.theta = face;
    if (tw) { // 정면: eased from where it was; the target eases onto the (moving) animal the same way
      tw.t = calm() ? 1 : Math.min(1, tw.t + dt / FRONT_T); const u = smooth(tw.t);
      sph.radius = tw.r + (goal.radius - tw.r) * u; sph.phi = tw.p + (goal.phi - tw.p) * u; sph.theta = tw.th + wrap(goal.theta - tw.th) * u;
      controls.target.lerpVectors(tw.at, want, u); extra = 0;
      if (tw.t === 1) tw = null;
    } else {
      sph.radius -= extra; // glide the distance without the side room
      if (goal?.radius) sph.radius += (goal.radius - sph.radius) * k;
      extra += ((focus && !facing && !zoomed ? Math.max(0, sideFit(face) - sph.radius) : 0) - extra) * k; sph.radius += extra;
      if (goal?.phi) sph.phi += (goal.phi - sph.phi) * k;
      if (goal?.theta != null) sph.theta += wrap(goal.theta - sph.theta) * k; // the short way round
      controls.target.lerp(want, k);
    }
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    if (aim && Math.abs(sph.radius - goal.radius) < 0.2 && controls.target.distanceTo(aim.at) < 0.1) aim = null;
    if (goingHome && Math.abs(sph.radius - goal.radius) < 0.2 && Math.abs(sph.phi - goal.phi) < 0.01 && Math.abs(wrap(sph.theta - (goal.theta ?? 0))) < 0.01 && controls.target.distanceTo(HOME.target) < 0.1) goingHome = false;
  }

  // perf: optional overlay (?debug) + drop resolution in steps if frames run long (never below 1x)
  const perfEl = DEBUG ? Object.assign(document.createElement('div'), { id: 'perf' }) : null;
  if (perfEl) container.parentElement.appendChild(perfEl);
  const gpu = (() => { // only when the browser exposes it (some hide it for privacy)
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '알 수 없음 (브라우저가 숨김)';
  })();
  let fN = 0, fT = 0, slow = 0, worst = 0, lite = false;
  // 26-3 배터리 절약: 30 frames a second, 15 after a minute without a touch, a key or the mouse
  let lastIn = performance.now(), lastDraw = 0;
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown']) window.addEventListener(ev, () => { lastIn = performance.now(); }, { passive: true, ...sig });
  const fpsCap = () => !PREFS.saver ? 60 : performance.now() - lastIn > 60000 ? 15 : 30;
  function perf(rawDt) {
    fN++; fT += rawDt; worst = Math.max(worst, rawDt); if (fT < 1) return;
    const fps = fN / fT;
    slow = fps < fpsCap() * 0.83 ? slow + 1 : 0; // 50 of 60 (25 of 30 with 배터리 절약)
    if (slow >= 2 && !lite && glassLite()) { lite = true; slow = 0; } // first step: drop the glass refraction pass (real glass only)
    else if (slow >= 2 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(W(), H()); slow = 0; }
    if (perfEl) { const i = renderer.info.render; perfEl.textContent = `품질 ${QUALITY.gfx}${PREFS.saver ? ` (절약 ${fpsCap()}fps)` : ''}  삼각형 ${(i.triangles / 1000).toFixed(0)}k
FPS ${fps.toFixed(0)}  (${(1000 / fps).toFixed(1)}ms, 최장 ${(worst * 1000).toFixed(0)}ms)
픽셀 비율 ${pr.toFixed(2)}x${lite ? ' (유리 간이)' : ''} / 기기 ${(window.devicePixelRatio || 1).toFixed(2)}x  ${renderer.domElement.width}×${renderer.domElement.height}
드로콜 ${i.calls}
GPU ${gpu}`; }
    fN = 0; fT = 0; worst = 0;
  }

  let active = true, lastTag = '', noteAt = 0;
  function setActive(on) { active = on; renderer.domElement.style.display = on ? '' : 'none'; clock.getDelta(); fN = fT = slow = 0; camState = null; if (!on) ambience(null); else if (DEBUG) window.__hab = dbg; } // paused (and hidden: another habitat may share the container) while the world map is shown
  const clock = new THREE.Clock();
  function tick() {
    if (dead) return;
    requestAnimationFrame(tick);
    if (!active) return;
    if (PREFS.saver) { const now = performance.now(); if (now - lastDraw < 1000 / fpsCap() - 4) return; lastDraw = now; } // 26-3 배터리 절약
    const raw = clock.getDelta(), dt = Math.min(PREFS.saver ? 0.075 : 0.05, raw), t = clock.elapsedTime; // 15 fps: steps of 1/15 s keep the walk at speed
    const w = sky.now(), L = light(w.gray); habitat.ctx.night = L.night; habitat.ctx.rain = w.rain + w.snow; habitat.ctx.az = Math.atan2(camera.position.z - controls.target.z, camera.position.x - controls.target.x); flies?.(t, L.night); ambience(habId, L.night, w.rain, w.snow); // walk.js / swim.js: sleepier at night, shelter or swim in the rain (25-1: the snow's snow alike)
    windTime.value = t; habitat.update(dt, t); mistTick(t, dt); bugs.tick(t, L.night, w.rain);
    if (t > noteAt) { noteAt = t + 2; const es = [...placed.values()]; // 23-2 도전 과제: what is on screen now
      if (L.night > 0.5) ui.note?.('lights', es.filter(e => e.light).length);
      if (w.rain > 0.3) ui.note?.('roof', Math.max(0, ...es.filter(e => e.roof?.under).map(e => [...actors.values()].filter(a => Math.hypot(a.position.x - e.roof.x, a.position.z - e.roof.z) < e.roof.under.r).length)));
    }
    if (train && stepTrain(train.T, train.net, dt, habitat.ctx.crowd, train.st) === 'toot') sfx('train'); // 28-4: before the riders (play.js reads its cars)
    if (train) placeCars();
    for (const a of actors.values()) a.update(dt, t);
    if (t > homeAt && !decorOn) { homeAt = t + 1; penCheck(); }
    hear(camera, controls.target, actors, habitat.ctx, D.list, underfoot); // 13-0: the world's sounds where they are
    updPuffs(dt);
    for (const e of placed.values()) e.obj.userData.tick?.(t); ed?.obj.userData.tick?.(t); // props that move (pinwheel, swing, boat...)
    if (ed && ed.on == null && fits(ed.P, ed.x, ed.z, SZ(ed)) !== ed.ok) moveEdit(ed.x, ed.z); // animals walk in and out of the held prop's spot (28-5: at its size; one on a top spot has none)
    if (grassDirty) { grassDirty = false; mask(hideGrass); }
    // a pinch / wheel moves the camera between frames (OrbitControls updates in its own handlers): the distance is theirs now
    unguard(); // undo last frame's guard (unless a pointer handler has, and moved the camera since)
    if (focus && !zoomed && Math.abs(camera.position.distanceTo(controls.target) - rEnd) > 1e-3) { zoomed = true; extra = 0; }
    if (trainCam) { if (!train) trainCam = false; else { const c = train.T.cars[0]; trainAim.at.set(c.x, c.y + 0.4, c.z); aim = trainAim; // 28-4 기차 따라가기 (a drag or a pinch sets how far, how high)
      if (held) { off.copy(camera.position).sub(controls.target); sph.setFromVector3(off); trainAim.radius = sph.radius; trainAim.phi = sph.phi; } } }
    if (peekT && (focus || decorOn || snapOn || trainCam)) peekT = 0, back0 = null;
    else if (peekT && (peekT -= dt) <= 0) { peekT = 0; aim = back0; back0 = null; } // inbox 43: back from the new friend
    feedWheel(dt); steerCamera(dt);
    if (!focus && !(DEBUG && window.__hab.free)) { // keep pan inside the board (screenshot script can lift this); eased so leaving a follow near the edge doesn't jump
      const T = controls.target, k = 1 - Math.exp(-dt * 8);
      want.set(THREE.MathUtils.clamp(T.x, ...panX), goingHome ? T.y : 0, THREE.MathUtils.clamp(T.z, ...panZ)).sub(T).multiplyScalar(k);
      T.add(want); camera.position.add(want);
    }
    const tag = focus ? label(focus) : '', k = tag + (focus?.rec.id ?? ''); if (k !== lastTag) { lastTag = k; ui.tag?.(tag, focus?.rec); } // stage can change while followed
    band(dt);
    want.copy(controls.target); controls.update();
    if (focus && held && !decorOn && (panned += want.distanceTo(controls.target)) > 0.08 * near) setFocus(null); // the view moved: stop following
    camUi();
    guard(); rEnd = real.distanceTo(controls.target); clearView(); fadeProps(dt); sky.draw(t, w, L); renderer.render(scene, camera);
    perf(raw);
  }
  function project(obj, lift = 2.4) { const v = obj.position.clone(); v.y += lift; v.project(camera); const r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }
  function resize() {
    pr = Math.min(pr, maxPR()); renderer.setPixelRatio(pr); renderer.setSize(W(), H());
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    HOME.wide = homeRadius(); setHome(); controls.maxDistance = HOME.wide * 1.15;
  }
  window.addEventListener('resize', resize, sig);
  // 27-1: the habitat on screen (a built one entered again is only set active, not started again)
  const dbg = DEBUG && { scene, camera, controls, renderer, actors, project, placed, habitat, level, nature, natSpots: () => natSpots, decor, ed: () => ed }; if (DEBUG) window.__hab = dbg; // ed: the held prop (inbox 52 tests)
  if (reveal) overview(); // out to the wider board's home view while the mist draws back
  // 28-1: a zone just opened (main.js): the camera glides out over it, and up to 4 animals run to its spots
  function showZone(k) {
    const s = strip(habId, k), sp = habitat.ctx.spots.filter(p => p.k === k), C = THREE.MathUtils.clamp;
    setFocus(null); goingHome = false;
    // a little in from the strip's middle (the old ground beside it shows, not the empty table past the edge), the same closeness at
    // step 1 and step 6 (HOME.radius grows with the board, kR). inbox 34: nearer than the home view, and along a side strip at its
    // hills and pools, so the zone's landmark is big on the screen
    const ix = { '+x': -3, '-x': 3 }[s.side] || 0, iz = s.side === '+z' ? -2.5 : 0, big = zoneSet(habId, k).F.filter(f => f.k === k && (f.t === 'hill' || f.t === 'pool'));
    const cz = big.length && s.side !== '+z' ? big.reduce((a, f) => a + f.z, 0) / big.length : s.cz;
    aim = { at: new THREE.Vector3(C(s.cx + ix, ...panX), 0, C(cz + iz, ...panZ)), radius: HOME.wide / kR * 0.48, phi: 0.78 };
    const far = a => Math.hypot(a.position.x - s.cx, a.position.z - s.cz); // the nearest four: they get there while the camera looks
    if (sp.length) idle().sort((a, b) => far(a) - far(b)).slice(0, 4).forEach((a, i) => { const p = sp[i % sp.length]; a.send(p.x + (Math.random() - 0.5) * 2, p.z + (Math.random() - 0.5) * 2, 'run', { fast: true }); });
  }
  // 28-1 넓히기 전과 비교: the open ground from straight above, w px wide (no mist), and the first board's part of it alone on the table
  function topView(w = 600) {
    const r = open, h = Math.round(w * (r[3] - r[2]) / (r[1] - r[0])), cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
    const cam = new THREE.OrthographicCamera(-(r[1] - r[0]) / 2, (r[1] - r[0]) / 2, (r[3] - r[2]) / 2, -(r[3] - r[2]) / 2, 1, 200);
    cam.up.set(0, 0, -1); cam.position.set(cx, 80, cz); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld(); // the back (-z) at the top, as the home view
    const mv = mistTick.mesh.visible; mistTick.mesh.visible = false;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.render(scene, cam);
    const now = document.createElement('canvas'); now.width = w; now.height = h; now.getContext('2d').drawImage(renderer.domElement, 0, 0);
    mistTick.mesh.visible = mv; renderer.setPixelRatio(pr); renderer.setSize(W(), H()); renderer.render(scene, camera);
    const was = document.createElement('canvas'), c = was.getContext('2d'), X = x => (x - r[0]) / (r[1] - r[0]) * w, Y = z => (z - r[2]) / (r[3] - r[2]) * h, B = BOARD0;
    was.width = w; was.height = h; c.drawImage(now, X(B[0]), Y(B[2]), X(B[1]) - X(B[0]), Y(B[3]) - Y(B[2]), X(B[0]), Y(B[2]), X(B[1]) - X(B[0]), Y(B[3]) - Y(B[2]));
    return { was, now };
  }
  tick();
  if (DEBUG) Object.assign(dbg, { showZone, topView, setFocus });
  return {
    resize, overview, front, setActive, sync, drop, syncProps, decor, revealed: mistTick.done, showZone, topView,
    // 27-2: the shaders of what is out now, made before the curtain lifts (main.js). inbox 49: not three's compileAsync, which reads each material's
    // program in a timer: a material let go meanwhile (a habitat built again) or a context given back (new renderer.properties) threw
    // 'isReady' of undefined there, uncaught, and the curtain never lifted. Here gone = ready, and it always ends (10 s at most)
    warm: () => new Promise(done => {
      let mats; try { mats = renderer.compile(scene, camera); } catch { return done(); }
      const t0 = performance.now(), poll = () => {
        if (dead || renderer.getContext().isContextLost() || performance.now() - t0 > 10000) return done();
        try { for (const m of mats) { const p = renderer.properties.get(m).currentProgram; if (!p || p.isReady()) mats.delete(m); } } catch { return done(); }
        if (mats.size) setTimeout(poll, 10); else done();
      };
      poll();
    }),
    natives: habitat.natives && { list: habitat.natives.list.map(n => ({ ...n, x: n.x / U, z: n.z / U })), rings: habitat.natives.rings }, // 22-1: for the save (main.js)
    pose: () => ({ target: controls.target.clone(), position: camera.position.clone() }),
    // 24-1 사진 모드: the wider camera band; shot(ratio): this frame drawn again at that pixel ratio, copied out (a 2D canvas)
    // inbox 42 G: the preview is fitted under the panel by photo.js (a CSS transform; taps read the canvas rect), the view itself is whole
    canvas: renderer.domElement, snap(on) { snapOn = on; },
    sky: () => ({ hour: hourNow(), kind: weatherNow(habId).kind }), // 15-1: what a photo shows (the event album)
    shot(ratio) {
      renderer.setPixelRatio(ratio); renderer.setSize(W(), H()); renderer.render(scene, camera);
      const c = document.createElement('canvas'); c.width = renderer.domElement.width; c.height = renderer.domElement.height; c.getContext('2d').drawImage(renderer.domElement, 0, 0);
      renderer.setPixelRatio(pr); renderer.setSize(W(), H()); renderer.render(scene, camera); return c; // drawn again: setSize cleared the screen
    },
    dispose() { dead = true; ac.abort(); controls.dispose(); unhook(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); boxEl.remove(); perfEl?.remove(); }, // replaced (21-3b, main.js)
    look(id) { const a = actors.get(id); if (!a) return false; setFocus(a); front(); watch = true; return true; }, // inbox 20: follow one and turn to its face (friends list, 「연못에서 보기」); 26-4 a touch lets go
    unfollow: () => { trainCam = false; setFocus(null); }, followed: () => trainCam ? 'train' : focus?.rec.id ?? null, // 26-4 사진 모드 따라가기
    hasTrain: () => !!train, followTrain() { if (!train) return false; setFocus(null); Object.assign(trainAim, { radius: 9, phi: 1 }); goingHome = false; trainCam = true; return true; }, // 28-4
    where(id) { const a = actors.get(id); return a?.obj.visible ? project(a.obj, height(a) + 0.3) : null; }, // screen point above an animal
  };
}
