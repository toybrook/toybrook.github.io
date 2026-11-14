// inbox 61 C 「토이브룩 어때요? 😍 🙂 😐」: once a day, after 3 minutes on the game screen that day, a small bar at the bottom.
// A tap sends only the stats event rate (love / ok / meh; stats.js: not when stats are off, Do Not Track or GPC) and then offers
// 「한 줄 더 남기기」 (the feedback form). Not tapped: gone after 20 s, not again that day. fbUrl: the form's address, or null
import { track, playedToday, rateDay, firstDay } from './stats.js';
import { topWindow, overlayOpen } from './hud.js';

const FACES = [['love', '😍', '좋아요'], ['ok', '🙂', '괜찮아요'], ['meh', '😐', '그저 그래요']];
export function initRate(fbUrl) {
  const t = setInterval(() => {
    if (playedToday() < (firstDay() ? 600 : 180) || // 92-4: the first day after 10 minutes only
        document.hidden || topWindow() || overlayOpen() || document.body.classList.contains('photo')) return;
    clearInterval(t); if (!rateDay()) return;
    const bar = Object.assign(document.createElement('div'), { className: 'rate', role: 'group' }); bar.setAttribute('aria-label', '토이브룩 어때요?');
    const shut = '<button class="x" data-x aria-label="닫기">✕</button>';
    bar.innerHTML = `<span>토이브룩 어때요?</span>${FACES.map(([v, f, t]) => `<button data-v="${v}" aria-label="${t}">${f}</button>`).join('')}${shut}`;
    document.body.append(bar);
    let gone = setTimeout(() => bar.remove(), 20000);
    bar.onclick = e => {
      const b = e.target.closest('button,a'); if (!b) return;
      if (!b.dataset.v) return void setTimeout(() => bar.remove()); // ✕, or the form opened
      track('rate', { v: b.dataset.v }); clearTimeout(gone); gone = setTimeout(() => bar.remove(), 12000);
      const url = fbUrl?.();
      bar.innerHTML = `<span>고마워요!</span>${url ? `<a class="more" href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener">한 줄 더 남기기</a>` : ''}${shut}`;
    };
  }, 5000);
}
