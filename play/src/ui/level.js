// 23-1 정원사 레벨: the Lv pill in the habitat bar (tap: the level sheet), and the small card when the level goes up
// ("레벨 6! 새로 풀린 것: 풍차"). The XP and what each level opens are BALANCE.level; rules.js keeps S.xp / S.lv.
// 23-2: 도전 과제 (game/achieve.js) from the level sheet: the list with each one's progress; a done one's 칭호 is put on by a tap
// (shown under the level). A toast when one is done.
import * as G from '../game/game.js';
import { BALANCE as B, SETS, BRUSHES } from '../game/data.js';
import { PROP, HAB, xpAt, unlocksBetween } from '../game/rules.js';
import { overlayOpen, topWindow, tip, toast } from './hud.js';
import { ACH, ACH_BY } from '../game/achieve.js';
import { sfx } from './sound.js';
const propThumb = (...a) => import('./thumbs.js').then(m => m.propThumb(...a)); // 26-1: three.js comes after the first screen

const $ = id => document.getElementById(id);
// an unlock key in words: [name, what it is, the props to show]
export function unlockText(k) {
  const [kind, id] = k.split(':'), where = P => P.habitat ? ` · ${HAB[P.habitat].name}` : '';
  if (kind === 'set') { const s = SETS.find(s => s.id === id); return [`${s.name} 세트`, s.props.map(p => PROP[p].name).join(' · ') + where(PROP[s.props[0]]), s.props]; }
  if (kind === 'prop') return [PROP[id].name, '큰 소품' + where(PROP[id]), [id]];
  if (kind === 'brush') { const b = BRUSHES.find(b => b.id === id); return [`${b.name} 붓`, '땅 칠하기', [], b.c]; }
  return [`땅 넓히기 ${id}단계`, `하트 ${B.expand.price[id - 1]}개로 살 수 있어요`, []];
}

