// 보관함 (storage): animals not out in a habitat. No slot limit, kept in their stage. A habitat holds rules.capOf (maxVisible, more once expanded)
// animals and as many as its zones have room for (HABITATS room, rules.fits). Two lists: what is in storage (take out if
// it fits, send back for hearts if already in the codex) and who is out in this habitat (put in). Sort: species, rarity, newest.
// inbox 20: filters (species, rarity, baby/adult); 고르기 picks several to send out or back at once. Sending back cannot be
// undone, so it always asks (twice for a legendary or a secret one). 자리 없음 says why. 26-4: ☆/★ on a cell marks an 아끼는 친구:
// it is left out of sending several back, and sending it back on its own asks once more.
import { $t, ko } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { SPECIES, MODELS, RARITIES, ACCESSORIES, S186 } from '../game/data.js';
import { SP, HAB, RAR, RANK, variantOf, variantsOf, habitatOf, known, fits, outIn, need, canSendBack, sendBackHearts, capOf, roomOf, callName } from '../game/rules.js';
import { figureThumb } from './thumbs.js';
import { toast, heart, josa, ask } from './hud.js';
import { pickStroll, openCards, strollLeft } from './stroll.js';
import { dressUp } from './friends.js';
import { track } from './stats.js';

const el = document.getElementById('store');
const nameOf = callName;
const spIx = a => SPECIES.findIndex(s => s.id === a.species), vIx = a => variantsOf(SP[a.species]).findIndex(v => v.id === a.variant);
export const SORTS = {
  kind: [$t('종류'), (a, b) => spIx(a) - spIx(b) || vIx(a) - vIx(b) || b.id - a.id],
  rare: [$t('희귀도'), (a, b) => RANK[variantOf(b.species, b.variant).rarity] - RANK[variantOf(a.species, a.variant).rarity] || SORTS.kind[1](a, b)],
  new: [$t('최신'), (a, b) => b.id - a.id],
};
// rooms smaller than maxVisible, said in animals of that zone: "연못엔 성체 오리 9마리 크기까지"
const roomNote = h => Object.keys(h.room || {}).map(zone => {
  const room = roomOf(G.S, h, zone);
  const sp = SPECIES.find(s => s.habitat === h.id && MODELS[s.model]?.move === zone); if (!sp) return '';
  const n = Math.floor(room / need({ species: sp.id }) + 1e-6);
  return n < capOf(G.S, h.id) ? $t('{0}엔 성체 {1} {2}마리 크기까지', zone === 'swim' ? $t('물') : $t('땅'), sp.name, n) : '';
}).filter(Boolean).join(' · ');

let habId = null, hab = null, tab = 'store', sort = 'kind', shown = '', fsp = '', frar = '', fstage = 'all', picking = false;
const picked = new Set();
const sig = () => G.S.animals.map(a => `${a.id}${a.stored ? 's' : a.pending ? 'p' : ''}${a.stage[0]}${a.hold ? 'h' : ''}${a.fav ? '*' : ''}${a.stroll ? strollLeft(a) : ''}${a.acc || ''}`).join() + JSON.stringify(G.S.accs) + tab + sort + fsp + frar + fstage + picking + [...picked] + G.S.cards.length + G.S.cards.some(c => c.new);

export function openStore(id, api) { habId = id; hab = api; el.hidden = false; picking = false; picked.clear(); draw(); }
export const leaveStore = () => { el.hidden = true; hab = null; };
G.on(() => { if (el.hidden || sig() === shown) return; const y = el.querySelector('.cbody')?.scrollTop || 0; draw(); el.querySelector('.cbody').scrollTop = y; });

// why it cannot come out: its home is shut, full, or out of room for its size
function whyNot(a) {
  const h = HAB[habitatOf(a)], n = outIn(G.S, h.id).length, cap = capOf(G.S, h.id);
  if (!G.S.unlocked.includes(h.id)) return $t('{0}{이/가} 열리면 꺼낼 수 있어요', h.name);
  if (n >= cap) return $t('{0}{이/가} 꽉 찼어요 ({1}/{2}) · 땅을 넓히거나 다른 동물을 넣으면 나올 수 있어요', h.name, n, cap);
  return $t('{0}에 이 동물이 들어갈 자리가 모자라요 · 큰 동물을 넣거나 땅을 넓혀 보세요', h.name);
}
const filt = a => (!fsp || a.species === fsp) && (!frar || variantOf(a.species, a.variant).rarity === frar) && (fstage === 'all' || (fstage === 'baby') === (a.stage === 'baby'));
const rarOf = a => RAR[variantOf(a.species, a.variant).rarity], precious = a => !!rarOf(a).precious || !!a.s; // 95: a hatched secret (a.s), not whoever wears an accessory now
const PRECIOUS = RARITIES.filter(r => r.precious).map(r => r.name).join('·'); // 전설

