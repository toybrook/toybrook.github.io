// Nest menu: a bottom sheet over the habitat (the habitat itself is only for watching). Top: this habitat's eggs,
// a tab per egg type. Middle: the shard gauges (BALANCE.pity). Bottom: the hatch slots. A ready slot hatches on a
// small 3D stage inside the sheet, then the reveal card: out into the habitat (always offered), or back for hearts
// (only a variant already in the codex). The hatched animal stays `pending` until the card is answered.
import { $t } from '../i18n/i18n.js';
import * as THREE from 'three';
import * as G from '../game/game.js';
import { BALANCE as B, ACCESSORIES, HABITATS, G190, PROPS } from '../game/data.js';
import { serOf, have as serHave, brkStamps, SOUND, collNo } from '../game/series.js'; // 199 B-11 ?g190
// <sec263>
import { SEC263 } from '../game/data.js'; import { SERIES } from '../game/series.js'; // 263 B · 267 B the series secret (trial flag)
// the series secret's look (kept here, not in style.css; since 0.87.1 the <sec263> blocks ship, the cow secret on)
if (SEC263 && typeof document !== 'undefined') document.head.append(Object.assign(document.createElement('style'), { textContent:
  '.nstage.sec263{box-shadow:inset 0 0 0 3px #ffd24a,inset 0 0 60px rgba(255,210,74,.45)}.nstage.sec263 .nglow{background:radial-gradient(circle at 50% 54%,rgba(255,236,160,.9) 0 10%,rgba(255,200,60,.55) 24%,transparent 52%)}' +
  '.ncard .secstamp{display:inline-block;transform:rotate(-6deg);font-weight:800;color:#fff;background:linear-gradient(135deg,#f6c445,#d99a12);border:2px solid #fff3b0;border-radius:8px;padding:2px 10px;box-shadow:0 1px 4px rgba(150,100,0,.4)}' +
  '.ncard .secno{margin:2px 0 0;font-size:calc(30px*var(--fs));font-weight:800;line-height:1.1;color:#c48a0c;letter-spacing:.02em}.ncard .secser{margin-top:0}' }));
// </sec263>
import { SP, RAR, HAB, EGG, RANK, pityOf, variantOf, colorOf, shards, isNew, canSendBack, sendBackHearts, fits, habitatOf, key, eggGap, kindName, canLetGo } from '../game/rules.js';
import { toast, hideToast, heart, clock, span, josa, tip, ask } from './hud.js';
import { eggThumb, studio } from './thumbs.js';
import { makeEgg, HATCH, glowAt } from '../animals/growth.js';
import { dress, loadModel, loadAcc } from '../animals/figure.js';
import { eggMat } from '../animals/materials.js';
import { sfx, cry } from './sound.js';
import { calm, TOSS } from '../config.js';
import { openOdds } from './odds.js';

const $ = id => document.getElementById(id);
const nameOf = kindName;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RC201 = !!document.documentElement.dataset.ui187; // 202 B (?rc200 다듬기): the nest's 20 places and the gauges' bars
const gaugesOf = type => Object.keys(pityOf(type)).sort((a, b) => RANK[a] - RANK[b]); // 75: each egg kind its own
// the habitat an egg type comes from (the hatch slots are shared, so a pond egg can hatch in the meadow)
const eggHome = type => HABITATS.find(h => h.nest === type);

// gauge (styled inline: it is cloned out of the sheet when it flies): an egg outline filled from the bottom with shell pieces (a jittered triangle mosaic, the same every time)
const EGG_D = 'M2 46A28 44 0 0 1 58 46A28 28 0 0 1 2 46Z';
const PIECES = (() => {
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, st = 7.5;
  const P = Array.from({ length: 11 }, (_, j) => Array.from({ length: 9 }, (_, i) => [i * st + (i % 8 ? (rnd() - 0.5) * 3.5 : 0), j * st + (j % 10 ? (rnd() - 0.5) * 3.5 : 0)]));
  const out = [];
  for (let j = 0; j < 10; j++) for (let i = 0; i < 8; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i], d = P[j + 1][i + 1];
    for (const t of (i + j) % 2 ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]]) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      if (((cx - 30) / 28) ** 2 + ((cy - 46) / (cy < 46 ? 44 : 28)) ** 2 < 1.05) out.push({ pts: t.map(p => p.map(v => v.toFixed(1)).join(',')).join(' '), y: cy + rnd() * 6, l: 48 + rnd() * 16 });
    }
  }
  return out.sort((p, q) => q.y - p.y); // bottom first
})();
// 69-1 천장 눈금: the egg stands on a little base with TICKS marks, one lit per target / TICKS eggs (30: every 5, 180: every 30)
const TICKS = 6;
const gaugeSvg = (k, have, target) => {
  const n = have >= target ? PIECES.length : Math.min(PIECES.length - 1, Math.ceil(have / target * PIECES.length)), on = Math.min(TICKS, Math.floor(have / target * TICKS));
  return `<svg viewBox="0 0 60 88" aria-hidden="true"><defs><clipPath id="gc-${k}"><path d="${EGG_D}"/></clipPath></defs><g clip-path="url(#gc-${k})" stroke="#fbf1e1" stroke-width=".7">
${PIECES.map((p, i) => `<polygon points="${p.pts}" ${i < n ? `fill="hsl(${RAR[k].hue} ${RAR[k].sat}% ${p.l}%)"` : 'fill="#efdfc4"'}/>`).join('')}</g><path d="${EGG_D}" fill="none" stroke="#b08a5e" stroke-width="1.8"/>
<path class="gbase" d="M12 75.5H48L53 85.5H7Z" fill="#e8d2ad" stroke="#b08a5e" stroke-width="1.4" stroke-linejoin="round"/>${Array.from({ length: TICKS }, (_, i) => `<rect x="${10.6 + i * 6.8}" y="78.6" width="5" height="4" rx="1" fill="${i < on ? `hsl(${RAR[k].hue} ${RAR[k].sat}% 52%)` : '#fbf1e1'}"/>`).join('')}</svg>`;
};

