// 177 C 확률표: what an egg can give, from the same tables the game rolls with (rules.oddsInfo / eggTable, the save's placed
// props counted). Opened from the nest's 「확률」 button for the tab's egg type. oddsList() is plain data (check-eggs
// compares it with the tables); openOdds() puts it on screen with textContent only.
import { $t } from '../i18n/i18n.js';
import { BALANCE as B, G190 } from '../game/data.js';
import { EGG, oddsInfo } from '../game/rules.js';
// <sec263>
import { SEC263, SEC263_P, SEC263_CELLS } from '../game/data.js'; import { SERIES } from '../game/series.js'; // 263 B · 267 B the series secret (trial flag)
// </sec263>

export const pct = p => (p * 100).toFixed(p < 0.01 ? 3 : 2).replace(/\.?0+$/, '') + '%';

// { title, rarities: [{ name, p, rows: [{ name, p, colors }] }], gauges: [line], notes: [line] } (p: the number shown, as text)
export function oddsList(type, S) {
  const o = oddsInfo(type, S), [, ...full] = o.segments;
  const rarities = o.base.map(r => ({ id: r.rarity.id, name: r.rarity.name, p: pct(r.p), v: r.p,
    rows: r.variants.map(v => ({ name: `${v.species.name} · ${v.variant.name}`, p: pct(v.p), v: v.p,
      colors: v.colors.length > 1 ? v.colors.map(c => `${c.color.name} ${pct(c.p)}`).join(' · ') : '' })) }));
  const gauges = full.map(s => $t('{0} 조각 {1}개가 차면 다음 알: {2} · 아직 없는 {3}부터', s.when.name, s.target,
    s.odds.map(x => `${x.rarity.name} ${pct(x.p)}`).join(' · '), s.when.name));
  const notes = [
    $t('알마다 조각이 하나씩 쌓이고, 그 등급 이상이 나오면 0으로 돌아가요'),
    ...o.guard.map(g => $t('{0}{이/가} 나오면 아직 없는 {1}부터 나와요(그 안에서는 위 비율대로)', g.rarity.name, g.rarity.name)),
    $t('치장: 모든 부화에 {0} · 치장 {1}가지 각 {2}', pct(o.secret.chance), o.secret.accessories.length, pct(o.secret.accessories[0]?.p || 0)),
    $t('색은 변종이 정해진 뒤 따로 골라요(변종 줄을 열면 보여요)'),
    ...G190 ? [$t('흔들어 보기는 결과를 바꾸지 않아요 · 부화할 때 나올 것을 미리 들려줄 뿐이에요'), $t('소품이 물어온 알도 이 둥지의 확률을 그대로 따라요 · 소품은 어떤 동물 무리인지만 좁혀요')] // 199 B-11: ?g190 has no hidden pull (BALANCE.attract off)
      : [$t('놓아 둔 소품이 끌어당기는 동물은 몫이 커져요 · 이 표는 지금 놓은 소품을 반영했어요')],
    $t('선물 알은 등급이 정해져 있고, 아직 없는 변종부터 고르게 나와요'),
  ];
  let sec = [];
  // <sec263> 263 B 5절 · 267 B ⑧: the series secret, a table of its own after the nest's (which stays as it is), for a series' egg only.
  // per egg = (the series cells' share of this egg's table, the props placed counted) × SEC263_P
  if (SEC263) sec = SERIES.filter(s => s.egg === type && SEC263_CELLS[s.id]).map(s => {
    const cell = o.base.reduce((n, r) => n + r.variants.reduce((m, v) => m + (s.cells.includes(v.species.id + ':' + v.variant.id) ? v.p : 0), 0), 0);
    return { title: $t('시리즈 시크릿'), cell, each: cell * SEC263_P, rows: [
      [$t('언제 굴리나요'), $t('이 둥지 알에서 「{0}」 칸 동물이 나왔을 때만', s.name)], [$t('그 동물이 시크릿으로 바뀔 확률'), pct(SEC263_P)],
      [$t('알 1개당'), $t('{0} (칸 동물 {1} × {2})', pct(cell * SEC263_P), pct(cell), pct(SEC263_P))],
      [$t('굴리지 않는 알'), $t('선물 알 모두 · 교환 도장 알')], [$t('가진 뒤에도'), $t('계속 굴려요 · 겹치면 판매 · 분해가 두 배')], [$t('등급 · 조각 천장'), $t('바뀌지 않아요 (위 표 그대로)')]] }; });
  // </sec263>
  return { title: $t('{0} 확률', EGG[type].name), rarities, gauges, notes, secret: B.secret.chance, ...sec.length && { sec } };
}

export function openOdds(type, S) {
  const L = oddsList(type, S), el = document.getElementById('oddsSheet');
  const h = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const row = (a, b, cls) => { const tr = h('tr', null, cls); tr.append(h('td', a), h('td', b)); return tr; };
  const box = h('div'), top = h('table', null, 'skodds');
  for (const r of L.rarities) top.append(row(r.name, r.p));
  box.append(h('h2', L.title), top, h('b', $t('등급 안에서 나오는 동물'), 'vhd'));
  for (const r of L.rarities) {
    const d = h('details'), t = h('table', null, 'skodds');
    d.append(h('summary', `${r.name} ${r.p}`));
    for (const x of r.rows) { t.append(row(x.name, x.p)); if (x.colors) t.append(row('', x.colors, 'cc')); }
    d.append(t); box.append(d);
  }
  box.append(h('b', $t('조각 천장'), 'vhd'));
  for (const g of L.gauges) box.append(h('p', g, 'note'));
  for (const n of L.notes) box.append(h('p', n, 'note'));
  for (const x of L.sec || []) { const t = h('table', null, 'skodds'); for (const [a, b] of x.rows) t.append(row(a, b)); box.append(h('b', x.title, 'vhd'), t); } // 263 B (empty without the trial)
  const b = h('div', null, 'nbtns'), c = h('button', $t('닫기'), 'go'); c.dataset.close = ''; c.onclick = () => { el.hidden = true; };
  b.append(c); box.append(b);
  el.replaceChildren(box); el.hidden = false;
}
