// 66-1 떠돌이 손님: every number and list of the guests in one file (guests.js is the rules). Not wired in yet: see
// docs/reports/66-1-design.md 「메인 세션이 할 일」. Egg odds and pity are not here on purpose: a guest only says which
// habitat's egg it leaves; the egg is layEgg's (70/22/7/1, pity counted as any nest egg).
const SEC = 1e3, MIN = 60e3, H = 36e5;

// GUEST: the knobs. stay: how long a guest waits while the app is open (on) and while it is shut (off).
// The shorter the stay the bigger the hearts and the gift chance (inbox 68); the egg is the same for all.
export const GUEST = {
  v: 1,                          // S.guests.v (its own shape; SCHEMA_VERSION stays)
  max: 2, max3: 8,               // guests at once; 3 from Lv max3
  radius: 3.5,                   // m around the guest that judge() looks at (a prop counts by its centre within radius + its r)
  gap: 60 * SEC,                 // ticks further apart than this: the app was shut (the off clock runs, not the on one)
  arrive: [120 * SEC, 240 * SEC], // while open and below max: the wait to the next guest
  stay: { short: { on: 3 * MIN, off: 1 * H }, normal: { on: 4 * MIN, off: 2 * H }, long: { on: 5 * MIN, off: 3 * H } },
  hearts: { short: 10, normal: 6, long: 4 }, // 만족
  great: 2,                      // 대만족 (every wish + the bonus): hearts and XP x this
  wishHeart: 1,                  // a wish met for the first time (the small burst)
  xp: { ok: 1, great: 2 },       // to the one Lv there is (no 명성)
  cut: { ok: 0.25, great: 0.5 }, // 부화 게이지: this share of an egg's whole time comes off (the egg with the most time left)
  gift: { short: 0.5, normal: 0.3, long: 0.2 }, // 대만족: chance of the habitat's guest prop (one not owned yet)
  giftHearts: 10,                // all of them owned (or the prop not in PROPS yet): hearts instead
  eggDay: 6,                     // guest eggs a day; past it none (the guest's hearts only)
  grace: 10 * SEC,               // every wish met: the bonus may still come this long, then 만족
  pair: 0.15, pairLv: 2,         // an arrival is two guests whose wishes clash (from Lv pairLv)
  tutStay: 2 * MIN,              // a tutorial guest's on stay (an idle player: it leaves, the next step comes)
  // 66-2 단골·정착 (the guest keeps its 보따리 or 모자 and lives here, tier 떠돌이: never sold, nothing paid)
  regular: 3,                    // 대만족 of one guest: it is a 단골
  big: 3,                        // 큰 소원: its steps (one a day; the first may be the day it became a 단골: 2~3 days), then 정착
  bigW: 6,                       // a 단골 whose step is due: its weight when a guest is picked (the rest 1, a `when` one 4)
  // 69-3 하루 마무리: guests a day (not the tutorial's; a `when` one may still come after); the last gone: the sunset and
  // tomorrow's first guest as a shadow
  day: 6,
};

