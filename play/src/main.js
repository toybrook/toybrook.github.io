// Screen flow: world map <-> habitats. The game (game/game.js) runs underneath either way.
import { reportText, copyNow, placeFrom, glRebuilt } from './ui/report.js'; // first: it listens for errors before the rest runs
import * as G from './game/game.js';
import { HAB, outIn, habitatOf, unlockInfo, firstEgg } from './game/rules.js';
import { BALANCE, HABITATS, ZONES, PROPS } from './game/data.js';
import { initWorldMap } from './worldmap/worldmap.js';
import { zzz, heart, overlayOpen, toast, josa, closeTop, topWindow, lockText, tip, TIPS, resetTips, ask } from './ui/hud.js';
import { loadBar, codeAsked } from './ui/loadbar.js';
import { initLevel } from './ui/level.js';
import * as BK from './ui/backup.js';
import { iosSafariTab } from './game/backup.js';
import { initPhoto } from './ui/photo.js';
import { ASSETS, DEBUG, VERSION, FEEDBACK_URL, FEEDBACK_FIELD, RATING, PREFS, savePrefs, OFFLINE, calm, applyLook } from './config.js';
import { applySound, sfx } from './ui/sound.js';
import { watch, track } from './ui/stats.js';
import { openCode } from './ui/mail.js'; // inbox 41 B 우편함
import { initAttend, todayRow, takeToday, weekOn, weekCells } from './ui/attend.js'; // inbox 41 C 출석부
import './ui/first.js'; // inbox 41 D 첫날 할 일
import { initEvent } from './ui/event.js'; // 15-1 계절 이벤트
import { initMyth, onMyth, mythCut, mythDue } from './ui/myth.js'; // 14-1 신수의 부름
import { initVisit, seeHash, seeBar } from './ui/visit.js'; // 16-1 놀러 보내기; 69-4 서식지 구경 링크
import { initSky, skyNow, onStar, retSky, retShown, retGo } from './ui/sky.js'; // 16-2 특별한 하늘
import { initArt, place as artPlace, retRow as artRow, open as artOpen, tapped as artTapped, due as artDue } from './ui/art.js'; // 17-2 동물 작품
import { newsOf as wildNews } from './game/wild.js'; // 17-3 정원이 숨 쉬어요

const $ = id => document.getElementById(id), mapImg = $('mapimg');
// 26-7 한 번에 한 탭: a tab opened second, or one another tab took over, is covered (nothing saved there) till 「여기서 하기」
function tabOff(first) {
  if ($('tabOff')) $('tabOff').remove(); const el = document.createElement('section'); el.className = 'intro'; el.id = 'tabOff';
  el.innerHTML = `<div><h2>${first ? '다른 탭에서 열려 있어요' : '다른 탭에서 이어서 하고 있어요'}</h2><p>${first ? '이 탭에서 하는 것은 저장되지 않아요. 여기서 하려면 아래를 누르세요. 다른 탭은 멈춰요.' : '이 탭은 멈췄어요. 여기서 다시 하려면 아래를 누르세요.'}</p><button data-take>여기서 하기</button></div>`;
  el.querySelector('[data-take]').onclick = e => { e.target.disabled = true; G.takeOver(); }; $('stage').append(el);
}
// 26-7: a save that failed (full storage etc.) is told once, with the way to a backup code (made from the game in memory)
const saveFail = () => ask('저장하지 못했어요. 기기 저장 공간이 꽉 찼을 수 있어요. 백업 코드를 만들어 두면 모은 것을 잃지 않아요.', '백업 코드 만들기', '닫기').then(ok => ok && BK.open());
// 69-4 서식지 구경 링크: someone's habitat to look at. This page stores nothing at all (the player's own save, prefs, counts
// stay as they were): every storage write is a no-op till 「내 정원으로」 opens the page again without the link
const SEE = seeHash();
if (SEE) { for (const k of ['setItem', 'removeItem', 'clear']) Storage.prototype[k] = () => {}; document.body.classList.add('see'); track('see_open', undefined, 'see_open#'); }
const offline = G.start(SEE ? { view: SEE.S } : { busy: () => tabOff(true), lost: () => tabOff(false), fail: saveFail }); // eggs laid / babies grown while the game was closed
if (!SEE) watch(G); // inbox 41 A 이용 통계: start, first_hatch, return_d1

const stage = $('stage'), map = $('map');
const phone = matchMedia('(max-width:600px),(pointer:coarse) and (max-width:1000px)');
// Desktop: a 390x693 phone frame scaled to the window. Phone: full screen.
// The world-map layer is always scaled to cover the stage, like the object-fit:cover image under it.
function fit() {
  const s = phone.matches ? 1 : Math.min(window.innerWidth / 410, window.innerHeight / 713, 1.6);
  window.__stageScale = s; stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  const side = document.querySelector('.side'), room = (innerWidth - 390 * s) / 2 - 40; // inbox 43: the PC guide text wraps beside the frame, or hides when there is no room
  side.hidden = room < 200; side.style.maxWidth = Math.min(300, room) + 'px';
  map.style.transform = 'translate(-50%,-50%) scale(' + Math.max(stage.clientWidth / 390, stage.clientHeight / 693) + ')';
  api?.resize();
}
window.addEventListener('resize', fit);

