// =====================================================================
//  ArchivÉo — Contrôles arithmétiques et de complétude des liasses
//
//  L'IA extrait, ce fichier vérifie. Aucun calcul n'est délégué au
//  modèle : il recopie les montants tels qu'imprimés, et c'est ici
//  qu'ils sont convertis en centimes puis rapprochés entre eux.
//
//  Tous les montants manipulés ici sont des ENTIERS de centimes.
// =====================================================================

/** Pièces qui doivent composer une liasse de paiement complète. */
export const PIECES_ATTENDUES = {
  ecriture_comptable: 'Écriture comptable',
  cheque: 'Chèque',
  grille_controle: 'Grille de contrôle interne',
  etat_beneficiaires: 'État des bénéficiaires',
};

export const SEVERITES = ['majeure', 'moyenne', 'mineure'];

/** Nombre de jours au-delà duquel le délai de saisie comptable est signalé. */
const DELAI_SAISIE_MAX_JOURS = 7;

// ---------------------------------------------------------------------
//  Conversion des montants
// ---------------------------------------------------------------------

/**
 * Convertit un montant imprimé en centimes.
 * Gère « 4 200,00 », « 4,200.00 », « 4200 », « USD 150,00 ».
 * Renvoie null si la chaîne ne contient aucun chiffre exploitable.
 */
export function parseMontantToCents(texte) {
  if (texte === null || texte === undefined) return null;
  if (typeof texte === 'number' && Number.isFinite(texte)) return Math.round(texte * 100);

  // Espaces fines, insécables et séparateurs typographiques
  const brut = String(texte).replace(/[\s   ']/g, '');
  const nettoye = brut.replace(/[^0-9,.-]/g, '');
  if (!/\d/.test(nettoye)) return null;

  const negatif = /^-/.test(nettoye) || /\(\s*\d/.test(String(texte));
  const chiffres = nettoye.replace(/-/g, '');

  const dernierePointe = chiffres.lastIndexOf('.');
  const derniereVirgule = chiffres.lastIndexOf(',');
  let separateur = -1;
  if (dernierePointe >= 0 && derniereVirgule >= 0) {
    // Le séparateur décimal est le dernier des deux
    separateur = Math.max(dernierePointe, derniereVirgule);
  } else if (dernierePointe >= 0 || derniereVirgule >= 0) {
    const pos = Math.max(dernierePointe, derniereVirgule);
    const decimales = chiffres.length - pos - 1;
    // 1 ou 2 décimales → séparateur décimal ; 3 → séparateur de milliers
    separateur = decimales === 1 || decimales === 2 ? pos : -1;
  }

  let entiers;
  let decimales;
  if (separateur >= 0) {
    entiers = chiffres.slice(0, separateur).replace(/[.,]/g, '');
    decimales = chiffres.slice(separateur + 1).replace(/[.,]/g, '');
  } else {
    entiers = chiffres.replace(/[.,]/g, '');
    decimales = '';
  }

  const centimes = Number(entiers || '0') * 100 + Number((decimales + '00').slice(0, 2));
  if (!Number.isFinite(centimes)) return null;
  return negatif ? -centimes : centimes;
}

/** Formate des centimes pour l'affichage : 420000 → « 4 200,00 ». */
export function formatCents(cents, devise = '') {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—';
  const signe = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const entiers = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const dec = String(abs % 100).padStart(2, '0');
  return `${signe}${entiers},${dec}${devise ? ` ${devise}` : ''}`;
}

const joursEntre = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2 - d1) / 86400000);
};

// ---------------------------------------------------------------------
//  Normalisation : ajoute les montants en centimes à côté des textes
// ---------------------------------------------------------------------

const CLES_MONTANT = [
  'montant', 'montant_total', 'montant_unitaire', 'montant_approuve',
  'total_debit', 'total_credit',
];