// Wishes. k: tag (a prop tag or the ground there), not (no such tag near), pals (n friends near), alone (none near),
// sp (that species near), baby (a baby near), env (time and weather, the real clock: never made by the player, so a guest
// with one only comes while it holds; see `when`). A wish with a riddle shows the riddle, the rest an icon.
export const TAGS = ['꽃', '빛', '소리', '놀이', '먹을 것', '쉼터']; // prop tags
export const GROUNDS = ['물가', '풀밭', '높은 곳', '그늘'];         // ground tags (a prop may carry one too: puddle 물가)
export const WISH = {
  꽃: { k: 'tag', v: '꽃', icon: '🌸' }, 빛: { k: 'tag', v: '빛', icon: '💡' }, 소리: { k: 'tag', v: '소리', icon: '🎵' },
  놀이: { k: 'tag', v: '놀이', icon: '🎈' }, '먹을 것': { k: 'tag', v: '먹을 것', icon: '🍎' }, 쉼터: { k: 'tag', v: '쉼터', icon: '🏠' },
  물가: { k: 'tag', v: '물가', icon: '💧' }, 풀밭: { k: 'tag', v: '풀밭', icon: '🌿' }, 그늘: { k: 'tag', v: '그늘', icon: '🌳' },
  '높은 곳': { k: 'tag', v: '높은 곳', icon: '⛰️', riddle: '멀리까지 내다보고 싶어' },
  quiet: { k: 'not', v: '소리', icon: '🤫', riddle: '쉿, 조용한 데서 쉬고 싶어' },
  alone: { k: 'alone', icon: '🍃', riddle: '잠깐만 혼자 있고 싶어' },
  pals1: { k: 'pals', n: 1, icon: '🐾' }, pals2: { k: 'pals', n: 2, icon: '🐾' },
  pals3: { k: 'pals', n: 3, icon: '🐾', riddle: '친구 셋이랑 둘러앉고 싶어' },
  baby: { k: 'baby', icon: '🍼', riddle: '아기 친구를 보면 기운이 날 것 같아' },
  'sp:horse': { k: 'sp', v: 'horse', riddle: '갈기 날리는 친구가 보고 싶어' },
  'sp:sheep': { k: 'sp', v: 'sheep', riddle: '구름처럼 폭신한 친구가 보고 싶어' },
  'sp:duck': { k: 'sp', v: 'duck', riddle: '꽥꽥 노래하는 친구가 보고 싶어' },
  'sp:turtle': { k: 'sp', v: 'turtle', riddle: '집을 지고 다니는 친구가 보고 싶어' },
  'sp:penguin': { k: 'sp', v: 'penguin', riddle: '뒤뚱뒤뚱 걷는 친구가 보고 싶어' },
  'sp:seal': { k: 'sp', v: 'seal', riddle: '얼음 위에서 뒹구는 친구가 보고 싶어' },
  밤: { k: 'env', v: 'night', icon: '🌙' }, 비: { k: 'env', v: 'rain', icon: '🌧️' },
  눈: { k: 'env', v: 'snow', icon: '❄️' }, 하늘: { k: 'env', v: 'sky', icon: '🌠' },
  // 69-3 테마 소원: a little scene, all its tags at one spot (one wish); met, the guest leaves the habitat's 기념 소품 (memo, once)
  'theme:meadow': { k: 'theme', v: ['꽃', '먹을 것', '쉼터'], name: '꽃길 소풍', icon: '🧺', memo: 'gst_picnicbox' },
  'theme:pond': { k: 'theme', v: ['물가', '놀이', '그늘'], name: '바닷가 놀이터', icon: '🏖️', memo: 'gst_beachdoll' },
  'theme:snow': { k: 'theme', v: ['쉼터', '먹을 것', '빛'], name: '겨울 찻집', icon: '🍵', memo: 'gst_tealamp' },
};
// wishes that cannot both hold at one spot: a pair of guests comes with one of each (보상을 미리 보여 주고 고르게)
export const CLASH = [['소리', 'quiet'], ['pals1', 'alone']];
// the ground each habitat has from the start (the world adapter reports it at a spot); the rest comes from props
export const GROUND = { meadow: ['물가', '풀밭', '높은 곳', '그늘'], pond: ['물가', '풀밭', '그늘'], snow: ['높은 곳', '그늘'] };

