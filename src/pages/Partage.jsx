import React, { useEffect, useState } from 'react';
import { Share2, Link, Copy, Users, Shield, Loader2, Plus, X, Trash2 } from 'lucide-react';
import { listShares, createShare, deleteShare } from '../services/sharesService';
import { listDocuments } from '../services/documentsService';
import { useSession } from '../context/SessionContext';

export default function Partage({ onBack }) {
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({ documentId: '', sharedWith: '', accessLevel: 'Lecture', expiresAt: '' });
  const { session, isSuperAdmin } = useSession();
  const provinceScope = isSuperAdmin ? null : session?.province;

  const refresh = () => listShares({ province: provinceScope }).then(setShares).finally(() => setLoading(false));

  useEffect(() => { refresh(); }, [provinceScope]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCreate = async () => {
    setDocuments(await listDocuments({ province: provinceScope }));
    setCreating(true);
  };

  const handleCreate = async () => {
    if (!form.documentId || !form.sharedWith) return;
    await createShare({
      documentId: form.documentId,
      sharedWith: form.sharedWith,
      accessLevel: form.accessLevel,
      expiresAt: form.expiresAt || null,
    });
    setForm({ documentId: '', sharedWith: '', accessLevel: 'Lecture', expiresAt: '' });
    setCreating(false);
    refresh();
  };

  const handleDelete = async (share) => {
    await deleteShare(share.id);
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-[#F26522]">
          <Share2 className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Partage & Accès</h2>
          <p className="text-slate-500 text-sm">{shares.length} partage{shares.length > 1 ? 's' : ''} actif{shares.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onBack}
          className="ml-auto px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <hr className="border-slate-200 dark:border-white/10" />

      <div className="bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Link className="h-4 w-4 text-orange-400" /> Lien de partage rapide
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value="https://archiveo.app/share/abc123xyz"
            className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none"
          />
          <button
            onClick={handleCopy}
            className={`px-4 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              copied ? 'bg-emerald-500 text-white' : 'bg-[#F26522] hover:bg-[#F26522]/80 text-white'
            }`}
          >
            {copied ? '✓ Copié' : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 overflow-auto">
        <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-orange-400" /> Documents partagés
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-500 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : (
          <>
            {shares.map(s => (
              <div key={s.id} className="bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-3 md:gap-4 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{s.documents?.name || 'Document supprimé'}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.shared_with}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.access_level === 'Modification' ? 'bg-orange-500/20 text-orange-500 dark:text-orange-300' : 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                }`}>
                  {s.access_level}
                </span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{s.expires_at ? `Exp. ${s.expires_at}` : 'Sans expiration'}</span>
                <Shield className="h-4 w-4 text-slate-400" />
                <button onClick={() => handleDelete(s)} className="text-slate-400 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {shares.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">Aucun partage actif.</p>
            )}
          </>
        )}
      </div>

      <button
        onClick={openCreate}
        className="bg-[#F26522] hover:bg-[#F26522]/80 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> Nouveau partage
      </button>

      {creating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setCreating(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 max-w-md w-full flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <h3 className="text-slate-900 dark:text-white font-bold flex-1">Nouveau partage</h3>
              <button onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <select
              value={form.documentId}
              onChange={e => setForm(f => ({ ...f, documentId: e.target.value }))}
              className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="">Choisir un document…</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <input
              value={form.sharedWith}
              onChange={e => setForm(f => ({ ...f, sharedWith: e.target.value }))}
              placeholder="Adresse e-mail du destinataire"
              className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none placeholder-slate-400 dark:placeholder-slate-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.accessLevel}
                onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value }))}
                className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
              >
                <option>Lecture</option>
                <option>Modification</option>
              </select>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!form.documentId || !form.sharedWith}
              className="bg-[#F26522] hover:bg-[#F26522]/80 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              Partager
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
