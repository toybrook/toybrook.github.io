// 친구들 (inbox 20 B): a bottom sheet listing who is out in this habitat. Top: the species counted (오리 ×4 · 백조 ×2);
// sort and filters as in 보관함 (species, rarity, babies / adults; the storage sorts). A row: picture, name, rarity, baby or
// adult and its growth. Tap (26-4 보러 가기): the sheet goes down and the camera follows that animal, turned to its face,
// until the screen is touched. ⋯ or a long press (or right click): 보러 가기 / 아끼는 친구 (★) / 이름 짓기 / 쓰다듬기 /
// 보관함으로 / 다른 서식지로.
import * as G from '../game/game.js';
import { BALANCE as B, RARITIES } from '../game/data.js';
import { SP, HAB, RAR, variantOf, outIn, capOf, gauge, growing, habitatOf, callName, kindName } from '../game/rules.js';
import { figureThumb } from './thumbs.js';
import { toast, heart, josa } from './hud.js';
import { SORTS } from './store.js';
import { pickStroll } from './stroll.js';
import { openBook } from './visit.js';
import { PE, mateOf } from '../game/pals.js';

const el = document.getElementById('friends');
const rarOf = a => variantOf(a.species, a.variant).rarity;
const stageText = a => a.stage !== 'baby' ? '성체' : `새끼 · ${a.hold ? '성장 멈춤' : growing(a) ? '자라는 중' : ''} ${Math.floor(gauge(a, G.now()) * 100)}%`;
const subText = a => (a.nm ? kindName(a) + ' · ' : '') + stageText(a);
const star = a => a.fav ? '<i class="fav" aria-label="아끼는 친구">★</i>' : '';
let habId = null, hab = null, sort = 'new', stage = 'all', rar = '', fsp = '', shown = '';

export function openFriends(id, api) {
  habId = id; hab = api; el.hidden = false; shown = ''; draw();
  const seen = outIn(G.S, id).filter(a => a.card).map(a => a.id); if (seen.length) G.grownSeen(seen); // the red dot: looked at
}
export const leaveFriends = () => { el.hidden = true; menu?.remove(); hab = null; };
const list = () => outIn(G.S, habId).filter(a => (stage === 'all' || (stage === 'baby') === (a.stage === 'baby')) && (!rar || rarOf(a) === rar) && (!fsp || a.species === fsp)).sort(SORTS[sort][1]);
const sig = () => outIn(G.S, habId).map(a => a.id + a.stage + (a.fav ? '*' : '') + (a.nm || '')).join() + sort + stage + rar + fsp;
G.on(() => { if (el.hidden) return; if (sig() !== shown) { const y = el.querySelector('.flist')?.scrollTop || 0; draw(); el.querySelector('.flist').scrollTop = y; } else tick(); });

function draw() {
  shown = sig();
  const out = outIn(G.S, habId), rows = list(), count = {};
  for (const a of out) count[a.species] = (count[a.species] || 0) + 1;
  if (fsp && !count[fsp]) fsp = '';
  const opt = (v, t, on) => `<option value="${v}"${on ? ' selected' : ''}>${t}</option>`;
  el.innerHTML = `<div class="nsheet fsheet" role="dialog" aria-label="친구들">
<div class="fhead"><b>친구들</b><span>${HAB[habId].name} ${out.length}/${capOf(G.S, habId)}</span><button class="back" data-book>방명록</button><button class="back" data-close>닫기</button></div>
<p class="fsum">${Object.entries(count).map(([s, n]) => `${SP[s].name} ×${n}`).join(' · ') || '아직 서식지에 나온 친구가 없어요'}</p>
<div class="fbar"><span class="seg">${[['all', '전체'], ['baby', '새끼'], ['adult', '성체']].map(([k, t]) => `<button data-stage="${k}"${k === stage ? ' class="on"' : ''}>${t}</button>`).join('')}</span>
<select data-fsp aria-label="종">${opt('', '모든 종', !fsp)}${Object.keys(count).map(s => opt(s, SP[s].name, s === fsp)).join('')}</select>
<select data-rar aria-label="등급">${opt('', '모든 등급', !rar)}${RARITIES.map(r => opt(r.id, r.name, r.id === rar)).join('')}</select>
<select data-sort aria-label="정렬">${Object.entries(SORTS).map(([k, [t]]) => opt(k, t + '순', k === sort)).join('')}</select></div>
<div class="flist">${rows.map(a => `<div class="frow${a.card ? ' card' : ''}" data-id="${a.id}"><button class="fgo" data-go="${a.id}"><img alt=""><div><b>${star(a)}${callName(a)}</b><small${a.hold ? ' class="hold"' : ''}>${subText(a)}</small></div><em data-r="${rarOf(a)}">${RAR[rarOf(a)].name}</em></button><button class="fmore" data-more="${a.id}" aria-label="${callName(a)} 더 보기">⋯</button></div>`).join('')}</div>
<p class="fnote">${rows.length ? '누르면 보러 가요 · ⋯에서 별 표시·이름 짓기' : out.length ? '고른 조건에 맞는 친구가 없어요' : ''}</p></div>`;
  el.querySelectorAll('.frow img').forEach((img, i) => { const a = rows[i]; figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }); });
}
function tick() { // growth numbers only
  for (const r of el.querySelectorAll('.frow')) { const a = G.S.animals.find(x => x.id === +r.dataset.id); if (a) r.querySelector('small').textContent = subText(a); }
}
function go(id) { // 보러 가기
  const a = G.S.animals.find(x => x.id === id); el.hidden = true; menu?.remove(); menu = null;
  if (!a || !hab?.look(id)) return toast('지금은 볼 수 없어요');
  toast(`${callName(a)} 보는 중 · 화면을 만지면 멈춰요`, 2400);
}

