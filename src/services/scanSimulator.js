// Simule l'acquisition d'un document via un scanner physique.
// Aucun matériel réel n'est piloté ici (un navigateur ne peut pas parler nativement
// au pilote TWAIN/WIA d'un scanner) : ce module génère un contenu de document plausible
// pour permettre de tester l'intégralité du workflow (aperçu -> analyse IA -> archivage).
// Point de branchement futur : remplacer generateScannedDocument() par un appel à un
// service local (agent WIA/TWAIN) qui retourne la vraie image + le vrai texte OCR.

const COMPANIES = ['Kivu Solutions Sarl', 'Congo Digital Services', 'Tshopo Ingénierie', 'Ubuntu Consulting', 'Mongala Systèmes'];
const DEPARTMENTS = ['Direction des Systèmes d\'Information', 'Direction Administrative et Financière', 'Direction des Ressources Humaines', 'Direction Générale'];
const SERVICES = ['développement logiciel', 'maintenance informatique', 'archivage électronique', 'conseil en organisation'];
const SUBJECTS = ['Mise à jour de la politique d\'archivage', 'Fermeture exceptionnelle des bureaux', 'Nouvelle procédure de numérisation', 'Rappel des consignes de sécurité'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pad = (n, len) => String(n).padStart(len, '0');

function randomDate2026() {
  const month = randInt(1, 7); // aujourd'hui = juillet 2026
  const day = randInt(1, 28);
  return `${pad(day, 2)}/${pad(month, 2)}/2026`;
}

const TEMPLATES = {
  Facture: () => {
    const ref = `FA-2026-${randInt(100, 999)}`;
    const qty1 = randInt(1, 3);
    const pu1 = randInt(150, 500);
    const pu2 = randInt(80, 300);
    const totalHT = qty1 * pu1 + pu2;
    const tva = Math.round(totalHT * 0.16 * 100) / 100;
    const ttc = Math.round((totalHT + tva) * 100) / 100;
    return {
      docType: 'Facture',
      fileName: `Facture_${ref}.pdf`,
      contentText: `FACTURE N° ${ref}
Date d'émission : ${randomDate2026()}
Fournisseur : ${pick(COMPANIES)}
Client : Direction Générale
Objet : Prestation de services informatiques

Désignation                     Qté   PU (USD)   Total (USD)
Maintenance serveur              ${qty1}     ${pu1}.00      ${qty1 * pu1}.00
Support technique mensuel        1     ${pu2}.00      ${pu2}.00

Total HT : ${totalHT}.00 USD
TVA (16%) : ${tva} USD
Total TTC à payer : ${ttc} USD

Échéance de paiement : ${randomDate2026()}
Merci de bien vouloir régler cette facture avant la date d'échéance indiquée.`,
    };
  },
  Contrat: () => {
    const ref = `CT-2026-${randInt(100, 999)}`;
    const duree = randInt(6, 36);
    return {
      docType: 'Contrat',
      fileName: `Contrat_${ref}.pdf`,
      contentText: `CONTRAT DE PRESTATION DE SERVICES N° ${ref}

Entre les soussignés :
La société ${pick(COMPANIES)}, ci-après dénommée "le Prestataire"
Et
${pick(DEPARTMENTS)}, ci-après dénommée "le Client"

Article 1 - Objet du contrat
Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire assurera au profit du Client des prestations de ${pick(SERVICES)}.

Article 2 - Durée
Le présent contrat est conclu pour une durée de ${duree} mois à compter du ${randomDate2026()}.

Article 3 - Résiliation
Chaque partie peut résilier le présent contrat moyennant un préavis écrit de 30 jours.

Fait à Kinshasa, le ${randomDate2026()}`,
    };
  },
  Rapport: () => {
    const n = randInt(40, 300);
    const pct = randInt(-10, 25);
    return {
      docType: 'Rapport',
      fileName: `Rapport_Activite_${randInt(100, 999)}.pdf`,
      contentText: `RAPPORT D'ACTIVITÉ - ${pick(MONTHS)} 2026
Direction : ${pick(DEPARTMENTS)}

Synthèse
Au cours de la période sous revue, le service a traité ${n} dossiers, soit une progression de ${pct}% par rapport au mois précédent.

Points clés
- Volume de documents archivés : ${randInt(200, 900)}
- Taux de satisfaction usager : ${randInt(70, 98)}%
- Incidents signalés : ${randInt(0, 6)}

Conclusion
Les indicateurs sont globalement positifs. Il est recommandé de renforcer la formation du personnel sur les nouveaux outils numériques.`,
    };
  },
  'Procès-verbal': () => {
    return {
      docType: 'Procès-verbal',
      fileName: `PV_Reunion_${randInt(100, 999)}.pdf`,
      contentText: `PROCÈS-VERBAL DE RÉUNION
Date : ${randomDate2026()}
Lieu : Salle de conférence
Présents : ${randInt(4, 15)} participants
Absents excusés : ${randInt(0, 3)}

Ordre du jour :
1. Adoption du procès-verbal précédent
2. Point sur l'avancement du projet d'archivage électronique
3. Questions diverses

Décisions prises :
- Validation du budget alloué au projet
- Désignation d'un responsable de suivi

La séance est levée à ${randInt(10, 18)}h${pad(randInt(0, 59), 2)}.`,
    };
  },
  'Note de service': () => {
    const ref = `NS-2026-${randInt(10, 99)}`;
    return {
      docType: 'Note de service',
      fileName: `Note_Service_${ref}.pdf`,
      contentText: `NOTE DE SERVICE N° ${ref}
Objet : ${pick(SUBJECTS)}
À l'attention de : L'ensemble du personnel

Il est porté à la connaissance de tous que la procédure ci-dessus entre en vigueur à compter du ${randomDate2026()}. Chaque responsable de service est chargé d'en assurer la diffusion auprès de ses équipes.

Cette note prend effet immédiatement.

La Direction`,
    };
  },
};

export function generateScannedDocument() {
  const types = Object.keys(TEMPLATES);
  const type = pick(types);
  const generated = TEMPLATES[type]();
  return {
    ...generated,
    pageCount: randInt(1, 4),
    sizeKb: randInt(80, 2400),
  };
}

export function generateFakePagePreview(docType) {
  const lineCount = randInt(9, 14);
  const lines = Array.from({ length: lineCount }, (_, i) => {
    const width = i === 0 ? 60 : randInt(35, 92);
    const y = 34 + i * 9;
    return `<rect x="8" y="${y}" width="${width}" height="3.2" rx="1.2" fill="#94a3b8" opacity="${i === 0 ? 0.9 : 0.45}" />`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">
    <rect x="0" y="0" width="100" height="140" fill="#f8fafc" />
    <rect x="0" y="0" width="100" height="140" fill="none" stroke="#cbd5e1" stroke-width="0.6" />
    <rect x="8" y="10" width="34" height="6" rx="1" fill="#334155" />
    <text x="92" y="14" font-size="4" text-anchor="end" fill="#64748b" font-family="sans-serif">${docType}</text>
    ${lines}
    <circle cx="82" cy="120" r="10" fill="none" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="1.5,1" />
    <text x="82" y="121" font-size="2.6" text-anchor="middle" fill="#94a3b8" font-family="sans-serif">SCAN</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
