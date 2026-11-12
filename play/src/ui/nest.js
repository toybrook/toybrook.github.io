// Nest menu: a bottom sheet over the habitat (the habitat itself is only for watching). Top: this habitat's eggs,
// a tab per egg type. Middle: the shard gauges (BALANCE.pity). Bottom: the hatch slots. A ready slot hatches on a
// small 3D stage inside the sheet, then the reveal card: out into the habitat (always offered), or back for hearts
// (only a variant already in the codex). The hatched animal stays `pending` until the card is answered.
import * as THREE from 'three';
import * as G from '../game/game.js';
import { BALANCE as B, ACCESSORIES, HABITATS } from '../game/data.js';
import { SP, RAR, HAB, EGG, RANK, variantOf, colorOf, shards, isNew, canSendBack, sendBackHearts, fits, habitatOf, key, eggGap, kindName } from '../game/rules.js';
import { toast, hideToast, heart, clock, span, josa, tip } from './hud.js';
import { eggThumb, studio } from './thumbs.js';
import { makeEgg, HATCH } from '../animals/growth.js';
import { dress, loadModel, loadAcc } from '../animals/figure.js';
import { eggMat } from '../animals/materials.js';
import { sfx, cry } from './sound.js';
import { calm } from '../config.js';

const $ = id => document.getElementById(id);
const nameOf = kindName;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GAUGES = Object.keys(B.pity).sort((a, b) => RANK[a] - RANK[b]);
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
const gaugeSvg = (k, have, target) => {
  const n = have >= target ? PIECES.length : Math.min(PIECES.length - 1, Math.ceil(have / target * PIECES.length));
  return `<svg viewBox="0 0 60 76" aria-hidden="true"><defs><clipPath id="gc-${k}"><path d="${EGG_D}"/></clipPath></defs><g clip-path="url(#gc-${k})" stroke="#fbf1e1" stroke-width=".7">
${PIECES.map((p, i) => `<polygon points="${p.pts}" ${i < n ? `fill="hsl(${RAR[k].hue} ${RAR[k].sat}% ${p.l}%)"` : 'fill="#efdfc4"'}/>`).join('')}</g><path d="${EGG_D}" fill="none" stroke="#b08a5e" stroke-width="1.8"/></svg>`;
};

