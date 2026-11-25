// 23-1 정원사 레벨: the Lv pill in the habitat bar (tap: the level sheet), and the small card when the level goes up
// ("레벨 6! 새로 풀린 것: 풍차"). The XP and what each level opens are BALANCE.level; rules.js keeps S.xp / S.lv.
// 23-2: 도전 과제 (game/achieve.js) from the level sheet: the list with each one's progress; (74: 칭호 hidden)
// (shown under the level). A toast when one is done.
import { $t } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { BALANCE as B, SETS, BRUSHES, G190 } from '../game/data.js';
import { PROP, HAB, xpAt, unlocksBetween, growStage, slotsAt } from '../game/rules.js';
import { GUESTS } from '../game/guests-data.js';
import { overlayOpen, topWindow, tip, toast, resting } from './hud.js';
import { ACH, ACH_BY } from '../game/achieve.js';
import { sfx } from './sound.js';
const propThumb = (...a) => import('./thumbs.js').then(m => m.propThumb(...a)); // 26-1: three.js comes after the first screen

const $ = id => document.getElementById(id);
// an unlock key in words: [name, what it is, the props to show]
export function unlockText(k) {
  const [kind, id] = k.split(':'), where = P => P.habitat ? ` · ${HAB[P.habitat].name}` : '';
  if (kind === 'set') { const s = SETS.find(s => s.id === id); return [G190 ? $t('{0} 테마', s.name) : $t('{0} 세트', s.name), s.props.map(p => PROP[p].name).join(' · ') + where(PROP[s.props[0]]), s.props]; }
  if (kind === 'prop') return [PROP[id].name, $t('큰 소품') + where(PROP[id]), [id]];
  if (kind === 'brush') { const b = BRUSHES.find(b => b.id === id); return [$t('{0} 붓', b.name), $t('땅 칠하기'), [], b.c]; }
  return [$t('땅 넓히기 {0}단계', id), $t('하트 {0}개로 살 수 있어요', B.expand.price[id - 1]), []];
}

