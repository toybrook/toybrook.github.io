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
import * as G from '../game/game.js';
import { BALANCE as B, BIGS, PROPS, SCENES, NATURE, BRUSHES, SETS, ZONES, brushIn, paletteOf, SIZES, sizeF, sizable } from '../game/data.js';
import { SP, PROP, placedIn, railsIn, capped, levelOf, decorCap, layoutOf, can as canLv, needFor } from '../game/rules.js';
const can = (S, k) => canLv(S, k) || k === 'prop:' + G.tutShop(); // 66-1: the tutorial's 등불 is sold before its Lv
import { propThumb } from './thumbs.js';
import { toast, josa, tip, ask } from './hud.js';
import { openShare } from './share.js';
import { sfx } from './sound.js';
import { railEnds } from '../habitat/train.js';

const el = document.getElementById('decor'), habEl = document.getElementById('habitat');
// 13-2: a play prop's 놀이 장면 (seen / all): a reason to buy and place it
const sceneNote = P => { const L = SCENES.filter(s => s.prop === P.id); return L.length ? ` · 놀이 장면 ${L.filter(s => G.S.scenes[s.id]).length}/${L.length}` : ''; };
export const propNote = P => P.gift || P.use || (P.effect ? `${SP[P.effect].name}${josa(SP[P.effect].name, '이', '가')} 조금 더 자주 와요`
  : P.light ? '밤이 되면 불이 켜져요' : P.shelter ? `${P.habitat === 'snow' ? '눈' : '비'} 오면 몸집이 맞는 동물이 쉬러 와요` : '보기만 해도 좋은 장식이에요');
