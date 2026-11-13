// 26-2 소리, 13-0 녹음한 소리: the beds and the world's sounds are recordings (assets/sounds, made by tools/make-sounds.mjs from
// CC0 sources: docs/assets.md); the small effects of the buttons and toys and the music box are still made here with Web Audio.
// Beds by habitat, hour and weather (habitat.js calls ambience() every frame; they move slowly to what they are told); the
// world's sounds where they happen (hear(), every frame: birds in the trees, bees at the flowers, frogs at the pond's rim, the
// animals' calls, steps, breath and eating, the play props), heard from the camera (near: louder, left or right: that side);
// short effects (sfx); the volumes in PREFS (설정: 전체 / 배경 / 효과 / 동물 소리, 모두 끄기). Nothing plays before the first touch
// (iPhone needs one), everything stops while the tab is hidden, and a habitat's files are fetched when it is entered (not with the
// first screen). Light: no three.js (the first screen has it).
import { DEBUG, PREFS } from '../config.js';
import { HABITATS } from '../game/data.js';
import { LOOP, BEDS, SPRITES, SHOTS } from './sound-map.js';

let A = null, out, amb, fx, ani, white, meter = null;
// each bed's loudness at full volume (the files are about -22 dBFS RMS; rainLeaves -28 and rainWater -35, their drops kept under the
// peak: lifted here), and how slowly they follow (s, setTargetAtTime: about 3x this to settle). The world's sounds a little over
// the beds; FX_GAIN lifts the effects, ANI_GAIN the animals
const LEVEL = { birdsFar: 0.5, grassWind: 0.4, nightField: 0.3, insects: 0.2, stream: 0.3, frogs: 0.3, pond: 0.4, snowWind: 0.45, hush: 0.4,
  rainLight: 0.4, rainHeavy: 0.4, rainLeaves: 0.45, rainWater: 0.6 }, FADE = 2.5, FX_GAIN = 1.6, ANI_GAIN = 1;
const MAX = 8, MAX_CALLS = 3, NEAR = 14, SP_GAP = 8; // one-shots at once, animal calls at once, steps / breath / eating heard within (m), the same species' calls apart (s)
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];

// 1 s of white noise, looping (the effects' taps, shutter, crackles)
function noise() {
  const n = A.sampleRate, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
const filter = (type, f, Q = 0.7) => { const x = A.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = Q; return x; };
const panTo = (node, pan) => { if (!pan || !A.createStereoPanner) return node; const p = A.createStereoPanner(); p.pan.value = pan; p.connect(node); return p; };

// one note: an oscillator with a quick rise and a fall (to: glide to this pitch over the note)
function tone(t, f, dur, { type = 'sine', gain = 0.2, to = 0, attack = 0.005, pan = 0, dest = fx } = {}) {
  const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(panTo(dest, pan)); o.start(t); o.stop(t + dur + 0.05);
}
// a short puff of noise through one filter (taps, shutter)
function puff(t, dur, type, f, gain, { Q = 0.7, pan = 0, dest = fx } = {}) {
  const s = A.createBufferSource(), g = A.createGain(); s.buffer = white;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(filter(type, f, Q)).connect(g).connect(panTo(dest, pan)); s.start(t, rnd(0, 0.9)); s.stop(t + dur + 0.05);
}
// a small bell: a few partials that ring out, the high ones first
function bell(t, f, dur, gain, dest = fx, pan = 0) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([k, a], i) => tone(t, f * k, dur / (1 + i), { gain: gain * a, attack: 0.003, dest, pan }));
}

// the files: a habitat's own are fetched when it is entered (all of them, so the service worker keeps them for offline play),
// decoded when first played, let go when not wanted (a bed silent 30 s; another habitat's)
const raw = {}, dec = {};
const fetchRaw = url => raw[url] ??= fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
const decode = url => dec[url] ??= fetchRaw(url).then(b => b && new Promise(ok => A.decodeAudioData(b.slice(0), ok, () => ok(null)))); // the callback form: older Safari
const ready = {}; // shot group (sound-map.js SPRITES) -> its AudioBuffer once decoded
function need(g) { if (g in ready) return; ready[g] = null; decode(SPRITES[g]).then(b => { if (g in ready) ready[g] = b; }); }