const world = $('world'), hab = $('habitat');
const camBtns = $('camBtns'), frontBtn = $('frontBtn');
let api = null, cur = null; fit(); // cur: the habitat on screen (null = the world map)
$('overview').onclick = () => api?.overview(); $('frontBtn').onclick = () => api?.front();
// inbox 20: going straight to a habitat (the 「연못에서 보기」 button, the habitat menu, the 「자리 비운 사이」 card), and to one animal there
const nav = {
  async go(id, aid) {
    if (cur !== id) { if (cur) { api?.setActive(false); play?.leave(); } if (!await enter(id)) return false; }
    if (aid != null && !api?.look(aid)) toast('지금은 볼 수 없어요');
  },
};
// 26-1: the first screen (the world map) needs none of the 3D. three.js, the habitats and their windows (ui/play.js) are
// fetched in the quiet moment after the map is up, or at once if a habitat is opened first; what happened before the
// windows were here is handed to them then.
// inbox 62: a tap or key since the page opened (offline.js: a newer version found before it is taken at once)
let touched = false; for (const k of ['pointerdown', 'keydown']) addEventListener(k, () => { touched = true; }, { capture: true, once: true });
let play = null; const early = [];
G.on(ev => { if (!play) early.push(...ev); });
const code = () => code.p ??= (codeAsked(), Promise.all([import('./habitat/habitat.js'), import('./ui/play.js')]).then(([h, p]) => {
  play = p.initPlay(nav); play.events([...offline, ...early]); early.length = 0; return h;
}, e => { code.p = null; throw e; }));
const idle = f => (window.requestIdleCallback || setTimeout)(f, { timeout: 2000 });
// inbox 61 A: a new player goes from 시작 straight into the first habitat: its code is asked for at once, and no models
// ahead (the build waits for none: nothing is out there yet; the hatched one's comes with it)
// and the map (0.37 MB, under the intro card) after that code, not sharing a slow line with it; the first screen doesn't wait for it.
// 67-2: 시작 tapped by then: not until the board is up (enter) or the map is opened (back): nothing on screen shows it
const fresh = firstEgg(G.S), mapUp = () => mapUp.p ??= (mapImg.src = ASSETS.worldmap, mapImg.decode().catch(() => {}));
// 76: a player back (past the intro card) opens straight into the habitat they were in last (the map is fetched after it)
const backTo = !fresh && (G.S.flags.betaIntro || PREFS.introAt === VERSION) && (h => HAB[h]?.ready && G.S.unlocked.includes(h) ? h : HABITATS[0].id)(G.S.flags.lastHab);
if (fresh) code().catch(() => {}).then(() => cur || mapUp());
(fresh || backTo ? Promise.resolve() : mapUp()).then(() => {
  const boot = $('boot'); boot.classList.add('done'); setTimeout(() => boot.remove(), 400);
  idle(() => code().then(h => { // then the models of the habitat opened last (a new player: none, above)
    if (!fresh && !backTo) idle(() => h.prefetch(G.S.flags.lastHab || HABITATS[0].id, G.withGuests()).catch(() => {}));
    if (OFFLINE && !SEE) import('./ui/offline.js').then(m => m.initOffline(() => touched));
  }).catch(() => {}));
});
const ui = {
  restored: id => redo(id), // inbox 49: its GL context was lost and given back (habitat.js): built again
  lostLong: id => { // inbox 53: not given back in 3 s: built on a new canvas. None to be had (a probe first: three logs an error when it can't): 다시 불러오기
    const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g || g.isContextLost()) return glFail('no context');
    g.getExtension('WEBGL_lose_context')?.loseContext(); redo(id); built[id]?.then(glRebuilt, glFail); },
  onDig: () => { const id = G.dig(); if (id) toast(`화석을 발견했어요! ${PROPS.find(p => p.id === id).name} · 꾸미기 › 선물에 넣어 두었어요`, 2800, true); return id; }, // 14-3 화석 발굴
  onPile: () => { const n = G.tapPile(), L = n && G.event(); if (n) toast(`눈더미에서 ${L.e.coin.icon} ${L.e.coin.name} ${n}개!`, 2200, true); return n; }, // 15-2 첫눈
  hello: (x, y) => heart(x, y), // inbox 64-A: the first friend's hop
  skyNow, onStar, // 16-2 특별한 하늘 (ui/sky.js)
  onMyth, // 14-1 the meadow's fire prints, hoofprints, altar and 신수 tapped (ui/myth.js)
  onArt: uid => artTapped(uid), // 17-2 a 동물 작품 tapped: its choice, or who made it
  onWalk: (h, t, n) => G.wildWalk(h, t, n), onWild: (h, c) => G.wildGround(h, c), // 17-3: the animals' steps; where things may grow (game/wild.js)
  say: t => toast(t, 1800, true), // 28-3: a short note from the habitat (the music box's tune, the fireworks by day)
  zzz(xy) { if (!hab.classList.contains('hidden') && !overlayOpen() && !document.querySelector('body > section.pop:not([hidden])')) zzz(xy); }, // not over a sheet (28-5: nor 설정·꾸미기 코드·도움말, outside #habitat)
  onCam(s) { camBtns.hidden = !s; frontBtn.hidden = s !== 'f'; $('overview').textContent = s === 'w' ? '친구들 보기' : '전체 보기'; }, // following: 정면 + 전체 보기; away from the start view: 전체 보기; at the whole board (inbox 63): 친구들 보기
  tag: (text, rec) => { play.tag(text, rec); snap.followed(); }, // ui/play.js: a baby's tag shows its growth; 26-4 사진 모드's 따라가기 shows who
  onTap: (...a) => { if (!snap.on()) play.onTap(...a); }, // 24-1 사진 모드: no hearts or bubbles (a tap still follows the animal)
  scene: e => play?.scene(e, snap.on()), // 13-2 놀이 장면 (ui/play.js)
  onPropTap: uid => play.onPropTap(uid), onEdit: ok => play.onEdit(ok), onPaint: (c, b) => play.onPaint(c, b), onSweep: u => play.onSweep(u), // decorate mode (ui/decor.js)
  note: (k, n) => { if (!snap.on()) G.note(k, n); }, // 23-2 도전 과제 (not while 사진 모드 can hold the night or the rain)
  onHome: (id, home) => G.setHome(id, home), // inbox 53 울타리 안 자리
  onCarry: rec => { G.flag('tip_carry'); if (!G.S.flags.carried) G.flag('carried'); play.onCarry(rec); }, // inbox 42 E: found it alone: no tip for it; 66-1 first_drag; 69-1 출생 기록
  onLetGo: rec => play.onLetGo(rec),
  onGuestMove: (id, x, z) => G.moveGuest(id, x, z), // 66-1: a 떠돌이 손님 carried somewhere
  cramped(again) { if (again || !G.S.flags.cramped) { G.flag('cramped'); toast('울타리 안이 너무 좁아요', 2200, true); } }, // inbox 42 B: one put outside a fence closed too tight (once)
  train(hab, loop) { const k = 'train:' + hab; if (loop && !G.S.flags[k]) { G.flag(k); toast('고리가 닫혔어요! 태엽 기차가 달려요', 2600, true); } return !!G.S.flags[k]; }, // 28-4: once closed, it runs (a broken track: back and forth)
};