// 13-3 오늘의 진열대: three props, a new display every PACE shelf.hours (「다음 진열 1:42」 counts down here; no notification)
const hm = ms => { const m = Math.max(1, Math.ceil(ms / 60e3)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
let shelfEnds = 0;
const shelfRow = sh => { shelfEnds = sh.ends; return sh.items.length ? `<div class="dshelf"><p><b>오늘의 진열대</b><span data-left>다음 진열 ${hm(sh.ends - G.now())}</span></p><div>${sh.items.map((it, i) => { const P = PROP[it.id], c = it.c && paletteOf(P)[it.c];
  return `<button class="dsh${it.off ? ' sale' : ''}" data-shelf="${i}"><img alt="">${c ? `<i style="background:${c[1]}"></i>` : ''}<b>${P.name}</b><small>${c ? `진열대 색 · ${c[0]}` : it.off ? `${Math.round(B.shelf.off * 100)}% 싸게` : '이번 진열'}</small><em>${it.off ? `<s>${P.price}</s> ` : ''}<span class="hrt">♥</span>${it.price}</em></button>`; }).join('')}</div></div>` : ''; };
setInterval(() => { const s = !el.hidden && el.querySelector('[data-left]'); if (!s) return; if (G.now() >= shelfEnds) draw(); else s.textContent = '다음 진열 ' + hm(shelfEnds - G.now()); }, 1000);
// the tabs and the props in each (one not listed goes under 가구; 28-2 놀이: the props animals use); the board's own nature put away shows under 자연
const TABS = [['nature', '자연', 'flowers tulips tallgrass stones mushrooms log cycad'], ['path', '길', 'fence path'], ['light', '조명', 'lantern jar mushlamp starlamp icelamp lavalamp'],
  ['furniture', '가구', 'bench mailbox pinwheel vane hay trough snowman sled dinonest ribs'], ['big', '큰 소품', BIGS], ['water', '물가', 'lily boat stepping'],
  ['play', '놀이', 'swing slide seesaw ball hammock fountain campfire feeder musicbox bubbles lights fireworks pinhill bell'], ['home', '집', 'table shelf platform doll'], ['land', '땅', 'hillock puddle flowermound rockmound'], ['train', '기차', 'rail railcurve railfork railbridge'], ['gift', '선물', 'att_sunflower att_birdhouse att_balloons att_wcan att_signpost att_cart att_rainbow firstday walk_cairn walk_acorn walk_pinecone sky_scope myth_altar ev_igloo ev_sled ev_snowman ev_icelamp ev_bigsnowman ev_album ev_slide ev_flakelamp ev_snowfam ev_mitten fos_ammonite fos_bone fos_egg fos_skull gst_kite gst_basket gst_milkcan gst_bottle gst_reedpipe gst_parasol gst_teapot gst_sleighbell gst_scarfpost gst_picnicbox gst_beachdoll gst_tealamp']].map(([id, name, ps]) => ({ id, name, ps: ps.split(' ') }));
const tabOf = P => (TABS.find(t => t.ps.includes(P.id)) ?? TABS[3]).id;
export const tabName = id => TABS.find(t => t.id === tabOf({ id })).name; // 66-1: where a guest's gift waits
const NAT = Object.fromEntries(NATURE.map(n => [n.id, n])), cut = id => id === 'rock' ? '치우기' : '베기';
const UNDO = 20;

let habId = null, hab = null, held = null, fresh = null, ok = false, shown = ''; // fresh: the uid bought for this hold (취소 refunds it)
let tab = 'nature', brush, grid = false, undo = [], redo = [], min = false, sy = null, swiped = 0, pick = null, sweep = 0; // sweep: 자연 정리 on (1: asks at the first box, 2: asked) // pick: the uids picked (고르기), null: not picking; // min (inbox 25): the panel folded to its head // brush: BRUSHES index, null: the eraser, undefined: not painting
const mine = () => PROPS.filter(P => (P.habitat ?? habId) === habId && (!P.gift || G.S.props.some(p => p.prop === P.id && p.hab === habId))); // 41: a gift one only once had here
const stowed = id => G.S.props.filter(p => p.prop === id && p.hab === habId && !p.placed && !p.nat);
const stowedNat = id => G.S.props.filter(p => p.nat && p.prop === id && p.hab === habId && !p.placed);
const sig = () => JSON.stringify([G.S.hearts, G.S.props, G.S.paint?.[habId], G.S.ghost?.[habId], held?.uid, ok, held?.ring && hab.decor.clears(), tab, brush, sweep, grid, undo.length, redo.length, pick && [...pick], isRail(held) && heldLine()]);
const picks = () => G.S.props.filter(p => pick?.has(p.uid) && p.placed && p.hab === habId); // those picked still on the board
// a size in 1 m cells (its footprint across; inbox 52: 1 m as the sizes and the rails step, not the 1.5 m 격자, so 작게·보통·크게·아주 크게
// differ in number too - text only, the sizes and snapping are as they were), its set, a light at night
const info = (P, N, f = 1) => { const n = Math.max(1, Math.round(2 * P.r * f)), s = !N && SETS.find(s => s.props.includes(P.id));
  return [`${n}×${P.id === 'railbridge' ? n / 2 : n}칸`, s && `${s.name} 세트`, N ? '처음부터 있던 것' : P.light && '밤에 빛나요'].filter(Boolean).join(' · '); };
// before a change: the layout as it is, for 되돌리기 (a new change forgets what 다시 하기 had)
const keep = () => { undo.push(layoutOf(G.S, habId)); if (undo.length > UNDO) undo.shift(); redo = []; };

export function openDecor(id, api) {
  habId = id; hab = api; held = null; brush = undefined; grid = false; undo = []; redo = []; min = false; pick = null; sweep = 0;
  if (!tabsHere().some(t => t.id === tab)) tab = 'nature';
  el.hidden = false; habEl.classList.add('decorating'); hab.decor.mode(true); draw(); tip('decor', '#decor .dgrid'); tip('expand', '#decor .dexp'); tip('nature', '#decor [data-sweep]'); if (tab === 'train') railGuide();
}
// decorTab opens 꾸미기 on a tab (in a habitat; the panel up: that tab); first.js 「다음은 큰 소품」
export function decorTab(t) { const b = document.getElementById('decorBtn'); tab = t; if (!el.hidden) draw(); else if (b.offsetParent) b.click(); }
export function closeDecor() { if (el.hidden) return; hab?.decor.mode(false); held = null; brush = undefined; pick = null; sweep = 0; el.hidden = true; habEl.classList.remove('decorating'); }
export const leaveDecor = () => { closeDecor(); hab = null; };
// from habitat.js: a placed prop tapped (pick it up), the held one moved (green / red), a paint stroke done
export function onPropTap(uid) { const rec = G.S.props.find(p => p.uid === uid); if (!rec || el.hidden || brush !== undefined || sweep) return;
  if (pick) { pick.has(uid) ? pick.delete(uid) : pick.add(uid); draw(); } else hold(rec); }
export function onEdit(can) { ok = can; if (held && sig() !== shown) draw(); }
export function onPaint(cells, b) { if (el.hidden || !cells.length) return; const before = layoutOf(G.S, habId); if (G.paintCells(habId, cells, b)) { undo.push(before); if (undo.length > UNDO) undo.shift(); redo = []; draw(); } }
// inbox 42 F-6 자연 정리: the natives in the box drawn (habitat.js) put away at once; asked at the first box, ↶ brings them back
export async function onSweep(uids) {
  const ps = () => G.S.props.filter(p => p.nat && p.placed && p.hab === habId && uids.includes(p.uid)); if (el.hidden || !sweep || !ps().length) return;
  const n = ps().length, what = NATURE.map(N => [N.name, ps().filter(p => p.prop === N.id).length]).filter(([, k]) => k).map(([a, k]) => `${a} ${k}`).join(' · ');
  if (sweep === 1 && !await ask(`네모 안의 자연 ${n}개(${what})를 치울까요? 치운 것은 자연 탭에서 다시 심고, ↶로 되돌릴 수 있어요.`, '자연 정리')) return;
  if (el.hidden || !sweep || !ps().length) return; sweep = 2;
  const q = ps(); keep(); G.setLayout(habId, moved(q.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast(`자연 ${q.length}개를 치웠어요 · ↶로 되돌릴 수 있어요`); sfx('undo');
}
G.on(() => { if (!el.hidden && sig() !== shown) draw(); });

const tabsHere = () => TABS.filter(t => t.id === 'nature' || mine().some(P => tabOf(P) === t.id));
const ghostOf = rec => !rec.placed && !rec.nat ? G.S.ghost?.[habId]?.find(g => g.prop === rec.prop) : null; // 24-2: it starts on its 미리보기
// inbox 52: then the band the panel leaves (under the top bar and the BETA badge, over the panel less room for 가까운 빈 자리로) for its first spot and the view
function hold(rec, bought = false, near) { held = rec; fresh = bought ? rec.uid : null; hab.decor.edit(rec, ghostOf(rec), near); draw();
  hab.decor.show(Math.max(...['#habitat .bar', '.beta'].map(q => document.querySelector(q)?.getBoundingClientRect().bottom ?? 0)), el.getBoundingClientRect().top - 56); }
function step(from, to) { // 되돌리기 (from undo) / 다시 하기 (from redo)
  if (!from.length) return;
  if (held) { hab.decor.cancel(); held = fresh = null; }
  to.push(layoutOf(G.S, habId)); G.setLayout(habId, from.pop()); draw(); sfx('undo');
}
const tools = () => `<div class="dtools"><button class="sb${grid ? ' on' : ''}" data-grid>격자</button><button class="sb" data-undo${undo.length ? '' : ' disabled'} aria-label="되돌리기">↶</button><button class="sb" data-redo${redo.length ? '' : ' disabled'} aria-label="다시 하기">↷</button>${brush === undefined && !pick && !sweep ? '<button class="sb" data-pick>고르기</button><button class="sb" data-paint>땅 칠하기</button><button class="sb" data-share>코드</button><button class="sb" data-snap>사진</button>' : ''}</div>`; // 74: 사진 moved here from the top tools
// inbox 25: the head (and the grip over it) folds the panel to one line and opens it again: a tap, or a drag down / up
const GRIP = () => `<button class="dgrip" data-fold aria-label="꾸미기 판 접기·펴기" aria-expanded="${!min}"></button>`;
function fold(v) { min = v; el.classList.toggle('min', v); el.querySelector('.dgrip')?.setAttribute('aria-expanded', !v); }
el.addEventListener('pointerdown', e => { sy = e.target.closest('.dgrip, .dhead') && !e.target.closest('.dhead button') ? e.clientY : null; });
el.addEventListener('pointerup', e => { if (sy == null) return; const dy = e.clientY - sy; sy = null; if (Math.abs(dy) > 24) { fold(dy > 0); swiped = Date.now() + 400; } });
function draw() {
  shown = sig(); el.classList.toggle('min', min); hab.decor.rails(!held && !pick && brush === undefined && tab === 'train'); // 42 F-4: the rail ends' dots
  if (held?.ring) { const [k, n] = ringCost(), c = ok && hab.decor.clears();
    el.innerHTML = GRIP() + ROOM + `<div class="dhead"><b>예시 고리</b><span class="${ok ? 'ok' : 'no'}">${ok ? '여기에 놓을 수 있어요' : '빨간 곳엔 놓을 수 없어요'}</span></div>
${heldLine()}<div class="dinfo"><span>8×8칸 · 곡선 레일 4조각${n ? ` · 넣어 둔 곡선 ${n}개 써요` : ''}${c ? ` · 자리의 들꽃·나무 ${c}개는 넣어 둬요` : ''}</span></div>
<div class="nbtns"><button class="sb" data-cancel>취소</button><button class="go" data-place${ok ? '' : ' disabled'}>놓기${k ? ` <span class="hrt">♥</span>${k}` : ''}</button></div>
<p class="dhint">끌어서 옮겨요 · 놓으면 바로 태엽 기차가 달려요</p>`;
    return;
  }
  if (held) {
    const N = held.nat && NAT[held.prop], P = N ? { ...N, r: N.r * (held.s || 1) } : PROPS.find(P => P.id === held.prop), name = P.name;
    const sx = !N && stowed(P.id).some(s => s.uid !== held.uid), more = !N && (sx || !P.paid && !P.gift); // 하나 더: one put away first, else bought (41: a gift one is never bought)
    const lk = !N && hab.decor.look(), pal = lk && paletteOf(P), big = lk && sizable(P); // 28-5 its look now (c, sz)
    el.innerHTML = GRIP() + (P.rail || !ok ? ROOM : '') + `<div class="dhead"><b>${name}</b><span class="${ok ? 'ok' : 'no'}">${ok ? '여기에 놓을 수 있어요' : '빨간 곳엔 놓을 수 없어요'}</span></div>
${P.rail ? heldLine() : ''}${pal || big ? `<div class="dlook">${pal ? `<span class="dsw" role="group" aria-label="색">${pal.map(([nm, hx, x], i) => x && lk.c !== i && !G.S.looks[P.id]?.includes(i) ? '' : `<button class="${lk.c === i ? 'on' : ''}${hx ? '' : ' orig'}" data-c="${i}" aria-label="${nm}" title="${nm}"${hx ? ` style="background:${hx}"` : ''}></button>`).join('')}</span>` : ''}${big ? `<span class="dsz" role="group" aria-label="크기">${[1, 0, 2, 3].map(i => `<button class="${lk.sz === i ? 'on' : ''}" data-sz="${i}">${SIZES[i]}</button>`).join('')}</span>` : ''}</div>` : ''}
<div class="dinfo"><span>${info(P, N, N ? 1 : sizeF(P, lk?.sz))}</span>${N ? `<button class="sb dcut" data-stow>${cut(held.prop)}</button>` : ''}${more ? `<button class="sb" data-more>하나 더 ${sx ? '꺼내기' : can(G.S, 'prop:' + P.id) ? `<span class="hrt">♥</span>${P.price}` : `· Lv ${needFor('prop:' + P.id)}`}</button>` : ''}</div>
<div class="nbtns"><button class="sb" data-cancel>취소</button>${P.rail ? '' : '<button class="sb" data-rot="15" aria-label="15도 돌리기 · 길게 누르면 자유롭게">⟳15°</button>'}<button class="sb" data-rot="90">⟳90°</button>${N ? '' : '<button class="sb" data-stow>넣기</button>'}<button class="go" data-place${ok ? '' : ' disabled'}>놓기</button></div>
<p class="dhint">끌어서 옮겨요 · ${P.rail ? '레일은 큰 칸에 맞춰 이어져요' : P.small ? '탁자·선반·평상 가까이 끌면 위에 올라가요' : grid ? '격자 칸에 맞춰 놓여요' : '⟳15°를 길게 누르면 자유롭게 돌아요'}${N ? ` · ${held.prop === 'rock' ? '치운' : '벤'} 것은 자연 탭에서 다시 심어요` : ''}</p>`;
    return;
  }
  if (pick) { // 26-6 고르기: taps pick and let go; the arrows move all of them a cell, ⟳90° turns them round their middle
    const ps = picks(), n = ps.length, off = n ? '' : ' disabled'; hab.decor.picked(ps);
    el.innerHTML = GRIP() + `<div class="dhead"><b>여러 개 고르기</b><span>${n}개 골랐어요</span><button class="back" data-done>다 했어요</button></div>
${tools()}<div class="nbtns dpad"><button class="sb" data-mv="l" aria-label="왼쪽으로 한 칸"${off}>←</button><button class="sb" data-mv="u" aria-label="위로 한 칸"${off}>↑</button><button class="sb" data-mv="d" aria-label="아래로 한 칸"${off}>↓</button><button class="sb" data-mv="r" aria-label="오른쪽으로 한 칸"${off}>→</button><button class="sb" data-grot${off}>⟳90°</button></div>
<div class="nbtns"><button class="sb" data-clear>판 비우기</button><button class="go" data-gstow${off}>${n ? `${n}개 ` : ''}넣기</button></div>
<p class="dhint">놓인 소품이나 나무를 누르면 골라요(다시 누르면 빠져요) · 화살표는 한 칸씩 옮겨요</p>`;
    return;
  }
  if (sweep) { // inbox 42 F-6 자연 정리: a finger draws a box, two move the view
    el.innerHTML = GRIP() + `<div class="dhead"><b>자연 정리</b><span>손가락으로 네모를 그리면 그 안의 나무·바위·덤불·들꽃을 한 번에 치워요</span></div>
${tools()}<div class="nbtns"><button class="go" data-endsweep>다 했어요</button></div>
<p class="dhint">두 손가락으로 화면을 옮기고 키워요 · 치운 것은 자연 탭에서 다시 심어요 · 물가 돌·다리·울타리 밖 숲은 그대로예요</p>`;
    return;
  }
  hab.decor.picked(null);
  if (brush !== undefined) { // 땅 칠하기: the brushes; a finger paints the cells it passes, two move the view
    el.innerHTML = GRIP() + `<div class="dhead"><b>땅 칠하기</b><span>칸을 손가락으로 칠해요 · 길은 옆 칸과 저절로 이어지고, 울타리·돌담은 동물이 돌아가요</span></div>
<div class="dbrush">${BRUSHES.map((b, i) => { if (!brushIn(i, habId) || b.id === 'bloom') return ''; /* 74: 꽃밭 merged into 풀 (67-3 made them alike; painted cells stay) */ const k = 'brush:' + b.id, lk = !can(G.S, k); return `<button class="${brush === i ? 'on' : lk ? 'lock' : ''}" data-brush="${i}"><i style="background:${b.c}"></i>${b.name}${lk ? `<small>Lv ${needFor(k)}</small>` : ''}</button>`; }).join('')}<button class="${brush === null ? 'on' : ''}" data-brush="x"><i class="erase"></i>지우개</button></div>
${tools()}<div class="nbtns"><button class="go" data-endpaint>다 칠했어요</button></div>
<p class="dhint">두 손가락으로 화면을 옮기고 키워요${habId === 'pond' ? ' · 연못은 물가 풀밭만 칠해요' : habId === 'snow' ? ' · 설원은 얼음 연못 밖 눈밭만 칠해요' : habId === 'dino' ? ' · 공룡 정글은 석호 밖 땅만 칠해요' : ''}</p>`;
    return;
  }
  const rl = tab === 'train', n = rl ? railsIn(G.S, habId) : placedIn(G.S, habId).length, cap = rl ? B.decor.rails : decorCap(G.S, habId), L = levelOf(G.S, habId), price = B.expand.price[L], xk = 'expand:' + (L + 1), xl = price != null && !can(G.S, xk);
  // 땅 넓히기 (21-3b): the first cell; one band of the board at a time, under the mist till then
  const exp = `<button class="dprop dexp${xl ? ' lock' : ''}" data-expand${price == null ? ' disabled' : ''}><i></i><b>땅 넓히기 ${L}/${B.expand.price.length}</b><small>${price == null ? '다 넓혔어요' : `다음: ${ZONES[habId][L].name} · ${B.expand.visible[L]}마리 · 소품 ${B.expand.decor[L]}개까지`}</small><em>${price == null ? '완료' : xl ? `Lv ${needFor(xk)}` : `<span class="hrt">♥</span>${price}`}</em></button>`;
  const [rk, rn] = ringCost(), rlk = rk && !can(G.S, 'prop:railcurve'), ring = rl ? `<button class="dprop dring${rlk ? ' lock' : ''}" data-ring><img alt=""><b>예시 고리 한 번에 놓기</b><small>곡선 4개로 된 작은 고리 · 놓으면 바로 기차가 달려요</small><em>${rlk ? `Lv ${needFor('prop:railcurve')}` : rk ? `<span class="hrt">♥</span>${rk}` : '넣어 둔 곡선'}${rn && rk && !rlk ? ` · 곡선 ${rn}개 써요` : ''}</em></button>` : '';
  const lvOf = P => stowed(P.id).length || can(G.S, 'prop:' + P.id) ? 0 : needFor('prop:' + P.id), // 42 F-5: the ones open first, then by the level they open at
    list = mine().filter(P => tabOf(P) === tab).sort((a, b) => lvOf(a) - lvOf(b)), nats = tab === 'nature' ? NATURE.filter(N => stowedNat(N.id).length) : [], sh = G.shelf(habId);
  el.innerHTML = GRIP() + `<div class="dhead"><b>꾸미기</b><span${n >= cap ? ' class="no"' : ''}>놓은 ${rl ? '레일' : '소품'} ${n} / ${cap}</span><button class="back" data-done>완료</button></div>
${rl ? railLine(railNow(false), '', '<button class="sb" data-rhelp>놓는 법</button>') : ''}${tools()}${shelfRow(sh)}<div class="dtabs">${tabsHere().map(t => `<button class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}</div>
<div class="dgrid">${ring}${exp}${L ? '<button class="dprop dcmp" data-compare><i></i><b>넓히기 전과 비교</b><small>처음 땅과 지금 땅을 위에서 봐요</small></button>' : ''}${tab === 'nature' ? '<button class="dprop dsweep" data-sweep><i></i><b>자연 정리</b><small>네모를 그려 그 안의 나무·바위·덤불을 한 번에 치워요</small></button>' : ''}${nats.map(N => `<button class="dprop dnat" data-n="${N.id}"><img alt=""><b>${N.name}</b><small>처음부터 있던 것 · 다시 심어요</small><em>넣어 둔 것 ${stowedNat(N.id).length}</em></button>`).join('')}${list.map(P => { const s = stowed(P.id).length, lk = !s && !can(G.S, 'prop:' + P.id);
    return `<button class="dprop${lk ? ' lock' : ''}" data-p="${P.id}"><img alt=""><b>${P.name}</b><small>${propNote(P)}${sceneNote(P)}</small><em>${s ? `넣어 둔 것 ${s}` : P.gift ? '놓았어요' : lk ? `Lv ${needFor('prop:' + P.id)}` : `<span class="hrt">♥</span>${P.price}`}</em></button>`; }).join('')}</div>
<p class="dhint">${n >= cap ? full(rl && 'rail') : rl ? '레일 끝의 초록 점은 이어진 곳, 빨간 점은 열린 곳이에요 · 고리를 닫으면 태엽 기차가 달려요' : G.S.ghost?.[habId]?.length ? '반투명한 것은 꾸미기 코드의 미리보기예요 · 그 소품을 사거나 꺼내면 그 자리에서 시작해요' : '놓은 소품이나 나무를 누르면(길게 누르면 바로 끌어서) 옮기거나 넣을 수 있어요'}</p>`;
  el.querySelectorAll('.dnat img').forEach((img, i) => propThumb('n:' + nats[i].id, () => hab.decor.natModel({ prop: nats[i].id, s: 1, v: 12 })).then(u => { img.src = u; }));
  el.querySelectorAll('.dring img').forEach(img => propThumb('railring', hab.decor.model).then(u => { img.src = u; }));
  el.querySelectorAll('.dsh img').forEach((img, i) => propThumb(sh.items[i].id, hab.decor.model).then(u => { img.src = u; }));
  el.querySelectorAll('.dprop[data-p] img').forEach((img, i) => propThumb(list[i].id, hab.decor.model).then(u => { img.src = u; }));
}

// put the held one down where it is (null: red there, or the cap)
function put() {
  const r = hab.decor.confirm(); if (!r) { toast('빨간 곳엔 놓을 수 없어요'); return null; }
  const was = layoutOf(G.S, habId), ran = G.S.flags['train:' + habId], p = r.ring ? G.placeRing(habId, r.cells, r.clear) : G.placeProp(r.uid, r.x, r.z, r.rot, r); // 28-5 r: its colour, size, and the prop it stands on
  if (!p) toast(r.ring ? ringNo() ?? "놓을 수 없어요" : full(held?.prop)); else { sfx('place'); undo.push(was); if (undo.length > UNDO) undo.shift(); redo = []; if (r.ring && ran) toast('고리가 닫혔어요! 태엽 기차가 달려요', 2600, true); } // the first loop: main.js says so
  held = null; draw(); hab.decor.reveal(r.x, r.z, el.getBoundingClientRect().top); return p;
}
// 26-6 하나 더: the held one goes down, then another of its kind is picked up beside it: one put away first, else bought
// (the list's own rules: level, hearts, the cap)
function another() {
  const P = PROPS.find(P => P.id === held.prop), s = stowed(P.id).find(s => s.uid !== held.uid);
  if (capped(G.S, habId, P.id, held.placed ? 0 : 1)) return toast(full(P.id));
  if (!s && !can(G.S, 'prop:' + P.id)) return locked('prop:' + P.id);
  if (!s && G.S.hearts < P.price) return toast(`하트 ${P.price}개가 필요해요 · 지금 ♥${G.S.hearts}`);
  const p = put(); if (!p) return;
  const at = { x: p.x, z: p.z, rot: p.rot }, rec = s ?? G.buyProp(P.id, habId); if (!rec) return;
  if (!s) toast(`${P.name} 하나 더 샀어요 · ♥-${P.price}`);
  hold(rec, !s, at);
}
// 26-6: the layout with these entries ([uid, placed, x, z, rot]) changed, for G.setLayout
// 28-1 넓히기 전과 비교: the first board and the board now, from straight above, side by side (habitat.js topView)
function compare() {
  const { was, now } = hab.topView(), L = levelOf(G.S, habId), w = document.createElement('section');
  w.id = 'cmpz'; w.className = 'intro pop cmpz'; w.setAttribute('aria-label', '넓히기 전과 비교');
  w.innerHTML = `<div><h2>넓히기 전과 비교</h2><div class="cmpz2"><figure><figcaption>처음</figcaption></figure><figure><figcaption>지금 · ${L}단계</figcaption></figure></div>
<p class="sub">새로 연 구역: ${ZONES[habId].slice(0, L).map(z => z.name).join(' · ')}</p><button data-close>닫기</button></div>`;
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
  if (!hab.decor.fitAll(to, new Set(pick)).every(Boolean)) return toast(d ? '그쪽은 막혀 있어요 · 빨간 곳이 없게 옮겨 주세요' : '돌리면 겹치거나 밖으로 나가요');
  keep(); G.setLayout(habId, moved([...to.map(p => [p.uid, 1, p.x, p.z, p.rot]), ...rides])); sfx('place');
}
// 26-6 판 비우기: every placed prop here into storage (the board's own trees etc. stay), asked once; ↶ brings it back
async function clearBoard() {
  const ps = G.S.props.filter(p => p.placed && p.hab === habId && !p.nat); if (!ps.length) return toast('놓인 소품이 없어요'); // 28-4: rails too
  if (!await ask(`놓인 소품 ${ps.length}개를 모두 넣을까요? 나무·바위 같은 원래 자연은 그대로예요. ↶로 되돌릴 수 있어요.`, '판 비우기')) return;
  keep(); G.setLayout(habId, moved(ps.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast(`소품 ${ps.length}개를 넣어 뒀어요`); sfx('undo');
}
// inbox 37 작은 고리: [hearts it costs, curves put away here it uses]; why it can't go now (null: it can); the corner button while a rail is held
const ringCost = () => { const n = Math.min(4, stowed('railcurve').length); return [(4 - n) * PROP.railcurve.price, n]; };
const ringNo = () => { const [k] = ringCost(); return capped(G.S, habId, 'railcurve', 3) ? full('railcurve') : k && !can(G.S, 'prop:railcurve') ? `정원사 레벨 ${needFor('prop:railcurve')}부터 살 수 있어요 · 지금 레벨 ${G.S.lv}` : G.S.hearts < k ? `하트 ${k}개가 필요해요 · 지금 ♥${G.S.hearts}` : null; };
const ROOM = '<button class="sb droom" data-room>가까운 빈 자리로</button>';
// inbox 42 F-4: the rails here now as train.js sees them (h: the held one counted where it is, else as it was): open ends, a loop
const isRail = r => !!(r?.ring || PROP[r?.prop]?.rail);
function railNow(h = isRail(held)) {
  const U = hab.decor.unit, ps = G.S.props.filter(p => p.placed && p.hab === habId && PROP[p.prop]?.rail && !(h && p.uid === held.uid)).map(p => ({ uid: p.uid, prop: p.prop, x: p.x * U, z: p.z * U, rot: p.rot || 0 }));
  if (h) ps.push(...hab.decor.heldRails()); return ps.length ? railEnds(ps) : null;
}
const railLine = (r, pre = '', btn = '') => `<p class="drail${r?.loop ? ' ok' : r ? ' no' : ''}">${r ? pre : ''}${!r ? '아직 놓은 레일이 없어요' : r.loop ? '고리 완성 · 기차 출발!' : r.open ? `열린 끝 ${r.open}곳` : '한 바퀴 도는 길이 없어요'}${btn}</p>`;
const heldLine = () => ok ? railLine(railNow(), '놓으면 ') : railLine(railNow(false), '지금 ');
// 42 F-4: how rails go, in three pictures (rails: sleepers under two grey lines; dots as on the board): the 기차 tab's first open, its 놓는 법
const RL = d => `<path d="${d}" stroke="#b07a48" stroke-width="13" stroke-dasharray="3 3.5"/><path d="${d}" stroke="#9aa3ad" stroke-width="9"/><path d="${d}" stroke="#cfe6a8" stroke-width="5"/>`;
const DOT = (x, y, on) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${on ? '#4fcf5a' : '#ff4545'}" stroke="#fff" stroke-width="1.5"/>`;
const RINGD = 'M22 52a28 28 0 1 0 56 0a28 28 0 1 0-56 0', CAR = (x, y, r, c) => `<rect x="-7" y="-5" width="14" height="10" rx="3" fill="${c}" transform="translate(${x} ${y}) rotate(${r})"/>`;
const PICS = [['① 레일 조각을 이어 붙여요', '끝이 닿으면 초록 점, 열린 끝은 빨간 점이에요. 가까이 가져가면 방향이 저절로 맞아요', RL('M10 62H50') + RL('M50 62H90') + DOT(10, 62) + DOT(50, 62, 1) + DOT(90, 62) + '<path d="M84 38H60m6-6-6 6 6 6" stroke="#6b4a2b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['② 끝이 모두 이어져 고리가 되면 기차가 달려요', '「예시 고리 한 번에 놓기」로 바로 놓을 수도 있어요', RL(RINGD) + DOT(50, 24, 1) + DOT(78, 52, 1) + DOT(50, 80, 1) + DOT(22, 52, 1) + CAR(34, 29, -35, '#3fae6a') + CAR(25, 40, -65, '#ffc22e')],
  ['③ 갈림길·다리는 고리 안에 넣어요', '고리의 한 조각으로 끼워 넣으면 기차가 지나가요', RL(RINGD) + RL('M22 52H78') + '<path d="M68 83.2A36 36 0 0 1 32 83.2M60 69.3A20 20 0 0 1 40 69.3" stroke="#e8463c" stroke-width="3.5" stroke-linecap="round"/>' + DOT(22, 52, 1) + DOT(78, 52, 1)]];
function railHelp() {
  if (habEl.querySelector('.rhelp')) return; const w = document.createElement('section'); w.className = 'intro pop rhelp'; w.setAttribute('aria-label', '기차 레일 놓는 법');
  w.innerHTML = `<div><h2>기차 레일 놓는 법</h2><ol>${PICS.map(([b, s, g]) => `<li><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="14" fill="#cfe6a8"/><g fill="none">${g}</g></svg><p><b>${b}</b>${s}</p></li>`).join('')}</ol><button data-close>알겠어요</button></div>`;
  w.querySelector('[data-close]').onclick = () => w.remove(); habEl.append(w);
}
const railGuide = () => { if (!G.S.flags.railHelp && !G.S.flags.tipsOff && can(G.S, 'prop:railcurve')) { G.flag('railHelp'); railHelp(); } }; // 42 마무리: not while rails are still locked (27-7b at Lv 6)
const railTip = () => G.S.flags.railHelp || tip('train', '#decor .droom'); // 42 F-4: the 3-picture guide (railHelp) already told it; the bubble only for a rail got some other way
// 23-1: a thing the gardener's level hasn't opened yet
const locked = k => toast(`정원사 레벨 ${needFor(k)}부터 살 수 있어요 · 지금 레벨 ${G.S.lv}`);
// at the cap (inbox 16): 땅 넓히기 raises it, till the last step; then swap
const full = id => PROP[id]?.rail ? `레일 ${B.decor.rails}조각을 다 놓았어요 · 놓은 레일을 넣고 바꿔 보세요` : `소품을 ${decorCap(G.S, habId)}개 다 놓았어요 · ${B.expand.price[levelOf(G.S, habId)] == null ? '놓은 것을 넣고 바꿔 보세요' : '서식지를 넓히면 더 놓을 수 있어요'}`;
// 28-5: ⟳15° held down turns it on and on, a little at a time (the tap after that does not add 15°)
let spin = null, spun = 0;
el.addEventListener('pointerdown', e => { if (!e.target.closest('[data-rot="15"]')) return; clearTimeout(spin?.t); spin = { t: setTimeout(() => { spin.i = setInterval(() => hab?.decor.rotate(Math.PI / 90), 30); }, 350) }; });
const unspin = () => { if (!spin) return; clearTimeout(spin.t); if (spin.i) { clearInterval(spin.i); spun = Date.now() + 400; } spin = null; };
for (const k of ['pointerup', 'pointercancel']) addEventListener(k, unspin);
el.addEventListener('contextmenu', e => { if (e.target.closest('[data-rot]')) e.preventDefault(); });
el.addEventListener('click', e => {
  const b = e.target.closest('button'), d = b?.dataset;
  if (d?.fold != null || !b && e.target.closest('.dhead')) { if (Date.now() > swiped) fold(!min); return; }
  if (!b || b.disabled) return;
  if (d.done != null) { if (pick) { pick = null; draw(); } else closeDecor(); }
  else if (d.pick != null) { pick = new Set(); draw(); }
  else if (d.mv || d.grot != null) group(d.mv ? dirOf(d.mv) : null);
  else if (d.gstow != null) { const ps = picks(); if (!ps.length) return; keep(); G.setLayout(habId, moved(ps.map(p => [p.uid, 0, p.x, p.z, p.rot]))); toast(`${ps.length}개를 넣어 뒀어요 · ↶로 되돌릴 수 있어요`); sfx('place'); }
  else if (d.clear != null) clearBoard();
  else if (d.more != null) another();
  else if (d.cancel != null) { // back where it was before it was picked up; one just bought goes back to the shop
    const n = held.uid === fresh ? G.refundProp(fresh) : 0; hab.decor.cancel(); held = fresh = null;
    if (n) toast(`구매를 취소했어요 · ♥+${n}`); draw();
  }
  else if (d.expand != null) {
    const L = levelOf(G.S, habId), price = B.expand.price[L];
    if (!can(G.S, 'expand:' + (L + 1))) return locked('expand:' + (L + 1));
    if (G.S.hearts < price) return toast(`하트 ${price}개가 필요해요 · 지금 ♥${G.S.hearts}`);
    if (G.buyExpand(habId)) closeDecor(); // main.js rebuilds the habitat (the mist lifts), then says 「땅을 넓혔어요」
  }
  else if (d.compare != null) compare();
  else if (d.share != null) openShare(habId, hab, keep); // 24-2 꾸미기 코드
  else if (d.snap != null) { closeDecor(); document.getElementById('snapBtn').click(); }
  else if (d.grid != null) { grid = !grid; hab.decor.grid(grid); draw(); }
  else if (d.undo != null) step(undo, redo);
  else if (d.redo != null) step(redo, undo);
  else if (d.tab) { tab = d.tab; draw(); if (tab === 'train') railGuide(); }
  else if (d.rhelp != null) railHelp();
  else if (d.paint != null) { brush = brushIn(1, habId) ? 1 : 5; hab.decor.paint(brush); draw(); } // 흙길 first: the brush most will want (25-1 the snow: 눈)
  else if (d.brush) { if (d.brush !== 'x' && !can(G.S, 'brush:' + BRUSHES[+d.brush].id)) return locked('brush:' + BRUSHES[+d.brush].id); brush = d.brush === 'x' ? null : +d.brush; hab.decor.paint(brush); draw(); }
  else if (d.sweep != null) { sweep = 1; hab.decor.sweep(true); draw(); }
  else if (d.endsweep != null) { sweep = 0; hab.decor.sweep(false); draw(); }
  else if (d.endpaint != null) { brush = undefined; hab.decor.paint(undefined); draw(); }
  else if (d.rot) { if (Date.now() > spun) hab.decor.rotate(+d.rot * Math.PI / 180); }
  else if (d.c || d.sz) { hab.decor.look(d.c ? { c: +d.c } : { sz: +d.sz }); draw(); }
  else if (d.stow != null) {
    const N = held.nat && NAT[held.prop];
    if (held.placed) { keep(); G.stowProp(held.uid); }
    hab.decor.cancel(); toast(N ? `${N.name}${josa(N.name, '을', '를')} ${N.id === 'rock' ? '치웠어요' : '베었어요'} · 자연 탭에서 다시 심을 수 있어요` : '넣어 뒀어요 · 언제든 다시 놓을 수 있어요'); held = null; draw();
  }
  else if (d.room != null) { if (!hab.decor.room()) toast(held?.ring || PROPS.find(P => P.id === held?.prop)?.rail ? '이 서식지엔 고리가 들어갈 빈 땅이 없어요 · 소품을 조금 치워 보세요' : '가까이에 빈 자리가 없어요 · 소품을 조금 치워 보세요'); }
  else if (d.ring != null) { const no = ringNo(); if (no) toast(no); else { hold({ ring: true, prop: 'railring' }); if (!ok) hab.decor.room(); railTip(); } }
  else if (d.shelf) { // 13-3: bought at the shelf's price (a 진열대 색 comes with it), then held like one from the list
    const it = G.shelf(habId).items[+d.shelf], P = it && PROP[it.id]; if (!P) return draw();
    if (capped(G.S, habId, P.id)) toast(full(P.id));
    else if (G.S.hearts < it.price) toast(`하트 ${it.price}개가 필요해요 · 지금 ♥${G.S.hearts}`);
    else { const rec = G.buyShelf(habId, +d.shelf); if (rec) { toast(`${P.name} 샀어요 · ♥-${it.price}${it.c ? ` · 진열대 색 「${paletteOf(P)[it.c][0]}」` : ''}`); hold(rec, true); } }
  }
  else if (d.place != null) put(); else if (d.n) { const s = stowedNat(d.n)[0]; if (s) hold(s); }
  else if (d.p) {
    const P = PROPS.find(P => P.id === d.p), s = stowed(P.id)[0];
    if (capped(G.S, habId, P.id)) toast(full(P.id));
    else if (s) hold(s);
    else if (P.gift) toast(`${P.name}${josa(P.name, '은', '는')} 선물로만 받아요 · 받은 것은 다 놓았어요`);
    else if (!can(G.S, 'prop:' + P.id)) locked('prop:' + P.id);
    else if (G.S.hearts < P.price) toast(`하트 ${P.price}개가 필요해요 · 지금 ♥${G.S.hearts}`);
    else { const rec = G.buyProp(P.id, habId); if (rec) { toast(`${P.name} 샀어요 · ♥-${P.price}`); hold(rec, true); if (P.rail) railTip(); } }
  }
});
