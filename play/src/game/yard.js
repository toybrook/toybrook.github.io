// 182 ④ 나의 뜰 (?yard, docs/concepts/custom-zone.md 6, 9; a trial). 184 ④ (SCHEMA 15): the yard's part of the save is S.yard in the
// main save (backup and continue carry it); before, its own key YKEY (merged once by withOldKey, then removed: game.js). With the
// flag on, the rest of the save is still kept as a build without the flag reads it (saveOf = yardOut + yard), and at the start
// yardIn puts S.yard back on the game. The yard part only says where things the main save already owns stand (by uid), plus the
// yard's own paint, step, free nature and who is visiting; it can never make a prop, hearts or an animal (yardIn checks each entry).
import { YARD_B, YD247, Y247, Y861, NATURE, HABITATS, MODELS, BRUSHES, brushIn, UNIT, SIZES, paletteOf, sizable } from './data.js';
import { scrub, SP, PROP, known, fits, capOf, natIn, natCap, levelOf, tidy, seatFree, unlockInfo, tidyPc } from './rules.js';
import { rectAt, inRect } from '../habitat/zones.js';
import { fitSc, capOf as scCap, scBlock } from './scatter.js';

export const YKEY = 'toyhabitat.yard';
const NATS = new Set(NATURE.map(n => n.id)), HABS = new Set(HABITATS.map(h => h.id));
const fin = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const inOpen = (S, x, z) => inRect(rectAt('yard', levelOf(S, 'yard')), x * UNIT, z * UNIT);
const homeOf = p => HABS.has(p.from) ? p.from : PROP[p.prop]?.habitat ?? HABITATS[0].id; // where a yard prop goes back to
export const walker = a => MODELS[SP[a.species]?.model]?.move === 'walk'; // 1단계: no swimmers (the duck, the swan)
export const visitors = S => S.animals.filter(a => a.stay === 'yard');

