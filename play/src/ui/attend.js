// inbox 41 C 출석부: once a day (dayOf) a card with the 7 slots; 받기 (or the dark area, Escape, back) takes today's one.
// It waits like 27-7c for a quiet screen (no window, sheet, loading or photo, the tab shown), then 1.6 s more, so it never
// covers 자리 비운 사이, a level card or a grown card; those wait for it in turn (TOPS, play.js busy, main.js away).
// The rules (one a day, none on a clock turned back, the 7th's prop in turn) are in rules.js attend.
import * as G from '../game/game.js';
import { PROP, HAB, firstEgg } from '../game/rules.js';
import { ATTEND, ATTEND_PROPS, GIFT } from '../game/data.js';
import { topWindow, overlayOpen, resting, toast } from './hud.js';
import { sfx } from './sound.js';
import { track } from './stats.js';

const $ = id => document.getElementById(id), box = $('attend'), L = ATTEND.length;
let at = () => null, done = () => {}, quiet = 0;
const cell = r => [r.hearts && `♥${r.hearts}`, r.candy && `사탕 ${r.candy}`, r.eggs && `알 ${r.eggs}`].filter(Boolean).join(' ');
const icon = r => r.eggs ? '🥚' : r.candy ? '🍬' : '💗';
// k: slots stamped in this round of 7; today: the one to take (-1 once taken)
function grid(k, today) {
  const P = PROP[ATTEND_PROPS[Math.floor((G.S.attend.n - (today < 0 ? 1 : 0)) / L) % ATTEND_PROPS.length]];
  return `<ol class="att">${ATTEND.map((r, i) => `<li class="${i < k ? 'done' : ''}${i === today ? ' today' : ''}${i === L - 1 ? ' last' : ''}"><b>${i + 1}일</b><i aria-hidden="true">${i === L - 1 ? '🎁' : icon(r)}</i><small>${cell(r)}${i === L - 1 ? ` + ${P.name}` : ''}</small></li>`).join('')}</ol>`;
}
function draw() {
  const k = G.S.attend.n % L;
  box.innerHTML = `<div><h2>출석부</h2><p class="note">하루에 한 칸 · 빠진 날이 있어도 이어서 찍어요</p>${grid(k, k)}
<div class="nbtns"><button class="go" data-close>오늘 칸 받기</button></div></div>`;
  box.dataset.step = 'slots';
}
const gotText = got => { const P = PROP[got.prop]; return [got.hearts && `♥${got.hearts}`, got.candy && `꼬마 사탕 ${got.candy}개`, got.eggs && `둥지 알 ${got.eggs}개`, P && `소품 「${P.name}」`].filter(Boolean).join(' · ') || '♥0'; };
function show(got) {
  const P = PROP[got.prop], hab = P && G.S.props.findLast(p => p.prop === P.id)?.hab, what = gotText(got);
  box.innerHTML = `<div><h2>${got.slot}일째 출석</h2>${grid((G.S.attend.n - 1) % L + 1, -1)}<p class="note got">${what}</p>${
    got.extra ? `<p class="note">둥지가 가득 차서 알 ${got.extra}개는 ♥${got.extra * GIFT.eggHearts}로 바꿨어요</p>` : ''}${
    P && HAB[hab] ? `<p class="note">${HAB[hab].name} 꾸미기 › 선물에 넣어 뒀어요</p>` : ''}
<div class="nbtns"><button class="go" data-close>좋아요</button></div></div>`;
  box.dataset.step = 'got'; sfx('grown');
}
box.onclick = e => {
  if (!e.target.closest('[data-close]')) return;
  const out = box.dataset.step === 'slots' && G.attend(at());
  if (out) { track('attend', { day: G.S.attend.n }); return show(out.got); }
  box.hidden = true; done();
};
const busy = () => firstEgg(G.S) || G.S.guests?.tut >= 0 || G.now() - G.S.since < 300e3 || topWindow() || overlayOpen() || !$('loading').hidden && !$('loading').closest('.scene.hidden') || $('tabOff') || document.body.classList.contains('photo') || document.hidden || !at() || resting(); // inbox 61 B: after the first egg; 66-1: after the guest tutorial; inbox 43: only inside a habitat, never on the map; one card at a time
setInterval(() => {
  if (!G.attendDue() || busy()) { quiet = 0; return; }
  if ((quiet += 800) < 1600) return;
  quiet = 0; const t = takeToday(at()); if (t) toast(`${G.S.attend.n}일째 출석 · ${t}`, 2800); // 74: one line, no card (a day back: a row of 돌아왔어요)
}, 800);
// cur: the habitat on screen (a 7th-day prop goes there); after: called when the card closes (main.js firstDone)
export function initAttend(cur, after) { at = cur; done = after; }
// inbox 58: on a day back, 돌아왔어요 (main.js) shows today's slot as one of its rows and takes it there; this card then has nothing to show
export const todayRow = () => { const n = G.S.attend.n, k = n % L; return [k + 1, cell(ATTEND[k]) + (k === L - 1 ? ` + ${PROP[ATTEND_PROPS[Math.floor(n / L) % ATTEND_PROPS.length]].name}` : '')]; };
export function takeToday(where) {
  const out = G.attend(where); if (!out) return null;
  track('attend', { day: G.S.attend.n }); sfx('grown');
  const { got } = out, P = PROP[got.prop], hab = P && G.S.props.findLast(p => p.prop === P.id)?.hab;
  return gotText(got) + (got.extra ? ` · 가득 찬 둥지 대신 ♥${got.extra * GIFT.eggHearts}` : '') + (P && HAB[hab] ? ` · ${HAB[hab].name} 꾸미기 › 선물에` : '');
}