// Rosters. k: id; sp: an existing species (no new one); mark: bundle (보따리) or hat (모자); stay: short/normal/long;
// egg: the habitat whose egg it leaves (not open yet: the host's); lv: it comes from this Lv; wish: its pool (a visit draws
// 1~2 short, 2 normal, 2~3 long, only ones the player can do at that Lv); bonus: the 덤 pool (대만족); when: an env wish it
// only comes with (and always has).
// 86-3마: what a visiting guest wears (game.js wanderers, the codex cell, play.js): its hat (data.js EV_ACC g_hat) or the bandana.
// A settled one (guests.js settle) keeps the straw hat in its save, a secret accessory like any other
export const guestWear = R => R.wear ?? (R.mark === 'hat' ? 'g_hat' : 'bandana'); // wear: a guest whose body hides the usual one
export const GUESTS = [
  { k: 'm_sheep', hab: 'meadow', sp: 'sheep', name: '보따리 양 몽실', mark: 'bundle', stay: 'normal', egg: 'meadow', lv: 1, wish: ['꽃', '풀밭', '쉼터', 'pals2'], bonus: ['baby', '먹을 것'] },
  { k: 'm_rabbit', hab: 'meadow', sp: 'rabbit', name: '모자 쓴 토끼 깡충', mark: 'hat', stay: 'short', egg: 'meadow', lv: 1, wish: ['꽃', '그늘', 'pals1'], bonus: ['sp:sheep', '쉼터'] },
  { k: 'm_chicken', hab: 'meadow', sp: 'chicken', name: '보따리 닭 꼬순이', mark: 'bundle', stay: 'normal', egg: 'meadow', lv: 2, wish: ['먹을 것', '꽃', '풀밭'], bonus: ['baby', '놀이'] },
  { k: 'm_pig', hab: 'meadow', sp: 'pig', name: '모자 쓴 돼지 통통', mark: 'hat', stay: 'long', egg: 'meadow', lv: 2, wish: ['먹을 것', '물가', 'pals2', '놀이', 'theme:meadow'], bonus: ['소리', 'pals3'] },
  { k: 'm_horse', hab: 'meadow', sp: 'horse', name: '보따리 말 바람', mark: 'bundle', stay: 'short', egg: 'meadow', lv: 3, wish: ['풀밭', '높은 곳', 'pals3'], bonus: ['sp:horse', '물가'] },
  { k: 'm_cow', hab: 'meadow', sp: 'cow', name: '모자 쓴 소 느림보', mark: 'hat', stay: 'long', egg: 'meadow', lv: 4, wish: ['그늘', '먹을 것', 'quiet', '쉼터', 'theme:meadow'], bonus: ['꽃'] },
  { k: 'm_moon', hab: 'meadow', sp: 'rabbit', name: '달밤 토끼', mark: 'hat', stay: 'short', egg: 'meadow', lv: 1, when: '밤', wish: ['쉼터', '꽃', 'quiet'], bonus: ['빛', 'pals1'] },
  { k: 'm_raindk', hab: 'meadow', sp: 'duck', name: '비 마중 오리', mark: 'bundle', stay: 'short', egg: 'pond', lv: 4, when: '비', wish: ['물가', '꽃', 'pals1'], bonus: ['그늘'] },
  { k: 'm_lamb', hab: 'meadow', sp: 'sheep', name: '모자 쓴 양 솜솜', mark: 'hat', stay: 'normal', egg: 'meadow', lv: 8, wish: ['놀이', '꽃', 'pals2', 'theme:meadow'], bonus: ['빛', 'baby'] }, // 66-2 명성: a new guest at a 땅 넓히기 Lv

  { k: 'p_duck', hab: 'pond', sp: 'duck', name: '보따리 오리 퐁당', mark: 'bundle', stay: 'short', egg: 'pond', lv: 1, wish: ['물가', '꽃', 'pals1'], bonus: ['sp:duck', '쉼터'] },
  { k: 'p_turtle', hab: 'pond', sp: 'turtle', name: '모자 쓴 거북 느긋', mark: 'hat', stay: 'long', egg: 'pond', lv: 1, wish: ['물가', '쉼터', 'quiet', '그늘', 'theme:pond'], bonus: ['baby'] },
  { k: 'p_otter', hab: 'pond', sp: 'otter', name: '보따리 수달 첨벙', mark: 'bundle', stay: 'short', egg: 'pond', lv: 2, wish: ['놀이', '물가', '먹을 것'], bonus: ['pals2', '소리'] },
  { k: 'p_swan', hab: 'pond', sp: 'swan', name: '모자 쓴 백조 사뿐', mark: 'hat', stay: 'normal', egg: 'pond', lv: 2, wish: ['꽃', '물가', 'quiet'], bonus: ['빛', 'sp:turtle'] },
  { k: 'p_flamingo', hab: 'pond', sp: 'flamingo', name: '보따리 플라밍고 분홍', mark: 'bundle', stay: 'normal', egg: 'pond', lv: 3, wish: ['꽃', 'pals2', '놀이'], bonus: ['물가', '소리'] },
  { k: 'p_capy', hab: 'pond', sp: 'capybara', name: '모자 쓴 카피바라 뭉근', mark: 'hat', stay: 'long', egg: 'pond', lv: 3, wish: ['그늘', '쉼터', 'pals2', 'baby', 'theme:pond'], bonus: ['먹을 것'] },
  { k: 'p_star', hab: 'pond', sp: 'swan', name: '별 보는 백조', mark: 'bundle', stay: 'short', egg: 'pond', lv: 3, when: '하늘', wish: ['물가', 'quiet'], bonus: ['빛'] },
  { k: 'p_peng', hab: 'pond', sp: 'penguin', name: '마실 온 펭귄', mark: 'hat', stay: 'normal', egg: 'snow', lv: 6, wish: ['물가', '그늘', 'pals1'], bonus: ['sp:duck'] },
  { k: 'p_pup', hab: 'pond', sp: 'otter', name: '모자 쓴 수달 퐁퐁', mark: 'hat', stay: 'short', egg: 'pond', lv: 11, wish: ['물가', '놀이', '소리', 'theme:pond'], bonus: ['pals3', '빛'] }, // 66-2

  { k: 's_penguin', hab: 'snow', sp: 'penguin', name: '보따리 펭귄 뒤뚱', mark: 'bundle', wear: 'g_band', stay: 'short', egg: 'snow', lv: 1, wish: ['놀이', 'pals2', '높은 곳'], bonus: ['sp:penguin', '소리'] },
  { k: 's_bear', hab: 'snow', sp: 'polarBear', name: '모자 쓴 북극곰 푸근', mark: 'hat', stay: 'long', egg: 'snow', lv: 1, wish: ['쉼터', '먹을 것', 'quiet', '그늘', 'theme:snow'], bonus: ['baby'] },
  { k: 's_seal', hab: 'snow', sp: 'seal', name: '보따리 물범 몽글', mark: 'bundle', stay: 'normal', egg: 'snow', lv: 1, wish: ['놀이', 'pals1', '그늘'], bonus: ['sp:seal', '빛'] },
  { k: 's_fox', hab: 'snow', sp: 'arcticFox', name: '모자 쓴 북극여우 살금', mark: 'hat', stay: 'short', egg: 'snow', lv: 2, wish: ['그늘', 'alone', '높은 곳'], bonus: ['빛'] },
  { k: 's_deer', hab: 'snow', sp: 'reindeer', name: '보따리 순록 방울', mark: 'bundle', stay: 'normal', egg: 'snow', lv: 3, wish: ['높은 곳', 'pals2', '빛'], bonus: ['소리', 'pals3'] },
  { k: 's_owl', hab: 'snow', sp: 'snowyOwl', name: '오로라 기다리는 흰올빼미', mark: 'hat', stay: 'short', egg: 'snow', lv: 2, when: '하늘', wish: ['높은 곳', 'quiet'], bonus: ['빛'] },
  { k: 's_snow', hab: 'snow', sp: 'arcticFox', name: '첫눈 마중 여우', mark: 'bundle', stay: 'normal', egg: 'snow', lv: 2, when: '눈', wish: ['놀이', 'pals1', '쉼터'], bonus: ['baby'] },
  { k: 's_cub', hab: 'snow', sp: 'polarBear', name: '보따리 북극곰 꼬미', mark: 'bundle', stay: 'normal', egg: 'snow', lv: 14, wish: ['놀이', '먹을 것', '빛', 'theme:snow'], bonus: ['pals2', '소리'] }, // 66-2
];

