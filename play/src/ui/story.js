// 14-2 신수·전설 이야기 카드 (game/story.js): one card is the day's line and three lines of text. 74: text only, read in the
// codex's 신수 row (no picture saved, no code to copy or paste; game/story.js still makes the codes, for old ones). Given at
// the moment (ui/myth.js its coming, its settling; ui/nest.js a legendary's first one): a toast pointing there, no window.
// #story is in hud.js TOPS, so level / 돌아왔어요 cards wait for it.
import { $t, esc } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { HAB } from '../game/rules.js';
import { storyCards, cardTitle, cardLines } from '../game/story.js';
import { toast } from './hud.js';
import { sfx } from './sound.js';

const el = document.getElementById('story');
let list = null; // the habitat whose cards it came from (back to them)
const mark = c => c.k === 'l' ? $t('전설 이야기 카드') : $t('신수 이야기 카드');

export const cardsIn = hab => storyCards(G.S).filter(c => c.hab === hab);
// the card of the moment: k 'm' | 's' | 'l', id (for 'l': 'species:variant'); nothing if the save has no such card
export function giveStory(k, id) { const c = storyCards(G.S).find(c => c.k === k && (!id || c.id === id)); if (c) { sfx('grown'); toast($t('{0}가 생겼어요 · 도감 › 신수에서 읽어요', mark(c)), 3200); } }

function openStory(c) {
  el.innerHTML = $t('<div><small class="mk">{0}</small><h2>{1}</h2>{2}\n<div class="nbtns">{3}<button class="go" data-close>닫기</button></div></div>', mark(c), esc(cardTitle(c)), cardLines(c).map(t => `<p>${esc(t)}</p>`).join(''), list ? $t('<button class="sb" data-act="list">목록</button>') : '');
  el.hidden = false; el.firstChild.scrollTop = 0;
}
// a habitat's cards (the codex's 신수 row)
export function openStories(hab) {
  list = hab; const cs = cardsIn(hab).reverse();
  el.innerHTML = $t('<div><h2>이야기 카드 · {0}</h2>{1}\n<div class="nbtns"><button class="go" data-close>닫기</button></div></div>', HAB[hab].name, cs.length ? `<ul class="slist">${cs.map((c, i) => `<li><button data-i="${i}"><span>${esc(cardTitle(c))}<small>${mark(c)}</small></span></button></li>`).join('')}</ul>` : $t('<p class="sub">신수를 만나거나 전설 동물이 태어나면 그날의 카드가 생겨요</p>'));
  el.hidden = false; el._cs = cs;
}

el.addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.close != null) { el.hidden = true; list = null; return; }
  if (d.i != null) return openStory(el._cs[+d.i]);
  if (d.act === 'list') return openStories(list);
});
