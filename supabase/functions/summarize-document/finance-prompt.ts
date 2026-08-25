// =====================================================================
//  ArchivÉo — Extraction structurée des liasses financières
//
//  RÈGLE ABSOLUE : le modèle ne calcule JAMAIS. Il recopie les montants
//  exactement tels qu'ils sont imprimés, sous forme de chaîne. Toute
//  vérification arithmétique est faite par le programme
//  (src/services/financeChecksService.js), jamais par l'IA.
// =====================================================================

export const FINANCE_PIECE_TYPES = [
  "ecriture_comptable",
  "cheque",
  "grille_controle",
  "etat_beneficiaires",
] as const;

export const FINANCE_PROMPT = `
Ce document est une LIASSE FINANCIÈRE du PNDA. Ajoute au JSON une clé "fields"
décrivant sa structure interne, sans jamais découper le fichier.

RÈGLES IMPÉRATIVES
1. Ne calcule rien. Aucune addition, aucune multiplication, aucune conversion.
2. Recopie chaque montant EXACTEMENT tel qu'imprimé, en chaîne de caractères,
   virgule et espaces compris : "4 200,00" et non 4200 ni 4200.00.
3. Une valeur absente, illisible ou barrée vaut null. N'invente jamais une
   valeur plausible : un champ laissé vide est une information utile.
4. Indique pour chaque pièce les numéros de page (1 = première page du PDF).
5. Les dates sont au format YYYY-MM-DD.

STRUCTURE DE "fields"
{
  "nature": "finance",
  "objet": string,                     // ex. "Forfait frais soins médicaux — juin 2026"
  "periode": string|null,              // "YYYY-MM" de la période couverte
  "montant_total_texte": string|null,  // montant de référence de la liasse
  "devise": "USD"|"CDF"|null,
  "beneficiaire_paiement": string|null,
  "mode_paiement": "cheque"|"virement"|"especes"|"op"|null,
  "pieces": [ … ]                      // une entrée par pièce reconnue
}

TYPES DE PIÈCES ATTENDUS DANS UNE LIASSE DE PAIEMENT
- "ecriture_comptable" : pages, n_piece, journal, site, date_comptable,
  date_saisie, saisi_par, total_debit_texte, total_credit_texte,
  imputations[{compte, sous_activite, rubrique, financement, province,
  libelle, sens:"debit"|"credit", montant_texte}], signataires[]
- "cheque" : pages, numero, banque, montant_texte, montant_en_lettres,
  date_emission, lieu_emission, beneficiaire, compte_emetteur,
  piece_identite_jointe (bool), identite_porteur
- "grille_controle" : pages, date_conception, n_facture, devise,
  montant_texte, montant_approuve_texte, mode_paiement, beneficiaire,
  champs_vides[] (libellés préimprimés laissés vides),
  visas{technique, financier, titre_paiement, responsable_technique,
  comptable, raf, coordonnateur_signe, coordonnateur_nom, coordonnateur_date}
  — chaque visa vaut true, false ou "NA",
  etat_decaissement_renseigne (bool)
- "etat_beneficiaires" : pages, intitule, effectif (nombre de lignes comptées),
  montant_unitaire_texte, montant_total_texte, date_etablissement, lieu,
  lignes_sans_signature[] (numéros de ligne sans signature manuscrite)

Si une pièce présente dans le document ne correspond à aucun de ces types,
utilise "autre" et renseigne au moins pages, intitule et montant_texte.
Ne crée pas d'entrée pour une pièce que tu ne vois pas : son absence sera
détectée par le programme.
`.trim();
