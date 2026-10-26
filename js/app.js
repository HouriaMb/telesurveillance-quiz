import { store, uid, mergeStates } from './store.js';
import { syncNow, scheduleSync, syncStatus, onSyncStatus, syncConfigured, testToken } from './sync.js';
import { parseImport, csvTemplate } from './io.js';

const APP_VERSION = '1.2.0';
const $ = (s, el = document) => el.querySelector(s);
const view = () => $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
const pct = x => Math.round(x * 100) + ' %';
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const TYPE_LABEL = { qcm: 'QCM', vf: 'Vrai/Faux', carte: 'Carte', cas: 'Cas clinique' };
const MODES = {
  sujet: { nom: 'Quiz sur un sujet', desc: 'Tapez un sujet : CPTS Cœur de Moselle, mortalité, PRADO…', ico: 'search' },
  quiz: { nom: 'Quiz libre', desc: 'Choisissez thèmes, formats et nombre de questions', ico: 'quiz' },
  revision: { nom: 'Révision espacée', desc: 'Les questions à revoir aujourd’hui, puis des nouvelles', ico: 'cal' },
  chrono: { nom: 'Contre la montre', desc: '15 questions, 3 minutes', ico: 'timer' },
  faibles: { nom: 'Points faibles', desc: 'Les questions où vous vous trompez le plus', ico: 'target' },
  cartes: { nom: 'Cartes de révision', desc: 'Recto / verso pour mémoriser', ico: 'cards' },
  cas: { nom: 'Cas cliniques', desc: 'Situations pas à pas', ico: 'case' },
};
const ICONS = {
  quiz: '<path d="M9 9a3 3 0 1 1 4.2 2.75c-.7.3-1.2 1-1.2 1.75V14"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/><rect x="3" y="3" width="18" height="18" rx="5"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.5 14l2.2 2.2L15.5 12"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  cards: '<rect x="6" y="3" width="14" height="17" rx="3"/><path d="M4 6.5v12A2.5 2.5 0 0 0 6.5 21H16"/>',
  case: '<path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M12 10v6M9 13h6"/>',
  home: '<path d="M3 11 12 3.5 21 11"/><path d="M5.5 9.5V20h13V9.5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function sheet(title, html, onMount) {
  const bd = document.createElement('div'); bd.className = 'sheet-backdrop';
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></div><div class="sheet-body">${html}</div></div>`;
  const close = () => bd.remove();
  bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bd);
  onMount && onMount(bd.querySelector('.sheet-body'), close);
  return close;
}
function confirmBox(msg) { return window.confirm(msg); }

// =============== ROUTEUR ===============
let session = null; // session de quiz en cours
let lastResult = null;
const routes = {
  '': renderHome, 'config': renderConfig, 'session': renderSession, 'resultats': renderResults,
  'biblio': renderBiblio, 'sujet': renderTopic, 'edit': renderEditor, 'progres': renderProgress, 'ressources': renderResources, 'reglages': renderSettings,
};
function go(hash) { if (location.hash === '#/' + hash) render(); else location.hash = '#/' + hash; }
function render() {
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[name] || renderHome;
  if (name === 'session' && !session) return go('');
  if (name === 'resultats' && !lastResult) return go('');
  if (session && name !== 'session') stopTimer();
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === (name === 'edit' ? 'biblio' : ['session', 'resultats'].includes(name) ? '' : name)));
  fn(...args.map(decodeURIComponent));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

// =============== ACCUEIL ===============
function renderHome() {
  const all = store.allQuestions();
  const due = store.dueQuestions().length;
  const fresh = store.newQuestions().length;
  const m = store.mastery(all);
  const h = new Date().getHours();
  const hello = h < 6 ? 'Bonsoir' : h < 18 ? 'Bonjour' : 'Bonsoir';
  const themes = store.themes.map(t => {
    const qs = all.filter(q => q.theme === t.id);
    return { t, n: qs.length, m: store.mastery(qs) };
  }).filter(x => x.n);
  view().innerHTML = `
    <section class="hero">
      <svg class="ecg" viewBox="0 0 220 60" fill="none" stroke="currentColor" stroke-width="3"><path d="M0 40h60l10-25 14 40 12-30 8 15h116"/></svg>
      <p class="small" style="margin:0">${hello} 👋</p>
      <h1>Révision du jour</h1>
      <div class="hero-stats">
        <div><b>${due}</b><span>à revoir</span></div>
        <div><b>${fresh}</b><span>nouvelles</span></div>
        <div><b>${pct(m)}</b><span>maîtrise</span></div>
      </div>
      <button class="btn" data-start="revision">${icon('play')} ${due ? 'Commencer ma révision' : 'Découvrir de nouvelles questions'}</button>
    </section>
    <div class="section">
      <div class="section-title"><h2>S'entraîner</h2></div>
      <div class="modes">
        ${Object.entries(MODES).filter(([k]) => k !== 'revision').map(([k, mo]) => `
          <button class="mode" data-mode="${k}"><span class="ico">${icon(mo.ico)}</span><b>${mo.nom}</b><span>${mo.desc}</span></button>`).join('')}
        <button class="mode" onclick="location.hash='#/ressources'"><span class="ico">${icon('link')}</span><b>Ressources</b><span>Documents sources et liens utiles</span></button>
      </div>
    </div>
    <div class="section">
      <div class="section-title"><h2>Par thème</h2><span class="tiny">${all.length} questions</span></div>
      <div class="card" style="padding:4px 14px">
        ${themes.map(x => `
          <div class="theme-row" data-theme="${esc(x.t.id)}">
            <span class="sw" style="background:${esc(x.t.couleur)}"></span>
            <div class="grow"><div class="name">${esc(x.t.nom)}</div><div class="bar"><i style="width:${x.m * 100}%;background:${esc(x.t.couleur)}"></i></div></div>
            <span class="pct">${pct(x.m)}</span>
          </div>`).join('') || '<p class="empty">Aucune question pour l’instant.</p>'}
      </div>
      <p class="tiny" style="margin-top:8px">La maîtrise augmente à chaque bonne réponse et redescend en cas d'erreur (répétition espacée).</p>
    </div>`;
  view().querySelector('[data-start]').onclick = () => startSession('revision', {});
  view().querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    const mo = b.dataset.mode;
    if (mo === 'faibles') return startSession('faibles', {});
    if (mo === 'chrono') return go('config/chrono');
    if (mo === 'sujet') return go('sujet');
    go('config/' + mo);
  });
  view().querySelectorAll('[data-theme]').forEach(r => r.onclick = () => go('config/quiz/' + encodeURIComponent(r.dataset.theme)));
}

// =============== CONFIGURATION ===============
function renderConfig(mode = 'quiz', themeId) {
  const mo = MODES[mode] || MODES.quiz;
  const all = store.allQuestions();
  const typesFor = { quiz: ['qcm', 'vf', 'cas', 'carte'], chrono: ['qcm', 'vf'], cartes: ['carte', 'qcm', 'vf'], cas: ['cas'] }[mode] || ['qcm', 'vf'];
  const defTypes = { quiz: ['qcm', 'vf', 'cas'], chrono: ['qcm', 'vf'], cartes: ['carte', 'qcm', 'vf'], cas: ['cas'] }[mode];
  const cfg = {
    themes: new Set(themeId ? [themeId] : store.themes.map(t => t.id)),
    types: new Set(defTypes), n: mode === 'chrono' ? 15 : mode === 'cas' ? 0 : 10, niveau: 0,
  };
  const draw = () => {
    const pool = filterPool(all, cfg);
    view().innerHTML = `
      <button class="btn ghost sm" onclick="history.back()">← Retour</button>
      <h1 style="margin-top:6px">${mo.nom}</h1>
      <p class="muted">${mo.desc}</p>
      <div class="card stack">
        <div><div class="section-title"><h3>Thèmes</h3><button class="btn ghost sm" id="allT">${cfg.themes.size === store.themes.length ? 'Aucun' : 'Tous'}</button></div>
          <div class="chips">${store.themes.filter(t => all.some(q => q.theme === t.id)).map(t => `<button class="chip" data-t="${esc(t.id)}" aria-pressed="${cfg.themes.has(t.id)}"><span class="d" style="background:${esc(t.couleur)}"></span>${esc(t.nom)}</button>`).join('')}</div></div>
        ${typesFor.length > 1 ? `<div><h3>Formats</h3><div class="chips">${typesFor.map(t => `<button class="chip" data-ty="${t}" aria-pressed="${cfg.types.has(t)}">${TYPE_LABEL[t]}</button>`).join('')}</div></div>` : ''}
        ${mode !== 'chrono' ? `<div><h3>Nombre de questions</h3><div class="seg">${[5, 10, 20, 30, 0].map(n => `<button data-n="${n}" aria-pressed="${cfg.n === n}">${n || 'Toutes'}</button>`).join('')}</div></div>` : ''}
        <div><h3>Difficulté</h3><div class="seg">${[[0, 'Toutes'], [1, 'Facile'], [2, 'Moyen'], [3, 'Expert']].map(([v, l]) => `<button data-lv="${v}" aria-pressed="${cfg.niveau === v}">${l}</button>`).join('')}</div></div>
      </div>
      <div class="sticky-actions"><button class="btn block" id="go" ${pool.length ? '' : 'disabled'}>${icon('play')} Lancer (${Math.min(pool.length, cfg.n || pool.length)} question${pool.length > 1 ? 's' : ''})</button></div>`;
    view().querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const id = b.dataset.t; cfg.themes.has(id) ? cfg.themes.delete(id) : cfg.themes.add(id); draw(); });
    view().querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { const id = b.dataset.ty; cfg.types.has(id) ? cfg.types.delete(id) : cfg.types.add(id); draw(); });
    view().querySelectorAll('[data-n]').forEach(b => b.onclick = () => { cfg.n = +b.dataset.n; draw(); });
    view().querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { cfg.niveau = +b.dataset.lv; draw(); });
    $('#allT').onclick = () => { cfg.themes = cfg.themes.size === store.themes.length ? new Set() : new Set(store.themes.map(t => t.id)); draw(); };
    $('#go').onclick = () => startSession(mode, cfg);
  };
  draw();
}
function filterPool(all, cfg) {
  return all.filter(q => cfg.themes.has(q.theme) && cfg.types.has(q.type) && (!cfg.niveau || (q.niveau || 1) === cfg.niveau));
}

// =============== SESSION ===============
function startSession(mode, cfg) {
  const all = store.allQuestions();
  let items = [];
  if (mode === 'revision') {
    const due = store.dueQuestions().sort((a, b) => store.prog(a.id).d - store.prog(b.id).d).slice(0, 20);
    const fresh = shuffle(store.newQuestions().filter(q => q.type !== 'carte')).slice(0, Math.max(0, 10 - due.length));
    items = [...due, ...fresh];
    if (!items.length) items = shuffle(all.filter(q => q.type !== 'carte')).slice(0, 10);
  } else if (mode === 'faibles') {
    items = store.weakQuestions().slice(0, 15);
    if (!items.length) { toast('Pas encore de points faibles : entraînez-vous d’abord !'); return; }
  } else if (mode === 'erreurs' || mode === 'sujet') {
    items = cfg.ids.map(id => store.question(id)).filter(Boolean);
  } else {
    items = shuffle(filterPool(all, cfg));
    if (cfg.n) items = items.slice(0, cfg.n);
  }
  if (!items.length) { toast('Aucune question ne correspond.'); return; }
  session = {
    id: uid('s'), mode, items, i: 0, step: 0, results: [], start: Date.now(), answered: false,
    limit: mode === 'chrono' ? 180 : 0, cardMode: mode === 'cartes', topic: cfg.topic,
  };
  go('session');
}

let tick = null;
function stopTimer() { clearInterval(tick); tick = null; }

function renderSession() {
  const s = session;
  const q = s.items[s.i];
  const th = store.theme(q.theme);
  const progress = (s.i / s.items.length) * 100;
  const asCard = s.cardMode || q.type === 'carte';
  view().innerHTML = `
    <div class="session-head">
      <button class="icon-btn" id="quit" aria-label="Quitter">${icon('x')}</button>
      <div class="bar"><i style="width:${progress}%"></i></div>
      <span class="tiny">${s.i + 1}/${s.items.length}</span>
      ${s.limit ? `<span class="timer" id="timer"></span>` : ''}
    </div>
    <div class="q-meta"><span class="badge" style="background:${esc(th.couleur)}22;color:${esc(th.couleur)}">${esc(th.nom)}</span><span class="badge">${TYPE_LABEL[q.type]}</span>${q.origine !== 'base' ? `<span class="badge brand">${esc(q.origine)}</span>` : ''}</div>
    <div id="qzone"></div>`;
  $('#quit').onclick = () => { if (s.results.length === 0 || confirmBox('Arrêter la session ? Les réponses déjà données sont enregistrées.')) finishSession(true); };
  if (s.limit) {
    const upd = () => {
      const left = Math.max(0, s.limit - Math.floor((Date.now() - s.start) / 1000));
      const el = $('#timer'); if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) { stopTimer(); toast('Temps écoulé !'); finishSession(); }
    };
    stopTimer(); upd(); tick = setInterval(upd, 500);
  }
  if (asCard) renderCard(q); else if (q.type === 'cas') renderCase(q); else renderChoiceTop(q);
}

function srcLine(q) {
  const so = store.source(q.source);
  const label = so ? so.titre : q.source;
  if (!label) return '';
  return `<div class="src">Source : ${so && so.url ? `<a href="${esc(so.url)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label)}</div>`;
}

// Affiche une question à choix (QCM, V/F ou étape de cas) dans #qzone (ou conteneur)
function renderChoiceQ(q, part, onDone, container = $('#qzone'), extraTop = '') {
  const multi = part.bonnes.length > 1;
  const keepOrder = q.type === 'vf' || part.choix.some(c => /^(tous|toutes|aucun)/i.test(c)) || part.choix.length <= 2;
  const order = keepOrder ? part.choix.map((_, i) => i) : shuffle(part.choix.map((_, i) => i));
  const selected = new Set();
  container.innerHTML = `${extraTop}
    <div class="q-text">${nl2br(part.question)}</div>
    <div class="q-hint">${multi ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</div>
    <div class="choices">${order.map((oi, k) => `<button class="choice ${multi ? 'multi' : ''}" data-i="${oi}" aria-pressed="false"><span class="k">${String.fromCharCode(65 + k)}</span><span>${esc(part.choix[oi])}</span></button>`).join('')}</div>
    <div id="fb"></div>
    <div class="sticky-actions"><button class="btn block" id="validate" disabled>Valider</button></div>`;
  const btns = container.querySelectorAll('.choice');
  const validate = container.querySelector('#validate');
  btns.forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (!multi) { selected.clear(); btns.forEach(x => x.setAttribute('aria-pressed', 'false')); }
    selected.has(i) ? selected.delete(i) : selected.add(i);
    b.setAttribute('aria-pressed', String(selected.has(i)));
    validate.disabled = !selected.size;
    if (!multi && session && session.mode === 'chrono') validate.click();
  });
  validate.onclick = () => {
    const good = new Set(part.bonnes);
    const ok = selected.size === good.size && [...selected].every(i => good.has(i));
    btns.forEach(b => {
      const i = +b.dataset.i; b.disabled = true;
      if (good.has(i)) b.classList.add('good'); else if (selected.has(i)) b.classList.add('bad');
    });
    const fb = container.querySelector('#fb');
    fb.innerHTML = `<div class="feedback ${ok ? 'ok' : 'ko'}"><div class="verdict">${ok ? '✓ Bonne réponse' : '✗ Pas tout à fait'}</div>${part.explication ? `<div>${nl2br(part.explication)}</div>` : ''}${q === part || part.isLast ? srcLine(q) : ''}</div>`;
    validate.textContent = 'Continuer →';
    validate.onclick = () => onDone(ok, true);
    onDone(ok, false);
    if (session && session.mode === 'chrono') setTimeout(() => { if (validate.isConnected) validate.click(); }, ok ? 700 : 1800);
  };
}

