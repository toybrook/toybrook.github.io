// 182 ② the 181 A tutorial (?tut181 only: main.js imports this then; docs/tutorial.md, reports/182t.md). It rides on the 170 first
// day (first170.js keeps the naming and end cards): one place lit at a time (a hole in a dim layer that takes no taps, so a tap
// anywhere still does what it always does), a finger, a bubble with 건너뛰기. The steps come from rules step181; the save keeps the
// step in flags.tut181 (decor's 7 cells start over after a reload). Later, once each: map (a second habitat open) and aff (정 Lv2).
// 설정 › 튜토리얼 다시 보기 shows pet·feed·decor·codex(·map)·aff again without giving or taking anything (flags.tut181 'again').
// Text in: textContent only (a friend's name comes from the save). Nothing three.js is made here; stop() takes it all down.
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import * as R from '../game/rules.js';
import { HABITATS } from '../game/data.js';
import { toast, topWindow } from './hud.js';
import { track } from './stats.js';
let tabOf = () => ''; // decor.js's, fetched at the decor step: a static import pulled the 3D code and held the first light ~6.5 s on slow 4G

const $ = id => document.getElementById(id), body = document.body, q = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls }, text != null ? { textContent: text } : {});
const vis = e => !!e && e.getClientRects().length > 0 && !e.closest('[hidden], .hidden');
const nm = a => a.nm || R.SP[a.species]?.name || R.kindName(a);
const PNAME = id => R.PROP[id]?.name ?? '';
const box = el('div', ''), hole = el('i', 'hole'), fing = el('i', 'finger'), say = el('div', 'tutsay'), p1 = el('p', ''), p2 = el('small', ''), skip = el('button', 'tutskip', $t('건너뛰기'));
box.id = 'tut'; box.hidden = true;
// the finger: our own fixed drawing (no file to fetch, nothing from outside in it); its tip is at (16, 1)
fing.innerHTML = '<svg viewBox="0 0 40 48" width="40" height="48"><path d="M12 5a4 4 0 0 1 8 0v15l2.5-.8a4 4 0 0 1 4.8 2.3l.6 1.4 1.8-.4a4 4 0 0 1 4.8 3.2V35c0 6.6-5 11-12 11h-2.5c-4.6 0-7.6-2.4-9.6-6.4L5 30.5a3.4 3.4 0 0 1 5.4-4L12 28z" fill="#fffaf0" stroke="#4a3626" stroke-width="2.4" stroke-linejoin="round"/></svg>'; say.append(p1, p2, skip); box.append(hole, fing, say);

const STEP = 250, AUTO = 25e3, LATE = 30e3; // the loop; a decor cell (drag·turn·move) passes itself after 25 s, map·aff after 30 s
const DFULL = ['d_open', 'd_pick', 'd_drag', 'd_turn', 'd_put', 'd_move', 'd_done'], DSHORT = ['d_open', 'd_move', 'd_turn', 'd_put', 'd_done']; // §2-4: one placed already
let getCur = () => null, getApi = () => null, iv = 0, raf = 0, plan = null, key, mode = 'main', AG = [], ai = 0, late = null, lateT = 0, lateB = true, auto = new Set();
let seen = null, path = DFULL, sub = null, subT = 0, mk = {}, n0 = 0, backs = 0, waitAt = 0, shook = false;

const hab2 = S => HABITATS.find((h, i) => i > 0 && h.ready && R.unlockInfo(S, h.id).open)?.id; // the second habitat, once open
const affDue = S => S.animals.some(a => !a.pending && R.affLevel(a, G.now()) >= 2);
const placedHere = S => S.props.filter(p => p.placed && !p.nat && p.hab === getCur() && !R.PROP[p.prop]?.art);
const stowedHere = S => S.props.filter(p => !p.placed && !p.nat && p.hab === getCur()).sort((a, b) => (b.prop === 'tulips') - (a.prop === 'tulips'));
// a guest of 66-1 coming (its camera, its toast): the tutorial waits, 6 s either side (170's rule, from its first hatch on)
const arriving = () => { const Q = G.S.guests; return Q?.tut >= 0 && Q.tt > 0 && Math.abs(G.now() - Q.tt) < 6e3; };
// may it show over this target now: no window over it (a target inside the open window is fine), not the photo mode, not loading
function clear(t, inBox) {
  if (document.hidden || body.classList.contains('photo') || !t && $('habitat').classList.contains('hidden')) return false;
  const top = topWindow('.tip') ?? q('#habitat > section:not([hidden])'), L = $('loading'); // the loading screen is under every window
  if (top) return t ? top.contains(t) : top === inBox;
  return L.hidden || !!t && L.contains(t);
}