// the save as the game keeps it with the flag on: the main save as a build without the flag reads it, the yard part beside it
// 251 C (YD247): the yard part twice. `yard` as 0.86.1 (16, steps 0..6) can read it: L at most 6 (past its last step it drops the
// whole part); `yard247` whole (an unknown key: 0.86.1 keeps it as it came). yardIn takes back from yard247 what 0.86.1 could only
// drop or put away (mergeNew); what was changed there wins
export const saveOf = S => { const o = yardOut(S), y = yardPart(S); if (y && YD247) { o.yard = old861(y, idOf(S)); o.yard247 = y; } else if (y) o.yard = y; return o; };
// 254 A-4: y (the 247 yard part) as 0.86.1 keeps it once it has opened it, by its yardIn's rules: its land (L at most 6, Y861) and
// caps, its brushes (0..20, no theme ones). A prop it cannot place is put away; nature, paint, scatter and visitors it cannot keep
// are not there. saveOf writes this as `yard`, so 0.86.1 opening it and saving changes nothing by itself: what then differs is the player's
// props new since 0.86.1 (Y861.gone) are not in it (0.86.1 drops their rows): mergeNew keeps them from yard247
// ponytail: visitors over its cap by place in the list, not fits()
export function old861(y, id = () => null) { // id: a prop row's uid -> its prop (the rows carry the uid only)
  const L = Math.min(6, y.L), r = rectAt('yard', L, Y861.cells), open = (x, z) => inRect(r, x * UNIT, z * UNIT), cap = { props: 0, big: 0 };
  const props = y.props.filter(e => !Y861.gone(id(e[0]) ?? '')).map(e => { const P = PROP[id(e[0])], big = YARD_B.bigIds.includes(id(e[0]));
    if (e[1] === 1 && P && open(e[2], e[3]) && (P.rail || P.art || cap.props < Y861.props[L] && (!big || cap.big < YARD_B.big))) { if (!P.rail && !P.art) { cap.props++; if (big) cap.big++; } return e; }
    return [e[0], 0, 0, 0, 0, e[5], e[6], null, null]; });
  let k = 0; const nat = y.nat.filter(e => e[1] !== 1 || open(e[2], e[3]) && k++ < Y861.nat[L]).map(e => e[1] === 1 ? e : [e[0], 0, 0, 0, 0, e[5], e[6]]);
  const paint = Object.fromEntries(Object.entries(y.paint).filter(([c, b]) => { const [i, j] = c.split(',').map(Number); return b < 21 && brushIn(b, 'yard') && !BRUSHES[b].th && open(i + 0.5, j + 0.5); }));
  const sc = fives(y.sc).filter(f => { const i = Math.floor(f[1] / 2), j = Math.floor(f[2] / 2); return open(i + 0.5, j + 0.5) && !scBlock(paint[i + ',' + j]); }).slice(0, scCap(...Y861.cells[L])).flat();
  return { ...y, L, props, nat, paint, stay: y.stay.slice(0, Y861.animals[L]), ...(y.sc && { sc }) };
}
const idOf = S => { const m = new Map(S.props.map(p => [p.uid, p.prop])); return uid => m.get(uid); };
const fives = x => Array.from({ length: Math.floor((x?.length ?? 0) / 5) }, (_, i) => x.slice(i * 5, i * 5 + 5));
// x less y, as lists of rows (each row of y takes one equal row of x away)
const minus = (x, y) => { const J = JSON.stringify, left = y.map(e => J(e)); return x.filter(e => { const i = left.indexOf(J(e)); if (i < 0) return true; left[i] = null; return false; }); };
// a: `yard` as it came back (0.86.1 may have opened it and saved its own), n: yard247 (this build's last save), b = old861(n): what
// 0.86.1 kept of n. Where a is b, nothing was done there: n's row (with what 0.86.1 had to put away or leave out). Where a differs
// (moved, put away, taken out, painted over, sent home, added), a wins. Only what 0.86.1 could not keep comes back from n
export function mergeNew(a, n, id) {
  if (!n) return a; if (!a) return n; if (n.since !== a.since) return a;
  const J = JSON.stringify, b = old861(n, id), was = new Map(b.props.map(e => [e[0], e])), by = new Map(a.props.map(e => [e[0], e]));
  const seen = new Set(), props = n.props.filter(e => (by.has(e[0]) || !was.has(e[0]) && Y861.gone(id(e[0]) ?? '')) && !seen.has(e[0]) && seen.add(e[0])).map(e => { const o = by.get(e[0]); by.delete(e[0]);
    return !o || J(o.slice(0, 7)) === J(was.get(e[0])?.slice(0, 7)) ? e : o; }); // not in b: a prop 0.86.1 has not got, n's row as it was
  const extra = (nr, br, ar) => [...ar, ...minus(minus(nr, br), ar)]; // what 0.86.1 could not keep, unless a has it already (a `yard` from before 254: all of n)
  const keptP = new Set(Object.keys(b.paint)), outP = Object.fromEntries(Object.entries(n.paint).filter(([c]) => !keptP.has(c)));
  const L = a.L === Math.min(6, n.L) ? n.L : Y247.old[Math.max(Y247.from[n.L], Y247.from[a.L])]; // more land bought there: the bigger
  return { ...n, L, kit: a.kit, last: a.last, paint: { ...outP, ...a.paint }, props: [...props, ...by.values()], nat: extra(n.nat, b.nat, a.nat),
    stay: [...new Set([...a.stay, ...n.stay.filter(id => !b.stay.includes(id))])], ...((n.sc || a.sc) && { sc: extra(fives(n.sc), fives(b.sc), fives(a.sc)).flat() }) };
}
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
  return { v: 1, since: S.since, L: YD247 ? Y247.old[Math.min(4, levelOf(S, 'yard'))] : levelOf(S, 'yard'), kit: S.flags?.yardKit ? 1 : 0, last: S.flags?.lastHab === 'yard' ? 1 : 0, paint: S.paint?.yard || {},
    props: mine.filter(p => !p.nat).map(p => [p.uid, p.placed ? 1 : 0, p.x, p.z, p.rot || 0, p.c || 0, p.sz || 0, p.on ?? null, p.sl ?? null]),
    nat: mine.filter(p => p.nat).map(p => [p.prop, p.placed ? 1 : 0, p.x, p.z, p.rot || 0, p.s || 1, p.v || 0]),
    stay: visitors(S).map(a => a.id), ...(S.scatter?.length && { sc: S.scatter }), ...(S.pc && Object.keys(S.pc).length && { pc: S.pc, pb: 3 }) }; // 195 B-8 1-2 흩뿌리기 (game/scatter.js); 238 E1 이어지는 조각 owned (248 D pb 3: brushes at 29..31)
}

