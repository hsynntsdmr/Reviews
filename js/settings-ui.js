// Ayarlar penceresi: GitHub bağlantısı, TMDB anahtarı, yerel mod.
import { h, openModal, toast } from './dom.js';
import { getSettings, saveSettings, clearSettings, guessRepo } from './settings.js';
import { exportJson, store } from './store.js';
import * as gh from './github.js';
import * as tmdb from './tmdb.js';

export function openSettings({ onChange }) {
  const s = { ...guessRepo(), ...getSettings() };
  const field = (id, label, props = {}, hint) =>
    h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, type: 'text', autocomplete: 'off', spellcheck: 'false', ...props }), hint ? h('p', { class: 'hint' }, hint) : null);

  const owner = field('st-owner', 'GitHub kullanıcı adı', { value: s.owner || '' });
  const repo = field('st-repo', 'Repo adı', { value: s.repo || '' });
  const branch = field('st-branch', 'Dal (branch)', { value: s.branch || '', placeholder: 'boşsa repo varsayılanı' });
  const token = field('st-token', 'GitHub token', { type: 'password', value: s.token || '' }, 'Yalnızca bu repoya "Contents: Read and write" izni olan fine-grained token kullan.');
  const tmdbKey = field('st-tmdb', 'TMDB API anahtarı', { type: 'password', value: s.tmdbKey || '' }, 'themoviedb.org → Ayarlar → API bölümünden ücretsiz alınır. v3 anahtarı da v4 jetonu da olur.');
  const local = h('input', { id: 'st-local', type: 'checkbox', checked: Boolean(s.localMode) });
  const status = h('p', { class: 'notice', hidden: true, role: 'status' });

  const val = (wrap) => wrap.querySelector('input').value.trim();
  const note = (text, kind = '') => {
    status.textContent = text;
    status.className = `notice ${kind}`;
    status.hidden = false;
  };

  async function test() {
    const cfg = { owner: val(owner), repo: val(repo), token: val(token) };
    const lines = [];
    let bad = false;
    if (cfg.owner && cfg.repo && cfg.token) {
      try {
        const info = await gh.getRepo(cfg);
        if (info.permissions && !info.permissions.push) {
          bad = true;
          lines.push('GitHub: repoya erişiliyor ama yazma izni yok.');
        } else {
          lines.push(`GitHub: ${info.full_name} bağlandı (varsayılan dal: ${info.default_branch}).`);
        }
      } catch (err) {
        bad = true;
        lines.push(`GitHub: ${err.message}`);
      }
    }
    if (val(tmdbKey)) {
      const prev = getSettings();
      saveSettings({ ...prev, tmdbKey: val(tmdbKey) });
      try {
        await tmdb.ping();
        lines.push('TMDB: anahtar çalışıyor.');
      } catch (err) {
        bad = true;
        lines.push(`TMDB: ${err.message}`);
      } finally {
        saveSettings(prev);
      }
    }
    note(lines.join(' ') || 'Test edecek bir bilgi girilmedi.', bad ? 'error' : 'success');
  }

  function save() {
    saveSettings({
      owner: val(owner),
      repo: val(repo),
      branch: val(branch),
      token: val(token),
      tmdbKey: val(tmdbKey),
      localMode: local.checked,
    });
    modal.close();
    toast('Ayarlar kaydedildi', 'success');
    onChange();
  }

  const content = h(
    'form',
    { class: 'editor', onsubmit: (ev) => (ev.preventDefault(), save()) },
    h('p', { class: 'muted' }, 'Bu bilgiler yalnızca bu tarayıcıda saklanır; repoya ya da siteye yazılmaz. Token girersen düzenleme modu açılır.'),
    h('fieldset', {}, h('legend', {}, 'GitHub (otomatik kaydetme)'), h('div', { class: 'field-row' }, owner, repo), branch, token),
    h('fieldset', {}, h('legend', {}, 'TMDB (arama ve bölüm listeleri)'), tmdbKey),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Deneme modu'),
      h('label', { class: 'check', for: 'st-local' }, local, h('span', {}, 'Token yoksa yorumları sadece bu tarayıcıda sakla (siteye yansımaz)')),
      h(
        'button',
        {
          type: 'button',
          class: 'btn ghost small',
          onclick: () => {
            const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
            const a = h('a', { href: url, download: 'library.json' });
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          },
        },
        `Verileri JSON olarak indir (${store.data.items.length} kayıt)`,
      ),
    ),
    status,
    h(
      'div',
      { class: 'modal-actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          onclick: () => {
            if (!confirm('Bu tarayıcıdaki token, TMDB anahtarı ve yerel taslaklar silinsin mi?')) return;
            clearSettings();
            try {
              localStorage.removeItem('jo.local.v1');
            } catch {
              /* yoksay */
            }
            modal.close();
            toast('Çıkış yapıldı');
            onChange();
          },
        },
        'Çıkış yap',
      ),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn ghost', onclick: test }, 'Bağlantıyı dene'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Kaydet'),
    ),
  );

  const modal = openModal({ title: 'Ayarlar', content, wide: true });
}
