// 서식지 꾸미기: decorate mode. Buy props with hearts (no randomness), drag them onto the board, turn them, put them away.
// Where one may stand is the habitat's layout.js (placeable); habitat.js moves the held one and shows green/red under it.
// A prop a species likes (PROPS effect) makes that species come a little more often from this habitat's nest eggs.
// 22-1: tabs by kind, 격자 (snap to cells), 되돌리기 / 다시 하기 (the last 20), 땅 칠하기 (BRUSHES, cell by cell), and the
// board's own trees, bushes, rocks and flowers (NATURE, nat: 1): moved like props, cut or cleared into storage, planted again.
// 26-6: 고르기 (several picked: moved a cell at a time, turned, put away together, one 되돌리기 step each), 판 비우기 (every placed
// prop put away, asked once), 하나 더 (another of the one held: from storage, else bought as in the list), the held one's info line.
// 28-5 꾸미기 자유도: the held one's colour (its PALETTES) and size (SIZES), turned 15° a tap or freely held down; a small prop
// dragged near a table / shelf / 평상 goes onto its top (rules.js topAt); 저장 칸 3개 in share.js.
// inbox 37: 작은 고리 바로 놓기 (four curves held as one, put down at once: rules.js placeRing), 가까운 빈 자리로 (a rail held:
// habitat.js room; 27-7b: any prop held on a red spot), the first rail's tip.
import { $t, esc } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { BALANCE as B, BIGS, PROPS, SCENES, NATURE, BRUSHES, SETS, ZONES, brushIn, paletteOf, SIZES, sizeF, sizable, YARD_B, G190 } from '../game/data.js';
import { SP, PROP, HAB, propReady, placedIn, railsIn, capped, levelOf, expPrice, decorCap, layoutOf, can as canLv, needFor, natCap, natIn, callName, habitatOf, capOf, spotMode, spotsUsed, piecesOwned, piecesUsed } from '../game/rules.js';
import { SPOTS, rectAt } from '../habitat/zones.js'; // 194 0-5
import { walker, visitors, callable } from '../game/yard.js'; // 182 ④
import { capAt } from '../game/scatter.js'; // 195 B-8 1-2
import { figureThumb } from './thumbs.js';
const can = (S, k) => canLv(S, k) || k === 'prop:' + G.tutShop(); // 66-1: the tutorial's 등불 is sold before its Lv
// 194 0-5 (?s186): this habitat has 꾸미기 자리 (one prop a spot; no size, grid, paint, nature tools or 고르기 here)
const SPM = () => spotMode(habId);
import { propThumb } from './thumbs.js';
import { toast, hideToast, josa, tip, ask } from './hud.js';
import { openShare } from './share.js';
import { sfx } from './sound.js';
import { railEnds } from '../habitat/train.js';
import { trails } from '../game/wild.js'; // 17-3
import { VIEW } from '../config.js'; // 195 B-8 1-3: 낮·밤 미리보기 (the look only, as 사진 모드)

const el = document.getElementById('decor'), habEl = document.getElementById('habitat');
// 13-2: a play prop's 놀이 장면 (seen / all): a reason to buy and place it
const sceneNote = P => { const L = SCENES.filter(s => s.prop === P.id); return L.length ? $t(' · 놀이 장면 {0}/{1}', L.filter(s => G.S.scenes[s.id]).length, L.length) : ''; };
export const propNote = P => P.gift || P.use || (P.effect ? $t('{0}{이/가} 조금 더 자주 와요', SP[P.effect].name)
  : P.light ? $t('밤이 되면 불이 켜져요') : P.shelter ? $t('{0} 오면 몸집이 맞는 동물이 쉬러 와요', P.habitat === 'snow' ? $t('눈') : $t('비')) : $t('보기만 해도 좋은 장식이에요'));