function normaliserPiece(piece) {
  const sortie = { ...piece };
  for (const cle of CLES_MONTANT) {
    const texte = piece[`${cle}_texte`];
    if (texte !== undefined) sortie[`${cle}_cents`] = parseMontantToCents(texte);
  }
  if (Array.isArray(piece.imputations)) {
    sortie.imputations = piece.imputations.map((imp) => ({
      ...imp,
      montant_cents: parseMontantToCents(imp.montant_texte),
    }));
  }
  return sortie;
}

/**
 * Transforme la sortie brute de l'IA en ai_fields prêt pour la base :
 * montants convertis en centimes, pièces normalisées.
 */
export function normalizeFinanceFields(fields) {
  if (!fields || typeof fields !== 'object') return null;
  const pieces = Array.isArray(fields.pieces) ? fields.pieces.map(normaliserPiece) : [];
  return {
    ...fields,
    nature: 'finance',
    devise: fields.devise || 'USD',
    montant_total: parseMontantToCents(fields.montant_total_texte),
    pieces,
  };
}

// ---------------------------------------------------------------------
//  Contrôles
// ---------------------------------------------------------------------

const anomalie = (code, severity, message, extra = {}) => ({
  code, severity, message,
  piece_type: extra.piece_type ?? null,
  page: extra.page ?? null,
  details: extra.details ?? {},
});

const premierePage = (piece) => (Array.isArray(piece?.pages) && piece.pages.length ? piece.pages[0] : null);

/**
 * Exécute tous les contrôles sur une liasse normalisée.
 * @param {object} fields   sortie de normalizeFinanceFields
 * @param {object} contexte { analysePartielle, confidence, pageCount }
 * @returns {Array} anomalies prêtes à insérer dans document_anomalies
 */
