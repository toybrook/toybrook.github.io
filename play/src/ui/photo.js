// 24-1 사진 모드: one button hides the game's buttons and lets the camera go nearer, lower and higher (habitat snap). The hour
// and the weather can be held for the look only (config.js VIEW: nothing is saved, counted or earned meanwhile, main.js),
// a filter, a frame, the logo and the 구경 링크 (69-4) as a small QR in the corner (each can be off). 저장 downloads a JPEG;
// 구경 그림 makes the 9:16 picture with the link's QR (ui/visit.js seeCard) to send.
// The preview is the same drawing: the filter as CSS on the 3D canvas, the rest on a canvas over it (deco); the saved
// picture is the frame drawn again at 2-3x, the filter worked out per pixel with the CSS matrices (tint), then deco.
import { VIEW } from '../config.js';
import * as G from '../game/game.js';
import { seeLink, seeCard, seeSend } from './visit.js'; // 69-4
import { outIn, callName } from '../game/rules.js';
import { sfx } from './sound.js';
import { skyPhoto } from './sky.js'; // 16-2 하늘 기록 사진
let qrcode = null; // 67-2: vendor/qrcode.js (52 KB) is not on the first screen: here when 사진 모드 first opens (the 3D code has it by then)

const HOURS = [['지금', null], ['아침', 7], ['낮', 12], ['노을', 18.5], ['밤', 23]];
const SKIES = [['지금', null], ['맑음', 'clear'], ['비', 'rain'], ['안개', 'fog'], ['무지개', 'rainbow']]; // 25-1 the snow: 비 shows as 눈 (weather.js weatherNow turns 'rain' into its snow)
export const FILTERS = { none: ['없음', ''], warm: ['따뜻하게', 'sepia(0.25) saturate(1.15) brightness(1.03)'],
  film: ['필름', 'sepia(0.18) contrast(0.88) brightness(1.06) saturate(0.85)'], mono: ['흑백', 'grayscale(1) contrast(1.08)'] };
const ADDS = [['frame', '테두리'], ['logo', '로고'], ['code', '구경 QR']];

// the CSS filter functions as 3x3 matrices + offset (Filter Effects 1, in sRGB), clamped after each one like the browser
const MAT = {
  sepia: s => { const k = 1 - s; return [.393 + .607 * k, .769 - .769 * k, .189 - .189 * k, .349 - .349 * k, .686 + .314 * k, .168 - .168 * k, .272 - .272 * k, .534 - .534 * k, .131 + .869 * k]; },
  saturate: s => [.213 + .787 * s, .715 - .715 * s, .072 - .072 * s, .213 - .213 * s, .715 + .285 * s, .072 - .072 * s, .213 - .213 * s, .715 - .715 * s, .072 + .928 * s],
  grayscale: g => { const k = 1 - g; return [.2126 + .7874 * k, .7152 - .7152 * k, .0722 - .0722 * k, .2126 - .2126 * k, .7152 + .2848 * k, .0722 - .0722 * k, .2126 - .2126 * k, .7152 - .7152 * k, .0722 + .9278 * k]; },
  brightness: b => [b, 0, 0, 0, b, 0, 0, 0, b],
  contrast: c => [c, 0, 0, 0, c, 0, 0, 0, c],
};
export function tint(px, css) { // px: RGBA bytes, changed in place
  const ops = [...css.matchAll(/(\w+)\(([\d.]+)\)/g)].map(([, f, v]) => [MAT[f](+v), f === 'contrast' ? (0.5 - 0.5 * v) * 255 : 0]);
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    for (const [m, o] of ops) { const R = cl(m[0] * r + m[1] * g + m[2] * b + o), Gn = cl(m[3] * r + m[4] * g + m[5] * b + o); b = cl(m[6] * r + m[7] * g + m[8] * b + o); r = R; g = Gn; }
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
}

let grainTile = null; // the film grain: one 128 px tile of fixed noise (the same in the preview and the picture)
const grain = () => {
  if (grainTile) return grainTile;
  const c = grainTile = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  let s = 7; for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 256; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
};

