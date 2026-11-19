// 170 C·D (?f170, loaded by main.js only then): the first day's one line at the bottom, a task at a time (rules.js step170:
// 첫 부화 → 이름 (건너뛰기 가능) → 쓰다듬기 → 소품 하나 → 알 3개 → 첫날 선물), gone from day 3; after the first card a naming card;
// the end card: the 첫날 선물, tomorrow's legendary egg with its time left, the week's cells with day 7; once in the daytime a line
// about the night. body.n170wait: the naming not answered yet (play.js holds the home-screen card and the in-app band till then).
// Text in: textContent; the only innerHTML is our own fixed text and weekCells (data.js). Nothing three.js is made here.
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import * as R from '../game/rules.js';
import { FIRST, WEEK1, TUT181 } from '../game/data.js';
import { toast, topWindow, overlayOpen, clock } from './hud.js';
import { figureThumb, eggThumb } from './thumbs.js';
import { weekCells, cell } from './attend.js';
import { track as send } from './stats.js';
import { sfx } from './sound.js';

// 170 A·B 정 레벨: the pet step is done at 정 Lv2 (a first baby gets there at 1/3 of its gauge)
const lv = TUT181 ? undefined : a => R.affLevel(a, G.now()); // 182 ②: the tutorial's pet is one pat (its `aff` step comes later)
// 182 ② (?tut181, ui/tut181.js on top of this): its bubble says the line (hidden), its `tut` events count the steps (no step170),
// the end card waits for its `end` step, and the night line and play.js's cards wait while it shows (body.tut181)
const track = (...a) => TUT181 || send(...a), tutOn = () => TUT181 && document.body.classList.contains('tut181'), tutAt = S => TUT181 && R.step181(S, G.now()); // tutAt: its step, null when done or skipped (the line is back then)

const $ = id => document.getElementById(id), hab = $('habitat'), el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});
const line = el('button', 'next170'); line.hidden = true; line.append(el('i', '', $t('다음 할 일')), el('span')); hab.append(line);
const card = el('section', 'intro pop ret n170'); card.id = 'n170'; card.hidden = true; card.setAttribute('aria-label', $t('첫날')); hab.append(card);
const nm = a => a.nm || R.SP[a.species]?.name || R.kindName(a), free = () => !hab.classList.contains('hidden') && !topWindow('.tip') && !overlayOpen() && !document.body.classList.contains('photo') && !document.hidden && $('loading').hidden;
// free: no window but a tip (a tip may stay up till tapped, and a card over it is fine: 109, the tip waits). arriving: 66-1's guest
// tutorial runs in these same minutes: the line shows through it, but a card (and play.js's home/app notes) waits out a guest's
// arrival, 6 s either side of it (its toast, the camera going to it)
const arriving = () => { const Q = G.S.guests; return Q?.tut >= 0 && (!Q.tt || Math.abs(G.now() - Q.tt) < 6e3); };
const TEXT = { // nm: its name, else the short species name (the line keeps to 2 lines)
  hatch: () => $t('둥지를 눌러 첫 알을 깨워요'),
  name: a => $t('{0}에게 이름을 지어 줘요', nm(a)),
  pet: a => $t('{0}{을/를} 톡 눌러 쓰다듬어요', nm(a)),
  prop: () => $t('꾸미기에서 소품 하나 놓아요'),
  egg3: () => $t('알 3개 깨우기 · {0}/3', Math.min(3, G.S.stats.hatch || 0)),
  end: () => $t('다 했어요 · 첫날 선물 받기'),
};
const GO = { hatch: () => $('nestBtn').click(), name: a => naming(a), prop: () => $('decorBtn').click(), egg3: () => $('nestBtn').click(), end: () => ending() };
let step = null, quiet = 0, calm = 0, tick = 0;
line.onclick = () => GO[step]?.(R.firstFriend(G.S));

function naming(a) {
  if (!a) return;
  const d = el('div'), inp = el('input', 'fname'), img = el('img', 'f170fig');
  Object.assign(inp, { maxLength: 8, autocomplete: 'off', placeholder: R.kindName(a) }); inp.setAttribute('aria-label', $t('이름'));
  const no = el('button', 'sb', $t('나중에')), ok = el('button', 'go', $t('저장')); no.dataset.close = '';
  const btns = el('div', 'nbtns'); btns.append(no, ok);
  d.append(el('h2', '', $t('이름을 지어 줄까요?')), img, el('p', 'sub', $t('{0} · 8글자까지', R.kindName(a))), inp, btns); card.replaceChildren(d); card.hidden = false;
  img.alt = ''; figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }, () => {});
  const done = save => { if (card.hidden) return; card.hidden = true; G.flag('nm170'); track('step170', { s: save && inp.value.trim() ? 'name' : 'skip' }, 'step170:name');
    if (save && inp.value.trim()) { const r = G.setName(a.id, inp.value); if (r?.nm) toast($t('이름을 지었어요 · 「{0}」', r.nm)); } };
  no.onclick = () => done(false); ok.onclick = () => done(true); inp.onkeydown = e => { if (e.key === 'Enter') done(true); };
}

