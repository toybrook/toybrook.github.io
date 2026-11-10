// All game content and numbers, in one place. No other file names a species, habitat, variant, material,
// accessory or egg type, or knows how many there are: they all read these lists.
//   new species      = one line in SPECIES (+ its MODELS entry if it has a new body, + its legendary looks in materials.js)
//   new shared look  = one line in SHARED_VARIANTS (+ the material in materials.js); every species gets it
//   new species-only = one line in that species' `extra` (+ the material)
//   new colour       = one entry in a `colors` list (or a species' `palette`)
//   new accessory    = one line in ACCESSORIES (+ its GLB from tools/bake-accessories.mjs)
//   new egg / event  = one line in EGG_TYPES
//   new habitat      = one line in HABITATS (it unlocks after the one before it)
//   new prop         = one line in PROPS (+ its look in that habitat's props.js decorModel)
// Pure data: no DOM, no three.js, so tools/check-eggs.mjs can import it in Node.

export const SCHEMA_VERSION = 10; // shape of the save; bump with a migration in rules.js (2: pity, album, animal acc/pending; 3: animal color, colors seen; 4: display, props; 5: growth gauge, 꼬마 사탕, codex baby/adult; 6: habitat expansion; 7: natives as props, ground paint; 8: 정원사 레벨 xp; 9: 도전 과제 ach, title, stats; 10: 28-1 zones, props past the open ground put away)
export const CONTENT_VERSION = 8; // bump when the lists below change (3: launch materials, one legendary each; marble and gold left the lists; 4: colour ids glitter gold -> violet, amber yellow -> honey; 5: meadow rabbit, pig, chicken; 6: meadow sheep, cow; 7: pond (turtle, otter, swan, flamingo, capybara; the duck moved from the meadow); 8: snow (penguin, polar bear, seal, arctic fox, reindeer, snowy owl))

const MIN = 60 * 1000;
// inbox 22: which build this is. 'beta' now; 'release' at launch. A release build opens no beta save or backup (all start
// over); the save and every backup carry it. Only here (config.js passes it on; the decor code of 24-2 is layout only and
// opens in either). It also picks the PACE table below.
export const EDITION = 'beta';
// inbox 31 진행 속도, one table per edition. beta: quick and fun (the open beta; check-eggs sim 31 sets it against its goals:
// 3 hatches and a first adult in a new game's first 10 minutes, the pond in a day, the snow in 3, level 10 in 2 days and 20
// and 땅 넓히기 step 6 in about a week, for 3 visits a day of 10 minutes). release: the numbers as they were (sims 16~18), to be
// set again before launch. Never in here: the odds (RARITIES, EGG_TYPES odds, tierWeight, color, secret) and the pity counts.
//   nest:   one egg every `every` per open habitat nest, piling up to `max` while closed; a new game starts with `start`
//           (startRarity); its first `early.n` eggs (hatched + in slots + in nests) come every early.every; a habitat that
//           opens starts with `onUnlock` eggs (rolled as usual)
//   hatch:  x the egg type's hatchScale;   slots: hatch slots
//   grow:   baby -> adult (inbox 14): a gauge that fills with time while the baby is out (time: the variant's rarity), plus
//           `pet` for each petting tap that gives a heart and `feed` for each feed (at most `feeds` a day per baby)
//   heart:  temporary (19단계 특별 행동 replaces it): tap an animal, once per cooldown each, `daily` a day (refills at local midnight)
//   sendBack: hearts for sending back a variant already in the codex (on the reveal card). Never shards
//   unlock: next habitat: this share of the previous codex + this many hearts (a threshold, not spent)
//   expand: 땅 넓히기 prices;   xp: 정원사 레벨 XP (BALANCE.level.xp)
//   play:   28-2 놀이 소품: their prices (PROPS) and the level each opens at (merged into BALANCE.level.unlock). Set again with the
//           release balance (11차): release has the beta numbers for now. 28-6: the 땅 tab's stamps too, and the line brushes' levels
export const PACE = {
  release: {
    nest: { every: 60 * MIN, max: 8, start: 1, startRarity: 'common', early: { n: 0, every: 60 * MIN }, onUnlock: 0 },
    hatch: { common: 5 * MIN, rare: 30 * MIN, heroic: 120 * MIN, legendary: 480 * MIN },
    slots: 2,
    grow: { time: { common: 20 * MIN, rare: 40 * MIN, heroic: 90 * MIN, legendary: 180 * MIN }, pet: 0.02, feed: 0.1, feeds: 3 },
    heart: { perTap: 1, cooldown: 10 * 1000, daily: 20 },
    sendBack: { common: 2, rare: 5, heroic: 15, legendary: 50 },
    codexHeart: 0,
    unlock: { codex: 0.2, hearts: 30 },
    expand: [20, 45, 140, 200, 400, 650],
    xp: { codex: 10, grown: 4, pet: 1, petDaily: 10, login: 5, achieve: 10 },
    play: { price: { seesaw: 70, ball: 30, hammock: 60, feeder: 40, campfire: 50, slide: 120, fountain: 150, musicbox: 80, bubbles: 60, lights: 70, fireworks: 60, pinhill: 90, bell: 50, rail: 10, railcurve: 10, railfork: 20, railbridge: 40, table: 40, shelf: 50, platform: 70, doll: 30, hillock: 40, puddle: 40, flowermound: 50, rockmound: 50 }, level: { 'set:friends': 6, 'prop:slide': 10, 'prop:fountain': 12, 'set:toys': 8, 'set:train': 7, 'set:home': 5, 'brush:stonepath': 3, 'prop:hillock': 3, 'brush:fenceline': 4, 'prop:puddle': 4, 'brush:plank': 5, 'prop:flowermound': 5, 'brush:wall': 6, 'prop:rockmound': 6 } },
  },
  beta: { // max 20: 10 h of eggs (the night between the last visit and the first); slots 3: with 2 the snow opened on day 4 (inbox-31.md)
    nest: { every: 30 * MIN, max: 20, start: 1, startRarity: 'common', early: { n: 4, every: 2 * MIN }, onUnlock: 3 },
    hatch: { common: 1 * MIN, rare: 3 * MIN, heroic: 8 * MIN, legendary: 20 * MIN },
    slots: 3,
    grow: { time: { common: 5 * MIN, rare: 10 * MIN, heroic: 20 * MIN, legendary: 40 * MIN }, pet: 0.02, feed: 0.1, feeds: 3 },
    heart: { perTap: 1, cooldown: 10 * 1000, daily: 120 },
    sendBack: { common: 6, rare: 15, heroic: 40, legendary: 120 },
    codexHeart: 3,                                   // inbox 38: hearts when a codex cell is filled for the first time
    unlock: { codex: 0.2, hearts: 30 },
    expand: [20, 45, 140, 200, 400, 650],
    xp: { codex: 8, grown: 2, pet: 1, petDaily: 10, login: 5, achieve: 10 },
    play: { price: { seesaw: 70, ball: 30, hammock: 60, feeder: 40, campfire: 50, slide: 120, fountain: 150, musicbox: 80, bubbles: 60, lights: 70, fireworks: 60, pinhill: 90, bell: 50, rail: 10, railcurve: 10, railfork: 20, railbridge: 40, table: 40, shelf: 50, platform: 70, doll: 30, hillock: 40, puddle: 40, flowermound: 50, rockmound: 50 }, level: { 'set:friends': 6, 'prop:slide': 10, 'prop:fountain': 12, 'set:toys': 8, 'set:train': 7, 'set:home': 5, 'brush:stonepath': 3, 'prop:hillock': 3, 'brush:fenceline': 4, 'prop:puddle': 4, 'brush:plank': 5, 'prop:flowermound': 5, 'brush:wall': 6, 'prop:rockmound': 6 } },
  },
};
const P = PACE[EDITION];
export const BALANCE = {
  nest: P.nest, hatch: P.hatch, slots: P.slots, grow: P.grow, heart: P.heart, sendBack: P.sendBack, codexHeart: P.codexHeart, // PACE (above)
  candy: { price: 15, free: 1 },                     // 꼬마 사탕 (inbox 14): holds a baby's growth (nothing shows on it); given back when it grows on. Hearts; a new game has `free`
  pity: { heroic: 30, legendary: 180 },              // shard gauges per egg type: every egg cracked +1 to each; full = the next egg is that rarity (legendary first).
                                                     // A natural one of that rarity or better empties the gauge. Guaranteed eggs prefer variants not owned yet
  secret: { chance: 0.02, sendBackX: 2 },            // any hatch: this chance of wearing one accessory (all equally likely); sending a secret back pays x2
  unlock: P.unlock,                                  // PACE
  maxVisible: 12,                                    // animals out in one habitat; also each zone's room (HABITATS room). Over either: storage
  decor: { max: 8, rails: 40 },                     // props placed in one habitat at once, before 땅 넓히기 (then expand.decor).
                                                     // rails (28-4): rail pieces are counted apart (a bridge counts 2), at most this many
  // 땅 넓히기 (21-3b, 6 steps since 22-2): per habitat, bought with hearts (spent), optional. Step n: the habitat's room x room[n-1]
  // and visible[n-1] animals out (instead of maxVisible), decor[n-1] props placed (instead of decor.max, inbox 16); the board one
  // band wider all round (layout.js; step 6 about twice step 0). Prices: check-eggs sim 17 (steps 1-3) and 17b (4-6: about 2
  // weeks to step 4, 1-2 months to step 6 for normal play). Animals stop at 20: 24 at step 6 fell under 30fps on a phone-size
  // screen with the CPU slowed 4x (22-2 report)
  expand: { price: P.expand, room: [1.25, 1.5, 1.75, 1.83, 1.92, 2.0], visible: [14, 16, 18, 20, 22, 24], decor: [11, 14, 17, 20, 23, 26] },
  // 23-1 정원사 레벨: XP for a new codex cell (the most), a baby growing up, petting (pet for each of the day's first petDaily
  // hearts), the day's first visit (no streak), 도전 과제 (23-2). at[n-1]: the total XP of level n (check-eggs sim 18: normal play
  // about level 5 the first day, 10 in a week, 20 in one to two months); past the table, `after` more XP a level (nothing new).
  // unlock: what a level lets the player buy (prices as before): set: every prop of that SETS entry, prop:, brush: (BRUSHES),
  // expand:n = 땅 넓히기 step n. What is not listed is there from level 1. Opening a habitat still asks for its codex (unlock).
  level: {
    xp: P.xp, // PACE
    at: [0, 15, 40, 70, 100, 150, 210, 290, 380, 570, 660, 750, 840, 930, 1020, 1110, 1200, 1290, 1390, 1490],
    after: 100,
    unlock: {
      2: ['set:ranch'], 3: ['expand:2', 'brush:sand'], 4: ['set:woods'], 5: ['set:water', 'prop:picnic'], 6: ['prop:windmill'], 7: ['set:night'],
      8: ['expand:3', 'prop:well'], 9: ['set:play', 'brush:gravel'], 10: ['prop:arch'], 11: ['expand:4'], 12: ['brush:bloom'], 13: ['prop:falls'],
      14: ['expand:5'], 15: ['prop:lighthouse'], 16: ['prop:barn'], 17: ['prop:greenhouse'], 18: ['expand:6'], 19: ['prop:waterpav'], 20: ['prop:treehouse'],
    },
  },
  attract: { per: 0.25, max: 0.5 },                  // each placed prop a species likes (PROPS effect): that species' weight in the habitat's nest eggs +25 %, at most +50 %.
                                                     // Species only: rarity, variants and colours never change
  preferMissing: { on: false, weight: 3 },           // normal eggs: weight variants nobody has yet. Off by design (decisions.md 16-1)
  tierWeight: {                                      // variants of one rarity in one species: weight by the variant's tier (players never see tiers; ?debug shows the %)
    common: { often: 1, normal: 1, seldom: 1 },
    rare: { often: 1.5, normal: 1, seldom: 0.8 },
    heroic: { often: 1.3, normal: 1, seldom: 0.7 },
  },
  color: { normal: 1, seldom: 0.25 },                // a variant's colours: weight of a normal / a seldom one (rolled after the variant)
};
for (const [k, lv] of Object.entries(P.play.level)) (BALANCE.level.unlock[lv] ??= []).push(k); // 28-2 (PACE play)

// In order, rarest last. egg: what an egg of this rarity looks like (material + colours; none = the material's first colour).
// 28-6c display: hue/sat the shard gauge's colour (nest.js, the rarities with a gauge); precious: 돌려보내기 asks once more (store.js)
export const RARITIES = [
  { id: 'common', name: '일반', egg: { mat: 'spots', colors: { body: '#fff1d6', second: '#e2ad7a', accent: '#fff1d6' } } },
  { id: 'rare', name: '희귀', egg: { mat: 'glass' } },
  { id: 'heroic', name: '영웅', egg: { mat: 'bluewhite' }, hue: 218, sat: 60 },
  { id: 'legendary', name: '전설', egg: { mat: 'gold' }, hue: 42, sat: 85, precious: true },
];

