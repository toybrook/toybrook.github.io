// 17-2 동물 작품 (game/art.js) on screen: those made while away put on the board's empty ground (habitat.js artSpot), their
// line in the 돌아왔어요 card (main.js), the choice sheet over the board (the camera flies to each in turn), the count on the
// top bar's habitat chip while some wait for a choice. No button or window of its own: the sheet is a card like 새 구역's
import * as G from '../game/game.js';
import { PROP } from '../game/rules.js';
import { ART, asking } from '../game/art.js';
import { toast, josa, ask, eat, topWindow } from './hud.js';
import { sfx } from './sound.js';
import { DEBUG } from '../config.js';

const $ = id => document.getElementById(id);
let api = () => null, cur = () => null, back = () => {}, on = null; // on: the habitat whose board took its 작품 last (enter)
const when = a => a.night ? '밤사이' : '자리 비운 사이';
const day = at => { const d = new Date(at); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

// the board on screen finds the empty ground for each made there (none: it goes, nothing asked)
export function place(hab) {
  const a = api(); if (!a?.artSpot || cur() !== hab) return; on = hab;
  for (const t of G.S.art.todo.filter(t => t.hab === hab)) { const s = a.artSpot(PROP[t.prop].r); G.artAt(t.uid, s?.[0] ?? null, s?.[1] ?? null); }
}
const ready = hab => on === hab && cur() === hab && !!api() && !G.S.art.todo.some(t => t.hab === hab);
const wait = (f, n = 240) => f() ? Promise.resolve(true) : n ? new Promise(r => setTimeout(r, 250)).then(() => wait(f, n - 1)) : Promise.resolve(false);

// not told yet (the 돌아왔어요 line): made and not placed, or placed and asking
export const due = hab => [...G.S.art.todo.filter(t => t.hab === hab), ...asking(G.S, hab)].filter(x => !x.art.told);
export function retRow(hab) {
  const d = due(hab); if (!d.length) return null;
  const last = d[d.length - 1].art, names = [...new Set(d.map(x => x.art.who))];
  G.artTold(d.map(x => x.uid));
  return d.length === 1 ? ['🎨', `${when(last)} ${last.who}${josa(last.who, '이', '가')} 작품을 만들었어요`, `${PROP[d[0].prop].name} · 보러 가요`, 'art']
    : ['🎨', `${when(last)} 친구들이 작품 ${d.length}개를 만들었어요`, `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` 외 ${names.length - 2}` : ''} · 보러 가요`, 'art'];
}

// the choice, one at a time (the camera on it); 나중에 / a tap beside the card: it waits (the chip's count, a tap on it asks again)
let el = null, queue = [], total = 0;
export async function open(hab, first) {
  const free = () => { const t = topWindow(); return !t || t === el || t.matches('.tip'); }; // never over another card (a 레벨 카드 that came up while the board loaded: after it)
  if (!await wait(() => ready(hab) && free())) return;
  const list = asking(G.S, hab).map(p => p.uid); if (!list.length) return;
  queue = first != null && list.includes(first) ? [first, ...list.filter(u => u !== first)] : list; total = queue.length;
  G.artTold(queue); show(hab);
}
function shut(say) { if (el) el.hidden = true; queue = []; if (say) toast(say, 2400, true); }
function show(hab) {
  queue = queue.filter(u => G.S.props.some(p => p.uid === u && p.art?.ask));
  const p = G.S.props.find(p => p.uid === queue[0]); if (!p || cur() !== hab) return shut();
  api()?.artView(p.x, p.z);
  if (!el) { el = document.createElement('section'); el.id = 'artCard'; el.className = 'intro pop lvup artc'; el.setAttribute('aria-label', '동물 작품'); el.onclick = pick; $('habitat').append(el); }
  const a = p.art, P = PROP[p.prop], F = PROP[P.find], n = queue.length;
  el.dataset.hab = hab; el.dataset.uid = p.uid;
  el.innerHTML = `<div><h2>${a.who}의 작품</h2><p class="sub">「${P.name}」 · ${day(a.at)} ${when(a)}에 만들었어요${total > 1 ? ` · ${total - n + 1}/${total}` : ''}</p>
<div class="abtns"><button data-a="keep">그대로 두기<small>꾸미기에서 옮기거나 넣어 둘 수 있어요</small></button><button data-a="record">기록만 남기고 치우기<small>작품집에 남기고 ${F.name}${josa(F.name, '은', '는')} 보관함으로</small></button><button data-a="clear">치우기<small>아무것도 남기지 않아요</small></button></div>
<div class="nbtns">${n > 1 ? `<button class="sb" data-all>모두 치우기</button>` : ''}<button class="sb" data-close>나중에</button></div></div>`;
  el.hidden = false;
}
async function pick(e) {
  const b = e.target.closest('button'), hab = el.dataset.hab, uid = +el.dataset.uid; if (!b) return;
  if (b.dataset.close != null) return shut('작품을 누르면 다시 고를 수 있어요'); // 나중에, or a tap beside the card (hud.js clicks it for a .pop's backdrop)
  if (b.dataset.all != null) {
    const n = asking(G.S, hab).length; if (!await ask(`작품 ${n}개를 모두 치울까요?\n작품집에도 남지 않아요.`, '치우기', '취소')) return;
    G.artClear(hab); sfx('undo'); return shut(`작품 ${n}개를 치웠어요`);
  }
  const r = G.artPick(uid, b.dataset.a); if (!r) return show(hab);
  sfx(r.what === 'clear' ? 'undo' : 'place');
  const F = r.got && PROP[r.got];
  toast(r.what === 'keep' ? '그대로 둘게요 · 작품집에도 남겼어요' : r.what === 'record' ? `작품집에 남겼어요${F ? ` · ${F.name}${josa(F.name, '은', '는')} 꾸미기 › 선물에 있어요` : ''}` : '치웠어요', 2400, true);
  queue.shift(); if (queue.length) show(hab); else shut();
}

// a 작품 tapped on the board (habitat.js tapProp): its choice if it still waits, else who made it and when
export function tapped(uid) {
  const p = G.S.props.find(p => p.uid === uid); if (!p) return;
  if (p.art?.ask) { eat(); return open(p.hab, uid); } // the click after this pointerup would land on the card
  const a = p.art; toast(a ? `${a.who}${josa(a.who, '이', '가')} 만든 「${PROP[p.prop].name}」 · ${day(a.at)}` : PROP[p.prop].name, 2400, true);
}

// the habitat chip's count (not a button of its own: the chip still goes back to the map)
function mark() {
  const n = cur() ? asking(G.S, cur()).length : 0, c = $('habName');
  if (n) c.dataset.art = n; else delete c.dataset.art;
  c.setAttribute('aria-label', `월드맵으로 돌아가기${n ? ` · 고르지 않은 동물 작품 ${n}개` : ''}`);
}

export function initArt(o) {
  ({ api, cur, back } = o);
  G.on(ev => { const h = cur(); if (h && on === h && ev.some(e => e.type === 'art' && e.hab === h)) setTimeout(() => place(h)); mark(); });
  // a tap or a key: the player is here. Back after ART.idle on screen with a new one (made while the page stayed open): the card
  for (const k of ['pointerdown', 'keydown']) addEventListener(k, () => { const was = G.S.art.here; G.artHere(); if (G.now() - was >= ART.idle && due(cur() || G.S.flags.lastHab).length) { eat(); back(); } }, { capture: true }); // on the map: the last habitat's
  if (DEBUG) window.__art = { place, open, tapped, due, mark, api: () => api() };
}
export const shown = () => !!el && !el.hidden;
