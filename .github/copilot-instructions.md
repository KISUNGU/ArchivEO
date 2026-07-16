# Instructions Globales — ArchivEO Ecosystem

## Contexte du projet

**ArchivÉo Ecosystem** est un logiciel professionnel d'archivage électronique développé pour le **Projet National de Développement Agricole (PNDA)** de la République Démocratique du Congo ([pnda.cd](https://pnda.cd)).

- **Maître d'ouvrage** : Gouvernement de la RDC — Ministère de l'Agriculture
- **Bailleur de fonds** : Banque Mondiale
- **Objectif** : Numériser, centraliser et gérer tous les dossiers physiques et documents du projet PNDA (rapports, contrats, fiches de suivi, données de terrain, etc.)

### Architecture organisationnelle

| Entité | Rôle | Localisation |
|---|---|---|
| **Coordination Nationale** | Base de données centrale, administration | Kinshasa |
| **UPE Kwilu** | Unité Provinciale d'Exécution — scan & archivage local | Province du Kwilu |
| **UPE Kasaï** | Unité Provinciale d'Exécution — scan & archivage local | Province du Kasaï |
| **UPE Kasaï Central** | Unité Provinciale d'Exécution — scan & archivage local | Province du Kasaï Central |

Chaque UPE dispose d'une **session propre** avec des **identifiants utilisateur distincts**. Les scans effectués en provinces sont remontés vers la base centrale de Kinshasa.

## Développeur / Product Owner

- **Rôle** : Assistant en Suivi & Évaluation (S&E) + Expert en Base de Données
- **Localisation** : Kinshasa, RDC
- **Préférences techniques** : Solutions robustes, scalables, sans over-engineering ; code lisible et maintenable ; interfaces modernes avec effets visuels soignés

## Stack technique

| Technologie | Version | Usage |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Bundler / dev server |
| Tailwind CSS | **v4** | Styling (utiliser `@import "tailwindcss"` dans index.css, plugin PostCSS : `@tailwindcss/postcss`) |
| Framer Motion | 10 | Animations et transitions |
| Lucide React | 0.294 | Icônes |
| Supabase | — | Backend : authentification, base de données PostgreSQL, stockage fichiers |

### Points d'attention Tailwind v4
- **Ne jamais** utiliser `@tailwind base/components/utilities` — utiliser `@import "tailwindcss"`
- Plugin PostCSS : `'@tailwindcss/postcss'` (pas `tailwindcss` directement)
- La config `tailwind.config.js` reste supportée pour les extensions de thème

## Architecture du code

```
src/
  components/
    Accueil.jsx       ← Dashboard rosace + layout global (header/sidebar/footer)
  pages/
    ScanDirect.jsx    ← Module de scan via scanner physique
    Impression.jsx    ← Module d'impression de documents archivés
    Importation.jsx   ← Module d'acquisition / import de documents
    Archives.jsx      ← Module de consultation de la base archivée
    Statistiques.jsx  ← Module de tableaux de bord & indicateurs S&E
    Partage.jsx       ← Module de partage inter-UPE
  index.css           ← @import "tailwindcss" + styles globaux
  App.jsx             ← Point d'entrée React
supabaseClient.js     ← Client Supabase configuré
```

## Philosophie de design

Le logiciel doit **refléter un travail professionnel de haut niveau**. L'interface est le premier vecteur de crédibilité auprès des bailleurs (Banque Mondiale) et des partenaires gouvernementaux.

### Principes visuels obligatoires
- **Glassmorphisme** : `backdrop-blur`, `bg-white/[0.03]`, `border border-white/10` — transparences multicouches
- **Gradients profonds** : fond `from-slate-900 via-slate-800 to-indigo-950`, jamais de blanc pur ni de gris plat
- **Effets morphiques** : blobs animés en arrière-plan (`animate-pulse`, `blur-3xl`)
- **Transitions fluides** : toujours via Framer Motion (`spring`, `stiffness`, `damping`) — pas de transitions CSS brutales
- **Micro-interactions** : `whileHover`, `whileTap`, `scale`, `filter: blur()` sur les entrées/sorties de page
- **Éclats et reflets** : `shadow-[0_0_50px_...]`, `drop-shadow`, anneaux lumineux sur les éléments actifs

### Palette de couleurs des modules
| Module | Couleur |
|---|---|
| Scan Direct | `#D91B5C` (rose vif) |
| Impression | `#92278F` (violet) |
| Importation | `#008B8B` (teal) |
| Archives | `#7AC143` (vert) |
| Statistiques | `#F5A623` (ambre) |
| Partage | `#F26522` (orange) |

## Règles de développement

1. **Langue de l'interface** : Français (RDC) — textes, labels, messages d'erreur, placeholders
2. **Monnaie** : utiliser `FC` ou `$` (jamais `FCFA`)
3. **Sessions & auth** : chaque utilisateur a un identifiant, un rôle et une UPE d'appartenance (Kinshasa, Kwilu, Kasaï, Kasaï Central)
4. **Sécurité** : toujours valider côté serveur (Supabase RLS) — ne jamais exposer de clés en clair dans le code
5. **Performance** : lazy loading des pages, pas de re-renders inutiles
6. **Responsive** : optimisé desktop d'abord (usage en bureau d'archivage), mais doit rester lisible sur tablette

## Ce qu'il ne faut PAS faire

- Ne pas régresser vers Tailwind v3 (le projet tourne sur v4)
- Ne pas supprimer les animations Framer Motion — elles sont fondamentales pour l'identité du logiciel
- Ne pas simplifier le design au prétexte de "lisibilité" — la richesse visuelle est une exigence métier
- Ne pas hardcoder des données utilisateur — utiliser Supabase Auth
- Ne pas créer de fichiers de documentation Markdown sauf demande explicite
