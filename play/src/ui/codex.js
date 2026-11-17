// Codex: a tab per habitat; its cells are every variant of every species living there (counted from data.js,
// never fixed), grouped by rarity, one row per species. Found (one of it out, inbox 14): the figure in its material, as
// a baby till one has grown up; tapped, its baby and adult side by side (the adult a silhouette till then). Not found: the
// species' silhouette and "?" (no name). A key not looked at yet: NEW when just registered, 새 칸 (sky blue) when an update added it.
// Under a found cell, one dot per colour of that variant: filled = seen (colours never count toward the codex).
// Last tab, 치장 앨범: one cell per secret accessory: the first animal seen wearing it (as it hatched) and the date, or a
// "?" silhouette. Not part of the codex count.
// inbox 20: any cell tapped says where it comes from (that habitat's nest, the egg's rarity) and where it lives; a bar per
// habitat shows how much is found and, while the next habitat is shut, how many more cells and hearts open it.
// 26-5: a found cell opens its figure in 3D (drag to turn, pinch or wheel to zoom; it turns slowly till touched), baby or
// adult (the adult once one has grown up), in any material of that species the codex has; under it, the day the first
// one came out and the habitat whose nest it hatched from (recorded since 0.60: older cells say 기록 없음).
import { $t, LOC, esc } from '../i18n/i18n.js';
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { makeFigure, loadModel } from '../animals/figure.js';
import * as G from '../game/game.js';
import { HABITATS, RARITIES, ACCESSORIES, SPECIES, SCENES, BALANCE, MYTHIC, HOLD, COMPLETE, ZONES } from '../game/data.js';
import { GUEST, guestWear } from '../game/guests-data.js';
import { codexCells, habitatOf, known, colorsOf, SP, HAB, RAR, EARNED, displayColor, unlockInfo, lookName, variantsOf, wholeOf, wanderersOf, PROP, levelOf, nameCase } from '../game/rules.js';
import { toast, tip, lockText, josa } from './hud.js';
import { DEBUG, calm } from '../config.js';
import { figureThumb, silhouetteThumb, propThumb, artThumb, studio, nightLights, mythThumb } from './thumbs.js';
import { mythCard, mythHint } from './myth.js';
import { openStories, cardsIn } from './story.js';
import { SLOTS } from '../game/sky.js';
import { BLOOMS, recipe } from '../game/wild.js'; // 17-3 들꽃 도감
const SKY_N = SLOTS.length;

const el = document.getElementById('codex');
let tab = HABITATS[0].id, night = false, hab = null; // night: 21-1 밤에 보기 (this screen only, off each time it opens)
const isNew = k => !G.S.seen.includes(k);
const open = id => HABITATS.find(h => h.id === id).ready && G.S.unlocked.includes(id) || codexCells(id).some(c => G.S.codex[c.key]); // or already has some there (19-2: ducks registered in the meadow)
export const hasNew = () => HABITATS.some(h => open(h.id) && codexCells(h.id).some(c => isNew(c.key)));

export function openCodex(habId, api) { G.note('codex', 1); if (habId) tab = habId; hab = api; night = false; el.hidden = false; draw(); tip('codex', '#codex .cbar'); } // G.note: 41 D 첫날 할 일
// live while open: redraw when what it shows changes (a variant registered, a habitat opened, someone stored), keeping the scroll
const sig = () => [Object.keys(G.S.scenes).length, Object.keys(G.S.album).length, Object.keys(G.S.codex).length, Object.values(G.S.codex).filter(e => e.adult != null).length, Object.values(G.S.colors).flat().length, G.S.unlocked.length, G.S.animals.filter(a => a.stored).length, G.S.myth?.here, G.S.myth?.settled, JSON.stringify(G.S.guests?.seen ?? 0), JSON.stringify(G.S.guests?.big ?? 0), JSON.stringify(G.S.whole ?? 0), Object.keys(G.S.wild.book).length].join(); // 66-3: guest progress and gifts redraw too
let shown = '';
G.on(() => { if (el.hidden || sig() === shown) return; const body = el.querySelector('.cbody'), y = body?.scrollTop || 0, up = V?.box?.isConnected && V.box; draw(); el.querySelector('.cbody').scrollTop = y; if (up) el.append(up); }); // the 3D view stays up