export function initLevel(getApi) {
  const stage = $('stage'), pill = document.createElement('button');
  pill.className = 'pill lvl'; pill.id = 'lvPill'; pill.setAttribute('aria-label', $t('레벨'));
  pill.innerHTML = '<b></b><i><s></s></i>'; $('hearts').after(pill);
  if (document.documentElement.dataset.ui187) { const t = document.createElement('span'); t.className = 'btag'; t.setAttribute('aria-hidden', 'true'); t.textContent = 'BETA'; pill.after(t); } // 202 B-1 (?rc200): BETA a small tag by Lv (the floating one stays on the world map)
  const sheet = mk('lvSheet', 'intro pop lvs', $t('레벨')), card = mk('lvup', 'intro pop lvup', $t('레벨이 올랐어요')), achs = mk('achSheet', 'intro pop lvs ach', $t('업적'));
  function mk(id, cls, label) { const el = document.createElement('section'); el.id = id; el.className = cls; el.hidden = true; el.setAttribute('aria-label', label); stage.append(el); return el; }
  const part = L => { const a = xpAt(L), b = xpAt(L + 1); return [G.S.xp - a, b - a]; };
  function draw() { const L = G.S.lv, [x, n] = part(L); pill.firstChild.textContent = `Lv ${L}`; pill.querySelector('s').style.width = Math.min(100, x / n * 100) + '%'; }

  // 26-10: on the world map (no habitat built yet) the props' looks come from their module, as every habitat's do
  const model = () => getApi()?.decor.model ?? import('../habitat/meadow/props.js').then(m => m.decorModel);
  const thumbs = root => root.querySelectorAll('img[data-p]').forEach(async img => { try { img.src = await propThumb(img.dataset.p, await model()); } catch { img.remove(); } });
  const row = (k, img) => { const [a, b, ps, c] = unlockText(k);
    return `<li>${c ? `<i class="sw" style="background:${c}"></i>` : ''}${img ? ps.map(p => `<img alt="" data-p="${p}">`).join('') : ''}<span><b>${a}</b><small>${b}</small></span></li>`; };

  const done = () => ACH.filter(a => G.S.ach?.[a.id]).length;
  const items = S => ACH.map(a => {
    const ok = S.ach?.[a.id], v = Math.min(a.n, a.v(S)); // 74: 칭호 hidden (S.title stays in saves, shown nowhere)
    return `<li class="${ok ? 'done' : ''}"><b>「${a.title}」</b><em>${ok ? '✓' : `${v}/${a.n}`}</em><small>${a.text}</small>${ok ? '' : `<i><s style="width:${v / a.n * 100}%"></s></i>`}</li>`; }).join('');
  pill.onclick = () => {
    const L = G.S.lv, [x, n] = part(L), X = B.level.xp, road = Object.entries(B.level.unlock);
    sheet.innerHTML = $t('<div><h2>레벨 {0}</h2><p class="bar"><i style="width:{1}%"></i></p><p class="sub">다음 레벨까지 {2} XP · 모은 XP {3}</p>\n<h3>XP를 받는 것</h3><ul class="src"><li>도감에 새 칸<b>+{4}</b></li><li>유체가 성체가 되면<b>+{5}</b></li><li>쓰다듬기 (하루 {6}번까지)<b>+{7}</b></li><li>하루 첫 방문<b>+{8}</b></li><li>업적 하나<b>+{9}</b></li></ul>\n<button class="achBtn" data-ach>업적 {10}/{11}</button>\n<h3>레벨마다 풀리는 것</h3><ol class="road">{12}\n<li class="{13}"><em>그 뒤</em><span>{14} XP마다 레벨이 올라요</span></li></ol>\n<p class="sub">하트로 사는 가격은 그대로예요. 레벨은 살 수 있는 자격이에요. 서식지는 도감으로 열려요.</p><button data-close>닫기</button></div>', L, Math.min(100, x / n * 100), n - x, G.S.xp, X.codex, X.grown, X.petDaily, X.pet, X.login, X.achieve, done(), ACH.length, road.map(([l, list]) => `<li class="${+l <= L ? 'done' : +l === L + 1 ? 'next' : ''}"><em>Lv ${l}</em><span>${list.map(k => unlockText(k)[0]).join(', ')}</span></li>`).join(''), L > road.length ? 'done' : '', B.level.after);
    sheet.querySelector('[data-close]').onclick = () => { sheet.hidden = true; };
    if (G190) { sheet.querySelector('h2').textContent = $t('수집가 등급 {0}', L); sheet.classList.add('ach'); // 203 D5 ?g190: the 업적 list inside the 수집가 등급 sheet (no sheet of its own)
      sheet.querySelector('[data-ach]').outerHTML = $t('<h3>업적 <small>{0}/{1} 달성 · 하나마다 XP +{2}</small></h3>', done(), ACH.length, B.level.xp.achieve) + `<ul class="achl">${items(G.S)}</ul>`; }
    else sheet.querySelector('[data-ach]').onclick = () => { sheet.hidden = true; list(); };
    sheet.hidden = false;
    // the next level in the middle of its list: scroll only the list (scrollIntoView also moved the whole screen up, its top cut off)
    const rd = sheet.querySelector('.road'), nx = rd.querySelector('.next');
    if (nx) rd.scrollTop += nx.getBoundingClientRect().top - rd.getBoundingClientRect().top - (rd.clientHeight - nx.offsetHeight) / 2;
  };

  function list() {
    achs.innerHTML = $t('<div><h2>업적</h2><p class="sub">{0}/{1} 달성 · 하나마다 XP +{2}</p><ul class="achl">{3}</ul>\n<p class="btns"><button data-back>레벨</button><button data-close>닫기</button></p></div>', done(), ACH.length, B.level.xp.achieve, items(G.S));
    achs.querySelector('[data-close]').onclick = () => { achs.hidden = true; };
    achs.querySelector('[data-back]').onclick = () => { achs.hidden = true; pill.onclick(); };
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
    if (topWindow() || overlayOpen() || document.body.classList.contains('photo') || document.body.classList.contains('skyview')) return; // 16-2: not over the sky
    const onMap = !$('world').classList.contains('hidden') || !$('loading').hidden; // inbox 43: a card left from the last visit waits for the habitat (on the map it would eat the 초원 tap)
    const xa = B.level.xp.achieve;
    if (got.length === 1) toast($t('업적 「{0}」 · {1} · XP +{2}', got[0].title, got[0].text, xa), 3200);
    else if (got.length) toast($t('업적 {0}개를 달성했어요 · XP +{1} · 위의 Lv에서 볼 수 있어요', got.length, got.length * xa), 3200);
    got = [];
    const since = G.now() - (G.S.flags.lvCard?.at || 0); // a clock set back (since < 0) does not hold the card
    if (!pend || !card.hidden || (since >= 0 && since < GAP) || onMap || resting()) return; // inbox 43
    const { level, from } = pend, unlocks = unlocksBetween(from, level); pend = null; G.flag('lvCard', { lv: level, at: G.now() });
    // 66-2 명성 (this Lv): a 땅 넓히기 Lv also grows the habitats a step (habitat.js grow), and new guests start to come
    const grew = growStage(level) > growStage(from), news = GUESTS.filter(R => R.lv > from && R.lv <= level && !R.when && G.S.unlocked.includes(R.hab)).map(R => R.name);
    card.innerHTML = $t('<div><h2>레벨 {0}!</h2>{1}{2}{3}{4}<button data-close>좋아요</button></div>', level, unlocks.length ? $t('<p class="sub">새로 풀린 것</p><ul>{0}</ul>', unlocks.map(k => row(k, true)).join('')) : $t('<p class="sub">레벨이 올랐어요</p>'), slotsAt(level) > slotsAt(from) ? $t('<p class="sub">부화 칸 +{0}</p>', slotsAt(level) - slotsAt(from)) : '', grew ? $t('<p class="sub">소문이 나서 서식지에 들꽃 무더기와 오솔길이 생겼어요</p>') : '', news.length ? $t('<p class="sub">새 손님이 찾아오기 시작해요 · {0}</p>', news.join(', ')) : '');
    thumbs(card);
    card.querySelector('[data-close]').onclick = () => { card.hidden = true; tip('level', '#lvPill'); };
    card.hidden = false; sfx('level');
  }
  setInterval(show, 800);
  G.on(events); draw();
  return { events };
}
