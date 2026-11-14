// Game rules on a plain save object. Pure (no DOM, no clock: `now` and `rng` are passed in), so
// tools/check-eggs.mjs runs them in Node. game.js owns the state, the clock and localStorage.
//
// Save (S): { schemaVersion, contentVersion, hearts, nextId,
//   nests:   { [habitat]: { t (last laid), eggs: [{ id, type, rarity, parents: [null, null] }] } },
//   slots:   [{ egg, start, end } | null],
//   animals: [{ id, species, variant, color (colour id | null), acc (secret accessory id | null), egg (type id), parents: [null, null], stage: 'baby' | 'adult',
//              born, g (growth gauge 0..1 as of gAt), gAt, fed (feeds on fedDay), fedDay, hold (a 꼬마 사탕 holds its growth), adultAt,
//              card (grown, its "다 자랐어요" card not seen yet), stored, heartAt, pending (hatched, reveal card not answered yet: not out
//              in the habitat), newColor (pending only: a colour first seen on this card), fav (26-4 아끼는 친구: true | absent),
//              nm (26-4 its name: cleanName | absent) }],
//   codex:   { 'species:variant': { at (first one of it out: registered), adult (first seen grown up), h (26-5: the habitat whose nest it hatched from; absent before 0.60) } },   seen: [codex keys already looked at (or not new)],
//   colors:  { 'species:variant': [colour ids seen on a reveal card] } (a layer inside a codex cell; never counts toward the codex),
//   pity:    { [egg type]: { heroic, legendary } } (shards, BALANCE.pity),   album: { [accessory]: { species, variant, color, at } } (first seen),
//   display: { 'species:variant': colour id } (진열장: the colour its figure shows; one of colors),
//   props:   [{ uid, prop (PROPS id), hab, placed, x, z, rot }] (bought; placed or put away; x, z in the first board's units, 21-3b),
//            28-5 also c (PALETTES index, absent: 0), sz (SIZES index, absent: 0), on + sl (a small prop on top spot sl of prop uid on);
//            22-1 also the habitat's own nature: { ..., prop (NATURE id), nat: 1, s, v }; natives: { habId: rings handed over }, paint: { habId: { 'i,j': brush } },
//   pet:     { day (local date string), n (petting hearts that day, BALANCE.heart.daily) },
//   expand:  { [habitat]: 땅 넓히기 step 0..6 },
//   whole?:  { [habitat]: 모으기 판 steps given 0..3 }, freeExp?: { [habitat]: free 땅 넓히기 steps left } (66-3, absent = 0)
//   xp (정원사 레벨 XP, 23-1), lv (the level last shown on a level-up card), xpDay (the day the first-visit XP was given),
//   ach: { [도전 과제 id]: when done } (achieve.js), title (the 칭호 shown: a done one's id | null), stats: { hatch, grown, pet, feed, plant,
//            days, lights, roof } (counts for 도전 과제; lights, roof: the most the habitat on screen has seen, noteLive),
//   candy (꼬마 사탕 owned, not in use), unlocked: [habitat ids], flags: {},
//   since (when this game began, 41), mailGot: [mail ids received], codes: [gift codes used, codeKey],
//   attend: { day: the last 출석 (dayOf), at: its time, n: slots had in all } (41 C), first: { [첫날 할 일 id | 'all']: when done } (41 D),
//   fossil: { at: when the last fossil was dug up (14-3 dig; 0: none yet) } }
// stored: in storage (보관함): not out in the habitat, no slot limit, keeps its stage.
// Animals are kept by species id + variant id only, so new content never breaks an old save; ids the
// game no longer knows stay in the save untouched and are just not shown.
import { blank, tidyVisit, visitTick } from './visit.js'; // 16-1
import { blank as skyBlank, tidySky } from './sky.js'; // 16-2
import { blank as palBlank, tidyPals, palTick, peOf } from './pals.js'; // 17-1
import { blank as artBlank, tidyArt, artTick } from './art.js'; // 17-2
import { blank as wildBlank, tidyWild, wildTick } from './wild.js'; // 17-3
import { tidyGuests, skipGuests, tutShop, blank as guestsBlank } from './guests.js'; // 66-1
import { GUESTS, GUEST } from './guests-data.js'; // 66-2: a settled guest's name
import { SCHEMA_VERSION, CONTENT_VERSION, GIFT, ATTEND, ATTEND_PROPS, WEEK1, EVENTS, EV_ACC, FIRST, STROLL_PROPS, PLACES, SCENES, MYTHIC, BIGS, COMPLETE, BALANCE as B, RARITIES, EARNED_TIERS, SHARED_VARIANTS, SPECIES, HABITATS, EGG_TYPES, ACCESSORIES, MODELS, PROPS, NATURE, BRUSHES, brushIn, SETS, bodyArea, ZONES, paletteOf, SIZES, sizeF, sizable, UNIT, FOSSIL, HOLD } from './data.js';
import { encode } from './layout.js';
import { heartFor } from './hearts.js';
import { dayOf } from './clock.js';
import { BOARD0, rectAt, inRect, zoneSet } from '../habitat/zones.js';
import { newlyDone } from './achieve.js';

const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
export const SP = byId(SPECIES), HAB = byId(HABITATS), EGG = byId(EGG_TYPES), RAR = byId(RARITIES), EARNED = byId(EARNED_TIERS), PROP = byId(PROPS), NAT = byId(NATURE);
export const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));

export const variantsOf = sp => [...SHARED_VARIANTS, ...(sp.extra || []), ...sp.legendary.map(l => ({ ...l, rarity: 'legendary' }))];
export const variantOf = (spId, vId) => SP[spId] && variantsOf(SP[spId]).find(v => v.id === vId);
// a variant's colours on a species: the species' own list (palette), else the variant's shared one; legendaries have none
export const colorsOf = (spId, vId) => SP[spId]?.palette?.[vId] ?? variantOf(spId, vId)?.colors ?? [];
export const colorOf = (spId, vId, cId) => { const cs = colorsOf(spId, vId); return cs.find(c => c.id === cId) ?? cs[0] ?? null; };
export const key = (spId, vId) => spId + ':' + vId;
export const habitatOf = a => a.hab || SP[a.species]?.habitat; // a.hab: a guest (settle)
// A species that moved to a habitat not open yet (19-2: the duck, meadow -> pond): its animals stay in the first habitat
// (a.hab) till their own one opens, then move there. Run on every load and every unlock. Props bought there that moved too
// (the lily pad, the duck house) go to the new habitat's storage once it is open (placed ones stay till then).
const settle = S => {
  for (const a of S.animals) { const h0 = habitatOf(a), h = SP[a.species]?.habitat; if (h && !S.unlocked.includes(h)) a.hab = S.unlocked[0]; else delete a.hab; if (habitatOf(a) !== h0) delete a.home; } // inbox 53: another habitat, no pen
  for (const p of S.props) { const h = PROP[p.prop]?.habitat; if (h && h !== p.hab && S.unlocked.includes(h)) { p.hab = h; p.placed = false; } }
};
export const known = a => !!variantOf(a.species, a.variant);
// codex cells of a habitat: every variant of every species living there, grouped by rarity in RARITIES order
export const codexCells = habId => RARITIES.flatMap(r => SPECIES.filter(s => s.habitat === habId)
  .flatMap(s => variantsOf(s).filter(v => v.rarity === r.id).map(v => ({ key: key(s.id, v.id), species: s, variant: v, rarity: r.id }))));
const allKeys = () => HABITATS.flatMap(h => codexCells(h.id).map(c => c.key));

const noExpand = () => Object.fromEntries(HABITATS.map(h => [h.id, 0]));
export function newGame(now) {
  const S = { schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT_VERSION, hearts: 0, nextId: 1, nests: {}, slots: Array(B.slots).fill(null),
    animals: [], codex: {}, seen: allKeys(), colors: {}, pity: {}, album: {}, display: {}, props: [], natives: {}, paint: {}, ghost: {}, lays: {}, pet: { day: '', n: 0 }, expand: noExpand(), xp: 0, lv: 1, xpDay: '', ach: {}, title: null, stats: { hatch: 0, grown: 0, pet: 0, feed: 0, plant: 0, days: 0, lights: 0, roof: 0 }, candy: B.candy.free, unlocked: [HABITATS[0].id], flags: {}, myth: {}, visit: blank(), sky: skyBlank(), seenProps: PROPS.map(p => p.id), since: now, mailGot: [], codes: [], giftEggs: 0, attend: { day: '', at: 0, n: 0 }, first: {}, cards: [], strolls: 0, scenes: {}, looks: {}, events: {}, fossil: { at: 0 }, pals: palBlank(), art: artBlank(), wild: wildBlank() }; // seenProps: 꾸미기's red dot for props an update adds (an older save gets today's list from here)
  const first = HABITATS[0];
  S.nests[first.id] = { t: now, eggs: Array.from({ length: B.nest.start }, () => egg(S, first.nest, B.nest.startRarity)) };
  S.guests = guestsBlank(S); // 66-1
  return S;
}

