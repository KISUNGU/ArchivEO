#!/usr/bin/env bash
# =====================================================================
#  ArchivÉo Ecosystem — Installation de la base de données auto-hébergée
#  Supabase self-hosted (Docker) — Linux / VPS (Oracle Cloud, OVH…)
#
#  Projet National de Développement Agricole (PNDA) — RDC
#
#  Usage :  bash install-linux.sh
#  Prérequis : docker + docker compose + git
# =====================================================================

set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="$KIT_DIR/supabase-stack"

bleu()  { printf '\n\033[1;36m==> [%s] %s\033[0m\n' "$1" "$2"; }
vert()  { printf '\033[1;32m%s\033[0m\n' "$1"; }
rouge() { printf '\033[1;31m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------
bleu 1 "Vérification des prérequis"

command -v docker >/dev/null || { rouge "Docker absent. Installez-le : curl -fsSL https://get.docker.com | sh"; exit 1; }
docker compose version >/dev/null 2>&1 || { rouge "Plugin 'docker compose' absent."; exit 1; }
command -v git >/dev/null || { rouge "Git absent : sudo apt install -y git"; exit 1; }
docker info >/dev/null 2>&1 || { rouge "Le daemon Docker ne répond pas (essayez : sudo systemctl start docker)."; exit 1; }
echo "    Docker, Compose et Git OK"

# ---------------------------------------------------------------------
bleu 2 "Récupération de la pile Supabase officielle"

if [ -d "$STACK_DIR" ]; then
  echo "    Déjà présent, on réutilise : $STACK_DIR"
else
  TMP="$(mktemp -d)"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase "$TMP"
  git -C "$TMP" sparse-checkout set docker
  mkdir -p "$STACK_DIR"
  cp -a "$TMP/docker/." "$STACK_DIR/"
  rm -rf "$TMP"
  echo "    Pile copiée dans $STACK_DIR"
fi

# ---------------------------------------------------------------------
bleu 3 "Configuration (.env)"

[ -f "$KIT_DIR/supabase.env" ] || { rouge "supabase.env introuvable dans le kit."; exit 1; }
cp -f "$KIT_DIR/supabase.env" "$STACK_DIR/.env"
mkdir -p "$STACK_DIR/volumes/db/data" "$STACK_DIR/volumes/storage"
echo "    .env installé (clés JWT déjà générées dans le kit)"

# ---------------------------------------------------------------------
bleu 4 "Démarrage des conteneurs (premier lancement : ~5 à 15 min)"

( cd "$STACK_DIR" && docker compose pull && docker compose up -d )

echo "    Attente de la base de données..."
PRET=0
for i in $(seq 1 60); do
  sleep 5
  if docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1; then PRET=1; break; fi
  echo "      ... ($((i*5))s)"
done
[ "$PRET" -eq 1 ] || { rouge "La base ne répond pas après 5 minutes."; echo "Diagnostic : docker compose -f $STACK_DIR/docker-compose.yml logs db"; exit 1; }
echo "    Base de données prête"

echo "    Attente des migrations du service storage (30s)..."
sleep 30

# ---------------------------------------------------------------------
bleu 5 "Création du schéma ArchivÉo"

for f in 01-schema.sql 02-seed.sql 03-supabase-grants.sql; do
  echo "    -> $f"
  docker cp "$KIT_DIR/sql/$f" "supabase-db:/tmp/$f"
  docker exec supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/$f"
  docker exec supabase-db rm -f "/tmp/$f"
done

# ---------------------------------------------------------------------
bleu 6 "Vérification"

NB="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "select count(*) from information_schema.tables where table_schema='public' and table_name in ('documents','categories','services','service_groups','activity_log','print_queue','frais','shares','chat_conversations','chat_messages');")"
echo "    Tables ArchivÉo présentes : $NB / 10"
[ "$NB" = "10" ] || { rouge "Schéma incomplet."; exit 1; }

IP="$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo 'IP_DU_SERVEUR')"

# ---------------------------------------------------------------------
echo
vert "====================================================================="
vert " Installation terminée"
vert "====================================================================="
echo
echo " Studio (administration) : http://$IP:8000"
echo "   utilisateur  : supabase"
echo "   mot de passe : voir DASHBOARD_PASSWORD dans supabase.env"
echo
echo " Dans le .env.local de l'application, mettez :"
echo "   VITE_SUPABASE_URL=http://$IP:8000"
echo "   VITE_SUPABASE_ANON_KEY=<ANON_KEY de supabase.env>"
echo
echo " ⚠️  Ouvrez le port 8000 dans le pare-feu du serveur ET dans les"
echo "     règles de sécurité du fournisseur (Oracle Cloud : Security List)."
echo
