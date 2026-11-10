// 26-2 소리: all of it made here with Web Audio (noise through filters, a few oscillators); no sound files.
// Ambience by habitat, hour and weather (habitat.js calls ambience() every frame; it moves slowly to what it is told),
// short effects (sfx), and the volumes in PREFS (설정: 전체 / 배경 / 효과, 모두 끄기). Nothing plays before the first
// touch (iPhone needs one), and everything stops while the tab is hidden. Light: no three.js (the first screen has it).
import { PREFS } from '../config.js';
import { HABITATS } from '../game/data.js';

let A = null, out, amb, fx, white, brown;
const L = {}; // ambience layers: name -> { g: GainNode, want: 0..1 }
// each layer's loudness at full volume, and how slowly it follows (s, setTargetAtTime: about 3x this to settle)
// (measured at the default 40%: the beds about -33..-24 dBFS RMS, the effects peak 4..12 dB over them; FX_GAIN lifts the effects)
const LEVEL = { wind: 0.38, water: 0.42, rain: 0.16, hush: 0.3, birds: 0.75, insects: 0.75 }, FADE = 2.5, FX_GAIN = 1.6;
const rnd = (a, b) => a + Math.random() * (b - a);

// 4 s of noise, looping: white (rain, splashes) or brown (wind, water, the snow's hush); the ends meet (no click each loop)
function noise(kind) {
  const n = A.sampleRate * 4, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
  let v = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] = kind === 'brown' ? (v = (v + 0.02 * w) / 1.02) * 3.5 : w; }
  const step = (d[n - 1] - d[0]) / (n - 1); for (let i = 0; i < n; i++) d[i] -= step * i;
  return b;
}
const filter = (type, f, Q = 0.7) => { const x = A.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = Q; return x; };
const panTo = (node, pan) => { if (!pan || !A.createStereoPanner) return node; const p = A.createStereoPanner(); p.pan.value = pan; p.connect(node); return p; };
function lfo(param, hz, depth) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g).connect(param); o.start(); }

// a looping bed of noise through filters into its layer (layers without one only gather scheduled sounds: birds, insects)
function layer(name, buf = null, filters = []) {
  const g = A.createGain(); g.gain.value = 0; g.connect(amb); L[name] = { g, want: 0 };
  if (!buf) return L[name];
  const s = A.createBufferSource(); s.buffer = buf; s.loop = true;
  filters.reduce((n, f) => n.connect(f), s).connect(g); s.start(0, rnd(0, 4));
  return L[name];
}

// one note: an oscillator with a quick rise and a fall (to: glide to this pitch over the note)
function tone(t, f, dur, { type = 'sine', gain = 0.2, to = 0, attack = 0.005, pan = 0, dest = fx } = {}) {
  const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(panTo(dest, pan)); o.start(t); o.stop(t + dur + 0.05);
}
// a short puff of noise through one filter (taps, shutter, raindrops)
function puff(t, dur, type, f, gain, { Q = 0.7, pan = 0, dest = fx } = {}) {
  const s = A.createBufferSource(), g = A.createGain(); s.buffer = white;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(filter(type, f, Q)).connect(g).connect(panTo(dest, pan)); s.start(t, rnd(0, 3.5)); s.stop(t + dur + 0.05);
}
// a small bell: a few partials that ring out, the high ones first
function bell(t, f, dur, gain, dest = fx, pan = 0) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([k, a], i) => tone(t, f * k, dur / (1 + i), { gain: gain * a, attack: 0.003, dest, pan }));
}