placeFrom(() => cur ? HAB[cur].name : '지도'); // inbox 49: where the player was, for 문제 알리기 and an error's clues
const built = {}, lv = {}; // each habitat's scene is built the first time it is entered (and its models fetched then); lv: the 땅 넓히기 step it was built at
// 22-1: a build hands the board's own trees, bushes, rocks and flowers to the save the first time (and a 땅 넓히기 step's new ones)
const build = (id, opt) => { lv[id] = G.S.expand[id] || 0; return new Promise(r => setTimeout(r, 60)).then(code).then(h => h.startHabitat($('gl'), ui, id, G.withGuests(), { level: lv[id], ...opt }))
  .then(api => { if (api.natives) G.addNatives(id, api.natives.list, api.natives.rings);
    if (SEE?.hab === id && !SEE.laid) { SEE.laid = true; G.importLayout(id, SEE.d, api.decor.fitAll, api.decor.cellOk); } // 69-4: the sender's layout on this board
    return api; }); };
// inbox 61 A·B: a new player's first egg is cracked on the loading screen as soon as the nest's code is here (seconds on a slow
// phone). inbox 64-A: the board is built while the reveal card is read (built during the hatch, the hatch took 2.7 s longer);
// while it is, a small line under the card says so (body.building), not the loading screen's over the nest
const firstHere = id => code().then(() => new Promise(done => {
  const L = $('loading'), b = L.querySelector('.lfirst'), say = L.firstChild, off = () => document.body.classList.remove('building');
  document.body.classList.add('building');
  say.textContent = '첫 알이에요! 눌러서 깨워 보세요'; b.hidden = false; b.focus?.();
  b.onclick = () => { b.onclick = null; b.hidden = true; say.textContent = ''; play.firstEgg(id, () => { say.textContent = '서식지 불러오는 중…'; done(); }, () => (built[id] ??= build(id)).then(off, off)); };
}), () => {});
async function enter(id) {
  cur = id; world.classList.add('hidden'); hab.classList.remove('hidden'); hab.setAttribute('aria-label', HAB[id].name + ' 서식지 3D');
  $('habName').querySelector('b').textContent = HAB[id].short ?? HAB[id].name; // 14-3: the chip's room (375 wide) fits two letters
  loadBar(true, !!play); if (G.S.flags.lastHab !== id) G.flag('lastHab', id);
  if (!SEE) track('habitat_open', { habitat: HAB[id].name }, 'open:' + id); // inbox 41 A: a day each
  if (firstEgg(G.S) && !built[id]) await firstHere(id); // inbox 61 A·B
  try { api = await (built[id] ??= build(id)); }
  catch (e) { console.warn('enter', id, e); // 26-1: offline, and this habitat's files were never fetched (or the network dropped): back to the map, try again later
    delete built[id]; loadBar(false); if (cur === id) $('back').click(); toast('인터넷에 연결되면 열 수 있어요', 2600); return false;
  }
  // 27-2: the animals and props come out in attach; their shaders are made behind the curtain (the first frame after it froze 2.6 s in Chrome, 3.3 s in WebKit)
  api.setActive(true); play.attach(api, id);
  if (G.S.refit?.includes(id)) G.refit(id, api.decor.refit(G.S.props)); // inbox 42 A: the board grew (rules.js to11): what no longer fits moves
  if (!SEE) artPlace(id); // 17-2: the 작품 made while away, on this board's empty ground
  await api.warm(); loadBar(false); idle(mapUp); return true;
}
const mapUi = initWorldMap(world, { enter });
G.on(ev => { if (ev.some(e => e.type === 'unlock' || e.type === 'reset')) mapUi.refresh(); });
// 21-3b 땅 넓히기 (or a new game: back to the first board): a built habitat is built again at its step. On screen, a cloud
// covers the change; the new board starts from the old view and glides out while the mist on the bought band draws back.
const veil = $('veil'), fade = on => new Promise(r => { veil.hidden = false; requestAnimationFrame(() => { veil.classList.toggle('on', on); setTimeout(() => { veil.hidden = !on; r(); }, 450); }); });
const rebuild = (id, ex) => { // ex: the 땅 넓히기 that asks for it (the mist draws back), none: built again as it is
  const reveal = !!ex, prev = built[id];
  built[id] = (async () => {
    const old = await prev, shown = cur === id;
    if (shown) { veil.firstChild.textContent = reveal ? '땅을 넓히는 중…' : '다시 짓는 중…'; await fade(true); } // a slow phone can take a few seconds
    const pose = old.pose(); old.setActive(false); // the layouts are shared: the old board must be still while the new one is laid out
    const next = await build(id, { pose, reveal }); old.dispose();
    if (cur === id) { api = next; next.setActive(true); play.attach(next, id); if (ex) next.showZone(ex.level); } else next.setActive(false); // 28-1: the camera to the new zone, animals run there
    if (shown) fade(false);
    if (ex) next.revealed.then(() => zoneCard(id, ex.level, ex.free)); // inbox 17: once the mist is gone
    return next;
  })();
};
// 28-1: 「새 구역: 과수원」 and what one can see there, in a line (ZONES)
function zoneCard(id, L, free) {
  const z = ZONES[id]?.[L - 1], el = document.createElement('section'); el.id = 'zoneCard'; el.className = 'intro pop lvup'; el.setAttribute('aria-label', '새 구역');
  el.innerHTML = `<div><h2>새 구역: ${z.name}</h2><p class="sub">${z.line}</p><p class="sub">땅 넓히기 ${L}단계 · ${free ? '모으기 선물로 무료' : `♥-${BALANCE.expand.price[L - 1]}`}</p><button data-close>좋아요</button></div>`;
  el.querySelector('[data-close]').onclick = () => el.remove(); $('habitat').append(el); sfx('level');
}
G.on(ev => {
  if (!ev.some(e => e.type === 'expand' || e.type === 'reset')) return;
  for (const id of Object.keys(built)) if (lv[id] !== (G.S.expand[id] || 0)) rebuild(id, ev.find(e => e.type === 'expand' && e.habitat === id));
});
// 26-3 그래픽 품질 changed: the habitat on screen is built again now (under the cloud), the others when next entered
const redo = id => { if (id === cur) rebuild(id); else if (built[id]) { const p = built[id]; delete built[id]; p.then(a => a.dispose(), () => {}); } }, regfx = () => Object.keys(built).forEach(redo);
// inbox 53: no new GL context either (the GPU gone for the page): a short note and a reload (the save is kept on every change)
const glFail = e => { console.warn('rebuild', e); if ($('glFail')) return; const el = document.createElement('section'); el.id = 'glFail'; el.className = 'intro pop'; el.setAttribute('aria-label', '다시 불러오기');
  el.innerHTML = '<div><h2>화면을 다시 그리지 못했어요</h2><p>모은 동물과 꾸미기는 저장돼 있어요.</p><button>다시 불러오기</button></div>'; el.querySelector('button').onclick = () => location.reload(); $('stage').append(el); };
