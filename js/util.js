export const STATUS = {
  watching: 'İzliyorum',
  finished: 'İzledim',
  planned: 'Listede',
  dropped: 'Bıraktım',
};

export const epKey = (season, episode) => `${season}x${episode}`;

export function fmtRating(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function ratingClass(v) {
  if (v >= 8.5) return 'r-great';
  if (v >= 7) return 'r-good';
  if (v >= 5) return 'r-mid';
  return 'r-low';
}

// Dizide genel puan yoksa bölüm puanlarının ortalaması gösterilir.
export function displayRating(item) {
  if (typeof item.rating === 'number') return { value: item.rating, derived: false };
  const rs = Object.values(item.episodes || {})
    .map((e) => e.rating)
    .filter((r) => typeof r === 'number');
  if (!rs.length) return null;
  return { value: Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10, derived: true };
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Arama için: küçük harf, aksan ve noktalı/noktasız i farkı yok sayılır.
export function fold(s) {
  return String(s || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i');
}

export function snippet(text, n = 140) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

export function entryHasContent(e) {
  return Boolean(e && (typeof e.rating === 'number' || e.comment || (e.questions && e.questions.length)));
}

export function reviewedEpisodes(item) {
  return Object.values(item.episodes || {}).sort((a, b) => a.season - b.season || a.episode - b.episode);
}
