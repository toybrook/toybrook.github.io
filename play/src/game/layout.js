// 24-1/24-2 꾸미기 코드: one habitat's layout as a short code (TG1.<base64url>). Only what is placed there: each prop and the
// board's own trees, bushes, rocks and flowers (by kind, where, which way), the painted ground, the 땅 넓히기 step. No animals,
// hearts, eggs, names or anything about the player. Bits, not JSON, so a QR of it stays small.
//   ver 4 · hab 4 · step 3 · kinds 7 { kind 7 · n 9 · n × (x 9 · z 9 · more 1 · (more ? rot 9 · c 3 · sz 2 · sl 3 : rot 3)) } · runs 12 × (j 7 · i 7 · len 6 · brush 3)
//   x, z: quarter units (first-board units, -64..63.75); rot: 45 deg steps (more: degrees); paint: runs along i of one brush in row j
//   28-5 (ver 2): more 1 when it has any of: a turn off the 45 deg steps, c its colour (PALETTES index), sz its size (SIZES index),
//   sl k + 1 on the k-th top spot of the prop under it (found again by where it stands); else as ver 1. ver 1 (no more bit) still reads
//   28-6 (ver 3): brush 4 bits, when a brush past 7 is painted (울타리, 돌담, ...); else as ver 2, so older games still read it
import { HABITATS, BRUSHES } from './data.js';

export const TAG = 'TG1.', MAX = 4000; // MAX: characters (a full 6-step board with everything placed is ~1500)
// append only: a code keeps a kind's index forever (check-eggs: every PROPS and NATURE id is here)
export const KINDS = ('hay trough lily duckhouse flowers bench fence path tulips tallgrass stones mushrooms log lantern jar mushlamp starlamp swing gazebo '
  + 'boat stepping pinwheel vane mailbox barn windmill greenhouse treehouse well arch picnic falls lighthouse waterpav tree bush rock wildflowers '
  + 'snowman igloo sled icelamp snowpine '  // 25-1 the snow's
  + 'slide seesaw campfire feeder fountain hammock ball '  // 28-2 놀이 소품
  + 'musicbox bubbles lights fireworks pinhill bell '  // 28-3 누르는 장난감
  + 'rail railcurve railfork railbridge '  // 28-4 장난감 기차
  + 'table shelf platform doll '  // 28-5 집 꾸미기
  + 'hillock puddle flowermound rockmound '  // 28-6 지형 도장
  + 'att_sunflower att_birdhouse att_balloons att_wcan att_signpost att_cart att_rainbow firstday').split(' '); // inbox 41 선물 소품

const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const q = v => Math.max(0, Math.min(511, Math.round(v * 4) + 256));

// S: the save; habId; step: its 땅 넓히기 step
export function encode(S, habId, step = S.expand?.[habId] || 0) {
  const bits = [], put = (v, n) => { for (let k = n - 1; k >= 0; k--) bits.push((v >> k) & 1); };
  const ver = Object.values(S.paint?.[habId] || {}).some(b => b > 7) ? 3 : 2;
  put(ver, 4); put(Math.max(0, HABITATS.findIndex(h => h.id === habId)), 4); put(Math.min(7, step), 3);
  const by = new Map();
  for (const p of S.props) if (p.placed && p.hab === habId && KINDS.includes(p.prop)) (by.get(p.prop) ?? by.set(p.prop, []).get(p.prop)).push(p);
  put(by.size, 7);
  for (const [k, ps] of by) {
    put(KINDS.indexOf(k), 7); put(Math.min(511, ps.length), 9);
    for (const p of ps.slice(0, 511)) {
      const deg = ((Math.round((p.rot || 0) * 180 / Math.PI) % 360) + 360) % 360, c = Math.min(7, p.c || 0), sz = Math.min(3, p.sz || 0), sl = p.on != null ? Math.min(7, (p.sl || 0) + 1) : 0;
      put(q(p.x), 9); put(q(p.z), 9);
      if (deg % 45 || c || sz || sl) { put(1, 1); put(deg, 9); put(c, 3); put(sz, 2); put(sl, 3); } else { put(0, 1); put(deg / 45, 3); }
    }
  }
  const rows = new Map(); // j -> [[i, brush]]
  for (const [key, b] of Object.entries(S.paint?.[habId] || {})) { const [i, j] = key.split(',').map(Number); if (Math.abs(i) < 64 && Math.abs(j) < 64 && BRUSHES[b]) (rows.get(j) ?? rows.set(j, []).get(j)).push([i, b]); }
  const runs = [];
  for (const [j, cs] of rows) {
    cs.sort((a, b) => a[0] - b[0]);
    for (const [i, b] of cs) { const r = runs.at(-1); if (r && r[0] === j && r[3] === b && r[1] + r[2] === i && r[2] < 64) r[2]++; else runs.push([j, i, 1, b]); }
  }
  put(Math.min(4095, runs.length), 12);
  for (const [j, i, n, b] of runs.slice(0, 4095)) { put(j + 64, 7); put(i + 64, 7); put(n - 1, 6); put(b, ver === 3 ? 4 : 3); }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((v, k) => { bytes[k >> 3] |= v << (7 - (k & 7)); });
  return TAG + b64(bytes);
}

