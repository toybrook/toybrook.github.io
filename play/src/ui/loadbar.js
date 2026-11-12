// 26-1 the habitat's loading screen: a bar of what has arrived, and one tip (tips.js). Light: on the first screen.
// What it counts: the 3D code (three.js, the habitats, their windows: CODE_BYTES, from the time it was asked for) if it
// is still on the way, then the model files the habitat asked for and those still arriving (figure.js fills `fetched`).
import { CODE_BYTES } from '../config.js';
import { loadTip } from './tips.js';

export const fetched = []; // one per model file asked for: the part of it that has arrived, 0..1 (1 also when it failed)
let el, bar; // made on first use: figure.js counts its files here on tools pages too, which have no #loading

let codeAt = -1; // performance.now() when the 3D code was asked for (-1: not yet)
export const codeAsked = () => { if (codeAt < 0) codeAt = performance.now(); };
const codeGot = () => performance.getEntriesByType('resource').filter(e => e.startTime >= codeAt && /\.js$/.test(e.name)).reduce((n, e) => n + e.decodedBodySize, 0);

// on: show it (codeDone: the 3D code is here already); off: hide it
export function loadBar(on, codeDone = true) {
  if (!el) {
    el = document.getElementById('loading');
    el.innerHTML = '<p>서식지 불러오는 중…</p><p class="lbar"><i></i></p><button class="lfirst" hidden>바로 깨기</button><p class="ltip"></p>'; bar = el.querySelector('i');
  }
  el.hidden = !on; if (!on) return;
  el.querySelector('.ltip').innerHTML = loadTip();
  let f0 = fetched.findIndex(x => x < 1), k = 0; if (f0 < 0) f0 = fetched.length; // files on the way (an early fetch of this habitat's) count too
  bar.style.width = '0';
  (function step() {
    if (el.hidden) return;
    const n = fetched.length - f0, files = n ? fetched.slice(f0).reduce((a, x) => a + x, 0) / n : 0;
    // ponytail: every file counts the same and the code and the models share the bar 4:6 (about their sizes for the meadow), not byte for byte
    const f = codeDone ? files : 0.4 * Math.min(1, codeGot() / CODE_BYTES) + 0.6 * files;
    k = Math.max(k, Math.min(1, f)); bar.style.width = (k * 100).toFixed(1) + '%';
    requestAnimationFrame(step);
  })();
}
