// inbox 41 B 우편함·선물 코드. The list is mail.json beside the game (same origin, docs/mail.md, tools/mail.mjs), read when the
// game opens and every hour while online; any failure is silent (an empty mailbox). The rules (who may have a mail, the
// gifts, overflow eggs as hearts) are in rules.js; this file shows the mailbox (the top bar's ✉, a red dot while one waits),
// the 선물 코드 넣기 card (설정) and what came.
// Beta: the list and the received ids live on the phone, so a player who edits them can take a gift again (release: a server).
import * as G from '../game/game.js';
import { mailOpen, legendRoom, PROP } from '../game/rules.js';
import { GIFT } from '../game/data.js';
import { sfx } from './sound.js';

const $ = id => document.getElementById(id), box = $('mail'), btn = $('mailBtn');
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let list = null; // { mail: [...], codes: [...] } once read
const load = () => navigator.onLine ? fetch('mail.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
  .then(d => { if (d && typeof d === 'object') { list = d; dot(); } }, () => {}).catch(() => {}) : Promise.resolve();
const all = () => [...(Array.isArray(list?.mail) ? list.mail : []), ...G.evMail()]; // 15-1: an event's mail while it runs
const waiting = () => all().filter(m => mailOpen(G.S, m, G.now()));
const dot = () => btn.classList.toggle('new', waiting().length > 0 || (G.S.giftEggs > 0 && legendRoom(G.S)));
const day = s => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(String(s ?? '')); return m ? `${+m[1]}월 ${+m[2]}일까지` : ''; };
const gifts = r => [r?.hearts > 0 && `♥${Math.floor(r.hearts)}`, r?.candy > 0 && `꼬마 사탕 ${Math.floor(r.candy)}개`,
  r?.eggs > 0 && `둥지 알 ${Math.floor(r.eggs)}개`, PROP[r?.prop] && `소품 「${PROP[r.prop].name}」`, r?.legendEggs > 0 && `전설 알 ${Math.floor(r.legendEggs)}개`].filter(Boolean).join(' · ');

function draw() {
  const L = waiting(), k = G.S.giftEggs, room = legendRoom(G.S); // 44: legend eggs that found the nest full wait here
  const wait = k > 0 ? `<li><i aria-hidden="true">🥚</i><span>전설 알 ${k}개<small>둥지에 자리가 생기면 받기</small><small class="gift">${room ? '지금 둥지에 자리가 있어요' : '둥지가 가득 찼어요. 알을 하나 부화하면 받을 수 있어요'}</small></span><button data-legend${room ? '' : ' disabled'}>받기</button></li>` : '';
  box.innerHTML = `<div><h2>우편함</h2>${L.length || wait ? `<ul>${wait}${L.map(m => `<li><i aria-hidden="true">✉️</i><span>${esc(m.title)}<small>${esc(m.body)}</small><small class="gift">${esc(gifts(m.rewards))}${m.end ? ` · ${day(m.end)}` : ''}</small></span><button data-get="${esc(m.id)}">받기</button></li>`).join('')}</ul>`
    : '<p class="note">새 우편이 없어요</p>'}
<div class="nbtns">${L.length > 1 ? '<button class="sb" data-all>모두 받기</button>' : ''}<button class="go" data-close>닫기</button></div></div>`;
}
// what came (a mail, all of them, or a code); eggs that found every nest full are told as hearts
function show(got) {
  const extra = got.reduce((n, g) => n + g.extra, 0), wait = got.reduce((n, g) => n + (g.wait || 0), 0);
  box.innerHTML = `<div><h2>받았어요</h2><ul>${got.map(g => `<li><i aria-hidden="true">🎁</i><span>${esc(g.title)}<small class="gift">${esc(gifts({ ...g, legendEggs: (g.legend || 0) + (g.wait || 0) }) || '♥0')}</small></span></li>`).join('')}</ul>${
    wait ? `<p class="note">둥지가 가득 차서 전설 알 ${wait}개는 우편함에 맡겨 뒀어요. 둥지에 자리가 생기면 우편함(✉)에서 받으세요</p>` : ''}${
    extra ? `<p class="note">둥지가 가득 차서 알 ${extra}개는 ♥${extra * GIFT.eggHearts}로 바꿨어요 (알 1개 = ♥${GIFT.eggHearts})</p>` : ''}
<div class="nbtns"><button class="go" data-close>좋아요</button></div></div>`;
  box.hidden = false; sfx('grown'); dot();
}
const ERR = { none: '맞는 선물 코드가 없어요', used: '이 기기에서 이미 쓴 코드예요', end: '기간이 끝난 코드예요' };
export function openCode() {
  box.innerHTML = `<div><h2>선물 코드 넣기</h2><input id="codeIn" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="선물 코드" placeholder="코드를 적어 주세요">
<p class="note" id="codeErr" role="status"></p><div class="nbtns"><button class="sb" data-close>닫기</button><button class="go" data-code>넣기</button></div></div>`;
  box.hidden = false; $('codeIn').focus(); load();
}
async function useCode() {
  const err = $('codeErr'), v = $('codeIn').value; if (!v.trim()) return;
  if (!list) await load();
  if (!list) { err.textContent = '코드 목록을 불러오지 못했어요. 인터넷에 연결한 뒤 다시 해 주세요'; return; }
  const out = G.useCode(list.codes, v);
  if (out.got) show(out.got); else err.textContent = ERR[out.err];
}
btn.onclick = () => { draw(); box.hidden = false; };
let evm = 0; G.on(() => { const n = G.evMail().length; if (n !== evm) { evm = n; dot(); } }); // 15-1: the dot when an event starts or ends
box.onclick = e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.close != null) { box.hidden = true; return; }
  if (d.code != null) return void useCode();
  if (d.legend != null) { const out = G.claimLegend(); if (out) show(out.got); else draw(); return; }
  const out = G.claimMail(all(), d.all != null ? undefined : [d.get]);
  if (out) show(out.got); else draw();
};
box.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'codeIn') useCode(); };
load(); setInterval(load, 3600000); addEventListener('online', () => load());
G.on(dot);
