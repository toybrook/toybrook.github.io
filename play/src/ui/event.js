// 15-1 계절 이벤트 (docs/event.md). The events are data.js EVENTS; the dates may be moved by events.json beside the game (same
// origin, tools/event.mjs), read when the game opens and every hour while online, the last copy kept for offline (none ever
// read: data.js dates). The rules (coins, the 보상 길, the shop, the album, the end's hearts) are rules.js evTick; this file
// shows them: the coin button atop the right column (곧 끝나요 near the end), the window (상점 / 보상 길 / 앨범), its start and end cards (they wait
// like attend.js for a quiet screen), a toast per 보상 길 step, a 새 소식 row and its weather (config WEATHER.ev).
import * as G from '../game/game.js';
import { PROP, HAB, SP, habitatOf } from '../game/rules.js';
import { BALANCE, EVENTS, EV_ACC } from '../game/data.js';
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
const hint = n => n.ball ? '친구들이 눈싸움할 때 찍기' : n.prop ? `「${PROP[[].concat(n.prop)[0]].name}」 놓고 찍기` : n.hab ? `${HAB[n.hab].name}에서 찍기` : n.sky === 'fog' ? '안개 낀 날 찍기' : n.night ? '밤에 찍기' : '찍기';
const TABS = [['shop', '상점'], ['track', '보상 길'], ['album', '앨범'], ['wear', '옷장']];
// 15-2: the shop in parts (big, small, wear); wear is put on in 옷장 (the friends out in this habitat), kept after the event
const KINDS = [['big', '큰 소품'], ['small', '작은 소품'], ['wear', '치장']], WICON = { beanie: '🧶', scarf: '🧣' };
const wicon = k => WICON[EV_ACC[k]?.base] ?? '🎀', worn = k => G.S.animals.filter(a => a.wear?.includes(k)).length;
const nm = a => a.nm || SP[a.species]?.name || '친구';
function wardrobe(e) {
  const own = G.evOwned(), ws = e.shop.filter(i => i.wear && own[i.wear]).map(i => i.wear);
  if (!ws.length) return '<p class="note">상점에서 치장을 사면 여기서 친구에게 입혀요</p>';
  const here = G.S.animals.filter(a => !a.stored && !a.pending && habitatOf(a) === at());
  return `<p class="note">${ws.map(k => `${wicon(k)} ${EV_ACC[k].name} ${own[k] - worn(k)}/${own[k]}개 남음`).join(' · ')}</p>
<ul class="evwear">${here.map(a => `<li><span>${esc(nm(a))}</span>${ws.map(k => { const on = !!a.wear?.includes(k);
    return `<button data-wear="${k}" data-id="${a.id}" aria-pressed="${on}"${!on && worn(k) >= own[k] ? ' disabled' : ''}>${wicon(k)} ${on ? '벗기기' : '입히기'}</button>`; }).join('')}</li>`).join('')}</ul>
${here.length ? '<p class="note">입힌 치장은 이벤트가 끝나도 그대로예요</p>' : '<p class="note">이 서식지에 나와 있는 친구가 없어요</p>'}`;
}

function draw() {
  const L = G.event(); if (!L) { box.hidden = true; return; }
  const { R, e } = L, c = e.coin, nx = e.track.findIndex((s, i) => i >= R.step);
  const row = i => { const id = i.prop ?? i.wear; return `<li>${i.wear ? `<i class="evi" aria-hidden="true">${wicon(id)}</i>` : `<img alt="" data-p="${id}">`}<span>${esc(i.wear ? EV_ACC[id].name : PROP[id].name)}${R.buy[id] ? `<small>${R.buy[id]}개 샀어요</small>` : ''}</span><button data-buy="${id}"${G.S.hearts < i.price ? ' disabled' : ''}>♥ ${i.price}</button></li>`; };
  const build = e.build ? `<ul><li class="evbuild"><i class="evi" aria-hidden="true">⛄</i><span>눈사람 만들기<small>서식지에서 눈을 세 번 눌러요 · 그대로 남아요</small></span><button data-build${G.S.hearts < e.build.price || !at() ? ' disabled' : ''}>♥ ${e.build.price}</button></li></ul>` : '';
  const body = tab === 'shop' ? `<div class="evscroll">${build}${KINDS.map(([k, n]) => { const its = e.shop.filter(i => (i.kind ?? 'big') === k); return its.length ? `<h3>${n}</h3><ul>${its.map(row).join('')}</ul>` : ''; }).join('')}</div>
<p class="note">산 소품은 꾸미기 › 선물에, 치장은 옷장에 들어가요</p>`
    : tab === 'wear' ? wardrobe(e)
    : tab === 'track' ? `<ol>${e.track.map((s, i) => `<li class="${i < R.step ? 'done' : i === nx ? 'next' : ''}"><b>${c.icon} ${s.at}</b><span>${rew(s)}</span>${i < R.step ? '<em>✓</em>' : ''}</li>`).join('')}</ol>
<p class="note">모은 ${c.name} ${R.got}개</p>`
    : `<ol>${e.album.slots.map(s => `<li class="${R.shots[s.id] ? 'done' : ''}"><i aria-hidden="true">${R.shots[s.id] ? '📷' : '❔'}</i><span>${s.name}<small>${hint(s.need)}</small></span>${R.shots[s.id] ? '<em>✓</em>' : ''}</li>`).join('')}</ol>
<p class="note">사진 모드로 찍으면 한 칸씩 채워져요 · 다 채우면 「${PROP[e.album.prop].name}」${R.cover ? ' 받았어요' : ''}</p>`;
  box.innerHTML = `<div><h2>${e.icon} ${e.name} 이벤트</h2><p class="note evc">${c.icon} 모은 ${c.name} <b>${R.got}</b>개 · ${left(R)}</p>
<div class="evtabs" role="tablist">${TABS.filter(([k]) => k !== 'wear' || e.shop.some(i => i.wear)).map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}"${tab === k ? ' class="on"' : ''}>${n}</button>`).join('')}</div>${body}
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  box.dataset.step = 'win';
  const H = hab(); if (tab === 'shop' && H?.decor) import('./thumbs.js').then(({ propThumb }) => box.querySelectorAll('img[data-p]').forEach(img => propThumb(img.dataset.p, H.decor.model).then(u => { img.src = u; })));
}
const flakes = () => calm() ? '' : `<p class="flakes" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${-(i * 0.61) % 4}s">❄</i>`).join('')}</p>`;
function card(L) { // the start card
  box.innerHTML = `<div class="evcard">${flakes()}<h2>${L.e.icon} ${L.e.name} 이벤트가 시작됐어요</h2><p class="note">${md(L.R.start)} ~ ${md(L.R.end - 1)}</p>
