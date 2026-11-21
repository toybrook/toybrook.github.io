// 14-1 신수의 부름: drives the meadow's layer (habitat/myth.js set) and answers its taps (the fire prints, the burnt hoofprints,
// the altar, a pet); the altar's window (its 3 flames, each with a hint that goes to its screen, the story pages, 부르기); its
// coming (the cutscene when the meadow is on screen; came while away: 돌아왔어요's top row, main.js); the 신수 card once it settles.
// The rules are rules.js mythTick; the codex's 신수 row is codex.js.
import { $t, SEP } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { dayNo } from '../game/clock.js';
import { BALANCE, MYTHIC, HOLD } from '../game/data.js';
import { HAB, SP, mythNight, mythPrints, NIGHT } from '../game/rules.js';
import { toast, topWindow, overlayOpen, eat } from './hud.js';
import { sfx } from './sound.js';

const MY = MYTHIC[0], $ = id => document.getElementById(id), box = $('myth'), cutEl = $('mythCut');
let at = () => null, hab = () => null, view = null, nav = null; // view: what the window shows ('altar' | a page number); nav: main.js's (167 「가 보기」 from another screen)
// 167 신수 안내·진행 표시: a trial until the chat OKs the photos (tools/build-web.mjs turns it off; off: the windows as before)
export const G167 = true; // 171: the 167 guide is public (UI, chat OK 11/19)
// 14-2 이야기 카드: given once each (flags story_m / story_s), when its coming was seen and when its last page was read
const story = (k, id) => { const f = 'story_' + k + (id ? '_' + id : ''); if (G.S.flags[f]) return; G.flag(f); import('./story.js').then(m => m.giveStory(k, id)); }; // 158: story_s_<id> the next ones'
const lit = M => !!M.hair + !!M.play + !!M.big;
const H = () => at() === MY.habitat ? hab()?.myth : null;
const busy = () => topWindow() || overlayOpen() || !$('loading').hidden || document.body.classList.contains('photo') || document.hidden || $('tabOff') || !box.hidden || !cutEl.hidden;
const sync = () => { const M = G.S?.myth[MY.id]; if (M) H()?.set(G.mythStage(), lit(M), !!M.here && !M.shown); };
// the 신수 card: on its stand, like a limited figure in its box
export const mythCard = () => $t('<figure class="mcard"><div class="mstand"><img alt="{0}"></div><figcaption><b>{1}</b><small>신수 · {2}</small></figcaption></figure>', MY.name, MY.name, HAB[MY.habitat].name);
// 199 A Q4: one picture for any mythic not met yet (「신수란?」, the codex): a glowing egg with a 「?」 and starlight, no mythic's own
const star = (x, y, r) => `<path d='M${x} ${y - r}l${r * .25} ${r * .75} ${r * .75} ${r * .25}-${r * .75} ${r * .25}-${r * .25} ${r * .75}-${r * .25}-${r * .75}-${r * .75}-${r * .25} ${r * .75}-${r * .25}z' fill='#ffd257'/>`;
export const MYSTERY = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>
<radialGradient id='g'><stop offset='0' stop-color='#fff3b8'/><stop offset='.55' stop-color='#ffe08a' stop-opacity='.55'/><stop offset='1' stop-color='#ffd36b' stop-opacity='0'/></radialGradient>
<radialGradient id='e' cx='.38' cy='.32' r='.8'><stop offset='0' stop-color='#fffef6'/><stop offset='.55' stop-color='#ffeab4'/><stop offset='1' stop-color='#eeb862'/></radialGradient></defs>
<circle cx='50' cy='54' r='47' fill='url(#g)'/><path d='M50 17C35 17 25 41 25 57c0 15 11 26 25 26s25-11 25-26C75 41 65 17 50 17z' fill='url(#e)' stroke='#dca04c' stroke-width='1.6'/>
<path d='M42 45.5a8 8 0 1 1 11.6 7.1c-2.7 1.4-3.6 2.9-3.6 5.6v2.3' fill='none' stroke='#c47f2e' stroke-width='5.2' stroke-linecap='round'/><circle cx='50' cy='70' r='3.4' fill='#c47f2e'/>
${star(17, 26, 7)}${star(83, 22, 5)}${star(86, 60, 6)}${star(14, 66, 4)}</svg>`);
const cardImg = el => { const img = el.querySelector('.mstand img'); if (img) import('./thumbs.js').then(t => t.mythThumb(false, false, 0)).then(u => { img.src = u; }, () => {}); };
// what to do next (the codex's "?" and the altar)
export function mythHint(id) {
  const g = byId(id); if (g) return guestHint(g); // 158
  const s = G.mythStage();
  return { null: G167 ? waitLine(MY) : $t('아직 아무 소식이 없어요'), prints: $t('들판 가장자리에 무언가 남아 있어요'), fire: $t('들판에 모닥불을 놓고 하룻밤 지내 보세요'), trace: $t('모닥불 곁에 무언가 남았어요'),
    altar: $t('옛 제단의 불 세 개를 켜 보세요'), ready: $t('옛 제단에서 부를 수 있어요'), called: $t('오늘 밤 옛 제단에 찾아와요') }[s] ?? '';
}
function page(i, more = '') {
  G.mythRead(i); view = i; cur = MY;
  box.innerHTML = $t('<div><small class="mk">신수의 부름 · 이야기 {0}/{1}</small>{2}{3}{4}\n<div class="nbtns">{5}<button class="go" data-close>확인</button></div></div>', i + 1, MY.pages.length, i === 4 ? mythCard() : '', MY.pages[i].map(t => `<p>${t}</p>`).join(''), more ? `<p class="sub">${more}</p>` : '', i ? $t('<button class="sb" data-altar>제단 보기</button>') : '');
  cardImg(box); box.hidden = false;
}
function draw() {
  const M = G.S.myth[MY.id], s = G.mythStage(), sc = Math.min(Object.keys(G.S.scenes).length, MY.scenes), C = BALANCE.myth; view = 'altar'; cur = MY;
  const rows = [['hair', MY.hair, FIREHINT[0], 'walk', 1], ['play', $t('놀이 장면 {0}/{1}', sc, MY.scenes), FIREHINT[1], 'scenes', 2], ['big', $t('큰 소품 하나'), FIREHINT[2], 'big', 3]];
  const call = { altar: G167 ? $t('<p class="sub">단서(불) {0}/3 · 세 개가 다 켜지면 부를 수 있어요</p>', lit(M)) : $t('<p class="sub">불 세 개가 다 켜지면 부를 수 있어요 ({0}/3)</p>', lit(M)), ready: $t('<p class="sub">부르면 오늘 밤 제단에 찾아와요</p>'),
    called: $t('<p class="sub">{0} 제단에 찾아와요</p>', M.arrive <= G.now() ? $t('곧') : $t('오늘 밤')),
    guest: $t('<p class="sub">손님으로 머물고 있어요 · 친밀도 {0}/{1}<br>하루에 한 번 쓰다듬거나, 제단 곁에 놀이 소품을 두면 친밀도가 올라요</p>', M.bond || 0, C.guest),
    home: $t('{0}<p class="sub">들판에 머물고 있어요</p>', mythCard()) }[s] ?? '';
  box.innerHTML = $t('<div><h2>옛 제단</h2><ul>{0}</ul>{1}\n<div class="nbtns"><button class="sb" data-page="0">이야기 1</button>{2}<button class="sb" data-close>닫기</button></div></div>', rows.map(([k, t, hint, go, p]) => `<li><button ${M[k] ? `data-page="${p}"` : `data-go="${go}"`}><i aria-hidden="true">${M[k] ? '🔥' : '○'}</i><span>${t}<small>${M[k] ? $t('불이 켜졌어요 · 이야기 보기') : hint}</small></span></button></li>`).join(''), call, s === 'ready' ? $t('<button class="go" data-call>부르기</button>') : s === 'home' ? $t('<button class="go" data-page="4">이야기 5</button>') : '');
  if (G167) winExtra(MY);
  cardImg(box); box.hidden = false;
}
box.addEventListener('click', async e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d) return;
  const g = cur !== MY && cur; // 158: the next ones' window
  if (d.close != null) { box.hidden = true; if (view === 4) story('s', g ? g.id : null); view = null; return; }
  if (d.next != null) { const f = after; after = null; if (f) return f(); box.hidden = true; view = null; return; } // 167 「신수란?」 확인
  if (d.about != null) { const w = cur; return about(() => w === MY ? draw() : drawG(w)); }
  if (d.mgo != null) return goTo(myOf(d.mid), d.mgo);
  if (d.altar != null) return g ? drawG(g) : draw();
  if (d.page != null) return g ? pageG(g, +d.page) : page(+d.page);
  if (d.call != null && g) { if (G.mythCall(g.id)) { sfx('grown'); toast(g.say.called, 2800); } return drawG(g); }
  if (d.call != null) { const t = G.mythCall(); if (t) { sfx('grown'); toast(mythNight(G.now()) ? $t('밤이에요. 곧 찾아와요') : $t('오늘 밤 8시에 찾아와요'), 2800); } return draw(); }
  if (d.go == null) return; // a clue found where it is (158: the jade)
  goTo(cur, d.go);
});
// a clue's (or 167 지금 할 일's) 「가 보기」: its habitat first when it is not on screen (167: from the codex, 돌아왔어요)
async function goTo(m, go) {
  box.hidden = true; view = null; if (!m) return;
  if (at() !== m.habitat && (!nav || await nav.go(m.habitat) === false)) return;
  const api = hab(), g = m !== MY;
  if (go === 'walk') { (await import('./friends.js')).openFriends(at(), api); toast(g ? $t('동물의 ⋯ › 산책에서 아무 곳이나 골라요') : $t('동물의 ⋯ › 산책에서 「불의 언덕」을 골라요'), 3200); }
  if (go === 'decor') (await import('./decor.js')).decorTab('nature');
  if (go === 'camp') (await import('./decor.js')).decorTab('play'); // 167: the campfire
  if (go === 'scenes') (await import('./codex.js')).openCodex('scenes', api);
  if (go === 'big') (await import('./decor.js')).decorTab('big');
  if (go === 'win') g ? drawG(m) : draw();
}
// the habitat's taps (habitat/myth.js): k 'prints' | 'trace' (a: where its gift goes) | 'altar' | 'pet'
export function onMyth(k, a, id) {
  const g = byId(id); if (g) return onGuest(k, g); // 158
  if (k !== 'pet') eat();
  if (k === 'prints') { const r = G.mythSeen(a); if (!r) return; sfx('place'); toast($t('무언가 다녀간 것 같아요…'), 2600);
    import('./codex.js').then(m => m.openMyth(hab()));
    if (r.gift) setTimeout(() => toast(r.gift.placed ? $t('모닥불 하나가 들판에 놓였어요') : $t('모닥불 하나를 꾸미기 › 선물에 넣어 뒀어요'), 3000), 2800); }
  if (k === 'trace') { const r = G.mythTrace(a); if (!r) return; sfx('grown');
    const more = $t('「옛 제단」{0} · 산책 길 「불의 언덕」이 열렸어요', r.placed ? $t('을 모닥불 곁에 놓아 두었어요') : $t('을 꾸미기 › 선물에 넣어 뒀어요')); first(() => page(0, more)); }
  if (k === 'altar') { sfx('place'); draw(); }
  if (k === 'pet') { const r = G.mythPet(); if (!r) return; sfx('place'); if (!r.events.length) toast(r.settled ? $t('불갈기 천리마가 기분 좋아해요') : $t('오늘은 벌써 쓰다듬었어요 · 내일 또 와요'), 1800, true); }
}
// its coming, on screen: the line and 건너뛰기 over the cutscene (≤10 s); main.js 「다시 보기」 too
export function mythCut() {
  const L = H(); if (!L) return false;
  G.mythShown(); cutEl.hidden = false; cutEl.querySelector('p').textContent = `${MY.name}${mythNight(G.now()) ? $t('가 제단에 내려왔어요') : $t('가 제단에 내려왔던 밤이에요')}`;
  L.cut(() => { cutEl.hidden = true; story('m'); const M = G.S.myth[MY.id]; if (!M.settled) toast($t('손님으로 머물러요 · 하루에 한 번 쓰다듬으면 친밀도가 올라요 ({0}/{1})', M.bond || 0, BALANCE.myth.guest), 3400); });
  return true;
}
cutEl.querySelector('button').onclick = () => { H()?.skip(); for (const m of NEXT) GL(m)?.skip(); };
G.on(ev => {
  sync();
  for (const e of ev) if (e.type === 'myth' && e.id === MY.id) { // 152 D: the others' have no window yet
    if (e.what === 'trace' && H()) toast($t('모닥불 곁에 그을린 자국이 남았어요'), 2800, true);
    if (['hair', 'play', 'big'].includes(e.what)) toast($t('옛 제단에 불이 켜졌어요 ({0}/3) · 제단을 눌러 이야기를 읽어요', lit(G.S.myth[MY.id])), 3200);
    if (e.what === 'bond' && !G.S.myth[MY.id].settled) toast($t('{0} 친밀도가 올랐어요 ({1}/{2})', MY.name, e.n, BALANCE.myth.guest), 2600);
  }
  for (const e of ev) { const m = e.type === 'myth' && byId(e.id); if (!m) continue; // 158
    const i = m.clues.indexOf(e.what); if (i >= 0 && e.what !== 'jade') toast($t('{0}의 단서를 찾았어요: {1} ({2}/3)', m.name, m.cl[i][0], found(m, G.S.myth[m.id])), 3200);
    if (e.what === 'bond' && !G.S.myth[m.id].settled) toast($t('{0} 친밀도가 올랐어요 ({1}/{2})', m.name, e.n, m.guest), 2600); }
  syncG(); if (!box.hidden && view === 'altar') { if (cur === MY) draw(); else drawG(cur); }
});
// a quiet screen in the meadow: its coming not seen yet (the cutscene), then the last page and its card once it settled
setInterval(() => {
  sync(); syncG(); if (G167) nightTick();
  for (const m of NEXT) { const M = G.S?.myth[m.id], L = GL(m); if (!M || !L || L.cutting() || busy()) continue; // 158: as the firemane's below
    if (M.here && !M.shown) cutG(m, L); else if (M.settled && !(M.read & 16) && M.shown) { sfx('grown'); pageG(m, 4); } }
  const M = G.S?.myth[MY.id], L = H(); if (!M || !L || L.cutting() || busy()) return;
  if (M.here && !M.shown) mythCut();
  else if (M.settled && !(M.read & 16) && M.shown) { sfx('grown'); page(4); }
}, 800);
export const mythDue = () => { const M = G.S?.myth[MY.id]; return !!M?.here && !M.shown && M.here <= G.now(); }; // came, not seen
export function initMyth(cur, api, n) { at = cur; hab = api; nav = n; }

// ---- 158 유니콘·백록 (160 A 공개): the next ones (data.js MYTHIC152), each with its window built from its data (textContent only):
// its 3 clues (each with its hint and 「가 보기」), the story pages, its call (at night); its prints are where it opens from
// (habitat/myth.js guestLayer), then a tap on it once it came (a pet; petted today: the window)
const NEXT = MYTHIC.slice(1), byId = id => NEXT.find(m => m.id === id);
let cur = MY; // whose window is open
const GL = m => at() === m.habitat ? hab()?.guests?.find(g => g.id === m.id) : null;
const found = (m, M) => m.clues.filter(k => M[k]).length;
const ringN = m => G.S.props.filter(p => p.placed && !p.nat && p.hab === m.habitat && m.ring.includes(p.prop)).length;
const frostN = m => Object.values(G.S.scenes).filter(x => SP[x.sp]?.habitat === m.habitat).length;
const mk = (tag, up, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; up?.append(e); return e; };
const btn = (up, text, cls, data) => { const b = mk('button', up, text, cls); Object.assign(b.dataset, data); return b; };
const syncG = () => { for (const m of NEXT) { const M = G.S?.myth[m.id], s = M && G.mythStage(m.id); if (M) GL(m)?.set(s, !!M.here && !M.shown, s === 'altar' && m.clues.includes('jade') && !M.jade); } };
function guestHint(m) {
  const s = G.mythStage(m.id), M = G.S.myth[m.id];
  return { null: G167 ? waitLine(m) : $t('아직 아무 소식이 없어요'), prints: m.say.where, altar: $t('단서 세 개를 모아 보세요 ({0}/3)', found(m, M)), ready: mythNight(G.now()) ? $t('지금 부를 수 있어요') : m.say.night, called: m.say.called }[s] ?? '';
}
function pageG(m, i) {
  G.mythRead(i, m.id); view = i; cur = m; box.replaceChildren();
  const d = mk('div', box); mk('small', d, $t('신수의 부름 · 이야기 {0}/{1}', i + 1, m.pages.length), 'mk');
  for (const t of m.pages[i]) mk('p', d, t);
  const nb = mk('div', d, null, 'nbtns'); if (i) btn(nb, $t('단서 보기'), 'sb', { altar: '' }); btn(nb, $t('확인'), 'go', { close: '' });
  box.hidden = false;
}
function drawG(m) {
  const M = G.S.myth[m.id], s = G.mythStage(m.id), night = mythNight(G.now()); view = 'altar'; cur = m; box.replaceChildren();
  const d = mk('div', box); mk('h2', d, m.name); const ul = mk('ul', d);
  m.cl.forEach(([name, hint, go], i) => { const k = m.clues[i], got = !!M[k];
    const n = got ? '' : k === 'ring' ? ` ${Math.min(ringN(m), m.need)}/${m.need}` : k === 'frost' ? ` ${Math.min(frostN(m), m.scenes)}/${m.scenes}` : '';
    const b = btn(mk('li', ul), null, null, got ? { page: i + 1 } : go ? { go } : {}); mk('i', b, got ? '✦' : '○').setAttribute('aria-hidden', 'true');
    mk('small', mk('span', b, name + n), got ? $t('단서를 찾았어요 · 이야기 보기') : hint); });
  const sub = { altar: G167 ? $t('단서 {0}/3 · 세 개를 다 찾으면 부를 수 있어요', found(m, M)) : $t('단서 세 개를 다 찾으면 부를 수 있어요 ({0}/3)', found(m, M)), ready: night ? $t('지금 부를 수 있어요') : m.say.night, called: m.say.called,
    guest: $t('손님으로 머물고 있어요 · 친밀도 {0}/{1} · 하루에 한 번 쓰다듬으면 친밀도가 올라요', M.bond || 0, m.guest), home: $t('{0}에 머물고 있어요', HAB[m.habitat].name) }[s];
  if (sub) mk('p', d, sub, 'sub');
  const nb = mk('div', d, null, s === 'ready' && night || s === 'home' ? 'nbtns callrow' : 'nbtns'); btn(nb, $t('이야기 1'), 'sb', { page: 0 });
  if (s === 'ready' && night) btn(nb, m.say.call, 'go', { call: '' }); else if (s === 'home') btn(nb, $t('이야기 5'), 'go', { page: 4 });
  btn(nb, $t('닫기'), 'sb', { close: '' }); if (G167) winExtra(m);
  box.hidden = false;
}
function onGuest(k, m) {
  if (k !== 'pet') eat();
  if (k === 'prints') { sfx('place'); if (G.mythStage(m.id) !== 'prints') return drawG(m); if (G.mythSeen(null, m.id)) { toast(m.say.seen, 2600); first(() => pageG(m, 0)); } }
  if (k === 'find' && G.mythFind(m.id)) { sfx('grown'); pageG(m, 3); }
  if (k === 'pet') { const r = G.mythPet(m.id); if (!r) return; sfx('place'); if (!r.events.length) { if (r.settled) toast(m.say.happy, 1800, true); drawG(m); } }
}
function cutG(m, L) { // its coming, on screen (the line and 건너뛰기 as the firemane's)
  G.mythShown(m.id); cutEl.hidden = false; cutEl.querySelector('p').textContent = m.say.came;
  L.cut(() => { cutEl.hidden = true; const M = G.S.myth[m.id]; if (!M.settled) toast($t('손님으로 머물러요 · 하루에 한 번 쓰다듬으면 친밀도가 올라요 ({0}/{1})', M.bond || 0, m.guest), 3400); });
}

// ---- 167 신수 안내·진행 표시: 「신수란?」 (A), each one's 4 steps and 지금 할 일 (B), the night it can be called (C)
const myOf = id => MYTHIC.find(m => m.id === id);
const FIREHINT = [$t('동물을 「불의 언덕」에 산책 보내면 찾아와요'), $t('동물들이 노는 모습을 보면 담겨요 (본 것도 세요)'), $t('꾸미기 › 큰 소품에서 하나 놓아요 (놓은 것도 세요)')]; // the altar's 3
const nightText = () => $t('밤(오후 {0}시~오전 {1}시)', NIGHT[0] - 12, NIGHT[1]);
const guestN = m => m.guest ?? BALANCE.myth.guest;
const STEP = { prints: 0, fire: 0, trace: 0, altar: 1, ready: 2, called: 2, guest: 3, home: 3 };
let after = null; // what the card's 확인 opens next (이야기 1, or the window it was opened from)
// the 4 steps, `on` lit (-1: none), each label (the card: what they are; a window: where this one is)
function steps(up, on, labels) {
  const ol = mk('ol', up, null, 'msteps');
  [['🐾', $t('발자국 찾기')], ['✦', $t('단서 3개 모으기')], ['🌙', $t('밤에 부르기')], ['🏡', $t('손님 → 획득')]].forEach(([i, t], k) => {
    const li = mk('li', ol, null, k === on ? 'on' : k < on ? 'done' : ''); mk('i', li, i).setAttribute('aria-hidden', 'true'); mk('span', li, labels?.[k] ?? t); });
  return ol;
}
// one that has no news yet: what it waits for (rules.js mythTurn / mythPick, 199 A: one at a time, any of the open ones, so
// 「누군가의」: the next news may be another's; the one coming now not named, its own cell shows it)
function waitLine(m) {
  if (HOLD.myth) return $t('아직 아무 소식이 없어요');
  if (MYTHIC.some(p => G.S.myth[p.id]?.come != null && !G.S.myth[p.id].settled)) return $t('지금 오는 신수를 획득하면 소식이 와요');
  if (!G.S.unlocked.includes(m.habitat)) return $t('{0}{을/를} 열면 소식이 와요', HAB[m.habitat].name);
  const k = dayNo(mythPrints(G.S, m.id)) - dayNo(G.now());
  return k > 1 ? $t('{0}일 뒤 아침에 누군가의 소식이 와요', k) : k === 1 ? $t('내일 아침에 누군가의 소식이 와요') : $t('곧 누군가의 소식이 와요');
}
// 지금 할 일 and where its 「가 보기」 goes (goTo; null: nothing to go to)
function nowOf(m, s, M) {
  if (s === 'altar') { const i = m.clues.findIndex(k => !M[k]); return m === MY ? [FIREHINT[i], ['walk', 'scenes', 'big'][i]] : [m.cl[i][1], m.cl[i][2] || 'hab']; }
  if (s === 'guest') return [$t('손님 {0}/{1}일 · 하루 한 번 쓰다듬으면 친밀도가 올라요', M.bond || 0, guestN(m)), 'hab'];
  if (s === 'ready' && m !== MY && !mythNight(G.now())) return [`${m.say.night} · ${nightText()}`, null];
  if (s === 'home') return [$t('{0}에 머물고 있어요', HAB[m.habitat].name), null];
  return [mythHint(m.id), { prints: 'hab', fire: 'camp', trace: 'hab', ready: 'win', called: 'hab' }[s] ?? null];
}
// B: the steps with this one's place, 지금 할 일 and 「가 보기」 (inWin: in its own window, so no 「가 보기」 to it)
function progress(up, m, inWin) {
  const s = G.mythStage(m.id), M = G.S.myth[m.id] || {}, n = m === MY ? lit(M) : found(m, M);
  steps(up, STEP[s] ?? -1, [$t('발자국'), m === MY ? $t('단서(불) {0}/3', n) : $t('단서 {0}/3', n), $t('밤에 부르기'), s === 'home' ? $t('획득') : s === 'guest' ? $t('손님 {0}/{1}', M.bond || 0, guestN(m)) : $t('손님 → 획득')]);
  const [t, go] = nowOf(m, s, M); if (!t) return;
  const r = mk('div', up, null, 'mnow'), p = mk('p', r); mk('b', p, $t('지금 할 일')); p.append(' ' + t);
  if (go && !(inWin && go === 'win')) btn(r, $t('가 보기'), 'sb', { mgo: go, mid: m.id });
  return t;
}
function winExtra(m) { // the altar / clue window: the steps under its title, 「신수란?」 at its foot
  const d = box.firstElementChild, w = mk('div', null, null, 'mprog'), t = progress(w, m, true); d.querySelector('h2').after(w);
  // 171: the same sentence not twice: a clue's hint that is 지금 할 일 → 「지금 찾는 중」, a line under the list that says it → gone
  if (t) for (const e of d.querySelectorAll(':scope > ul small, :scope > p.sub')) if (e.textContent === t) e.tagName === 'SMALL' ? (e.textContent = $t('지금 찾는 중')) : e.remove();
  btn(d, $t('신수란?'), 'mabtn', { about: '' });
}
export const mythSteps = (up, id) => { const m = myOf(id); if (m) progress(up, m, false); }; // the codex's 신수 cell
export const mythGo = (id, go) => goTo(myOf(id), go);
// A: 「신수란?」. The ones to meet now: MYTHIC but HOLD (its habitat held back: not ready)
function about(next) {
  if (!G.S.flags.mythInfo) G.flag('mythInfo', 1); // first: G.flag's redraw (an open altar) comes before this card
  after = next; view = 'about'; box.replaceChildren();
  const d = mk('div', box, null, 'mabout'); mk('h2', d, $t('신수란?'));
  const img = mk('img', mk('div', mk('figure', d, null, 'mcard'), null, 'mstand')); img.alt = $t('신수 실루엣'); img.src = MYSTERY; // 199 A Q4
  mk('p', d, $t('신수는 서식지를 지켜 주는 특별한 동물이에요. 알에서 태어나지 않아요.'));
  mk('small', steps(d, -1).children[2], nightText());
  mk('p', d, $t('획득하면 서식지에 계속 머물고, 동물 자리를 차지하지 않아요. 이야기 카드도 받아요.'));
  const by = {}; if (!HOLD.myth) for (const m of MYTHIC) if (HAB[m.habitat]?.ready) (by[m.habitat] ??= []).push(m.name);
  mk('p', d, $t('지금 만날 수 있는 신수: {0}', Object.entries(by).map(([h, ns]) => `${HAB[h].name} ${ns.join(' · ')}`).join(SEP)), 'sub');
  btn(mk('div', d, null, 'nbtns'), $t('확인'), 'go', { next: '' }); box.hidden = false;
}
export const mythAbout = () => about(null);
const first = f => !G.S.flags.mythInfo && G167 ? about(f) : f(); // once, right before the first 이야기 1
// C: 「부를 수 있음」 since before tonight's dusk, and night now: a toast if the page was here at dusk, else 돌아왔어요's top row
// (main.js). Once a night: flags.mythInfo = that night's day (any value: 「신수란?」 seen)
let awake = 0; // the last tick the page was seen (0: none yet this load)
const nightOf = t => G.dayOf(t - NIGHT[1] * 36e5), dusk = t => { const x = new Date(t - NIGHT[1] * 36e5); x.setHours(NIGHT[0], 0, 0, 0); return +x; };
export function mythNightDue() {
  const t = G.now(); if (!G167 || !nav || !G.S || !mythNight(t) || G.S.flags.mythInfo === nightOf(t)) return null;
  return MYTHIC.find(m => G.mythStage(m.id) === 'ready' && Math.max(...m.clues.map(k => G.S.myth[m.id][k] || 0)) < dusk(t)) ?? null;
}
export const mythNightText = m => $t('밤이 됐어요 · {0}{을/를} 부를 수 있어요', m.name);
export const mythNightTold = () => G.flag('mythInfo', nightOf(G.now()));
function nightTick() {
  if (!nav || document.hidden) return; const t = G.now(), m = mythNightDue();
  if (m && awake && awake < dusk(t) && t - awake < 10 * 60000) { if ($('toast').classList.contains('on')) return; mythNightTold(); toast(mythNightText(m), 3600); } // another toast up (the sky's at dusk): the next tick
  awake = t;
}
