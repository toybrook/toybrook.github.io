// Small still pictures for the UI (codex cells, nest eggs and slots): the real figures and eggs in their real materials,
// drawn once each by one small offscreen renderer under the habitat's sun and sky, cached as image URLs.
import * as THREE from 'three';
import { makeSkyEnv, nightGlow } from '../habitat/toyKit.js';
import { TIMES } from '../habitat/daylight.js';
import { makeFigure, loadModel, loadAcc } from '../animals/figure.js';
import { makeEgg } from '../animals/growth.js';
import { eggMat } from '../animals/materials.js';
import { SP, variantsOf } from '../game/rules.js';

const SIZE = 192, BG = '#fbf1e1', NIGHT_BG = '#2b3356'; // BG = the cell colour in style.css (fake glass bends what is behind it); NIGHT_BG = .codex.night .cell
let S, R, scene, cam;
const cache = new Map(), sil = new THREE.MeshBasicMaterial({ color: '#d8c4a4' });

// a renderer and an empty scene lit like the habitat (also the nest menu's hatch stage)
export function studio(opts) {
  const R = new THREE.WebGLRenderer({ antialias: true, ...opts });
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.setClearColor(BG, 1);
  const sunDir = new THREE.Vector3(-22, 40, -14).normalize(); // same sun as the habitat
  const scene = new THREE.Scene(); scene.environment = makeSkyEnv(R, sunDir);
  const sun = new THREE.DirectionalLight('#ffe6c4', 2.1); sun.position.copy(sunDir).multiplyScalar(40); scene.add(sun);
  return { R, scene, sun };
}
// 21-1 밤에 보기 (cabinet, codex): a studio under the night's moon and sky (daylight.js TIMES) with the glow uniform up; off: the day again
export function nightLights(s, on) {
  const T = TIMES[on ? 3 : 1];
  s.envs ??= [s.scene.environment, makeSkyEnv(s.R, new THREE.Vector3(...TIMES[3].sun).normalize(), TIMES[3])];
  s.scene.environment = s.envs[on ? 1 : 0]; s.sun.color.set(T.col); s.sun.intensity = T.I; s.sun.position.set(...T.sun).normalize().multiplyScalar(40);
  nightGlow.value = on ? 1 : 0;
}
function setup() {
  S = studio({ preserveDrawingBuffer: true }); ({ R, scene } = S); R.setSize(SIZE, SIZE, false);
  cam = new THREE.PerspectiveCamera(22, 1, 0.1, 200);
}
function shoot(obj, silhouette = false, night = false) {
  if (!R) setup();
  const was = nightGlow.value; if (night) { nightLights(S, true); R.setClearColor(NIGHT_BG, 1); }
  obj.rotation.y = -Math.PI / 2 + 0.45; scene.add(obj); // facing us, turned a little (like tools/lineup.html ?a=front)
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  cam.position.set(c.x, c.y + r * 0.35, c.z + r / Math.tan(THREE.MathUtils.degToRad(11)) * 0.95); cam.lookAt(c);
  sil.color.set(night ? '#4a5382' : '#d8c4a4'); scene.overrideMaterial = silhouette ? sil : null; // a dim shape on the night cell
  R.render(scene, cam); scene.remove(obj);
  const url = R.domElement.toDataURL('image/png');
  if (night) { nightLights(S, false); R.setClearColor(BG, 1); nightGlow.value = was; } // back as the habitat had it
  return url;
}
const once = (k, f) => cache.has(k) ? cache.get(k) : (cache.set(k, f().catch(e => { cache.delete(k); throw e; })), cache.get(k)); // 27-2: a failed one (offline) is made again next time

// figure of a variant in one colour (none = its first), adult unless told, with a secret accessory if given
// (async: the species' model may not be loaded yet)
export const figureThumb = (spId, vId, cId = null, acc = null, stage = 'adult', night = false) => once(`f${spId}:${vId}:${cId}:${acc}:${stage}${night ? ':n' : ''}`, async () => { await Promise.all([loadModel(SP[spId].model), loadAcc(acc)]); return shoot(makeFigure(spId, vId, stage, acc, cId).obj, false, night); });
// a habitat's decor prop (front +z), turned a little toward us like the figures (a light without its halo sprite: it would widen the framing)
export const propThumb = (id, make) => once('p' + id, async () => { const g = new THREE.Group(), m = make(id); m.remove(...m.children.filter(o => o.isSprite)); m.rotation.y = Math.PI / 2 - 0.9; g.add(m); return shoot(g); });
// the species' shape, flat, for codex cells not found yet (wearing an accessory: the album's "?")
export const silhouetteThumb = (spId, acc = null, night = false) => once('s' + spId + acc + (night ? ':n' : ''), async () => { await Promise.all([loadModel(SP[spId].model), loadAcc(acc)]); return shoot(makeFigure(spId, variantsOf(SP[spId])[0].id, 'adult', acc).obj, true, night); });
export const eggThumb = rarity => once('e' + rarity, async () => shoot(makeEgg(eggMat(rarity)).group));
