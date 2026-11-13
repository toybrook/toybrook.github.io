// 16-1 우리 애 놀러 보내기. A grown friend goes out as a link (#visit=TV1.<code>); on another device it stays as a guest for
// BALANCE.visit.stay (real time), never in S.animals: no seat, no 도감, no 보관함·산책·돌려보내기, so a code edited into a
// fake legendary gets nothing. One link id is taken once per device. When it leaves the host picks a postcard (a picture and
// a line from the lists below); its link (#postcard=TP1.<code>) gives the sender a mail with ♥visit.card (cardDaily a day).
// No free text anywhere: the garden name is two words from GARDEN. Codes: base64url of a JSON array + an FNV sum (a cut or
// edited link is dropped quietly, not a cheat guard). Nothing is sent anywhere: the code sits after # (not to the server).
import { BALANCE as B, ACCESSORIES, HABITATS, SPECIES, PROPS, FOSSIL, paletteOf } from './data.js';
import { SP, HAB, NAT, variantOf, variantsOf, colorsOf, kindName, outIn, newGame, xpAt } from './rules.js';
import { encode, decode, TAG, MAX, b64, unb64 } from './layout.js';
import { dayOf } from './clock.js';
import { when } from './story.js';

export const GARDEN = [['햇살', '달빛', '별빛', '무지개', '솜사탕', '꽃잎', '이슬', '바람', '조약돌', '도토리', '구름', '노을'],
  ['언덕', '들판', '숲속', '호숫가', '오솔길', '마을', '골짜기', '바닷가', '꽃밭', '풀밭', '시냇가', '섬']];
export const PICS = ['🌼', '🍀', '🌙', '⭐', '🌈', '🍓', '❄️', '🎈'];
export const LINES = ['또 놀러 와요!', '덕분에 즐거웠어요', '우리 정원 친구들이 반겨 줬어요', '사진을 많이 찍었어요', '쓰다듬어 줬더니 좋아했어요', '다음엔 우리 애가 놀러 갈게요'];
export const gardenName = ([a, b] = [0, 0]) => `${GARDEN[0][a] ?? GARDEN[0][0]} ${GARDEN[1][b] ?? GARDEN[1][0]} 정원`;
const okG = (a, b) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < GARDEN[0].length && b < GARDEN[1].length;