// Saved JSON -> state, or null (then the caller starts a new game). Missing fields get defaults.
// 27-1: a field of the wrong type gets its default too (a hand-edited backup, a broken write); anything else that would
// throw here or in the first catch-up (tried on a copy) makes the whole save unreadable instead of a game that dies on start.
const shape = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v, isObj = v => shape(v) === 'object';
export function fromSave(raw, now) {
  if (!raw || typeof raw !== 'object' || !(raw.schemaVersion >= 1) || raw.schemaVersion > SCHEMA_VERSION) return null;
  try {
    const T = newGame(now), S = { ...T };
    for (const [k, v] of Object.entries(raw)) if (!(k in T) || T[k] === null || shape(v) === shape(T[k])) S[k] = v;
    S.animals = S.animals.filter(isObj); S.props = S.props.filter(isObj);
    for (const [h, n] of Object.entries(S.nests)) if (!isObj(n) || !Array.isArray(n.eggs)) delete S.nests[h]; else n.eggs = n.eggs.filter(isObj); // advance lays it again
    S.slots = Array.from({ length: Math.max(B.slots, S.slots.length) }, (_, i) => isObj(S.slots[i]?.egg) ? S.slots[i] : null);
    for (let v = raw.schemaVersion + 1; v <= SCHEMA_VERSION; v++) MIGRATIONS[v]?.(S, now); // each step in order, oldest first
    for (const a of S.animals) { const n = cleanName(a.nm); if (n) a.nm = n; else delete a.nm; if (a.fav !== true) delete a.fav; if (!(Array.isArray(a.home) && a.home.length === 2 && a.home.every(v => Number.isFinite(v) && Math.abs(v) < 1e3))) delete a.home; if (a.wd != null && !GUESTS.some(R => R.k === a.wd)) delete a.wd; } // 26-4: a backup code is text from outside; 53 home; 66-2 wd
    tidy(S); // 28-5
    for (const [h, L] of Object.entries(S.lays)) if (!Array.isArray(L)) delete S.lays[h]; else S.lays[h] = LAY_NAMES.map((_, i) => isObj(L[i]) && typeof L[i].c === 'string' ? { n: cleanName(L[i].n) || LAY_NAMES[i], c: L[i].c, at: L[i].at } : null);
    if (!Number.isFinite(raw.since)) S.since = Math.min(now, ...Object.values(S.codex).map(e => e?.at), ...S.animals.map(a => a.born)) || now; // 41: before 0.71, the first animal
    S.mailGot = S.mailGot.filter(x => typeof x === 'string'); S.codes = S.codes.filter(x => typeof x === 'string'); S.giftEggs = Math.min(99, Math.max(0, Math.floor(S.giftEggs) || 0)); // 44
    { const A = S.attend; S.attend = { day: typeof A.day === 'string' ? A.day : '', at: Number.isFinite(A.at) ? A.at : 0, n: Number.isInteger(A.n) && A.n >= 0 ? A.n : 0 }; } // 41 C
    S.first = Object.fromEntries(Object.entries(S.first).filter(([, v]) => Number.isFinite(v))); // 41 D
    S.looks = Object.fromEntries(Object.entries(S.looks).filter(([k]) => Object.hasOwn(PROP, k)).map(([k, v]) => [k, (Array.isArray(v) ? v : []).filter(c => paletteOf(PROP[k])?.[c]?.[2])]).filter(([, v]) => v.length)); // 13-3
    S.cards = S.cards.filter(isObj).slice(-B.stroll.cards); S.strolls = Math.max(0, Math.floor(S.strolls) || 0); // 13-1
    S.scenes = Object.fromEntries(Object.entries(S.scenes).filter(([k, v]) => SCENES.some(s => s.id === k) && isObj(v) && Number.isFinite(v.at)).map(([k, v]) => [k, { at: v.at, sp: Object.hasOwn(SP, v.sp) ? v.sp : null }])); // 13-2
    for (const a of S.animals) if (a.stroll != null && !(isObj(a.stroll) && B.stroll.hours.includes(a.stroll.h) && Number.isFinite(a.stroll.end) && (PLACES.some(p => p.id === a.stroll.pl) || a.stroll.pl === MY.place.id))) { delete a.stroll; a.stored = true; } // a broken walk: it waits in storage
    S.fossil = { at: Number.isFinite(S.fossil.at) ? Math.min(S.fossil.at, now) : 0 }; // 14-3
    S.myth = Object.fromEntries(Object.entries(S.myth).filter(([k, v]) => k === 'bondDay' ? typeof v === 'string' : MYTH_T.includes(k) && Number.isFinite(v))); // 14-1
    { const n = v => Math.max(0, Math.floor(v) || 0); // 15-1: runs of events this build knows
      S.events = Object.fromEntries(Object.entries(S.events).filter(([, R]) => isObj(R) && EV[R.id] && Number.isFinite(R.start) && Number.isFinite(R.end)).map(([k, R]) => [k, { ...R,
        c: n(R.c), got: n(R.got), step: Math.min(n(R.step), EV[R.id].track.length), pets: n(R.pets), dayAt: n(R.dayAt), day: typeof R.day === 'string' ? R.day : '',
        buy: isObj(R.buy) ? Object.fromEntries(Object.entries(R.buy).map(([k, v]) => [k, n(v)])) : {}, shots: isObj(R.shots) ? R.shots : {},
        pile: typeof R.pile === 'string' ? R.pile : '', pileAt: n(R.pileAt), built: n(R.built), luck: n(R.luck) }]));
      const own = evOwned(S); // 15-2: worn event wear, known ones, no more of each than bought
      for (const a of S.animals) if (a.wear != null) { a.wear = Array.isArray(a.wear) ? [...new Set(a.wear)].filter(k => EV_ACC[k] && own[k]-- > 0) : []; if (!a.wear.length) delete a.wear; } }
    tidyVisit(S); tidySky(S); tidyPals(S); tidyGuests(S); tidyArt(S); tidyWild(S); // 16-1, 16-2, 17-1, 66-1, 17-2, 17-3
    S.schemaVersion = SCHEMA_VERSION; S.contentVersion = CONTENT_VERSION; // keys added since are not in `seen`: they show NEW
    settle(S);
    advance(structuredClone(S), now, () => 0.5);
    return S;
  } catch { return null; }
}
// Save migrations: MIGRATIONS[v] turns a v-1 save into a v save. A new save shape = SCHEMA_VERSION + 1 in data.js and a
// step here (fields that only need a default don't need one: newGame fills them). 1 and 2 had no steps.
const MIGRATIONS = { 3: to3, 4: to4, 5: to5, 6: to6, 7: to7, 8: to8, 9: to9, 10: to10, 11: to11 }; // 4: animals over the new room go to storage on the first advance
// 2 -> 3 (16-2): 대리석 left the launch list (-> 유리), 황금 too (-> the species' remaining legendary); every animal gets
// its variant's first colour, which also counts as seen. Codex entries move with them (the earliest date wins).
function to3(S) {
  const fix = (sp, v) => v === 'marble' ? 'glass' : v === 'gold' ? SP[sp]?.legendary[0]?.id ?? v : v;
  const move = k => { const [sp, v] = k.split(':'); return key(sp, fix(sp, v)); };
  const codex = {};
  for (const [k, e] of Object.entries(S.codex)) { const n = move(k); if (!codex[n] || e.at < codex[n].at) codex[n] = e; }
  S.codex = codex; S.seen = [...new Set(S.seen.map(move))]; S.colors = {};
  for (const e of Object.values(S.album)) e.variant = fix(e.species, e.variant);
  for (const a of S.animals) { a.variant = fix(a.species, a.variant); a.color = colorsOf(a.species, a.variant)[0]?.id ?? null; }
  for (const k of [...Object.keys(S.codex), ...S.animals.map(a => key(a.species, a.variant))]) {
    const [sp, v] = k.split(':'), c = colorsOf(sp, v)[0]; if (c) S.colors[k] = [c.id];
  }
}

// 3 -> 4 (16-3): colour ids renamed with their new looks (글리터 금빛 -> 보랏빛, 호박 젤리 노란 -> 꿀빛); display and props start empty.
function to4(S) {
  const ren = { glitter: { gold: 'violet' }, amber: { yellow: 'honey' } }, fix = (v, c) => ren[v]?.[c] ?? c;
  for (const a of S.animals) a.color = fix(a.variant, a.color);
  for (const [k, cs] of Object.entries(S.colors)) S.colors[k] = [...new Set(cs.map(c => fix(k.split(':')[1], c)))];
}

// 4 -> 5 (inbox 14): growing is a gauge. A baby's gauge = the share of the old 30 minutes it has had (the feed it may still have
// needed is no longer asked: one past 30 minutes grows on the first advance); feeds start again. Codex entries so far were all
// registered grown up (adult = at); a baby out or in storage registers its cell now. Every save gets the free 꼬마 사탕 (newGame).
function to5(S, now) {
  for (const e of Object.values(S.codex)) e.adult ??= e.at;
  for (const a of S.animals) {
    if (a.stage === 'baby') { a.g = a.pending ? 0 : Math.min(1, Math.max(0, now - a.born) / (30 * 60 * 1000)); a.gAt = now; }
    a.fed = 0; delete a.fedAt;
    if (!a.pending && known(a)) register(S, a, a.born);
  }
}

// 5 -> 6 (21-3b): every habitat starts not expanded.
function to6(S) { S.expand = { ...noExpand(), ...(S.expand || {}) }; }

// 6 -> 7 (22-1): no habitat's own trees, bushes, rocks and flowers are props yet (natives: rings done per habitat), no ground
// painted. The next time each habitat opens, its build hands them over as they stand (addNatives), at its 땅 넓히기 step.
function to7(S) { S.natives = {}; S.paint = {}; S.props = S.props.filter(p => !p.nat); }

// 7 -> 8 (23-1): the XP its codex would have given (each cell, each grown-up look), at that level without a card. What it has
// stays; buying more waits for the level as in a new game.
function to8(S) {
  const X = B.level.xp, cells = Object.values(S.codex);
  S.xp = cells.length * X.codex + cells.filter(e => e.adult != null).length * X.grown; S.lv = gardenLevel(S.xp); S.xpDay = '';
}

// 8 -> 9 (23-2): the 도전 과제 counts from what the save still shows (at least: ones sent back are gone). The goals it has met
// are done at the next advance (their XP too, one toast).
function to9(S) {
  const c = Object.values(S.codex);
  S.stats = { ...S.stats, hatch: Math.max(S.animals.length, c.length), grown: Math.max(S.animals.filter(a => a.stage === 'adult').length, c.filter(e => e.adult != null).length), days: S.xpDay ? 1 : 0 };
}
// 9 -> 10 (28-1): a 땅 넓히기 step opens a named zone along one side (zones.js), no longer a ring round the board. The
// meadow's own trees etc. past the first board go (its build plants the zones' anew: natives back to 1); in every habitat a
// prop past the open ground now, or in a zone's water, is put away (storage), and paint past the open ground goes.
function to10(S) {
  for (const hab of Object.keys(S.expand || {}).filter(h => ZONES[h])) { // a habitat not out yet (dino) has no zones
    const L = S.expand[hab] || 0, O = rectAt(hab, L), Z = zoneSet(hab, L), u = UNIT; // inbox 42 A: the zones in the world's metres, UNIT x the save's
    S.props = S.props.filter(p => !(p.nat && p.hab === hab && !inRect(BOARD0, p.x * u, p.z * u)));
    if (S.natives?.[hab] > 1) S.natives[hab] = 1;
    for (const p of S.props) if (p.hab === hab && p.placed && !p.nat && (!inRect(O, p.x * u, p.z * u, 0.5) || Z.wd(p.x * u, p.z * u, true) < (PROP[p.prop]?.r ?? 1) * sizeF(PROP[p.prop], p.sz))) p.placed = false;
    const P = S.paint?.[hab]; if (P) for (const k of Object.keys(P)) { const [i, j] = k.split(',').map(Number); if (!inRect(O, (i + 0.5) * u, (j + 0.5) * u)) delete P[k]; }
  }
}
// 10 -> 11 (inbox 42 A): the first board 1.5x (data.js UNIT). x, z stay in the old board's metres, the world is UNIT x them, so
// the board's own things (its trees, the paint's cells) stand where they stood on it. Props that touch (a fence line, a table
// and its chairs, a rail loop) would spread apart: each such group keeps its shape and moves as one, its middle where the
// middle is now (rails by whole tiles, train.js TILE); the meadow pond's water props stay in it (it moved, it did not grow).
// What still does not fit (water, a wall) the habitat moves on its first visit (S.refit: habitat.js refit)
export const MEADOW_POND = [9, 13]; // meadow/layout.js pond, in the old board's metres
function to11(S) {
  const k = UNIT - 1, g4 = v => Math.round(v / 4) * 4, R = p => (PROP[p.prop].r || 1) * sizeF(PROP[p.prop], p.sz);
  for (const hab of new Set(S.props.map(p => p.hab))) {
    const mine = S.props.filter(p => p.hab === hab && p.placed && !p.nat && p.on == null && PROP[p.prop]), groups = [];
    for (const p of mine) { const near = groups.filter(g => g.some(q => Math.hypot(q.x - p.x, q.z - p.z) < R(p) + R(q) + 0.6)); const g = [p, ...near.flat()]; for (const n of near) groups.splice(groups.indexOf(n), 1); groups.push(g); }
    for (const g of groups) {
      const pond = hab === 'meadow' && g.every(p => PROP[p.prop].water), rail = g.some(p => PROP[p.prop].rail);
      let [cx, cz] = pond ? MEADOW_POND : [g.reduce((a, p) => a + p.x, 0) / g.length, g.reduce((a, p) => a + p.z, 0) / g.length], dx = cx * k, dz = cz * k;
      if (rail) { dx = g4(dx); dz = g4(dz); }
      for (const p of g) { p.x = +((p.x + dx) / UNIT).toFixed(4); p.z = +((p.z + dz) / UNIT).toFixed(4); }
    }
  }
  tidy(S); // the ones on top of another prop: onto its spot again
  S.refit = Object.keys(ZONES);
}
export const bump = (S, k) => { S.stats ??= {}; S.stats[k] = (S.stats[k] || 0) + 1; };

const pick = (items, weight, rng) => {
  let sum = 0; for (const it of items) sum += weight(it);
  let r = rng() * sum; for (const it of items) if ((r -= weight(it)) < 0) return it;
  return items[items.length - 1];
};
export const rollRarity = (odds, rng) => pick(RARITIES.filter(r => odds[r.id] > 0), r => odds[r.id], rng).id;
const egg = (S, type, rarity) => ({ id: S.nextId++, type, rarity, parents: [null, null] });
export const layEgg = (S, type, rng) => egg(S, type, rollRarity(EGG[type].odds, rng));

// weights inside a species x rarity (BALANCE.tierWeight) and inside a variant's colours (BALANCE.color)
export const tierWeight = v => B.tierWeight[v.rarity]?.[v.tier || 'normal'] ?? 1;
export const colorWeight = c => c.seldom ? B.color.seldom : B.color.normal;
const rollColor = (spId, vId, rng) => { const cs = colorsOf(spId, vId); return cs.length ? pick(cs, colorWeight, rng).id : null; };

// Props a species likes (PROPS effect), placed in the habitat whose nest lays this egg type: that species' weight (BALANCE.attract).
// Only the species pick: rarity odds, variants and colours are never touched.
export function attract(S, type) {
  const h = HABITATS.find(h => h.nest === type), w = {};
  for (const p of S?.props || []) { const e = p.placed && p.hab === h?.id && PROP[p.prop]?.effect; if (e) w[e] = (w[e] || 0) + 1; }
  for (const sp in w) w[sp] = 1 + Math.min(B.attract.max, w[sp] * B.attract.per);
  return w;
}
const spWeight = (w, sp) => w[sp.id] ?? 1;