el.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.close != null) el.hidden = true;
  else if (b.dataset.lock) toast(`${HAB[b.dataset.lock].name}: ${lockText(b.dataset.lock)}`, 3200);
  else if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
  else if (b.dataset.night != null) { const y = el.querySelector('.cbody')?.scrollTop || 0; night = !night; draw(); el.querySelector('.cbody').scrollTop = y; }
  else if (b.dataset.shut != null) b.closest('.cdet').remove();
  else if (b.dataset.story) openStories(b.dataset.story); // 14-2 이야기 카드
  else if (b.dataset.cab != null) { el.hidden = true; document.getElementById('cabBtn').click(); } // 74: 진열장 from here
  else if (b.dataset.sky != null) import('./sky.js').then(m => m.skyRecord()); // 74: 하늘 기록 from here
});
// a cell, tapped. Found: the 3D view (below). Not found: the silhouette. Both: where it comes from and where it lives.
el.addEventListener('click', e => {
  const d = e.target.closest('.cell[data-k]'); if (!d || tab === 'album') return;
  const c = codexCells(tab, G.S).find(c => c.key === d.dataset.k);
  if (G.S.codex[c.key]) return detail(c);
  const box = document.createElement('div'); box.className = 'cdet pop';
  box.innerHTML = $t('<div><b>아직 못 찾은 {0} 변종</b><p class="pair"><span><img alt="{1} 실루엣"><small>?</small></span></p>{2}<br><button class="back" data-shut>닫기</button></div>', RAR[c.rarity].name, c.species.name, from(c));
  silhouetteThumb(c.species.id, null, night).then(u => { box.querySelector('img').src = u; });
  el.append(box);
});
// 66-3 모으기 판: each habitat in three rows: 알 친구 (by rarity, the cells above) / 떠돌이 (its guests: settled, the figure with its
// 보따리 or 모자; else a silhouette and a hint: when it comes, 대만족 n/3, 단골 and the 큰 소원 steps) / 신수. The bar: the whole of
// the three and the next 모으기 선물 (COMPLETE). 놀이 장면 folded at the foot (was a tab). Rows of EARNED_TIERS soon: none yet
// 74: the codex's foot: the 진열장 (was its own button) and the 하늘 기록 (once a sky was seen)
const foot = () => { const n = Object.keys(G.S.sky?.got ?? {}).length;
  return $t('<div class="cfoot"><button class="scards" data-cab>진열장으로 보기</button>{0}</div>', n ? $t('<button class="scards" data-sky>하늘 기록 <small>{0}/{1}</small></button>', n, SKY_N) : ''); };
// 14-1 신수: its own row in each habitat (the meadow's 불갈기 천리마; the others' only a rumour yet), not in the count
const mythRow = () => { if (HOLD.myth) return ''; const m = MYTHIC.find(m => m.habitat === tab), met = !!(m && G.S.myth?.here);
  return $t('<h2 class="ctier myth">{0} <small>{1}/1</small></h2><div class="crow"><div class="cell myth{2}" role="button" data-m="{3}">{4}<span>{5}</span>{6}</div></div><button class="scards" data-story="{7}">이야기 카드 <b>{8}</b>장<small>신수·전설 친구를 만난 날</small></button>', EARNED.myth.name, +met, met ? '' : ' unk', m?.id || '', m ? `<img alt="${met ? m.name : $t('아직 못 만난 신수')}">` : '', met ? m.name : '?', m ? '' : $t('<small>소문만 있어요</small>'), tab, cardsIn(tab).length); }; // 14-2
function mythBox(id) {
  const m = MYTHIC.find(m => m.id === id), met = !!(m && G.S.myth?.here), box = document.createElement('div'), n = [...Array(5)].filter((_, i) => G.S.myth?.read & 1 << i).length;
  box.className = 'cdet pop myth';
  box.innerHTML = $t('<div><b>{0}</b>{1}<p class="from">{2}</p><button class="back" data-shut>닫기</button></div>', met ? m.name : $t('아직 못 만난 신수'), met ? mythCard() : m ? $t('<p class="pair"><span><img alt="신수 실루엣"><small>?</small></span></p>') : '', !m ? $t('이 서식지의 신수는 아직 소문만 있어요') : met ? $t('사는 곳: {0} · 신수는 자리를 차지하지 않아요<br>이야기 {1}/{2} · 옛 제단에서 다시 읽어요', HAB[m.habitat].name, n, m.pages.length) : mythHint());
  const img = box.querySelector('img'); if (img) mythThumb(!met, false, met ? 0 : 1).then(u => { img.src = u; }, () => {});
  el.append(box);
}
el.addEventListener('click', e => { const d = e.target.closest('.cell[data-m]'); if (d && tab !== 'album') mythBox(d.dataset.m); });
export function openMyth(api) { openCodex(MYTHIC[0].habitat, api); mythBox(MYTHIC[0].id); } // 14-1 stage 0: the fire prints tapped
const from = c => { const h = HAB[c.species.habitat]; return $t('<p class="from">어디서 나와요: {0} 둥지 · {1} 알<br>사는 곳: {2}</p>', h.name, RAR[c.rarity].name, h.name); };

