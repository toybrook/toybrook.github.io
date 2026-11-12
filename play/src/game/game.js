// The running game: owns the save (S), the clock and localStorage. rules.js does the work; this file only
// times it, stores it and tells listeners what happened. Saved on device only; unreadable save = new game.
import * as V from './visit.js'; // 16-1
import * as K from './sky.js'; // 16-2
import * as R from './rules.js';
import { PROPS } from './data.js';
import { EDITION } from '../config.js';
import { now as clock } from './clock.js';
export { now, dayOf } from './clock.js'; // the UI reads game time as G.now()

const KEY = 'toyhabitat.save';
export let S = null;
export let refused = null; // inbox 22: the edition of a save this build would not open (release: a beta save), else null
export let bad = false; // 27-1: there was a save but it could not be read or is another edition's (kept under KEY.bad / KEY.<edition>): told on the start card
const listeners = [];
export const on = f => listeners.push(f); // f(events) after every tick and action

// Before a save is migrated, or replaced because it can't be read (or comes from a newer build), the old text is kept
// once under KEY.v<n> / KEY.bad, so an update never silently loses a collection.
function load(now) {
  let raw = null;
  try { raw = localStorage.getItem(KEY); if (!raw) return null; } catch { return null; }
  let v = 0, S = null, ed = EDITION;
  try { const o = JSON.parse(raw); v = o?.schemaVersion; ed = o?.edition || 'beta'; if (ed === EDITION) S = R.fromSave(o, now); } catch { /* unreadable */ }
  if (ed !== EDITION) refused = ed; // inbox 22: beta saves stay out of the release build (kept once under KEY.beta)
  const keep = S ? (v < S.schemaVersion ? KEY + '.v' + v : null) : KEY + (refused ? '.' + refused : '.bad');
  bad = !S && refused !== 'beta'; // a beta save in the release build has its own notice
  try { if (keep && !localStorage.getItem(keep)) localStorage.setItem(keep, raw); } catch { /* full: keep playing */ }
  return S;
}
// 26-7: off: another tab has the game (Web Locks), so this one saves nothing; failed: the last save threw (full storage etc.), told
// once till one goes through again. hooks (main.js): busy() this tab opened second, lost() another tab took over, fail()
let off = !!navigator.locks, failed = false, hooks = {};
export function save() {
  if (off) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); failed = false; } catch { if (!failed) { failed = true; hooks.fail?.(); } } // keep playing
}
// 26-7 한 번에 한 탭: the tab that holds the lock saves. A reload or a tab just let go may still hold it a moment: asked twice.
// ponytail: no Web Locks (Safari < 15.4) = no guard, two tabs both save as before
const LOCK = 'toyhabitat.tab';
function claim(again) {
  if (!navigator.locks) return;
  let had = false;
  navigator.locks.request(LOCK, { ifAvailable: true }, lock => {
    if (!lock) return again ? hooks.busy?.() : void setTimeout(() => claim(true), 400);
    had = true; off = false; save(); return new Promise(() => {}); // held till the page goes, or 「여기서 하기」 in another tab steals it
  }).catch(() => { off = had; if (had) hooks.lost?.(); else save(); }); // not allowed a lock at all (an odd origin): no guard
}
// 「여기서 하기」: the other tab stops (its lock stolen), then this page reloads to open the save as that tab left it
export async function takeOver() { await navigator.locks.request(LOCK, { steal: true }, () => {}); location.reload(); }

// Load (or start), catch up on the time the game was closed. Returns what happened meanwhile.
export function start(h = {}) {
  hooks = h; const now = clock(); S = load(now) || R.newGame(now); S.edition = EDITION;
  const ev = R.advance(S, now); save(); claim(false); // saved as soon as this tab holds the lock
  setInterval(() => { const ev = R.advance(S, clock()); if (ev.length) save(); emit(ev); }, 1000);
  addEventListener('visibilitychange', save); addEventListener('pagehide', save);
  return ev;
}
// inbox 21 백업 불러오기: s (already through R.fromSave) becomes the save; the caller reloads the page right after.
// 27-1: false when it can't be stored (full storage): the save stays as it was
export function replace(s) { s.edition = EDITION; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { return false; } S = s; return true; }
const emit = ev => { for (const f of listeners) f(ev); };
// an action, then catch up (a feed or pet that fills the gauge grows it at once), save, tell
function act(fn) { const now = clock(), out = fn(now), ev = R.advance(S, now); save(); emit([...(out?.events || []), ...ev]); return out; }

