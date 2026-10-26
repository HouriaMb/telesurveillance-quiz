// Stockage local, fusion multi-appareils et répétition espacée (Leitner)
const KEY = 'tsq-state-v1';
const SETTINGS_KEY = 'tsq-settings-v1';
export const DAY = 86400000;
// intervalle (jours) avant nouvelle révision selon la boîte
const INTERVALS = [0, 1, 2, 5, 12, 30];

export function uid(prefix = 'u') {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyState() {
  return { v: 1, progress: {}, custom: {}, hidden: {}, history: [], resources: {}, dossiers: {}, updatedAt: 0 };
}

export const store = {
  state: emptyState(),
  settings: {},
  base: { themes: [], sources: [], questions: [] },
  listeners: new Set(),

  load() {
    try { this.state = Object.assign(emptyState(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { this.state = emptyState(); }
    try { this.settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { this.settings = {}; }
  },
  save(silent) {
    this.state.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { console.warn(e); }
    if (!silent) this.listeners.forEach(fn => fn('change'));
  },
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
  },
  onChange(fn) { this.listeners.add(fn); },

  // ---------- banque de questions ----------
  get themes() {
    const custom = this.settings.customThemes || [];
    return [...this.base.themes, ...custom];
  },
  theme(id) { return this.themes.find(t => t.id === id) || { id, nom: id || 'Sans thème', couleur: '#64748b' }; },
  get sources() {
    const res = Object.values(this.state.resources).filter(r => !r.deleted);
    return [...this.base.sources, ...res];
  },
  source(id) { return this.sources.find(s => s.id === id); },

  allQuestions() {
    const map = new Map();
    for (const q of this.base.questions) map.set(q.id, { ...q, origine: 'base' });
    for (const q of Object.values(this.state.custom)) {
      if (q.deleted) { map.delete(q.id); continue; }
      map.set(q.id, { ...q, origine: map.has(q.id) ? 'modifiée' : 'perso' });
    }
    for (const [id, h] of Object.entries(this.state.hidden)) if (h && h.h) map.delete(id);
    return [...map.values()];
  },
  question(id) { return this.allQuestions().find(q => q.id === id); },

  upsertQuestion(q) {
    q.updatedAt = Date.now();
    this.state.custom[q.id] = q;
    if (this.state.hidden[q.id]) this.state.hidden[q.id] = { h: false, t: Date.now() };
    this.save();
  },
  deleteQuestion(id) {
    const isBase = this.base.questions.some(q => q.id === id);
    if (isBase) this.state.hidden[id] = { h: true, t: Date.now() };
    this.state.custom[id] = { id, deleted: true, updatedAt: Date.now() };
    if (isBase) delete this.state.custom[id];
    this.save();
  },
  restoreHidden() {
    for (const id of Object.keys(this.state.hidden)) this.state.hidden[id] = { h: false, t: Date.now() };
    this.save();
  },

  // ---------- progression ----------
  prog(id) { return this.state.progress[id] || { s: 0, c: 0, w: 0, b: 0, d: 0, l: 0 }; },
  record(id, correct) {
    const p = { ...this.prog(id) };
    p.s++; correct ? p.c++ : p.w++;
    p.b = correct ? Math.min(5, (p.b || 0) + 1) : 1;
    p.l = Date.now();
    p.d = p.l + INTERVALS[p.b] * DAY - (p.b <= 1 ? 0 : 3600000); // marge d'une heure
    this.state.progress[id] = p;
    this.save(true);
  },
  addHistory(h) {
    this.state.history.push(h);
    if (this.state.history.length > 500) this.state.history = this.state.history.slice(-500);
    this.save();
  },
  mastery(qs) {
    if (!qs.length) return 0;
    return qs.reduce((a, q) => a + (this.prog(q.id).b || 0), 0) / (qs.length * 5);
  },
  dueQuestions() {
    const now = Date.now();
    return this.allQuestions().filter(q => { const p = this.prog(q.id); return p.s > 0 && p.d <= now; });
  },
  newQuestions() { return this.allQuestions().filter(q => !this.prog(q.id).s); },
  weakQuestions() {
    return this.allQuestions()
      .map(q => ({ q, p: this.prog(q.id) }))
      .filter(x => x.p.w > 0 && x.p.b < 4)
      .sort((a, b) => (b.p.w / b.p.s - a.p.w / a.p.s) || (a.p.b - b.p.b))
      .map(x => x.q);
  },
  resetProgress() { this.state.progress = {}; this.state.history = []; this.save(); },

  get pathos() { return this.base.pathos || [{ id: 'IC', nom: 'Insuffisance cardiaque' }, { id: 'IR', nom: 'Insuffisance rénale' }, { id: 'Transversal', nom: 'Organisation des soins' }]; },
  get natures() { return this.base.natures || []; },
  // ---------- dossiers (filtres enregistrés) ----------
  get dossiers() {
    const mine = Object.values(this.state.dossiers || {}).filter(d => !d.deleted).map(d => ({ ...d, perso: true }));
    return [...(this.base.dossiers || []), ...mine];
  },
  upsertDossier(d) { d.updatedAt = Date.now(); (this.state.dossiers ||= {})[d.id] = d; this.save(); },
  deleteDossier(id) { (this.state.dossiers ||= {})[id] = { id, deleted: true, updatedAt: Date.now() }; this.save(); },

  // ---------- ressources ----------
  upsertResource(r) { r.updatedAt = Date.now(); this.state.resources[r.id] = r; this.save(); },
  deleteResource(id) { this.state.resources[id] = { id, deleted: true, updatedAt: Date.now() }; this.save(); },
};

// Fusion de deux états (local / distant) : la donnée la plus récente gagne, élément par élément
export function mergeStates(a, b) {
  a = Object.assign(emptyState(), a || {});
  b = Object.assign(emptyState(), b || {});
  const out = emptyState();
  const pick = (x, y, k) => (!x ? y : !y ? x : ((y[k] || 0) > (x[k] || 0) ? y : x));
  for (const id of new Set([...Object.keys(a.progress), ...Object.keys(b.progress)]))
    out.progress[id] = pick(a.progress[id], b.progress[id], 'l');
  for (const id of new Set([...Object.keys(a.custom), ...Object.keys(b.custom)]))
    out.custom[id] = pick(a.custom[id], b.custom[id], 'updatedAt');
  for (const id of new Set([...Object.keys(a.hidden), ...Object.keys(b.hidden)]))
    out.hidden[id] = pick(a.hidden[id], b.hidden[id], 't');
  for (const id of new Set([...Object.keys(a.resources), ...Object.keys(b.resources)]))
    out.resources[id] = pick(a.resources[id], b.resources[id], 'updatedAt');
  for (const id of new Set([...Object.keys(a.dossiers || {}), ...Object.keys(b.dossiers || {})]))
    out.dossiers[id] = pick((a.dossiers || {})[id], (b.dossiers || {})[id], 'updatedAt');
  const hist = new Map();
  for (const h of [...a.history, ...b.history]) hist.set(h.id, h);
  out.history = [...hist.values()].sort((x, y) => x.date - y.date).slice(-500);
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}
