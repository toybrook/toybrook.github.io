// 14-2 신수·전설 이야기 카드 (game/story.js): one card on its stand (the figure's thumbnail, the day's line, three lines), saved
// as a picture (like 사진 모드: a JPEG with the card's code as a small QR) or as its code (like 꾸미기 코드: copy, paste to see
// a card someone sent). The codex's 신수 row opens a habitat's cards. Given at the moment: ui/myth.js (its coming, its settling),
// ui/nest.js (a legendary's first one). #story is in hud.js TOPS, so level / 돌아왔어요 / 출석부 cards wait for it.
import * as G from '../game/game.js';
import { HAB } from '../game/rules.js';
import { storyCards, cardTitle, cardLines, cardName, encodeCard, decodeCard } from '../game/story.js';
import { figureThumb, mythThumb } from './thumbs.js';
import { sfx } from './sound.js';

const el = document.getElementById('story'), esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let cur = null, list = null, msg = ''; // cur: the card shown; list: the habitat whose cards it came from (back to them)
const thumb = c => { if (c.k !== 'l') return mythThumb(false, false, 0); const [sp, v] = c.id.split(':'); return figureThumb(sp, v, null, null, 'adult', false, 0); };
const mark = c => c.k === 'l' ? '전설 이야기 카드' : '신수 이야기 카드';
const pic = (img, c) => thumb(c).then(u => { img.src = u; }, () => {});

export const cardsIn = hab => storyCards(G.S).filter(c => c.hab === hab);
// the card of the moment: k 'm' | 's' | 'l', id (for 'l': 'species:variant'); nothing if the save has no such card
export function giveStory(k, id) { const c = storyCards(G.S).find(c => c.k === k && (!id || c.id === id)); if (c) { list = null; sfx('grown'); openStory(c); } }

