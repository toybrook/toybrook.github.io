// 보관함 (storage): animals not out in a habitat. No slot limit, kept in their stage. A habitat holds rules.capOf (maxVisible, more once expanded)
// animals and as many as its zones have room for (HABITATS room, rules.fits). Two lists: what is in storage (take out if
// it fits, send back for hearts if already in the codex) and who is out in this habitat (put in). Sort: species, rarity, newest.
// inbox 20: filters (species, rarity, baby/adult); 고르기 picks several to send out or back at once. Sending back cannot be
// undone, so it always asks (twice for a legendary or a secret one). 자리 없음 says why. 26-4: ☆/★ on a cell marks an 아끼는 친구:
// it is left out of sending several back, and sending it back on its own asks once more.
import * as G from '../game/game.js';
import { SPECIES, MODELS, RARITIES } from '../game/data.js';
import { SP, HAB, RAR, RANK, variantOf, variantsOf, habitatOf, known, fits, outIn, need, canSendBack, sendBackHearts, capOf, roomOf, callName } from '../game/rules.js';
import { figureThumb } from './thumbs.js';
import { toast, heart, josa, ask } from './hud.js';
import { pickStroll, openCards, strollLeft } from './stroll.js';

const el = document.getElementById('store');
const nameOf = callName;
const spIx = a => SPECIES.findIndex(s => s.id === a.species), vIx = a => variantsOf(SP[a.species]).findIndex(v => v.id === a.variant);
export const SORTS = {
  kind: ['종류', (a, b) => spIx(a) - spIx(b) || vIx(a) - vIx(b) || b.id - a.id],
  rare: ['희귀도', (a, b) => RANK[variantOf(b.species, b.variant).rarity] - RANK[variantOf(a.species, a.variant).rarity] || SORTS.kind[1](a, b)],
  new: ['최신', (a, b) => b.id - a.id],
};
// rooms smaller than maxVisible, said in animals of that zone: "연못엔 성체 오리 9마리 크기까지"
const roomNote = h => Object.keys(h.room || {}).map(zone => {
  const room = roomOf(G.S, h, zone);
  const sp = SPECIES.find(s => s.habitat === h.id && MODELS[s.model]?.move === zone); if (!sp) return '';
  const n = Math.floor(room / need({ species: sp.id }) + 1e-6);
  return n < capOf(G.S, h.id) ? `${zone === 'swim' ? '물' : '땅'}엔 성체 ${sp.name} ${n}마리 크기까지` : '';
}).filter(Boolean).join(' · ');

let habId = null, hab = null, tab = 'store', sort = 'kind', shown = '', fsp = '', frar = '', fstage = 'all', picking = false;
const picked = new Set();
const sig = () => G.S.animals.map(a => `${a.id}${a.stored ? 's' : a.pending ? 'p' : ''}${a.stage[0]}${a.hold ? 'h' : ''}${a.fav ? '*' : ''}${a.stroll ? strollLeft(a) : ''}`).join() + tab + sort + fsp + frar + fstage + picking + [...picked] + G.S.cards.length + G.S.cards.some(c => c.new);

export function openStore(id, api) { habId = id; hab = api; el.hidden = false; picking = false; picked.clear(); draw(); }
export const leaveStore = () => { el.hidden = true; hab = null; };
G.on(() => { if (el.hidden || sig() === shown) return; const y = el.querySelector('.cbody')?.scrollTop || 0; draw(); el.querySelector('.cbody').scrollTop = y; });

// why it cannot come out: its home is shut, full, or out of room for its size
function whyNot(a) {
  const h = HAB[habitatOf(a)], n = outIn(G.S, h.id).length, cap = capOf(G.S, h.id);
  if (!G.S.unlocked.includes(h.id)) return `${h.name}${josa(h.name, '이', '가')} 열리면 꺼낼 수 있어요`;
  if (n >= cap) return `${h.name}${josa(h.name, '이', '가')} 꽉 찼어요 (${n}/${cap}) · 땅을 넓히거나 다른 친구를 넣으면 나올 수 있어요`;
  return `${h.name}에 이 친구가 들어갈 자리가 모자라요 · 큰 친구를 넣거나 땅을 넓혀 보세요`;
}
const filt = a => (!fsp || a.species === fsp) && (!frar || variantOf(a.species, a.variant).rarity === frar) && (fstage === 'all' || (fstage === 'baby') === (a.stage === 'baby'));
const rarOf = a => RAR[variantOf(a.species, a.variant).rarity], precious = a => !!rarOf(a).precious || !!a.acc;
const PRECIOUS = RARITIES.filter(r => r.precious).map(r => r.name).join('·'); // 전설

