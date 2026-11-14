// inbox 41 D 첫날 할 일 (74: no list on screen). rules.js advance gives each task's hearts as it is done, all five the 첫날 기념 prop + candy; told here by
// one toast when the screen is free (like 도전 과제, level.js).
import * as G from '../game/game.js';
import { FIRST, BIGS, PROPS, HABITATS, BALANCE } from '../game/data.js';
import { PROP, HAB, can, unlockInfo, gauge, eggGap } from '../game/rules.js';
import { toast, topWindow, overlayOpen } from './hud.js';
import { track } from './stats.js';
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
// 3 minutes (92-4: 5) after the game began. flags.ui64: this save began so (older saves see everything); flags['ui:' + id]: shown for good
const LATER = 300e3, cheapest = S => Math.min(...PROPS.filter(P => P.price > 0 && !P.ev && can(S, 'prop:' + P.id)).map(P => P.price));
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

// 92-2 one goal at a time, a line under the top bar (a new save, flags.ui64): the pond (friends hatched), a first prop, a first
// grown-up, the snow (unlockInfo). Done: the next one; all done: gone. goal_done: the goal's id, once each
const [, H2, H3] = HABITATS, goalEl = Object.assign(document.createElement('div'), { className: 'goal', hidden: true });
goalEl.innerHTML = '<span></span><i><b></b></i>'; document.getElementById('habitat')?.append(goalEl);
const GOALS = [
  ['pond', S => S.unlocked.includes(H2.id), S => { const L = unlockInfo(S, H2.id); return L.friends ? [`${L.prev.name} 친구 ${Math.min(L.got, L.friends)}/${L.friends} → ${H2.name} 열림`, L.got / L.friends] : null; }],
  ['decor', S => S.props.some(p => p.placed && !p.nat), () => ['꾸미기에서 소품 하나 놓기 → 친구들이 보러 와요', 0]],
  ['adult', S => S.stats.grown > 0, S => { const g = Math.max(0, ...S.animals.filter(a => a.stage === 'baby' && !a.pending).map(a => gauge(a, G.now()))); return [`새끼 하나 다 키우기 ${Math.floor(g * 100)}% → 성체 도감`, g]; }],
  ['snow', S => S.unlocked.includes(H3.id), S => { const L = unlockInfo(S, H3.id); return L.need ? [`${L.prev.name} 도감 ${Math.min(L.have, L.need)}/${L.need} · ♥${Math.min(S.hearts, L.hearts)}/${L.hearts} → ${H3.name} 열림`, Math.min(L.have / L.need, S.hearts / L.hearts)] : null; }],
];
function goal() {
  const S = G.S; if (!S?.flags.ui64 || !S.stats.hatch) return void (goalEl.hidden = true);
  for (const [id, done, show] of GOALS) {
    if (done(S)) { if (!S.flags['goal:' + id]) { G.flag('goal:' + id); track('goal_done', { g: id }, 'goal:' + id); } continue; }
    const v = show(S); if (!v) break;
    goalEl.hidden = !!(topWindow() || overlayOpen()); goalEl.querySelector('span').textContent = v[0]; goalEl.querySelector('b').style.width = `${Math.round(Math.min(1, v[1]) * 100)}%`; return;
  }
  goalEl.hidden = true;
}
// 92-3 손잡고: after the second hatch 「쓰다듬어 보세요」 (no pet yet); once the guests' script is over, a prop to put down
// (one waiting in storage: free; else hearts enough for the cheapest). One line each, once, when the screen is free
let hintAt = 0, left = false; // left: the tab hidden once (92-5: then the line on the way back, before the 5 minutes)
addEventListener('visibilitychange', () => { if (document.hidden) left = true; });
function hint() {
  const S = G.S; if (!S?.flags.ui64 || topWindow() || overlayOpen() || document.body.classList.contains('photo') || document.hidden || G.now() < hintAt) return;
  if (S.stats.hatch >= 2 && !S.stats.pet && !S.flags.hintPet) { G.flag('hintPet'); hintAt = G.now() + 8e3; return toast('친구를 톡 눌러 쓰다듬어 보세요 · 하트가 생겨요', 3200, true); }
  if (S.flags.week1 && S.attend.n === 1 && !S.flags.d2seen && S.stats.hatch && (G.now() - S.since >= LATER || left) && G.dayOf(G.now()) === G.dayOf(S.since)) { // 92-5·93-1: once, on the first day
    const n = S.nests[HABITATS[0].id], w = n && n.eggs.length < BALANCE.nest.max ? Math.max(0, n.t + eggGap(S) - G.now()) : null;
    G.flag('d2seen'); hintAt = G.now() + 8e3; track('d2_gift_seen'); track('leave_hint', { at: left ? 'back' : '5m' });
    return toast(`내일 들어오면 전설 알이 와 있어요${w == null ? '' : ` · 둥지 다음 알 ${Math.floor(w / 60e3)}:${String(Math.floor(w / 1e3) % 60).padStart(2, '0')}`}`, 4200, true);
  }
  if (S.guests?.tut >= 0 || S.props.some(p => p.placed && !p.nat) || S.flags.hintDecor || !S.flags.hintPet) return;
  const free = S.props.some(p => !p.placed && !p.nat); if (!free && S.hearts < cheapest(S)) return;
  G.flag('hintDecor'); hintAt = G.now() + 8e3; toast(free ? '꾸미기에 받은 소품이 있어요 · 무료로 놓아 보세요' : `하트가 모였어요 · 꾸미기에서 ♥${cheapest(S)} 소품을 놓아 보세요`, 3400, true);
}
setInterval(() => { goal(); hint(); }, 1000);
