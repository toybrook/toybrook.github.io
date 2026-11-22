// 199 B-11 ?g190 trial (docs/game-purpose.md 12장, inbox 199 B): 초원 시리즈 1탄 (12칸 + 시크릿 자리), 교환 도장 (분해 · 빠진 칸
//교환), 의뢰 1건, 물어오기 (하루 2개), 흔들어 보기 (하루 3번). Rules only: no DOM, no three.js (ui/series.js draws it).
// The series is read off the codex (no odds of its own: a cell is a codex cell). Its save is three keys, S.stamp, S.ser, S.req, none
// of them in newGame: a build without the flag keeps them as they came (rules.fromSave keeps unknown keys) and reads nothing in them.
// With the flag tidy() checks their shape after every load. Eggs may carry v (shaken), pick (swapped), sp (fetched): rules.crack
// honours them in any build, each only when it is a real look of the egg's rarity.
import { $t } from '../i18n/i18n.js';
import { BALANCE as B, HABITATS, ACCESSORIES, TUT228 } from './data.js';
import { SP, RAR, EGG, variantOf, rollRarity, crackRarity, choose, canSendBack, putGift, hatchMs, eggMarks, bump } from './rules.js';
import { dayOf } from './clock.js';
import { GUESTS } from './guests-data.js';
import { doable } from './guests.js';

const H = 36e5;
// 3-1 가안: 일반 8 + 희귀 3 + 영웅 1, all of them meadow cells today (inbox 199 B 1). Legendary cells are never in a series
export const SERIES = [{ id: 'm1', name: $t('초원 시리즈 1탄'), hab: 'meadow', egg: 'meadow_nest', prize: 'ser_m1',
  cells: ['horse:spots', 'sheep:spots', 'rabbit:spots', 'pig:spots', 'cow:spots', 'chicken:spots', 'horse:stripes', 'rabbit:twotone',
    'sheep:velvet', 'pig:jelly', 'cow:marble', 'chicken:quilling'] }];
// inbox 199 B 2: 분해 (a duplicate into stamps, the card's choice next to 판매) and 교환 (a missing cell for stamps); a secret breaks x2
export const STAMP = { brk: { common: 1, rare: 3, heroic: 8, legendary: 25 }, swap: { common: 10, rare: 30, heroic: 80 }, secretX: 2 };
// 3-9 물어오기: every 3 h each fetching prop placed in an open habitat (4 at most there) brings an egg at p; inbox 199 B 4: 2 a day and
// 2 waiting at most. The egg is that habitat's, its rarity the nest's odds; only its species narrow to the prop's group (when 4 or
// more of them live there, else any). back: windows caught up after the game was shut
export const FETCH = { cap: 2, wait: 2, every: 3 * H, p: 0.25, per: 4, min: 4, back: 8,
  props: { hay: 'graze', trough: 'graze', lily: 'water', duckhouse: 'water', mushrooms: 'small', lantern: 'night', att_birdhouse: 'bird', feeder: 'bird', mailbox: null },
  groups: { graze: ['horse', 'cow', 'sheep', 'pig'], water: ['duck', 'turtle', 'swan', 'seal'], small: ['rabbit', 'otter', 'capybara', 'arcticFox'],
    night: ['horse', 'reindeer', 'arcticFox', 'snowyOwl'], bird: ['chicken', 'duck', 'swan', 'flamingo', 'penguin', 'snowyOwl'] } };
// 3-8 흔들어 보기: a hatch slot's egg tapped rolls its look now (the same roll a hatch makes), 3 a day; the sound tells its group
export const KNOCK = { day: 3, sound: { clear: 'glass dew celadon bluewhite stained bubble', heavy: 'chrome hammered marble', crisp: 'wood marquetry quilling xstitch beads najeon glitter glow' } };
export const SOUND = { clear: [$t('맑은 소리가 나요'), 'bell'], heavy: [$t('묵직한 소리가 나요'), 'place'], soft: [$t('말랑한 소리가 나요'), 'pop'],
  crisp: [$t('사각사각 소리가 나요'), 'wood'], shine: [$t('반짝이는 소리가 나요'), 'lights'] };
