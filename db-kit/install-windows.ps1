# =====================================================================
#  ArchivEo Ecosystem - Installation de la base de donnees auto-hebergee
#  Supabase self-hosted (Docker) - Windows / PowerShell
#
#  Projet National de Developpement Agricole (PNDA) - RDC
#
#  Usage (PowerShell, depuis le dossier du kit) :
#      .\install-windows.ps1
#
#  Prerequis : Docker Desktop installe et demarre.
# =====================================================================

$ErrorActionPreference = 'Stop'
$KitDir   = $PSScriptRoot
$StackDir = Join-Path $KitDir 'supabase-stack'

function Etape($n, $texte) {
  Write-Host ""
  Write-Host "==> [$n] $texte" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------
Etape 1 "Verification des prerequis"

try { docker version --format '{{.Server.Version}}' | Out-Null }
catch {
  Write-Host "Docker n'est pas accessible." -ForegroundColor Red
  Write-Host "Installez Docker Desktop (https://www.docker.com/products/docker-desktop/)"
  Write-Host "puis demarrez-le et relancez ce script."
  exit 1
}
Write-Host "    Docker OK"

try { git --version | Out-Null } catch {
  Write-Host "Git n'est pas installe. Installez-le : https://git-scm.com/download/win" -ForegroundColor Red
  exit 1
}
Write-Host "    Git OK"

# ---------------------------------------------------------------------
Etape 2 "Recuperation de la pile Supabase officielle"

if (Test-Path $StackDir) {
  Write-Host "    Deja present, on reutilise : $StackDir"
} else {
  $Tmp = Join-Path $env:TEMP "supabase-clone-$(Get-Random)"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase $Tmp
  Push-Location $Tmp
  git sparse-checkout set docker
  Pop-Location
  New-Item -ItemType Directory -Force -Path $StackDir | Out-Null
  Copy-Item -Recurse -Force "$Tmp\docker\*" $StackDir
  Remove-Item -Recurse -Force $Tmp
  Write-Host "    Pile copiee dans $StackDir"
}

# ---------------------------------------------------------------------
Etape 3 "Configuration (.env)"

$EnvSource = Join-Path $KitDir 'supabase.env'
$EnvTarget = Join-Path $StackDir '.env'

if (-not (Test-Path $EnvSource)) {
  Write-Host "Fichier supabase.env introuvable dans le kit." -ForegroundColor Red
  exit 1
}
Copy-Item -Force $EnvSource $EnvTarget
Write-Host "    .env installe (cles JWT deja generees dans le kit)"

# Le dossier volumes/ doit exister avant le demarrage
New-Item -ItemType Directory -Force -Path (Join-Path $StackDir 'volumes\db\data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $StackDir 'volumes\storage')  | Out-Null

# ---------------------------------------------------------------------
Etape 4 "Demarrage des conteneurs (premier lancement : ~5 a 15 min)"

Push-Location $StackDir
docker compose pull
docker compose up -d
Pop-Location

Write-Host "    Attente de la base de donnees..."
$Pret = $false
foreach ($i in 1..60) {
  Start-Sleep -Seconds 5
  $out = docker exec supabase-db pg_isready -U postgres 2>$null
  if ($LASTEXITCODE -eq 0) { $Pret = $true; break }
  Write-Host "      ... ($($i*5)s)"
}
if (-not $Pret) {
  Write-Host "La base ne repond pas apres 5 minutes." -ForegroundColor Red
  Write-Host "Diagnostic : docker compose -f `"$StackDir\docker-compose.yml`" logs db"
  exit 1
}
Write-Host "    Base de donnees prete"

# Laisse le service storage terminer ses migrations (cree le schema storage)
Write-Host "    Attente des migrations du service storage (30s)..."
Start-Sleep -Seconds 30

# ---------------------------------------------------------------------
Etape 5 "Creation du schema ArchivEo"

# On copie les fichiers dans le conteneur plutot que de les envoyer par le pipe :
# PowerShell reencode le flux stdin et corromprait les accents (Kasai -> Kasa??),
# ce qui ferait echouer la contrainte CHECK sur documents.province.
$Fichiers = @('01-schema.sql', '02-seed.sql', '03-supabase-grants.sql')
foreach ($f in $Fichiers) {
  $chemin = Join-Path $KitDir "sql\$f"
  Write-Host "    -> $f"
  docker cp $chemin "supabase-db:/tmp/$f"
  if ($LASTEXITCODE -ne 0) { Write-Host "Copie de $f impossible" -ForegroundColor Red; exit 1 }
  docker exec supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/$f"
  if ($LASTEXITCODE -ne 0) { Write-Host "Echec sur $f" -ForegroundColor Red; exit 1 }
  docker exec supabase-db rm -f "/tmp/$f" | Out-Null
}

# ---------------------------------------------------------------------
Etape 6 "Verification"

$nb = docker exec supabase-db psql -U postgres -d postgres -tAc `
  "select count(*) from information_schema.tables where table_schema='public' and table_name in ('documents','categories','services','service_groups','activity_log','print_queue','frais','shares','chat_conversations','chat_messages');"
Write-Host "    Tables ArchivEo presentes : $nb / 10"

if ($nb.Trim() -ne '10') {
  Write-Host "Schema incomplet." -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " Installation terminee" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Studio (administration) : http://localhost:8000"
Write-Host "   utilisateur : supabase"
Write-Host "   mot de passe : voir DASHBOARD_PASSWORD dans supabase.env"
Write-Host ""
Write-Host " Copiez maintenant le fichier env-local-archiveo.txt du kit vers"
Write-Host " le fichier .env.local de l'application, puis relancez :"
Write-Host ""
Write-Host "     npm run dev"
Write-Host ""
