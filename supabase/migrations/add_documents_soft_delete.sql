-- À exécuter une seule fois dans le SQL Editor de Supabase (Studio).
-- Ajoute la suppression douce (corbeille) sur la table documents :
-- un document "supprimé" n'est que marqué (deleted_at rempli) au lieu
-- d'être retiré définitivement de la base. Il peut être restauré, ou
-- supprimé définitivement depuis la corbeille.

alter table documents add column if not exists deleted_at timestamptz;

create index if not exists idx_documents_deleted_at on documents (deleted_at);