const level = initLevel(() => api); level.events(offline); // 23-1 정원사 레벨
const snap = initPhoto(() => api, () => cur); // 24-1 사진 모드
initSky(() => api, () => cur);
$('back').onclick = () => { mapUp(); snap.leave(); hab.classList.add('hidden'); world.classList.remove('hidden'); api?.setActive(false); api = cur = null; play?.leave(); };

// 74: one button (the habitat's name, ‹) back to the world map; the map moves between habitats
$('habName').onclick = () => $('back').click();
if (SEE) { // 69-4: only the sender's habitat; back (‹, Esc, the phone's back) is 「내 정원으로」. Taps follow a friend, nothing more
  $('back').onclick = () => location.replace(location.pathname + location.search); seeBar(SEE);
  Object.assign(ui, { onTap() {}, onCarry() {}, scene() {}, note() {}, cramped() {}, onDig: () => null, onPile: () => 0, onHome() {}, onGuestMove() {}, onArt() {}, onWalk() {}, onWild() {} });
}

// inbox 20 C9: Esc (PC) and the phone's back button close the window on top first, then leave the habitat for the map.
// One history entry stands for "there is something to close" (a window, or a habitat on screen); back uses it up.
const leaveHab = () => { if (!cur) return false; $('back').click(); return true; };
addEventListener('keydown', e => { if (e.key === 'Escape' && !e.repeat && !closeTop()) leaveHab(); });
let skipPop = false;
const guard = () => {
  const deep = !!cur || !!topWindow();
  if (deep && !history.state?.th) history.pushState({ th: 1 }, '');
  else if (!deep && history.state?.th && !skipPop) { skipPop = true; history.back(); } // 26-8: one back at a time (back is async; two events in a row asked twice → off the page)
};
addEventListener('popstate', () => { if (skipPop) { skipPop = false; return; } if (!closeTop()) leaveHab(); setTimeout(guard, 50); });
document.addEventListener('click', () => setTimeout(guard, 50), true);
G.on(() => guard());