const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(36); };
const enc = (tag, arr) => { const j = JSON.stringify(arr); return tag + btoa(JSON.stringify([...arr, fnv(tag + j)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function dec(tag, text, n) { // -> the array without its sum, or null
  const s = String(text ?? '').trim(); if (!s.startsWith(tag) || s.length > 400 || !/^[A-Za-z0-9_-]+$/.test(s.slice(tag.length))) return null;
  let a; try { a = JSON.parse(atob(s.slice(tag.length).replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
  if (!Array.isArray(a) || a.length !== n + 1) return null;
  const sum = a.pop(); return sum === fnv(tag + JSON.stringify(a)) ? a : null;
}
const LID = /^[a-z0-9]{8}$/, DAY = /^\d{8}$/;
export const newLid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => (b % 36).toString(36)).join('');

// a friend -> the visit code. m: 신수 (0: the 신수 can't go yet, the field is kept for it)
export const visitCode = (a, g, lid, t) => enc('TV1.', [a.species, a.variant, a.color ?? '', a.acc ?? '', 0, when(t).day, lid, g[0], g[1]]);
export function readVisit(text) {
  const a = dec('TV1.', text, 9); if (!a) return null;
  const [species, variant, color, acc, m, day, lid, ga, gb] = a, cs = colorsOf(species, variant);
  if (!SP[species] || !variantOf(species, variant) || m !== 0 || !DAY.test(day) || !LID.test(lid) || !okG(ga, gb)) return null;
  if (color !== '' && !cs.some(c => c.id === color)) return null; // '' : the default look (an old save's friend has none)
  if (acc !== '' && !Object.hasOwn(ACCESSORIES, acc)) return null;
  return { species, variant, color: color || null, acc: acc || null, day, lid, g: [ga, gb] };
}
export const cardCode = (lid, pic, line, g, t) => enc('TP1.', [lid, pic, line, g[0], g[1], when(t).day]);
export function readCard(text) {
  const a = dec('TP1.', text, 6); if (!a) return null;
  const [lid, pic, line, ga, gb, day] = a;
  if (!LID.test(lid) || !Number.isInteger(pic) || !(pic >= 0 && pic < PICS.length) || !Number.isInteger(line) || !(line >= 0 && line < LINES.length) || !okG(ga, gb) || !DAY.test(day)) return null;
  return { lid, pic, line, g: [ga, gb], day };
}

// S.visit: { garden: [a, b], sent: { lid: { at, species, variant } }, got: { lid: at }, guests: [...], book: [...], cards: [...], cardDay, cardN }
export const blank = () => ({ sent: {}, got: {}, guests: [], book: [], cards: [] });
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export function tidyVisit(S) { // fromSave: whatever is unreadable goes
  const V = isObj(S.visit) ? S.visit : blank(), fine = x => isObj(x) && LID.test(x.lid) && !!variantOf(x.species, x.variant) && Number.isFinite(x.at);
  S.visit = { ...(Array.isArray(V.garden) && okG(...V.garden) ? { garden: V.garden } : {}),
    sent: isObj(V.sent) ? Object.fromEntries(Object.entries(V.sent).filter(([k, v]) => LID.test(k) && isObj(v) && Number.isFinite(v.at)).slice(-200)) : {},
    got: isObj(V.got) ? Object.fromEntries(Object.entries(V.got).filter(([k, v]) => LID.test(k) && Number.isFinite(v)).slice(-500)) : {},
    guests: (Array.isArray(V.guests) ? V.guests : []).filter(g => fine(g) && Number.isFinite(g.until) && HABITATS.some(h => h.id === g.hab)).slice(0, B.visit.max)
      .map(g => ({ ...g, id: 'v' + g.lid, stage: 'adult', guest: true })),
    book: (Array.isArray(V.book) ? V.book : []).filter(fine).slice(-60),
    cards: (Array.isArray(V.cards) ? V.cards : []).filter(c => isObj(c) && LID.test(c.lid) && Number.isFinite(c.at)).slice(-60),
    ...(typeof V.cardDay === 'string' ? { cardDay: V.cardDay, cardN: Math.max(0, Math.floor(V.cardN) || 0) } : {}) };
}
export const gardenOf = (S, rng = Math.random) => S.visit.garden ??= [Math.floor(rng() * GARDEN[0].length), Math.floor(rng() * GARDEN[1].length)];

// send: a grown friend of this save -> { lid, code } (the sent list knows the lid, for the postcard back)
export function sendVisit(S, id, now) {
  const a = S.animals.find(x => x.id === id); if (!a || a.stage === 'baby' || a.pending) return null;
  const lid = newLid(); S.visit.sent[lid] = { at: now, species: a.species, variant: a.variant };
  return { lid, code: visitCode(a, gardenOf(S), lid, now) };
}
// a link opened: { guest } | { err: 'own' | 'got' | 'full' }
export function takeVisit(S, v, now) {
  if (S.visit.sent[v.lid]) return { err: 'own' };
  if (S.visit.got[v.lid]) return { err: 'got' };
  if (S.visit.guests.length >= B.visit.max) return { err: 'full' };
  const h = SP[v.species].habitat, hab = S.unlocked.includes(h) ? h : S.unlocked[0]; // its own habitat, or the first one while that is shut
  const g = { id: 'v' + v.lid, lid: v.lid, species: v.species, variant: v.variant, color: v.color, acc: v.acc, g: v.g, day: v.day, at: now, until: now + B.visit.stay, hab, stage: 'adult', guest: true };
  S.visit.got[v.lid] = now; S.visit.guests.push(g); return { guest: g };
}
// every tick: a guest whose time is up goes home; the 방명록 keeps it (pick: a postcard not chosen yet)
export function visitTick(S, now, ev) {
  const V = S.visit, gone = V.guests.filter(g => now >= g.until); if (!gone.length) return;
  V.guests = V.guests.filter(g => !gone.includes(g));
  for (const g of gone) { V.book.push({ lid: g.lid, species: g.species, variant: g.variant, color: g.color, acc: g.acc, g: g.g, at: g.at, left: now, pick: true }); ev.push({ type: 'guestLeft', guest: g }); }
  V.book = V.book.slice(-60);
}
// the host's postcard (pic, line: indexes) or none (pic null): -> the postcard code, or '' for none
export function pickCard(S, lid, pic, line, now) {
  const e = S.visit.book.find(b => b.lid === lid); if (!e) return null; delete e.pick;
  if (pic == null) return ''; e.pic = pic; e.line = line; return cardCode(lid, pic, line, gardenOf(S), now);
}
// the sender opened a postcard link: kept for the mailbox (only for a lid this save sent, once). -> card | { err }
export function takeCard(S, c, now) {
  const s = S.visit.sent[c.lid]; if (!s) return { err: 'not' };
  if (S.visit.cards.some(x => x.lid === c.lid)) return { err: 'got' };
  const card = { lid: c.lid, pic: c.pic, line: c.line, g: c.g, day: c.day, species: s.species, variant: s.variant, at: now };
  S.visit.cards.push(card); S.visit.cards = S.visit.cards.slice(-60); return card;
}
// 우편함 받기: ♥visit.card, cardDaily a day (after that the postcard still comes, without hearts)
export function claimCard(S, lid, now) {
  const c = S.visit.cards.find(x => x.lid === lid && !x.got); if (!c) return null;
  const day = dayOf(now); if (S.visit.cardDay !== day) { S.visit.cardDay = day; S.visit.cardN = 0; }
  const hearts = S.visit.cardN < B.visit.cardDaily ? B.visit.card : 0; if (hearts) S.visit.cardN++;
  c.got = now; S.hearts += hearts; return { title: `${gardenName(c.g)}에서 온 엽서 · ${kindName(c)}`, hearts, extra: 0 };
}
export const guestName = g => `${gardenName(g.g)}의 ${kindName(g)}`;

// 69-4 서식지 구경 링크 (#see=TH1.<base64url>): one habitat as it stands, to look at only (ui/visit.js; nothing of it is kept).
// Bytes: FNV sum 4 · 정원사 레벨 1 (its 명성 look) · garden name 2 · friends n 1 · n × (species 1, +128 a baby · variant 1 ·
// colour 1 (+1, 0 none) · accessory 1 (+1, 0 none)) · then the 꾸미기 코드's bytes (layout.js). No names, hearts or anything else.
// ponytail: indexes into SPECIES, variantsOf, colorsOf and ACCESSORIES (append only, as layout.js KINDS); a reorder there needs TH2
const SEE = 'TH1.', ACC = Object.keys(ACCESSORIES), FR = 24;
const sum4 = bytes => { let h = 0x811c9dc5; for (const b of bytes) h = Math.imul(h ^ b, 0x01000193); h >>>= 0; return [h >>> 24, h >>> 16 & 255, h >>> 8 & 255, h & 255]; };
export function seeCode(S, habId) { // S.visit.garden set first (ui/visit.js)
  const fr = outIn(S, habId).slice(0, FR).map(a => { const sp = SPECIES.findIndex(s => s.id === a.species);
    return [sp | (a.stage === 'baby' ? 128 : 0), variantsOf(SP[a.species]).findIndex(v => v.id === a.variant), colorsOf(a.species, a.variant).findIndex(c => c.id === a.color) + 1, ACC.indexOf(a.acc) + 1]; });
  const [ga, gb] = S.visit.garden ?? [0, 0], body = [Math.min(255, S.lv || 1), ga, gb, fr.length, ...fr.flat(), ...unb64(encode(S, habId).slice(TAG.length))];
  return SEE + b64([...sum4(body), ...body]);
}
// -> { hab, lv, g, friends, d (a decoded 꾸미기 코드) } or null: cut, edited, too long, another version, or a habitat (or a friend's) not out here
export function readSee(text) {
  const s = String(text ?? '').trim(); if (!s.startsWith(SEE) || s.length > MAX || !/^[A-Za-z0-9_-]+$/.test(s.slice(SEE.length))) return null;
  let b; try { b = [...unb64(s.slice(SEE.length))]; } catch { return null; }
  const body = b.slice(4), [lv, ga, gb, n] = body; if (body.length < 4 || sum4(body).some((v, i) => v !== b[i])) return null;
  if (!(lv >= 1) || !okG(ga, gb) || n > FR || body.length < 4 + 4 * n) return null;
  const friends = [];
  for (let i = 4; i < 4 + 4 * n; i += 4) {
    const [s0, v, c, a] = body.slice(i, i + 4), sp = SPECIES[s0 & 127], vr = sp && variantsOf(sp)[v], cs = vr ? colorsOf(sp.id, vr.id) : [];
    if (!vr || !HAB[sp.habitat]?.ready || c > cs.length || a > ACC.length) return null;
    friends.push({ species: sp.id, variant: vr.id, color: c ? cs[c - 1].id : null, acc: a ? ACC[a - 1] : null, stage: s0 & 128 ? 'baby' : 'adult' });
  }
  const d = decode(TAG + b64(body.slice(4 + 4 * n))); if (d.error || !HAB[d.hab]?.ready) return null;
  if (!HAB.dino?.ready) d.items = d.items.filter(it => !FOSSIL.props.includes(it.prop)); // the jungle held: its fossils too (check-hold)
  return { hab: d.hab, lv, g: [ga, gb], friends, d };
}
// the save the view runs on (never stored): its friends out in that habitat, one of each prop the code places (importLayout
// puts them there once the board is built), every colour, its 넓히기 step and level; quiet (no tips, cards or the first egg)
export function seeSave(v, now) {
  const S = newGame(now), ready = HABITATS.filter(h => h.ready).map(h => h.id);
  Object.assign(S, { lv: v.lv, xp: xpAt(v.lv), unlocked: ready, nests: {}, expand: { ...S.expand, [v.hab]: v.d.step }, stats: { ...S.stats, hatch: 1 },
    flags: { betaIntro: true, tipsOff: true, nestTapped: true, homeHintSeen: true, appHintSeen: true, lastHab: v.hab, ['train:' + v.hab]: true },
    looks: Object.fromEntries(PROPS.filter(paletteOf).map(P => [P.id, paletteOf(P).map((_, i) => i)])),
    animals: v.friends.map((f, i) => ({ ...f, id: i + 1, egg: null, parents: [null, null], born: now, g: f.stage === 'baby' ? 0.5 : 1, gAt: now, fed: 0, stored: false, pending: false, heartAt: 0, hab: v.hab })),
    visit: { ...S.visit, garden: v.g } });
  S.props = v.d.items.filter(it => !NAT[it.prop]).map(it => ({ uid: S.nextId++, prop: it.prop, hab: v.hab, placed: false, x: 0, z: 0, rot: 0 }));
  return S;
}
