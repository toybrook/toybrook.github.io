// Small DOM overlays: toast message, tap heart, sleep "z".
import { $t, LANG } from '../i18n/i18n.js';
const toastEl = document.getElementById('toast');
let toastT;

// ms = 0: stays until the next toast or hideToast(); small: a quieter, smaller line
export function toast(text, ms = 2200, small = false) {
  toastEl.textContent = text; toastEl.classList.add('on'); toastEl.classList.toggle('small', small);
  toastEl.style.top = ''; // 64-A: below any top-row button it would cover (첫날 할 일, 진열장 …)
  const st = stageEl(), s = window.__stageScale || 1, sr = st.getBoundingClientRect();
  const btns = [...st.querySelectorAll('.scene:not(.hidden) button, .tip')].filter(b => shown(b) && b.offsetParent && !b.closest('.scene > section,[role=dialog]')).map(b => b.getBoundingClientRect()).filter(r => r.width && r.top < sr.top + sr.height * .4);
  for (let k = 0; k < 4; k++) {
    const t = toastEl.getBoundingClientRect(), b = btns.find(r => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top); if (!b) break;
    toastEl.style.top = (b.bottom - sr.top) / s + 6 + 'px';
  }
  const c = TUT228 && document.querySelector('.t2chip:not([hidden])')?.getBoundingClientRect(), tt = toastEl.getBoundingClientRect(); // 238 C ①: not under the praise chip
  if (c && c.left < tt.right && c.right > tt.left && c.top < tt.bottom && c.bottom > tt.top) toastEl.style.top = (c.bottom - sr.top) / s + 6 + 'px';
  // 176: not over an open window's head row (the nest's 「둥지 · 정리 · 닫기」): below the window if it fits above the bottom
  // buttons, else above it if there is room under the top bar, else at the bottom edge (over the window's foot, not its head)
  const w = topWindow()?.firstElementChild?.getBoundingClientRect(), t = toastEl.getBoundingClientRect();
  if (w?.height && t.top < w.bottom && t.bottom > w.top) {
    const foot = sr.bottom - 84 * s, y = w.bottom + 6 * s + t.height <= foot ? w.bottom + 6 * s : w.top - 6 * s - t.height >= sr.top + 60 * s ? w.top - 6 * s - t.height : sr.bottom - 14 * s - t.height;
    toastEl.style.top = (y - sr.top) / s + 'px';
  }
  clearTimeout(toastT); if (ms) toastT = setTimeout(hideToast, ms);
}
export const hideToast = () => toastEl.classList.remove('on');
// inbox 102: news in turn, one line at a time (small): each waits for the one before it to go
let line = Promise.resolve();
export const say = (text, ms = 3000) => { line = line.then(() => { toast(text, ms, true); return new Promise(r => setTimeout(r, ms)); }); };

function fx(cls, text, x, y, ms) {
  const e = document.createElement('div'); e.className = 'fx ' + cls; e.textContent = text;
  e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), ms);
}

export const heart = (x, y, cls = '') => fx('heart ' + cls, '♥', x, y, 1300); // cls 'rim': 176 the 정 레벨-up hearts, a white rim over pink friends
export const zzz = ([x, y]) => fx('zz', 'z', x, y, 2300);
// a sheet (nest, codex, storage, cabinet...) is open over the habitat: nothing floats over animals then
// a window opened on a 3D tap's pointerup: the click that follows lands on it (a phone hit-tests the click after the window is up), so eat it
export const eat = () => { const f = e => { e.stopPropagation(); e.preventDefault(); }; addEventListener('click', f, { capture: true, once: true }); setTimeout(() => removeEventListener('click', f, { capture: true }), 450); };
export const overlayOpen = () => !!document.querySelector('#habitat > section:not([hidden])');

