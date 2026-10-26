// Filtres transversaux : pathologie, territoire (région > département > CPTS), nature, thème, source
import { store } from './store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const NATIONAL = '__national';

export function emptyFilter() { return { patho: [], nature: [], region: '', dept: '', cpts: '', themes: [], sources: [], national: false }; }
export function normalizeFilter(f) { return Object.assign(emptyFilter(), JSON.parse(JSON.stringify(f || {}))); }
export function isEmpty(f) {
  f = normalizeFilter(f);
  return !f.patho.length && !f.nature.length && !f.region && !f.dept && !f.cpts && !f.themes.length && !f.sources.length;
}

export function matchFilter(q, f) {
  if (!f) return true;
  if (f.patho && f.patho.length && !(q.patho || ['Transversal']).some(p => f.patho.includes(p))) return false;
  if (f.nature && f.nature.length && !f.nature.includes(q.nature || 'parcours')) return false;
  if (f.themes && f.themes.length && !f.themes.includes(q.theme)) return false;
  if (f.sources && f.sources.length && !f.sources.includes(q.source)) return false;
  const z = q.zone || {};
  if (f.region || f.dept || f.cpts) {
    const isNat = !z.region;
    if (f.region === NATIONAL) return isNat;
    if (isNat) return !!f.national; // option « inclure les connaissances nationales »
    if (f.cpts) return z.cpts === f.cpts || (!!f.national && !z.cpts && (!z.dept || z.dept === f.dept) && z.region === f.region);
    if (f.dept) return z.dept === f.dept || (!!f.national && !z.dept && z.region === f.region);
    if (f.region) return z.region === f.region;
  }
  return true;
}

// Arborescence des territoires présents dans la banque
export function zoneTree(qs = store.allQuestions()) {
  const tree = {};
  for (const q of qs) {
    const z = q.zone; if (!z || !z.region) continue;
    const r = tree[z.region] ||= { n: 0, depts: {} }; r.n++;
    if (z.dept) {
      const d = r.depts[z.dept] ||= { n: 0, cpts: {} }; d.n++;
      if (z.cpts) d.cpts[z.cpts] = (d.cpts[z.cpts] || 0) + 1;
    }
  }
  return tree;
}
export function zoneLabel(z) {
  if (!z || !z.region) return 'France (national)';
  return z.cpts ? 'CPTS ' + z.cpts : z.dept ? z.dept : z.region;
}

export function describeFilter(f) {
  f = normalizeFilter(f);
  const parts = [];
  if (f.patho.length) parts.push(f.patho.map(p => (store.pathos.find(x => x.id === p) || { nom: p }).nom).join(' ou '));
  if (f.cpts) parts.push('CPTS ' + f.cpts); else if (f.dept) parts.push(f.dept); else if (f.region) parts.push(f.region === NATIONAL ? 'National' : f.region);
  if (f.nature.length) parts.push(f.nature.map(n => (store.natures.find(x => x.id === n) || { nom: n }).nom).join(' ou '));
  if (f.themes.length) parts.push(f.themes.map(t => store.theme(t).nom).join(', '));
  if (f.sources.length) parts.push(f.sources.length + ' document(s)');
  return parts.join(' · ') || 'Toutes les questions';
}

