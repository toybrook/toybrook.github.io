// 236 B (?tut228, docs/design/tutorial-2.md, reports/236b.md): the 이정표 줄 (what to do, the first day's 8 dots), the 칭찬 칩, the
// 이정표 판 (FIRST's hatch · prop · photo + FIRST2's rows, rules f2Rows) and its 「같이 해 볼까요?」 card, the words of every cell (3장:
// A · small · B after 9 s · the line) and the guides past the first day (yard · req · swap · photo · egg · prop · pill). tut181.js imports
// this only with TUT228; build-web.mjs leaves the file out. Text in: textContent only (a friend's and a habitat's name come from the
// save); the flag is our own fixed drawing. Nothing three.js is made here.
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import * as R from '../game/rules.js';
import { FIRST, FIRST2, G190, HABITATS } from '../game/data.js';
import { topWindow, clock } from './hud.js';
import { track } from './stats.js';

const $ = id => document.getElementById(id), body = document.body, q = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls }, text != null ? { textContent: text } : {});
const vis = e => !!e && e.getClientRects().length > 0 && !e.closest('[hidden], .hidden');

// ---- the words (3-1 · 3-2 · 3-3): [A, small, B (9 s on), the line]; n: the first friend's name, h: a habitat's
const TX = {
  hatch: () => [$t('바로 부화를 눌러 봐요'), $t('알이 깨는 걸 부화라고 해요'), $t('아래 큰 버튼을 눌러요')],
  hatch_egg: () => [$t('알을 톡 눌러 봐요'), '', $t('반짝이는 알을 눌러요')],
  hatch_wait: () => [$t('곧 알이 깨요'), $t('조금만 기다려요'), '', $t('알이 깨는 중')],
  hatch_card: () => [$t('새 동물을 서식지로 보내요'), '', $t('아래 큰 버튼을 눌러요')],
  name: () => [$t('이름을 지어 줘요'), $t('비워 둬도 괜찮아요'), $t('글자 칸을 눌러 써 봐요')],
  name_save: () => [$t('다 썼으면 저장을 눌러요'), '', $t('아래 저장을 눌러요')],
  pet: n => [$t('{0}{을/를} 톡 눌러요', n), $t('쓰다듬으면 ♥가 생겨요'), $t('반짝이는 동물을 눌러요')],
  pet_off: n => [$t('{0}{이/가} 안 보이나요?', n), $t('위 이정표를 누르면 찾아 줘요'), '', $t('쓰다듬기 · 눌러서 찾기')],
  feed: n => [$t('{0}{을/를} 다시 눌러요', n), $t('먹이 버튼이 나와요'), $t('반짝이는 동물을 눌러요')],
  feed_btn: () => [$t('먹이를 한 번 줘 봐요'), $t('먹으면 쑥쑥 자라요'), $t('먹이 버튼을 눌러요')],
  d_open: () => [$t('받은 소품을 놓아 봐요'), $t('꾸미기 버튼을 눌러요'), $t('아래 꾸미기를 눌러요')],
  d_pick: () => [$t('선물 받은 소품을 눌러요'), '', $t('반짝이는 그림을 눌러요')],
  d_pick2: () => [$t('소품을 하나 골라요'), '', $t('반짝이는 그림을 눌러요')],
  d_drag: () => [$t('끌어서 자리를 옮겨요'), $t('빛나는 자리에 놓을 수 있어요'), $t('빛나는 자리를 눌러도 돼요')],
  d_red: () => [$t('여기는 못 놓아요'), $t('초록이 되게 옮겨요'), ''],
  d_turn: () => [$t('돌리기로 방향을 바꿔요'), '', $t('⟳ 버튼을 한 번 눌러요')],
  d_put: () => [$t('마음에 들면 놓기!'), '', $t('놓기 버튼을 눌러요')],
  d_move: () => [$t('놓은 소품도 옮길 수 있어요'), $t('소품을 톡 눌러 봐요'), $t('방금 놓은 소품을 눌러요')],
  d_move2: () => [$t('옮겼으면 다시 놓기!'), '', $t('놓기 버튼을 눌러요')],
  d_done: () => [$t('다 됐으면 완료!'), '', $t('위의 완료를 눌러요')],
  codex: () => [$t('도감을 열어 봐요'), $t('만난 동물이 모이는 책이에요'), $t('도감 버튼을 눌러요')],
  codex_cell: n => [$t('{0}의 칸을 눌러 봐요', n), '', $t('반짝이는 칸을 눌러요')],
  codex_shut: () => [$t('다 봤으면 닫아요'), '', $t('닫기 버튼을 눌러요')],
  codex_close: () => [$t('도감도 닫아요'), '', $t('위의 닫기를 눌러요')],
  nest_open: () => [$t('둥지를 열어 봐요'), $t('둥지는 알이 깨는 곳이에요'), $t('둥지 버튼을 눌러요')],
  nest_egg: () => [$t('알을 눌러 둥지에 넣어요'), '', $t('반짝이는 알을 눌러요')],
  nest_wait: () => [$t('깨는 동안 놀아 줘요'), $t('남은 시간은 위에 보여요'), '', $t('알이 깨는 중')],
  nest_ready: () => [$t('알이 다 됐어요!'), $t('톡 눌러 부화해요'), $t('반짝이는 알을 눌러요'), $t('알 부화하기')],
  nest_card: () => [$t('새 동물을 서식지로 보내요'), '', $t('아래 큰 버튼을 눌러요'), $t('알 부화하기')],
  end_card: () => [$t('새 동물을 서식지로 보내요'), $t('보내면 첫날 선물이 와요'), $t('아래 큰 버튼을 눌러요')],
  pill: () => [$t('다음 할 일은 여기 있어요'), $t('이정표를 눌러 봐요'), $t('위의 깃발 줄을 눌러요'), $t('이정표')],
  map1: (n, h) => [$t('{0}{이/가} 열렸어요!', h), $t('먼저 지도로 나가요'), $t('왼쪽 위 버튼을 눌러요'), $t('{0} 가 보기', h)],
  map2: (n, h) => [$t('지도에서 {0}{을/를} 눌러요', h), '', $t('반짝이는 땅을 눌러요'), $t('{0} 가 보기', h)],
  aff: () => [$t('자주 놀아 주면 친해져요'), $t('친한 만큼 친밀도가 올라요'), '', $t('친밀도')],
  yard1: () => [$t('먼저 지도로 나가요'), $t('왼쪽 위 버튼을 눌러요'), $t('반짝이는 버튼을 눌러요'), $t('나의 뜰 가 보기 1/3')],
  yard2: () => [$t('지도에서 나의 뜰을 눌러요'), '', $t('반짝이는 땅을 눌러요'), $t('나의 뜰 가 보기 2/3')],
  yard_in: () => [$t('소품을 하나 놓아 봐요'), $t('마음대로 꾸미는 빈 땅이에요'), $t('아래 꾸미기를 눌러요'), $t('나의 뜰')],
  ser1: () => [$t('시리즈를 열어 봐요'), $t('시리즈는 모으는 세트예요'), $t('시리즈 버튼을 눌러요'), $t('시리즈 1/2')],
  ser2: () => [$t('알에서 나오면 칸이 차요'), $t('다 봤으면 닫아요'), $t('위의 닫기를 눌러요'), $t('시리즈 2/2')],
  req1: () => [$t('의뢰를 열어 봐요'), $t('의뢰는 손님의 부탁이에요'), $t('의뢰 글자를 눌러요'), $t('의뢰 1/3')],
  req2: () => [$t('사진으로 보여 줘요'), $t('찍으러 가기를 눌러요'), $t('반짝이는 버튼을 눌러요'), $t('의뢰 2/3')],
  req_close: () => [$t('바라는 것을 살펴봐요'), $t('다 봤으면 닫아요'), $t('위의 닫기를 눌러요'), $t('의뢰 2/3')],
  req3: () => [$t('의뢰 사진 보내기를 눌러요'), '', $t('반짝이는 버튼을 눌러요'), $t('의뢰 3/3')],
  req_miss: () => [$t('바라는 것이 다 보여야 해요'), $t('나가서 꾸민 뒤 다시 찍어요'), $t('나가기를 눌러요'), $t('의뢰 3/3')], // E-19
  photo1: () => [$t('사진을 찍어 봐요'), $t('먼저 꾸미기를 눌러요'), $t('아래 꾸미기를 눌러요'), $t('사진 한 장 찍기 1/3')],
  d_snap: () => [$t('사진을 눌러요'), '', $t('반짝이는 버튼을 눌러요'), $t('사진 한 장 찍기 2/3')],
  d_more: () => [$t('더보기를 눌러요'), $t('사진은 더보기 안에 있어요'), $t('반짝이는 버튼을 눌러요'), $t('사진 한 장 찍기 2/3')], // 검토 4: not 자리 모드
  photo3: () => [$t('마음에 들면 저장!'), '', $t('저장 버튼을 눌러요'), $t('사진 한 장 찍기 3/3')],
  swap0: () => [$t('시리즈를 열어 봐요'), '', $t('시리즈 버튼을 눌러요'), $t('교환 토큰')],
  swap1: () => [$t('남는 동물은 분해해 봐요'), $t('분해하면 토큰이 돼요'), $t('분해 버튼을 눌러요'), $t('교환 토큰')],
  swap2: () => [$t('토큰으로 빈 칸을 채워요'), $t('교환을 누르면 알이 와요'), $t('교환 버튼을 눌러요'), $t('교환 토큰')],
  m_egg: () => [$t('알은 조금 뒤에 또 와요'), $t('그동안 다른 이정표를 해 봐요'), ''], // E-19: and the line's 다음 moves on (held)
  guest: () => [$t('손님이 오고 있어요…'), $t('조금만 기다려요'), ''], // E-19: tut181's 12 s pause for a guest
  m_full: () => [$t('부화 칸이 가득 찼어요'), $t('그동안 다른 이정표를 해 봐요'), ''],
  m_stamp: () => [$t('토큰이 10개 모이면 돼요'), $t('그동안 다른 이정표를 해 봐요'), ''],
};
export const tx = (c, n, h) => TX[c]?.(n, h) ?? null;
const LINE = { hatch: $t('알 부화하기'), name: $t('이름 짓기'), pet: $t('쓰다듬기'), feed: $t('먹이 주기'), codex: $t('도감 보기'), nest: $t('다음 알 넣기'), end: $t('첫날 선물') };
const ROW = { hatch: $t('알 3개 깨기'), prop: $t('꾸미기 자리에 소품 놓기'), photo: FIRST.tasks.find(t => t.id === 'photo').text, ...Object.fromEntries(FIRST2.tasks.map(t => [t.id, t.text])) };
const GUIDE = { hatch: 'egg', prop: 'prop', yard: 'yard', ser: 'ser', req: 'req', swap: 'swap', photo: 'photo' }, ROWOF = { egg: 'hatch', prop: 'prop', yard: 'yard', ser: 'ser', req: 'req', swap: 'swap', photo: 'photo' };
// the line: a cell's own, else the step's (꾸미기 n/7), else the guide's row
export function line(o, T) { return T?.[3] || (o.sub ? $t('꾸미기 {0}/{1}', o.di + 1, o.dn) : LINE[o.key] ?? ROW[ROWOF[o.late]] ?? ''); }
const PRAISE = { name: $t('좋은 이름이에요!'), feed: $t('맛있게 먹었어요!'), decor: $t('예쁘게 꾸몄어요!'), end: $t('다 배웠어요!') };
// 8장: time in the step (s, the bucket under), re-guides (B lines), decor's longest cell
export function meas(ms, r, dc) {
  const s = ms / 1e3, o = { d: [5, 10, 20, 40, 90].find(x => s < x) ?? '90+', r: r >= 3 ? '3+' : r };
  if (dc) { const c = Object.entries(dc).sort((a, b) => b[1] - a[1])[0]; if (c) o.c = c[0]; }
  return o;
}

