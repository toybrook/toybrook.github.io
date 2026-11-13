// inbox 41 C 출석부: once a day (dayOf) today's slot. 74: one toast line once the screen is quiet (no window, sheet, loading
// or photo, the tab shown) 1.6 s; 76: on a day back, a row of 돌아왔어요 (main.js) instead. No card of its own.
// The rules (one a day, none on a clock turned back, the 7th's prop in turn) are in rules.js attend.
import * as G from '../game/game.js';
import { PROP, HAB, firstEgg } from '../game/rules.js';
import { ATTEND, ATTEND_PROPS, GIFT } from '../game/data.js';
import { topWindow, overlayOpen, resting, toast } from './hud.js';
import { sfx } from './sound.js';
import { track } from './stats.js';

const $ = id => document.getElementById(id), L = ATTEND.length;
let at = () => null, quiet = 0;
const cell = r => [r.hearts && `♥${r.hearts}`, r.candy && `사탕 ${r.candy}`, r.eggs && `알 ${r.eggs}`].filter(Boolean).join(' ');
const gotText = got => { const P = PROP[got.prop]; return [got.hearts && `♥${got.hearts}`, got.candy && `꼬마 사탕 ${got.candy}개`, got.eggs && `둥지 알 ${got.eggs}개`, P && `소품 「${P.name}」`].filter(Boolean).join(' · ') || '♥0'; };
const busy = () => firstEgg(G.S) || G.S.guests?.tut >= 0 || G.now() - G.S.since < 300e3 || topWindow() || overlayOpen() || !$('loading').hidden && !$('loading').closest('.scene.hidden') || $('tabOff') || document.body.classList.contains('photo') || document.hidden || !at() || resting(); // inbox 61 B: after the first egg; 66-1: after the guest tutorial; inbox 43: only inside a habitat, never on the map; one card at a time
setInterval(() => {
  if (!G.attendDue() || busy()) { quiet = 0; return; }
  if ((quiet += 800) < 1600) return;
  quiet = 0; const t = takeToday(at()); if (t) toast(`${G.S.attend.n}일째 출석 · ${t}`, 2800); // 74: one line, no card (a day back: a row of 돌아왔어요)
}, 800);
// cur: the habitat on screen (a 7th-day prop goes there)
export function initAttend(cur) { at = cur; }
// inbox 58: on a day back, 돌아왔어요 (main.js) shows today's slot as one of its rows and takes it there; this card then has nothing to show
export const todayRow = () => { const n = G.S.attend.n, k = n % L; return [k + 1, cell(ATTEND[k]) + (k === L - 1 ? ` + ${PROP[ATTEND_PROPS[Math.floor(n / L) % ATTEND_PROPS.length]].name}` : '')]; };
export function takeToday(where) {
  const out = G.attend(where); if (!out) return null;
  track('attend', { day: G.S.attend.n }); sfx('grown');
  const { got } = out, P = PROP[got.prop], hab = P && G.S.props.findLast(p => p.prop === P.id)?.hab;
  return gotText(got) + (got.extra ? ` · 가득 찬 둥지 대신 ♥${got.extra * GIFT.eggHearts}` : '') + (P && HAB[hab] ? ` · ${HAB[hab].name} 꾸미기 › 선물에` : '');
}