// Panneau de filtres réutilisable. f est modifié en place ; onChange() appelé après chaque modification.
export function renderFilterPanel(el, f, onChange, opts = {}) {
  const all = store.allQuestions();
  const cnt = pred => all.filter(pred).length;
  const tree = zoneTree(all);
  const draw = () => {
    const regions = Object.keys(tree).sort();
    const depts = f.region && tree[f.region] ? Object.keys(tree[f.region].depts).sort() : [];
    const cptsList = f.dept && tree[f.region] && tree[f.region].depts[f.dept] ? Object.keys(tree[f.region].depts[f.dept].cpts).sort() : [];
    el.innerHTML = `
      <div class="fgroup"><h3>Pathologie</h3><div class="chips">${store.pathos.map(p => { const n = cnt(q => (q.patho || ['Transversal']).includes(p.id)); return n ? `<button class="chip" data-fp="${esc(p.id)}" aria-pressed="${f.patho.includes(p.id)}">${esc(p.nom)} <span class="tiny">${n}</span></button>` : ''; }).join('')}</div></div>
      <div class="fgroup"><h3>Territoire</h3>
        <div class="toolbar" style="margin:0">
          <select class="input" data-fz="region"><option value="">Tous les territoires</option><option value="${NATIONAL}" ${f.region === NATIONAL ? 'selected' : ''}>France – connaissances nationales (${cnt(q => !q.zone || !q.zone.region)})</option>${regions.map(r => `<option value="${esc(r)}" ${f.region === r ? 'selected' : ''}>Région ${esc(r)} (${tree[r].n})</option>`).join('')}</select>
          ${depts.length ? `<select class="input" data-fz="dept"><option value="">Tous les départements</option>${depts.map(d => `<option value="${esc(d)}" ${f.dept === d ? 'selected' : ''}>${esc(d)} (${tree[f.region].depts[d].n})</option>`).join('')}</select>` : ''}
          ${cptsList.length ? `<select class="input" data-fz="cpts"><option value="">Toutes les CPTS</option>${cptsList.map(c => `<option value="${esc(c)}" ${f.cpts === c ? 'selected' : ''}>CPTS ${esc(c)} (${tree[f.region].depts[f.dept].cpts[c]})</option>`).join('')}</select>` : ''}
        </div>
        ${f.region && f.region !== NATIONAL ? `<label class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" data-fn ${f.national ? 'checked' : ''}> Inclure aussi les connaissances générales (national${f.dept ? ', région' : ''})</label>` : ''}
      </div>
      <div class="fgroup"><h3>Type de contenu</h3><div class="chips">${store.natures.map(n => { const c = cnt(q => (q.nature || 'parcours') === n.id); return c ? `<button class="chip" data-fnat="${esc(n.id)}" aria-pressed="${f.nature.includes(n.id)}">${esc(n.nom)} <span class="tiny">${c}</span></button>` : ''; }).join('')}</div></div>
      ${opts.themes ? `<div class="fgroup"><h3>Thèmes</h3><div class="chips">${store.themes.filter(t => all.some(q => q.theme === t.id)).map(t => `<button class="chip" data-ft="${esc(t.id)}" aria-pressed="${f.themes.includes(t.id)}"><span class="d" style="background:${esc(t.couleur)}"></span>${esc(t.nom)}</button>`).join('')}</div><p class="tiny" style="margin:6px 0 0">Aucun thème coché = tous les thèmes.</p></div>` : ''}
      ${!isEmpty(f) ? `<button class="btn ghost sm" data-freset>Effacer les filtres</button>` : ''}`;
    const tog = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); };
    el.querySelectorAll('[data-fp]').forEach(b => b.onclick = () => { tog(f.patho, b.dataset.fp); changed(); });
    el.querySelectorAll('[data-fnat]').forEach(b => b.onclick = () => { tog(f.nature, b.dataset.fnat); changed(); });
    el.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { tog(f.themes, b.dataset.ft); changed(); });
    el.querySelectorAll('[data-fz]').forEach(s => s.onchange = () => {
      const k = s.dataset.fz; f[k] = s.value;
      if (k === 'region') { f.dept = ''; f.cpts = ''; } if (k === 'dept') f.cpts = '';
      changed();
    });
    const nat = el.querySelector('[data-fn]'); if (nat) nat.onchange = () => { f.national = nat.checked; changed(); };
    const rs = el.querySelector('[data-freset]'); if (rs) rs.onclick = () => { Object.assign(f, emptyFilter()); changed(); };
  };
  const changed = () => { draw(); onChange && onChange(); };
  draw();
}
