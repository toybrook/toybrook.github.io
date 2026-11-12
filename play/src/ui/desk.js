// 16-3 책상 모드 (켜 두는 화면): the HUD away, the camera drifting from friend to friend at 15 fps (habitat.js desk()), a clock
// (Korean time) in a corner, a little darker at night (22~6 시), the screen kept on if chosen (Wake Lock), sound off or the
// background only; one tap (or Esc / back) and it is as before. 작은 창: the habitat itself moved into a Document
// Picture-in-Picture window (PC Chrome), over the other windows; this page shows the desk until it is closed. Loaded at first use.
import { PREFS } from '../config.js';
import { deskSound } from './sound.js';

const KST = { timeZone: 'Asia/Seoul' }, time = new Intl.DateTimeFormat('ko-KR', { ...KST, hour: 'numeric', minute: '2-digit' });
const date = new Intl.DateTimeFormat('ko-KR', { ...KST, month: 'long', day: 'numeric', weekday: 'short' });
const hour = new Intl.DateTimeFormat('en-US', { ...KST, hour: 'numeric', hourCycle: 'h23' });
let el = null, api = null, lock = null, clockT = 0, pip = null;

// the screen kept on: asked again when the tab comes back (the browser lets it go when hidden)
async function keep() {
  if (!el || PREFS.deskWake === false || document.hidden || lock || !navigator.wakeLock) return;
  try { lock = await navigator.wakeLock.request('screen'); lock.onrelease = () => { lock = null; }; if (!el) lock.release(); } catch { /* refused (low battery...): the screen may sleep */ }
}
document.addEventListener('visibilitychange', keep);
function draw() {
  const d = new Date(), h = +hour.format(d);
  el.querySelector('b').textContent = time.format(d); el.querySelector('small').textContent = date.format(d);
  el.classList.toggle('night', h >= 22 || h < 6);
}
export function deskOn(a, note = '') {
  if (el) return; api = a;
  el = document.createElement('div'); el.id = 'desk'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', '책상 모드 끄기');
  el.innerHTML = `<button data-close hidden></button>${note ? `<p>${note}</p>` : ''}<div class="dclock"><b></b><small></small></div>`;
  el.onclick = deskOff; // closeTop (Esc, back) clicks the hidden button: it bubbles here
  document.getElementById('stage').append(el); document.body.classList.add('desk');
  api.desk(true); deskSound(PREFS.deskSound === true ? 'amb' : 'off'); draw(); clockT = setInterval(draw, 5000); keep();
}
export function deskOff() {
  if (!el) return; el.remove(); el = null; clearInterval(clockT); document.body.classList.remove('desk');
  api.desk(false); deskSound(null); lock?.release(); lock = null; pip?.close(); // its pagehide puts the habitat back
}
export async function openPip(a) {
  if (pip) return;
  const w = await window.documentPictureInPicture.requestWindow({ width: 360, height: 270 }); pip = w;
  const gl = document.getElementById('gl'), at = gl.nextSibling, fit = () => a.resize();
  w.document.title = '토이브룩'; w.document.body.style.cssText = 'margin:0;overflow:hidden;background:#2b3a2e';
  gl.style.cssText = 'position:fixed;inset:0'; w.document.body.append(gl);
  a.raf(w); fit(); w.addEventListener('resize', fit);
  deskOn(a, '작은 창에서 보고 있어요<br>누르면 여기로 돌아와요');
  w.addEventListener('pagehide', () => { pip = null; gl.style.cssText = ''; at.before(gl); a.raf(window); fit(); deskOff(); });
}
