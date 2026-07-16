import React from 'react';
import { Shield, Lock } from 'lucide-react';

export default function Securite({ onBack }) {
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/20">
            <Shield className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Sécurité</h2>
            <p className="text-slate-500 text-sm">Gestion des accès, rôles et droits d’administration.</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Lock className="h-4 w-4 text-amber-500" />
            Gestion des accès
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Révision des comptes, rôles et privilèges des profils administratifs.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Shield className="h-4 w-4 text-rose-500" />
            Audit & traçabilité
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Contrôle des activités sensibles et historique des accès au système.</p>
        </div>
      </div>
    </div>
  );
}
