// 303 ?ui2611 단계 1: the new look's parts that need words or numbers (src/ui2611.css draws the rest). Only reads the game and
// clicks its own buttons: no rule, save or feature changes. Its words are its own table (not $t keys: a trial's words stay out of
// en.js/ja.js until it ships); text goes in with textContent. index.html loads it with ?ui2611; the build (tools/build-web.mjs UI880, 0.88.0) for everyone
import { LANG, $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { SP, HAB, RAR, variantOf, outIn, xpAt, callName, kindName, key, habitatOf } from '../game/rules.js';
import { serOf, have, STAMP } from '../game/series.js';
import { clock, ask } from './hud.js';
import { figureThumb } from './thumbs.js';
import { mailCount } from './mail.js';

const W = {
  ko: { lv: 'Lv {1} · 다음까지 {0}%', go1: '알 {0}개 바로 까기', all: '남은 알 {0} · 모두 까기', cell: '도감 새 칸', find: '이름이나 종으로 찾기', findL: '친구 찾기',
    res: '{0}마리가 나왔어요', out: '{0}에 나왔어요', kept: '보관함에서 기다려요', ok: '좋아요', filt: '필터', swapQ: '{0} · {1} 칸을 토큰 {2}개로 교환할까요? 둥지의 선물 알로 와요', swapOk: '교환' },
  en: { lv: 'Lv {1} · {0}% to next', go1: 'Hatch {0} now', all: '{0} left · Hatch all', cell: 'New in Collection', find: 'Search by name or species', findL: 'Find a friend',
    res: '{0} hatched', out: 'Out in {0}', kept: 'Waiting in Storage', ok: 'Nice', filt: 'Filter', swapQ: 'Swap {2} tokens for a {1} spot in {0}? It comes as a gift egg in the nest', swapOk: 'Swap' },
  ja: { lv: 'Lv {1} · 次まで{0}%', go1: 'たまご{0}個 すぐふ化', all: 'のこり{0} · ぜんぶふ化', cell: '図鑑に新しく', find: '名前や種類でさがす', findL: 'ともだちをさがす',
    res: '{0}ひき うまれたよ', out: '{0}に出たよ', kept: 'ほかんこで待っているよ', ok: 'いいね', filt: 'しぼりこみ', swapQ: '{0}の{1}のマスを トークン{2}個で交換する？ 巣のプレゼントのたまごで届くよ', swapOk: '交換' },
}[LANG] || {};
const w = (k, ...a) => (W[k] ?? '').replace(/\{(\d)\}/g, (_, i) => a[i]);
const $ = id => document.getElementById(id);
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const set = (e, t) => { if (e.textContent !== t) e.textContent = t; };
const RC = { common: '#8A8178', rare: '#2F6FB5', heroic: '#6A4EB8', legendary: '#C48A1C' }; // 303: the friends' rarity dots

// ① main: the level ring chip, labels under the right icons, BETA into the chip, 「알 N개 바로 까기」 + the time chip.
// The habitat's windows come after the map (main.js code(): play.js, nest.js), so each part is put in when its place is there
let lv = null, ring, lt, pill, pillT, go, time, mailN;
const ready = () => G.S.slots.filter(s => s && G.now() >= s.end).length;
const hatchNext = () => $('nslots')?.querySelector('.nslot.ready')?.click();
function mainUp() { // 2611a 검토 ②: lv is set last, once every part it needs is there (a missing one: tried again next tick, no error)
  const L = $('lvPill'), P = $('nestPill'), hb = $('habName'); if (!L || !P || !hb || P.children.length < 2) return false;
  ring = mk('em', 'u26ring'); lt = mk('span', 'u26lt'); L.append(ring, lt);
  const beta = document.querySelector('#habitat>.bar .btag'); if (beta) L.append(beta); // 316 ①: BETA 표는 정식 출시 때 지움 (이 줄과 src/ui2611.css #lvPill .btag 두 줄)
  const lp = mk('div', 'u26pill'); hb.before(lp); lp.append(hb, ...[$('hearts')].filter(Boolean)); // one panel round the name and ♥ (play.js fitBar still measures the name)
  const ic = [...document.querySelectorAll('#habitat>.bar :is(#overview,#serBtn,#mailBtn,#prefsBtn)')]; // one panel round the right icons
  if (ic.length) { const grp = mk('div', 'u26grp'); ic[0].before(grp); grp.append(...ic); }
  for (const b of [$('mailBtn'), $('prefsBtn')]) b?.append(mk('span', 'u26lb', b.getAttribute('aria-label')));
  mailN = mk('b', 'u26mn'); mailN.ariaHidden = 'true'; $('mailBtn')?.append(mailN); // 316 ⑨: 우편 숫자 배지 (9+까지)
  if ($('mailBtn')) new MutationObserver(badge).observe($('mailBtn'), { attributes: true, attributeFilter: ['class'] }); // mail.js dot() (mail.json come, a mail read) is not a G event
  pill = P; [pillT] = P.children; const pillB = P.children[1]; go = mk('button', 'u26go'); time = mk('button', 'u26time');
  go.type = 'button'; time.type = 'button'; P.prepend(go); pillB.before(time); // 2611a 검토 ④: the time chip is a button (looks the same)
  go.onclick = () => { $('nestBtn')?.click(); hatchNext(); }; // the nest opens on its slots, then the first ready one is pressed, as a finger would
  time.onclick = () => pillT.click();
  lv = L; return true;
}
function badge() { const mn = mailCount(); mailN.hidden = !mn; set(mailN, mn > 9 ? '9+' : String(mn)); $('mailBtn')?.classList.toggle('u26has', mn > 0); } // toggle to the same state: no class change, no observer loop
function main() {
  if (!lv && !mainUp()) return;
  const L = G.S.lv, a = xpAt(L), p = Math.max(0, Math.min(99, Math.floor((G.S.xp - a) / (xpAt(L + 1) - a) * 100)));
  set(ring, String(L)); ring.style.setProperty('--p', p + '%'); set(lt, w('lv', p, L)); // 316 ①: 칭호 데이터 없이 「Lv 8 · 다음까지 94%」
  badge();
  const now = G.now(), done = ready(), run = G.S.slots.filter(s => s && now < s.end), m = /\d+:\d\d(:\d\d)?/.exec(pillT.textContent);
  const soon = run.length ? Math.min(...run.map(s => s.end - now)) : 0, t = soon > 0 ? clock(soon) : !pillT.hidden && m ? m[0] : '';
  go.hidden = !done; set(go, w('go1', done));
  time.hidden = !t; set(time, t); time.title = t ? (soon > 0 ? $t('부화까지 {0}', t) : $t('다음 알까지 {0}', t)) : '';
}

// ② the hatch stage: one DOM block behind the transparent canvas (nest.js <ui2611>), its colour from the card's rarity
let sheet = null, card, gz, ser, serB, dots, all, lastCard = null;
function hatchUp() {
  const S = document.querySelector('#nest .nsheet'); if (!S) return false;
  sheet = S; card = $('ncard'); gz = $('ngauges');
  // 271 ① 여기에 얹음: A1 언박싱 손맛 goes on this block (rays, pedestal, sparkles, the series line, 남은 알)
  const st = mk('div', 'u26st'), top = mk('div', 'u26top'); ser = mk('div', 'u26ser'); serB = mk('b'); dots = mk('span', 'u26dots'); all = mk('button', 'u26all');
  for (const c of ['u26rays', 'u26ped', 'u26sp']) { const i = mk('i', c); i.ariaHidden = 'true'; st.append(i); }
  for (let i = 0; i < 5; i++) st.lastChild.append(mk('i', '', '✦'));
  for (let i = 0; i < 12; i++) dots.append(mk('i'));
  all.type = 'button'; ser.append(serB, dots); top.append(ser, all); st.append(top); sheet.prepend(st);
  all.onclick = () => { const a = G.S.animals.find(x => x.id === +card.dataset.id), first = !!a && !G.S.codex[key(a.species, a.variant)]; card.querySelector('.nbtns .go')?.click(); results([...a ? [{ a, first }] : [], ...hatchAll()]); }; // 316 ②: this one as its 큰 버튼 sends it, then every ready egg at once, one list
  new MutationObserver(() => { reward(); gauges(); hatch(); }).observe(card, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  return true;
}
function hatch() {
  if (!sheet && !hatchUp()) return;
  const a = !card.hidden && G.S.animals.find(x => x.id === +card.dataset.id), v = a && variantOf(a.species, a.variant);
  sheet.dataset.u26r = v ? (RC[v.rarity] ? v.rarity : 'other') : 'egg';
  if (v) sheet.style.setProperty('--u26-x', RAR[v.rarity]?.color ?? '#888');
  const k = a && key(a.species, a.variant), s = a && serOf(k), n = s ? have(G.S, s) + (G.S.codex[k] ? 0 : 1) : 0; // as nest.js counts it: the new cell is in the codex only once placed
  ser.hidden = !s; if (s) { set(serB, `${s.name} · ${n} / ${s.cells.length}`); [...dots.children].forEach((d, i) => d.classList.toggle('on', i < n)); }
  const left = a ? ready() : 0; all.hidden = !left; set(all, w('all', left));
}
// 316 ② 모두 까기 (A1 「빠르게 모두 까기」와 같은 함수: 271 A1 손맛 연출은 이 위에 얹음). Every ready slot hatches now and each friend goes
// where the card's big button would send it: out into its habitat when it fits, else storage (rules.release / store). The
// card's other choices (판매·분해·보기) stay on one-at-a-time hatching. Returns [{ a: the friend, first: its codex cell is new }]
export function hatchAll() {
  const got = [];
  G.S.slots.forEach((s, i) => { if (s && G.now() >= s.end) { const r = G.hatch(i); if (r) got.push(r.animal); } });
  return got.map(a => {
    const k = key(a.species, a.variant), first = !G.S.codex[k];
    if (!G.release(a.id)) G.store(a.id);
    return { a, first, lore: first && !!RAR[variantOf(a.species, a.variant)?.rarity]?.story }; // lore: a legendary's first one, its story toast (nest.js answer()) comes after the card, one by one
  });
}
function results(list) { // one card: every friend that came, its picture, name, rarity and where it went
  if (!list.length) return;
  document.getElementById('u26res')?.remove();
  const el = mk('section', 'intro pop ret news mail u26res'), box = mk('div'), ul = mk('ul'), row = mk('div', 'nbtns'), ok = mk('button', 'go', w('ok'));
  el.id = 'u26res'; el.setAttribute('role', 'dialog'); ok.type = 'button'; ok.dataset.close = '';
  for (const { a, first } of list) {
    const v = variantOf(a.species, a.variant), li = mk('li'), img = mk('img'), sp = mk('span', '', callName(a)), sm = mk('small', 'u26rr', RAR[v?.rarity]?.name ?? '');
    img.alt = ''; li.style.setProperty('--u26-rc', RAR[v?.rarity]?.color ?? '#8A8178');
    figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }, () => {});
    sp.append(sm, mk('small', '', a.stored ? w('kept') : w('out', HAB[habitatOf(a)]?.name ?? '')));
    if (first) sp.prepend(mk('i', 'new', 'NEW'));
    li.append(img, sp); ul.append(li);
  }
  row.append(ok); box.append(mk('h2', '', w('res', list.length)), ul, row); el.append(box);
  const lore = list.filter(x => x.lore).map(x => key(x.a.species, x.a.variant));
  el.onclick = e => { if (e.target !== el && !e.target.closest('[data-close]')) return; el.remove(); lore.forEach((k, i) => setTimeout(() => import('./story.js').then(m => m.giveStory('l', k)), 600 + i * 3400)); };
  $('mail').after(el); ok.focus({ preventScroll: true });
}
function reward() { // the chips under the name as one line (♥+3 · 도감 새 칸 · 새 색!), No. stays hidden (src/ui2611.css)
  if (card.hidden || card.firstChild === lastCard) return; lastCard = card.firstChild;
  const rw = mk('p', 'u26rw');
  for (const c of card.querySelectorAll('.nchips>:not(.rar)')) rw.append(mk('span', '', c.classList.contains('new') && c.textContent === 'NEW' ? w('cell') : c.textContent));
  if (rw.children.length) card.querySelector('.nbtns')?.before(rw);
}
function gauges() { // 323 ②: the 조각 판 (nest.js #ngauges) in the card between its words and the big button (the 손맛 trial file shows it there, small; 328 rc: the word kept out, build-web.mjs refuses it in a shipped file), back over the slots when the card goes
  const g = gz, b = !card.hidden && card.querySelector('.nbtns'); if (!g) return; // gz: held, card() innerHTML takes it out of the page
  if (b) { if (g.nextElementSibling !== b) b.before(g); } else if (g.parentElement !== card.parentElement) $('nslots')?.before(g);
}

