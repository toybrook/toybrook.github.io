// 14-2 신수·전설 이야기 카드 (game/story.js): one card is the day's line and three lines of text. 74: text only, read in the
// codex's 신수 row (no picture saved, no code to copy or paste; game/story.js still makes the codes, for old ones). Given at
// the moment (ui/myth.js its coming, its settling; ui/nest.js a legendary's first one): a toast pointing there, no window.
// #story is in hud.js TOPS, so level / 돌아왔어요 cards wait for it.
import * as G from '../game/game.js';
import { HAB } from '../game/rules.js';
import { storyCards, cardTitle, cardLines } from '../game/story.js';
import { toast } from './hud.js';
import { sfx } from './sound.js';

const el = document.getElementById('story'), esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let list = null; // the habitat whose cards it came from (back to them)
const mark = c => c.k === 'l' ? '전설 이야기 카드' : '신수 이야기 카드';

export const cardsIn = hab => storyCards(G.S).filter(c => c.hab === hab);
// the card of the moment: k 'm' | 's' | 'l', id (for 'l': 'species:variant'); nothing if the save has no such card
export function giveStory(k, id) { const c = storyCards(G.S).find(c => c.k === k && (!id || c.id === id)); if (c) { sfx('grown'); toast(`${mark(c)}가 생겼어요 · 도감 › 신수에서 읽어요`, 3200); } }

function openStory(c) {
  el.innerHTML = `<div><small class="mk">${mark(c)}</small><h2>${esc(cardTitle(c))}</h2>${cardLines(c).map(t => `<p>${esc(t)}</p>`).join('')}
<div class="nbtns">${list ? '<button class="sb" data-act="list">목록</button>' : ''}<button class="go" data-close>닫기</button></div></div>`;
  el.hidden = false; el.firstChild.scrollTop = 0;
}
// a habitat's cards (the codex's 신수 row)
export function openStories(hab) {
  list = hab; const cs = cardsIn(hab).reverse();
  el.innerHTML = `<div><h2>이야기 카드 · ${HAB[hab].name}</h2>${cs.length ? `<ul class="slist">${cs.map((c, i) => `<li><button data-i="${i}"><span>${esc(cardTitle(c))}<small>${mark(c)}</small></span></button></li>`).join('')}</ul>` : '<p class="sub">신수를 만나거나 전설 친구가 태어나면 그날의 카드가 생겨요</p>'}
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  el.hidden = false; el._cs = cs;
}

el.addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.close != null) { el.hidden = true; list = null; return; }
  if (d.i != null) return openStory(el._cs[+d.i]);
  if (d.act === 'list') return openStories(list);
});
