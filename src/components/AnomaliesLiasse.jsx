import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown,
  CheckCircle2, RotateCcw, Loader2, FileStack,
} from 'lucide-react';
import { listAnomalies, resolveAnomalie, reopenAnomalie } from '../services/anomaliesService';
import { compterParSeverite, formatCents, PIECES_ATTENDUES } from '../services/financeChecksService';

const STYLES = {
  majeure: {
    libelle: 'Majeure',
    icone: ShieldAlert,
    texte: 'text-rose-600 dark:text-rose-400',
    fond: 'bg-rose-500/10 border-rose-500/30',
    halo: 'shadow-[0_0_25px_-8px_rgba(244,63,94,0.6)]',
  },
  moyenne: {
    libelle: 'Moyenne',
    icone: AlertTriangle,
    texte: 'text-amber-600 dark:text-amber-400',
    fond: 'bg-amber-500/10 border-amber-500/30',
    halo: 'shadow-[0_0_25px_-8px_rgba(245,158,11,0.5)]',
  },
  mineure: {
    libelle: 'Mineure',
    icone: Info,
    texte: 'text-sky-600 dark:text-sky-400',
    fond: 'bg-sky-500/10 border-sky-500/30',
    halo: '',
  },
};

const ressort = { type: 'spring', stiffness: 320, damping: 30 };

/** Pastille compacte de conformité — utilisable dans une liste de documents. */
export function BadgeConformite({ compteurs, className = '' }) {
  if (!compteurs || !compteurs.total) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 ${className}`}>
        <ShieldCheck className="h-3 w-3" /> Conforme
      </span>
    );
  }
  const grave = compteurs.majeure > 0;
  const style = grave ? STYLES.majeure : STYLES.moyenne;
  const Icone = style.icone;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.fond} ${style.texte} ${className}`}>
      <Icone className="h-3 w-3" />
      {compteurs.total} anomalie{compteurs.total > 1 ? 's' : ''}
      {grave ? ` · ${compteurs.majeure} majeure${compteurs.majeure > 1 ? 's' : ''}` : ''}
    </span>
  );
}