<p class="note">${esc(L.e.news)}</p><p class="note">${L.e.coin.icon} 매일 처음 오면 ${L.e.coin.name} ${L.e.earn.day}개, 친구를 쓰다듬어 하트 ${L.e.earn.pet}개마다 1개${L.e.earn.luck ? '(가끔 1개 더)' : ''}${L.e.piles ? `, 하루 ${L.e.piles.length}번 생기는 눈더미를 누르면 ${L.e.earn.pile}개` : ''} · 모을수록 보상 길이 열려요</p>
<div class="nbtns"><button class="sb" data-close>나중에</button><button class="go" data-open>보러 가기</button></div></div>`;
  box.dataset.step = 'start'; box.hidden = false; G.evSeen(L.key, 'seen'); sfx('bell');
}
function endCard(key, R) {
  const e = EV(R.id), c = e.coin;
  box.innerHTML = `<div class="evcard"><h2>${e.icon} ${e.name} 이벤트가 끝났어요</h2><p class="note">모은 ${c.name} ${R.got}개 · 보상 길 ${R.step}/${e.track.length}칸</p>
${R.left ? `<p class="note got">남은 ${c.name} ${R.left}개 → ♥${R.paid}</p>` : ''}
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
    if (p?.wear) { sfx('place'); toast(`「${EV_ACC[p.wear].name}」 · 옷장에서 친구에게 입혀 보세요`); }
    else if (p) { sfx('place'); toast(`「${PROP[p.prop].name}」 · ${HAB[p.hab]?.name ?? ''} 꾸미기 › 선물에 넣어 뒀어요`); }
    draw();
  }
  if (d.wear) { if (G.evWear(+d.id, d.wear)) sfx('place'); draw(); }
  if (d.build != null) { const H = hab(), h = at(); if (!H?.snowman || !h) return; box.hidden = true; // 15-2: 3 taps in the habitat, then saved (paid then)
    H.snowman((x, z) => { const p = G.evBuild(h, x, z); if (p) { sfx('grown'); toast('눈사람을 만들었어요! 친구들이 모여요', 2400); } return !!p; });
    toast('하얀 눈을 세 번 눌러 눈사람을 만들어요', 2600); }
};
function tick() { // after every game tick: the pill, the weather, the 새 소식 row, a 보상 길 step's toast
  const L = G.event(), w = L?.e.look.weather ?? null; if (WEATHER.ev !== w) WEATHER.ev = w;
  // 15-2: snow lying (all through it; melting over the day after its end), the snow habitat's aurora, a snow pile when one is due
  const now = G.now(), gone = !L && G.S && Object.values(G.S.events).find(R => R.end <= now && now < R.end + DAY && EV(R.id)?.look.cover);
  WEATHER.cover = L ? (L.e.look.cover ? 1 : 0) : gone ? 1 - (now - gone.end) / DAY : 0; WEATHER.aur = L?.e.look.aurora ?? 1;
  hab()?.pile?.(!!(L && at() && G.pile()));
  const k = L ? `${L.e.icon}|${soon(L.R)}` : ''; // 74: no coin count on screen (♥ and Lv only)
  if (k !== pillWas) {
    pillWas = k; btn.hidden = !L;
    if (L) { btn.innerHTML = `<span aria-hidden="true">${L.e.icon}</span>${soon(L.R) ? '<small>곧 끝나요</small>' : ''}`; btn.setAttribute('aria-label', `${L.e.name} 이벤트`); }
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