// a bed: its file looping (two of it half a loop apart, a little left and right: some width from one mono file) into its gain
const L = {}; // name -> { g, want, src: null | [] (loading) | [{ s, p }], idle }
function bed(k, v) {
  let l = L[k];
  if (!l) { if (!v) return; l = L[k] = { g: A.createGain(), want: 0, src: null, idle: 0 }; l.g.gain.value = 0; l.g.connect(amb); }
  if (Math.abs(l.want - v) > 0.02 || (!v && l.want)) { l.want = v; l.g.gain.setTargetAtTime(v * LEVEL[k], A.currentTime, FADE); }
  if (!v || l.src) return;
  l.src = []; decode(BEDS[k]).then(b => {
    if (!b || l.src?.length !== 0) return; // let go meanwhile, or failed (silent)
    const o = rnd(0, LOOP.len);
    l.src = [-0.5, 0.5].map((pan, i) => { const s = A.createBufferSource(), p = panTo(l.g, pan); s.buffer = b; s.loop = true; s.loopStart = LOOP.pad; s.loopEnd = LOOP.pad + LOOP.len;
      s.connect(p); s.start(0, LOOP.pad + (o + i * LOOP.len / 2) % LOOP.len); return { s, p }; });
  });
}

// one take of a recorded sound (sound-map.js SHOTS). at: [x, y, z] in the world (none: in the middle), ref: how near it is at its
// full loudness (m; further: softer as ref / distance, and duller); rate: its pitch; call: an animal's call (MAX_CALLS);
// roll: [n, s apart] the same take again and again, softer each time (the woodpecker). false: not now (not loaded, too many)
const busy = { all: 0, call: 0 }, ear = { x: 0, y: 0, z: 0 }; // ear: the camera
const stats = { max: 0, maxCalls: 0, n: {} }; // ?debug: the most at once (13-0 report)
function play(name, { at, ref = 3, rate = 1, gain = 1, delay = 0, bus = ani, lp = 0, call = false, roll = null } = {}) {
  const S = SHOTS[name], b = S && ready[S[0]];
  if (!b || A.state !== 'running' || busy.all >= MAX || (call && busy.call >= MAX_CALLS)) return false;
  const [from, len] = pick(S[1]), t = A.currentTime + delay, g = A.createGain(); g.gain.value = gain;
  let tail = g, head = g;
  if (at) {
    const p = tail = A.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1;
    if (p.positionX) { p.positionX.value = at[0]; p.positionY.value = at[1]; p.positionZ.value = at[2]; } else p.setPosition(...at);
    g.connect(p); lp = Math.min(lp || 2e4, 18000 / (1 + Math.hypot(at[0] - ear.x, at[1] - ear.y, at[2] - ear.z) / 12)); // far off: the highs go first
  }
  if (lp && lp < 15000) { head = filter('lowpass', lp); head.connect(g); }
  tail.connect(bus);
  const [n, every] = roll || [1, 0]; let s;
  for (let i = 0; i < n; i++) {
    s = A.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    if (i) { const k = A.createGain(); k.gain.value = 0.86 ** i; s.connect(k).connect(head); } else s.connect(head);
    s.start(t + i * every, from, len);
  }
  busy.all++; if (call) busy.call++;
  s.onended = () => { busy.all--; if (call) busy.call--; head.disconnect(); g.disconnect(); tail.disconnect(); };
  if (DEBUG) { stats.max = Math.max(stats.max, busy.all); stats.maxCalls = Math.max(stats.maxCalls, busy.call); stats.n[name] = (stats.n[name] || 0) + 1; }
  return true;
}

