// Import (JSON / CSV) et modèle CSV
import { uid } from './store.js';

const TYPES = { qcm: 'qcm', vf: 'vf', 'vrai/faux': 'vf', 'vrai-faux': 'vf', carte: 'carte', flashcard: 'carte', cas: 'cas', 'cas clinique': 'cas' };
const slug = s => 't-' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export function csvTemplate() {
  const head = ['theme', 'type', 'niveau', 'question', 'choix1', 'choix2', 'choix3', 'choix4', 'choix5', 'bonnes', 'explication', 'reponse', 'source'];
  const rows = [
    ['PRADO insuffisance cardiaque', 'qcm', '1', 'Dans quel délai a lieu la 1re consultation chez le médecin traitant avec Prado ?', '48 heures', '7 jours', '1 mois', '3 mois', '', '2', 'Le conseiller organise la consultation dans les 7 jours suivant la sortie.', '', 'prado'],
    ['IC – Signes d\'alerte (EPOF/EPON)', 'vf', '1', 'Une prise de 2 kg en 3 jours doit faire appeler le médecin.', 'Vrai', 'Faux', '', '', '', '1', 'Seuil d\'alerte du carnet Prado.', '', ''],
    ['Mon nouveau thème', 'carte', '1', 'Que signifie EPON ?', '', '', '', '', '', '', '', 'Exercice, Pesée, Observance, Nutrition', ''],
  ];
  const cell = v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  return [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
}

function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

function normalizeQuestion(raw, warnings, i) {
  const q = { ...raw };
  q.type = TYPES[String(q.type || 'qcm').toLowerCase()] || 'qcm';
  q.id = q.id || uid('u');
  q.niveau = Math.min(3, Math.max(1, parseInt(q.niveau, 10) || 1));
  if (!q.question) { warnings.push(`Élément ${i + 1} ignoré : question vide.`); return null; }
  if (q.type === 'carte') { if (!q.reponse) { warnings.push(`Carte ${i + 1} ignorée : verso vide.`); return null; } return q; }
  if (q.type === 'vf') { q.choix = ['Vrai', 'Faux']; }
  if (q.type === 'cas') {
    if (!Array.isArray(q.etapes) || !q.etapes.length) { warnings.push(`Cas ${i + 1} ignoré : pas d'étapes.`); return null; }
    q.etapes = q.etapes.filter(e => e && e.question && Array.isArray(e.choix) && Array.isArray(e.bonnes) && e.bonnes.length);
    if (!q.etapes.length) { warnings.push(`Cas ${i + 1} ignoré : étapes invalides.`); return null; }
    return q;
  }
  if (!Array.isArray(q.choix) || q.choix.length < 2) { warnings.push(`Question ${i + 1} ignorée : moins de 2 réponses.`); return null; }
  if (!Array.isArray(q.bonnes) || !q.bonnes.length || q.bonnes.some(b => b < 0 || b >= q.choix.length)) { warnings.push(`Question ${i + 1} ignorée : bonnes réponses invalides.`); return null; }
  return q;
}

export function parseImport(text, filename, store) {
  const warnings = []; const themes = []; const questions = [];
  const known = () => [...store.themes, ...themes];
  const themeFor = (val) => {
    if (!val) return store.themes[0]?.id;
    const v = String(val).trim();
    const t = known().find(t => t.id === v || t.nom.toLowerCase() === v.toLowerCase());
    if (t) return t.id;
    const nt = { id: slug(v), nom: v, couleur: '#' + ((Math.random() * 0x777777 + 0x333333) | 0).toString(16) };
    themes.push(nt); return nt.id;
  };
  try {
    if (/\.csv$/i.test(filename) || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
      const rows = parseCSV(text.replace(/^﻿/, ''));
      if (rows.length < 2) return { error: 'CSV vide ou sans en-tête.' };
      const head = rows[0].map(h => h.trim().toLowerCase());
      const col = n => head.indexOf(n);
      rows.slice(1).forEach((r, i) => {
        const g = n => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
        const choix = head.map((h, k) => /^choix\d+$/.test(h) ? (r[k] || '').trim() : null).filter(c => c);
        const raw = { theme: themeFor(g('theme')), type: g('type'), niveau: g('niveau'), question: g('question'), choix,
          bonnes: g('bonnes').split(/[,\s/]+/).filter(Boolean).map(x => parseInt(x, 10) - 1),
          explication: g('explication'), reponse: g('reponse'), source: g('source') };
        if ((TYPES[raw.type.toLowerCase()] || 'qcm') === 'vf') {
          const b = g('bonnes').toLowerCase(); raw.bonnes = [b.startsWith('f') || b === '2' ? 1 : 0];
        }
        const q = normalizeQuestion(raw, warnings, i); if (q) questions.push(q);
      });
      return { questions, themes, warnings };
    }
    const data = JSON.parse(text);
    if (data && data.format === 'tsq-backup') {
      (data.customThemes || []).forEach(t => { if (!known().some(k => k.id === t.id)) themes.push(t); });
      return { questions: [], themes, warnings, backup: data.state };
    }
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list)) return { error: 'Aucune liste « questions » trouvée.' };
    (data.themes || []).forEach(t => { if (t && t.id && t.nom && !known().some(k => k.id === t.id)) themes.push(t); });
    list.forEach((raw, i) => {
      const q = normalizeQuestion({ ...raw, theme: raw.theme && known().some(t => t.id === raw.theme) ? raw.theme : themeFor(raw.theme) }, warnings, i);
      if (q) questions.push(q);
    });
    return { questions, themes, warnings };
  } catch (e) {
    return { error: 'Lecture impossible : ' + e.message };
  }
}
