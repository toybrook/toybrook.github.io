// 16-2 특별한 하늘 (the rules: game/sky.js; drawn: habitat/skyfx.js). This file: what the habitat draws tonight (skyNow), the
// 「하늘 보기」 pill by night (or under a double rainbow) and the low camera it opens, what counts as seen (each first one fills a
// 하늘 기록 slot, ♥), the falling stars caught (별 조각), (74: no pill, no telescope; the sky counts as seen in the habitat
// itself; last night's again from 돌아왔어요), the 하늘 기록 sheet (도감's bottom row) with the odds, the line on the 돌아왔어요 card, and a confirmed
// night said once a day (a real peak or the 놓침 보장; a random sky is never said ahead). Nothing leaves the device.
import * as G from '../game/game.js';
import * as K from '../game/sky.js';
import { BALANCE as B } from '../game/data.js';
import { HOUR, VIEW, DEBUG } from '../config.js';
import { toast, josa, topWindow, overlayOpen, resting } from './hud.js';
import { sfx } from './sound.js';

const $ = id => document.getElementById(id), bar = $('skyBar'), box = $('skySheet');
const KEY = 'toyhabitat.sky'; // the photos of the 하늘 기록 (small JPEGs, kept out of the save)
let A = () => null, cur = () => null, on = false, over = null, seenAt = 0, quiet = 0; // over: a replay / preview { T, n, until }
const hour = () => HOUR != null ? ((HOUR % 24) + 24) % 24 : new Date(G.now()).getHours();
const pct = v => `${Math.round(v * 100)}%`;
const photos = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const busy = () => !box.hidden || topWindow() || overlayOpen() || document.body.classList.contains('photo') || document.hidden || resting();