// the effects (s: when, from now). Each at most twice at once, and not again within 50 ms (taps in a row stay quiet).
const FX = {
  tap: t => tone(t, 1250, 0.05, { gain: 0.05, to: 950 }),
  egg: t => { tone(t, 280, 0.2, { gain: 0.24, to: 150 }); puff(t, 0.07, 'lowpass', 700, 0.18); },
  hatch: t => { bell(t, 1568, 1.6, 0.16); bell(t + 0.13, 2093, 1.5, 0.12); },
  grown: t => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.1, f, 0.4, { type: 'triangle', gain: 0.16 })); bell(t + 0.3, 1047, 1.2, 0.1); },
  level: t => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.085, f, 0.45, { type: 'triangle', gain: 0.17 })); bell(t + 0.36, 2093, 1.5, 0.11); bell(t + 0.48, 1568, 1.3, 0.08); },
  // 13-0: a plastic 「톡」 (a prop put down, an animal let go: habitat.js); the old made one until the recordings are in
  place: t => { if (!play('toy', { bus: fx, gain: 0.6, rate: rnd(0.94, 1.08), delay: t - A.currentTime })) { puff(t, 0.05, 'bandpass', 1100, 0.5, { Q: 3 }); tone(t, 430, 0.1, { gain: 0.2, to: 260 }); } },
  tok: t => tone(t, 1700, 0.04, { type: 'triangle', gain: 0.07, to: 1250 }), // 66-1 톡톡톡: a heart landing on the counter
  undo: t => tone(t, 700, 0.15, { type: 'triangle', gain: 0.13, to: 380 }),
  photo: t => { puff(t, 0.03, 'highpass', 2500, 0.24); puff(t + 0.07, 0.04, 'highpass', 1800, 0.2); tone(t, 3200, 0.02, { gain: 0.04 }); },
  // 28-3 누르는 장난감: the calling bell (ding-ding), soap bubbles popping, the string lights' switch, a small firework (kept
  // soft: a thin whistle up, a muffled pop, a few crackles), the pinwheels' gust
  bell: t => { bell(t, 1175, 1.7, 0.13); bell(t + 0.24, 1175, 1.5, 0.1); },
  train: t => { for (const d of [0, 0.32]) { tone(t + d, 740, 0.24, { type: 'triangle', gain: 0.07, attack: 0.03 }); tone(t + d, 932, 0.24, { gain: 0.05, attack: 0.03 }); } }, // 28-4: the wind-up train's two toots
  bubbles: t => { for (let i = 0; i < 6; i++) { const f = rnd(900, 1700); tone(t + i * rnd(0.05, 0.12), f, 0.05, { to: f * 1.8, gain: 0.035, pan: rnd(-0.4, 0.4) }); } },
  lights: t => { puff(t, 0.02, 'bandpass', 2400, 0.3, { Q: 4 }); tone(t, 1900, 0.03, { gain: 0.04 }); },
  fireworks: t => { tone(t, 650, 0.75, { to: 1500, gain: 0.02 }); puff(t + 0.8, 0.4, 'lowpass', 700, 0.2); for (let i = 0; i < 7; i++) puff(t + 0.9 + i * rnd(0.05, 0.11), 0.02, 'highpass', 3000, 0.04, { pan: rnd(-0.6, 0.6) }); },
  pinhill: t => { puff(t, 0.9, 'bandpass', 700, 0.14, { Q: 1.2 }); puff(t + 0.12, 0.8, 'bandpass', 1300, 0.08, { Q: 1.2 }); },
};
const DUR = { hatch: 1.8, grown: 1.6, level: 2, bell: 1.8, fireworks: 1.6, train: 0.7 }, fxBusy = {}, lastAt = {};
const BUZZ = { hatch: [25, 70, 25], grown: 40 }; // 26-3 진동 (Android Chrome; iPhone browsers have no navigator.vibrate)
export function sfx(name, delay = 0) {
  if (!FX[name]) return; // 28-3: a prop's own sound by its id (habitat.js), when it has one
  if (BUZZ[name] && PREFS.buzz) navigator.vibrate?.(BUZZ[name]);
  if (!A || A.state !== 'running' || PREFS.mute) return;
  const t = A.currentTime + delay; if ((fxBusy[name] || 0) >= 2 || t - (lastAt[name] ?? -1) < 0.05) return;
  fxBusy[name] = (fxBusy[name] || 0) + 1; lastAt[name] = t; setTimeout(() => fxBusy[name]--, (delay + (DUR[name] || 0.3)) * 1000);
  FX[name](t);
}

