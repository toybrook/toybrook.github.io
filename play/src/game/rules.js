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
//   xp (정원사 레벨 XP, 23-1), lv (the level last shown on a level-up card), xpDay (the day the first-visit XP was given),
//   ach: { [도전 과제 id]: when done } (achieve.js), title (the 칭호 shown: a done one's id | null), stats: { hatch, grown, pet, feed, plant,
//            days, lights, roof } (counts for 도전 과제; lights, roof: the most the habitat on screen has seen, noteLive),
//   candy (꼬마 사탕 owned, not in use), unlocked: [habitat ids], flags: {} }
// stored: in storage (보관함): not out in the habitat, no slot limit, keeps its stage.
// Animals are kept by species id + variant id only, so new content never breaks an old save; ids the
// game no longer knows stay in the save untouched and are just not shown.
import { SCHEMA_VERSION, CONTENT_VERSION, BALANCE as B, RARITIES, SHARED_VARIANTS, SPECIES, HABITATS, EGG_TYPES, ACCESSORIES, MODELS, PROPS, NATURE, BRUSHES, brushIn, SETS, bodyArea, ZONES, paletteOf, SIZES, sizeF, sizable } from './data.js';
import { encode } from './layout.js';
import { heartFor } from './hearts.js';
import { dayOf } from './clock.js';
import { BOARD0, rectAt, inRect, zoneSet } from '../habitat/zones.js';
import { newlyDone } from './achieve.js';

const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
export const SP = byId(SPECIES), HAB = byId(HABITATS), EGG = byId(EGG_TYPES), RAR = byId(RARITIES), PROP = byId(PROPS), NAT = byId(NATURE);
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
  for (const a of S.animals) { const h = SP[a.species]?.habitat; if (h && !S.unlocked.includes(h)) a.hab = S.unlocked[0]; else delete a.hab; }
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
    animals: [], codex: {}, seen: allKeys(), colors: {}, pity: {}, album: {}, display: {}, props: [], natives: {}, paint: {}, ghost: {}, lays: {}, pet: { day: '', n: 0 }, expand: noExpand(), xp: 0, lv: 1, xpDay: '', ach: {}, title: null, stats: { hatch: 0, grown: 0, pet: 0, feed: 0, plant: 0, days: 0, lights: 0, roof: 0 }, candy: B.candy.free, unlocked: [HABITATS[0].id], flags: {}, seenProps: PROPS.map(p => p.id) }; // seenProps: 꾸미기's red dot for props an update adds (an older save gets today's list from here)
  const first = HABITATS[0];
  S.nests[first.id] = { t: now, eggs: Array.from({ length: B.nest.start }, () => egg(S, first.nest, B.nest.startRarity)) };
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
    for (const a of S.animals) { const n = cleanName(a.nm); if (n) a.nm = n; else delete a.nm; if (a.fav !== true) delete a.fav; } // 26-4: a backup code is text from outside
    tidy(S); // 28-5
    for (const [h, L] of Object.entries(S.lays)) if (!Array.isArray(L)) delete S.lays[h]; else S.lays[h] = LAY_NAMES.map((_, i) => isObj(L[i]) && typeof L[i].c === 'string' ? { n: cleanName(L[i].n) || LAY_NAMES[i], c: L[i].c, at: L[i].at } : null);
    S.schemaVersion = SCHEMA_VERSION; S.contentVersion = CONTENT_VERSION; // keys added since are not in `seen`: they show NEW
    settle(S);
    advance(structuredClone(S), now, () => 0.5);
    return S;
  } catch { return null; }
}
// Save migrations: MIGRATIONS[v] turns a v-1 save into a v save. A new save shape = SCHEMA_VERSION + 1 in data.js and a
// step here (fields that only need a default don't need one: newGame fills them). 1 and 2 had no steps.
const MIGRATIONS = { 3: to3, 4: to4, 5: to5, 6: to6, 7: to7, 8: to8, 9: to9, 10: to10 }; // 4: animals over the new room go to storage on the first advance
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
    const L = S.expand[hab] || 0, O = rectAt(hab, L), Z = zoneSet(hab, L);
    S.props = S.props.filter(p => !(p.nat && p.hab === hab && !inRect(BOARD0, p.x, p.z)));
    if (S.natives?.[hab] > 1) S.natives[hab] = 1;
    for (const p of S.props) if (p.hab === hab && p.placed && !p.nat && (!inRect(O, p.x, p.z, 0.5) || Z.wd(p.x, p.z, true) < (PROP[p.prop]?.r ?? 1))) p.placed = false;
    const P = S.paint?.[hab]; if (P) for (const k of Object.keys(P)) { const [i, j] = k.split(',').map(Number); if (!inRect(O, i + 0.5, j + 0.5)) delete P[k]; }
  }
}
const bump = (S, k) => { S.stats ??= {}; S.stats[k] = (S.stats[k] || 0) + 1; };

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
export function rollHatch(S, e, rng) {
  const pool = hatchPool(e.type, e.rarity), w = attract(S, e.type); if (!pool.length) return null;
  const { sp, vs } = pick(pool, x => spWeight(w, x.sp), rng);
  const pm = B.preferMissing, v = pick(vs, v => tierWeight(v) * (pm.on && !owned(S, key(sp.id, v.id)) ? pm.weight : 1), rng);
  return { species: sp.id, variant: v.id };
}
// Probability table of an egg type (for the ?debug screen; later the public odds page). Same pool as rollHatch, preferMissing off.
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
export const shards = (S, type) => Object.fromEntries(Object.keys(B.pity).map(k => [k, S.pity[type]?.[k] || 0]));
export function sureRarity(S, type) {
  const P = shards(S, type); let top = null;
  for (const k in B.pity) if (P[k] >= B.pity[k] && (!top || RANK[k] > RANK[top])) top = k;
  return top;
}