function draw() {
  shown = sig();
  const h = HAB[habId], stored = G.S.animals.filter(a => a.stored && known(a)), out = outIn(G.S, habId);
  const all = tab === 'store' ? stored : out, list = all.filter(filt).sort(SORTS[sort][1]);
  for (const id of picked) if (!list.some(a => a.id === id)) picked.delete(id);
  const walk = a => `<button class="sb wk" data-walk="${a.id}">산책</button>`;
  const btns = a => a.stroll ? `<small class="onwalk">산책 중 · ${strollLeft(a)} 남음</small>` : tab === 'store'
    ? `<button class="go${fits(G.S, a) ? '' : ' off'}" data-out="${a.id}">${fits(G.S, a) ? '꺼내기' : '자리 없음'}</button>${canSendBack(G.S, a) ? `<button class="sb" data-back="${a.id}">♥+${sendBackHearts(a)}</button>` : ''}${walk(a)}`
    : `<button class="sb" data-in="${a.id}">넣기</button>${walk(a)}`;
  const opt = (v, t, on) => `<option value="${v}"${on ? ' selected' : ''}>${t}</option>`, kinds = [...new Set(all.map(a => a.species))];
  const sel = list.filter(a => picked.has(a.id)), backs = sel.filter(a => canSendBack(G.S, a) && !a.fav), favs = sel.filter(a => a.fav).length;
  el.innerHTML = `<div class="chead"><b>보관함</b><span>${stored.length}마리</span><button class="back${G.S.cards.some(c => c.new) ? ' new' : ''}" data-cards>엽서 ${G.S.cards.length}</button><button class="back" data-close>닫기</button></div>
<div class="ctabs"><button data-tab="store"${tab === 'store' ? ' class="on"' : ''}>보관함 ${stored.length}</button><button data-tab="out"${tab === 'out' ? ' class="on"' : ''}>${h.name} ${out.length}/${capOf(G.S, habId)}</button>
<span class="sorts">${Object.entries(SORTS).map(([k, [nm]]) => `<button data-sort="${k}"${k === sort ? ' class="on"' : ''}>${nm}</button>`).join('')}</span></div>
<div class="sfilt"><span class="seg">${[['all', '전체'], ['baby', '새끼'], ['adult', '성체']].map(([k, t]) => `<button data-stage="${k}"${k === fstage ? ' class="on"' : ''}>${t}</button>`).join('')}</span>
<select data-fsp aria-label="종">${opt('', '모든 종', !fsp)}${kinds.map(s => opt(s, SP[s].name, s === fsp)).join('')}</select>
<select data-frar aria-label="등급">${opt('', '모든 등급', !frar)}${RARITIES.map(r => opt(r.id, r.name, r.id === frar)).join('')}</select>
${tab === 'store' && stored.length ? `<button class="pick${picking ? ' on' : ''}" data-pick>${picking ? '고르기 끝' : '고르기'}</button>` : ''}</div>
<div class="cbody"><div class="srow">${list.map(a => `<div class="cell scell${picked.has(a.id) ? ' picked' : ''}${a.stroll ? ' away' : ''}" data-a="${a.id}" data-r="${variantOf(a.species, a.variant).rarity}"><img alt="${nameOf(a)}">${a.stage === 'baby' ? '<i class="baby">아기</i>' : ''}${picking ? `<b class="tick"></b>${a.fav ? '<i class="sfav">★</i>' : ''}` : `<button class="sfav${a.fav ? ' on' : ''}" data-star="${a.id}" aria-label="아끼는 친구" aria-pressed="${!!a.fav}">${a.fav ? '★' : '☆'}</button>`}<span>${nameOf(a)}</span>${a.hold ? '<small class="hold">성장 멈춤</small>' : ''}${picking ? '' : `<div class="sbtns">${btns(a)}</div>`}</div>`).join('')}</div>
${list.length ? '' : `<p class="cnote">${all.length ? '고른 조건에 맞는 친구가 없어요' : tab === 'store' ? '보관함이 비어 있어요' : '서식지에 나온 친구가 없어요'}</p>`}
<p class="cnote">${h.name}엔 ${capOf(G.S, habId)}마리까지 나와요${roomNote(h) ? ` · ${roomNote(h)}` : ''}</p></div>
${picking && favs ? `<p class="cnote sfavnote">★ 아끼는 친구 ${favs}마리는 돌려보내지 않아요</p>` : ''}${picking ? `<div class="sact"><button data-many="out"${sel.length ? '' : ' disabled'}>서식지로 보내기 ${sel.length || ''}</button><button class="sb" data-many="back"${backs.length ? '' : ' disabled'}>돌려보내기 ${backs.length ? `♥+${backs.reduce((n, a) => n + sendBackHearts(a), 0)}` : ''}</button></div>` : ''}`;
  el.querySelectorAll('.scell img').forEach((img, i) => { const a = list[i]; figureThumb(a.species, a.variant, a.color, a.acc, a.stage).then(u => { img.src = u; }); });
}

