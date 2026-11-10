// inbox 21 설정 › 내 저장 백업: copy the backup code, save it as a file, load one back (pasted or a file).
// Loading keeps the current save once (UNDO) and can put it back. game/backup.js makes and checks the code.
import * as G from '../game/game.js';
import { fromSave } from '../game/rules.js';
import { SCHEMA_VERSION } from '../game/data.js';
import { toCode, pack, unpack } from '../game/backup.js';
import { EDITION } from '../config.js';
import { ask, toast } from './hud.js';

const UNDO = 'toyhabitat.save.undo', DONE = 'toyhabitat.imported', DAY = 864e5;
const $ = id => document.getElementById(id), el = $('backup');
const date = t => new Date(t).toLocaleDateString('ko-KR');
const sumUp = s => `도감 ${Object.keys(s.codex || {}).length}칸 · 친구 ${(s.animals || []).length} · 하트 ${s.hearts ?? 0}`;
const undoSave = () => { try { return JSON.parse(localStorage.getItem(UNDO)); } catch { return null; } };

// the reminder (a dot on 설정 and one line on the 「자리 비운 사이」 card): codex 10+ and no backup for 7 days; can be turned off
export function due(now = G.now()) {
  const c = Object.values(G.S.codex), f = G.S.flags; if (c.length < 10 || f.backupNagOff) return false;
  return now - (f.backupAt ?? Math.min(...c.map(e => e.at))) > 7 * DAY;
}

let msg = '';
function draw() {
  const f = G.S.flags, u = undoSave();
  el.innerHTML = `<div><h2>내 저장 백업</h2>
<p class="bkp">기기를 바꿀 때 쓰는 저장이에요. 모은 동물·도감·하트·알·꾸미기가 모두 들어가요. ${f.backupAt ? `마지막 백업 ${date(f.backupAt)}` : '아직 백업한 적 없어요'}</p>
<div class="row"><b>백업하기</b><div class="seg"><button data-act="copy">백업 코드 복사</button><button data-act="file">파일로 저장</button></div></div>
<div class="row"><b>백업 불러오기</b><textarea id="bkText" rows="3" placeholder="여기에 백업 코드를 붙여 넣어요" spellcheck="false" autocomplete="off"></textarea>
<div class="seg"><button data-act="paste">코드 불러오기</button><button data-act="pick">파일 고르기</button></div></div>
<p class="bkmsg" role="status"${msg ? '' : ' hidden'}>${msg}</p>
${u ? `<div class="row"><b>되돌리기 <small>(${sumUp(u)})</small></b><div class="seg"><button data-act="undo">불러오기 전으로 되돌리기</button></div></div>` : ''}
<div class="row"><b>백업 알림</b><div class="seg"><button data-nag="on"${f.backupNagOff ? '' : ' class="on"'}>켜기</button><button data-nag="off"${f.backupNagOff ? ' class="on"' : ''}>끄기</button></div></div>
<input type="file" id="bkFile" accept=".json,application/json,text/plain" hidden>
<button data-close>닫기</button></div>`;
  $('bkFile').onchange = async e => { const file = e.target.files[0]; if (!file) return; if (file.size > 1e6) return say('너무 커서 백업이 아니에요'); load(await file.text()); };
}
const say = t => { const v = $('bkText')?.value || ''; msg = t; draw(); $('bkText').value = v; }; // keep what is in the box
// inbox 39: this device for homeHintDue (a home-screen app opens standalone: manifest display)
export const DEV = { ua: navigator.userAgent, touch: navigator.maxTouchPoints || 0,
  standalone: navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches };
export function open() { msg = ''; draw(); $('prefs').hidden = true; el.hidden = false; }

async function copy(code) {
  try { await navigator.clipboard.writeText(code); return true; } catch { /* http on a LAN: no clipboard API */ }
  const t = $('bkText'); t.value = code; t.select();
  try { return document.execCommand('copy'); } catch { return false; }
}
async function load(text) {
  const r = unpack(text, EDITION, SCHEMA_VERSION); if (r.err) return say(r.err);
  const s = fromSave(r.save, G.now()); if (!s) return say('읽을 수 없는 백업이에요');
  if (!await ask(`지금 저장을 덮어써요. 지금 저장은 자동으로 한 번 남겨 둘게요.\n\n불러올 백업: ${r.at ? date(r.at) + ' · ' : ''}${sumUp(s)}`, '불러오기')) return;
  try { localStorage.setItem(UNDO, JSON.stringify(G.S)); } catch { return say('기기 저장 공간이 모자라서 불러오지 못했어요'); }
  if (!G.replace(s)) { localStorage.removeItem(UNDO); return say('기기 저장 공간이 모자라서 불러오지 못했어요'); }
  sessionStorage.setItem(DONE, '1'); location.reload();
}
async function undo() {
  const u = undoSave(), s = u && fromSave(u, G.now()); if (!s) { localStorage.removeItem(UNDO); return say('되돌릴 저장이 없어요'); }
  if (!await ask(`불러오기 전 저장으로 돌아가요. 지금 저장은 사라져요.\n\n돌아갈 저장: ${sumUp(s)}`, '되돌리기')) return;
  if (!G.replace(s)) return say('기기 저장 공간이 모자라서 되돌리지 못했어요');
  localStorage.removeItem(UNDO); sessionStorage.setItem(DONE, 'undo'); location.reload();
}

el.onclick = async e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.close != null) { el.hidden = true; return; }
  if (d.nag) { G.flag('backupNagOff', d.nag === 'off'); return draw(); }
  if (d.act === 'copy' || d.act === 'file') G.flag('backupAt', G.now()); // the backup carries its own date
  if (d.act === 'copy') return say(await copy(toCode(G.S, EDITION)) ? '백업 코드를 복사했어요 · 메모나 메일에 붙여 넣어 두세요' : '복사가 안 돼요 · 아래 칸의 코드를 길게 눌러 복사해 주세요');
  if (d.act === 'file') {
    const a = document.createElement('a'), stamp = new Date().toLocaleDateString('sv-SE').replace(/-/g, '');
    a.href = URL.createObjectURL(new Blob([pack(G.S, EDITION)], { type: 'application/json' })); a.download = `toybrook-backup-${stamp}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return say('백업 파일을 저장했어요 · 다운로드 폴더를 확인해 주세요');
  }
  if (d.act === 'paste') return load($('bkText').value);
  if (d.act === 'pick') return $('bkFile').click();
  if (d.act === 'undo') return undo();
};

// after the reload: say what happened; release build with a beta save: say why it starts over (game.js kept it once)
// (in a timeout: this module runs before main.js has started the game)
setTimeout(() => {
  const done = sessionStorage.getItem(DONE); sessionStorage.removeItem(DONE);
  if (done) toast(done === 'undo' ? '불러오기 전 저장으로 돌아왔어요' : '백업을 불러왔어요 · 설정 › 내 저장 백업에서 되돌릴 수 있어요', 3500, true);
  else if (G.refused === 'beta' || G.bad) { // on the start card when it is up (a toast would sit under it)
    const t = G.bad ? '저장을 읽을 수 없어서 처음부터 시작해요. 백업 코드가 있으면 설정 › 내 저장 백업에서 불러올 수 있어요.' : '베타 데이터는 정식판으로 옮길 수 없어요. 처음부터 시작해요.', i = $('intro');
    if (i.hidden) toast(t, 4000, true); else i.querySelector('p').insertAdjacentHTML('afterend', `<p><b>${t}</b></p>`);
  }
}, 600);