// 28-3 오르골: three little tunes of its own (none borrowed), played on music-box tines through the 배경 volume. music() goes to
// the next one (after the last: off); another habitat stops it. Each tune: beats a second, beats a loop, and its notes
// [beat, midi, length in beats] (the tune, then the low notes under it, softer)
const TUNES = [
  { name: '별빛 왈츠', bps: 1.7, loop: 24, mel: [[76, 1], [79, 1], [81, 1], [79, 2], [76, 1], [74, 1], [76, 1], [79, 1], [72, 3], [69, 1], [72, 1], [74, 1], [76, 2], [79, 1], [81, 1], [79, 1], [74, 1], [76, 3]],
    low: [60, 57, 55, 60, 53, 60, 55, 60].flatMap((m, i) => [[i * 3, m], [i * 3 + 1, m + 7], [i * 3 + 2, m + 7]]) },
  { name: '아침 산책', bps: 2, loop: 32, mel: [[79, 1], [83, 0.5], [86, 0.5], [83, 1], [81, 1], [79, 1.5], [76, 0.5], [74, 2], [76, 0.5], [79, 0.5], [81, 1], [83, 1], [81, 1], [79, 3], [0, 1],
    [74, 1], [76, 0.5], [79, 0.5], [81, 1], [79, 1], [76, 1], [74, 1], [71, 2], [74, 0.5], [76, 0.5], [79, 1], [83, 1], [86, 1], [79, 3], [0, 1]],
    low: [67, 64, 60, 67, 60, 64, 62, 67].flatMap((m, i) => [[i * 4, m], [i * 4 + 2, m + 7]]) },
  { name: '자장가', bps: 2.6, loop: 48, mel: [[84, 2], [81, 1], [79, 2], [77, 1], [79, 3], [81, 3], [84, 2], [86, 1], [84, 2], [81, 1], [79, 6], [77, 2], [79, 1], [81, 2], [84, 1], [86, 3], [84, 3], [81, 2], [79, 1], [77, 2], [79, 1], [77, 6]],
    low: [65, 60, 65, 60, 70, 65, 60, 65].flatMap((m, i) => [[i * 6, m], [i * 6 + 3, m + 7]]) },
].map(T => { let b = 0; const ev = T.mel.map(([m, d]) => { const e = [b, m, 0.07]; b += d; return e; }).filter(e => e[1]);
  return { ...T, ev: [...ev, ...T.low.map(([b, m]) => [b, m, 0.035])].sort((a, c) => a[0] - c[0]) }; });
const mus = { i: 0, g: null, at: 0, k: 0 }; // i: the tune (0: none), g: its gain, at: when its loop started, k: the next note
// a tine: a pure note with a faint bright partial (a comb tine's own, about 6.3x), plucked, ringing out
const tine = (t, m, gain, dest) => { const f = 440 * 2 ** ((m - 69) / 12); tone(t, f, 1.5, { gain, attack: 0.004, dest }); tone(t, f * 6.27, 0.18, { gain: gain * 0.12, attack: 0.002, dest }); };
export const playing = () => mus.i;
export function music(stop) { // stop: off whichever tune
  if (mus.g && A) { const g = mus.g; g.gain.setTargetAtTime(0, A.currentTime, 0.12); setTimeout(() => g.disconnect(), 1500); }
  mus.i = stop ? 0 : (mus.i + 1) % (TUNES.length + 1); mus.g = null; // tunes() starts it (27-7e: also when the sound is made only later)
  return mus.i ? TUNES[mus.i - 1].name : null;
}
function tunes() {
  if (!mus.i) return;
  if (!mus.g) { mus.g = A.createGain(); mus.g.connect(amb); mus.at = A.currentTime + 0.15; mus.k = 0; }
  const T = TUNES[mus.i - 1], now = A.currentTime;
  if (mus.at + T.loop / T.bps < now) { mus.at = now + 0.1; mus.k = 0; } // the tab was away: start the loop again
  for (;;) { if (mus.k >= T.ev.length) { mus.k = 0; mus.at += T.loop / T.bps; }
    const [b, m, g] = T.ev[mus.k], t = mus.at + b / T.bps; if (t > now + 0.3) break; tine(t, m, g, mus.g); mus.k++; }
}

// what plays: the habitat (null: none, the world map), its night (0..1), rain and snow (0..1, weather.js)
const cur = { hab: null, night: 0, rain: 0, snow: 0, lily: 0 }; // 17-3 lily: 0..1 the lilies grown on the board here (more frogs)
export const lilies = v => { cur.lily = v; };
const day = () => 1 - cur.night, dry = () => 1 - Math.min(1, cur.rain + cur.snow);
const gust = () => 0.5 + 0.5 * Math.sin(A.currentTime * 2 * Math.PI / 47); // the wind comes and goes (47 s), the leaves rustle at its top