// 20-1 open beta: the intro card once (flags.betaIntro); the feedback form with the game's state filled in (no personal
// data: the version, where the player is, how many animals are out there, or how many in all on the map); the rating mark once rated
const intro = $('intro'), fb = $('feedback'), rating = $('rating');
// inbox 43: once per version on this device, also kept in the prefs (apart from the save and its tab lock); 설정 › 정보 shows it again
intro.hidden = !!G.S.flags.betaIntro || PREFS.introAt === VERSION;
if (intro.hidden && !G.S.flags.betaIntro) { G.flag('betaIntro'); G.flag('news', VERSION); }
// 26-8 새 소식: once after VERSION changes (flags.news = the version last shown); a new player gets the intro card instead. 설정 › 다시 보기
// 76: a player back gets it as one line of 돌아왔어요 (the whole card on a tap), not a card of its own
const news = $('news'); news.querySelector('[data-ver]').textContent = VERSION;
let newsDue = intro.hidden && G.S.flags.news !== VERSION;
const firstDone = () => { if (retWait && intro.hidden && news.hidden) { retWait = false; showRet(); } }; // 자리 비운 사이 waits for these
fb.hidden = FEEDBACK_URL === 'TODO';
const fbUrl = () => { const n = cur ? outIn(G.S, cur).length : G.S.animals.length; // out in this habitat (not stored), or all
  return `${FEEDBACK_URL}?usp=pp_url&${FEEDBACK_FIELD}=${encodeURIComponent(`ver=${VERSION} habitat=${cur || 'map'} animals=${n}`)}`; };
fb.onclick = () => { fb.href = fbUrl(); }; // the href is set at the tap, before the link opens (inbox 20: on the world map; in a habitat a 설정 row)
if (!SEE) setTimeout(() => import('./ui/rate.js').then(m => m.initRate(FEEDBACK_URL === 'TODO' ? null : fbUrl)).catch(() => {}), 60e3); // inbox 61 C (3 minutes at the soonest)
if (RATING.mark || RATING.number) {
  const img = rating.querySelector('img'); img.hidden = !RATING.mark; if (RATING.mark) img.src = RATING.mark;
  rating.querySelector('span').textContent = RATING.number; rating.hidden = false;
}

