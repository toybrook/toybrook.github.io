// 15-1 계절 이벤트 (docs/event.md). The events are data.js EVENTS; the dates may be moved by events.json beside the game (same
// origin, tools/event.mjs), read when the game opens and every hour while online, the last copy kept for offline (none ever
// read: data.js dates). The rules (coins, the 보상 길, the shop, the album, the end's hearts) are rules.js evTick; this file
// shows them: the coin button atop the right column (곧 끝나요 near the end), the window (상점 / 보상 길 / 앨범), its start and end cards (they wait
// like attend.js for a quiet screen), a toast per 보상 길 step, a 새 소식 row and its weather (config WEATHER.ev).
import { $t, esc } from '../i18n/i18n.js';
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

const rew = s => [s.hearts && `♥${s.hearts}`, s.candy && $t('성장 사탕 {0}개', s.candy), PROP[s.prop] && $t('소품 「{0}」', PROP[s.prop].name)].filter(Boolean).join(' · ');
const soon = R => R.end - G.now() < BALANCE.event.soon * DAY;
const left = R => { const ms = R.end - G.now(); return ms >= DAY ? $t('{0}일 남음', Math.floor(ms / DAY)) : $t('{0}시간 남음', Math.max(1, Math.ceil(ms / 3600e3))); };
const md = t => { const d = new Date(t + 9 * 3600e3); return $t('{0}월 {1}일', d.getUTCMonth() + 1, d.getUTCDate()); };
const hint = n => n.ball ? $t('동물들이 눈싸움할 때 찍기') : n.prop ? $t('「{0}」 놓고 찍기', PROP[[].concat(n.prop)[0]].name) : n.hab ? $t('{0}에서 찍기', HAB[n.hab].name) : n.sky === 'fog' ? $t('안개 낀 날 찍기') : n.night ? $t('밤에 찍기') : $t('찍기');
const TABS = [['shop', $t('상점')], ['track', $t('보상 길')], ['album', $t('앨범')], ['wear', $t('옷장')]];
// 15-2: the shop in parts (big, small, wear); wear is put on in 옷장 (the friends out in this habitat), kept after the event
const KINDS = [['big', $t('큰 소품')], ['small', $t('작은 소품')], ['wear', $t('치장')]], WICON = { beanie: '🧶', scarf: '🧣' };
const wicon = k => WICON[EV_ACC[k]?.base] ?? '🎀', worn = k => G.S.animals.filter(a => a.wear?.includes(k)).length;
const nm = a => a.nm || SP[a.species]?.name || $t('동물');
function wardrobe(e) {
  const own = G.evOwned(), ws = e.shop.filter(i => i.wear && own[i.wear]).map(i => i.wear);
  if (!ws.length) return $t('<p class="note">상점에서 치장을 사면 여기서 동물에게 입혀요</p>');
  const here = G.S.animals.filter(a => !a.stored && !a.pending && habitatOf(a) === at());
  return `<p class="note">${ws.map(k => $t('{0} {1} {2}/{3}개 남음', wicon(k), EV_ACC[k].name, own[k] - worn(k), own[k])).join(' · ')}</p>
<ul class="evwear">${here.map(a => `<li><span>${esc(nm(a))}</span>${ws.map(k => { const on = !!a.wear?.includes(k);
    return `<button data-wear="${k}" data-id="${a.id}" aria-pressed="${on}"${!on && worn(k) >= own[k] ? ' disabled' : ''}>${wicon(k)} ${on ? $t('벗기기') : $t('입히기')}</button>`; }).join('')}</li>`).join('')}</ul>
${here.length ? $t('<p class="note">입힌 치장은 이벤트가 끝나도 그대로예요</p>') : $t('<p class="note">이 서식지에 나와 있는 동물이 없어요</p>')}`;
}

