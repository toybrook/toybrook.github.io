// inbox 41 D 첫날 할 일 (74: no list on screen). rules.js advance gives each task's hearts as it is done, all five the 첫날 기념 prop + candy; told here by
// one toast when the screen is free (like 도전 과제, level.js).
import * as G from '../game/game.js';
import { FIRST, BIGS, PROPS } from '../game/data.js';
import { PROP, HAB, can } from '../game/rules.js';
import { toast, topWindow, overlayOpen } from './hud.js';
import { sfx } from './sound.js';
// 42 F-5: after 「소품 하나 놓기」 the next thing, a big prop: the cheapest one open in every habitat (♥), null once one is placed.
// decor.js comes with the 3D code (play.js), not with the first screen
const BIG = BIGS.split(' '), bigFrom = () => G.S.props.some(p => p.placed && !p.nat && BIG.includes(p.prop)) ? null
  : Math.min(...PROPS.filter(P => BIG.includes(P.id) && !P.habitat && can(G.S, 'prop:' + P.id)).map(P => P.price));

// 74: the list on screen is gone (66-1's guest tutorial leads the first minutes); the tasks still give their hearts and
// the 첫날 기념 prop, told by one toast
const T = FIRST.tasks;
let said = [];
// inbox 64-A: a new game's first minutes show only 둥지·친구들·설정 and the top bar; the rest come when they are of use, with a
// little sparkle: 꾸미기 once the hearts reach the cheapest prop, 도감 at the second friend, 보관함 once one is in it, all of them
// 3 minutes after the game began. flags.ui64: this save began so (older saves see everything); flags['ui:' + id]: shown for good
const LATER = 180e3, cheapest = S => Math.min(...PROPS.filter(P => P.price > 0 && !P.ev && can(S, 'prop:' + P.id)).map(P => P.price));
const UNLOCK = { decorBtn: ['꾸미기', S => S.hearts >= cheapest(S)], codexBtn: ['도감', S => S.animals.filter(a => !a.pending).length >= 2], storeBtn: ['보관함', S => S.animals.some(a => a.stored)],
  mailBtn: ['우편함'], evBtn: [''] }; // 74: 진열장 (도감), 사진 (꾸미기), 도움말 (설정), 첫날 할 일 (gone) no longer buttons
export const locked = id => !!document.getElementById(id)?.hasAttribute('data-lock');
function locks() {
  const S = G.S; if (!S) return;
  if (!S.flags.ui64 && !S.stats.hatch && !S.animals.length) return G.flag('ui64'); // a new save (G.on calls this again)
  const late = G.now() - S.since >= LATER, got = [], now = [];
  for (const id in UNLOCK) {
    const el = document.getElementById(id); if (!el) continue;
    if (!S.flags.ui64 || S.flags['ui:' + id]) { el.removeAttribute('data-lock'); continue; }
    if (!late && !UNLOCK[id][1]?.(S)) { el.dataset.lock = ''; continue; }
    now.push(id); el.removeAttribute('data-lock'); el.classList.add('newly'); setTimeout(() => el.classList.remove('newly'), 4200);
    if (!el.hidden && UNLOCK[id][0]) got.push(UNLOCK[id][0]);
  }
  now.forEach(id => G.flag('ui:' + id)); // after the loop: G.flag calls this again through G.on, and an inner toast would be overwritten
  if (got.length) toast(`새로 생겼어요 · ${got.length > 3 ? `${got.slice(0, 2).join('·')} 외 ${got.length - 2}개` : got.join('·')}`, 2600, true);
}
locks();
G.on(ev => { said.push(...ev.filter(e => e.type === 'first' || e.type === 'firstAll')); locks(); });
setInterval(() => {
  locks();
  if (!said.length || topWindow() || overlayOpen() || document.body.classList.contains('photo')) return;
  const one = said.filter(e => e.type === 'first'), all = said.find(e => e.type === 'firstAll')?.got; said = [];
  const h = one.reduce((n, e) => n + e.hearts, 0), hab = all?.prop && HAB[G.S.props.findLast(p => p.prop === all.prop)?.hab];
  const nx = one.some(e => e.id === 'prop') ? bigFrom() : null, head = one.length === 1 ? `${T.find(t => t.id === one[0].id).text} · ♥${h}${nx != null ? ` · 다음은 큰 소품 ♥${nx}부터` : ''}` : one.length ? `♥${h}` : '';
  toast([head, all && `첫날 선물 · 「${PROP[all.prop]?.name ?? ''}」 + 꼬마 사탕 ${all.candy}개${hab ? ` · ${hab.name} 꾸미기 › 선물` : ''}`].filter(Boolean).join(' · '), all ? 4200 : 3000);
  if (all) sfx('grown');
}, 800);