// Every species gets all of these (variant id = material id). Rarity is how showy the look is, not what it is made of.
// tier: often / normal / seldom (BALANCE.tierWeight). colors: [{ id, name, ...the material's colour values, seldom? }]
// (the first is the default; a species' `palette` replaces a list). Commons have no shared list: each species paints them.
// A colour is the same look in other colours; a different texture, light or pattern is a new variant.
// Rarity shows in the material only: accessories are a separate secret (BALANCE.secret).
export const SHARED_VARIANTS = [
  { id: 'solid', rarity: 'common', tier: 'normal', name: '단색' },
  { id: 'twotone', rarity: 'common', tier: 'normal', name: '투톤' },
  { id: 'spots', rarity: 'common', tier: 'normal', name: '점박이' },
  { id: 'stripes', rarity: 'common', tier: 'normal', name: '줄무늬' },
  { id: 'gradient', rarity: 'common', tier: 'normal', name: '그라데이션' },
  { id: 'glass', rarity: 'rare', tier: 'often', name: '유리', colors: [
    { id: 'clear', name: '맑은', tint: '#f3faff' }, { id: 'sea', name: '바다', tint: '#8fd6ea' }, { id: 'amethyst', name: '자수정', tint: '#c7a2f2', seldom: true }] },
  { id: 'jelly', rarity: 'rare', tier: 'normal', name: '젤리', colors: [
    { id: 'strawberry', name: '딸기', body: '#ffbcc9' }, { id: 'grape', name: '포도', body: '#c9a6ff' }, { id: 'melon', name: '멜론', body: '#b4ec94', seldom: true }] },
  { id: 'celadon', rarity: 'rare', tier: 'normal', name: '청자', colors: [
    { id: 'jade', name: '비색', body: '#a9cbb2', accent: '#86b495' }, { id: 'sky', name: '하늘빛', body: '#a8c5d8', accent: '#85a6be' }, { id: 'honey', name: '황유', body: '#d9c48c', accent: '#bba366', seldom: true }] },
  { id: 'glow', rarity: 'rare', tier: 'normal', name: '야광', colors: [
    { id: 'lime', name: '연두', body: '#b4ff3c' }, { id: 'sky', name: '하늘', body: '#5fd6ff' }, { id: 'pink', name: '분홍', body: '#ff7ccc', seldom: true }] },
  { id: 'glitter', rarity: 'rare', tier: 'seldom', name: '글리터 레진', colors: [
    { id: 'violet', name: '보랏빛', tint: '#f0e6ff', glitter: '#9a55ff' }, { id: 'silver', name: '은빛', tint: '#eef3fb', glitter: '#e6edf7' }, { id: 'pink', name: '분홍', tint: '#ffe4ee', glitter: '#ff86bd', seldom: true }] },
  { id: 'bluewhite', rarity: 'heroic', tier: 'often', name: '청화백자', colors: [
    { id: 'cobalt', name: '청화', ink: '#1e3a94' }, { id: 'iron', name: '철화', ink: '#6e3b1c' }, { id: 'copper', name: '진사', ink: '#a8262c', seldom: true }] },
  { id: 'najeon', rarity: 'heroic', tier: 'normal', name: '자개', colors: [
    { id: 'black', name: '흑칠', body: '#120e0c' }, { id: 'green', name: '녹칠', body: '#0c2a1c' }, { id: 'red', name: '주칠', body: '#5e140e', seldom: true }] },
  { id: 'bubble', rarity: 'heroic', tier: 'normal', name: '비눗방울 펄', colors: [
    { id: 'clear', name: '맑은', tint: '#f6fbff' }, { id: 'sky', name: '하늘', tint: '#b9e0ff' }, { id: 'pink', name: '분홍', tint: '#ffcfe3', seldom: true }] },
  { id: 'stained', rarity: 'heroic', tier: 'seldom', name: '스테인드글라스', colors: [
    { id: 'chapel', name: '성당', a: '#c4102e', b: '#1840c8', c: '#0f9a4a', d: '#8a28c8' }, { id: 'forest', name: '숲', a: '#0e8f4a', b: '#78c41a', c: '#0f7d8c', d: '#1c4fb0' }, { id: 'sunset', name: '노을', a: '#f08418', b: '#c8143c', c: '#8a28b0', d: '#f5c21a', seldom: true }] },
  // 대리석 (marble) left the launch list in 16-2; its look stays in materials.js as an update candidate.
];

// Secret accessories: separate GLBs (tools/bake-accessories.mjs), worn at a model attach slot, small on a baby and full size
// on an adult. Own colours (keyed by GLB material name), never the variant's. Any animal can hatch wearing one (BALANCE.secret).
export const ACCESSORIES = {
  strawhat: { name: '밀짚모자', wear: '밀짚모자를 쓰고', slot: 'head', file: 'assets/models/acc_strawhat.glb', colors: { body: '#ebc46e', accent: '#d9573f' } },
  ribbon: { name: '리본', wear: '리본을 달고', slot: 'neck', file: 'assets/models/acc_ribbon.glb', colors: { body: '#ee5577' } },
  flowercrown: { name: '꽃 화관', wear: '꽃 화관을 쓰고', slot: 'head', file: 'assets/models/acc_flowercrown.glb', colors: { body: '#6fae55', accent: '#ffb7cc', center: '#ffd54a' } },
  sunglasses: { name: '선글라스', wear: '선글라스를 끼고', slot: 'eye', file: 'assets/models/acc_sunglasses.glb', colors: { body: '#26232a', accent: '#2c3e58' } },
  scarf: { name: '목도리', wear: '목도리를 두르고', slot: 'neck', file: 'assets/models/acc_scarf.glb', colors: { body: '#d84b4b', accent: '#fff3e2' } },
  // 28-6b: nineteen more (24). also: a second slot it takes (the medal hangs on the chest, so the otter's pebble gives way);
  // glow: its materials that shine softly by night (emissive x the night, plain vinyl by day)
  crown: { name: '꼬마 왕관', wear: '꼬마 왕관을 쓰고', slot: 'head', file: 'assets/models/acc_crown.glb', colors: { body: '#f2c14e', center: '#e2465a' } },
  beret: { name: '베레모', wear: '베레모를 쓰고', slot: 'head', file: 'assets/models/acc_beret.glb', colors: { body: '#3d4f86' } },
  beanie: { name: '방울 털모자', wear: '방울 털모자를 쓰고', slot: 'head', file: 'assets/models/acc_beanie.glb', colors: { body: '#4f9bd9', accent: '#fff3e2' } },
  partyhat: { name: '고깔 파티모자', wear: '고깔 파티모자를 쓰고', slot: 'head', file: 'assets/models/acc_partyhat.glb', colors: { body: '#f07aa8', accent: '#ffe066' } },
  mushroom: { name: '버섯 모자', wear: '버섯 모자를 쓰고', slot: 'head', file: 'assets/models/acc_mushroom.glb', colors: { body: '#d9473f', accent: '#fff6e8' } },
  headphones: { name: '헤드폰', wear: '헤드폰을 쓰고', slot: 'eye', also: 'head', file: 'assets/models/acc_headphones.glb', colors: { body: '#7fc8c0', accent: '#f4f1ea' } },
  earmuffs: { name: '귀마개', wear: '귀마개를 하고', slot: 'eye', also: 'head', file: 'assets/models/acc_earmuffs.glb', colors: { body: '#c9b8e8', accent: '#ffc4d6' } },
  bowtie: { name: '나비넥타이', wear: '나비넥타이를 매고', slot: 'neck', file: 'assets/models/acc_bowtie.glb', colors: { body: '#d8433f', accent: '#fffaf0' } },
  bell: { name: '방울 목걸이', wear: '방울 목걸이를 달고', slot: 'neck', file: 'assets/models/acc_bell.glb', colors: { body: '#c8463c', accent: '#f2c14e' } },
  pearls: { name: '진주 목걸이', wear: '진주 목걸이를 걸고', slot: 'neck', file: 'assets/models/acc_pearls.glb', colors: { body: '#e8dccb', center: '#fbf4ea' } },
  bandana: { name: '반다나', wear: '반다나를 두르고', slot: 'neck', file: 'assets/models/acc_bandana.glb', colors: { body: '#3a78c8' } },
  medal: { name: '메달', wear: '메달을 걸고', slot: 'neck', also: 'chest', file: 'assets/models/acc_medal.glb', colors: { body: '#f2c14e', accent: '#3f74c9' } },
  glasses: { name: '동그란 안경', wear: '동그란 안경을 쓰고', slot: 'eye', file: 'assets/models/acc_glasses.glb', colors: { body: '#6b4a34' } },
  heartglasses: { name: '하트 선글라스', wear: '하트 선글라스를 끼고', slot: 'eye', file: 'assets/models/acc_heartglasses.glb', colors: { body: '#e8507a', accent: '#7a2140' } },
  monocle: { name: '외눈 안경', wear: '외눈 안경을 끼고', slot: 'eye', file: 'assets/models/acc_monocle.glb', colors: { body: '#d9b04a', center: '#d9b04a' } },
  goggles: { name: '물안경', wear: '물안경을 쓰고', slot: 'eye', file: 'assets/models/acc_goggles.glb', colors: { body: '#3fbfc0', accent: '#1d4f63' } },
  backpack: { name: '꼬마 배낭', wear: '꼬마 배낭을 메고', slot: 'back', file: 'assets/models/acc_backpack.glb', colors: { body: '#e07a3a', accent: '#f6d06a' } },
  cape: { name: '망토', wear: '망토를 두르고', slot: 'back', file: 'assets/models/acc_cape.glb', colors: { body: '#c8343f', accent: '#f2c14e' } },
  wings: { name: '반짝 날개', wear: '반짝 날개를 달고', slot: 'back', glow: ['body', 'accent'], file: 'assets/models/acc_wings.glb', colors: { body: '#fbf6ff', accent: '#ffe9a8' } },
};
// A legendary's own item (its `item`, inbox 10), held at the model's attach slot like an accessory but in the look's
// materials (materials.js LOOKS: `item`); baked by tools/bake-props.mjs. A secret accessory in the same slot wins.
export const LEGEND_ITEMS = {
  moonstone: { slot: 'chest', file: 'assets/models/prop_moonstone.glb' }, // 수달: a glowing crescent pebble held to the chest
  yuzu: { slot: 'head', file: 'assets/models/prop_yuzu.glb' },            // 카피바라: a yuzu on the head
};

// Bodies. files: baked GLBs (tools/bake-*.mjs), loaded only when a habitat that has the species is entered.
// move: which behaviour drives it (src/animals/<move>.js). Per stage: s = figure scale, sink = how deep it floats,
// r + seg = the body seen from above, in world units: the line seg = [back, front] along its facing, thickened by r
// (a capsule; animals keep these apart, animals/crowd.js; measured from the GLBs' bounds), legs = pivots of the separately baked leg
// (keep in step with the bake script), attach = accessory slots { p: position, r: rotation, s: scale } in model units.
// eye = the head centre (sunglasses are built round it). A baby's slots fit its own (bigger) head.
// All species are written in model units (h = top of the model, the bake script prints them) and sized by SIZE.

// Sizes (17-2): each species' adult height (feet to the top of the head or ears; a swimmer above the waterline) against the
// adult horse = 1.00; a baby is `baby` of its adult (0.70~0.80). unit = the adult horse in world units. Change a number
// here to resize a species. Species not in the game yet are written ahead. inbox 1 (temporary, the user to confirm):
// duck 0.40 -> 0.30 (a long low body read as big as the pig), rabbit 0.40 -> 0.48 (ears count in its height), chicken 0.44.
export const SIZE = {
  unit: 4.5, baby: 0.75,
  horse: 1.00, cow: 0.95, polarBear: 1.05, reindeer: 0.95, flamingo: 0.85, sheep: 0.70, pig: 0.60, swan: 0.60, capybara: 0.55, // the polar bear is also the longest
  penguin: 0.55, seal: 0.45, arcticFox: 0.45, rabbit: 0.48, chicken: 0.44, otter: 0.40, snowyOwl: 0.40, duck: 0.30, turtle: 0.30, // the seal lies down
};
// a stage in model units -> scale s, and sink / r / seg in world units (legs and attach stay in model units)
export const sized = (id, stage, m) => {
  const s = SIZE.unit * SIZE[id] * (stage === 'baby' ? SIZE.baby : 1) / (m.h - (m.sink || 0));
  return { ...m, s, sink: (m.sink || 0) * s, r: m.r * s, seg: m.seg.map(v => v * s) };
};
// Adult horses (tools/bake-horse.mjs). d (17-3, finished 17-4) = the 17-1 adult with longer legs and neck, a slightly
// smaller head, the muzzle back to the mock's head length, a bigger tail high on the rump and bigger ears; tuned against
// docs/concepts/horse_mock1.jpg. The game uses d. old = the 17-1 adult and foal, kept only for tools/lineup.html?cmp.
// inbox 10: d's and the foal's h stay the 19-1 tops (2.395, 2.341). The ears grew 1.3x and stand above them now (the bake
// prints 2.514, 2.487); with the new tops every horse would come out 4% smaller, and the user asked for longer ears only.
export const HORSES = {
  d: { file: 'assets/models/horse_adult_d.glb', h: 2.395, r: 0.379, seg: [-0.82, 0.951], legs: { hip: 0.806, foot: 0.15, x: [0.4, -0.42], z: 0.19 }, attach: { head: { p: [0.8259, 2.0157, 0], r: [0, 0, -0.22], s: 0.874 }, neck: { p: [0.6002, 1.583, 0], r: [0, 0, -0.384], s: 1.12 }, back: { p: [-0.05, 1.506, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.8259, 1.8447, 0], r: [0, 0, 0], s: 0.95 } } },
  old: { file: 'assets/models/horse_adult_old.glb', h: 2.252, r: 0.444, seg: [-0.854, 1.034], legs: { hip: 0.62, foot: 0.16, x: [0.40, -0.42], z: 0.19 }, attach: { head: { p: [0.86, 1.96, 0], r: [0, 0, -0.22], s: 0.92 }, neck: { p: [0.62, 1.42, 0], r: [0, 0, -0.54], s: 1.12 }, back: { p: [-0.05, 1.32, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.86, 1.78, 0], r: [0, 0, 0], s: 1 } } },
};
// the foal: the 17-1 adult's shape (4 mane clumps), the body 10% shorter since 17-3; old = the 17-1 foal (lineup only)
const FOALS = {
  new: { file: 'assets/models/horse_foal.glb', h: 2.341, r: 0.388, seg: [-0.831, 1.011], legs: { hip: 0.62, foot: 0.16, x: [0.32, -0.34], z: 0.19 }, attach: { head: { p: [0.78, 1.96, 0], r: [0, 0, -0.22], s: 0.92 }, neck: { p: [0.54, 1.42, 0], r: [0, 0, -0.54], s: 1.12 }, back: { p: [-0.05, 1.32, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.78, 1.78, 0], r: [0, 0, 0], s: 1 } } },
  old: { file: 'assets/models/horse_foal_old.glb', h: 1.784, r: 0.33, seg: [-0.367, 0.779], legs: { hip: 0.44, foot: 0.145, x: [0.27, -0.27], z: 0.14 }, attach: { head: { p: [0.56, 1.5, 0], r: [0, 0, -0.22], s: 0.95 }, neck: { p: [0.4, 1.0, 0], r: [0, 0, -0.5], s: 0.95 }, eye: { p: [0.56, 1.32, 0], r: [0, 0, 0], s: 1.03 } } },
};
// walk.stride: the walk's stride rate follows the leg length, so hooves stay put on the ground (walk.js)
export const horseModel = k => {
  const a = HORSES[k], b = FOALS[k === 'old' ? 'old' : 'new'];
  return { move: 'walk', walk: { stride: true }, files: { baby: b.file, adult: a.file }, baby: sized('horse', 'baby', b), adult: sized('horse', 'adult', a) };
};