// 손님 선물 (소품): 3 a habitat, only from a guest's 대만족. New ids; the main session adds them to PROPS (gift: '떠돌이 손님',
// price 0) with a model. as: the existing model to start from (props.js `as`), so they work before their own model.
export const GUEST_PROPS = [
  { id: 'gst_kite', name: '가오리연', hab: 'meadow', tags: ['놀이'], as: 'pinwheel' },
  { id: 'gst_basket', name: '꽃바구니', hab: 'meadow', tags: ['꽃'], as: 'tulips' },
  { id: 'gst_milkcan', name: '우유 통', hab: 'meadow', tags: ['먹을 것'], as: 'trough' },
  { id: 'gst_bottle', name: '편지 병', hab: 'pond', tags: ['물가'], as: 'jar' },
  { id: 'gst_reedpipe', name: '갈대 피리', hab: 'pond', tags: ['소리'], as: 'tallgrass' },
  { id: 'gst_parasol', name: '연잎 양산', hab: 'pond', tags: ['그늘', '쉼터'], as: 'lily' },
  { id: 'gst_teapot', name: '따뜻한 주전자', hab: 'snow', tags: ['먹을 것'], as: 'icelamp' },
  { id: 'gst_sleighbell', name: '썰매 방울', hab: 'snow', tags: ['소리'], as: 'bell' },
  { id: 'gst_scarfpost', name: '목도리 걸이', hab: 'snow', tags: ['쉼터'], as: 'vane' },
  // 69-3 기념 소품: a 테마 소원's (memo: never a 대만족 gift)
  { id: 'gst_picnicbox', name: '소풍 오르골', hab: 'meadow', tags: ['소리'], as: 'musicbox', memo: true },
  { id: 'gst_beachdoll', name: '물놀이 오뚝이', hab: 'pond', tags: ['놀이'], as: 'doll', memo: true },
  { id: 'gst_tealamp', name: '찻집 등불', hab: 'snow', tags: ['빛'], as: 'lantern', memo: true },
];