// 3-2 의뢰 (215, docs/design/requests-12.md): 12 이야기 의뢰, each its visitor (guests-data.js GUESTS k), the habitat, lv (the
// player's S.lv), must (all for ★1) and extra (★ each): guests.js judge's wish keys (WISH keys are the Korean words: never $t here,
// the windows translate them), judged where the camera looks in 사진 모드. Hearts and the prop once, the stars kept at their best
// (shot again for more: no second reward). The prize props: data.js req_r1..r12 (free, gift only)
const rq = (id, who, hab, lv, must, extra, name, line, post, thanks) => ({ id, who, hab, lv, must, extra, name, line, post, thanks, hearts: 15, prop: 'req_' + id });
export const REQUESTS = [
  rq('r1', 'm_sheep', 'meadow', 1, ['꽃', 'pals2'], ['쉼터', 'sp:sheep'], $t('꽃밭에 둘러앉은 친구들'), $t('꽃 곁에 친구 둘이 모여 있는 사진을 받고 싶어요'), $t('사진을 보따리 맨 위에 넣어 두었어요. 꽃 냄새가 여기까지 나는 것 같아요.'), $t('다음 소풍은 이 매트 위에서 해요.')),
  rq('r2', 'p_duck', 'pond', 1, ['물가', 'sp:duck'], ['꽃', 'pals2'], $t('물가에 핀 꽃과 오리'), $t('물가에서 꽥꽥 노는 오리 사진을 받고 싶어요'), $t('물소리가 들리는 것 같아서 사진을 자꾸 꺼내 봐요.'), $t('다음엔 같이 퐁당 해요!')),
  rq('r3', 'm_chicken', 'meadow', 2, ['먹을 것', 'pals1'], ['물가', 'baby'], $t('든든한 새참 시간'), $t('먹을 것 곁에 친구가 있는 사진을 받고 싶어요'), $t('사진을 보다가 배가 고파져서 낟알을 세 번이나 쪼았어요.'), $t('잘 먹는 친구들, 참 보기 좋아요.')),
  rq('r4', 'm_pig', 'yard', 2, ['먹을 것', '쉼터'], ['꽃', 'pals2'], $t('뜰에서 여는 소풍'), $t('먹을 것과 쉴 자리가 있는 뜰 사진을 받고 싶어요'), $t('사진을 보고 모자를 고쳐 쓰고 길을 나섰어요. 소풍 가는 길이에요.'), $t('자리 하나만 남겨 둬요!')),
  rq('r5', 'p_turtle', 'pond', 1, ['쉼터', 'sp:turtle'], ['그늘', 'quiet'], $t('거북의 낮잠 자리'), $t('쉴 자리 곁에 거북이 있는 사진을 받고 싶어요'), $t('사진을 천천히, 아주 천천히 봤어요. 다 보는 데 하루가 걸렸어요.'), $t('서두르지 않아도 괜찮아요.')),
  rq('r6', 'm_horse', 'meadow', 1, ['높은 곳', 'sp:horse'], ['풀밭', 'pals3'], $t('언덕 위의 말'), $t('높은 곳에 말이 서 있는 사진을 받고 싶어요'), $t('사진을 보니 다리가 근질근질해서 언덕을 두 번 달렸어요.'), $t('바람이 불면 제 생각 해 줘요.')),
  rq('r7', 'p_otter', 'pond', 5, ['놀이', '물가'], ['pals2', 'sp:duck'], $t('물 위의 놀이터'), $t('물가에 놀 거리가 있는 사진을 받고 싶어요'), $t('사진을 보고 참을 수가 없어서 세 번 연달아 뛰어들었어요.'), $t('다음엔 저도 끼워 줘요!')),
  rq('r8', 'p_capy', 'yard', 1, ['놀이', '그늘'], ['물가', 'pals3'], $t('그늘 아래 놀이터'), $t('그늘에 놀 거리가 있는 뜰 사진을 받고 싶어요'), $t('사진을 보다가 그대로 잠들었어요. 좋은 꿈을 꿨어요.'), $t('뜰이 참 포근해 보여요.')),
  rq('r9', 's_penguin', 'snow', 1, ['놀이', 'sp:penguin'], ['높은 곳', 'pals2'], $t('눈밭의 놀이 시간'), $t('눈밭에서 노는 펭귄 사진을 받고 싶어요'), $t('눈밭에서 노는 모습을 보고, 저도 뒤뚱뒤뚱 나가서 놀았어요.'), $t('눈밭은 같이 놀 때 제일 신나요!')),
  rq('r10', 's_seal', 'snow', 1, ['쉼터', 'sp:seal'], ['pals2', 'baby'], $t('눈밭의 포근한 집'), $t('쉴 자리 곁에 물범이 있는 사진을 받고 싶어요'), $t('사진이 너무 포근해서 베고 잤어요. 조금 구겨졌지만 괜찮아요.'), $t('같이 뒹굴 날을 기다려요.')),
  rq('r11', 's_deer', 'snow', 6, ['소리', 'pals1'], ['빛', 'pals3'], $t('눈밭 음악회'), $t('소리 나는 것 곁에 친구가 있는 사진을 받고 싶어요'), $t('사진을 보는데 어디선가 딸랑딸랑 소리가 났어요. 제 보따리였어요.'), $t('그 소리, 여기까지 들려요.')),
  rq('r12', 's_fox', 'yard', 2, ['먹을 것', '빛'], ['쉼터', 'alone'], $t('아무도 모르는 찻집'), $t('불빛 곁에 먹을 것이 놓인 뜰 사진을 받고 싶어요'), $t('아무도 없을 때 살금살금 다녀갔어요. 찻잔이 비어 있으면 저예요.'), $t('비밀로 해 줘요.'))];
