// 24-2 꾸미기 코드 (꾸미기 › 코드): this habitat's layout as a code and a QR (game/layout.js), a code loaded (pasted, or read from a
// QR photo where the browser can: BarcodeDetector), 「불러오기 전으로」 once, the 미리보기 cleared, and 정원 구경하기: the
// operator's picks in gardens/gardens.json beside the game (same origin, a relative address: no other server is asked).
// A code holds only where things stand; no animals, hearts, eggs, names or anything about the player.
// 69-4: what goes out is the 구경 링크 (ui/visit.js: the layout + the friends out there, opened to look at only), its QR and
// 사진 모드's 구경 그림; a link pasted or read from a QR loads like a code. TG1 codes still load (and the 배치 저장 칸 keep them).
import { $t, SEP, esc } from '../i18n/i18n.js';
import * as G from '../game/game.js';
import { HABITATS, PROPS } from '../game/data.js';
import { levelOf, LAY_NAMES } from '../game/rules.js';
import { decode } from '../game/layout.js';
import { ask, toast } from './hud.js';
import { seeLink, send } from './visit.js';
import { readSee } from '../game/visit.js';
import { track } from './stats.js';
import { TOSS } from '../config.js';

const $ = id => document.getElementById(id), el = $('share'), LIST = 'gardens/gardens.json';
const habName = id => HABITATS.find(h => h.id === id)?.name ?? id;
// an entry of gardens.json the game will show: a title, a habitat it knows, a code that reads, a photo in gardens/ (nothing elsewhere)
const okGarden = g => g && typeof g.title === 'string' && g.title.length <= 40 && HABITATS.some(h => h.id === g.hab) && typeof g.code === 'string'
  && !decode(g.code).error && decode(g.code).hab === g.hab && /^gardens\/[\w-]+\.(jpg|png|webp)$/.test(g.photo);
let habId = null, hab = null, before = null, msg = '', gardens = null; // gardens: null (not asked yet), 'wait', 'err' or the list
let qrcode = null; // 67-2: vendor/qrcode.js (52 KB) not with the first screen's code: when 꾸미기 코드 first opens

// id: the habitat, api: its habitat.js, keep: decor.js's 되돌리기 step, taken just before a code is loaded
export function openShare(id, api, keep) { habId = id; hab = api; before = keep; msg = '';
  const go = () => { el.hidden = false; draw(); el.scrollTop = 0; };
  if (qrcode) go(); else import('../../vendor/qrcode.js').then(m => { qrcode = m.default; }, () => {}).then(go); }