// the main save as a build without the flag keeps it: no 'yard' anywhere; a yard prop back in its own habitat's storage, the
// yard's free nature gone, the visitors home (a build without the flag puts any over its cap into storage, as for an old save)
export function yardOut(S) {
  const o = { ...S, unlocked: S.unlocked.filter(h => h !== 'yard') }, drop = k => { if (o[k]?.yard !== undefined) { o[k] = { ...o[k] }; delete o[k].yard; } };
  for (const k of ['expand', 'paint', 'ghost', 'lays', 'natives', 'freeExp', 'whole']) drop(k);
  if (o.flags?.yardKit !== undefined || o.flags?.lastHab === 'yard') { o.flags = { ...o.flags }; delete o.flags.yardKit; if (o.flags.lastHab === 'yard') delete o.flags.lastHab; }
  if (o.layoutUndo?.hab === 'yard') delete o.layoutUndo;
  delete o.scatter; delete o.pc; // 195 B-8 1-2: the yard part's sc; 238 E1: its pc
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
  delete S.scatter; delete S.pc; // 195 B-8 1-2: only from the yard part (sc, below), never a stray main-save key; 238 E1 pc likewise
  if (YD247) raw = mergeNew(raw, S.yard247, idOf(S)); delete S.yard247; // 251 C (fromSave checked both: rules.js tidyYard)
  const d = raw && typeof raw === 'object' ? scrub(raw) : null;
  if (!d || typeof d !== 'object' || d.v !== 1) return 0;
  if (d.since !== S.since || !unlockInfo(S, 'yard').met) return 0; // a key left by another save (reset, another backup) or under the yard's level: not this game's
  let off = 0;
  if (!S.unlocked.includes('yard')) S.unlocked = [...S.unlocked, 'yard'];
  S.expand = { ...S.expand, yard: Number.isInteger(d.L) ? Math.max(0, Math.min(YARD_B.cells.length - 1, d.L)) : 0 };
  if (YD247) { const L = Number.isInteger(d.L) ? Math.max(0, Math.min(9, d.L)) : 0, k = Y247.from[L]; S.expand.yard = k; // 247 A5 (yard-247.md 2): the old step on the new ladder, the land never smaller
    if (!S.flags?.y247) { S.hearts += Math.max(0, Y247.paid[L] - YARD_B.price.slice(0, k).reduce((a, b) => a + b, 0)); S.flags = { ...S.flags, y247: 1 }; } } // once: ♥ paid past the new step's worth back
  if (d.kit === 1) S.flags = { ...S.flags, yardKit: 1 };
  if (d.last === 1) S.flags = { ...S.flags, lastHab: 'yard' }; // back to the yard on the next start (yardOut keeps it out of the main save)
  // 238 E1: 이어지는 조각 owned, by shape (kept as it came where the brush is not in this build); a piece cell past them is left out
  const pc = d.pc && typeof d.pc === 'object' && !Array.isArray(d.pc) ? tidyPc(d.pc) : {}, pcs = {}; if (Object.keys(pc).length) S.pc = pc;
  const paint = {}, mv = !d.pc || d.pb === 3 ? {} : d.pb === 2 ? { 22: 29, 29: 30, 30: 31 } : { 21: 29, 22: 30, 23: 31 }; let n = 0; // 248 D: ?h232 trial saves from before: no pb 21..23, pb 2 (246 B) 22 · 29 · 30
  if (d.paint && typeof d.paint === 'object' && !Array.isArray(d.paint)) for (const [k, b0] of Object.entries(d.paint)) { const b = mv[b0] ?? b0;
    const m = /^(-?\d{1,2}),(-?\d{1,2})$/.exec(k);
    if (!m || !Number.isInteger(b) || !BRUSHES[b] || !brushIn(b, 'yard') || n >= 2088 || !inOpen(S, +m[1] + 0.5, +m[2] + 0.5)
      || BRUSHES[b].piece && (pcs[b] = (pcs[b] || 0) + 1) > (pc[BRUSHES[b].id] || 0)) { off++; continue; }
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