export const REQ = Object.assign(Object.create(null), Object.fromEntries(REQUESTS.map(q => [q.id, q])));
// 작은 의뢰 (221 B 3): 8 templates, ♥15, no prop, never done; its habitat and visitor drawn when it comes (kept on its board entry).
// They fill the board's places a story does not take and go at the day's end (a story stays till it is answered)
const sm = (id, must, extra, name, line) => ({ id, must, extra, name, line, hearts: 15, small: true });
export const SMALL = [
  sm('s1', ['꽃', 'pals1'], ['pals2'], $t('꽃 곁의 친구'), $t('꽃 곁에 친구가 있는 사진을 받고 싶어요')),
  sm('s2', ['먹을 것', 'pals1'], ['쉼터'], $t('간식 시간'), $t('먹을 것과 친구가 함께 있는 사진을 받고 싶어요')),
  sm('s3', ['쉼터', 'pals2'], ['그늘'], $t('쉼터의 친구들'), $t('쉴 자리에 친구 둘이 모인 사진을 받고 싶어요')),
  sm('s4', ['놀이', 'pals1'], ['물가'], $t('노는 시간'), $t('놀 거리 곁에 친구가 있는 사진을 받고 싶어요')),
  sm('s5', ['빛', 'pals1'], ['꽃'], $t('반짝이는 불빛'), $t('불빛 곁에 친구가 있는 사진을 받고 싶어요')),
  sm('s6', ['소리', 'pals2'], ['풀밭'], $t('작은 음악회'), $t('소리 나는 것 곁에 친구 둘이 있는 사진을 받고 싶어요')),
  sm('s7', ['물가', 'pals2'], ['baby'], $t('물가 나들이'), $t('물가에 친구 둘이 있는 사진을 받고 싶어요')),
  sm('s8', ['높은 곳', 'pals1'], ['그늘'], $t('높은 곳 구경'), $t('높은 곳에 친구가 있는 사진을 받고 싶어요'))];