// ---- the board (4장)
const rows = () => R.f2Rows(G190), got = S => rows().filter(id => R.f2Done(S, id)).length;
export const live = S => !!S?.first?.f2 && !S.first['f2:all'];
export let asked = null; // the guide 「같이 가요」 picked: tut181 runs it next
const held = {}; // E-19: row → till when the line's 다음 skips it (its guide could not go on: no egg to put in or the slots full: ser·hatch; a request photo short of a wish: req; too few stamps: swap)
// 258 B Q2: ser·hatch till the nest's real next egg (or the first slot's hatch when they are full); what cannot be read, and req·swap: 2 min
const hold = (ids, u) => { const t = G.now(), v = Number.isFinite(u) && u > t ? u : t + 120e3; for (const id of ids) held[id] = v; };
const EGGROW = ['ser', 'hatch'], waits = id => G.now() < (held[id] ?? 0);
export const nextRow = S => rows().find(id => !R.f2Done(S, id) && !waits(id)); // all that is left waits: no 「다음」, the count only (was the same 4 s words again and again)
let hooks = { wake() {}, poke() {} }, last = null, inPill = '', chipT = 0, ph = [], phT = 0, gm = {};
const pill = el('button', 't2pill'), flg = el('i', 't2flag'), lab = el('span', 't2lab'), sm = el('small', 't2sm'), dots = el('span', 't2dots');
const chipE = el('div', 't2chip'), board = el('div', 't2board'), ask = el('div', 't2ask');
pill.type = 'button'; pill.hidden = chipE.hidden = board.hidden = ask.hidden = true;
flg.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 1.5v13" stroke="#4a3626" stroke-width="1.8" stroke-linecap="round"/><path d="M4.4 2.2h8.4l-2.3 3 2.3 3H4.4z" fill="#e9a23b" stroke="#4a3626" stroke-width="1.2" stroke-linejoin="round"/></svg>';
pill.append(flg, lab, sm, dots);
const under = e => { e.style.top = (pill.hidden ? 0 : Math.round(pill.getBoundingClientRect().bottom + 6)) + 'px'; e.classList.toggle('free', pill.hidden); };
export const below = () => pill.hidden ? 70 : Math.round(pill.getBoundingClientRect().bottom + 8); // the bubble with nothing to point at
export const pillEl = () => pill;