// inbox 20 C1: back after a while (the game was closed, or the tab hidden 10+ minutes): what happened; a line goes there.
// inbox 58: one card on a day back, 돌아왔어요: today's 출석 (받기 right there; closing takes it too), the eggs laid, the friends grown
// (baby → adult, small: their own card then has nothing to show), the eggs done in the slots. The news comes first (firstDone).
const ret = $('ret');
let retWait = false, retEggs = {}, retGrown = [];
const retAttend = () => G.attendDue() && G.S.attend.n > 0; // a new player's first slot: the 출석부 card in the habitat, as before
const retHome = () => cur || G.S.flags.lastHab || HABITATS[0].id;
function away(eggs) { // eggs: { habitat id: eggs laid meanwhile }
  retEggs = eggs;
  if (!Object.values(eggs).some(Boolean) && !G.S.animals.some(a => a.card) && !retAttend() && !G.S.cards.some(c => c.new) && !mythDue() && !retSky() && !newsDue && !artDue(retHome()).length && !wildNews(G.S)) return; // nothing new: no card
  if (intro.hidden && news.hidden) showRet(); else retWait = true;
}
function showRet() {
  const eggs = retEggs, now = G.now(), ready = G.S.slots.filter(s => s && now >= s.end).length, grown = G.S.animals.filter(a => a.card), att = retAttend() && todayRow();
  const n = Object.values(eggs).reduce((a, b) => a + b, 0), most = Object.keys(eggs).sort((a, b) => eggs[b] - eggs[a])[0];
  const back = G.S.cards.filter(c => c.new), names = [...new Set(back.map(c => c.nm))]; // 13-1: postcards not seen, at the top
  const myth = mythDue(); // 14-1: it came to the altar while away: the top row (its coming seen from there, 다시 보기)
  const sk = retSky(); // 16-2: last night's sky not seen (망원경으로 다시 보기)
  const ar = artRow(retHome()); // 17-2 「밤사이 먹보 양 몽실이가 작품을 만들었어요」 (after the 출석, before the rest)
  const wn = wildNews(G.S), wr = wn && ['🌼', wn.text, wn.sub, 'wild']; // 17-3: one row, the most interesting change (a tap: the camera there)
  if (!n && !grown.length && !att && !back.length && !myth && !sk && !newsDue && !ar && !wr) return;
  const top = newsDue && (news.querySelector('li[data-top] span') || news.querySelector('li:not([data-upd]) span'))?.textContent; // 76: this version's line (data-top), on one line
  const full = Object.keys(eggs).filter(h => G.S.nests[h].eggs.length >= BALANCE.nest.max); // 27-7c: 「알 3개」 with 20 in the nest: say it is full (no more come)
  const d2 = att && att[2], wk = att && weekOn(); // 93-1: the second day's legendary egg, the card's top row (a tap: into the nest, then the nest)
  const rows = [d2 && ['🥚', '이틀째 선물 · 전설 알이 왔어요', '누르면 둥지로 · 기다림 없이 바로 깨요', 'd2'], top && ['📰', `새 소식 ${VERSION}`, top, 'news'], myth && ['🔥', '밤사이 제단에 불갈기 천리마가 내려왔어요', '다시 보기', 'myth'], sk && ['🌌', sk.text, '다시 보기', 'sky'], back.length && ['🐾', '산책에서 돌아왔어요', `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` 외 ${names.length - 2}` : ''} · 엽서 ${back.length}장 보기`, 'cards'], !d2 && att && ['📅', wk ? `첫 주 선물 ${att[0]}일째` : `${att[0]}일째 출석`, att[1], 'attend'], ar, wr, n && ['🥚', `알 ${n}개`, `${Object.keys(eggs).map(h => HAB[h].name).join('·')} ${full.length === Object.keys(eggs).length ? '둥지가 가득 찼어요' : `둥지에 생겼어요${full.length ? ` · ${full.map(h => HAB[h].name).join('·')} 가득` : ''}`}`, 'eggs'],
    grown.length && ['🌱', `다 자란 친구 ${grown.length}`, '보러 가요', 'grown'], ready && ['✨', `부화 끝난 알 ${ready}`, '깨우러 가요', 'ready']].filter(Boolean);
  const today = G.dayOf(now); // inbox 21: the backup reminder, at most once a day
  if (BK.due(now) && G.S.flags.backupNag !== today) { rows.push(['💾', '백업해 두면 기기를 바꿔도 이어서 할 수 있어요', '설정 › 내 저장 백업', 'backup']); G.flag('backupNag', today); }
  ret.innerHTML = `<div><h2>돌아왔어요</h2><ul>${rows.map(([i, t, sub, k]) => `<li><button data-go="${k}"${k === 'attend' ? ' class="take"' : ''}><i aria-hidden="true">${i}</i><span>${t}<small>${sub}</small></span></button>${
    (k === 'attend' || k === 'd2') && wk ? weekCells() : k === 'grown' ? `<p class="minis">${grown.slice(0, 3).map(() => '<span><img alt="새끼"><b>→</b><img alt="성체"></span>').join('')}</p>` : ''}</li>`).join('')}</ul>
<div class="nbtns"><button class="go" data-close>확인</button></div></div>`;
  ret.dataset.wild = wn ? JSON.stringify([wn.hab, wn.at]) : ''; if (wn) G.wildSeen();
  ret.dataset.eggs = most || ''; ret.dataset.grown = grown[0] ? habitatOf(grown[0]) : ''; retGrown = grown.map(a => a.id);
  if (grown.length) code().then(() => import('./ui/thumbs.js')).then(({ figureThumb: f }) => ret.querySelectorAll('.minis > span').forEach((p, i) => { const a = grown[i], [b, c] = p.querySelectorAll('img');
    f(a.species, a.variant, a.color, a.acc, 'baby').then(u => { b.src = u; }); f(a.species, a.variant, a.color, a.acc, 'adult').then(u => { c.src = u; }); })).catch(() => {}); // offline: the row without them
  ret.hidden = false; if (myth) G.mythShown(); if (sk) retShown(sk.n); if (newsDue) { newsDue = false; G.flag('news', VERSION); }
}
ret.onclick = async e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d) return;
  if (d.go === 'attend') { const t = takeToday(retHome()), r = b.getBoundingClientRect(); b.disabled = true; b.querySelector('small').textContent = t ? `받았어요 · ${t}` : '받았어요';
    for (let i = 0; i < 3; i++) setTimeout(() => heart(r.right - 30 + (i - 1) * 14, r.top + r.height / 2), i * 120); return; } // 76: no window; ♥ pops right there
  ret.hidden = true;
  if (retAttend()) { const t = takeToday(retHome()); if (t) toast(`오늘 출석 · ${t}`, 2600); }
  const first = retGrown[0]; if (retGrown.length) { G.grownSeen(retGrown); retGrown = []; }
  if (d.go == null) return;
  if (d.go === 'd2') { ret.dataset.eggs = Object.keys(G.S.nests).find(h => G.S.nests[h].eggs.some(e => e.now)) || ''; d.go = 'eggs'; } // taken above (retAttend)
  if (d.go === 'backup') return BK.open();
  if (d.go === 'news') { news.hidden = false; return; }
  const home = retHome(), to = { eggs: ret.dataset.eggs || home, ready: home, grown: ret.dataset.grown || home, cards: home, myth: 'meadow', sky: 'meadow', art: home, wild: JSON.parse(ret.dataset.wild || '[]')[0] || home }[d.go];
  // the 3D comes in under a cloud, at once: no map in between (it showed for seconds on a phone the first time); the loading bar says the rest
  const far = cur !== to; if (far) { veil.firstChild.textContent = ''; veil.hidden = false; veil.classList.add('on'); world.classList.add('now'); hab.classList.add('now'); }
  const ok = await nav.go(to, d.go === 'grown' ? first : undefined) !== false;
  if (ok && d.go === 'cards') (await import('./ui/stroll.js')).openCards();
  else if (ok && d.go === 'myth') mythCut();
  else if (ok && d.go === 'sky') retGo();
  else if (ok && d.go === 'art') artOpen(to); // 17-2: the camera to each, its choice
  else if (ok && d.go === 'wild') { const [i, j] = (JSON.parse(ret.dataset.wild)[1] ?? '0,0').split(',').map(Number); api?.artView(i + 0.5, j + 0.5); } // 17-3: the camera on it
  else if (ok && d.go !== 'grown') play.openNest();
  if (far) { world.classList.remove('now'); hab.classList.remove('now'); fade(false); }
};
let hiddenAt = null;
const eggsNow = () => Object.fromEntries(Object.entries(G.S.nests).map(([h, x]) => [h, x.eggs.length]));
addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = { t: Date.now(), eggs: eggsNow() }; return; }
  if (!hiddenAt || Date.now() - hiddenAt.t < 10 * 60000) return;
  const was = hiddenAt.eggs, eggs = {}; hiddenAt = null;
  for (const [h, n] of Object.entries(eggsNow())) if (n > (was[h] || 0)) eggs[h] = n - (was[h] || 0);
  if (ret.hidden) away(eggs);
});
$('introStart').onclick = () => { intro.hidden = true; G.flag('betaIntro'); G.flag('news', VERSION); PREFS.introAt = VERSION; savePrefs(); firstDone();
  if (!cur && firstEgg(G.S)) nav.go(HABITATS[0].id); }; // inbox 61 B: a new player, straight to the first egg (no map tap)