// for the habitat (once a second): tonight's sky, as skyfx reads it ({ ev: its events may show, meteor, aurora, comet, moon, full, star, bow2 })
const view = (T, ev) => ({ n: T.n, ev, meteor: !!T.meteor, aurora: T.aurora, comet: T.comet, moon: T.moon, full: T.full, star: T.star.id, bow2: false });
export function skyNow(hab) {
  if (!G.S) return null;
  if (over) return over.v;
  const T = G.skyTonight(hab);
  return { ...view(T, K.skyTime(hour())), bow2: K.bow2(T.n, hab), ...DEBUG && window.__sky }; // tests and shots: window.__sky = { ev, aurora, meteor... }
}
// what is on screen now (the slots it fills): the events only in their hours, the double rainbow only by day
function shown() {
  const a = A(), h = cur(); if (!a || !h) return null;
  if (over) return over.n == null ? null : { n: over.n, slots: K.slotsOf(over.T) };
  const T = G.skyTonight(h), s = a.skyState(), ev = K.skyTime(hour());
  if (s.night < 0.5) return s.bow > 0.3 && K.bow2(T.n, h) ? { n: T.n, slots: ['bow2'] } : null;
  return { n: T.n, slots: K.slotsOf(ev ? T : { ...T, meteor: null, aurora: null, comet: null }) };
}
const names = T => [T.aurora && K.AURORAS.find(x => x.id === T.aurora).name, T.meteor && T.meteor.name + ' 유성우', T.comet && '혜성'].filter(Boolean);
const slotName = k => K.SLOTS.find(s => s.id === k).name;
function seen() {
  const w = shown(); if (!w || !w.slots.length) return;
  const r = G.skySeen(w.n, w.slots); if (!r?.fresh.length) return;
  sfx('grown'); toast(`하늘 기록 · ${r.fresh.map(slotName).join(', ')} ♥${r.hearts}`, 3000);
}
function barText() {
  const h = cur(), T = over ? over.T : G.skyTonight(h), ev = over ? over.v.ev : K.skyTime(hour()), s = A()?.skyState();
  if (!over && s && s.night < 0.5) return `<b>쌍무지개</b><span>비 갠 하늘에 무지개가 두 겹 떴어요</span>`;
  const ev2 = ev ? names(T) : [], what = [...ev2, K.moonName(T.n), `${T.star.season} 별자리 ${T.star.name}`];
  return `<b>${over ? (over.n == null ? '오늘 밤 하늘 미리 보기' : '어젯밤 하늘') : '오늘 밤 하늘'}</b><span>${what.join(' · ')}</span>${ev && T.meteor ? '<small>별똥별을 눌러 봐요</small>' : ''}`;
}
// 하늘 보기: the camera low, the HUD away, the bar with what is up
function enter(o = null) {
  const a = A(); if (!a || on && !o) return;
  over = o; if (o) { VIEW.hour = 22; VIEW.weather = 'clear'; }
  on = true; seenAt = performance.now() + 1800; a.skyView(true); document.body.classList.add('skyview');
  bar.innerHTML = `<div class="sktx">${barText()}</div><div class="skb"><button class="back" data-rec>하늘 기록</button><button class="back" data-shot>사진</button><button class="back" data-out>돌아가기</button></div>`;
  bar.hidden = false;
}
function exit() {
  if (!on) return; on = false; document.body.classList.remove('skyview'); bar.hidden = true;
  if (over) { over = null; VIEW.hour = VIEW.weather = null; }
  A()?.skyView(false);
}
// last night again (the 돌아왔어요 card): its own roll for the meadow, events on
function replay(n = K.nightNo(G.now()) - 1) { const T = G.skyTonight('meadow', n); exit(); enter({ T, n, v: view(T, true), until: performance.now() + 25e3 }); }
// 하늘 기록: the 18 slots (a photo where one was taken), the 별 조각, the odds
export function skyRecord() {
  const S = G.S.sky, P = B.sky, ph = photos(), md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  box.innerHTML = `<div><h2>하늘 기록 <small>${Object.keys(S.got).length}/${K.SLOTS.length}</small></h2>
<ul class="skrec">${K.SLOTS.map(s => `<li class="${S.got[s.id] ? 'got' : ''}">${ph[s.id] ? `<img src="${ph[s.id]}" alt="">` : `<i aria-hidden="true">${S.got[s.id] ? s.icon : '?'}</i>`}<span>${s.name}${S.got[s.id] ? `<small>${md(S.got[s.id])}</small>` : ''}</span></li>`).join('')}</ul>
<p class="sub">처음 본 하늘마다 ♥${P.first} · 밤이면 서식지 위로 떠요</p>
<b class="vhd">하늘 확률 (가안)</b><table class="skodds"><tr><td>유성우</td><td>밤마다 ${pct(P.meteor)} · 실제 극대일 밤엔 꼭</td></tr><tr><td>오로라</td><td>${pct(P.aurora)} · 설원 ${pct(P.auroraSnow)} · 그중 붉은 오로라 ${pct(P.red)}</td></tr>
<tr><td>혜성</td><td>${pct(P.comet)}</td></tr><tr><td>쌍무지개</td><td>비 갠 낮 무지개의 ${pct(P.bow2)}</td></tr><tr><td>보름달</td><td>실제 보름</td></tr><tr><td>별자리</td><td>맑은 밤 늘 · 계절마다 하나</td></tr>
<tr><td>놓침 보장</td><td>유성우·오로라를 ${P.miss}일 못 보면 다음 밤엔 꼭</td></tr></table>
<p class="note">밤은 저녁 6시부터 새벽 5시까지예요 · 유성우·오로라는 서식지마다 따로 굴려요</p>
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  box.hidden = false;
}
// a falling star caught (habitat.js)
export function onStar() { G.skyBit(); toast('별똥별 ✦', 1200, true); } // 74: 별 조각 hidden (still counted in the save)
// 사진 모드's save (photo.js): in 하늘 보기, the photo goes into the slots on screen -> how many
export function skyPhoto(c) {
  const w = on && shown(); if (!w) return 0;
  const k = w.slots.filter(s => G.S.sky.got[s]); if (!k.length) return 0;
  const t = document.createElement('canvas'), d = Math.min(c.width, c.height); t.width = t.height = 96; // a square from the sky part (the top), not the middle
  t.getContext('2d').drawImage(c, (c.width - d) / 2, Math.min(c.height - d, c.height * 0.08), d, d, 0, 0, 96, 96);
  const p = photos(), u = t.toDataURL('image/jpeg', 0.7); for (const x of k) p[x] = u;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { return 0; } return k.length;
}
// the 돌아왔어요 card (main.js): last night had an aurora, a shower or a comet not seen -> its line (once)
export function retSky() {
  const S = G.S, n = K.nightNo(G.now()) - 1; if (!S || S.sky.ret === n || S.sky.nights.includes(n) || n < K.nightNo(S.since)) return null;
  const was = names(G.skyTonight('meadow', n)); if (!was.length) return null;
  const t = was.join('·'); return { n, text: `어젯밤 ${t}${josa(t, '이', '가')} 떴어요` };
}
export const retShown = n => G.skyMark('ret', n);
export const retGo = () => setTimeout(() => replay(), 600);

bar.onclick = e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.out != null) return exit();
  if (d.rec != null) return skyRecord();
  if (d.shot != null) $('snapBtn').click();
};
box.onclick = e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  box.hidden = true;
};

setInterval(() => {
  const a = A(), h = cur(), S = G.S; if (!S) return;
  if (on && (!a || !h || !a.skyOn())) { exit(); return; }
  if (on) {
    if (over) { if (!document.body.classList.contains('photo')) VIEW.hour = 22; if (topWindow()) over.until += 1000; if (performance.now() > over.until && box.hidden && !document.body.classList.contains('photo')) exit(); }
    const tx = bar.querySelector('.sktx'); if (tx && !over) tx.innerHTML = barText();
  }
  if (h && (on || !busy()) && performance.now() > seenAt) { seenAt = performance.now() + 5000; seen(); } // 74: seen in the habitat too (no 하늘 보기 button)
  if (!h || on || busy()) { quiet = 0; return; }
  if ((quiet += 1000) < 2000) return;
  const n = K.nightNo(G.now());
  // 74: the 하늘 망원경 is no longer given (one placed in an old save stays, a prop)
  // a sure night, said once a day (from the morning; random ones never)
  const T = G.skyTonight(h); if (T.sure && S.sky.told !== n && hour() >= 5) { G.skyMark('told', n); toast(T.peak ? `오늘 밤은 ${T.meteor.name} 유성우 극대일이에요 · 밤에 하늘을 올려다봐요` : '오늘 밤엔 유성우나 오로라가 꼭 와요 · 밤에 하늘을 올려다봐요', 3600); }
}, 1000);
export function initSky(getApi, getHab) { A = getApi; cur = getHab; }