export function init(h) {
  hooks = h; if (pill.isConnected) return;
  body.append(pill, chipE, board, ask);
  setInterval(() => { if (!last) draw(null); tags(); }, 1000); // tut181 stopped: the board's line alone
  addEventListener('pointerdown', e => { if (!board.hidden && !e.target.closest('.t2pill, .t2board, .t2ask')) board.hidden = ask.hidden = true; }, true);
  G.on(ev => { for (const e of ev) {
    if (e.type === 'first' && body.classList.contains('t2lead')) { ph.push(e); clearTimeout(phT); phT = setTimeout(flush, 600); } // first.js leaves these to the chip
    else if (e.type === 'first2') { chip(`${e.id === 'yard' ? $t('여기는 나의 뜰이에요') : ROW[e.id]} ♥+${e.hearts}`); track('goal_done', { g: e.id }, 'goal:' + e.id); }
    else if (e.type === 'first2All') allDone(e.hearts);
  } });
}
pill.onclick = () => {
  if (!G.S.flags.tutPill) G.flag('tutPill', 1);
  if (last?.key || last?.late && last.late !== 'pill') { hooks.poke(); flash(); return; } // a step or a guide on: show me again (2장 18 s now)
  if (!board.hidden) { board.hidden = ask.hidden = true; return; }
  if (live(G.S)) openBoard();
};
function openBoard() {
  const S = G.S; board.textContent = ''; ask.hidden = true;
  board.append(el('b', '', `${$t('이정표')} ${got(S)}/${rows().length}`));
  for (const id of rows()) { const d = R.f2Done(S, id), b = el('button', 't2row' + (d ? ' ok' : '')), i = el('i', '', d ? '✓' : '');
    const sp = el('span', '', ROW[id]); if (EGGROW.includes(id)) { const w = el('small', 't2wait'); w.dataset.id = id; sp.append(w); } // 258 B Q1
    b.type = 'button'; b.disabled = d; b.append(i, sp); b.onclick = e => askFor(id, e); board.append(b); }
  board.append(el('small', '', $t('하나를 누르면 같이 가 줘요')), el('small', '', $t('다 하면 작은 선물이 있어요')));
  board.hidden = false; tags(); under(board);
}
function tags() { // 258 B Q1: all that is left waits: the egg rows say how long (each second, with the board up)
  if (board.hidden) return; const S = G.S, all = !nextRow(S), t = G.now();
  for (const s of board.querySelectorAll('.t2wait')) { const u = held[s.dataset.id] ?? 0, w = all && !R.f2Done(S, s.dataset.id) && t < u ? $t('알 기다리는 중 · {0}', clock(u - t)) : ''; if (s.textContent !== w) s.textContent = w; }
}
function askFor(id, ev) {
  ask.textContent = ''; const no = el('button', 'sb', $t('혼자 할게요')), go = el('button', 'go', $t('같이 가요')), row = el('div', 't2btns');
  no.type = go.type = 'button'; row.append(no, go); ask.append(el('b', '', ROW[id]), el('p', '', $t('같이 해 볼까요?')), row);
  no.onclick = () => { ask.hidden = true; };
  go.onclick = () => { ask.hidden = board.hidden = true; asked = GUIDE[id]; track('goal_go', { g: id }, 'goal_go'); hooks.wake(); };
  for (const r of board.querySelectorAll('.t2row')) r.classList.toggle('sel', r.contains(ev?.currentTarget ?? null));
  ask.hidden = false; const b = board.getBoundingClientRect(); // 238 C ②: under the board, not over its rows (up from the bottom bar if it is too long)
  ask.style.top = Math.round(Math.min(b.bottom + 8, innerHeight - ask.offsetHeight - 96)) + 'px';
}
let fin = false; // E-19: the all-done card is up (the line is gone by then: draw leaves it be)
function allDone(h) { // E-19: the last row done: a card says so and what is left to do (was a chip, then nothing on screen)
  if (body.classList.contains('photo')) { setTimeout(() => allDone(h), 500); return; } // the photo row last: after the photo mode
  fin = true; ask.textContent = ''; const go = el('button', 'go', $t('좋아요')), row = el('div', 't2btns'); go.type = 'button'; row.append(go);
  ask.append(el('b', '', `${$t('이정표를 다 마쳤어요!')} ♥+${h}`), el('p', '', $t('이제 마음대로 놀아요')), el('p', '', $t('알이 오면 둥지에 넣고, 꾸미기로 서식지를 꾸며요')), row);
  go.onclick = () => { ask.hidden = true; fin = false; }; board.hidden = true; ask.hidden = false; ask.style.top = Math.round(innerHeight * 0.3) + 'px';
}
export function flash() { pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash'); }

// ---- the chip (7-1): under the line 1.6 s; with a friend's bubble open, inside the line instead (1장)
export function chip(text, ms = 1600) {
  clearTimeout(chipT);
  if (vis($('bubble')) && !pill.hidden) { inPill = text; chipE.hidden = true; chipT = setTimeout(() => { inPill = ''; }, ms); return; }
  inPill = ''; chipE.textContent = text; chipE.hidden = false; under(chipE); chipT = setTimeout(() => { chipE.hidden = true; }, ms);
  const T = $('toast'); // 238 C ①: a toast already there: the chip goes under it (hud.js toast does the other way round) · 239 B ②: the photo mode's panel the same
  for (const o of [T?.classList.contains('on') && T, vis($('snap')) && $('snap')]) {
    const r = o && o.getBoundingClientRect(), c = chipE.getBoundingClientRect();
    if (r && r.top < c.bottom && r.bottom > c.top) { chipE.classList.remove('free'); chipE.style.top = Math.round(r.bottom + 6) + 'px'; }
  }
}
const take = () => { clearTimeout(phT); const h = ph.reduce((n, e) => n + e.hearts, 0); ph = []; return h; };
function flush() { // 첫날 할 일 ♥ with no step's praise to ride on (it waits while a window hides the line)
  if (pill.hidden && body.classList.contains('t2lead')) { phT = setTimeout(flush, 600); return; }
  const one = ph.length === 1 ? FIRST.tasks.find(t => t.id === ph[0].id)?.text : '', h = take(); if (h) chip(one ? `${one} ♥+${h}` : `♥+${h}`);
}
export function praise(step, n) { const h = n + take(); chip(`${PRAISE[step] ?? $t('잘했어요!')}${h ? ' ♥+' + h : ''}`); }

// ---- the line, every tick (o: tut181's step · cell · guide, null when it is stopped)
export function draw(o) {
  last = o; const S = G.S; if (!S) return;
  const W = topWindow(), lead = !!(o?.key || o?.late), on = lead || live(S) && R.f2On(S, G.now()), mini = !on && live(S); // Q3 나: past its days, a small flag till done
  body.classList.toggle('t2lead', on);
  pill.hidden = !(on || mini) || document.hidden || body.classList.contains('photo') || !!W && !W.matches('#nest, #decor, .tip, #n170'); // a window over the screen: its own head stays clear
  pill.classList.toggle('mini', mini);
  if (pill.hidden) { board.hidden = true; ask.hidden ||= !fin; return; }
  const tp = q('.tip'); let py = ''; if (vis(tp)) { pill.style.top = ''; const a = pill.getBoundingClientRect(), b = tp.getBoundingClientRect(); if (b.top < a.bottom && b.bottom > a.top) py = Math.round(b.bottom + 8) + 'px'; } // 258 B 추가: a hud tip card (자라기 …) up top: the line under it, not on its lines
  if (pill.style.top !== py) pill.style.top = py;
  const next = nextRow(S), t = lead ? o.line : mini ? '' : next ? $t('다음: {0}', ROW[next]) : '';
  if (lab.textContent !== t) { lab.textContent = t; pill.classList.remove('turn'); void pill.offsetWidth; pill.classList.add('turn'); }
  sm.textContent = inPill || (o?.key ? '' : `${got(S)}/${rows().length}`);
  const n = o?.key ? R.STEPS181.length : 0, at = o?.key ? R.STEPS181.indexOf(o.key) : -1;
  if (dots.childElementCount !== n || dots.dataset.at !== String(at)) { dots.textContent = ''; dots.dataset.at = at; for (let i = 0; i < n; i++) dots.append(el('i', i < at ? 'on' : i === at ? 'now' : '')); }
  if (!board.hidden) { tags(); under(board); }
  if (!chipE.hidden && chipE.getBoundingClientRect().top < pill.getBoundingClientRect().bottom) under(chipE); // 258 B: the line grew or went under a tip after the chip came: the chip follows (only when the line sits on it: a chip under a toast stays there)
}

// ---- which guide next (6장): the first day's last cell (the line), one 「같이 가요」 asked, then a new thing opened (two a day)
const SEEN = { pill: 'tutPill', map: 'tutMap', aff: 'tutAff', ser: 'tutSer', req: 'tutReq', yard: 'tutYard', brk: 'tutBrk', swap: 'tutSwap' };
export const left2 = S => !S.flags.tutYard && S.unlocked.includes('yard') || live(S) && !S.flags.tutPill || G190 && (!S.flags.tutBrk || !S.flags.tutSwap);
const today = S => { const [d, n] = String(S.flags.tg228 || '').split(':'); return d === String(G.dayOf(G.now())) ? +n || 0 : 0; };
export function pick(S, cand, cur) {
  if (!S.flags.tutPill && live(S) && S.flags.tut181 === 'done') return 'pill';
  if (asked) return asked;
  if (S.flags.tut181 === 'skip') return null; // skipped: only what is asked (8장)
  const c = { ...cand, yard: cur === 'yard' && !S.flags.tutYard, brk: G190 && !S.flags.tutBrk && vis(q('[data-brk]')), swap: G190 && !S.flags.tutSwap && vis(q('#ser .sswap[data-swap]:not([disabled])')) };
  const k = Object.keys(c).find(k => c[k]);
  return k && (today(S) < 2 || S.flags.tour281 === G.dayOf(G.now())) ? k : null; // 281: 둘러보기 picked today: all of them, not two
}
// 281: the guides that would come one by one (tut181 asks 「새 기능 둘러보기 (n)」 first when back with two or more)
export const due = (S, cand) => Object.entries({ pill: !S.flags.tutPill && live(S), ...cand, yard: !S.flags.tutYard && S.unlocked.includes('yard'), brk: G190 && !S.flags.tutBrk, swap: G190 && !S.flags.tutSwap }).filter(([, v]) => v).map(([k]) => SEEN[k]);
export function begin(k, S) {
  gm = { k, asked: k === asked, req: S.stats.req || 0, swap: S.stats.swap || 0, prop: R.FIRST_V.prop(S), eggs: S.slots.filter(Boolean).length + (S.stats.hatch || 0) };
}
// 검토 7: the day's count (2) is spent when a guide really shows, not when it is picked (map · yard can be done at once)
export function shown(S) { if (gm.cnt || gm.asked || !SEEN[gm.k] || gm.k === 'pill') return; gm.cnt = 1; G.flag('tg228', `${G.dayOf(G.now())}:${today(S) + 1}`); }
export function end(k, n, m) {
  if (SEEN[k]) G.flag(SEEN[k], 1);
  if (gm.asked) { asked = null; return; } // asked: goal_go counted it
  if (SEEN[k] && k !== 'brk' && k !== 'pill') track('tut', { s: k, ...n ? { n: 1 } : {}, ...m }, 'tut:' + k); // 8장: yard · swap new (17 kinds at most)
}
const msg = (c, inBox) => { gm.msg ??= G.now(); return G.now() - gm.msg > 4e3 ? { done: 1 } : { t: null, c, wait: 1, inBox }; }; // 238 C: inBox, or the open window hid the words
// a guide's plan, as tut181 lateP: { t | pt, c (the cell), ... } or { done }
export function guide(S, k, cur, api) {
  const D = $('decor'), W = $('ser'), photo = body.classList.contains('photo'), open = vis(W);
  switch (k) {
    case 'pill': return S.flags.tutPill ? { done: 1 } : { t: pill, c: 'pill', fing: 'tap' };
    case 'yard':
      if (cur === 'yard') { if (vis(D)) return { done: 1 }; gm.y = 1; return { t: $('decorBtn'), c: 'yard_in', fing: 'tap' }; }
      if (gm.y || !gm.asked) return { done: 1 };
      return cur ? { t: $('habName'), c: 'yard1', fing: 'tap' } : { t: q('.spot[data-hab="yard"]'), c: 'yard2', fing: 'tap' };
    case 'req': { // Q11: 의뢰 탭 → the card's 찍으러 가기 → 의뢰 사진 보내기
      if ((S.stats.req || 0) > gm.req) return { done: 1 };
      if (photo) { gm.snap = 1; const miss = (q('#snap .smsg')?.textContent || '').startsWith($t('조금 모자라요 · {0}').split('{0}')[0]); // E-19: sent, short of a wish: out to decorate (was 보내기 lit again and again)
        if (miss) hold(['req']);
        return miss ? { t: q('#snap [data-close]'), c: 'req_miss', fing: 'tap', photo: 1 } : { t: q('#snap [data-act="req"]'), c: 'req3', fing: 'tap', photo: 1 }; }
      if (gm.snap) return { done: 1 };
      if (open && q('[data-tab="req"].on', W)) { const s = q('.sreq.on [data-shot]', W); gm.in = s ? 'shot' : 'close'; return s ? { t: s, c: 'req2', fing: 'tap', inBox: W } : { t: q('[data-close]', W), c: 'req_close', fing: 'tap', inBox: W }; }
      if (gm.in === 'shot' && !open) { gm.w ??= G.now(); if (G.now() - gm.w < 2e3) return { wait: 1, none: 1 }; } // the photo mode coming
      if (gm.in && !open) return { done: 1 };
      return { t: open ? q('[data-tab="req"]', W) : $('serBtn'), c: 'req1', fing: 'tap', inBox: open ? W : undefined };
    }
    case 'photo':
      if (photo) { gm.snap = 1; return R.f2Done(S, 'photo') ? { done: 1 } : { t: q('#snap [data-act="save"]'), c: 'photo3', fing: 'tap', photo: 1 }; }
      if (gm.snap) return { done: 1 };
      return vis(D) ? (s => s ? { t: s, c: 'd_snap', fing: 'tap', dec: 1, inBox: D } : { t: q('[data-moretools]', D), c: 'd_more', fing: 'tap', dec: 1, inBox: D })(q('[data-snap]', D)) : { t: $('decorBtn'), c: 'photo1', fing: 'tap' };
    case 'ser': // 238 C · 281: ser2 low (the bubble under the board, its first row clear): 「같이 가요」 on to the nest like the other rows (the cells fill from eggs); an egg put in = done
      if (open) { gm.s = 1; return { t: q('[data-close]', W), c: 'ser2', fing: 'tap', inBox: W, low: 1 }; }
      return gm.s || vis($('nest')) ? guide(S, 'egg', cur, api) : { t: $('serBtn'), c: 'ser1', fing: 'tap' }; // asked again with the nest open: straight to the next egg
    case 'egg':
      if (S.slots.filter(Boolean).length + (S.stats.hatch || 0) > gm.eggs) return { done: 1 };
      if (vis($('nest'))) { const e = q('#neggs .negg[data-id]'); if (e && S.slots.includes(null)) return { t: e, c: 'nest_egg', fing: 'tap', inBox: $('nest') };
        const n = S.nests?.[cur === 'yard' ? HABITATS[0].id : cur]; // 258 B Q2: the nest's own clock (nest.js 다음 알까지), read only
        hold(EGGROW, e ? Math.min(...S.slots.map(s => s?.end ?? NaN)) : n && !n.eggs.length ? n.t + R.eggGap(S) : NaN); return msg(e ? 'm_full' : 'm_egg', $('nest')); } // E-19: slots full: the egg's tap only toasts 가득 찼어요 (was lit again and again) · 258 B: eggs there (another tab's) or none to read: 2 min (a full nest's n.t keeps moving)
      return { t: $('nestBtn'), c: 'nest_open', fing: 'tap' };
    case 'prop': {
      if (R.FIRST_V.prop(S) > gm.prop) return { done: 1 };
      if (!vis(D)) return gm.d ? { done: 1 } : { t: $('decorBtn'), c: 'd_open', fing: 'tap' };
      gm.d = 1; return api?.decor.holding() ? { t: q('[data-place]', D), c: 'd_put', fing: 'tap', dec: 1, inBox: D } : { t: q('.dprop[data-p]', D), c: 'd_pick2', fing: 'tap', dec: 1, inBox: D };
    }
    case 'brk': { const b = q('[data-brk]'); return vis(b) ? { t: b, c: 'swap1', fing: 'tap', soft: 1 } : { done: 1 }; } // 6장: not chosen for them (판매 still there)
    case 'swap': {
      if ((S.stats.swap || 0) > gm.swap) return { done: 1 };
      const sw = open && q('.sswap[data-swap]:not([disabled])', W);
      if (vis(sw)) { gm.in = 1; return { t: sw, c: 'swap2', fing: 'tap', inBox: W }; }
      if (gm.in || !gm.asked) return { done: 1 };
      return open ? (hold(['swap']), msg('m_stamp', W)) : { t: $('serBtn'), c: 'swap0', fing: 'tap' }; // E-19: too few stamps: the pill's 다음 goes past it for 2 min (was the same 4 s words again and again)
    }
  }
  return { done: 1 };
}
