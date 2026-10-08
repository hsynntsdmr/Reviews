// GitHub Contents API ile repodaki bir dosyayı okuyup yazar.
const API = 'https://api.github.com';

export class GhError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function headers(token, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
  };
}

async function explain(res) {
  let detail = '';
  try {
    detail = (await res.json()).message || '';
  } catch {
    /* gövde yok */
  }
  const byStatus = {
    401: 'Token geçersiz ya da süresi dolmuş.',
    403: 'Bu token\'ın bu repoya yazma izni yok (ya da istek sınırına takıldın).',
    404: 'Repo ya da dosya bulunamadı. Token bu repoya erişebiliyor mu?',
    409: 'Veri başka bir yerden değişmiş. Sayfayı yenileyip tekrar dene.',
    422: 'Veri başka bir yerden değişmiş. Sayfayı yenileyip tekrar dene.',
  };
  return new GhError(res.status, byStatus[res.status] || `GitHub hatası (${res.status}) ${detail}`.trim());
}

const enc = (path) => path.split('/').map(encodeURIComponent).join('/');

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function request(url, init) {
  try {
    return await fetch(url, init);
  } catch {
    throw new GhError(0, 'GitHub\'a ulaşılamadı. İnternet bağlantını kontrol et.');
  }
}

export async function getRepo({ owner, repo, token }) {
  const res = await request(`${API}/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!res.ok) throw await explain(res);
  return res.json();
}

// Dosya yoksa null döner.
export async function readFile({ owner, repo, token, branch }, path) {
  const url = `${API}/repos/${owner}/${repo}/contents/${enc(path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`;
  // Özel başlık (ör. Cache-Control) eklenmez: GitHub'ın CORS ön kontrolü onları reddeder.
  const res = await request(url, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw await explain(res);
  const json = await res.json();
  if (json.content) return { text: fromB64(json.content), sha: json.sha };
  // 1 MB üstü dosyalarda içerik gelmez; ham halini iste.
  const raw = await request(url, { headers: headers(token, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (!raw.ok) throw await explain(raw);
  return { text: await raw.text(), sha: json.sha };
}

export async function writeFile({ owner, repo, token, branch }, path, text, sha, message) {
  const body = { message, content: toB64(text) };
  if (branch) body.branch = branch;
  if (sha) body.sha = sha;
  const res = await request(`${API}/repos/${owner}/${repo}/contents/${enc(path)}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await explain(res);
  return (await res.json()).content.sha;
}