news.querySelector('[data-close]').onclick = () => { news.hidden = true; G.flag('news', VERSION); firstDone(); };
if (!SEE) { initAttend(() => cur); initEvent(() => cur, () => api); initMyth(() => cur, () => api); initVisit(nav); initArt({ api: () => api, cur: () => cur, back: () => { if (ret.hidden) away({}); } }); }
if (backTo) nav.go(backTo);
if (!SEE) { const eggs = {}; for (const e of offline) if (e.type === 'egg') eggs[e.habitat] = (eggs[e.habitat] || 0) + 1; away(eggs); }

// 21-1 설정: choices kept in this browser apart from the save (config.js PREFS); the habitat reads them every frame
const PREF_ROWS = [['time', '시간', [['real', '실제 시간'], ['day', '항상 낮']]], ['weather', '날씨 효과', [[true, '켜기'], [false, '끄기']]], // 21-2: 끄기 = always clear (for slow phones)
  ['mute', '소리', [[false, '켜기'], [true, '모두 끄기']]]]; // 26-2
const VOLS = [['vAll', '전체'], ['vAmb', '배경 소리'], ['vFx', '효과음'], ['vAnimal', '동물 소리']];
// 26-3: after the sound. 움직임 줄이기 shows the device's choice until one is picked; 진동 only where the browser can (Android)
const PC = matchMedia('(pointer:fine)').matches; // 74: 책상 모드 is for a desk
const LOOK_ROWS = [['gfx', '그래픽 품질', [['low', '낮음'], ['mid', '보통'], ['high', '높음']]], ['saver', '배터리 절약', [[false, '끄기'], [true, '켜기']]],
  ...PC ? [['deskSound', '책상 모드 소리', [[false, '끄기'], [true, '배경 소리만']]], ...navigator.wakeLock ? [['deskWake', '책상 모드 화면 켜 두기', [[true, '켜기'], [false, '끄기']]]] : []] : [], // 16-3; 74: PC only
  ['font', '글자 크기', [['s', '작게'], ['m', '보통'], ['l', '크게']]], ['calm', '움직임 줄이기', [[false, '끄기'], [true, '켜기']]], ['signs', '구역 팻말 보이기', [[true, '켜기'], [false, '끄기']]],
  // 74: 성격·단짝 and 단짝 하트 끈 rows hidden (they stay on; flags.palOff and PREFS.palLine as saved)
  ...navigator.vibrate && matchMedia('(pointer:coarse)').matches ? [['buzz', '진동', [[false, '끄기'], [true, '켜기']]]] : [],
  ['art', '동물 작품 만들기', [[true, '켜기'], [false, '끄기']]], // 17-2 (flags.artOff: kept in the save)
  ['wild', '정원이 자라요', [[true, '켜기'], [false, '끄기']]], // 17-3 (flags.wildOff: kept in the save; 끄기: nothing grows, none drawn)
  ['stats', '이용 통계 보내기', [[true, '켜기'], [false, '끄기']]]]; // inbox 41 A (src/ui/stats.js)
const segRow = ([k, name, opts]) => { const now = k === 'calm' ? calm() : k === 'pal' ? !G.S.flags.palOff : k === 'art' ? !G.S.flags.artOff : k === 'wild' ? !G.S.flags.wildOff : PREFS[k];
  return `<div class="row"><b>${name}</b><div class="seg">${opts.map(([v, t]) => `<button data-k="${k}" data-v="${v}"${now === v ? ' class="on"' : ''}>${t}</button>`).join('')}</div></div>`; };
const prefs = $('prefs'), rows = $('prefRows'), help = $('help');
const drawPrefs = () => { rows.innerHTML = PREF_ROWS.map(segRow).join('')
  + VOLS.map(([k, name]) => `<label class="row vol"><b>${name}</b><input type="range" min="0" max="100" step="5" data-vol="${k}" value="${Math.round(PREFS[k] * 100)}"${PREFS.mute ? ' disabled' : ''}><output>${Math.round(PREFS[k] * 100)}%</output></label>`).join('')
  + LOOK_ROWS.map(segRow).join('')
  + (cur && PC ? `<div class="row"><b>책상 모드</b><div class="seg"><button data-act="desk">켜기</button>${window.documentPictureInPicture ? '<button data-act="pip">항상 위 작은 창</button>' : ''}</div></div>` : '') // 16-3 (작은 창: PC Chrome only)
  + `<div class="row"><b>내 저장 백업</b><div class="seg"><button data-act="backup"${BK.due() ? ' class="new"' : ''}>백업 · 불러오기</button></div></div>`
  + `<div class="row"><b>처음 안내</b><div class="seg"><button data-act="help">도움말</button><button data-act="tips">안내 다시 보기</button></div></div>`
  + (iosSafariTab(BK.DEV) ? `<div class="row"><b>홈 화면 안내</b><div class="seg"><button data-act="home">홈 화면 안내 다시 보기</button></div></div>` : '') // inbox 39
  + `<div class="row"><b>정보</b><div class="seg"><button data-act="intro">베타 안내</button><button data-act="news">새 소식 다시 보기</button></div></div>` // inbox 43
  + `<div class="row"><b>선물 코드</b><div class="seg"><button data-act="code">선물 코드 넣기</button></div></div>` // inbox 41 B
  + (FEEDBACK_URL === 'TODO' ? '' : `<div class="row"><b>의견</b><div class="seg"><button data-act="fb">의견 보내기</button><button data-act="bug">문제 알리기</button></div></div>`); };
