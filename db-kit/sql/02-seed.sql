-- =====================================================================
--  ArchivÉo Ecosystem — Données de référence (catégories & services)
--
--  ⚠️  Les référentiels d'origine ont disparu avec le projet Supabase
--      supprimé. Cette liste est une proposition cohérente avec le PNDA :
--      ajustez-la depuis l'écran Paramètres, ou modifiez ce fichier avant
--      de l'exécuter.
--
--  Idempotent : peut être rejoué sans créer de doublons.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  Catégories de classement (couleurs = badges dans Archives)
-- ---------------------------------------------------------------------
insert into categories (name, color) values
  ('Contrat',                  '#D91B5C'),
  ('Marché public',            '#92278F'),
  ('Rapport d''activité',      '#008B8B'),
  ('Rapport de mission',       '#0EA5E9'),
  ('Fiche de suivi',           '#7AC143'),
  ('Données de terrain',       '#22C55E'),
  ('Facture',                  '#F5A623'),
  ('Bon de commande',          '#F26522'),
  ('Ordre de mission',         '#EAB308'),
  ('Courrier entrant',         '#3B82F6'),
  ('Courrier sortant',         '#6366F1'),
  ('Procès-verbal',            '#A855F7'),
  ('Termes de référence',      '#14B8A6'),
  ('Convention',               '#EC4899'),
  ('État de paie',             '#84CC16'),
  ('Pièce justificative',      '#F97316'),
  ('Document administratif',   '#64748B')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
--  Regroupements de services
-- ---------------------------------------------------------------------
insert into service_groups (name) values
  ('Coordination Nationale'),
  ('Unités Provinciales d''Exécution'),
  ('Directions techniques'),
  ('Partenaires & Bailleurs')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
--  Services rattachés
-- ---------------------------------------------------------------------
insert into services (name, group_id)
select v.name, g.id
from (values
  ('Coordination Nationale',            'Coordination Nationale'),
  ('Suivi & Évaluation',                'Coordination Nationale'),
  ('Administration & Finances',         'Coordination Nationale'),
  ('Passation des marchés',             'Coordination Nationale'),
  ('Sauvegardes environnementales',     'Coordination Nationale'),
  ('Communication',                     'Coordination Nationale'),

  ('UPE Kwilu',                         'Unités Provinciales d''Exécution'),
  ('UPE Kasaï',                         'Unités Provinciales d''Exécution'),
  ('UPE Kasaï Central',                 'Unités Provinciales d''Exécution'),

  ('Production végétale',               'Directions techniques'),
  ('Production animale',                'Directions techniques'),
  ('Infrastructures rurales',           'Directions techniques'),
  ('Appui aux organisations paysannes', 'Directions techniques'),

  ('Banque Mondiale',                   'Partenaires & Bailleurs'),
  ('Ministère de l''Agriculture',       'Partenaires & Bailleurs')
) as v(name, group_name)
join service_groups g on g.name = v.group_name
on conflict (name, group_id) do nothing;

commit;
