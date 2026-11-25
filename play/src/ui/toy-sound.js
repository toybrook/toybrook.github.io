// 260 C 장난감 소리 (docs/design/toy-sounds.md, 2판 user OK 260 C): a figure tapped, lifted, put down sounds like what it is made
// of. Eight families, one file each (assets/sounds/toy-<family>.m4a); the look id (materials.js v.mat || v.id) picks the family
// and a pitch (x). Not listed: vinyl. Kept apart from sound.js (no DOM here) so check-eggs can read the table and the limits.
export const TOY_FAMS = {
  vinyl: 'solid twotone spots stripes gradient glow firefly115 yuzu',
  rubber: 'jelly amber',
  wood: 'wood marquetry najeon beads:1.2',
  ceramic: 'celadon bluewhite pearl blackpearl151 moonpearl kintsugi141',
  metal: 'chrome hammered gold titanium157 fortune vane128 rosegold filigree163 foil',
  glass: 'glass dew stained bubble:1.15 glitter:0.9 mint115 nightsky115 galaxy crystal145 crystal piggy141 moonwater resin151 neon151 aurora glacier polarnight192 starlight lantern snowspirit nebula amberbone dawn unicorn152 baengnok152',
  flock: 'velvet leather xstitch cloud115 cotton',
  stone: 'marble jade ruby141 opal lapis141 star89 emerald151 obsidian151 obsidian163 moonstone151 blackopal163 rosequartz163 amethyst lava malachite sunstone',
};
// the files, spelled out: build-web.mjs ships only the assets/... paths it finds written in the code
export const TOY_URL = { vinyl: 'assets/sounds/toy-vinyl.m4a', rubber: 'assets/sounds/toy-rubber.m4a', wood: 'assets/sounds/toy-wood.m4a', ceramic: 'assets/sounds/toy-ceramic.m4a',
  metal: 'assets/sounds/toy-metal.m4a', glass: 'assets/sounds/toy-glass.m4a', flock: 'assets/sounds/toy-flock.m4a', stone: 'assets/sounds/toy-stone.m4a' };
export const TOY = Object.create(null); // look id -> [family, pitch x]
for (const [f, s] of Object.entries(TOY_FAMS)) for (const w of s.split(' ')) { const [id, k] = w.split(':'); TOY[id] = [f, +k || 1]; }
export const toyFam = id => TOY[id] || ['vinyl', 1];
// 0.87.1: 호일 풍선 (the quilling slot's look is mat foil) metal; the 스켈레톤 태엽 소 (windcow275) left to the vinyl default
// the mythics (235 C Q4 OK): the firemane metal (no look id), the unicorn and the white deer glass (unicorn152 / baengnok152 above)
export const MYTH_FAM = { firemane: 'metal', unicorn: 'glass', baengnok: 'glass' };
// TOY_VOL: 설정 「장난감 소리」 크기 at first (small: the effects' bus is 1 x 1.6, this 0.35, so a toy sound sits about 13 dB under a
// button's); TOY_GAP: the same family's file not again within this (s); TOY_MAX: toy sounds at once
export const TOY_VOL = 0.35, TOY_GAP = 0.1, TOY_MAX = 4;
// may this one play now? st: { n: playing now, last: { name: when } } (sound.js keeps it; n goes down as each ends)
export function toyGate(st, name, now) {
  if (st.n >= TOY_MAX || now - (st.last[name] ?? -1e9) < TOY_GAP) return false;
  st.last[name] = now; return true;
}
// the pitch: smaller animals higher, at most half an octave either way (design 3), a baby higher, x the family's own
export const toyRate = (r, baby, k = 1) => Math.min(1.25, Math.max(0.8, (0.5 / (r || 0.5)) ** 0.35)) * (baby ? 1.15 : 1) * k;
// 설정 (config.js PREFS, kept in this browser apart from the save): toy on / off, vToy 0..1; anything else kept there: the defaults
export const tidyToy = P => { if (typeof P.toy !== 'boolean') P.toy = true; if (!(typeof P.vToy === 'number' && P.vToy >= 0 && P.vToy <= 1)) P.vToy = TOY_VOL; return P; };