// the world's own sounds, each on its own clock: which (a take of one of s), where (spot), how often now (k 0..1: gap s apart at 1)
const NATURE = [
  { s: ['robin', 'blackbird', 'blackcap'], at: 'tree', k: () => cur.hab !== 'snow' && day() * dry(), gap: [5, 12], gain: 0.4, ref: 8 },
  { s: ['knock'], at: 'tree', k: () => cur.hab === 'meadow' && day() * dry(), gap: [50, 110], gain: 0.35, ref: 8, roll: [13, 1 / 16], rate: [1.25, 1.4] }, // a woodpecker
  { s: ['bee'], at: 'flower', k: () => cur.hab !== 'snow' && day() * dry(), gap: [6, 14], gain: 0.4, ref: 2 },
  { s: ['leaf'], at: 'tree', k: () => cur.hab !== 'snow' && gust() > 0.75, gap: [5, 12], gain: 0.35, ref: 6 },
  { s: ['nightingale'], at: 'tree', k: () => cur.hab === 'meadow' && cur.night * dry(), gap: [20, 45], gain: 0.35, ref: 8 },
  { s: ['owl'], at: 'tree', k: () => cur.hab !== 'pond' && cur.night * (1 - cur.rain), gap: [30, 70], gain: 0.3, ref: 10 },
  { s: ['cricket'], at: 'grass', k: () => cur.hab === 'meadow' && cur.night * dry(), gap: [5, 10], gain: 0.25, ref: 3 }, // the fireflies' night
  { s: ['frog', 'toad'], at: 'rim', k: () => (cur.hab === 'pond' ? 0.4 + 0.6 * cur.night : cur.hab === 'meadow' && 0.7 * cur.night * (1 - cur.rain)) * (1 + cur.lily), gap: [6, 14], gain: 0.4, ref: 5 }, // by the lilies
  { s: ['splash'], at: 'water', k: () => cur.hab !== 'snow' && 1 - 0.6 * cur.rain, gap: [15, 35], gain: 0.3, ref: 5 }, // a fish
  { s: ['thunder'], at: null, k: () => cur.rain > 0.6, gap: [50, 140], gain: 0.3, rate: [0.8, 0.95] }, // far off and low (fx-rain)
];
// where: a tree near what the camera looks at (or somewhere up off to the side), a flower patch near it, open ground near it,
// the pond's rim, its water (ctx.pond: x, z, r and k, the ellipse's z over x)
let W = null; // the world habitat.js last passed (hear)
function spot(kind) {
  const { target: c, ctx, list } = W, near = (o, r) => Math.hypot(o.x - c.x, o.z - c.z) < r, up = (x, z, h) => [x, ctx.heightAt(x, z) + h, z], a = rnd(0, 2 * Math.PI);
  if (kind === 'tree') { const t = list.filter(o => (o.prop === 'tree' || o.prop === 'snowpine') && near(o, 30)), o = t.length && pick(t); const r = rnd(10, 22);
    return o ? up(o.x, o.z, (o.h || 6) * 0.7) : up(c.x + r * Math.cos(a), c.z + r * Math.sin(a), 5); }
  if (kind === 'flower') { const f = list.filter(o => o.prop === 'wildflowers' && near(o, 18)), o = f.length && pick(f); return o ? up(o.x + rnd(-0.6, 0.6), o.z + rnd(-0.6, 0.6), 0.5) : null; }
  if (kind === 'grass') { const r = rnd(2, 9), x = c.x + r * Math.cos(a), z = c.z + r * Math.sin(a); return ctx.walkable(x, z) ? up(x, z, 0.1) : null; }
  const p = ctx.pond, r = kind === 'rim' ? 0.92 : 0.6 * Math.sqrt(Math.random()); if (!p) return null;
  return [p.x + Math.cos(a) * p.r * r, ctx.water, p.z + Math.sin(a) * p.r * (p.k || 1) * r];
}
function nature(now) {
  for (const n of NATURE) {
    const k = +n.k() || 0; if (k < 0.05) { n.next = 0; continue; }
    if (!n.next) n.next = now + rnd(...n.gap) * 0.5 / k; // just come on: sooner than its gap
    if (now < n.next) continue; n.next = now + rnd(...n.gap) / k;
    const at = n.at && spot(n.at); if (n.at && !at) continue;
    play(pick(n.s), { at, ref: n.ref, gain: n.gain, bus: amb, roll: n.roll, rate: n.rate ? rnd(...n.rate) : rnd(0.95, 1.05) });
  }
}