function handleResult(q, ok) {
  const s = session;
  store.record(q.id, ok);
  s.results.push({ id: q.id, ok });
}
function nextItem() {
  const s = session;
  if (!s) return;
  s.i++; s.step = 0;
  if (s.i >= s.items.length) finishSession(); else renderSession();
}

// QCM / VF : onDone est appelé à la validation (final=false) puis sur « Continuer » (final=true)
function renderChoiceTop(q) {
  let recorded = false;
  renderChoiceQ(q, q, (ok, final) => {
    if (!recorded) { recorded = true; handleResult(q, ok); }
    if (final) nextItem();
  });
}

function renderCase(q) {
  const s = session;
  const zone = $('#qzone');
  const results = [];
  const showStep = (k) => {
    const st = { ...q.etapes[k], isLast: k === q.etapes.length - 1 };
    const top = `<div class="tiny" style="margin-bottom:6px">${esc(q.question)} — étape ${k + 1}/${q.etapes.length}</div><div class="context">${nl2br(q.contexte)}</div>`;
    let rec = false;
    renderChoiceQ(q, st, (ok, final) => {
      if (!rec) { rec = true; results.push(ok); }
      if (final) {
        if (k + 1 < q.etapes.length) showStep(k + 1);
        else { handleResult(q, results.every(Boolean)); nextItem(); }
      }
    }, zone, top);
    window.scrollTo(0, 0);
  };
  showStep(0);
}

