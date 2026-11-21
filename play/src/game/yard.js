// 182 ④ 나의 뜰 (?yard, docs/concepts/custom-zone.md 6, 9; a trial). 184 ④ (SCHEMA 15): the yard's part of the save is S.yard in the
// main save (backup and continue carry it); before, its own key YKEY (merged once by withOldKey, then removed: game.js). With the
// flag on, the rest of the save is still kept as a build without the flag reads it (saveOf = yardOut + yard), and at the start
// yardIn puts S.yard back on the game. The yard part only says where things the main save already owns stand (by uid), plus the
// yard's own paint, step, free nature and who is visiting; it can never make a prop, hearts or an animal (yardIn checks each entry).
import { YARD_B, NATURE, HABITATS, MODELS, BRUSHES, brushIn, UNIT, SIZES, paletteOf, sizable } from './data.js';
import { scrub, SP, PROP, known, fits, capOf, natIn, natCap, levelOf, tidy, seatFree, unlockInfo } from './rules.js';
import { rectAt, inRect } from '../habitat/zones.js';
import { fitSc } from './scatter.js';

export const YKEY = 'toyhabitat.yard';
const NATS = new Set(NATURE.map(n => n.id)), HABS = new Set(HABITATS.map(h => h.id));
const fin = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const inOpen = (S, x, z) => inRect(rectAt('yard', levelOf(S, 'yard')), x * UNIT, z * UNIT);
const homeOf = p => HABS.has(p.from) ? p.from : PROP[p.prop]?.habitat ?? HABITATS[0].id; // where a yard prop goes back to
export const walker = a => MODELS[SP[a.species]?.model]?.move === 'walk'; // 1단계: no swimmers (the duck, the swan)
export const visitors = S => S.animals.filter(a => a.stay === 'yard');

// the save as the game keeps it with the flag on: the main save as a build without the flag reads it, the yard part beside it
export const saveOf = S => { const o = yardOut(S), y = yardPart(S); if (y) o.yard = y; return o; };
// 184 ④: a save from before 15 and the text under the old key (or null): the key's part in the save, if the save has none; rules.js
// fromSave checks its shape (tidyYard) like any save's
export function withOldKey(o, txt) {
  if (o && typeof o === 'object' && o.schemaVersion < 15 && o.yard === undefined && txt) try { o.yard = JSON.parse(txt); } catch { /* unreadable: no yard */ }
  return o;
}

// the yard part to keep: what yardIn reads back
export function yardPart(S) {
  if (!S.unlocked.includes('yard')) return null;
  const mine = S.props.filter(p => p.hab === 'yard');
  return { v: 1, since: S.since, L: levelOf(S, 'yard'), kit: S.flags?.yardKit ? 1 : 0, last: S.flags?.lastHab === 'yard' ? 1 : 0, paint: S.paint?.yard || {},
    props: mine.filter(p => !p.nat).map(p => [p.uid, p.placed ? 1 : 0, p.x, p.z, p.rot || 0, p.c || 0, p.sz || 0, p.on ?? null, p.sl ?? null]),
    nat: mine.filter(p => p.nat).map(p => [p.prop, p.placed ? 1 : 0, p.x, p.z, p.rot || 0, p.s || 1, p.v || 0]),
    stay: visitors(S).map(a => a.id), ...(S.scatter?.length && { sc: S.scatter }) }; // 195 B-8 1-2 흩뿌리기 (game/scatter.js)
}

// the main save as a build without the flag keeps it: no 'yard' anywhere; a yard prop back in its own habitat's storage, the
// yard's free nature gone, the visitors home (a build without the flag puts any over its cap into storage, as for an old save)
export function yardOut(S) {
  const o = { ...S, unlocked: S.unlocked.filter(h => h !== 'yard') }, drop = k => { if (o[k]?.yard !== undefined) { o[k] = { ...o[k] }; delete o[k].yard; } };
  for (const k of ['expand', 'paint', 'ghost', 'lays', 'natives', 'freeExp', 'whole']) drop(k);
  if (o.flags?.yardKit !== undefined || o.flags?.lastHab === 'yard') { o.flags = { ...o.flags }; delete o.flags.yardKit; if (o.flags.lastHab === 'yard') delete o.flags.lastHab; }
  if (o.layoutUndo?.hab === 'yard') delete o.layoutUndo;
  delete o.scatter; // 195 B-8 1-2: the yard part's sc
  o.props = S.props.filter(p => !(p.hab === 'yard' && p.nat)).map(p => { if (p.hab !== 'yard' && p.from === undefined) return p;
    const q = { ...p, hab: p.hab === 'yard' ? homeOf(p) : p.hab }; if (p.hab === 'yard') q.placed = false; delete q.from; delete q.on; delete q.sl; return q; });
  // what stood on a yard prop (28-5 top spots) went into storage with it
  const gone = new Set(S.props.filter(p => p.hab === 'yard').map(p => p.uid));
  o.props = o.props.map(p => p.on != null && gone.has(p.on) ? (q => (delete q.on, delete q.sl, q))({ ...p, placed: false }) : p);
  o.animals = S.animals.map(a => { if (a.stay === undefined) return a; const b = { ...a }; delete b.stay; return b; });
  return o;
}