// 26-5 the 3D view: one small renderer (made the first time), drawing only while the box is up; the habitat waits meanwhile
let V = null;
function stage3d() {
  if (V) return V;
  const s = studio(), cam = new THREE.PerspectiveCamera(28, 1, 0.05, 100), ctl = new OrbitControls(cam, s.R.domElement);
  Object.assign(ctl, { enablePan: false, enableDamping: true, autoRotate: !calm(), autoRotateSpeed: 1.5, minPolarAngle: 0.3, maxPolarAngle: 1.62 });
  ctl.addEventListener('start', () => { ctl.autoRotate = false; }); // a finger on it: it stays where it is turned
  s.R.domElement.style.touchAction = 'none';
  V = { ...s, cam, ctl, fig: null, box: null }; if (DEBUG) window.__c3d = V; return V;
}
function detail(c) {
  const v = stage3d(), mats = codexCells(tab, G.S).filter(x => x.species === c.species && G.S.codex[x.key]); // the materials it has
  let stage = G.S.codex[c.key].adult != null ? 'adult' : 'baby', fresh = true;
  const box = document.createElement('div'); box.className = 'cdet pop c3dbox';
  box.innerHTML = $t('<div><b></b><div class="c3d" role="img"></div><p class="sub">끌어서 돌리고, 두 손가락으로 크게 봐요</p>\n<span class="seg"><button data-st="baby">새끼</button><button data-st="adult">성체</button></span>{0}\n<p class="crec"></p>{1}<br><button class="back" data-shut>닫기</button></div>', mats.length > 1 ? `<div class="cmat">${mats.map(x => `<button data-m="${x.key}">${x.variant.name}</button>`).join('')}</div>` : '', from(c));
  const wrap = box.querySelector('.c3d');
  const paint = async () => {
    const e = G.S.codex[c.key], adult = e.adult != null; if (!adult) stage = 'baby';
    box.querySelector('b').textContent = lookName(c.species.id, c.variant.id, displayColor(G.S, c.key));
    wrap.setAttribute('aria-label', $t('{0} {1} 3D 모습', lookName(c.species.id, c.variant.id, displayColor(G.S, c.key)), stage === 'baby' ? $t('새끼') : $t('성체')));
    for (const b of box.querySelectorAll('[data-st]')) { b.classList.toggle('on', b.dataset.st === stage); b.disabled = b.dataset.st === 'adult' && !adult; b.textContent = b.dataset.st === 'baby' ? $t('새끼') : adult ? $t('성체') : $t('성체 · ?'); }
    for (const b of box.querySelectorAll('[data-m]')) b.classList.toggle('on', b.dataset.m === c.key);
    box.querySelector('.crec').innerHTML = $t('처음 만난 날: {0}<br>처음 깬 곳: {1}{2}', e.at ? new Date(e.at).toLocaleDateString(LOC) : $t('기록 없음'), HAB[e.h] ? HAB[e.h].name + $t(' 둥지') : $t('기록 없음'), adult ? '' : $t('<br><small>다 자라면 성체 모습도 볼 수 있어요</small>'));
    await loadModel(c.species.model); if (!box.isConnected) return;
    if (v.fig) v.scene.remove(v.fig);
    const f = v.fig = makeFigure(c.species.id, c.variant.id, stage, null, displayColor(G.S, c.key)).obj;
    f.rotation.y = -Math.PI / 2 + 0.45; v.scene.add(f); // facing us, turned a little (as the cells' pictures)
    const b3 = new THREE.Box3().setFromObject(f), mid = b3.getCenter(new THREE.Vector3()), d = b3.getSize(new THREE.Vector3()).length() / 2 / Math.tan(THREE.MathUtils.degToRad(14));
    const dir = fresh ? new THREE.Vector3(0, 0.35, 1).normalize() : v.cam.position.clone().sub(v.ctl.target).normalize(); fresh = false; // baby ⇄ adult, another material: same side
    v.ctl.target.copy(mid); v.cam.position.copy(mid).addScaledVector(dir, d); v.ctl.minDistance = d * 0.4; v.ctl.maxDistance = d * 1.4; v.ctl.update();
  };
  box.addEventListener('click', e => {
    const d = e.target.closest('button')?.dataset; if (!d) return;
    if (d.st && d.st !== stage) { stage = d.st; paint(); }
    if (d.m && d.m !== c.key) { c = mats.find(x => x.key === d.m); paint(); }
  });
  v.box?.remove(); v.box = box; el.append(box);
  wrap.append(v.R.domElement); v.ctl.autoRotate = !calm(); // 27-7d 움직임 줄이기: it turns only when dragged
  nightLights(v, night); v.R.setClearColor(night ? '#2b3356' : '#f3e2c7', 1);
  v.R.setPixelRatio(Math.min(devicePixelRatio, 2)); v.R.setSize(wrap.clientWidth, wrap.clientHeight); v.cam.aspect = wrap.clientWidth / wrap.clientHeight; v.cam.updateProjectionMatrix();
  hab?.setActive(false); paint();
  const frame = () => { // till the box goes (닫기, or the codex redrawn / closed)
    if (!box.isConnected || el.hidden) { if (v.box === box) { v.box = null; box.remove(); hab?.setActive(true); } return; }
    requestAnimationFrame(frame); v.ctl.update(); v.R.render(v.scene, v.cam);
  };
  requestAnimationFrame(frame);
}
// found / all for a habitat, and what is left to open the next one (rules.unlockInfo)
function bar(habId, cells, n) {
  const next = HABITATS[HABITATS.findIndex(h => h.id === habId) + 1], L = next && unlockInfo(G.S, next.id);
  const left = L && !L.open && L.friends ? $t('{0}{이/가} 열리기까지 친구 {1}마리', next.name, Math.max(0, L.friends - L.got)) : L && !L.open && L.need ? $t('{0}{이/가} 열리기까지 도감 {1}칸{2}', next.name, Math.max(0, L.need - L.have), G.S.hearts < L.hearts ? $t(' · 하트 {0}개 더 <span style="white-space:nowrap">(친구를 쓰다듬으면 생겨요)</span>', L.hearts - G.S.hearts) : '') : '';
  const W = wholeOf(G.S, habId), R = COMPLETE[habId], i = G.S.whole?.[habId] || 0, at = R && i < R.length && Math.ceil(COMPLETE.at[i] * W.all - 1e-9);
  const gift = at ? $t('<small>모으기 선물까지 {0}칸: {1}</small>', at - W.got, R[i] === 'expand' ? $t('땅 넓히기 한 번 무료{0}', ZONES[habId]?.[levelOf(G.S, habId)] ? ` (${ZONES[habId][levelOf(G.S, habId)].name})` : '') : $t('큰 소품 「{0}」', PROP[R[i]]?.name)) : R ? $t('<small>모으기 선물을 다 받았어요</small>') : '';
  const ng = wanderersOf(habId).length, nm = W.all - cells.length - ng; // 133: what 모으기 counts besides the egg friends (the 도감 n/N above)
  const inc = ng && nm ? $t('· 손님·신수 포함') : ng ? $t('· 손님 포함') : nm ? $t('· 신수 포함') : '';
  return $t('<div class="cbar">{0} 모으기 {1}/{2} ({3}%) <span style="white-space:nowrap">{4}</span><u><i style="width:{6}%"></i></u>{7}{8}</div>', HAB[habId].name, W.got, W.all, Math.round(W.got / W.all * 100), inc, cells.length, W.got / W.all * 100, gift, left ? `<small>${left}</small>` : '');
}

