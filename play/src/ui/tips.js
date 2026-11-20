// The first-time tips (hud.js tip()), also listed in 「?」 도움말 and shown one at a time on the loading screens (26-1).
// Imports only data.js (pure data): index.html's loading screen reads this before the game has loaded. inbox 31: the times
// come from the edition's PACE table (BALANCE).
import { $t } from '../i18n/i18n.js';
import { BALANCE as B } from '../game/data.js';
const span = ms => { const m = Math.round(ms / 60000); return m % 60 ? $t('{0}분', m) : m === 60 ? $t('한 시간') : $t('{0}시간', m / 60); };
export const TIPS = {
  nest: [$t('둥지'), $t('둥지에 {0}마다 알이 생겨요{1}. 둥지를 눌러 알을 부화 칸에 넣어 보세요.', span(B.nest.every), [].concat(B.nest.early).some(t => t.n > B.nest.start) ? $t('(처음 몇 개는 더 빨리)') : '')],
  hatch: [$t('부화'), $t('시간이 다 되면 부화 칸을 눌러 부화해요. 기다리는 동안 게임을 닫아도 돼요.')],
  next: [$t('다음 알'), $t('알마다 뭐가 나올지 몰라요. 둥지에 다음 알이 있어요.')], // inbox 64-A: was a toast at the top, over 첫날 할 일·전체 보기
  grow: [$t('자라기'), $t('새끼는 시간이 지나면 자라요. 동물을 눌러 쓰다듬거나 먹이를 주면 조금 빨라져요. 친구들에서 얼마나 자랐는지 봐요.')],
  decor: [$t('꾸미기'), $t('동물을 눌러 쓰다듬으면 하트가 생겨요. 하트로 소품을 사서 끌어다 놓아요. 놓은 소품은 다시 옮겨도 무료예요.')],
  train: [$t('기차'), $t('레일 끝을 이어 고리를 만들면 기차가 달려요.')], // inbox 37: the first rail bought
  carry: [$t('옮기기'), $t('꾹 누르면 옮길 수 있어요. 동물을 꾹 눌러 들어 올리면 태어난 날이 보이고, 든 채로 옆으로 밀면 빙글 돌아요. 손가락을 떼면 그 자리에 내려놓아요. 놀이 소품 위에 놓으면 바로 놀아요.')], // inbox 42 E
  expand: [$t('땅 넓히기'), $t('땅을 넓히면 동물도 소품도 더 둘 수 있어요.')],
  nature: [$t('자연'), $t('나무·바위·덤불도 눌러서 옮기거나 치울 수 있어요.')], // inbox 42 F-6
  codex: [$t('도감'), $t('서식지마다 도감이 따로 있어요. 못 찾은 칸을 누르면 어디서 나오는지 알려 줘요.')],
  level: [$t('레벨'), $t('도감 새 칸, 다 자란 동물, 쓰다듬기, 하루 첫 방문으로 XP가 모여요. 레벨이 오르면 소품 세트·붓·큰 소품·땅 넓히기가 풀려요. 업적을 달성하면 XP를 받아요. 위의 Lv를 눌러 봐요.')],
  unlock: [$t('새 서식지'), $t('새 서식지가 열렸어요! 위의 서식지 이름을 누르면 바로 갈 수 있어요.')],
};
// one for a loading screen (not 'unlock': that one is news)
export const loadTip = () => { const k = Object.keys(TIPS).filter(k => k !== 'unlock'), [t, d] = TIPS[k[Math.floor(Math.random() * k.length)]]; return `<b>${t}</b> ${d}`; };