// the effects (s: when, from now). Each at most twice at once, and not again within 50 ms (taps in a row stay quiet).
const FX = {
  tap: t => tone(t, 1250, 0.05, { gain: 0.05, to: 950 }),
  egg: t => { tone(t, 280, 0.2, { gain: 0.24, to: 150 }); puff(t, 0.07, 'lowpass', 700, 0.18); },
  hatch: t => { bell(t, 1568, 1.6, 0.16); bell(t + 0.13, 2093, 1.5, 0.12); },
  grown: t => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.1, f, 0.4, { type: 'triangle', gain: 0.16 })); bell(t + 0.3, 1047, 1.2, 0.1); },
  level: t => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.085, f, 0.45, { type: 'triangle', gain: 0.17 })); bell(t + 0.36, 2093, 1.5, 0.11); bell(t + 0.48, 1568, 1.3, 0.08); },
  place: t => { puff(t, 0.05, 'bandpass', 1100, 0.5, { Q: 3 }); tone(t, 430, 0.1, { gain: 0.2, to: 260 }); },
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
const DUR = { hatch: 1.8, grown: 1.6, level: 2, bell: 1.8, fireworks: 1.6, train: 0.7 }, busy = {}, lastAt = {};
const BUZZ = { hatch: [25, 70, 25], grown: 40 }; // 26-3 진동 (Android Chrome; iPhone browsers have no navigator.vibrate)
export function sfx(name, delay = 0) {
  if (!FX[name]) return; // 28-3: a prop's own sound by its id (habitat.js), when it has one
  if (BUZZ[name] && PREFS.buzz) navigator.vibrate?.(BUZZ[name]);
  if (!A || A.state !== 'running' || PREFS.mute) return;
  const t = A.currentTime + delay; if ((busy[name] || 0) >= 2 || t - (lastAt[name] ?? -1) < 0.05) return;
  busy[name] = (busy[name] || 0) + 1; lastAt[name] = t; setTimeout(() => busy[name]--, (delay + (DUR[name] || 0.3)) * 1000);
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

// sounds that come and go inside a layer: birds, crickets, splashes, raindrops, a far tinkle in the snow (each its own clock)
const VOICES = [
  { layer: 'birds', gap: [1.5, 5], play(t) { const f = rnd(2400, 3800), up = Math.random() < 0.5, pan = rnd(-0.7, 0.7);
    for (let i = 0, n = 2 + (Math.random() * 4 | 0); i < n; i++) tone(t + i * rnd(0.09, 0.13), f * (1 + 0.12 * Math.sin(i * 1.7)), 0.08, { to: f * (up ? 1.35 : 0.75), gain: rnd(0.04, 0.08), pan, dest: L.birds.g }); } },
  { layer: 'birds', gap: [3, 8], play(t) { const pan = rnd(-0.8, 0.8); tone(t, 1900, 0.22, { to: 1500, gain: 0.05, pan, dest: L.birds.g }); tone(t + 0.28, 1700, 0.3, { to: 1250, gain: 0.045, pan, dest: L.birds.g }); } },
  ...[[4300, -0.6], [4750, 0.25], [5150, 0.7]].map(([f, pan]) => ({ layer: 'insects', gap: [0.55, 0.95], play(t) { for (let p = 0; p < 3; p++) tone(t + p * 0.045, f, 0.032, { gain: 0.022, attack: 0.004, pan, dest: L.insects.g }); } })),
  { layer: 'water', gap: [0.15, 0.8], play(t) { const f = rnd(320, 800); tone(t, f, 0.07, { to: f * 2.3, gain: rnd(0.05, 0.12), pan: rnd(-0.6, 0.6), dest: L.water.g }); } },
  { layer: 'rain', gap: [0.03, 0.12], play(t) { puff(t, 0.012, 'highpass', 3200, rnd(0.03, 0.09), { pan: rnd(-0.8, 0.8), dest: L.rain.g }); } },
  { layer: 'hush', gap: [4, 9], play(t) { bell(t, rnd(2600, 3400), 2, 0.01, L.hush.g, rnd(-0.5, 0.5)); } },
];
function schedule() {
  if (A.state !== 'running') return;
  const now = A.currentTime; tunes();
  for (const v of VOICES) {
    if (L[v.layer].want < 0.02) { v.next = 0; continue; }
    if (!v.next || v.next < now) v.next = now + rnd(...v.gap) * 0.5;
    while (v.next < now + 0.3) { v.play(v.next); v.next += rnd(...v.gap); }
  }
}

function build() {
  const lim = A.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.2; lim.connect(A.destination); // never clips when several stack
  out = A.createGain(); out.connect(lim); amb = A.createGain(); amb.connect(out); fx = A.createGain(); fx.connect(out);
  white = noise('white'); brown = noise('brown');
  // phone speakers give little under ~400 Hz: every bed keeps some of itself between 400 and 1500 Hz (the rumble below is cut)
  const wind = filter('lowpass', 900); lfo(wind.frequency, 0.07, 450); // gusts: the wind opens and closes
  layer('wind', brown, [filter('highpass', 200), wind]); // the layer's own gain is the cross-fade; the slow swell goes after it
  const swell = A.createGain(); L.wind.g.disconnect(); L.wind.g.connect(swell).connect(amb); lfo(swell.gain, 0.11, 0.35);
  const lap = A.createGain(); layer('water', brown, [filter('bandpass', 560, 0.9), lap]); lfo(lap.gain, 0.23, 0.35); // lapping
  layer('rain', white, [filter('highpass', 900), filter('lowpass', 6500)]);
  layer('hush', brown, [filter('highpass', 150), filter('lowpass', 520)]); // a snowy day: almost nothing, muffled
  layer('birds'); layer('insects');
  setInterval(schedule, 100);
}

// what plays: the habitat (null: none, the world map), its night (0..1), rain and snow (0..1, weather.js)
const now = { hab: null, night: 0, rain: 0, snow: 0 };
export function ambience(hab, night = 0, rain = 0, snow = 0) {
  if (hab !== now.hab && mus.i) music(true); // 28-3: the music box's tune stays in its habitat
  Object.assign(now, { hab, night, rain, snow });
  if (!A) return;
  const day = 1 - night, dry = 1 - Math.min(1, rain + snow), H = HABITATS.find(h => h.id === hab); // its layers: data.js HABITATS sound
  const W = { wind: 0, water: 0, birds: 0, insects: 0, rain: hab ? rain : 0, hush: hab ? snow : 0, ...H?.sound?.({ day, night, dry, rain, snow }) };
  for (const k in W) { const l = L[k]; if (Math.abs(l.want - W[k]) > 0.02 || (!W[k] && l.want)) { l.want = W[k]; l.g.gain.setTargetAtTime(W[k] * LEVEL[k], A.currentTime, FADE); } }
}

// the volumes and 모두 끄기 (설정 calls this after a change)
export function applySound() {
  if (!A) return void touched(); // 27-7e: 켜기 itself (a tap) makes the sound, not the touch after it
  const t = A.currentTime;
  out.gain.setTargetAtTime(PREFS.vAll, t, 0.05); amb.gain.setTargetAtTime(PREFS.vAmb, t, 0.05); fx.gain.setTargetAtTime(PREFS.vFx * FX_GAIN, t, 0.05);
  wake();
}
// running only when it may be heard: touched once, the tab shown, not muted (a silent context still costs battery)
function wake() {
  if (!A) return;
  if (document.hidden || PREFS.mute) { if (A.state === 'running') A.suspend(); } else if (A.state !== 'running') A.resume().catch(() => {});
}
function touched() {
  if (!A) {
    if (PREFS.mute) return; // 27-7e 모두 끄기: no sound made at all (made at the first touch after 켜기)
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    A = new C(); build(); applySound(); ambience(now.hab, now.night, now.rain, now.snow);
  }
  wake(); // iPhone: also after a call or the lock screen ('interrupted'), the next touch brings it back
}
for (const e of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(e, touched, { capture: true, passive: true });
document.addEventListener('visibilitychange', wake);
// every button: a very small tap
document.addEventListener('click', e => { if (e.target.closest?.('button, .spot')) sfx('tap'); }, true);
