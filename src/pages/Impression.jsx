import React, { useEffect, useState } from 'react';
import {
  Printer, FileText, Trash2, Loader2, Plus, X, Eye,
  Settings2, CheckCircle2, Calendar, Layers, AlertCircle,
} from 'lucide-react';
import { listQueue, addToQueue, updateQueueStatus, removeFromQueue } from '../services/printQueueService';
import { listDocuments } from '../services/documentsService';
import { logActivity } from '../services/activityLogService';
import { detectScannerBridge, listPrinters } from '../services/scannerBridgeService';
import VerificationComptable from '../components/VerificationComptable';
import { useSession } from '../context/SessionContext';

const NEXT_STATUS = { 'En attente': 'En cours', 'En cours': 'Terminé', 'Terminé': 'Terminé' };

function buildPrintHtml(doc, copies) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(doc.name)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  .meta { font-size: 9pt; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 8pt; margin-bottom: 12pt; }
  .resume { background: #f4f4f4; padding: 8pt 10pt; font-size: 10pt; border-left: 3pt solid #92278F; margin-bottom: 12pt; }
  pre { font-family: 'Consolas', monospace; font-size: 10pt; white-space: pre-wrap; word-wrap: break-word; }
  .footer { position: fixed; bottom: 0; font-size: 8pt; color: #999; }
</style>
</head>
<body>
  <h1>${esc(doc.name)}</h1>
  <p class="meta">
    ${esc(doc.categories?.name || doc.doc_type || 'Document')} ·
    ${doc.page_count || 1} page(s) ·
    ${doc.doc_date ? 'Daté du ' + esc(doc.doc_date) + ' · ' : ''}
    Imprimé via ArchivÉo${copies > 1 ? ' · ' + copies + ' exemplaires demandés' : ''}
  </p>
  ${doc.ai_summary ? `<div class="resume"><strong>Résumé :</strong> ${esc(doc.ai_summary)}</div>` : ''}
  <pre>${esc(doc.content_text || 'Contenu textuel non disponible pour ce document.')}</pre>
  <p class="footer">ArchivÉo Ecosystem — Système d'archivage électronique</p>
</body>
</html>`;
}

export default function Impression({ onBack }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [copies, setCopies] = useState(1);
  const [printers, setPrinters] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [fraisConfirmes, setFraisConfirmes] = useState([]);
  const { session, isSuperAdmin } = useSession();
  const provinceScope = isSuperAdmin ? null : session?.province;

  const refresh = () => listQueue({ province: provinceScope }).then(q => {
    setQueue(q);
    setSelectedId(prev => (q.some(i => i.id === prev) ? prev : (q[0]?.id ?? null)));
  }).finally(() => setLoading(false));

  useEffect(() => {
    refresh();
    detectScannerBridge().then(bridge => {
      if (bridge) listPrinters().then(setPrinters).catch(() => setPrinters([]));
    });
  }, [provinceScope]);

  const selected = queue.find(i => i.id === selectedId) || null;
  const selectedDoc = selected?.documents || null;

  const openPicker = async () => {
    setPicking(true);
    setDocuments(await listDocuments({ province: provinceScope }));
  };

  const handleAdd = async (doc) => {
    const item = await addToQueue({ documentId: doc.id, pages: doc.page_count || 1 });
    setPicking(false);
    await refresh();
    setSelectedId(item.id);
  };

  const handleAdvance = async (item) => {
    await updateQueueStatus(item.id, NEXT_STATUS[item.status]);
    refresh();
  };

  const handleRemove = async (item) => {
    await removeFromQueue(item.id);
    refresh();
  };

  const handlePrint = async () => {
    if (!selected || !selectedDoc) return;
    // Ouvrir la vérification du comptable avant d'imprimer
    setShowVerification(true);
  };

  const handleConfirmVerification = async (frais) => {
    // Frais confirmés avec cases à cocher
    setFraisConfirmes(frais);
    setShowVerification(false);

    // Procéder à l'impression avec les frais
    if (!selected || !selectedDoc) return;
    setPrinting(true);
    try {
      await updateQueueStatus(selected.id, 'En cours');
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) throw new Error("Fenêtre d'impression bloquée par le navigateur (autoriser les pop-ups)");

      // Construire le HTML avec les frais
      const htmlAvecFrais = buildPrintHtmlWithFrais(selectedDoc, copies, frais);
      win.document.write(htmlAvecFrais);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 350);
      await updateQueueStatus(selected.id, 'Terminé');
      await logActivity({
        documentId: selectedDoc.id,
        action: 'print',
        detail: `Impression · ${copies} exemplaire${copies > 1 ? 's' : ''} · Frais vérifiés par comptable`,
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setPrinting(false);
      refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-[#92278F]">
          <Printer className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Impression</h2>
          <p className="text-slate-500 text-sm">{queue.length} document{queue.length > 1 ? 's' : ''} en file d'attente</p>
        </div>
        <button
          onClick={onBack}
          className="ml-auto px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <hr className="border-slate-200 dark:border-white/10" />

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-500 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 flex-1 min-h-0 overflow-auto lg:overflow-visible">

          <div className="flex flex-col gap-3 lg:min-h-0">
            <div className="flex flex-col gap-2 lg:flex-1 lg:overflow-auto lg:min-h-24">
              {queue.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-all ${
                    item.id === selectedId
                      ? 'bg-[#92278F]/15 border-[#92278F]/50'
                      : 'bg-slate-100/80 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{item.documents?.name || 'Document supprimé'}</p>
                    <p className="text-slate-500 text-xs">{item.pages} page{item.pages > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAdvance(item); }}
                    disabled={item.status === 'Terminé'}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all shrink-0 ${
                      item.status === 'Terminé'  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 cursor-default' :
                      item.status === 'En cours' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 hover:bg-blue-500/30' :
                                                   'bg-slate-200 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500/30'
                    }`}
                  >
                    {item.status}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                    className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {queue.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Aucun document en file d'impression.</p>
              )}
            </div>

            <div className="bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 flex flex-col gap-3">
              <p className="text-slate-900 dark:text-white text-xs font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-purple-500 dark:text-purple-400" /> Réglages d'impression
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs">Exemplaires</span>
                  <select
                    value={copies}
                    onChange={e => setCopies(Number(e.target.value))}
                    className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {[1, 2, 3, 4, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs">Imprimante {printers.length === 0 && '(pont non lancé)'}</span>
                  <select className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none">
                    {printers.length === 0
                      ? <option>Choix dans la boîte de dialogue</option>
                      : printers.map(p => (
                          <option key={p.name}>{p.name}{p.default ? ' (par défaut)' : ''}</option>
                        ))}
                  </select>
                </label>
              </div>
              <p className="text-slate-500 text-[11px]">
                Le choix final de l'imprimante se confirme dans la boîte de dialogue d'impression de Windows.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={openPicker}
                className="flex-1 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Ajouter un document
              </button>
              <button
                onClick={handlePrint}
                disabled={!selected || printing}
                className="flex-1 bg-[#92278F] hover:bg-[#92278F]/80 disabled:opacity-40 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Imprimer maintenant
              </button>
            </div>
          </div>

          <div className="bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-3 min-h-64 lg:min-h-0">
            <p className="text-slate-900 dark:text-white text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-500 dark:text-purple-400" /> Aperçu avant impression
            </p>

            {!selectedDoc ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <Printer className="h-10 w-10 opacity-30" />
                Sélectionne un document dans la file pour voir son aperçu.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" /> {selectedDoc.page_count || 1} page(s)
                  </span>
                  {selectedDoc.doc_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {selectedDoc.doc_date}
                    </span>
                  )}
                  {selectedDoc.categories?.name && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px]"
                      style={{ backgroundColor: (selectedDoc.categories.color || '#64748B') + '30', color: selectedDoc.categories.color || '#94a3b8' }}
                    >
                      {selectedDoc.categories.name}
                    </span>
                  )}
                  {selected.status === 'Terminé' && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Imprimé
                    </span>
                  )}
                </div>

                {/* Rendu « papier » — toujours blanc comme une feuille imprimée */}
                <div className="flex-1 overflow-auto rounded-lg bg-slate-200/50 dark:bg-slate-950/40 p-3 sm:p-5 flex justify-center">
                  <div className="bg-white text-slate-900 rounded-sm shadow-2xl w-full max-w-[520px] min-h-[400px] p-6 sm:p-8 text-left">
                    <h3 className="font-bold text-lg mb-1 break-words">{selectedDoc.name}</h3>
                    <p className="text-[11px] text-slate-500 border-b border-slate-200 pb-2 mb-3">
                      {selectedDoc.categories?.name || selectedDoc.doc_type || 'Document'} · {selectedDoc.page_count || 1} page(s)
                      {selectedDoc.doc_date ? ` · Daté du ${selectedDoc.doc_date}` : ''}
                    </p>
                    {selectedDoc.ai_summary && (
                      <div className="bg-slate-100 border-l-4 border-[#92278F] px-3 py-2 mb-3 text-xs">
                        <strong>Résumé :</strong> {selectedDoc.ai_summary}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed break-words">
                      {selectedDoc.content_text || 'Contenu textuel non disponible pour ce document.'}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setPicking(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 max-w-md w-full max-h-[70vh] overflow-auto flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <h3 className="text-slate-900 dark:text-white font-bold flex-1">Choisir un document archivé</h3>
              <button onClick={() => setPicking(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {documents.length === 0 && <p className="text-slate-500 text-sm">Aucun document archivé pour l'instant.</p>}
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleAdd(doc)}
                className="text-left bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white transition-all"
              >
                {doc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
