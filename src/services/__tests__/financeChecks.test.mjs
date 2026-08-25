import { parseMontantToCents, formatCents, normalizeFinanceFields, runFinanceChecks, compterParSeverite }
  from '../financeChecksService.js';

let ko = 0;
const eq = (label, a, b) => { const ok = a === b; if (!ok) ko++; console.log(`${ok?'ok  ':'KO  '}${label}: ${a} ${ok?'=':'≠'} ${b}`); };

console.log('--- parseMontantToCents ---');
eq('4 200,00',   parseMontantToCents('4 200,00'), 420000);
eq('4,200.00',   parseMontantToCents('4,200.00'), 420000);
eq('150,00',     parseMontantToCents('150,00'), 15000);
eq('4200',       parseMontantToCents('4200'), 420000);
eq('USD 150,00', parseMontantToCents('USD 150,00'), 15000);
eq('2 100,00',   parseMontantToCents('2 100,00'), 210000);
eq('1.234.567,89', parseMontantToCents('1.234.567,89'), 123456789);
eq('vide',       parseMontantToCents(''), null);
eq('null',       parseMontantToCents(null), null);
eq('nbsp',       parseMontantToCents('4 200,00'), 420000);
eq('format',     formatCents(420000, 'USD'), '4 200,00 USD');

console.log('\n--- liasse réelle BQ0416 (juin 2026) ---');
const brut = {
  nature: 'finance',
  objet: 'Forfait frais soins médicaux UNCP/PNDA — juin 2026',
  periode: '2026-06',
  montant_total_texte: '4 200,00',
  devise: 'USD',
  beneficiaire_paiement: 'LOKULI ITONGA Loïc',
  mode_paiement: 'cheque',
  pieces: [
    { type: 'ecriture_comptable', pages: [1], n_piece: 'BQ0416', journal: 'BQ01', site: '01',
      date_comptable: '2026-06-05', date_saisie: '2026-06-11', saisi_par: 'TSHIENDA',
      total_debit_texte: '4 200,00', total_credit_texte: '4 200,00',
      imputations: [
        { compte: '661500', sous_activite: 'C20160', rubrique: '906', financement: '02 - 1', province: '01',
          libelle: 'Indemnités de maladies versées aux travailleurs', sens: 'debit', montant_texte: '2 100,00' },
        { compte: '661500', sous_activite: 'C20160', rubrique: '906', financement: '03 - 1', province: '01',
          libelle: 'Indemnités de maladies versées aux travailleurs', sens: 'debit', montant_texte: '2 100,00' },
        { compte: '521110', libelle: 'LOKULI, chq 3955 Indemnités s.méd versées 06/26',
          sens: 'credit', montant_texte: '4 200,00' },
      ],
      signataires: ['Macaire TSHIALA', 'Benjamin TSHIENDA'] },
    { type: 'cheque', pages: [2], numero: '9513955', banque: 'TMB', montant_texte: '4 200,00',
      montant_en_lettres: 'Quatre mille deux cent Dollars américains', date_emission: '2026-06-01',
      lieu_emission: 'Kinshasa', beneficiaire: 'LOKULI ITONGA',
      compte_emetteur: '00017-11000-50472332101-47', piece_identite_jointe: true,
      identite_porteur: 'LOKULI ITONGA Loïc — permis CD0419880' },
    { type: 'grille_controle', pages: [3], date_conception: '2026-06-01', n_facture: null, devise: 'USD',
      montant_texte: '4 200,00', montant_approuve_texte: '4 200,00', mode_paiement: 'cheque',
      beneficiaire: 'LOKULI ITONGA',
      champs_vides: ['N° facture', 'Catégorie', 'Composante', 'Libellé', 'N° contrat ou BC', 'Date clôture'],
      visas: { technique: 'NA', financier: true, titre_paiement: true, responsable_technique: false,
               comptable: true, raf: true, coordonnateur_signe: true,
               coordonnateur_nom: false, coordonnateur_date: false },
      etat_decaissement_renseigne: false },
    { type: 'etat_beneficiaires', pages: [4],
      intitule: 'FORFAIT FRAIS SOINS MEDICAUX UNCP /PNDA MOIS DE JUIN 2026',
      effectif: 28, montant_unitaire_texte: '150,00', montant_total_texte: '4 200,00',
      date_etablissement: '2026-06-01', lieu: 'Kinshasa', lignes_sans_signature: [] },
  ],
};

const fields = normalizeFinanceFields(brut);
eq('montant_total en centimes', fields.montant_total, 420000);
eq('unitaire état', fields.pieces[3].montant_unitaire_cents, 15000);

const anomalies = runFinanceChecks(fields, { confidence: 0.92, analysePartielle: false });
console.log(`\n${anomalies.length} anomalie(s) — ${JSON.stringify(compterParSeverite(anomalies))}\n`);
for (const a of anomalies) console.log(`[${a.severity.toUpperCase().padEnd(7)}] ${a.code}\n            ${a.message}`);

console.log('\n--- cas dégradé : total faussé + une signature manquante ---');
const faux = JSON.parse(JSON.stringify(brut));
faux.pieces[3].montant_total_texte = '4 350,00';
faux.pieces[3].lignes_sans_signature = [7, 19];
const a2 = runFinanceChecks(normalizeFinanceFields(faux), { confidence: 0.9 });
for (const a of a2.filter((x) => ['ETAT_TOTAL_INCOHERENT','MONTANT_DIVERGENT','SIGNATURES_MANQUANTES'].includes(x.code)))
  console.log(`[${a.severity.toUpperCase().padEnd(7)}] ${a.code}\n            ${a.message}`);

console.log(ko === 0 ? '\n✅ tous les asserts passent' : `\n❌ ${ko} assert(s) en échec`);
process.exit(ko === 0 ? 0 : 1);