$('prefsBtn').onclick = () => { drawPrefs(); prefs.hidden = false; };
const nagDot = () => $('prefsBtn').classList.toggle('new', BK.due()); nagDot(); G.on(nagDot); // inbox 21: 7 days without a backup
$('prefsClose').onclick = () => { prefs.hidden = true; };
const tipsAgain = () => { resetTips(); G.flag('nestTapped', false); prefs.hidden = help.hidden = true; toast('처음 안내를 다시 보여 줄게요', 2200, true); if (cur) tip('nest', '#nestBtn'); };
rows.onclick = e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.act === 'tips') return tipsAgain();
  if (d.act === 'help') { prefs.hidden = true; return openHelp(); } // 74: was the 「?」 button
  if (d.act === 'home') { G.flag('homeHintSeen', false); prefs.hidden = true; return toast(cur ? '홈 화면 안내를 다시 보여 줄게요' : '서식지에 들어가면 홈 화면 안내를 다시 보여 줄게요', 2200, true); } // play.js shows it
  if (d.act === 'backup') return BK.open();
  if (d.act === 'news') { prefs.hidden = true; news.hidden = false; return; }
  if (d.act === 'intro') { prefs.hidden = true; intro.hidden = false; return; }
  if (d.act === 'code') { prefs.hidden = true; return openCode(); }
  if (d.act === 'desk' || d.act === 'pip') { prefs.hidden = true; const a = api; if (!a) return toast('서식지를 그리는 중이에요 · 조금 뒤에 다시 눌러 주세요', 2200, true); return import('./ui/desk.js').then(m => d.act === 'pip' ? m.openPip(a) : m.deskOn(a)).catch(e => { console.warn('desk', e); toast('작은 창을 열지 못했어요', 2200, true); }); } // 16-3
  if (d.act === 'fb') return void open(fbUrl(), '_blank', 'noopener');
  if (d.act === 'bug') { const ok = copyNow(reportText()); // copied at this tap; the player pastes it in the form
    ask(ok === false ? '복사하지 못했어요.\n의견 양식에 겪은 일을 적어 주세요.' : '버전·기기·최근 오류를 복사했어요.\n의견 양식의 글칸에 붙여 넣고 겪은 일을 적어 주세요.', '양식 열기', '닫기');
    $('ask').querySelector('[data-ok]').addEventListener('click', () => open(fbUrl(), '_blank', 'noopener')); return; } // opened in the tap itself, not after a promise (popup blockers)
  if (!d.k) return;
  if (d.k === 'pal') { G.flag('palOff', d.v !== 'true'); return drawPrefs(); } // 17-1
  if (d.k === 'art') { G.flag('artOff', d.v !== 'true'); return drawPrefs(); } // 17-2
  if (d.k === 'wild') { G.flag('wildOff', d.v !== 'true'); return drawPrefs(); } // 17-3
  const opt = [...PREF_ROWS, ...LOOK_ROWS].find(r => r[0] === d.k)[2].find(o => String(o[0]) === d.v), was = PREFS[d.k];
  PREFS[d.k] = opt[0]; savePrefs(); applyLook(); drawPrefs(); applySound();
  if (d.k === 'gfx' && was !== opt[0]) regfx(); // 26-3: the habitat is built again at the new quality
};
rows.oninput = e => { const k = e.target.dataset.vol; if (!k) return; PREFS[k] = e.target.value / 100; e.target.nextElementSibling.value = e.target.value + '%'; applySound(); };
rows.onchange = e => { if (e.target.dataset.vol) { savePrefs(); sfx('tap'); } }; // let go of the slider: keep it, and a tap to hear how loud
// inbox 20 C3: every first-time tip in one place (74: from 설정 › 처음 안내)
const openHelp = () => {
  help.innerHTML = `<div><h2>도움말</h2><dl>${Object.values(TIPS).map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>
<div class="nbtns"><button class="sb" data-act="tips">안내 다시 보기</button><button class="go" data-close>닫기</button></div></div>`;
  help.hidden = false;
};
help.onclick = e => { const d = e.target.closest('button')?.dataset; if (!d) return; if (d.act === 'tips') tipsAgain(); else if (d.close != null) help.hidden = true; };
if (DEBUG) import('./ui/debug.js').then(m => m.initDebug());
// ?photo: promo shots (docs/threads/shots) - no buttons, hearts, notes, labels; the game itself is unchanged
if (/[?&]photo/.test(location.search)) document.body.classList.add('photo');
