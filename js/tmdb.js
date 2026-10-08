// TMDB API: arama, dizi/film detayı, sezon bölüm listeleri.
// Bu ürün TMDB API'sini kullanır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır.
import { getSettings } from './settings.js';

const BASE = 'https://api.themoviedb.org/3';

export const hasKey = () => Boolean(getSettings().tmdbKey);

// Veri dosyası elle bozulsa bile CSS/URL enjeksiyonu olmasın diye yalnızca düz dosya yollarını kabul eder.
export function img(path, size = 'w342') {
  return typeof path === 'string' && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : '';
}

async function api(path, params = {}) {
  const key = (getSettings().tmdbKey || '').trim();
  if (!key) throw new Error('TMDB anahtarı girilmemiş. Ayarlardan ekleyebilirsin.');
  const url = new URL(BASE + path);
  url.searchParams.set('language', 'tr-TR');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const init = { headers: {} };
  if (key.startsWith('eyJ')) init.headers.Authorization = `Bearer ${key}`; // v4 okuma jetonu
  else url.searchParams.set('api_key', key); // v3 API anahtarı
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('TMDB\'ye ulaşılamadı.');
  }
  if (res.status === 401) throw new Error('TMDB anahtarı geçersiz.');
  if (!res.ok) throw new Error(`TMDB hatası (${res.status}).`);
  return res.json();
}

// Türkçe özet boşsa İngilizcesini kullan.
async function withOverview(path, data) {
  if (data.overview) return data;
  try {
    data.overview = (await api(path, { language: 'en-US' })).overview || '';
  } catch {
    /* özet olmadan devam */
  }
  return data;
}

export const ping = () => api('/configuration');

export async function search(query) {
  const data = await api('/search/multi', { query, include_adult: 'false' });
  return data.results.filter((r) => r.media_type === 'tv' || r.media_type === 'movie');
}

const seasonCache = new Map();
export const cachedSeason = (tvId, n) => seasonCache.get(`${tvId}:${n}`) || null;

export async function season(tvId, n) {
  const hit = cachedSeason(tvId, n);
  if (hit) return hit;
  // Kimlikler veri dosyasından gelir; yol parçası olmadan önce sayı olduklarından emin ol.
  if (!Number.isInteger(tvId) || !Number.isInteger(n)) throw new Error('Geçersiz dizi ya da sezon kimliği.');
  const data = await api(`/tv/${tvId}/season/${n}`);
  const eps = (data.episodes || []).map((e) => ({
    episode: e.episode_number,
    name: e.name,
    airDate: e.air_date || '',
    overview: e.overview || '',
  }));
  seasonCache.set(`${tvId}:${n}`, eps);
  return eps;
}

// TMDB yanıtını kütüphanedeki kayıt biçimine çevirir.
export async function buildItem(type, tmdbId) {
  const path = `/${type}/${tmdbId}`;
  const d = await withOverview(path, await api(path));
  const date = d.first_air_date || d.release_date || '';
  const item = {
    id: `${type}-${tmdbId}`,
    type,
    tmdbId,
    title: d.name || d.title,
    originalTitle: d.original_name || d.original_title || '',
    year: date ? Number(date.slice(0, 4)) : null,
    poster: d.poster_path || '',
    backdrop: d.backdrop_path || '',
    overview: d.overview || '',
    genres: (d.genres || []).map((g) => g.name),
    status: type === 'tv' ? 'watching' : 'finished',
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: null,
    comment: '',
    questions: [],
    tags: [],
    watchedAt: '',
    spoiler: false,
  };
  if (type === 'tv') {
    item.seasons = (d.seasons || []).map((s) => ({ n: s.season_number, count: s.episode_count }));
    item.episodeCount = d.number_of_episodes || 0;
    item.episodes = {};
  } else {
    item.runtime = d.runtime || 0;
  }
  return item;
}
