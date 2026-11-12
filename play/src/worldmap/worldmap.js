// World map: painted island (no UI in the picture) with tappable habitat spots.
// Locks, signs and name labels are drawn here from HABITATS (game/data.js) and the save's unlocks.
import { toast, lockText } from '../ui/hud.js';
import * as G from '../game/game.js';
import { HABITATS } from '../game/data.js';
import { unlockInfo } from '../game/rules.js';

const INK = '#6b4a2b', CREAM = '#fff4dc';
const LOCK = `<svg viewBox="0 0 32 36" aria-hidden="true">
  <path d="M9 17V11a7 7 0 0 1 14 0v6" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M9 17V11a7 7 0 0 1 14 0v6" fill="none" stroke="#efe0bf" stroke-width="3.6" stroke-linecap="round"/>
  <rect x="3.5" y="15" width="25" height="19" rx="5.5" fill="#f8eed6" stroke="${INK}" stroke-width="2"/>
  <rect x="6.5" y="17.5" width="19" height="3" rx="1.5" fill="#fffaf0" opacity=".8"/>
  <circle cx="16" cy="23.5" r="2.7" fill="${INK}"/><rect x="14.8" y="24" width="2.4" height="5.5" rx="1.2" fill="${INK}"/>
</svg>`;
// sign icons (map art) in a 40-unit box centred on the sign face
const ICON = {
  horse: `<path d="M-6 12C-6.5 6-7.5 1-5.5-3.5-4.5-6.5-2.5-8.6-.5-9.6L.6-14l2.7 4.2c2.7.6 5.3 2.6 6.8 5.6l2 3.7c.9 1.8-.4 3.5-2.4 3L6 1.6c-1.5 2.2-1.4 5.6.2 10.4z" fill="${CREAM}"/>
    <path d="M-.5-9.6C-4-8-6.8-4.5-7.6.5-8.1 4-7.9 8-7.6 11" fill="none" stroke="#e9c48d" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="4" cy="-4.6" r="1.2" fill="${INK}"/>`,
  duck: `<circle cx="-3" cy="-5" r="4.8" fill="${CREAM}"/><path d="M-7.2-6.2-12.6-3.6-7.2-2.2z" fill="#f1a948"/>
    <path d="M-9.5 3.5C-9.5 9-4 11.5 2.5 11.5S12 8 11.2 2.5L13-3.4 8 .2C4.8-1-.5-1.1-3.5.2-6.5 1-9.5 1.4-9.5 3.5z" fill="${CREAM}"/>
    <circle cx="-2" cy="-6" r="1.1" fill="${INK}"/>`,
  penguin: `<ellipse cy="1" rx="8.6" ry="11.6" fill="#3d4250"/><ellipse cy="2.6" rx="5.8" ry="9.4" fill="${CREAM}"/>
    <circle cx="-2.4" cy="-4.4" r="1.1" fill="${INK}"/><circle cx="2.4" cy="-4.4" r="1.1" fill="${INK}"/><path d="M-1.9-2.6H1.9L0 .2z" fill="#f1a948"/>
    <ellipse cx="-3.4" cy="12.4" rx="3" ry="1.4" fill="#f1a948"/><ellipse cx="3.4" cy="12.4" rx="3" ry="1.4" fill="#f1a948"/>`, // 25-1 the snow's sign
  triceratops: `<ellipse cx="-3" cy="-2" rx="9.5" ry="9" fill="#e9c48d"/><ellipse cx="2.5" cy="3.5" rx="8" ry="6.6" fill="${CREAM}"/>
    <path d="M9 2.5 14.2 6 9 8.6z" fill="${CREAM}"/><path d="M-.6-1.4 3.4-11.6 3.2-.6zM4.6-.8 8.6-9.2 7.8.4zM10.6 1.2 12.6-3.6 12.4 2.4z" fill="#f6efe0"/>
    <circle cx="5.6" cy="1.6" r="1.1" fill="${INK}"/>`, // 14-3 the dino jungle's sign
};
const SIGN = icon => `<svg viewBox="-20 -20 40 50" aria-hidden="true">
  <rect x="-2.6" y="12" width="5.2" height="17" rx="2" fill="#8a5a2f"/>
  <circle r="17" fill="#c98a4f" stroke="${INK}" stroke-width="2.5"/><circle r="13.6" fill="none" stroke="#e7b77d" stroke-width="1.2" opacity=".7"/>
  ${ICON[icon] || ''}
</svg>`;

const lockToast = id => toast(lockText(id), 3200);

export function initWorldMap(root, { enter }) {
  const map = root.querySelector('#map'), made = [];
  const add = (cls, [x, y], html) => { const e = document.createElement(cls === 'label' ? 'span' : 'div'); e.className = cls; e.style.left = x + 'px'; e.style.top = y + 'px'; e.innerHTML = html; map.appendChild(e); made.push(e); };
  function refresh() {
    for (const e of made.splice(0)) e.remove();
    for (const spot of root.querySelectorAll('.spot[data-hab]')) {
      const h = HABITATS.find(h => h.id === spot.dataset.hab), P = h.map; // where its marker and label sit (data.js)
      const state = !unlockInfo(G.S, h.id).open ? 'lock' : h.ready ? 'in' : 'soon';
      add(state === 'lock' ? 'mark lock' : 'mark sign', P.at, state === 'lock' ? LOCK : SIGN(P.icon));
      const word = { lock: '잠김', in: '들어가기', soon: '준비 중' }[state];
      add('label', P.label, `${h.name} · ${word}`);
      spot.setAttribute('aria-label', `${h.name} 서식지, ${word}`);
      spot.onclick = state === 'in' ? () => enter(h.id) : state === 'soon' ? () => toast('준비 중이에요') : () => lockToast(h.id);
    }
  }
  // inbox 40: the map covers the stage like a picture, so a tall narrow screen (Fold cover, Flip) loses its sides;
  // the name labels slide back inside. It runs on stage resize and on label size (font) changes.
  const stage = map.closest('.stage');
  const ro = new ResizeObserver(() => {
    const r = map.getBoundingClientRect(), s = stage.getBoundingClientRect(), m = r.width / 390;
    if (!m) return;
    const lo = (s.left - r.left) / m + 6, hi = (s.right - r.left) / m - 6;
    for (const e of made) if (e.tagName === 'SPAN') {
      const x = parseFloat(e.style.left), w = e.offsetWidth / 2;
      e.style.marginLeft = (x - w < lo ? lo - x + w : x + w > hi ? hi - x - w : 0) + 'px';
    }
  });
  const watch = () => { ro.disconnect(); ro.observe(stage); for (const e of made) if (e.tagName === 'SPAN') ro.observe(e); };
  refresh(); watch();
  return { refresh() { refresh(); watch(); } };
}