// everything over the 3D picture, sized by the width w: film vignette and grain, the frame, the logo, the QR tile
export function deco(x, w, h, o, code) {
  const font = getComputedStyle(document.body).fontFamily;
  if (o.fx === 'film') {
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) / 2);
    v.addColorStop(0, 'rgba(40,24,10,0)'); v.addColorStop(1, 'rgba(40,24,10,.42)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
    x.save(); x.globalAlpha = 0.06; x.globalCompositeOperation = 'overlay'; x.fillStyle = x.createPattern(grain(), 'repeat'); x.fillRect(0, 0, w, h); x.restore();
  }
  const side = o.frame ? Math.round(w * 0.035) : 0, foot = o.frame ? Math.round(w * 0.075) : 0;
  if (o.frame) { x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, side); x.fillRect(0, 0, side, h); x.fillRect(w - side, 0, side, h); x.fillRect(0, h - foot, w, foot); }
  const m = Math.round(w * 0.03); // the gap to the picture's edge (inside the frame)
  if (o.logo) {
    const fs = Math.round(w * 0.036); x.save(); x.font = `800 ${fs}px ${font}`; x.textAlign = 'right'; x.textBaseline = 'middle';
    const y = o.frame ? h - foot / 2 : h - m - fs / 2;
    if (o.frame) x.fillStyle = '#8a6646'; else { x.fillStyle = '#fffaf0'; x.shadowColor = 'rgba(40,25,10,.55)'; x.shadowBlur = fs * 0.35; }
    x.fillText('토이브룩', w - side - m, y); x.restore();
  }
  if (o.code && code) {
    const n = code.getModuleCount(), q = 3, cell = Math.max(2, Math.floor(w * 0.17 / (n + 2 * q))), qs = cell * (n + 2 * q);
    // inbox 25: the words 2.3% of the width (27 px at 1170, was ~19), the tile as wide as they need; the QR as before
    const fs = Math.max(10, Math.round(w * 0.023)), th = qs + Math.round(fs * 1.25), x0 = side + m, y0 = h - foot - m - th;
    x.font = `700 ${fs}px ${font}`; const tw = Math.max(qs, Math.ceil(x.measureText('구경 QR').width + fs)), qx = x0 + Math.round((tw - qs) / 2);
    x.save(); x.fillStyle = '#fffaf0'; x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = cell * 3; x.fillRect(x0, y0, tw, th); x.restore();
    x.fillStyle = '#2b1d12'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) x.fillRect(qx + (q + c) * cell, y0 + (q + r) * cell, cell, cell);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#6b4a2b'; x.fillText('구경 QR', x0 + tw / 2, y0 + qs + fs * 0.55);
  }
}

