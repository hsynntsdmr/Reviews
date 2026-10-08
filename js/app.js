import { h, icon, toast } from './dom.js';
import { store, initStore, canEdit, commit } from './store.js';
import * as tmdb from './tmdb.js';
import { openEditor } from './editor.js';
import { openSearch } from './search.js';
import { openSettings } from './settings-ui.js';
import {
  STATUS,
  epKey,
  fmtRating,
  ratingClass,
  displayRating,
  fmtDate,
  today,
  fold,
  snippet,
  entryHasContent,
  reviewedEpisodes,
} from './util.js';

const root = document.getElementById('app');
const header = document.getElementById('header');
const APP_NAME = 'Jenerik Sonrası';

let route = { name: 'home' };
const filters = { q: '', type: 'all', status: 'all', sort: 'updated' };
const selectedSeason = {};

// ---------------------------------------------------------------- yönlendirme

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if ((parts[0] === 'tv' || parts[0] === 'movie') && parts[1]) {
    const num = (v) => (v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
    return { name: 'item', type: parts[0], id: parts[1], season: num(parts[2]), episode: num(parts[3]) };
  }
  return { name: 'home' };
}

function render({ keepScroll = false } = {}) {
  const y = window.scrollY;
  route = parseRoute();
  root.replaceChildren(route.name === 'item' ? itemView() : homeView());
  if (keepScroll) window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
  root.focus({ preventScroll: true });
});

const itemHref = (item, s, e) => `#/${item.type}/${item.tmdbId}${s != null ? `/${s}${e != null ? `/${e}` : ''}` : ''}`;

// ---------------------------------------------------------------- üst çubuk

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('jo.theme', t);
  } catch {
    /* yoksay */
  }
  renderHeader();
}

function renderHeader() {
  const dark = document.documentElement.dataset.theme === 'dark';
  header.replaceChildren(
    h(
      'div',
      { class: 'container header-inner' },
      h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, APP_NAME)),
      h(
        'nav',
        { class: 'header-actions', 'aria-label': 'Araçlar' },
        canEdit() ? h('span', { class: 'mode-chip' }, store.mode === 'github' ? 'Düzenleme açık' : 'Yerel mod') : null,
        canEdit()
          ? h('button', { class: 'btn primary', onclick: () => openSearch({ onAdded: (it) => (location.hash = itemHref(it)), onNeedSettings: openSettingsDialog }) }, icon('plus'), h('span', { class: 'btn-label' }, 'Ekle'))
          : null,
        h('button', { class: 'icon-btn', 'aria-label': dark ? 'Açık temaya geç' : 'Koyu temaya geç', onclick: () => setTheme(dark ? 'light' : 'dark') }, icon(dark ? 'sun' : 'moon')),
        h('button', { class: 'icon-btn', 'aria-label': 'Ayarlar', onclick: openSettingsDialog }, icon('gear')),
      ),
    ),
  );
}

function openSettingsDialog() {
  openSettings({
    onChange: async () => {
      await boot();
    },
  });
}

// ---------------------------------------------------------------- ortak parçalar

function ratingBadge(r, extra = '') {
  if (!r) return null;
  return h('span', { class: `rating ${ratingClass(r.value)} ${extra}`, title: r.derived ? 'Bölüm puanlarının ortalaması' : 'Puanım' }, fmtRating(r.value), r.derived ? h('small', {}, 'ort.') : null);
}

function posterEl(item, size = 'w342') {
  const url = tmdb.img(item.poster, size);
  const fallback = () => h('div', { class: 'poster-fallback' }, icon(item.type === 'tv' ? 'tv' : 'film'), h('span', {}, item.title));
  if (!url) return fallback();
  const el = h('img', { src: url, alt: `${item.title} afişi`, loading: 'lazy' });
  el.addEventListener('error', () => el.replaceWith(fallback()), { once: true });
  return el;
}

// Spoiler işaretli içerik, ziyaretçi tıklayana kadar gizli kalır.
function spoilerGate(content) {
  const body = h('div', { class: 'spoiler-body', hidden: true }, content);
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'spoiler-btn',
      'aria-expanded': 'false',
      onclick: () => {
        const show = body.hidden;
        body.hidden = !show;
        btn.setAttribute('aria-expanded', String(show));
        btn.textContent = show ? 'Spoiler\'ı gizle' : 'Spoiler içeriyor — göstermek için tıkla';
      },
    },
    'Spoiler içeriyor — göstermek için tıkla',
  );
  return h('div', { class: 'spoiler-gate' }, btn, body);
}

