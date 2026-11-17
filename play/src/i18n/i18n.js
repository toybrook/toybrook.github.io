// 119 언어: 한국어 · English · 日本語. The Korean text in the code is the key: $t('하트 {0}개', n) looks it up in en.js / ja.js
// ({ '원문': '번역' }) and falls back to the Korean (a missing key never shows blank). {0} {1} ... are the arguments in order.
// The language: 설정 › 언어 (PREFS.lang, kept in toyhabitat.prefs), else the device's first language (ko / ja / anything else en).
// A change reloads the page (main.js), so every module, data name and DOM text is built once in one language.
// Node (check-eggs, sims) has no window: always Korean, no dictionary.
export const LANGS = { ko: '한국어', en: 'English', ja: '日本語' };
const pick = () => {
  if (typeof window === 'undefined') return 'ko';
  try { const l = JSON.parse(localStorage.getItem('toyhabitat.prefs') || '{}').lang; if (LANGS[l]) return l; } catch { /* broken prefs: the device */ }
  const q = new URLSearchParams(location.search).get('lang'); if (LANGS[q]) return q; // ?lang=en (shots, the site's links)
  const d = String((navigator.languages || [])[0] || navigator.language || 'ko').slice(0, 2).toLowerCase();
  return d === 'ko' || d === 'ja' ? d : 'en';
};
export const LANG = pick();
export const LOC = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' }[LANG]; // dates (toLocaleDateString, Intl)
const D = LANG === 'en' ? (await import('./en.js')).default : LANG === 'ja' ? (await import('./ja.js')).default : {};
// {이/가} {을/를} ... (Korean only): the josa that fits the argument just before it (other languages leave it out)
const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };
export const $t = (s, ...a) => {
  const r = D[s] || s; if (!a.length && !r.includes('/')) return r;
  let last = '';
  return r.replace(/\{(\d+)\}|\{([가-힣])\/([가-힣])\}/g, (m, i, x, y) => i != null ? (last = a[i] ?? '') : josa(last, x, y));
};
export const SEP = LANG === 'ja' ? '、' : ', '; // 124: a list of names (Japanese 「、」)
// back to the Korean (이용 통계 keeps one name per habitat / accessory in every language)
let RD = null;
export const ko = s => LANG === 'ko' ? s : (RD ||= Object.fromEntries(Object.entries(D).reverse().map(([k, v]) => [v, k])))[s] || s; // 124: one word, two keys (흰색·하양 = White): the first key wins
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG;
  if (LANG === 'ja') document.documentElement.classList.add('ja'); // style.css: Japanese fonts first
}
// index.html's own text (no code builds it): every text node and aria-label / alt / title / placeholder whose whole trimmed
// text is a key; an element with data-t takes its whole innerHTML as one key (a sentence with <b> inside)
export const localize = root => {
  if (LANG === 'ko') return;
  for (const el of root.querySelectorAll('[data-t]')) { const k = el.innerHTML.trim(); if (D[k]) el.innerHTML = D[k]; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const k = n.nodeValue.trim(); if (k && D[k]) n.nodeValue = n.nodeValue.replace(k, D[k]); }
  for (const a of ['aria-label', 'alt', 'title', 'placeholder', 'content']) for (const el of root.querySelectorAll(`[${a}]`)) { const k = el.getAttribute(a).trim(); if (D[k]) el.setAttribute(a, D[k]); }
};