export const SMALLQ = Object.assign(Object.create(null), Object.fromEntries(SMALL.map(q => [q.id, q])));
export const SMALL_HABS = ['meadow', 'pond', 'snow'];
// 0장 10번 ⑤: the board takes `all` a day, `story` of them stories (`first` on the first day stories come), `board` waiting at most
export const DAILY = { all: 2, story: 1, first: 2, board: 3 };
// a board entry's request: a story by id, a small one with the habitat and visitor it came with
export const reqOf = (id, x) => REQ[id] ?? (SMALLQ[id] && x ? { ...SMALLQ[id], hab: x.hab, who: x.who } : null);
export const reqQ = (S, id) => reqOf(id, S.req.on.find(x => x.id === id));
// what 사진 모드 may send in a habitat: the board's there, then its stories sent with fewer than 3 stars (221 B 2 다시 찍기)
export const reqHere = (S, hab) => [...S.req.on.map(x => reqOf(x.id, x)), ...REQUESTS.filter(q => S.req.done[q.id] < 3 && !S.req.on.some(x => x.id === q.id))].filter(q => q && q.hab === hab);
const WN = { quiet: $t('조용한 곳'), alone: $t('동물 없이'), baby: $t('아기 동물') };
// a WISH key (Korean) in the reader's language (208 A: no emoji, the ui187 icon by .scond[data-i])
export const wishName = w => /^pals(\d)$/.test(w) ? $t('친구 {0}마리', w.slice(4)) : w.startsWith('sp:') ? $t('{0} 한 마리', SP[w.slice(3)]?.name ?? '') : WN[w] ?? $t(w);

// 215 (3-13 컬렉션 번호): counted, never saved, so an old save has its numbers too. A legendary (a story rarity): by its codex `at`
// among theirs (one without `at` last, then by key); a series secret: by its accessory's album `at` among the series' secrets.
// k not there yet: the number it gets now (the reveal card shows it before the cell is kept)
const isStory = k => !!RAR[variantOf(...k.split(':'))?.rarity]?.story;
export function collNo(S, k, secret = false) {
  const t = x => Number.isFinite(x) ? x : Infinity;
  const xs = secret ? Object.values(S.ser || {}).filter(M => M?.sec).map(M => [M.sec.species + ':' + M.sec.variant, t(S.album?.[M.sec.acc]?.at)])
    : isStory(k) ? Object.entries(S.codex || {}).filter(([c]) => isStory(c)).map(([c, e]) => [c, t(e?.at)]) : null;
  if (!xs) return 0;
  const i = xs.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).findIndex(x => x[0] === k); return i < 0 ? xs.length + 1 : i + 1;
}
export const cellsOf = s => s.cells.map(k => { const [sp, v] = k.split(':'); return { key: k, species: sp, variant: v, rarity: variantOf(sp, v).rarity }; });
export const serOf = k => SERIES.find(s => s.cells.includes(k));
export const have = (S, s) => s.cells.filter(k => S.codex[k]).length;
const eggsOf = S => [...Object.values(S.nests).flatMap(n => n.eggs), ...S.slots.filter(Boolean).map(s => s.egg), ...S.giftRow, ...(S.ser?.f?.q || []).map(x => x.egg)];
export const queued = (S, k) => eggsOf(S).some(e => e.pick && e.pick.species + ':' + e.pick.variant === k); // swapped, not hatched yet
export const brkStamps = a => (STAMP.brk[variantOf(a.species, a.variant)?.rarity] || 0) * (a.s ? STAMP.secretX : 1);