// Crack an egg: its rarity (raised to the guaranteed one when a gauge is full), the variant, its colour, the gauges, the secret accessory.
// A guaranteed rarity picks evenly among that rarity's variants nobody has yet (all of them if none is missing); tiers don't count there.
// Gauges: +1 each, except a gauge whose rarity (or better) came out, which empties. Every egg counts, the first one too.
export function crack(S, e, now, rng = Math.random, forced = false) { // forced: a secret for sure (?debug 다음 알 시크릿, game.hatch)
  const top = sureRarity(S, e.type), sure = !!top && RANK[top] >= RANK[e.rarity], rarity = sure ? top : e.rarity;
  let r;
  if (sure) {
    const all = hatchPool(e.type, rarity).flatMap(({ sp, vs }) => vs.map(v => ({ species: sp.id, variant: v.id })));
    const miss = all.filter(p => !owned(S, key(p.species, p.variant))), from = miss.length ? miss : all;
    r = from[Math.floor(rng() * from.length)];
  } else r = rollHatch(S, e, rng);
  if (!r) return null;
  r = { ...r, color: rollColor(r.species, r.variant, rng) };
  const before = shards(S, e.type), P = S.pity[e.type] = { ...before };
  for (const k in B.pity) P[k] = RANK[rarity] >= RANK[k] ? 0 : P[k] + 1;
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
  const base = eggTable(type, S), keys = Object.keys(B.pity).sort((a, b) => RANK[a] - RANK[b]);
  const seg = k => base.map(r => {
    const i = RANK[r.rarity.id], p = !k || i > RANK[k] ? r.p : i < RANK[k] ? 0 : base.filter(b => RANK[b.rarity.id] <= i).reduce((s, b) => s + b.p, 0);
    return { rarity: r.rarity, p, missingFirst: !!k && i === RANK[k] };
  }).filter(r => r.p > 0);
  const accs = Object.entries(ACCESSORIES);
  return {
    egg: EGG[type], base,
    segments: [{ when: null, odds: seg(null) }, ...keys.map(k => ({ when: RAR[k], target: B.pity[k], odds: seg(k) }))],
    gauges: keys.map(k => ({ rarity: RAR[k], target: B.pity[k], have: S ? shards(S, type)[k] : 0 })),
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
export const eggGap = S => had(S) < B.nest.early.n ? B.nest.early.every : B.nest.every;
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
  for (const a of S.animals) {
    if (!growing(a) || gauge(a, now) < 1) continue;
    a.adultAt = Math.min(now, (a.gAt ?? now) + Math.max(0, 1 - (a.g || 0)) * growTime(a)); // when it filled (offline: earlier)
    a.stage = 'adult'; a.g = 1; a.card = true;
    register(S, a, a.adultAt); const e = S.codex[key(a.species, a.variant)], isNew = e.adult == null; if (isNew) e.adult = a.adultAt;
    S.xp += B.level.xp.grown; bump(S, 'grown'); ev.push({ type: 'grown', animal: a, isNew });
  }
  ev.push(...enforceCap(S));
  HABITATS.forEach((h, i) => { if (i && !S.unlocked.includes(h.id) && unlockInfo(S, h.id).met) { S.unlocked.push(h.id); settle(S);
    if (h.nest && h.ready && !S.nests[h.id]) S.nests[h.id] = { t: now, eggs: Array.from({ length: B.nest.onUnlock }, () => layEgg(S, h.nest, rng)) }; // inbox 31: eggs to start with
    ev.push({ type: 'unlock', habitat: h.id }); } });
  const day = dayOf(now); if (S.xpDay !== day) { S.xpDay = day; S.xp += B.level.xp.login; bump(S, 'days'); } // the day's first visit (or the game left open past midnight)
  for (const a of newlyDone(S)) { S.ach = { ...S.ach, [a.id]: now }; S.xp += B.level.xp.achieve; ev.push({ type: 'achieve', id: a.id }); } // 23-2
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
const unlocksBetween = (from, to) => Object.entries(LV.unlock).filter(([L]) => +L > from && +L <= to).flatMap(([, list]) => list);

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
      const [a] = adults.splice(i, 1); out.splice(out.indexOf(a), 1); a.stored = true; ev.push({ type: 'stored', animal: a });
    }
  }
  return ev;
}

