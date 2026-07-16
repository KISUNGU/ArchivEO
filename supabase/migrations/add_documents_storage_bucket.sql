-- À exécuter une seule fois dans le SQL Editor de Supabase (Studio).
-- Crée le bucket de stockage "documents" (fichiers scannés/importés : PDF, JPG, PNG...)
-- et autorise l'app (clé anon, pas d'auth Supabase dans ce projet) à y lire/écrire,
-- cohérent avec le reste du modèle de sécurité actuel (RLS non utilisée sur les tables).

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Lecture publique (nécessaire pour afficher/imprimer les fichiers depuis Archives)
drop policy if exists "Documents publicly readable" on storage.objects;
create policy "Documents publicly readable"
on storage.objects for select
to public
using (bucket_id = 'documents');

-- Écriture depuis l'app (anon) pour l'import et le scan direct
drop policy if exists "Documents insertable by anon" on storage.objects;
create policy "Documents insertable by anon"
on storage.objects for insert
to public
with check (bucket_id = 'documents');

drop policy if exists "Documents updatable by anon" on storage.objects;
create policy "Documents updatable by anon"
on storage.objects for update
to public
using (bucket_id = 'documents');

drop policy if exists "Documents deletable by anon" on storage.objects;
create policy "Documents deletable by anon"
on storage.objects for delete
to public
using (bucket_id = 'documents');
