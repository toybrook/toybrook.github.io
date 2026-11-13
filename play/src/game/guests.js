// 66-1 떠돌이 손님: lost toys come along the stream or in from a path end, each with 1~3 wishes (guests-data.js), judged
// only within GUEST.radius of where the guest stands. The player answers with what the game already has: placing or moving a
// prop, moving a friend (or the guest) with a long press, a walk. All wishes met: 만족; and the 덤 too: 대만족. Rewards are
// hearts (bigger for a shorter stay, inbox 68), XP to the one Lv, a cut off the 부화 게이지 (the egg with the most time
// left), the egg of one habitat (layEgg: 70/22/7/1, pity counted as any nest egg) and, on 대만족, now and then a guest prop.
// A guest that goes unhelped only says 「다음에 또 올게」: nothing is taken away. Not a friend: never in S.animals, the
// friend list, slots or storage. Pure rules (no DOM, no three.js), as rules.js: `now` and `rng` come in, events go out.
// S.guests: { v, t: last tick, next: next arrival, warm: banked gauge share, day, eggs: guest eggs today, tut: tutorial
//   step (-1 done), tt: when it may start, hello: 1 = an old save's first guest card is due, list: [guest], seen: { k: [만족, 대만족] } }
// guest: { id, k, hab, at, on: open-app ms left, off: shut-app ms left, w: [wish], b: 덤 | null, hit: wishes met once (bits),
//   x, z (null till the world places it), from: 'stream' | 'path', pair?: shared id, tut?: step, ok?: when every wish held }
import { GUEST as G, GUESTS, WISH, CLASH, GROUND, TAGS, GROUNDS, GUEST_PROPS, PROP_TAGS, TUTORIAL } from './guests-data.js';
import { BALANCE as B, GIFT, PROPS } from './data.js';
import { HAB, EGG, PROP, layEgg, needFor, outIn } from './rules.js';
import { nightNo } from './sky.js';
import { dayOf } from './clock.js';