function cardBack(q) {
  if (q.type === 'carte') return nl2br(q.reponse);
  if (q.type === 'cas') return q.etapes.map((e, i) => `<p><b>${i + 1}. ${esc(e.question)}</b><br>${e.bonnes.map(b => '✓ ' + esc(e.choix[b])).join('<br>')}</p>`).join('');
  return `<p><b>${q.bonnes.map(b => '✓ ' + esc(q.choix[b])).join('<br>')}</b></p>${q.explication ? `<p class="small">${nl2br(q.explication)}</p>` : ''}`;
}
function renderCard(q) {
  const zone = $('#qzone');
  zone.innerHTML = `
    <div class="flash" id="flash"><div class="flash-inner">
      <div class="flash-face front">${q.contexte ? `<div class="context">${nl2br(q.contexte)}</div>` : ''}<div class="q-text">${nl2br(q.question)}</div></div>
      <div class="flash-face back"><div class="verso">${cardBack(q)}</div>${srcLine(q).replace('class="src"', 'class="tiny" style="margin-top:12px"')}</div>
    </div></div>
    <div class="flip-hint" id="hint">Touchez la carte pour la retourner</div>
    <div class="sticky-actions"><div class="btn-row hidden" id="judge"><button class="btn danger" id="no">À revoir</button><button class="btn" id="yes">Je savais ✓</button></div>
    <button class="btn block secondary" id="flipBtn">Retourner la carte</button></div>`;
  const flip = () => {
    $('#flash').classList.toggle('flipped');
    $('#judge').classList.remove('hidden'); $('#flipBtn').classList.add('hidden'); $('#hint').textContent = 'Soyez honnête : cela règle la date de la prochaine révision.';
  };
  $('#flash').onclick = flip; $('#flipBtn').onclick = flip;
  $('#yes').onclick = () => { handleResult(q, true); nextItem(); };
  $('#no').onclick = () => { handleResult(q, false); nextItem(); };
}

function finishSession(aborted) {
  stopTimer();
  const s = session; if (!s) return;
  const score = s.results.filter(r => r.ok).length;
  const h = { id: s.id, date: Date.now(), mode: s.mode, score, total: s.results.length, duree: Math.round((Date.now() - s.start) / 1000),
    themes: [...new Set(s.items.map(q => q.theme))], ...(s.topic ? { sujet: s.topic } : {}) };
  if (s.results.length) store.addHistory(h); else store.save();
  lastResult = { ...h, results: s.results, aborted };
  session = null;
  scheduleSync(1500);
  if (!s.results.length) return go('');
  go('resultats');
}

function renderResults() {
  const r = lastResult;
  const ratio = r.total ? r.score / r.total : 0;
  const misses = r.results.filter(x => !x.ok).map(x => store.question(x.id)).filter(Boolean);
  const C = 2 * Math.PI * 52;
  const msg = ratio >= .9 ? 'Excellent !' : ratio >= .7 ? 'Très bien, continuez !' : ratio >= .5 ? 'C’est en bonne voie.' : 'Chaque erreur est une occasion d’apprendre.';
  view().innerHTML = `
    <div class="card" style="text-align:center">
      <svg class="score-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
        <circle cx="60" cy="60" r="52" fill="none" stroke="${ratio >= .7 ? 'var(--ok)' : ratio >= .5 ? 'var(--warn)' : 'var(--ko)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * ratio} ${C}" transform="rotate(-90 60 60)"/>
        <text x="60" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="var(--ink)" font-family="Georgia,serif">${r.score}/${r.total}</text></svg>
      <h1>${msg}</h1>
      <p class="muted">${r.sujet ? 'Sujet : ' + esc(r.sujet) : MODES[r.mode] ? MODES[r.mode].nom : 'Révision des erreurs'} · ${Math.floor(r.duree / 60)} min ${r.duree % 60} s${r.aborted ? ' · session interrompue' : ''}</p>
      <div class="btn-row">${misses.length ? `<button class="btn" id="redo">Revoir mes ${misses.length} erreur${misses.length > 1 ? 's' : ''}</button>` : ''}<button class="btn secondary" onclick="location.hash='#/'">Accueil</button></div>
    </div>
    ${misses.length ? `<div class="section"><h2>À retenir</h2><div class="card">${misses.map(q => `
      <div class="result-item"><div class="q-meta"><span class="badge">${esc(store.theme(q.theme).nom)}</span></div>
      <b>${esc(q.question)}</b>
      <div class="small" style="margin-top:6px">${q.type === 'carte' ? nl2br(q.reponse) : q.type === 'cas' ? q.etapes.map(e => '✓ ' + e.bonnes.map(b => esc(e.choix[b])).join(' · ')).join('<br>') : '✓ ' + q.bonnes.map(b => esc(q.choix[b])).join(' · ')}</div>
      ${q.explication ? `<div class="small muted" style="margin-top:4px">${nl2br(q.explication)}</div>` : ''}</div>`).join('')}</div></div>` : ''}`;
  const redo = $('#redo'); if (redo) redo.onclick = () => startSession('erreurs', { ids: misses.map(q => q.id) });
}