function draw() {
  shown = sig();
  const h = HAB[habId], stored = G.S.animals.filter(a => a.stored && known(a)), out = outIn(G.S, habId);
  const all = tab === 'store' ? stored : tab === 'acc' ? [...out, ...stored] : out, list = all.filter(filt).sort(SORTS[sort][1]);
  for (const id of picked) if (!list.some(a => a.id === id)) picked.delete(id);
  const walk = a => $t('<button class="sb wk" data-walk="{0}">산책</button>', a.id);
  const btns = a => tab === 'acc' ? (a.acc ? $t('<button class="sb" data-accoff="{0}">떼기</button>', a.id) : Object.keys(G.S.accs).length ? $t('<button class="go" data-accon="{0}">끼우기</button>', a.id) : '') : a.stroll ? $t('<small class="onwalk">산책 중 · {0} 남음</small>', strollLeft(a)) : tab === 'store'
    ? `<button class="go${fits(G.S, a) ? '' : ' off'}" data-out="${a.id}">${fits(G.S, a) ? $t('꺼내기') : $t('자리 없음')}</button>${canSendBack(G.S, a) ? `<button class="sb" data-back="${a.id}">♥+${sendBackHearts(a)}</button>` : ''}${walk(a)}`
    : $t('<button class="sb" data-in="{0}">넣기</button>{1}', a.id, walk(a));
  const opt = (v, t, on) => `<option value="${v}"${on ? ' selected' : ''}>${t}</option>`, kinds = [...new Set(all.map(a => a.species))];
  const sel = list.filter(a => picked.has(a.id)), backs = sel.filter(a => canSendBack(G.S, a) && !a.fav), favs = sel.filter(a => a.fav).length;
  el.innerHTML = $t('<div class="chead"><b>보관함</b><span>{0}마리</span><button class="back{1}" data-cards>엽서 {2}</button><button class="back" data-close>닫기</button></div>\n<div class="ctabs"><button data-tab="store"{3}>보관함 {4}</button><button data-tab="out"{5}>{6} {7}/{8}</button><button data-tab="acc"{9}>치장 {10}</button>\n<span class="sorts">{11}</span></div>\n<div class="sfilt"><span class="seg">{12}</span>\n<select data-fsp aria-label="종">{13}{14}</select>\n<select data-frar aria-label="등급">{15}{16}</select>\n{17}</div>\n<div class="cbody">{18}<div class="srow">{19}</div>\n{20}\n<p class="cnote">{21}엔 {22}마리까지 나와요{23}</p></div>\n{24}{25}', stored.length, G.S.cards.some(c => c.new) ? ' new' : '', G.S.cards.length, tab === 'store' ? ' class="on"' : '', stored.length, tab === 'out' ? ' class="on"' : '', h.name, out.length, capOf(G.S, habId), tab === 'acc' ? ' class="on"' : '', Object.values(G.S.accs).reduce((s, n) => s + n, 0), Object.entries(SORTS).map(([k, [nm]]) => `<button data-sort="${k}"${k === sort ? ' class="on"' : ''}>${nm}</button>`).join(''), [['all', $t('전체')], ['baby', $t('새끼')], ['adult', $t('성체')]].map(([k, t]) => `<button data-stage="${k}"${k === fstage ? ' class="on"' : ''}>${t}</button>`).join(''), opt('', $t('모든 종'), !fsp), kinds.map(s => opt(s, SP[s].name, s === fsp)).join(''), opt('', $t('모든 등급'), !frar), RARITIES.map(r => opt(r.id, r.name, r.id === frar)).join(''), tab === 'store' && stored.length ? `<button class="pick${picking ? ' on' : ''}" data-pick>${picking ? $t('고르기 끝') : $t('고르기')}</button>` : '', tab === 'acc' ? `<p class="cnote accs">${Object.entries(G.S.accs).map(([k, n]) => `<span>${ACCESSORIES[k].name} ×${n}</span>`).join('') || $t('떼어 둔 치장이 없어요 · 동물을 눌러 떼면 여기 모여요')}</p>` : '', list.map(a => `<div class="cell scell${picked.has(a.id) ? ' picked' : ''}${a.stroll ? ' away' : ''}" data-a="${a.id}" data-r="${variantOf(a.species, a.variant).rarity}"><img alt="${nameOf(a)}">${a.stage === 'baby' ? $t('<i class="baby">아기</i>') : ''}${picking ? `<b class="tick"></b>${a.fav ? '<i class="sfav">★</i>' : ''}` : $t('<button class="sfav{0}" data-star="{1}" aria-label="잠금" aria-pressed="{2}">{3}</button>', a.fav ? ' on' : '', a.id, !!a.fav, a.fav ? '★' : '☆')}<span>${nameOf(a)}</span>${a.hold ? (S186 ? $t('<small class="hold">크기 고정</small>') : $t('<small class="hold">성장 멈춤</small>')) : ''}${picking ? '' : `<div class="sbtns">${btns(a)}</div>`}</div>`).join(''), list.length ? '' : `<p class="cnote">${all.length ? $t('고른 조건에 맞는 동물이 없어요') : tab === 'store' ? $t('보관함이 비어 있어요') : $t('서식지에 나온 동물이 없어요')}</p>`, h.name, capOf(G.S, habId), roomNote(h) ? ` · ${roomNote(h)}` : '', picking && favs ? $t('<p class="cnote sfavnote">★ 잠금한 동물 {0}마리는 판매되지 않아요</p>', favs) : '', picking ? $t('<div class="sact"><button data-many="out"{0}>서식지로 보내기 {1}</button><button class="sb" data-many="back"{2}>판매 {3}</button></div>', sel.length ? '' : ' disabled', sel.length || '', backs.length ? '' : ' disabled', backs.length ? `♥+${backs.reduce((n, a) => n + sendBackHearts(a), 0)}` : '') : '');
  el.querySelectorAll('.scell img').forEach((img, i) => { const a = list[i]; figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }, () => {}); });
}