let eggT = 0;
function ending() {
  const out = G.firstEnd(), S = G.S, d = el('div'), P = out?.got?.prop && R.PROP[out.got.prop];
  track('step170', { s: 'end' }, 'step170:end'); sfx('grown');
  d.append(el('h2', '', $t('첫날 할 일을 다 했어요!')));
  if (P) d.append(el('p', 'sub', $t('첫날 선물 · 「{0}」 + 꼬마 사탕 {1}개 · 꾸미기 › 선물에 있어요', P.name, out.got.candy)));
  if (S.flags.week1 && S.attend.n === 1 && !R.attendDue(S, G.now())) { // the day-2 gift (rules attend, WEEK1[1]) still to come: shown here, given tomorrow as before
    const box = el('div', 'egg170'), img = el('img'), t = el('small');
    img.alt = ''; eggThumb('legendary').then(u => { img.src = u; }, () => {});
    box.append(img, el('b', '', $t('둥지에 전설 알이 왔어요')), t); d.append(box);
    const up = () => { const now = G.now(); t.textContent = $t('내일 깨어나요 · {0}', clock(new Date(now).setHours(24, 0, 0, 0) - now)); };
    clearInterval(eggT); eggT = setInterval(up, 1000); up(); // stopped with the card (the 500 ms loop below)
    if (!S.flags.d2seen) { G.flag('d2seen'); send('d2_gift_seen'); } // first.js's 「내일 들어오면 전설 알…」 line: said here instead
  }
  if (S.flags.week1 && S.attend.n < WEEK1.length) { // the first week's cells (attend.js), day 7 marked
    const w = el('div'); w.innerHTML = weekCells(); d.append(...w.childNodes); d.querySelector('.week span:last-child')?.classList.add('d7');
    d.append(el('p', 'sub d7t', $t('7일째에는 {0}', cell(WEEK1.at(-1)))));
  }
  const btns = el('div', 'nbtns'), nest = el('button', 'sb', $t('둥지 보기')), ok = el('button', 'go', $t('좋아요')); ok.dataset.close = '';
  btns.append(nest, ok); d.append(btns); card.replaceChildren(d); card.hidden = false;
  ok.onclick = () => { card.hidden = true; }; nest.onclick = () => { card.hidden = true; $('nestBtn').click(); };
}

// the night line: once, in the daytime of the first day, after the naming and the first pet (167's 20시 toast is at night)
function night() {
  const S = G.S, now = G.now();
  if (S.flags.nt170 || R.mythNight(now) || G.dayOf(now) !== G.dayOf(S.since) || !S.flags.nm170 || !(S.stats.pet > 0) || $('toast').classList.contains('on')) return;
  G.flag('nt170'); toast($t('{0}이 되면 빛나는 친구들이 깨어나요', $t('밤(오후 {0}시~오전 {1}시)', R.NIGHT[0] - 12, R.NIGHT[1])), 4200, true);
}

setInterval(() => {
  const S = G.S; if (!S) return;
  const s = R.step170(S, G.now(), lv), was = step; step = s;
  if (was && was !== s) track('step170', { s: was }, 'step170:' + was);
  document.body.classList.toggle('n170on', !!s); document.body.classList.toggle('n170wait', s === 'name' || !!s && arriving() || tutOn());
  if (card.hidden) clearInterval(eggT);
  const ok = !!s && free(); quiet = ok ? quiet + 1 : 0; // ticks of 500 ms with the screen free
  line.hidden = !ok || tutOn() || !!tutAt(S) && tutAt(S) !== 'end'; // 182 ② review: at the end step 170's line is back (a prop put away after decor: step170 'prop', nothing lit) if (ok) { line.lastChild.textContent = TEXT[s](R.firstFriend(S)); line.classList.toggle('go', s === 'end'); }
  if (ok && quiet >= 3 && !arriving() && (s === 'name' && !tick++ || s === 'end' && (tutAt(S) || 'end') === 'end')) GO[s](R.firstFriend(S)); // the naming card once a page, after the first card; the end card when all is done
  calm = free() && !tutOn() ? calm + 1 : 0; if (calm >= 4) night();
}, 500);
