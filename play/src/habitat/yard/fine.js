// 195 B-8 1-2 세밀 배치 (?yard, docs/decor-redesign.md 5-2 ②, 5-3 ④): the yard's placing rules and the 흩뿌리기 붓's names, pure
// (no DOM, no three.js: tools/check-eggs.mjs runs them). habitat.js and decor.js reach them through the yard's build
// (yard/index.js habitat.fine), so like all of yard/ they are not in the public build (build-web.mjs) till the yard is.
import { $t, LANG } from '../../i18n/i18n.js';

// text not public yet: kept here, not in en.js / ja.js (135-4)
const tr = (ko, en, ja) => ({ en, ja })[LANG] ?? ko;
export const TXT = { clear: tr('흩뿌린 것 지우기', 'Clear scatter', '散らしたものを消す'),
  hint: tr(' · 조약돌·낙엽 같은 흩뿌리기는 소품 밑에도 놓여요 · 풀숲·물가는 낮은 풀포기가 돋아요', ' · Scatter like pebbles and leaves can go under props · Thicket and waterside sprout low tufts',
    ' · 小石や落ち葉などの散らしは小物の下にも置けます · 草むら・水辺には低い草が生えます') };
// the kinds, in game/scatter.js KINDS order (a piece's kind is its index here)
export const SCATTER = [{ id: 'pebble', name: $t('조약돌'), c: '#bdb5a5' }, { id: 'leaf', name: $t('낙엽'), c: '#d98a3e' }, { id: 'moss', name: $t('이끼'), c: '#6d9b3a' },
  { id: 'shroom', name: tr('작은 버섯', 'Tiny mushrooms', '小さなきのこ'), c: '#e0473a' }, { id: 'petal', name: $t('꽃잎'), c: '#f7a8c4' }];
// A띠 (부록 A) low ones: in the yard they may stand inside another prop's spot, and others inside theirs (5-3 ④)
export const OVER = new Set(['stones', 'mushrooms', 'walk_cairn', 'walk_acorn', 'walk_pinecone', 'find_flower']);

// 격자 on: the nearest half cell (U: a cell)
export const halfSnap = (v, U) => Math.round(v / (U / 2)) * U / 2;
// spots no one goes into: a line's (fence, wall, hedge, gate, bridge), the water's, an open one's (a rail tile, a tunnel), a rail's
const hard = d => d.line || d.water || d.open || d.rail;
// 겹쳐 놓기: the spots an OVER one may stand inside (a placed prop's; not nature's, not a play prop's where animals play)
export const under = d => !hard(d) && !d.nat && !d.play;
// the animals' and props' bodies an OVER one (ov) or another keeps off: an OVER one's body never; a prop's (pb) not for an OVER one
export const crowdFor = (crowd, ov) => [...crowd].filter(o => !o.over && !(ov && o.pb));
// 자석: a held one (r) at x, z near a spot's edge (gap -0.5..0.6) goes to touch it (0.12 apart): { d, x, z } or null
export function magnetPick(list, x, z, r) {
  let best = null, bd = 0.6;
  for (const d of list) { if (hard(d) || d.over) continue; const g = Math.hypot(d.x - x, d.z - z) - d.r - r; if (g > -0.5 && g < bd) { bd = g; best = d; } }
  if (!best) return null; const a = Math.atan2(z - best.z, x - best.x), k = best.r + r + 0.12;
  return { d: best, x: best.x + Math.cos(a) * k, z: best.z + Math.sin(a) * k };
}
// 위에 올리기: the 돌담 cells' spots (top: their height) by cell, and the one whose middle is at x, z (within 0.05) or null
const cellKey = (x, z, U) => Math.floor(x / U) + ',' + Math.floor(z / U);
export const topsOf = (spots, U) => new Map(spots.filter(o => o.top).map(o => [cellKey(o.x, o.z, U), o]));
export const topAt = (tops, x, z, U) => { const o = tops.get(cellKey(x, z, U)); return o && Math.abs(o.x - x) < 0.05 && Math.abs(o.z - z) < 0.05 ? o : null; };