// Next habitat's lock: the previous one's codex share + hearts (a threshold, not spent). Once open, open for good.
export function unlockInfo(S, habId) {
  const i = HABITATS.findIndex(h => h.id === habId), prev = HABITATS[i - 1];
  if (i <= 0) return { open: true, met: true };
  const cells = codexCells(prev.id).length, have = codexCells(prev.id).filter(c => S.codex[c.key]).length;
  const need = Math.ceil(cells * B.unlock.codex);
  return { open: S.unlocked.includes(habId), met: cells > 0 && have >= need && S.hearts >= B.unlock.hearts, prev, have, need, hearts: B.unlock.hearts };
}

// Player actions. Each returns something falsy when it can't happen.
// An egg from the nest (that one, or the oldest) into the first empty hatch slot.
export function takeEgg(S, habId, now, eggId) {
  const n = S.nests[habId], i = S.slots.indexOf(null), j = !n ? -1 : eggId == null ? 0 : n.eggs.findIndex(e => e.id === eggId);
  if (j < 0 || j >= n.eggs.length || i < 0) return -1;
  if (n.eggs.length >= B.nest.max) n.t = now; // the hour to the next egg starts now
  const [e] = n.eggs.splice(j, 1);
  S.slots[i] = { egg: e, start: now, end: now + B.hatch[e.rarity] * (EGG[e.type]?.hatchScale ?? 1) };
  return i;
}
// A ready slot cracks. The animal waits (pending) for the reveal card's answer, so a reload shows the same card again.
// Its colour counts as seen now (the card is what shows it), so sending it back keeps the colour; newColor marks the card.
export function hatch(S, i, now, rng = Math.random, forced = false) {
  const s = S.slots[i]; if (!s || now < s.end) return null;
  const c = crack(S, s.egg, now, rng, forced); if (!c) return null;
  const a = { id: S.nextId++, species: c.species, variant: c.variant, color: c.color, acc: c.acc, egg: s.egg.type, parents: s.egg.parents, stage: 'baby', born: now,
    g: 0, gAt: now, fed: 0, adultAt: null, stored: false, heartAt: 0, pending: true };
  const seen = a.color && (S.colors[key(a.species, a.variant)] ??= []);
  if (seen && !seen.includes(a.color)) { seen.push(a.color); a.newColor = true; }
  S.animals.push(a); S.slots[i] = null; bump(S, 'hatch');
  return { animal: a, ...c, egg: s.egg };
}
// reveal card: NEW = nobody like it yet; already in the codex = it may go back for hearts (from the card or storage)
export const isNew = (S, a) => !S.codex[key(a.species, a.variant)] && !S.animals.some(b => b !== a && b.species === a.species && b.variant === a.variant);
export const canSendBack = (S, a) => !!(a?.pending || a?.stored) && !!S.codex[key(a.species, a.variant)];
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
  a.stored = true; return a;
}
export function unstore(S, id, now) {
  const a = S.animals.find(a => a.id === id && a.stored); if (!a || !fits(S, a)) return null;
  bank(a, now); a.stored = false; return a;
}
// 진열장: the colour a codex cell's figure shows (one seen on a reveal card)
export function setDisplay(S, k, cId) {
  if (!S.colors[k]?.includes(cId)) return false;
  S.display[k] = cId; return true;
}
export const displayColor = (S, k) => S.display[k] ?? S.colors[k]?.[0] ?? null;
// 꾸미기: buy with hearts (put away), place/turn (free; where it may go is the habitat's layout.js), put away
export function buyProp(S, propId, habId) { // habId: where it was bought (a prop sold everywhere stays there)
  const P = PROP[propId], hab = P?.habitat ?? habId; if (!P || P.paid || S.hearts < P.price || !hab || !can(S, 'prop:' + P.id)) return null;
  S.hearts -= P.price;
  const p = { uid: S.nextId++, prop: P.id, hab, placed: false, x: 0, z: 0, rot: 0 };
  S.props.push(p); return p;
}
// 땅 넓히기: the next step of an open habitat, for hearts
export function buyExpand(S, habId) {
  const L = levelOf(S, habId), price = B.expand.price[L];
  if (!HAB[habId] || !S.unlocked.includes(habId) || price == null || S.hearts < price || !can(S, 'expand:' + (L + 1))) return null;
  S.hearts -= price; S.expand = { ...S.expand, [habId]: L + 1 };
  return { level: L + 1, events: [{ type: 'expand', habitat: habId, level: L + 1 }] };
}
export const placedIn = (S, habId) => S.props.filter(p => p.placed && p.hab === habId && !p.nat && !PROP[p.prop]?.rail); // what counts toward decorCap (natives and rails never)
// 28-4: rail pieces placed in a habitat (PROPS rail: a bridge counts 2), toward B.decor.rails
export const railsIn = (S, habId) => S.props.reduce((n, p) => n + (p.placed && p.hab === habId && PROP[p.prop]?.rail || 0), 0);
// one more of this kind (n more not placed yet before it) would go over: decorCap, or for a rail piece B.decor.rails
export const capped = (S, habId, prop, n = 0) => { const r = PROP[prop]?.rail; return r ? railsIn(S, habId) + r * (n + 1) > B.decor.rails : placedIn(S, habId).length + n >= decorCap(S, habId); };
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
// 28-5 쌓기: top spot k of a placed prop (a record) where it stands: x, z (saved units) and y above its ground, or null
export function topAt(h, k) {
  const t = PROP[h?.prop]?.top?.[k]; if (!t) return null;
  const f = sizeF(PROP[h.prop], h.sz), c = Math.cos(h.rot || 0), s = Math.sin(h.rot || 0);
  return { x: +(h.x + (t[0] * c + t[2] * s) * f).toFixed(3), z: +(h.z + (-t[0] * s + t[2] * c) * f).toFixed(3), y: t[1] * f };
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
    const look = nat ? {} : { c: it.c || 0, sz: it.sz || 0 }; let seat = null, top = null;
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
  if (!P || P.paid) return 0; // 28-6c: a paid prop is never turned into hearts
  S.props.splice(i, 1); S.hearts += P.price; return P.price;
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
export const kindName = a => `${variantOf(a.species, a.variant)?.name ?? ''} ${SP[a.species]?.name ?? ''}`.trim();
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
export function tapHeart(S, id, now) {
  const a = S.animals.find(a => a.id === id), n = a ? heartFor(S, a, now) : 0;
  if (n && growing(a)) { bank(a, now); a.g = Math.min(1, a.g + B.grow.pet); }
  if (n) bump(S, 'pet');
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
// debug: pretend `ms` passed (every timestamp moves back), then catch up
export function skip(S, ms, now, rng = Math.random) {
  for (const n of Object.values(S.nests)) n.t -= ms;
  for (const s of S.slots) if (s) { s.start -= ms; s.end -= ms; }
  for (const a of S.animals) { a.born -= ms; if (a.gAt != null) a.gAt -= ms; if (a.adultAt != null) a.adultAt -= ms; a.heartAt -= ms; }
  return advance(S, now, rng);
}
