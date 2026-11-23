// 199 B-11 ?g190 (docs/game-purpose.md 12장): the 「시리즈」 button (215, 214 A ③: an icon in the top bar, before 우편함) and its board, two tabs: 시리즈 (초원 시리즈 1탄,
// 12 cells and the secret's place, 교환 도장 for a missing cell) and 의뢰 (215: the board's requests, the 12 stories, shot in 사진 모드: ui/photo.js).
// 203 D5: a third tab, 앨범 (사진 앨범): the 33 놀이 장면 (SCENES) moved from the codex, each its condition as before (seen: the
// day, its ♥ given then as before) and 「찍기」 (to 사진 모드). The request's postcard when it is done. Loaded only with the flag (main.js); text in with textContent (the markup is ours).
import { $t, LOC } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { SP, RAR, HAB, lookName, variantsOf, colorsOf } from '../game/rules.js';
import { PROPS, SCENES, SPECIES, BALANCE as B, TUT228 } from '../game/data.js';
import { GUESTS, guestWear } from '../game/guests-data.js';
import { SERIES, STAMP, REQUESTS, REQ, DAILY, cellsOf, have, queued, reqOf, wishName, collNo } from '../game/series.js';
import { figureThumb, silhouetteThumb, propThumb } from './thumbs.js';
import { toast, whenClear } from './hud.js';
import { sfx } from './sound.js';

const $ = id => document.getElementById(id), mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const who = q => GUESTS.find(g => g.k === q.who)?.name ?? '';
const prop = id => PROPS.find(p => p.id === id)?.name ?? '';
const icon = w => /^(pals|sp:)/.test(w) ? 'friends' : { 꽃: 'flower', 쉼터: 'home' }[w] ?? '';
// 208 A: each wish 채움 / 모자람 where the camera looks now (as the request shot judges it), only in the request's habitat
let cam = null; export const useCam = f => { cam = f; }; // main.js: () => [habitat id, x, z] or null
const reqQ = id => reqOf(id, G.S.req.on.find(x => x.id === id));
const metOf = q => { const c = cam?.(); return c && c[0] === q.hab ? G.reqMet(q.id, c[1], c[2]) : null; };

const btn = mk('button', 'back', $t('시리즈')); btn.id = 'serBtn'; btn.setAttribute('aria-label', $t('시리즈')); btn.title = $t('시리즈'); $('mailBtn').before(btn); // 215 (214 A ③): the top bar
const el = mk('section', 'codex ser'); el.id = 'ser'; el.hidden = true; el.setAttribute('aria-label', $t('시리즈'));
el.innerHTML = $t('<div class="chead"><b>시리즈</b><span id="serStamp"></span><button class="back" data-close>닫기</button></div>\n<div class="ctabs"><button data-tab="ser">시리즈</button><button data-tab="req">의뢰</button><button data-tab="alb">앨범</button></div>\n<div class="cbody" id="serBody"></div>');
const post = mk('section', 'intro pop'); post.id = 'serPost'; post.hidden = true; post.setAttribute('aria-label', $t('엽서'));
post.innerHTML = $t('<div class="spost"><span class="sstamp" aria-hidden="true"><img alt=""></span><h2></h2><p class="sp1"></p><p class="sp2"></p><button data-close>고마워요</button></div>'); // 208 A: a postcard, its stamp the sender (a thumbs.js picture: cached there, nothing to dispose here)
$('habitat').append(el, post);
let tab = 'ser';

