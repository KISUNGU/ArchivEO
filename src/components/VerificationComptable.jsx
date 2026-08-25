import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Trash2, Loader2, X } from 'lucide-react';
import { getFraisByQueueId, updateFrais, deleteFrais, createFrais } from '../services/fraisService';
import AnomaliesLiasse from './AnomaliesLiasse';

export default function VerificationComptable({ queueId, onClose, onConfirm, documentId = null, fields = null, userId = null }) {
  const [frais, setFrais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFrais, setNewFrais] = useState({ label: '', montant: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFrais = async () => {
    try {
      setLoading(true);
      const data = await getFraisByQueueId(queueId);
      setFrais(data);
    } catch (err) {
      console.error('Erreur chargement frais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrais();
  }, [queueId]);

  const handleToggleFrais = async (fraisId, selected) => {
    try {
      await updateFrais(fraisId, { selected: !selected });
      setFrais(frais.map(f => f.id === fraisId ? { ...f, selected: !selected } : f));
    } catch (err) {
      alert('Erreur mise à jour frais');
    }
  };

  const handleUpdateMontant = async (fraisId, montant) => {
    try {
      await updateFrais(fraisId, { montant: parseFloat(montant) || 0 });
      setFrais(frais.map(f => f.id === fraisId ? { ...f, montant: parseFloat(montant) || 0 } : f));
    } catch (err) {
      alert('Erreur mise à jour montant');
    }
  };

  const handleDeleteFrais = async (fraisId) => {
    try {
      await deleteFrais(fraisId);
      setFrais(frais.filter(f => f.id !== fraisId));
    } catch (err) {
      alert('Erreur suppression frais');
    }
  };

  const handleAddFrais = async () => {
    if (!newFrais.label || !newFrais.montant) {
      alert('Veuillez remplir label et montant');
      return;
    }
    try {
      setSaving(true);
      const data = await createFrais(queueId, {
        label: newFrais.label,
        montant: parseFloat(newFrais.montant),
        selected: true,
      });
      setFrais([...frais, data]);
      setNewFrais({ label: '', montant: '' });
      setShowAddForm(false);
    } catch (err) {
      alert('Erreur ajout frais');
    } finally {
      setSaving(false);
    }
  };

  const totalSelectionne = frais
    .filter(f => f.selected)
    .reduce((acc, f) => acc + (f.montant || 0), 0)
    .toFixed(2);

  const totalTous = frais
    .reduce((acc, f) => acc + (f.montant || 0), 0)
    .toFixed(2);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Vérification du Comptable
            </h3>
            <p className="text-slate-500 text-sm">AVIS SUR JUSTIFICATIFS PROVISION</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <hr className="border-slate-200 dark:border-white/10" />

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des frais…
          </div>
        ) : (
          <>
            {/* Contrôles automatiques de la liasse archivée */}
            {documentId && (
              <AnomaliesLiasse documentId={documentId} fields={fields} userId={userId} compact />
            )}

            {/* Liste des frais */}
            <div className="space-y-2">
              <p className="text-slate-900 dark:text-white text-sm font-semibold">Éléments d'autres frais</p>

              {frais.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">Aucun frais enregistré.</p>
              ) : (
                <div className="space-y-2 bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                  {frais.map(f => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={f.selected || false}
                        onChange={() => handleToggleFrais(f.id, f.selected)}
                        className="h-5 w-5 rounded border-slate-300 text-purple-600 cursor-pointer"
                      />

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white text-sm font-medium">{f.label}</p>
                      </div>

                      {/* Montant */}
                      <div className="flex items-center gap-2">
                        {!f.selected ? (
                          <input
                            type="number"
                            value={f.montant || ''}
                            onChange={(e) => handleUpdateMontant(f.id, e.target.value)}
                            placeholder="0.00"
                            className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900 dark:text-white w-24 outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        ) : (
                          <span className="text-slate-900 dark:text-white font-medium w-24 text-right">
                            {(f.montant || 0).toFixed(2)} $
                          </span>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteFrais(f.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add frais form */}
            {showAddForm && (
              <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-200 dark:border-white/10 space-y-2">
                <p className="text-slate-900 dark:text-white text-xs font-semibold">Ajouter un frais</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Libellé du frais"
                    value={newFrais.label}
                    onChange={(e) => setNewFrais({ ...newFrais, label: e.target.value })}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="number"
                    placeholder="Montant"
                    value={newFrais.montant}
                    onChange={(e) => setNewFrais({ ...newFrais, montant: e.target.value })}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-sm text-slate-900 dark:text-white w-28 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAddFrais}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-all"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter'}
                  </button>
                </div>
              </div>
            )}

            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 w-full py-2 border border-dashed border-slate-300 dark:border-white/10 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 text-sm transition-all"
              >
                <Plus className="h-4 w-4" /> Ajouter un frais
              </button>
            )}

            {/* Totals */}
            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-900 dark:text-white text-sm">Total (sélectionnés)</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalSelectionne} $</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Total (tous les frais)</span>
                <span>{totalTous} $</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium text-sm transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => onConfirm(frais)}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmer et imprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