export const MODELS = {
  duck: {
    move: 'swim',
    files: { baby: 'assets/models/duck_baby.glb', adult: 'assets/models/duck_adult.glb' },
    baby: sized('duck', 'baby', { h: 1.469, sink: 0.15, r: 0.525, seg: [-0.15, 0.45], attach: { head: { p: [0.27, 1.4, 0], r: [0, 0, -0.12], s: 1.02 }, neck: { p: [0.26, 0.64, 0], r: [0, 0, -0.3], s: 1.3 }, back: { p: [-0.4, 0.65, 0], r: [0, 0, 0.2], s: 0.65 }, eye: { p: [0.28, 1.02, 0], r: [0, 0, 0], s: 1.3 } } }),
    adult: sized('duck', 'adult', { h: 1.398, sink: 0.1586, r: 0.6207, seg: [-0.3862, 0.5448], attach: { head: { p: [0.46, 1.33, 0], r: [0, 0, -0.12], s: 0.78 }, neck: { p: [0.44, 0.88, 0], r: [0, 0, -0.15], s: 1.12 }, back: { p: [-0.1, 0.8, 0], r: [0, 0, 0], s: 0.8 }, eye: { p: [0.47, 1.06, 0], r: [0, 0, 0], s: 1 } } }),
  },
  horse: horseModel('d'),
  // tools/bake-meadow.mjs (17-1, matched to the duck and horse in 17-5). walk: how walk.js moves it: hop = share of trips
  // hopped (0 = walks only, 1 = always hops; the horse's default 0.4), trot = stride speed (x), rest = what replaces
  // grazing ('sit' up, 'peck' the ground), roam = share of choices that are a walk (the default 0.5; less = grazes more,
  // the sheep), pace = walking speed (x; the cow 0.7). wing = the chicken's wing pivot (+z; figure.js mirrors it), model
  // units. legMat = which of the variant's materials paints the legs (none = body; the sheep's ivory 'accent').
  rabbit: {
    move: 'walk', walk: { hop: 1, rest: 'sit' },
    files: { baby: 'assets/models/rabbit_baby.glb', adult: 'assets/models/rabbit_adult.glb' },
    baby: sized('rabbit', 'baby', { h: 2.123, r: 0.537, seg: [-0.319, 0.037], attach: { head: { p: [0.14, 1.56, 0], r: [0, 0, -0.25], s: 0.45 }, neck: { p: [0.14, 0.98, 0], r: [0, 0, -0.2], s: 1.3 }, back: { p: [-0.55, 0.8, 0], r: [0, 0, 0.6], s: 0.8 }, eye: { p: [0.12, 1.24, 0], r: [0, 0, 0], s: 1.06 } } }),
    adult: sized('rabbit', 'adult', { h: 2.226, r: 0.447, seg: [-0.443, 0.316], attach: { head: { p: [0.38, 1.5, 0], r: [0, 0, -0.25], s: 0.42 }, neck: { p: [0.3, 0.95, 0], r: [0, 0, -0.45], s: 0.95 }, back: { p: [-0.24, 0.88, 0], r: [0, 0, 0.2], s: 0.7 }, eye: { p: [0.36, 1.22, 0], r: [0, 0, 0], s: 0.89 } } }),
  },
  pig: {
    move: 'walk', walk: { hop: 0 },
    files: { baby: 'assets/models/pig_baby.glb', adult: 'assets/models/pig_adult.glb' },
    baby: sized('pig', 'baby', { h: 1.441, r: 0.474, seg: [-0.44, 0.626], legs: { hip: 0.4, x: [0.27, -0.27], z: 0.22 }, attach: { head: { p: [0.52, 1.28, 0], r: [0, 0, -0.1], s: 0.68 }, neck: { p: [0.4, 0.75, 0], r: [0, 0, -1.2], s: 1.55 }, back: { p: [-0.05, 1.15, 0], r: [0, 0, 0], s: 1.05 }, eye: { p: [0.56, 0.9, 0], r: [0, 0, 0], s: 1.05 } } }),
    adult: sized('pig', 'adult', { h: 1.966, r: 0.563, seg: [-0.613, 0.827], legs: { hip: 0.62, x: [0.42, -0.4], z: 0.28 }, attach: { head: { p: [0.68, 1.64, 0], r: [0, 0, -0.1], s: 0.75 }, neck: { p: [0.54, 1.02, 0], r: [0, 0, -1.2], s: 1.74 }, back: { p: [-0.1, 1.56, 0], r: [0, 0, 0], s: 1.25 }, eye: { p: [0.74, 1.2, 0], r: [0, 0, 0], s: 1.18 } } }),
  },
  chicken: {
    move: 'walk', walk: { hop: 0, trot: 2, rest: 'peck' },
    files: { baby: 'assets/models/chicken_baby.glb', adult: 'assets/models/chicken_adult.glb' },
    baby: sized('chicken', 'baby', { h: 1.625, r: 0.432, seg: [-0.271, 0.103], legs: { hip: 0.3, x: [0.03], z: 0.14 }, wing: [0.12, 0.78, 0.25], attach: { head: { p: [0.2, 1.38, 0], r: [0, 0, -0.1], s: 0.66 }, neck: { p: [0.22, 0.98, 0], r: [0, 0, -0.45], s: 1.25 }, back: { p: [-0.05, 1.04, 0], r: [0, 0, 0], s: 0.65 }, eye: { p: [0.2, 1.12, 0], r: [0, 0, 0], s: 0.86 } } }),
    adult: sized('chicken', 'adult', { h: 2.011, r: 0.46, seg: [-0.416, 0.202], legs: { hip: 0.5, x: [0.04], z: 0.17 }, wing: [0.16, 1.08, 0.31], attach: { head: { p: [0.36, 1.78, 0], r: [0, 0, -0.1], s: 0.6 }, neck: { p: [0.34, 1.24, 0], r: [0, 0, -0.38], s: 0.9 }, back: { p: [-0.14, 1.3, 0], r: [0, 0, 0], s: 0.8 }, eye: { p: [0.38, 1.54, 0], r: [0, 0, 0], s: 0.78 } } }),
  },
  // 17-6, from horse d and the foal (the horse's legs and walk). foot = the hoof's half length (the stride's lift, walk.js)
  sheep: {
    move: 'walk', walk: { stride: true, hop: 0.2, roam: 0.3 }, legMat: 'accent',
    files: { baby: 'assets/models/sheep_baby.glb', adult: 'assets/models/sheep_adult.glb' },
    baby: sized('sheep', 'baby', { h: 1.919, r: 0.582, seg: [-0.244, 0.678], legs: { hip: 0.5, foot: 0.14, x: [0.3, -0.32], z: 0.22 }, attach: { head: { p: [0.74, 1.84, 0], r: [0, 0, -0.15], s: 0.9 }, neck: { p: [0.52, 1.2, 0], r: [0, 0, -0.6], s: 1.15 }, back: { p: [-0.05, 1.36, 0], r: [0, 0, 0], s: 1.05 }, eye: { p: [0.8, 1.48, 0], r: [0, 0, 0], s: 1.1 } } }),
    adult: sized('sheep', 'adult', { h: 2.039, r: 0.583, seg: [-0.336, 0.807], legs: { hip: 0.58, foot: 0.14, x: [0.42, -0.44], z: 0.24 }, attach: { head: { p: [0.88, 1.92, 0], r: [0, 0, -0.15], s: 0.8 }, neck: { p: [0.66, 1.36, 0], r: [0, 0, -0.68], s: 1.2 }, back: { p: [-0.05, 1.5, 0], r: [0, 0, 0], s: 1.15 }, eye: { p: [0.96, 1.62, 0], r: [0, 0, 0], s: 1 } } }),
  },
  cow: {
    move: 'walk', walk: { stride: true, hop: 0, pace: 0.7 },
    files: { baby: 'assets/models/cow_baby.glb', adult: 'assets/models/cow_adult.glb' },
    baby: sized('cow', 'baby', { h: 1.889, r: 0.695, seg: [-0.169, 0.674], legs: { hip: 0.62, foot: 0.15, x: [0.34, -0.36], z: 0.22 }, attach: { head: { p: [0.8, 1.86, 0], r: [0, 0, -0.15], s: 1 }, neck: { p: [0.56, 1.22, 0], r: [0, 0, -0.79], s: 1.12 }, back: { p: [-0.05, 1.34, 0], r: [0, 0, 0], s: 1.05 }, eye: { p: [0.82, 1.5, 0], r: [0, 0, 0], s: 1.19 } } }),
    adult: sized('cow', 'adult', { h: 1.959, r: 0.622, seg: [-0.422, 0.897], legs: { hip: 0.74, foot: 0.15, x: [0.46, -0.48], z: 0.24 }, attach: { head: { p: [1, 1.92, 0], r: [0, 0, -0.15], s: 0.9 }, neck: { p: [0.78, 1.36, 0], r: [0, 0, -0.79], s: 1.2 }, back: { p: [-0.05, 1.46, 0], r: [0, 0, 0], s: 1.15 }, eye: { p: [1.02, 1.6, 0], r: [0, 0, 0], s: 1.03 } } }),
  },
  // 18-1 pond (tools/bake-pond.mjs). walk.water: a walker that also goes in the pond (walk.js): 'swim' = any depth, the body
  // floating with `float` of its height under the surface, and lying down (sunk by its leg length) when it rests there; 'wade' =
  // the shallow rim only, standing on the bed. shallow: a 'swim' one whose walks into the water head for the shallow rim too (the
  // capybara: lies there half under). wet = share of its walks that head into the water. oneLeg = share of its rests stood on one
  // leg (the flamingo). All keep within 3 of the shore on land (inbox 7).
  turtle: {
    move: 'walk', walk: { hop: 0, pace: 0.45, trot: 0.6, roam: 0.45, water: 'swim', wet: 0.35, float: 0.55 },
    files: { baby: 'assets/models/turtle_baby.glb', adult: 'assets/models/turtle_adult.glb' },
    baby: sized('turtle', 'baby', { h: 1.059, r: 0.549, seg: [-0.223, 0.501], legs: { hip: 0.3, x: [0.32, -0.32], z: 0.34 }, attach: { head: { p: [0.75, 1.02, 0], r: [0, 0, -0.1], s: 0.75 }, neck: { p: [0.55, 0.58, 0], r: [0, 0, -0.75], s: 0.62 }, back: { p: [-0.06, 0.98, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.8, 0.87, 0], r: [0, 0, 0], s: 0.85 } } }),
    adult: sized('turtle', 'adult', { h: 1.045, r: 0.619, seg: [-0.292, 0.6], legs: { hip: 0.28, x: [0.42, -0.42], z: 0.4 }, attach: { head: { p: [0.93, 0.94, 0], r: [0, 0, -0.1], s: 0.62 }, neck: { p: [0.7, 0.58, 0], r: [0, 0, -0.87], s: 0.6 }, back: { p: [-0.05, 1, 0], r: [0, 0, 0], s: 1.1 }, eye: { p: [0.97, 0.81, 0], r: [0, 0, 0], s: 0.7 } } }),
  },
  otter: {
    move: 'walk', walk: { hop: 0.15, trot: 1.6, roam: 0.6, water: 'swim', wet: 0.5, float: 0.6 },
    files: { baby: 'assets/models/otter_baby.glb', adult: 'assets/models/otter_adult.glb' },
    baby: sized('otter', 'baby', { h: 1.639, r: 0.4, seg: [-0.966, 0.599], legs: { hip: 0.34, x: [0.24, -0.42], z: 0.19 }, attach: { head: { p: [0.44, 1.56, 0], r: [0, 0, -0.1], s: 1.15 }, neck: { p: [0.36, 0.86, 0], r: [0, 0, -0.9], s: 1.2 }, back: { p: [-0.2, 0.92, 0], r: [0, 0, 0], s: 0.85 }, eye: { p: [0.5, 1.32, 0], r: [0, 0, 0], s: 1.3 }, chest: { p: [0.62, 0.6, 0], r: [0, 0, 0], s: 0.85 } } }), // chest x 0.56 -> 0.62, adult 0.72 -> 0.8: the pebble out in front of the belly (inbox 12)
    adult: sized('otter', 'adult', { h: 1.512, r: 0.403, seg: [-1.212, 0.917], legs: { hip: 0.4, x: [0.4, -0.48], z: 0.2 }, attach: { head: { p: [0.78, 1.48, 0], r: [0, 0, -0.1], s: 0.95 }, neck: { p: [0.57, 1.02, 0], r: [0, 0, -0.84], s: 1.15 }, back: { p: [-0.1, 1.08, 0], r: [0, 0, 0], s: 0.95 }, eye: { p: [0.84, 1.33, 0], r: [0, 0, 0], s: 1.05 }, chest: { p: [0.8, 0.6, 0], r: [0, 0, 0], s: 1 } } }),
  },
  swan: {
    move: 'swim', legMat: 'hoof', // the cygnet's leg stub the shank's colour (figure.js)
    files: { baby: 'assets/models/swan_baby.glb', adult: 'assets/models/swan_adult.glb' },
    baby: sized('swan', 'baby', { h: 2.3, sink: 0.5, r: 0.455, seg: [-0.333, 0.294], legs: { hip: 0.48, x: [0.02], z: 0.17 }, wing: [0.16, 0.96, 0.3], attach: { head: { p: [0.48, 2.27, 0], r: [0, 0, -0.1], s: 0.7 }, neck: { p: [0.39, 1.25, 0], r: [0, 0, -0.44], s: 0.8 }, back: { p: [-0.1, 1.24, 0], r: [0, 0, 0], s: 0.9 }, eye: { p: [0.52, 2.16, 0], r: [0, 0, 0], s: 0.75 } } }),
    adult: sized('swan', 'adult', { h: 2.447, sink: 0.46, r: 0.519, seg: [-0.499, 0.478], legs: { hip: 0.42, x: [-0.12], z: 0.2 }, wing: [0.3, 0.88, 0.28], attach: { head: { p: [0.78, 2.43, 0], r: [0, 0, -0.1], s: 0.5 }, neck: { p: [0.66, 1.42, 0], r: [0, 0, 0.22], s: 0.65 }, back: { p: [-0.1, 1.16, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.8, 2.36, 0], r: [0, 0, 0], s: 0.55 } } }),
  },
  flamingo: {
    move: 'walk', walk: { hop: 0, pace: 0.55, trot: 0.8, roam: 0.55, water: 'wade', wet: 0.85, oneLeg: 0.5 },
    files: { baby: 'assets/models/flamingo_baby.glb', adult: 'assets/models/flamingo_adult.glb' },
    baby: sized('flamingo', 'baby', { h: 2.299, r: 0.399, seg: [-0.309, 0.32], legs: { hip: 0.72, x: [-0.02], z: 0.14 }, wing: [0.14, 1.12, 0.26], attach: { head: { p: [0.48, 2.28, 0], r: [0, 0, -0.1], s: 0.62 }, neck: { p: [0.37, 1.38, 0], r: [0, 0, -0.46], s: 0.55 }, back: { p: [-0.05, 1.44, 0], r: [0, 0, 0], s: 0.9 }, eye: { p: [0.52, 2.18, 0], r: [0, 0, 0], s: 0.68 } } }),
    adult: sized('flamingo', 'adult', { h: 2.769, r: 0.34, seg: [-0.48, 0.489], legs: { hip: 1, x: [-0.02], z: 0.14 }, wing: [0.2, 1.36, 0.22], attach: { head: { p: [0.64, 2.76, 0], r: [0, 0, -0.1], s: 0.45 }, neck: { p: [0.45, 1.55, 0], r: [0, 0, -0.49], s: 0.45 }, back: { p: [-0.05, 1.58, 0], r: [0, 0, 0], s: 0.9 }, eye: { p: [0.67, 2.66, 0], r: [0, 0, 0], s: 0.48 } } }),
  },
  capybara: {
    move: 'walk', walk: { hop: 0, pace: 0.7, roam: 0.35, water: 'swim', shallow: true, wet: 0.6, float: 0.5 },
    files: { baby: 'assets/models/capybara_baby.glb', adult: 'assets/models/capybara_adult.glb' },
    baby: sized('capybara', 'baby', { h: 1.479, r: 0.494, seg: [-0.25, 0.541], legs: { hip: 0.36, x: [0.3, -0.32], z: 0.24 }, attach: { head: { p: [0.52, 1.38, 0], r: [0, 0, -0.1], s: 1 }, neck: { p: [0.36, 0.88, 0], r: [0, 0, -1], s: 1.3 }, back: { p: [-0.1, 1.18, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.58, 1.16, 0], r: [0, 0, 0], s: 1.1 } } }),
    adult: sized('capybara', 'adult', { h: 1.584, r: 0.546, seg: [-0.397, 0.814], legs: { hip: 0.4, x: [0.44, -0.5], z: 0.25 }, attach: { head: { p: [0.74, 1.52, 0], r: [0, 0, -0.1], s: 1.05 }, neck: { p: [0.52, 1, 0], r: [0, 0, -1], s: 1.4 }, back: { p: [-0.1, 1.48, 0], r: [0, 0, 0], s: 1.2 }, eye: { p: [0.8, 1.32, 0], r: [0, 0, 0], s: 1.15 } } }),
  },
  // 25-1 snow (tools/bake-snow.mjs, 18-2; till now in tools/upcoming.js for the lineup only). walk: slide = share of the
  // penguin's long land walks done as a belly slide; perch = share of the owl's walks that hop up onto a rock top and sit
  // there longer (it never flies); lope = the seal humps along on land (walk.js). The seal has no legs (its flippers are body)
  penguin: {
    move: 'walk', walk: { hop: 0, trot: 1.2, pace: 0.6, roam: 0.55, water: 'swim', wet: 0.35, float: 0.55, slide: 0.15 }, legMat: 'hoof', // the chick's leg stub the shank's colour
    paints: ['cheek', 'face'], waddle: 8, // inbox 10: its painted layers (colors.paint) and a waddle, 8 degrees (figure.js)
    files: { baby: 'assets/models/penguin_baby.glb', adult: 'assets/models/penguin_adult.glb' },
    baby: sized('penguin', 'baby', { h: 1.575, r: 0.629, seg: [-0.037, 0.065], legs: { hip: 0.12, x: [0.24], z: 0.22 }, wing: [-0.05, 1, 0.54], attach: { head: { p: [0.16, 1.5, 0], r: [0, 0, -0.1], s: 1.05 }, neck: { p: [0.2, 1.04, 0], r: [0, 0, -0.3], s: 1.8 }, back: { p: [-0.64, 0.85, 0], r: [0, 0, 1.571], s: 1 }, eye: { p: [0.34, 1.18, 0], r: [0, 0, 0], s: 1.2 } } }),
    adult: sized('penguin', 'adult', { h: 2.084, r: 0.648, seg: [0.044, 0.068], legs: { hip: 0.12, x: [0.2], z: 0.21 }, wing: [0, 0.923, 0.585], attach: { head: { p: [0.22, 2.03, 0], r: [0, 0, -0.1], s: 0.75 }, neck: { p: [0.2, 1.52, 0], r: [0, 0, -0.3], s: 1.1 }, back: { p: [-0.49, 0.95, 0], r: [0, 0, 1.62], s: 1 }, eye: { p: [0.31, 1.86, 0], r: [0, 0, 0], s: 0.84 } } }),
  },
  polarBear: {
    move: 'walk', walk: { hop: 0, pace: 0.75, trot: 0.8, roam: 0.45, water: 'swim', wet: 0.3, float: 0.55 },
    files: { baby: 'assets/models/polarBear_baby.glb', adult: 'assets/models/polarBear_adult.glb' },
    baby: sized('polarBear', 'baby', { h: 1.659, r: 0.614, seg: [-0.216, 0.665], legs: { hip: 0.39, x: [0.36, -0.4], z: 0.28 }, attach: { head: { p: [0.72, 1.58, 0], r: [0, 0, -0.1], s: 0.97 }, neck: { p: [0.52, 1.02, 0], r: [0, 0, -0.9], s: 1.3 }, back: { p: [-0.05, 1.36, 0], r: [0, 0, 0], s: 1.05 }, eye: { p: [0.8, 1.3, 0], r: [0, 0, 0], s: 1.07 } } }),
    adult: sized('polarBear', 'adult', { h: 2.158, r: 0.64, seg: [-0.536, 1.273], legs: { hip: 0.76, x: [0.58, -0.6], z: 0.3 }, attach: { head: { p: [1.3, 2.08, 0], r: [0, 0, -0.1], s: 0.95 }, neck: { p: [1.0, 1.56, 0], r: [0, 0, -0.8], s: 1.3 }, back: { p: [-0.15, 1.9, 0], r: [0, 0, 0], s: 1.25 }, eye: { p: [1.38, 1.84, 0], r: [0, 0, 0], s: 1.04 } } }),
  },
  seal: {
    move: 'walk', walk: { hop: 0, pace: 0.35, trot: 0.5, roam: 0.4, water: 'swim', wet: 0.55, float: 0.6, lope: true },
    files: { baby: 'assets/models/seal_baby.glb', adult: 'assets/models/seal_adult.glb' },
    baby: sized('seal', 'baby', { h: 1.383, r: 0.797, seg: [-0.44, 0.243], attach: { head: { p: [0.55, 1.33, 0], r: [0, 0, -0.1], s: 1.02 }, neck: { p: [0.4, 0.8, 0], r: [0, 0, -0.6], s: 1.4 }, back: { p: [-0.3, 1.0, 0], r: [0, 0, 0.15], s: 1 }, eye: { p: [0.61, 1.08, 0], r: [0, 0, 0], s: 1.14 } } }),
    adult: sized('seal', 'adult', { h: 1.399, r: 0.594, seg: [-1.082, 0.541], attach: { head: { p: [0.7, 1.37, 0], r: [0, 0, -0.1], s: 0.8 }, neck: { p: [0.5, 0.9, 0], r: [0, 0, -0.6], s: 1.25 }, back: { p: [-0.4, 0.78, 0], r: [0, 0, 0.08], s: 1 }, eye: { p: [0.77, 1.17, 0], r: [0, 0, 0], s: 0.87 } } }),
  },
  arcticFox: {
    move: 'walk', walk: { hop: 0.1, trot: 1.8, pace: 1.1, roam: 0.6 },
    files: { baby: 'assets/models/arcticFox_baby.glb', adult: 'assets/models/arcticFox_adult.glb' },
    baby: sized('arcticFox', 'baby', { h: 1.818, r: 0.44, seg: [-0.805, 0.542], legs: { hip: 0.36, x: [0.22, -0.34], z: 0.19 }, attach: { head: { p: [0.44, 1.54, 0], r: [0, 0, -0.1], s: 1.02 }, neck: { p: [0.28, 0.92, 0], r: [0, 0, -0.9], s: 1.2 }, back: { p: [-0.1, 1.02, 0], r: [0, 0, 0], s: 0.8 }, eye: { p: [0.53, 1.26, 0], r: [0, 0, 0], s: 1.14 } } }),
    adult: sized('arcticFox', 'adult', { h: 1.951, r: 0.442, seg: [-0.926, 0.863], legs: { hip: 0.62, x: [0.32, -0.36], z: 0.19 }, attach: { head: { p: [0.76, 1.8, 0], r: [0, 0, -0.1], s: 0.75 }, neck: { p: [0.56, 1.32, 0], r: [0, 0, -0.8], s: 1.0 }, back: { p: [-0.15, 1.41, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.83, 1.6, 0], r: [0, 0, 0], s: 0.84 } } }),
  },
  reindeer: {
    move: 'walk', walk: { stride: true, hop: 0, pace: 0.8 }, // foot: the hoof's half length (as the cow's)
    files: { baby: 'assets/models/reindeer_baby.glb', adult: 'assets/models/reindeer_adult.glb' },
    baby: sized('reindeer', 'baby', { h: 1.779, r: 0.516, seg: [-0.265, 0.604], legs: { hip: 0.46, foot: 0.145, x: [0.32, -0.36], z: 0.23 }, attach: { head: { p: [0.56, 1.74, 0], r: [0, 0, -0.1], s: 1.0 }, neck: { p: [0.38, 1.12, 0], r: [0, 0, -0.8], s: 1.2 }, back: { p: [-0.15, 1.16, 0], r: [0, 0, 0], s: 1 }, eye: { p: [0.64, 1.46, 0], r: [0, 0, 0], s: 1.1 } } }),
    adult: sized('reindeer', 'adult', { h: 2.07, r: 0.531, seg: [-0.426, 0.949], legs: { hip: 0.86, foot: 0.2, x: [0.44, -0.46], z: 0.25 }, attach: { head: { p: [0.94, 2.04, 0], r: [0, 0, -0.1], s: 0.7 }, neck: { p: [0.76, 1.56, 0], r: [0, 0, -0.79], s: 1.05 }, back: { p: [-0.1, 1.53, 0], r: [0, 0, 0], s: 1.1 }, eye: { p: [1.01, 1.84, 0], r: [0, 0, 0], s: 0.78 } } }),
  },
  snowyOwl: {
    move: 'walk', walk: { hop: 0.6, trot: 1.5, pace: 0.8, roam: 0.45, rest: 'sit', perch: 0.4 },
    files: { baby: 'assets/models/snowyOwl_baby.glb', adult: 'assets/models/snowyOwl_adult.glb' },
    baby: sized('snowyOwl', 'baby', { h: 1.62, r: 0.54, seg: [-0.15, 0.02], legs: { hip: 0.14, x: [0.12], z: 0.2 }, wing: [0.06, 1, 0.4], attach: { head: { p: [0.1, 1.58, 0], r: [0, 0, -0.1], s: 1.0 }, neck: { p: [0.18, 0.98, 0], r: [0, 0, -0.2], s: 1.25 }, back: { p: [-0.54, 0.8, 0], r: [0, 0, 1.571], s: 0.95 }, eye: { p: [0.23, 1.25, 0], r: [0, 0, 0], s: 1.1 } } }),
    adult: sized('snowyOwl', 'adult', { h: 1.81, r: 0.44, seg: [-0.259, 0.02], legs: { hip: 0.2, x: [0.08], z: 0.16 }, wing: [0.06, 1.12, 0.32], attach: { head: { p: [0.06, 1.78, 0], r: [0, 0, -0.1], s: 0.85 }, neck: { p: [0.12, 1.18, 0], r: [0, 0, -0.2], s: 1.1 }, back: { p: [-0.44, 0.85, 0], r: [0, 0, 1.571], s: 0.9 }, eye: { p: [0.17, 1.48, 0], r: [0, 0, 0], s: 0.94 } } }),
  },
};