export function openStory(c, got = false) {
  cur = c; if (!got) msg = ''; const code = encodeCard(c);
  el.innerHTML = `<div><small class="mk">${mark(c)}${c.got ? ' · 받은 카드' : ''}</small><figure class="mcard scard"><div class="mstand"><img alt="${esc(cardName(c))}"></div>
<figcaption><b>${esc(cardTitle(c))}</b></figcaption></figure>${cardLines(c).map(t => `<p>${esc(t)}</p>`).join('')}
<textarea class="scode" rows="1" wrap="off" readonly spellcheck="false" aria-label="이야기 카드 코드">${code}</textarea>
<p class="sub" role="status">${msg || '카드 코드에는 날짜·때·서식지·친구 종류만 담겨요'}</p>
<div class="nbtns"><button class="sb" data-act="img">이미지 저장</button><button class="sb" data-act="copy">코드 복사</button>${list ? '<button class="sb" data-act="list">목록</button>' : ''}<button class="go" data-close>닫기</button></div></div>`;
  pic(el.querySelector('img'), c); el.hidden = false; el.firstChild.scrollTop = 0;
}
// a habitat's cards (the codex's 신수 row), and a code someone sent
export function openStories(hab) {
  list = hab; cur = null; const cs = cardsIn(hab).reverse(), v = el.querySelector('#stText')?.value || '';
  el.innerHTML = `<div><h2>이야기 카드 · ${HAB[hab].name}</h2>${cs.length ? `<ul class="slist">${cs.map((c, i) => `<li><button data-i="${i}"><img alt=""><span>${esc(cardTitle(c))}<small>${mark(c)}</small></span></button></li>`).join('')}</ul>` : '<p class="sub">신수를 만나거나 전설 친구가 태어나면 그날의 카드가 생겨요</p>'}
<div class="row"><b>받은 카드 보기</b><textarea id="stText" rows="2" placeholder="받은 이야기 카드 코드(TS1.…)를 붙여 넣어요" spellcheck="false" autocomplete="off"></textarea><p class="sub" role="status">${msg}</p><button class="sb" data-act="see">보기</button></div>
<div class="nbtns"><button class="go" data-close>닫기</button></div></div>`;
  el.querySelector('#stText').value = v; msg = '';
  el.querySelectorAll('.slist img').forEach((img, i) => pic(img, cs[i])); el.hidden = false;
  el._cs = cs;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* http on a LAN */ }
  const t = el.querySelector('.scode'); t.focus(); t.select();
  try { return document.execCommand('copy'); } catch { return false; }
}
// the picture: 1080 x 1350, the card as on screen, its code as a QR in the corner, 토이브룩 at the foot
async function saveImage(c) {
  const qrcode = (await import('../../vendor/qrcode.js').catch(() => null))?.default; // 67-2: not with the first screen's code (none: the picture without it)
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), font = getComputedStyle(document.body).fontFamily;
  x.fillStyle = '#fbf1e1'; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 90, 0, 650); g.addColorStop(0, '#fff4dc'); g.addColorStop(1, '#f6dcb0'); x.fillStyle = g;
  x.beginPath(); x.roundRect(80, 90, W - 160, 560, 48); x.fill(); x.strokeStyle = '#e3b97a'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#d9a040'; x.beginPath(); x.ellipse(W / 2, 600, 300, 34, 0, 0, Math.PI * 2); x.fill();
  const img = new Image(); img.src = await thumb(c); await img.decode();
  const k = Math.min((W - 220) / img.width, 520 / img.height); x.drawImage(img, (W - img.width * k) / 2, 610 - img.height * k, img.width * k, img.height * k);
  x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = '#b0703a'; x.font = `700 34px ${font}`; x.fillText(mark(c), W / 2, 30);
  const wrap = (t, y, size, color, weight) => { // keep-all: break at spaces only
    x.font = `${weight} ${size}px ${font}`; x.fillStyle = color; let line = '';
    for (const w of t.split(' ')) { const n = line ? line + ' ' + w : w; if (x.measureText(n).width > W - 180 && line) { x.fillText(line, W / 2, y); y += size * 1.4; line = w; } else line = n; }
    x.fillText(line, W / 2, y); return y + size * 1.4;
  };
  let y = wrap(cardTitle(c), 690, 48, '#7a3a1c', 800) + 20;
  for (const t of cardLines(c)) y = wrap(t, y, 38, '#4a3626', 500);
  try { // the code as a QR, bottom left (as the photo's 꾸미기 코드 tile)
    const q = qrcode(0, 'L'); q.addData(encodeCard(c)); q.make(); const n = q.getModuleCount(), cell = Math.floor(170 / (n + 6)), s = cell * (n + 6), x0 = 70, y0 = H - 70 - s;
    x.fillStyle = '#fffaf0'; x.fillRect(x0, y0, s, s); x.fillStyle = '#2b1d12';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) x.fillRect(x0 + (3 + cc) * cell, y0 + (3 + r) * cell, cell, cell);
    x.textAlign = 'left'; x.textBaseline = 'bottom'; x.font = `700 26px ${font}`; x.fillStyle = '#6b4a2b'; x.fillText('카드 코드', x0 + s + 16, H - 76);
  } catch { /* no QR: the picture without it */ }
  x.textAlign = 'right'; x.textBaseline = 'bottom'; x.font = `800 40px ${font}`; x.fillStyle = '#8a6646'; x.fillText('토이브룩', W - 70, H - 70);
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92)), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `toybrook-story-${c.k}-${c.day}.jpg`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

el.addEventListener('click', async e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d) return;
  if (d.close != null) { el.hidden = true; list = cur = null; msg = ""; return; }
  if (d.i != null) return openStory(el._cs[+d.i]);
  if (d.act === 'list') return openStories(list);
  if (d.act === 'see') { const c = decodeCard(el.querySelector('#stText').value); if (c.error) { msg = c.error; return openStories(list); } return openStory({ ...c, got: true }); }
  if (!cur) return;
  if (d.act === 'copy') msg = await copy(encodeCard(cur)) ? '카드 코드를 복사했어요 · 메시지로 보내면 받은 사람이 도감 › 이야기 카드에서 볼 수 있어요' : '복사가 안 돼요 · 위 칸의 코드를 길게 눌러 복사해 주세요';
  if (d.act === 'img') { msg = '저장하는 중…'; openStory(cur, true); sfx('photo'); try { await saveImage(cur); msg = '저장했어요 · 내려받은 파일이나 사진 앱에서 볼 수 있어요'; } catch { msg = '저장하지 못했어요 · 다시 해 주세요'; } }
  openStory(cur, true);
});