export function runFinanceChecks(fields, contexte = {}) {
  const out = [];
  if (!fields) return out;

  const devise = fields.devise || 'USD';
  const pieces = Array.isArray(fields.pieces) ? fields.pieces : [];
  const parType = (type) => pieces.find((p) => p.type === type) || null;

  const ecriture = parType('ecriture_comptable');
  const cheque = parType('cheque');
  const grille = parType('grille_controle');
  const etat = parType('etat_beneficiaires');

  // --- Analyse incomplète -------------------------------------------
  if (contexte.analysePartielle) {
    out.push(anomalie(
      'LIASSE_TRONQUEE', 'majeure',
      `Seules les ${contexte.pagesAnalysees || 8} premières pages ont été analysées : `
      + `les contrôles ne portent pas sur l'intégralité de la liasse.`,
    ));
  }

  // --- Pièces attendues absentes -------------------------------------
  const absences = {
    ecriture_comptable: 'moyenne',
    cheque: 'majeure',
    grille_controle: 'majeure',
    etat_beneficiaires: 'majeure',
  };
  for (const [type, severite] of Object.entries(absences)) {
    // Le chèque n'est attendu que si le paiement se fait par chèque
    if (type === 'cheque' && fields.mode_paiement && fields.mode_paiement !== 'cheque') continue;
    if (!parType(type)) {
      out.push(anomalie(
        `PIECE_MANQUANTE_${type.toUpperCase()}`, severite,
        `Pièce absente de la liasse : ${PIECES_ATTENDUES[type]}.`,
        { piece_type: type },
      ));
    }
  }

  // --- Rapprochement des montants entre pièces ------------------------
  const reference = fields.montant_total
    ?? etat?.montant_total_cents
    ?? cheque?.montant_cents
    ?? null;

  if (reference !== null) {
    const aComparer = [
      ['etat_beneficiaires', etat?.montant_total_cents, etat],
      ['cheque', cheque?.montant_cents, cheque],
      ['grille_controle', grille?.montant_approuve_cents ?? grille?.montant_cents, grille],
      ['ecriture_comptable', ecriture?.total_debit_cents, ecriture],
    ];
    const ecarts = aComparer
      .filter(([, valeur]) => valeur !== null && valeur !== undefined)
      .filter(([, valeur]) => valeur !== reference);

    for (const [type, valeur, piece] of ecarts) {
      out.push(anomalie(
        'MONTANT_DIVERGENT', 'majeure',
        `Le montant de la pièce « ${PIECES_ATTENDUES[type] || type} » (${formatCents(valeur, devise)}) `
        + `diffère du montant de référence de la liasse (${formatCents(reference, devise)}).`,
        {
          piece_type: type,
          page: premierePage(piece),
          details: { attendu_cents: reference, trouve_cents: valeur },
        },
      ));
    }
  } else {
    out.push(anomalie(
      'MONTANT_REFERENCE_INTROUVABLE', 'majeure',
      'Aucun montant de référence n\'a pu être lu sur la liasse.',
    ));
  }

  // --- État : effectif × unitaire = total -----------------------------
  if (etat) {
    const { effectif, montant_unitaire_cents: unitaire, montant_total_cents: total } = etat;
    if (Number.isFinite(effectif) && Number.isFinite(unitaire) && Number.isFinite(total)) {
      const calcule = effectif * unitaire;
      if (calcule !== total) {
        out.push(anomalie(
          'ETAT_TOTAL_INCOHERENT', 'majeure',
          `Sur l'état des bénéficiaires, ${effectif} × ${formatCents(unitaire)} = ${formatCents(calcule, devise)}, `
          + `alors que le total imprimé est ${formatCents(total, devise)}.`,
          { piece_type: 'etat_beneficiaires', page: premierePage(etat), details: { calcule, total } },
        ));
      }
    }
    const sansSignature = Array.isArray(etat.lignes_sans_signature) ? etat.lignes_sans_signature : [];
    if (sansSignature.length) {
      out.push(anomalie(
        'SIGNATURES_MANQUANTES', 'majeure',
        `${sansSignature.length} ligne(s) de l'état sans signature du bénéficiaire : `
        + `n° ${sansSignature.join(', ')}.`,
        { piece_type: 'etat_beneficiaires', page: premierePage(etat), details: { lignes: sansSignature } },
      ));
    }
  }

  // --- Écriture comptable : débit = crédit ----------------------------
  if (ecriture) {
    const { total_debit_cents: debit, total_credit_cents: credit } = ecriture;
    if (Number.isFinite(debit) && Number.isFinite(credit) && debit !== credit) {
      out.push(anomalie(
        'ECRITURE_DESEQUILIBREE', 'majeure',
        `Écriture déséquilibrée : débit ${formatCents(debit, devise)} contre crédit ${formatCents(credit, devise)}.`,
        { piece_type: 'ecriture_comptable', page: premierePage(ecriture), details: { debit, credit } },
      ));
    }

    const imputations = Array.isArray(ecriture.imputations) ? ecriture.imputations : [];
    const sommeDebit = imputations
      .filter((i) => i.sens === 'debit' && Number.isFinite(i.montant_cents))
      .reduce((acc, i) => acc + i.montant_cents, 0);
    if (imputations.length && Number.isFinite(debit) && sommeDebit !== debit) {
      out.push(anomalie(
        'IMPUTATIONS_INCOHERENTES', 'moyenne',
        `La somme des lignes d'imputation au débit (${formatCents(sommeDebit, devise)}) ne correspond pas `
        + `au total débit de l'écriture (${formatCents(debit, devise)}).`,
        { piece_type: 'ecriture_comptable', page: premierePage(ecriture), details: { sommeDebit, debit } },
      ));
    }

    const delai = joursEntre(ecriture.date_comptable, ecriture.date_saisie);
    if (delai !== null && delai > DELAI_SAISIE_MAX_JOURS) {
      out.push(anomalie(
        'DELAI_SAISIE_LONG', 'mineure',
        `L'écriture a été saisie ${delai} jours après la date comptable `
        + `(seuil : ${DELAI_SAISIE_MAX_JOURS} jours).`,
        { piece_type: 'ecriture_comptable', page: premierePage(ecriture), details: { delai } },
      ));
    }

    // Le numéro de chèque doit se retrouver dans un libellé d'imputation
    if (cheque?.numero) {
      const libelles = imputations.map((i) => String(i.libelle || '')).join(' ');
      const quatreDerniers = String(cheque.numero).slice(-4);
      if (quatreDerniers && !libelles.includes(quatreDerniers)) {
        out.push(anomalie(
          'CHEQUE_NON_REFERENCE', 'mineure',
          `Le numéro de chèque ${cheque.numero} n'apparaît dans aucun libellé de l'écriture comptable.`,
          { piece_type: 'ecriture_comptable', page: premierePage(ecriture) },
        ));
      }
    }
  }

  // --- Grille de contrôle interne -------------------------------------
  if (grille) {
    const visas = grille.visas || {};
    if (visas.coordonnateur_signe && (!visas.coordonnateur_nom || !visas.coordonnateur_date)) {
      out.push(anomalie(
        'VISA_COORDONNATEUR_INCOMPLET', 'moyenne',
        'Approbation du Coordonnateur signée, mais le nom et/ou la date ne sont pas renseignés.',
        { piece_type: 'grille_controle', page: premierePage(grille) },
      ));
    }
    if (visas.responsable_technique === false) {
      out.push(anomalie(
        'VISA_TECHNIQUE_ABSENT', 'moyenne',
        'Aucun avis du Responsable Technique sur la grille de contrôle.',
        { piece_type: 'grille_controle', page: premierePage(grille) },
      ));
    }
    if (grille.etat_decaissement_renseigne === false) {
      out.push(anomalie(
        'ETAT_DECAISSEMENT_VIDE', 'majeure',
        'Section « État de décaissement » non renseignée : la dépense n\'est rattachée '
        + 'à aucun suivi de consommation budgétaire.',
        { piece_type: 'grille_controle', page: premierePage(grille) },
      ));
    }
    const vides = Array.isArray(grille.champs_vides) ? grille.champs_vides : [];
    if (vides.length) {
      out.push(anomalie(
        'CHAMPS_GRILLE_VIDES', 'moyenne',
        `${vides.length} champ(s) de la grille laissés vides : ${vides.join(', ')}.`,
        { piece_type: 'grille_controle', page: premierePage(grille), details: { champs: vides } },
      ));
    }
  }

  // --- Paiement collectif encaissé par une seule personne --------------
  if (cheque && etat && Number.isFinite(etat.effectif) && etat.effectif > 1 && cheque.beneficiaire) {
    out.push(anomalie(
      'BENEFICIAIRE_UNIQUE_POUR_COLLECTIF', 'majeure',
      `Le paiement concerne ${etat.effectif} bénéficiaires mais est encaissé par une seule personne `
      + `(${cheque.beneficiaire}). Joindre le mandat de perception et les décharges individuelles.`,
      { piece_type: 'cheque', page: premierePage(cheque), details: { effectif: etat.effectif } },
    ));
    if (cheque.piece_identite_jointe === false) {
      out.push(anomalie(
        'PIECE_IDENTITE_ABSENTE', 'moyenne',
        'Aucune pièce d\'identité du porteur n\'accompagne le chèque.',
        { piece_type: 'cheque', page: premierePage(cheque) },
      ));
    }
  }

  if (cheque && !cheque.montant_en_lettres) {
    out.push(anomalie(
      'MONTANT_EN_LETTRES_ABSENT', 'mineure',
      'Le montant en toutes lettres n\'a pas pu être lu sur le chèque.',
      { piece_type: 'cheque', page: premierePage(cheque) },
    ));
  }

  // --- Fiabilité de l'extraction ---------------------------------------
  if (Number.isFinite(contexte.confidence) && contexte.confidence < 0.6) {
    out.push(anomalie(
      'EXTRACTION_PEU_FIABLE', 'mineure',
      `Confiance de l'extraction faible (${Math.round(contexte.confidence * 100)} %) : `
      + 'les valeurs demandent une relecture humaine.',
    ));
  }

  return out;
}

/** Compte les anomalies par sévérité — utilisé par les badges et Statistiques. */
export function compterParSeverite(anomalies = []) {
  return anomalies.reduce(
    (acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] || 0) + 1 }),
    { majeure: 0, moyenne: 0, mineure: 0 },
  );
}
