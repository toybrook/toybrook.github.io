// 16-1 우리 애 놀러 보내기 (the rules: game/visit.js). This file reads #visit= / #postcard= from the address (then wipes it),
// shows the guest's arrival card when the screen is quiet (a new player: on the intro card first, the guest after the first
// friend), the 친구네 놀러 가기 sheet (산책, stroll.js), the postcard a host picks when a guest leaves, and the 방명록.
// Links go out with the share sheet, else copied. Counts only to stats (visit_sent / visit_got).
import * as G from '../game/game.js';
import { BALANCE as B } from '../game/data.js';
import { HAB, kindName, callName, firstEgg } from '../game/rules.js';
import * as V from '../game/visit.js';
import { toast, josa, topWindow, overlayOpen, resting } from './hud.js';
import { copyNow } from './report.js';
import { track } from './stats.js';

const $ = id => document.getElementById(id), box = $('visit');
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const H = Math.round(B.visit.stay / 3600e3);
let nav = null, wait = null, quiet = 0, fresh = false; // wait: a guest read from the link, not let in yet; fresh: it came with a new player
const thumb = (img, a) => img && import('./thumbs.js').then(t => t.figureThumb(a.species, a.variant, a.color, a.acc, 'adult')).then(u => { img.src = u; }, () => {}); // three.js: not on the first screen (26-1)
const link = (k, code) => `${location.origin}${location.pathname}#${k}=${code}`;
const left = g => { const m = Math.max(0, Math.ceil((g.until - G.now()) / 60e3)); return m >= 60 ? `${Math.ceil(m / 60)}시간 더 머물러요` : `${m}분 더 머물러요`; };
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const busy = () => firstEgg(G.S) || !box.hidden || topWindow() || overlayOpen() || !$('loading').hidden && !$('loading').closest('.scene.hidden') || $('tabOff')
  || document.body.classList.contains('photo') || document.hidden || !fresh && resting(); // the guest a new player came for: not held by the first 10 minutes' rest

