// Habitat HUD and what taps do: hearts, codex, nest and tool buttons (보관함 / 진열장 / 꾸미기), the bubble over an animal,
// game toasts. Eggs, hatching and the reveal card live in the nest menu (nest.js).
import * as G from '../game/game.js';
import { BALANCE as B } from '../game/data.js';
import { SP, HAB, variantOf, growLeft, gauge, growing, feedsLeft, capOf, habitatOf, outIn, callName, eggGap, scenesOf } from '../game/rules.js';
import { PROPS } from '../game/data.js';
import { toast, hideToast, heart, span, josa, overlayOpen, clock, tip, resting } from './hud.js';
import { openCodex, hasNew } from './codex.js';
import { initNest } from './nest.js';
import { openStore, leaveStore } from './store.js';
import { pickStroll } from './stroll.js';
import { openFriends, leaveFriends } from './friends.js';
import { openDecor, leaveDecor, onPropTap, onEdit, onPaint, onSweep } from './decor.js';
import { openCabinet } from './cabinet.js';
import { figureThumb } from './thumbs.js';
import { sfx } from './sound.js';
import { homeHintDue } from '../game/backup.js';
import { DEV, open as openBackup } from './backup.js';

const $ = id => document.getElementById(id);
const nameOf = callName; // 26-4: its name if it has one
// a baby's growing, in words: "자라는 중 62% · 12분 남음" / "성장 멈춤 · 62%" (a 꼬마 사탕 holds it)
const pct = (r, now) => Math.floor(gauge(r, now) * 100);
const growText = (r, now) => r.hold ? `성장 멈춤 · ${pct(r, now)}%` : `자라는 중 ${pct(r, now)}% · ${span(Math.max(60000, growLeft(r, now) ?? 0))} 남음`;

