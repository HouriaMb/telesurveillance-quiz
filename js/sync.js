// Synchronisation multi-appareils via un Gist GitHub privé
import { store, mergeStates } from './store.js';

const FILE = 'telesurveillance-quiz-progression.json';
const API = 'https://api.github.com';

let timer = null;
let running = null;
export const syncStatus = { state: 'off', message: '', last: 0 };
const subs = new Set();
export function onSyncStatus(fn) { subs.add(fn); }
function setStatus(state, message = '') {
  Object.assign(syncStatus, { state, message });
  if (state === 'ok') syncStatus.last = Date.now();
  subs.forEach(fn => fn(syncStatus));
}

export function syncConfigured() { return !!store.settings.ghToken; }

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + store.settings.ghToken,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    if (res.status === 401) msg = 'Jeton refusé (expiré ou incorrect).';
    if (res.status === 403 || res.status === 404) msg = 'Accès refusé : vérifiez que le jeton a bien la permission « Gists ».';
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

async function findGist() {
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const g = list.find(x => x.files && x.files[FILE]);
    if (g) return g.id;
    if (list.length < 100) break;
  }
  return null;
}

async function readGist(id) {
  const g = await gh('/gists/' + id);
  const f = g.files[FILE];
  if (!f) return null;
  let content = f.content;
  if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
  try { return JSON.parse(content); } catch { return null; }
}

export async function syncNow() {
  if (!syncConfigured()) { setStatus('off'); return; }
  if (running) return running;
  running = (async () => {
    setStatus('busy', 'Synchronisation…');
    try {
      let id = store.settings.gistId;
      if (!id) {
        id = await findGist();
        if (id) { store.settings.gistId = id; store.saveSettings(); }
      }
      let remote = null;
      if (id) {
        try { remote = await readGist(id); }
        catch (e) { if (/404|refusé/.test(e.message)) { id = null; } else throw e; }
      }
      const merged = mergeStates(store.state, remote);
      store.state = merged;
      store.save(true);
      const body = JSON.stringify({ files: { [FILE]: { content: JSON.stringify(merged) } } });
      if (id) {
        await gh('/gists/' + id, { method: 'PATCH', body });
      } else {
        const g = await gh('/gists', { method: 'POST', body: JSON.stringify({
          description: 'Télésurveillance Quiz – progression (ne pas supprimer)', public: false,
          files: { [FILE]: { content: JSON.stringify(merged) } } }) });
        store.settings.gistId = g.id; store.saveSettings();
      }
      store.listeners.forEach(fn => fn('synced'));
      setStatus('ok', 'Synchronisé');
    } catch (e) {
      console.warn(e);
      setStatus(navigator.onLine === false ? 'offline' : 'error', navigator.onLine === false ? 'Hors ligne – synchro plus tard' : e.message);
    } finally { running = null; }
  })();
  return running;
}

export function scheduleSync(delay = 4000) {
  if (!syncConfigured()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function testToken(token) {
  const res = await fetch(API + '/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Jeton invalide.' : 'Erreur ' + res.status);
  return res.json();
}

window.addEventListener('online', () => scheduleSync(1000));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(500); });
