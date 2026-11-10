// 사이트의 바깥 주소와 메일은 여기 한 곳에만 적습니다. 'TODO'인 동안 그 링크는 눌러도 이동하지 않습니다.
const SITE = {
  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSdhOcH-Ljao3GnRUU3X5YHTaDOkuRqfB5WoITMuPCDWGVL5Bg/viewform', // 업데이트 소식 받기 양식
  FEEDBACK_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSeHXV6tlH6IS3tlu7Xb71qeh1fvIbkzNHUoUHnSY3j_u7dcpA/viewform', // 의견 보내기 양식(개인정보 없음). 게임 정보 미리 채우기: ?usp=pp_url&entry.2112099919=<값>
  PLAY_URL: 'https://toybrook.github.io/play/', // 게임 주소(inbox 33 오픈 베타). 'TODO'로 두면 「지금 플레이하기」는 「곧 열려요」로 바뀌고 눌리지 않습니다
  RATING_MARK: 'TODO',   // 등급분류 뒤 등급 그림 파일(예: img/rating.png). 그림과 글이 모두 'TODO'면 등급 자리를 숨깁니다
  RATING_TEXT: 'TODO',   // 등급분류 뒤 등급과 번호(예: 전체이용가 · 등급분류번호 …)
  THREADS_URL: 'https://www.threads.com/@toybrook.game',   // 스레드 계정 주소
  CONTACT_EMAIL: 'toybrook1107@gmail.com', // 문의·삭제 요청을 받을 메일 주소
};

const on = v => v && v !== 'TODO';
// <a data-link="FORM_URL">: href를 채웁니다. data-show가 있으면 글자도 메일 주소로 바꿉니다.
// 값이 'TODO'면 href를 지워 눌리지 않게 하고, data-soon이 있으면 글자를 그것으로 바꿉니다.
for (const a of document.querySelectorAll('[data-link]')) {
  const k = a.dataset.link, v = SITE[k], mail = k === 'CONTACT_EMAIL';
  if (!on(v)) { a.removeAttribute('href'); a.dataset.todo = k; if (a.dataset.soon) a.textContent = a.dataset.soon; continue; }
  a.href = mail ? 'mailto:' + v : v;
  if (mail && 'show' in a.dataset) a.textContent = v;
}
// 등급 자리(index.html의 #rating): 등급분류를 받아 RATING_MARK나 RATING_TEXT를 채우면 보입니다.
const rating = document.getElementById('rating');
if (rating && (on(SITE.RATING_MARK) || on(SITE.RATING_TEXT))) {
  const img = rating.querySelector('img');
  if (on(SITE.RATING_MARK)) { img.src = SITE.RATING_MARK; img.alt = on(SITE.RATING_TEXT) ? '' : '게임물 등급'; } else img.remove();
  rating.querySelector('span').textContent = on(SITE.RATING_TEXT) ? SITE.RATING_TEXT : '';
  rating.hidden = false;
}