// text -> { hab, step, items: [{ prop, x, z, rot, c, sz, sl }], paint: { 'i,j': brush } } or { error: what to tell the player }
export function decode(text) {
  const s = String(text ?? '').replace(/\s+/g, '');
  if (!s) return { error: '코드를 붙여 넣어 주세요' };
  if (s.length > MAX) return { error: '코드가 너무 길어요 · 꾸미기 코드가 맞는지 확인해 주세요' };
  if (s.startsWith('TB1.')) return { error: '이건 저장 백업 코드예요 · 설정 › 내 저장 백업에서 불러와 주세요' };
  if (!s.startsWith(TAG) || !/^[A-Za-z0-9_-]+$/.test(s.slice(TAG.length))) return { error: '꾸미기 코드가 아니에요 · 「TG1.」로 시작하는 코드를 붙여 넣어 주세요' };
  let bytes; try { bytes = unb64(s.slice(TAG.length)); } catch { return { error: '코드가 깨졌어요 · 처음부터 끝까지 다시 복사해 주세요' }; }
  let at = 0; const len = bytes.length * 8;
  const get = n => { if (at + n > len) throw 0; let v = 0; for (let k = 0; k < n; k++, at++) v = (v << 1) | ((bytes[at >> 3] >> (7 - (at & 7))) & 1); return v; };
  try {
    const ver = get(4); if (ver < 1 || ver > 3) return { error: '더 새 판의 코드예요 · 게임을 새로 고친 뒤 다시 해 주세요' };
    const hab = HABITATS[get(4)]?.id, step = get(3), items = [], paint = {}, unknown = new Set();
    if (!hab) return { error: '모르는 서식지의 코드예요' };
    for (let n = get(7); n > 0; n--) {
      const k = get(7), prop = KINDS[k];
      for (let m = get(9); m > 0; m--) {
        const x = (get(9) - 256) / 4, z = (get(9) - 256) / 4, more = ver >= 2 && get(1), rot = more ? get(9) % 360 * Math.PI / 180 : get(3) * Math.PI / 4, [c, sz, sl] = more ? [get(3), get(2), get(3)] : [0, 0, 0];
        if (prop) items.push({ prop, x, z, rot, c, sz, sl }); else unknown.add(k);
      }
    }
    for (let n = get(12); n > 0; n--) { const j = get(7) - 64, i = get(7) - 64, m = get(6) + 1, b = get(ver === 3 ? 4 : 3); if (BRUSHES[b]) for (let d = 0; d < m; d++) paint[`${i + d},${j}`] = b; }
    if (len - at >= 8) return { error: '코드가 깨졌어요 · 처음부터 끝까지 다시 복사해 주세요' }; // more than the padding left over
    return { hab, step, items, paint, unknown: unknown.size };
  } catch { return { error: '코드가 깨졌어요 · 처음부터 끝까지 다시 복사해 주세요' }; }
}
