// Small DOM overlays: toast message, tap heart, sleep "z".
const toastEl = document.getElementById('toast');
let toastT;

// ms = 0: stays until the next toast or hideToast(); small: a quieter, smaller line
export function toast(text, ms = 2200, small = false) {
  toastEl.textContent = text; toastEl.classList.add('on'); toastEl.classList.toggle('small', small);
  clearTimeout(toastT); if (ms) toastT = setTimeout(hideToast, ms);
}
export const hideToast = () => toastEl.classList.remove('on');

function fx(cls, text, x, y, ms) {
  const e = document.createElement('div'); e.className = 'fx ' + cls; e.textContent = text;
  e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), ms);
}

export const heart = (x, y) => fx('heart', '♥', x, y, 1300);
export const zzz = ([x, y]) => fx('zz', 'z', x, y, 2300);
// a sheet (nest, codex, storage, cabinet...) is open over the habitat: nothing floats over animals then
export const overlayOpen = () => !!document.querySelector('#habitat > section:not([hidden])');

// time left: 4:05 / 1:02:05 (slots), 40초 / 12분 / 1시간 5분 (sentences)
export const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
export const span = ms => { const m = Math.ceil(ms / 60000); return ms < 60000 ? `${Math.max(1, Math.ceil(ms / 1000))}초` : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`; };
// Korean particle after a word: a if it ends in a final consonant (이/을/은), else b (가/를/는)
export const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

// ---- inbox 20 편의성: a yes/no question, closing the top window (Esc / back / a tap outside), first-time tips
import * as G from '../game/game.js';
import { unlockInfo } from '../game/rules.js';
const stageEl = () => document.getElementById('stage');
// why a habitat is shut, and how far along: "초원 도감 8칸 + 하트 30개면 열려요 (지금 3칸 · ♥12)"
export const lockText = id => { const L = unlockInfo(G.S, id); return L.need ? `${L.prev.name} 도감 ${L.need}칸 + 하트 ${L.hearts}개면 열려요 (지금 ${L.have}칸 · ♥${G.S.hearts})` : '아직 잠겨 있어요'; };

// a question over everything: true for ok; 취소, a tap outside, Esc / back = false
export function ask(text, ok = '확인', no = '취소') {
  return new Promise(res => {
    const el = document.createElement('section'); el.className = 'intro ask'; el.id = 'ask';
    el.innerHTML = `<div><p></p><div class="nbtns"><button class="sb" data-close>${no}</button><button class="go" data-ok>${ok}</button></div></div>`;
    el.querySelector('p').textContent = text;
    el.onclick = e => { const b = e.target.closest('button'); if (e.target !== el && !b) return; el.remove(); res(b?.dataset.ok != null); };
    stageEl().append(el);
  });
}

// the windows, top first; each closes with its own close button (so its own code runs)
const TOPS = ['#ask', '.tip', '#intro', '#news', '#lvup', '#zoneCard', '#cmpz', '#lvSheet', '#achSheet', '#share', '#backup', '#mail', '#event', '#prefs', '#help', '#habMenu', '#attend', '#ret', '#grown', '#homeHint', '#fmenu', '#friends', '.cdet', '#codex', '#cards', '#store', '#cab', '#nest', '#decor', '#snap'];
const SHUT = '[data-close],[data-shut],[data-done],[data-cancel]';
const shown = el => el && !el.hidden && !el.closest('[hidden]') && !el.closest('.scene.hidden');
export const topWindow = () => { for (const q of TOPS) { const el = document.querySelector(q); if (shown(el) && el.querySelector(SHUT)) return el; } return null; };
export function closeTop() {
  const el = topWindow(); if (el) { el.querySelector(SHUT).click(); return true; }
  const b = document.getElementById('bubble'); if (!b.hidden) { b.hidden = true; return true; }
  return false;
}
// a tap on the dark area around a window (class pop) closes it
document.addEventListener('click', e => { if (e.target.classList?.contains('pop')) e.target.querySelector(SHUT)?.click(); });

// first-time tips: a small bubble by the thing it is about, once each (flags tip_<k>); 안내 끄기 = flags.tipsOff.
// 설정 「안내 다시 보기」 clears them; the 「?」 sheet lists them all.
export { TIPS } from './tips.js'; // 26-1: in its own file, so the loading screen can show one before the game has loaded
import { TIPS } from './tips.js';
const waiting = []; let tipEl = null, calm = 0;
// inbox 43: a game's first 10 minutes show one card or tip at a time, the next 40 s after the last one went (the start card
// is the way in, not counted). resting(): wait. Tips, 출석부, level, grown and home cards all ask it.
const CARDS = '#news,#attend,#event,#ret,#lvup,#zoneCard,#grown,#homeHint,.tip'; let upAt = 0;
export const resting = () => { if ([...document.querySelectorAll(CARDS)].some(shown)) upAt = Date.now(); return !!G.S && G.now() - G.S.since < 600e3 && Date.now() - upAt < 40e3; };
setInterval(() => { if (!resting()) nextTip(); }, 250);
export function tip(k, anchor) { // anchor: an element or a selector; shown once it is on screen and no other tip is up
  if (G.S.flags.tipsOff || G.S.flags['tip_' + k] || waiting.some(w => w.k === k) || tipEl?.dataset.k === k) return;
  waiting.push({ k, anchor }); nextTip();
}
function nextTip() {
  if (tipEl || G.S.flags.tipsOff || Date.now() < calm || resting()) return; // 26-11: not while the tap that closed the last one is still landing
  const over = topWindow(), el = w => typeof w.anchor === 'string' ? document.querySelector(w.anchor) : w.anchor;
  const i = waiting.findIndex(w => shown(el(w)) && (!over || over.contains(el(w)))); if (i < 0) return; // not under another window
  const [{ k, anchor }] = waiting.splice(i, 1), a = typeof anchor === 'string' ? document.querySelector(anchor) : anchor;
  const st = stageEl(), s = window.__stageScale || 1, sr = st.getBoundingClientRect(), r = a.getBoundingClientRect();
  tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.dataset.k = k; tipEl.setAttribute('role', 'status');
  tipEl.innerHTML = `<p><b>${TIPS[k][0]}</b> ${TIPS[k][1]}</p><div><button data-off>안내 끄기</button><button data-close>알겠어요</button></div>`;
  st.append(tipEl);
  const W = st.clientWidth, H = st.clientHeight, cx = (r.left + r.width / 2 - sr.left) / s, top = (r.top - sr.top) / s, bot = (r.bottom - sr.top) / s;
  const w = tipEl.offsetWidth, x = Math.max(12, Math.min(W - 12 - w, cx - w / 2)); tipEl.style.left = x + 'px';
  tipEl.style.setProperty('--ax', Math.max(14, Math.min(w - 14, cx - x)) + 'px');
  // a tall anchor: kept on screen; inbox 40: and off the home bar (--sa-b, style.css)
  if (top > H / 2) { tipEl.style.bottom = `max(calc(8px + var(--sa-b)), ${H - top + 10}px)`; tipEl.classList.add('up'); } else tipEl.style.top = `min(calc(100% - ${tipEl.offsetHeight + 8}px - var(--sa-b)), ${bot + 10}px)`;
  tipEl.onclick = e => { const b = e.target.closest('button'); if (b) endTip(b.dataset.off != null); };
}
function endTip(off) { if (!tipEl) return; const k = tipEl.dataset.k; tipEl.remove(); tipEl = null; calm = Date.now() + 380; G.flag('tip_' + k); if (off) { G.flag('tipsOff'); waiting.length = 0; } setTimeout(nextTip, 400); }
// any tap elsewhere also counts as seen
addEventListener('pointerdown', e => { if (tipEl && !tipEl.contains(e.target)) endTip(false); }, true);
G.on(() => setTimeout(nextTip)); // a tick later: a card opened in the same step (level.js flags lvCard before it shows the card) is up first, so the tip waits instead of covering it
export function resetTips() { for (const k in TIPS) G.flag('tip_' + k, false); G.flag('tipsOff', false); }
