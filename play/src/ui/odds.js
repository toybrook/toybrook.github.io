// 177 C 확률표: what an egg can give, from the same tables the game rolls with (rules.oddsInfo / eggTable, the save's placed
// props counted). Opened from the nest's 「확률」 button for the tab's egg type. oddsList() is plain data (check-eggs
// compares it with the tables); openOdds() puts it on screen with textContent only.
import { $t } from '../i18n/i18n.js';
import { BALANCE as B } from '../game/data.js';
import { EGG, oddsInfo } from '../game/rules.js';

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
    $t('시크릿 치장: 모든 부화에 {0} · 치장 {1}가지 각 {2}', pct(o.secret.chance), o.secret.accessories.length, pct(o.secret.accessories[0]?.p || 0)),
    $t('색은 변종이 정해진 뒤 따로 골라요(변종 줄을 열면 보여요)'),
    $t('놓아 둔 소품이 끌어당기는 동물은 몫이 커져요 · 이 표는 지금 놓은 소품을 반영했어요'),
    $t('선물 알은 등급이 정해져 있고, 아직 없는 변종부터 고르게 나와요'),
  ];
  return { title: $t('{0} 확률', EGG[type].name), rarities, gauges, notes, secret: B.secret.chance };
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
  const b = h('div', null, 'nbtns'), c = h('button', $t('닫기'), 'go'); c.dataset.close = ''; c.onclick = () => { el.hidden = true; };
  b.append(c); box.append(b);
  el.replaceChildren(box); el.hidden = false;
}
