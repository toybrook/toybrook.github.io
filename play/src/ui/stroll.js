// 13-1 산책 보내기: the length picker (the animal card, 친구들 ⋯, 보관함's 산책) and the 엽서 album (보관함's 엽서, 돌아왔어요).
// A postcard: the place's picture (SCENES, drawn here), the friend's figure on it, its line (data.js PLACES), what it brought.
import * as G from '../game/game.js';
import { BALANCE as B, PLACES, PROPS, MYTHIC } from '../game/data.js';
import { strollCap, strolling, callName, mythHill } from '../game/rules.js';
import { figureThumb } from './thumbs.js';
import { toast, josa } from './hud.js';

const FH = MYTHIC[0].place, PL = Object.fromEntries([...PLACES, FH].map(p => [p.id, p])), PNAME = Object.fromEntries(PROPS.map(p => [p.id, p.name]));
export const cardLine = c => (PL[c.pl]?.lines[c.ln] ?? '').replace('{n}', c.nm).replace(/\{(.)\/(.)\}/g, (_, a, b) => josa(c.nm, a, b));
export const strollLeft = a => { const m = Math.max(1, Math.ceil((a.stroll.end - G.now()) / 60000)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const host = () => document.getElementById('habitat');

let menu = null;
export function pickStroll(a) {
  const nm = callName(a), n = strolling(G.S).length, cap = strollCap(G.S), R = B.stroll, full = n >= cap;
  menu?.remove(); menu = document.createElement('section'); menu.className = 'intro pop fmenu'; menu.id = 'fmenu';
  menu.innerHTML = `<div><h2>산책 보내기</h2><p class="sub">${nm} · ${full ? `지금 ${n}마리가 산책 중이라 더 못 가요` : `산책 중 ${n}/${cap} · 돌아오면 엽서와 하트를 줘요`}</p><div class="col">${
    R.hours.map(h => `<button data-h="${h}"${full ? ' disabled' : ''}>${h}시간 · ♥${R.hearts[h]}${R.candy[h] ? ` · 사탕 ${R.candy[h]}` : ''}</button>`).join('')}${mythHill(G.S) ? `<button data-h="${R.hours[0]}" data-pl="${FH.id}"${full ? ' disabled' : ''}>🔥 ${FH.name} · ${R.hours[0]}시간 · ${MYTHIC[0].hair}</button>` : ''}<button class="sb" data-shut>닫기</button></div></div>`;
  menu.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const h = +b.dataset.h; if (h && G.sendStroll(a.id, h, b.dataset.pl)) toast(`${nm}${josa(nm, '이', '가')} 산책을 나갔어요 · ${h}시간 뒤에 돌아와요`, 2600);
    menu.remove(); menu = null;
  };
  host().append(menu);
}

// the pictures: a 300x200 scene each, flat shapes in the game's colours (no outside art)
const sky = c => `<rect width="300" height="200" fill="${c}"/>`, cloud = (x, y, k = 1) => `<g fill="#fff" opacity=".9"><ellipse cx="${x}" cy="${y}" rx="${22 * k}" ry="${9 * k}"/><ellipse cx="${x + 12 * k}" cy="${y - 6 * k}" rx="${13 * k}" ry="${9 * k}"/></g>`;
const tree = (x, y, k = 1, c = '#5fae4a') => `<rect x="${x - 3 * k}" y="${y}" width="${6 * k}" height="${18 * k}" rx="${2 * k}" fill="#8a5733"/><circle cx="${x}" cy="${y - 4 * k}" r="${16 * k}" fill="${c}"/>`;
const SCENES = {
  brook: sky('#cfe8f5') + cloud(60, 40) + `<rect y="110" width="300" height="90" fill="#8fcf6a"/><path d="M0 150 C60 130 110 175 170 150 S260 135 300 150 V180 C240 165 200 190 150 178 S50 170 0 182Z" fill="#6fb6e8"/>` + [[70, 162], [120, 168], [175, 160], [225, 158]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="5" fill="#d9d3c8"/>`).join(''),
  flowers: sky('#fde7cf') + cloud(230, 36) + `<rect y="112" width="300" height="88" fill="#9bd36f"/>` + Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 47) % 300 + 6}" cy="${120 + (i * 29) % 74}" r="${4 + i % 3}" fill="${['#ff8fb3', '#ffd54a', '#fff7ee', '#e9873e'][i % 4]}"/>`).join(''),
  hill: sky('#bfe0f7') + cloud(70, 44, 1.2) + cloud(210, 28, 0.8) + `<ellipse cx="200" cy="215" rx="190" ry="105" fill="#7cc56a"/><ellipse cx="40" cy="225" rx="140" ry="85" fill="#93d27a"/>`,
  forest: sky('#e3f1d6') + `<rect y="120" width="300" height="80" fill="#86c463"/>` + [[30, 100, 1.3], [85, 92, 1.6, '#4f9a3f'], [250, 96, 1.5, '#4f9a3f'], [290, 104, 1.1], [200, 108, 1]].map(([x, y, k, c]) => tree(x, y, k, c)).join('') + `<path d="M120 200 C135 160 165 150 170 120 L182 120 C185 150 205 170 210 200Z" fill="#e3c99a"/>`,
  lake: sky('#ffd3b0') + `<circle cx="225" cy="105" r="26" fill="#ffb36b"/><rect y="105" width="300" height="95" fill="#8fcf6a"/><ellipse cx="160" cy="150" rx="135" ry="34" fill="#6fa9e0"/><ellipse cx="160" cy="146" rx="60" ry="5" fill="#ffd3b0" opacity=".6"/>`,
  firehill: sky('#ffd9b0') + `<circle cx="70" cy="70" r="22" fill="#ffb36b"/><ellipse cx="170" cy="225" rx="200" ry="110" fill="#d9894a"/><ellipse cx="40" cy="230" rx="130" ry="80" fill="#c46a3a"/>` + [[150, 128], [205, 140], [110, 150]].map(([x, y]) => `<path d="M${x} ${y} q-8 -12 0 -24 q8 12 0 24Z" fill="#ff7a2a"/><path d="M${x} ${y} q-4 -7 0 -13 q4 6 0 13Z" fill="#ffe08a"/>`).join(''), // 14-1 불의 언덕
  path: sky('#cfe8f5') + cloud(220, 40) + `<rect y="108" width="300" height="92" fill="#a5d67a"/><path d="M0 200 C80 170 170 150 200 108 L214 108 C200 160 150 185 120 200Z" fill="#ead2a2"/>` + [40, 75, 110, 145].map(x => `<rect x="${x}" y="${120 - x / 20}" width="6" height="24" rx="2" fill="#b07a48"/>`).join('') + `<rect x="36" y="128" width="118" height="5" rx="2" fill="#b07a48"/>`,
};
const scene = id => `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENES[id] ?? sky('#cfe8f5')}</svg>`;
const when = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

const el = document.getElementById('cards');
export function openCards() {
  const list = [...G.S.cards].reverse(), been = new Set(G.S.cards.map(c => c.pl).filter(p => p !== FH.id)).size;
  el.innerHTML = `<div class="chead"><b>엽서</b><span>${list.length}장 · 가 본 곳 ${been}/${PLACES.length}</span><button class="back" data-close>닫기</button></div>
<div class="cbody">${list.length ? '' : '<p class="cnote">친구를 산책 보내면 엽서가 와요 · 친구를 누르거나 보관함에서 「산책」</p>'}<div class="pcards">${list.map(c => `<figure class="pcard">
<div class="ppic">${scene(c.pl)}<img alt="${c.nm}">${c.new ? '<i>NEW</i>' : ''}</div><figcaption><b>${cardLine(c)}</b><small>${PL[c.pl]?.name ?? ''} · ${c.h}시간 · ${when(c.at)} · ♥+${c.hearts}${c.candy ? ` · 사탕 ${c.candy}` : ''}${c.prop ? ` · ${PNAME[c.prop]}` : ''}${c.myth ? ` · ${c.myth}` : ''}</small></figcaption></figure>`).join('')}</div></div>`;
  el.querySelectorAll('.pcard img').forEach((img, i) => { const c = list[i]; figureThumb(c.sp, c.v, c.c, c.acc, c.st).then(u => { img.src = u; }); });
  el.hidden = false;
  if (list.some(c => c.new)) G.cardsSeen();
}
el.addEventListener('click', e => { if (e.target.closest('[data-close]')) el.hidden = true; });