// ---- the save (?g190 only): shapes kept, anything else rebuilt empty
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi) => Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : lo;
const day = v => typeof v === 'string' ? v.slice(0, 40) : '';
const look = x => isObj(x) && typeof x.species === 'string' && typeof x.variant === 'string' && !!variantOf(x.species, x.variant);
const okEgg = e => isObj(e) && Number.isInteger(e.id) && Object.hasOwn(EGG, e.type) && Object.hasOwn(B.hatch, e.rarity);
export function tidy(S, now) {
  S.stamp = int(S.stamp, 0, 1e6);
  const T = isObj(S.ser) ? S.ser : {}; S.ser = {};
  for (const s of SERIES) { const M = isObj(T[s.id]) ? T[s.id] : {}, sec = look(M.sec) && s.cells.includes(M.sec.species + ':' + M.sec.variant), acc = sec && Object.hasOwn(ACCESSORIES, M.sec.acc) ? M.sec.acc : null;
    S.ser[s.id] = { n: Number.isInteger(M.n) ? int(M.n, 0, s.cells.length) : have(S, s), ...Number.isFinite(M.got) && { got: M.got }, ...sec && { sec: { species: M.sec.species, variant: M.sec.variant, acc } } }; }
  const F = isObj(T.f) ? T.f : {}, K = isObj(T.k) ? T.k : {};
  S.ser.f = { day: day(F.day), n: int(F.n, 0, FETCH.cap), w: Number.isInteger(F.w) ? F.w : Math.floor(now / FETCH.every),
    q: (Array.isArray(F.q) ? F.q : []).filter(x => isObj(x) && okEgg(x.egg)).slice(0, FETCH.wait).map(x => ({ uid: int(x.uid, 0, Number.MAX_SAFE_INTEGER), egg: x.egg })) };
  S.ser.k = { day: day(K.day), n: int(K.n, 0, KNOCK.day), at: Number.isFinite(K.at) ? K.at : 0 };
  const Q = isObj(S.req) ? S.req : {};
  const okOn = x => isObj(x) && Number.isFinite(x.at) && (Object.hasOwn(REQ, x.id) || Object.hasOwn(SMALLQ, x.id) && SMALL_HABS.includes(x.hab) && GUESTS.some(g => g.k === x.who && g.hab === x.hab));
  S.req = { on: (Array.isArray(Q.on) ? Q.on : []).filter((x, i, a) => okOn(x) && a.findIndex(y => y?.id === x.id) === i).slice(0, DAILY.board).map(x => REQ[x.id] ? { id: x.id, at: x.at } : { id: x.id, at: x.at, hab: x.hab, who: x.who }),
    done: Object.fromEntries(Object.entries(isObj(Q.done) ? Q.done : {}).filter(([id, v]) => Object.hasOwn(REQ, id) && Number.isInteger(v) && v >= 1 && v <= 3)),
    d: day(Q.d), ns: int(Q.ns, 0, DAILY.all), nm: int(Q.nm, 0, DAILY.all), t: Number.isFinite(Q.t) ? Math.min(Q.t, now) : 0 }; // 215: today's day, stories and small ones come today, the last one's time
  for (const x of S.ser.f.q) eggMarks(x.egg); // the other eggs: rules.fromSave, any build
  return S;
}

