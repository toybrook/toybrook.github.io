// inbox 41 D 첫날 할 일: on a game's first days (rules.js firstOn) a small list under the top bar, folded to its title by a tap
// (flags.fdFold). rules.js advance gives each task's hearts as it is done, all five the 첫날 기념 prop + candy; told here by
// one toast when the screen is free (like 도전 과제, level.js).
import * as G from '../game/game.js';
import { FIRST } from '../game/data.js';
import { firstOn, firstGot, PROP, HAB } from '../game/rules.js';
import { toast, topWindow, overlayOpen } from './hud.js';
import { sfx } from './sound.js';

const box = document.getElementById('fday'), T = FIRST.tasks;
let sig = null, said = [];
function draw() {
  const S = G.S, on = !!S && firstOn(S, G.now()), fold = !!S?.flags.fdFold;
  const s = on ? [fold, ...T.map(t => firstGot(S, t) + (S.first[t.id] ? '+' : ''))].join() : '';
  if (s === sig) return; sig = s; box.hidden = !on; if (!on) return;
  box.innerHTML = `<button class="fh" data-fold aria-expanded="${!fold}">첫날 할 일 <b>${T.filter(t => S.first[t.id]).length}/${T.length}</b><i aria-hidden="true">${fold ? '▾' : '▴'}</i></button>${fold ? '' :
    `<ol>${T.map(t => `<li${S.first[t.id] ? ' class="done"' : ''}><span>${S.first[t.id] ? '✓' : `${firstGot(S, t)}/${t.n}`}</span>${t.text}<small>♥${t.hearts}</small></li>`).join('')}</ol>
<p>다 하면 「${PROP[FIRST.prop].name}」 + 사탕 ${FIRST.candy}</p>`}`;
}
box.onclick = e => { if (e.target.closest('[data-fold]')) G.flag('fdFold', !G.S.flags.fdFold); };
G.on(ev => { said.push(...ev.filter(e => e.type === 'first' || e.type === 'firstAll')); draw(); });
setInterval(() => {
  draw();
  if (!said.length || topWindow() || overlayOpen() || document.body.classList.contains('photo')) return;
  const one = said.filter(e => e.type === 'first'), all = said.find(e => e.type === 'firstAll')?.got; said = [];
  const h = one.reduce((n, e) => n + e.hearts, 0), hab = all?.prop && HAB[G.S.props.findLast(p => p.prop === all.prop)?.hab];
  const head = one.length === 1 ? `첫날 할 일 「${T.find(t => t.id === one[0].id).text}」 · ♥${h}` : one.length ? `첫날 할 일 ${one.length}개 · ♥${h}` : '';
  toast([head, all && `다 했어요 · 「${PROP[all.prop]?.name ?? ''}」 + 꼬마 사탕 ${all.candy}개${hab ? ` · ${hab.name} 꾸미기 › 선물` : ''}`].filter(Boolean).join(' · '), all ? 4200 : 3000);
  if (all) sfx('grown');
}, 800);
