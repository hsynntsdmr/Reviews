// Veri katmanı. Tüm kütüphane tek bir JSON dosyasında (data/library.json) durur.
//   public : ziyaretçi, dosyayı sadece okur
//   github : sahibi, token ile okur ve her kayıtta repoya commit atar
//   local  : token olmadan deneme modu, veri bu tarayıcıda kalır
import { getSettings } from './settings.js';
import * as gh from './github.js';

const DATA_PATH = 'data/library.json';
const LS_LOCAL = 'jo.local.v1';

export const store = {
  data: emptyData(),
  sha: null,
  mode: 'public',
  loadError: null,
  branch: null,
};

export const canEdit = () => store.mode === 'github' || store.mode === 'local';

function emptyData() {
  return { version: 1, items: [] };
}

function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : emptyData();
  if (!Array.isArray(data.items)) data.items = [];
  data.version = 1;
  return data;
}

async function fetchPublic() {
  try {
    const res = await fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return emptyData();
    return normalize(await res.json());
  } catch {
    return emptyData();
  }
}

function ghConfig() {
  const s = getSettings();
  return { owner: s.owner, repo: s.repo, token: s.token, branch: s.branch || store.branch || undefined };
}

export async function initStore() {
  const s = getSettings();
  store.loadError = null;

  if (s.token && s.owner && s.repo) {
    try {
      const file = await gh.readFile(ghConfig(), DATA_PATH);
      store.data = file ? normalize(JSON.parse(file.text)) : emptyData();
      store.sha = file ? file.sha : null;
      store.mode = 'github';
      return;
    } catch (err) {
      store.loadError = err.message;
    }
  }

  if (s.localMode) {
    try {
      const raw = localStorage.getItem(LS_LOCAL);
      store.data = raw ? normalize(JSON.parse(raw)) : await fetchPublic();
      store.mode = 'local';
      return;
    } catch {
      /* bozuk yerel veri: herkese açık veriye düş */
    }
  }

  store.data = await fetchPublic();
  store.mode = 'public';
}

export function exportJson() {
  return `${JSON.stringify(store.data, null, 2)}\n`;
}

async function persist(message) {
  const text = exportJson();
  if (store.mode === 'local') {
    localStorage.setItem(LS_LOCAL, text);
    return;
  }
  if (!getSettings().branch && !store.branch) {
    store.branch = (await gh.getRepo(ghConfig())).default_branch;
  }
  store.sha = await gh.writeFile(ghConfig(), DATA_PATH, text, store.sha, message);
}

// Kayıtlar sırayla yazılır; biri patlarsa bellekteki veri eski haline döner.
let queue = Promise.resolve();

export function commit(message, mutate) {
  const run = queue.then(async () => {
    if (!canEdit()) throw new Error('Düzenleme modu kapalı. Ayarlardan giriş yap.');
    const snapshot = structuredClone(store.data);
    try {
      mutate(store.data);
      await persist(message);
    } catch (err) {
      store.data = snapshot;
      throw err;
    }
  });
  queue = run.catch(() => {});
  return run;
}