// A body's capsule seen from above (crowd.js), in square world units: what one animal takes of its zone's room.
export const bodyArea = m => Math.PI * m.r ** 2 + 2 * m.r * (m.seg[1] - m.seg[0]);

// One line per species. colors: accent (beak, mane; the sheep's face and legs, the cow's patches) / hoof / beak (its own
// colour for the beak mesh: the cow's pink nose; none = hoof) / horn (the cow's).
// palette: this species' colour lists by variant id (first = default). Every common is listed here (body / second = the
// pattern colour of 투톤·점박이·줄무늬, the lower colour of 그라데이션 / accent to override); any other variant listed
// here uses this list instead of its shared one.
// extra: variants only this species has (same shape as SHARED_VARIANTS). legendary: { id, name, mat, effect, item?, model? }:
// mat = the look in materials.js, effect = what plays round it (figure.js FX; a list plays several), item = LEGEND_ITEMS, model = its own body later (none = the
// species' model; not read yet). Any number of each (0 legendaries is fine: its legendary eggs then hatch another species).
// fit: optional per-accessory nudge on top of the model's attach slot, { [accessory]: { p: [dx,dy,dz], s, r (instead of the slot's), baby / adult: the same for one stage } }.
export const SPECIES = [
  { id: 'duck', fit: { cape: { adult: { s: 1.5 } } }, name: '오리', habitat: 'pond', model: 'duck', colors: { accent: '#ff8a1e' },
    palette: {
      solid: [{ id: 'yellow', name: '노랑', body: '#ffd21f' }, { id: 'sky', name: '하늘', body: '#9fd6f5' }, { id: 'ash', name: '잿빛', body: '#a9a8ae', seldom: true }],
      twotone: [{ id: 'orange', name: '주황', body: '#fbf6ee', second: '#ff9a3c' }, { id: 'green', name: '초록', body: '#fbf6ee', second: '#62bf62' }, { id: 'violet', name: '보라', body: '#fbf6ee', second: '#9a78e0', seldom: true }],
      spots: [{ id: 'sky', name: '하늘', body: '#8fcbf0', second: '#ffffff' }, { id: 'mint', name: '민트', body: '#98e2c4', second: '#ffffff' }, { id: 'ladybug', name: '무당벌레', body: '#e8483c', second: '#2a2226', seldom: true }],
      stripes: [{ id: 'pink', name: '분홍', body: '#f7a8c4', second: '#ffffff' }, { id: 'sea', name: '바다', body: '#7fb3e8', second: '#ffffff' }, { id: 'tiger', name: '호랑', body: '#ffb23e', second: '#3a2a22', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffe066', second: '#ff7a59' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#6fbcef' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    extra: [ // 시험용 예시 (16-2): shows how a species-only variant works; safe to delete with its look (materials.js amber)
      { id: 'amber', rarity: 'rare', tier: 'seldom', name: '호박 젤리', note: '시험용 예시', colors: [
        { id: 'honey', name: '꿀빛 호박', body: '#dc8420' }, { id: 'red', name: '붉은 호박', body: '#bc4f1a' }, { id: 'blue', name: '푸른 호박', body: '#9ccfe0', seldom: true }] },
    ],
    legendary: [{ id: 'pearl', name: '무지개 진주', mat: 'pearl', effect: 'motes' }] },
  { id: 'horse', name: '말', habitat: 'meadow', model: 'horse', colors: { accent: '#5e3a26', hoof: '#4a3022' },
    palette: {
      solid: [{ id: 'chestnut', name: '밤색', body: '#a8744c' }, { id: 'grey', name: '잿빛', body: '#9b989e', accent: '#46434a' }, { id: 'cream', name: '크림', body: '#f2e0bc', accent: '#c49a6a', seldom: true }],
      twotone: [{ id: 'ink', name: '먹색', body: '#3d3638', second: '#f4efe8', accent: '#f4efe8' }, { id: 'brown', name: '갈색', body: '#8a5a3a', second: '#f4efe8', accent: '#f4efe8' }, { id: 'sky', name: '하늘', body: '#7fa8d8', second: '#ffffff', accent: '#ffffff', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#f4efe8', second: '#6a4a36', accent: '#6a4a36' }, { id: 'grey', name: '잿빛', body: '#dcdadf', second: '#585660', accent: '#585660' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', accent: '#ee86ae', seldom: true }],
      stripes: [{ id: 'lavender', name: '라벤더', body: '#c4b2ec', second: '#ffffff', accent: '#8a70c8' }, { id: 'mint', name: '민트', body: '#a4dfca', second: '#ffffff', accent: '#4ea688' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#2c282a', accent: '#2c282a', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffd08a', second: '#c25c3a' }, { id: 'sea', name: '바다', body: '#eaf6ff', second: '#477cc6', accent: '#2f5a9a' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', accent: '#7a5cc8', seldom: true }],
    },
    legendary: [{ id: 'galaxy', name: '은하수', mat: 'galaxy', effect: 'motes' }] },
  { id: 'sheep', name: '양', habitat: 'meadow', model: 'sheep', colors: { accent: '#f2dfc0', hoof: '#77706a' },
    palette: {
      solid: [{ id: 'cream', name: '크림', body: '#f8ecd6' }, { id: 'blackface', name: '검은 얼굴', body: '#f8ecd6', accent: '#3a3436' }, { id: 'ink', name: '먹색', body: '#4a4446', accent: '#2c282a', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#c8a07a', second: '#fbf4e6' }, { id: 'grey', name: '잿빛', body: '#a8a4a8', second: '#fbf4e6' }, { id: 'pink', name: '분홍', body: '#f6bccb', second: '#fffaf4', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#fbf4e6', second: '#a57452' }, { id: 'ink', name: '먹점', body: '#fbf4e6', second: '#3a3436', accent: '#3a3436' }, { id: 'sky', name: '하늘', body: '#f4f9ff', second: '#86b8e0', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#bfe8d6', second: '#ffffff' }, { id: 'lemon', name: '레몬', body: '#fbe7a0', second: '#fffaf0' }, { id: 'lavender', name: '라벤더', body: '#d2c4f0', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'peach', name: '복숭아', body: '#fff0e0', second: '#f2a090' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#8ec0ea' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'cotton', name: '구름 솜사탕', mat: 'cotton', effect: 'puffs' }] }, // 이름 가칭 (17-6)
  { id: 'rabbit', name: '토끼', habitat: 'meadow', model: 'rabbit', colors: { accent: '#f2a6ae' },
    palette: {
      solid: [{ id: 'cream', name: '크림', body: '#f3e6cf' }, { id: 'brown', name: '갈색', body: '#b88a64' }, { id: 'grey', name: '잿빛', body: '#a8a3a6', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#b88a64', second: '#fbf4e8' }, { id: 'grey', name: '잿빛', body: '#9c979b', second: '#fbf4e8' }, { id: 'lavender', name: '라벤더', body: '#b9a6d6', second: '#fbf4e8', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#fbf6ee', second: '#a57452' }, { id: 'grey', name: '잿빛', body: '#fbf6ee', second: '#77727a' }, { id: 'pink', name: '분홍', body: '#fbf3ea', second: '#e88aa6', seldom: true }],
      stripes: [{ id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2' }, { id: 'sky', name: '하늘', body: '#a9cbe6', second: '#ffffff' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#3a3436', seldom: true }],
      gradient: [{ id: 'peach', name: '복숭아', body: '#fff0e0', second: '#f2a090' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#7fb6e6' }, { id: 'lavender', name: '라벤더', body: '#f4eaff', second: '#9c84d8', seldom: true }],
    },
    legendary: [{ id: 'jade', name: '옥토끼 비취', mat: 'jade', effect: 'moondust' }] },
  { id: 'pig', name: '돼지', habitat: 'meadow', model: 'pig', colors: { accent: '#eea19b', hoof: '#5a3f38' }, // inbox 5: the snout face one step darker than the pink body (was #e88e8e, read red)
    palette: {
      solid: [{ id: 'pink', name: '분홍', body: '#f4b4a8' }, { id: 'brown', name: '갈색', body: '#a8704e', accent: '#c48a72' }, { id: 'ink', name: '먹색', body: '#3f3a3c', accent: '#7a6a6e', seldom: true }],
      twotone: [{ id: 'saddle', name: '흑띠', body: '#463e40', second: '#fbefea' }, { id: 'brown', name: '갈색', body: '#b07a58', second: '#fbefea' }, { id: 'sky', name: '하늘', body: '#9fc6e6', second: '#ffffff', accent: '#7fa9cc', seldom: true }],
      spots: [{ id: 'ink', name: '먹점', body: '#f6c4b8', second: '#5a4a4a' }, { id: 'brown', name: '갈색', body: '#fbefe6', second: '#c8865e' }, { id: 'pink', name: '분홍', body: '#fff4f0', second: '#f08aa8', seldom: true }],
      stripes: [{ id: 'boar', name: '멧돼지', body: '#b88a62', second: '#f0dcb8', accent: '#9a6a52' }, { id: 'mint', name: '민트', body: '#a8dcc8', second: '#ffffff' }, { id: 'pink', name: '분홍', body: '#f7b2c6', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'peach', name: '복숭아', body: '#ffe0d2', second: '#e98e88' }, { id: 'sunset', name: '노을', body: '#ffd08a', second: '#c8664a' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'fortune', name: '황금 복돼지', mat: 'fortune', effect: 'coins' }] },
  { id: 'cow', name: '소', habitat: 'meadow', model: 'cow', colors: { accent: '#9a5a34', hoof: '#55504c', beak: '#f0a5a0', horn: '#efe0b8' },
    palette: {
      solid: [{ id: 'brown', name: '갈색 얼룩', body: '#fbf8f2' }, { id: 'ink', name: '먹색 얼룩', body: '#fbf8f2', accent: '#3a3436' }, { id: 'gold', name: '누렁', body: '#d6a066', accent: '#9a5e36', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#8a5a3a', second: '#fbf6ee' }, { id: 'ink', name: '먹색', body: '#3d3638', second: '#fbf6ee', accent: '#f4efe8' }, { id: 'sky', name: '하늘', body: '#8fb8e0', second: '#ffffff', accent: '#ffffff', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#fbf6ee', second: '#8a5a3a' }, { id: 'ink', name: '먹점', body: '#fbf6ee', second: '#3a3436', accent: '#3a3436' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', accent: '#ee86ae', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#a4dfca', second: '#ffffff', accent: '#4ea688' }, { id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2', accent: '#c8865e' }, { id: 'lavender', name: '라벤더', body: '#c4b2ec', second: '#ffffff', accent: '#8a70c8', seldom: true }],
      gradient: [{ id: 'strawberry', name: '딸기우유', body: '#fffaf4', second: '#f4a6b8', accent: '#e07a92' }, { id: 'choco', name: '초코우유', body: '#fff4e6', second: '#9a6444', accent: '#6a4030' }, { id: 'banana', name: '바나나우유', body: '#fffbe8', second: '#f6d46a', accent: '#d8a83a', seldom: true }],
    },
    legendary: [{ id: 'opal', name: '밀키 오팔', mat: 'opal', effect: 'twinkle' }] }, // 이름 가칭 (17-6)
  { id: 'chicken', name: '닭', habitat: 'meadow', model: 'chicken', colors: { accent: '#e0402e', hoof: '#f4b23c' },
    palette: {
      solid: [{ id: 'white', name: '흰색', body: '#fbf6ee' }, { id: 'brown', name: '갈색', body: '#b0683c' }, { id: 'ink', name: '먹색', body: '#3a3436', seldom: true }],
      twotone: [{ id: 'gold', name: '황갈', body: '#d89a52', second: '#7a4426' }, { id: 'grey', name: '잿빛', body: '#f4f0ea', second: '#8e8a90' }, { id: 'teal', name: '청록', body: '#fbf6ee', second: '#4fa0a0', seldom: true }],
      spots: [{ id: 'speckled', name: '깨점', body: '#fbf6ee', second: '#3a3436' }, { id: 'brown', name: '갈색', body: '#a8643c', second: '#fbf2e2' }, { id: 'gold', name: '금빛', body: '#f0c060', second: '#b04a2a', seldom: true }],
      stripes: [{ id: 'barred', name: '바둑', body: '#f0eeee', second: '#4a4648' }, { id: 'brown', name: '갈색', body: '#e8c08a', second: '#9a5a32' }, { id: 'pink', name: '분홍', body: '#f8c8d6', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffe6a0', second: '#d8743c' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#86b8e0' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'dawn', name: '새벽 노을', mat: 'dawn', effect: 'sparks' }] },
  // 19-2 pond. colors: accent (the turtle's shell, the otter's cream, the capybara's muzzle and ears; the swan's and the
  // flamingo's = the body), hoof (feet, the swan's legs and beak root, the flamingo's beak tip), beak (the beak / nose
  // mesh), horn (the turtle's shell rim). Legendary names are 가칭 (19-2 report).
  { id: 'turtle', name: '거북', habitat: 'pond', model: 'turtle', colors: { accent: '#5e9a48', horn: '#f2e6c0' },
    palette: {
      solid: [{ id: 'green', name: '연두', body: '#b8d68a' }, { id: 'sand', name: '모래', body: '#e8d6a8', accent: '#a8865a' }, { id: 'sky', name: '하늘', body: '#bfe0f0', accent: '#5f9ac8', seldom: true }],
      twotone: [{ id: 'olive', name: '올리브', body: '#a8c878', second: '#f2e6c0' }, { id: 'brown', name: '갈색', body: '#c8a878', second: '#f6ecd4', accent: '#7a5a3a' }, { id: 'pink', name: '분홍', body: '#f4c0cc', second: '#fff6f0', accent: '#d87a96', seldom: true }],
      spots: [{ id: 'green', name: '초록', body: '#c4e09a', second: '#6aa84f' }, { id: 'yellow', name: '노랑', body: '#f6e6a0', second: '#8ab858' }, { id: 'starry', name: '별밤', body: '#3e5a7a', second: '#f6f0c8', accent: '#2a3e58', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#a8e0c8', second: '#ffffff', accent: '#4ea688' }, { id: 'lemon', name: '레몬', body: '#fbe7a0', second: '#fffaf0', accent: '#c8a83a' }, { id: 'lavender', name: '라벤더', body: '#c4b2ec', second: '#ffffff', accent: '#8a70c8', seldom: true }],
      gradient: [{ id: 'forest', name: '숲', body: '#e8f4c8', second: '#6aa84f' }, { id: 'sea', name: '바다', body: '#eaf6ff', second: '#477cc6', accent: '#2f5a9a' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', accent: '#7a5cc8', seldom: true }],
    },
    legendary: [{ id: 'coral', name: '용궁 산호', mat: 'coral', effect: 'bubbles' }] },
  { id: 'otter', name: '수달', habitat: 'pond', model: 'otter', colors: { accent: '#f2dfc0', beak: '#3a2a24' },
    palette: {
      solid: [{ id: 'brown', name: '갈색', body: '#9a6a48' }, { id: 'choco', name: '초코', body: '#6a4a36', accent: '#d8c0a0' }, { id: 'cream', name: '크림', body: '#e8d2b0', accent: '#fff6e6', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#8a5a3a', second: '#f4e6cc' }, { id: 'grey', name: '잿빛', body: '#8e8a90', second: '#f4f0ea', accent: '#f4f0ea' }, { id: 'sky', name: '하늘', body: '#7fa8d8', second: '#ffffff', accent: '#ffffff', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#b88a64', second: '#6a4a36' }, { id: 'cream', name: '크림', body: '#f4e6cc', second: '#9a6a48' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', accent: '#fff0f4', seldom: true }],
      stripes: [{ id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2' }, { id: 'mint', name: '민트', body: '#a4dfca', second: '#ffffff' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#3a3436', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffd08a', second: '#c25c3a' }, { id: 'sea', name: '바다', body: '#eaf6ff', second: '#477cc6' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'moonwater', name: '달빛 물결', mat: 'moonwater', effect: 'fireflies', item: 'moonstone' }] },
  { id: 'swan', fit: { cape: { adult: { s: 1.3 } } }, name: '백조', habitat: 'pond', model: 'swan', colors: { accent: '#fbf8f2', hoof: '#4a4a4c', beak: '#f59a2a' },
    palette: {
      solid: [{ id: 'white', name: '흰색', body: '#fbf8f2' }, { id: 'cream', name: '크림', body: '#f6ead0', accent: '#f6ead0' }, { id: 'black', name: '흑고니', body: '#3a3638', accent: '#3a3638', beak: '#d8433a', seldom: true }],
      twotone: [{ id: 'sky', name: '하늘', body: '#fbf8f2', second: '#9fc8ec' }, { id: 'pink', name: '분홍', body: '#fbf8f2', second: '#f4a6b8' }, { id: 'gold', name: '금빛', body: '#fbf8f2', second: '#e8c060', seldom: true }],
      spots: [{ id: 'grey', name: '잿빛', body: '#fbf8f2', second: '#9a989e' }, { id: 'sky', name: '하늘', body: '#f4f9ff', second: '#86b8e0' }, { id: 'violet', name: '보라', body: '#fbf6ff', second: '#a585f0', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#bfe8d6', second: '#ffffff' }, { id: 'lemon', name: '레몬', body: '#fbe7a0', second: '#fffaf0' }, { id: 'lavender', name: '라벤더', body: '#d2c4f0', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'dawn', name: '새벽', body: '#ffffff', second: '#f4a6b8' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#7fb6e6' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'crystal', name: '눈꽃 수정', mat: 'crystal', effect: 'snow' }] },
  { id: 'flamingo', name: '플라밍고', habitat: 'pond', model: 'flamingo', colors: { accent: '#f6a8b0', hoof: '#2a2426', beak: '#f4b2b8' },
    palette: {
      solid: [{ id: 'pink', name: '분홍', body: '#f6a8b0' }, { id: 'coral', name: '산호', body: '#f8907a', beak: '#f8a090' }, { id: 'white', name: '흰색', body: '#fbf6f2', beak: '#f4d6c8', seldom: true }],
      twotone: [{ id: 'peach', name: '복숭아', body: '#f6b8b0', second: '#fff4ee' }, { id: 'rose', name: '장미', body: '#e87890', second: '#ffe4ea' }, { id: 'sky', name: '하늘', body: '#a8cdee', second: '#ffffff', seldom: true }],
      spots: [{ id: 'pink', name: '분홍', body: '#fde4e8', second: '#ee86ae' }, { id: 'peach', name: '복숭아', body: '#fff0e6', second: '#f4a07a' }, { id: 'mint', name: '민트', body: '#e8faf2', second: '#4ea688', seldom: true }],
      stripes: [{ id: 'pink', name: '분홍', body: '#f7b2c6', second: '#ffffff' }, { id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2' }, { id: 'lavender', name: '라벤더', body: '#c4b2ec', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffe066', second: '#ff7a59' }, { id: 'peach', name: '복숭아', body: '#fff0e0', second: '#f2a090' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'rosegold', name: '로즈골드', mat: 'rosegold', effect: 'petals' }] },
  { id: 'capybara', name: '카피바라', habitat: 'pond', model: 'capybara', colors: { accent: '#6e4a32', hoof: '#5a3f30', beak: '#3a2a24' },
    palette: {
      solid: [{ id: 'brown', name: '갈색', body: '#c8955e' }, { id: 'tan', name: '황토', body: '#d8b07a', accent: '#8a6040' }, { id: 'choco', name: '초코', body: '#7a5238', accent: '#4a3022', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#b07a50', second: '#f4e6cc' }, { id: 'grey', name: '잿빛', body: '#9c979b', second: '#f4f0ea', accent: '#5a565a' }, { id: 'mint', name: '민트', body: '#a4dfca', second: '#ffffff', accent: '#4ea688', seldom: true }],
      spots: [{ id: 'brown', name: '갈색', body: '#e8c8a0', second: '#8a5a3a' }, { id: 'cream', name: '크림', body: '#fbf4e6', second: '#c8955e' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', accent: '#d0708e', seldom: true }],
      stripes: [{ id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2', accent: '#c8865e' }, { id: 'sky', name: '하늘', body: '#a9cbe6', second: '#ffffff', accent: '#6a8eb0' }, { id: 'tiger', name: '호랑', body: '#f0a848', second: '#3a2a22', accent: '#3a2a22', seldom: true }],
      gradient: [{ id: 'choco', name: '초코우유', body: '#fff4e6', second: '#9a6444', accent: '#6a4030' }, { id: 'sunset', name: '노을', body: '#ffd08a', second: '#c25c3a', accent: '#8a3a22' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', accent: '#7a5cc8', seldom: true }],
    },
    legendary: [{ id: 'yuzu', name: '유자 온천', mat: 'yuzu', effect: ['steam', 'yuzus'], item: 'yuzu' }] },
  // 25-1 snow. colors (18-2, inbox 10): accent = the penguin's white front, the fox's grey tips, the reindeer's ruff, the owl's
  // spots; hoof = the penguin's feet, the owl's talons, the seal's muzzle pads; beak = the beak / nose mesh; nostril = the
  // penguin's dark upper beak; horn = the antlers, the seal's cream bib, the penguin's pale yellow upper chest; paint = the
  // penguin's cheek comma and face. The legendaries are 가칭 (temporary names)
  { id: 'penguin', fit: { wings: { r: [0, 0, 0.15], p: [0.06, 0.1, 0] }, medal: { adult: { r: [0, 0, 0.1], p: [0.1, 0, 0] } } }, name: '펭귄', habitat: 'snow', model: 'penguin', colors: { accent: '#fbf8f2', hoof: '#7a5638', beak: '#f3a440', nostril: '#33363d', horn: '#fbd98a', paint: { cheek: '#f7a23c', face: '#3c414b' } },
    palette: {
      solid: [{ id: 'grey', name: '회색', body: '#626a78' }, { id: 'navy', name: '남색', body: '#3e4a66' }, { id: 'sky', name: '하늘', body: '#86a8cc', seldom: true }],
      twotone: [{ id: 'sky', name: '하늘', body: '#5a6880', second: '#a8d0ee' }, { id: 'mint', name: '민트', body: '#5e6e74', second: '#a4dfca' }, { id: 'pink', name: '분홍', body: '#6a6274', second: '#f4b8cc', seldom: true }],
      spots: [{ id: 'snow', name: '눈송이', body: '#626a78', second: '#ffffff' }, { id: 'sky', name: '하늘', body: '#86a8cc', second: '#ffffff' }, { id: 'starry', name: '별밤', body: '#3e5a7a', second: '#f6f0c8', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#a8e0c8', second: '#ffffff' }, { id: 'sea', name: '바다', body: '#7fb3e8', second: '#ffffff' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#3a3436', seldom: true }],
      gradient: [{ id: 'dusk', name: '저녁', body: '#9fb4d8', second: '#3e4a66' }, { id: 'sea', name: '바다', body: '#eaf6ff', second: '#477cc6' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'aurora', name: '오로라 빛', mat: 'aurora', effect: 'twinkle' }] },
  { id: 'polarBear', name: '북극곰', habitat: 'snow', model: 'polarBear', colors: { accent: '#f4efe0', beak: '#2a2628' },
    palette: {
      solid: [{ id: 'white', name: '흰색', body: '#f4efe0' }, { id: 'cream', name: '크림', body: '#f2e2c0', accent: '#f2e2c0' }, { id: 'choco', name: '초코', body: '#7a5238', accent: '#7a5238', seldom: true }],
      twotone: [{ id: 'sky', name: '하늘', body: '#f4efe0', second: '#a8cdee' }, { id: 'honey', name: '꿀', body: '#f4efe0', second: '#f0c870' }, { id: 'mint', name: '민트', body: '#f4efe0', second: '#8fd8bc', seldom: true }],
      spots: [{ id: 'grey', name: '잿빛', body: '#f4efe0', second: '#a9a8ae' }, { id: 'sky', name: '하늘', body: '#f4f9ff', second: '#86b8e0' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', seldom: true }],
      stripes: [{ id: 'lemon', name: '레몬', body: '#fbe7a0', second: '#fffaf0' }, { id: 'sky', name: '하늘', body: '#a9cbe6', second: '#ffffff' }, { id: 'lavender', name: '라벤더', body: '#c4b2ec', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'dawn', name: '새벽', body: '#ffffff', second: '#f4a6b8' }, { id: 'glacier', name: '빙하', body: '#ffffff', second: '#7fc4e0' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'glacier', name: '빙하 얼음', mat: 'glacier', effect: 'snow' }] },
  { id: 'seal', fit: { medal: { adult: { r: [0, 0, -0.35] } } }, name: '물범', habitat: 'snow', model: 'seal', colors: { accent: '#7d828a', hoof: '#f2ead8', beak: '#2a2628', horn: '#f2ead8' },
    palette: {
      solid: [{ id: 'grey', name: '회색', body: '#adb2ba' }, { id: 'silver', name: '은빛', body: '#d4d8de', accent: '#a0a6ae' }, { id: 'white', name: '흰색', body: '#f8f6f0', accent: '#d8d8dc', seldom: true }],
      twotone: [{ id: 'sky', name: '하늘', body: '#9fb4c8', second: '#eaf4fa' }, { id: 'sand', name: '모래', body: '#c8b89a', second: '#f6efe0' }, { id: 'violet', name: '보라', body: '#b0a4d0', second: '#f4f0ff', seldom: true }],
      spots: [{ id: 'grey', name: '잿빛', body: '#c8ccd2', second: '#6e737b' }, { id: 'cream', name: '크림', body: '#f4ecdc', second: '#a0948a' }, { id: 'starry', name: '별밤', body: '#3e5a7a', second: '#f6f0c8', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#a8e0c8', second: '#ffffff' }, { id: 'sea', name: '바다', body: '#7fb3e8', second: '#ffffff' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#3a3436', seldom: true }],
      gradient: [{ id: 'sea', name: '바다', body: '#eaf6ff', second: '#477cc6' }, { id: 'dusk', name: '저녁', body: '#d8dce4', second: '#5a6278' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'moonpearl', name: '달 진주', mat: 'moonpearl', effect: 'bubbles' }] },
  { id: 'arcticFox', name: '북극여우', habitat: 'snow', model: 'arcticFox', colors: { accent: '#c9c7cc', beak: '#2a2628' },
    palette: {
      solid: [{ id: 'white', name: '흰색', body: '#f9f7f2' }, { id: 'blue', name: '청회색', body: '#8a8e9a', accent: '#5e626c' }, { id: 'cream', name: '크림', body: '#f2e2c0', accent: '#d0b88e', seldom: true }],
      twotone: [{ id: 'grey', name: '잿빛', body: '#a9a8ae', second: '#fbf8f2' }, { id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2' }, { id: 'sky', name: '하늘', body: '#9fc8ec', second: '#ffffff', seldom: true }],
      spots: [{ id: 'grey', name: '잿빛', body: '#f9f7f2', second: '#a9a8ae' }, { id: 'honey', name: '꿀', body: '#fff6e6', second: '#e0a858' }, { id: 'violet', name: '보라', body: '#fbf6ff', second: '#a585f0', seldom: true }],
      stripes: [{ id: 'pink', name: '분홍', body: '#f7b2c6', second: '#ffffff' }, { id: 'mint', name: '민트', body: '#a4dfca', second: '#ffffff' }, { id: 'ink', name: '먹색', body: '#ffffff', second: '#3a3436', seldom: true }],
      gradient: [{ id: 'dawn', name: '새벽', body: '#ffffff', second: '#f4a6b8' }, { id: 'sky', name: '하늘', body: '#ffffff', second: '#7fb6e6' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'starlight', name: '별빛', mat: 'starlight', effect: 'motes' }] },
  { id: 'reindeer', name: '순록', habitat: 'snow', model: 'reindeer', colors: { accent: '#f1e3c4', hoof: '#4a3428', beak: '#5a4034', horn: '#dfc49a' },
    palette: {
      solid: [{ id: 'brown', name: '갈색', body: '#ad7f58' }, { id: 'grey', name: '잿빛', body: '#a49c94', accent: '#f4f0ea' }, { id: 'white', name: '흰색', body: '#f4ede0', accent: '#ffffff', seldom: true }],
      twotone: [{ id: 'brown', name: '갈색', body: '#9a6a48', second: '#f4e6cc' }, { id: 'choco', name: '초코', body: '#6a4a36', second: '#e8d2b0' }, { id: 'sky', name: '하늘', body: '#7fa8d8', second: '#ffffff', seldom: true }],
      spots: [{ id: 'fawn', name: '아기사슴', body: '#c8955e', second: '#fbf4e6' }, { id: 'cream', name: '크림', body: '#f4e6cc', second: '#9a6a48' }, { id: 'pink', name: '분홍', body: '#fff0f4', second: '#ee86ae', seldom: true }],
      stripes: [{ id: 'apricot', name: '살구', body: '#f6c7a2', second: '#fffaf2' }, { id: 'candy', name: '사탕', body: '#ffffff', second: '#e8483c' }, { id: 'tiger', name: '호랑', body: '#f0a848', second: '#3a2a22', seldom: true }],
      gradient: [{ id: 'sunset', name: '노을', body: '#ffd08a', second: '#c25c3a' }, { id: 'choco', name: '초코우유', body: '#fff4e6', second: '#9a6444' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'lantern', name: '겨울 등불', mat: 'lantern', effect: 'sparks' }] },
  { id: 'snowyOwl', fit: { wings: { r: [0, 0, 0.15], p: [0.06, 0.1, 0] } }, name: '흰올빼미', habitat: 'snow', model: 'snowyOwl', colors: { accent: '#a6a6ab', hoof: '#5a5a5e', beak: '#3e3e42' },
    palette: {
      solid: [{ id: 'white', name: '흰색', body: '#f8f6f0' }, { id: 'grey', name: '잿빛', body: '#c8c6cc', accent: '#7e7c84' }, { id: 'gold', name: '금빛', body: '#f2dc9a', accent: '#b8944a', seldom: true }],
      twotone: [{ id: 'sky', name: '하늘', body: '#f8f6f0', second: '#9fc8ec' }, { id: 'brown', name: '갈색', body: '#f8f6f0', second: '#b88a64' }, { id: 'pink', name: '분홍', body: '#f8f6f0', second: '#f4a6b8', seldom: true }],
      spots: [{ id: 'grey', name: '잿빛', body: '#f8f6f0', second: '#6e6e74' }, { id: 'brown', name: '갈색', body: '#fbf4e6', second: '#8a5a3a' }, { id: 'starry', name: '별밤', body: '#3e5a7a', second: '#f6f0c8', seldom: true }],
      stripes: [{ id: 'mint', name: '민트', body: '#bfe8d6', second: '#ffffff' }, { id: 'lemon', name: '레몬', body: '#fbe7a0', second: '#fffaf0' }, { id: 'lavender', name: '라벤더', body: '#d2c4f0', second: '#ffffff', seldom: true }],
      gradient: [{ id: 'dawn', name: '새벽', body: '#ffffff', second: '#f4a6b8' }, { id: 'night', name: '밤하늘', body: '#c8d4f0', second: '#3e4a78' }, { id: 'aurora', name: '오로라', body: '#9ff0c8', second: '#a585f0', seldom: true }],
    },
    legendary: [{ id: 'snowspirit', name: '눈의 정령', mat: 'snowspirit', effect: 'snow' }] },
];

// 28-1 땅 넓히기 구역: step n opens ZONES[habitat][n-1], a strip w wide along one side of the board as it was (side: +x right,
// -x left, +z front, toward the camera; habitat/zones.js). line: what happens there, for the 「새 구역」 card (only what the
// game really does there)
export const ZONES = {
  meadow: [
    { id: 'flowerhill', name: '꽃 언덕', side: '+x', w: 8, line: '꽃이 가득한 언덕이에요. 동물들이 언덕 위에 올라와 쉬어요.' },
    { id: 'grove', name: '작은 숲', side: '-x', w: 8, line: '나무가 모여 선 작은 숲이에요. 동물들이 나무 그늘에서 쉬어요.' },
    { id: 'fork', name: '개울 갈래와 징검다리', side: '+z', w: 8, line: '넓어진 개울에 징검다리와 작은 물레방아가 있어요. 동물들이 물가에 와서 쉬어요.' },
    { id: 'orchard', name: '과수원', side: '+x', w: 8, line: '열매가 가끔 떨어지면 가까이 있던 동물이 와서 먹어요.' },
    { id: 'lookout', name: '전망 언덕', side: '-x', w: 8, line: '높은 언덕 꼭대기 정자와 망원경 옆에 동물들이 올라와 쉬어요.' },
    { id: 'mushroom', name: '버섯 숲길', side: '+z', w: 8, line: '숲길의 버섯이 밤이면 은은하게 빛나요. 동물들이 길가에서 쉬어요.' },
  ],
  pond: [
    { id: 'reeds', name: '갈대밭', side: '+x', w: 8, line: '키 큰 갈대 사이로 물길이 흘러요. 동물들이 물가에서 쉬어요.' },
    { id: 'falls', name: '바위 폭포', side: '-x', w: 8, line: '바위에서 물이 떨어져 작은 못이 생겼어요. 동물들이 물가에 와서 쉬어요.' },
    { id: 'sandbar', name: '모래톱', side: '+z', w: 8, line: '햇볕 드는 모래밭에서 동물들이 낮잠을 자요.' },
    { id: 'lotus', name: '연꽃 습지', side: '+x', w: 8, line: '연잎과 연꽃이 가득한 큰 연못이에요. 동물들이 물가에서 쉬어요.' },
    { id: 'isle', name: '나무다리 섬', side: '-x', w: 8, line: '긴 나무다리를 건너 섬에 가서 낮잠을 자요.' },
    { id: 'swamp', name: '물안개 늪', side: '+z', w: 8, line: '물안개가 낮게 흐르는 늪이에요. 동물들이 그루터기 옆에서 쉬어요.' },
  ],
  snow: [
    { id: 'conifer', name: '침엽수 숲', side: '+x', w: 8, line: '눈 덮인 전나무 숲이에요. 동물들이 나무 밑에서 쉬어요.' },
    { id: 'sled', name: '썰매 언덕', side: '-x', w: 8, line: '펭귄이 언덕 위에 올라가 배로 미끄러져 내려와요.' },
    { id: 'pillars', name: '얼음 기둥 들판', side: '+z', w: 8, line: '파란 얼음 기둥 사이 낮은 얼음 둔덕 위에 흰올빼미가 올라가 앉아요.' },
    { id: 'hotspring', name: '김 나는 온천', side: '+x', w: 8, line: '김이 나는 온천에 동물들이 들어가 졸아요.' },
    { id: 'cave', name: '바위산 얼음 동굴', side: '-x', w: 8, line: '바위산 아래 얼음 동굴 입구에서 동물들이 낮잠을 자요.' },
    { id: 'iceplate', name: '얼음판', side: '+z', w: 8, line: '꽁꽁 언 얼음판에서 펭귄이 배로 미끄럼을 타요.' },
  ],
};

// In unlock order: each one opens when the one before it is far enough along (BALANCE.unlock). ready: false = not built yet.
// room: each zone's space (square units, bodyArea) for animals out there (swim: MODELS move 'swim', walk: 'walk'; props don't take room, they are crowd.js obstacles).
// Every animal is counted at its adult size, so growing up never overflows. Meadow: the pond holds 9 adult ducks (16-2: 9~10;
// the duck lives in the pond habitat since 19-2, and the meadow keeps this room for ducks that stay there till it opens);
// the land 118 adult horses of 17-1 (the fewest of 20 random non-overlapping fills of the walkable ground, 646 sq units; 16-3),
// kept as that number when the horse grew (17-2).
// 28-6c map: the world map marker and its label in the 390x693 map space (tied to the painted map, ASSETS.worldmap) and the
// sign's picture (worldmap.js ICON). sound: the ambience layers this habitat plays, 0..1 (sound.js; rain and hush everywhere),
// from day/night 0..1, dry (1 - rain - snow), rain and snow 0..1
export const HABITATS = [
  { id: 'meadow', name: '초원', ready: true, nest: 'meadow_nest', room: { swim: 9 * bodyArea(MODELS.duck.adult), walk: 427 },
    map: { at: [168, 466], label: [168, 505], icon: 'horse' }, sound: ({ day, night, dry, rain }) => ({ wind: 0.4 * dry + 0.15, birds: day * dry, insects: night * (1 - rain) }) },
  // Pond (19-2, resized in inbox 7, the water grown to ~60% of the board in inbox 10): its swim lanes (swim.js: radius
  // pond.r x pond.lanes 0.15~0.66 + 1.2, z x pond.k; 445 sq units) cover 13.0x the meadow's (34), so 117 adult ducks; the
  // land as in the meadow: 427 / 646 of the walkable ground (372 sq units with the island tops, the same 0.25 grid that gives
  // the meadow's 646). The water the turtle, otter, capybara and flamingo also go in (918 sq units, 286 of it shallow) is
  // not counted: it is the ducks' room.
  { id: 'pond', name: '연못', ready: true, nest: 'pond_nest', room: { swim: 117 * bodyArea(MODELS.duck.adult), walk: 246 },
    map: { at: [98, 292], label: [98, 331], icon: 'duck' }, sound: ({ rain }) => ({ water: 1 - 0.3 * rain }) },
  // Snow (25-1): its land the same way, 427 / 646 of the walkable ground (873 sq units with the ice floes on the same 0.25
  // grid, 857 of it the mainland). The ice pond is for the penguin, seal and polar bear (walkers that swim), so it has no
  // swim room of its own
  { id: 'snow', name: '설원', ready: true, nest: 'snow_nest', room: { swim: 0, walk: 577 },
    map: { at: [292, 210], label: [292, 243], icon: 'penguin' }, sound: ({ snow }) => ({ wind: 1 - 0.6 * snow }) },
  { id: 'dino', name: '공룡 정글', ready: false, map: { at: [125, 147], label: [125, 180] } },
];

// Habitat props (서식지 꾸미기): bought with hearts, a fixed price, no randomness; placed, turned and put away for free.
// habitat: where it is sold (none: every habitat; bought there, it stays there). r: footprint radius (placement, crowd.js
// obstacle). water: on the pond only. effect: a species id: each one placed raises that species' weight in this habitat's
// nest eggs (BALANCE.attract). paid: bought with money; a paid prop is decoration only and never has an effect
// (tools/check-eggs.mjs fails otherwise). 21-3, for looking at only: light: glows by night. shelter: land animals gather
// by it in the rain (walk.js). open: animals walk over it or under it (no body but its model's posts). 28-2 use: animals
// come and use it (USES; src/animals/play.js), the shop's note.
export const PROPS = [
  { id: 'hay', name: '건초 더미', habitat: 'meadow', price: 40, r: 0.8, effect: 'horse' },
  { id: 'trough', name: '물통', habitat: 'meadow', price: 60, r: 0.85, effect: 'horse' },
  { id: 'lily', name: '연잎', habitat: 'pond', price: 40, r: 0.75, water: true, effect: 'duck' },
  { id: 'duckhouse', name: '작은 오리 집', habitat: 'pond', price: 60, r: 0.9, effect: 'duck' },
  { id: 'flowers', name: '꽃밭', price: 30, r: 0.9 },
  { id: 'bench', name: '나무 벤치', price: 30, r: 0.95, shelter: true, pal: 'wood' },
  // 21-3: fences and paths, flowers and grass, stones, mushrooms and logs, lights, furniture, water things, ornaments
  { id: 'fence', name: '나무 울타리', price: 30, r: 1.0, pal: 'wood' },
  { id: 'path', name: '돌길', price: 30, r: 1.0, open: true, pal: 'stone' },
  { id: 'tulips', name: '튤립 화분', price: 30, r: 0.55, small: true },
  { id: 'tallgrass', name: '풀숲', price: 30, r: 0.6, pal: 'leaf' },
  { id: 'stones', name: '둥근 돌', price: 30, r: 0.75, pal: 'stone' },
  { id: 'mushrooms', name: '버섯 무리', price: 30, r: 0.6 },
  { id: 'log', name: '통나무', price: 40, r: 0.95, pal: 'wood' },
  { id: 'lantern', name: '등불', price: 40, r: 0.45, light: true, small: true },
  { id: 'jar', name: '반딧불 병', price: 30, r: 0.4, light: true, small: true },
  { id: 'mushlamp', name: '버섯 등', price: 40, r: 0.5, light: true, small: true },
  { id: 'starlamp', name: '별 등', price: 50, r: 0.45, light: true, small: true },
  { id: 'swing', name: '그네', price: 50, r: 1.6, shelter: true, use: '작은 동물이 와서 타요' }, // 28-2: bigger, so they fit (1.0)
  { id: 'gazebo', name: '작은 정자', price: 60, r: 2.3, shelter: true, open: true },
  { id: 'boat', name: '작은 나룻배', habitat: 'pond', price: 60, r: 1.1, water: true },
  { id: 'stepping', name: '징검다리', habitat: 'pond', price: 50, r: 1.3, water: true },
  { id: 'pinwheel', name: '바람개비', price: 30, r: 0.35 },
  { id: 'vane', name: '풍향계', price: 40, r: 0.4 },
  { id: 'mailbox', name: '우체통', price: 40, r: 0.4 },
  // 22-2 큰 소품 (2 x 2 cells or more). light: the greenhouse's inside, the lighthouse's turning beam. open: the arch (its two
  // posts only) and the picnic mat (walked over)
  { id: 'barn', name: '헛간', habitat: 'meadow', price: 250, r: 2.2, shelter: true },
  { id: 'windmill', name: '풍차', price: 280, r: 1.5 },
  { id: 'greenhouse', name: '온실', price: 220, r: 1.6, light: true },
  { id: 'treehouse', name: '나무집', price: 300, r: 1.8, shelter: true },
  { id: 'well', name: '우물', price: 120, r: 1.1, pal: 'stone' },
  { id: 'arch', name: '정원 아치', price: 120, r: 1.2, open: true },
  { id: 'picnic', name: '피크닉 매트', price: 100, r: 1.3, open: true },
  { id: 'falls', name: '작은 폭포 바위', price: 180, r: 1.4 },
  { id: 'lighthouse', name: '작은 등대', habitat: 'pond', price: 200, r: 1.1, water: true, light: true },
  { id: 'waterpav', name: '수상 정자', habitat: 'pond', price: 260, r: 2.2, water: true },
  // 25-1 설원 (the snow set; under 100 hearts, so small props). light: the ice lamp glows at night
  { id: 'snowman', name: '눈사람', habitat: 'snow', price: 40, r: 0.88 }, // inbox 26: x1.25 (0.7)
  { id: 'igloo', name: '이글루', habitat: 'snow', price: 90, r: 2, shelter: true }, // inbox 26: x1.25 (1.6)
  { id: 'sled', name: '썰매', habitat: 'snow', price: 50, r: 0.9 },
  { id: 'icelamp', name: '얼음 등불', habitat: 'snow', price: 40, r: 0.45, light: true, small: true },
  // 28-2 놀이 소품 (and the swing, above): prices in PACE play. The fountain: the water birds' bath, so the pond's
  { id: 'seesaw', name: '시소', price: P.play.price.seesaw, r: 2.3, use: '두 마리가 같이 타요' },
  { id: 'ball', name: '굴리는 공', price: P.play.price.ball, r: 1.5, open: true, use: '공을 굴리며 놀아요' },
  { id: 'hammock', name: '해먹', price: P.play.price.hammock, r: 2.1, use: '낮잠 자러 와요' },
  { id: 'feeder', name: '먹이통', price: P.play.price.feeder, r: 0.9, use: '동물들이 모여서 먹어요' },
  { id: 'campfire', name: '모닥불', price: P.play.price.campfire, r: 0.9, light: true, use: '밤에 동물들이 둘러앉아요' },
  { id: 'slide', name: '미끄럼틀', price: P.play.price.slide, r: 1.9, use: '작은 동물이 와서 타요' },
  { id: 'fountain', name: '작은 분수', habitat: 'pond', price: P.play.price.fountain, r: 2.75, use: '오리·물새가 와서 물놀이해요' },
  // 28-3 누르면 반응하는 소품 (habitat.js: a tap on one, meadow/props.js: what it does). lights: two posts and the string between (open: walked under)
  { id: 'musicbox', name: '오르골', price: P.play.price.musicbox, r: 0.75, use: '누르면 음악이 바뀌고 동물들이 들썩여요' },
  { id: 'bubbles', name: '비눗방울 기계', price: P.play.price.bubbles, r: 0.7, use: '누르면 비눗방울이 나와요' },
  { id: 'lights', name: '꼬마전구 줄', price: P.play.price.lights, r: 2.45, open: true, light: true, use: '누르면 켜고 꺼요' },
  { id: 'fireworks', name: '작은 폭죽', price: P.play.price.fireworks, r: 0.6, use: '밤에 누르면 작은 폭죽이 올라가요' },
  { id: 'pinhill', name: '바람개비 언덕', price: P.play.price.pinhill, r: 1.6, use: '누르면 바람개비가 힘차게 돌아요' },
  { id: 'bell', name: '부르는 종', price: P.play.price.bell, r: 0.75, use: '누르면 근처 동물들이 모여요' },
  // 28-4 장난감 기차: rail pieces snap to a 4 x 4 grid (the bridge 8 x 4) and join into track (src/habitat/train.js). A closed loop
  // starts the wind-up train. rail: how many of BALANCE.decor.rails it takes (not counted in decorCap). open: walked across
  { id: 'rail', name: '직선 레일', price: P.play.price.rail, r: 2, open: true, rail: 1, use: '레일을 이어 고리를 닫으면 태엽 기차가 달려요' },
  { id: 'railcurve', name: '곡선 레일', price: P.play.price.railcurve, r: 2, open: true, rail: 1, use: '레일을 이어 고리를 닫으면 태엽 기차가 달려요' },
  { id: 'railfork', name: '갈림길 레일', price: P.play.price.railfork, r: 2, open: true, rail: 1, use: '기차가 두 길로 번갈아 가요' },
  { id: 'railbridge', name: '레일 다리', price: P.play.price.railbridge, r: 4, open: true, rail: 2, use: '길이나 개울을 건너요' },
  // 28-5 쌓기: top: the spots on it where a small prop (small: true) goes, [x, y, z] in its own units at size 보통 (turned and sized with it)
  { id: 'table', name: '둥근 탁자', price: P.play.price.table, r: 0.95, pal: 'wood', top: [[-0.36, 0.74, 0], [0.36, 0.74, 0]] },
  { id: 'shelf', name: '낮은 선반', price: P.play.price.shelf, r: 0.95, pal: 'wood', top: [[-0.48, 0.92, 0], [0.48, 0.92, 0]] },
  { id: 'platform', name: '평상', price: P.play.price.platform, r: 1.3, pal: 'wood', shelter: true, top: [[-0.5, 0.46, -0.45], [0.5, 0.46, -0.45], [-0.5, 0.46, 0.45], [0.5, 0.46, 0.45]] },
  { id: 'doll', name: '오뚝이 인형', price: P.play.price.doll, r: 0.4, small: true },
  // 28-6 지형 도장 (the 땅 tab): stamp: the ground under it rises (or sinks) that much at its middle, to nothing at r (src/habitat/stamps.js);
  // animals walk over the open ones and round the rest. Never on water or by it (placeable keeps r + 0.8 off)
  { id: 'hillock', name: '작은 언덕', price: P.play.price.hillock, r: 2.8, open: true, stamp: 0.75 },
  { id: 'puddle', name: '웅덩이', price: P.play.price.puddle, r: 1.5, stamp: -0.3 },
  { id: 'flowermound', name: '꽃 둔덕', price: P.play.price.flowermound, r: 1.6, open: true, stamp: 0.45 },
  { id: 'rockmound', name: '바위 둔덕', price: P.play.price.rockmound, r: 1.7, stamp: 0.55 },
];
// 28-5 소품 색: each prop's palette (pal: its own, else toy; rails none). 0: as made; the rest: the key colour of its model turned
// to that one (meadow/props.js recolor). 크기: sz 0 보통, 1 작게, 2 크게 (its model, footprint and cells x sizeF)
export const PALETTES = {
  toy: [['원래'], ['빨강', '#e5584a'], ['파랑', '#4f8fe0'], ['노랑', '#f2c84b'], ['초록', '#6cbf5a'], ['분홍', '#f39ac0']],
  wood: [['원래'], ['밝은 나무', '#e3b77f'], ['짙은 나무', '#8f5f3c'], ['하얀 칠', '#f1ece2']],
  stone: [['원래'], ['밝은 돌', '#dcd8d0'], ['짙은 돌', '#7f7c79']],
  leaf: [['원래'], ['연두', '#a8d65a'], ['단풍', '#e9873e'], ['노랑', '#f0cf4a']],
};
export const paletteOf = P => P && !P.rail && !P.stamp ? PALETTES[P.pal ?? 'toy'] : null;
export const SIZES = ['보통', '작게', '크게'];
// its size factor: 작게 / 크게 take its footprint (2r across, rounded to cells) a cell down / up, x0.75 or less / x1.3..1.7
// (a small one, for the top spots, x1.6 at most: bigger hits the next spot); one a cell across stays 1 cell at 작게 (x0.75), a thin
// one (r under about .45) at 크게 too
export const sizeF = (P, sz) => { if (!sz || !P) return 1; const n = Math.max(1, Math.round(2 * P.r));
  return sz === 1 ? (n > 1 ? Math.min(0.75, (n - 0.52) / (2 * P.r)) : 0.75) : Math.min(P.small ? 1.6 : 1.7, Math.max(1.3, (n + 0.52) / (2 * P.r))); };
export const sizable = P => !!P && !P.rail && !P.use && !P.stamp && !(P.open && P.shelter); // play props (their seats), rails, the gazebo (who fits under it) keep their size
// 28-2 「소품 쓰기」: the play props each species uses now and then (src/animals/play.js; one too big for a prop passes it by)
export const USES = {
  horse: 'feeder campfire', cow: 'feeder campfire', sheep: 'feeder campfire ball train', pig: 'feeder campfire ball hammock slide train',
  rabbit: 'swing slide seesaw feeder campfire ball hammock train', chicken: 'swing slide seesaw feeder campfire ball train',
  duck: 'fountain', swan: 'fountain', flamingo: 'fountain campfire', turtle: 'slide feeder campfire train',
  otter: 'swing slide ball hammock campfire train', capybara: 'hammock feeder campfire seesaw ball train',
  penguin: 'slide seesaw ball campfire train', polarBear: 'campfire', seal: 'ball campfire hammock',
  arcticFox: 'swing slide seesaw ball hammock campfire train', reindeer: 'feeder campfire', snowyOwl: 'swing seesaw campfire',
};

// 23-1 소품 세트: every small prop is in one. A level opens a set (BALANCE.level.unlock); the garden set is there from the start.
// 23-2 puts a little show on a habitat where a whole set is placed (looks only).
export const SETS = [
  { id: 'garden', name: '정원', props: ['flowers', 'tulips', 'path', 'bench'] },
  { id: 'ranch', name: '목장', props: ['fence', 'hay', 'trough', 'vane'] },
  { id: 'woods', name: '숲속', props: ['tallgrass', 'stones', 'mushrooms', 'log'] },
  { id: 'water', name: '물가', props: ['lily', 'duckhouse', 'boat', 'stepping'] },
  { id: 'night', name: '밤빛', props: ['lantern', 'jar', 'mushlamp', 'starlamp'] },
  { id: 'play', name: '놀이터', props: ['swing', 'pinwheel', 'mailbox', 'gazebo'] },
  { id: 'friends', name: '놀이 친구', props: ['seesaw', 'ball', 'hammock', 'feeder', 'campfire'] }, // 28-2 (its level: PACE play)
  { id: 'toys', name: '누르는 장난감', props: ['musicbox', 'bubbles', 'lights', 'fireworks', 'pinhill', 'bell'] }, // 28-3 (its level: PACE play)
  { id: 'train', name: '장난감 기차', props: ['rail', 'railcurve', 'railfork', 'railbridge'] }, // 28-4 (its level: PACE play)
  { id: 'home', name: '집 꾸미기', props: ['table', 'shelf', 'platform', 'doll'] }, // 28-5 (its level: PACE play)
  { id: 'land', name: '언덕과 웅덩이', props: ['hillock', 'puddle', 'flowermound', 'rockmound'] }, // 28-6 지형 도장 (a level each: PACE play)
  { id: 'snow', name: '설원', props: ['snowman', 'igloo', 'sled', 'icelamp'] }, // 25-1: no level of its own, the snow habitat is its gate
];

// 22-1 「처음부터 놓인 소품」: each habitat's own trees, bushes, rocks and wildflower clusters (not the forest past the fence,
// nor the stones of the stream and the shore), saved as props (nat: 1, s: size, v: colour) the first time a habitat (or a band
// of 땅 넓히기) opens, so they can be moved, cut (put away) and planted again. Never sold, not counted in decorCap, no effect.
// r, h: footprint and height at size 1 (meadow/props.js kit). open: animals walk through it.
export const NATURE = [
  { id: 'tree', name: '나무', r: 1.7, h: 4.8 },
  { id: 'bush', name: '덤불', r: 0.9, h: 1.25 },
  { id: 'rock', name: '바위', r: 1.05, h: 1 },
  { id: 'wildflowers', name: '들꽃 무리', r: 0.9, h: 0.45, open: true },
  { id: 'snowpine', name: '눈 덮인 전나무', r: 1.3, h: 3.6 }, // 25-1: the snow's trees
];
// 22-1 땅 칠하기: a brush per grid cell (1 x 1 on the first board), stored as its index; looks only (animals walk as before)
export const BRUSHES = [{ id: 'grass', name: '풀', c: '#86bf45', hab: ['meadow', 'pond'] }, { id: 'dirt', name: '흙길', c: '#e2bf86', hab: ['meadow', 'pond'], way: 1 }, { id: 'sand', name: '모래', c: '#efdcaa', hab: ['meadow', 'pond'] }, { id: 'gravel', name: '자갈', c: '#c4bdb0' }, { id: 'bloom', name: '꽃밭', c: '#7cb843', hab: ['meadow', 'pond'] },
  { id: 'snow', name: '눈', c: '#f4f6fa', hab: ['snow'] }, { id: 'ice', name: '얼음', c: '#cfe6f2', hab: ['snow'] },
  // 28-6: drawn along the cells, joined to the next ones: paths (way: terrain.js, with 흙길) and lines that stand (stand: lines.js;
  // animals go round them, props keep off them)
  { id: 'stonepath', name: '돌길', c: '#cfc8bb', way: 1 }, { id: 'plank', name: '나무판길', c: '#c99a63', way: 1 },
  { id: 'fenceline', name: '울타리', c: '#c88a4b', stand: 1 }, { id: 'wall', name: '돌담', c: '#a8a39a', stand: 1 }]; // c: the ground colour (terrain.js)
// 25-1 hab: the habitats a brush paints in (none: all). 자갈 everywhere; 풀·흙길·모래·꽃밭 not on the snow; 눈·얼음 only there
export const brushIn = (b, habId) => !!BRUSHES[b] && (!BRUSHES[b].hab || BRUSHES[b].hab.includes(habId));

// Egg kinds. species: who can hatch from it, picked evenly. odds: rarity weights (%). hatchScale: x BALANCE.hatch.
// sale: null = always, or { start, end } (ISO dates) for a limited egg. Parents (짝꿍 둥지) are stored on eggs, unused yet.
const speciesOf = habitat => SPECIES.filter(s => s.habitat === habitat).map(s => s.id);
export const EGG_TYPES = [
  { id: 'meadow_nest', name: '초원 둥지 알', species: speciesOf('meadow'), odds: { common: 70, rare: 22, heroic: 7, legendary: 1 }, hatchScale: 1, sale: null },
  { id: 'pond_nest', name: '연못 둥지 알', species: speciesOf('pond'), odds: { common: 70, rare: 22, heroic: 7, legendary: 1 }, hatchScale: 1, sale: null },
  { id: 'snow_nest', name: '설원 둥지 알', species: speciesOf('snow'), odds: { common: 70, rare: 22, heroic: 7, legendary: 1 }, hatchScale: 1, sale: null },
];