function tick() {
  const S = G.S; if (!S) return;
  const v = S.flags.tut181, now = G.now();
  if (v === 'skip' || v === 'done' && !late && S.flags.tutMap && S.flags.tutAff) return stop();
  let k, P = null;
  if (v === 'again') { k = AG[ai]; if (!k) { G.flag('tut181', 'done'); return stop(); } }
  else {
    k = R.step181(S, now);
    if (k === 'name' && R.step170(S, now) !== 'name') { auto.add('name'); G.flag('tut181', 'pet'); return; } // an older save past 170's days: no naming card comes
    if (k && v !== k) G.flag('tut181', k); // the step, kept for a reload (rules step181 never goes back before it)
    if (!k && v !== 'done') G.flag('tut181', 'done');
  }
  if (k !== key) { if (mode === 'main' && key) passed(key, k); key = k; enter(k); }
  const busy = arriving();
  if (!busy) P = k ? plan181(S, k, now) : null;
  // map·aff: when the first day's steps are done, or in the nest's wait (Q7)
  if (!busy && mode === 'main' && (!k || k === 'nest' && P?.wait)) {
    if (!late) { late = !S.flags.tutMap && hab2(S) ? 'map' : !S.flags.tutAff && affDue(S) ? 'aff' : null; lateT = 0; lateB = true; }
    if (late) { P = lateP(S, late); if (P.done) { lateEnd(0); P = null; } }
  }
  // map·aff pass themselves after 30 s on screen (n:1)
  if (show(P) && (late || k === 'map' || k === 'aff') && (lateT += STEP) >= LATE) { if (late) lateEnd(1); else next(); }
}
function lateEnd(n) { G.flag(late === 'map' ? 'tutMap' : 'tutAff', 1); track('tut', n ? { s: late, n: 1 } : { s: late }, 'tut:' + late); late = null; }

function passed(was, now) { // the steps passed since the last tick: `was` done by hand (unless it passed itself), any between passed themselves
  const i = R.STEPS181.indexOf(was), j = now ? R.STEPS181.indexOf(now) : R.STEPS181.length;
  for (let x = i; x < j; x++) { const s = R.STEPS181[x]; track('tut', x > i || auto.has(s) ? { s, n: 1 } : { s }, 'tut:' + s); }
}
function enter(k) {
  sub = null; mk = {}; shook = false; const S = G.S, a = R.firstFriend(S);
  if (k === 'decor') { import('./decor.js').then(m => { tabOf = m.tabOf; }); if (!S.flags['ui:decorBtn']) G.flag('ui:decorBtn'); const short = placedHere(S).length > 0; path = short ? DSHORT : DFULL; if (!short && mode === 'main') G.tutGift(getCur() || HABITATS[0].id); dGo('d_open'); }
  if (k === 'codex' && !S.flags['ui:codexBtn']) G.flag('ui:codexBtn');
  if (k === 'pet' || k === 'aff') mk = { pet: S.stats.pet || 0, bub: vis($('bubble')) };
  if (k === 'feed') mk = { feed: S.stats.feed || 0, a };
  if (k === 'map' || k === 'aff') { lateT = 0; lateB = true; }
}
const next = () => { if (mode === 'again') ai++; };

