-- =====================================================================
--  ArchivÉo — Droits d'accès API + bucket de stockage
--  À exécuter APRÈS 01-schema.sql et 02-seed.sql.
--
--  Spécifique à une installation Supabase (self-hosted ou cloud) :
--  ce fichier ouvre l'API PostgREST au rôle `anon`, car ArchivÉo
--  n'utilise pas Supabase Auth (les comptes UPE sont gérés côté
--  application dans SessionContext.jsx).
--
--  ⚠️  Sur un Postgres nu (Neon, Aiven, CockroachDB…) ce fichier ne
--      fait rien : les rôles anon/authenticated/service_role n'existent
--      pas. C'est normal, il se termine sans erreur.
--
--  ⚠️  SÉCURITÉ — à lire : voir la section « Modèle de sécurité »
--      du fichier INSTALLATION.md. La clé anon donne un accès complet
--      aux tables. C'est le modèle actuel du projet, pas une cible.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1. Droits API (PostgREST) — seulement si les rôles Supabase existent
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'Rôles Supabase absents : Postgres nu détecté, droits API ignorés.';
    return;
  end if;

  grant usage on schema public to anon, authenticated, service_role;

  grant all on all tables    in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant all on all functions in schema public to anon, authenticated, service_role;

  -- Les tables créées plus tard héritent des mêmes droits
  alter default privileges in schema public
    grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;

  raise notice 'Droits API accordés à anon / authenticated / service_role.';
end
$$;

-- ---------------------------------------------------------------------
--  2. Bucket de stockage « documents » (PDF, JPG, PNG scannés/importés)
--     Reprend supabase/migrations/add_documents_storage_bucket.sql
-- ---------------------------------------------------------------------
do $$
declare
  pol record;
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Schéma storage absent : bucket et politiques ignorés (Postgres nu).';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', true)
  on conflict (id) do update set public = true;

  -- Politiques d'accès au bucket, rejouables.
  -- CREATE POLICY n'accepte pas IF NOT EXISTS : on nettoie puis on recrée.
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'Documents %'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;

  execute $p$create policy "Documents publicly readable"
             on storage.objects for select to public
             using (bucket_id = 'documents')$p$;

  execute $p$create policy "Documents insertable by anon"
             on storage.objects for insert to public
             with check (bucket_id = 'documents')$p$;

  execute $p$create policy "Documents updatable by anon"
             on storage.objects for update to public
             using (bucket_id = 'documents')$p$;

  execute $p$create policy "Documents deletable by anon"
             on storage.objects for delete to public
             using (bucket_id = 'documents')$p$;

  raise notice 'Bucket « documents » prêt (public) et politiques appliquées.';
end
$$;

commit;

-- ---------------------------------------------------------------------
--  3. Recharge le cache de schéma de PostgREST
--     (sans ça, l'API renvoie « relation does not exist » pendant ~10 min)
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