// Prop tags (every PROPS and NATURE id; a prop may have none): what judge() reads off the props near a guest.
// Ground tags on a prop are for the ones that make ground (웅덩이 물가, 작은 언덕 높은 곳) or shade (나무, 정자).
const BY_TAG = {
  꽃: 'lily flowers tulips greenhouse arch flowermound att_sunflower att_cart att_rainbow wildflowers',
  빛: 'lantern jar mushlamp starlamp greenhouse lighthouse icelamp lavalamp campfire lights fireworks ev_icelamp ev_album ev_flakelamp',
  소리: 'windmill waterwheel falls musicbox bell fireworks carousel att_birdhouse',
  놀이: 'swing boat stepping pinwheel tunnel snowslide carousel gym balloon seesaw ball slide fountain bubbles pinhill rail railcurve railfork railbridge doll snowman sled treehouse att_balloons ev_sled ev_slide ev_snowman ev_bigsnowman ev_snowfam',
  '먹을 것': 'hay trough mushrooms feeder picnic table walk_acorn walk_pinecone',
  쉼터: 'duckhouse bench log gazebo barn treehouse mushroom waterpav igloo hammock platform ev_igloo ev_mitten tree',
  물가: 'trough lily boat stepping well falls waterpav lighthouse fountain puddle waterwheel',
  풀밭: 'tallgrass',
  '높은 곳': 'tower hillock rockmound treehouse balloon snowslide rock',
  그늘: 'gazebo barn mushroom waterpav tree bush snowpine treefern cycad firstday',
};
export const PROP_TAGS = {};
for (const [t, ids] of Object.entries(BY_TAG)) for (const id of ids.split(' ')) (PROP_TAGS[id] ??= []).push(t);
for (const g of GUEST_PROPS) PROP_TAGS[g.id] = g.tags;
export const TAGGED = Object.values(BY_TAG).flatMap(s => s.split(' ')); // sim-guests checks each is a real id

// 새 첫 5분 (a new save only; an old save gets `hello` instead). A step starts `gap` after the last one ended (the first:
// after the first hatch). Its guests come with these wishes (no draw), stay GUEST.tutStay, and leave as any guest.
// free: a prop put in storage as it starts (the 반짝 꽃). cut: the 부화 게이지 share it gives (1 = fill it).
// shop: the one prop the shop sells while it is on (the 등불 opens at Lv 7, set:night). pair: the two clash (첫 선택).
export const TUTORIAL = [
  { gap: 3 * SEC, free: 'tulips', cut: 0.3, guests: [{ k: 'm_sheep', wish: ['꽃'], from: 'stream' }] },
  { gap: 12 * SEC, cut: 1, guests: [{ k: 'm_rabbit', wish: ['물가', 'pals1'], from: 'stream' }] },
  { gap: 30 * SEC, shop: 'lantern', guests: [{ k: 'm_chicken', wish: ['빛'], from: 'path' }] },
  { gap: 40 * SEC, pair: true, guests: [{ k: 'm_pig', wish: ['pals1'], from: 'path' }, { k: 'm_cow', wish: ['alone', '꽃'], from: 'path' }] },
];