// 13-3 오늘의 진열대: three props, a new display every PACE shelf.hours (「다음 진열 1:42」 counts down here; no notification)
const hm = ms => { const m = Math.max(1, Math.ceil(ms / 60e3)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
let shelfEnds = 0;
const shelfRow = sh => { shelfEnds = sh.ends; return sh.items.length ? $t('<div class="dshelf"><p><b>오늘의 진열대</b><span data-left>다음 진열 {0}</span></p><div>{1}</div></div>', hm(sh.ends - G.now()), sh.items.map((it, i) => { const P = PROP[it.id], c = it.c && paletteOf(P)[it.c];
  return `<button class="dsh${it.off ? ' sale' : ''}" data-shelf="${i}"><img alt="">${c ? `<i style="background:${c[1]}"></i>` : ''}<b>${P.name}</b><small>${c ? $t('진열대 색 · {0}', c[0]) : it.off ? $t('{0}% 싸게', Math.round(B.shelf.off * 100)) : $t('이번 진열')}</small><em>${it.off ? `<s>${P.price}</s> ` : ''}<span class="hrt">♥</span>${it.price}</em></button>`; }).join('')) : ''; };
setInterval(() => { const s = !el.hidden && el.querySelector('[data-left]'); if (!s) return; if (G.now() >= shelfEnds) draw(); else s.textContent = $t('다음 진열 ') + hm(shelfEnds - G.now()); }, 1000);
// the tabs and the props in each (one not listed goes under 가구; 28-2 놀이: the props animals use); the board's own nature put away shows under 자연
const TABS = [['nature', $t('자연'), 'flowers tulips tallgrass stones mushrooms log cycad'], ['path', $t('길'), 'fence path'], ['light', $t('조명'), 'lantern jar mushlamp starlamp icelamp lavalamp'],
  ['furniture', $t('가구'), 'bench mailbox pinwheel vane hay trough snowman sled dinonest ribs'], ['big', $t('큰 소품'), BIGS], ['water', $t('물가'), 'lily boat stepping'],
  ['play', $t('놀이'), 'swing slide seesaw ball hammock fountain campfire feeder musicbox bubbles lights fireworks pinhill bell'], ['home', $t('집'), 'table shelf platform doll'], ['land', $t('땅'), 'hillock puddle flowermound rockmound'], ['train', $t('기차'), 'rail railcurve railfork railbridge'], ['gift', $t('선물'), PROPS.filter(P => P.gift).map(P => P.id).join(' ')]].map(([id, name, ps]) => ({ id, name, ps: ps.split(' ') }));
if (G190) TABS.push({ id: 'theme', name: $t('테마'), ps: [] }); // 203 D5 ?g190: 소품 세트 → 꾸미기 테마 (the props keep their own tabs too)
export const tabOf = P => (TABS.find(t => t.ps.includes(P.id)) ?? TABS[3]).id;
export const tabName = id => TABS.find(t => t.id === tabOf({ id })).name; // 66-1: where a guest's gift waits
const NAT = Object.fromEntries(NATURE.map(n => [n.id, n])), cut = id => id === 'rock' ? $t('치우기') : $t('베기');
const UNDO = 20;

let habId = null, hab = null, held = null, ok = false, shown = '';
// 194 0-1 ①: a card tapped holds a 미리보기 (not bought yet: held.buy = { price, shelf? }); its hearts go at 놓기, 취소 changes nothing.
// Its uid is the one buying will give it (tut181 follows it)
const preview = (P, buy, c) => ({ uid: G.S.nextId, prop: P.id, hab: habId === 'yard' ? 'yard' : P.habitat ?? habId, placed: false, x: 0, z: 0, rot: 0, ...c && { c }, buy });
let yv = null, y3 = false, ypan = false, ytop = false, yk = -1, npv = 0; // 182 ④ (the yard only); npv 195 B-8: 0 지금, 1 밤, 2 낮
let lookMore = false; // 194 0-1 ⑧: the held one's sizes shown (under 더보기)
let tab = 'nature', brush, grid = false, undo = [], redo = [], min = false, moreT = false, sy = null, swiped = 0, pick = null, sweep = 0; // sweep: 자연 정리 on (1: asks at the first box, 2: asked) // pick: the uids picked (고르기), null: not picking; // min (inbox 25): the panel folded to its head // brush: BRUSHES index, null: the eraser, undefined: not painting
const mine = () => PROPS.filter(P => (habId === 'yard' ? !P.water && !P.art : (P.habitat ?? habId) === habId) && (!P.gift && propReady(P) || G.S.props.some(p => p.prop === P.id && p.hab === habId))); // 41: a gift one only once had here; 215 (221 B 1): a habitat not out yet (dino): its props only if had here
const stowed = id => G.S.props.filter(p => p.prop === id && p.hab === habId && !p.placed && !p.nat);
const stowedNat = id => G.S.props.filter(p => p.nat && p.prop === id && p.hab === habId && !p.placed);
const sig = () => JSON.stringify([npv, lookMore, yv, y3, ypan, ytop, yk, moreT, G.S.hearts, G.S.props, G.S.paint?.[habId], G.S.ghost?.[habId], held?.uid, ok, held?.ring && hab.decor.clears(), tab, brush, sweep, grid, undo.length, redo.length, pick && [...pick], isRail(held) && heldLine(), G.S.wild.h[habId]?.v]);
const picks = () => G.S.props.filter(p => pick?.has(p.uid) && p.placed && p.hab === habId); // those picked still on the board
// a size in 1 m cells (its footprint across; inbox 52: 1 m as the sizes and the rails step, not the 1.5 m 격자, so 작게·보통·크게·아주 크게
// differ in number too - text only, the sizes and snapping are as they were), its set, a light at night
const info = (P, N, f = 1) => { const n = Math.max(1, Math.round(2 * P.r * f)), s = !N && SETS.find(s => s.props.includes(P.id));
  return [$t('{0}×{1}칸', n, P.id === 'railbridge' ? n / 2 : n), s && (G190 ? $t('{0} 테마', s.name) : $t('{0} 세트', s.name)), N ? (habId === 'yard' ? $t('뜰의 자연물') : $t('처음부터 있던 것')) : P.light && $t('밤에 빛나요')].filter(Boolean).join(' · '); };
// before a change: the layout as it is, for 되돌리기 (a new change forgets what 다시 하기 had)
// 17-3 정원이 숨 쉬어요: the animals' worn way made a real path (the brush held if it is a path one, else 흙길, 돌길 or 자갈: the
// first this habitat has and the player may use), ↶ undoes it; what grew by itself cleared at once (자연 정리: it grows again)
const firmB = () => [...BRUSHES[brush]?.way ? [brush] : [], 1, 7, 3].find(b => brushIn(b, habId) && can(G.S, 'brush:' + BRUSHES[b].id));
const grown = () => { const H = G.S.wild.h[habId]; return H ? Object.keys(H.g).length + trails(G.S, habId).length : 0; };
// 194 0-5 (9-1) 예전 배치 불러오기: the props of habitat h's layout before its 꾸미기 자리 into the yard's storage, then down on the yard
// in the same shape (round the middle, squeezed to the open land when wider); what does not fit or is over the yard's cap stays in its storage
function oldBack(h) {
  const S = G.S, [, l, w] = olds().find(([k]) => k === h) ?? []; if (!l) return draw(); keep();
  for (const [u] of l) if (S.props.find(p => p.uid === u).hab === h) G.importProp(u);
  const U = hab.decor.unit, [, x1, , z1] = rectAt('yard', levelOf(S, 'yard')).map(v => v / U), cx = l.reduce((a, e) => a + e[1], 0) / l.length, cz = l.reduce((a, e) => a + e[2], 0) / l.length;
  const k = Math.min(1, 0.8 * Math.min(x1, z1) / (Math.max(...l.map(([, x, z]) => Math.max(Math.abs(x - cx), Math.abs(z - cz)))) || 1));
  const items = l.map(([uid, x, z, rot, sz]) => ({ uid, prop: S.props.find(p => p.uid === uid).prop, x: (x - cx) * k, z: (z - cz) * k, rot, sz })), fit = hab.decor.fitAll(items); // 194 review 중간 1: its size before the spots
  let n = 0; for (const [i, it] of items.entries()) if (fit[i] && G.placeProp(it.uid, it.x, it.z, it.rot, it.sz ? { sz: it.sz } : {})) n++;
  if (!n) undo.pop(); sfx('place'); toast($t('예전 {0} 소품 {1}개를 뜰에 놓았어요{2}', HAB[h].name, n, (l.length > n ? $t(' · 나머지 {0}개는 뜰 보관함에 있어요', l.length - n) : '') + (w ? $t(' · 물가 소품 {0}개는 {1} 보관함에 그대로 있어요', w, HAB[h].name) : ''))); yv = null; draw();
}
// 195 B-8 1-2 (the yard): the 흩뿌리기 brushes after the ground's ('s0'..: yard/fine.js SCATTER, the yard's build; 'sx' clears them from the cells)
const scBtns = () => !hab?.decor.fine ? '' : hab.decor.fine.SCATTER.map((o, k) => `<button class="${brush === 's' + k ? 'on' : ''}" data-brush="s${k}"><i style="background:${o.c}"></i>${o.name}</button>`).join('')
  + `<button class="${brush === 'sx' ? 'on' : ''}" data-brush="sx"><i class="erase"></i>${hab.decor.fine.TXT.clear}</button>`;
const keep = () => { undo.push(layoutOf(G.S, habId)); if (undo.length > UNDO) undo.shift(); redo = []; };

export function openDecor(id, api) {
  if (!api) return; // 168: no habitat built yet (its loading screen): nothing to decorate (style.css hides the buttons then)
  habId = id; hab = api; held = null; brush = undefined; yv = null; y3 = ypan = ytop = false; yk = -1; nightPv(0); grid = id === 'yard'; undo = []; redo = []; pcOk = 0; pcSpent = 0; pcSeq++; min = false; moreT = false; pick = null; sweep = 0; el.classList.remove('tall');
  if (!tabsHere().some(t => t.id === tab)) tab = 'nature';
  el.hidden = false; habEl.classList.add('decorating'); if (document.documentElement.dataset.ui187) hideToast(); /* 202 B-13 (?rc200): no note left over the board while decorating */ hab.decor.mode(true); if (grid) hab.decor.grid(true); draw(); tip('decor', '#decor .dgrid'); tip('expand', '#decor .dexp'); if (G.S.props.some(p => p.nat && p.placed && p.hab === habId && p.prop !== 'wildflowers')) tip('nature', '#decor [data-sweep]'); /* 295: no trees·rocks·bushes here (an empty yard): skipped, not marked seen, comes up where there are */ if (tab === 'train') railGuide();
}
// decorTab opens 꾸미기 on a tab (in a habitat; the panel up: that tab); first.js 「다음은 큰 소품」
export function decorTab(t) { const b = document.getElementById('decorBtn'); tab = t; if (!el.hidden) draw(); else if (b.offsetParent) b.click(); }
export function closeDecor() { if (el.hidden) return; hab?.decor.mode(false); held = null; brush = undefined; yv = null; y3 = ypan = ytop = false; yk = -1; nightPv(0); pick = null; sweep = 0; el.hidden = true; habEl.classList.remove('decorating'); }
export const leaveDecor = () => { closeDecor(); hab = null; };
// from habitat.js: a placed prop tapped (pick it up), the held one moved (green / red), a paint stroke done
export function onPropTap(uid) { const rec = G.S.props.find(p => p.uid === uid); if (!rec || el.hidden || brush !== undefined || sweep || rec.nat && SPM()) return; // 194 0-5: the board's own trees stay
  if (pick) { pick.has(uid) ? pick.delete(uid) : pick.add(uid); draw(); } else hold(rec); }
export function onEdit(can) { ok = can; if (held && sig() !== shown) draw(); }
// 246 B 이어지는 조각 bought as painted: asked the first time an opening of 꾸미기 needs one, at most PC_CAP ♥ an opening (openDecor resets)
// pcOk: 0 not asked yet, 1 yes, -1 no (the bag only till the next opening); pcSeq: which opening (an ask left from an older one does nothing)
const PC_CAP = 100; let pcOk = 0, pcSpent = 0, pcSeq = 0;
export async function onPaint(cells, b) { if (el.hidden || !cells.length) return; // 195 B-8 1-2 b 's0'.., 'sx': 흩뿌리기 붓 (G.scatter)
  const pz = typeof b === 'number' && BRUSHES[b]?.piece, left = () => cells.filter(([i, j]) => G.S.paint[habId]?.[`${i},${j}`] !== b).length;
  if (pz && !pcOk && left() > piecesOwned(G.S, b) - piecesUsed(G.S, b) && G.S.hearts >= pz[1] && pcSpent + pz[1] <= PC_CAP) {
    const seq = pcSeq, h0 = habId, ok = await ask($t('조각이 모자라면 ♥로 사서 칠해요 · 한 번에 최대 ♥{0}', PC_CAP), $t('사서 칠하기'));
    if (el.hidden || seq !== pcSeq || h0 !== habId) return; pcOk = ok ? 1 : -1; }
  const before = layoutOf(G.S, habId), o0 = pz && piecesOwned(G.S, b), n = (typeof b === 'string' ? G.scatter : G.paintCells)(habId, cells, b, pz ? pcOk > 0 ? PC_CAP - pcSpent : 0 : undefined);
  if (n) { undo.push(before); if (undo.length > UNDO) undo.shift(); redo = []; draw(); }
  if (pz) { const spent = (piecesOwned(G.S, b) - o0) * pz[1]; pcSpent += spent; // 238 E1 이어지는 조각: what the stroke cost (by pieces bought: act may add ♥ too), or why it stopped
    if (left() && pcOk < 0) toast($t('가방의 조각만 칠했어요 · ♥로 사려면 꾸미기를 다시 열어요'));
    else if (left() && G.S.hearts < pz[1]) toast($t('조각이 다 떨어졌어요 · 한 조각에 ♥{0}, 지금 ♥{1}', pz[1], G.S.hearts));
    else if (left() && pcOk > 0 && pcSpent + pz[1] > PC_CAP) toast($t('이번에 조각을 ♥{0}만큼 샀어요 · 더 사려면 꾸미기를 다시 열어요', pcSpent));
    else if (spent) toast($t('{0} {1}조각을 더 샀어요 · ♥-{2}', BRUSHES[b].name, spent / pz[1], spent)); if (!n) draw(); } }
// 238 E1 (?h232): buy a 이어지는 조각 brush (its first price: the right and one piece), asked first; true when bought
async function buyPieces(b) {
  const B0 = BRUSHES[b], [first, each] = B0.piece;
  if (G.S.hearts < first) { toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', first, G.S.hearts)); return false; }
  if (pcSpent + first > PC_CAP) { toast($t('이번에 조각을 ♥{0}만큼 샀어요 · 더 사려면 꾸미기를 다시 열어요', pcSpent)); return false; } // 248 D Q2: the right counts too
  const seq = pcSeq;
  if (!await ask($t('{0}{을/를} ♥{1}에 살까요? 첫 조각이 들어 있고, 다음 조각부터 한 칸에 ♥{2}예요 · 지운 조각은 가방에 남아 다시 놓을 때 공짜예요', B0.name, first, each), $t('이어지는 조각'))) return false;
  if (seq !== pcSeq || pcSpent + first > PC_CAP) return false; // reopened (or the cap reached) while asked
  if (!G.buyBrush(b)) { toast($t('지금은 살 수 없어요')); return false; }
  pcSpent += first; toast($t('{0} 샀어요 · ♥-{1}', B0.name, first)); sfx('place'); return true;
}
// inbox 42 F-6 자연 정리: the natives in the box drawn (habitat.js) put away at once; asked at the first box, ↶ brings them back
export async function onSweep(uids) {
  const ps = () => G.S.props.filter(p => p.nat && p.placed && p.hab === habId && uids.includes(p.uid)); if (el.hidden || !sweep || !ps().length) return;
  const n = ps().length, what = NATURE.map(N => [N.name, ps().filter(p => p.prop === N.id).length]).filter(([, k]) => k).map(([a, k]) => `${a} ${k}`).join(' · ');
  if (sweep === 1 && !await ask($t('네모 안의 자연 {0}개({1})를 치울까요? 치운 것은 자연 탭에서 다시 심고, ↶로 되돌릴 수 있어요.', n, what), $t('자연 정리'))) return;
  if (el.hidden || !sweep || !ps().length) return; sweep = 2;
  const q = ps(); keep(); G.setLayout(habId, moved(q.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast($t('자연 {0}개를 치웠어요 · ↶로 되돌릴 수 있어요', q.length)); sfx('undo');
}
G.on(() => { if (!el.hidden && sig() !== shown) draw(); });

const tabsHere = () => TABS.filter(t => t.id === 'nature' || (t.id === 'theme' ? themes().length : mine().some(P => tabOf(P) === t.id)));
// 203 D5 ?g190 테마: every SETS one with a prop sold here, its props under its name and how many of the set stand here
const themes = () => { const m = new Set(mine().map(P => P.id)); return SETS.map(s => [s, s.props.filter(id => m.has(id)).map(id => PROP[id])]).filter(([, ps]) => ps.length); };
const themeHead = s => { const n = s.props.filter(id => G.S.props.some(p => p.placed && p.hab === habId && p.prop === id)).length;
  return `<p class="dthm"><b>${$t('{0} 테마', s.name)}</b><small>${n === s.props.length ? $t('다 놓았어요 ✓') : $t('놓은 것 {0}/{1}', n, s.props.length)}</small></p>`; };
const ghostOf = rec => !rec.placed && !rec.nat ? G.S.ghost?.[habId]?.find(g => g.prop === rec.prop) : null; // 24-2: it starts on its 미리보기
// inbox 52: then the band the panel leaves (under the top bar and the BETA badge, over the panel less room for 가까운 빈 자리로) for its first spot and the view
function hold(rec, near) { held = rec; lookMore = false; hab.decor.edit(rec, ghostOf(rec), near); draw();
  hab.decor.show(Math.max(...['#habitat .bar', '.beta'].map(q => document.querySelector(q)?.getBoundingClientRect().bottom ?? 0)), el.getBoundingClientRect().top - 56); }
function step(from, to) { // 되돌리기 (from undo) / 다시 하기 (from redo)
  if (!from.length) return;
  if (held) { hab.decor.cancel(); held = null; }
  to.push(layoutOf(G.S, habId)); G.setLayout(habId, from.pop()); draw(); sfx('undo');
  // 184 ④ 되돌리기 다듬기: in the yard say what came back and what stays (♥로 산 것은 보관함, 넓힌 땅·부른 친구는 그대로, custom-zone.md 3-5)
  if (habId === 'yard') toast(from === undo ? $t('되돌렸어요 · 산 소품은 보관함으로, 넓힌 땅·부른 동물은 그대로예요') : $t('다시 했어요'));
}
// 86-3다: the full row shows only ↶ ↷ 땅 칠하기, the rest (격자 고르기 링크 사진) under 더보기, a second row (74: 사진 moved here from the top tools)
const DIST = [$t('가까이'), $t('보통'), $t('멀리')];
// 195 B-8 1-3 낮·밤 미리보기: the hour held at 22 or 12 while decorating (config.js VIEW, as 사진 모드: nothing saved), 지금 again on leaving
const NPV = [$t('지금'), $t('밤'), $t('낮')];
function nightPv(n) { if (npv || n) VIEW.hour = [null, 22, 12][n]; npv = n; VIEW.pv = n > 0; } // VIEW.pv: main.js gives no 도전 과제·밤 놀이 장면 for it
const yTools = () => habId !== 'yard' ? '' : $t('<button class="sb" data-ydist>거리{0}</button><button class="sb{1}" data-ytop aria-pressed="{2}">위에서</button>', yk < 0 ? '' : ' · ' + DIST[yk], ytop ? ' on' : '', ytop)
  + $t('<button class="sb{0}" data-ynight aria-pressed="{2}">낮·밤 · {1}</button>', npv ? ' on' : '', NPV[npv], npv > 0)
  + (brush === undefined ? '' : $t('<button class="sb{0}" data-ysz="1">1칸</button><button class="sb{1}" data-ysz="3">3×3</button><button class="sb{2}" data-ypan aria-pressed="{3}">화면 옮기기</button>', y3 ? '' : ' on', y3 ? ' on' : '', ypan ? ' on' : '', ypan));
const tools = () => { const g = $t('<button class="sb{0}" data-grid>격자</button>', grid ? ' on' : ''), ur = $t('<button class="sb" data-undo{0} aria-label="되돌리기">↶</button><button class="sb" data-redo{1} aria-label="다시 하기">↷</button>', undo.length ? '' : ' disabled', redo.length ? '' : ' disabled');
  if (SPM() && brush === undefined && !pick && !sweep) return $t('<div class="dtools">{0}<button class="sb" data-snap>사진</button></div>', ur); // 194 0-5 (4-4)
  return brush === undefined && !pick && !sweep ? $t('<div class="dtools">{0}<button class="sb" data-paint>땅 칠하기</button><button class="sb{1}" data-moretools aria-expanded="{2}">더보기</button></div>{3}', ur, moreT ? ' on' : '', moreT, habId === 'yard' ? `<div class="dtools">${yTools()}</div>` + (moreT ? $t('<div class="dtools">{0}<button class="sb" data-pick>고르기</button><button class="sb" data-snap>사진</button></div>', g) : '') : moreT ? $t('<div class="dtools">{0}<button class="sb" data-pick>고르기</button><button class="sb" data-share>링크</button><button class="sb" data-snap>사진</button></div>', g) : '')
    : `<div class="dtools">${g}${ur}</div>` + (habId === 'yard' ? `<div class="dtools">${yTools()}</div>` : ''); };
// inbox 25: the head (and the grip over it) folds the panel to one line and opens it again: a tap, or a drag down / up
const GRIP = () => $t('<button class="dgrip" data-fold aria-label="꾸미기 판 접기·펴기" aria-expanded="{0}"></button>', !min);
function fold(v) { if (v && (G.S?.flags.tut181 === 'decor' || /^d_/.test(document.body.dataset.tut || ''))) return; min = v; // 232 B: not folded in the tutorial's decor step (folded, 놓기 hid under it and the tutorial's layer went: stuck, 228a ①)
  el.classList.toggle('min', v); el.querySelector('.dgrip')?.setAttribute('aria-expanded', !v); }
el.addEventListener('pointerdown', e => { sy = e.target.closest('.dgrip, .dhead') && !e.target.closest('.dhead button') ? e.clientY : null; if (sy != null) e.target.setPointerCapture?.(e.pointerId); }); // 86-3다: a mouse let go above the panel still counts (a finger is captured anyway)
// 86-3다: open, it takes the bottom 40 %; dragged up again it grows (.tall), dragged down it comes back, then folds
el.addEventListener('pointerup', e => { if (sy == null) return; const dy = e.clientY - sy, t = el.classList.contains('tall'); sy = null; if (Math.abs(dy) > 24) { if (dy < 0 ? !min : t) el.classList.toggle('tall', dy < 0); else fold(dy > 0); swiped = Date.now() + 400; } });
const yGuide = () => { const S = G.S, d = [Object.keys(S.paint?.yard || {}).length > 0, S.props.some(p => p.hab === 'yard' && p.placed && !p.nat), visitors(S).length > 0];
  return d.every(Boolean) ? '' : $t('<p class="dyg">처음 할 일 · {0}</p>', [$t('① 땅 칠하기'), $t('② 소품 하나 놓기'), $t('③ 동물 부르기')].map((t, i) => d[i] ? `<s>${t}</s>` : t).join(' → ')); };
// 194 0-5 (9-1): the props of a habitat's layout before its 꾸미기 자리 (S.old194) still in storage there or in the yard's
const olds = () => Object.entries(G.S.old194 || {}).map(([h, l]) => { const L = (Array.isArray(l) ? l : []).filter(e => Array.isArray(e) && e.length >= 4 && e.slice(0, 4).every(Number.isFinite)), at = u => G.S.props.find(p => p.uid === u && !p.placed && !p.nat && PROP[p.prop] && (p.hab === h || p.hab === 'yard' && p.from === h)); // 194 review 낮음 3: an array of arrays (a ?yard trial's backup)
  return [h, L.filter(([u]) => at(u) && !PROP[at(u).prop].water), L.filter(([u]) => at(u) && PROP[at(u).prop].water).length]; }).filter(([h, l]) => HAB[h] && l.length); // 낮음 4: [h, those the yard takes, water ones (stay in h's storage: the yard has no water)]
const yRow = () => $t('<div class="dtools"><button class="sb" data-yv="imp">보관함에서 가져오기</button><button class="sb" data-yv="call">동물 부르기 {0}/{1}</button></div>', visitors(G.S).filter(a => !a.stored).length, capOf(G.S, 'yard'));
const homeIn = p => HAB[p.hab]?.name ?? '';
let yList = [];
function yPage() {
  const S = G.S, imp = yv === 'imp', by = (L, k) => [...L.reduce((m, x) => m.set(k(x), [...m.get(k(x)) ?? [], x]), new Map()).values()];
  if (imp) { // one card a kind and habitat; the first uid of each is the one moved
    const there = S.props.filter(p => !p.placed && !p.nat && p.hab !== 'yard' && HAB[p.hab] && PROP[p.prop] && !PROP[p.prop].water && !PROP[p.prop].art), here = S.props.filter(p => !p.placed && !p.nat && p.hab === 'yard' && PROP[p.prop]);
    yList = [...by(there, p => p.prop + '@' + p.hab).map(g => ['imp', g]), ...by(here, p => p.prop).map(g => ['ret', g])];
    const card = ([k, g]) => { const P = PROP[g[0].prop], from = k === 'imp' ? homeIn(g[0]) : HAB[g[0].from ?? P.habitat]?.name ?? HAB.meadow.name;
      return $t('<button class="dprop" data-{0}="{1}"><img alt=""><b>{2}</b><small>{3}{4}</small><em>{5} {6}</em></button>', k, g[0].uid, P.name, k === 'imp' ? $t('{0} 보관함', from) : $t('뜰 보관함 · {0}{으로/로} 돌려보내요', from), P.effect ? $t(' · {0}에서 {1}{을/를} 불러요', HAB[P.habitat]?.name ?? from, SP[P.effect].name) : '', k === 'imp' ? $t('가져오기') : $t('돌려보내기'), g.length); };
    const ol = olds().map(([h, l, w]) => $t('<button class="dprop dold" data-old="{0}"><i></i><b>예전 {1} 배치 불러오기</b><small>자리가 생기기 전에 놓았던 소품 {2}개 · 뜰에 그 모양대로 놓아요</small></button>', h, HAB[h].name, l.length).replace('</small>', (w ? $t(' · 물가 소품 {0}개는 {1} 보관함에 그대로 있어요', w, HAB[h].name) : '') + '</small>')).join(''); // 194 0-5
    el.innerHTML = GRIP() + $t('<div class="dhead"><b>보관함에서 가져오기</b><span>다른 서식지에 넣어 둔 소품 · 값 없이 옮겨요</span><button class="back" data-yv="">뒤로</button></div>\n<div class="dlist"><div class="dgrid">{0}</div>\n<p class="dhint">{1}</p></div>', ol + yList.map(card).join(''), yList.length || ol ? $t('가져온 소품은 뜰 보관함에 들어가요 · 꾸미기 목록에서 꺼내 놓아요 · 물가 소품은 아직 못 가져와요') : $t('다른 서식지 보관함에 넣어 둔 소품이 없어요 · 그 서식지에서 「보관함에 넣기」를 하면 여기에 나와요'));
    el.querySelectorAll('.dprop img').forEach((img, i) => propThumb(yList[i][1][0].prop, hab.decor.model).then(u => { img.src = u; }, () => {}));
    return;
  }
  const mineA = S.animals.filter(a => callable(a) && !a.stay && !a.stored), here = visitors(S), cap = capOf(S, 'yard'), n = here.filter(a => !a.stored).length;
  yList = [...here.map(a => ['home', a]), ...mineA.map(a => ['call', a])];
  const swim = S.animals.some(a => !walker(a) && !a.stored && !a.pending);
  el.innerHTML = GRIP() + $t('<div class="dhead"><b>동물 부르기</b><span{0}>뜰에 {1}/{2}</span><button class="back" data-yv="">뒤로</button></div>\n<div class="dlist"><div class="dgrid">{3}</div>\n<p class="dhint">{4}</p></div>', n >= cap ? ' class="no"' : '', n, cap,
    yList.map(([k, a]) => $t('<button class="dprop" data-{0}="{1}"><img alt=""><b>{2}</b><small>{3}</small><em>{4}</em></button>', k, a.id, esc(callName(a)), k === 'home' ? $t('뜰에 놀러 왔어요') : $t('{0}에 있어요', HAB[habitatOf(a)]?.name ?? ''), k === 'home' ? $t('집으로') : $t('부르기'))).join(''),
    $t('걷는 동물만 올 수 있어요{0} · 넓히면 더 많이 와요 · 부른 동물은 언제든 집으로 돌아가요', swim ? $t(' (오리·백조는 다음에)') : ''));
  el.querySelectorAll('.dprop img').forEach((img, i) => { const a = yList[i][1]; figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }, () => {}); });
}
function draw() {
  shown = sig(); el.classList.toggle('min', min); hab.decor.rails(!held && !pick && brush === undefined && tab === 'train'); // 42 F-4: the rail ends' dots
  if (held?.ring) { const [k, n] = ringCost(), c = ok && hab.decor.clears();
    el.innerHTML = GRIP() + ROOM + $t('<div class="dhead"><b>예시 고리</b><span class="{0}">{1}</span></div>\n{2}<div class="dinfo"><span>8×8칸 · 곡선 레일 4조각{3}{4}</span></div>\n<div class="nbtns"><button class="sb" data-cancel>취소</button><button class="go" data-place{5}>놓기{6}</button></div>\n<p class="dhint">끌어서 옮겨요 · 놓으면 바로 태엽 기차가 달려요</p>', ok ? 'ok' : 'no', ok ? $t('여기에 놓을 수 있어요') : $t('빨간 곳엔 놓을 수 없어요'), heldLine(), n ? $t(' · 넣어 둔 곡선 {0}개 써요', n) : '', c ? $t(' · 자리의 들꽃·나무 {0}개는 넣어 둬요', c) : '', ok ? '' : ' disabled', k ? ` <span class="hrt">♥</span>${k}` : '');
    return;
  }
  if (held) {
    const N = held.nat && NAT[held.prop], P = N ? { ...N, r: N.r * (held.s || 1) } : PROPS.find(P => P.id === held.prop), name = P.name;
    const sx = !N && stowed(P.id).some(s => s.uid !== held.uid), more = !N && (sx || !P.paid && !P.gift); // 하나 더: one put away first, else bought (41: a gift one is never bought)
    const lk = !N && hab.decor.look(), pal = lk && paletteOf(P), big = lk && sizable(P); // 28-5 its look now (c, sz)
    const dsz = big && lookMore ? $t('<span class="dsz" role="group" aria-label="크기">{0}</span>', [1, 0, 2, 3].map(i => `<button class="${lk.sz === i ? 'on' : ''}" data-sz="${i}">${SIZES[i]}</button>`).join('')) : '';
    // 194 0-1 ⑧: 놓기 (with its price, a 미리보기) on the first row; 보관함에 넣기 ⑦, 하나 더 and 더보기 (colors and sizes, ② keeps the held panel near 28 %) on a row of their own
    el.innerHTML = GRIP() + (P.rail || !ok ? ROOM : '') + $t('<div class="dhead"><b>{0}</b><span class="{1}">{2}</span></div>\n{3}{4}\n<div class="dinfo"><span>{5}</span>{6}</div>\n<div class="nbtns"><button class="sb" data-cancel>취소</button>{7}<button class="sb" data-rot="90">⟳90°</button><button class="go" data-place{8}>놓기{9}</button></div>\n<div class="nbtns dsub">{10}{11}{12}</div>\n<p class="dhint">끌어서 옮겨요 · {13}{14}</p>', name, ok ? 'ok' : 'no', ok ? $t('여기에 놓을 수 있어요') : $t('빨간 곳엔 놓을 수 없어요'), P.rail ? heldLine() : '', lookMore && (pal || dsz) ? `<div class="dlook">${pal ? $t('<span class="dsw" role="group" aria-label="색">{0}</span>', pal.map(([nm, hx, x], i) => x && lk.c !== i && !G.S.looks[P.id]?.includes(i) ? '' : `<button class="${lk.c === i ? 'on' : ''}${hx ? '' : ' orig'}" data-c="${i}" aria-label="${nm}" title="${nm}"${hx ? ` style="background:${hx}"` : ''}></button>`).join('')) : ''}${dsz}</div>` : '', info(P, N, N ? 1 : sizeF(P, lk?.sz)), N ? `<button class="sb dcut" data-stow>${cut(held.prop)}</button>` : '', P.rail ? '' : $t('<button class="sb" data-rot="15" aria-label="15도 돌리기 · 길게 누르면 자유롭게">⟳15°</button>'), ok ? '' : ' disabled', held.buy ? ` <span class="hrt">♥</span>${held.buy.price}` : '', N || held.buy ? '' : $t('<button class="sb" data-stow>보관함에 넣기</button>'), more ? $t('<button class="sb" data-more>하나 더 {0}</button>', sx ? $t('꺼내기') : can(G.S, 'prop:' + P.id) ? `<span class="hrt">♥</span>${P.price}` : `· Lv ${needFor('prop:' + P.id)}`) : '', pal || big ? $t('<button class="sb{0}" data-hmore aria-expanded="{1}">더보기</button>', lookMore ? ' on' : '', lookMore) : '', P.rail ? $t('레일은 큰 칸에 맞춰 이어져요') : P.small ? $t('탁자·선반·평상 가까이 끌면 위에 올라가요') : grid ? $t('격자 칸에 맞춰 놓여요') : $t('⟳15°를 길게 누르면 자유롭게 돌아요'), N ? $t(' · {0} 것은 자연 탭에서 다시 심어요', held.prop === 'rock' ? $t('치운') : $t('벤')) : '');
    if (SPM() && !N && !P.rail) { // 194 0-5 (4-4): on 꾸미기 자리 it turns a quarter at a time, has no size, and the lit spots are the places
      el.querySelectorAll('[data-rot="15"], .droom, .dsz').forEach(b => b.remove()); el.querySelector('.dhint').textContent = $t('빛나는 빈 자리를 누르거나 끌어서 옮겨요 · 자리 하나에 소품 하나');
      if (!ok) el.querySelector('.dhead span').textContent = $t('맞는 빈 자리가 없어요'); }
    return;
  }
  if (pick) { // 26-6 고르기: taps pick and let go; the arrows move all of them a cell, ⟳90° turns them round their middle
    const ps = picks(), n = ps.length, off = n ? '' : ' disabled'; hab.decor.picked(ps);
    el.innerHTML = GRIP() + $t('<div class="dhead"><b>여러 개 고르기</b><span>{0}개 골랐어요</span><button class="back" data-done>다 했어요</button></div>\n{1}<div class="nbtns dpad"><button class="sb" data-mv="l" aria-label="왼쪽으로 한 칸"{2}>←</button><button class="sb" data-mv="u" aria-label="위로 한 칸"{3}>↑</button><button class="sb" data-mv="d" aria-label="아래로 한 칸"{4}>↓</button><button class="sb" data-mv="r" aria-label="오른쪽으로 한 칸"{5}>→</button><button class="sb" data-grot{6}>⟳90°</button></div>\n<div class="nbtns"><button class="sb" data-clear>판 비우기</button><button class="go" data-gstow{7}>{8}넣기</button></div>\n<p class="dhint">놓인 소품이나 나무를 누르면 골라요(다시 누르면 빠져요) · 화살표는 한 칸씩 옮겨요</p>', n, tools(), off, off, off, off, off, off, n ? $t('{0}개 ', n) : '');
    return;
  }
  if (sweep) { // inbox 42 F-6 자연 정리: a finger draws a box, two move the view
    el.innerHTML = GRIP() + $t('<div class="dhead"><b>자연 정리</b><span>손가락으로 네모를 그리면 그 안의 나무·바위·덤불·들꽃을 한 번에 치워요</span></div>\n{0}<div class="nbtns">{1}<button class="go" data-endsweep>다 했어요</button></div>\n<p class="dhint">두 손가락으로 화면을 옮기고 키워요 · 치운 것은 자연 탭에서 다시 심어요 · 물가 돌·다리·울타리 밖 숲은 그대로예요</p>', tools(), grown() ? $t('<button class="sb" data-wclear>자란 것 모두 치우기</button>') : '');
    return;
  }
  hab.decor.picked(null);
  if (yv && brush === undefined) return yPage(); // 182 ④
  if (brush !== undefined) { // 땅 칠하기: the brushes; a finger paints the cells it passes, two move the view
    el.innerHTML = GRIP() + $t('<div class="dhead"><b>땅 칠하기</b><span>칸을 손가락으로 칠해요 · 길은 옆 칸과 저절로 이어지고, 울타리·돌담은 동물이 돌아가요</span></div>\n<div class="dbrush">{0}<button class="{1}" data-brush="x"><i class="erase"></i>지우개</button></div>\n{2}<div class="nbtns">{3}<button class="go" data-endpaint>다 칠했어요</button></div>\n<p class="dhint">두 손가락으로 화면을 옮기고 키워요{4}</p>', BRUSHES.map((b, i) => { if (!brushIn(i, habId) || b.id === 'bloom') return ''; /* 74: 꽃밭 merged into 풀 (67-3 made them alike; painted cells stay) */ const k = 'brush:' + b.id, lk = !can(G.S, k), pz = b.piece, own = pz && piecesOwned(G.S, i); /* 238 E1 이어지는 조각: ♥ first, then the pieces left · ♥ each */ return `<button class="${brush === i ? 'on' : lk || pz && !own ? 'lock' : ''}" data-brush="${i}"><i style="background:${b.c}"></i>${b.name}${lk ? `<small>Lv ${needFor(k)}</small>` : pz ? `<small>${own ? $t('{0}조각 · ♥{1}', own - piecesUsed(G.S, i), pz[1]) : `<span class="hrt">♥</span>${pz[0]}`}</small>` : ''}</button>`; }).join('') + scBtns(), brush === null ? 'on' : '', tools(), trails(G.S, habId).length && firmB() != null ? $t('<button class="sb" data-firm>진짜 길로 굳히기<small>동물들이 다닌 길 {0}칸 → {1}</small></button>', trails(G.S, habId).length, BRUSHES[firmB()].name) : '', habId === 'yard' ? $t(' · 「화면 옮기기」를 켜면 한 손가락으로 화면을 옮겨요 · 물은 보기만 하는 얕은 물이에요') + $t(' · 문은 울타리·돌담·생울타리 줄에 칠하면 동물이 드나들고, 두 칸이면 큰 문이에요 · 나무다리는 물을 건너요') + (hab.decor.fine?.TXT.hint ?? '') : habId === 'pond' ? $t(' · 연못은 물가 풀밭만 칠해요') : habId === 'snow' ? $t(' · 설원은 얼음 연못 밖 눈밭만 칠해요') : habId === 'dino' ? $t(' · 공룡 정글은 석호 밖 땅만 칠해요') : '');
    return;
  }
  const rl = tab === 'train', spm = SPM() && !rl, [n, cap] = rl ? [railsIn(G.S, habId), B.decor.rails] : spm ? spotsUsed(G.S, habId) : [placedIn(G.S, habId).length, decorCap(G.S, habId)], L = levelOf(G.S, habId), price = expPrice(G.S, habId), xk = 'expand:' + (L + 1), yd = habId === 'yard', xl = price != null && !yd && !can(G.S, xk);
  // 땅 넓히기 (21-3b): the first cell; one band of the board at a time, under the mist till then
  const exp = $t('<button class="dprop dexp{0}" data-expand{1}><i></i><b>땅 넓히기 {2}/{3}</b><small>{4}</small><em>{5}</em></button>', xl ? ' lock' : '', price == null ? ' disabled' : '', L, yd ? YARD_B.price.length : B.expand.price.length, price == null ? $t('다 넓혔어요') : yd ? $t('다음: {0}×{1}칸 · {2}마리 · 소품 {3}개까지', ...YARD_B.cells[L + 1], YARD_B.animals[L + 1], YARD_B.props[L + 1]) : SPM() ? $t('다음: {0} · {1}마리 · 꾸미기 자리 {2}개', ZONES[habId][L].name, B.expand.visible[L], SPOTS[habId].filter(s => s.L <= L + 1).length) : $t('다음: {0} · {1}마리 · 소품 {2}개까지', ZONES[habId][L].name, B.expand.visible[L], B.expand.decor[L]), price == null ? $t('완료') : xl ? `Lv ${needFor(xk)}` : price === 0 ? $t('무료') : `<span class="hrt">♥</span>${price}`);
  const [rk, rn] = ringCost(), rlk = rk && !can(G.S, 'prop:railcurve'), ring = rl ? $t('<button class="dprop dring{0}" data-ring><img alt=""><b>예시 고리 한 번에 놓기</b><small>곡선 4개로 된 작은 고리 · 놓으면 바로 기차가 달려요</small><em>{1}{2}</em></button>', rlk ? ' lock' : '', rlk ? `Lv ${needFor('prop:railcurve')}` : rk ? `<span class="hrt">♥</span>${rk}` : $t('넣어 둔 곡선'), rn && rk && !rlk ? $t(' · 곡선 {0}개 써요', rn) : '') : '';
  const lvOf = P => stowed(P.id).length || can(G.S, 'prop:' + P.id) ? 0 : needFor('prop:' + P.id), // 42 F-5: the ones open first, then by the level they open at
    th = tab === 'theme' && themes(), heads = th ? th.reduce((h, [s, ps]) => (h.at[h.i] = themeHead(s), h.i += ps.length, h), { at: [], i: 0 }).at : [],
    noSpot = P => +(spm && capped(G.S, habId, P.id)), // 194 0-5: the ones with a free spot that takes them first
    list = th ? th.flatMap(([, ps]) => ps) : mine().filter(P => tabOf(P) === tab).sort((a, b) => noSpot(a) - noSpot(b)).sort((a, b) => lvOf(a) - lvOf(b)) /* stable: by level, then the ones with a spot */, nats = tab === 'nature' && !spm ? NATURE.filter(N => yd || stowedNat(N.id).length) : [], sh = G.shelf(habId);
  el.innerHTML = GRIP() + $t('<div class="dhead"><b>꾸미기</b><span{0}>놓은 {1} {2} / {3}</span><button class="back" data-done>완료</button></div>\n{4}{5}<div class="dlist">{6}<div class="dtabs">{7}</div>\n<div class="dgrid">{8}{9}{10}{11}{12}{13}</div>\n<p class="dhint">{14}</p></div>', n >= cap ? ' class="no"' : '', rl ? $t('레일') : spm ? $t('자리') : $t('소품'), n, cap, rl ? railLine(railNow(false), '', $t('<button class="sb" data-rhelp>놓는 법</button>')) : '', tools(), (yd ? yGuide() + yRow() : '') + shelfRow(sh), tabsHere().map(t => `<button class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${t.name}</button>`).join(''), ring, exp, L ? $t('<button class="dprop dcmp" data-compare><i></i><b>넓히기 전과 비교</b><small>처음 땅과 지금 땅을 위에서 봐요</small></button>') : '', tab === 'nature' && !spm ? $t('<button class="dprop dsweep" data-sweep><i></i><b>자연 정리</b><small>네모를 그려 그 안의 나무·바위·덤불을 한 번에 치워요</small></button>') : '', nats.map(N => yd ? $t('<button class="dprop dnat" data-n="{0}"><img alt=""><b>{1}</b><small>자연물 · 놓은 것 {2}/{3}</small><em>{4}</em></button>', N.id, N.name, natIn(G.S, 'yard'), natCap(G.S), stowedNat(N.id).length ? $t('넣어 둔 것 {0}', stowedNat(N.id).length) : $t('무료')) : $t('<button class="dprop dnat" data-n="{0}"><img alt=""><b>{1}</b><small>처음부터 있던 것 · 다시 심어요</small><em>넣어 둔 것 {2}</em></button>', N.id, N.name, stowedNat(N.id).length)).join(''), list.map((P, i) => { const s = stowed(P.id).length, lk = !s && !can(G.S, 'prop:' + P.id);
    return (heads[i] ?? '') + `<button class="dprop${lk ? ' lock' : ''}" data-p="${P.id}"><img alt=""><b>${P.name}</b><small>${propNote(P)}${sceneNote(P)}</small><em>${s ? $t('넣어 둔 것 {0}', s) : P.gift ? $t('놓았어요') : lk ? `Lv ${needFor('prop:' + P.id)}` : `<span class="hrt">♥</span>${P.price}`}</em></button>`; }).join(''), n >= cap ? full(rl && 'rail') : rl ? $t('레일 끝의 초록 점은 이어진 곳, 빨간 점은 열린 곳이에요 · 고리를 닫으면 태엽 기차가 달려요') : G.S.ghost?.[habId]?.length ? $t('반투명한 것은 불러온 배치의 미리보기예요 · 그 소품을 사거나 꺼내면 그 자리에서 시작해요') : $t('놓은 소품이나 나무를 누르면(길게 누르면 바로 끌어서) 옮기거나 넣을 수 있어요'));
  el.querySelectorAll('.dnat img').forEach((img, i) => propThumb('n:' + nats[i].id, () => hab.decor.natModel({ prop: nats[i].id, s: 1, v: 12 })).then(u => { img.src = u; }, () => {}));
  el.querySelectorAll('.dring img').forEach(img => propThumb('railring', hab.decor.model).then(u => { img.src = u; }, () => {}));
  el.querySelectorAll('.dsh img').forEach((img, i) => propThumb(sh.items[i].id, hab.decor.model).then(u => { img.src = u; }, () => {}));
  el.querySelectorAll('.dprop[data-p] img').forEach((img, i) => propThumb(list[i].id, hab.decor.model).then(u => { img.src = u; }, () => {}));
}

// put the held one down where it is (null: red there, or the cap)
function put() {
  const b = held?.buy, P = b && PROP[held.prop];
  if (b && G.S.hearts < b.price) { toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', b.price, G.S.hearts)); return null; }
  if (b && capped(G.S, habId, P.id)) { toast(full(P.id)); return null; }
  const r = hab.decor.confirm(); if (!r) { toast($t('빨간 곳엔 놓을 수 없어요')); return null; }
  if (b) { // 194 0-1 ①: bought now (the shelf's price while that shelf still shows it, else the list's)
    const h = G.S.hearts, it = b.shelf != null && G.shelf(habId).items[b.shelf], rec = it?.id === P.id && it.price === b.price ? G.buyShelf(habId, b.shelf) : G.buyProp(P.id, habId);
    if (!rec) { toast($t('지금은 살 수 없어요')); held = null; draw(); return null; }
    r.uid = rec.uid; toast($t('{0} 샀어요 · ♥-{1}', P.name, h - G.S.hearts));
  }
  const was = layoutOf(G.S, habId), ran = G.S.flags['train:' + habId], first = !G.S.props.some(p => p.placed && !p.nat), p = r.ring ? G.placeRing(habId, r.cells, r.clear) : G.placeProp(r.uid, r.x, r.z, r.rot, r); // 28-5 r: its colour, size, and the prop it stands on
  if (p && first) hab.decor.cheer(); // 92-3 (first.js's toast says what the task gave)
  if (!p && b) G.refundProp(r.uid); // bought just now and could not go down: its hearts back
  if (!p) toast(r.ring ? ringNo() ?? $t('놓을 수 없어요') : full(held?.prop)); else { sfx('place'); undo.push(was); if (undo.length > UNDO) undo.shift(); redo = []; if (r.ring && ran) toast($t('고리가 닫혔어요! 태엽 기차가 달려요'), 2600, true); } // the first loop: main.js says so
  held = null; draw(); hab.decor.reveal(r.x, r.z, el.getBoundingClientRect().top); return p;
}
// 26-6 하나 더: the held one goes down, then another of its kind is picked up beside it: one put away first, else bought
// (the list's own rules: level, hearts, the cap)
function another() {
  const P = PROPS.find(P => P.id === held.prop), s = stowed(P.id).find(s => s.uid !== held.uid);
  if (capped(G.S, habId, P.id, held.placed ? 0 : 1)) return toast(full(P.id));
  if (!s && !can(G.S, 'prop:' + P.id)) return locked('prop:' + P.id);
  const need = (held.buy?.price ?? 0) + (s ? 0 : P.price); // this one (a 미리보기 is bought as it goes down) and the next, at 놓기
  if (G.S.hearts < need) return toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', need, G.S.hearts));
  const p = put(); if (!p) return;
  hold(s ?? preview(P, { price: P.price }), { x: p.x, z: p.z, rot: p.rot });
}
// 26-6: the layout with these entries ([uid, placed, x, z, rot]) changed, for G.setLayout
// 28-1 넓히기 전과 비교: the first board and the board now, from straight above, side by side (habitat.js topView)
function compare() {
  const { was, now } = hab.topView(), L = levelOf(G.S, habId), w = document.createElement('section');
  w.id = 'cmpz'; w.className = 'intro pop cmpz'; w.setAttribute('aria-label', $t('넓히기 전과 비교'));
  w.innerHTML = $t('<div><h2>넓히기 전과 비교</h2><div class="cmpz2"><figure><figcaption>처음</figcaption></figure><figure><figcaption>지금 · {0}단계</figcaption></figure></div>\n<p class="sub">새로 연 구역: {1}</p><button data-close>닫기</button></div>', L, ZONES[habId].slice(0, L).map(z => z.name).join(' · '));
  const f = w.querySelectorAll('figure'); f[0].prepend(was); f[1].prepend(now);
  w.querySelector('[data-close]').onclick = () => w.remove(); habEl.append(w);
}
function moved(list) { const o = JSON.parse(layoutOf(G.S, habId)), by = new Map(list.map(e => [e[0], e])); o.p = o.p.map(e => by.get(e[0]) ?? e); return JSON.stringify(o); }
// 26-6: an arrow as the view goes (↑: away from the camera), on the board's own axes: [dx, dz]
function dirOf(k) {
  const { target: t, position: c } = hab.pose(), ox = t.x - c.x, oz = t.z - c.z, f = Math.abs(ox) > Math.abs(oz) ? [Math.sign(ox), 0] : [0, Math.sign(oz)], r = [-f[1], f[0]];
  return { u: f, d: [-f[0], -f[1]], r, l: [-r[0], -r[1]] }[k];
}
// 26-6: the picked ones a cell along (d: [dx, dz], first-board units) or turned 90° round their middle (d: null), if all of them fit there
function group(d) {
  const ps = picks(); if (!ps.length) return; if (d && ps.some(p => PROP[p.prop]?.rail)) d = d.map(v => v * 4); // 28-4: rails go a whole rail tile
  const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length, cz = ps.reduce((a, p) => a + p.z, 0) / ps.length, q = Math.PI / 2, f = v => +v.toFixed(2);
  const to = ps.map(p => d ? { ...p, x: f(p.x + d[0]), z: f(p.z + d[1]) } : { ...p, x: f(cx + (p.z - cz)), z: f(cz - (p.x - cx)), rot: f((p.rot + q) % (2 * Math.PI)) });
  const rides = d ? [] : G.S.props.filter(o => o.placed && pick.has(o.on) && !pick.has(o.uid)).map(o => [o.uid, 1, o.x, o.z, f(((o.rot || 0) + q) % (2 * Math.PI))]); // 28-5: what stands on them turns with them (rules.js tidy puts it on its spot)
  if (!hab.decor.fitAll(to, new Set(pick)).every(Boolean)) return toast(d ? $t('그쪽은 막혀 있어요 · 빨간 곳이 없게 옮겨 주세요') : $t('돌리면 겹치거나 밖으로 나가요'));
  keep(); G.setLayout(habId, moved([...to.map(p => [p.uid, 1, p.x, p.z, p.rot]), ...rides])); sfx('place');
}
// 26-6 판 비우기: every placed prop here into storage (the board's own trees etc. stay), asked once; ↶ brings it back
async function clearBoard() {
  const ps = G.S.props.filter(p => p.placed && p.hab === habId && !p.nat); if (!ps.length) return toast($t('놓인 소품이 없어요')); // 28-4: rails too
  if (!await ask($t('놓인 소품 {0}개를 모두 넣을까요? 나무·바위 같은 원래 자연은 그대로예요. ↶로 되돌릴 수 있어요.', ps.length), $t('판 비우기'))) return;
  keep(); G.setLayout(habId, moved(ps.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast($t('소품 {0}개를 넣어 뒀어요', ps.length)); sfx('undo');
}
// inbox 37 작은 고리: [hearts it costs, curves put away here it uses]; why it can't go now (null: it can); the corner button while a rail is held
const ringCost = () => { const n = Math.min(4, stowed('railcurve').length); return [(4 - n) * PROP.railcurve.price, n]; };
const ringNo = () => { const [k] = ringCost(); return capped(G.S, habId, 'railcurve', 3) ? full('railcurve') : k && !can(G.S, 'prop:railcurve') ? $t('레벨 {0}부터 살 수 있어요 · 지금 레벨 {1}', needFor('prop:railcurve'), G.S.lv) : G.S.hearts < k ? $t('하트 {0}개가 필요해요 · 지금 ♥{1}', k, G.S.hearts) : null; };
const ROOM = $t('<button class="sb droom" data-room>가까운 빈 자리로</button>');
// inbox 42 F-4: the rails here now as train.js sees them (h: the held one counted where it is, else as it was): open ends, a loop
const isRail = r => !!(r?.ring || PROP[r?.prop]?.rail);
function railNow(h = isRail(held)) {
  const U = hab.decor.unit, ps = G.S.props.filter(p => p.placed && p.hab === habId && PROP[p.prop]?.rail && !(h && p.uid === held.uid)).map(p => ({ uid: p.uid, prop: p.prop, x: p.x * U, z: p.z * U, rot: p.rot || 0 }));
  if (h) ps.push(...hab.decor.heldRails()); return ps.length ? railEnds(ps) : null;
}
const railLine = (r, pre = '', btn = '') => `<p class="drail${r?.loop ? ' ok' : r ? ' no' : ''}">${r ? pre : ''}${!r ? $t('아직 놓은 레일이 없어요') : r.loop ? $t('고리 완성 · 기차 출발!') : r.open ? $t('열린 끝 {0}곳', r.open) : $t('한 바퀴 도는 길이 없어요')}${btn}</p>`;
const heldLine = () => ok ? railLine(railNow(), $t('놓으면 ')) : railLine(railNow(false), $t('지금 '));
// 42 F-4: how rails go, in three pictures (rails: sleepers under two grey lines; dots as on the board): the 기차 tab's first open, its 놓는 법
const RL = d => `<path d="${d}" stroke="#b07a48" stroke-width="13" stroke-dasharray="3 3.5"/><path d="${d}" stroke="#9aa3ad" stroke-width="9"/><path d="${d}" stroke="#cfe6a8" stroke-width="5"/>`;
const DOT = (x, y, on) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${on ? '#4fcf5a' : '#ff4545'}" stroke="#fff" stroke-width="1.5"/>`;
const RINGD = 'M22 52a28 28 0 1 0 56 0a28 28 0 1 0-56 0', CAR = (x, y, r, c) => `<rect x="-7" y="-5" width="14" height="10" rx="3" fill="${c}" transform="translate(${x} ${y}) rotate(${r})"/>`;
const PICS = [[$t('① 레일 조각을 이어 붙여요'), $t('끝이 닿으면 초록 점, 열린 끝은 빨간 점이에요. 가까이 가져가면 방향이 저절로 맞아요'), RL('M10 62H50') + RL('M50 62H90') + DOT(10, 62) + DOT(50, 62, 1) + DOT(90, 62) + '<path d="M84 38H60m6-6-6 6 6 6" stroke="#6b4a2b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'],
  [$t('② 끝이 모두 이어져 고리가 되면 기차가 달려요'), $t('「예시 고리 한 번에 놓기」로 바로 놓을 수도 있어요'), RL(RINGD) + DOT(50, 24, 1) + DOT(78, 52, 1) + DOT(50, 80, 1) + DOT(22, 52, 1) + CAR(34, 29, -35, '#3fae6a') + CAR(25, 40, -65, '#ffc22e')],
  [$t('③ 갈림길·다리는 고리 안에 넣어요'), $t('고리의 한 조각으로 끼워 넣으면 기차가 지나가요'), RL(RINGD) + RL('M22 52H78') + '<path d="M68 83.2A36 36 0 0 1 32 83.2M60 69.3A20 20 0 0 1 40 69.3" stroke="#e8463c" stroke-width="3.5" stroke-linecap="round"/>' + DOT(22, 52, 1) + DOT(78, 52, 1)]];
function railHelp() {
  if (habEl.querySelector('.rhelp')) return; const w = document.createElement('section'); w.className = 'intro pop rhelp'; w.setAttribute('aria-label', $t('기차 레일 놓는 법'));
  w.innerHTML = $t('<div><h2>기차 레일 놓는 법</h2><ol>{0}</ol><button data-close>알겠어요</button></div>', PICS.map(([b, s, g]) => `<li><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="14" fill="#cfe6a8"/><g fill="none">${g}</g></svg><p><b>${b}</b>${s}</p></li>`).join(''));
  w.querySelector('[data-close]').onclick = () => w.remove(); habEl.append(w);
}
const railGuide = () => { if (!G.S.flags.railHelp && !G.S.flags.tipsOff && can(G.S, 'prop:railcurve')) { G.flag('railHelp'); railHelp(); } }; // 42 마무리: not while rails are still locked (27-7b at Lv 6)
const railTip = () => G.S.flags.railHelp || tip('train', '#decor .droom'); // 42 F-4: the 3-picture guide (railHelp) already told it; the bubble only for a rail got some other way
// 23-1: a thing the gardener's level hasn't opened yet
const locked = k => toast($t('레벨 {0}부터 살 수 있어요 · 지금 레벨 {1}', needFor(k), G.S.lv));
// at the cap (inbox 16): 땅 넓히기 raises it, till the last step; then swap
const full = id => SPM() && id !== 'rail' && !PROP[id]?.rail ? $t('맞는 빈 자리가 없어요 · {0}', expPrice(G.S, habId) == null ? $t('놓은 것을 넣고 바꿔 보세요') : $t('서식지를 넓히면 자리가 늘어요')) // 194 0-5
  : habId === 'yard' && NAT[id] ? $t('자연물을 {0}개 다 놓았어요 · 놓은 것을 넣거나 땅을 넓혀 보세요', natCap(G.S)) : habId === 'yard' && YARD_B.bigIds.includes(id) && capped(G.S, habId, id) && placedIn(G.S, habId).length < decorCap(G.S, habId) ? $t('큰 소품은 {0}개까지 놓아요 · 놓은 큰 소품을 넣고 바꿔 보세요', YARD_B.big) : PROP[id]?.rail ? $t('레일 {0}조각을 다 놓았어요 · 놓은 레일을 넣고 바꿔 보세요', B.decor.rails) : $t('소품을 {0}개 다 놓았어요 · {1}', decorCap(G.S, habId), expPrice(G.S, habId) == null ? $t('놓은 것을 넣고 바꿔 보세요') : $t('서식지를 넓히면 더 놓을 수 있어요'));
// 28-5: ⟳15° held down turns it on and on, a little at a time (the tap after that does not add 15°)
let spin = null, spun = 0;
el.addEventListener('pointerdown', e => { if (!e.target.closest('[data-rot="15"]')) return; clearTimeout(spin?.t); spin = { t: setTimeout(() => { spin.i = setInterval(() => hab?.decor.rotate(Math.PI / 90), 30); }, 350) }; });
const unspin = () => { if (!spin) return; clearTimeout(spin.t); if (spin.i) { clearInterval(spin.i); spun = Date.now() + 400; } spin = null; };
for (const k of ['pointerup', 'pointercancel']) addEventListener(k, unspin);
el.addEventListener('contextmenu', e => { if (e.target.closest('[data-rot]')) e.preventDefault(); });
el.addEventListener('click', async e => {
  const b = e.target.closest('button'), d = b?.dataset;
  if (d?.fold != null || !b && e.target.closest('.dhead')) { if (Date.now() > swiped) fold(!min); return; }
  if (!b || b.disabled) return;
  if (d.done != null) { if (pick) { pick = null; draw(); } else closeDecor(); }
  else if (d.pick != null) { pick = new Set(); draw(); }
  else if (d.mv || d.grot != null) group(d.mv ? dirOf(d.mv) : null);
  else if (d.gstow != null) { const ps = picks(); if (!ps.length) return; keep(); G.setLayout(habId, moved(ps.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast($t('{0}개를 넣어 뒀어요 · ↶로 되돌릴 수 있어요', ps.length)); sfx('place'); }
  else if (d.clear != null) clearBoard();
  else if (d.more != null) another();
  else if (d.cancel != null) { hab.decor.cancel(); held = null; draw(); } // back where it was before it was picked up; a 미리보기 was never bought (194 0-1 ①)
  else if (d.expand != null) {
    const L = levelOf(G.S, habId), price = expPrice(G.S, habId);
    if (habId !== 'yard' && !can(G.S, 'expand:' + (L + 1))) return locked('expand:' + (L + 1));
    if (G.S.hearts < price) return toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', price, G.S.hearts));
    if (G.buyExpand(habId)) closeDecor(); // main.js rebuilds the habitat (the mist lifts), then says 「땅을 넓혔어요」
  }
  else if (d.compare != null) compare();
  else if (d.share != null) openShare(habId, hab, keep); // 24-2 꾸미기 코드; 69-4 구경 링크
  else if (d.snap != null) { closeDecor(); document.getElementById('snapBtn').click(); }
  else if (d.moretools != null) { moreT = !moreT; draw(); }
  else if (d.hmore != null) { lookMore = !lookMore; draw(); }
  else if (d.grid != null) { grid = !grid; hab.decor.grid(grid); draw(); }
  else if (d.undo != null) step(undo, redo);
  else if (d.redo != null) step(redo, undo);
  else if (d.tab) { tab = d.tab; draw(); if (tab === 'train') railGuide(); }
  else if (d.rhelp != null) railHelp();
  else if (d.paint != null) { brush = brushIn(1, habId) ? 1 : 5; hab.decor.paint(brush); draw(); } // 흙길 first: the brush most will want (25-1 the snow: 눈)
  else if (d.brush) { const sc = /^s[\dx]$/.test(d.brush); if (sc && habId !== 'yard') return; // 195 B-8 1-2 흩뿌리기 붓: the yard's, no Lv (13-1 16: not sold)
    if (!sc && d.brush !== 'x' && !can(G.S, 'brush:' + BRUSHES[+d.brush].id)) return locked('brush:' + BRUSHES[+d.brush].id);
    const pz = !sc && d.brush !== 'x' && BRUSHES[+d.brush].piece; if (pz && !piecesOwned(G.S, +d.brush) && !await buyPieces(+d.brush)) return; /* 238 E1 */ brush = sc ? d.brush : d.brush === 'x' ? null : +d.brush; hab.decor.paint(brush, sc ? capAt(levelOf(G.S, 'yard')) : undefined); draw(); }
  else if (d.sweep != null) { sweep = 1; hab.decor.sweep(true); draw(); }
  else if (d.endsweep != null) { sweep = 0; hab.decor.sweep(false); draw(); }
  else if (d.firm != null) { const b = firmB(), c = trails(G.S, habId).map(([k]) => k.split(',').map(Number)); if (b == null || !c.length) return;
    keep(); const n = G.paintCells(habId, c, b); if (!n) { undo.pop(); return; } toast($t('동물들이 다닌 길 {0}칸을 {1}로 굳혔어요 · ↶로 되돌릴 수 있어요', n, BRUSHES[b].name)); sfx('place'); draw(); }
  else if (d.wclear != null) { const n = grown(); if (!n || !await ask($t('저절로 자란 들꽃·이끼·갈대·수련과 동물들이 다닌 길을 모두 치울까요? 며칠 지나면 다시 자라요.'), $t('치우기'))) return;
    G.wildClear(habId); toast($t('자란 것을 치웠어요 · 며칠 지나면 다시 자라요')); sfx('undo'); draw(); }
  else if (d.endpaint != null) { brush = undefined; hab.decor.paint(undefined); draw(); }
  else if (d.rot) { if (Date.now() > spun) hab.decor.rotate(+d.rot * Math.PI / 180); }
  else if (d.c || d.sz) { hab.decor.look(d.c ? { c: +d.c } : { sz: +d.sz }); draw(); }
  else if (d.stow != null) {
    const N = held.nat && NAT[held.prop];
    if (held.placed) { keep(); G.stowProp(held.uid); }
    hab.decor.cancel(); toast(N ? $t('{0}{을/를} {1} · 자연 탭에서 다시 심을 수 있어요', N.name, N.id === 'rock' ? $t('치웠어요') : $t('베었어요')) : $t('넣어 뒀어요 · 언제든 다시 놓을 수 있어요')); held = null; draw();
  }
  else if (d.room != null) { if (!hab.decor.room()) toast(held?.ring || PROPS.find(P => P.id === held?.prop)?.rail ? $t('이 서식지엔 고리가 들어갈 빈 땅이 없어요 · 소품을 조금 치워 보세요') : $t('가까이에 빈 자리가 없어요 · 소품을 조금 치워 보세요')); }
  else if (d.ring != null) { const no = ringNo(); if (no) toast(no); else { hold({ ring: true, prop: 'railring' }); if (!ok) hab.decor.room(); railTip(); } }
  else if (d.shelf) { // 13-3: bought at the shelf's price (a 진열대 색 comes with it), then held like one from the list
    const it = G.shelf(habId).items[+d.shelf], P = it && PROP[it.id]; if (!P) return draw();
    if (capped(G.S, habId, P.id)) toast(full(P.id));
    else if (G.S.hearts < it.price) toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', it.price, G.S.hearts));
    else { hold(preview(P, { price: it.price, shelf: +d.shelf }, it.c)); if (it.c) toast($t('진열대 색 「{0}」 · 놓으면 ♥{1}에 사요', paletteOf(P)[it.c][0], it.price)); }
  }
  else if (d.place != null) put(); else if (d.n) { const s = stowedNat(d.n)[0] ?? (habId === 'yard' ? G.takeNat(d.n) : null); if (s) hold(s); else if (habId === 'yard') toast(full(d.n)); } // 182 ④ the yard's free nature
  else if (d.yv != null) { yv = d.yv || null; draw(); }
  else if (d.ydist != null) { yk = (yk + 1) % 3; hab.decor.dist(yk); draw(); }
  else if (d.ytop != null) { ytop = !ytop; hab.decor.top(ytop); draw(); }
  else if (d.ynight != null) { nightPv((npv + 1) % 3); draw(); } // 195 B-8
  else if (d.ysz) { y3 = d.ysz === '3'; hab.decor.size(y3); draw(); }
  else if (d.ypan != null) { ypan = !ypan; hab.decor.pan(ypan); draw(); }
  else if (d.old) oldBack(d.old); // 194 0-5
  else if (d.imp || d.ret) { const P = PROP[yList.find(([k, g]) => String(g[0].uid) === (d.imp || d.ret))?.[1][0].prop]; if (!P) return draw();
    if (d.imp ? G.importProp(+d.imp) : G.returnProp(+d.ret)) { sfx('place'); toast(d.imp ? $t('{0}{을/를} 뜰 보관함에 가져왔어요', P.name) : $t('{0}{을/를} 돌려보냈어요', P.name)); } draw(); }
  else if (d.call) { const a = G.callToYard(+d.call); if (!a) return toast(visitors(G.S).filter(x => !x.stored).length >= capOf(G.S, 'yard') ? $t('뜰에는 {0}마리까지 와요 · 땅을 넓히면 더 와요', capOf(G.S, 'yard')) : $t('지금은 부를 수 없어요'));
    hab.drop(a); sfx('place'); toast($t('{0}{이/가} 뜰에 놀러 왔어요', esc(callName(a)))); draw(); }
  else if (d.home) { const a = G.sendHome(+d.home); if (a) toast($t('{0}{이/가} {1}{2}', esc(callName(a)), a.stored ? $t('보관함으로 갔어요 · ') : '', a.stored ? $t('집에 자리가 없어요') : $t('{0}에 돌아갔어요', HAB[habitatOf(a)]?.name ?? ''))); draw(); }
  else if (d.p) {
    const P = PROPS.find(P => P.id === d.p), s = stowed(P.id)[0];
    if (capped(G.S, habId, P.id)) toast(full(P.id));
    else if (s) hold(s);
    else if (P.gift) toast($t('{0}{은/는} 선물로만 받아요 · 받은 것은 다 놓았어요', P.name));
    else if (!can(G.S, 'prop:' + P.id)) locked('prop:' + P.id);
    else if (G.S.hearts < P.price) toast($t('하트 {0}개가 필요해요 · 지금 ♥{1}', P.price, G.S.hearts));
    else { hold(preview(P, { price: P.price })); if (P.rail) railTip(); }
  }
});
