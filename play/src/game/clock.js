// 28-6c the game's one clock and its day. Every rule reads the time through now() and counts days with dayOf(), so a
// server clock (now) or a fixed time zone (dayOf) goes in here and nowhere else. UI timers that only measure a tap or
// a fade (decor, hud tips, play bubble, the 자리 비운 사이 10 minutes in main.js,
// report, offline update check) keep Date.now(): they are not game time.
export const now = () => Date.now();
export const dayOf = t => new Date(t).toDateString(); // the device's local day: a new day at local midnight
export const dayNo = t => { const d = new Date(t); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }; // 17-3: dayOf as a number (days apart)