function cell(c, S) {
  const got = !!S.codex[c.key], d = mk('div', 'cell' + (got ? '' : ' unk')), img = mk('img'); img.alt = ''; d.dataset.k = c.key;
  d.append(img, mk('span', got ? null : 'srar', got ? lookName(c.species, c.variant) : RAR[c.rarity].name));
  if (!got) d.lastChild.style.setProperty('--rc', RAR[c.rarity].color); // 208 A: the rarity a pill in its colour (as the hatch card)
  (got ? figureThumb(c.species, c.variant) : silhouetteThumb(c.species)).then(u => { img.src = u; }, () => {});
  if (!got) { const cost = STAMP.swap[c.rarity], q = queued(S, c.key), b = mk('button', 'sswap', q ? $t('오는 중') : $t('교환 {0}', cost)); b.dataset.swap = c.key; b.disabled = q || S.stamp < cost; d.append(b); }
  return d;
}
function drawSer(body, S) {
  for (const s of SERIES) {
    const M = S.ser[s.id], n = have(S, s), h = mk('h3', null, s.name + ' '); h.append(mk('small', null, $t('{0}/{1}', n, s.cells.length))); body.append(h);
    const row = mk('div', 'crow'); for (const c of cellsOf(s)) row.append(cell(c, S));
    body.append(row); // 263 A: 12 cells only, no secret place (M.sec stays in the save for the secret redone, 263 B)
    body.append(mk('p', 'cnote', M.got ? $t('다 모았어요 · 「{0}」{을/를} 받았어요(보관함의 소품)', prop(s.prize), prop(s.prize)) : $t('12칸을 다 모으면 「{0}」{을/를} 받아요', prop(s.prize), prop(s.prize))));
  }
  body.append(mk('h3', null, $t('교환 도장')), mk('p', 'cnote', $t('도감에 있는 변종이 또 나오면 카드에서 판매 대신 분해를 고를 수 있어요 · 일반 {0} · 희귀 {1} · 영웅 {2} · 전설 {3}개 (시크릿은 두 배)', ...['common', 'rare', 'heroic', 'legendary'].map(r => STAMP.brk[r]))),
    mk('p', 'cnote', $t('도장으로 빠진 칸을 하나 골라 선물 알로 받아요 · 일반 {0} · 희귀 {1} · 영웅 {2}개 · 시크릿과 전설은 교환하지 않아요', STAMP.swap.common, STAMP.swap.rare, STAMP.swap.heroic)));
}
const habName = h => HAB[h]?.name ?? $t('나의 뜰'); // the yard: HAB.yard only with ?yard
function reqBox(q, S, x) { // a request on the board (x: its entry) or a story sent
  const st = S.req.done[q.id], box = mk('div', 'sreq' + (x ? ' on' : '')); box.dataset.q = q.id;
  box.append(mk('b', null, q.name), mk('p', 'sreqwho', $t('{0} · 「{1}」', who(q), q.line)));
  const met = x || st < 3 ? metOf(q) : null; // 208 A: a card per wish, 채움 / 모자람 when it can be judged here
  [...q.must, ...q.extra].forEach((w, i) => { const m = met?.[i], r = mk('div', 'scond' + (i < q.must.length ? ' must' : '') + (m == null ? '' : m ? ' ok' : ' no')), ic = mk('i'); r.dataset.i = icon(w); ic.setAttribute('aria-hidden', 'true');
    r.append(ic, mk('span', null, wishName(w)), mk('small', null, i < q.must.length ? $t('꼭') : $t('★ 하나 더'))); if (m != null) r.append(mk('em', null, m ? $t('채움') : $t('모자람'))); box.append(r); });
  if ((x || st < 3) && !met) box.append(mk('p', 'cnote', $t('{0}에서 열면 채움·모자람이 보여요', habName(q.hab))));
  box.append(mk('p', 'cnote', st ? (st < 3 ? $t('보냈어요 · ★{0}/3 · 사진 모드에서 다시 찍어 보내면 별이 올라가요', st) : $t('보냈어요 · ★3/3')) : $t('사진 모드에서 {0}{을/를} 비추고 「의뢰 사진 보내기」를 눌러요 · 화면 가운데가 기준이에요', habName(q.hab), habName(q.hab))));
  if (TUT228 && x) { const b = mk('button', 'sb', $t('찍으러 가기')); b.dataset.shot = '1'; box.append(b); } // 236 B Q11: straight to the photo mode (the tutorial's 의뢰 2/3)
  box.append(mk('p', 'cnote', q.small ? $t('보상: ♥{0} · 오늘의 작은 의뢰 (오늘이 지나면 다른 의뢰가 와요)', q.hearts) : $t('보상: ♥{0} · 「{1}」 (처음 한 번)', q.hearts, prop(q.prop))));
  return box;
}
function drawReq(body, S) { // 215: the board (3 at most, 2 a day), then the stories sent, then the ones still to come (where, from which Lv)
  const on = S.req.on.map(x => [reqOf(x.id, x), x]).filter(([q]) => q), sent = REQUESTS.filter(q => S.req.done[q.id] && !S.req.on.some(x => x.id === q.id)), later = REQUESTS.filter(q => !S.req.done[q.id] && !S.req.on.some(x => x.id === q.id));
  const h = mk('h3', null, $t('의뢰판') + ' '); h.append(mk('small', null, $t('{0}/{1}', on.length, DAILY.board))); body.append(h);
  if (!on.length) body.append(mk('p', 'cnote', (S.stats.hatch || 0) < 1 ? $t('첫 알을 부화하면 의뢰가 와요') : $t('새 의뢰는 내일 와요 · 하루에 두 건까지')));
  for (const [q, x] of on) body.append(reqBox(q, S, x));
  const h2 = mk('h3', null, $t('이야기 의뢰') + ' '); h2.append(mk('small', null, $t('{0}/{1}', sent.length, REQUESTS.length))); body.append(h2);
  for (const q of sent) body.append(reqBox(q, S, null));
  if (later.length) { const row = mk('div', 'sreqs'); for (const q of later) { const d = mk('div', 'sreq later'); d.append(mk('b', null, '?'), mk('small', null, $t('{0} · Lv{1}', habName(q.hab), q.lv))); row.append(d); } body.append(row); }
}
// 203 D5 앨범: a cell per SCENES one, as the codex drew them (prop or friend, flat shape till seen), the condition (hint) or the day
const model = () => import('../habitat/meadow/props.js').then(m => m.decorModel); // as level.js on the map: every prop's look
function drawAlb(body, S) {
  const n = SCENES.filter(s => S.scenes[s.id]).length, h = mk('h3', null, $t('사진 앨범') + ' '); h.append(mk('small', null, $t('{0}/{1}', n, SCENES.length))); body.append(h);
  const row = mk('div', 'crow sc');
  for (const s of SCENES) {
    const e = S.scenes[s.id], d = mk('div', 'cell scene' + (e ? '' : ' unk')), img = mk('img'); img.alt = ''; d.dataset.sc = s.id;
    d.append(img, mk('span', null, e ? s.name : '?'), mk('small', null, e ? new Date(e.at).toLocaleDateString(LOC) : s.hint), mk('button', 'sswap', $t('찍기')));
    d.lastChild.dataset.shot = s.id;
    const sp = e?.sp || s.sp || SPECIES[0].id, fig = () => figureThumb(sp, variantsOf(SP[sp])[0].id, null, null, 'adult');
    (s.prop ? model().then(m => propThumb(s.prop === 'train' ? 'railring' : s.prop, m, !e)).catch(fig) : e ? fig() : silhouetteThumb(sp)).then(u => { img.src = u; }, () => {});
    row.append(d);
  }
  body.append(row, mk('p', 'cnote', $t('동물이 놀이 소품에서 놀거나 동물끼리 노는 모습을 보면 담겨요 · 처음 볼 때 ♥{0} · 「찍기」를 누르면 사진 모드로 가요', B.scene.hearts)));
}
// review 6: redrawn only when what it shows changed (each tick redrew it, a tap on 교환 could land on a button just replaced)
const sig = () => JSON.stringify([tab, G.S.stamp, G.S.ser, G.S.req, G.S.giftRow.length, Object.keys(G.S.scenes).length, SERIES.flatMap(s => s.cells.map(k => !!G.S.codex[k] || queued(G.S, k))), tab === 'req' && [...G.S.req.on.map(x => reqOf(x.id, x)), ...REQUESTS.filter(q => G.S.req.done[q.id] < 3)].map(q => q && metOf(q))]); // 208 A: and 채움 / 모자람 as the animals move
let shown = '';
function draw() {
  if (el.hidden || !G.S?.ser) return;
  const S = G.S, body = $('serBody'), y = body.scrollTop; $('serStamp').textContent = $t('도장 {0}', S.stamp);
  el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  body.textContent = ''; ({ ser: drawSer, req: drawReq, alb: drawAlb }[tab] ?? drawSer)(body, S); body.scrollTop = y; shown = sig();
}
export function openSeries(t = tab) { if (!G.S?.ser) return; tab = t; el.hidden = false; draw(); }
btn.onclick = () => openSeries();
el.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.close != null) el.hidden = true;
  else if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
  else if (b.dataset.shot) { el.hidden = true; if (!document.body.classList.contains('photo')) $('snapBtn').click(); } // 203 D5 찍기 (as sky.js, share.js)
  else if (b.dataset.swap) { const r = G.swapCell(b.dataset.swap);
    if (!r) return; if (r.short) return toast($t('도장이 {0}개 모자라요', r.short)); if (r.full) return toast($t('선물 알 줄이 가득 찼어요 · 둥지에서 먼저 넣어 주세요'));
    sfx('egg'); toast($t('교환했어요 · 둥지의 선물 알로 왔어요'), 3000); }
});
post.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === post) post.hidden = true; });
function card(q, ev) { // the request's postcard: the visitor's thanks, the stars, what came (215: a story's own words; a small one ♥ only)
  const R = GUESTS.find(g => g.k === q.who), im = post.querySelector('.sstamp img'); im.removeAttribute('src'); post.dataset.q = q.id;
  if (R) figureThumb(R.sp, 'solid', colorsOf(R.sp, 'solid')[0]?.id ?? null, guestWear(R), 'adult').then(u => { if (post.dataset.q === q.id) im.src = u; }, () => {}); // as the codex draws a visitor (208 A review: a later card keeps its own)
  post.querySelector('h2').textContent = $t('{0}의 엽서', who(q));
  post.querySelector('.sp1').textContent = q.small ? $t('「{0}」 고마워요! {1}', q.name, '★'.repeat(ev.stars)) : $t('{0} {1}', q.post, '★'.repeat(ev.stars));
  post.querySelector('.sp2').textContent = q.small ? $t('♥+{0}', q.hearts) : $t('{0} · ♥+{1} · 「{2}」{을/를} 보관함에 넣었어요', q.thanks, q.hearts, prop(q.prop), prop(q.prop)); post.hidden = false; sfx('unveil');
}
G.on(ev => {
  for (const e of ev) {
    if (e.type === 'series_cell') { const s = SERIES.find(s => s.id === e.id); toast($t('{0} {1}/{2}', s.name, e.n, s.cells.length), 2600); }
    else if (e.type === 'series_done') { sfx('unveil'); toast($t('{0}{을/를} 다 모았어요 · 「{1}」{을/를} 받았어요', SERIES.find(s => s.id === e.id).name, prop(SERIES.find(s => s.id === e.id).prize)), 4000); }
    // 263 A: series_secret (M.sec saved) shows nothing; the secret accessory goes to the album as before
    else if (e.type === 'req_new') whenClear(() => { const q = G.S?.req?.on && reqQ(e.id); if (q) toast($t('{0}{이/가} 의뢰를 맡겼어요 · 시리즈 → 의뢰', who(q)), 3600); }); // 264 B ③: not over the 둥지·이름 카드
    else if (e.type === 'req_done') card(e.small ? reqOf(e.id, e) : REQ[e.id], e);
    else if (e.type === 'fetch') toast($t('{0}{이/가} 알을 물어왔어요 · 둥지에서 볼 수 있어요', prop(e.prop)), 3000);
  }
  if (!el.hidden && G.S?.ser && sig() !== shown) draw();
});
