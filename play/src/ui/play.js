// Habitat HUD and what taps do: hearts, codex, nest and tool buttons (보관함 / 진열장 / 꾸미기), the bubble over an animal,
// game toasts. Eggs, hatching and the reveal card live in the nest menu (nest.js).
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { BALANCE as B } from '../game/data.js';
import { SP, HAB, variantOf, growLeft, gauge, growing, feedsLeft, capOf, habitatOf, outIn, callName, eggGap, scenesOf, growStage, PROP } from '../game/rules.js';
import { PROPS, HABITATS, PART_NAME, GROW_ACTS } from '../game/data.js';
import { when, TODS } from '../game/story.js';
import { tonight, skyTime, AURORAS } from '../game/sky.js';
import { weatherAt } from '../habitat/weather.js';
import { gameHours } from '../habitat/daylight.js';
import { toast, say, hideToast, heart, span, josa, overlayOpen, clock, tip, resting, redodge } from './hud.js';
import { openCodex, hasNew } from './codex.js';
import { initNest } from './nest.js';
import { openStore, leaveStore } from './store.js';
import { pickStroll } from './stroll.js';
import { openFriends, leaveFriends } from './friends.js';
import { openDecor, leaveDecor, onPropTap, onEdit, onPaint, onSweep, tabName } from './decor.js';
import { openCabinet } from './cabinet.js';
import { figureThumb, silhouetteThumb } from './thumbs.js';
import { guestName } from '../game/visit.js';
import { PE } from '../game/pals.js';
import { sfx } from './sound.js';
import { homeHintDue, appHintDue, inApp } from '../game/backup.js';
import { DEV, open as openBackup, copyLink, chromeLink } from './backup.js';
import { rosterOf, isRegular } from '../game/guests.js'; // 66-1 떠돌이 손님
import { WISH, GUEST, guestWear } from '../game/guests-data.js';
import { PREFS, calm } from '../config.js';
import { track } from './stats.js'; // 93-3

const $ = id => document.getElementById(id);
const nameOf = callName; // 26-4: its name if it has one
// a baby's growing, in words: "자라는 중 62% · 12분 남음" / "성장 멈춤 · 62%" (a 꼬마 사탕 holds it)
const pct = (r, now) => Math.floor(gauge(r, now) * 100);
const growText = (r, now) => r.hold ? $t('성장 멈춤 · {0}%', pct(r, now)) : $t('자라는 중 {0}% · {1} 남음', pct(r, now), span(Math.max(60000, growLeft(r, now) ?? 0)));
// 69-1 출생 기록 한 줄: the day (한국 시간, as the 이야기 카드), the habitat whose nest it came from, that hour's weather, and that
// night's sky if it was a special one. Read off what the save keeps already (its born and egg: the codex's day and habitat for
// a first one, so a legendary's line and its story card say the same); nothing new is saved
const WX = { clear: $t('맑음'), rain: $t('비'), fog: $t('안개'), snow: $t('눈') };
function birthLine(r) {
  if (!Number.isFinite(r.born)) return '';
  const { day, tod } = when(r.born), h = HABITATS.find(x => x.nest === r.egg)?.id ?? SP[r.species]?.habitat, w = weatherAt(h, gameHours(r.born));
  const T = G.S.sky && skyTime(new Date(r.born).getHours()) && tonight(G.S, r.born, h);
  const sky = T && (T.aurora ? AURORAS.find(x => x.id === T.aurora).name : T.meteor ? T.meteor.name + $t(' 유성우') : T.comet ? $t('혜성') : T.full ? $t('보름달') : '');
  return [$t('{0}월 {1}일 {2} · {3} 둥지', +day.slice(4, 6), +day.slice(6), TODS[tod], HAB[h]?.name ?? ''), w.bow > 0.3 ? $t('무지개') : WX[w.kind], sky && sky.replace(/ /g, '\u00a0')].filter(Boolean).join(' · ');
}