// ---- each step: what to light, what to say, when it is done (main steps are done by rules step181; replayed ones here)
function plan181(S, k, now) {
  const a = R.firstFriend(S), api = getApi(), at = id => () => { const p = api?.where(id); return p && [p[0], p[1] + 34]; };
  if (k === 'hatch') {
    const L = $('loading'), lf = q('.lfirst', L), go = q('#ncard [data-go]'), rd = q('#nslots .nslot.ready');
    const t = vis(go) ? go : vis(rd) ? rd : vis(lf) ? lf : !L.hidden && vis(q('.lbar', L)) ? q('.lbar', L) : vis($('nest')) ? (S.slots.some(Boolean) ? null : q('#neggs .negg[data-id]')) : $('nestBtn');
    return { t, text: t === go ? '' : $t('알을 톡 눌러 깨워요'), fing: 'tap' }; // 서식지로 보내기: the button says it
  }
  if (k === 'end') { const go = q('#ncard [data-go]'); return vis(go) ? { t: go, text: '', fing: 'tap' } : null; } // the 3rd egg's card still open; then 170's end card
  if (!a) return null;
  if (k === 'name') { const c = $('n170'), i = q('input.fname', c); return vis(i) ? { t: i.value.trim() ? q('button.go', c) : i, text: $t('{0}에게 이름을 지어 줘요', nm(a)), fing: 'tap', near: c } : null; }
  if (k === 'pet' || k === 'aff') {
    if (k === 'pet' && mode === 'again' && ((S.stats.pet || 0) > mk.pet || vis($('bubble')) && !mk.bub)) return next(), null;
    if (!vis($('bubble'))) mk.bub = false;
    const f = k === 'aff' ? S.animals.find(x => !x.pending && !x.stored && R.affLevel(x, now) >= 2) ?? a : a;
    return { pt: at(f.id), r: 60, text: k === 'aff' ? $t('자주 놀아 주면 정이 깊어져요') : $t('{0}{을/를} 톡 눌러 쓰다듬어요', nm(f)), fing: 'tap' };
  }
  if (k === 'feed') {
    if (mode === 'again' && ((S.stats.feed || 0) > mk.feed || !R.growing(a) || !R.feedsLeft(a, now))) return next(), null;
    const b = q('#bubble [data-act=feed]');
    return vis(b) && !b.disabled ? { t: b, text: $t('먹이도 한 번 줘 볼까요?'), fing: 'tap' } : { pt: at(a.id), r: 60, text: $t('먹이도 한 번 줘 볼까요?'), fing: 'tap' };
  }
  if (k === 'decor') return decor(S, api, now);
  if (k === 'codex') {
    const c = $('codex');
    if (vis(c)) { mk.open ??= now; const cell = q(`.cell[data-k="${a.species}:${a.variant}"]`, c) ?? q('.cell[data-k]:not(.unk)', c);
      return { t: now - mk.open < 3e3 && cell ? cell : q('.cdet [data-shut]', c) ?? q('[data-close]', c), text: $t('만난 친구는 도감에 모여요'), fing: 'tap' }; }
    if (mk.open) { if (mode === 'again') next(); else G.flag('tut181', 'nest'); return null; }
    return { t: $('codexBtn'), text: $t('만난 친구는 도감에 모여요'), fing: 'tap' };
  }
  if (k === 'nest') {
    const go = q('#ncard [data-go]'), rd = q('#nslots .nslot.ready');
    if (vis(go) || rd) return { t: vis(go) ? go : vis(rd) ? rd : $('nestBtn'), text: vis(go) ? '' : $t('알을 톡 눌러 깨워요'), fing: 'tap' }; // the 2nd and 3rd eggs (step181 waits for 3 hatched)
    if (S.slots.some(Boolean)) { waitAt ||= now; return now - waitAt < 5e3 ? { t: null, text: $t('깨는 동안 꾸며 봐요'), wait: 1, near: $('nestPill') } : { wait: 1, none: 1 }; } // then it leaves them be
    waitAt = 0; const e = q('#neggs .negg[data-id]');
    return { t: vis($('nest')) ? e : $('nestBtn'), text: $t('다음 알을 둥지에 넣어요'), fing: 'tap' };
  }
  if (k === 'map' || k === 'aff') { const L = lateP(S, k); if (L.done) { next(); return null; } return L; }
  return null;
}
function lateP(S, k) {
  if (k === 'aff') { const b = vis($('bubble')); if (!b) lateB = false; else if (!lateB) return { done: 1 }; return plan181(S, 'aff', G.now()); } // its bubble (정 줄) opened after it was lit (not the one open as the level came)
  const h = hab2(S); if (!h || getCur() === h) return { done: 1 };
  return { t: getCur() ? $('habName') : q(`.spot[data-hab="${h}"]`), text: $t('새 서식지가 열렸어요 · 가 볼까요?'), fing: 'tap' };
}