// sending back cannot be undone: always asked when several go; one at a time only a legendary or a secret one asks
async function sure(list) {
  const n = list.reduce((s, a) => s + sendBackHearts(a), 0), one = list.length === 1 && nameOf(list[0]);
  if (list.length > 1 && !await ask($t('{0}마리를 판매할까요? 판매하면 되돌릴 수 없어요. (♥+{1})', list.length, n), $t('판매'))) return false;
  const favs = list.filter(a => a.fav); // only ever one: several leave them out
  if (favs.length && !await ask($t('{0}{은/는} 잠금한 동물(★)이에요. 그래도 판매할까요?', one), $t('판매'))) return false;
  const top = list.filter(precious);
  if (top.length && !await ask(one ? $t('{0}{은/는} {1} 동물이에요. 정말 판매할까요?', one, top[0].s ? $t('시크릿 치장으로 태어난') : rarOf(top[0]).name) : $t('{0}·시크릿 동물 {1}마리가 들어 있어요. 정말 판매할까요?', PRECIOUS, top.length), $t('판매'))) return false;
  return true;
}

el.addEventListener('change', e => { const d = e.target.dataset; if (d.fsp != null) fsp = e.target.value; if (d.frar != null) frar = e.target.value; draw(); });
el.addEventListener('click', async e => {
  if (picking) { const c = e.target.closest('.scell:not(.away)'); if (c && !e.target.closest('button')) { const id = +c.dataset.a; picked.has(id) ? picked.delete(id) : picked.add(id); return draw(); } }
  const b = e.target.closest('button'), d = b?.dataset; if (!b) return;
  const a = G.S.animals.find(x => x.id === +(d.out || d.back || d.in || d.star || d.walk || d.accon || d.accoff)), nm = a && nameOf(a);
  if (d.close != null) el.hidden = true;
  else if (d.cards != null) openCards();
  else if (d.walk) pickStroll(a);
  else if (d.accon) dressUp(a); // 95
  else if (d.accoff) { const k = G.accOff(a.id); if (k) { track('acc_off', { v: ko(ACCESSORIES[k].name) }, 'acc_off:' + k); toast($t('{0}의 「{1}」{을/를} 뗐어요', nm, ACCESSORIES[k].name)); } }
  else if (d.tab) { tab = d.tab; picking = false; picked.clear(); fsp = ''; draw(); }
  else if (d.sort) { sort = d.sort; draw(); }
  else if (d.stage) { fstage = d.stage; draw(); }
  else if (d.pick != null) { picking = !picking; picked.clear(); draw(); }
  else if (d.many === 'out') {
    let ok = 0; const left = [];
    for (const id of picked) { const x = G.S.animals.find(y => y.id === id); if (x && G.unstore(id)) { ok++; if (hab && habitatOf(x) === habId) hab.drop(x); } else if (x) left.push(x); }
    picked.clear(); picking = false; draw();
    toast($t('{0}마리를 서식지로 보냈어요{1}', ok, left.length ? $t(' · {0}마리는 {1}', left.length, whyNot(left[0]).split(' · ')[0]) : ''), 3200);
  } else if (d.many === 'back') {
    const list = [...picked].map(id => G.S.animals.find(y => y.id === id)).filter(x => x && canSendBack(G.S, x) && !x.fav);
    if (!list.length || !await sure(list)) return;
    let n = 0; for (const x of list) n += G.sendBack(x.id);
    heart(e.clientX, e.clientY); picked.clear(); picking = false; draw(); toast($t('{0}마리를 판매했어요 · ♥+{1}', list.length, n));
  }
  else if (d.out) { if (!G.unstore(a.id)) return toast(whyNot(a), 3200); if (hab && habitatOf(a) === habId) hab.drop(a); toast($t('{0}{이/가} {1}에 나왔어요', nm, HAB[habitatOf(a)].name)); }
  else if (d.star) { G.setFav(a.id, !a.fav); toast(a.fav ? $t('{0}{을/를} 잠갔어요 · 여러 마리 판매에서 빠져요', nm) : $t('{0} 잠금을 풀었어요', nm), 2600); }
  else if (d.back) { if ((precious(a) || a.fav) && !await sure([a])) return; const n = G.sendBack(a.id); if (n) { heart(e.clientX, e.clientY); toast($t('{0}{을/를} 판매했어요 · ♥+{1}', nm, n)); } }
  else if (d.in && G.store(a.id)) toast($t('{0}{을/를} 보관함에 넣었어요', nm));
});