export const takeEgg = (hab, eggId) => act(now => R.takeEgg(S, hab, now, eggId));
export const hatch = i => act(now => { // ?debug 「다음 알 시크릿」 (flags.forceSecret) is used up here; rules only take forced
  const f = !!S.flags.forceSecret, out = R.hatch(S, i, now, Math.random, f); if (out && f) delete S.flags.forceSecret; return out;
});
export const release = id => act(now => R.release(S, id, now));
export const feed = id => act(now => R.feed(S, id, now));
export const tapHeart = id => act(now => R.tapHeart(S, id, now));
export const sendBack = id => act(() => R.sendBack(S, id));
export const store = id => act(now => R.store(S, id, now));
export const setFav = (id, on) => act(() => R.setFav(S, id, on));
export const setName = (id, text) => act(() => R.setName(S, id, text));
export const unstore = id => act(now => R.unstore(S, id, now));
export const sendStroll = (id, h, pl) => act(now => R.sendStroll(S, id, h, now, Math.random, pl)); // 13-1 (pl: 14-1 the 불의 언덕)
export const cardsSeen = () => act(() => R.cardsSeen(S));
export const seeScene = (id, sp) => act(now => R.seeScene(S, id, sp, now)); // 13-2
// 14-1 신수의 부름 (rules.js mythTick): at [x, z] where the gift goes if there is room
export const mythStage = () => S && R.mythStage(S, clock());
export const mythSeen = at => act(now => R.mythSeen(S, now, at));
export const mythTrace = at => act(now => R.mythTrace(S, now, at));
export const mythCall = () => act(now => R.mythCall(S, now));
export const mythPet = () => act(now => R.mythPet(S, now));
export const mythRead = i => act(() => R.mythRead(S, i));
export const mythShown = () => act(now => R.mythShown(S, now));
export const buyCandy = () => act(() => R.buyCandy(S));
export const holdBaby = id => act(now => R.holdBaby(S, id, now));
export const letGrow = id => act(now => R.letGrow(S, id, now));
export const grownSeen = ids => act(() => R.grownSeen(S, ids));
export const setDisplay = (k, c) => act(() => R.setDisplay(S, k, c));
// inbox 51: a 'buy' event (stats.js): kind as priced (big: listed ♥100 and up, else play for 놀이·기차 ones, else small), the hearts paid
export const buyProp = (id, hab) => act(() => { const h = S.hearts, p = R.buyProp(S, id, hab), P = PROPS.find(x => x.id === id);
  return p && { p, events: [{ type: 'buy', kind: P.list >= 100 ? 'big' : P.use || P.rail ? 'play' : 'small', price: h - S.hearts }] }; })?.p ?? null;
export const shelf = hab => R.shelfOf(S, hab, clock()); // 13-3 오늘의 진열대
export const buyShelf = (hab, i) => act(now => { const h = S.hearts, p = R.buyShelf(S, hab, i, now), P = p && PROPS.find(x => x.id === p.prop);
  return p && { p, events: [{ type: 'buy', kind: P.list >= 100 ? 'big' : P.use || P.rail ? 'play' : 'small', price: h - S.hearts }] }; })?.p ?? null;
export const buyExpand = hab => act(() => R.buyExpand(S, hab));
export const refit = (hab, moves) => act(() => R.refit(S, hab, moves)); // inbox 42 A
export const setHome = (id, home) => act(() => R.setHome(S, id, home)); // inbox 53
export const placeProp = (uid, x, z, rot, ex) => act(() => R.placeProp(S, uid, x, z, rot, ex)); // 28-5 ex: { c, sz, on, sl }
export const placeRing = (hab, cells, clear) => act(() => R.placeRing(S, hab, cells, clear)); // inbox 37 작은 고리
export const saveLay = (hab, k, name) => act(now => R.saveLay(S, hab, k, name, now)); // 28-5 배치 저장 칸
export const stowProp = uid => act(() => R.stowProp(S, uid));
export const addNatives = (hab, list, rings) => act(() => R.addNatives(S, hab, list, rings));
export const paintCell = (hab, i, j, b) => act(() => R.paintCell(S, hab, i, j, b));
export const paintCells = (hab, cells, b) => act(() => cells.reduce((n, [i, j]) => n + R.paintCell(S, hab, i, j, b), 0)); // a stroke: one save
export const setLayout = (hab, snap) => act(() => R.setLayout(S, hab, snap));
export const importLayout = (hab, d, fit, cell) => act(() => R.importLayout(S, hab, d, fit, cell));
export const undoImport = () => act(() => R.undoImport(S));
export const clearGhost = hab => act(() => R.clearGhost(S, hab));
export const refundProp = uid => act(() => R.refundProp(S, uid));
// inbox 41 B: mail.json's mail (ids: only those) and a gift code. Codes used on this device are also kept apart from the save
// (toyhabitat.codes), so a new game here can't use one again
const CODES = 'toyhabitat.codes', usedHere = () => { try { const u = JSON.parse(localStorage.getItem(CODES)); return Array.isArray(u) ? u : []; } catch { return []; } };
export const claimMail = (list, ids) => act(now => R.claimMail(S, list, now, ids));
export const claimLegend = () => act(now => R.claimLegend(S, now)); // 44
export const useCode = (codes, input) => act(now => { const out = R.useCode(S, codes, input, now, usedHere());
  if (out.got) try { localStorage.setItem(CODES, JSON.stringify([...usedHere(), out.got[0].id])); } catch { /* full: the save still has it */ } return out; });
