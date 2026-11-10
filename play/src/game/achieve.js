// 23-2 도전 과제: each one a goal n of a count v(S) (the save as it is, or S.stats that rules.js and the habitat keep). Done
// once (S.ach[id] = when), it gives BALANCE.level.xp.achieve XP and its 칭호 (title: S.title shows one). Never hearts or eggs.
// rules.js advance checks them; ui/level.js lists them. (rules.js imports this file too: its helpers are only called later)
import { HABITATS, SETS } from './data.js';
import { SP, variantOf, placedIn, decorCap, levelOf, outIn } from './rules.js';

const cells = S => Object.keys(S.codex);
const rarity = r => S => cells(S).filter(k => variantOf(...k.split(':'))?.rarity === r).length;
const kinds = hab => S => new Set(cells(S).map(k => k.split(':')[0]).filter(sp => SP[sp]?.habitat === hab)).size;
const habs = S => HABITATS.filter(h => S.unlocked.includes(h.id)).map(h => h.id);
const most = f => S => Math.max(0, ...habs(S).map(h => f(S, h)));
const st = k => S => S.stats?.[k] || 0;
const placed = S => S.props.filter(p => p.placed && !p.nat);
export const BIG = ['barn', 'windmill', 'greenhouse', 'treehouse', 'well', 'arch', 'picnic', 'falls', 'lighthouse', 'waterpav']; // 22-2 큰 소품
// the sets whole in one habitat: every prop of the set placed there
export const setsIn = (S, hab) => SETS.filter(s => s.props.every(id => S.props.some(p => p.placed && p.hab === hab && p.prop === id)));
const setsDone = S => new Set(habs(S).flatMap(h => setsIn(S, h).map(s => s.id))).size;

// [id, 칭호, what to do, n, v]
export const ACH = [
  ['first', '새내기 정원사', '첫 친구를 도감에 올려요', 1, S => cells(S).length],
  ['codex10', '도감 수집가', '도감 10칸을 채워요', 10, S => cells(S).length],
  ['codex30', '부지런한 수집가', '도감 30칸을 채워요', 30, S => cells(S).length],
  ['codex60', '도감 박사', '도감 60칸을 채워요', 60, S => cells(S).length],
  ['duck10', '오리 색 탐험가', '오리 색 10가지를 모아요', 10, S => Object.entries(S.colors).filter(([k]) => k.startsWith('duck:')).reduce((n, [, c]) => n + c.length, 0)],
  ['rare', '반짝이 발견자', '희귀 친구를 만나요', 1, rarity('rare')],
  ['heroic', '영웅의 친구', '영웅 친구를 만나요', 1, rarity('heroic')],
  ['legendary', '전설의 친구', '전설 친구를 만나요', 1, rarity('legendary')],
  ['secret', '비밀 찾기 명수', '시크릿 액세서리를 찾아요', 1, S => Object.keys(S.album).length],
  ['meadow6', '초원 친구들', '초원 친구 6종을 모두 만나요', 6, kinds('meadow')],
  ['pond', '연못 개척자', '연못을 열어요', 1, S => +S.unlocked.includes('pond')],
  ['pond6', '연못 친구들', '연못 친구 6종을 모두 만나요', 6, kinds('pond')],
  ['snow', '설원 개척자', '설원을 열어요', 1, S => +S.unlocked.includes('snow')], // 25-1
  ['snow6', '설원 친구들', '설원 친구 6종을 모두 만나요', 6, kinds('snow')],
  ['hatch50', '알 깨우기 장인', '알 50개를 깨워요', 50, st('hatch')],
  ['grown5', '꼬마 돌보미', '새끼 5마리가 다 자라요', 5, st('grown')],
  ['grown20', '든든한 보호자', '새끼 20마리가 다 자라요', 20, st('grown')],
  ['pet100', '쓰담쓰담 달인', '하트가 나오게 100번 쓰다듬어요', 100, st('pet')],
  ['feed30', '맛있는 밥상', '먹이를 30번 줘요', 30, st('feed')],
  ['days7', '단골 손님', '7일 놀러 와요 (이어서 오지 않아도 돼요)', 7, st('days')],
  ['days30', '오랜 이웃', '30일 놀러 와요 (이어서 오지 않아도 돼요)', 30, st('days')],
  ['plant10', '나무 심는 사람', '넣어 둔 나무를 10그루 심어요', 10, st('plant')],
  ['props10', '꾸미기 새싹', '소품 10개를 놓아요', 10, S => placed(S).length],
  ['full', '꽉 찬 정원', '한 서식지에 소품을 놓을 수 있는 만큼 다 놓아요', 1, most((S, h) => +(placedIn(S, h).length >= decorCap(S, h)))],
  ['paint50', '땅 화가', '땅 50칸을 칠해요', 50, S => Object.values(S.paint || {}).reduce((n, P) => n + Object.keys(P).length, 0)],
  ['lights5', '밤빛 지기', '밤에 한 서식지에서 불빛 소품 5개를 켜요', 5, st('lights')],
  ['roof3', '비 오는 날의 쉼터', '비 오는 날 정자 밑에 동물 3마리가 모여요', 3, st('roof')],
  ['set1', '세트 완성', '한 서식지에 소품 세트 하나를 다 놓아요', 1, setsDone],
  ['set3', '세트 수집가', '소품 세트 3가지를 다 놓아요', 3, setsDone],
  ['big1', '큰 그림', '큰 소품을 놓아요', 1, S => new Set(placed(S).filter(p => BIG.includes(p.prop)).map(p => p.prop)).size],
  ['big5', '큰 손 정원사', '큰 소품 5가지를 놓아요', 5, S => new Set(placed(S).filter(p => BIG.includes(p.prop)).map(p => p.prop)).size],
  ['expand3', '넓은 들', '땅을 3단계까지 넓혀요', 3, most((S, h) => levelOf(S, h))],
  ['expand6', '끝없는 들판', '땅을 6단계까지 넓혀요', 6, most((S, h) => levelOf(S, h))],
  ['crowd', '북적북적 서식지', '한 서식지에 친구 12마리가 나와 놀아요', 12, most((S, h) => outIn(S, h).length)],
].map(([id, title, text, n, v]) => ({ id, title, text, n, v }));
export const ACH_BY = Object.fromEntries(ACH.map(a => [a.id, a]));
export const newlyDone = S => ACH.filter(a => !S.ach?.[a.id] && a.v(S) >= a.n);