// ---- decor, 7 cells (§2): each lit in turn; a slip goes back a cell, never blocks
function dGo(s) { sub = s; subT = 0; shook = false; const h = getApi()?.decor.holding(), S = G.S; mk = { n: R.FIRST_V.prop(S), h, rot: h?.rot, x: h?.x, z: h?.z, miss: mk.miss || 0, red: 0 }; if (s === 'd_move') mk.uid = placedHere(S).at(-1)?.uid; }
function dNext() { const i = path.indexOf(sub); if (i < path.length - 1) dGo(path[i + 1]); }
function dEnd() { sub = null; if (mode === 'again') next(); else G.flag('tut181', 'codex'); } // the save's step: decor is done
function decor(S, api, now) {
  const D = $('decor'), open = vis(D), h = api?.decor.holding() ?? null, n = R.FIRST_V.prop(S), dec = 1, inBox = D;
  if (!sub) dGo('d_open');
  if (sub !== 'd_open' && !open) { if (path.indexOf(sub) > path.indexOf('d_put') || sub === 'd_put' && mk.at || n > n0) dEnd(); else dGo('d_open'); return null; } // closed before 놓기: from the start
  const red = $t('빨간 곳엔 못 놓아요 · 초록이 되게 옮겨요'), putT = h?.ok ? $t('마음에 들면 놓기!') : red, putB = h?.ok ? q('[data-place]', D) : q('[data-room]', D) ?? q('[data-place]', D);
  const back = () => { if (n > mk.n) return dGo(path === DFULL ? 'd_move' : 'd_done'); backs++; dGo(path === DFULL ? 'd_pick' : 'd_move'); }; // put down (취소·넣기): pick again; placed early: on to moving it
  // 25 s in a cell: drag·turn·move pass (decor counted n:1), pick·put shake the bubble once (they are what the step is for)
  const timed = s => { if (body.classList.contains('pdrag') || (subT += STEP) < AUTO) return false; if (s) { auto.add('decor'); return true; } if (!shook) { shook = true; say.classList.remove('shake'); void say.offsetWidth; say.classList.add('shake'); } return false; };
  switch (sub) {
    case 'd_open': if (open) { n0 = n; dNext(); return null; } return { t: $('decorBtn'), text: path === DFULL ? $t('받은 소품으로 꾸며 볼까요?') : $t('놓은 것도 톡 누르면 다시 옮겨요'), fing: 'tap' };
    case 'd_pick': {
      if (h) { dNext(); return null; } timed(false);
      const p = stowedHere(S)[0], b = p && q(`.dprop[data-p="${p.prop}"]`, D);
      return { t: vis(b) ? b : p ? q(`.dtabs [data-tab="${tabOf({ id: p.prop })}"]`, D) : null, text: backs > 1 ? '' : p ? $t('{0}{을/를} 눌러 꺼내요', PNAME(p.prop)) : $t('소품을 하나 골라요'), fing: 'tap', dec, inBox };
    }
    case 'd_drag': {
      if (!h) { back(); return null; } const drag = body.classList.contains('pdrag'); if (drag) mk.red = 1;
      if (Math.hypot(h.x - mk.x, h.z - mk.z) > 0.6 && h.ok && !drag) { dNext(); return null; }
      if (timed(true)) { dNext(); return null; }
      return { pt: () => api.decor.screen(), r: 70 * (mk.miss >= 2 ? 1.3 : 1), text: !drag && mk.red && !h.ok ? red : $t('손가락으로 끌어서 옮겨요'), text2: mk.miss >= 2 ? $t('{0} 위에 손가락을 대고 끌어요', PNAME(S.props.find(p => p.uid === h.uid)?.prop)) : '', fing: drag ? '' : 'drag', dec, inBox };
    }
    case 'd_turn': if (!h) { back(); return null; } if (h.rot !== mk.rot || timed(true)) { dNext(); return null; }
      return { t: q('[data-rot="90"]', D), text: $t('돌리기 버튼으로 방향을 바꿔요'), text2: $t('⟳15°를 길게 누르면 조금씩 돌아요'), fing: 'tap', dec, inBox };
    case 'd_put': if (mk.at || !h && S.props.find(p => p.uid === mk.h?.uid)?.placed) { mk.at ??= now; if (now - mk.at >= 2e3) dNext(); return null; } // put (or moved, the short way); the friends come to look (decor.cheer) first
      if (!h) { back(); return null; } timed(false); return { t: putB, text: putT, fing: 'tap', dec, inBox };
    case 'd_move': {
      if (h) { mk.held = 1; if (path === DSHORT) { dNext(); return null; } } else if (mk.held) { dNext(); return null; }
      if (timed(true) || !h && mk.uid != null && !api.decor.screen(mk.uid) && (mk.off = (mk.off || 0) + STEP) >= 3e3) { auto.add('decor'); dNext(); return null; } // placed off the screen's edge: nothing to point at, on after 3 s
      return h ? { t: putB, text: putT, fing: 'tap', dec, inBox } : { pt: () => mk.uid != null ? api.decor.screen(mk.uid) : null, r: 60, text: $t('놓은 것도 톡 누르면 다시 옮겨요'), fing: 'tap', dec, inBox };
    }
    case 'd_done': return { t: q('[data-done]', D), text: $t('다 꾸몄으면 완료를 눌러요'), fing: 'tap', dec, inBox };
  }
  return null;
}