// ---- after every action and tick: the series read off the codex (a new cell, the secret, the prize), the requests
export function step(S, now) {
  const ev = [];
  for (const s of SERIES) { const M = S.ser[s.id], n = have(S, s);
    if (n > M.n) ev.push({ type: 'series_cell', id: s.id, n }); M.n = n;
    if (!M.sec) { const a = S.animals.find(a => a.s && !a.pending && s.cells.includes(a.species + ':' + a.variant)); if (a) { M.sec = { species: a.species, variant: a.variant, acc: a.acc ?? null }; ev.push({ type: 'series_secret', id: s.id }); } }
    if (n === s.cells.length && (!M.got || !S.props.some(p => p.prop === s.prize))) { const first = !M.got; M.got ??= now; putGift(S, s.prize, null, { cost: 0 }); if (first) ev.push({ type: 'series_done', id: s.id }); } // a build without the flag may have dropped it: given again
  }
  issue(S, now, ev);
  return ev;
}
// 0장 10번: after the first hatch, a story first (in order: its place open, S.lv at its lv, the board not full, none there from the same
// place, today's stories under the cap), then small ones in the places left. A day turned (forward only): the small ones go
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function issue(S, now, ev) {
  const R = S.req, d = dayOf(now), lv = S.lv || 1; if ((S.stats.hatch || 0) < 1) return;
  if (R.d !== d && now >= R.t) { R.d = d; R.t = Math.max(R.t, now); R.ns = R.nm = 0; R.on = R.on.filter(x => REQ[x.id]); }
  const busy = h => R.on.some(x => reqOf(x.id, x)?.hab === h), room = () => R.on.length < DAILY.board && R.ns + R.nm < DAILY.all;
  const first = Object.keys(R.done).length + R.on.filter(x => REQ[x.id]).length === R.ns; // every story so far came today
  for (const q of REQUESTS) {
    if (!room() || R.ns >= (first ? DAILY.first : DAILY.story)) break;
    if (R.done[q.id] || R.on.some(x => x.id === q.id) || !S.unlocked.includes(q.hab) || lv < q.lv || busy(q.hab)) continue;
    R.on.push({ id: q.id, at: now }); R.ns++; R.t = now; ev.push({ type: 'req_new', id: q.id });
  }
  for (let k = 0; room() && k < 6; k++) { // the day and its count pick the place, the template and the visitor
    const v = hash(d + ':' + R.nm + ':' + k), habs = SMALL_HABS.filter(h => S.unlocked.includes(h) && !busy(h)); if (!habs.length) break;
    const h = habs[v % habs.length], ts = SMALL.filter(t => !R.on.some(x => x.id === t.id) && t.must.every(w => doable(S, h, w))), gs = GUESTS.filter(g => g.hab === h && !g.when && (g.lv || 1) <= lv);
    if (!ts.length || !gs.length) continue;
    const t = ts[(v >>> 8) % ts.length], g = gs[(v >>> 16) % gs.length];
    R.on.push({ id: t.id, at: now, hab: h, who: g.k }); R.nm++; R.t = now; ev.push({ type: 'req_new', id: t.id, small: true });
  }
}
export const tick = (S, now, rng = Math.random) => [...fetchTick(S, now, rng), ...step(S, now)];

// ---- 분해 · 교환
export function breakDup(S, id) { // as rules.sendBack (only a look already in the codex, its accessory kept), stamps instead of hearts
  const i = S.animals.findIndex(a => a.id === id && canSendBack(S, a)); if (i < 0) return null;
  const a = S.animals[i], n = brkStamps(a); if (a.acc) S.accs[a.acc] = (S.accs[a.acc] || 0) + 1;
  S.animals.splice(i, 1); S.stamp += n; return { n, events: [{ type: 'stamp_break', n, rarity: variantOf(a.species, a.variant)?.rarity }] };
}
export function swap(S, k) { // a missing cell for stamps: a gift egg of it (no gauges) in the gift row; never the secret, never legendary
  const s = serOf(k), c = s && cellsOf(s).find(c => c.key === k), cost = c && STAMP.swap[c.rarity];
  if (!cost || S.codex[k] || queued(S, k)) return null;
  if (S.stamp < cost) return { short: cost - S.stamp };
  if (S.giftRow.length >= B.nest.gifts) return { full: true };
  const egg = { id: S.nextId++, type: s.egg, rarity: c.rarity, parents: [null, null], gift: true, pick: { species: c.species, variant: c.variant } };
  S.stamp -= cost; S.giftRow.push(egg); if (TUT228) bump(S, 'swap'); return { cost, egg, events: [{ type: 'stamp_swap', key: k, cost }] }; // 236 B: bump
}