export function initPlay(nav) {
  let hab = null, habId = null, bubbleFor = null, bubbleUntil = 0, press = null, pats = 0, held = false; // held: 69-1, one carried shows its 출생 기록
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
    if (r.guest) { bubble.hidden = true; bubbleFor = null; if (act === 'book') import('./visit.js').then(m => m.openBook()); return; } // 16-1: a guest has only 방명록
    if (act === 'feed') { if (G.feed(r.id)) return showBubble(r, $t('냠냠!')); }
    if (act === 'candy') {
      if (!(G.S.candy > 0) && !G.buyCandy()) return toast($t('하트가 모자라요 (꼬마 사탕 ♥{0})', B.candy.price), 2200, true);
      if (G.holdBaby(r.id)) { toast($t('{0}{은/는} 지금 모습 그대로 있어요', nm), 2400, true); return showBubble(r); }
    }
    if (act === 'grow' && G.letGrow(r.id)) { toast($t('다시 자라요 · 꼬마 사탕을 돌려받았어요'), 2400, true); return showBubble(r); }
    if (act === 'store' && G.store(r.id)) toast($t('{0}{을/를} 보관함에 넣었어요', nm));
    bubble.hidden = true; bubbleFor = null;
    if (act === 'walk') pickStroll(r);
  };
  const hint = () => { if (!G.S.flags.nestTapped) tip('nest', '#nestBtn'); }; // inbox 20: a first-time tip by the button (was a toast)
  // 꾸미기's red dot: a prop for this habitat not looked at yet (one added by an update; a new game has seen them all)
  const newProps = () => PROPS.filter(p => p.habitat === habId && !(G.S.seenProps || []).includes(p.id));
  // above the nest button: the soonest egg still hatching, and 「부화 시작」 (this habitat's eggs into every empty slot at once)
  pill.innerHTML = $t('<span class="pill" hidden></span><button class="back" hidden>부화 시작</button>');
  const [pillT, pillB] = pill.children;
  pillT.onclick = () => $('nestBtn').click(); // 26-11: people tap the words 「둥지를 눌러요」 / 「부화까지 4:57」 themselves
  pillB.onclick = () => {
    let n = 0; for (const e of [...(G.S.nests[habId]?.eggs || [])]) { if (!G.S.slots.includes(null)) break; if (G.takeEgg(habId, e.id) >= 0) n++; }
    if (n) { toast($t('알 {0}개를 부화 칸에 넣었어요', n), 2200, true); tip('hatch', '#nestBtn'); }
  };
  function drawPill() {
    const now = G.now(), run = G.S.slots.filter(s => s && now < s.end), eggs = G.S.nests[habId]?.eggs.length || 0;
    const soon = run.length && Math.min(...run.map(s => s.end - now)), fill = eggs > 0 && G.S.slots.includes(null);
    const done = G.S.slots.filter(s => s && now >= s.end).length; // C11: a finished egg said in words, not only the button's glow
    const n = G.S.nests[habId], next = !soon && !done && n && !eggs && n.t + eggGap(G.S) - now; // 27-7a: nothing to do -> when the next egg comes
    pillT.hidden = !soon && !done && !(next > 0); pillT.textContent = done ? $t('깨울 알 {0}개 · 둥지를 눌러요', done) : soon ? $t('부화까지 {0}', clock(soon)) : next > 0 ? $t('다음 알까지 {0}', clock(next)) : '';
    pillB.hidden = !fill; pill.hidden = pillT.hidden && !fill; redodge();
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
    hearts.lastChild.textContent = G.S.hearts - flying; // 66-1: the hearts still flying in are added as they land if (tagFor) drawTag();
    codexBtn.classList.toggle('new', hasNew()); $('storeBtn').classList.toggle('new', G.S.cards.some(c => c.new)); // 13-1 a postcard not seen
    if (habId) {
      const out = outIn(G.S, habId); friendsBtn.lastChild.textContent = `${out.length}/${capOf(G.S, habId)}`;
      friendsBtn.classList.toggle('new', out.some(a => a.card)); decorBtn.classList.toggle('new', newProps().length > 0); drawPill();
      if (out.some(a => a.stage === 'baby')) tip('grow', '#friendsBtn');
      if (out.length && !persisted) { persisted = true; navigator.storage?.persist?.()?.catch(() => {}); } // inbox 39: once a page, when there is something to keep
      if (out.length && !homeT && home.hidden && homeHintDue(DEV, G.S.flags)) { quiet = Date.now(); homeT = setTimeout(homeCard, 800); }
      if (out.length && !appT && appHintDue(DEV, G.S.flags)) { appQuiet = Date.now(); appT = setTimeout(appBand, 800); }
    }
    hab?.syncProps(G.S.props, G.S.paint?.[habId], G.S.ghost?.[habId], growStage(G.S.lv)); hab?.sync(G.withGuests()); // 16-1: and the guests; inbox 42 B: the props first, so no one comes out inside one
    hab?.syncWild?.(G.S.flags.wildOff ? null : G.S.wild.h[habId] ?? null, G.S.wild.d); // 17-3 정원이 숨 쉬어요
    hab?.setPals(G.S.flags.palOff ? null : new Map(G.S.pals.list.flatMap(p => [[p.a, p.b], [p.b, p.a]])), new Map(G.S.pals.list.flatMap(p => [[p.a, p.prop], [p.b, p.prop]]))); // 17-1 성격·단짝 (walk.js); 113 the prop each pair likes
  }

  function onTap(kind, rec, x, y, pt) {
    if (rec.wg) return showBubble(rec); // 66-1: a 떠돌이 손님 shows its wishes (no pat hearts)
    if (G.tapHeart(rec.id)) { // temporary heart rule (game/hearts.js); the tap that reaches the day's cap says so, once
      heart(x, y); if (G.S.pet.n >= B.heart.daily) toast($t('오늘 쓰다듬기 하트는 다 모았어요'), 2200, true);
    }
    showBubble(rec); if (++pats >= 2) tip('carry', bubble); // inbox 42 E: from the second tap on a friend, once
    // 69-2: pt { z, part } from habitat.js: its 좋아하는 곳 / 싫어하는 곳 (hearts the same either way); a baby: what it has learned so far
    const w = pt && PART_NAME[pt.part], g = rec.stage === 'baby' && growing(rec) ? GROW_ACTS.filter(a => gauge(rec, G.now()) >= a.at).pop() : null;
    const say = [w && (pt.z === 'like' ? $t('{0}{을/를} 쓰다듬어 주니 좋아해요', w) : $t('{0}{은/는} 싫은가 봐요', w)), g && $t('{0}을 배웠어요', g.name)].filter(Boolean);
    if (say.length) bubble.querySelector('.row')?.insertAdjacentHTML('beforebegin', say.map(s => `<small class="pat">${s}</small>`).join(''));
  }

  // the small card over an animal: its name; a baby also how far it has grown, 먹이 주기 (3 a day) and the 꼬마 사탕
  // (or 다시 자라기 when one holds it). Anyone can go to storage from here.
  function showBubble(r, say = '') {
    const now = G.now(), baby = r.stage === 'baby', n = feedsLeft(r, now), c = G.S.candy || 0;
    const btn = (act, text, sub) => `<button data-act="${act}"${sub ? ' class="sub"' : ''}>${text}</button>`;
    if (r.wg) bubble.innerHTML = guestHtml(r, say); else // 66-1
    if (r.guest) bubble.innerHTML = $t('{0}{1}<small>손님 · {2}시간 더 머물러요</small><div class="row">{3}</div>', say ? say + ' ' : '', guestName(r), Math.max(1, Math.ceil((r.until - now) / 3600e3)), btn('book', $t('방명록'), true)); else // 16-1
    bubble.innerHTML = `${say ? say + ' ' : ''}${nameOf(r)}${baby ? `<small>${growText(r, now)}</small>` : ''}<div class="row">${
      baby && growing(r) ? btn('feed', n ? $t('먹이 주기 {0}/{1}', n, B.grow.feeds) : $t('오늘 먹이 다 줬어요')) + btn('candy', $t('꼬마 사탕 주기 {0}', c ? $t('({0}개)', c) : `♥${B.candy.price}`), true) : ''}${
      r.hold ? btn('grow', $t('다시 자라기')) : ''}${btn('walk', $t('산책 보내기'), true)}${btn('store', $t('보관함에 넣기'), true)}</div>`;
    bubble.querySelector('[data-act=feed]')?.toggleAttribute('disabled', !n); bubble.hidden = false;
    const go = !bubbleFor; bubbleFor = r; bubbleUntil = Date.now() + 10000; if (press) press.re = true;
    if (go) requestAnimationFrame(place);
  }
  function place() {
    if (!bubbleFor) return;
    const p = hab?.where(bubbleFor.id), r = stage.getBoundingClientRect();
    if (!p || p[0] < r.left || p[0] > r.right || p[1] < r.top || p[1] > r.bottom || Date.now() > bubbleUntil && !held || overlayOpen() || document.querySelector('#lvup:not([hidden]), #ret:not([hidden]), #news:not([hidden])')) { bubble.hidden = true; bubbleFor = null; return; } // 26-11: a card coming up
    const cb = $('camBtns'), low = cb.hidden ? 0 : cb.getBoundingClientRect().bottom + bubble.offsetHeight + 16; // following up close: kept under 정면 / 전체 보기
    const half = bubble.offsetWidth / 2 + 6, x = Math.min(Math.max(p[0], r.left + half), r.right - half); // 13-1: kept on screen near the edges, the tail still at the friend
    bubble.style.left = x + 'px'; bubble.style.setProperty('--tx', p[0] - x + 'px'); bubble.style.top = Math.max(p[1], low) + 'px';
    requestAnimationFrame(place);
  }

  // what the game did (every tick, every action, and the catch-up at start)
  // 66-1 떠돌이 손님: its bubble (name, each wish with ✓ while it holds there, time left, what it leaves: shown before)
  const wishText = w => { const W = WISH[w] || {}; return `${W.icon ?? ''} ${W.riddle ? `「${W.riddle}」` : W.k === 'pals' ? $t('친구 {0}마리 곁', W.n) : W.k === 'theme' ? $t('「{0}」 {1} 한자리에', W.name, W.v.map(t => WISH[t].icon + t).join(' ')) : w}`; }; // 69-3 테마 소원
  function guestHtml(r, say = '') {
    const g = G.guestOf(r.wg); if (!g) return say || '';
    const R = rosterOf(g), J = G.guestMet(g), P = G.guestPreview(g), egg = P.egg && HAB[P.egg]?.name;
    return $t('{0}{1}<small>{2}손님 · {3}분 더 머물러요</small>{4}<ul class="gw">{5}{6}</ul><small>만족 ♥{7}{8}{9}{10}</small>', say ? say + ' ' : '', R.name, isRegular(G.S, g.k) ? $t('단골 ') : $t('떠돌이 '), Math.max(1, Math.ceil(g.on / 60e3)), g.big != null ? $t('<small class="big">큰 소원 {0}<b>●</b>{1} · 다 들어주면 여기 살아요</small>', '●'.repeat(g.big), '○'.repeat(GUEST.big - g.big - 1)) : '', g.w.map((w, i) => `<li${J?.met[i] ? ' class="ok"' : ''}>${J?.met[i] ? '✓' : '·'} ${wishText(w)}</li>`).join(''), g.b ? $t('<li class="bn{0}">{1} 덤 {2}</li>', J?.bonus ? ' ok' : '', J?.bonus ? '✓' : '+', wishText(g.b)) : '', P.hearts, P.great ? $t(' · 대만족 ♥{0}', P.great) : '', egg ? $t(' · {0} 알', egg) : '', P.gift ? $t(' · 선물 {0}%', Math.round(P.gift * 100)) : '');
  }
  // inbox 68 톡톡톡: the hearts fly from the guest into the counter, a 톡 and a short buzz as each lands, the number going up with them
  let flying = 0;
  function fly(from, n) {
    const to = hearts.getBoundingClientRect(), k = calm() ? 1 : Math.min(8, Math.max(3, Math.ceil(n / 2))), [x0, y0] = from || [innerWidth / 2, innerHeight / 2];
    flying += n; draw();
    for (let i = 0; i < k; i++) { const part = Math.floor(n * (i + 1) / k) - Math.floor(n * i / k), e = document.createElement('div');
      e.className = 'fx heart'; e.textContent = '♥'; Object.assign(e.style, { left: x0 + 'px', top: y0 + 'px', animation: 'none' }); document.body.append(e);
      const dx = to.left + to.width * 0.3 - x0, dy = to.top + to.height / 2 - y0, ms = calm() ? 0 : 620, d = calm() ? 0 : i * 90;
      const done = () => { e.remove(); flying -= part; draw(); hearts.classList.remove('pop'); void hearts.offsetWidth; hearts.classList.add('pop'); sfx('tok'); if (PREFS.buzz && !calm()) navigator.vibrate?.(8); };
      if (!ms) { done(); continue; }
      e.animate([{ transform: 'translate(-50%,-50%) scale(1.1)' }, { transform: `translate(calc(-50% + ${dx * 0.35 + (i % 2 ? 30 : -30)}px), calc(-50% + ${dy * 0.2 - 40}px)) scale(1.2)` }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)` }],
        { duration: ms, delay: d, easing: 'ease-in', fill: 'both' }).finished.then(done, done);
    }
  }
  const gName = e => { const R = rosterOf(e); return R ? R.name : $t('손님'); }, at = id => hab?.where('w' + id);
  function guestEv(e) {
    const nm = gName(e), here = !e.hab || e.hab === habId;
    if (e.what === 'arrive' && here) { const g = G.guestOf(e.id);
      if (e.pair != null && G.S.guests.list.some(o => o.pair === e.pair && o.id < e.id)) return; // the pair: one note for both
      const two = e.pair != null && G.S.guests.list.filter(o => o.pair === e.pair);
      toast(two ? $t('손님 둘이 함께 왔어요 · 둘의 소원이 서로 달라요. 눌러서 보상을 보고 골라 주세요') : $t('{0}{이/가} 놀러 왔어요 · 눌러서 소원을 들어 보세요', nm), 3200, true);
      if (g?.tut != null) setTimeout(() => { const r = G.withGuests().find(x => x.wg === e.id); if (r && hab?.look(r.id)) showBubble(r); }, 900); // the tutorial's guest: the camera goes to it
    }
    if (e.what === 'wish') fly(at(e.id), e.hearts); // a wish met for the first time: its small burst
    if (e.what === 'happy' || e.what === 'great') {
      const p = at(e.id), x = [];
      const egg = [e.egg?.slot != null ? $t('알을 부화 칸에 넣었어요') : e.egg?.nest ? $t('{0} 둥지에 알을 두고 갔어요', HAB[e.egg.hab]?.name ?? '') : e.egg?.hearts && $t('알 대신 ♥+{0}', e.egg.hearts), e.slot != null && e.slot >= 0 && $t('부화가 빨라졌어요')].filter(Boolean);
      if (egg.length) x.push(egg.join(' · '));
      if (e.gift?.prop) x.push($t('선물 「{0}」 · 꾸미기 › {1}', PROPS.find(P => P.id === e.gift.prop)?.name ?? '', tabName(e.gift.prop))); else if (e.gift?.hearts) x.push($t('선물 ♥+{0}', e.gift.hearts));
      if (e.memo?.prop) x.push($t('기념 소품 「{0}」 · 꾸미기 › {1}', PROPS.find(P => P.id === e.memo.prop)?.name ?? '', tabName(e.memo.prop))); else if (e.memo?.hearts) x.push($t('기념 ♥+{0}', e.memo.hearts)); // 69-3
      say($t('{0}{1}{이/가} 기뻐해요{2}', e.what === 'great' ? $t('대만족! ') : '', nm, e.hearts ? ` · ♥+${e.hearts}` : '')); x.forEach(t => say(t)); // 102: one news a line, in turn (they came glued in one)
      fly(p, e.hearts + (e.egg?.hearts || 0) + (e.gift?.hearts || 0) + (e.memo?.hearts || 0)); if (e.what === 'great') sfx('grown');
      if (bubbleFor?.wg === e.id) { bubble.hidden = true; bubbleFor = null; }
    }
    if (e.what === 'bye' && hab) { toast($t('{0}: 「다음에 또 올게」', nm), 2400, true); if (bubbleFor?.wg === e.id) { bubble.hidden = true; bubbleFor = null; } }
    if (e.what === 'free') { const P = PROPS.find(p => p.id === e.prop); G.flag('ui:decorBtn'); decorBtn.classList.add('newly'); setTimeout(() => decorBtn.classList.remove('newly'), 4200);
      toast($t('「{0}」{을/를} 받았어요 · 꾸미기 › {1}에서 꺼내 손님 곁에 놓아 주세요', P?.name ?? '', tabName(e.prop)), 4200, true); }
    // 66-2 단골 · 큰 소원 · 정착 (after the 기뻐해요 toast: the next one waits for it)
    const later = (ms, f) => setTimeout(f, ms);
    if (e.what === 'arrive' && here && e.big != null) later(3300, () => say($t('{0}{이/가} 큰 소원을 들고 왔어요 ({1}/{2}) · 눌러서 보세요', nm, e.big + 1, GUEST.big), 3600));
    if (e.what === 'regular') later(3700, () => say($t('{0}{이/가} 단골이 됐어요 · 다음에 오면 큰 소원을 말해 줄 거예요', nm), 4200));
    if (e.what === 'step' && e.s < e.n) later(3700, () => say($t('큰 소원 {0}/{1} · {2}: 「내일 또 올게」', e.s, e.n, nm), 3600));
    if (e.what === 'settle') later(3700, () => { say($t('{0}{이/가} 여기 살기로 했어요 · 떠돌이 친구{1}', nm, e.stored ? $t(' · 자리가 없어 보관함에 있어요') : ''), 4800); sfx('level'); });
    if (e.what === 'dayEnd' && hab) dusk(e.k); // 69-3 하루 마무리
    if (e.what === 'hello') toast($t('떠돌이 손님이 찾아오기 시작했어요 · 소원을 들어주면 하트와 알을 두고 가요'), 4200, true);
    if (e.what === 'tutDone') { const R = e.night && rosterOf({ k: e.night }); toast(R ? $t('오늘 밤 손님 · 「{0}」{이/가} 올지도 몰라요', R.name) : $t('손님맞이를 다 익혔어요 · 이제 손님이 가끔 찾아와요'), 4200, true); }
  }

  // 69-3 하루 마무리: the day's guests are done. A short sunset over the habitat (no button: it fades by itself, taps go through)
  // and tomorrow's first guest as a shadow (its 보따리 or 모자 shows who)
  function dusk(k) {
    const R = k && rosterOf({ k }), el = document.createElement('div'); el.className = 'dusk';
    el.innerHTML = $t('<p>오늘 손님은 여기까지예요</p>{0}', R ? $t('<img alt=""><small>내일은 누가 올까요?</small>') : '');
    stage.append(el); if (R) silhouetteThumb(R.sp, guestWear(R), false, 0).then(u => { const i = el.querySelector('img'); if (i) i.src = u; });
    setTimeout(() => el.remove(), calm() ? 5000 : 7000);
  }
  function events(ev) {
    for (const e of ev) if (e.type === 'guest') guestEv(e); // before draw: a guest just gone is still there to fly from
    draw();
    if (bubbleFor?.wg && !bubble.hidden) bubble.innerHTML = guestHtml(bubbleFor); // its ✓ as things move
    if (bubbleFor && ev.some(e => e.type === 'grown' && e.animal.id === bubbleFor.id)) showBubble(bubbleFor); // grown up: says its name
    const grown = ev.filter(e => e.type === 'grown').map(e => e.animal);
    if (grown.length && hab) setTimeout(cards, 2200); // after the growing (figure.js: about 1.5 s), the "다 자랐어요" card
    else if (ev.some(e => e.type === 'pal') && hab) setTimeout(cards, 1200); // 17-1 단짝 card
    const eggs = ev.filter(e => e.type === 'egg').length;
    if (eggs && hab) toast(eggs > 1 ? $t('둥지에 알이 {0}개 생겼어요', eggs) : $t('둥지에 알이 생겼어요'));
    for (const e of ev) { // later ones matter more: they win the toast
      if (e.type === 'stored') toast($t('서식지 자리가 모자라 오래된 친구가 보관함으로 갔어요 (최대 {0}마리)', capOf(G.S, habitatOf(e.animal))), 3200);
      if (e.type === 'unlock') { toast($t('{0}의 잠금이 풀렸어요! 위의 서식지 이름을 눌러 월드맵에서 가 보세요', HAB[e.habitat].name), 3200); tip('unlock', '#habName'); }
      if (e.type === 'strollBack' && hab) { const a = e.animal, nm = nameOf(a); if (!a.stored && habitatOf(a) === habId) hab.drop(a); toast($t('{0}{이/가} 산책에서 돌아왔어요 · ♥+{1}{2}', nm, e.card.hearts, a.stored ? $t(' · 자리가 없어 보관함에 있어요') : ''), 3000); } // 13-1
      if (e.type === 'whole') { const r = e.reward; toast($t('{0} 모으기 {1}/3 선물: {2}', HAB[e.habitat].name, e.step, r === 'expand' ? $t('다음 땅 넓히기가 무료예요') : $t('큰 소품 「{0}」{이/가} 보관함에 왔어요', PROP[r]?.name)), 3600); } // 66-3
      if (e.type === 'reset' && hab) { bubble.hidden = true; bubbleFor = null; hint(); }
    }
  }
  G.on(events);

  // "○○가 다 자랐어요!": every grown animal whose card wasn't seen (several at once after time away), baby and adult side by side
  const card = $('grown'); let later = 0;
  const covered = () => overlayOpen() || document.querySelector('#lvup:not([hidden]), #ret:not([hidden]), #news:not([hidden]), .tip') || document.body.classList.contains('photo'); // 66-1: a guest lands once none is up
  const busy = () => covered() || resting(); // inbox 43
  function cards() {
    if (!hab || !card.hidden) return;
    const list = G.S.animals.filter(a => a.card), pal = !list.length && !G.S.flags.palOff && G.S.pals.list.find(p => p.new); if (!list.length && !pal) return;
    // 27-7c: the nest (opened by 자리 비운 사이's egg row), another card or a tip in the way: wait for it (was dropped until the next visit)
    if (busy()) { clearTimeout(later); later = setTimeout(cards, 800); return; }
    if (pal) { // 17-1 "○○와 ○○가 단짝이 되었어요!" (after the grown cards)
      const [a, b] = [pal.a, pal.b].map(id => G.S.animals.find(x => x.id === id)), na = nameOf(a), nb = nameOf(b);
      card.innerHTML = $t('<div><h2>{0}{과/와} {1}{이/가} 단짝이 되었어요!</h2><p class="pair"><img alt="{2}"><span>♥</span><img alt="{3}"></p><p class="sub">{4} · {5} · 나란히 걷고, 같이 낮잠 자고, 시소도 같이 타요</p>{6}<button data-close>좋아요</button></div>', na, nb, na, nb, PE[a.pe].name, PE[b.pe].name, PROP[pal.prop] ? $t('<p class="sub">둘 다 {0}{을/를} 좋아해요</p>', PROP[pal.prop].name) : '');
      card.querySelectorAll('.pair img').forEach((m, i) => { const x = [a, b][i]; figureThumb(x.species, x.variant, x.color, x.acc, x.stage).then(u => { m.src = u; }); });
      card.querySelector('button').onclick = () => { card.hidden = true; G.palSeen(); };
      card.hidden = false; sfx('grown'); return;
    }
    const one = list.length === 1, nm = one && nameOf(list[0]), more = list.length - 4;
    card.innerHTML = $t('<div><h2>{0}</h2>{1}{2}{3}<button data-close>좋아요</button></div>', one ? $t('{0}{이/가} 다 자랐어요!', nm) : $t('친구 {0}마리가 다 자랐어요!', list.length), list.slice(0, 4).map(a => $t('<p class="pair"><img class="b" alt="새끼"><span>→</span><img alt="성체"></p>')).join(''), more > 0 ? $t('<p>그리고 {0}마리 더</p>', more) : '', one ? '' : $t('<p class="sub">자란 모습은 도감에서도 볼 수 있어요</p>'));
    card.querySelectorAll('.pair').forEach((p, i) => { const a = list[i], [b, c] = p.querySelectorAll('img');
      figureThumb(a.species, a.variant, a.color, a.acc, 'baby').then(u => { b.src = u; }); figureThumb(a.species, a.variant, a.color, a.acc, 'adult').then(u => { c.src = u; }); });
    card.querySelector('button').onclick = () => { card.hidden = true; G.grownSeen(list.map(a => a.id)); setTimeout(cards, 600); }; // 17-1: then a 단짝 card, if one waits
    card.hidden = false; sfx('grown');
  }

  // inbox 39: iPhone·iPad Safari can clear the save after 7 days away (a home-screen app is spared). Once a friend is out, one card says so:
  // it waits like cards() and for 2 s with nothing else up (after the grow tip come the level card and its tip). 알겠어요 = not again.
  const home = $('homeHint'); let homeT = 0, quiet = 0, persisted = false;
  function homeCard() {
    homeT = 0; if (!hab || !home.hidden || !homeHintDue(DEV, G.S.flags)) return;
    if (busy() || G.S.guests?.tut >= 0 || G.now() - G.S.since < 300e3) quiet = Date.now(); // 66-1: not in the first 5 minutes (the guest tutorial)
    if (Date.now() - quiet < 2000) { homeT = setTimeout(homeCard, 800); return; }
    home.hidden = false;
  }
  // inbox 64-A: in an Instagram·Threads in-app browser, once after the first friend: a band to carry the save to Safari·Chrome
  let appT = 0, appQuiet = 0;
  function appBand() {
    if (!hab || !appHintDue(DEV, G.S.flags)) return void (appT = 0);
    if (overlayOpen() || document.querySelector('#lvup:not([hidden]), #ret:not([hidden]), #news:not([hidden]), .tip, #toast.on') || document.body.classList.contains('photo') || !home.hidden) appQuiet = Date.now(); // busy() but not the quiet rest: the save is at stake
    if (Date.now() - appQuiet < 2000) { appT = setTimeout(appBand, 800); return; }
    G.flag('appHintSeen'); track('webview_hint'); // 93-3
    const bar = Object.assign(document.createElement('div'), { className: 'rate appband', role: 'group' }); bar.setAttribute('aria-label', $t('다른 브라우저에서 이어서 하기'));
    bar.innerHTML = DEV.framed && !inApp(DEV.ua) // inbox 107: in another site's frame (와플)
      ? $t('<span>다른 사이트 화면 안에서 열렸어요. 여기서 한 저장은 toybrook.github.io에서 바로 연 저장과 따로이고, 아이폰은 한동안 안 들어오면 지워질 수 있어요. 설정 › 내 저장 백업으로 백업 코드를 만들어 두세요.</span><a class="more" data-a="tab" href="https://toybrook.github.io/play/" target="_blank" rel="noopener">새 창으로 열기</a><button class="x" aria-label="닫기">✕</button>')
      : $t('<span>{0} 안에서는 저장이 사라질 수 있어요 · 브라우저로 이어 하기</span><button data-a="copy">이어서 하기 링크 복사</button>{1}<button class="x" aria-label="닫기">✕</button>', /Instagram/.test(DEV.ua) ? $t('인스타') : $t('앱'), /Android/.test(DEV.ua) ? $t('<a class="more" data-a="chrome" href="{0}">Chrome으로 열기</a>', chromeLink()) : '');
    document.body.append(bar); setTimeout(() => bar.remove(), 60e3); // the tips wait under it (hud.js)
    bar.onclick = async e => { const b = e.target.closest('button,a'); if (!b) return; if (b.dataset.a) track('webview_move', { by: b.dataset.a });
      if (b.dataset.a === 'copy') { const ok = await copyLink(); bar.remove(); if (ok) toast(/iPhone|iPad/.test(DEV.ua) ? $t('링크를 복사했어요 · 사파리 주소창에 붙여 넣어 열어 주세요') : $t('링크를 복사했어요 · Chrome 주소창에 붙여 넣어 열어 주세요'), 4000, true); }
      else setTimeout(() => bar.remove()); };
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
    if (h) toast($t('새 놀이 장면 「{0}」{1} · 도감에 담았어요 ♥+{2}', list[0].name, list.length > 1 ? $t(' 외 {0}개', list.length - 1) : '', h), 2800, true); };
  function scene(e, quiet) {
    if (!hab || document.hidden) return; const list = scenesOf(e).filter(s => !G.S.scenes[s.id]); if (!list.length) return;
    const r = e.who?.[0]?.rec, p = r && hab.where(r.id), W = innerWidth, H = innerHeight;
    if (p && p[0] > 8 && p[0] < W - 8 && p[1] > 70 && p[1] < H - 90 && !overlayOpen()) return got(list, r);
    if (quiet || !r || overlayOpen() || Date.now() - noteAt < 60e3) return;
    noteAt = Date.now(); const right = !p || p[0] >= W / 2;
    note.innerHTML = $t('✨ 저쪽에서 새 놀이 장면!<small>눌러서 보러 가기</small>'); note.className = 'back scnote ' + (right ? 'r' : 'l');
    note.style.top = Math.min(Math.max(p ? p[1] : H / 2, 150), H - 260) + 'px'; note.hidden = false;
    clearTimeout(noteT); noteT = setTimeout(hideNote, 8000);
    note.onclick = () => { hideNote(); if (hab?.look(r.id)) got(list, r); };
  }

  // 69-1: held up (habitat.js carry), its name and the 출생 기록 한 줄 over it (no buttons: the finger is busy); let go, it stays a moment
  function onCarry(r) {
    if (r.wg || r.guest) return; // a visitor: not born here
    const line = birthLine(r); bubble.innerHTML = `${nameOf(r)}${line ? `<small>${line}</small>` : ''}`; bubble.hidden = false;
    const go = !bubbleFor; bubbleFor = r; held = true; if (press) press.re = true;
    if (go) requestAnimationFrame(place);
  }
  const onLetGo = r => { if (held && bubbleFor === r) bubbleUntil = Date.now() + 2500; held = false; };

  // 113 단짝 놀이 (habitat.js ctx.onDuo): the two together on the prop they like: the hearts (the first time ♥20, then a few once a day)
  function duo(a, b, kind) {
    const h = G.palPlay(a, b); if (!h || !hab) return; const [na, nb] = [a, b].map(id => nameOf(G.S.animals.find(r => r.id === id))), P = PROP[kind]?.name ?? '';
    toast($t('{0}{과/와} {1}{이/가} {2}에서 함께 놀아요 ♥+{3}', na, nb, P, h), 2800, true); fly(hab.where(a), h);
  }
  return {
    onTap, events, scene, duo, onPropTap, onEdit, onPaint, onSweep, onCarry, onLetGo,
    tag(text, rec) { tagText = text; tagFor = rec || null; drawTag(); },
    attach(api, id) { hab = api; habId = id; nest.attach(api, id);
      G.guestWorld({ look: (h, x, z, r) => h === habId && hab ? hab.guestLook(x, z, r) : {}, entry: (h, from, rng, want, show) => covered() || !hab ? null : hab.guestEntry(from, rng, want, show), pos: id => hab?.guestPos(id) }, () => hab ? hab.guestEnv() : {}); // 66-1
      draw(); hint(); setTimeout(cards, 1200); }, // grown while away: the cards together
    openNest: () => nest.open(), cards, firstEgg: (id, done, onCard) => nest.first(id, done, onCard), // inbox 61 B
    leave() { G.guestWorld(null); leaveDecor(); leaveStore(); leaveFriends(); hab = null; nest.leave(); hideNote(); bubble.hidden = true; bubbleFor = null; card.hidden = home.hidden = true; clearTimeout(homeT); homeT = 0; hideToast(); },
  };
}
