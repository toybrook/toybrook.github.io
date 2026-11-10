// 24-2 꾸미기 코드 (꾸미기 › 코드): this habitat's layout as a code and a QR (game/layout.js), a code loaded (pasted, or read from a
// QR photo where the browser can: BarcodeDetector), 「불러오기 전으로」 once, the 미리보기 cleared, and 정원 구경하기: the
// operator's picks in gardens/gardens.json beside the game (same origin, a relative address: no other server is asked).
// A code holds only where things stand; no animals, hearts, eggs, names or anything about the player.
import * as G from '../game/game.js';
import { HABITATS, PROPS } from '../game/data.js';
import { levelOf, LAY_NAMES } from '../game/rules.js';
import { encode, decode } from '../game/layout.js';
import qrcode from '../../vendor/qrcode.js';
import { ask, toast } from './hud.js';

const $ = id => document.getElementById(id), el = $('share'), LIST = 'gardens/gardens.json';
const habName = id => HABITATS.find(h => h.id === id)?.name ?? id;
const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// an entry of gardens.json the game will show: a title, a habitat it knows, a code that reads, a photo in gardens/ (nothing elsewhere)
const okGarden = g => g && typeof g.title === 'string' && g.title.length <= 40 && HABITATS.some(h => h.id === g.hab) && typeof g.code === 'string'
  && !decode(g.code).error && decode(g.code).hab === g.hab && /^gardens\/[\w-]+\.(jpg|png|webp)$/.test(g.photo);
let habId = null, hab = null, before = null, msg = '', gardens = null; // gardens: null (not asked yet), 'wait', 'err' or the list

// id: the habitat, api: its habitat.js, keep: decor.js's 되돌리기 step, taken just before a code is loaded
export function openShare(id, api, keep) { habId = id; hab = api; before = keep; msg = ''; el.hidden = false; draw(); el.scrollTop = 0; }

