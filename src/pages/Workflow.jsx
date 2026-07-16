import React from 'react';
import { Sparkles, ArrowRight, Workflow as WorkflowIcon } from 'lucide-react';

export default function Workflow({ onBack }) {
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-600/15 text-blue-600 border border-blue-500/20">
            <WorkflowIcon className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Flux & Automations</h2>
            <p className="text-slate-500 text-sm">Workflow documentaire pour la validation et l’orchestration des processus.</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Workflow principal
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Définir les étapes de traitement, validation et diffusion d’un document.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ArrowRight className="h-4 w-4 text-emerald-500" />
            Orchestration
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Suivi des tâches entre archivage, impression, partage et accès.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <WorkflowIcon className="h-4 w-4 text-violet-500" />
            Automations
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cette vue pourra être enrichie avec des règles de routage documentaire.</p>
        </div>
      </div>
    </div>
  );
}