function qr(text) { try { const q = qrcode(0, 'L'); q.addData(text); q.make(); return q.createDataURL(4, 4); } catch { return null; } } // too long: none
function gardenList() {
  if (gardens === 'wait') return $t('<p class="bkp">불러오는 중…</p>');
  if (gardens === 'err') return $t('<p class="bkp">목록을 읽지 못했어요 · 잠시 뒤 다시 해 주세요</p><div class="seg"><button data-act="gardens">다시 보기</button></div>');
  if (!gardens) return $t('<div class="seg"><button data-act="gardens">추천 정원 보기</button></div>');
  if (!gardens.length) return $t('<p class="bkp">아직 추천 정원이 없어요</p>');
  return `<div class="gcards">${gardens.map((g, i) => `<div class="gcard"><img src="${esc(g.photo)}" alt="" loading="lazy"><b>${esc(g.title)}</b><small>${habName(g.hab)}</small>
<button data-g="${i}"${g.hab === habId ? '' : ' disabled'}>${g.hab === habId ? $t('불러오기') : $t('{0}에서 불러와요', habName(g.hab))}</button></div>`).join('')}</div>`;
}
function draw() {
  const url = seeLink(habId), q = qr(url), ghosts = G.S.ghost?.[habId]?.length || 0, v = $('shText')?.value || '';
  el.innerHTML = $t('<div><h2>구경 링크 · {0}</h2>\n<p class="bkp">소품 자리와 방향·색·크기, 쌓은 것, 칠한 땅, 넓히기 단계, 나와 있는 동물의 종류·색·장식이 담겨요. 이름·하트·알은 들어가지 않아요.</p>\n<div class="row"><b>배치 저장 칸</b>{1}</div>\n<div class="row"><b>구경 링크</b><p class="bkp">받은 사람은 이 서식지를 둘러보기만 해요 · 그 사람의 저장은 바뀌지 않아요</p>{2}\n<textarea id="shMine" rows="3" readonly spellcheck="false">{3}</textarea><div class="seg"><button data-act="send">링크 보내기</button><button data-act="copy">복사</button><button data-act="card">구경 그림</button></div></div>\n<div class="row"><b>불러오기</b><textarea id="shText" rows="3" placeholder="받은 구경 링크나 꾸미기 코드(TG1.…)를 붙여 넣어요" spellcheck="false" autocomplete="off"></textarea>\n<div class="seg"><button data-act="load">불러오기</button>{4}</div></div>\n<p class="bkmsg" role="status"{5}>{6}</p>\n{7}\n{8}\n<div class="row"><b>정원 구경하기</b>{9}</div>\n<input type="file" id="shFile" accept="image/*" hidden>\n<button data-close>닫기</button></div>', habName(habId), LAY_NAMES.map((d, k) => { const L = G.S.lays?.[habId]?.[k]; // 28-5: 3 named layouts, saved as their codes
    return $t('<div class="lay"><input id="lay{0}" maxlength="8" value="{1}" aria-label="{2}번 칸 이름" autocomplete="off"><button data-save="{3}">{4}</button><button data-lay="{5}"{6}>불러오기</button></div>', k, esc(L?.n ?? d), k + 1, k, L ? $t('덮어쓰기') : $t('저장'), k, L ? '' : ' disabled'); }).join(''), q ? $t('<img class="shqr" src="{0}" alt="구경 링크 QR">', q) : $t('<p class="bkp">배치가 많아 QR은 못 만들어요 · 링크를 보내 주세요</p>'), url, 'BarcodeDetector' in window ? $t('<button data-act="pick">QR 사진 고르기</button>') : '', msg ? '' : ' hidden', msg, G.S.layoutUndo?.hab === habId ? $t('<div class="row"><b>되돌리기</b><div class="seg"><button data-act="undo">불러오기 전으로 되돌리기</button></div></div>') : '', ghosts ? $t('<div class="row"><b>반투명 미리보기 {0}개</b><div class="seg"><button data-act="clear">미리보기 지우기</button></div></div>', ghosts) : '', gardenList());
  if (TOSS) { $('shMine').closest('.row').remove(); el.querySelector('h2').textContent = $t('꾸미기 배치 · {0}', habName(habId)); } // 174
  $('shText').value = v;
  $('shFile').onchange = async e => { // a photo of a QR: the browser's own reader (Android Chrome and others; the button shows only then)
    const f = e.target.files[0]; if (!f) return;
    try { const [c] = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(await createImageBitmap(f)); if (!c) return say($t('사진에서 QR을 찾지 못했어요')); $('shText').value = c.rawValue; load(c.rawValue); }
    catch { say($t('사진을 읽지 못했어요 · 코드를 붙여 넣어 주세요')); }
  };
}
const say = t => { msg = t; draw(); };