// ---- the layer: shown when its target may be (clear), the hole and finger follow it each frame while shown
function show(P) { // true: shown
  const on = !!P && !P.none && clear(P.t ?? null, P.inBox) && (P.t !== undefined && P.t !== null ? vis(P.t) : true);
  body.classList.toggle('tut181', on); body.dataset.tut = on ? sub || key || late || '' : ''; // hidden: stats see the real screen
  if (!on) { plan = null; box.hidden = true; cancelAnimationFrame(raf); raf = 0; return false; }
  plan = P; box.hidden = false; p1.textContent = P.text || ''; p1.hidden = !P.text; p2.textContent = P.text2 || ''; p2.hidden = !P.text2; say.hidden = !P.text && !P.text2; // no words (서식지로 보내기): the hole and finger only, the card's own lines stay readable
  if (!raf) raf = requestAnimationFrame(frame);
  return true;
}
function frame() {
  raf = 0; const P = plan; if (!P) return; raf = requestAnimationFrame(frame);
  let c = null; // [x, y, w, h, round]
  if (P.t && P.t !== seen) { seen = P.t; const r = P.t.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) P.t.scrollIntoView({ block: 'nearest' }); } // a cell below the panel's fold (the stowed 튤립): brought up once
  if (P.t) { const r = P.t.getBoundingClientRect(); if (r.width) c = [r.left + r.width / 2, r.top + r.height / 2, r.width + 12, r.height + 12, 0]; }
  else if (P.pt) { const p = P.pt(); if (p && p[0] >= 0 && p[1] >= 0 && p[0] <= innerWidth && p[1] <= innerHeight) c = [p[0], p[1], P.r * 2, P.r * 2, 1]; }
  hole.hidden = !c; fing.hidden = !c || !P.fing;
  if (c) { Object.assign(hole.style, { left: c[0] - c[2] / 2 + 'px', top: c[1] - c[3] / 2 + 'px', width: c[2] + 'px', height: c[3] + 'px', borderRadius: c[4] ? '50%' : '14px' });
    Object.assign(fing.style, { left: c[0] + 'px', top: c[1] + 'px' }); fing.className = 'finger ' + P.fing; }
  const H = innerHeight, sh = say.offsetHeight, D = $('decor'), n = P.near && vis(P.near) ? P.near.getBoundingClientRect() : null;
  const top = P.dec && vis(D) ? D.getBoundingClientRect().top - sh - 12 : n ? n.top - sh - 10 : c ? (c[1] > H * 0.55 ? c[1] - c[3] / 2 - sh - 18 : c[1] + c[3] / 2 + 18) : H * 0.6;
  say.style.top = Math.round(Math.max(12, Math.min(H - sh - 12, top))) + 'px';
}

// a drag that missed the prop (the camera moved instead): twice and the hole grows, a second line says where to put the finger (§2-2)
let down = null;
const pd = e => { down = sub === 'd_drag' ? [e.clientX, e.clientY, 0] : null; }, pm = () => { if (down && body.classList.contains('pdrag')) down[2] = 1; };
const pu = e => { if (down && !down[2] && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 30) mk.miss = (mk.miss || 0) + 1; down = null; };

skip.onclick = () => { const at = sub || key || late || ''; G.flag('tut181', mode === 'again' ? 'done' : 'skip'); track('tut', { s: 'skip', at }, 'tut:skip'); stop(); toast($t('설정에서 다시 볼 수 있어요')); };
function start() {
  if (iv) return; body.append(box); key = undefined; late = null; auto = new Set();
  addEventListener('pointerdown', pd, true); addEventListener('pointermove', pm, true); addEventListener('pointerup', pu, true);
  iv = setInterval(tick, STEP); tick();
}
function stop() {
  clearInterval(iv); iv = 0; cancelAnimationFrame(raf); raf = 0; plan = null; box.remove(); box.hidden = true;
  removeEventListener('pointerdown', pd, true); removeEventListener('pointermove', pm, true); removeEventListener('pointerup', pu, true);
  body.classList.remove('tut181'); delete body.dataset.tut;
}
// 설정 › 튜토리얼 다시 보기: shows, gives nothing (no egg, no 튤립), keeps everything (Q5's toast points here)
export function again() {
  const S = G.S; if (!S) return; stop();
  if (R.step181(S, G.now())) { mode = 'main'; return start(); } // the first run still going: it carries on where it is
  G.flag('tut181', 'again'); track('tut', { s: 'again' }, 'tut:again');
  mode = 'again'; ai = 0; AG = ['pet', 'feed', 'decor', 'codex', ...hab2(S) ? ['map'] : [], 'aff']; start();
}
export function initTut(cur, api) {
  getCur = cur; getApi = api; const S = G.S;
  if (S?.flags.tut181 === 'again') { G.flag('tut181', 'done'); } // a replay cut by a reload: over (it gave nothing)
  mode = 'main'; start();
}
