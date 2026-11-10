// Screen assets and quality switches. Game content and numbers (species, models, habitats, odds) live in src/game/data.js.
export const ASSETS = {
  // painted island without UI (top bar, locks and signs are drawn by worldmap.js on top)
  worldmap: 'assets/worldmap_clean.jpg',
};

// Quality switches from the address bar (for comparing on a phone):
//   ?q=low      the 낮음 graphics below, whatever the settings say
//   ?glass=real three.js transmission glass (re-renders the scene) instead of the default one-copy fake refraction
const params = new URLSearchParams(location.search);
// 26-3 그래픽 품질 (설정): pixel ratio cap, the sun's shadow map (0: no shadows; the animals keep their blob shadows), the share
// of grass clumps and of a wildflower patch's flowers kept, rain / snow drops kept, leaves per grass clump (+-). 높음 = as before.
export const GFX = {
  low: { pr: 1.25, shadow: 0, grass: 0.5, flower: 0.6, drops: 0.4, leaf: -1 },
  mid: { pr: 1.5, shadow: 1024, grass: 0.75, flower: 0.8, drops: 0.7, leaf: 0 },
  high: { pr: 2, shadow: 2048, grass: 1, flower: 1, drops: 1, leaf: 0 },
};
export const QUALITY = { glass: params.get('glass') === 'real' ? 'real' : 'fake', get gfx() { return params.get('q') === 'low' ? 'low' : PREFS.gfx; }, get g() { return GFX[this.gfx]; } };
// keeps share d of a list, spread evenly (d = 0.5: every other one)
export const thin = (list, d) => d >= 1 ? list : list.filter((_, i) => Math.floor((i + 1) * d) > Math.floor(i * d));

// ?debug: time skip, odds table, perf readout. The web build (tools/build-web.mjs) turns this line into `false`.
export const DEBUG = false; // release build

// 20-1 open beta. VERSION goes to the feedback form; FEEDBACK_URL is the same form as site/config.js ('TODO' = no button).
// RATING: the rating mark (an image under assets/) and number on the start screen; both empty = hidden (until rated).
export const VERSION = '0.70';
export { EDITION } from './game/data.js'; // inbox 22/31: set in data.js, next to the PACE table it picks
export const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeHXV6tlH6IS3tlu7Xb71qeh1fvIbkzNHUoUHnSY3j_u7dcpA/viewform';
export const FEEDBACK_FIELD = 'entry.2112099919'; // the form's "game info" box, filled in for the player
export const RATING = { mark: '', number: '' };

// 21-1 time of day (src/habitat/daylight.js hourNow is the only clock). 'real': the device's clock; 'cycle': a whole day
// every CYCLE_MINUTES (for testing). ?hour=H fixes the hour (shots). Nothing about the time goes into the save.
export const TIME_MODE = 'real', CYCLE_MINUTES = 24;
export const HOUR = params.has('hour') ? +params.get('hour') : null;
// 21-2 weather (src/habitat/weather.js): each habitat its own, worked out from the game clock alone (the same hour shows the
// same weather; nothing in the save). A spell lasts every[0]..every[1] game hours; odds: each kind's share of the spells;
// rainbow: game hours of rainbow after a rain when the next spell is clear; fade: game hours each one fades in and out.
// ?weather=clear|rain|fog|rainbow fixes it (shots). Only for looking at: no odds, rewards or hearts depend on it.
// 25-1 by: a habitat's own odds (the snow: snow in place of rain)
export const WEATHER = { every: [1, 3], odds: { clear: 60, rain: 25, fog: 15 }, by: { snow: { clear: 55, snow: 30, fog: 15 } }, rainbow: 0.5, fade: 1 / 6 };
export const WEATHER_Q = params.get('weather');
// 24-1 사진 모드: the hour (0..24) and weather ('clear' | 'rain' | 'fog' | 'rainbow') to show, null: as usual. Looks only (nothing is saved or counted)
export const VIEW = { hour: null, weather: null };
// 26-1: the bytes of the 3D code fetched after the first screen (ui/loadbar.js), and whether the offline files (dist-web/sw.js) are
// there. Both lines are rewritten by tools/build-web.mjs; here (the source folder, no sw.js) a rough number and off.
export const CODE_BYTES = 1538938; // release build
export const OFFLINE = true; // release build
// settings sheet (main.js): kept apart from the save. time: 'real' | 'day' (항상 낮); weather: false = 날씨 효과 끄기
// 26-2 소리: mute (모두 끄기), vAll / vAmb / vFx (전체 / 배경 / 효과, 0..1). Low at first (40%).
// 26-3: gfx (GFX above; at first picked from the device), saver (배터리 절약), font 's' | 'm' | 'l', calm (움직임 줄이기;
// null = the device's 「동작 줄이기」), buzz (진동, Android)
export const PREFS = { time: 'real', weather: true, mute: false, vAll: 0.4, vAmb: 1, vFx: 1, gfx: null, saver: false, font: 'm', calm: null, buzz: true, signs: true }; // signs: the zones' name signs (inbox 34)
try { Object.assign(PREFS, JSON.parse(localStorage.getItem('toyhabitat.prefs') || '{}')); } catch { /* broken: defaults */ }
// the first pick: Chrome-family browsers tell the memory (GB, capped at 8): 2 or less 낮음, 4 or less 보통. Safari and Firefox
// don't; there 2 cores or fewer is 보통. Otherwise 높음 (habitat.js still lowers the resolution if frames run long).
if (!GFX[PREFS.gfx]) { const m = navigator.deviceMemory, c = navigator.hardwareConcurrency || 4; PREFS.gfx = m ? (m <= 2 ? 'low' : m <= 4 ? 'mid' : 'high') : c <= 2 ? 'mid' : 'high'; }
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
export const calm = () => PREFS.calm ?? reduce.matches;
// 글자 크기 and 움직임 줄이기 on <html> (style.css: --fs, html.calm); again when the device's setting changes
// the top bar is one row of buttons across the screen: its text grows at most 5% (크게 would push 설정 off a 360px screen)
export const applyLook = () => { const h = document.documentElement, fs = { s: 0.9, m: 1, l: 1.2 }[PREFS.font] || 1; h.style.setProperty('--fs', fs); h.style.setProperty('--fsb', Math.min(fs, 1.05)); h.classList.toggle('calm', calm()); };
applyLook(); reduce.addEventListener?.('change', applyLook);
export const savePrefs = () => { try { localStorage.setItem('toyhabitat.prefs', JSON.stringify(PREFS)); } catch { /* private mode */ } };
