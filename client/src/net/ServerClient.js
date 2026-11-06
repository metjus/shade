// Spojenie so serverom (server/public/api.php). Ak server nie je dostupný (napr. ukážka mimo shade.sk),
// hra beží v lokálnom režime so simulovanými hráčmi.

const API = new URLSearchParams(location.search).get('api') || './api.php';
const TOKEN_KEY = 'shade.token';

function loadToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* súkromné okno: token platí len do zatvorenia */ }
}

export function decodeBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class ServerClient {
  constructor() {
    this.token = loadToken();
  }

  async call(action, body = {}, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API}?a=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: this.token }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error('bad_response');
      if (data.error) { const e = new Error(data.error); e.code = data.error; throw e; }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Prihlási hosťa (alebo založí nového). Vráti null, ak server nie je dostupný. */
  async hello() {
    if (location.protocol === 'file:') return null;
    try {
      const data = await this.call('hello', {}, 4000);
      this.token = data.token;
      saveToken(data.token);
      return data;
    } catch {
      return null;
    }
  }
}