// ③ friends: progress bar, search, counts on the age tabs, a rarity colour per card (src/ui2611.css makes the grid)
const fr = $('friends'); let q = '', foc = null, fOpen = false; // foc: the search box had the focus (its caret) when friends.js drew the sheet again
const habOf = () => { const t = fr.querySelector('.fhead span')?.textContent ?? ''; return Object.values(HAB).find(h => t.startsWith(h.name + ' ')); };
const hay = a => [callName(a), kindName(a), SP[a.species]?.name ?? ''].join(' ').toLowerCase();
function filter() {
  const k = q.trim().toLowerCase();
  for (const r of fr.querySelectorAll('.frow')) { const a = G.S.animals.find(x => x.id === +r.dataset.id); r.hidden = !!k && !(a && hay(a).includes(k)); }
}
function friends() {
  const sh = fr.querySelector('.fsheet'), H = habOf(); if (!sh || !H || sh.querySelector('.u26find')) return;
  const out = outIn(G.S, H.id), [, n, cap] = /(\d+)\/(\d+)/.exec(sh.querySelector('.fhead span').textContent) || [];
  const bar = mk('div', 'u26prog'), fill = mk('i'); fill.style.width = Math.min(100, n / cap * 100 || 0) + '%'; bar.append(fill); bar.ariaHidden = 'true';
  const find = mk('label', 'u26find'), inp = mk('input'); inp.type = 'search'; inp.placeholder = w('find'); inp.value = q; inp.enterKeyHint = 'search';
  find.append(mk('i'), mk('span', 'u26sr', w('findL')), inp);
  const keep = () => { foc = [inp.selectionStart, inp.selectionEnd]; }; // 2611a 검토 ③: a redraw (friends.js innerHTML) takes the box away under the finger
  inp.oninput = () => { q = inp.value; filter(); keep(); }; inp.onfocus = inp.onkeyup = inp.onpointerup = inp.onselect = inp.onselectionchange = keep;
  inp.onblur = () => { keep(); setTimeout(() => { if (inp.isConnected) foc = null; }); }; // the caret as it went; a real blur (the box still there after the redraw's own) forgets it
  inp.onchange = e => e.stopPropagation(); // the box's change (Chrome fires it as the redraw takes the box away) is not one of friends.js's pickers: its draw() inside that redraw threw (NotFoundError)
  const srow = mk('div', 'u26srow'), fb = mk('button', 'u26fb'), pan = mk('div', 'u26fpan'), sel = [...sh.querySelectorAll('.fbar :is([data-fsp],[data-rar])')]; // 316 ④: 희귀도·종 고르개는 「필터」 안에
  const on = sel.filter(s => s.value).length; fb.type = 'button'; fb.textContent = on ? `${w('filt')} ${on}` : w('filt'); fb.classList.toggle('on', !!on); fb.ariaExpanded = String(fOpen);
  fb.onclick = () => { fOpen = !fOpen; pan.hidden = !fOpen; fb.ariaExpanded = String(fOpen); };
  pan.hidden = !fOpen; pan.append(...sel); srow.append(find, fb);
  sh.querySelector('.fhead').after(bar, srow, pan);
  const cnt = { all: out.length, baby: out.filter(a => a.stage === 'baby').length }; cnt.adult = cnt.all - cnt.baby;
  for (const b of sh.querySelectorAll('.fbar [data-stage]')) b.append(mk('small', 'u26n', ' ' + cnt[b.dataset.stage]));
  for (const r of sh.querySelectorAll('.frow')) { const e = r.querySelector('em[data-r]'); r.style.setProperty('--u26-rc', RC[e?.dataset.r] ?? e?.style.backgroundColor ?? '#8A8178'); }
  filter();
  if (foc && (document.activeElement === document.body || !document.activeElement)) { const c = foc; inp.focus({ preventScroll: true }); inp.setSelectionRange(...c); } // c: focus() runs keep() (the new box's caret)
}
new MutationObserver(() => { if (fr.hidden) foc = null; friends(); }).observe(fr, { childList: true, attributes: true, attributeFilter: ['hidden'] }); // 2611b 검토 1: closed without a blur (Esc, iOS): no caret kept for the next open

// 316 단계 2 ⑥: 시리즈 「교환」은 확인 한 번 (series.js spends the tokens on the tap; this asks first, then taps it for real)
let swapGo = false;
document.addEventListener('click', e => {
  const b = e.target.closest?.('#ser .sswap[data-swap]'); if (!b || b.disabled || swapGo) return;
  if ($('ask')) { e.stopPropagation(); e.preventDefault(); return; } // a second tap while the window is up: one window
  e.stopPropagation(); e.preventDefault();
  const k = b.dataset.swap, [sp, vr] = k.split(':'), r = variantOf(sp, vr)?.rarity;
  ask(w('swapQ', serOf(k)?.name ?? '', RAR[r]?.name ?? '', STAMP.swap[r] ?? ''), w('swapOk')).then(ok => { if (ok && b.isConnected && !b.disabled) { swapGo = true; try { b.click(); } finally { swapGo = false; } } });
}, true);

G.on(() => { main(); hatch(); if (!fr.hidden) friends(); });
main(); hatch(); friends();