// Who can come out of an egg of this type and rarity: species by weight (even without props), then variants by tier weight within the species.
// A species with no variant of that rarity (e.g. no legendary yet) sits it out; if nobody has one, any variant.
function hatchPool(type, rarity) {
  const pool = EGG[type].species.map(id => SP[id]).filter(Boolean);
  const has = pool.filter(sp => variantsOf(sp).some(v => v.rarity === rarity));
  return (has.length ? has : pool).map(sp => {
    const vs = variantsOf(sp).filter(v => v.rarity === rarity);
    return { sp, vs: vs.length ? vs : variantsOf(sp) };
  });
}
const owned = (S, k) => !!S.codex[k] || S.animals.some(a => key(a.species, a.variant) === k);
// 69-1 전설 중복 보호 (RARITIES guard): while a look of that rarity is missing, only the missing ones, each at its usual share
// (species weight x its tier share); all owned: the table as is. The rarity itself was rolled before (odds and gauges unchanged).
const tw = vs => vs.reduce((s, v) => s + tierWeight(v), 0);
function guarded(S, pool) {
  const miss = pool.map(x => ({ ...x, all: x.vs, vs: x.vs.filter(v => !owned(S, key(x.sp.id, v.id))) })).filter(x => x.vs.length);
  return miss.length ? miss : pool;
}
export function rollHatch(S, e, rng) {
  let pool = hatchPool(e.type, e.rarity); const w = attract(S, e.type); if (!pool.length) return null;
  if (RAR[e.rarity]?.guard) pool = guarded(S, pool);
  const { sp, vs } = pick(pool, x => spWeight(w, x.sp) * (x.all ? tw(x.vs) / tw(x.all) : 1), rng);
  const pm = B.preferMissing, v = pick(vs, v => tierWeight(v) * (pm.on && !owned(S, key(sp.id, v.id)) ? pm.weight : 1), rng);
  return { species: sp.id, variant: v.id };
}
// Probability table of an egg type (for the ?debug screen; later the public odds page). Same pool as rollHatch, preferMissing off,
// nothing owned (69-1: a guard rarity then gives the missing looks first; oddsInfo.guard says how many this save still has to get).
// colors: each colour's share inside its variant. S: count that save's placed props (attract); without it, no props.
export function eggTable(type, S) {
  const aw = attract(S, type);
  const T = EGG[type], sum = RARITIES.reduce((s, r) => s + (T.odds[r.id] || 0), 0);
  return RARITIES.filter(r => T.odds[r.id] > 0).map(r => {
    const p = T.odds[r.id] / sum, pool = hatchPool(type, r.id), sw = pool.reduce((s, x) => s + spWeight(aw, x.sp), 0);
    return { rarity: r, p, hatch: B.hatch[r.id] * T.hatchScale,
      variants: pool.flatMap(({ sp, vs }) => {
        const w = vs.reduce((s, v) => s + tierWeight(v), 0);
        return vs.map(v => {
          const cs = colorsOf(sp.id, v.id), cw = cs.reduce((s, c) => s + colorWeight(c), 0);
          return { species: sp, variant: v, p: p * spWeight(aw, sp) / sw * tierWeight(v) / w, colors: cs.map(c => ({ color: c, p: colorWeight(c) / cw })) };
        });
      }) };
  });
}

// Shard gauges (BALANCE.pity) of an egg type, and the rarity they guarantee for the next egg (the rarest full one) or null.
// 75: each egg kind has its own gauges (data.js EGG_TYPES pity; today all BALANCE.pity)
export const pityOf = type => EGG[type]?.pity ?? B.pity;
export const shards = (S, type) => Object.fromEntries(Object.keys(pityOf(type)).map(k => [k, S.pity[type]?.[k] || 0]));
export function sureRarity(S, type) {
  const P = shards(S, type); let top = null;
  const T = pityOf(type);
  for (const k in T) if (P[k] >= T[k] && (!top || RANK[k] > RANK[top])) top = k;
  return top;
}

// Crack an egg: its rarity (raised to the guaranteed one when a gauge is full), the variant, its colour, the gauges, the secret accessory.
// A guaranteed rarity picks evenly among that rarity's variants nobody has yet (all of them if none is missing); tiers don't count there.
// Gauges: +1 each, except a gauge whose rarity (or better) came out, which empties. Every egg counts, the first one too.
export function crack(S, e, now, rng = Math.random, forced = false) { // forced: a secret for sure (?debug 다음 알 시크릿, game.hatch)
  const top = e.gift ? null : sureRarity(S, e.type), sure = !!top && RANK[top] >= RANK[e.rarity], rarity = sure ? top : e.rarity; // 44: a gift egg leaves the gauges alone
  let r;
  if (sure || e.gift) { // 93-1: a gift egg (no pity) also picks one not owned yet first
    const all = hatchPool(e.type, rarity).flatMap(({ sp, vs }) => vs.map(v => ({ species: sp.id, variant: v.id })));
    const miss = all.filter(p => !owned(S, key(p.species, p.variant))), from = miss.length ? miss : all;
    r = from[Math.floor(rng() * from.length)];
  } else r = rollHatch(S, e, rng);
  if (!r) return null;
  r = { ...r, color: rollColor(r.species, r.variant, rng) };
  const before = shards(S, e.type), P = e.gift ? { ...before } : S.pity[e.type] = { ...before };
  if (!e.gift) for (const k in pityOf(e.type)) P[k] = RANK[rarity] >= RANK[k] ? 0 : P[k] + 1;
  const accs = Object.keys(ACCESSORIES);
  const acc = (forced || rng() < B.secret.chance) ? accs[Math.floor(rng() * accs.length)] : null;
  const newAcc = !!acc && !S.album[acc]; // first time this accessory turns up: the reveal card says 새 치장!
  if (newAcc) S.album[acc] = { species: r.species, variant: r.variant, color: r.color, at: now };
  return { ...r, rarity, sure, acc, newAcc, shards: { before, after: { ...P } } };
}

// Everything an egg type can give, in one place: the ?debug screen now, the public odds page when eggs are sold.
// segments: odds of the next egg in each gauge state. Under a full gauge, the rarities below it become that rarity and
// the ones above keep their odds; a guaranteed rarity picks variants not owned yet first. Otherwise variants are even.
export function oddsInfo(type, S) {
  const base = eggTable(type, S), PT = pityOf(type), keys = Object.keys(PT).sort((a, b) => RANK[a] - RANK[b]);
  const seg = k => base.map(r => {
    const i = RANK[r.rarity.id], p = !k || i > RANK[k] ? r.p : i < RANK[k] ? 0 : base.filter(b => RANK[b.rarity.id] <= i).reduce((s, b) => s + b.p, 0);
    return { rarity: r.rarity, p, missingFirst: !!k && i === RANK[k] };
  }).filter(r => r.p > 0);
  const accs = Object.entries(ACCESSORIES);
  return {
    egg: EGG[type], base,
    segments: [{ when: null, odds: seg(null) }, ...keys.map(k => ({ when: RAR[k], target: PT[k], odds: seg(k) }))],
    gauges: keys.map(k => ({ rarity: RAR[k], target: PT[k], have: S ? shards(S, type)[k] : 0 })),
    guard: RARITIES.filter(r => r.guard).map(r => { const pool = hatchPool(type, r.id), g = S ? guarded(S, pool) : pool;
      return { rarity: r, all: pool.reduce((n, x) => n + x.vs.length, 0), missing: g === pool && S ? 0 : g.reduce((n, x) => n + x.vs.length, 0) }; }),
    secret: { chance: B.secret.chance, accessories: accs.map(([id, a]) => ({ id, name: a.name, p: B.secret.chance / accs.length })) },
  };
}

// Growing up (inbox 14): a baby's gauge fills in BALANCE.grow.time (its variant's rarity) while it is out: not on the reveal card,
// not in storage, not held by a 꼬마 사탕. Petting (a tap that gives a heart) and feeding add to it. a.g is the gauge as of a.gAt:
// bank() before anything that starts or stops it.
export const growTime = a => B.grow.time[variantOf(a.species, a.variant)?.rarity] ?? B.grow.time.common;
export const growing = a => a.stage === 'baby' && !a.pending && !a.stored && !a.hold;
export const gauge = (a, now) => Math.min(1, (a.g || 0) + (growing(a) ? Math.max(0, now - (a.gAt ?? now)) / growTime(a) : 0));
const bank = (a, now) => { a.g = gauge(a, now); a.gAt = now; };
// the codex cell of an animal that is now the player's (out of the reveal card, or found in an old save): registered, NEW.
// gift (inbox 38): out of the reveal card, a cell filled for the first time gives B.codexHeart hearts (not an old save, not growing up)
function register(S, a, at, gift) {
  const k = key(a.species, a.variant), h = HABITATS.find(x => x.nest === a.egg)?.id; if (S.codex[k]) return false;
  S.codex[k] = h ? { at, h } : { at }; S.seen = S.seen.filter(x => x !== k); S.xp += B.level.xp.codex; if (gift) S.hearts += B.codexHeart; return true;
}

// inbox 31: the time between nest eggs. A new game's first BALANCE.nest.early.n eggs (hatched, in a slot or in a nest) come faster
const had = S => (S.stats?.hatch || 0) + S.slots.filter(Boolean).length + Object.values(S.nests).reduce((s, n) => s + n.eggs.length, 0);
export const eggGap = S => [].concat(B.nest.early).find(t => had(S) < t.n)?.every ?? B.nest.every; // early: one step or a list of them (41 D)
// Catch up to `now`: nests lay, babies whose gauge is full grow up (their adult look goes in the codex),
// storage keeps each habitat at maxVisible, habitats unlock. Returns what happened, for the UI.
export function advance(S, now, rng = Math.random) {
  const ev = [];
  for (const h of HABITATS) {
    if (!h.nest || !h.ready || !S.unlocked.includes(h.id)) continue;
    const n = S.nests[h.id] ??= { t: now, eggs: [] };
    if (n.t > now) n.t = now; // clock went back
    for (let g; n.eggs.length < B.nest.max && now - n.t >= (g = eggGap(S)); ) { n.t += g; n.eggs.push(layEgg(S, h.nest, rng)); ev.push({ type: 'egg', habitat: h.id }); }
    if (n.eggs.length >= B.nest.max) n.t = now; // a full nest doesn't bank time
  }
  strollBack(S, now, ev, rng);
  for (const a of S.animals) {
    if (!growing(a) || gauge(a, now) < 1) continue;
    a.adultAt = Math.min(now, (a.gAt ?? now) + Math.max(0, 1 - (a.g || 0)) * growTime(a)); // when it filled (offline: earlier)
    a.stage = 'adult'; a.g = 1; a.card = true;
    register(S, a, a.adultAt); const e = S.codex[key(a.species, a.variant)], isNew = e.adult == null; if (isNew) e.adult = a.adultAt;
    S.xp += B.level.xp.grown; bump(S, 'grown'); ev.push({ type: 'grown', animal: a, isNew });
  }
  ev.push(...enforceCap(S));
  HABITATS.forEach((h, i) => { if (i && h.ready && !S.unlocked.includes(h.id) && unlockInfo(S, h.id).met) { S.unlocked.push(h.id); settle(S);
    if (h.nest && h.ready && !S.nests[h.id]) S.nests[h.id] = { t: now, eggs: Array.from({ length: B.nest.onUnlock }, () => layEgg(S, h.nest, rng)) }; // inbox 31: eggs to start with
    ev.push({ type: 'unlock', habitat: h.id }); } });
  const day = dayOf(now); if (S.xpDay !== day) { S.xpDay = day; S.xp += B.level.xp.login; bump(S, 'days'); } // the day's first visit (or the game left open past midnight)
  for (const a of newlyDone(S)) { S.ach = { ...S.ach, [a.id]: now }; S.xp += B.level.xp.achieve; ev.push({ type: 'achieve', id: a.id }); } // 23-2
  wholeTick(S, ev); // 66-3
  firstCheck(S, now, ev, rng); // 41 D
  evTick(S, now, rng); // 15-1
  mythTick(S, now, ev); // 14-1
  visitTick(S, now, ev); // 16-1
  palTick(S, now, ev); // 17-1
  artTick(S, now, ev); // 17-2
  wildTick(S, now, ev); // 17-3
  const L = gardenLevel(S.xp); if (L > S.lv) { ev.push({ type: 'level', from: S.lv, level: L, unlocks: unlocksBetween(S.lv, L) }); S.lv = L; }
  return ev;
}

// 23-1 정원사 레벨 (BALANCE.level): the level of this much XP, the XP a level starts at, what a level lets the player buy
const LV = B.level;
export const xpAt = L => L <= LV.at.length ? LV.at[L - 1] : LV.at.at(-1) + (L - LV.at.length) * LV.after;
export const gardenLevel = xp => { let L = 1; while (L < LV.at.length && xp >= LV.at[L]) L++; return L < LV.at.length ? L : L + Math.floor((xp - LV.at.at(-1)) / LV.after); };
const SET_OF = Object.fromEntries(SETS.flatMap(s => s.props.map(p => [p, s.id])));
const NEED = Object.fromEntries(Object.entries(LV.unlock).flatMap(([L, list]) => list.map(k => [k, +L])));
export const needFor = k => { const [kind, id] = k.split(':'); return NEED[k] ?? (kind === 'prop' && SET_OF[id] ? NEED['set:' + SET_OF[id]] : null) ?? 1; }; // 'prop:barn', 'brush:sand', 'expand:3'
export const can = (S, k) => gardenLevel(S.xp || 0) >= needFor(k);
export const unlocksBetween = (from, to) => Object.entries(LV.unlock).filter(([L]) => +L > from && +L <= to).flatMap(([, list]) => list);