// time left: 4:05 / 1:02:05 (slots), 40초 / 12분 / 1시간 5분 (sentences)
export const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
export const span = ms => { const m = Math.ceil(ms / 60000); return ms < 60000 ? $t('{0}초', Math.max(1, Math.ceil(ms / 1000))) : m < 60 ? $t('{0}분', m) : $t('{0}시간{1}', Math.floor(m / 60), m % 60 ? $t(' {0}분', m % 60) : ''); };
// Korean particle after a word: a if it ends in a final consonant (이/을/은), else b (가/를/는)
export const josa = (w, a, b) => { if (LANG !== 'ko') return ''; const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

// ---- inbox 20 편의성: a yes/no question, closing the top window (Esc / back / a tap outside), first-time tips
import * as G from '../game/game.js';
import { unlockInfo, step181 } from '../game/rules.js';
import { TUT181, TUT228 } from '../game/data.js'; // 182 ②; 238 C
const stageEl = () => document.getElementById('stage');
// why a habitat is shut, and how far along: "초원 도감 8칸 + 하트 30개면 열려요 (지금 3칸 · ♥12)"
export const lockText = id => { const L = unlockInfo(G.S, id); return L.friends ? $t('{0} 동물 {1}마리가 태어나면 열려요 (지금 {2}마리)', L.prev.name, L.friends, Math.min(L.got, L.friends)) : L.need ? $t('{0} 도감 {1}칸 + 하트 {2}개면 열려요 (지금 {3}칸 · ♥{4})', L.prev.name, L.need, L.hearts, L.have, G.S.hearts) : $t('아직 잠겨 있어요'); };

// a question over everything: true for ok; 취소, a tap outside, Esc / back = false
export function ask(text, ok = $t('확인'), no = $t('취소')) {
  return new Promise(res => {
    const el = document.createElement('section'); el.className = 'intro ask'; el.id = 'ask';
    el.innerHTML = `<div><p></p><div class="nbtns"><button class="sb" data-close>${no}</button><button class="go" data-ok>${ok}</button></div></div>`;
    el.querySelector('p').textContent = text;
    el.onclick = e => { const b = e.target.closest('button'); if (e.target !== el && !b) return; el.remove(); res(b?.dataset.ok != null); };
    stageEl().append(el);
  });
}

// the windows, top first; each closes with its own close button (so its own code runs)
const TOPS = ['#desk', '#ask', '.tip', '#intro', '#news', '#lvup', '#zoneCard', '#artCard', '#story', '#cmpz', '#lvSheet', '#achSheet', '#share', '#backup', '#mail', '#visit', '#skySheet', '#oddsSheet', '#event', '#prefs', '#help', '#habMenu', '#ret', '#myth', '#grown', '#homeHint', '#n170', '#fmenu', '#friends', '.cdet', '#codex', '#cards', '#store', '#cab', '#nest', '#decor', '#snap'];
const SHUT = '[data-close],[data-shut],[data-done],[data-cancel]';
const shown = el => el && !el.hidden && !el.closest('[hidden]') && !el.closest('.scene.hidden') && !el.closest('[data-lock]'); // 64-A: ui/first.js locks
// 248 B: a window card (.intro.pop: 첫눈 이벤트 · 우편함 · 설정 …) is up: the bubble over an animal or 손님 goes under it (it was drawn on top)
export const cardUp = () => [...document.querySelectorAll('.intro.pop')].some(shown);
export const topWindow = (skip) => { for (const q of TOPS) { if (q === skip) continue; const el = document.querySelector(q); if (shown(el) && el.querySelector(SHUT)) return el; } return null; };
// 264 B ③: a guest's note (도착·선물 띠, 손님의 의뢰) waits while a card or sheet is up (the name card, 둥지, 확인 cards …) and comes after it closes; a minute on: dropped
export const whenClear = (f, t = Date.now()) => topWindow() ? void (Date.now() - t < 60000 && setTimeout(() => whenClear(f, t), 500)) : f();
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
const NOTES = '#news,#event,#ret,#lvup,#zoneCard,#artCard,#grown,#homeHint', CARDS = NOTES + ',.tip'; let upAt = 0, noteAt = 0;
// inbox 102: in any game, a first-time tip waits a minute after the last card (돌아왔어요 · 단짝 · 레벨 …) went: four came in a row on a visit
const noted = () => { if ([...document.querySelectorAll(NOTES)].some(shown)) noteAt = Date.now(); return Date.now() - noteAt < 60e3; };
// 245 ①: nor while the hand is moving: a card that came up the moment a window shut took the next tap (meant for 둥지 / 지도) on its
// dark area and shut again. A card waits HAND ms after the last touch (the poll then shows it once the player stops)
const HAND = 1500; let handAt = 0; addEventListener('pointerdown', () => { handAt = Date.now(); }, { capture: true });
export const resting = () => { if ([...document.querySelectorAll(CARDS)].some(shown)) upAt = Date.now(); return Date.now() - handAt < HAND || !!G.S && G.now() - G.S.since < 600e3 && Date.now() - upAt < 40e3; };
setInterval(() => { noted(); const o = tipEl && topWindow('.tip'); if (tipEl && (!shown(tipFor) || o && !o.contains(tipFor))) { waiting.unshift({ k: tipEl.dataset.k, anchor: tipFor }); tipEl.remove(); tipEl = null; } if (tipEl) dodge(); else if (!resting()) nextTip(); }, 250); // 74: its anchor went away (a window closed without a tap): the tip waits for it again (66-1 r04); 109: or a card came up over it (레벨 5 창): the whole tip, tail too, waits under it
export function tip(k, anchor) { // anchor: an element or a selector; shown once it is on screen and no other tip is up
  if (G.S.flags.tipsOff || G.S.flags['tip_' + k] || waiting.some(w => w.k === k) || tipEl?.dataset.k === k) return;
  if (TUT228 && TUT_SAYS.includes(k) && step181(G.S, G.now())) { G.flag('tip_' + k); return; } // 238 C ③: the tutorial's own step says it, so no tip for it after
  waiting.push({ k, anchor }); nextTip();
}
const TUT_SAYS = ['nest', 'next', 'hatch', 'decor', 'grow']; // 264 B ④ (261 A): grow too, not over the tutorial·the name card (2판: folded, line above); 182 ②: the tutorial points there itself; these tips wait (not dropped: next61 asks once) until it is done or skipped
function nextTip() {
  if (document.body.classList.contains('tut181')) return; // 182 ②: not over the tutorial's bubble
  if (!document.body.classList.contains('building') && document.querySelector('#loading:not([hidden])')) return; // 257 B: not over the loading cover
  if (tipEl || G.S.flags.tipsOff || Date.now() < calm || resting() || document.querySelector('.rate')) return; // 26-11: not while the tap that closed the last one is still landing; 64-A: nor under a band (어때요·이어서 하기)
  const over = topWindow(), el = w => typeof w.anchor === 'string' ? document.querySelector(w.anchor) : w.anchor;
  const wait = noted(), held = TUT181 && step181(G.S, G.now()), i = waiting.findIndex(w => shown(el(w)) && (!over || over.contains(el(w))) && (!wait || over) && !(held && TUT_SAYS.includes(w.k))); if (i < 0) return; // not under another window; 102: a minute after a card only a sheet's own (one the player opened)
  const [{ k, anchor }] = waiting.splice(i, 1), a = typeof anchor === 'string' ? document.querySelector(anchor) : anchor;
  const st = stageEl(), s = window.__stageScale || 1, sr = st.getBoundingClientRect(), r = a.getBoundingClientRect();
  tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.dataset.k = k; tipEl.setAttribute('role', 'status');
  tipEl.innerHTML = $t('<p><b>{0}</b> {1}</p><div><button data-off>안내 끄기</button><button data-close>알겠어요</button></div>', TIPS[k][0], TIPS[k][1]);
  st.append(tipEl);
  const W = st.clientWidth, H = st.clientHeight, cx = (r.left + r.width / 2 - sr.left) / s, top = (r.top - sr.top) / s, bot = (r.bottom - sr.top) / s;
  const w = tipEl.offsetWidth, x = Math.max(12, Math.min(W - 12 - w, cx - w / 2)); tipEl.style.left = x + 'px';
  tipEl.style.setProperty('--ax', Math.max(14, Math.min(w - 14, cx - x)) + 'px');
  // a tall anchor: kept on screen; inbox 40: and off the home bar (--sa-b, style.css)
  if (top > H / 2) { tipEl.style.bottom = `max(calc(8px + var(--sa-b)), ${H - top + 10}px)`; tipEl.classList.add('up'); } else tipEl.style.top = `min(calc(100% - ${tipEl.offsetHeight + 8}px - var(--sa-b)), ${bot + 10}px)`;
  tipFor = a; dodge(); requestAnimationFrame(() => tipEl && dodge()); // 66-1: the nest pill can show in the same step, after it
  tipEl.onclick = e => { const b = e.target.closest('button'); if (b) endTip(b.dataset.off != null); };
}
// inbox 64-A: never over another button (the 「자라기」 tip by 친구들 covered 「부화 시작」): moved past it, away from its anchor;
// again every 250 ms (a button can come up under it later, like 「부화 시작」 over the nest)
let tipFor = null;
function dodge() {
  const a = tipFor, st = stageEl(), s = window.__stageScale || 1, sr = st.getBoundingClientRect(), up = tipEl.classList.contains('up');
  const others = [...(a.closest?.('.scene') || st).querySelectorAll('button, .npill')].filter(b => b !== a && !a.contains?.(b) && !tipEl.contains(b) && shown(b) && b.offsetParent && !b.closest('.scene > section,[role=dialog]')); // its own screen's buttons, not a sheet's
  for (let k = 0; k < 6; k++) {
    const t = { left: sr.left + tipEl.offsetLeft * s, top: sr.top + tipEl.offsetTop * s }; t.right = t.left + tipEl.offsetWidth * s; t.bottom = t.top + tipEl.offsetHeight * s; // 66-1: where it rests, not where its slide-in has it now
    const b = others.map(b => b.getBoundingClientRect()).find(r => r.width && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top); if (!b) break;
    if (up) tipEl.style.bottom = (sr.bottom - b.top) / s + 8 + 'px'; else tipEl.style.top = (b.bottom - sr.top) / s + 8 + 'px';
  }
  if (!toastEl.classList.contains('on')) return; // 66-1: a tip come up under a toast already showing: the toast goes below it
  const tt = sr.top + tipEl.offsetTop * s, tb = tt + tipEl.offsetHeight * s, tl = sr.left + tipEl.offsetLeft * s, tr = tl + tipEl.offsetWidth * s, T = toastEl.getBoundingClientRect();
  if (T.left < tr && T.right > tl && T.top < tb && T.bottom > tt) toastEl.style.top = (tb - sr.top) / s + 6 + 'px';
}
export const redodge = () => { if (tipEl) dodge(); }; // 66-1: a button that just grew under a tip (the nest pill's 「부화 시작」), not up to 250 ms later
function endTip(off) { if (!tipEl) return; const k = tipEl.dataset.k; tipEl.remove(); tipEl = null; calm = Date.now() + 380; upAt = Date.now(); /* 238 C ③ · 239 B ①: the 40 s rest after a tip too, 1판 as well (resting() never saw the tip while it was up, so 3 came in a row) */ G.flag('tip_' + k); if (off) { G.flag('tipsOff'); waiting.length = 0; } setTimeout(nextTip, 400); }
// any tap elsewhere also counts as seen
addEventListener('pointerdown', e => { if (tipEl && !tipEl.contains(e.target)) endTip(false); }, true);
G.on(() => setTimeout(nextTip)); // a tick later: a card opened in the same step (level.js flags lvCard before it shows the card) is up first, so the tip waits instead of covering it
export function resetTips() { for (const k in TIPS) G.flag('tip_' + k, false); G.flag('tipsOff', false); }