function qr(text) { try { const q = qrcode(0, 'L'); q.addData(text); q.make(); return q.createDataURL(4, 4); } catch { return null; } } // too long: none
function gardenList() {
  if (gardens === 'wait') return '<p class="bkp">불러오는 중…</p>';
  if (gardens === 'err') return '<p class="bkp">목록을 읽지 못했어요 · 잠시 뒤 다시 해 주세요</p><div class="seg"><button data-act="gardens">다시 보기</button></div>';
  if (!gardens) return '<div class="seg"><button data-act="gardens">추천 정원 보기</button></div>';
  if (!gardens.length) return '<p class="bkp">아직 추천 정원이 없어요</p>';
  return `<div class="gcards">${gardens.map((g, i) => `<div class="gcard"><img src="${esc(g.photo)}" alt="" loading="lazy"><b>${esc(g.title)}</b><small>${habName(g.hab)}</small>
<button data-g="${i}"${g.hab === habId ? '' : ' disabled'}>${g.hab === habId ? '불러오기' : `${habName(g.hab)}에서 불러와요`}</button></div>`).join('')}</div>`;
}
function draw() {
  const code = encode(G.S, habId), q = qr(code), ghosts = G.S.ghost?.[habId]?.length || 0, v = $('shText')?.value || '';
  el.innerHTML = `<div><h2>꾸미기 코드 · ${habName(habId)}</h2>
<p class="bkp">이 서식지의 소품 자리와 방향·색·크기, 쌓은 것, 칠한 땅, 넓히기 단계만 담겨요. 동물·하트·알·이름은 들어가지 않아요.</p>
<div class="row"><b>배치 저장 칸</b>${LAY_NAMES.map((d, k) => { const L = G.S.lays?.[habId]?.[k]; // 28-5: 3 named layouts, saved as their codes
    return `<div class="lay"><input id="lay${k}" maxlength="8" value="${esc(L?.n ?? d)}" aria-label="${k + 1}번 칸 이름" autocomplete="off"><button data-save="${k}">${L ? '덮어쓰기' : '저장'}</button><button data-lay="${k}"${L ? '' : ' disabled'}>불러오기</button></div>`; }).join('')}</div>
<div class="row"><b>내 꾸미기 코드</b>${q ? `<img class="shqr" src="${q}" alt="내 꾸미기 코드 QR">` : '<p class="bkp">코드가 길어서 QR은 못 만들어요 · 글자 코드를 보내 주세요</p>'}
<textarea id="shMine" rows="2" readonly spellcheck="false">${code}</textarea><div class="seg"><button data-act="copy">코드 복사</button></div></div>
<div class="row"><b>코드 불러오기</b><textarea id="shText" rows="3" placeholder="받은 꾸미기 코드(TG1.…)를 붙여 넣어요" spellcheck="false" autocomplete="off"></textarea>
<div class="seg"><button data-act="load">불러오기</button>${'BarcodeDetector' in window ? '<button data-act="pick">QR 사진 고르기</button>' : ''}</div></div>
<p class="bkmsg" role="status"${msg ? '' : ' hidden'}>${msg}</p>
${G.S.layoutUndo?.hab === habId ? '<div class="row"><b>되돌리기</b><div class="seg"><button data-act="undo">불러오기 전으로 되돌리기</button></div></div>' : ''}
${ghosts ? `<div class="row"><b>반투명 미리보기 ${ghosts}개</b><div class="seg"><button data-act="clear">미리보기 지우기</button></div></div>` : ''}
<div class="row"><b>정원 구경하기</b>${gardenList()}</div>
<input type="file" id="shFile" accept="image/*" hidden>
<button data-close>닫기</button></div>`;
  $('shText').value = v;
  $('shFile').onchange = async e => { // a photo of a QR: the browser's own reader (Android Chrome and others; the button shows only then)
    const f = e.target.files[0]; if (!f) return;
    try { const [c] = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(await createImageBitmap(f)); if (!c) return say('사진에서 QR을 찾지 못했어요'); $('shText').value = c.rawValue; load(c.rawValue); }
    catch { say('사진을 읽지 못했어요 · 코드를 붙여 넣어 주세요'); }
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
  const t = [n.placed ? `소품 ${n.placed}개를 그 자리에 놓았어요` : '가진 소품 중엔 놓을 게 없었어요'];
  if (n.trees) t.push(`나무·덤불·바위·꽃 ${n.trees}개도 코드 자리로`);
  if (n.ghost) { const c = {}; for (const g of G.S.ghost?.[habId] || []) c[g.prop] = (c[g.prop] || 0) + 1; // 28-5: which ones are missing
    t.push(`모자란 소품 ${n.ghost}개(${Object.entries(c).map(([id, k]) => `${PROPS.find(P => P.id === id)?.name ?? id}${k > 1 ? ` ${k}` : ''}`).join(', ')})는 반투명 미리보기예요(레벨·하트로 얻으면 그 자리에서 시작해요)`); }
  if (n.off || n.cellOff) t.push(`자리가 안 맞아 ${[n.off && `${n.off}개`, n.cellOff && `칠한 칸 ${n.cellOff}`].filter(Boolean).join('와 ')}는 빠졌어요${d.step > levelOf(G.S, habId) ? '(땅을 넓히면 더 들어가요)' : ''}`);
  if (n.full) t.push(`소품 칸이 모자라 ${n.full}개는 빠졌어요`);
  if (n.nat) t.push(`나무·덤불·바위·꽃이 모자라 ${n.nat}개는 빠졌어요`);
  if (n.lock) t.push(`아직 못 쓰는 붓이라 ${n.lock}칸은 칠하지 않았어요`);
  if (n.unknown) t.push(`모르는 소품 ${n.unknown}개는 건너뛰었어요`);
  return t.join(' · ');
}
async function load(text, title) {
  const d = decode(text); if (d.error) return say(d.error);
  if (d.hab !== habId) return say(`${habName(d.hab)} 꾸미기 코드예요 · ${G.S.unlocked.includes(d.hab) ? `${habName(d.hab)}에서 불러와 주세요` : '그 서식지를 연 뒤에 불러올 수 있어요'}`);
  if (!await ask(`지금 ${habName(habId)} 배치를 ${title ? `「${title}」` : '이 코드'}로 바꿔요.\n가진 소품만 놓이고, 없는 소품은 반투명 미리보기로 보여요.\n지금 배치는 한 번 남겨 둘게요.`, '불러오기')) return;
  before?.(); const n = G.importLayout(habId, d, hab.decor.fitAll, hab.decor.cellOk); if (!n) return say('불러오지 못했어요');
  el.hidden = true; toast(summary(n, d), 6000);
}

el.onclick = async e => {
  const b = e.target.closest('button'), d = b?.dataset; if (!d || b.disabled) return;
  if (d.close != null) { el.hidden = true; return; }
  if (d.act === 'copy') return say(await copy($('shMine').value) ? '꾸미기 코드를 복사했어요 · 메시지나 의견 양식에 붙여 넣어 보내요' : '복사가 안 돼요 · 위 칸의 코드를 길게 눌러 복사해 주세요');
  if (d.act === 'load') return load($('shText').value);
  if (d.act === 'pick') return $('shFile').click();
  if (d.act === 'gardens') return loadGardens();
  if (d.g) { const g = gardens[+d.g]; return load(g.code, g.title); }
  if (d.save) { const k = +d.save, had = G.S.lays?.[habId]?.[k]; // 28-5 배치 저장 칸
    if (had && !await ask(`「${had.n}」 칸을 지금 배치로 덮어써요.`, '덮어쓰기')) return;
    const L = G.saveLay(habId, k, $('lay' + k).value); return say(L ? `「${esc(L.n)}」에 지금 배치를 저장했어요` : '저장하지 못했어요'); }
  if (d.lay) { const L = G.S.lays?.[habId]?.[+d.lay]; if (L) return load(L.c, L.n); }
  if (d.act === 'undo') {
    if (!await ask('불러오기 전 배치로 돌아가요. 지금 배치는 사라져요.', '되돌리기')) return;
    before?.(); G.undoImport(); el.hidden = true; toast('불러오기 전 배치로 돌아왔어요'); return;
  }
  if (d.act === 'clear') { before?.(); G.clearGhost(habId); return say('미리보기를 지웠어요'); }
};