// Habitat cap: maxVisible animals out, and each zone's room (HABITATS room: every animal counts at its adult body size),
// both grown by 땅 넓히기 (BALANCE.expand).
export const levelOf = (S, habId) => S.expand?.[habId] || 0;
export const capOf = (S, habId) => { const L = levelOf(S, habId); return L ? B.expand.visible[L - 1] : B.maxVisible; };
export const decorCap = (S, habId) => { const L = levelOf(S, habId); return L ? B.expand.decor[L - 1] : B.decor.max; }; // props placed at once
export const roomOf = (S, h, zone) => { const L = levelOf(S, h.id), r = h.room?.[zone]; return r == null ? null : r * (L ? B.expand.room[L - 1] : 1); };
export const zoneOf = a => MODELS[SP[a.species]?.model]?.move;
export const need = a => { const m = MODELS[SP[a.species]?.model]; return m ? bodyArea(m.adult) : 0; };
export const outIn = (S, habId) => S.animals.filter(a => !a.stored && !a.pending && known(a) && habitatOf(a) === habId);
const used = (out, zone) => out.reduce((s, b) => s + (zoneOf(b) === zone ? need(b) : 0), 0);
const over = (S, h, out, zone) => { const r = roomOf(S, h, zone); return r != null && used(out, zone) > r + 1e-6; };
// can `a` come out into its habitat now (from the reveal card or storage)?
// A home not open yet (a pond hatchling while the pond is shut, inbox 20) never fits: it waits in storage. Guests have a.hab.
export function fits(S, a) {
  const h = HAB[habitatOf(a)], out = outIn(S, h?.id).filter(b => b !== a);
  return !!h && S.unlocked.includes(h.id) && out.length < capOf(S, h.id) && !over(S, h, [...out, a], zoneOf(a));
}
// Over the cap in a habitat (an old save, a smaller room): the oldest adults go to storage (still in the codex), from the zone
// that is over first. Babies always stay out; pending ones aren't out yet.
function enforceCap(S) {
  const ev = [];
  for (const h of HABITATS) {
    const out = outIn(S, h.id), adults = out.filter(a => a.stage === 'adult').sort((a, b) => a.adultAt - b.adultAt);
    for (;;) {
      const zone = ['swim', 'walk'].find(z => over(S, h, out, z));
      if (!zone && out.length <= capOf(S, h.id)) break;
      const i = adults.findIndex(a => !zone || zoneOf(a) === zone); if (i < 0) break;
      const [a] = adults.splice(i, 1); out.splice(out.indexOf(a), 1); a.stored = true; delete a.home; ev.push({ type: 'stored', animal: a });
    }
  }
  return ev;
}

// Next habitat's lock: the previous one's codex share + hearts (a threshold, not spent). Once open, open for good.
export function unlockInfo(S, habId) {
  const i = HABITATS.findIndex(h => h.id === habId), prev = HABITATS[i - 1];
  if (i <= 0) return { open: true, met: true };
  const cells = codexCells(prev.id).length, have = codexCells(prev.id).filter(c => S.codex[c.key]).length;
  const need = Math.ceil(cells * B.unlock.codex), friends = i === 1 ? B.unlock.friends : null, got = S.stats?.hatch || 0; // 92-2: the second habitat also at `friends` hatched
  return { open: S.unlocked.includes(habId), met: cells > 0 && have >= need && S.hearts >= B.unlock.hearts || friends > 0 && got >= friends, prev, have, need, hearts: B.unlock.hearts, friends, got };
}

// Player actions. Each returns something falsy when it can't happen.
// An egg from the nest (that one, or the oldest) into the first empty hatch slot.
export const firstEgg = S => !S.stats.hatch && !S.animals.length && S.slots.every(s => !s); // inbox 61 B: nothing hatched yet, nothing in a slot
export function takeEgg(S, habId, now, eggId) {
  const n = S.nests[habId], i = S.slots.indexOf(null), j = !n ? -1 : eggId == null ? 0 : n.eggs.findIndex(e => e.id === eggId);
  if (j < 0 || j >= n.eggs.length || i < 0) return -1;
  if (n.eggs.length >= B.nest.max) n.t = now; // the hour to the next egg starts now
  const [e] = n.eggs.splice(j, 1);
  const first = firstEgg(S); // inbox 61 B: a new save's very first egg is ready at once (바로 깨기), and the next one is laid now
  if (first) n.t = Math.min(n.t, now - eggGap(S)); // (「둥지에 다음 알이 있어요」); from the second on, the usual waits
  const fast = B.nest.fast?.[(S.stats.hatch || 0) + S.slots.filter(Boolean).length]; // 92-1: a new save's first eggs (hatched + in slots before this one)
  S.slots[i] = { egg: e, start: now, end: first || e.now ? now : now + (fast ?? B.hatch[e.rarity] * (EGG[e.type]?.hatchScale ?? 1)) };
  return i;
}
// A ready slot cracks. The animal waits (pending) for the reveal card's answer, so a reload shows the same card again.
// Its colour counts as seen now (the card is what shows it), so sending it back keeps the colour; newColor marks the card.
export function hatch(S, i, now, rng = Math.random, forced = false) {
  const s = S.slots[i]; if (!s || now < s.end) return null;
  const c = crack(S, s.egg, now, rng, forced); if (!c) return null;
  const a = { id: S.nextId++, species: c.species, variant: c.variant, color: c.color, acc: c.acc, egg: s.egg.type, parents: s.egg.parents, stage: 'baby', born: now,
    g: 0, gAt: now, fed: 0, adultAt: null, stored: false, heartAt: 0, pending: true };
  a.pe = peOf(a.id, now); // 17-1 성격
  const seen = a.color && (S.colors[key(a.species, a.variant)] ??= []);
  if (seen && !seen.includes(a.color)) { seen.push(a.color); a.newColor = true; }
  S.animals.push(a); S.slots[i] = null; bump(S, 'hatch');
  return { animal: a, ...c, egg: s.egg };
}
// reveal card: NEW = nobody like it yet; already in the codex = it may go back for hearts (from the card or storage)
export const isNew = (S, a) => !S.codex[key(a.species, a.variant)] && !S.animals.some(b => b !== a && !b.wd && b.species === a.species && b.variant === a.variant);
// 66-2: a settled guest (wd) is a friend, never sent back for hearts
export const canSendBack = (S, a) => !!(a?.pending || a?.stored) && !a.stroll && !a.wd && !!S.codex[key(a.species, a.variant)];
export const sendBackHearts = a => (B.sendBack[variantOf(a.species, a.variant)?.rarity] || 0) * (a.acc ? B.secret.sendBackX : 1);
// out into its habitat (growing starts now) if it fits, or into storage, or back for hearts (never shards)
// (both register its codex cell: it is the player's now)
export function release(S, id, now) {
  const a = S.animals.find(a => a.id === id && a.pending); if (!a || !fits(S, a)) return null;
  bank(a, now); a.pending = false; a.born = now; delete a.newColor; register(S, a, now, true);
  return { animal: a, events: enforceCap(S) };
}
// 보관함: from the reveal card (it is registered now) or from the habitat; growing waits while it is stored
export function store(S, id, now) {
  const a = S.animals.find(a => a.id === id && !a.stored); if (!a) return null;
  bank(a, now);
  if (a.pending) { a.pending = false; a.born = now; delete a.newColor; register(S, a, now, true); }
  a.stored = true; delete a.home; return a;
}
// inbox 53: where a hand put it inside a closed fence (habitat.js letGo: a land of ROOM or more, not the board's main one); null: none.
// walk.js starts it there while that is still such a land
export function setHome(S, id, home) {
  const a = S.animals.find(a => a.id === id); if (!a) return;
  if (home) a.home = home.map(v => Math.round(v * 10) / 10); else delete a.home;
}
export function unstore(S, id, now) {
  const a = S.animals.find(a => a.id === id && a.stored && !a.stroll); if (!a || !fits(S, a)) return null;
  bank(a, now); a.stored = false; return a;
}
// 13-1 산책: a friend (out or in storage, not on a walk) goes for B.stroll.hours h. While away it is stored (out of the habitat,
// not growing, not sent back) with a.stroll = { start, end, h, pl (PLACES id), ln (its line) }. At `end` advance pays once (the
// walk is gone after), writes a postcard in S.cards and puts it back out if it fits, else in storage. Clock back: end <= now + h
export const strollCap = S => B.stroll.slots.filter(([L]) => (S.lv || 1) >= L).at(-1)[1];
export const strolling = S => S.animals.filter(a => a.stroll);
export function sendStroll(S, id, h, now, rng = Math.random, pl = null) { // pl: 14-1 the 불의 언덕 (mythHill), else picked here
  const a = S.animals.find(a => a.id === id && !a.pending && !a.stroll && known(a));
  if (!a || !B.stroll.hours.includes(h) || strolling(S).length >= strollCap(S) || (pl != null && (pl !== MY.place.id || !mythHill(S)))) return null;
  bank(a, now); a.stored = true; delete a.home;
  a.stroll = { start: now, end: now + h * 3600e3, h, pl: pl ?? PLACES[Math.floor(rng() * PLACES.length)].id, ln: Math.floor(rng() * 3) };
  return a;
}
function strollBack(S, now, ev, rng) {
  for (const a of S.animals.filter(a => a.stroll).sort((a, b) => a.stroll.end - b.stroll.end)) {
    const w = a.stroll; w.end = Math.min(w.end, now + w.h * 3600e3); if (now < w.end) continue;
    const R = B.stroll, prop = rng() < R.prop[w.h] ? STROLL_PROPS[S.strolls % STROLL_PROPS.length] : null;
    const got = give(S, { hearts: R.hearts[w.h], candy: R.candy[w.h], prop }, now, rng, habitatOf(a));
    if (got.prop) S.strolls++;
    delete a.stroll; bank(a, w.end); a.stored = !fits(S, a);
    const card = { id: S.nextId++, a: a.id, sp: a.species, v: a.variant, c: a.color, acc: a.acc, st: a.stage, nm: callName(a), pl: w.pl, ln: w.ln, h: w.h, at: w.end, hearts: got.hearts, candy: got.candy, prop: got.prop, new: true };
    S.cards.push(card); if (S.cards.length > R.cards) S.cards.splice(0, S.cards.length - R.cards);
    ev.push({ type: 'strollBack', animal: a, card });
    if (w.pl === MY.place.id && S.myth.got && !S.myth.hair) { S.myth.hair = w.end; card.myth = MY.hair; ev.push({ type: 'myth', what: 'hair' }); } // 14-1
  }
}
// 14-1 신수의 부름 (data.js MYTHIC, PACE myth). S.myth: seen (the faint fire prints tapped), fire (a campfire out in the meadow
// since), trace (the burnt hoofprints came), got (they were tapped: page 1, the 옛 제단, the 불의 언덕 opens), hair / play / big
// (the altar's 3 lit), called (부르기), arrive (that night), here (it came), shown (its coming seen: the cutscene or 돌아왔어요),
// bond, bondDay, settled, read (pages read, bits). Timestamps but bond, read, bondDay. Not in S.animals: no seat, no 보관함, no
// walk, no send-back, never from an egg
const MY = MYTHIC[0], BIG_IDS = BIGS.split(' ');
const MYTH_T = ['seen', 'fire', 'trace', 'got', 'hair', 'play', 'big', 'called', 'arrive', 'here', 'shown', 'bond', 'settled', 'read'];
const at6 = (t, d) => { const x = new Date(t); x.setHours(6, 0, 0, 0); x.setDate(x.getDate() + d); return +x; }; // 06:00, d days after t's day
export const mythPrints = S => at6(S.since ?? 0, B.myth.day); // the faint fire prints show from then, no condition
export const mythNight = t => { const h = new Date(t).getHours(); return h >= 20 || h < 5; };
// null (nothing yet) | 'prints' | 'fire' (a campfire's night to wait) | 'trace' | 'altar' (the 3) | 'ready' (부르기) | 'called' | 'guest' | 'home'
export function mythStage(S, now) {
  const M = S.myth; if (HOLD.myth) return null; // inbox 65
  if (M.settled) return 'home'; if (M.here) return 'guest'; if (M.called) return 'called';
  if (M.got) return M.hair && M.play && M.big ? 'ready' : 'altar';
  if (M.trace) return 'trace'; if (M.seen) return 'fire';
  return now >= mythPrints(S) ? 'prints' : null;
}
export const mythHill = S => !!S.myth.got && !S.myth.hair && !S.animals.some(a => a.stroll?.pl === MY.place.id); // 불의 언덕 open (one walk at a time)
export const altarOf = S => S.props.find(p => p.prop === 'myth_altar' && p.placed && p.hab === MY.habitat);
const playNear = S => { const A = altarOf(S); return !!A && S.props.some(p => p.placed && p.hab === MY.habitat && PROP[p.prop]?.use && Math.hypot(p.x - A.x, p.z - A.z) < 12); };
function bondUp(S, now, ev) { // one a day (a pet, or a play prop near the altar on a day the game is open); days missed just wait
  const M = S.myth; M.bondDay = dayOf(now); M.bond = (M.bond || 0) + 1; ev.push({ type: 'myth', what: 'bond', n: M.bond });
  if (M.bond >= B.myth.guest) { M.settled = now; ev.push({ type: 'myth', what: 'settle' }); }
}
function mythTick(S, now, ev) {
  if (HOLD.myth) return; // inbox 65
  const M = S.myth, C = B.myth;
  if (M.seen && !M.trace) { // a campfire out through `nights` nights (offline too: nothing moves a prop then) -> the hoofprints at 06:00
    if (!S.props.some(p => p.placed && p.hab === MY.habitat && p.prop === 'campfire')) delete M.fire;
    else { if (!(M.fire <= now)) M.fire = now; const t = at6(M.fire, C.nights); if (now >= t) { M.trace = t; ev.push({ type: 'myth', what: 'trace' }); } }
  }
  if (M.got) { // scenes seen before count, and a 큰 소품 placed before (anywhere)
    if (!M.play && Object.keys(S.scenes).length >= MY.scenes) { M.play = now; ev.push({ type: 'myth', what: 'play' }); }
    if (!M.big && S.props.some(p => p.placed && !p.nat && BIG_IDS.includes(p.prop))) { M.big = now; ev.push({ type: 'myth', what: 'big' }); }
  }
  if (M.arrive && !M.here && now >= M.arrive) { M.here = M.arrive; ev.push({ type: 'myth', what: 'arrive' }); if (!C.guest) { M.settled = M.here; ev.push({ type: 'myth', what: 'settle' }); } }
  if (M.here && !M.settled && M.bondDay !== dayOf(now) && now >= M.here && playNear(S)) bondUp(S, now, ev);
}
export const putGift = (S, prop, at, ex = {}) => { // into the meadow's storage, then where the tap was if there is room
  const p = { uid: S.nextId++, prop, hab: MY.habitat, placed: false, x: 0, z: 0, rot: 0, ...ex }; S.props.push(p);
  return { uid: p.uid, prop, placed: !!at && !!placeProp(S, p.uid, at[0], at[1], 0) };
};
export function mythSeen(S, now, at = null) { // the fire prints tapped; a campfire given (nothing back for it) if the level doesn't sell one yet
  if (mythStage(S, now) !== 'prints') return null;
  S.myth.seen = now;
  return { gift: !can(S, 'prop:campfire') && !S.props.some(p => p.prop === 'campfire') ? putGift(S, 'campfire', at, { cost: 0 }) : null };
}
export function mythTrace(S, now, at = null) { // the burnt hoofprints tapped: page 1 and the 옛 제단
  if (mythStage(S, now) !== 'trace') return null;
  S.myth.got = now; const A = S.props.find(p => p.prop === 'myth_altar');
  return A ? { uid: A.uid, prop: A.prop, placed: A.placed } : putGift(S, 'myth_altar', at);
}
export function mythCall(S, now) { // 부르기: it comes this night (20:00, or now if it is night already)
  if (mythStage(S, now) !== 'ready') return null;
  const t = new Date(now); t.setHours(20, 0, 0, 0);
  const M = S.myth; M.called = now; M.arrive = mythNight(now) ? now : +t; return M.arrive;
}
export function mythPet(S, now) { // a guest's bond, once a day
  const M = S.myth; if (!M.here || now < M.here) return null; const events = [];
  if (!M.settled && M.bondDay !== dayOf(now)) bondUp(S, now, events);
  return { events, bond: M.bond || 0, settled: !!M.settled };
}
export const mythRead = (S, i) => { S.myth.read = (S.myth.read || 0) | 1 << i; return true; }; // page i: 0 the hoofprints, 1~3 the altar's 3, 4 settled
export const mythShown = (S, now) => { S.myth.shown = now; return true; };
// 13-2 놀이 장면: S.scenes { id: { at (first seen), sp (the friend in it) } }. scenesOf(e): the SCENES e is, e = { prop (its kind), sp (species on it),
// n (seats taken), night } from play.js's start, or { social (walk.js kind), night }. seeScene pays B.scene.hearts once
export const scenesOf = e => SCENES.filter(s => (s.prop ? s.prop === e.prop && !(s.n > (e.n || 0)) && (!s.sp || !!e.sp?.includes(s.sp)) : s.social === e.social)
  && (s.night == null || s.night === (e.night > 0.3)));