export function initPlay(nav) {
  let hab = null, habId = null, bubbleFor = null, bubbleUntil = 0, press = null, pats = 0;
  const hearts = $('hearts'), bubble = $('bubble'), codexBtn = $('codexBtn'), stage = $('stage'), nest = initNest(nav);
  const friendsBtn = $('friendsBtn'), decorBtn = $('decorBtn'), pill = $('nestPill');
  // the bubble stays with its animal until a tap somewhere else, the animal leaves the screen, or 10 s without a touch
  addEventListener('pointerdown', e => { press = { x: e.clientX, y: e.clientY, own: bubble.contains(e.target) }; bubbleUntil = Date.now() + 10000; }, true);
  addEventListener('pointerup', e => { // after the habitat's own tap handling: tapping an animal (re)opens it (press.re)
    if (bubbleFor && press && !press.own && !press.re && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) { bubble.hidden = true; bubbleFor = null; }
    press = null;
  });
  codexBtn.onclick = () => openCodex(habId, hab);
  $('storeBtn').onclick = () => openStore(habId, hab);
  $('cabBtn').onclick = () => openCabinet(habId, hab);
  decorBtn.onclick = () => { bubble.hidden = true; bubbleFor = null; openDecor(habId, hab); if (newProps().length) G.markProps(); };
  friendsBtn.onclick = () => { bubble.hidden = true; bubbleFor = null; openFriends(habId, hab); };
  bubble.onclick = e => { // the bubble's buttons: 먹이 주기 / 꼬마 사탕 / 다시 자라기 / 보관함에 넣기
    const b = e.target.closest('button'), r = bubbleFor; if (!b || !r) return;
    const nm = nameOf(r), act = b.dataset.act;
    if (act === 'feed') { if (G.feed(r.id)) return showBubble(r, '냠냠!'); }
    if (act === 'candy') {
      if (!(G.S.candy > 0) && !G.buyCandy()) return toast(`하트가 모자라요 (꼬마 사탕 ♥${B.candy.price})`, 2200, true);
      if (G.holdBaby(r.id)) { toast(`${nm}${josa(nm, '은', '는')} 지금 모습 그대로 있어요`, 2400, true); return showBubble(r); }
    }
    if (act === 'grow' && G.letGrow(r.id)) { toast('다시 자라요 · 꼬마 사탕을 돌려받았어요', 2400, true); return showBubble(r); }
    if (act === 'store' && G.store(r.id)) toast(`${nm}${josa(nm, '을', '를')} 보관함에 넣었어요`);
    bubble.hidden = true; bubbleFor = null;
    if (act === 'walk') pickStroll(r);
  };
  const hint = () => { if (!G.S.flags.nestTapped) tip('nest', '#nestBtn'); }; // inbox 20: a first-time tip by the button (was a toast)
  // 꾸미기's red dot: a prop for this habitat not looked at yet (one added by an update; a new game has seen them all)
  const newProps = () => PROPS.filter(p => p.habitat === habId && !(G.S.seenProps || []).includes(p.id));
  // above the nest button: the soonest egg still hatching, and 「부화 시작」 (this habitat's eggs into every empty slot at once)
  pill.innerHTML = '<span class="pill" hidden></span><button class="back" hidden>부화 시작</button>';
  const [pillT, pillB] = pill.children;
  pillT.onclick = () => $('nestBtn').click(); // 26-11: people tap the words 「둥지를 눌러요」 / 「부화까지 4:57」 themselves
  pillB.onclick = () => {
    let n = 0; for (const e of [...(G.S.nests[habId]?.eggs || [])]) { if (!G.S.slots.includes(null)) break; if (G.takeEgg(habId, e.id) >= 0) n++; }
    if (n) { toast(`알 ${n}개를 부화 칸에 넣었어요`, 2200, true); tip('hatch', '#nestBtn'); }
  };
  function drawPill() {
    const now = G.now(), run = G.S.slots.filter(s => s && now < s.end), eggs = G.S.nests[habId]?.eggs.length || 0;
    const soon = run.length && Math.min(...run.map(s => s.end - now)), fill = eggs > 0 && G.S.slots.includes(null);
    const done = G.S.slots.filter(s => s && now >= s.end).length; // C11: a finished egg said in words, not only the button's glow
    const n = G.S.nests[habId], next = !soon && !done && n && !eggs && n.t + eggGap(G.S) - now; // 27-7a: nothing to do -> when the next egg comes
    pillT.hidden = !soon && !done && !(next > 0); pillT.textContent = done ? `깨울 알 ${done}개 · 둥지를 눌러요` : soon ? `부화까지 ${clock(soon)}` : next > 0 ? `다음 알까지 ${clock(next)}` : '';
    pillB.hidden = !fill; pill.hidden = pillT.hidden && !fill;
  }

  // the name tag of the animal followed (habitat.js): a baby's tag adds its growth gauge, kept up to date every tick
  const tagEl = $('tag'); let tagText = '', tagFor = null;
  function drawTag() {
    const r = tagFor && G.S.animals.find(a => a.id === tagFor.id), baby = r?.stage === 'baby' && !r.pending, now = G.now();
    tagEl.hidden = !tagText; tagEl.classList.toggle('grow', !!baby);
    if (!baby) { tagEl.textContent = tagText; return; }
    tagEl.innerHTML = `<span>${tagText}</span><b class="gg${r.hold ? ' hold' : ''}"><i style="width:${pct(r, now)}%"></i></b><small>${growText(r, now)}</small>`;
  }

  function draw() {
    hearts.lastChild.textContent = G.S.hearts; if (tagFor) drawTag();
    codexBtn.classList.toggle('new', hasNew()); $('storeBtn').classList.toggle('new', G.S.cards.some(c => c.new)); // 13-1 a postcard not seen
    if (habId) {
      const out = outIn(G.S, habId); friendsBtn.lastChild.textContent = `${out.length}/${capOf(G.S, habId)}`;
      friendsBtn.classList.toggle('new', out.some(a => a.card)); decorBtn.classList.toggle('new', newProps().length > 0); drawPill();
      if (out.some(a => a.stage === 'baby')) tip('grow', '#friendsBtn');
      if (out.length && !persisted) { persisted = true; navigator.storage?.persist?.()?.catch(() => {}); } // inbox 39: once a page, when there is something to keep
      if (out.length && !homeT && home.hidden && homeHintDue(DEV, G.S.flags)) { quiet = Date.now(); homeT = setTimeout(homeCard, 800); }
    }
    hab?.syncProps(G.S.props, G.S.paint?.[habId], G.S.ghost?.[habId]); hab?.sync(G.S.animals); // inbox 42 B: the props first, so no one comes out inside one
  }

  function onTap(kind, rec, x, y) {
    if (G.tapHeart(rec.id)) { // temporary heart rule (game/hearts.js); the tap that reaches the day's cap says so, once
      heart(x, y); if (G.S.pet.n >= B.heart.daily) toast('오늘 쓰다듬기 하트는 다 모았어요', 2200, true);
    }
    showBubble(rec); if (++pats >= 2) tip('carry', bubble); // inbox 42 E: from the second tap on a friend, once
  }

  // the small card over an animal: its name; a baby also how far it has grown, 먹이 주기 (3 a day) and the 꼬마 사탕
  // (or 다시 자라기 when one holds it). Anyone can go to storage from here.
  function showBubble(r, say = '') {
    const now = G.now(), baby = r.stage === 'baby', n = feedsLeft(r, now), c = G.S.candy || 0;
    const btn = (act, text, sub) => `<button data-act="${act}"${sub ? ' class="sub"' : ''}>${text}</button>`;
    bubble.innerHTML = `${say ? say + ' ' : ''}${nameOf(r)}${baby ? `<small>${growText(r, now)}</small>` : ''}<div class="row">${
      baby && growing(r) ? btn('feed', n ? `먹이 주기 ${n}/${B.grow.feeds}` : '오늘 먹이 다 줬어요') + btn('candy', `꼬마 사탕 주기 ${c ? `(${c}개)` : `♥${B.candy.price}`}`, true) : ''}${
      r.hold ? btn('grow', '다시 자라기') : ''}${btn('walk', '산책 보내기', true)}${btn('store', '보관함에 넣기', true)}</div>`;
    bubble.querySelector('[data-act=feed]')?.toggleAttribute('disabled', !n); bubble.hidden = false;
    const go = !bubbleFor; bubbleFor = r; bubbleUntil = Date.now() + 10000; if (press) press.re = true;
    if (go) requestAnimationFrame(place);
  }
  function place() {
    if (!bubbleFor) return;
    const p = hab?.where(bubbleFor.id), r = stage.getBoundingClientRect();
    if (!p || p[0] < r.left || p[0] > r.right || p[1] < r.top || p[1] > r.bottom || Date.now() > bubbleUntil || overlayOpen() || document.querySelector('#lvup:not([hidden]), #ret:not([hidden]), #attend:not([hidden]), #news:not([hidden])')) { bubble.hidden = true; bubbleFor = null; return; } // 26-11: a card coming up
    const cb = $('camBtns'), low = cb.hidden ? 0 : cb.getBoundingClientRect().bottom + bubble.offsetHeight + 16; // following up close: kept under 정면 / 전체 보기
    const half = bubble.offsetWidth / 2 + 6, x = Math.min(Math.max(p[0], r.left + half), r.right - half); // 13-1: kept on screen near the edges, the tail still at the friend
    bubble.style.left = x + 'px'; bubble.style.setProperty('--tx', p[0] - x + 'px'); bubble.style.top = Math.max(p[1], low) + 'px';
    requestAnimationFrame(place);
  }

  // what the game did (every tick, every action, and the catch-up at start)
  function events(ev) {
    draw();
    if (bubbleFor && ev.some(e => e.type === 'grown' && e.animal.id === bubbleFor.id)) showBubble(bubbleFor); // grown up: says its name
    const grown = ev.filter(e => e.type === 'grown').map(e => e.animal);
    if (grown.length && hab) setTimeout(cards, 2200); // after the growing (figure.js: about 1.5 s), the "다 자랐어요" card
    const eggs = ev.filter(e => e.type === 'egg').length;
    if (eggs && hab) toast(eggs > 1 ? `둥지에 알이 ${eggs}개 생겼어요` : '둥지에 알이 생겼어요');
    for (const e of ev) { // later ones matter more: they win the toast
      if (e.type === 'stored') toast(`서식지 자리가 모자라 오래된 친구가 보관함으로 갔어요 (최대 ${capOf(G.S, habitatOf(e.animal))}마리)`, 3200);
      if (e.type === 'unlock') { toast(`${HAB[e.habitat].name}의 잠금이 풀렸어요! 위의 서식지 이름을 눌러 가 보세요`, 3200); tip('unlock', '#habName'); }
      if (e.type === 'strollBack' && hab) { const a = e.animal, nm = nameOf(a); if (!a.stored && habitatOf(a) === habId) hab.drop(a); toast(`${nm}${josa(nm, '이', '가')} 산책에서 돌아왔어요 · ♥+${e.card.hearts}${a.stored ? ' · 자리가 없어 보관함에 있어요' : ''}`, 3000); } // 13-1
      if (e.type === 'reset' && hab) { bubble.hidden = true; bubbleFor = null; hint(); }
    }
  }
  G.on(events);

  // "○○가 다 자랐어요!": every grown animal whose card wasn't seen (several at once after time away), baby and adult side by side
  const card = $('grown'); let later = 0;
  const busy = () => overlayOpen() || document.querySelector('#lvup:not([hidden]), #ret:not([hidden]), #attend:not([hidden]), #news:not([hidden]), .tip') || document.body.classList.contains('photo') || resting(); // inbox 43
  function cards() {
    if (!hab || !card.hidden) return;
    const list = G.S.animals.filter(a => a.card); if (!list.length) return;
    // 27-7c: the nest (opened by 자리 비운 사이's egg row), another card or a tip in the way: wait for it (was dropped until the next visit)
    if (busy()) { clearTimeout(later); later = setTimeout(cards, 800); return; }
    const one = list.length === 1, nm = one && nameOf(list[0]), more = list.length - 4;
    card.innerHTML = `<div><h2>${one ? `${nm}${josa(nm, '이', '가')} 다 자랐어요!` : `친구 ${list.length}마리가 다 자랐어요!`}</h2>${
      list.slice(0, 4).map(a => `<p class="pair"><img alt="새끼"><span>→</span><img alt="성체"></p>`).join('')}${more > 0 ? `<p>그리고 ${more}마리 더</p>` : ''}${
      one ? '' : '<p class="sub">자란 모습은 도감에서도 볼 수 있어요</p>'}<button data-close>좋아요</button></div>`;
    card.querySelectorAll('.pair').forEach((p, i) => { const a = list[i], [b, c] = p.querySelectorAll('img');
      figureThumb(a.species, a.variant, a.color, a.acc, 'baby').then(u => { b.src = u; }); figureThumb(a.species, a.variant, a.color, a.acc, 'adult').then(u => { c.src = u; }); });
    card.querySelector('button').onclick = () => { card.hidden = true; G.grownSeen(list.map(a => a.id)); };
    card.hidden = false; sfx('grown');
  }

  // inbox 39: iPhone·iPad Safari can clear the save after 7 days away (a home-screen app is spared). Once a friend is out, one card says so:
  // it waits like cards() and for 2 s with nothing else up (after the grow tip come the level card and its tip). 알겠어요 = not again.
  const home = $('homeHint'); let homeT = 0, quiet = 0, persisted = false;
  function homeCard() {
    homeT = 0; if (!hab || !home.hidden || !homeHintDue(DEV, G.S.flags)) return;
    if (busy()) quiet = Date.now();
    if (Date.now() - quiet < 2000) { homeT = setTimeout(homeCard, 800); return; }
    home.hidden = false;
  }
  home.onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'backup') return openBackup(); // the backup sheet goes over the card; closing it comes back here
    home.hidden = true; G.flag('homeHintSeen'); };

  // 13-2 놀이 장면 (habitat.js: a friend got on a play prop, or friends did something together). One not in the 도감 yet: with
  // the friend on screen (no sheet over it) it goes in at once; elsewhere a notice at the screen's side (one a minute, 8 s)
  // turns the camera to it and puts it in. Quiet (사진 모드): only the ones in view
  const note = $('sceneNote'); let noteAt = -Infinity, noteT = 0;
  const hideNote = () => { note.hidden = true; clearTimeout(noteT); };
  const got = (list, r) => { let h = 0; for (const s of list) h += G.seeScene(s.id, r?.species) || 0;
    if (h) toast(`새 놀이 장면 「${list[0].name}」${list.length > 1 ? ` 외 ${list.length - 1}개` : ''} · 도감에 담았어요 ♥+${h}`, 2800, true); };
  function scene(e, quiet) {
    if (!hab || document.hidden) return; const list = scenesOf(e).filter(s => !G.S.scenes[s.id]); if (!list.length) return;
    const r = e.who?.[0]?.rec, p = r && hab.where(r.id), W = innerWidth, H = innerHeight;
    if (p && p[0] > 8 && p[0] < W - 8 && p[1] > 70 && p[1] < H - 90 && !overlayOpen()) return got(list, r);
    if (quiet || !r || overlayOpen() || Date.now() - noteAt < 60e3) return;
    noteAt = Date.now(); const right = !p || p[0] >= W / 2;
    note.innerHTML = `✨ 저쪽에서 새 놀이 장면!<small>눌러서 보러 가기</small>`; note.className = 'back scnote ' + (right ? 'r' : 'l');
    note.style.top = Math.min(Math.max(p ? p[1] : H / 2, 150), H - 260) + 'px'; note.hidden = false;
    clearTimeout(noteT); noteT = setTimeout(hideNote, 8000);
    note.onclick = () => { hideNote(); if (hab?.look(r.id)) got(list, r); };
  }

  return {
    onTap, events, scene, onPropTap, onEdit, onPaint, onSweep,
    tag(text, rec) { tagText = text; tagFor = rec || null; drawTag(); },
    attach(api, id) { hab = api; habId = id; nest.attach(api, id); draw(); hint(); setTimeout(cards, 1200); }, // grown while away: the cards together
    openNest: () => nest.open(), cards, firstEgg: (id, done) => nest.first(id, done), // inbox 61 B
    leave() { leaveDecor(); leaveStore(); leaveFriends(); hab = null; nest.leave(); hideNote(); bubble.hidden = true; bubbleFor = null; card.hidden = home.hidden = true; clearTimeout(homeT); homeT = 0; hideToast(); },
  };
}