// =============== QUIZ SUR UN SUJET ===============
const norm = s => ' ' + String(s ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim() + ' ';
const STOP = new Set('le la les un une des de du d l et ou en au aux a sur pour par dans avec sans quiz quizz question questions chiffre chiffres sujet patient patients du des est ce ces qui que quoi quel quelle quels quelles son sa ses leur leurs texte textes chiffre'.split(' '));
const SYN = { ic: ['insuffisance cardiaque', 'insuffisant cardiaque', 'insuffisants cardiaques'], irc: ['insuffisance renale', 'mrc', 'dialys'], ir: ['insuffisance renale'],
  mortalite: ['mortalite', 'deces', 'mortalit', 'surmortalite', 'mourir'], deces: ['deces', 'mortalit'], rein: ['renal', 'rein', 'dialys', 'greffe'], renal: ['renal', 'renale', 'dialys'],
  coeur: ['coeur', 'cardiaque', 'cardio'], tele: ['telesurveillance', 'telemedecine', 'teleconsultation', 'tele expertise', 'teleexpertise'], ts: ['telesurveillance'],
  prado: ['prado', 'retour a domicile'], cpts: ['cpts', 'communaute professionnelle'], ars: ['ars', 'agence regionale'], bnp: ['bnp', 'nt probnp', 'peptide'],
  vaccin: ['vaccin', 'grippe', 'pneumoco'], sel: ['sel', 'sodium', 'sale'], loi: ['loi', 'lfss', 'decret', 'arrete du', 'arrete ministeriel', 'code de la sante', 'legislat', 'reglementaire', 'droit commun', 'juridique'] };
function topicTerms(query) {
  let n = norm(query);
  const terms = [];
  for (const ph of ['grand est', 'coeur de moselle', 'insuffisance cardiaque', 'insuffisance renale', 'droit commun', 'education therapeutique']) {
    if (n.includes(' ' + ph + ' ')) { terms.push([ph]); n = n.replace(' ' + ph + ' ', ' '); }
  }
  for (let w of n.trim().split(/\s+/)) {
    if (!w || STOP.has(w) || (w.length < 2 && !/\d/.test(w))) continue;
    const base = w.length > 4 ? w.replace(/(es|s|x)$/, '') : w;
    terms.push([...new Set([w.length >= 8 ? w.slice(0, 6) : base, ...(SYN[w] || SYN[base] || [])])]);
  }
  return terms;
}
function hay(q) {
  if (q._hay) return q._hay;
  const so = store.source(q.source);
  const parts = [q.question, q.contexte, q.reponse, q.explication, ...(q.choix || []), ...(q.tags || []), store.theme(q.theme).nom, so ? so.titre : q.source,
    ...(q.etapes || []).flatMap(e => [e.question, e.explication, ...e.choix])];
  Object.defineProperty(q, '_hay', { value: norm(parts.join(' ')), enumerable: false });
  return q._hay;
}
const hit = (h, alt) => alt.length <= 3 ? h.includes(' ' + alt + ' ') : h.includes(' ' + alt);
export function searchTopic(query, pool = store.allQuestions()) {
  const terms = topicTerms(query);
  if (!terms.length) return { terms, list: [] };
  const scored = pool.map(q => {
    const h = hay(q), hq = norm(q.question + ' ' + (q.reponse || '') + ' ' + (q.choix || []).join(' '));
    const sc = terms.filter(alts => alts.some(a => hit(h, a))).length;
    return { q, sc, pr: terms.filter(alts => alts.some(a => hit(hq, a))).length };
  }).filter(x => x.sc);
  let list = scored.filter(x => x.sc === terms.length);
  if (list.length < 5 && terms.length >= 3) list = scored.filter(x => x.sc >= terms.length - 1);
  return { terms, list: list.sort((a, b) => (b.sc - a.sc) || (b.pr - a.pr)).map(x => x.q) };
}
const topicState = { query: '', source: '', types: new Set(['qcm', 'vf', 'cas', 'carte']), n: 0 };
function renderTopic() {
  const all = store.allQuestions();
  const SUGG = ['CPTS Cœur de Moselle', 'Newcard', 'Télésurveillance rénale', 'Éligibilité', 'Urgences RPU', 'Mortalité', 'Mortalité Grand Est', 'PRADO', 'NT-proBNP', 'NYHA', 'Télésurveillance', 'Dialyse', 'Sel', 'Vaccination', 'DAC', 'Textes de loi'];
  const counts = new Map(); all.forEach(q => counts.set(q.source, (counts.get(q.source) || 0) + 1));
  const draw = (keepFocus) => {
    let pool = topicState.source ? all.filter(q => q.source === topicState.source) : all;
    const res = topicState.query.trim() ? searchTopic(topicState.query, pool).list : (topicState.source ? pool : []);
    const list = res.filter(q => topicState.types.has(q.type));
    const n = topicState.n ? Math.min(topicState.n, list.length) : list.length;
    const so = topicState.source && store.source(topicState.source);
    const active = topicState.query.trim() || topicState.source;
    $('#tres').innerHTML = !active ? '<p class="tiny">Choisissez une suggestion, un document, ou tapez librement un sujet.</p>'
      : list.length ? `<p class="small"><b>${list.length} question${list.length > 1 ? 's' : ''}</b> trouvée${list.length > 1 ? 's' : ''}${so ? ' dans « ' + esc(so.titre) + ' »' : ''}.</p>
        <div class="card" style="padding:0 14px">${list.slice(0, 8).map(q => `<div class="qrow" data-id="${esc(q.id)}"><span class="sw" style="background:${esc(store.theme(q.theme).couleur)}"></span><div style="flex:1;min-width:0"><div class="t">${esc(q.question)}</div><div class="m"><span class="badge">${TYPE_LABEL[q.type]}</span><span class="tiny">${esc(store.theme(q.theme).nom)}</span></div></div></div>`).join('')}
        ${list.length > 8 ? `<p class="tiny" style="padding:10px 0">… et ${list.length - 8} autre(s)</p>` : ''}</div>`
      : `<div class="feedback ko"><div class="verdict">Aucune question sur ce sujet pour l'instant</div>
          <div class="small">Les questions ne portent que sur les supports déjà transformés en quiz. Pour couvrir ce sujet : envoyez le document ou le lien à Claude en demandant des questions sur « ${esc(topicState.query || so?.titre || '')} », puis importez le fichier reçu (Questions → Importer). Vous pouvez aussi créer vos questions vous-même.</div>
          <div class="btn-row" style="margin-top:10px"><button class="btn sm secondary" onclick="location.hash='#/edit/new'">Créer une question</button></div></div>`;
    $('#tgo').disabled = !list.length;
    $('#tgo').innerHTML = `${icon('play')} Lancer le quiz (${n} question${n > 1 ? 's' : ''})`;
    view().querySelectorAll('#tres .qrow').forEach(r => r.onclick = () => showQuestion(r.dataset.id));
    view().querySelectorAll('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === topicState.source)));
    view().querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-pressed', String(topicState.types.has(b.dataset.ty))));
    view().querySelectorAll('[data-n]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.n === topicState.n)));
    $('#tgo').onclick = () => startSession('sujet', { ids: shuffle(list).slice(0, n).map(q => q.id), topic: topicState.query.trim() || (so ? so.titre : '') });
  };
  view().innerHTML = `
    <button class="btn ghost sm" onclick="history.back()">← Retour</button>
    <h1 style="margin-top:6px">Quiz sur un sujet</h1>
    <p class="muted small">Tapez un sujet précis : l'application rassemble toutes les questions qui en parlent, quel que soit leur thème.</p>
    <input class="input" id="tq" type="search" placeholder="Ex. CPTS Cœur de Moselle, mortalité IC, NT-proBNP…" value="${esc(topicState.query)}" autocomplete="off" style="font-size:1.05rem">
    <div class="chips" style="margin-top:10px">${SUGG.map(t => `<button class="chip" data-sg="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="section" id="tres"></div>
    <div class="section"><h3>Formats</h3><div class="chips">${Object.entries(TYPE_LABEL).map(([k, v]) => `<button class="chip" data-ty="${k}">${v}</button>`).join('')}</div>
      <h3 style="margin-top:14px">Nombre de questions</h3><div class="seg">${[10, 20, 0].map(n => `<button data-n="${n}">${n || 'Toutes'}</button>`).join('')}</div></div>
    <div class="section"><h3>Ou par document importé</h3>
      <div class="chips">${store.sources.filter(s => counts.get(s.id)).map(s => `<button class="chip" style="text-align:left" data-src="${esc(s.id)}" aria-pressed="false" title="${esc(s.titre)}">${esc(s.titre.length > 38 ? s.titre.slice(0, 36) + '…' : s.titre)} <span class="tiny">${counts.get(s.id)}</span></button>`).join('')}</div></div>
    <div class="sticky-actions"><button class="btn block" id="tgo" disabled></button></div>`;
  $('#tq').oninput = e => { topicState.query = e.target.value; draw(); };
  view().querySelectorAll('[data-sg]').forEach(b => b.onclick = () => {
    topicState.query = b.dataset.sg === 'Textes de loi' ? 'loi' : b.dataset.sg; $('#tq').value = topicState.query; draw();
  });
  view().querySelectorAll('[data-src]').forEach(b => b.onclick = () => { topicState.source = topicState.source === b.dataset.src ? '' : b.dataset.src; draw(); });
  view().querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { const t = b.dataset.ty; topicState.types.has(t) ? topicState.types.delete(t) : topicState.types.add(t); draw(); });
  view().querySelectorAll('[data-n]').forEach(b => b.onclick = () => { topicState.n = +b.dataset.n; draw(); });
  draw();
}

// =============== BIBLIOTHÈQUE ===============
const biblioState = { q: '', theme: '', type: '', origine: '' };
function renderBiblio() {
  const all = store.allQuestions();
  const draw = () => {
    const term = biblioState.q.toLowerCase();
    const list = all.filter(q => (!biblioState.theme || q.theme === biblioState.theme) && (!biblioState.type || q.type === biblioState.type)
      && (!biblioState.origine || (biblioState.origine === 'perso' ? q.origine !== 'base' : q.origine === 'base'))
      && (!term || JSON.stringify([q.question, q.choix, q.explication, q.reponse, q.contexte]).toLowerCase().includes(term)));
    $('#list').innerHTML = list.length ? list.map(q => {
      const th = store.theme(q.theme); const p = store.prog(q.id);
      return `<div class="qrow" data-id="${esc(q.id)}"><span class="sw" style="background:${esc(th.couleur)}"></span><div style="flex:1;min-width:0"><div class="t">${esc(q.question)}</div>
        <div class="m"><span class="badge">${TYPE_LABEL[q.type]}</span>${q.origine !== 'base' ? `<span class="badge brand">${esc(q.origine)}</span>` : ''}<span class="tiny">${p.s ? `vue ${p.s}× · ${Math.round(p.c / p.s * 100)} % réussite · boîte ${p.b}/5` : 'jamais vue'}</span></div></div></div>`;
    }).join('') : '<p class="empty">Aucune question trouvée.</p>';
    $('#count').textContent = `${list.length} / ${all.length}`;
    view().querySelectorAll('.qrow').forEach(r => r.onclick = () => showQuestion(r.dataset.id));
  };
  view().innerHTML = `
    <div class="section-title"><h1 style="margin:0">Bibliothèque</h1><span class="tiny" id="count"></span></div>
    <p class="muted small">Toutes vos questions. Ajoutez les vôtres, modifiez, importez : tout est synchronisé entre vos appareils.</p>
    <div class="btn-row" style="margin-bottom:14px"><button class="btn" id="add">+ Nouvelle question</button><button class="btn secondary" id="imp">Importer</button><button class="btn secondary" id="exp">Exporter</button></div>
    <div class="toolbar">
      <input class="input" id="search" type="search" placeholder="Rechercher…" value="${esc(biblioState.q)}">
      <select class="input" id="fth" style="flex:1 1 160px"><option value="">Tous les thèmes</option>${store.themes.map(t => `<option value="${esc(t.id)}" ${biblioState.theme === t.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select>
      <select class="input" id="fty" style="flex:0 1 140px"><option value="">Tous formats</option>${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${biblioState.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="input" id="for" style="flex:0 1 150px"><option value="">Toutes origines</option><option value="base" ${biblioState.origine === 'base' ? 'selected' : ''}>Banque initiale</option><option value="perso" ${biblioState.origine === 'perso' ? 'selected' : ''}>Mes questions</option></select>
    </div>
    <div class="card" style="padding:0 14px" id="list"></div>`;
  $('#search').oninput = e => { biblioState.q = e.target.value; draw(); };
  $('#fth').onchange = e => { biblioState.theme = e.target.value; draw(); };
  $('#fty').onchange = e => { biblioState.type = e.target.value; draw(); };
  $('#for').onchange = e => { biblioState.origine = e.target.value; draw(); };
  $('#add').onclick = () => go('edit/new');
  $('#imp').onclick = openImport;
  $('#exp').onclick = openExport;
  draw();
}

function showQuestion(id) {
  const q = store.question(id); if (!q) return;
  const th = store.theme(q.theme);
  const body = q.type === 'carte' ? `<div class="context">${nl2br(q.reponse)}</div>`
    : q.type === 'cas' ? `<div class="context">${nl2br(q.contexte)}</div>${q.etapes.map((e, i) => `<p><b>${i + 1}. ${esc(e.question)}</b></p><ul>${e.choix.map((c, j) => `<li>${e.bonnes.includes(j) ? '✓ <b>' + esc(c) + '</b>' : esc(c)}</li>`).join('')}</ul><p class="small muted">${nl2br(e.explication)}</p>`).join('')}`
    : `<ul>${q.choix.map((c, j) => `<li>${q.bonnes.includes(j) ? '✓ <b>' + esc(c) + '</b>' : esc(c)}</li>`).join('')}</ul><p class="small muted">${nl2br(q.explication)}</p>`;
  sheet(TYPE_LABEL[q.type], `
    <div class="q-meta"><span class="badge" style="background:${esc(th.couleur)}22;color:${esc(th.couleur)}">${esc(th.nom)}</span><span class="badge">Niveau ${q.niveau || 1}</span><span class="badge brand">${esc(q.origine)}</span></div>
    <div class="q-text">${nl2br(q.question)}</div>${body}<div class="feedback" style="border:0;padding:0">${srcLine(q)}</div>
    <div class="btn-row" style="margin-top:16px"><button class="btn" data-a="test">Tester</button><button class="btn secondary" data-a="edit">Modifier</button><button class="btn danger" data-a="del">Supprimer</button></div>`,
  (el, close) => {
    el.querySelector('[data-a=test]').onclick = () => { close(); startSession('erreurs', { ids: [q.id] }); };
    el.querySelector('[data-a=edit]').onclick = () => { close(); go('edit/' + encodeURIComponent(q.id)); };
    el.querySelector('[data-a=del]').onclick = () => {
      if (!confirmBox('Supprimer cette question ?' + (q.origine === 'base' ? ' (Elle sera masquée ; vous pourrez la restaurer dans Réglages.)' : ''))) return;
      store.deleteQuestion(q.id); close(); scheduleSync(); toast('Question supprimée'); render();
    };
  });
}

// =============== ÉDITEUR ===============
function renderEditor(id) {
  const existing = id && id !== 'new' ? store.question(id) : null;
  const q = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid('u'), theme: store.themes[0]?.id, type: 'qcm', question: '', choix: ['', '', '', ''], bonnes: [0], explication: '', niveau: 1, source: '' };
  delete q.origine;
  if (!q.choix) q.choix = ['', '', '', ''];
  if (!q.bonnes) q.bonnes = [0];
  if (!q.etapes) q.etapes = [{ question: '', choix: ['', '', ''], bonnes: [0], explication: '' }];
  const choicesEditor = (arr, good, prefix) => `${arr.map((c, i) => `
      <div class="choice-edit"><input class="input" data-${prefix}c="${i}" value="${esc(c)}" placeholder="Réponse ${String.fromCharCode(65 + i)}">
      <label><input type="checkbox" data-${prefix}g="${i}" ${good.includes(i) ? 'checked' : ''}> bonne</label>
      <button class="icon-btn" data-${prefix}x="${i}" aria-label="Retirer">${icon('x')}</button></div>`).join('')}
      <button class="btn ghost sm" data-${prefix}add>+ Ajouter une réponse</button>`;
  const draw = () => {
    const isCase = q.type === 'cas', isCard = q.type === 'carte', isVF = q.type === 'vf';
    if (isVF) { q.choix = ['Vrai', 'Faux']; if (!q.bonnes.length || q.bonnes[0] > 1) q.bonnes = [0]; }
    view().innerHTML = `
      <button class="btn ghost sm" onclick="history.back()">← Retour</button>
      <h1 style="margin-top:6px">${existing ? 'Modifier la question' : 'Nouvelle question'}</h1>
      <div class="card">
        <label class="field"><span>Format</span><div class="seg">${Object.entries(TYPE_LABEL).map(([k, v]) => `<button type="button" data-type="${k}" aria-pressed="${q.type === k}">${v}</button>`).join('')}</div></label>
        <label class="field"><span>Thème</span><select class="input" id="theme">${store.themes.map(t => `<option value="${esc(t.id)}" ${q.theme === t.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}<option value="__new">+ Créer un nouveau thème…</option></select></label>
        <label class="field"><span>${isCase ? 'Titre du cas' : isCard ? 'Recto (question / notion)' : 'Question'}</span><textarea class="input" id="question">${esc(q.question)}</textarea></label>
        ${isCase ? `<label class="field"><span>Situation clinique (contexte)</span><textarea class="input" id="contexte" style="min-height:120px">${esc(q.contexte || '')}</textarea></label>
          <div id="steps">${q.etapes.map((e, k) => `<div class="step-box"><div class="section-title"><h3>Étape ${k + 1}</h3>${q.etapes.length > 1 ? `<button class="btn ghost sm" data-delstep="${k}">Retirer</button>` : ''}</div>
            <label class="field"><span>Question</span><input class="input" data-sq="${k}" value="${esc(e.question)}"></label>
            <div class="field"><span>Réponses (cochez la ou les bonnes)</span>${choicesEditor(e.choix, e.bonnes, 's' + k)}</div>
            <label class="field"><span>Explication</span><textarea class="input" data-se="${k}">${esc(e.explication)}</textarea></label></div>`).join('')}</div>
          <button class="btn secondary sm" id="addstep">+ Ajouter une étape</button>`
        : isCard ? `<label class="field"><span>Verso (réponse)</span><textarea class="input" id="reponse" style="min-height:140px">${esc(q.reponse || '')}</textarea></label>`
        : isVF ? `<div class="field"><span>Bonne réponse</span><div class="seg"><button type="button" data-vf="0" aria-pressed="${q.bonnes[0] === 0}">Vrai</button><button type="button" data-vf="1" aria-pressed="${q.bonnes[0] === 1}">Faux</button></div></div>`
        : `<div class="field"><span>Réponses (cochez la ou les bonnes)</span>${choicesEditor(q.choix, q.bonnes, 'm')}</div>`}
        ${!isCase && !isCard ? `<label class="field"><span>Explication (affichée après la réponse)</span><textarea class="input" id="explication">${esc(q.explication || '')}</textarea></label>` : ''}
        <label class="field"><span>Source</span><select class="input" id="source"><option value="">—</option>${store.sources.map(s => `<option value="${esc(s.id)}" ${q.source === s.id ? 'selected' : ''}>${esc(s.titre)}</option>`).join('')}${q.source && !store.source(q.source) ? `<option value="${esc(q.source)}" selected>${esc(q.source)}</option>` : ''}</select>
          <span class="tiny" style="font-weight:400">Pour une nouvelle source (lien web, document), ajoutez-la d'abord dans Ressources.</span></label>
        <label class="field"><span>Difficulté</span><div class="seg">${[[1, 'Facile'], [2, 'Moyen'], [3, 'Expert']].map(([v, l]) => `<button type="button" data-lv="${v}" aria-pressed="${(q.niveau || 1) === v}">${l}</button>`).join('')}</div></label>
      </div>
      <div class="sticky-actions"><button class="btn block" id="save">Enregistrer</button></div>`;
    bindEditor();
  };
  const collect = () => {
    q.question = $('#question').value.trim();
    q.theme = $('#theme').value;
    q.source = $('#source').value;
    if ($('#explication')) q.explication = $('#explication').value.trim();
    if ($('#reponse')) q.reponse = $('#reponse').value.trim();
    if ($('#contexte')) q.contexte = $('#contexte').value.trim();
    if (q.type === 'qcm') {
      q.choix = [...view().querySelectorAll('[data-mc]')].map(i => i.value);
      q.bonnes = [...view().querySelectorAll('[data-mg]')].map((c, i) => c.checked ? i : -1).filter(i => i >= 0);
    }
    if (q.type === 'cas') q.etapes.forEach((e, k) => {
      e.question = view().querySelector(`[data-sq="${k}"]`).value.trim();
      e.explication = view().querySelector(`[data-se="${k}"]`).value.trim();
      e.choix = [...view().querySelectorAll(`[data-s${k}c]`)].map(i => i.value);
      e.bonnes = [...view().querySelectorAll(`[data-s${k}g]`)].map((c, i) => c.checked ? i : -1).filter(i => i >= 0);
    });
  };
  const bindChoices = (prefix, target) => {
    view().querySelectorAll(`[data-${prefix}x]`).forEach(b => b.onclick = () => {
      collect(); const i = +b.getAttribute(`data-${prefix}x`); if (target().choix.length <= 2) return toast('Au moins 2 réponses.');
      const t = target(); t.choix.splice(i, 1); t.bonnes = t.bonnes.filter(x => x !== i).map(x => x > i ? x - 1 : x); draw();
    });
    const add = view().querySelector(`[data-${prefix}add]`); if (add) add.onclick = () => { collect(); target().choix.push(''); draw(); };
  };
  const bindEditor = () => {
    view().querySelectorAll('[data-type]').forEach(b => b.onclick = () => { collect(); q.type = b.dataset.type; if (q.type === 'qcm' && q.choix.join('') === 'VraiFaux') q.choix = ['', '', '', '']; draw(); });
    view().querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { collect(); q.niveau = +b.dataset.lv; draw(); });
    view().querySelectorAll('[data-vf]').forEach(b => b.onclick = () => { collect(); q.bonnes = [+b.dataset.vf]; draw(); });
    $('#theme').onchange = e => {
      if (e.target.value !== '__new') return;
      const nom = prompt('Nom du nouveau thème :');
      if (nom && nom.trim()) {
        const t = { id: 't-' + nom.trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30), nom: nom.trim(), couleur: '#' + Math.floor(Math.random() * 0x777777 + 0x333333).toString(16) };
        store.settings.customThemes = [...(store.settings.customThemes || []), t]; store.saveSettings();
        collect(); q.theme = t.id;
      } else collect();
      draw();
    };
    bindChoices('m', () => q);
    q.etapes.forEach((e, k) => bindChoices('s' + k, () => q.etapes[k]));
    const addstep = $('#addstep'); if (addstep) addstep.onclick = () => { collect(); q.etapes.push({ question: '', choix: ['', '', ''], bonnes: [0], explication: '' }); draw(); };
    view().querySelectorAll('[data-delstep]').forEach(b => b.onclick = () => { collect(); q.etapes.splice(+b.dataset.delstep, 1); draw(); });
    $('#save').onclick = () => {
      collect();
      const err = validateQuestion(q);
      if (err) return toast(err);
      const out = { ...q };
      if (out.type !== 'cas') { delete out.etapes; delete out.contexte; }
      if (out.type === 'carte') { delete out.choix; delete out.bonnes; delete out.explication; }
      if (out.type !== 'carte') delete out.reponse;
      if (out.type === 'cas') { delete out.choix; delete out.bonnes; delete out.explication; out.etapes = out.etapes.map(e => ({ ...e, choix: e.choix.map(c => c.trim()).filter(Boolean) })); }
      if (out.choix) out.choix = out.choix.map(c => c.trim());
      store.upsertQuestion(out);
      scheduleSync();
      toast('Question enregistrée');
      history.length > 1 ? history.back() : go('biblio');
    };
  };
  draw();
}
function validateQuestion(q) {
  if (!q.question || !q.question.trim()) return 'La question est vide.';
  if (q.type === 'carte') return q.reponse ? null : 'Le verso est vide.';
  const check = (p, label) => {
    if (p.choix.filter(c => c.trim()).length < 2) return label + ' : au moins 2 réponses.';
    if (p.choix.some(c => !c.trim())) return label + ' : une réponse est vide.';
    if (!p.bonnes.length) return label + ' : cochez au moins une bonne réponse.';
    return null;
  };
  if (q.type === 'cas') {
    if (!q.contexte) return 'Décrivez la situation clinique.';
    for (let k = 0; k < q.etapes.length; k++) { if (!q.etapes[k].question) return `Étape ${k + 1} : question vide.`; const e = check(q.etapes[k], 'Étape ' + (k + 1)); if (e) return e; }
    return null;
  }
  return check(q, 'Question');
}

// =============== IMPORT / EXPORT ===============
function download(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function openExport() {
  sheet('Exporter', `
    <p class="muted small">Le fichier peut être réimporté sur un autre appareil, partagé, ou envoyé à Claude pour être enrichi.</p>
    <div class="stack">
      <button class="btn block" data-e="perso">Mes questions (ajoutées ou modifiées)</button>
      <button class="btn block secondary" data-e="all">Toute la banque de questions</button>
      <button class="btn block secondary" data-e="backup">Sauvegarde complète (questions + progression)</button>
      <button class="btn block ghost" data-e="csv">Modèle CSV pour Excel</button>
    </div>`, (el, close) => {
    const stamp = new Date().toISOString().slice(0, 10);
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
      const k = b.dataset.e;
      if (k === 'csv') download('modele-questions.csv', '﻿' + csvTemplate(), 'text/csv;charset=utf-8');
      else if (k === 'backup') download(`telesurveillance-quiz-sauvegarde-${stamp}.json`, JSON.stringify({ format: 'tsq-backup', state: store.state, customThemes: store.settings.customThemes || [] }, null, 1));
      else {
        const qs = store.allQuestions().filter(q => k === 'all' || q.origine !== 'base').map(({ origine, ...q }) => q);
        const used = new Set(qs.map(q => q.theme));
        download(`questions-${k === 'all' ? 'banque' : 'perso'}-${stamp}.json`, JSON.stringify({ version: 1, themes: store.themes.filter(t => used.has(t.id)), questions: qs }, null, 1));
      }
      close();
    });
  });
}
function openImport() {
  sheet('Importer des questions', `
    <p class="muted small">Formats acceptés : fichier <b>.json</b> (préparé par Claude ou exporté depuis l'application) ou <b>.csv</b> (Excel, séparateur point-virgule — téléchargez le modèle via Exporter).</p>
    <label class="field"><span>Fichier</span><input class="input" type="file" id="file" accept=".json,.csv,application/json,text/csv"></label>
    <label class="field"><span>…ou collez le contenu JSON</span><textarea class="input" id="paste" placeholder='{"questions":[...]}'></textarea></label>
    <div id="preview"></div>
    <button class="btn block" id="doImp" disabled>Importer</button>`, (el, close) => {
    let parsed = null;
    const show = (res) => {
      parsed = res;
      el.querySelector('#preview').innerHTML = res.error ? `<div class="feedback ko"><div class="verdict">Fichier non reconnu</div>${esc(res.error)}</div>`
        : `<div class="feedback ok"><div class="verdict">${res.questions.length} question(s) prête(s)</div>${res.themes.length ? `${res.themes.length} thème(s) : ${res.themes.map(t => esc(t.nom)).join(', ')}<br>` : ''}${res.backup ? 'Sauvegarde complète : la progression sera fusionnée.<br>' : ''}${res.warnings.length ? `<span class="tiny">${res.warnings.slice(0, 5).map(esc).join('<br>')}</span>` : ''}</div>`;
      el.querySelector('#doImp').disabled = !!res.error || (!res.questions.length && !res.backup);
    };
    el.querySelector('#file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
      show(parseImport(text, f.name, store));
    };
    el.querySelector('#paste').oninput = e => { if (e.target.value.trim()) show(parseImport(e.target.value, 'colle.json', store)); };
    el.querySelector('#doImp').onclick = () => {
      if (!parsed || parsed.error) return;
      const existingThemes = new Set(store.themes.map(t => t.id));
      const newThemes = parsed.themes.filter(t => !existingThemes.has(t.id));
      if (newThemes.length) { store.settings.customThemes = [...(store.settings.customThemes || []), ...newThemes]; store.saveSettings(); }
      if (parsed.backup) {
        store.state = mergeStates(store.state, parsed.backup);
      }
      const baseIds = new Set(store.base.questions.map(q => q.id));
      let n = 0;
      for (const q of parsed.questions) {
        // une question identique à la banque initiale n'est pas dupliquée
        const base = baseIds.has(q.id) && store.base.questions.find(b => b.id === q.id);
        if (base && JSON.stringify({ ...base }) === JSON.stringify({ ...q })) continue;
        q.updatedAt = Date.now(); store.state.custom[q.id] = q; n++;
      }
      store.save(); scheduleSync();
      toast(`${n} question(s) importée(s)`); close(); render();
    };
  });
}

// =============== PROGRESSION ===============
function renderProgress() {
  const all = store.allQuestions();
  const seen = all.filter(q => store.prog(q.id).s);
  const tot = Object.values(store.state.progress).reduce((a, p) => ({ c: a.c + p.c, s: a.s + p.s }), { c: 0, s: 0 });
  const hist = store.state.history.slice(-20);
  const boxes = [0, 1, 2, 3, 4, 5].map(b => all.filter(q => (store.prog(q.id).b || 0) === b).length);
  const days = new Set(store.state.history.map(h => new Date(h.date).toDateString()));
  let streak = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
  const W = 600, H = 160, bw = hist.length ? Math.min(40, (W - 20) / hist.length - 6) : 0;
  const chart = hist.length ? `<svg class="chart" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Scores des dernières sessions">
      ${[0, .5, 1].map(y => `<line x1="0" x2="${W}" y1="${10 + H - y * H}" y2="${10 + H - y * H}" stroke="var(--line)"/><text x="${W}" y="${6 + H - y * H}" text-anchor="end" font-size="11" fill="var(--ink-3)">${y * 100} %</text>`).join('')}
      ${hist.map((h, i) => { const r = h.total ? h.score / h.total : 0; const x = 10 + i * ((W - 20) / hist.length); const bh = Math.max(3, r * H);
        return `<rect x="${x}" y="${10 + H - bh}" width="${bw}" height="${bh}" rx="4" fill="${r >= .7 ? 'var(--ok)' : r >= .5 ? 'var(--warn)' : 'var(--ko)'}"><title>${new Date(h.date).toLocaleDateString('fr-FR')} · ${h.score}/${h.total}</title></rect>`; }).join('')}
    </svg>` : '<p class="empty">Faites une première session pour voir vos scores ici.</p>';
  const rows = store.themes.map(t => {
    const qs = all.filter(q => q.theme === t.id); if (!qs.length) return '';
    const ps = qs.map(q => store.prog(q.id)); const s = ps.reduce((a, p) => a + p.s, 0), c = ps.reduce((a, p) => a + p.c, 0);
    return `<tr><td><span class="chip" style="padding:2px 8px;border:0;background:none"><span class="d" style="background:${esc(t.couleur)}"></span>${esc(t.nom)}</span></td><td class="n">${qs.filter(q => store.prog(q.id).s).length}/${qs.length}</td><td class="n">${s ? Math.round(c / s * 100) + ' %' : '—'}</td><td class="n">${pct(store.mastery(qs))}</td></tr>`;
  }).join('');
  const weak = store.weakQuestions().slice(0, 5);
  view().innerHTML = `
    <h1>Ma progression</h1>
    <div class="kpis">
      <div class="kpi"><b>${pct(store.mastery(all))}</b><span>maîtrise globale</span></div>
      <div class="kpi"><b>${seen.length}/${all.length}</b><span>questions vues</span></div>
      <div class="kpi"><b>${tot.s ? Math.round(tot.c / tot.s * 100) + ' %' : '—'}</b><span>bonnes réponses</span></div>
      <div class="kpi"><b>${streak}</b><span>jour${streak > 1 ? 's' : ''} d'affilée</span></div>
    </div>
    <div class="section"><div class="section-title"><h2>Dernières sessions</h2><span class="tiny">${store.state.history.length} au total</span></div><div class="card">${chart}</div></div>
    <div class="section"><h2>Répétition espacée</h2><div class="card">
      <p class="small muted">Chaque bonne réponse fait monter la question d'une boîte (révision de plus en plus espacée : 1, 2, 5, 12 puis 30 jours). Une erreur la renvoie en boîte 1.</p>
      ${boxes.map((n, b) => `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><span class="tiny" style="width:64px">${b === 0 ? 'Nouvelles' : 'Boîte ' + b}</span><div class="bar" style="flex:1;margin:0"><i style="width:${all.length ? n / all.length * 100 : 0}%;background:${b === 0 ? 'var(--ink-3)' : 'var(--brand)'};opacity:${b === 0 ? .5 : .35 + b * .13}"></i></div><span class="pct">${n}</span></div>`).join('')}
    </div></div>
    <div class="section"><h2>Par thème</h2><div class="card" style="overflow-x:auto"><table class="t"><thead><tr><th>Thème</th><th class="n">Vues</th><th class="n">Réussite</th><th class="n">Maîtrise</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="section"><div class="section-title"><h2>Points faibles</h2>${weak.length ? '<button class="btn sm" id="wk">S’entraîner</button>' : ''}</div>
      <div class="card">${weak.length ? weak.map(q => { const p = store.prog(q.id); return `<div class="res-item"><span class="ic">${p.c}/${p.s}</span><div class="grow small">${esc(q.question)}</div></div>`; }).join('') : '<p class="empty">Aucun point faible repéré pour l’instant.</p>'}</div></div>`;
  const wk = $('#wk'); if (wk) wk.onclick = () => startSession('faibles', {});
}

// =============== RESSOURCES ===============
function renderResources() {
  const list = store.sources;
  const count = id => store.allQuestions().filter(q => q.source === id).length;
  view().innerHTML = `
    <button class="btn ghost sm" onclick="history.back()">← Retour</button>
    <h1 style="margin-top:6px">Ressources</h1>
    <p class="muted small">Les documents et sites à partir desquels les questions sont rédigées. Ajoutez vos liens (HAS, ameli, Légifrance, ARS…) : ils seront proposés comme source dans l'éditeur.</p>
    <button class="btn" id="addR">+ Ajouter un lien</button>
    <div class="card" style="margin-top:14px;padding:0 14px">${list.map(s => `
      <div class="res-item"><span class="ic">${esc((s.type || 'web').toUpperCase().slice(0, 4))}</span><div class="grow">
        <div class="small"><b>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>` : esc(s.titre)}</b></div>
        <div class="tiny">${count(s.id)} question(s)${s.note ? ' · ' + esc(s.note) : ''}</div></div>
        ${store.state.resources[s.id] ? `<button class="btn ghost sm" data-del="${esc(s.id)}">Retirer</button>` : ''}</div>`).join('')}</div>`;
  $('#addR').onclick = () => sheet('Nouvelle ressource', `
    <label class="field"><span>Titre</span><input class="input" id="rt" placeholder="Ex. HAS – Guide parcours insuffisance cardiaque"></label>
    <label class="field"><span>Lien (facultatif)</span><input class="input" id="ru" type="url" placeholder="https://…"></label>
    <label class="field"><span>Note (facultatif)</span><input class="input" id="rn" placeholder="Ex. à transformer en questions"></label>
    <button class="btn block" id="rs">Ajouter</button>`, (el, close) => {
    el.querySelector('#rs').onclick = () => {
      const titre = el.querySelector('#rt').value.trim(); if (!titre) return toast('Indiquez un titre.');
      const url = el.querySelector('#ru').value.trim();
      store.upsertResource({ id: uid('r'), titre, url, note: el.querySelector('#rn').value.trim(), type: url ? 'web' : 'doc' });
      scheduleSync(); close(); render();
    };
  });
  view().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { store.deleteResource(b.dataset.del); scheduleSync(); render(); });
}

// =============== RÉGLAGES ===============
function renderSettings() {
  const st = store.settings;
  const hiddenN = Object.values(store.state.hidden).filter(h => h && h.h).length;
  view().innerHTML = `
    <h1>Réglages</h1>
    <div class="section" style="margin-top:12px"><h2>Synchronisation entre appareils</h2>
      <div class="card">
        ${syncConfigured() ? `
          <p><b>Connectée à GitHub${st.ghLogin ? ' (' + esc(st.ghLogin) + ')' : ''}.</b> Votre progression et vos questions sont enregistrées dans un Gist privé et fusionnées automatiquement.</p>
          <p class="small muted" id="syncInfo"></p>
          <div class="btn-row"><button class="btn" id="syncNow">Synchroniser maintenant</button><button class="btn danger" id="unlink">Déconnecter cet appareil</button></div>`
        : `
          <p class="small">Pour retrouver votre progression sur ordinateur, téléphone et tablette, l'application l'enregistre dans un <b>Gist privé</b> de votre compte GitHub. À faire une fois par appareil :</p>
          <ol class="steps-list small">
            <li>Sur GitHub : <b>Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)</b>.</li>
            <li>Nom : « Quiz télésurveillance », expiration : <i>No expiration</i> (ou 1 an), cochez uniquement <code class="k">gist</code>, puis générez.</li>
            <li>Copiez le jeton (il commence par <code class="k">ghp_</code>) et collez-le ci-dessous.</li>
          </ol>
          <p><a href="https://github.com/settings/tokens/new?scopes=gist&description=Quiz%20t%C3%A9l%C3%A9surveillance" target="_blank" rel="noopener">Ouvrir directement la page de création du jeton ↗</a></p>
          <label class="field"><span>Jeton GitHub</span><input class="input" id="tok" type="password" autocomplete="off" placeholder="ghp_…"></label>
          <button class="btn block" id="link">Connecter</button>
          <p class="tiny" style="margin-top:8px">Le jeton reste uniquement sur cet appareil. Il ne donne accès qu'à vos Gists. Utilisez le même jeton (ou un autre) sur vos autres appareils.</p>`}
      </div></div>
    <div class="section"><h2>Apparence</h2><div class="card"><div class="seg">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${(st.theme || 'auto') === k}">${l}</button>`).join('')}</div></div></div>
    <div class="section"><h2>Données</h2><div class="card stack">
      <div class="btn-row"><button class="btn secondary" id="imp">Importer</button><button class="btn secondary" id="exp">Exporter / sauvegarder</button></div>
      ${hiddenN ? `<button class="btn secondary block" id="restore">Restaurer ${hiddenN} question(s) supprimée(s) de la banque initiale</button>` : ''}
      <button class="btn danger block" id="reset">Remettre ma progression à zéro</button>
    </div></div>
    <div class="section"><h2>À propos</h2><div class="card small">
      <p><b>Télésurveillance Quiz</b> v${APP_VERSION} · banque initiale v${store.base.version || 1} (${store.base.maj || ''}) · ${store.allQuestions().length} questions.</p>
      <p class="muted">Outil personnel de formation. Les contenus sont tirés des documents cités en source et ne remplacent pas les recommandations officielles en vigueur.</p>
      <p class="muted">Installer l'application : sur téléphone, menu du navigateur → « Ajouter à l'écran d'accueil » (Safari : bouton Partager). Sur ordinateur : icône d'installation dans la barre d'adresse de Chrome ou Edge.</p>
    </div></div>`;
  const info = $('#syncInfo');
  if (info) info.textContent = syncStatus.state === 'error' ? 'Dernière erreur : ' + syncStatus.message : syncStatus.last ? 'Dernière synchronisation : ' + new Date(syncStatus.last).toLocaleString('fr-FR') : '';
  const link = $('#link');
  if (link) link.onclick = async () => {
    const tok = $('#tok').value.trim(); if (!tok) return toast('Collez votre jeton.');
    link.disabled = true; link.textContent = 'Vérification…';
    try {
      const u = await testToken(tok);
      Object.assign(store.settings, { ghToken: tok, ghLogin: u.login }); delete store.settings.gistId; store.saveSettings();
      await syncNow();
      toast(syncStatus.state === 'ok' ? 'Synchronisation activée ✓' : syncStatus.message);
    } catch (e) { toast(e.message); }
    render();
  };
  const sn = $('#syncNow'); if (sn) sn.onclick = async () => { sn.disabled = true; await syncNow(); toast(syncStatus.state === 'ok' ? 'Synchronisé ✓' : syncStatus.message); render(); };
  const ul = $('#unlink'); if (ul) ul.onclick = () => { if (!confirmBox('Déconnecter cet appareil ? Vos données restent sur GitHub et sur cet appareil.')) return; delete store.settings.ghToken; delete store.settings.gistId; delete store.settings.ghLogin; store.saveSettings(); updateSyncPill(); render(); };
  view().querySelectorAll('[data-th]').forEach(b => b.onclick = () => { store.settings.theme = b.dataset.th; store.saveSettings(); applyTheme(); render(); });
  $('#imp').onclick = openImport; $('#exp').onclick = openExport;
  const rs = $('#restore'); if (rs) rs.onclick = () => { store.restoreHidden(); scheduleSync(); toast('Questions restaurées'); render(); };
  $('#reset').onclick = () => { if (confirmBox('Effacer toute votre progression et votre historique ? (Vos questions personnelles sont conservées.)')) { store.resetProgress(); scheduleSync(); toast('Progression remise à zéro'); render(); } };
}

// =============== DIVERS ===============
function applyTheme() {
  const t = store.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
function updateSyncPill() {
  const p = $('#syncPill'); if (!p) return;
  const st = syncConfigured() ? syncStatus.state : 'off';
  p.dataset.state = st;
  p.querySelector('span:last-child').textContent = { off: 'Local', ok: 'Synchronisé', busy: 'Synchro…', error: 'Erreur synchro', offline: 'Hors ligne' }[st] || 'Local';
  p.title = syncStatus.message || '';
}
onSyncStatus(updateSyncPill);
store.onChange(ev => { if (ev === 'synced' && !session && ['', 'progres', 'biblio'].includes(location.hash.replace(/^#\/?/, '').split('/')[0])) render(); });

async function boot() {
  store.load();
  applyTheme();
  try {
    const res = await fetch('data/questions.json', { cache: 'no-cache' });
    store.base = await res.json();
  } catch (e) {
    view().innerHTML = '<p class="empty">Impossible de charger la banque de questions. Vérifiez votre connexion puis rechargez.</p>';
    return;
  }
  $('#syncPill').onclick = () => go('reglages');
  updateSyncPill();
  render();
  if (syncConfigured()) syncNow();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

export { boot };
document.addEventListener('DOMContentLoaded', boot);
