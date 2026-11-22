// Google Drive storage. Visitors read the exhibition file and the photos with the public API key
// (the files are shared "anyone with the link can view"). The owner signs in with Google to add,
// change and remove them. The app only ever sees the files it created itself (drive.file).
import { GOOGLE } from './config.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const MANIFEST_NAME = 'virtual-exhibition.json';
const FOLDER_NAME = 'Virtual Exhibition';
const STORED_ID = 've-manifest-id';

export const mockDrive = new URLSearchParams(location.search).has('mockdrive'); // for testing without Google
const mockFiles = new Map(); // id → { blob, url }

// the exhibition file: from the site's settings, or remembered on the owner's device
export const manifestId = () => (mockDrive ? '' : GOOGLE.manifestId || localStorage.getItem(STORED_ID) || '');
export const fileUrl = id => mockFiles.get(id)?.url || `${API}/files/${encodeURIComponent(id)}?alt=media&key=${GOOGLE.apiKey}`;

export async function readPublicManifest(id) {
  const response = await fetch(fileUrl(id), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Couldn't load the exhibition from Google Drive (HTTP ${response.status})`);
  return response.json();
}

// the sign-in has run out (it lasts an hour) or hasn't happened: ask again, then retry
export class SignInNeeded extends Error { constructor() { super('Please sign in with Google again'); } }

let gis = null;
export function loadGoogleSignIn() {
  if (mockDrive) return Promise.resolve();
  gis ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { gis = null; reject(new Error("Couldn't reach Google sign-in. Check the internet connection.")); };
    document.head.append(script);
  });
  return gis;
}

export class Drive {
  constructor() { this.token = null; this.expires = 0; this.client = null; this.folderId = null; this.manifestId = null; }
  get signedIn() { return mockDrive ? !!this.token : !!this.token && Date.now() < this.expires; }

  // must run straight from a tap or click: it opens Google's sign-in window
  signIn() {
    if (mockDrive) { this.token = 'mock'; return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      this.client ??= google.accounts.oauth2.initTokenClient({ client_id: GOOGLE.clientId, scope: SCOPE, callback: () => {} });
      this.client.callback = response => {
        if (response.error) { reject(new Error(response.error_description || response.error)); return; }
        this.token = response.access_token;
        this.expires = Date.now() + (Number(response.expires_in) - 120) * 1000;
        resolve();
      };
      this.client.error_callback = error => reject(new Error(error?.type === 'popup_closed' ? 'The sign-in window was closed.' : error?.message || 'Sign-in failed.'));
      this.client.requestAccessToken({ prompt: '' });
    });
  }

  async request(url, { method = 'GET', json, body, headers = {} } = {}) {
    if (!this.signedIn) throw new SignInNeeded();
    const response = await fetch(url, {
      method, body: json ? JSON.stringify(json) : body, cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
    });
    if (response.status === 401) { this.token = null; throw new SignInNeeded(); }
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(`Google Drive: ${detail?.error?.message || `error ${response.status}`}`);
    }
    return response.status === 204 ? null : response.json();
  }

  // find the gallery's exhibition file, or make the folder and the file the first time
  async setUp(initial) {
    if (mockDrive) {
      this.manifestId = 'mock-manifest';
      if (!mockFiles.has(this.manifestId)) { this.mockManifest = JSON.parse(JSON.stringify(initial)); mockFiles.set(this.manifestId, {}); return { id: this.manifestId, created: true }; }
      return { id: this.manifestId, created: false };
    }
    let id = GOOGLE.manifestId || localStorage.getItem(STORED_ID);
    if (!id) {
      const q = encodeURIComponent(`name='${MANIFEST_NAME}' and trashed=false`);
      id = (await this.request(`${API}/files?q=${q}&spaces=drive&fields=files(id)`)).files?.[0]?.id;
    }
    let created = false;
    if (id) {
      const meta = await this.request(`${API}/files/${encodeURIComponent(id)}?fields=id,parents`);
      this.folderId = meta.parents?.[0] || null;
    } else {
      this.folderId = (await this.request(`${API}/files?fields=id`, { method: 'POST', json: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' } })).id;
      id = await this.upload(new Blob([JSON.stringify(initial, null, 1)], { type: 'application/json' }), MANIFEST_NAME);
      created = true;
    }
    this.manifestId = id;
    localStorage.setItem(STORED_ID, id);
    return { id, created };
  }

  // upload a file into the gallery's folder and let anyone with the link see it; returns its id
  async upload(blob, name) {
    if (mockDrive) {
      const id = `mock-${mockFiles.size}-${Math.random().toString(36).slice(2, 8)}`;
      mockFiles.set(id, { blob, url: URL.createObjectURL(blob) });
      await new Promise(resolve => setTimeout(resolve, 150));
      return id;
    }
    const boundary = `ve${Math.random().toString(36).slice(2)}`;
    const meta = { name, ...(this.folderId ? { parents: [this.folderId] } : {}) };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${boundary}--`,
    ]);
    const file = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
    await this.request(`${API}/files/${file.id}/permissions?fields=id`, { method: 'POST', json: { role: 'reader', type: 'anyone' } });
    return file.id;
  }

  async readManifest() {
    if (mockDrive) return JSON.parse(JSON.stringify(this.mockManifest));
    return this.request(`${API}/files/${encodeURIComponent(this.manifestId)}?alt=media`);
  }
  async saveManifest(data) {
    if (mockDrive) { this.mockManifest = JSON.parse(JSON.stringify(data)); return; }
    await this.request(`${UPLOAD}/files/${encodeURIComponent(this.manifestId)}?uploadType=media&fields=id`, { method: 'PATCH', body: JSON.stringify(data, null, 1), headers: { 'Content-Type': 'application/json' } });
  }
  // removed photos go to the Drive bin (kept there 30 days), not deleted outright
  async trash(id) {
    if (!id) return;
    if (mockDrive) { mockFiles.delete(id); return; }
    await this.request(`${API}/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', json: { trashed: true } });
  }
}