const tabs = () => $t('<div class="ctabs">{0}<button data-tab="album"{1}>치장 앨범</button></div>', HABITATS.map(h => `<button ${open(h.id) ? `data-tab="${h.id}"` : `data-lock="${h.id}" class="lock"`}${h.id === tab ? ' class="on"' : ''}>${h.name}${open(h.id) ? '' : ' 🔒'}</button>`).join(''), tab === 'album' ? ' class="on"' : '');
// 13-2 놀이 장면: one cell per SCENES one. Seen: the play prop (the friend in it pinned on) or, friends together, the friend; the
// day. Not seen: the prop's (or a friend's) flat shape and the hint. Not part of the codex count
const scenesHtml = () => $t('<details class="cscenes"{0}><summary>놀이 장면 <small>{1}/{2}</small></summary><div class="crow sc">{3}</div>\n<p class="cnote">친구가 놀이 소품에서 놀거나 친구끼리 노는 모습을 보면 담겨요 · 처음 볼 때 ♥{4} · 도감 수에는 들어가지 않아요</p></details>', sceneOpen ? ' open' : '', SCENES.filter(s => G.S.scenes[s.id]).length, SCENES.length, SCENES.map(s => { const e = G.S.scenes[s.id];
    return `<div class="cell scene${e ? '' : ' unk'}"><img alt="${e ? s.name : $t('아직 못 본 장면')}">${e?.sp && s.prop ? '<img class="who" alt="">' : ''}<span>${e ? s.name : '?'}</span><small>${e ? new Date(e.at).toLocaleDateString(LOC) : s.hint}</small></div>`; }).join(''), BALANCE.scene.hearts);
