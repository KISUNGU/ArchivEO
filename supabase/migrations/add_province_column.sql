-- À exécuter une seule fois dans le SQL Editor de Supabase (Studio).
-- Ajoute la colonne "province" manquante sur la table documents et
-- rattrape les documents existants (créés avant la correction du bug
-- qui empêchait l'enregistrement de la province).

ALTER TABLE documents ADD COLUMN IF NOT EXISTS province text;

-- Rattrapage des documents déjà archivés sans province : à ajuster
-- si vous savez que certains documents appartiennent à une autre
-- province (Kwilu / Kasaï / Kasaï Central).
UPDATE documents SET province = 'Kinshasa' WHERE province IS NULL;

-- Index pour accélérer les filtres par province.
CREATE INDEX IF NOT EXISTS idx_documents_province ON documents (province);