function entryBody(e) {
  const box = h('div', { class: 'entry' });
  if (e.comment) box.append(h('p', { class: 'comment' }, e.comment));
  if (e.questions && e.questions.length) {
    box.append(
      h(
        'div',
        { class: 'questions' },
        h('h4', {}, 'Merak ettiklerim'),
        h(
          'ul',
          {},
          e.questions.map((q) =>
            h('li', {}, h('span', { class: 'q' }, q.q), q.a ? h('span', { class: 'a' }, q.a) : h('span', { class: 'a pending' }, 'Henüz cevap bulamadım')),
          ),
        ),
      ),
    );
  }
  const meta = [];
  (e.tags || []).forEach((t) => meta.push(h('span', { class: 'tag' }, t)));
  if (e.watchedAt) meta.push(h('span', { class: 'meta-date' }, `${fmtDate(e.watchedAt)} tarihinde izledim`));
  if (meta.length) box.append(h('div', { class: 'entry-meta' }, meta));
  return e.spoiler && (e.comment || (e.questions && e.questions.length)) ? spoilerGate(box) : box;
}

function notice(text) {
  return h('p', { class: 'muted empty' }, text);
}

// ---------------------------------------------------------------- ana sayfa

function matchesQuery(item, q) {
  const hay = [item.title, item.originalTitle, item.comment, (item.tags || []).join(' ')];
  for (const ep of Object.values(item.episodes || {})) hay.push(ep.name, ep.comment, (ep.tags || []).join(' '));
  return fold(hay.join(' ')).includes(q);
}

