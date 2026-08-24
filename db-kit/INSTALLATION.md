# ArchivÉo Ecosystem — Remise en service de la base de données

Projet National de Développement Agricole (PNDA) — République Démocratique du Congo

---

## Ce qui s'est passé

Le projet Supabase d'origine (`aathevgbzraeptngqwok`, référencé dans votre `.env.local`)
n'existe plus dans votre compte. Les autres projets sont en pause et Supabase refuse
d'en réactiver un : **l'offre gratuite plafonne à 2 projets actifs**, et vous en avez
déjà deux (`suivi-mission` et `assurancepay`).

Conséquence : le schéma et les données de l'ancienne base ne sont pas récupérables
depuis Supabase. Le schéma livré ici a été **reconstruit à partir de votre code
source** — les 12 fichiers de `src/services/` et les pages qui les appellent.

---

## Ce que contient le kit

| Fichier | Rôle |
|---|---|
| `sql/01-schema.sql` | Les 10 tables, index, contraintes et déclencheurs |
| `sql/02-seed.sql` | Catégories et services de référence (ajustables) |
| `sql/03-supabase-grants.sql` | Droits API + bucket de stockage `documents` |
| `supabase.env` | Clés JWT et mots de passe générés pour votre installation |
| `env-local-archiveo.txt` | Contenu à copier dans le `.env.local` de l'application |
| `install-windows.ps1` | Installation automatique (Windows + Docker Desktop) |
| `install-linux.sh` | Installation automatique (VPS Linux) |

---

## Le schéma reconstruit

10 tables, dérivées des requêtes réellement effectuées par l'application :

```
categories ──┐
             ├──< documents >──┬──< activity_log
services ────┤                 ├──< print_queue ──< frais
   │         │                 ├──< shares
service_groups                 └──< chat_conversations ──< chat_messages
```

**`documents`** est la table centrale : identification (`name`, `doc_type`, `sender`,
`subject`, `doc_date`), classement (`category_id`, `service_id`), rattachement UPE
(`province`, contrainte sur Kinshasa / Kwilu / Kasaï / Kasaï Central), fichier
(`file_url`, `size_kb`, `page_count`, `content_text`), enrichissement IA
(`ai_summary`, `ai_tags`, `ai_confidence`) et corbeille (`deleted_at`).

Points vérifiés sur un PostgreSQL 16 réel avant livraison : les jointures
`categories(name, color)` / `services(name)`, la recherche `ilike` sur
nom/expéditeur/objet, le filtrage par province, le cycle corbeille → restauration,
la suppression en cascade des messages du chat, le calcul des totaux de frais,
et le déclencheur `updated_at`.

Deux détails ajoutés par rapport à l'ancienne base :

- **`pg_trgm` + index GIN** sur `name`, `sender`, `subject`. Vos recherches utilisent
  `ilike %terme%`, que Postgres ne peut pas accélérer avec un index classique. Sur
  quelques centaines de documents la différence est invisible ; sur les dizaines de
  milliers que vise le PNDA, elle est déterminante.
- **Index partiel** `idx_documents_actifs` sur `(province, created_at desc)` filtré
  `where deleted_at is null` — exactement la requête de la page Archives.

---

## Installation

### Option A — Sur le poste ou le serveur du bureau d'archivage (recommandé)

C'est l'option qui correspond le mieux à un bureau d'archivage : les scans restent
sur le disque local, aucune limite de volume, aucune mise en pause, et le logiciel
fonctionne même quand la connexion Internet est coupée.

1. Installez **Docker Desktop** : https://www.docker.com/products/docker-desktop/
2. Ouvrez PowerShell dans le dossier du kit et lancez :

   ```powershell
   .\install-windows.ps1
   ```

3. Le script clone la pile Supabase officielle, la configure avec vos clés,
   démarre les conteneurs et crée le schéma. Comptez 5 à 15 minutes au premier
   lancement (téléchargement des images).
4. Copiez le contenu de `env-local-archiveo.txt` dans
   `C:\Projets\electronic-archiving\.env.local`.
5. `npm run dev`

### Option B — Sur un VPS (Oracle Cloud Always Free, 200 Go)

Nécessaire si les UPE de Kwilu, Kasaï et Kasaï Central doivent atteindre la base
depuis les provinces.

```bash
bash install-linux.sh
```

Puis, dans `.env.local`, remplacez `localhost` par l'adresse IP du serveur.

⚠️ Sur Oracle Cloud, ouvrir le port 8000 se fait à **deux** endroits : le pare-feu
de la machine (`iptables` / `firewalld`) **et** la Security List du réseau virtuel.
Oublier le second est la cause la plus fréquente de « ça ne se connecte pas ».

### Option C — Base seule sur un hébergeur managé (Neon, Aiven, CockroachDB)

`01-schema.sql` et `02-seed.sql` fonctionnent tels quels sur n'importe quel
PostgreSQL. `03-supabase-grants.sql` se termine sans rien faire (il détecte
l'absence des rôles Supabase).

**Mais** : ces services fournissent uniquement la base. Ils n'ont ni l'API REST
que `supabase-js` interroge, ni le stockage de fichiers, ni les fonctions Edge.
Choisir cette voie implique de réécrire les 12 fichiers de `src/services/` et de
trouver une autre solution pour les scans. C'est plusieurs jours de travail —
à ne considérer que si l'auto-hébergement est écarté.

---

## Après l'installation

Studio (administration de la base) : http://localhost:8000
— utilisateur `supabase`, mot de passe dans `supabase.env`.

Vérifiez dans l'ordre :

1. La page **Archives** se charge sans erreur (base accessible).
2. Une **importation** de PDF réussit (base + stockage).
3. La **corbeille** puis la restauration fonctionnent (`deleted_at`).
4. La **file d'impression** et la vérification comptable (`print_queue` + `frais`).

---

## Deux points qui demandent votre décision

### 1. Les fonctions IA ne sont pas récupérables

`src/services/aiAgentService.js` appelle deux fonctions Edge —
`summarize-document` et `chat-with-document` — qui étaient déployées sur l'ancien
projet Supabase et **ne figurent pas dans le dépôt**. Elles sont donc perdues.

Sans elles : le résumé automatique et le ChatBot documentaire échouent. Le reste
de l'application (scan, import, archivage, impression, partage, statistiques)
fonctionne normalement.

Je peux les réécrire — il faut me dire quelle clé d'API IA vous utilisez et si
elle est toujours valide.

### 2. Le modèle de sécurité

Vos propres consignes projet demandent de « toujours valider côté serveur
(Supabase RLS) ». Ce n'est pas ce que fait l'application aujourd'hui, et le kit
reproduit fidèlement l'existant pour ne rien casser :

- les comptes UPE sont dans `SessionContext.jsx`, avec **mots de passe en clair
  dans le code source** (`admin123`, `kwilu123`…) et stockés en `localStorage` ;
- l'isolation par province est appliquée **côté navigateur** — un utilisateur qui
  ouvre la console peut lire les documents de toutes les provinces ;
- la clé anon donne un accès complet en lecture et écriture à toutes les tables.

Pour un projet financé par la Banque Mondiale et destiné à des données de terrain
gouvernementales, c'est un écart à combler. La correction consiste à basculer sur
Supabase Auth avec la province portée par le JWT, puis à activer RLS sur
`documents` avec une politique `province = auth.jwt() ->> 'province'`.

Ce n'est pas un petit changement : il touche l'authentification, les 12 services
et la gestion des comptes dans Paramètres. À planifier comme un chantier à part —
dites-moi si vous voulez que je le prépare.
