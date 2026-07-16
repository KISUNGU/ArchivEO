import React, { useEffect, useState } from 'react';
import { Building2, FileText, Database, Shield, Workflow, ArrowRight } from 'lucide-react';
import { countDocuments, getProvinceStats, sumDocumentSizeKb } from '../services/documentsService';

export default function DashboardGeneral({ onBack }) {
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalSizeKb, setTotalSizeKb] = useState(0);
  const [provinceStats, setProvinceStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [count, sizeKb, stats] = await Promise.all([
          countDocuments(),
          sumDocumentSizeKb(),
          getProvinceStats(),
        ]);
        setTotalDocuments(count ?? 0);
        setTotalSizeKb(sizeKb ?? 0);
        setProvinceStats(stats ?? []);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/15 text-blue-600 border border-blue-500/20">
            <Building2 className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord général</h2>
            <p className="text-slate-500 text-sm">Vue globale des archives, des provinces et des activités du système.</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <FileText className="h-4 w-4 text-emerald-500" />
            Documents
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loading ? '…' : totalDocuments}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nombre total de documents archivés</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Database className="h-4 w-4 text-violet-500" />
            Stockage
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loading ? '…' : `${Math.round(totalSizeKb / 1024)} Mo`}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Capacité totale utilisée</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Shield className="h-4 w-4 text-amber-500" />
            Sécurité
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Global</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Contrôle centralisé des accès</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Workflow className="h-4 w-4 text-blue-500" />
          Vue par province
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {provinceStats.map((item) => (
            <div key={item.province} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.province}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.count} docs</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Stockage : {Math.round((item.sizeKb || 0) / 1024)} Mo</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <ArrowRight className="h-4 w-4 text-rose-500" />
          Accès rapide
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Impression, archives, partage, sécurité et workflow documentaire sont désormais accessibles dans le profil du super administrateur.</p>
      </div>
    </div>
  );
}