// tap vs long press (450 ms without moving)
let press = null, menu = null;
el.addEventListener('pointerdown', e => {
  const r = e.target.closest('.frow'); if (!r) return;
  press = { id: +r.dataset.id, x: e.clientX, y: e.clientY, t: setTimeout(() => { press.long = true; more(press.id); }, 450) };
});
el.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.t); press = null; } });
addEventListener('pointerup', () => { if (press) clearTimeout(press.t); }, true);
el.addEventListener('contextmenu', e => { const r = e.target.closest('.frow'); if (!r) return; e.preventDefault(); if (press) clearTimeout(press.t); press = { long: true }; more(+r.dataset.id); });
el.addEventListener('change', e => { const d = e.target.dataset; if (d.rar != null) rar = e.target.value; if (d.sort != null) sort = e.target.value; if (d.fsp != null) fsp = e.target.value; draw(); });
el.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.close != null) { el.hidden = true; return; }
  if (b.dataset.book != null) { el.hidden = true; return openBook(); } // 16-1
  if (b.dataset.stage) { stage = b.dataset.stage; draw(); return; }
  const long = press?.long; press = null; if (long) return;
  if (b.dataset.more) more(+b.dataset.more);
  else if (b.dataset.go) go(+b.dataset.go);
});

function more(id) {
  const a = G.S.animals.find(x => x.id === id); if (!a) return;
  const nm = callName(a), home = SP[a.species].habitat, guest = habitatOf(a) !== home;
  const m = G.S.animals.find(x => x.id === mateOf(G.S, a.id)), pe = G.S.flags.palOff || !PE[a.pe] ? '' : `<p class="sub pe">${PE[a.pe].name} · ${PE[a.pe].line}${m ? `<br>단짝: ${callName(m)}` : ''}</p>`; // 17-1 성격과 단짝
  menu?.remove(); menu = document.createElement('section'); menu.className = 'intro pop fmenu'; menu.id = 'fmenu';
  menu.innerHTML = `<div><h2>${star(a)}${nm}</h2>${a.nm ? `<p class="sub">${kindName(a)}</p>` : ''}${pe}<div class="col"><button data-do="go">보러 가기</button>
<button data-do="fav" aria-pressed="${!!a.fav}">${a.fav ? '★ 별 떼기' : '☆ 아끼는 친구로'}</button><button data-do="name">${a.nm ? '이름 바꾸기' : '이름 짓기'}</button>
<button data-do="pet">쓰다듬기</button><button data-do="walk">산책 보내기</button><button data-do="store">보관함으로</button><button data-do="move">다른 서식지로</button><button class="sb" data-shut>닫기</button></div></div>`;
  menu.onclick = e => {
    const d = e.target.closest('button')?.dataset; if (!d) return;
    if (d.do === 'go') return go(a.id);
    if (d.do === 'name') return naming(a);
    if (d.do === 'walk') { menu.remove(); menu = null; return pickStroll(a); }
    if (d.do === 'pet') { const n = G.tapHeart(a.id); const r = e.target.getBoundingClientRect(); if (n) heart(r.left + r.width / 2, r.top); toast(n ? `${nm}${josa(nm, '이', '가')} 좋아해요 ♥+${n}` : G.S.pet.n >= B.heart.daily ? '오늘 쓰다듬기 하트는 다 모았어요' : '방금 쓰다듬었어요 · 조금 뒤에 다시', 2200, true); return; }
    if (d.do === 'fav') toast(G.setFav(a.id, !a.fav)?.fav ? `${nm}${josa(nm, '은', '는')} 아끼는 친구예요 · 보관함의 여러 마리 돌려보내기에서 빠져요` : `${nm}의 별을 뗐어요`, 2600);
    if (d.do === 'store' && G.store(a.id)) toast(`${nm}${josa(nm, '을', '를')} 보관함에 넣었어요`);
    // each species lives in one habitat (a guest goes home once its home opens: rules.settle)
    if (d.do === 'move') toast(guest ? `${nm}${josa(nm, '은', '는')} ${HAB[home].name}이 열리면 그리로 이사 가요` : `${SP[a.species].name}${josa(SP[a.species].name, '은', '는')} ${HAB[home].name}에서만 살아요`, 2600);
    menu.remove(); menu = null;
  };
  el.closest('#habitat').append(menu);
}
// 이름 짓기: up to 8 letters (rules.cleanName); empty takes the name off. Names stay in this save (not in 꾸미기 코드).
function naming(a) {
  menu.innerHTML = `<div><h2>이름 짓기</h2><p class="sub">${kindName(a)} · 8글자까지 · 비우면 이름이 없어져요</p>
<input class="fname" maxlength="8" autocomplete="off" aria-label="이름" placeholder="${kindName(a)}"><div class="nbtns"><button class="sb" data-cancel>취소</button><button class="go" data-ok>저장</button></div></div>`;
  const inp = menu.querySelector('input'); inp.value = a.nm || ''; inp.focus();
  const done = ok => { if (ok) { const r = G.setName(a.id, inp.value); toast(r?.nm ? `이제 「${r.nm}」${josa(r.nm, '이에요', '예요')}` : '이름을 지웠어요'); } menu.remove(); menu = null; };
  inp.onkeydown = e => { if (e.key === 'Enter') done(true); };
  menu.onclick = e => { const d = e.target.closest('button')?.dataset; if (d) done(d.ok != null); };
}