export function initLevel(getApi) {
  const stage = $('stage'), pill = document.createElement('button');
  pill.className = 'pill lvl'; pill.id = 'lvPill'; pill.setAttribute('aria-label', '정원사 레벨');
  pill.innerHTML = '<b></b><i><s></s></i>'; $('hearts').after(pill);
  const sheet = mk('lvSheet', 'intro pop lvs', '정원사 레벨'), card = mk('lvup', 'intro pop lvup', '레벨이 올랐어요'), achs = mk('achSheet', 'intro pop lvs ach', '도전 과제');
  function mk(id, cls, label) { const el = document.createElement('section'); el.id = id; el.className = cls; el.hidden = true; el.setAttribute('aria-label', label); stage.append(el); return el; }
  const part = L => { const a = xpAt(L), b = xpAt(L + 1); return [G.S.xp - a, b - a]; };
  function draw() { const L = G.S.lv, [x, n] = part(L); pill.firstChild.textContent = `Lv ${L}`; pill.querySelector('s').style.width = Math.min(100, x / n * 100) + '%'; }

  // 26-10: on the world map (no habitat built yet) the props' looks come from their module, as every habitat's do
  const model = () => getApi()?.decor.model ?? import('../habitat/meadow/props.js').then(m => m.decorModel);
  const thumbs = root => root.querySelectorAll('img[data-p]').forEach(async img => { try { img.src = await propThumb(img.dataset.p, await model()); } catch { img.remove(); } });
  const row = (k, img) => { const [a, b, ps, c] = unlockText(k);
    return `<li>${c ? `<i class="sw" style="background:${c}"></i>` : ''}${img ? ps.map(p => `<img alt="" data-p="${p}">`).join('') : ''}<span><b>${a}</b><small>${b}</small></span></li>`; };

  const done = () => ACH.filter(a => G.S.ach?.[a.id]).length;
  pill.onclick = () => {
    const L = G.S.lv, [x, n] = part(L), X = B.level.xp, road = Object.entries(B.level.unlock), T = ACH_BY[G.S.title];
    sheet.innerHTML = `<div><h2>정원사 레벨 ${L}</h2>${T ? `<p class="ttl">「${T.title}」</p>` : ''}<p class="bar"><i style="width:${Math.min(100, x / n * 100)}%"></i></p><p class="sub">다음 레벨까지 ${n - x} XP · 모은 XP ${G.S.xp}</p>
<h3>XP를 받는 것</h3><ul class="src"><li>도감에 새 칸<b>+${X.codex}</b></li><li>새끼가 다 자라면<b>+${X.grown}</b></li><li>쓰다듬기 (하루 ${X.petDaily}번까지)<b>+${X.pet}</b></li><li>하루 첫 방문<b>+${X.login}</b></li><li>도전 과제 하나<b>+${X.achieve}</b></li></ul>
<button class="achBtn" data-ach>도전 과제 ${done()}/${ACH.length} · 칭호 고르기</button>
<h3>레벨마다 풀리는 것</h3><ol class="road">${road.map(([l, list]) => `<li class="${+l <= L ? 'done' : +l === L + 1 ? 'next' : ''}"><em>Lv ${l}</em><span>${list.map(k => unlockText(k)[0]).join(', ')}</span></li>`).join('')}
<li class="${L > road.length ? 'done' : ''}"><em>그 뒤</em><span>${B.level.after} XP마다 레벨이 올라요</span></li></ol>
<p class="sub">하트로 사는 가격은 그대로예요. 레벨은 살 수 있는 자격이에요. 서식지는 도감으로 열려요.</p><button data-close>닫기</button></div>`;
    sheet.querySelector('[data-close]').onclick = () => { sheet.hidden = true; };
    sheet.querySelector('[data-ach]').onclick = () => { sheet.hidden = true; list(); };
    sheet.hidden = false;
    // the next level in the middle of its list: scroll only the list (scrollIntoView also moved the whole screen up, its top cut off)
    const rd = sheet.querySelector('.road'), nx = rd.querySelector('.next');
    if (nx) rd.scrollTop += nx.getBoundingClientRect().top - rd.getBoundingClientRect().top - (rd.clientHeight - nx.offsetHeight) / 2;
  };

  function list() {
    const S = G.S;
    achs.innerHTML = `<div><h2>도전 과제</h2><p class="sub">${done()}/${ACH.length} 이룸 · 하나마다 XP +${B.level.xp.achieve}와 칭호 · 이룬 것을 누르면 그 칭호를 달아요</p><ul class="achl">${ACH.map(a => {
      const ok = S.ach?.[a.id], v = Math.min(a.n, a.v(S)), on = S.title === a.id;
      return `<li class="${ok ? 'done' : ''}${on ? ' on' : ''}"${ok ? ` data-t="${a.id}"` : ''}><b>「${a.title}」</b><em>${on ? '달고 있음' : ok ? '✓' : `${v}/${a.n}`}</em><small>${a.text}</small>${ok ? '' : `<i><s style="width:${v / a.n * 100}%"></s></i>`}</li>`; }).join('')}</ul>
<p class="btns"><button data-back>정원사 레벨</button><button data-close>닫기</button></p></div>`;
    achs.querySelector('[data-close]').onclick = () => { achs.hidden = true; };
    achs.querySelector('[data-back]').onclick = () => { achs.hidden = true; pill.onclick(); };
    achs.querySelectorAll('[data-t]').forEach(li => { li.onclick = () => { const y = achs.querySelector('ul').scrollTop; G.setTitle(S.title === li.dataset.t ? null : li.dataset.t); list(); achs.querySelector('ul').scrollTop = y; }; });
    achs.hidden = false;
  }

  // level events wait for the screen to be free (a hatch reveal, the grown card, the away sheet...), several merged into one card.
  // 41 D: and for GAP after the last card (flags.lvCard), so a quick first day gets one card for the levels in between; one
  // not shown before the page closed comes on the next visit (from lvCard.lv)
  const GAP = 15 * 60e3, C = G.S.flags.lvCard;
  let pend = Number.isInteger(C?.lv) && C.lv < G.S.lv ? { from: C.lv, level: G.S.lv } : null, got = []; // got: 도전 과제 done, told by one toast when the screen is free
  function events(ev) {
    draw();
    if (ev.some(e => e.type === 'reset')) { pend = null; got = []; card.hidden = true; }
    got.push(...ev.filter(e => e.type === 'achieve').map(e => ACH_BY[e.id]).filter(Boolean));
    for (const e of ev) if (e.type === 'level') pend = { from: pend?.from ?? e.from, level: e.level };
  }
  function show() {
    if (topWindow() || overlayOpen() || document.body.classList.contains('photo')) return;
    const xa = B.level.xp.achieve;
    if (got.length === 1) toast(`도전 과제 「${got[0].title}」 · ${got[0].text} · XP +${xa}`, 3200);
    else if (got.length) toast(`도전 과제 ${got.length}개를 이뤘어요 · XP +${got.length * xa} · 위의 Lv에서 볼 수 있어요`, 3200);
    got = [];
    const since = G.now() - (G.S.flags.lvCard?.at || 0); // a clock set back (since < 0) does not hold the card
    if (!pend || !card.hidden || (since >= 0 && since < GAP)) return;
    const { level } = pend, unlocks = unlocksBetween(pend.from, level); pend = null; G.flag('lvCard', { lv: level, at: G.now() });
    card.innerHTML = `<div><h2>레벨 ${level}!</h2>${unlocks.length ? `<p class="sub">새로 풀린 것</p><ul>${unlocks.map(k => row(k, true)).join('')}</ul>` : '<p class="sub">정원사 레벨이 올랐어요</p>'}<button data-close>좋아요</button></div>`;
    thumbs(card);
    card.querySelector('[data-close]').onclick = () => { card.hidden = true; tip('level', '#lvPill'); };
    card.hidden = false; sfx('level');
  }
  setInterval(show, 800);
  G.on(events); draw();
  return { events };
}