const BY = Object.fromEntries(GUESTS.map(R => [R.k, R]));
export const rosterOf = g => BY[g.k];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const span = ([a, b], rng) => a + (b - a) * rng();
const shuffle = (a, rng) => a.map(x => [rng(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const cap = S => (S.lv || 1) >= G.max3 ? 3 : G.max;

// a new save (nothing hatched yet) gets the tutorial; an old one a short card and its first guest at once
export const blank = S => { const fresh = !S?.stats?.hatch && !S?.animals?.length;
  return { v: G.v, t: 0, next: 0, warm: 0, day: '', eggs: 0, tut: fresh ? 0 : -1, tt: 0, hello: fresh ? 0 : 1, list: [], seen: {} }; };
export function tidyGuests(S) {
  const V = isObj(S.guests) ? S.guests : null; if (!V) { S.guests = blank(S); return; }
  const num = (v, d = 0) => Number.isFinite(v) ? v : d, pos = v => Number.isFinite(v) ? v : null;
  const guest = g => isObj(g) && BY[g.k] && Number.isInteger(g.id) && HAB[g.hab] && Array.isArray(g.w) && g.w.every(w => WISH[w]) && {
    id: g.id, k: g.k, hab: g.hab, at: num(g.at), on: num(g.on), off: num(g.off), w: [...g.w], b: WISH[g.b] ? g.b : null, hit: Number.isInteger(g.hit) ? g.hit : 0,
    x: pos(g.x), z: pos(g.z), from: g.from === 'path' ? 'path' : 'stream', ...(Number.isInteger(g.pair) && { pair: g.pair }),
    ...(Number.isInteger(g.tut) && TUTORIAL[g.tut] && { tut: g.tut }), ...(Number.isFinite(g.ok) && { ok: g.ok }) };
  S.guests = { v: G.v, t: num(V.t), next: num(V.next), warm: Math.min(1, Math.max(0, num(V.warm))), day: typeof V.day === 'string' ? V.day : '',
    eggs: Math.max(0, Math.floor(num(V.eggs))), tut: Number.isInteger(V.tut) && V.tut >= -1 && V.tut < TUTORIAL.length ? V.tut : -1, tt: num(V.tt),
    hello: V.hello === 1 ? 1 : 0, list: (Array.isArray(V.list) ? V.list : []).map(guest).filter(Boolean),
    seen: Object.fromEntries(Object.entries(isObj(V.seen) ? V.seen : {}).filter(([k, v]) => BY[k] && Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0))) };
}
// debug skip (rules.js skip): every guest time moves back with the rest
export const skipGuests = (S, ms) => { const Q = S.guests; if (!Q) return; Q.t -= ms; Q.next -= ms; Q.tt -= ms; for (const g of Q.list) { g.at -= ms; if (g.ok) g.ok -= ms; } };

// The Lv a tag can first be had in a habitat: its ground (GROUND), else the first prop with it the shop sells there.
// Lazy: rules.js imports this file too (fromSave), so needFor is only called once both have loaded.
let LV_OF = null;
export const tagLv = (hab, t) => {
  const m = (LV_OF ??= {})[hab] ??= Object.fromEntries([...TAGS, ...GROUNDS].map(x => [x, GROUND[hab]?.includes(x) ? 1
    : Math.min(Infinity, ...PROPS.filter(P => (P.habitat ?? hab) === hab && !P.gift && !P.paid && PROP_TAGS[P.id]?.includes(x)).map(P => needFor('prop:' + P.id)))]));
  return m[t] ?? Infinity;
};
// a wish the player can answer now in that habitat (env wishes only come with a guest's `when`)
function doable(S, hab, w) {
  const W = WISH[w], lv = S.lv || 1, out = () => outIn(S, hab);
  switch (W?.k) {
    case 'tag': case 'not': return tagLv(hab, W.v) <= lv; // 조용함 only once a 소리 prop is there to clash with
    case 'pals': return out().length >= W.n;
    case 'alone': return true;
    case 'sp': return out().some(a => a.species === W.v);
    case 'baby': return out().some(a => a.stage === 'baby');
    default: return false;
  }
}
const clashOf = w => CLASH.flatMap(([a, b]) => w === a ? [b] : w === b ? [a] : []);

// What a guest wants, at its spot. world.look(hab, x, z, r) -> { ground: [ground tags at x,z], props: [prop ids within r],
// pals: [{ species, baby }] friends within r (not guests) }. env: { hab, night, rain, snow, sky } (the real clock and weather).
export function judge(g, world, env = {}) {
  const L = world.look(g.hab, g.x, g.z, G.radius), pals = L.pals || [];
  const tags = new Set([...(L.ground || []), ...(L.props || []).flatMap(id => PROP_TAGS[id] || [])]);
  const has = w => { const W = WISH[w];
    switch (W?.k) {
      case 'tag': return tags.has(W.v);
      case 'not': return !tags.has(W.v);
      case 'pals': return pals.length >= W.n;
      case 'alone': return !pals.length;
      case 'sp': return pals.some(p => p.species === W.v);
      case 'baby': return pals.some(p => p.baby);
      case 'env': return !!env[W.v];
      default: return false;
    } };
  const met = g.w.map(has);
  return { met, all: met.every(Boolean), bonus: !!g.b && has(g.b) };
}

// 부화 게이지: share f of an egg's whole time comes off the hatching slot with the most time left (start moves back as far,
// so the gauge (now - start) / (end - start) goes up by f). None hatching: it waits in S.guests.warm for the next egg in a slot.
function warm(S, f, now) {
  let i = -1; S.slots.forEach((s, k) => { if (s && s.end > now && (i < 0 || s.end > S.slots[i].end)) i = k; });
  if (i < 0) { S.guests.warm = Math.min(1, S.guests.warm + f); return -1; }
  const s = S.slots[i], d = Math.min(f * (s.end - s.start), s.end - now); s.start -= d; s.end -= d; return i;
}
const useBank = (S, now) => { const f = S.guests.warm; if (f > 0 && S.slots.some(s => s && s.end > now)) { S.guests.warm = 0; return warm(S, f, now); } return -1; };

// the guest's egg: straight into a free hatch slot (its usual time), else its nest, else GIFT.eggHearts (as a full nest);
// GUEST.eggDay a day, then none (the hearts only). A habitat not open yet: the host's egg.
function leaveEgg(S, g, now, rng) {
  const Q = S.guests, R = BY[g.k], h = S.unlocked.includes(R.egg) ? R.egg : g.hab, type = HAB[h]?.nest, i = S.slots.indexOf(null);
  const n = type && (S.nests[h] ??= { t: now, eggs: [] });
  if (Q.eggs >= G.eggDay || !type) return null;
  if (i < 0 && n.eggs.length >= B.nest.max) { S.hearts += GIFT.eggHearts; return { hearts: GIFT.eggHearts }; }
  Q.eggs++; const e = layEgg(S, type, rng);
  if (i < 0) { n.eggs.push(e); return { hab: h, nest: true }; }
  S.slots[i] = { egg: e, start: now, end: now + B.hatch[e.rarity] * (EGG[type]?.hatchScale ?? 1) };
  return { hab: h, slot: i };
}
// 대만족's chance of a guest prop of the habitat not owned yet (all owned, or not in PROPS yet: hearts)
function gift(S, g, rng) {
  if (rng() >= G.gift[BY[g.k].stay]) return null;
  const own = new Set(S.props.map(p => p.prop)), P = GUEST_PROPS.filter(p => p.hab === g.hab && PROP[p.id] && !own.has(p.id));
  if (!P.length) { S.hearts += G.giftHearts; return { hearts: G.giftHearts }; }
  const p = P[Math.floor(rng() * P.length)]; S.props.push({ uid: S.nextId++, prop: p.id, hab: g.hab, placed: false, x: 0, z: 0, rot: 0 });
  return { prop: p.id };
}
// what the UI shows before (보상을 미리 보여 주고 고르게): hearts for 만족 and 대만족, whose egg, the gift chance
export const preview = (S, g) => { const R = BY[g.k], h = G.hearts[R.stay];
  return { hearts: h, great: g.b ? h * G.great : null, egg: S.guests.eggs < G.eggDay ? (S.unlocked.includes(R.egg) ? R.egg : g.hab) : null, gift: g.b ? G.gift[R.stay] : 0 }; };

// off the list; a pair's other one goes too, the same way (bye; gone while shut); the tutorial's next step once its guests are gone
function drop(S, g, ev, now, what = 'bye') {
  const Q = S.guests; Q.list = Q.list.filter(x => x !== g);
  for (const o of Q.list.filter(x => g.pair != null && x.pair === g.pair)) { ev.push({ type: 'guest', what, id: o.id, k: o.k }); Q.list = Q.list.filter(x => x !== o); }
  if (g.tut != null && Q.tut === g.tut && !Q.list.some(x => x.tut === g.tut)) {
    Q.tut++; Q.tt = now + (TUTORIAL[Q.tut]?.gap ?? 0);
    if (Q.tut >= TUTORIAL.length) { Q.tut = -1; Q.next = now + G.arrive[0]; ev.push({ type: 'guest', what: 'tutDone', night: tonightGuest(S, now)?.k ?? null }); }
  }
}
const leave = (S, g, what, ev, now) => { ev.push({ type: 'guest', what, id: g.id, k: g.k }); drop(S, g, ev, now, what); }; // bye: 「다음에 또 올게」 · gone: while the app was shut

// 만족 / 대만족 (great): the rewards, then the guest goes
export function satisfy(S, id, great, now, rng = Math.random) {
  const Q = S.guests, g = Q.list.find(x => x.id === id); if (!g) return [];
  const R = BY[g.k], x = great ? G.great : 1, hearts = G.hearts[R.stay] * x;
  S.hearts += hearts; S.xp += great ? G.xp.great : G.xp.ok;
  const egg = leaveEgg(S, g, now, rng), slot = warm(S, TUTORIAL[g.tut]?.cut ?? (great ? G.cut.great : G.cut.ok), now), got = great ? gift(S, g, rng) : null; // the egg first:
  useBank(S, now); // in a free slot it is usually the one with the most time left, so it starts with the cut (「게이지가 이미 30%」)
  (Q.seen[g.k] ??= [0, 0])[great ? 1 : 0]++;
  const ev = [{ type: 'guest', what: great ? 'great' : 'happy', id, k: g.k, hearts, slot, egg, gift: got }];
  drop(S, g, ev, now); return ev;
}

// a guest comes: wishes drawn from its pool (only doable ones; none: it doesn't come now), a 덤 that doesn't clash
function draw(S, R, rng) {
  const ok = w => doable(S, R.hab, w), w = shuffle(R.wish.filter(ok), rng).slice(0, { short: 1 + (rng() < 0.5), normal: 2, long: 2 + (rng() < 0.5) }[R.stay]);
  if (!w.length) return null;
  const b = shuffle(R.bonus.filter(x => ok(x) && !w.includes(x) && !w.some(y => clashOf(y).includes(x))), rng)[0] ?? null;
  return { w: R.when ? [R.when, ...w] : w, b };
}
function come(S, R, now, rng, o, ev) {
  const g = { id: S.nextId++, k: R.k, hab: R.hab, at: now, on: o.tut != null ? G.tutStay : G.stay[R.stay].on, off: G.stay[R.stay].off,
    w: o.w, b: o.b ?? null, hit: 0, x: null, z: null, from: o.from ?? (rng() < 0.5 ? 'stream' : 'path') };
  if (o.pair != null) g.pair = o.pair; if (o.tut != null) g.tut = o.tut;
  S.guests.list.push(g); ev.push({ type: 'guest', what: 'arrive', id: g.id, k: R.k, hab: R.hab, from: g.from, pair: g.pair ?? null }); return g;
}
// the roster of a habitat now: open by Lv, `when` holding, not here already (a `when` one first: weight 4)
function arrive(S, hab, now, rng, env, ev) {
  const Q = S.guests, lv = S.lv || 1, ready = R => R.hab === hab && R.lv <= lv && (!R.when || !!env[WISH[R.when].v]) && !Q.list.some(g => g.k === R.k);
  const pool = GUESTS.filter(ready), room = cap(S) - Q.list.length;
  if (room >= 2 && lv >= G.pairLv && pool.length >= 2 && rng() < G.pair) { // 부딪치는 소원: two at one spot, one side of a CLASH each
    const c = shuffle(CLASH.filter(c => c.every(w => doable(S, hab, w))), rng)[0];
    if (c) {
      const [A, Bg] = shuffle(pool.filter(R => !R.when), rng), from = rng() < 0.5 ? 'stream' : 'path';
      if (A && Bg) {
        const more = (R, n) => shuffle(R.wish.filter(w => doable(S, hab, w) && !CLASH.flat().includes(w)), rng).slice(0, n);
        const p = S.nextId; // a pair's id: its first guest's
        come(S, A, now, rng, { w: [c[0], ...more(A, rng() < 0.5 ? 1 : 0)], from, pair: p }, ev); come(S, Bg, now, rng, { w: [c[1], ...more(Bg, 1)], from, pair: p }, ev); return true;
      }
    }
  }
  let sum = 0; const wt = R => R.when ? 4 : 1; for (const R of pool) sum += wt(R);
  for (let r = rng() * sum, i = 0; i < pool.length; i++) if ((r -= wt(pool[i])) < 0) { const d = draw(S, pool[i], rng); if (!d) return false; come(S, pool[i], now, rng, d, ev); return true; }
  return false;
}
function tutStep(S, now, ev) {
  const Q = S.guests, st = TUTORIAL[Q.tut];
  if (st.free) { S.props.push({ uid: S.nextId++, prop: st.free, hab: 'meadow', placed: false, x: 0, z: 0, rot: 0 }); ev.push({ type: 'guest', what: 'free', prop: st.free }); }
  const p = st.pair ? S.nextId : null; // a pair's id: its first guest's
  for (const t of st.guests) come(S, BY[t.k], now, () => 0, { w: t.wish, from: t.from, tut: Q.tut, pair: p }, ev);
}

// Each tick of the open app (game.js, with advance). env: { hab: the habitat on screen, night, rain, snow, sky };
// world: the 3D adapter (null when no habitat is on screen: nothing is judged then). Returns events { type: 'guest', what }:
// arrive, wish (n new wishes met: their hearts), happy / great (rewards), bye (「다음에 또 올게」), gone (left while shut),
// free (the tutorial's prop), hello (an old save's card), tutDone (night: 「오늘 밤 손님」 k or null).
export function guestTick(S, now, rng = Math.random, env = {}, world = null) {
  const Q = S.guests ??= blank(S), ev = [], dt = Q.t ? Math.max(0, now - Q.t) : 0, shut = dt > G.gap, hab = env.hab ?? 'meadow';
  Q.t = now;
  const day = dayOf(now); if (Q.day !== day) { Q.day = day; Q.eggs = 0; }
  for (const g of [...Q.list]) { if (shut) g.off -= dt; else g.on -= dt; if (Q.list.includes(g) && (g.on <= 0 || g.off <= 0)) leave(S, g, shut ? 'gone' : 'bye', ev, now); }
  useBank(S, now);
  if (Q.tut >= 0) { // 새 첫 5분: one step at a time, after the first hatch
    if (S.stats?.hatch > 0 && !Q.list.some(g => g.tut === Q.tut)) { if (!Q.tt) Q.tt = now + TUTORIAL[Q.tut].gap; else if (now >= Q.tt) tutStep(S, now, ev); }
  } else if (S.unlocked.includes(hab)) {
    if (Q.hello) { Q.hello = 0; Q.next = now; ev.push({ type: 'guest', what: 'hello' }); }
    Q.next = Math.max(Q.next, now); // a long time shut banks one guest at most (the ones still in their off stay are there too)
    while (Q.list.length < cap(S) && now >= Q.next) { if (!arrive(S, hab, now, rng, env, ev)) { Q.next = now + G.arrive[0]; break; } Q.next += span(G.arrive, rng); }
    if (Q.list.length >= cap(S)) Q.next = Math.max(Q.next, now + G.arrive[0]); // full: the next one a while after someone goes
  }
  if (!world) return ev;
  for (const g of [...Q.list]) {
    if (g.hab !== hab || !Q.list.includes(g)) continue;
    if (g.x == null) { // a pair: side by side; else not where it is happy already, as far as it strays (walk.js 1.5 m: no 튜토리얼 양 by wild flowers)
      const o = Q.list.find(x => x !== g && x.pair != null && x.pair === g.pair && x.x != null), pad = [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]], happy = (x, z) => pad.some(([a, b]) => judge({ ...g, x: x + a, z: z + b }, world, env).all), land = (x, z) => pad.every(([a, b]) => judge({ ...g, x: x + a, z: z + b }, world, env).met.every((m, i) => m || !GROUNDS.includes(g.w[i]))); // its ground wishes met all round where it lands, as far as it strays (물가 토끼 by the water: a friend is brought)
      const p = o ? [o.x + 0.9, o.z] : world.entry(g.hab, g.from, rng, (x, z) => land(x, z) && !happy(x, z), Q.tut >= 0); if (p) { g.x = p[0]; g.z = p[1]; } }
    if (g.x == null) continue; // entry null: a window is up, it lands once the view is seen
    const r = judge(g, world, env), bits = r.met.reduce((m, ok, i) => ok ? m | 1 << i : m, 0), fresh = bits & ~g.hit;
    if (fresh) { const n = r.met.filter((ok, i) => fresh & 1 << i).length; g.hit |= fresh; S.hearts += n * G.wishHeart; ev.push({ type: 'guest', what: 'wish', id: g.id, n, hearts: n * G.wishHeart }); }
    if (!r.all) { delete g.ok; continue; }
    g.ok ??= now;
    if (r.bonus || !g.b || now - g.ok >= G.grace) ev.push(...satisfy(S, g.id, r.bonus, now, rng));
  }
  return ev;
}
// long press on a guest: it moves (a pair moves together, so the clash stays a choice)
export function moveGuest(S, id, x, z) {
  const g = S.guests?.list.find(g => g.id === id); if (!g || g.x == null) return false;
  const dx = x - g.x, dz = z - g.z; for (const o of S.guests.list) if (o === g || g.pair != null && o.pair === g.pair) { o.x += dx; o.z += dz; } return true;
}
// the shop's one tutorial prop (등불 at step 3, before its Lv) while that step's guest is here
export const tutShop = S => { const Q = S.guests, st = Q && TUTORIAL[Q.tut]; return st?.shop && Q.list.some(g => g.tut === Q.tut) ? st.shop : null; };
// 「오늘 밤 손님」: the night guest of an open habitat at this Lv, one a night (by the night's number)
export const tonightGuest = (S, now) => { const L = GUESTS.filter(R => R.when === '밤' && R.lv <= (S.lv || 1) && S.unlocked.includes(R.hab)); return L.length ? L[nightNo(now) % L.length] : null; };
