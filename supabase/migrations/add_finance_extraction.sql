-- =====================================================================
--  ArchivÉo Ecosystem — Extraction structurée des liasses financières
--  Option C : un document = un fichier, dont la structure interne est
--  décrite dans ai_fields (pièces typées + plages de pages).
--
--  Les montants sont stockés en CENTIMES (bigint) — jamais de float
--  ni de numeric flottant sur de l'argent public.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Champs métier extraits par l'IA
-- ---------------------------------------------------------------------
alter table documents
  add column if not exists ai_fields jsonb not null default '{}'::jsonb;

comment on column documents.ai_fields is
  'Champs métier extraits par l''IA. Pour la nature « finance » : objet, '
  'periode, montant_total (centimes), devise, pieces[] (type, pages, montant…).';

-- Recherche par nature (finance, rh, marche…) et par contenu du JSON
create index if not exists documents_nature_idx
  on documents ((ai_fields ->> 'nature'));

create index if not exists documents_ai_fields_gin
  on documents using gin (ai_fields jsonb_path_ops);

-- ---------------------------------------------------------------------
-- 2. Anomalies détectées sur un document
-- ---------------------------------------------------------------------
create table if not exists document_anomalies (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents (id) on delete cascade,

  code            text not null,          -- ex. MONTANTS_DIVERGENTS
  severity        text not null
                    check (severity in ('majeure', 'moyenne', 'mineure')),
  message         text not null,          -- libellé affiché à l'archiviste
  piece_type      text,                   -- pièce concernée, si applicable
  page            integer check (page is null or page >= 1),
  details         jsonb not null default '{}'::jsonb,

  -- Levée d'anomalie : l'archiviste justifie plutôt qu'il ne supprime
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users (id) on delete set null,
  resolution_note text,

  created_at      timestamptz not null default now()
);

comment on table document_anomalies is
  'Manquements et incohérences détectés sur une liasse. Une anomalie ne se '
  'supprime pas : elle se lève avec une justification tracée.';

-- Une même anomalie ne doit pas être insérée deux fois lors d''une réanalyse
create unique index if not exists document_anomalies_uniq
  on document_anomalies (document_id, code, coalesce(piece_type, ''));

create index if not exists document_anomalies_doc_idx
  on document_anomalies (document_id);

create index if not exists document_anomalies_ouvertes_idx
  on document_anomalies (severity) where resolved_at is null;

-- ---------------------------------------------------------------------
-- 3. Sécurité — mêmes règles que documents (isolation par UPE)
-- ---------------------------------------------------------------------
alter table document_anomalies enable row level security;

drop policy if exists anomalies_select on document_anomalies;
drop policy if exists anomalies_insert on document_anomalies;
drop policy if exists anomalies_update on document_anomalies;
drop policy if exists anomalies_delete on document_anomalies;

create policy anomalies_select on document_anomalies
  for select to authenticated using (true);

create policy anomalies_insert on document_anomalies
  for insert to authenticated with check (
    exists (
      select 1 from documents d
      where d.id = document_id
        and (is_admin_scope() or d.province = jwt_province())
    )
  );

create policy anomalies_update on document_anomalies
  for update to authenticated using (
    exists (
      select 1 from documents d
      where d.id = document_id
        and (is_admin_scope() or d.province = jwt_province())
    )
  );

create policy anomalies_delete on document_anomalies
  for delete to authenticated using (
    jwt_access_level() <> 'user'
    and exists (
      select 1 from documents d
      where d.id = document_id
        and (is_admin_scope() or d.province = jwt_province())
    )
  );

-- ---------------------------------------------------------------------
-- 4. Vue de pilotage S&E — alimente le module Statistiques
-- ---------------------------------------------------------------------
create or replace view v_finance_liasses
  with (security_invoker = true) as
select
  d.id,
  d.name,
  d.province,
  d.doc_date,
  d.created_at,
  d.ai_fields ->> 'objet'                                   as objet,
  d.ai_fields ->> 'periode'                                 as periode,
  nullif(d.ai_fields ->> 'montant_total', '')::bigint       as montant_total_cents,
  coalesce(d.ai_fields ->> 'devise', 'USD')                 as devise,
  jsonb_array_length(coalesce(d.ai_fields -> 'pieces', '[]'::jsonb)) as nb_pieces,
  coalesce(a.total, 0)                                      as nb_anomalies,
  coalesce(a.majeures, 0)                                   as nb_anomalies_majeures,
  (coalesce(a.majeures, 0) = 0)                             as conforme
from documents d
left join lateral (
  select
    count(*)                                        as total,
    count(*) filter (where severity = 'majeure')    as majeures
  from document_anomalies x
  where x.document_id = d.id and x.resolved_at is null
) a on true
where d.ai_fields ->> 'nature' = 'finance'
  and d.deleted_at is null;

comment on view v_finance_liasses is
  'Une ligne par liasse financière archivée, avec son état de conformité. '
  'security_invoker : la vue respecte les politiques RLS de l''appelant.';
