// Kullanıcı ayarları: yalnızca bu tarayıcının localStorage'ında durur, repoya hiç girmez.
const KEY = 'jo.settings.v1';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* gizli sekme vb. — ayarlar kalıcı olmaz */
  }
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}

// kullanici.github.io/repo-adi adresinden sahip ve repo adını tahmin eder.
export function guessRepo() {
  const m = location.hostname.match(/^(.+)\.github\.io$/i);
  if (!m) return {};
  const first = location.pathname.split('/').filter(Boolean)[0];
  const repo = first && !first.includes('.') ? first : `${m[1]}.github.io`;
  return { owner: m[1], repo };
}