async function copy(code) {
  try { await navigator.clipboard.writeText(code); return true; } catch { /* http on a LAN: no clipboard API */ }
  const t = $('shMine'); t.focus(); t.select();
  try { return document.execCommand('copy'); } catch { return false; }
}
async function loadGardens() {
  gardens = 'wait'; draw();
  try {
    const r = await fetch(LIST, { cache: 'no-cache' }); if (!r.ok) throw 0;
    const j = await r.json(); gardens = (Array.isArray(j?.gardens) ? j.gardens : []).filter(okGarden).slice(0, 24);
  } catch { gardens = 'err'; }
  if (!el.hidden) draw();
}
// what loading did, in one line (rules.js importLayout counts)
function summary(n, d) {
  const t = [n.placed ? $t('소품 {0}개를 그 자리에 놓았어요', n.placed) : $t('가진 소품 중엔 놓을 게 없었어요')];
  if (n.trees) t.push($t('나무·덤불·바위·꽃 {0}개도 코드 자리로', n.trees));
  if (n.ghost) { const c = {}; for (const g of G.S.ghost?.[habId] || []) c[g.prop] = (c[g.prop] || 0) + 1; // 28-5: which ones are missing
    t.push($t('모자란 소품 {0}개({1})는 반투명 미리보기예요(레벨·하트로 얻으면 그 자리에서 시작해요)', n.ghost, Object.entries(c).map(([id, k]) => `${PROPS.find(P => P.id === id)?.name ?? id}${k > 1 ? ` ${k}` : ''}`).join(SEP))); }
  if (n.off || n.cellOff) t.push($t('자리가 안 맞아 {0}는 빠졌어요{1}', [n.off && $t('{0}개', n.off), n.cellOff && $t('칠한 칸 {0}', n.cellOff)].filter(Boolean).join($t('와 ')), d.step > levelOf(G.S, habId) ? $t('(땅을 넓히면 더 들어가요)') : ''));
  if (n.full) t.push($t('소품 칸이 모자라 {0}개는 빠졌어요', n.full));
  if (n.nat) t.push($t('나무·덤불·바위·꽃이 모자라 {0}개는 빠졌어요', n.nat));
  if (n.lock) t.push($t('아직 못 쓰는 붓이라 {0}칸은 칠하지 않았어요', n.lock));
  if (n.unknown) t.push($t('모르는 소품 {0}개는 건너뛰었어요', n.unknown));
  return t.join(' · ');
}
async function load(text, title) {
  const m = /#see=([\w.-]+)/.exec(text), d = m ? readSee(m[1])?.d ?? { error: $t('구경 링크가 깨졌어요 · 처음부터 끝까지 다시 복사해 주세요') } : decode(text); if (d.error) return say(d.error); // 69-4: a link loads its layout
  if (d.hab !== habId) return say($t('{0} 꾸미기 코드예요 · {1}', habName(d.hab), G.S.unlocked.includes(d.hab) ? $t('{0}에서 불러와 주세요', habName(d.hab)) : $t('그 서식지를 연 뒤에 불러올 수 있어요')));
  if (!await ask($t('지금 {0} 배치를 {1}로 바꿔요.\n가진 소품만 놓이고, 없는 소품은 반투명 미리보기로 보여요.\n지금 배치는 한 번 남겨 둘게요.', habName(habId), title ? `「${title}」` : $t('이 코드')), $t('불러오기'))) return;
  before?.(); const n = G.importLayout(habId, d, hab.decor.fitAll, hab.decor.cellOk); if (!n) return say($t('불러오지 못했어요'));
  el.hidden = true; toast(summary(n, d), 6000);
}

el.onclick = async e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d || b.disabled) return;
  if (d.close != null) { el.hidden = true; return; }
  if (d.act === 'copy') return say(await copy($('shMine').value) ? $t('구경 링크를 복사했어요 · 메신저에 붙여 넣어 보내요') : $t('복사가 안 돼요 · 위 칸의 링크를 길게 눌러 복사해 주세요'));
  if (d.act === 'send') { track('see_sent', undefined, 'see_sent#'); return send($('shMine').value, $t('{0} 구경 오세요 · 토이브룩', habName(habId))); } // 69-4
  if (d.act === 'card') { el.hidden = true; (await import('./decor.js')).closeDecor(); $('snapBtn').click(); return; } // 69-4: framed in 사진 모드, then 구경 그림
  if (d.act === 'load') return load($('shText').value);
  if (d.act === 'pick') return $('shFile').click();
  if (d.act === 'gardens') return loadGardens();
  if (d.g) { const g = gardens[+d.g]; return load(g.code, g.title); }
  if (d.save) { const k = +d.save, had = G.S.lays?.[habId]?.[k]; // 28-5 배치 저장 칸
    if (had && !await ask($t('「{0}」 칸을 지금 배치로 덮어써요.', had.n), $t('덮어쓰기'))) return;
    const L = G.saveLay(habId, k, $('lay' + k).value); return say(L ? $t('「{0}」에 지금 배치를 저장했어요', esc(L.n)) : $t('저장하지 못했어요')); }
  if (d.lay) { const L = G.S.lays?.[habId]?.[+d.lay]; if (L) return load(L.c, L.n); }
  if (d.act === 'undo') {
    if (!await ask($t('불러오기 전 배치로 돌아가요. 지금 배치는 사라져요.'), $t('되돌리기'))) return;
    before?.(); G.undoImport(); el.hidden = true; toast($t('불러오기 전 배치로 돌아왔어요')); return;
  }
  if (d.act === 'clear') { before?.(); G.clearGhost(habId); return say($t('미리보기를 지웠어요')); }
};