export function seeScene(S, id, sp, now) { if (S.scenes[id] || !SCENES.some(s => s.id === id)) return 0; S.scenes[id] = { at: now, sp: Object.hasOwn(SP, sp) ? sp : null }; S.hearts += B.scene.hearts; return B.scene.hearts; }
export const cardsSeen = S => { for (const c of S.cards) delete c.new; return true; };
// 진열장: the colour a codex cell's figure shows (one seen on a reveal card)
export function setDisplay(S, k, cId) {
  if (!S.colors[k]?.includes(cId)) return false;
  S.display[k] = cId; return true;
}
export const displayColor = (S, k) => S.display[k] ?? S.colors[k]?.[0] ?? null;
// 꾸미기: buy with hearts (put away), place/turn (free; where it may go is the habitat's layout.js), put away
export function buyProp(S, propId, habId) { // habId: where it was bought (a prop sold everywhere stays there)
  const P = PROP[propId], hab = P?.habitat ?? habId; if (!P || P.paid || P.gift || S.hearts < P.price || !hab || !(can(S, 'prop:' + P.id) || tutShop(S) === P.id)) return null; // 41: a gift one only comes as a gift; 66-1: the tutorial's 등불 before its Lv
  S.hearts -= P.price;
  const p = { uid: S.nextId++, prop: P.id, hab, placed: false, x: 0, z: 0, rot: 0 };
  S.props.push(p); return p;
}
// 13-3 오늘의 진열대: PACE shelf n of this habitat's props (open now; no gift, paid, rail or 지형 도장), a new display every
// `hours`, in a fixed order (by a hash of the id, never random); one at -off; every `every`-th display the next one shows a
// 진열대 색 (its palette's entries marked 1, in turn). Bought at that price; the colour then stays in its swatch (S.looks)
const hid = id => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export function shelfOf(S, habId, now) {
  const C = B.shelf, T = C.hours * 3600e3, k = Math.floor(now / T), ends = (k + 1) * T;
  const pool = PROPS.filter(P => (P.habitat ?? habId) === habId && !P.gift && !P.paid && !P.rail && !P.stamp && can(S, 'prop:' + P.id)).sort((a, b) => hid(a.id) - hid(b.id));
  const n = Math.min(C.n, pool.length), items = [];
  for (let i = 0; i < n; i++) { const P = pool[(k * C.n + i) % pool.length], off = i === k % n; items.push({ id: P.id, off, price: off ? Math.round(P.price * (1 - C.off)) : P.price }); }
  if (n && k % C.every === 0) { const it = items[(k + 1) % n], pal = paletteOf(PROP[it.id]) || [], xs = pal.map((e, c) => e[2] ? c : 0).filter(Boolean);
    if (xs.length) it.c = xs[Math.floor(k / C.every) % xs.length]; }
  return { k, ends, items };
}
export function buyShelf(S, habId, i, now) {
  const it = shelfOf(S, habId, now).items[i], P = it && PROP[it.id], hab = P?.habitat ?? habId; if (!P || S.hearts < it.price) return null;
  S.hearts -= it.price;
  const p = { uid: S.nextId++, prop: P.id, hab, placed: false, x: 0, z: 0, rot: 0 }; if (it.price !== P.price) p.cost = it.price;
  if (it.c) { p.c = it.c; const L = S.looks[P.id] || []; if (!L.includes(it.c)) { S.looks[P.id] = [...L, it.c]; p.nl = 1; } }
  S.props.push(p); return p;
}
// 땅 넓히기: the next step of an open habitat, for hearts
export const expPrice = (S, habId) => { const p = B.expand.price[levelOf(S, habId)]; return p != null && S.freeExp?.[habId] ? 0 : p; }; // 66-3: a free step (모으기 판)
export function buyExpand(S, habId) {
  const L = levelOf(S, habId), price = expPrice(S, habId), free = price === 0;
  if (!HAB[habId] || !S.unlocked.includes(habId) || price == null || S.hearts < price || !can(S, 'expand:' + (L + 1))) return null;
  S.hearts -= price; S.expand = { ...S.expand, [habId]: L + 1 }; if (free) S.freeExp = { ...S.freeExp, [habId]: S.freeExp[habId] - 1 };
  return { level: L + 1, events: [{ type: 'expand', habitat: habId, level: L + 1, free }] };
}
// 66-3 모으기 판: a habitat's whole, got / all: its egg cells, its 떠돌이 (GUESTS of the wanderer tier: settled), its 신수 (met)
export const wanderersOf = habId => GUESTS.filter(R => R.hab === habId && (R.tier ?? 'wanderer') === 'wanderer');
export function wholeOf(S, habId) {
  const cells = codexCells(habId), gs = wanderersOf(habId), m = !HOLD.myth && MYTHIC.find(m => m.habitat === habId);
  return { got: cells.filter(c => S.codex[c.key]).length + gs.filter(R => (S.guests?.big?.[R.k]?.s ?? 0) >= GUEST.big).length + (m && S.myth?.here ? 1 : 0), all: cells.length + gs.length + (m ? 1 : 0) };
}
// each COMPLETE step reached in an open habitat, once (S.whole[hab]: steps given): the prop to storage, or a free 땅 넓히기
function wholeTick(S, ev) {
  for (const h of HABITATS) { const R = COMPLETE[h.id]; if (!R || !S.unlocked.includes(h.id)) continue;
    const { got, all } = wholeOf(S, h.id), step = all ? COMPLETE.at.filter(a => got >= Math.ceil(a * all - 1e-9)).length : 0;
    for (let i = S.whole?.[h.id] || 0; i < step; i++) { const r = R[i]; S.whole = { ...S.whole, [h.id]: i + 1 };
      if (r === 'expand') S.freeExp = { ...S.freeExp, [h.id]: (S.freeExp?.[h.id] || 0) + 1 }; else S.props.push({ uid: S.nextId++, prop: r, hab: h.id, placed: false, x: 0, z: 0, rot: 0 });
      ev.push({ type: 'whole', habitat: h.id, step: i + 1, reward: r }); } }
}
export const placedIn = (S, habId) => S.props.filter(p => p.placed && p.hab === habId && !p.nat && !PROP[p.prop]?.rail && !PROP[p.prop]?.art); // what counts toward decorCap (natives, rails and 17-2 동물 작품 never)
// 28-4: rail pieces placed in a habitat (PROPS rail: a bridge counts 2), toward B.decor.rails
export const railsIn = (S, habId) => S.props.reduce((n, p) => n + (p.placed && p.hab === habId && PROP[p.prop]?.rail || 0), 0);
// one more of this kind (n more not placed yet before it) would go over: decorCap, or for a rail piece B.decor.rails
export const capped = (S, habId, prop, n = 0) => { const r = PROP[prop]?.rail; if (PROP[prop]?.art) return false; return r ? railsIn(S, habId) + r * (n + 1) > B.decor.rails : placedIn(S, habId).length + n >= decorCap(S, habId); };
// 22-1: the habitat's own nature (NATURE) handed over by its build: list [{ prop, x, z, s, v, ring }] (first-board units), rings:
// how many rings the build planted (the meadow: its first board + one per 땅 넓히기 step; the pond: 1). Only rings not done yet.
export function addNatives(S, habId, list, rings) {
  const done = S.natives?.[habId] || 0; if (rings <= done) return 0;
  const add = list.filter(n => (n.ring || 0) >= done && (n.ring || 0) < rings && NAT[n.prop]);
  for (const n of add) S.props.push({ uid: S.nextId++, prop: n.prop, hab: habId, placed: true, x: +n.x.toFixed(2), z: +n.z.toFixed(2), rot: 0, nat: 1, s: +n.s.toFixed(2), v: n.v });
  S.natives = { ...S.natives, [habId]: rings }; return add.length;
}
// 22-1 땅 칠하기: cell i, j (the grid of the first board's units) of a habitat to brush b (BRUSHES index), or null: bare again
export function paintCell(S, habId, i, j, b) {
  const P = S.paint[habId] ??= {}, k = `${i},${j}`;
  if (b == null || !BRUSHES[b]) { if (!(k in P)) return false; delete P[k]; return true; }
  if (P[k] === b || !brushIn(b, habId) || !can(S, 'brush:' + BRUSHES[b].id)) return false; P[k] = b; return true; // 25-1: only that habitat's brushes
}
// 22-1 되돌리기 / 다시 하기: a habitat's layout (its props where they stand, its paint) and putting one back. A prop bought since
// goes into storage; one sold since stays gone. Hearts never move.
// 24-2: the 미리보기 (S.ghost) go with it.
// 28-5: an entry is [uid, placed, x, z, rot, c, sz, on, sl] (one of 5 leaves those as they are)
export const layoutOf = (S, habId) => JSON.stringify({ p: S.props.filter(p => p.hab === habId).map(p => [p.uid, p.placed ? 1 : 0, p.x, p.z, p.rot, p.c || 0, p.sz || 0, p.on ?? null, p.sl ?? null]), paint: S.paint[habId] || {}, g: S.ghost?.[habId] || [] });
export function setLayout(S, habId, snap) {
  const o = JSON.parse(snap), at = new Map(o.p.map(e => [e[0], e]));
  for (const p of S.props) if (p.hab === habId) {
    const e = at.get(p.uid); if (!e) { p.placed = false; continue; }
    Object.assign(p, { placed: !!e[1], x: e[2], z: e[3], rot: e[4] });
    if (e.length > 5) { Object.assign(p, { c: e[5], sz: e[6], on: e[7], sl: e[8] }); if (e[7] == null) { delete p.on; delete p.sl; } }
  }
  S.paint = { ...S.paint, [habId]: { ...o.paint } }; S.ghost = { ...S.ghost, [habId]: o.g || [] }; tidy(S);
}
// inbox 42 A: the habitat's refit (habitat.js) after to11: moved ones to their new spot, the rest into storage (and what stood on them)
export function refit(S, habId, moves) {
  const by = new Map(S.props.map(p => [p.uid, p]));
  for (const m of moves || []) { const p = by.get(m.uid); if (!p || p.hab !== habId) continue; if (m.off) p.placed = false; else if (Number.isFinite(m.x) && Number.isFinite(m.z)) { p.x = m.x; p.z = m.z; } }
  tidy(S); S.refit = (S.refit || []).filter(h => h !== habId); if (!S.refit.length) delete S.refit;
  return { moved: (moves || []).filter(m => !m.off).length, off: (moves || []).filter(m => m.off).length };
}
// 28-5 쌓기: top spot k of a placed prop (a record) where it stands: x, z (saved units) and y above its ground, or null
export function topAt(h, k) {
  const t = PROP[h?.prop]?.top?.[k]; if (!t) return null;
  const f = sizeF(PROP[h.prop], h.sz), c = Math.cos(h.rot || 0), s = Math.sin(h.rot || 0);
  return { x: +(h.x + (t[0] * c + t[2] * s) * f / UNIT).toFixed(4), z: +(h.z + (-t[0] * s + t[2] * c) * f / UNIT).toFixed(4), y: t[1] * f }; // inbox 42 A: a top's metres in saved units
}
const seatFree = (S, h, k, p) => !!PROP[h?.prop]?.top?.[k] && h.placed && !S.props.some(o => o !== p && o.placed && o.on === h.uid && o.sl === k);
// what a save may hold (a backup code is text from outside): c and sz in range (else dropped: 0); a small prop whose prop under
// it went (put away, sold, moved off) goes into storage; one on a prop moved (고르기, 되돌리기) stands on its spot again
export function tidy(S) {
  const by = new Map(S.props.map(p => [p.uid, p]));
  for (const p of S.props) {
    const P = PROP[p.prop]; if (p.nat || !P) continue;
    if (!(Number.isInteger(p.c) && p.c > 0 && p.c < (paletteOf(P)?.length ?? 0))) delete p.c;
    if (!(Number.isInteger(p.sz) && p.sz > 0 && p.sz < SIZES.length && sizable(P))) delete p.sz;
    if (p.on != null && p.sz === 3) p.sz = 2; // inbox 42 F-3: 아주 크게 is too big for a top spot (it hits the next one)
    if (p.on == null && p.sl == null) { delete p.on; delete p.sl; continue; }
    const h = by.get(p.on);
    if (!p.placed || !P.small || !h || h === p || h.hab !== p.hab || !Number.isInteger(p.sl) || !seatFree(S, h, p.sl, p)) { p.placed = false; delete p.on; delete p.sl; }
    else { const t = topAt(h, p.sl); p.x = t.x; p.z = t.z; }
  }
}
// 24-2 꾸미기 코드 불러오기. d: a decoded code (layout.js) of this habitat; fit(items): a boolean each, may it stand there on the
// board as it is now (habitat.js: its 넓히기 step, off the water, off the others before it); cell(i, j): may that cell be painted.
// The player's own props of each kind go to the code's spots (the nearest one first, up to decorCap), the board's own trees etc.
// likewise; a prop not owned becomes a 미리보기 (S.ghost: see-through while decorating, gone when one of that kind is put there),
// counted toward the cap; a brush not open yet paints nothing. Everything else here is put away. Hearts never move.
// The layout before is kept once (S.layoutUndo, 「불러오기 전으로」). Returns what happened, for the message.
export function importLayout(S, habId, d, fit, cell) {
  if (!d || d.hab !== habId || !HAB[habId]) return null;
  S.layoutUndo = { hab: habId, snap: layoutOf(S, habId) };
  const ok = fit(d.items), mine = S.props.filter(p => p.hab === habId), used = new Set(), ghost = [], cap = decorCap(S, habId);
  const n = { placed: 0, trees: 0, ghost: 0, off: 0, full: 0, nat: 0, unknown: d.unknown || 0, cells: 0, cellOff: 0, lock: 0 };
  let props = 0, rails = 0;
  for (const p of mine) { p.placed = false; delete p.on; delete p.sl; } // all put away first (28-5: so the top spots are free); placed again below
  const order = d.items.map((it, k) => k).sort((a, b) => !!d.items[a].sl - !!d.items[b].sl); // 28-5: what goes on top, after the rest
  for (const k of order) (it => {
    const nat = !!NAT[it.prop], P = PROP[it.prop];
    if (!nat && (!P || (P.habitat ?? habId) !== habId)) return n.unknown++;
    if (!ok[k]) return n.off++;
    const r = P?.rail || 0; // 28-4: rails go to their own cap
    if (!nat && (r ? rails + r > B.decor.rails : props >= cap)) return n.full++;
    const look = nat ? {} : { c: paletteOf(P)?.[it.c]?.[2] && !S.looks[P.id]?.includes(it.c) ? 0 : it.c || 0, sz: it.sz || 0 }; let seat = null, top = null;
    if (it.sl) { // 28-5: the prop under it (placed by this code just now, or its 미리보기) whose top spot sl is where it stands
      const near = h => { const t = topAt(h, it.sl - 1); return !!t && Math.hypot(t.x - it.x, t.z - it.z) < 0.35; };
      const h = mine.find(h => used.has(h.uid) && seatFree(S, h, it.sl - 1, null) && near(h)), gh = !h && ghost.find(near);
      if (!P?.small || !h && !gh) return n.off++; top = topAt(h || gh, it.sl - 1); if (h) seat = { on: h.uid, sl: it.sl - 1 };
    }
    const pool = top && !seat ? [] : mine.filter(p => p.prop === it.prop && !!p.nat === nat && !used.has(p.uid)), at = { x: top?.x ?? it.x, z: top?.z ?? it.z, rot: it.rot }; // on a 미리보기: a 미리보기 too
    if (!pool.length) { if (nat) return n.nat++; ghost.push({ prop: it.prop, ...at, ...look, ...top && { y: top.y } }); if (r) rails += r; else props++; return n.ghost++; }
    const far = p => Math.hypot(p.x - it.x, p.z - it.z), p = pool.reduce((a, b) => far(b) < far(a) ? b : a);
    used.add(p.uid); Object.assign(p, { placed: true }, at, look, seat); if (nat) n.trees++; else { if (r) rails += r; else props++; n.placed++; }
  })(d.items[k]);
  const paint = {};
  for (const [key, b] of Object.entries(d.paint || {})) {
    const [i, j] = key.split(',').map(Number);
    if (!BRUSHES[b]) continue; if (!cell(i, j) || !brushIn(b, habId)) { n.cellOff++; continue; } if (!can(S, 'brush:' + BRUSHES[b].id)) { n.lock++; continue; }
    paint[key] = b; n.cells++;
  }
  S.paint = { ...S.paint, [habId]: paint }; S.ghost = { ...S.ghost, [habId]: ghost }; tidy(S);
  return n;
}
export function undoImport(S) {
  const u = S.layoutUndo; if (!u) return null;
  setLayout(S, u.hab, u.snap); delete S.layoutUndo; return u.hab;
}
export const clearGhost = (S, habId) => { if (!S.ghost?.[habId]?.length) return false; S.ghost = { ...S.ghost, [habId]: [] }; return true; };
// 28-5 ex: { c, sz } its colour and size (absent: as they are), { on, sl }: onto top spot sl of placed prop on (a small prop
// only, the spot free; x, z then from the spot). What stands on it moves and turns with it.
export function placeProp(S, uid, x, z, rot, ex = {}) {
  const p = S.props.find(p => p.uid === uid); if (!p) return null;
  if (!p.placed && !p.nat && capped(S, p.hab, p.prop)) return null;
  const h = ex.on != null && S.props.find(o => o.uid === ex.on);
  if (ex.on != null && !(PROP[p.prop]?.small && h && h !== p && h.hab === p.hab && seatFree(S, h, ex.sl, p))) return null;
  if (!p.placed && p.nat && p.prop === 'tree') bump(S, 'plant'); // 23-2 나무 심기: one put away, planted again
  const turn = (rot || 0) - (p.placed ? p.rot || 0 : 0);
  Object.assign(p, { placed: true, x, z, rot });
  if (!p.nat) {
    for (const k of ['c', 'sz']) if (ex[k] !== undefined) p[k] = ex[k];
    if (h) { const t = topAt(h, ex.sl); Object.assign(p, { on: h.uid, sl: ex.sl, x: t.x, z: t.z }); } else { delete p.on; delete p.sl; }
    for (const o of S.props) if (o.on === p.uid && o.placed) { const t = topAt(p, o.sl); if (t) Object.assign(o, { x: t.x, z: t.z, rot: ((o.rot || 0) + turn) % (Math.PI * 2) }); }
    tidy(S);
  }
  const g = S.ghost?.[p.hab], i = p.nat ? -1 : g?.findIndex(o => o.prop === p.prop && Math.hypot(o.x - x, o.z - z) < 1); // 24-2: its 미리보기 is done
  if (i >= 0) S.ghost = { ...S.ghost, [p.hab]: g.filter((_, k) => k !== i) };
  return p;
}
// inbox 37 작은 고리 바로 놓기: four curves at once (cells: [x, z, rot] each, a loop habitat.js checked), the curves put away
// here first, the rest bought at their price; all or nothing (the level, the hearts, the rail cap). clear: the board's own
// flowers and trees under it (uids habitat.js found), put away (꾸미기 자연 plants them again). The placed records, or null
export function placeRing(S, habId, cells, clear = []) {
  const C = PROP.railcurve, mine = () => S.props.filter(p => p.prop === C.id && p.hab === habId && !p.placed && !p.nat), need = Math.max(0, 4 - mine().length);
  if (!HAB[habId] || cells?.length !== 4 || capped(S, habId, C.id, 3) || need && (!can(S, 'prop:' + C.id) || S.hearts < need * C.price)) return null;
  for (const p of S.props) if (p.nat && p.placed && p.hab === habId && clear.includes(p.uid)) p.placed = false;
  for (let i = 0; i < need; i++) buyProp(S, C.id, habId);
  return mine().slice(0, 4).map((p, i) => placeProp(S, p.uid, ...cells[i]));
}
// 취소 right after buying (held, never placed or put away): the prop goes and its hearts come back
export function refundProp(S, uid) {
  const i = S.props.findIndex(p => p.uid === uid && !p.placed), P = i < 0 ? null : PROP[S.props[i].prop];
  if (!P || P.paid || P.gift) return 0; // 28-6c: a paid prop is never turned into hearts (41: nor a gift one)
  const p = S.props[i], h = Math.min(P.price, p.cost ?? P.price); // 13-3: what it cost on the shelf; a 진열대 색 it brought goes again
  if (p.nl) S.looks[P.id] = (S.looks[P.id] || []).filter(c => c !== p.c);
  S.props.splice(i, 1); S.hearts += h; return h;
}
export function stowProp(S, uid) {
  const p = S.props.find(p => p.uid === uid); if (!p) return null;
  p.placed = false; tidy(S); return p; // 28-5: what stood on it goes into storage too
}
// 28-5 배치 저장 칸: per habitat 3 named layouts ({ n: name, c: its 꾸미기 code, at }); loading one is loading its code (share.js)
export const LAY_NAMES = ['봄 정원', '밤 축제', '배치 3'];
export function saveLay(S, habId, k, name, now) {
  if (!HAB[habId] || !(k >= 0 && k < LAY_NAMES.length)) return null;
  const L = Array.from({ length: LAY_NAMES.length }, (_, i) => isObj(S.lays[habId]?.[i]) ? S.lays[habId][i] : null);
  L[k] = { n: cleanName(name) || LAY_NAMES[k], c: encode(S, habId), at: now }; S.lays = { ...S.lays, [habId]: L }; return L[k];
}
// 26-4 아끼는 친구 and names. A name: up to 8 letters, without < > & " ' ` (names go into the windows' HTML) or control characters
export const cleanName = t => typeof t === 'string' ? [...t.replace(/[<>&"'` -]/g, '').trim()].slice(0, 8).join('').trim() : '';
// inbox 58: a variant whose name has the species in it already (황금 복돼지) is not called 황금 복돼지 돼지
export const twoName = (v = '', s = '') => (!v ? s : !s || v.includes(s) ? v : `${v} ${s}`);
// 86-3라: a common is called by its colour, 단색 left out: 「흰 닭」 (not 「단색 닭 흰색」), 「갈색 점박이 말」, 「깨점 닭」 (the colour names
// the dots already). cId undefined: not known (a postcard keeps no colour): 「닭」, 「점박이 닭」. Names only: ids and saves as they were
const ADJ = { 흰색: '흰', 노랑: '노란', 하늘: '하늘색', 흑고니: '검은' };
export const lookName = (sp, v, cId) => { const V = variantOf(sp, v), s = SP[sp]?.name;
  if (V?.rarity !== 'common') return twoName(V?.name, s);
  const c = cId !== undefined && colorOf(sp, v, cId), dots = V.id === 'spots' && /점$|얼룩/.test(c?.name);
  const n = c ? ADJ[c.name] ?? c.name : '', p = V.id === 'solid' || dots ? '' : V.name; // a colour that names the species (멧돼지): 「줄무늬 멧돼지」
  return (n.includes(s) ? [p, n] : [s.startsWith(n) ? '' : n, p, s]).filter(Boolean).join(' '); }; // 흰 + 흰올빼미: 「흰올빼미」
export const kindName = a => (a.wd && GUESTS.find(R => R.k === a.wd)?.name) || lookName(a.species, a.variant, a.color); // 66-2: a settled guest keeps its name
export const tierOf = a => a.wd ? EARNED.wanderer : RAR[variantOf(a.species, a.variant)?.rarity]; // 66-2: 떠돌이 tier, never sold
export const growStage = lv => [2, 3, 4, 5, 6].filter(n => lv >= needFor('expand:' + n)).length; // 68-3: 명성 steps = the 땅 넓히기 levels (3/8/11/14/18)
export const callName = a => a.nm || kindName(a); // what the windows call it
export function setFav(S, id, on) { const a = S.animals.find(a => a.id === id && !a.pending); if (!a) return null; if (on) a.fav = true; else delete a.fav; return a; }
export function setName(S, id, text) { const a = S.animals.find(a => a.id === id && !a.pending), n = cleanName(text); if (!a) return null; if (n) a.nm = n; else delete a.nm; return a; }
export function sendBack(S, id) {
  const i = S.animals.findIndex(a => a.id === id && canSendBack(S, a));
  if (i < 0) return 0;
  const n = sendBackHearts(S.animals[i]); S.animals.splice(i, 1); S.hearts += n; return n;
}
// 23-2: what the habitat on screen saw (lights: light props placed there at night; roof: animals under one roof in the rain),
// kept when more than before
export function noteLive(S, k, n) { if (!(n > (S.stats?.[k] || 0))) return false; S.stats[k] = n; return true; }
export function setTitle(S, id) { if (id != null && !S.ach?.[id]) return false; S.title = id; return true; }
// feeding a growing baby: + BALANCE.grow.feed, at most grow.feeds a day each (the device's local day)
export const feedsLeft = (a, now) => a.fedDay === dayOf(now) ? Math.max(0, B.grow.feeds - (a.fed || 0)) : B.grow.feeds;
export function feed(S, id, now) {
  const a = S.animals.find(a => a.id === id);
  if (!a || !growing(a) || !feedsLeft(a, now)) return false;
  const day = dayOf(now); if (a.fedDay !== day) { a.fedDay = day; a.fed = 0; }
  bank(a, now); a.fed++; a.g = Math.min(1, a.g + B.grow.feed); bump(S, 'feed'); return true;
}
// petting: the heart rule (hearts.js); a tap that gives a heart also adds BALANCE.grow.pet to a growing baby
export function tapHeart(S, id, now, rng = Math.random) {
  const a = S.animals.find(a => a.id === id) ?? S.visit.guests.find(g => g.id === id), n = a ? heartFor(S, a, now) : 0; // 16-1: a guest too (the day's cap the same)
  if (n && growing(a)) { bank(a, now); a.g = Math.min(1, a.g + B.grow.pet); }
  if (n) { bump(S, 'pet'); const L = liveRun(S, now); if (L) { if (++L.R.pets % L.e.earn.pet === 0) evEarn(S, L.R, 1, now); // 15-1: a coin every earn.pet hearts
    if (L.e.earn.luck && rng() < L.e.earn.luck) { L.R.luck++; evEarn(S, L.R, 1, now); } } } // 15-2: now and then one more
  if (n && S.pet.n <= B.level.xp.petDaily) S.xp += B.level.xp.pet; // the day's first petDaily hearts (hearts.js counts them)
  S.hearts += n; return n;
}
// ms till grown on time alone (null: not growing)
export const growLeft = (a, now) => growing(a) ? (1 - gauge(a, now)) * growTime(a) : null;
// 꼬마 사탕: bought with hearts; given to a baby out in a habitat, it holds its growth (nothing shows on the figure);
// 다시 자라기 lets it grow on from there and gives the candy back. A held baby is like any other for hearts, eggs and the codex.
export function buyCandy(S) {
  if (S.hearts < B.candy.price) return false;
  S.hearts -= B.candy.price; S.candy = (S.candy || 0) + 1; return true;
}
export function holdBaby(S, id, now) {
  const a = S.animals.find(a => a.id === id);
  if (!a || !growing(a) || !(S.candy > 0)) return false;
  bank(a, now); a.hold = true; S.candy--; return true;
}
export function letGrow(S, id, now) {
  const a = S.animals.find(a => a.id === id && a.hold); if (!a) return false;
  delete a.hold; a.gAt = now; S.candy = (S.candy || 0) + 1; return true;
}
// the "다 자랐어요" cards were seen
export function grownSeen(S, ids) { for (const a of S.animals) if (ids.includes(a.id)) delete a.card; }
// inbox 41 B 우편함·선물 코드 (the list: play/mail.json, src/ui/mail.js). Times are KST text: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM';
// a day alone as an end means the end of that day; missing or unreadable = no limit. A gift { hearts, candy, eggs, prop }:
// the eggs are ordinary nest eggs (layEgg: rarity rolled, pity counted when they hatch), put in the newest open habitat's nest
// with room; with every nest full each one comes as GIFT.eggHearts hearts (extra). A prop is put away in its habitat.
// inbox 44: legendEggs = legendary eggs of the newest open habitat (species as usual, gift: true = the gauges don't count it,
// crack). With that nest full they wait in S.giftEggs (the mailbox: 둥지에 자리가 생기면 받기, claimLegend), never hearts.
const DAY_MS = 86400000;
export const kst = s => { const m = /^(\d{4}-\d\d-\d\d)(?:[ T](\d\d:\d\d))?$/.exec(String(s ?? '').trim()); return m ? Date.parse(`${m[1]}T${m[2] || '00:00'}:00+09:00`) : NaN; };
const kstEnd = s => kst(s) + (/:/.test(String(s)) ? 0 : DAY_MS);
const live = (m, now) => !(now < kst(m.start)) && !(now >= kstEnd(m.end));
export const mailOpen = (S, m, now) => typeof m?.id === 'string' && !!m.id && !S.mailGot.includes(m.id) && live(m, now) && (m.before == null || S.since < kst(m.before));
export function give(S, rw, now, rng = Math.random, at = null) { // at: the habitat on screen (a prop goes there if open)
  const n = k => Math.max(0, Math.min(/eggs|Now|Exp/i.test(k) ? 20 : 9999, Math.floor(+rw?.[k] || 0))); // a file from outside: whole numbers, capped
  const got = { hearts: n('hearts'), candy: n('candy'), eggs: 0, extra: 0, prop: null, legend: 0, wait: 0 };
  S.hearts += got.hearts; S.candy = (S.candy || 0) + got.candy;
  const open = [...S.unlocked].reverse().map(id => HAB[id]).filter(h => h?.nest && h.ready);
  for (let i = n('eggs'); i > 0; i--) {
    const h = open.find(h => (S.nests[h.id]?.eggs.length ?? 0) < B.nest.max);
    if (h) { (S.nests[h.id] ??= { t: now, eggs: [] }).eggs.push(layEgg(S, h.nest, rng)); got.eggs++; } else { S.hearts += GIFT.eggHearts; got.extra++; }
  }
  const now1 = layLegend(S, now, n('legendNow'), { now: 1 }); // 93-1: hatches at once, in even with the nest full (the day-2 gift: a night fills it)
  got.legend = layLegend(S, now, n('legendEggs')); got.wait = n('legendEggs') + n('legendNow') - got.legend - now1; got.legend += now1; S.giftEggs += got.wait;
  got.hero = layLegend(S, now, n('heroEggs'), {}, 'heroic', true); // 93-2
  if (n('freeExp')) { const h = HABITATS[0].id; S.freeExp = { ...S.freeExp, [h]: (S.freeExp?.[h] || 0) + n('freeExp') }; got.exp = n('freeExp'); }
  const clue = !!rw?.clue && !S.props.some(p => p.prop === 'campfire'); if (rw?.clue) got.clue = 1; // 93-2 신수 단서: the campfire, free
  const P = PROP[clue ? 'campfire' : rw?.prop], hab = clue ? MY.habitat : P?.habitat ?? (open.find(h => h.id === at) ?? open[0])?.id;
  if (P && !P.paid && hab) { S.props.push({ uid: S.nextId++, prop: P.id, hab, placed: false, x: 0, z: 0, rot: 0, ...(clue ? { cost: 0 } : {}) }); got.prop = P.id; }
  return got;
}
const newestNest = S => [...S.unlocked].reverse().map(id => HAB[id]).find(h => h?.nest && h.ready);
export const legendRoom = S => { const h = newestNest(S); return !!h && (S.nests[h.id]?.eggs.length ?? 0) < B.nest.max; };
function layLegend(S, now, k, ex = {}, rarity = 'legendary', over = !!ex.now) { // over (93): the week's gift eggs go in even past a full nest
  const h = newestNest(S); let n = 0;
  for (; n < k && h && (over || legendRoom(S)); n++) (S.nests[h.id] ??= { t: now, eggs: [] }).eggs.push({ ...egg(S, h.nest, rarity), gift: true, ...ex });
  return n;
}
// the waiting legend eggs, as many as the nest has room for
export function claimLegend(S, now) {
  const k = layLegend(S, now, S.giftEggs); if (!k) return null;
  S.giftEggs -= k; const got = [{ id: 'legend', title: '기다리던 전설 알', hearts: 0, candy: 0, eggs: 0, extra: 0, prop: null, legend: k, wait: 0 }];
  return { got, events: [{ type: 'gift', got }] };
}
// mail that can be had now (ids: only those), each once: ids kept in mailGot
export function claimMail(S, list, now, ids, rng = Math.random) {
  const got = [];
  for (const m of Array.isArray(list) ? list : []) if (mailOpen(S, m, now) && (!ids || ids.includes(m.id))) { S.mailGot.push(m.id); got.push({ id: m.id, title: String(m.title ?? ''), ...give(S, m.rewards, now, rng) }); }
  return got.length ? { got, events: [{ type: 'gift', got }] } : null;
}
// a gift code: case and spaces don't count; once per save and once per device (used: the device's list, game.js)
export const codeKey = s => String(s ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 40);
export function useCode(S, codes, input, now, used = [], rng = Math.random) {
  const k = codeKey(input), c = k && (Array.isArray(codes) ? codes : []).find(c => codeKey(c?.code) === k);
  if (!c || now < kst(c.start)) return { err: 'none' };
  if (S.codes.includes(k) || used.includes(k)) return { err: 'used' };
  if (!live(c, now)) return { err: 'end' };
  S.codes.push(k); const got = [{ id: k, title: String(c.title ?? '선물 코드'), ...give(S, c.rewards, now, rng) }];
  return { got, events: [{ type: 'gift', got }] };
}
// inbox 41 C 출석부: a slot a day (dayOf); none on a day before the last one's time (a clock turned back), so at most one a day.
// The slots run on after days away; the 7th adds the next of ATTEND_PROPS (the 7 in turn). at: the habitat on screen (give)
// 93-2 첫 주 선물: a save the game itself starts (game.js; not the sims, which keep newGame as it was) takes slot 1 now (♥),
// so the next day's first visit is slot 2, the legendary egg
export function weekStart(S, now) { S.flags.week1 = 1; S.attend = { day: dayOf(now), at: now, n: 1 }; S.hearts += WEEK1[0].hearts; return S; }
export const attendDue = (S, now) => dayOf(now) !== S.attend.day && now >= S.attend.at;
export function attend(S, now, rng = Math.random, at = null) {
  if (!attendDue(S, now)) return null;
  const A = S.attend, L = ATTEND.length, k = A.n % L, wk = S.flags.week1 && A.n < WEEK1.length, // 93-2: a new save's first week
    rw = wk ? WEEK1[A.n] : k === L - 1 ? { ...ATTEND[k], prop: ATTEND_PROPS[Math.floor(A.n / L) % ATTEND_PROPS.length] } : ATTEND[k];
  A.day = dayOf(now); A.at = now; A.n++;
  const got = { slot: k + 1, week: wk ? A.n : 0, ...give(S, rw, now, rng, at) };
  return { got, events: [{ type: 'attend', got }] };
}
// 15-1 계절 이벤트 (data.js EVENTS, docs/event.md). The dates come from play/events.json (setCal; ui/event.js reads it and keeps
// the last copy) or, for a year it does not name, the event's own 'MM-DD'; all KST. A run is one event in one year (key
// 'id-year'): S.events[key] = { id, start, end, c (coins now), got (in all: the 보상 길), step (steps given), pets, day/dayAt (the
// day's coins: dayOf, at most one a day, none on a day before the last one's time), buy: { prop: n }, shots: { slot: when },
// cover (the album's prop given), seen (its start card), over (when its coins became hearts: paid), told (that card) }.
// Made when it starts; from then it runs to its own end offline too. A calendar read later moves start and end till it is over
// (an end at or before the start: the run is off). The UI reads it all from here (no events: a toast or card comes from the state)
let CAL = null;
export const setCal = c => { CAL = Array.isArray(c) ? c.filter(isObj) : null; };
const EV = Object.fromEntries(EVENTS.map(e => [e.id, e])), kstYear = t => new Date(t + 9 * 3600e3).getUTCFullYear();
function runAt(e, y) { // its run of year y (by the start): { start, end } or null
  const c = CAL?.find(c => c.id === e.id && kstYear(kst(c.start)) === y), start = c ? kst(c.start) : kst(`${y}-${e.start}`);
  const end = c?.end != null ? kstEnd(c.end) : start + e.days * DAY_MS;
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}
const evLive = (R, now) => !R.over && R.start <= now && now < R.end;
export function liveRun(S, now) { for (const [key, R] of Object.entries(S.events)) if (evLive(R, now)) return { key, R, e: EV[R.id] }; return null; }
function evEarn(S, R, n, now, rng = Math.random) {
  const e = EV[R.id]; R.got += n; // 74: no coins to spend, only the 보상 길's count (R.c: an old save's, made hearts at the end)
  while (R.step < e.track.length && R.got >= e.track[R.step].at) give(S, e.track[R.step++], now, rng, S.flags.lastHab);
}
function evTick(S, now, rng) {
  const Y = kstYear(now);
  for (const e of EVENTS) for (const y of [Y - 1, Y]) {
    const key = `${e.id}-${y}`, r = runAt(e, y), R = S.events[key];
    if (R) { if (CAL && r && !R.over) Object.assign(R, r); }
    else if (r && r.start <= now && now < r.end) S.events[key] = { id: e.id, ...r, c: 0, got: 0, step: 0, pets: 0, day: '', dayAt: 0, buy: {}, shots: {}, pile: '', pileAt: 0, built: 0, luck: 0 };
  }
  for (const R of Object.values(S.events)) {
    if (!R.over && now >= R.end) { R.over = now; R.paid = R.c * EV[R.id].coin.hearts; R.left = R.c; S.hearts += R.paid; R.c = 0; }
    else if (evLive(R, now) && dayOf(now) !== R.day && now >= R.dayAt) { R.day = dayOf(now); R.dayAt = now; evEarn(S, R, EV[R.id].earn.day, now, rng); }
  }
}
export function buyEv(S, propId, hab, now) { // the event shop: its coins, into this habitat (put away: 꾸미기 › 선물); 15-2 wear: one more to put on
  const L = liveRun(S, now), it = L?.e.shop.find(i => (i.prop ?? i.wear) === propId), P = PROP[propId]; if (!it || S.hearts < it.price) return null; // 74: hearts
  if (it.wear) { if (!EV_ACC[propId]) return null; S.hearts -= it.price; L.R.buy[propId] = (L.R.buy[propId] || 0) + 1; return { wear: propId }; }
  if (!P) return null;
  S.hearts -= it.price; L.R.buy[propId] = (L.R.buy[propId] || 0) + 1;
  const p = { uid: S.nextId++, prop: P.id, hab: P.habitat ?? hab, placed: false, x: 0, z: 0, rot: 0 }; S.props.push(p); return p;
}
// a photo saved while an event runs: ctx { hab, night, sky } (photo.js); fills the first empty slot it meets, all = album.prop
export const shotFits = (S, n, { hab, night, sky, ball }) => (!n.hab || n.hab === hab) && (n.night == null || n.night === !!night) && (!n.sky || n.sky === sky)
  && (!n.ball || !!ball) && (!n.prop || S.props.some(p => p.placed && p.hab === hab && [].concat(n.prop).includes(p.prop))); // 15-2: ball, a list of props
export function evShot(S, ctx, now, rng = Math.random) {
  const L = liveRun(S, now), A = L?.e.album, s = A?.slots.find(s => !L.R.shots[s.id] && shotFits(S, s.need, ctx)); if (!s) return null;
  L.R.shots[s.id] = now; let cover = null;
  if (A.slots.every(s => L.R.shots[s.id]) && !L.R.cover) { L.R.cover = now; cover = give(S, { prop: A.prop }, now, rng, ctx.hab).prop; }
  return { slot: s.id, cover };
}
// 15-2 첫눈's play. Snow piles: one at each of piles' hours (KST), waiting till the next one (R.pile: the last taken, 'day:i';
// none while the clock is before pileAt, turned back); a tap gives earn.pile coins
const kstDay = t => new Date(t + 9 * 3600e3).toISOString().slice(0, 10), kstHour = t => new Date(t + 9 * 3600e3).getUTCHours();
export function evPile(S, now) {
  const L = liveRun(S, now), P = L?.e.piles; if (!P) return null;
  const i = P.findLastIndex(h => kstHour(now) >= h), id = `${kstDay(now)}:${i}`;
  return i < 0 || L.R.pile === id || now < L.R.pileAt ? null : { ...L, id };
}
// 14-3 화석 발굴: an animal done digging at the dino jungle's fossil site (walk.js 'dig', habitat.js ctx.onDig). The next of
// FOSSIL.props the player doesn't have yet, with FOSSIL.odds, FOSSIL.gap at least after the last one: into the dino jungle's
// storage (꾸미기 › 선물). Its PROPS id, or null
export function dig(S, now, rng = Math.random) {
  const prop = FOSSIL.props.find(id => !S.props.some(p => p.prop === id));
  if (!prop || !S.unlocked.includes('dino') || now - S.fossil.at < FOSSIL.gap || !(rng() < FOSSIL.odds)) return null;
  S.fossil.at = now; S.props.push({ uid: S.nextId++, prop, hab: 'dino', placed: false, x: 0, z: 0, rot: 0 }); return prop;
}
export function tapPile(S, now) { const p = evPile(S, now); if (!p) return 0; p.R.pile = p.id; p.R.pileAt = now; evEarn(S, p.R, p.e.earn.pile, now); return p.e.earn.pile; }
// a snowman built (3 taps, the habitat finds the spot: x, z as saved) for build.price coins: placed there at once, a prop to keep
export function evBuild(S, hab, x, z, now) {
  const L = liveRun(S, now), b = L?.e.build; if (!b || S.hearts < b.price || !HAB[hab] || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  S.hearts -= b.price; L.R.built++; const p = { uid: S.nextId++, prop: b.prop, hab, placed: true, x, z, rot: 0 }; S.props.push(p); return p;
}
// event wear (data.js EV_ACC): how many of each were bought in all runs; on a friend (a.wear: ids) while fewer are worn than bought.
// Toggled; kept after the event (only its window changes it)
export const evOwned = S => { const o = Object.fromEntries(Object.keys(EV_ACC).map(k => [k, 0])); for (const R of Object.values(S.events)) for (const k in o) o[k] += R.buy?.[k] || 0; return o; };
export const evWorn = (S, k) => S.animals.filter(a => a.wear?.includes(k)).length;
export function evWear(S, id, k) {
  const a = S.animals.find(a => a.id === id); if (!a || !EV_ACC[k]) return false;
  if (a.wear?.includes(k)) { a.wear = a.wear.filter(x => x !== k); if (!a.wear.length) delete a.wear; return true; }
  if (evWorn(S, k) >= evOwned(S)[k]) return false;
  a.wear = [...a.wear || [], k]; return true;
}
export function evSeen(S, key, k) { const R = S.events[key]; if (R && (k === 'seen' || k === 'told')) R[k] = 1; }
// its mail, while it runs (ui/mail.js adds it to mail.json's; mailOpen: once)
export const evMail = (S, now) => { const L = liveRun(S, now); if (!L) return [];
  return [{ id: 'ev-' + L.key, ...L.e.mail, end: new Date(L.R.end + 9 * 3600e3 - 1).toISOString().slice(0, 10) }]; };
// inbox 41 D 첫날 할 일 (data.js FIRST): on while today (dayOf) is one of the game's first FIRST.days days and not all are done.
// advance gives each task's hearts once (S.first[id] = when); all of them: FIRST.prop (into the habitat last entered) + FIRST.candy
const FIRST_V = { hatch: S => S.stats?.hatch || 0, pet: S => S.stats?.pet || 0, prop: S => S.props.filter(p => p.placed && !p.nat && !PROP[p.prop]?.art).length, photo: S => S.stats?.photo || 0, codex: S => S.stats?.codex || 0 };
export const firstGot = (S, t) => Math.min(t.n, FIRST_V[t.id](S));
export const firstOn = (S, now) => !S.first?.all && Array.from({ length: FIRST.days }, (_, i) => dayOf(new Date(S.since).setHours(12, 0, 0, 0) + i * DAY_MS)).includes(dayOf(now));
function firstCheck(S, now, ev, rng) {
  if (!firstOn(S, now)) return; S.first ??= {};
  for (const t of FIRST.tasks) if (!S.first[t.id] && firstGot(S, t) >= t.n) { S.first[t.id] = now; S.hearts += t.hearts; ev.push({ type: 'first', id: t.id, hearts: t.hearts }); }
  if (FIRST.tasks.every(t => S.first[t.id])) { S.first.all = now; ev.push({ type: 'firstAll', got: give(S, { prop: FIRST.prop, candy: FIRST.candy }, now, rng, S.flags.lastHab) }); }
}
// debug: pretend `ms` passed (every timestamp moves back), then catch up
export function skip(S, ms, now, rng = Math.random) {
  for (const n of Object.values(S.nests)) n.t -= ms;
  for (const s of S.slots) if (s) { s.start -= ms; s.end -= ms; }
  for (const a of S.animals) { a.born -= ms; if (a.gAt != null) a.gAt -= ms; if (a.adultAt != null) a.adultAt -= ms; a.heartAt -= ms; if (a.stroll) { a.stroll.start -= ms; a.stroll.end -= ms; } }
  if (Number.isFinite(S.flags.lvCard?.at)) S.flags.lvCard.at -= ms; // 41 D: level.js's gap between level cards
  for (const k of MYTH_T) if (k !== 'bond' && k !== 'read' && Number.isFinite(S.myth[k])) S.myth[k] -= ms; // 14-1
  for (const g of S.visit.guests) { g.at -= ms; g.until -= ms; } // 16-1
  if (S.pals.at) S.pals.at -= ms; for (const p of S.pals.list) p.at -= ms; // 17-1
  if (S.art.here) S.art.here -= ms; // 17-2: skipped time is time away
  if (S.wild.d) S.wild.d -= Math.round(ms / 864e5); // 17-3: whole days skipped grow
  skipGuests(S, ms); // 66-1
  return advance(S, now, rng);
}
