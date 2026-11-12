// 15-1 계절 이벤트 (docs/event.md). The events are data.js EVENTS; the dates may be moved by events.json beside the game (same
// origin, tools/event.mjs), read when the game opens and every hour while online, the last copy kept for offline (none ever
// read: data.js dates). The rules (coins, the 보상 길, the shop, the album, the end's hearts) are rules.js evTick; this file
// shows them: the coin button atop the right column (곧 끝나요 near the end), the window (상점 / 보상 길 / 앨범), its start and end cards (they wait
// like attend.js for a quiet screen), a toast per 보상 길 step, a 새 소식 row and its weather (config WEATHER.ev).
import * as G from '../game/game.js';
import { PROP, HAB } from '../game/rules.js';
import { BALANCE, EVENTS } from '../game/data.js';
import { WEATHER, calm } from '../config.js';
import { topWindow, overlayOpen, resting, toast } from './hud.js';
import { sfx } from './sound.js';

const $ = id => document.getElementById(id), box = $('event'), btn = $('evBtn'), KEY = 'toyhabitat.cal', DAY = 864e5;
let at = () => null, hab = () => null, tab = 'shop', quiet = 0, pillWas = '', stepWas = {};
try { const c = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(c)) G.setCal(c); } catch { /* none */ }
const load = () => navigator.onLine && fetch('events.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => {
  if (!Array.isArray(d?.events)) return; try { localStorage.setItem(KEY, JSON.stringify(d.events)); } catch { /* full */ } G.setCal(d.events); }).catch(() => {});

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const rew = s => [s.hearts && `♥${s.hearts}`, s.candy && `꼬마 사탕 ${s.candy}개`, PROP[s.prop] && `소품 「${PROP[s.prop].name}」`].filter(Boolean).join(' · ');
const soon = R => R.end - G.now() < BALANCE.event.soon * DAY;
const left = R => { const ms = R.end - G.now(); return ms >= DAY ? `${Math.floor(ms / DAY)}일 남음` : `${Math.max(1, Math.ceil(ms / 3600e3))}시간 남음`; };
const md = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
const hint = n => n.prop ? `「${PROP[n.prop].name}」 놓고 찍기` : n.hab ? `${HAB[n.hab].name}에서 찍기` : n.sky === 'fog' ? '안개 낀 날 찍기' : n.night ? '밤에 찍기' : '찍기';
const TABS = [['shop', '상점'], ['track', '보상 길'], ['album', '앨범']];

function draw() {
  const L = G.event(); if (!L) { box.hidden = true; return; }
  const { R, e } = L, c = e.coin, nx = e.track.findIndex((s, i) => i >= R.step);
  const body = tab === 'shop' ? `<ul>${e.shop.map(i => `<li><img alt=""><span>${esc(PROP[i.prop].name)}${R.buy[i.prop] ? `<small>${R.buy[i.prop]}개 샀어요</small>` : ''}</span><button data-buy="${i.prop}"${R.c < i.price ? ' disabled' : ''}>${c.icon} ${i.price}</button></li>`).join('')}</ul>
<p class="note">산 소품은 꾸미기 › 선물에 들어가요</p>`
    : tab === 'track' ? `<ol>${e.track.map((s, i) => `<li class="${i < R.step ? 'done' : i === nx ? 'next' : ''}"><b>${c.icon} ${s.at}</b><span>${rew(s)}</span>${i < R.step ? '<em>✓</em>' : ''}</li>`).join('')}</ol>
<p class="note">모은 ${c.name} ${R.got}개 · 쓴 것도 세어요</p>`
    : `<ol>${e.album.slots.map(s => `<li class="${R.shots[s.id] ? 'done' : ''}"><i aria-hidden="true">${R.shots[s.id] ? '📷' : '❔'}</i><span>${s.name}<small>${hint(s.need)}</small></span>${R.shots[s.id] ? '<em>✓</em>' : ''}</li>`).join('')}</ol>
<p class="note">사진 모드로 찍으면 한 칸씩 채워져요 · 다 채우면 「${PROP[e.album.prop].name}」${R.cover ? ' 받았어요' : ''}</p>`;
  box.innerHTML = `<div><h2>${e.icon} ${e.name} 이벤트</h2><p class="note evc">${c.icon} ${c.name} <b>${R.c}</b>개 · ${left(R)}</p>
<div class="evtabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}"${tab === k ? ' class="on"' : ''}>${n}</button>`).join('')}</div>${body}
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  box.dataset.step = 'win';
  const H = hab(); if (tab === 'shop' && H?.decor) import('./thumbs.js').then(({ propThumb }) => box.querySelectorAll('li img').forEach((img, i) => e.shop[i] && propThumb(e.shop[i].prop, H.decor.model).then(u => { img.src = u; })));
}
const flakes = () => calm() ? '' : `<p class="flakes" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${-(i * 0.61) % 4}s">❄</i>`).join('')}</p>`;
function card(L) { // the start card
  box.innerHTML = `<div class="evcard">${flakes()}<h2>${L.e.icon} ${L.e.name} 이벤트가 시작됐어요</h2><p class="note">${md(L.R.start)} ~ ${md(L.R.end - 1)}</p>