// raw: S.yard (shape checked by fromSave) or null. Called on S just loaded (after fromSave), before advance. Each entry checked;
// one that does not fit is left out (a prop: stays in its habitat's storage, as the main save has it). Returns how many were left out
export function yardIn(S, raw) {
  delete S.scatter; // 195 B-8 1-2: only from the yard part (sc, below), never a stray main-save key
  const d = raw && typeof raw === 'object' ? scrub(raw) : null;
  if (!d || typeof d !== 'object' || d.v !== 1) return 0;
  if (d.since !== S.since || !unlockInfo(S, 'yard').met) return 0; // a key left by another save (reset, another backup) or under the yard's level: not this game's
  let off = 0;
  if (!S.unlocked.includes('yard')) S.unlocked = [...S.unlocked, 'yard'];
  S.expand = { ...S.expand, yard: Number.isInteger(d.L) ? Math.max(0, Math.min(YARD_B.cells.length - 1, d.L)) : 0 };
  if (d.kit === 1) S.flags = { ...S.flags, yardKit: 1 };
  if (d.last === 1) S.flags = { ...S.flags, lastHab: 'yard' }; // back to the yard on the next start (yardOut keeps it out of the main save)
  const paint = {}; let n = 0;
  if (d.paint && typeof d.paint === 'object' && !Array.isArray(d.paint)) for (const [k, b] of Object.entries(d.paint)) {
    const m = /^(-?\d{1,2}),(-?\d{1,2})$/.exec(k);
    if (!m || !Number.isInteger(b) || !BRUSHES[b] || !brushIn(b, 'yard') || n >= 2088 || !inOpen(S, +m[1] + 0.5, +m[2] + 0.5)) { off++; continue; }
    paint[k] = b; n++;
  }
  S.paint = { ...S.paint, yard: paint };
  const by = new Map(S.props.map(p => [p.uid, p])), seen = new Set(), cap = { props: 0, big: 0 }, seats = [];
  for (const e of Array.isArray(d.props) ? d.props.slice(0, 400) : []) {
    const [uid, on, x, z, rot, c, sz, hu, sl] = Array.isArray(e) ? e : [], p = by.get(uid), P = p && PROP[p.prop];
    if (!P || p.nat || p.placed || seen.has(uid) || P.water) { off++; continue; } // a prop the main save owns and keeps put away (one placed since, in a build without the flag, stays there), once
    seen.add(uid); p.from = p.hab; p.hab = 'yard'; delete p.on; delete p.sl; // from: where the main save keeps it
    p.placed = false; p.x = 0; p.z = 0; p.rot = 0;
    if (Number.isInteger(c) && c > 0 && c < (paletteOf(P)?.length ?? 0)) p.c = c; else delete p.c;
    if (Number.isInteger(sz) && sz > 0 && sz < SIZES.length && sizable(P)) p.sz = sz; else delete p.sz;
    const big = YARD_B.bigIds.includes(p.prop), rail = P.rail || 0;
    if (on === 1 && fin(x, -99, 99) && fin(z, -99, 99) && fin(rot, -7, 7) && inOpen(S, x, z) && (rail || P.art || (cap.props < YARD_B.props[S.expand.yard] && (!big || cap.big < YARD_B.big)))) {
      Object.assign(p, { placed: true, x, z, rot }); if (!rail && !P.art) { cap.props++; if (big) cap.big++; }
      if (Number.isInteger(hu) && Number.isInteger(sl)) seats.push([p, hu, sl]);
    } else if (on === 1) off++;
  }
  // 28-5 top spots: back onto the yard prop under it if that stands and the spot is free; else it stays on the floor where it was
  for (const [p, hu, sl] of seats) { const h = by.get(hu); if (PROP[p.prop].small && h && h !== p && h.hab === 'yard' && seatFree(S, h, sl, p)) Object.assign(p, { on: hu, sl }); }
  let nat = 0;
  for (const e of Array.isArray(d.nat) ? d.nat.slice(0, 120) : []) {
    const [prop, on, x, z, rot, s, v] = Array.isArray(e) ? e : [];
    if (!NATS.has(prop)) { off++; continue; }
    const place = on === 1 && fin(x, -99, 99) && fin(z, -99, 99) && fin(rot, -7, 7) && inOpen(S, x, z) && nat < YARD_B.nat[S.expand.yard];
    if (on === 1 && !place) { off++; continue; } // a free one that does not fit: simply not there
    S.props.push({ uid: S.nextId++, prop, hab: 'yard', placed: place, x: place ? x : 0, z: place ? z : 0, rot: place ? rot : 0, nat: 1, s: fin(s, 0.5, 1.6) ? s : 1, v: Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0 });
    if (place) nat++;
  }
  tidy(S);
  // 195 B-8 1-2 흩뿌리기: whole pieces in range, two a cell (tidySc), each on the yard's open land at its step and not on water or a line, under its cap
  const sc = fitSc(S, d.sc); off += sc.off; if (sc.list.length) S.scatter = sc.list; else delete S.scatter;
  for (const id of Array.isArray(d.stay) ? d.stay.slice(0, 20) : []) {
    const a = S.animals.find(a => a.id === id);
    if (!a || !callable(a)) { off++; continue; }
    a.stay = 'yard'; if (!fits(S, a) && !a.stored) { delete a.stay; off++; } else delete a.home;
  }
  return off;
}