function sortItems(items) {
  const key = {
    updated: (i) => i.updatedAt || '',
    rating: (i) => displayRating(i)?.value ?? -1,
    title: (i) => i.title,
    year: (i) => i.year || 0,
  }[filters.sort];
  const dir = filters.sort === 'title' ? 1 : -1;
  return [...items].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

function recentNotes(limit = 6) {
  const notes = [];
  for (const item of store.data.items) {
    if (entryHasContent(item) && item.comment) notes.push({ item, entry: item, label: item.type === 'tv' ? 'Genel değerlendirme' : 'Film yorumu', href: itemHref(item) });
    for (const ep of Object.values(item.episodes || {})) {
      if (ep.comment) notes.push({ item, entry: ep, label: `${ep.season}. sezon ${ep.episode}. bölüm · ${ep.name}`, href: itemHref(item, ep.season, ep.episode) });
    }
  }
  return notes.sort((a, b) => (b.entry.updatedAt || '').localeCompare(a.entry.updatedAt || '')).slice(0, limit);
}

function homeView() {
  document.title = APP_NAME;
  const { items } = store.data;
  const view = h('div', { class: 'home' });

  const shows = items.filter((i) => i.type === 'tv').length;
  const movies = items.length - shows;
  const eps = items.reduce((n, i) => n + Object.keys(i.episodes || {}).length, 0);

  view.append(
    h(
      'section',
      { class: 'intro' },
      h('h1', {}, 'Bölüm bitti, düşünceler başladı.'),
      h('p', { class: 'lede' }, 'İzlediğim dizi ve filmlerden aklımda kalanlar, merak ettiklerim ve puanlarım.'),
      items.length ? h('p', { class: 'stats' }, `${shows} dizi · ${movies} film · ${eps} bölüm notu`) : null,
    ),
  );

  if (store.loadError) view.append(h('p', { class: 'notice error' }, `Düzenleme modu açılamadı: ${store.loadError} Ayarlardan bilgileri kontrol et; şimdilik herkese açık veri gösteriliyor.`));

  if (!items.length) {
    view.append(
      h(
        'section',
        { class: 'empty-state' },
        h('h2', {}, 'Burası henüz boş'),
        canEdit()
          ? [h('p', { class: 'muted' }, 'İlk dizini ya da filmini ekleyip yorum yazmaya başla.'), h('button', { class: 'btn primary', onclick: () => openSearch({ onAdded: (it) => (location.hash = itemHref(it)), onNeedSettings: openSettingsDialog }) }, icon('plus'), 'Dizi / film ekle')]
          : [h('p', { class: 'muted' }, 'Henüz paylaşılmış bir not yok. Sağ üstteki dişli simgesinden giriş yapıp ilk yorumu yazabilirsin.')],
      ),
    );
    return view;
  }

  const notes = recentNotes();
  if (notes.length) {
    view.append(
      h(
        'section',
        { class: 'section' },
        h('h2', {}, 'Son notlar'),
        h(
          'div',
          { class: 'note-grid' },
          notes.map(({ item, entry, label, href }) =>
            h(
              'a',
              { class: 'note-card', href },
              h('div', { class: 'note-poster' }, posterEl(item, 'w154')),
              h(
                'div',
                { class: 'note-text' },
                h('strong', {}, item.title),
                h('span', { class: 'muted' }, label),
                entry.spoiler ? h('em', { class: 'muted' }, 'Spoiler içeriyor') : h('p', {}, snippet(entry.comment, 130)),
              ),
              typeof entry.rating === 'number' ? ratingBadge({ value: entry.rating }) : null,
            ),
          ),
        ),
      ),
    );
  }

  // filtre çubuğu + ızgara
  const grid = h('div', { class: 'grid' });
  const count = h('p', { class: 'muted', role: 'status' });

  function renderGrid() {
    const q = fold(filters.q.trim());
    const list = sortItems(
      items.filter((i) => (filters.type === 'all' || i.type === filters.type) && (filters.status === 'all' || i.status === filters.status) && (!q || matchesQuery(i, q))),
    );
    count.textContent = `${list.length} kayıt`;
    grid.replaceChildren(
      ...list.map((item) => {
        const r = displayRating(item);
        const done = Object.keys(item.episodes || {}).length;
        return h(
          'a',
          { class: 'card', href: itemHref(item) },
          h('div', { class: 'card-poster' }, posterEl(item), r ? ratingBadge(r, 'on-poster') : null),
          h(
            'div',
            { class: 'card-text' },
            h('strong', {}, item.title),
            h('span', { class: 'muted' }, [item.year, item.type === 'tv' ? (done ? `${done}${item.episodeCount ? `/${item.episodeCount}` : ''} bölüm notu` : 'Dizi') : 'Film'].filter(Boolean).join(' · ')),
            h('span', { class: `status s-${item.status}` }, STATUS[item.status] || ''),
          ),
        );
      }),
    );
    if (!list.length) grid.append(notice('Bu filtreyle eşleşen bir şey yok.'));
  }

  const select = (label, key, options) =>
    h(
      'label',
      { class: 'select' },
      h('span', { class: 'sr-only' }, label),
      h('select', { onchange: (ev) => ((filters[key] = ev.target.value), renderGrid()) }, options.map(([v, text]) => h('option', { value: v, selected: filters[key] === v }, text))),
    );

  view.append(
    h(
      'section',
      { class: 'section' },
      h('h2', {}, 'Kütüphane'),
      h(
        'div',
        { class: 'filters' },
        h('label', { class: 'searchbox' }, icon('search'), h('span', { class: 'sr-only' }, 'Ara'), h('input', { type: 'search', placeholder: 'Ad, yorum ya da etiket ara…', value: filters.q, oninput: (ev) => ((filters.q = ev.target.value), renderGrid()) })),
        select('Tür', 'type', [['all', 'Hepsi'], ['tv', 'Diziler'], ['movie', 'Filmler']]),
        select('Durum', 'status', [['all', 'Her durum'], ...Object.entries(STATUS)]),
        select('Sıralama', 'sort', [['updated', 'Son güncellenen'], ['rating', 'Puana göre'], ['title', 'Ada göre'], ['year', 'Yıla göre']]),
      ),
      count,
      grid,
    ),
  );
  renderGrid();
  return view;
}

// ---------------------------------------------------------------- detay sayfası

const findItem = (id) => store.data.items.find((i) => i.id === id);

function itemView() {
  const item = store.data.items.find((i) => i.type === route.type && String(i.tmdbId) === route.id);
  if (!item) {
    document.title = `Bulunamadı · ${APP_NAME}`;
    return h('div', { class: 'empty-state' }, h('h2', {}, 'Bulunamadı'), h('p', { class: 'muted' }, 'Bu kayıt kütüphanede yok.'), h('a', { class: 'btn ghost', href: '#/' }, 'Kütüphaneye dön'));
  }
  document.title = `${item.title} · ${APP_NAME}`;

  const view = h('div', { class: 'detail' });
  const r = displayRating(item);
  const backdrop = tmdb.img(item.backdrop, 'w780');

  const hero = h(
    'section',
    { class: 'hero' },
    h('a', { class: 'back', href: '#/' }, '← Kütüphane'),
    h(
      'div',
      { class: 'hero-inner' },
      h('div', { class: 'hero-poster' }, posterEl(item, 'w342')),
      h(
        'div',
        { class: 'hero-text' },
        h('h1', {}, item.title),
        item.originalTitle && item.originalTitle !== item.title ? h('p', { class: 'muted' }, item.originalTitle) : null,
        h(
          'p',
          { class: 'hero-meta' },
          [item.type === 'tv' ? 'Dizi' : 'Film', item.year, item.type === 'movie' && item.runtime ? `${item.runtime} dk` : null, item.type === 'tv' && item.seasons ? `${item.seasons.filter((s) => s.n > 0).length} sezon` : null].filter(Boolean).join(' · '),
        ),
        h('div', { class: 'chips' }, h('span', { class: `status s-${item.status}` }, STATUS[item.status] || ''), (item.genres || []).map((g) => h('span', { class: 'tag' }, g))),
        r ? h('div', { class: 'hero-rating' }, ratingBadge(r, 'big'), h('span', { class: 'muted' }, '/ 10')) : null,
        item.overview ? h('p', { class: 'overview' }, item.overview) : null,
      ),
    ),
  );
  if (backdrop) hero.style.setProperty('--backdrop', `url("${backdrop}")`);
  view.append(hero);

  view.append(overallSection(item));
  if (item.type === 'tv') view.append(episodesSection(item));

  if (canEdit()) {
    view.append(
      h(
        'div',
        { class: 'danger-zone' },
        h(
          'button',
          {
            class: 'btn danger',
            onclick: async () => {
              if (!confirm(`"${item.title}" ve tüm yorumları kütüphaneden kaldırılsın mı?`)) return;
              try {
                await commit(`Kaldır: ${item.title}`, (data) => (data.items = data.items.filter((i) => i.id !== item.id)));
                toast('Kütüphaneden kaldırıldı');
                location.hash = '#/';
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          },
          'Kütüphaneden kaldır',
        ),
      ),
    );
  }
  return view;
}

function overallSection(item) {
  const has = entryHasContent(item);
  if (!has && !canEdit()) return h('div');
  const title = item.type === 'tv' ? 'Genel değerlendirme' : 'Yorumum';
  const sec = h('section', { class: 'section overall' }, h('div', { class: 'section-head' }, h('h2', {}, title), canEdit() ? h('button', { class: 'btn ghost small', onclick: () => editOverall(item) }, icon('pencil'), has ? 'Düzenle' : 'Yorum yaz') : null));
  sec.append(has ? entryBody(item) : notice(item.type === 'tv' ? 'Dizinin geneli hakkında henüz bir şey yazmadın.' : 'Bu film hakkında henüz bir şey yazmadın.'));
  return sec;
}

function editOverall(item) {
  openEditor({
    title: item.title,
    subtitle: item.type === 'tv' ? 'Dizinin geneli' : 'Film yorumu',
    entry: item,
    status: item.status,
    onSave: async (data, status) => {
      await commit(`Yorum: ${item.title}`, (d) => {
        const it = findItem(item.id);
        Object.assign(it, data, { status, updatedAt: new Date().toISOString() });
      });
      toast('Kaydedildi', 'success');
      render({ keepScroll: true });
    },
  });
}

function defaultSeason(item, seasons) {
  const withReviews = reviewedEpisodes(item).map((e) => e.season);
  if (withReviews.length) return withReviews[withReviews.length - 1];
  return seasons.find((n) => n > 0) ?? seasons[0];
}

function episodesSection(item) {
  const owner = canEdit();
  const seasonSet = new Set(reviewedEpisodes(item).map((e) => e.season));
  if (owner) (item.seasons || []).forEach((s) => seasonSet.add(s.n));
  const seasons = [...seasonSet].sort((a, b) => a - b);

  const sec = h('section', { class: 'section episodes' }, h('div', { class: 'section-head' }, h('h2', {}, 'Bölümler')));
  if (!seasons.length) {
    sec.append(notice('Henüz bölüm notu yok.'));
    return sec;
  }

  if (route.season != null && seasons.includes(route.season)) selectedSeason[item.id] = route.season;
  let current = seasons.includes(selectedSeason[item.id]) ? selectedSeason[item.id] : defaultSeason(item, seasons);
  selectedSeason[item.id] = current;

  const listBox = h('div', { class: 'ep-list' });
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sezonlar' });

  function paintTabs() {
    tabs.replaceChildren(
      ...seasons.map((n) => {
        const done = reviewedEpisodes(item).filter((e) => e.season === n).length;
        return h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'tab',
            'aria-selected': String(n === current),
            onclick: () => {
              current = n;
              selectedSeason[item.id] = n;
              history.replaceState(null, '', itemHref(item, n));
              route = parseRoute();
              paintTabs();
              fillSeason(listBox, item, n);
            },
          },
          n === 0 ? 'Özel' : `Sezon ${n}`,
          done ? h('small', {}, String(done)) : null,
        );
      }),
    );
  }
  paintTabs();
  sec.append(tabs, listBox);
  fillSeason(listBox, item, current);
  return sec;
}

async function fillSeason(box, item, n) {
  box.dataset.season = String(n);
  const reviews = Object.values(item.episodes || {}).filter((e) => e.season === n);
  if (!canEdit() || !tmdb.hasKey()) {
    box.replaceChildren(episodeList(item, n, reviews, []));
    return;
  }
  if (!tmdb.cachedSeason(item.tmdbId, n)) box.replaceChildren(notice('Bölümler yükleniyor…'));
  try {
    const eps = await tmdb.season(item.tmdbId, n);
    if (box.dataset.season === String(n) && box.isConnected) box.replaceChildren(episodeList(item, n, reviews, eps));
  } catch (err) {
    if (box.dataset.season === String(n) && box.isConnected) box.replaceChildren(h('p', { class: 'notice error' }, `Bölüm listesi alınamadı: ${err.message}`), episodeList(item, n, reviews, []));
  }
}

function episodeList(item, n, reviews, tmdbEps) {
  const nums = new Set([...reviews.map((r) => r.episode), ...tmdbEps.map((e) => e.episode)]);
  const rows = [...nums].sort((a, b) => a - b).map((num) => {
    const review = item.episodes?.[epKey(n, num)];
    const meta = tmdbEps.find((e) => e.episode === num);
    return episodeRow(item, n, num, review?.name || meta?.name || `${num}. bölüm`, review, meta);
  });
  if (!rows.length) return notice('Bu sezon için henüz bölüm notu yok.');
  return h('div', { class: 'ep-rows' }, rows);
}

function episodeRow(item, s, e, name, review, meta) {
  const label = h('span', { class: 'ep-num' }, `${e}`);
  if (!review) {
    const unaired = meta?.airDate && meta.airDate > today();
    return h(
      'div',
      { class: 'ep ep-empty', id: `ep-${s}-${e}` },
      label,
      h('span', { class: 'ep-name' }, name, meta?.airDate ? h('small', { class: 'muted' }, unaired ? `Yayın: ${fmtDate(meta.airDate)}` : fmtDate(meta.airDate)) : null),
      canEdit() && !unaired ? h('button', { class: 'btn ghost small', onclick: () => editEpisode(item, s, e, name, meta, null) }, 'Yorum yaz') : null,
    );
  }
  const det = h(
    'details',
    { class: 'ep', id: `ep-${s}-${e}` },
    h(
      'summary',
      {},
      label,
      h('span', { class: 'ep-name' }, name, review.comment && !review.spoiler ? h('small', { class: 'ep-snip muted' }, snippet(review.comment, 110)) : review.spoiler ? h('small', { class: 'ep-snip muted' }, 'Spoiler içeriyor') : null),
      typeof review.rating === 'number' ? ratingBadge({ value: review.rating }) : null,
      icon('chevron'),
    ),
    h('div', { class: 'ep-body' }, entryBody(review), canEdit() ? h('div', { class: 'ep-actions' }, h('button', { class: 'btn ghost small', onclick: () => editEpisode(item, s, e, name, meta, review) }, icon('pencil'), 'Düzenle')) : null),
  );
  if (route.season === s && route.episode === e) {
    det.open = true;
    setTimeout(() => det.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }
  return det;
}

function editEpisode(item, s, e, name, meta, review) {
  const key = epKey(s, e);
  openEditor({
    title: name,
    subtitle: `${item.title} · ${s === 0 ? 'Özel bölüm' : `${s}. sezon`} ${e}. bölüm`,
    overview: meta?.overview,
    entry: review,
    onSave: async (data) => {
      await commit(`Yorum: ${item.title} ${s}x${e}`, (d) => {
        const it = findItem(item.id);
        const now = new Date().toISOString();
        it.episodes ||= {};
        it.episodes[key] = { season: s, episode: e, name, ...data, updatedAt: now };
        it.updatedAt = now;
        if (it.status === 'planned') it.status = 'watching';
      });
      toast('Kaydedildi', 'success');
      render({ keepScroll: true });
    },
    onDelete: review
      ? async () => {
          await commit(`Sil: ${item.title} ${s}x${e}`, () => {
            delete findItem(item.id).episodes[key];
          });
          toast('Yorum silindi');
          render({ keepScroll: true });
        }
      : undefined,
  });
}

// ---------------------------------------------------------------- açılış

async function boot() {
  root.replaceChildren(h('p', { class: 'muted empty' }, 'Yükleniyor…'));
  renderHeader();
  await initStore();
  renderHeader();
  if (store.loadError) toast(`GitHub'a bağlanılamadı: ${store.loadError}`, 'error');
  render();
}

boot();