function draw() {
  const L = G.event(); if (!L) { box.hidden = true; return; }
  const { R, e } = L, c = e.coin, nx = e.track.findIndex((s, i) => i >= R.step);
  const row = i => { const id = i.prop ?? i.wear; return `<li>${i.wear ? `<i class="evi" aria-hidden="true">${wicon(id)}</i>` : `<img alt="" data-p="${id}">`}<span>${esc(i.wear ? EV_ACC[id].name : PROP[id].name)}${R.buy[id] ? $t('<small>{0}개 샀어요</small>', R.buy[id]) : ''}</span><button data-buy="${id}"${G.S.hearts < i.price ? ' disabled' : ''}>♥ ${i.price}</button></li>`; };
  const build = e.build ? $t('<ul><li class="evbuild"><i class="evi" aria-hidden="true">⛄</i><span>눈사람 만들기<small>서식지에서 눈을 세 번 눌러요 · 그대로 남아요</small></span><button data-build{0}>♥ {1}</button></li></ul>', G.S.hearts < e.build.price || !at() ? ' disabled' : '', e.build.price) : '';
  const body = tab === 'shop' ? $t('<div class="evscroll">{0}{1}</div>\n<p class="note">산 소품은 꾸미기 › 선물에, 치장은 옷장에 들어가요</p>', build, KINDS.map(([k, n]) => { const its = e.shop.filter(i => (i.kind ?? 'big') === k); return its.length ? `<h3>${n}</h3><ul>${its.map(row).join('')}</ul>` : ''; }).join(''))
    : tab === 'wear' ? wardrobe(e)
    : tab === 'track' ? $t('<ol>{0}</ol>\n<p class="note">모은 {1} {2}개</p>', e.track.map((s, i) => `<li class="${i < R.step ? 'done' : i === nx ? 'next' : ''}"><b>${esc(c.icon)} ${s.at}</b><span>${rew(s)}</span>${i < R.step ? '<em>✓</em>' : ''}</li>`).join(''), c.name, R.got)
    : $t('<ol>{0}</ol>\n<p class="note">사진 모드로 찍으면 한 칸씩 채워져요 · 다 채우면 「{1}」{2}</p>', e.album.slots.map(s => `<li class="${R.shots[s.id] ? 'done' : ''}"><i aria-hidden="true">${R.shots[s.id] ? '📷' : '❔'}</i><span>${s.name}<small>${hint(s.need)}</small></span>${R.shots[s.id] ? '<em>✓</em>' : ''}</li>`).join(''), PROP[e.album.prop].name, R.cover ? $t(' 받았어요') : '');
  box.innerHTML = $t('<div><h2>{0} {1} 이벤트</h2><p class="note evc">{2} 모은 {3} <b>{4}</b>개 · {5}</p>\n<div class="evtabs" role="tablist">{6}</div>{7}\n<div class="nbtns"><button class="go" data-close>닫기</button></div></div>', esc(e.icon), esc(e.name), esc(c.icon), esc(c.name), R.got, left(R), TABS.filter(([k]) => k !== 'wear' || e.shop.some(i => i.wear)).map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}"${tab === k ? ' class="on"' : ''}>${n}</button>`).join(''), body);
  box.dataset.step = 'win';
  const H = hab(); if (tab === 'shop' && H?.decor) import('./thumbs.js').then(({ propThumb }) => box.querySelectorAll('img[data-p]').forEach(img => propThumb(img.dataset.p, H.decor.model).then(u => { img.src = u; }, () => {})));
}
const flakes = () => calm() ? '' : `<p class="flakes" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${-(i * 0.61) % 4}s">❄</i>`).join('')}</p>`;
function card(L) { // the start card
  box.innerHTML = $t('<div class="evcard">{0}<h2>{1} {2} 이벤트가 시작됐어요</h2><p class="note">{3} ~ {4}</p>\n<p class="note">{5}</p><p class="note">{6} 매일 처음 오면 {7} {8}개, 동물을 쓰다듬어 하트 {9}개마다 1개{10}{11} · 모을수록 보상 길이 열려요</p>\n<div class="nbtns"><button class="sb" data-close>나중에</button><button class="go" data-open>보러 가기</button></div></div>', flakes(), esc(L.e.icon), esc(L.e.name), md(L.R.start), md(L.R.end - 1), esc(L.e.news), esc(L.e.coin.icon), esc(L.e.coin.name), L.e.earn.day, L.e.earn.pet, L.e.earn.luck ? $t('(가끔 1개 더)') : '', L.e.piles ? $t(', 하루 {0}번 생기는 눈더미를 누르면 {1}개', L.e.piles.length, L.e.earn.pile) : '');
  box.dataset.step = 'start'; box.hidden = false; G.evSeen(L.key, 'seen'); sfx('bell');
}
function endCard(key, R) {
  const e = EV(R.id), c = e.coin;
  box.innerHTML = $t('<div class="evcard"><h2>{0} {1} 이벤트가 끝났어요</h2><p class="note">모은 {2} {3}개 · 보상 길 {4}/{5}칸</p>\n{6}\n<div class="nbtns"><button class="go" data-close>좋아요</button></div></div>', esc(e.icon), esc(e.name), esc(c.name), R.got, R.step, e.track.length, R.left ? $t('<p class="note got">남은 {0} {1}개 → ♥{2}</p>', c.name, R.left, R.paid) : '');
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
    if (p?.wear) { sfx('place'); toast($t('「{0}」 · 옷장에서 동물에게 입혀 보세요', EV_ACC[p.wear].name)); }
    else if (p) { sfx('place'); toast($t('「{0}」 · {1} 꾸미기 › 선물에 넣어 뒀어요', PROP[p.prop].name, HAB[p.hab]?.name ?? '')); }
    draw();
  }
  if (d.wear) { if (G.evWear(+d.id, d.wear)) sfx('place'); draw(); }
  if (d.build != null) { const H = hab(), h = at(); if (!H?.snowman || !h) return; box.hidden = true; // 15-2: 3 taps in the habitat, then saved (paid then)
    H.snowman((x, z) => { const p = G.evBuild(h, x, z); if (p) { sfx('grown'); toast($t('눈사람을 만들었어요! 동물들이 모여요'), 2400); } return !!p; });
    toast($t('하얀 눈을 세 번 눌러 눈사람을 만들어요'), 2600); }
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
    if (L) { btn.innerHTML = `<span aria-hidden="true">${esc(L.e.icon)}</span>${soon(L.R) ? $t('<small>곧 끝나요</small>') : ''}`; btn.setAttribute('aria-label', $t('{0} 이벤트', L.e.name)); }
    const ul = document.querySelector('#news ul'), li = ul?.querySelector('[data-ev]');
    if (L && ul && !li) (ul.querySelector('[data-upd]') ?? ul).insertAdjacentHTML(ul.querySelector('[data-upd]') ? 'afterend' : 'afterbegin', $t('<li data-ev><i aria-hidden="true">{0}</i><span>{1} ({2}까지)</span></li>', esc(L.e.icon), esc(L.e.news), md(L.R.end - 1)));
    if (!L) li?.remove();
  }
  if (L) { const was = stepWas[L.key]; stepWas[L.key] = L.R.step;
    if (was != null && L.R.step > was) toast($t('{0} 보상 길 {1}칸째 · {2}', L.e.name, L.R.step, rew(L.e.track[L.R.step - 1])), 3200); }
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