export function initNest(nav) {
  const el = $('nest'), btn = $('nestBtn'), badge = btn.querySelector('i');
  el.innerHTML = `<div class="nsheet" role="dialog" aria-label="둥지">
  <div class="chead"><b>둥지</b><span id="ncount"></span><button class="back" data-close>닫기</button></div>
  <div class="ctabs" id="ntabs"></div>
  <div class="ntop"><div class="neggs" id="neggs"></div><div class="nstage" id="nstage" hidden></div></div>
  <div class="nlow"><div class="ngauges" id="ngauges"></div><div class="nslots" id="nslots"></div><div class="ncard" id="ncard" hidden></div></div>
</div>`;
  const eggsEl = $('neggs'), stageEl = $('nstage'), gEl = $('ngauges'), slotsEl = $('nslots'), cardEl = $('ncard'), tabsEl = $('ntabs');
  let habId = null, hab = null, tab = null, busy = false, shown = null, run = 0, sig = {};
  const nest = () => G.S.nests[habId] || { eggs: [], t: G.now() };
  const pending = () => G.S.animals.find(a => a.pending);

  // ---- drawing (rebuilt only when what it shows changed; the timers every tick)
  function drawBtn() {
    const n = habId ? nest().eggs.length : 0, now = G.now();
    badge.textContent = n; badge.hidden = !n;
    btn.classList.toggle('ready', G.S.slots.some(s => s && now >= s.end) || !!pending());
    btn.ariaLabel = `둥지: 알 ${n}개`;
  }
  const once = (k, v, f) => { if (sig[k] !== v) { sig[k] = v; f(); } };
  function draw() {
    drawBtn(); if (el.hidden) return;
    const now = G.now(), n = nest(), types = [...new Set([HAB[habId].nest, ...n.eggs.map(e => e.type)])].filter(Boolean);
    if (!types.includes(tab)) tab = types[0];
    $('ncount').textContent = `알 ${n.eggs.length}/${B.nest.max}`;
    once('tabs', types.join() + tab, () => { tabsEl.innerHTML = types.map(t => `<button data-tab="${t}"${t === tab ? ' class="on"' : ''}>${EGG[t].name}</button>`).join(''); });
    const mine = n.eggs.filter(e => e.type === tab);
    once('eggs', mine.map(e => e.id).join() + tab, () => {
      eggsEl.innerHTML = `<div class="ngrid">${mine.map(e => `<button class="negg" data-id="${e.id}" aria-label="${RAR[e.rarity].name} 알"><img alt=""></button>`).join('')}</div><p class="nnote"></p>`;
      eggsEl.querySelectorAll('img').forEach((img, i) => eggThumb(mine[i].rarity).then(u => { img.src = u; }));
    });
    eggsEl.lastChild.textContent = (mine.length ? '알을 누르면 부화 칸에 들어가요 · ' : '알이 없어요 · ')
      + (n.eggs.length >= B.nest.max ? '둥지가 가득 찼어요' : `다음 알까지 ${clock(n.t + eggGap(G.S) - now)}`);
    drawGauges(); slotsEl.classList.toggle('n3', G.S.slots.length > 2); // inbox 31: three slots in one row
    G.S.slots.forEach((s, i) => { const was = sig['slot' + i]; once('slot' + i, s ? `${s.egg.id}` : '-', () => {
      const b = slotsEl.children[i] || slotsEl.appendChild(Object.assign(document.createElement('button'), { className: 'nslot', innerHTML: '<img alt=""><span><b></b><small></small></span>' }));
      b.dataset.i = i; b.classList.toggle('empty', !s); b.classList.remove('fresh'); const img = b.firstChild;
      img.removeAttribute('src'); if (s) eggThumb(s.egg.rarity).then(u => { img.src = u; });
      if (s && was === '-') { void b.offsetWidth; b.classList.add('fresh'); } // an egg just went in
    }); });
    G.S.slots.forEach((s, i) => {
      const b = slotsEl.children[i], ready = !!s && now >= s.end, [t, sub] = b.lastChild.children;
      b.classList.toggle('ready', ready);
      t.textContent = !s ? '빈 칸' : ready ? '부화!' : clock(s.end - now);
      const from = eggHome(s?.egg.type), there = from && from.id !== habId ? from.name + ' ' : '';
      sub.textContent = !s ? '알을 눌러 넣어요' : ready ? `${there}눌러서 깨우기` : `${there}${RAR[s.egg.rarity].name} 알`;
      b.ariaLabel = `부화 칸 ${i + 1}: ${!s ? '비어 있음' : `${RAR[s.egg.rarity].name} 알, ${ready ? '눌러서 부화' : span(s.end - now) + ' 남음'}`}`;
    });
  }
  function drawGauges() {
    const P = shown || shards(G.S, tab);
    once('gauges', JSON.stringify(P) + tab, () => {
      gEl.innerHTML = GAUGES.map(k => {
        const have = P[k], target = B.pity[k], full = have >= target, nm = RAR[k].name;
        return `<div class="gauge${full ? ' full' : ''}" data-k="${k}">${gaugeSvg(k, have, target)}<div><b>${nm} 조각</b><span>${have}/${target}</span>
<small>${full ? `다음 알 ${nm} 확정!` : `${nm}까지 <span style="white-space:nowrap">${target - have}알</span>`}</small></div></div>`;
      }).join('');
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
      st = { R, scene, cam, shadow }; stageEl.appendChild(R.domElement);
    }
    eggsEl.hidden = true; stageEl.hidden = false;
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    st.R.setPixelRatio(Math.min(devicePixelRatio, 3)); st.R.setSize(w, h); st.cam.aspect = w / h; st.cam.updateProjectionMatrix();
    if (!live) { live = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  function stageOff() {
    if (cur) { st.scene.remove(cur.look.obj); if (cur.egg) st.scene.remove(cur.egg.group); cur = null; }
    live = false; stageEl.hidden = true; eggsEl.hidden = false; stageEl.classList.remove('secret');
  }
  function show(a, egg = null) { // the figure (hidden until it pops out of the egg), framed to its size
    const look = dress(a); look.obj.rotation.y = -Math.PI / 2 + 0.45; st.scene.add(look.obj);
    const hgt = Math.max(1.3, new THREE.Box3().setFromObject(look.obj).getSize(new THREE.Vector3()).y);
    st.cam.position.set(0, hgt * 0.75, hgt * 3.6); st.cam.lookAt(0, hgt * 0.42, 0);
    if (egg) { look.obj.visible = false; st.scene.add(egg.group); }
    cur = { look, egg, t0: null };
  }
  function frame(now) {
    if (!live) return; requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    if (cur) {
      const { look, egg } = cur;
      if (egg && cur.t0 != null) {
        const k = (now - cur.t0) / 1000;
        if (k >= HATCH.pop && !look.obj.visible) { look.obj.visible = true; look.appear(); }
        if (egg.hatch(k)) { st.scene.remove(egg.group); cur.egg = null; }
      }
      look.update(dt); look.obj.rotation.y = -Math.PI / 2 + 0.45 + (calm() ? 0 : Math.sin(t * 0.7) * 0.35); // 27-7d 움직임 줄이기: no sway
      look.fig.pose({ sq: 1 + Math.sin(t * 2.2) * 0.015, rot: 0, gait: 'still', ph: 0 });
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
    const p = Object.assign(document.createElement('div'), { className: 'shell' }); p.dataset.r = rarity;
    Object.assign(p.style, { left: ax + 'px', top: ay + 'px' }); document.body.append(p);
    const dx = bx - ax, dy = by - ay;
    return p.animate([{ transform: 'translate(-50%,-50%) rotate(0deg)' }, { transform: `translate(calc(-50% + ${dx * 0.3}px),calc(-50% + ${dy * 0.3 - 60}px)) rotate(220deg) scale(1.2)`, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(480deg) scale(.6)` }], { duration: 750, easing: 'ease-in' }).finished.then(() => {
      p.remove(); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump');
    });
  }

  // ---- hatch: crack (the save changes now), then play it: gauge in (if guaranteed), wobble, crack, a piece to the gauges, the card
  async function hatchSlot(i) {
    const s = G.S.slots[i], tok = ++run; busy = true; tab = s.egg.type; shown = shards(G.S, tab);
    const r = G.hatch(i); if (!r) { busy = false; shown = null; return draw(); }
    await Promise.all([loadModel(SP[r.animal.species].model), loadAcc(r.animal.acc)]); if (tok !== run) return; // another habitat's species: its model isn't loaded here yet
    stageOn(); show(r.animal, makeEgg(eggMat(r.egg.rarity))); draw();
    await sleep(400); if (tok !== run) return;
    if (r.sure) {
      await gaugeIn(r.rarity); if (tok !== run) return;
      shown = { ...shown, [r.rarity]: 0 }; drawGauges();
      st.scene.remove(cur.egg.group); cur.egg = makeEgg(eggMat(r.rarity)); st.scene.add(cur.egg.group); // now it is the guaranteed egg
      stageEl.classList.remove('flash'); void stageEl.offsetWidth; stageEl.classList.add('flash');
      await sleep(700); if (tok !== run) return;
    }
    cur.t0 = performance.now();
    await sleep(HATCH.crack * 1000); if (tok !== run) return;
    sfx('hatch'); cry(r.animal.species); await sleep(150); if (tok !== run) return; // 26-2: the small bell when the shell cracks
    const up = GAUGES.filter(k => r.shards.after[k] > r.shards.before[k]);
    Promise.all(up.map(k => shellTo(k, r.egg.rarity))).then(() => { if (tok === run) { shown = null; drawGauges(); } });
    if (!up.length) { shown = null; drawGauges(); }
    await sleep((HATCH.end - HATCH.crack) * 1000 + 200); if (tok !== run) return;
    card(r.animal, r);
  }
  function card(a, r = null) {
    const v = variantOf(a.species, a.variant), back = canSendBack(G.S, a), n = sendBackHearts(a), fresh = isNew(G.S, a), col = colorOf(a.species, a.variant, a.color);
    const newCol = !fresh && a.newColor; // a variant already met, in a colour not seen before (rules.js hatch)
    const gift = B.codexHeart && !G.S.codex[key(a.species, a.variant)]; // inbox 38: its cell is filled when it is kept (out or storage)
    const H = HAB[habitatOf(a)], away = H.id !== habId, open = G.S.unlocked.includes(H.id), room = fits(G.S, a); // inbox 20: never gone without a word
    cardEl.dataset.r = v.rarity;
    cardEl.innerHTML = `<div class="nchips"><span class="rar">${RAR[v.rarity].name}</span>${fresh ? '<i class="new">NEW</i>' : newCol ? '<i class="new">새 색!</i>' : ''}${gift ? `<i class="gift">♥+${B.codexHeart}</i>` : ''}${r?.sure ? '<span class="sure">조각으로 확정!</span>' : ''}${r?.newAcc ? '<i class="new">새 치장!</i>' : ''}</div>
<b class="nname">${nameOf(a)}${col ? ` <small>${col.name}</small>` : ''}</b>
${a.acc ? `<div class="nsecret"><em>시크릿!</em> ${ACCESSORIES[a.acc].wear} 나왔어요${'<i>✦</i>'.repeat(6)}${r?.newAcc ? '<small>처음 만난 치장이에요 · 치장 앨범에 남았어요</small>' : ''}</div>` : ''}
<p class="nwhy">${SP[a.species].name} · ${H.name} 친구 · ${fresh ? '처음 만난 변종이에요' : newCol ? '처음 보는 색이에요' : back ? '이미 도감에 있는 변종이에요' : '이미 데려온 변종이에요'}</p>
${away ? `<p class="nwhy away">${!open ? `${H.name}${josa(H.name, '이', '가')} 열리면 데려갈 수 있어요. 그때까지 보관함에서 기다려요.` : room ? `${H.name}에서 사는 친구예요. ${H.name}으로 보낼게요.` : `${H.name}에서 사는 친구예요. ${H.name}에 자리가 모자라 보관함에서 기다려요.`}</p>` : ''}
<div class="nbtns${away && room && back ? ' three' : ''}">${!room ? '<button class="go" data-store>보관함으로</button>' : away ? `<button class="sb" data-look>${H.name}에서 보기</button><button class="go" data-go>확인</button>` : '<button class="go" data-go>서식지로 보내기</button>'}${back ? `<button class="sb" data-back>돌려보내기 <span class="hrt">♥</span>+${n}</button>` : ''}</div>`;
    cardEl.dataset.id = a.id; cardEl.hidden = false; stageEl.classList.toggle('secret', !!a.acc);
  }
  function answer(go, e) {
    const a = G.S.animals.find(x => x.id === +cardEl.dataset.id && x.pending); if (!a) return;
    const nm = nameOf(a), gift = go && B.codexHeart && !G.S.codex[key(a.species, a.variant)] ? ` · ♥+${B.codexHeart}` : ''; // inbox 38
    if (gift) heart(e.clientX, e.clientY);
    if (go === 'store') { // its habitat is full or not open yet (rules.fits): it waits in storage
      const H = HAB[habitatOf(a)], shut = !G.S.unlocked.includes(H.id);
      G.store(a.id); toast(`${shut ? `${H.name}${josa(H.name, '이', '가')} 열리면 데려갈 수 있어요` : `${H.name}에 자리가 모자라요`} · ${nm}${josa(nm, '은', '는')} 보관함에서 기다려요${gift}`, 3200);
      cardEl.hidden = true; stageOff(); busy = false; resume(); // 27-7a: nothing to see outside, so the nest stays open for the next egg (as 돌려보내기)
    } else if (go === 'look') { // out in its own habitat, and the camera goes there to see it
      const home = habitatOf(a); G.release(a.id); close(); nav.go(home, a.id);
    } else if (go) {
      const fresh = !G.S.codex[key(a.species, a.variant)]; G.release(a.id); close();
      if (hab && habitatOf(a) === habId) hab.drop(a, true); // inbox 43: a look at it, then back
      toast(`${nm}${josa(nm, '이', '가')} ${HAB[habitatOf(a)].name}에 나왔어요${fresh ? ' · 도감에 등록됐어요' : ''}${gift}`, fresh ? 3200 : undefined);
    } else {
      const n = G.sendBack(a.id); heart(e.clientX, e.clientY); toast(`${nm}${josa(nm, '을', '를')} 돌려보냈어요 · ♥+${n}`);
      cardEl.hidden = true; stageOff(); busy = false; resume();
    }
  }
  async function resume() { const p = pending(); if (!p) return draw(); busy = true; const tok = run; await Promise.all([loadModel(SP[p.species].model), loadAcc(p.acc)]); if (tok !== run || el.hidden) return; stageOn(); show(p); card(p); draw(); } // an unanswered card (closed sheet, reload) comes back

  function open() {
    if (!habId) return;
    el.hidden = false; sig = {}; tab = HAB[habId].nest;
    if (!G.S.flags.nestTapped) { hideToast(); G.flag('nestTapped'); }
    draw(); resume();
  }
  function close() { run++; busy = false; shown = null; cardEl.hidden = true; if (st) stageOff(); el.hidden = true; drawBtn(); }

  btn.onclick = open;
  el.addEventListener('click', e => {
    if (e.target === el) return close();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close != null) close();
    else if (b.dataset.go != null) answer(true, e);
    else if (b.dataset.look != null) answer('look', e);
    else if (b.dataset.store != null) answer('store', e);
    else if (b.dataset.back != null) answer(false, e);
    else if (busy) return;
    else if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
    else if (b.dataset.id) { if (G.takeEgg(habId, +b.dataset.id) < 0) toast('부화 칸이 가득 찼어요'); else { sfx('egg'); tip('hatch', '#nslots'); } }
    else if (b.dataset.i != null) {
      const s = G.S.slots[+b.dataset.i], now = G.now();
      if (!s) toast('위의 알을 누르면 이 칸에 들어가요');
      else if (now < s.end) toast(`${RAR[s.egg.rarity].name} 알 · ${span(s.end - now)} 뒤에 깨어나요`);
      else hatchSlot(+b.dataset.i);
    }
  });
  G.on(ev => { if (ev.some(e => e.type === 'reset')) close(); draw(); });

  return {
    attach(api, id) { hab = api; habId = id; draw(); },
    leave() { close(); hab = null; },
    open,
  };
}