// 9 동물 부르기: a walking friend of the player's (no guest, no 신수 look, not on a walk, not just hatched) comes to the yard
export const callable = a => known(a) && !a.pending && !a.stroll && !a.guest && !a.hab && walker(a);
export function callToYard(S, id) {
  const a = S.animals.find(a => a.id === id); if (!a || a.stay || !S.unlocked.includes('yard') || !callable(a)) return null;
  a.stay = 'yard'; if (!fits(S, a)) { delete a.stay; return null; }
  a.stored = false; delete a.home; return a;
}
// back to its own habitat: out if it fits there, else into storage
export function sendHome(S, id) {
  const a = S.animals.find(a => a.id === id && a.stay === 'yard'); if (!a) return null;
  delete a.stay; delete a.home; if (!a.stored && !fits(S, a)) a.stored = true; return a;
}
// 6 보관함에서 가져오기 / 돌려보내기: a prop put away in another habitat to the yard's storage, and back
export function importProp(S, uid) {
  const p = S.props.find(p => p.uid === uid); if (!p || p.placed || p.nat || p.hab === 'yard' || !HABS.has(p.hab) || !PROP[p.prop] || PROP[p.prop].water || !S.unlocked.includes('yard')) return null;
  p.from = p.hab; p.hab = 'yard'; return p;
}
export function returnProp(S, uid) {
  const p = S.props.find(p => p.uid === uid); if (!p || p.placed || p.nat || p.hab !== 'yard') return null;
  p.hab = homeOf(p); delete p.from; return p;
}
// 자연물 꺼내 놓기: a tree, bush, rock or flowers of the yard's own, free, while under its cap (one put away is used first)
export function takeNat(S, prop) {
  if (!NATS.has(prop) || !S.unlocked.includes('yard') || natIn(S, 'yard') >= natCap(S)) return null;
  const old = S.props.find(p => p.nat && p.hab === 'yard' && p.prop === prop && !p.placed); if (old) return old;
  const p = { uid: S.nextId++, prop, hab: 'yard', placed: false, x: 0, z: 0, rot: 0, nat: 1, s: 1, v: S.nextId * 7919 % 100000 }; S.props.push(p); return p;
}
// 8 시작 꾸러미: once, when the yard is first opened: a few props (real ones: they go home in a build without the flag) and nature
export function giveKit(S) {
  if (S.flags?.yardKit || !S.unlocked.includes('yard')) return null;
  S.flags = { ...S.flags, yardKit: 1 }; const got = [];
  for (const [id, n] of YARD_B.kit) if (PROP[id]) for (let i = 0; i < n; i++) { const p = { uid: S.nextId++, prop: id, hab: 'yard', placed: false, x: 0, z: 0, rot: 0 }; S.props.push(p); got.push(p); }
  for (const [id, n] of YARD_B.kitNat) if (NATS.has(id)) for (let i = 0; i < n; i++) { const p = { uid: S.nextId++, prop: id, hab: 'yard', placed: false, x: 0, z: 0, rot: 0, nat: 1, s: 1, v: S.nextId * 7919 % 100000 }; S.props.push(p); got.push(p); }
  return got;
}
export const yardCap = S => ({ animals: capOf(S, 'yard'), here: visitors(S).filter(a => !a.stored).length });