// the animals. call: its call (a shot), rate: its pitch, b: its breath's pitch (petted, asleep, a first cry), bird: petted it
// says its call softly; gain. No call: the quiet ones (rabbit, turtle, otter, capybara, arctic fox); the big snow ones huff
// (their own calls had no free recording: docs/reports/13-0.md); swan and flamingo: the duck's, lower
const VOICE = {
  horse: { call: 'horse', b: 1, gain: 0.7 }, sheep: { call: 'sheep', b: 1.25 }, rabbit: { b: 1.9 }, pig: { call: 'pig', b: 1.15, gain: 0.7 }, cow: { call: 'cow', b: 0.85, gain: 0.6 },
  chicken: { call: 'hen', b: 1.4, bird: 1, gain: 0.7 }, duck: { call: 'duck', b: 1.3, bird: 1 }, turtle: { b: 1.4 }, otter: { b: 1.6 }, swan: { call: 'duck', rate: 0.72, b: 1.1, bird: 1 },
  flamingo: { call: 'duck', rate: 0.82, b: 1.2, bird: 1 }, capybara: { b: 1.15 }, penguin: { call: 'penguin', b: 1.3, bird: 1 }, polarBear: { call: 'breath', rate: 0.62, b: 0.7 },
  seal: { call: 'breath', rate: 0.9, b: 1.05 }, arcticFox: { b: 1.6 }, reindeer: { call: 'breath', rate: 0.8, b: 0.9 }, snowyOwl: { call: 'owl', rate: 1.15, b: 1.3, bird: 1, gain: 0.5 },
};
const QUIET = new Set(['carry', 'drop', 'jump', 'play', 'sleep', 'nuzzle']); // no steps (held up, falling, on a prop, ...)
const mem = new WeakMap(), pm = new WeakMap(), lastCall = {}; // each animal's and play prop's own, the species' last call
function animal(a, now) {
  if (a.hold || !a.obj.visible) return;
  const p = a.position, st = a.state, V = VOICE[a.rec.species] || {}, baby = a.look?.stage === 'baby' ? 1.2 : 1;
  let m = mem.get(a); if (!m) mem.set(a, m = { x: p.x, z: p.z, d: 0, call: now + rnd(5, 60), br: 0, pet: 0 });
  const dd = Math.hypot(p.x - m.x, p.z - m.z), d = Math.hypot(p.x - ear.x, p.y - ear.y, p.z - ear.z), at = () => [p.x, p.y + 0.3, p.z]; m.x = p.x; m.z = p.z;
  // steps: very quiet, by the ground under it, only near the camera
  if (d < NEAR && dd < 0.5 && !QUIET.has(st)) { if ((m.d += dd) > (a.body?.r || 0.4) + 0.35) { m.d = 0; const k = W.ground(p.x, p.y, p.z); if (k) play('step_' + k, { at: [p.x, p.y, p.z], ref: 1.5, gain: 0.3, rate: rnd(0.9, 1.1) * baby }); } }
  else m.d = 0;
  // now and then its call (fewer at night; never two of a species within SP_GAP, never more than MAX_CALLS at once)
  if (now > m.call) { m.call = now + rnd(60, 150) * (cur.night > 0.5 ? 2.5 : 1);
    if (V.call && st !== 'sleep' && st !== 'carry' && now - (lastCall[a.rec.species] ?? -99) > SP_GAP && play(V.call, { at: at(), ref: 6, rate: (V.rate || 1) * baby * rnd(0.92, 1.08), gain: V.gain ?? 0.8, call: true })) lastCall[a.rec.species] = now; }
  // asleep: slow breaths; grazing: small bites (near only)
  if (d < NEAR && now > m.br && (st === 'sleep' || st === 'graze')) {
    if (st === 'sleep') { m.br = now + rnd(3.2, 4.4); play('breath', { at: at(), ref: 2, rate: V.b * 0.8 * baby * rnd(0.95, 1.05), gain: 0.3, lp: 1500 }); }
    else { m.br = now + rnd(2.2, 3.6); play('eat', { at: at(), ref: 2, rate: Math.min(1.6, V.b) * rnd(0.92, 1.08), gain: 0.35 }); }
  }
}
// the play props (play.js): the swing creaks at the front, the seesaw thuds at each end, the ball bounces as it is pushed along,
// the slide whooshes 0.4 s after one gets on (the chute)
function prop(st, now) {
  let s = pm.get(st); if (!s) pm.set(st, s = { a: 0, v: 0, d: 0, bx: null, bz: null, on: false, t: 0 });
  const at = [st.x, (st.y || 0) + 0.8, st.z], gain = 0.45;
  if (st.kind === 'swing' || st.kind === 'seesaw') {
    const x = (st.kind === 'swing' ? st.ang : st.th) || 0, v = x - s.a; s.a = x;
    if (st.kind === 'swing' ? st.on[0] && v < 0 && s.v > 0 && x > 0.2 : st.on[0] && st.on[1] && v * s.v < 0) play(st.kind === 'swing' ? 'creak' : 'knock', { at, ref: 3, gain, rate: st.kind === 'swing' ? rnd(0.95, 1.05) : rnd(0.5, 0.6), lp: st.kind === 'seesaw' ? 1200 : 0 });
    if (v) s.v = v;
  } else if (st.kind === 'ball') {
    if (st.bx != null && s.bx != null && (s.d += Math.hypot(st.bx - s.bx, st.bz - s.bz)) > 1.6) { s.d = 0; play('bounce', { at: [st.bx, st.y || 0, st.bz], ref: 3, gain, rate: rnd(0.9, 1.1) }); }
    s.bx = st.bx; s.bz = st.bz;
  } else if (st.kind === 'slide') {
    const on = !!st.on[0]; if (on && !s.on) s.t = now + 0.4; s.on = on;
    if (s.t && now >= s.t) { s.t = 0; play('whoosh', { at, ref: 3, gain, rate: rnd(0.9, 1.1) }); }
  }
}
// every frame (habitat.js, after the animals moved): the camera (the ear), what it looks at, the animals, the habitat's ctx, its
// props and natives (D.list), and ground(x, y, z): what is underfoot there ('grass' 'dirt' 'wood' 'snow' 'water', null: swimming)
export function hear(cam, target, actors, ctx, list, ground) {
  W = { target, ctx, list, ground };
  if (!A || A.state !== 'running' || !cur.hab) return;
  const l = A.listener, e = cam.matrixWorld.elements; ear.x = e[12]; ear.y = e[13]; ear.z = e[14];
  if (l.positionX) { l.positionX.value = e[12]; l.positionY.value = e[13]; l.positionZ.value = e[14]; l.forwardX.value = -e[8]; l.forwardY.value = -e[9]; l.forwardZ.value = -e[10]; l.upX.value = e[4]; l.upY.value = e[5]; l.upZ.value = e[6]; }
  else { l.setPosition(e[12], e[13], e[14]); l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
  const now = A.currentTime;
  for (const a of actors.values()) animal(a, now);
  for (const st of ctx.play || []) prop(st, now);
}
// petted (habitat.js, a tap on it): a content little breath (a bird: its call, soft and a little higher), once a second at most
export function pet(a) {
  if (!A || A.state !== 'running') return;
  const V = VOICE[a.rec.species] || {}, p = a.position, baby = a.look?.stage === 'baby' ? 1.2 : 1, m = mem.get(a), now = A.currentTime;
  if (m) { if (now < m.pet) return; m.pet = now + 1; }
  if (V.bird) play(V.call, { at: [p.x, p.y + 0.3, p.z], ref: 4, rate: (V.rate || 1) * 1.12 * baby, gain: 0.45 });
  else play('breath', { at: [p.x, p.y + 0.3, p.z], ref: 4, rate: (V.b || 1) * baby * rnd(0.95, 1.05), gain: 0.6, lp: 3000 });
}
// a first cry as its shell opens (nest.js): a bird peeps; the others a small breath, and their call, high, when it is loaded here
export function cry(species) {
  if (!A || A.state !== 'running') return;
  const V = VOICE[species] || {}; need('common');
  setTimeout(() => { if (V.bird) play('chick', { rate: rnd(0.95, 1.1), gain: 0.5 });
    else { play('breath', { rate: (V.b || 1) * 1.5, gain: 0.45 }); if (V.call && V.call !== 'breath') play(V.call, { rate: (V.rate || 1) * 1.35, gain: 0.35, delay: 0.25 }); } }, 350);
}

// a habitat entered: its shots wanted (and the common ones), another's let go, all its files fetched (beds decoded when they play).
// The meadow has a pond too: the pond's shots as well (its frogs at night, a fish)
let here;
function enter(hab) {
  here = hab;
  const H = HABITATS.find(h => h.id === hab), beds = Object.keys(H?.sound?.({ day: 1, night: 1, dry: 1, rain: 1, snow: 1 }) || {}), wet = beds.some(k => k.startsWith('rain'));
  if (wet) beds.push('rainLight', 'rainHeavy');
  const own = hab === 'meadow' ? [hab, 'pond'] : hab === 'dino' ? ['meadow', 'pond'] : [hab], keep = new Set([...beds.map(k => BEDS[k]), SPRITES.common, ...own.map(g => SPRITES[g]), wet && SPRITES.rain]);
  for (const g in ready) if (!keep.has(SPRITES[g])) { delete ready[g]; delete dec[SPRITES[g]]; }
  for (const u in raw) if (!keep.has(u)) delete raw[u];
  if (!hab) return;
  for (const u of keep) if (u) fetchRaw(u);
  for (const g of ['common', ...own]) if (SPRITES[g]) need(g);
}
export function ambience(hab, night = 0, rain = 0, snow = 0) {
  if (hab !== cur.hab && mus.i) music(true); // 28-3: the music box's tune stays in its habitat
  Object.assign(cur, { hab, night, rain, snow });
  if (!A) return;
  if (hab !== here) enter(hab);
  const H = HABITATS.find(h => h.id === hab), h = 0.5 + 0.5 * Math.sin(A.currentTime * 2 * Math.PI / 150); // the rain comes harder and softer (2.5 min)
  const want = hab ? { ...H?.sound?.({ day: day(), night, dry: dry(), rain, snow }) } : {};
  if ('rainLeaves' in want || 'rainWater' in want) Object.assign(want, { rainLight: rain * (1 - 0.6 * h), rainHeavy: rain * h });
  if (rain > 0.05 && 'rainLight' in want) need('rain');
  for (const k in L) if (!(k in want)) bed(k, 0);
  for (const k in want) bed(k, want[k] * (k.endsWith('Wind') ? 0.7 + 0.3 * gust() : 1));
}

// 16-3 책상 모드: 'off' silent, 'amb' the background only (no taps, no animals); null: as set
let desk = null;
export const deskSound = m => { desk = m; applySound(); };
// the volumes and 모두 끄기 (설정 calls this after a change)
export function applySound() {
  if (!A) return void touched(); // 27-7e: 켜기 itself (a tap) makes the sound, not the touch after it
  const t = A.currentTime;
  out.gain.setTargetAtTime(PREFS.vAll, t, 0.05); amb.gain.setTargetAtTime(PREFS.vAmb, t, 0.05); fx.gain.setTargetAtTime(desk ? 0 : PREFS.vFx * FX_GAIN, t, 0.05); ani.gain.setTargetAtTime(desk ? 0 : PREFS.vAnimal * ANI_GAIN, t, 0.05);
  wake();
}
// every 0.1 s: the music box's next notes, the world's sounds, beds silent 30 s let go (their decoded sound: memory)
function tick() {
  if (A.state !== 'running') return;
  const now = A.currentTime; tunes(); if (cur.hab && W) nature(now);
  for (const k in L) { const l = L[k]; if (l.want) { l.idle = 0; continue; }
    if ((l.idle += 0.1) > 30 && l.src) { for (const { s, p } of l.src) { s.stop(); s.disconnect(); if (p !== l.g) p.disconnect(); } l.src = null; delete dec[BEDS[k]]; } }
}
function build() {
  const lim = A.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.2; lim.connect(A.destination); // never clips when several stack
  out = A.createGain(); out.connect(lim); amb = A.createGain(); amb.connect(out); fx = A.createGain(); fx.connect(out); ani = A.createGain(); ani.connect(out);
  white = noise();
  setInterval(tick, 100);
  if (DEBUG) { meter = A.createAnalyser(); meter.fftSize = 4096; lim.connect(meter); window.__snd = { get A() { return A; }, L, ready, busy, stats, cur, meter, play, buses: { out, amb, fx, ani } }; } // 13-0: measured in the report
}
// running only when it may be heard: touched once, the tab shown, not muted (a silent context still costs battery)
function wake() {
  if (!A) return;
  if (document.hidden || PREFS.mute || desk === 'off') { if (A.state === 'running') A.suspend(); } else if (A.state !== 'running') A.resume().catch(() => {});
}
function touched() {
  if (!A) {
    if (PREFS.mute) return; // 27-7e 모두 끄기: no sound made at all (made at the first touch after 켜기)
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    A = new C(); build(); applySound(); ambience(cur.hab, cur.night, cur.rain, cur.snow);
  }
  wake(); // iPhone: also after a call or the lock screen ('interrupted'), the next touch brings it back
}
for (const e of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(e, touched, { capture: true, passive: true });
document.addEventListener('visibilitychange', wake);
// every button: a very small tap
document.addEventListener('click', e => { if (e.target.closest?.('button, .spot')) sfx('tap'); }, true);