// inbox 41 C 출석부: at = the habitat on screen (a gift prop goes there)
// 15-1 계절 이벤트: the calendar (play/events.json, ui/event.js), the run now, its shop, album, cards and mail
export const setCal = c => { R.setCal(c); if (S) act(() => {}); }; // 15-1: before start (the kept copy) only the calendar
export const event = () => S && R.liveRun(S, clock());
export const buyEv = (id, hab) => act(now => R.buyEv(S, id, hab, now));
export const evShot = ctx => act(now => R.evShot(S, ctx, now));
export const evSeen = (key, k) => act(() => R.evSeen(S, key, k));
export const evMail = () => S ? R.evMail(S, clock()) : [];
// 15-2 첫눈: snow piles, the snowman built, event wear (on a friend while fewer are worn than bought)
export const pile = () => S && R.evPile(S, clock());
export const tapPile = () => act(now => R.tapPile(S, now));
export const dig = () => act(now => R.dig(S, now)); // 14-3 화석 발굴: an animal done digging at the fossil site (the PROPS id found, or null)
export const evBuild = (hab, x, z) => act(now => R.evBuild(S, hab, x, z, now));
export const evWear = (id, k) => act(() => R.evWear(S, id, k));
export const evOwned = () => S ? R.evOwned(S) : {};
// 16-1 놀러 보내기 (visit.js): the guests come with the animals to the habitat (no seat, not in S.animals)
export const withGuests = () => [...S.animals, ...S.visit.guests];
export const sendVisit = id => act(now => V.sendVisit(S, id, now));
export const takeVisit = v => act(now => V.takeVisit(S, v, now));
export const pickCard = (lid, pic, line) => act(now => V.pickCard(S, lid, pic, line, now));
export const takeCard = c => act(now => V.takeCard(S, c, now));
export const claimCard = lid => act(now => V.claimCard(S, lid, now));
export const setGarden = g => act(() => { S.visit.garden = g; });
// 16-2 특별한 하늘 (sky.js, ui/sky.js)
export const skyTonight = (hab, n) => K.tonight(S, clock(), hab, n);
export const skySeen = (n, slots) => act(now => K.seenNight(S, n, slots, now));
export const skyBit = () => act(() => K.skyBit(S));
export const skyMark = (k, v) => act(() => { S.sky[k] = v; });
export const palSeen = () => act(() => { for (const p of S.pals.list) delete p.new; }); // 17-1 단짝 card seen
export const skyScope = at => act(() => { if (S.sky.scope) return null; S.sky.scope = 1; return R.putGift(S, 'sky_scope', at, { cost: 0 }); });
export const attendDue = () => R.attendDue(S, clock());
export const attend = at => act(now => R.attend(S, now, Math.random, at));
export const note = (k, n) => { if (n > (S.stats?.[k] || 0)) act(() => R.noteLive(S, k, n)); }; // 23-2: the habitat on screen (saved only when more)
export const setTitle = id => act(() => R.setTitle(S, id));
export const flag = (k, v = true) => act(() => { S.flags[k] = v; });
export const markSeen = keys => act(() => { S.seen = [...new Set([...S.seen, ...keys])]; });
export const markProps = () => act(() => { S.seenProps = PROPS.map(p => p.id); }); // 꾸미기 opened: every prop looked at
// debug
export const skip = ms => act(now => ({ events: R.skip(S, ms, now) }));
export const addHearts = n => act(() => { S.hearts += n; });
export const forceSecret = () => act(() => { S.flags.forceSecret = true; });
// fill the codex (one species, or the whole habitat), every colour seen: for 진열장 screenshots and FPS
export const fillCodex = (habId, spId) => act(now => {
  for (const c of R.codexCells(habId)) if (!spId || c.species.id === spId) {
    S.codex[c.key] ??= { at: now, adult: now }; S.colors[c.key] = R.colorsOf(c.species.id, c.variant.id).map(x => x.id); S.seen = S.seen.filter(x => x !== c.key);
  }
});
// crack up to n eggs of this type straight away (no animals), never a natural legendary: the unluckiest run. Stops once
// the legendary gauge is full, so the next egg hatched in the nest menu is the guaranteed one. Album and "다음 알 시크릿" untouched.
export const crackMany = (type, n) => act(now => {
  const odds = { ...R.EGG[type].odds, legendary: 0 }, out = {}, album = S.album;
  S.album = { ...album };
  for (let i = 0; i < n && R.sureRarity(S, type) !== 'legendary'; i++) { const r = R.crack(S, { type, rarity: R.rollRarity(odds, Math.random) }, now); out[r.rarity] = (out[r.rarity] || 0) + 1; }
  S.album = album;
  return { cracked: out };
});
export const reset = () => { S = R.newGame(clock()); save(); emit([{ type: 'reset' }]); };
