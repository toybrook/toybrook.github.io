// 17-1 성격과 단짝. Each friend has one 성격 of PERSONAS (a.pe): drawn at hatch from its id and the hatch time (a hash, not the
// game's rng: the sims' eggs stay as they were); a 0.7x save's friend gets one the same way, once (fromSave: the same save, the
// same one). What a 성격 does is in the view (animals/walk.js, play.js through habitat.js ctx.bf). 단짝: two friends out in the
// same place whose 성격 go together (the same one, or one in `good`) add up time there (real time, the app shut too); at
// BALANCE.pal.hours they are 단짝: one new pair a day, a place one pair per `per` friends out (1 at least), a friend in one pair.
// A pair stays (a friend sent back: it goes). S.flags.palOff (설정 「성격·단짝」 끔): no time adds up, no pair, the view does none of it.
// S.pals: { at: the last tick, t: { 'a-b': ms together (a < b) }, list: [{ a, b, at, new }] } (new: its card not seen yet)
import { BALANCE as B, HABITATS } from './data.js';
import { outIn } from './rules.js';
import { hash } from './sky.js';
import { dayOf } from './clock.js';

export const PERSONAS = [
  { id: 'shy', name: '겁쟁이', line: '비가 오면 덤불 옆에 숨어요', good: ['easy', 'tidy'] },
  { id: 'curious', name: '호기심쟁이', line: '새 소품이 놓이면 제일 먼저 가 봐요', good: ['prank', 'collector'] },
  { id: 'glutton', name: '먹보', line: '먹이통과 열매 앞에서 한참 머물러요', good: ['sleepy', 'prank'] },
  { id: 'sleepy', name: '잠꾸러기', line: '낮잠을 길게 자요', good: ['glutton', 'easy'] },
  { id: 'prank', name: '장난꾸러기', line: '친구에게 술래잡기를 자주 걸어요', good: ['curious', 'glutton'] },
  { id: 'tidy', name: '깔끔이', line: '몸을 자주 털고 빗물에 첨벙대지 않아요', good: ['shy', 'collector'] },
  { id: 'collector', name: '수집가', line: '여기저기 구경하며 돌아다녀요', good: ['curious', 'tidy'] },
  { id: 'easy', name: '느긋이', line: '천천히 걷고 오래 쉬어요', good: ['shy', 'sleepy'] },
];
export const PE = Object.fromEntries(PERSONAS.map(p => [p.id, p]));
export const peOf = (id, born) => PERSONAS[Math.floor(hash(+id || 0, +born || 0, 17) * PERSONAS.length)].id;
export const match = (x, y) => x === y || !!PE[x]?.good.includes(y);
export const mateOf = (S, id) => { const p = S.pals.list.find(p => p.a === id || p.b === id); return p && (p.a === id ? p.b : p.a); };

export const blank = () => ({ at: 0, t: {}, list: [] });
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export function tidyPals(S) { // fromSave
  for (const a of S.animals) if (!Object.hasOwn(PE, a.pe)) a.pe = peOf(a.id, a.born);
  const P = isObj(S.pals) ? S.pals : blank(), ids = new Set(S.animals.map(a => a.id)), used = new Set();
  S.pals = { at: Number.isFinite(P.at) ? P.at : 0,
    t: isObj(P.t) ? Object.fromEntries(Object.entries(P.t).filter(([k, v]) => /^\d+-\d+$/.test(k) && Number.isFinite(v) && v >= 0)) : {},
    list: (Array.isArray(P.list) ? P.list : []).filter(p => isObj(p) && p.a !== p.b && ids.has(p.a) && ids.has(p.b) && Number.isFinite(p.at) && !used.has(p.a) && !used.has(p.b) && used.add(p.a).add(p.b))
      .map(p => ({ a: p.a, b: p.b, at: p.at, ...p.new === true && { new: true } })) };
}

export function palTick(S, now, ev) { // advance
  const P = S.pals, dt = P.at ? Math.max(0, now - P.at) : 0, ids = new Set(S.animals.map(a => a.id)); P.at = now;
  P.list = P.list.filter(p => ids.has(p.a) && ids.has(p.b));
  if (S.flags.palOff) return;
  const paired = new Set(P.list.flatMap(p => [p.a, p.b])), keep = k => k.split('-').every(i => ids.has(+i) && !paired.has(+i));
  const t = Object.fromEntries(Object.entries(P.t).filter(([k]) => keep(k))), today = dayOf(now), room = !P.list.some(p => dayOf(p.at) === today);
  let best = null;
  for (const h of HABITATS) {
    const out = outIn(S, h.id), free = out.filter(a => !paired.has(a.id)), here = P.list.filter(p => out.some(a => a.id === p.a)).length;
    const can = room && here < Math.max(1, Math.floor(out.length / B.pal.per));
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const x = free[i], y = free[j]; if (!match(x.pe, y.pe)) continue;
      const [a, b] = x.id < y.id ? [x.id, y.id] : [y.id, x.id], k = a + '-' + b, v = t[k] = (t[k] || 0) + dt;
      if (can && v >= B.pal.hours * 36e5 && !(best?.v >= v)) best = { a, b, k, v };
    }
  }
  P.t = t;
  if (!best) return;
  delete t[best.k]; P.list.push({ a: best.a, b: best.b, at: now, new: true }); ev.push({ type: 'pal', a: best.a, b: best.b });
}