// sending back cannot be undone: always asked when several go; one at a time only a legendary or a secret one asks
async function sure(list) {
  const n = list.reduce((s, a) => s + sendBackHearts(a), 0), one = list.length === 1 && nameOf(list[0]);
  if (list.length > 1 && !await ask(`${list.length}마리를 돌려보낼까요? 돌려보내면 되돌릴 수 없어요. (♥+${n})`, '돌려보내기')) return false;
  const favs = list.filter(a => a.fav); // only ever one: several leave them out
  if (favs.length && !await ask(`${one}${josa(one, '은', '는')} 아끼는 친구(★)예요. 그래도 돌려보낼까요?`, '돌려보내기')) return false;
  const top = list.filter(precious);
  if (top.length && !await ask(one ? `${one}${josa(one, '은', '는')} ${top[0].acc ? '시크릿 치장을 한' : rarOf(top[0]).name} 친구예요. 정말 돌려보낼까요?` : `${PRECIOUS}·시크릿 친구 ${top.length}마리가 들어 있어요. 정말 돌려보낼까요?`, '돌려보내기')) return false;
  return true;
}

el.addEventListener('change', e => { const d = e.target.dataset; if (d.fsp != null) fsp = e.target.value; if (d.frar != null) frar = e.target.value; draw(); });
el.addEventListener('click', async e => {
  if (picking) { const c = e.target.closest('.scell:not(.away)'); if (c && !e.target.closest('button')) { const id = +c.dataset.a; picked.has(id) ? picked.delete(id) : picked.add(id); return draw(); } }
  const b = e.target.closest('button'), d = b?.dataset; if (!b) return;
  const a = G.S.animals.find(x => x.id === +(d.out || d.back || d.in || d.star || d.walk)), nm = a && nameOf(a);
  if (d.close != null) el.hidden = true;
  else if (d.cards != null) openCards();
  else if (d.walk) pickStroll(a);
  else if (d.tab) { tab = d.tab; picking = false; picked.clear(); fsp = ''; draw(); }
  else if (d.sort) { sort = d.sort; draw(); }
  else if (d.stage) { fstage = d.stage; draw(); }
  else if (d.pick != null) { picking = !picking; picked.clear(); draw(); }
  else if (d.many === 'out') {
    let ok = 0; const left = [];
    for (const id of picked) { const x = G.S.animals.find(y => y.id === id); if (x && G.unstore(id)) { ok++; if (hab && habitatOf(x) === habId) hab.drop(x); } else if (x) left.push(x); }
    picked.clear(); picking = false; draw();
    toast(`${ok}마리를 서식지로 보냈어요${left.length ? ` · ${left.length}마리는 ${whyNot(left[0]).split(' · ')[0]}` : ''}`, 3200);
  } else if (d.many === 'back') {
    const list = [...picked].map(id => G.S.animals.find(y => y.id === id)).filter(x => x && canSendBack(G.S, x) && !x.fav);
    if (!list.length || !await sure(list)) return;
    let n = 0; for (const x of list) n += G.sendBack(x.id);
    heart(e.clientX, e.clientY); picked.clear(); picking = false; draw(); toast(`${list.length}마리를 돌려보냈어요 · ♥+${n}`);
  }
  else if (d.out) { if (!G.unstore(a.id)) return toast(whyNot(a), 3200); if (hab && habitatOf(a) === habId) hab.drop(a); toast(`${nm}${josa(nm, '이', '가')} ${HAB[habitatOf(a)].name}에 나왔어요`); }
  else if (d.star) { G.setFav(a.id, !a.fav); toast(a.fav ? `${nm}${josa(nm, '은', '는')} 아끼는 친구예요 · 여러 마리 돌려보내기에서 빠져요` : `${nm}의 별을 뗐어요`, 2600); }
  else if (d.back) { if ((precious(a) || a.fav) && !await sure([a])) return; const n = G.sendBack(a.id); if (n) { heart(e.clientX, e.clientY); toast(`${nm}${josa(nm, '을', '를')} 돌려보냈어요 · ♥+${n}`); } }
  else if (d.in && G.store(a.id)) toast(`${nm}${josa(nm, '을', '를')} 보관함에 넣었어요`);
});
