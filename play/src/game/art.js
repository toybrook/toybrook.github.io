// 17-2 동물이 꾸미는 정원 (동물 작품). While the player is away (no tap or key for ART.idle, the app shut too), a 수집가·장난꾸러기·
// 깔끔이 friend out in the habitat last entered makes a small 작품 of things it found (주운 것: PROPS gift '주운 것', never sold),
// one a day, none while ART.max wait for a choice there. Which friend and which shape: by the day (no rng: the sims' eggs stay).
// It waits in S.art.todo till the habitat is on screen (the board finds the empty ground: habitat.js artSpot), then it is a placed
// prop (S.props, p.art) asking for a choice: 그대로 두기 (stays, a prop like any other), 기록만 남기고 치우기 (작품집 + its 주운 것
// to storage), 치우기. S.flags.artOff (설정 「동물 작품 만들기」 끔): none made.
// S.art: { here: last tap, day: the day of the last one, todo: [{ uid, prop, hab, art }], book: [{ prop, who, hab, at }] }
// art: { by: friend id, who: 「수집가 토끼 몽실이」, at, ask: 1 (no choice yet), told: 1 (its notice seen), night: 1 (밤사이) }
import { PROPS, HOLD } from './data.js';
import { outIn, SP, HAB } from './rules.js';
import { PE } from './pals.js';
import { dayOf } from './clock.js';

export const ART = { idle: 3600e3, max: 3, book: 60, pe: ['collector', 'tidy', 'prank'] };
// the shapes each 성격 makes, by habitat (one not listed: the meadow's). 수집가 dotted rings and bunches, 깔끔이 rows, 장난꾸러기 odd piles
const BY = {
  collector: { meadow: ['art_ring', 'art_bunch'], pond: ['art_heart', 'art_ring'], snow: ['art_icering', 'art_ring'] },
  tidy: { meadow: ['art_row', 'art_ring'], pond: ['art_shellrow', 'art_row'], snow: ['art_icerow', 'art_row'] },
  prank: { meadow: ['art_tower', 'art_hut'], pond: ['art_hut', 'art_tower'], snow: ['art_icetower', 'art_hut'] },
};
const P = Object.fromEntries(PROPS.map(p => [p.id, p]));
export const shapes = (pe, hab) => BY[pe]?.[hab] || BY[pe]?.meadow || [];

export const blank = () => ({ here: 0, day: '', todo: [], book: [] });
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const num = v => Number.isFinite(v);
const tidyMark = a => isObj(a) && typeof a.who === 'string' && num(a.at) ? { by: num(a.by) ? a.by : 0, who: a.who.slice(0, 40), at: a.at, ...a.ask === 1 && { ask: 1 }, ...a.told === 1 && { told: 1 }, ...a.night === 1 && { night: 1 } } : null;
export function tidyArt(S) { // fromSave (a save before 17-2: none)
  const A = isObj(S.art) ? S.art : blank();
  S.art = { here: num(A.here) ? A.here : 0, day: typeof A.day === 'string' ? A.day : '',
    todo: (Array.isArray(A.todo) ? A.todo : []).filter(t => isObj(t) && num(t.uid) && P[t.prop]?.art && HAB[t.hab] && tidyMark(t.art)?.ask).slice(0, ART.max * 3)
      .map(t => ({ uid: t.uid, prop: t.prop, hab: t.hab, art: tidyMark(t.art) })),
    book: (Array.isArray(A.book) ? A.book : []).filter(b => isObj(b) && P[b.prop]?.art && HAB[b.hab] && typeof b.who === 'string' && num(b.at)).slice(-ART.book)
      .map(b => ({ prop: b.prop, who: b.who.slice(0, 40), hab: b.hab, at: b.at })) };
  for (const p of S.props) if (p.art !== undefined) { const m = P[p.prop]?.art && tidyMark(p.art); if (m && !p.placed) delete m.ask, delete m.told; if (m) p.art = m; else delete p.art; } // put away: no more asking
}

// the ones placed in hab waiting for a choice; with those made and not placed yet
export const asking = (S, hab) => S.props.filter(p => p.placed && p.hab === hab && p.art?.ask);
export const waiting = (S, hab) => S.art.todo.filter(t => t.hab === hab).length + asking(S, hab).length;
export const whoOf = a => `${PE[a.pe]?.name ?? ''} ${SP[a.species]?.name ?? ''}${a.nm ? ' ' + a.nm : ''}`.replace(/ +/g, ' ').trim(); // 「먹보 양 몽실이」 (the kind only: no 단색·얼룩)

export function artTick(S, now, ev) { // advance
  const A = S.art, hab = S.flags.lastHab; if (!A.here) A.here = now;
  for (const p of S.props) if (p.art?.ask && !p.placed) { delete p.art.ask; delete p.art.told; } // put away (꾸미기, 판 비우기): no more asking, as on load
  if (S.flags.artOff || now - A.here < ART.idle || A.day === dayOf(now) || !hab || !S.unlocked.includes(hab) || !HAB[hab]?.ready || HOLD[hab] || waiting(S, hab) >= ART.max) return;
  const who = outIn(S, hab).filter(a => ART.pe.includes(a.pe)).sort((a, b) => a.id - b.id); if (!who.length) return;
  const n = Math.floor(now / 864e5), a = who[n % who.length], sh = shapes(a.pe, hab), prop = sh[Math.floor(n / who.length) % sh.length];
  const night = now - A.here >= 6 * 3600e3 && new Date(now).getHours() < 12;
  const t = { uid: S.nextId++, prop, hab, art: { by: a.id, who: whoOf(a), at: now, ask: 1, ...night && { night: 1 } } };
  A.todo.push(t); A.day = dayOf(now); ev.push({ type: 'art', uid: t.uid, hab });
}

// the board found a spot (x, z in saved units), or none (x null: it goes, nothing asked)
export function artAt(S, uid, x, z) {
  const i = S.art.todo.findIndex(t => t.uid === uid); if (i < 0) return false;
  const [t] = S.art.todo.splice(i, 1); if (x == null) return false;
  S.props.push({ uid: t.uid, prop: t.prop, hab: t.hab, placed: true, x, z, rot: 0, art: t.art }); return true;
}
// keep: stays (a prop, 꾸미기 moves or puts it away); record: in the 작품집, its 주운 것 to storage; clear: gone
export function artPick(S, uid, what) {
  const p = S.props.find(p => p.uid === uid && p.art?.ask); if (!p || !['keep', 'record', 'clear'].includes(what)) return null;
  const a = p.art; let got = null;
  if (what !== 'clear') S.art.book.push({ prop: p.prop, who: a.who, hab: p.hab, at: a.at }), S.art.book.splice(0, Math.max(0, S.art.book.length - ART.book));
  if (what === 'keep') { delete a.ask; delete a.told; return { what }; }
  S.props.splice(S.props.indexOf(p), 1);
  if (what === 'record' && P[P[p.prop].find]) S.props.push(got = { uid: S.nextId++, prop: P[p.prop].find, hab: p.hab, placed: false, x: 0, z: 0, rot: 0 });
  return { what, got: got?.prop };
}
export const artClear = (S, hab) => asking(S, hab).map(p => artPick(S, p.uid, 'clear')).length; // 모두 치우기
export const artTold = (S, uids) => { for (const p of [...S.props, ...S.art.todo]) if (uids.includes(p.uid) && p.art?.ask) p.art.told = 1; }; // seen in 돌아왔어요 (placed or not yet)