let sceneOpen = false; // 66-3: the fold stays as the player left it while the codex is redrawn
// 17-2 작품집: the 동물 작품 of this habitat kept (그대로 두기, 기록만 남기고 치우기), newest first: the 작품 itself (its model, as the
// 놀이 장면 cells), who made it, the day. In the codex as the 놀이 장면 are (a fold: no screen of its own); not part of the count
let artOpen = false;
const artBook = () => G.S.art.book.filter(b => b.hab === tab).reverse();
const artHtml = () => { const L = artBook();
  return $t('<details class="cscenes cart"{0}><summary>작품집 <small>{1}</small></summary>{2}\n<p class="cnote">친구가 만든 작품을 「그대로 두기」나 「기록만 남기고 치우기」로 고르면 담겨요 · 도감 수에는 들어가지 않아요</p></details>', artOpen ? ' open' : '', L.length, L.length ? `<div class="crow ab">${L.map(b => `<div class="cell art"><img alt="${PROP[b.prop]?.name}"><span>${PROP[b.prop]?.name}</span><small>${esc(b.who)}<br>${new Date(b.at).toLocaleDateString(LOC)}</small></div>`).join('')}</div>` : ''); };
const fillArt = () => { const L = artBook(); el.querySelectorAll('.cell.art img').forEach((img, i) => { if (hab?.decor) artThumb(L[i].prop, hab.decor.model, night).then(u => { img.src = u; }, () => {}); }); };
// 17-3 들꽃 도감: the colours of the 들꽃 that spread by themselves (game/wild.js), one cell each: the flower (its petals and middle),
// the name, the day it first bloomed; not yet: ? and how it comes (the two colours mixed, or where the colour is). The garden's
// whole (the same in each tab, as the codex count is not). A fold as the 놀이 장면 are; not part of the count
let wildOpen = false;
const wildHtml = () => { const B = G.S.wild.book, ids = Object.keys(BLOOMS), day = d => new Date(d * 864e5).toLocaleDateString(LOC, { timeZone: 'UTC' });
  return $t('<details class="cscenes cwild"{0}><summary>들꽃 도감 <small>{1}/{2}</small></summary><div class="crow ab">{3}</div>\n<p class="cnote">친구들이 꽃씨를 옮겨 들꽃이 저절로 퍼져요 · 다른 색이 가까이 피면 정해진 색으로 섞여요 · 도감 수에는 들어가지 않아요</p></details>', wildOpen ? ' open' : '', ids.filter(c => B[c] != null).length, ids.length, ids.map(c => { const b = BLOOMS[c], got = B[c] != null, r = recipe(c);
    return `<div class="cell bloom${got ? '' : ' unk'}"><b class="fl" style="--p:${b.c[0]};--m:${b.c[1]}" aria-hidden="true"></b><span>${got ? b.name : '?'}</span><small>${got ? day(B[c]) : r ? r.map(x => BLOOMS[x].name).join(' + ') : b.from}</small></div>`; }).join('')); };
