// Yorum editörü: puan, yorum, "merak ettiklerim", etiket, tarih, spoiler.
import { h, openModal, icon } from './dom.js';
import { STATUS, fmtRating, today } from './util.js';

/**
 * @param {object} o
 * @param {string} o.title      Pencere başlığı
 * @param {string} [o.subtitle]
 * @param {string} [o.overview] Bölüm özeti (isteğe bağlı, kapalı gelir)
 * @param {object} [o.entry]    Mevcut yorum
 * @param {string} [o.status]   Verilirse durum seçici gösterilir
 * @param {(entry:object, status:string)=>Promise} o.onSave
 * @param {()=>Promise} [o.onDelete]
 */
export function openEditor({ title, subtitle, overview, entry, status, onSave, onDelete }) {
  const e = entry || {};
  let rating = typeof e.rating === 'number' ? e.rating : null;
  const questions = (e.questions || []).map((q) => ({ q: q.q || '', a: q.a || '' }));

  // --- puan
  const out = h('output', { class: 'rating-out' });
  const range = h('input', { type: 'range', min: '0', max: '10', step: '0.5', 'aria-label': 'Puan (10 üzerinden)' });
  const clearBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: () => setRating(null) }, 'Puanı kaldır');
  function setRating(v) {
    rating = v;
    range.value = v ?? 5;
    range.classList.toggle('unset', v == null);
    out.textContent = v == null ? 'Puan yok' : `${fmtRating(v)} / 10`;
    clearBtn.hidden = v == null;
  }
  range.addEventListener('input', () => setRating(Number(range.value)));
  setRating(rating);

  // --- alanlar
  const comment = h('textarea', {
    id: 'ed-comment',
    rows: '6',
    placeholder: 'Ne düşündün? Aklında ne kaldı?',
    value: e.comment || '',
  });
  const tags = h('input', { id: 'ed-tags', type: 'text', placeholder: 'virgülle ayır: plot twist, final, müzik', value: (e.tags || []).join(', ') });
  const watched = h('input', { id: 'ed-date', type: 'date', value: e.watchedAt || today() });
  const spoiler = h('input', { id: 'ed-spoiler', type: 'checkbox', checked: Boolean(e.spoiler) });
  const statusSel = status
    ? h('select', { id: 'ed-status' }, Object.entries(STATUS).map(([k, label]) => h('option', { value: k, selected: k === status }, label)))
    : null;

  // --- merak ettiklerim
  const qList = h('div', { class: 'q-list' });
  function renderQuestions() {
    qList.replaceChildren(
      ...questions.map((item, i) =>
        h(
          'div',
          { class: 'q-row' },
          h('input', {
            type: 'text',
            'aria-label': `Soru ${i + 1}`,
            placeholder: 'Merak ettiğin şey…',
            value: item.q,
            oninput: (ev) => (item.q = ev.target.value),
          }),
          h('input', {
            type: 'text',
            'aria-label': `Soru ${i + 1} için cevap`,
            placeholder: 'Cevap (sonra da ekleyebilirsin)',
            value: item.a,
            oninput: (ev) => (item.a = ev.target.value),
          }),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn',
              'aria-label': `Soru ${i + 1}'i sil`,
              onclick: () => {
                questions.splice(i, 1);
                renderQuestions();
              },
            },
            icon('x'),
          ),
        ),
      ),
    );
  }
  renderQuestions();

  // --- form
  const errorBox = h('p', { class: 'notice error', role: 'alert', hidden: true });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary' }, 'Kaydet');
  const cancelBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => modal.close() }, 'Vazgeç');
  const delBtn = onDelete
    ? h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          onclick: async () => {
            if (!confirm('Bu yorum silinsin mi?')) return;
            await run(onDelete);
          },
        },
        'Sil',
      )
    : null;

  async function run(fn) {
    errorBox.hidden = true;
    [saveBtn, cancelBtn, delBtn].forEach((b) => b && (b.disabled = true));
    const label = saveBtn.textContent;
    saveBtn.textContent = 'Kaydediliyor…';
    try {
      await fn();
      modal.close();
    } catch (err) {
      errorBox.textContent = err.message || 'Kaydedilemedi.';
      errorBox.hidden = false;
      [saveBtn, cancelBtn, delBtn].forEach((b) => b && (b.disabled = false));
      saveBtn.textContent = label;
    }
  }

  const form = h(
    'form',
    {
      class: 'editor',
      onsubmit: (ev) => {
        ev.preventDefault();
        const data = {
          rating,
          comment: comment.value.trim(),
          questions: questions.map((q) => ({ q: q.q.trim(), a: q.a.trim() })).filter((q) => q.q),
          tags: [...new Set(tags.value.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12),
          watchedAt: watched.value || '',
          spoiler: spoiler.checked,
        };
        run(() => onSave(data, statusSel ? statusSel.value : undefined));
      },
    },
    overview
      ? h('details', { class: 'ep-overview' }, h('summary', {}, 'Bölüm özeti (spoiler olabilir)'), h('p', {}, overview))
      : null,
    h('div', { class: 'field' }, h('label', { for: 'ed-range' }, 'Puanım'), h('div', { class: 'rating-ctl' }, range, out, clearBtn)),
    h('div', { class: 'field' }, h('label', { for: 'ed-comment' }, 'Yorumum'), comment),
    h(
      'div',
      { class: 'field' },
      h('span', { class: 'label' }, 'Merak ettiklerim'),
      qList,
      h(
        'button',
        {
          type: 'button',
          class: 'btn ghost small',
          onclick: () => {
            questions.push({ q: '', a: '' });
            renderQuestions();
            qList.querySelector('.q-row:last-child input')?.focus();
          },
        },
        icon('plus'),
        'Soru ekle',
      ),
    ),
    h(
      'div',
      { class: 'field-row' },
      statusSel ? h('div', { class: 'field' }, h('label', { for: 'ed-status' }, 'Durum'), statusSel) : null,
      h('div', { class: 'field' }, h('label', { for: 'ed-date' }, 'İzlediğim tarih'), watched),
    ),
    h('div', { class: 'field' }, h('label', { for: 'ed-tags' }, 'Etiketler'), tags),
    h('label', { class: 'check', for: 'ed-spoiler' }, spoiler, h('span', {}, 'Spoiler içeriyor (ziyaretçilere tıklayınca gösterilir)')),
    errorBox,
    h('div', { class: 'modal-actions' }, delBtn, h('span', { class: 'spacer' }), cancelBtn, saveBtn),
  );
  range.id = 'ed-range';

  const modal = openModal({ title, subtitle, content: form, wide: true, dismissOnBackdrop: false });
  comment.focus();
  return modal;
}