export function initNest(nav) {
  const el = $('nest'), btn = $('nestBtn'), badge = btn.querySelector('i');
  el.innerHTML = $t('<div class="nsheet" role="dialog" aria-label="둥지">\n  <div class="chead"><b>둥지</b><span id="ncount"></span><button class="back" data-odds>확률</button><button class="back" data-tidy>정리</button><button class="back" data-close>닫기</button></div>\n  <div class="ngift" id="ngift" hidden></div>\n  <div class="ctabs" id="ntabs"></div>\n  <div class="ntop"><div class="neggs" id="neggs"></div><div class="nstage" id="nstage" hidden></div></div>\n  <div class="nlow"><div class="ngauges" id="ngauges"></div><div class="nslots" id="nslots"></div><div class="ncard" id="ncard" hidden></div></div>\n</div>');
  if (G190) $('ngift').insertAdjacentHTML('afterend', '<div class="ngift nfetch" id="nfetch" hidden></div>'); // 199 B-11 물어온 알
  const eggsEl = $('neggs'), giftEl = $('ngift'), tidyBtn = el.querySelector('[data-tidy]'), stageEl = $('nstage'), gEl = $('ngauges'), slotsEl = $('nslots'), cardEl = $('ncard'), tabsEl = $('ntabs');
  let sel = null, habId = null, hab = null, tab = null, busy = false, shown = null, run = 0, sig = {}, after = null, ready = null;
  const nest = () => G.S.nests[habId] || { eggs: [], t: G.now() };
  const pending = () => G.S.animals.find(a => a.pending);

  // ---- drawing (rebuilt only when what it shows changed; the timers every tick)
  function drawBtn() {
    const n = habId ? nest().eggs.length : 0, now = G.now();
    badge.textContent = n; badge.hidden = !n;
    btn.classList.toggle('ready', G.S.slots.some(s => s && now >= s.end) || !!pending());
    btn.ariaLabel = $t('둥지: 알 {0}개', n);
  }
  const once = (k, v, f) => { if (sig[k] !== v) { sig[k] = v; f(); } };
  function draw() {
    drawBtn(); if (el.hidden) return;
    const now = G.now(), n = nest(), types = [...new Set([HAB[habId].nest, ...n.eggs.map(e => e.type)])].filter(Boolean);
    if (!types.includes(tab)) tab = types[0];
    $('ncount').textContent = $t('알 {0}/{1}', n.eggs.length, B.nest.max);
    once('tabs', types.join() + tab, () => { tabsEl.innerHTML = types.map(t => `<button data-tab="${t}"${t === tab ? ' class="on"' : ''}>${EGG[t].name}</button>`).join(''); });
    const mine = n.eggs.filter(e => e.type === tab).sort((a, b) => !!b.now - !!a.now), d2 = G.S.flags.week1 && G.S.attend.n === 1 && habId === HABITATS[0].id; // 93-1: tomorrow's legendary egg, locked
    if (sel && !n.eggs.some(canLetGo)) sel = null;
    tidyBtn.hidden = !n.eggs.some(canLetGo); tidyBtn.classList.toggle('on', !!sel); eggsEl.classList.toggle('tidy', !!sel);
    const ph = RC201 ? Math.max(0, B.nest.max - n.eggs.length - (d2 ? 1 : 0)) : 0; // 202 B-6 (?rc200): the nest's free room as dashed empty places
    once('eggs', mine.map(e => e.id).join() + tab + d2 + !!sel + ph, () => {
      eggsEl.innerHTML = `<div class="ngrid">${mine.map(e => $t('<button class="negg{0}" data-id="{1}" aria-label="{2} 알{3}"><img alt=""></button>', canLetGo(e) ? '' : ' keep', e.id, RAR[e.rarity].name, canLetGo(e) ? '' : $t(' · 선물'))).join('')}${d2 ? $t('<span class="negg lock" aria-label="전설 알 · 내일 열려요"><img alt=""><small>내일 열려요</small></span>') : ''}${'<span class="negg ph" aria-hidden="true"></span>'.repeat(ph)}</div><p class="nnote"></p>${
        sel ? $t('<div class="nbtns ntidy"><button class="sb" data-untidy>취소</button><button class="go" data-letgo>판매</button></div>') : ''}`;
      eggsEl.querySelectorAll('img').forEach((img, i) => eggThumb(mine[i]?.rarity ?? 'legendary').then(u => { img.src = u; }, () => {}));
    });
    const note = eggsEl.querySelector('.nnote');
    if (sel) { // 112 정리: tap eggs to pick, 놓아주기 lets them go for hearts (gifts can't be picked)
      const P = n.eggs.filter(e => sel.has(e.id)), h = P.reduce((s, e) => s + (B.nest.release[e.rarity] || 0), 0);
      eggsEl.querySelectorAll('.negg[data-id]').forEach(b => b.classList.toggle('sel', sel.has(+b.dataset.id)));
      note.textContent = P.length ? $t('알 {0}개 · ♥+{1}', P.length, h) : $t('판매할 알을 골라요 · 선물 알은 빼고요'); eggsEl.querySelector('[data-letgo]').disabled = !P.length;
    } else note.textContent = (mine.length ? $t('알을 누르면 부화 칸에 들어가요 · ') : $t('알이 없어요 · '))
      + (n.eggs.length >= B.nest.max ? $t('둥지가 가득 찼어요 · 부화하거나 판매해요') : $t('다음 알까지 {0}', clock(n.t + eggGap(G.S) - now))) + (d2 ? $t(' · 금빛 알은 {0} 뒤 열려요', clock(new Date(now).setHours(24, 0, 0, 0) - now)) : '');
    const gr = G.S.giftRow, free = G.S.slots.includes(null); giftEl.hidden = !gr.length; // 112 선물 알: given over a full nest, the first one into a free slot
    once('gift', gr.map(e => e.id).join(), () => {
      giftEl.innerHTML = $t('<b>선물 알</b>{0}<small></small>', gr.map((e, i) => $t('<button class="negg" data-gift aria-label="선물 {0} 알"><img alt=""></button>', RAR[e.rarity].name)).join(''));
      giftEl.querySelectorAll('img').forEach((img, i) => eggThumb(gr[i].rarity).then(u => { img.src = u; }, () => {}));
    });
    if (G190) drawFetch(free);
    if (gr.length) giftEl.lastChild.textContent = free ? $t('누르면 부화 칸에 들어가요') : $t('부화 칸이 비면 넣을 수 있어요');
    drawGauges(); slotsEl.classList.toggle('n3', G.S.slots.length > 2); slotsEl.classList.toggle('n4', G.S.slots.length > 3); slotsEl.classList.toggle('n5', G.S.slots.length > 4); // inbox 31: three slots in one row (112: four, five)
    G.S.slots.forEach((s, i) => { const was = sig['slot' + i]; once('slot' + i, s ? `${s.egg.id}` : '-', () => {
      const b = slotsEl.children[i] || slotsEl.appendChild(Object.assign(document.createElement('button'), { className: 'nslot', innerHTML: '<img alt=""><span><b></b><small></small></span>' }));
      b.dataset.i = i; b.classList.toggle('empty', !s); b.classList.remove('fresh'); const img = b.firstChild;
      img.removeAttribute('src'); if (s) eggThumb(s.egg.rarity).then(u => { img.src = u; }, () => {});
      if (s && was === '-') { void b.offsetWidth; b.classList.add('fresh'); } // an egg just went in
    }); });
    G.S.slots.forEach((s, i) => {
      const b = slotsEl.children[i], ready = !!s && now >= s.end, [t, sub] = b.lastChild.children;
      b.classList.toggle('ready', ready);
      t.textContent = !s ? $t('빈 칸') : ready ? $t('부화!') : clock(s.end - now);
      const from = eggHome(s?.egg.type), there = from && from.id !== habId ? from.name + ' ' : '';
      sub.textContent = !s ? $t('알을 눌러 넣어요') : ready ? $t('{0}눌러서 부화', there) : $t('{0}{1} 알', there, RAR[s.egg.rarity].name);
      b.ariaLabel = $t('부화 칸 {0}: {1}', i + 1, !s ? $t('비어 있음') : $t('{0} 알, {1}', RAR[s.egg.rarity].name, ready ? $t('눌러서 부화') : span(s.end - now) + $t(' 남음')));
    });
  }
  function drawGauges() {
    const P = shown || shards(G.S, tab);
    once('gauges', JSON.stringify(P) + tab, () => {
      gEl.innerHTML = gaugesOf(tab).map(k => {
        const have = P[k], target = pityOf(tab)[k], full = have >= target, nm = RAR[k].name;
        return $t('<div class="gauge{0}" data-k="{1}">{2}<div><b>{3} 조각</b><span>{4}/{5}</span>\n<small>{6}</small></div></div>', full ? ' full' : '', k, gaugeSvg(k, have, target), nm, have, target, full ? $t('다음 알 {0} 확정!', nm) : $t('{0}까지 <span style="white-space:nowrap">{1}알</span>', nm, target - have));
      }).join('');
      if (RC201) gEl.querySelectorAll('.gauge').forEach(g => { const k = g.dataset.k, bar = document.createElement('i'), s = document.createElement('s'); // 202 B-7: a thin bar under the count
        bar.className = 'gbar'; s.style.width = Math.min(100, P[k] / pityOf(tab)[k] * 100) + '%'; bar.append(s); g.lastElementChild.append(bar); });
    });
  }

  // ---- the hatch stage: its own small renderer, lit like the habitat, alive only while the sheet shows it
  let st = null, cur = null, live = false, last = 0;
  function stageOn() {
    if (!st) {
      const { R, scene } = studio(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(120,80,40,.32)'); gr.addColorStop(1, 'rgba(120,80,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; scene.add(shadow);
      st = { R, scene, cam, shadow, glow: Object.assign(document.createElement('div'), { className: 'nglow' }) }; stageEl.append(R.domElement, st.glow); // 69-1 예고 빛
    }
    eggsEl.hidden = true; stageEl.hidden = false;
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    st.R.setPixelRatio(Math.min(devicePixelRatio, 2)); st.R.setSize(w, h); st.cam.aspect = w / h; st.cam.updateProjectionMatrix(); // 212 C: 2 as the other stages (was 3)
    if (!live) { live = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  function stageOff() {
    if (cur) { st.scene.remove(cur.look.obj); cur.look.dispose(); if (cur.egg) { st.scene.remove(cur.egg.group); cur.egg.dispose(); } cur = null; }
    live = false; stageEl.hidden = true; eggsEl.hidden = false; stageEl.classList.remove('secret'); st.glow.style.opacity = 0;
    // <sec263>
    stageEl.classList.remove('sec263');
    // </sec263>
  }
  function show(a, egg = null) { // the figure (hidden until it pops out of the egg), framed to its size
    let yaw = -Math.PI / 2 + 0.45;
    // <sec263> 282 A: the 태엽 속 시크릿 turned to its side-back 3/4 (the works behind the glass, lineup a=rq), from the crack to the card
    if (SEC263 && variantOf(a.species, a.variant)?.windup) yaw = 0.6; // 284: 0.6 rad, the gears' faces at cos 0.6 = 0.83 to the camera, the rump and the clear half in view
    // </sec263>
    const look = dress(a); look.obj.rotation.y = yaw; st.scene.add(look.obj);
    const hgt = Math.max(1.3, new THREE.Box3().setFromObject(look.obj).getSize(new THREE.Vector3()).y);
    st.cam.position.set(0, hgt * 0.75, hgt * 3.6); st.cam.lookAt(0, hgt * 0.42, 0);
    if (egg) { look.obj.visible = false; st.scene.add(egg.group); try { st.R.compile(st.scene, st.cam); } catch { /* drawn when it shows, as before */ } } // 69-1: the hidden figure's shaders made now (in the background where the browser can), not in the frame it breaks out
    cur = { look, egg, t0: null, yaw };
  }
  function frame(now) {
    if (!live) return; requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    if (cur) {
      const { look, egg } = cur;
      if (egg && cur.t0 != null) {
        const k = (now - cur.t0) / 1000;
        if (k >= HATCH.pop && !look.obj.visible) { look.obj.visible = true; look.appear(); }
        st.glow.style.opacity = glowAt(k); // 69-1: the rarity's light behind the egg, with the seams
        if (egg.hatch(k)) { st.scene.remove(egg.group); egg.dispose(); cur.egg = null; st.glow.style.opacity = 0; }
      }
      look.update(dt); look.obj.rotation.y = cur.yaw + (calm() ? 0 : Math.sin(t * 0.7) * 0.35); // 27-7d 움직임 줄이기: no sway
      const pz = { sq: 1 + Math.sin(t * 2.2) * 0.015, rot: 0, gait: 'still', ph: 0 };
      // <sec263> 284: from the card on, the 태엽 속 시크릿's gears turn once with one glint (materials.js parts275, p.spin: seconds)
      if (cur.spin0 && !calm()) pz.spin = (now - cur.spin0) / 1000; // 27-7d 움직임 줄이기: not this either
      // </sec263>
      look.fig.pose(pz);
    }
    st.R.render(st.scene, st.cam);
  }

  // ---- little flights between the stage and the gauges (DOM, on top of everything)
  const centre = (e, fy = 0.5) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * fy, r]; };
  function gaugeIn(k) { // a full gauge sparkles, then flies into the egg
    const g = gEl.querySelector(`[data-k="${k}"]`), svg = g.querySelector('svg'), [ax, ay, a] = centre(svg), [bx, by] = centre(stageEl, 0.62);
    g.classList.add('go');
    const c = svg.cloneNode(true); c.classList.add('flyg'); Object.assign(c.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' }); document.body.append(c);
    return c.animate([{ transform: 'none', offset: 0 }, { transform: 'translateY(-14px) scale(1.2)', offset: 0.4 }, { transform: `translate(${bx - ax}px,${by - ay}px) scale(.3)`, opacity: 0.3 }],
      { duration: 1100, easing: 'cubic-bezier(.5,0,.7,1)' }).finished.then(() => { c.remove(); g.classList.remove('go'); });
  }
  function shellTo(k, rarity) { // one shell piece from the cracking egg to a gauge
    const g = gEl.querySelector(`[data-k="${k}"]`), [ax, ay] = centre(stageEl, 0.6), [bx, by] = centre(g.querySelector('svg'));
    const p = Object.assign(document.createElement('div'), { className: 'shell' }); p.style.background = RAR[rarity].shell; // 75: the tier table's colour
    Object.assign(p.style, { left: ax + 'px', top: ay + 'px' }); document.body.append(p);
    const dx = bx - ax, dy = by - ay;
    return p.animate([{ transform: 'translate(-50%,-50%) rotate(0deg)' }, { transform: `translate(calc(-50% + ${dx * 0.3}px),calc(-50% + ${dy * 0.3 - 60}px)) rotate(220deg) scale(1.2)`, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(480deg) scale(.6)` }], { duration: 750, easing: 'ease-in' }).finished.then(() => {
      p.remove(); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump');
    });
  }

  // ---- hatch: crack (the save changes now), then play it: gauge in (if guaranteed), then 69-1's five beats: wobble, cracks,
  // one light in the colour of the rarity that came out (r.rarity, after the gauges: never a fake one), break and a piece to
  // the gauges, the friend (figure, then the card). As long as before (2.2 s from the wobble to the card), no skip as before
  async function hatchSlot(i) {
    const s = G.S.slots[i], tok = ++run; busy = true; tab = s.egg.type; shown = shards(G.S, tab);
    const r = G.hatch(i); if (!r) { busy = false; shown = null; return draw(); }
    const got = await Promise.all([loadModel(SP[r.animal.species].model), loadAcc(r.animal.acc)]).then(() => true, () => false); if (tok !== run) return; // another habitat's species: its model isn't loaded here yet
    if (!got) { busy = false; shown = null; return draw(); } // 168: offline and that model never fetched: the friend waits (pending) and its card comes back on the next open (resume)
    const light = RAR[r.rarity].shell; // the seams light up in its shell colour, the halo round the egg in its tier colour (the card's)
    let sec = false;
    // <sec263> 263 B: the series secret's egg: a gold light behind, its own wobble and gold seams (growth.js)
    sec = !!(SEC263 && r.sec);
    // </sec263>
    stageOn(); st.glow.style.setProperty('--gc', RAR[r.rarity].color); show(r.animal, makeEgg(eggMat(r.egg.rarity), light, { sec })); draw();
    // <sec263>
    stageEl.classList.toggle('sec263', sec); if (sec) st.glow.style.setProperty('--gc', '#ffd24a');
    // </sec263>
    await sleep(400); if (tok !== run) return;
    if (r.sure) {
      await gaugeIn(r.rarity); if (tok !== run) return;
      shown = { ...shown, [r.rarity]: 0 }; drawGauges();
      st.scene.remove(cur.egg.group); cur.egg.dispose(); cur.egg = makeEgg(eggMat(r.rarity), light, { sec }); st.scene.add(cur.egg.group); // now it is the guaranteed egg
      stageEl.classList.remove('flash'); void stageEl.offsetWidth; stageEl.classList.add('flash');
      await sleep(700); if (tok !== run) return;
    }
    // 69-1: each beat waits till its time on the egg's clock (t0), so a slow frame as it breaks doesn't make the whole longer
    const t0 = cur.t0 = performance.now(), till = s => sleep(Math.max(0, t0 + s * 1000 - performance.now()));
    await till(HATCH.crack); if (tok !== run) return;
    sfx('tok'); sfx('tok', 0.14); // 69-1 금: two small ticks as the seams run
    await till(HATCH.pop); if (tok !== run) return;
    sfx('hatch'); if (sec) sfx('level'); cry(r.animal); await till(HATCH.pop + 0.15); if (tok !== run) return; // 26-2: the small bell (69-1: when it breaks)
    const up = Object.keys(r.shards.after).filter(k => r.shards.after[k] > r.shards.before[k]);
    Promise.all(up.map(k => shellTo(k, r.egg.rarity))).then(() => { if (tok === run) { shown = null; drawGauges(); } });
    if (!up.length) { shown = null; drawGauges(); }
    await till(HATCH.end + 0.35); if (tok !== run) return; // the card at 2.2 s, as before
    card(r.animal, r);
  }
  function card(a, r = null) {
    const v = variantOf(a.species, a.variant), back = canSendBack(G.S, a), n = sendBackHearts(a), fresh = isNew(G.S, a), col = colorOf(a.species, a.variant, a.color);
    // <sec263> 284: the card's start, only with a hatch (r): resume() shows a card again without one
    if (SEC263 && v?.windup && r && cur) cur.spin0 = performance.now();
    // </sec263>
    const newCol = !fresh && a.newColor; // a variant already met, in a colour not seen before (rules.js hatch)
    const gift = B.codexHeart && !G.S.codex[key(a.species, a.variant)]; // inbox 38: its cell is filled when it is kept (out or storage)
    const H = HAB[habitatOf(a)], away = H.id !== habId, open = G.S.unlocked.includes(H.id), room = fits(G.S, a); // inbox 20: never gone without a word
    cardEl.style.setProperty('--rc', RAR[v.rarity].color); // 75
    cardEl.innerHTML = $t('<div class="nchips"><span class="rar">{0}</span>{1}{2}{3}{4}</div>\n<b class="nname">{5}{6}</b>\n{7}\n<p class="nwhy">{8} · {9} 동물 · {10}</p>\n{11}\n<div class="nbtns{12}">{13}{14}</div><p class="nload">서식지 준비 중…</p>', RAR[v.rarity].name, fresh ? '<i class="new">NEW</i>' : newCol ? $t('<i class="new">새 색!</i>') : '', gift ? `<i class="gift">♥+${B.codexHeart}</i>` : '', r?.sure ? $t('<span class="sure">조각으로 확정!</span>') : '', r?.newAcc ? $t('<i class="new">새 치장!</i>') : '', nameOf(a), col && v?.rarity !== 'common' ? ` <small>${col.name}</small>` : '', a.acc ? $t('<div class="nsecret"><em>치장 발견!</em> {0} 나왔어요{1}{2}</div>', ACCESSORIES[a.acc].wear, '<i>✦</i>'.repeat(6), r?.newAcc ? $t('<small>처음 만난 치장이에요 · 치장 앨범에 남았어요</small>') : '') : '', SP[a.species].name, H.name, fresh ? $t('처음 만난 변종이에요') : newCol ? $t('처음 보는 색이에요') : back ? $t('이미 도감에 있는 변종이에요') : $t('이미 가진 변종이에요'), away ? `<p class="nwhy away">${!open ? $t('{0}{이/가} 열리면 옮길 수 있어요. 그때까지 보관함에서 기다려요.', H.name) : room ? $t('{0}에서 사는 동물이에요. {1}으로 보낼게요.', H.name, H.name) : $t('{0}에서 사는 동물이에요. {1}에 자리가 모자라 보관함에서 기다려요.', H.name, H.name)}</p>` : '', away && room && back ? ' three' : '', !room ? $t('<button class="go" data-store>보관함으로</button>') : away ? $t('<button class="sb" data-look>{0}에서 보기</button><button class="go" data-go>확인</button>', H.name) : $t('<button class="go" data-go>서식지로 보내기</button>'), back ? $t('<button class="sb" data-back>판매 <span class="hrt">♥</span>+{0}</button>', n) : ''); // inbox 64-A: the first board still being built (body.building, main.js)
    if (G190) serCard(a, back);
    cardEl.dataset.id = a.id; cardEl.hidden = false; stageEl.classList.toggle('secret', !!a.acc);
  }
  function answer(go, e) {
    const a = G.S.animals.find(x => x.id === +cardEl.dataset.id && x.pending); if (!a) return;
    if (TOSS) dispatchEvent(new CustomEvent('toss:adi', { detail: { at: 'nest' } })); // 184 ⑤: src/toss.js may show the interstitial its 「Ad」 chip told of (ADI184)
    if (ready) { const f = ready; ready = null; setTimeout(f, 500); } // 64-A: the first habitat builds while this card is read (not during the hatch: it took 2.7 s longer)
    if (G.S.stats.hatch === 1 && !G.S.flags.next61) { G.flag('next61'); tip('next', '#nestBtn'); } // inbox 61 B: once, after the first (64-A: a tip, one at a time with the rest)
    const nm = nameOf(a), gift = go && B.codexHeart && !G.S.codex[key(a.species, a.variant)] ? ` · ♥+${B.codexHeart}` : ''; // inbox 38
    if (gift) heart(e.clientX, e.clientY);
    const k = key(a.species, a.variant); if (go && !G.S.codex[k] && RAR[variantOf(a.species, a.variant)?.rarity]?.story) setTimeout(() => import('./story.js').then(m => m.giveStory('l', k)), 600); // 14-2: a legendary's first one, its card once it is kept
    if (go === 'store') { // its habitat is full or not open yet (rules.fits): it waits in storage
      const H = HAB[habitatOf(a)], shut = !G.S.unlocked.includes(H.id);
      G.store(a.id); toast($t('{0} · {1}{은/는} 보관함에서 기다려요{2}', shut ? $t('{0}{이/가} 열리면 옮길 수 있어요', H.name) : $t('{0}에 자리가 모자라요', H.name), nm, gift), 3200);
      cardEl.hidden = true; stageOff(); busy = false; resume(); // 27-7a: nothing to see outside, so the nest stays open for the next egg (as 돌려보내기)
    } else if (go === 'brk') { // 199 B-11 분해: a duplicate into 교환 도장 (판매's other choice)
      const r = G.breakDup(a.id); if (r) { sfx('wood'); toast($t('{0}{을/를} 분해했어요 · 토큰 +{1} (모은 토큰 {2})', nm, r.n, G.S.stamp)); }
      cardEl.hidden = true; stageOff(); busy = false; resume();
    } else if (go === 'look') { // out in its own habitat, and the camera goes there to see it
      const home = habitatOf(a); G.release(a.id); close(); nav.go(home, a.id);
    } else if (go) {
      const fresh = !G.S.codex[key(a.species, a.variant)]; G.release(a.id);
      const more = G.S.slots.some(s => s && G.now() >= s.end); // inbox 86-3가: another 부화! slot: the nest stays open on the slots (no look: it would be behind the sheet)
      if (more) { cardEl.hidden = true; stageOff(); busy = false; resume(); } else close();
      if (hab && habitatOf(a) === habId) hab.drop(a, !more); // inbox 43: a look at it, then back
      toast($t('{0}{이/가} {1}에 나왔어요{2}{3}', nm, HAB[habitatOf(a)].name, fresh ? $t(' · 도감에 등록됐어요') : '', gift), fresh ? 3200 : undefined);
    } else {
      const n = G.sendBack(a.id); heart(e.clientX, e.clientY); toast($t('{0}{을/를} 판매했어요 · ♥+{1}', nm, n));
      cardEl.hidden = true; stageOff(); busy = false; resume();
    }
  }
  async function resume() { const p = pending(); if (!p) return draw(); busy = true; const tok = run; const got = await Promise.all([loadModel(SP[p.species].model), loadAcc(p.acc)]).then(() => true, () => false); if (tok !== run || el.hidden) return; if (!got) { busy = false; return draw(); } stageOn(); show(p); card(p); draw(); } // an unanswered card (closed sheet, reload) comes back

  function open() {
    if (!habId) return;
    el.hidden = false; sig = {}; tab = HAB[habId].nest;
    if (!G.S.flags.nestTapped) { hideToast(); G.flag('nestTapped'); }
    draw(); resume();
  }
  function close() { sel = null; run++; busy = false; shown = null; cardEl.hidden = true; if (st) stageOff(); el.hidden = true; drawBtn(); if (after) { const f = after; after = null; f(); } }

  btn.onclick = open;
  el.addEventListener('click', e => {
    if (e.target === el) return close();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close != null) close();
    else if (b.dataset.go != null) answer(true, e);
    else if (b.dataset.look != null) answer('look', e);
    else if (b.dataset.store != null) answer('store', e);
    else if (b.dataset.back != null) answer(false, e);
    else if (b.dataset.brk != null) answer('brk', e);
    else if (busy) return;
    else if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
    else if (b.dataset.odds != null) openOdds(tab, G.S); // 177 C
    else if (b.dataset.tidy != null || b.dataset.untidy != null) { sel = sel || b.dataset.untidy != null ? null : new Set(); draw(); }
    else if (b.dataset.letgo != null) letGo(e);
    else if (b.dataset.fetch != null) { if (G.takeFetched(+b.dataset.fetch) < 0) toast($t('부화 칸이 가득 찼어요 · 알을 부화하면 넣을 수 있어요')); else sfx('egg'); } // 199 B-11
    else if (b.dataset.gift != null) { if (G.takeGift() < 0) toast($t('부화 칸이 가득 찼어요 · 알을 부화하면 넣을 수 있어요')); else sfx('egg'); }
    else if (sel && b.dataset.id) { const id = +b.dataset.id, x = nest().eggs.find(x => x.id === id); if (x && canLetGo(x)) { sel.has(id) ? sel.delete(id) : sel.add(id); draw(); } else toast($t('선물 알은 판매할 수 없어요')); }
    else if (b.dataset.id) { if (G.takeEgg(habId, +b.dataset.id) < 0) toast($t('부화 칸이 가득 찼어요')); else { sfx('egg'); tip('hatch', '#nslots'); } }
    else if (b.dataset.i != null) {
      const s = G.S.slots[+b.dataset.i], now = G.now();
      if (press?.long) { press = null; return; } // 199 B-11 review 5: a long press shook it (below), not a tap
      if (!s) toast($t('위의 알을 누르면 이 칸에 들어가요'));
      else if (now < s.end) { toast($t('{0} 알 · {1} 뒤에 부화해요', RAR[s.egg.rarity].name, span(s.end - now)) + (G190 ? $t(' · 길게 누르면 흔들어 봐요') : '')); knock(b); if (TOSS) dispatchEvent(new CustomEvent('toss:egg', { detail: { i: +b.dataset.i } })); } // 174: src/toss.js may ask about an ad
      else hatchSlot(+b.dataset.i);
    }
  });
  // 112 놓아주기: one question when a heroic or better egg is among them
  async function letGo(e) {
    const P = nest().eggs.filter(x => sel?.has(x.id)), [x, y] = [e.clientX, e.clientY], big = P.filter(x => RANK[x.rarity] >= RANK.heroic); if (!P.length) return;
    if (big.length && !await ask($t('{0} 알이 들어 있어요.\n판매한 알은 돌아오지 않아요. 판매할까요?', [...new Set(big.map(x => RAR[x.rarity].name))].join('·')), $t('판매'))) return;
    const r = G.letGo(habId, P.map(x => x.id)); sel = null; draw(); if (!r) return;
    heart(x, y); sfx('grown'); toast($t('알 {0}개를 판매했어요 · ♥+{1}', r.n, r.hearts));
  }
  // 69-1: an egg still waiting, tapped (톡), answers from inside a moment later: two little rocks and 톡톡 (the same for every rarity)
  function knock(b) { sfx('tok', 0.28); sfx('tok', 0.42); b.classList.remove('knock'); void b.offsetWidth; b.classList.add('knock'); }
  // ---- 199 B-11 (?g190): 물어온 알 (a row like 선물 알), the card's 시리즈 line and 분해, 흔들어 보기 (3 a day: the sound tells its group)
  function drawFetch(free) {
    const fe = $('nfetch'), q = G.S.ser?.f?.q || []; fe.hidden = !q.length;
    once('fetch', q.map(x => x.egg.id).join(), () => {
      fe.innerHTML = $t('<b>물어온 알</b>{0}<small></small>', q.map((x, j) => $t('<button class="negg" data-fetch="{0}" aria-label="물어온 {1} 알"><img alt=""></button>', j, RAR[x.egg.rarity].name)).join(''));
      fe.querySelectorAll('img').forEach((img, j) => eggThumb(q[j].egg.rarity).then(u => { img.src = u; }, () => {}));
    });
    if (q.length) { const p = G.S.props.find(p => p.uid === q[0].uid), P = p && PROPS.find(x => x.id === p.prop);
      fe.lastChild.textContent = (P ? $t('{0}{이/가} 물어왔어요 · ', P.name) : '') + (free ? $t('누르면 부화 칸에 들어가요') : $t('부화 칸이 비면 넣을 수 있어요')); }
  }
  function serCard(a, back) {
    const k = key(a.species, a.variant), s = serOf(k), row = cardEl.querySelector('.nbtns');
    if (s) { const p = document.createElement('p'), n = serHave(G.S, s) + (G.S.codex[k] ? 0 : 1); p.className = 'nwhy nser';
      p.textContent = $t('{0} {1}/{2}{3}', s.name, n, s.cells.length, G.S.codex[k] ? '' : $t(' · 새 칸!')); row.before(p); }
    // <sec263> 263 B · 267 B ⑤: the series secret's card: a gold stamp for the rarity chip, No.13 big (the cells + 1; a server-wide serial waits
    // for the server, 265-7), its series
    const sv = SEC263 && variantOf(a.species, a.variant)?.sec, S1 = sv && SERIES.find(x => x.id === sv);
    if (S1) { const st = Object.assign(document.createElement('span'), { className: 'secstamp', textContent: $t('시크릿!') }), rar = cardEl.querySelector('.nchips .rar');
      if (rar) rar.replaceWith(st); else cardEl.querySelector('.nchips')?.prepend(st);
      row.before(Object.assign(document.createElement('p'), { className: 'secno', textContent: $t('No.{0}', S1.cells.length + 1) }),
        Object.assign(document.createElement('p'), { className: 'nwhy secser', textContent: $t('{0} · 시크릿', S1.name) })); }
    // </sec263>
    const no = G.S.codex[k] ? 0 : collNo(G.S, k); // 215 (3-13): 「나의 n번째 전설」, only its first (the card comes before the codex has it); 263 A: no series-secret number
    if (no) { const p = document.createElement('p'); p.className = 'nwhy cno'; p.textContent = $t('No.{0} · 나의 {1}번째 전설', no, no); row.before(p); }
    if (!back) return;
    const x = Object.assign(document.createElement('button'), { className: 'sb' }); x.dataset.brk = '';
    x.textContent = $t('분해 +{0}', brkStamps(a)); row.append(x); row.classList.add('three'); // 208 A Q4
  }
  // review 5: a tap tells the time left as before; a long press (0.45 s, as friends.js) on a waiting egg shakes it
  let press = null;
  const waiting = b => { const s = b && G.S.slots[+b.dataset.i]; return !!s && G.now() < s.end; };
  if (G190) {
    slotsEl.addEventListener('pointerdown', e => { const b = e.target.closest('[data-i]'); if (press) clearTimeout(press.t); press = null; if (!waiting(b)) return;
      press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press.long = true; shakeSlot(b, +b.dataset.i); }, 450) }; });
    slotsEl.addEventListener('pointermove', e => { if (press && !press.long && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.t); press = null; } });
    for (const k of ['pointerup', 'pointercancel', 'pointerleave']) slotsEl.addEventListener(k, () => { if (press) clearTimeout(press.t); });
    slotsEl.addEventListener('contextmenu', e => { if (waiting(e.target.closest('[data-i]'))) e.preventDefault(); }); // no menu on the egg's picture
  }
  function shakeSlot(b, i) {
    const r = G.shake(i); if (!r) return;
    if (r.none) { toast($t('오늘은 흔들어 보기를 다 했어요 · 내일 다시 3번')); return knock(b); }
    const [t, snd] = SOUND[r.sound]; b.classList.remove('knock'); void b.offsetWidth; b.classList.add('knock'); sfx(snd, 0.2);
    toast($t('{0} · 오늘 {1}번 남았어요', t, r.left));
  }
  G.on(ev => { if (ev.some(e => e.type === 'reset')) close(); draw(); });

  return {
    attach(api, id) { hab = api; habId = id === 'yard' ? HABITATS[0].id : id; draw(); }, // 182 ④ (?yard): in the yard, the first habitat's nest
    leave() { close(); hab = null; },
    open,
    // inbox 61 B: a new player's first egg, from the loading screen's 바로 깨기 (main.js), before the board is built; done: the sheet closed
    first(id, done, onCard) { habId ??= id; after = done; ready = onCard; const i = G.takeEgg(id); if (i < 0) return close(); sfx('egg'); open(); hatchSlot(i); },
  };
}