// the share sheet if there is one, else copied (a cancelled share sends nothing more)
async function send(url, text) {
  if (navigator.share) { try { await navigator.share({ title: '토이브룩', text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  toast(copyNow(url) !== false ? '링크를 복사했어요 · 메신저에 붙여 넣어 보내 주세요' : '복사하지 못했어요', 2800);
}

function readHash() {
  const m = /^#(visit|postcard)=([A-Za-z0-9._-]+)$/.exec(location.hash); if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (m[1] === 'visit') { wait = V.readVisit(m[2]); return; } // a cut or edited link: nothing, quietly
  const c = V.readCard(m[2]); if (!c) return;
  const out = G.takeCard(c);
  setTimeout(() => toast(out?.err === 'got' ? '이미 받은 엽서예요' : out?.err ? '이 기기에서 보낸 친구의 엽서가 아니에요' : '엽서가 왔어요 · 우편함(✉)에서 받아요', 3000), 600);
  if (!out?.err) { const b = $('mailBtn'); b?.classList.add('new'); if (b) b.hidden = false; }
}
// a new player: the guest on the intro card, and its button says why to start
function onIntro() {
  const intro = $('intro'); if (!wait || intro.hidden || intro.querySelector('.vfig')) return;
  fresh = true; const nm = kindName(wait);
  intro.querySelector('h2').insertAdjacentHTML('afterend', `<figure class="vfig"><img alt="${esc(nm)}"><figcaption>${esc(V.gardenName(wait.g))}의 ${esc(nm)}${josa(nm, '이', '가')} 놀러 오려고 해요</figcaption></figure>`);
  thumb(intro.querySelector('.vfig img'), wait); $('introStart').textContent = '이 친구를 만나러 시작하기';
}
const ERR = { own: '내가 보낸 링크예요 · 친구에게 보내 주세요', got: '이미 다녀간 손님이에요', full: `손님이 가득해요 · 한 번에 ${B.visit.max}마리까지 머물러요` };
function arrive(v) {
  const r = G.takeVisit(v); if (!r) return;
  if (r.err) return void toast(ERR[r.err], 2800);
  track('visit_got', undefined, 'visit_got#'); const g = r.guest, nm = kindName(g);
  box.innerHTML = `<div><h2>${esc(V.gardenName(g.g))}의 ${esc(nm)}${josa(nm, '이', '가')} 놀러 왔어요</h2><figure class="vfig"><img alt=""></figure>
<p class="sub">${HAB[g.hab].name}에서 ${H}시간 머물러요 · 내 친구가 되지는 않아요<br>쓰다듬고 사진도 찍어 주세요</p>
<div class="nbtns"><button class="sb" data-close>나중에</button><button class="go" data-see="${g.id}" data-hab="${g.hab}">보러 가기</button></div></div>`;
  thumb(box.querySelector('img'), g); box.hidden = false;
}
// when a guest left: the host picks a postcard (or none)
let pic = null, line = 0;
function pick(e) {
  pic = null; line = 0; const nm = kindName(e);
  box.innerHTML = `<div><h2>${esc(V.gardenName(e.g))}의 ${esc(nm)}${josa(nm, '이', '가')} 돌아갔어요</h2><p class="sub">엽서를 보내면 그 정원에 ♥가 가요</p>
<div class="vpics">${V.PICS.map((p, i) => `<button data-pic="${i}" aria-pressed="false">${p}</button>`).join('')}</div>
<div class="vlines">${V.LINES.map((t, i) => `<button data-line="${i}" aria-pressed="${!i}">${t}</button>`).join('')}</div>
<div class="nbtns"><button class="sb" data-skip="${e.lid}">괜찮아요</button><button class="go" data-card="${e.lid}" disabled>엽서 보내기</button></div></div>`;
  box.hidden = false;
}
// 친구네 놀러 가기 (stroll.js, a branch of 산책 since 74): a grown friend of this save
export function sendSheet(a) {
  if (a.stage === 'baby') return void toast('다 자란 친구만 놀러 갈 수 있어요', 2400);
  if (!G.S.visit.garden) G.setGarden([Math.floor(Math.random() * V.GARDEN[0].length), Math.floor(Math.random() * V.GARDEN[1].length)]);
  const nm = callName(a);
  box.innerHTML = `<div><h2>${esc(nm)} 친구네 놀러 가기</h2><figure class="vfig"><img alt=""></figure>
<p class="sub">링크를 받은 사람의 서식지에 ${H}시간 손님으로 머물러요. 내 친구는 그대로 여기 있어요</p>
<p class="vgarden">우리 정원 <b>${V.gardenName(G.S.visit.garden)}</b> <button class="sb" data-garden>바꾸기</button></p>
<div class="nbtns"><button class="sb" data-close>닫기</button><button class="go" data-send="${a.id}">링크 보내기</button></div></div>`;
  thumb(box.querySelector('img'), a); box.hidden = false;
}
// 방명록: who is here now, who came, the postcards back
export function openBook() {
  const { guests, book, cards } = G.S.visit, row = (a, t, s, b = '') => `<li><img class="vth" data-i="${a.i}" alt=""><span>${esc(t)}<small>${esc(s)}</small></span>${b}</li>`, all = [];
  const L = (list, f) => list.map(x => { x = { ...x, i: all.push(x) - 1 }; return f(x); }).join('');
  box.innerHTML = `<div><h2>방명록</h2>${guests.length + book.length + cards.length ? '' : '<p class="note">아직 다녀간 손님이 없어요. 친구 ⋯ › 산책 › 「친구네 놀러 가기」로 링크를 보내 보세요</p>'}
${guests.length ? `<b class="vhd">지금 머무는 손님</b><ul>${L(guests, g => row(g, V.guestName(g), `${HAB[g.hab].name} · ${left(g)}`, `<button data-see="${g.id}" data-hab="${g.hab}">보기</button>`))}</ul>` : ''}
${book.length ? `<b class="vhd">다녀간 손님</b><ul>${L([...book].reverse(), e => row(e, V.guestName(e), `${md(e.at)}${e.pic != null ? ` · 엽서 ${V.PICS[e.pic]} ${V.LINES[e.line]}` : ''}`, e.pick ? `<button data-pickof="${e.lid}">엽서</button>` : ''))}</ul>` : ''}
${cards.length ? `<b class="vhd">받은 엽서</b><ul>${L([...cards].reverse(), c => row(c, `${V.PICS[c.pic]} ${V.LINES[c.line]}`, `${V.gardenName(c.g)} · ${kindName(c)}${c.got ? '' : ' · 우편함에서 받기'}`))}</ul>` : ''}
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  box.querySelectorAll('img.vth').forEach(img => thumb(img, all[+img.dataset.i])); box.hidden = false;
}

box.onclick = e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d) return;
  if (d.close != null) { box.hidden = true; return; }
  if (d.see) { box.hidden = true; return void nav?.go(d.hab, d.see); }
  if (d.garden != null) { const [a, c] = G.S.visit.garden; G.setGarden([(a + 1 + Math.floor(Math.random() * 11)) % V.GARDEN[0].length, (c + 1 + Math.floor(Math.random() * 11)) % V.GARDEN[1].length]);
    box.querySelector('.vgarden b').textContent = V.gardenName(G.S.visit.garden); return; }
  if (d.send) { const out = G.sendVisit(+d.send); box.hidden = true; if (!out) return void toast('지금은 보낼 수 없어요');
    track('visit_sent', undefined, 'visit_sent#'); const a = G.S.animals.find(x => x.id === +d.send), nm = a ? kindName(a) : '친구';
    return void send(link('visit', out.code), `${V.gardenName(G.S.visit.garden)}의 ${nm}${josa(nm, '이', '가')} 놀러 가요 · 토이브룩`); }
  if (d.pickof) { const x = G.S.visit.book.find(y => y.lid === d.pickof); if (x) pick(x); return; }
  if (d.pic != null) { pic = +d.pic; box.querySelectorAll('[data-pic]').forEach(x => x.setAttribute('aria-pressed', x === b)); box.querySelector('[data-card]').disabled = false; return; }
  if (d.line != null) { line = +d.line; box.querySelectorAll('[data-line]').forEach(x => x.setAttribute('aria-pressed', x === b)); return; }
  if (d.skip) { G.pickCard(d.skip, null, 0); box.hidden = true; return; }
  if (d.card && pic != null) { const code = G.pickCard(d.card, pic, line); box.hidden = true; if (code) send(link('postcard', code), `${V.PICS[pic]} ${V.LINES[line]} · 토이브룩 엽서`); }
};

// a quiet screen (1.6 s; a new player's guest 6 s after the first friend is out): the guest comes in, then a postcard to pick
setInterval(() => {
  if (!G.S || busy() || !(wait || G.S.visit.book.some(x => x.pick))) { quiet = 0; return; }
  if ((quiet += 800) < (fresh ? 6000 : 1600)) return;
  quiet = 0; if (wait) { const v = wait; wait = null; fresh = false; return arrive(v); }
  pick(G.S.visit.book.find(x => x.pick));
}, 800);
export function initVisit(n) { nav = n; readHash(); onIntro(); addEventListener('hashchange', () => { readHash(); quiet = 0; }); }
