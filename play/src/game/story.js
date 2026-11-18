// 14-2 신수·전설 이야기 카드: the day a 신수 came to its altar, the day it settled, the day a legendary hatched. Nothing new in
// the save: the cards are read from what it already keeps (S.myth[id] here / settled, the codex's first day of each legendary
// look), so an old save has its cards too. A card's code (TS1.<base64url>) holds only its kind, who, the day and the part of
// the day (한국 시간) and the habitat: no names given, no device, no place, nothing else about the player.
import { $t, LANG } from '../i18n/i18n.js';
import { MYTHIC, HABITATS } from './data.js';
import { SP, RAR, variantOf, twoName } from './rules.js';
const josa = (w, a, b) => { if (LANG !== 'ko') return ''; const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; }; // as ui/hud.js (no DOM here)

export const TAG = 'TS1.';
export const TODS = [$t('아침'), $t('낮'), $t('저녁'), $t('밤')]; // 05~10 · 11~16 · 17~19 · 20~04 (밤: as rules.js mythNight)
const MY = Object.fromEntries(MYTHIC.map(m => [m.id, m])), HN = Object.fromEntries(HABITATS.map(h => [h.id, h.name]));
// a legendary's three lines, by the habitat whose nest it hatched from ({n}: its name)
const LEGEND = {
  meadow: [$t('{n}{이/가} 반짝이며 알에서 나왔어요.'), $t('들판의 풀잎이 모두 그쪽으로 고개를 숙였어요.'), $t('오늘은 초원이 조금 더 빛나는 날이에요.')],
  pond: [$t('{n}{이/가} 반짝이며 알에서 나왔어요.'), $t('연못 위로 동그란 물결이 멀리 퍼졌어요.'), $t('물가 친구들이 살금살금 다가와 인사했어요.')],
  snow: [$t('{n}{이/가} 반짝이며 알에서 나왔어요.'), $t('내리던 눈송이가 잠깐 멈춘 것 같았어요.'), $t('설원 친구들이 발자국으로 길을 내 주었어요.')],
  '': [$t('{n}{이/가} 반짝이며 알에서 나왔어요.'), $t('둥지 둘레가 따뜻한 빛으로 가득했어요.'), $t('모두가 오래 기억할 날이에요.')],
};
const fill = (t, n) => t.replace('{n}', n).replace(/\{(.)\/(.)\}/g, (_, a, b) => josa(n, a, b));

// t -> { day: 'YYYYMMDD', tod } in 한국 시간
export function when(t) {
  const d = new Date(t + 9 * 3600e3), h = d.getUTCHours(), p = v => String(v).padStart(2, '0');
  return { day: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`, tod: h >= 20 || h < 5 ? 3 : h >= 17 ? 2 : h >= 11 ? 1 : 0 };
}
const card = (k, id, hab, t) => ({ k, id, hab, ...when(t), t });

// every card the save holds, oldest first. k: 'm' it came (meet), 's' it settled, 'l' a legendary (id 'species:variant')
export function storyCards(S) {
  const out = [];
  for (const m of MYTHIC) { const M = S.myth?.[m.id] || {}; if (!m.tales) continue; // 152 D: each 신수 with its tales (the ?m89 ones have none yet)
    if (Number.isFinite(M.here)) out.push(card('m', m.id, m.habitat, M.here));
    if (Number.isFinite(M.settled)) out.push(card('s', m.id, m.habitat, M.settled)); }
  for (const [k, e] of Object.entries(S.codex || {})) {
    const [sp, v] = k.split(':');
    if (RAR[variantOf(sp, v)?.rarity]?.story && Number.isFinite(e?.at)) out.push(card('l', k, HN[e.h] ? e.h : SP[sp].habitat, e.at));
  }
  return out.sort((a, b) => a.t - b.t);
}

export const cardName = c => { if (c.k !== 'l') return MY[c.id].name; const [sp, v] = c.id.split(':'); return twoName(variantOf(sp, v).name, SP[sp].name); };
export function cardTitle(c) {
  const n = cardName(c), d = $t('{0}월 {1}일 {2}', +c.day.slice(4, 6), +c.day.slice(6), TODS[c.tod]), ga = josa(n, '이', '가');
  if (c.k === 'm') return $t('{0}, {1}에 {2}{3} 내려옴', d, MY[c.id].tales.at, n, ga);
  if (c.k === 's') return $t('{0}, {1}{2} {3}에 머물기로 함', d, n, ga, HN[c.hab]);
  return $t('{0}, {1} 둥지에서 {2}{3} 태어남', d, HN[c.hab], n, ga);
}
export const cardLines = c => c.k === 'l' ? (LEGEND[c.hab] ?? LEGEND['']).map(t => fill(t, cardName(c))) : MY[c.id].tales[c.k === 'm' ? 'meet' : 'settle'];

// the code: TS1. + base64url of "k.id.day.tod.hab" (all ASCII)
export const encodeCard = c => TAG + btoa([c.k, c.id, c.day, c.tod, c.hab].join('.')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// text -> a card (without t) or { error }
export function decodeCard(text) {
  const s = String(text ?? '').replace(/\s+/g, ''), bad = { error: $t('카드 코드가 깨졌어요 · 처음부터 끝까지 다시 복사해 주세요') };
  if (!s) return { error: $t('카드 코드를 붙여 넣어 주세요') };
  if (s.startsWith('TG1.')) return { error: $t('이건 꾸미기 코드예요 · 꾸미기 › 코드에서 불러와 주세요') };
  if (!s.startsWith(TAG) || s.length > 200 || !/^[A-Za-z0-9_-]+$/.test(s.slice(TAG.length))) return { error: $t('이야기 카드 코드가 아니에요 · 「TS1.」로 시작하는 코드를 붙여 넣어 주세요') };
  let p; try { p = atob(s.slice(TAG.length).replace(/-/g, '+').replace(/_/g, '/')).split('.'); } catch { return bad; }
  if (p.length !== 5) return bad;
  const [k, id, day, tod, hab] = p, [sp, v] = id.split(':'), y = +day.slice(0, 4), mo = +day.slice(4, 6), dd = +day.slice(6);
  const who = k === 'l' ? !!RAR[variantOf(sp, v)?.rarity]?.story && !!HN[hab] : (k === 'm' || k === 's') && MY[id]?.habitat === hab;
  const date = /^\d{8}$/.test(day) && y >= 2024 && mo >= 1 && mo <= 12 && dd >= 1 && dd <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (!who || !date || !/^[0-3]$/.test(tod)) return bad;
  return { k, id, hab, day, tod: +tod };
}
