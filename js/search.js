// "Ekle" penceresi: TMDB'de ara, kütüphaneye ekle.
import { h, openModal, icon, toast } from './dom.js';
import { store, commit } from './store.js';
import * as tmdb from './tmdb.js';

export function openSearch({ onAdded, onNeedSettings }) {
  if (!tmdb.hasKey()) {
    const content = h(
      'div',
      { class: 'stack' },
      h('p', {}, 'Dizi ve film aramak için ücretsiz bir TMDB anahtarına ihtiyacın var. Bir kez girmen yeterli.'),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            modal.close();
            onNeedSettings();
          },
        },
        'Ayarları aç',
      ),
    );
    const modal = openModal({ title: 'TMDB anahtarı gerekli', content });
    return;
  }

  const input = h('input', { type: 'search', placeholder: 'Dizi ya da film adı…', 'aria-label': 'Dizi veya film ara', autocomplete: 'off' });
  const list = h('ul', { class: 'result-list' });
  const hint = h('p', { class: 'muted center' }, 'Aramak için yazmaya başla.');
  let timer;
  let seq = 0;

  async function add(r, row) {
    row.disabled = true;
    row.classList.add('busy');
    try {
      const item = await tmdb.buildItem(r.media_type, r.id);
      await commit(`Ekle: ${item.title}`, (data) => data.items.push(item));
      toast(`"${item.title}" kütüphaneye eklendi`, 'success');
      modal.close();
      onAdded(item);
    } catch (err) {
      row.disabled = false;
      row.classList.remove('busy');
      toast(err.message, 'error');
    }
  }

  function show(results) {
    list.replaceChildren(
      ...results.slice(0, 12).map((r) => {
        const title = r.name || r.title;
        const year = (r.first_air_date || r.release_date || '').slice(0, 4);
        const exists = store.data.items.some((i) => i.type === r.media_type && i.tmdbId === r.id);
        const poster = tmdb.img(r.poster_path, 'w92');
        const row = h(
          'button',
          { type: 'button', class: 'result', disabled: exists, onclick: (ev) => add(r, ev.currentTarget) },
          poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : h('span', { class: 'thumb-fallback' }, icon(r.media_type === 'tv' ? 'tv' : 'film')),
          h(
            'span',
            { class: 'result-text' },
            h('strong', {}, title),
            h('span', { class: 'muted' }, [r.media_type === 'tv' ? 'Dizi' : 'Film', year, exists ? 'Zaten ekli' : ''].filter(Boolean).join(' · ')),
          ),
        );
        return h('li', {}, row);
      }),
    );
    hint.textContent = results.length ? '' : 'Sonuç bulunamadı.';
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) {
      list.replaceChildren();
      hint.textContent = 'Aramak için yazmaya başla.';
      return;
    }
    timer = setTimeout(async () => {
      const mine = ++seq;
      hint.textContent = 'Aranıyor…';
      try {
        const results = await tmdb.search(q);
        if (mine === seq) show(results);
      } catch (err) {
        if (mine === seq) {
          list.replaceChildren();
          hint.textContent = err.message;
        }
      }
    }, 350);
  });

  const modal = openModal({ title: 'Dizi / film ekle', content: h('div', { class: 'stack' }, input, hint, list) });
  input.focus();
}