function fillScenes() {
  const fig = sp => figureThumb(sp, variantsOf(SP[sp])[0].id, null, null, 'adult', night);
  el.querySelectorAll('.cell.scene').forEach((d, i) => { const s = SCENES[i], e = G.S.scenes[s.id], [img, who] = d.querySelectorAll('img'), set = el => u => { el.src = u; };
    const sp = e?.sp || s.sp || SPECIES[0].id, pid = s.prop === 'train' ? 'railring' : s.prop;
    (s.prop && hab?.decor ? propThumb(pid, hab.decor.model, !e, night).catch(() => fig(sp)) : e ? fig(sp) : silhouetteThumb(sp, null, night)).then(set(img), () => {});
    if (who) fig(e.sp).then(set(who), () => {}); });
}
function drawAlbum() {
  const ids = Object.keys(ACCESSORIES), got = ids.filter(id => G.S.album[id]);
  el.innerHTML = $t('<div class="chead"><b>치장 앨범</b><span>모은 치장 {0}/{1}</span>{2}<button class="back" data-close>닫기</button></div>{3}\n<div class="cbody"><div class="crow">{4}</div>\n<p class="cnote">시크릿으로 처음 만난 동물이 남아요 · 도감 수에는 들어가지 않아요</p></div>', got.length, ids.length, nightBtn(), tabs(), ids.map(id => { const e = G.S.album[id];
    return `<div class="cell${e ? '' : ' unk'}"><img alt="${e ? ACCESSORIES[id].name : $t('아직 못 본 치장')}"><span>${e ? ACCESSORIES[id].name : '?'}</span>${e ? `<small>${lookName(e.species, e.variant, e.color)}<br>${new Date(e.at).toLocaleDateString(LOC)}</small>` : ''}</div>`; }).join(''));
  el.querySelectorAll('.cell img').forEach((img, i) => { const id = ids[i], e = G.S.album[id];
    (e ? figureThumb(e.species, e.variant, e.color ?? null, id, 'adult', night) : silhouetteThumb(SPECIES[0].id, id, night)).then(u => { img.src = u; }); });
}
// 66-3 떠돌이: one cell per guest of this habitat that may settle. Settled: its figure and name; met: its name and how far; not
// met: ? and when it comes (`when`, or the Lv that brings it)
const WHEN = { 밤: $t('밤에 와요'), 비: $t('비 오는 날 와요'), 눈: $t('눈 오는 날 와요'), 하늘: $t('특별한 하늘에 와요') };
function guestRow() {
  const gs = wanderersOf(tab); if (!gs.length) return '';
  const Q = G.S.guests, big = R => Q?.big?.[R.k]?.s ?? 0, great = R => Q?.seen?.[R.k]?.[1] ?? 0, met = R => !!Q?.seen?.[R.k], done = R => big(R) >= GUEST.big;
  const cell = R => { const reg = great(R) >= GUEST.regular, nm = R.name.split(' ').pop();
    return `<div class="cell gst${done(R) ? '' : ' unk'}" data-g="${R.k}"><img alt="${done(R) ? R.name : met(R) ? nm + $t(' 실루엣') : $t('아직 못 만난 손님')}">${reg && !done(R) ? $t('<i class="reg">단골</i>') : ''}<span>${met(R) || done(R) ? nm : '?'}</span><small>${done(R) ? $t('정착했어요') : reg ? $t('큰 소원 {0}/{1}', big(R), GUEST.big) : met(R) ? $t('대만족 {0}/{1}', great(R), GUEST.regular) : WHEN[R.when] ?? (R.lv > G.S.lv ? $t('Lv {0}부터 와요', R.lv) : $t('곧 찾아와요'))}</small></div>`; };
  return $t('<h2 class="ctier gst">{0} <small>{1}/{2}</small></h2><div class="crow">{3}</div><p class="cnote ctip">같은 손님을 {4}번 크게 기쁘게 하면 단골, 큰 소원을 다 들어주면 정착해요</p>', EARNED.wanderer.name, gs.filter(done).length, gs.length, gs.map(cell).join(''), GUEST.regular);
}
const nightBtn = () => `<button class="back" data-night>${night ? $t('낮에 보기') : $t('밤에 보기')}</button>`;
function draw() {
  shown = sig(); el.classList.toggle('night', night);
  if (tab === 'album') return drawAlbum();
  const vis = codexCells(tab, G.S), cells = vis.filter(c => !c.variant.gone), got = c => !!G.S.codex[c.key]; // 125-A: a gone look shows, uncounted
  const stored = G.S.animals.filter(a => a.stored && known(a) && habitatOf(a) === tab).length;
  const seen = c => G.S.colors[c.key] || [];
  const dots = c => { const cs = colorsOf(c.species.id, c.variant.id); return got(c) && cs.length ? $t('<b class="dots" aria-label="색 {0}/{1}">{2}</b>', cs.filter(x => seen(c).includes(x.id)).length, cs.length, cs.map(x => `<u${seen(c).includes(x.id) ? ' class="on"' : ''}></u>`).join('')) : ''; };
  const cell = c => `<div class="cell${got(c) ? '' : ' unk'}" role="button" data-k="${c.key}"><img alt="${got(c) ? lookName(c.species.id, c.variant.id, displayColor(G.S, c.key)) : $t('아직 못 찾은 변종')}">${!isNew(c.key) ? '' : got(c) ? '<i>NEW</i>' : $t('<i class="slot">새 칸</i>')}<span>${got(c) ? nameCase(c.variant.name) : '?'}</span>${dots(c)}</div>`;
  const groups = RARITIES.map(r => {
    const cs = cells.filter(c => c.rarity === r.id), ss = vis.filter(c => c.rarity === r.id); if (!ss.length) return '';
    const rows = [...new Set(ss.map(c => c.species))].map(sp => `<div class="crow">${ss.filter(c => c.species === sp).map(cell).join('')}</div>`);
    return `<h3>${r.name} <small>${cs.filter(got).length}/${cs.length}</small></h3>${rows.join('')}`;
  }).join('');
  const egg = groups && $t('<h2 class="ctier">알 친구 <small>{0}/{1}</small></h2>', cells.filter(got).length, cells.length);
  el.innerHTML = $t('<div class="chead"><b>도감</b><span>{0}/{1}</span>{2}<button class="back" data-close>닫기</button></div>\n{3}{4}\n<div class="cbody">{5}{6}{7}{8}</div>', cells.filter(got).length, cells.length, nightBtn(), tabs(), cells.length ? bar(tab, cells, cells.filter(got).length) : '', groups ? egg + groups : $t('<p class="cnote">준비 중이에요</p>'), groups ? guestRow() + mythRow() + scenesHtml() + artHtml() + (tab === 'dino' ? '' : wildHtml()) : '', stored ? $t('<p class="cnote">보관함에 {0}마리 있어요</p>', stored) : '', foot());
  if (groups) fillScenes(), fillArt(); el.querySelector('.cscenes:not(.cart):not(.cwild)')?.addEventListener('toggle', e => { sceneOpen = e.target.open; });
  el.querySelector('.cart')?.addEventListener('toggle', e => { artOpen = e.target.open; }); // 17-2
  el.querySelector('.cwild')?.addEventListener('toggle', e => { wildOpen = e.target.open; }); // 17-3
  for (const d of el.querySelectorAll('.cell[data-g]')) { const R = wanderersOf(tab).find(R => R.k === d.dataset.g), acc = guestWear(R);
    (d.classList.contains('unk') ? silhouetteThumb(R.sp, acc, night) : figureThumb(R.sp, 'solid', colorsOf(R.sp, 'solid')[0]?.id ?? null, acc, 'adult', night)).then(u => { d.firstChild.src = u; }, () => {}); }
  const mi = el.querySelector('.cell.myth img'); if (mi) mythThumb(!G.S.myth?.here, night).then(u => { mi.src = u; }, () => {});
  for (const d of el.querySelectorAll('.cell[data-k]')) {
    const c = vis.find(c => c.key === d.dataset.k), img = d.firstChild;
    const stage = G.S.codex[c.key]?.adult == null ? 'baby' : 'adult'; // registered, not seen grown up yet: its baby
    (got(c) ? figureThumb(c.species.id, c.variant.id, displayColor(G.S, c.key), null, stage, night) : silhouetteThumb(c.species.id, null, night)).then(u => { img.src = u; }); // the colour picked in the cabinet (else the first found)
  }
  const fresh = vis.filter(c => isNew(c.key)).map(c => c.key);
  if (fresh.length) G.markSeen(fresh); // badges stay on screen until the codex is opened again
}