// ---- 물어오기
const night = t => { const h = new Date(t).getHours(); return h >= 20 || h < 5; };
const groupOf = (prop, type) => { const g = FETCH.groups[FETCH.props[prop]], sp = g && EGG[type].species.filter(x => g.includes(x)); return sp && sp.length >= FETCH.min ? sp : null; };
export function fetchTick(S, now, rng = Math.random) {
  const F = S.ser.f, w = Math.floor(now / FETCH.every), ev = [];
  if (w <= F.w) return ev; // a clock set back: wait for it (F.w never goes back, review 1: else 2 a day again and again)
  for (let k = Math.max(F.w + 1, w - FETCH.back + 1); k <= w; k++) {
    const t = k * FETCH.every, d = dayOf(t); if (F.day !== d) { F.day = d; F.n = 0; }
    for (const h of HABITATS) { if (!h.nest || !S.unlocked.includes(h.id)) continue;
      for (const p of S.props.filter(p => p.placed && p.hab === h.id && Object.hasOwn(FETCH.props, p.prop)).slice(0, FETCH.per)) {
        if (F.n >= FETCH.cap || F.q.length >= FETCH.wait) break;
        if ((FETCH.props[p.prop] === 'night' && !night(t)) || rng() >= FETCH.p) continue;
        const egg = { id: S.nextId++, type: h.nest, rarity: rollRarity(EGG[h.nest].odds, rng), parents: [null, null] }, sp = groupOf(p.prop, h.nest); if (sp) egg.sp = sp;
        F.q.push({ uid: p.uid, egg }); F.n++; ev.push({ type: 'fetch', prop: p.prop, hab: h.id, rarity: egg.rarity });
      } }
  }
  F.w = w; return ev;
}
export function takeFetched(S, j, now) { // a fetched egg into a free hatch slot (its usual time)
  const i = S.slots.indexOf(null), x = S.ser.f.q[j]; if (i < 0 || !x) return -1;
  S.ser.f.q.splice(j, 1); S.slots[i] = { egg: x.egg, start: now, end: now + hatchMs(S, x.egg) }; return i;
}

// ---- 흔들어 보기
const groupSound = v => v.rarity === 'legendary' ? 'shine' : Object.keys(KNOCK.sound).find(g => KNOCK.sound[g].split(' ').includes(v.variant)) ?? 'soft';
export function shake(S, i, now, rng = Math.random) {
  const s = S.slots[i]; if (!s || now >= s.end) return null;
  const e = s.egg, K = S.ser.k, d = dayOf(now); if (K.day !== d && now >= K.at) { K.day = d; K.n = 0; } // forward only, as rules.attendDue (review 2)
  if (!e.v) {
    if (K.n >= KNOCK.day) return { none: true };
    const { sure, rarity } = crackRarity(S, e), r = e.pick && variantOf(e.pick.species, e.pick.variant)?.rarity === rarity ? e.pick : choose(S, e, rarity, sure, rng);
    if (!r) return null;
    e.v = { rarity, species: r.species, variant: r.variant, ...sure && { p: true } }; K.n++; K.at = now; // p: the gauge's rarity, kept for this egg (rules.crackRarity)
    return { sound: groupSound(e.v), left: KNOCK.day - K.n, events: [{ type: 'egg_shake' }] };
  }
  return { sound: groupSound(e.v), left: KNOCK.day - K.n };
}

// ---- 의뢰: the photo judged where the camera looks (met: guests.judge over must, then extra); the reward once, the stars at their best
export const reqWish = q => [...q.must, ...q.extra];
export const stars = (q, met) => Array.isArray(met) && q.must.every((_, i) => met[i]) ? 1 + q.extra.filter((_, i) => met[q.must.length + i]).length : 0;
export function reqShot(S, id, met) {
  const x = S.req.on.find(x => x.id === id), q = reqOf(id, x); if (!q || (!x && !S.req.done[id])) return null;
  const n = stars(q, met); if (!n) return { stars: 0, met };
  if (q.small) { S.req.on = S.req.on.filter(y => y !== x); S.hearts += q.hearts; if (TUT228) bump(S, 'req'); return { stars: n, met, hearts: q.hearts, small: true, events: [{ type: 'req_done', id, stars: n, small: true, hab: q.hab, who: q.who }] }; }
  const was = S.req.done[id] || 0; S.req.done[id] = Math.max(was, n); S.req.on = S.req.on.filter(y => y.id !== id);
  if (was) return { stars: n, met, again: true, was, events: [{ type: 'req_again', id, stars: n, was }] }; // 다시 찍기: the stars only
  S.hearts += q.hearts; if (TUT228) bump(S, 'req'); const gift = putGift(S, q.prop, null, { cost: 0 });
  return { stars: n, met, hearts: q.hearts, gift, events: [{ type: 'req_done', id, stars: n }] };
}
