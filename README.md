# Télésurveillance Quiz

Application web installable (PWA) pour réviser la télésurveillance cardiaque et rénale, le parcours insuffisance cardiaque, PRADO, le PRS Grand Est, les CPTS/MSP/DAC.

- **Dossiers** : ensembles de questions prêts à l'emploi (IC, IR, télésurveillance, textes & réglementation, chiffres clés, Grand Est, Moselle, CPTS Cœur de Moselle, urgences par CPTS…) et dossiers personnels créés à partir de vos filtres
- **Filtres croisés** : pathologie (IC, IR, diabète, cardiovasculaire, organisation des soins) × territoire (France > région > département > CPTS) × type de contenu (chiffres clés, textes & réglementation, clinique, traitements, parcours, éducation du patient)
- **Quiz sur un sujet** : tapez « CPTS Cœur de Moselle », « mortalité », « NT-proBNP »… ou choisissez un document importé : l'application rassemble toutes les questions qui en parlent
- **6 autres modes** : quiz libre, révision espacée (méthode Leitner), contre la montre, points faibles, cartes recto/verso, cas cliniques pas à pas
- **Bibliothèque** : recherche, ajout, modification, suppression de questions ; import JSON ou CSV (Excel) ; export
- **Progression** : maîtrise par thème, historique des scores, série de jours
- **Synchronisation** entre ordinateur, téléphone et tablette via un Gist privé de votre compte GitHub
- **Fonctionne hors ligne** une fois installée

---

## 1. Mettre l'application en ligne (une seule fois, ~10 min)

1. Connectez-vous sur **github.com** → bouton **+** en haut à droite → **New repository**.
2. Nom : `telesurveillance-quiz` · cochez **Public** (obligatoire pour GitHub Pages gratuit ; seules les questions sont visibles, jamais votre progression) → **Create repository**.
3. Sur la page du dépôt vide, cliquez sur **uploading an existing file**.
4. Décompressez le fichier zip sur votre ordinateur, ouvrez le dossier `telesurveillance-quiz`, sélectionnez **tout son contenu** (fichiers et dossiers `css`, `js`, `data`, `icons`…) et glissez-le dans la page GitHub. → **Commit changes**.
5. Dans le dépôt : **Settings → Pages** → *Source* : **Deploy from a branch** → Branche **main**, dossier **/ (root)** → **Save**.
6. Patientez 1 à 2 minutes : l'adresse s'affiche en haut de la page Pages, du type
   `https://VOTRE-PSEUDO.github.io/telesurveillance-quiz/`

## 2. Installer sur vos appareils

- **iPhone / iPad** (Safari) : ouvrez l'adresse → bouton Partager → **Sur l'écran d'accueil**.
- **Android** (Chrome) : menu ⋮ → **Installer l'application** / Ajouter à l'écran d'accueil.
- **Ordinateur** (Chrome / Edge) : icône d'installation à droite de la barre d'adresse.

## 3. Activer la synchronisation de la progression

Dans l'application : **Réglages → Synchronisation**. Créez un jeton GitHub (lien direct fourni dans l'app) avec uniquement la case **gist** cochée, collez-le, **Connecter**. Répétez sur chaque appareil (même jeton possible). La progression, vos questions et vos ressources sont fusionnées automatiquement à l'ouverture et après chaque session.

## 4. Enrichir l'application

**Option A – depuis l'application (le plus simple)**
- *Questions → + Nouvelle question* : QCM, Vrai/Faux, carte, cas clinique à étapes.
- *Questions → Importer* : un fichier `.json` (préparé par Claude) ou `.csv` (Excel, modèle téléchargeable via *Exporter → Modèle CSV*).
- *Ressources* : ajoutez vos liens (HAS, ameli, Légifrance, ARS…).
Tout ce qui est ajouté ainsi est synchronisé sur vos appareils.

**Option B – avec Claude**
Astuce : ajoutez des mots-clés dans un champ `"tags": ["…"]` pour qu'une question ressorte dans le quiz sur un sujet.

Envoyez à Claude vos nouveaux PDF, Word ou liens en demandant :
> « Génère de nouvelles questions au format JSON de mon application Télésurveillance Quiz à partir de ces documents (QCM, vrai/faux, cartes et un cas clinique), avec explication et source. »

Importez ensuite le fichier reçu via *Questions → Importer*.

**Option C – mettre à jour la banque initiale**
Remplacez `data/questions.json` dans le dépôt GitHub (*Add file → Upload files*). Les appareils récupèrent la nouvelle version à la prochaine ouverture.

## Format d'une question (JSON)

```json
{
  "id": "u-ma-question-1",
  "theme": "prado",
  "type": "qcm",
  "question": "Dans quel délai a lieu la 1re consultation chez le médecin traitant ?",
  "choix": ["48 h", "7 jours", "1 mois"],
  "bonnes": [1],
  "explication": "…",
  "source": "prado",
  "niveau": 1
}
```
- `type` : `qcm` · `vf` (choix `["Vrai","Faux"]`) · `carte` (champ `reponse` au lieu de `choix`) · `cas` (champs `contexte` + `etapes` : liste de `{question, choix, bonnes, explication}`)
- `bonnes` : positions des bonnes réponses, en commençant à 0 (plusieurs possibles)
- `niveau` : 1 facile, 2 moyen, 3 expert
- facultatif : `patho` (`["IC"]`, `["IR"]`, `["Transversal"]`…), `nature` (`chiffres`, `reglementation`, `clinique`, `traitement`, `parcours`, `education`), `zone` (`{"region": "Grand Est", "dept": "Moselle", "cpts": "Cœur de Moselle"}`), `tags`

---
*Outil personnel de formation. Les contenus proviennent des documents cités en source et ne remplacent pas les recommandations officielles en vigueur.*