/** Récapitulatif des pièces reconnues dans la liasse. */
function PiecesLiasse({ fields }) {
  const pieces = Array.isArray(fields?.pieces) ? fields.pieces : [];
  if (!pieces.length) return null;
  const devise = fields?.devise || 'USD';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
        <FileStack className="h-3.5 w-3.5 text-teal-500" />
        {pieces.length} pièce{pieces.length > 1 ? 's' : ''} reconnue{pieces.length > 1 ? 's' : ''}
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {pieces.map((p, i) => {
          const montant = p.montant_cents ?? p.montant_total_cents ?? p.total_debit_cents ?? p.montant_approuve_cents;
          return (
            <div key={`${p.type}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 dark:bg-slate-900/40 px-2.5 py-1.5">
              <span className="truncate text-[11px] text-slate-700 dark:text-slate-300">
                {PIECES_ATTENDUES[p.type] || p.intitule || p.type}
                {Array.isArray(p.pages) && p.pages.length ? (
                  <span className="text-slate-400"> · p. {p.pages.join(', ')}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-slate-900 dark:text-white">
                {Number.isFinite(montant) ? formatCents(montant, devise) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Panneau des anomalies d'une liasse.
 * - mode « avant archivage » : passer `anomalies` (non persistées, lecture seule)
 * - mode « document archivé » : passer `documentId` (chargement + levée possible)
 */
export default function AnomaliesLiasse({
  documentId = null,
  anomalies: anomaliesProp = null,
  fields = null,
  userId = null,
  compact = false,
  onChange = null,
}) {
  const [anomalies, setAnomalies] = useState(anomaliesProp ?? []);
  const [chargement, setChargement] = useState(Boolean(documentId));
  const [ouvert, setOuvert] = useState(!compact);
  const [enCours, setEnCours] = useState(null);
  const [saisieId, setSaisieId] = useState(null);
  const [note, setNote] = useState('');

  const persiste = Boolean(documentId);

  useEffect(() => {
    if (!persiste) {
      setAnomalies(anomaliesProp ?? []);
      return;
    }
    let vivant = true;
    setChargement(true);
    listAnomalies(documentId)
      .then((data) => { if (vivant) setAnomalies(data); })
      .catch(() => { if (vivant) setAnomalies([]); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [documentId, anomaliesProp, persiste]);

  const ouvertes = useMemo(() => anomalies.filter((a) => !a.resolved_at), [anomalies]);
  const levees = useMemo(() => anomalies.filter((a) => a.resolved_at), [anomalies]);
  const compteurs = useMemo(
    () => ({ ...compterParSeverite(ouvertes), total: ouvertes.length }),
    [ouvertes],
  );

  const majAnomalie = (maj) => {
    setAnomalies((prev) => {
      const suivant = prev.map((a) => (a.id === maj.id ? maj : a));
      onChange?.(suivant);
      return suivant;
    });
  };

  const lever = async (id) => {
    try {
      setEnCours(id);
      majAnomalie(await resolveAnomalie(id, note, userId));
      setSaisieId(null);
      setNote('');
    } catch (err) {
      alert(`Impossible de lever l'anomalie : ${err.message}`);
    } finally {
      setEnCours(null);
    }
  };

  const rouvrir = async (id) => {
    try {
      setEnCours(id);
      majAnomalie(await reopenAnomalie(id));
    } catch (err) {
      alert(`Impossible de rouvrir l'anomalie : ${err.message}`);
    } finally {
      setEnCours(null);
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contrôles en cours…
      </div>
    );
  }

  const conforme = ouvertes.length === 0;
  const styleEntete = conforme ? STYLES.mineure : (compteurs.majeure ? STYLES.majeure : STYLES.moyenne);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={ressort}
      className={`rounded-2xl border backdrop-blur-xl ${conforme
        ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
        : `${styleEntete.fond} ${styleEntete.halo}`}`}
    >
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          {conforme
            ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
            : <styleEntete.icone className={`h-4 w-4 ${styleEntete.texte}`} />}
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {conforme
              ? 'Contrôles conformes'
              : `${ouvertes.length} anomalie${ouvertes.length > 1 ? 's' : ''} détectée${ouvertes.length > 1 ? 's' : ''}`}
          </span>
          {!conforme && (
            <span className="hidden gap-1 sm:flex">
              {['majeure', 'moyenne', 'mineure'].filter((s) => compteurs[s]).map((s) => (
                <span key={s} className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STYLES[s].fond} ${STYLES[s].texte}`}>
                  {compteurs[s]} {STYLES[s].libelle.toLowerCase()}{compteurs[s] > 1 ? 's' : ''}
                </span>
              ))}
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: ouvert ? 180 : 0 }} transition={ressort}>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={ressort}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 px-4 pb-4">
              {fields && <PiecesLiasse fields={fields} />}

              {conforme && !levees.length && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Montants rapprochés, pièces attendues présentes, visas complets.
                </p>
              )}

              {ouvertes.map((a) => {
                const style = STYLES[a.severity] || STYLES.mineure;
                const Icone = style.icone;
                return (
                  <motion.div
                    key={a.id || a.code}
                    layout
                    className={`rounded-xl border p-3 ${style.fond}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${style.texte}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${style.texte}`}>
                            {style.libelle}
                          </span>
                          {a.page && (
                            <span className="rounded bg-slate-900/5 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">
                              page {a.page}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-400">{a.code}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                          {a.message}
                        </p>

                        {persiste && saisieId === a.id && (
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              autoFocus
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Justification (pièce jointe, note de service, décision…)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-teal-500/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => lever(a.id)}
                                disabled={!note.trim() || enCours === a.id}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {enCours === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Lever'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setSaisieId(null); setNote(''); }}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 dark:border-white/10 dark:text-slate-300"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {persiste && saisieId !== a.id && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setSaisieId(a.id); setNote(''); }}
                          title="Lever avec justification"
                          className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:text-emerald-600 dark:border-white/10"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {levees.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Levées ({levees.length})
                  </p>
                  {levees.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-200/70 bg-white/50 px-2.5 py-1.5 dark:border-white/5 dark:bg-white/[0.02]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-500 line-through dark:text-slate-400">{a.message}</p>
                        {a.resolution_note && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">↳ {a.resolution_note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => rouvrir(a.id)}
                        title="Rouvrir"
                        className="shrink-0 text-slate-400 transition-colors hover:text-amber-500"
                      >
                        {enCours === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
