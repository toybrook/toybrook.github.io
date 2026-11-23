// 28-6c the game's one clock and its day. Every rule reads the time through now() and counts days with dayOf(), so a
// server clock (now) or a fixed time zone (dayOf) goes in here and nowhere else. UI timers that only measure a tap or
// a fade (decor, hud tips, play bubble, the 자리 비운 사이 10 minutes in main.js,
// report, offline update check) keep Date.now(): they are not game time.
// 238 E2 dev only: ?fest&festnow=2026-12-25 (or 2026-12-25T21:30, KST; noon if no time) runs the game clock from there on.
// A save played so is ahead of the real clock afterwards (S.jAt): a test save only. build-web.mjs turns it off (FESTNOW = null)
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null, FESTNOW = null; // release build: no ?festnow (238 E2)
const SHIFT = (t => /^\d{4}-\d\d-\d\d(T\d\d:\d\d)?$/.test(FESTNOW || '') && Number.isFinite(t) ? t - Date.now() : 0)(Date.parse(/T/.test(FESTNOW || '') ? `${FESTNOW}:00+09:00` : `${FESTNOW}T12:00:00+09:00`));
export const shifted = SHIFT !== 0; // ui/fest.js: no clock check against the server while it is shifted
export const now = () => Date.now() + SHIFT;
export const dayOf = t => new Date(t).toDateString(); // the device's local day: a new day at local midnight
export const dayNo = t => { const d = new Date(t); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }; // 17-3: dayOf as a number (days apart)
