-- =====================================================================
--  ArchivÉo Ecosystem — Schéma complet de la base de données
--  Projet National de Développement Agricole (PNDA) — RDC
--
--  Reconstruit à partir du code source (src/services/*, src/pages/*)
--  après la suppression du projet Supabase d'origine.
--
--  Compatible : PostgreSQL 14+ (Supabase self-hosted, Neon, CockroachDB,
--  Aiven, Postgres local…). Aucune dépendance à une extension Supabase.
--
--  Ordre d'exécution : ce fichier est idempotent, il peut être rejoué.
-- =====================================================================

begin;

-- Génération d'UUID. pgcrypto est présent sur Supabase, Neon et Aiven.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Fonction utilitaire : met à jour updated_at à chaque UPDATE
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
--  1. RÉFÉRENTIELS
-- =====================================================================

-- Catégories de classement (Nature du document) --------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#64748B',   -- couleur du badge dans Archives
  created_at  timestamptz not null default now()
);

-- Regroupements de services (optgroup des formulaires) -------------------
create table if not exists service_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- Services / directions émetteurs ---------------------------------------
create table if not exists services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  group_id    uuid references service_groups (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint services_name_group_unique unique (name, group_id)
);

create index if not exists idx_services_group_id on services (group_id);

-- =====================================================================
--  2. TABLE CENTRALE : DOCUMENTS ARCHIVÉS
-- =====================================================================

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),

  -- Identification
  name          text not null,
  doc_type      text,                       -- type détecté (Contrat, Rapport, Facture…)
  subject       text,                       -- objet du courrier
  sender        text,                       -- expéditeur
  doc_date      date,                       -- date portée sur le document

  -- Classement
  category_id   uuid references categories (id) on delete set null,
  service_id    uuid references services   (id) on delete set null,

  -- Rattachement organisationnel (isolation UPE)
  province      text not null default 'Kinshasa'
                check (province in ('Kinshasa', 'Kwilu', 'Kasaï', 'Kasaï Central')),

  -- Origine et état
  source        text not null default 'upload'
                check (source in ('scan', 'upload', 'import_backup')),
  status        text not null default 'archived',

  -- Fichier
  file_url      text,                       -- URL publique dans le bucket "documents"
  size_kb       integer not null default 0 check (size_kb >= 0),
  page_count    integer not null default 1 check (page_count >= 0),
  content_text  text,                       -- texte extrait (OCR / PDF) pour la recherche

  -- Enrichissement IA
  ai_summary    text,
  ai_tags       text[] not null default '{}',
  ai_confidence numeric(5,2) check (ai_confidence is null
                                    or (ai_confidence >= 0 and ai_confidence <= 100)),

  -- Corbeille (suppression douce)
  deleted_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index alignés sur les requêtes réelles de documentsService.js
create index if not exists idx_documents_created_at  on documents (created_at desc);
create index if not exists idx_documents_deleted_at  on documents (deleted_at);
create index if not exists idx_documents_province    on documents (province);
create index if not exists idx_documents_category_id on documents (category_id);
create index if not exists idx_documents_service_id  on documents (service_id);
create index if not exists idx_documents_doc_date    on documents (doc_date);

-- Liste par défaut : documents actifs, les plus récents d'abord
create index if not exists idx_documents_actifs
  on documents (province, created_at desc)
  where deleted_at is null;

-- Recherche plein texte insensible à la casse sur name / sender / subject
-- (le code utilise .ilike %terme% : trigram est ce qui accélère réellement)
create extension if not exists "pg_trgm";
create index if not exists idx_documents_name_trgm    on documents using gin (name    gin_trgm_ops);
create index if not exists idx_documents_sender_trgm  on documents using gin (sender  gin_trgm_ops);
create index if not exists idx_documents_subject_trgm on documents using gin (subject gin_trgm_ops);

drop trigger if exists trg_documents_updated_at on documents;
create trigger trg_documents_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- =====================================================================
--  3. JOURNAL D'ACTIVITÉ (traçabilité S&E)
-- =====================================================================

create table if not exists activity_log (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid references documents (id) on delete cascade,
  action       text not null
               check (action in ('scan', 'upload', 'ai_summary', 'print', 'print_batch',
                                 'reclassify', 'share', 'share_batch',
                                 'trash', 'trash_batch', 'restore', 'restore_batch',
                                 'delete_permanent', 'delete_permanent_batch')),
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_activity_log_created_at  on activity_log (created_at desc);
create index if not exists idx_activity_log_action      on activity_log (action, created_at desc);
create index if not exists idx_activity_log_document_id on activity_log (document_id);

-- =====================================================================
--  4. FILE D'IMPRESSION + VÉRIFICATION COMPTABLE
-- =====================================================================

create table if not exists print_queue (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents (id) on delete cascade,
  pages        integer not null default 1 check (pages > 0),
  status       text not null default 'En attente'
               check (status in ('En attente', 'En cours', 'Imprimé', 'Erreur', 'Annulé')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_print_queue_created_at  on print_queue (created_at);
create index if not exists idx_print_queue_document_id on print_queue (document_id);

-- Éléments de frais rattachés à un travail d'impression
-- (écran « Avis sur justificatifs provision »)
create table if not exists frais (
  id          uuid primary key default gen_random_uuid(),
  queue_id    uuid not null references print_queue (id) on delete cascade,
  label       text not null,
  montant     numeric(14,2) not null default 0,   -- en FC ou $ (jamais de float)
  selected    boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_frais_queue_id on frais (queue_id, created_at);

-- =====================================================================
--  5. PARTAGE INTER-UPE
-- =====================================================================

create table if not exists shares (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents (id) on delete cascade,
  shared_with   text not null,                 -- email ou nom de l'UPE destinataire
  access_level  text not null default 'Lecture'
                check (access_level in ('Lecture', 'Écriture', 'Complet')),
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_shares_created_at  on shares (created_at desc);
create index if not exists idx_shares_document_id on shares (document_id);

-- =====================================================================
--  6. ASSISTANT IA (ChatBot documentaire)
-- =====================================================================

create table if not exists chat_conversations (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default 'Nouvelle discussion',
  document_id  uuid references documents (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_chat_conversations_updated_at on chat_conversations (updated_at desc);

create table if not exists chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references chat_conversations (id) on delete cascade,
  document_id      uuid references documents (id) on delete set null,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation on chat_messages (conversation_id, created_at);

commit;