// getApi: the habitat on screen (habitat.js), getHab: its id. on(): whether 사진 모드 is up (main.js holds hearts and notes then)
export function initPhoto(getApi, getHab) {
  const $ = id => document.getElementById(id), el = $('snap'), ov = $('snapOv'), btn = $('snapBtn');
  const o = { hour: null, sky: null, fx: 'none', frame: true, logo: true, code: true, fold: false };
  let on = false, busy = false, code = null, text = '', msg = '';
  const ratio = () => Math.min(3, (window.devicePixelRatio || 1) * (window.__stageScale || 1));
  const seg = (k, opts) => opts.map(([t, v]) => `<button data-k="${k}" data-v="${v}"${o[k] === v ? ' class="on"' : ''}>${t}</button>`).join('');
  function draw() {
    el.classList.toggle('fold', o.fold);
    el.innerHTML = `<div class="sbody"><div class="row"><b>시간</b><div class="seg">${seg('hour', HOURS)}</div></div><div class="row"><b>날씨</b><div class="seg">${seg('sky', getHab() === 'snow' ? SKIES.map(k => k[1] === 'rain' ? ['눈', 'rain'] : k) : SKIES)}</div></div>
<div class="row"><b>필터</b><div class="seg">${seg('fx', Object.entries(FILTERS).map(([k, [t]]) => [t, k]))}</div></div>
<div class="row"><b>넣기</b><div class="seg">${ADDS.map(([k, t]) => `<button data-add="${k}"${o[k] ? ' class="on"' : ''} aria-pressed="${o[k]}">${t}</button>`).join('')}</div></div>
<div class="row"><b class="w">따라가기</b><select data-follow aria-label="따라갈 친구"><option value="">안 함</option>${getApi()?.hasTrain?.() ? '<option value="train">🚂 장난감 기차</option>' : ''}${outIn(G.S, getHab()).map(a => `<option value="${a.id}">${a.fav ? '★ ' : ''}${callName(a)}</option>`).join('')}</select></div></div>
<p class="smsg" role="status">${msg || '끌어서 돌리고, 두 손가락을 벌려 가까이 봐요 · 시간과 날씨는 보기만 바뀌어요'}</p>
<div class="sbar"><button data-act="fold">${o.fold ? '펼치기' : '접기'}</button><button data-act="home">전체 보기</button><button class="go" data-act="save">저장</button><button data-act="card">구경 그림</button><button data-close>나가기</button></div>`;
    paint();
  }
  function paint() { // the preview: the filter on the 3D canvas, deco over it at the screen's pixels
    const api = getApi(); if (!api || !on) return;
    api.canvas.style.filter = FILTERS[o.fx][1];
    const f = el.querySelector('[data-follow]'); if (f) f.value = api.followed() ?? ''; // 26-4: who the camera follows now (a tap or a drag changes it)
    // inbox 42 G: the whole picture (3D and deco) shrunk into the room under the panel, the saved file as seen. It was slid down
    // under the panel (inbox 25), so about half its bottom (the QR tile, the near ground) was off the screen on a phone
    const sb = el.appendChild(document.createElement('i')); sb.style.cssText = 'position:absolute;height:var(--sa-b)'; // and above the home bar (inbox 40)
    const top = el.offsetHeight, k = Math.max(0.2, (ov.clientHeight - top - sb.offsetHeight) / ov.clientHeight); sb.remove();
    api.snap(true); for (const c of [api.canvas, ov]) { c.style.transformOrigin = '50% 0'; c.style.transform = `translateY(${top}px) scale(${k})`; }
    const r = ratio(), w = Math.round(ov.clientWidth * r), h = Math.round(ov.clientHeight * r);
    if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
    const x = ov.getContext('2d'); x.clearRect(0, 0, w, h); deco(x, w, h, o, code);
  }
  function set(k, v) {
    o[k] = v; VIEW.hour = o.hour; VIEW.weather = o.sky; msg = ''; draw();
  }
  function enter() {
    const api = getApi(); if (!api || on) return;
    if (qrcode === null) return void import('../../vendor/qrcode.js').then(m => m.default, () => false).then(q => { qrcode = q; enter(); qrcode ||= null; }); // offline and never fetched: no tile (asked again next time)
    on = true; msg = ''; text = seeLink(getHab());
    try { const q = qrcode(0, 'L'); q.addData(text); q.make(); code = q; } catch { code = null; } // too long for a QR: no tile
    document.body.classList.add('photo'); api.snap(true); el.hidden = ov.hidden = false; draw();
    if (!code) { msg = '배치가 많아 구경 QR은 사진에 넣지 못해요'; draw(); }
  }
  function leave() {
    if (!on) return; on = false; VIEW.hour = VIEW.weather = null;
    const api = getApi(); if (api) { api.snap(false); api.canvas.style.filter = api.canvas.style.transform = ''; } ov.style.transform = '';
    if (!/[?&]photo/.test(location.search)) document.body.classList.remove('photo');
    el.hidden = ov.hidden = true;
  }
  async function save() {
    const api = getApi(); if (!api || busy) return; busy = true; msg = '저장하는 중…'; draw(); sfx('photo');
    try {
      await new Promise(r => requestAnimationFrame(() => r()));
      const c = api.shot(Math.max(2, ratio())), x = c.getContext('2d', { willReadFrequently: true });
      if (FILTERS[o.fx][1]) { const d = x.getImageData(0, 0, c.width, c.height); tint(d.data, FILTERS[o.fx][1]); x.putImageData(d, 0, 0); }
      deco(x, c.width, c.height, o, code);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)), t = new Date(), p = v => String(v).padStart(2, '0');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `toybrook-${getHab()}-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.jpg`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      msg = `저장했어요 · ${c.width}×${c.height} · 내려받은 파일이나 사진 앱에서 볼 수 있어요`; G.note('photo', 1); // 41 D 첫날 할 일
      const sk = api.sky?.(), got = sk && G.event() && G.evShot({ hab: getHab(), night: sk.hour >= 20 || sk.hour < 5, sky: sk.kind, ball: api.ball?.() }); // 15-1 이벤트 앨범 (15-2: a snowball fight on screen)
      const sp = skyPhoto(c); if (sp) msg += ' · 하늘 기록에 사진을 넣었어요'; // 16-2
      if (got) msg += ` · 이벤트 앨범 한 칸: 「${G.event()?.e.album.slots.find(s => s.id === got.slot)?.name ?? ''}」${got.cover ? ' · 앨범을 다 채워 소품을 받았어요' : ''}`;
    } catch { msg = '저장하지 못했어요 · 다시 해 주세요'; }
    busy = false; draw();
  }
  async function card() { // 69-4: the frame as it is (its filter, no frame or tile) in the 9:16 picture, then out of 사진 모드 to send it
    const api = getApi(), hab = getHab(); if (!api || busy) return; busy = true;
    try { await new Promise(r => requestAnimationFrame(() => r()));
      const c = api.shot(2), x = c.getContext('2d', { willReadFrequently: true });
      if (FILTERS[o.fx][1]) { const d = x.getImageData(0, 0, c.width, c.height); tint(d.data, FILTERS[o.fx][1]); x.putImageData(d, 0, 0); }
      const pic = seeCard(c, hab, text, qrcode); busy = false; leave(); seeSend(pic, hab, text);
    } catch { busy = false; msg = '그림을 만들지 못했어요 · 다시 해 주세요'; draw(); }
  }
  btn.onclick = enter;
  el.onclick = e => {
    const d = e.target.closest('button')?.dataset; if (!d) return;
    if (d.close != null) return leave();
    if (d.act === 'fold') return set('fold', !o.fold);
    if (d.act === 'home') return getApi()?.overview();
    if (d.act === 'save') return save();
    if (d.act === 'card') return card();
    if (d.add) return set(d.add, !o[d.add]);
    if (d.k === 'fx') return set('fx', d.v);
    if (d.k) return set(d.k, d.v === 'null' ? null : d.k === 'hour' ? +d.v : d.v);
  };
  el.onchange = e => { const api = getApi(), v = e.target.value, id = +v; if (e.target.dataset.follow == null || !api) return; if (v === 'train') { if (!api.followTrain()) { msg = '지금은 따라갈 수 없어요'; draw(); } } else if (!id) api.unfollow(); else if (!api.look(id)) { msg = '지금은 따라갈 수 없어요'; draw(); } };
  addEventListener('resize', () => on && paint());
  return { on: () => on, enter, leave, code: () => text, followed: () => { const f = on && el.querySelector('[data-follow]'); if (f) f.value = getApi()?.followed() ?? ''; } };
}
