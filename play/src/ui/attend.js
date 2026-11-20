// inbox 41 C 출석부: once a day (dayOf) today's slot. 74: one toast line once the screen is quiet (no window, sheet, loading
// or photo, the tab shown) 1.6 s; 76: on a day back, a row of 돌아왔어요 (main.js) instead. No card of its own.
// The rules (one a day, none on a clock turned back, the 7th's prop in turn) are in rules.js attend.
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { PROP, HAB, firstEgg } from '../game/rules.js';
import { ATTEND, ATTEND_PROPS, GIFT, WEEK1 } from '../game/data.js';
import { topWindow, overlayOpen, resting, toast } from './hud.js';
import { sfx } from './sound.js';
import { track } from './stats.js';

const $ = id => document.getElementById(id), L = ATTEND.length;
let at = () => null, quiet = 0;
export const cell = r => [r.hearts && `♥${r.hearts}`, r.candy && $t('사탕 {0}', r.candy), r.eggs && $t('알 {0}', r.eggs), r.legendNow && $t('전설 알'), r.heroEggs && $t('영웅 알'), r.freeExp && $t('땅 넓히기'), r.clue && $t('신수 단서'), r.prop && PROP[r.prop]?.name].filter(Boolean).join(' ');
const gotText = got => { const P = PROP[got.prop]; return [got.hearts && `♥${got.hearts}`, got.candy && $t('성장 사탕 {0}개', got.candy), got.eggs && $t('둥지 알 {0}개', got.eggs), got.row && $t('선물 알 {0}개 · 둥지에서 기다려요', got.row), got.legend && $t('전설 알 {0}개 · 바로 부화해요', got.legend), got.hero && $t('영웅 알 {0}개', got.hero), got.exp && $t('땅 넓히기 {0}칸 무료', got.exp), got.clue && $t('신수 단서'), P && $t('소품 「{0}」', P.name)].filter(Boolean).join(' · '); }; // 102: no 「♥0」 (a full nest's egg is told below)
const busy = () => firstEgg(G.S) || G.S.guests?.tut >= 0 || G.now() - G.S.since < 300e3 || topWindow() || overlayOpen() || !$('loading').hidden && !$('loading').closest('.scene.hidden') || $('tabOff') || document.body.classList.contains('photo') || document.hidden || !at() || resting(); // inbox 61 B: after the first egg; 66-1: after the guest tutorial; inbox 43: only inside a habitat, never on the map; one card at a time
setInterval(() => {
  if (!G.attendDue() || busy()) { quiet = 0; return; }
  if ((quiet += 800) < 1600) return;
  quiet = 0; const t = takeToday(at()); if (t) toast(`${G.S.flags.week1 && G.S.attend.n <= WEEK1.length ? $t('첫 주 선물 ') + G.S.attend.n + $t('일째') : G.S.attend.n + $t('일째 출석')} · ${t}`, 2800); // 74: one line, no card (a day back: a row of 돌아왔어요)
}, 800);
// cur: the habitat on screen (a 7th-day prop goes there)
export function initAttend(cur) { at = cur; }
// inbox 58: on a day back, 돌아왔어요 (main.js) shows today's slot as one of its rows and takes it there; this card then has nothing to show
export const weekOn = () => !!G.S.flags.week1 && G.S.attend.n < WEEK1.length; // 93-2 첫 주 선물 (rules attend)
// the 7 cells: got (도장), today's, the rest faint (93-2)
export const weekCells = () => { const n = G.S.attend.n; return `<p class="week">${WEEK1.map((r, i) => `<span class="${i < n ? 'got' : i === n ? 'now' : ''}"><b>${i + 1}</b>${i < n ? '✓' : cell(r)}</span>`).join('')}</p>`; };
export const todayRow = () => { const n = G.S.attend.n, k = n % L; if (weekOn()) return [n + 1, cell(WEEK1[n]), n === 1]; return [n + 1, cell(ATTEND[k]) + (k === L - 1 ? ` + ${PROP[ATTEND_PROPS[Math.floor(n / L) % ATTEND_PROPS.length]].name}` : ''), false, Math.floor(n / L) + 1]; }; // 196-3: the running day (n + 1) and the week, not the slot in the 7-day turn
export function takeToday(where) {
  const out = G.attend(where); if (!out) return null;
  track('attend', { day: G.S.attend.n }); if (out.got.week) track('week_day', { v: out.got.week }); if (out.got.week === 2) track('d2_gift_open'); sfx('grown');
  const { got } = out, P = PROP[got.prop], hab = P && G.S.props.findLast(p => p.prop === P.id)?.hab;
  // 102: every nest full: 「둥지가 가득 차서 알 대신 ♥15를 받았어요」 as the whole line when that is all (no zero part, no second half-sentence)
  const h = got.extra * GIFT.eggHearts, full = got.extra && $t('둥지가 가득 차서 {0}알 대신 ♥{1}', got.eggs ? $t('나머지 ') : '', h), rest = gotText(got);
  return [rest, full && (rest ? full : ('2459'.includes(String(h).at(-1)) ? $t('{0}를 받았어요', full) : $t('{0}을 받았어요', full))), P && HAB[hab] && $t('{0} 꾸미기 › 선물에', HAB[hab].name)].filter(Boolean).join(' · ');
}