<p class="note">${esc(L.e.news)}</p><p class="note">${L.e.coin.icon} 매일 처음 오면 ${L.e.coin.name} ${L.e.earn.day}개, 친구를 쓰다듬어 하트 ${L.e.earn.pet}개마다 1개</p>
<div class="nbtns"><button class="sb" data-close>나중에</button><button class="go" data-open>보러 가기</button></div></div>`;
  box.dataset.step = 'start'; box.hidden = false; G.evSeen(L.key, 'seen'); sfx('bell');
}
function endCard(key, R) {
  const e = EV(R.id), c = e.coin;
  box.innerHTML = `<div class="evcard"><h2>${e.icon} ${e.name} 이벤트가 끝났어요</h2><p class="note">모은 ${c.name} ${R.got}개 · 보상 길 ${R.step}/${e.track.length}칸</p>
<p class="note got">${R.left ? `남은 ${c.name} ${R.left}개 → ♥${R.paid} (1개 = ♥${c.hearts})` : `남은 ${c.name} 없이 다 썼어요`}</p>
<div class="nbtns"><button class="go" data-close>좋아요</button></div></div>`;
  box.dataset.step = 'end'; box.hidden = false; G.evSeen(key, 'told'); sfx('grown');
}
const EV = id => EVENTS.find(e => e.id === id);

btn.onclick = () => { tab = 'shop'; draw(); box.hidden = false; };
box.onclick = e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.close != null) { box.hidden = true; return; }
  if (d.open != null || d.tab) { if (d.tab) tab = d.tab; else tab = 'shop'; return draw(); }
  if (d.buy) {
    const p = G.buyEv(d.buy, at() ?? G.S.flags.lastHab);
    if (p) { sfx('place'); toast(`「${PROP[p.prop].name}」 · ${HAB[p.hab]?.name ?? ''} 꾸미기 › 선물에 넣어 뒀어요`); }
    draw();
  }
};
function tick() { // after every game tick: the pill, the weather, the 새 소식 row, a 보상 길 step's toast
  const L = G.event(), w = L?.e.look.weather ?? null; if (WEATHER.ev !== w) WEATHER.ev = w;
  const k = L ? `${L.e.coin.icon}|${L.R.c}|${soon(L.R)}` : '';
  if (k !== pillWas) {
    pillWas = k; btn.hidden = !L;
    if (L) { btn.innerHTML = `<span aria-hidden="true">${L.e.coin.icon}</span><b>${L.R.c}</b>${soon(L.R) ? '<small>곧 끝나요</small>' : ''}`; btn.setAttribute('aria-label', `${L.e.name} 이벤트 · ${L.e.coin.name} ${L.R.c}개`); }
    const ul = document.querySelector('#news ul'), li = ul?.querySelector('[data-ev]');
    if (L && ul && !li) (ul.querySelector('[data-upd]') ?? ul).insertAdjacentHTML(ul.querySelector('[data-upd]') ? 'afterend' : 'afterbegin', `<li data-ev><i aria-hidden="true">${L.e.icon}</i><span>${esc(L.e.news)} (${md(L.R.end - 1)}까지)</span></li>`);
    if (!L) li?.remove();
  }
  if (L) { const was = stepWas[L.key]; stepWas[L.key] = L.R.step;
    if (was != null && L.R.step > was) toast(`${L.e.name} 보상 길 ${L.R.step}칸째 · ${rew(L.e.track[L.R.step - 1])}`, 3200); }
}
G.on(tick);
const busy = () => topWindow() || overlayOpen() || !$('loading').hidden && !$('loading').closest('.scene.hidden') || $('tabOff') || document.body.classList.contains('photo') || document.hidden || !at() || resting();
setInterval(() => {
  if (!G.S) return;
  const L = G.event(), end = Object.entries(G.S.events).find(([, R]) => R.over && !R.told && (R.seen || R.paid > 0));
  if (!box.hidden || !(L && !L.R.seen || end) || busy()) { quiet = 0; return; }
  if ((quiet += 800) < 1600) return;
  quiet = 0; if (end) endCard(...end); else card(L);
}, 800);
// cur: the habitat on screen (a bought prop goes there; the cards only inside one); api: its habitat (the shop's pictures)
export function initEvent(cur, api) { at = cur; hab = api; tick(); }
load(); setInterval(load, 3600000); addEventListener('online', () => load());
