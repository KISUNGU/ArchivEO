import React, { useEffect, useRef, useState } from 'react';
import {
  Settings, RefreshCw, Loader2, ScanLine, Printer, CheckCircle2,
  XCircle, Star, TerminalSquare, Building2, Plus, Pencil, Trash2, Check, X,
  Download, Upload, DatabaseBackup,
} from 'lucide-react';
import {
  detectScannerBridge, listScanners, listPrinters,
  getDefaultScannerId, setDefaultScannerId,
} from '../services/scannerBridgeService';
import {
  listServiceGroups, createServiceGroup, renameServiceGroup, deleteServiceGroup,
  createService, renameService, deleteService,
} from '../services/servicesService';
import { buildBackup, downloadBackupFile, parseBackupFile, importBackup } from '../services/backupService';
import { useSession } from '../context/SessionContext';

function EditableName({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = async () => {
    const name = draft.trim();
    if (name && name !== value) await onSave(name);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span className={`flex items-center gap-2 min-w-0 ${className}`}>
        <span className="truncate">{value}</span>
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          title="Renommer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 min-w-0 flex-1">
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        className="bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-1 text-sm text-slate-900 dark:text-white outline-none flex-1 min-w-0"
      />
      <button onClick={save} className="text-emerald-500 hover:text-emerald-400 shrink-0" title="Valider"><Check className="h-4 w-4" /></button>
      <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0" title="Annuler"><X className="h-4 w-4" /></button>
    </span>
  );
}

export default function Parametres({ onBack }) {
  const [checking, setChecking] = useState(true);
  const [bridge, setBridge] = useState(null);
  const { accounts, createAccount, deleteAccount, refreshAccounts, isSuperAdmin, session } = useSession();
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', province: 'Kwilu', accessLevel: 'admin' });
  const [userError, setUserError] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [scanners, setScanners] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [defaultScanner, setDefaultScanner] = useState(getDefaultScannerId());

  const [groups, setGroups] = useState([]);
  const [svcError, setSvcError] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newServiceName, setNewServiceName] = useState({});

  const [exportProvince, setExportProvince] = useState('Toutes provinces');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [backupError, setBackupError] = useState('');
  const importInputRef = useRef(null);

  const reloadGroups = () =>
    listServiceGroups().then(setGroups).catch(err => setSvcError(err.message));

  useEffect(() => { reloadGroups(); }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      refreshAccounts().catch(err => setUserError(err.message));
    }
  }, [isSuperAdmin]);

  const svc = async (fn) => {
    setSvcError(null);
    try { await fn(); await reloadGroups(); }
    catch (err) {
      setSvcError(/duplicate|unique/i.test(err.message) ? 'Ce nom existe déjà.' : err.message);
    }
  };

  const refresh = async () => {
    setChecking(true);
    setLoadingDevices(true);
    const health = await detectScannerBridge();
    setBridge(health);
    setChecking(false);

    if (health) {
      try {
        const [foundScanners, foundPrinters] = await Promise.all([listScanners(), listPrinters()]);
        setScanners(foundScanners);
        setPrinters(foundPrinters);
      } catch {
        setScanners([]);
        setPrinters([]);
      }
    } else {
      setScanners([]);
      setPrinters([]);
    }
    setLoadingDevices(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setUserError('');
    setSavingUser(true);
    try {
      await createAccount(newUser);
      setNewUser({ name: '', email: '', password: '', province: 'Kwilu', accessLevel: 'admin' });
    } catch (error) {
      setUserError(error.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Supprimer définitivement le compte ${account.email} ?`)) return;
    setUserError('');
    try {
      await deleteAccount(account.id);
    } catch (error) {
      setUserError(error.message);
    }
  };

  const chooseDefault = (deviceId) => {
    const next = defaultScanner === deviceId ? '' : deviceId;
    setDefaultScannerId(next);
    setDefaultScanner(next);
  };

  const handleExportBackup = async () => {
    setBackupError('');
    setExporting(true);
    try {
      const scope = isSuperAdmin
        ? (exportProvince === 'Toutes provinces' ? null : exportProvince)
        : session?.province;
      const backup = await buildBackup({ province: scope, isSuperAdmin });
      downloadBackupFile(backup);
    } catch (error) {
      setBackupError(`Erreur lors de l'export : ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBackupError('');
    setImportResult(null);
    setImporting(true);
    setImportProgress({ done: 0, total: 0 });
    try {
      const backup = await parseBackupFile(file);
      if (!isSuperAdmin && !window.confirm(
        `Importer ${backup.documents.length} document(s) dans les archives de ${session?.province} ?`
      )) {
        setImporting(false);
        return;
      }
      const result = await importBackup(backup, {
        province: session?.province,
        isSuperAdmin,
        onProgress: (done, total) => setImportProgress({ done, total }),
      });
      setImportResult(result);
    } catch (error) {
      setBackupError(`Erreur lors de l'import : ${error.message}`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-auto">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-slate-600">
          <Settings className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h2>
          <p className="text-slate-500 text-sm">Périphériques de numérisation et d'impression</p>
        </div>
        <button
          onClick={onBack}
          className="ml-auto px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <hr className="border-slate-200 dark:border-white/10" />


      {/* Gestion des comptes et services */}

      {isSuperAdmin && (
        <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-4" style={{ borderLeftColor: '#0EA5E9' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#0EA5E91A' }}>
              <Building2 className="h-5 w-5" style={{ color: '#0EA5E9' }} />
            </div>
            <p className="text-slate-900 dark:text-white text-sm font-semibold">Gestion des comptes</p>
          </div>
          <form onSubmit={handleCreateUser} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={newUser.name} onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom du compte" className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm" />
            <input value={newUser.email} onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm" />
            <input value={newUser.password} onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))} placeholder="Mot de passe" className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm" />
            <select value={newUser.province} onChange={(e) => setNewUser((prev) => ({ ...prev, province: e.target.value }))} className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm">
              <option>Kwilu</option>
              <option>Kasaï</option>
              <option>Kasaï Central</option>
              <option>Kinshasa</option>
            </select>
            <select value={newUser.accessLevel} onChange={(e) => setNewUser((prev) => ({ ...prev, accessLevel: e.target.value }))} className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm">
              <option value="admin">Rôle : Admin (gestion complète, y compris suppression)</option>
              <option value="user">Rôle : Utilisateur (sans droit de suppression)</option>
            </select>
            <button type="submit" disabled={savingUser} className="rounded-lg bg-[#008B8B] text-white px-3 py-2 text-sm font-semibold disabled:opacity-60">{savingUser ? 'Création…' : 'Créer le compte'}</button>
          </form>
          {userError && <p className="text-red-600 text-xs">{userError}</p>}
          <div className="grid gap-2">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{account.name}</p>
                  <p className="text-slate-500 text-xs">
                    {account.email} · {account.province} · {account.role}
                    {' · '}
                    <span className={(account.accessLevel === 'user') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                      {account.accessLevel === 'user' ? 'Utilisateur' : 'Admin'}
                    </span>
                  </p>
                </div>
                <button onClick={() => handleDeleteAccount(account)} className="text-xs text-rose-500 hover:underline">Supprimer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-4" style={{ borderLeftColor: '#008B8B' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#008B8B1A' }}>
            <Building2 className="h-5 w-5" style={{ color: '#008B8B' }} />
          </div>
          <p className="text-slate-900 dark:text-white text-sm font-semibold">Services &amp; regroupements</p>
          <span className="text-slate-500 text-xs">
            {groups.reduce((n, g) => n + g.services.length, 0)} services · {groups.length} regroupements
          </span>
        </div>

        {svcError && (
          <p className="text-red-600 dark:text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{svcError}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {groups.map(g => (
            <div key={g.id} className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white text-sm font-semibold">
                <EditableName
                  value={g.name}
                  onSave={name => svc(() => renameServiceGroup(g.id, name))}
                  className="flex-1"
                />
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer le regroupement « ${g.name} » ?\nSes services seront conservés mais non regroupés.`)) {
                      svc(() => deleteServiceGroup(g.id));
                    }
                  }}
                  className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
                  title="Supprimer le regroupement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {g.services.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm bg-slate-200/50 dark:bg-white/5 rounded-lg px-2.5 py-1.5">
                    <EditableName
                      value={s.name}
                      onSave={name => svc(() => renameService(s.id, name))}
                      className="flex-1"
                    />
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer le service « ${s.name} » ?\nLes documents affectés passeront en « Non affecté ».`)) {
                          svc(() => deleteService(s.id));
                        }
                      }}
                      className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
                      title="Supprimer le service"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {g.services.length === 0 && (
                  <p className="text-slate-400 text-xs px-1">Aucun service dans ce regroupement.</p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  value={newServiceName[g.id] || ''}
                  onChange={e => setNewServiceName(prev => ({ ...prev, [g.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (newServiceName[g.id] || '').trim()) {
                      svc(() => createService(newServiceName[g.id].trim(), g.id));
                      setNewServiceName(prev => ({ ...prev, [g.id]: '' }));
                    }
                  }}
                  placeholder="Nouveau service…"
                  className="flex-1 min-w-0 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500/60 placeholder-slate-400 dark:placeholder-slate-500"
                />
                <button
                  onClick={() => {
                    if ((newServiceName[g.id] || '').trim()) {
                      svc(() => createService(newServiceName[g.id].trim(), g.id));
                      setNewServiceName(prev => ({ ...prev, [g.id]: '' }));
                    }
                  }}
                  className="p-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shrink-0"
                  title="Ajouter le service"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 dark:border-white/10 pt-3">
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newGroupName.trim()) {
                svc(() => createServiceGroup(newGroupName.trim()));
                setNewGroupName('');
              }
            }}
            placeholder="Nouveau regroupement (ex. Direction Commerciale)…"
            className="flex-1 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500/60 placeholder-slate-400 dark:placeholder-slate-500"
          />
          <button
            onClick={() => {
              if (newGroupName.trim()) {
                svc(() => createServiceGroup(newGroupName.trim()));
                setNewGroupName('');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#008B8B] hover:bg-[#008B8B]/80 rounded-lg text-white text-sm font-semibold transition-all"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>

        <p className="text-slate-500 text-[11px]">
          Ces services alimentent le champ « Service concerné » des fiches d'enregistrement et le filtre
          des Archives. L'agent IA choisit automatiquement le service le plus pertinent dans cette liste.
        </p>
      </div>

      <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-4" style={{ borderLeftColor: '#F5A623' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#F5A6231A' }}>
            <DatabaseBackup className="h-5 w-5" style={{ color: '#F5A623' }} />
          </div>
          <p className="text-slate-900 dark:text-white text-sm font-semibold">Sauvegarde &amp; restauration des archives</p>
        </div>

        {backupError && (
          <p className="text-red-600 dark:text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{backupError}</p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3">
            <p className="text-slate-900 dark:text-white text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-[#F5A623]" /> Exporter
            </p>
            <p className="text-slate-500 text-xs">
              Télécharge un fichier JSON contenant les documents archivés{isSuperAdmin ? ' (province au choix)' : ` de ${session?.province}`}.
            </p>
            {isSuperAdmin && (
              <select
                value={exportProvince}
                onChange={(e) => setExportProvince(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option>Toutes provinces</option>
                <option>Kinshasa</option>
                <option>Kwilu</option>
                <option>Kasaï</option>
                <option>Kasaï Central</option>
              </select>
            )}
            <button
              onClick={handleExportBackup}
              disabled={exporting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F5A623] hover:bg-[#F5A623]/80 disabled:opacity-50 rounded-lg text-white text-xs font-semibold transition-all"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exporter les archives
            </button>
          </div>

          <div className="flex flex-col gap-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3">
            <p className="text-slate-900 dark:text-white text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#F5A623]" /> Importer
            </p>
            <p className="text-slate-500 text-xs">
              Restaure des documents depuis un fichier de sauvegarde JSON précédemment exporté.
              {!isSuperAdmin && ` Les documents seront rattachés à ${session?.province}.`}
            </p>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFileSelected}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-700/80 disabled:opacity-50 rounded-lg text-white text-xs font-semibold transition-all"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {importing && importProgress?.total
                ? `Import en cours… ${importProgress.done}/${importProgress.total}`
                : 'Choisir un fichier de sauvegarde'}
            </button>
            {importResult && (
              <p className="text-xs text-emerald-600 dark:text-emerald-300">
                {importResult.imported} document(s) importé(s){importResult.skipped > 0 ? `, ${importResult.skipped} ignoré(s)` : ''} sur {importResult.total}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pont de scan local */}

      <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-3" style={{ borderLeftColor: '#2563EB' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#2563EB1A' }}>
            <TerminalSquare className="h-5 w-5" style={{ color: '#2563EB' }} />
          </div>
          <p className="text-slate-900 dark:text-white text-sm font-semibold">Pont de scan local</p>
          <button
            onClick={refresh}
            disabled={checking || loadingDevices}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-lg text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 transition-all disabled:opacity-50"
          >
            {(checking || loadingDevices) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
        </div>

        {checking ? (
          <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Vérification…</p>
        ) : bridge ? (
          <p className="text-emerald-600 dark:text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Actif sur localhost:3777 (v{bridge.version})
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-red-600 dark:text-red-300 text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Non lancé — le scan réel et la détection des périphériques sont indisponibles.
            </p>
            <p className="text-slate-500 text-xs">
              Ouvre un terminal dans le dossier du projet et lance :
              <code className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-black/30 rounded text-slate-700 dark:text-slate-200">npm run scan-bridge</code>
              &nbsp;— puis clique « Actualiser ».
            </p>
          </div>
        )}
      </div>

      {/* Détection de scanner */}

      <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-3" style={{ borderLeftColor: '#D91B5C' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#D91B5C1A' }}>
            <ScanLine className="h-5 w-5" style={{ color: '#D91B5C' }} />
          </div>
          <p className="text-slate-900 dark:text-white text-sm font-semibold">Scanners détectés</p>
          <span className="text-slate-500 text-xs">{scanners.length}</span>
        </div>

        {loadingDevices ? (
          <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Énumération WIA en cours…</p>
        ) : scanners.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {bridge ? "Aucun scanner détecté. Vérifie qu'il est branché, allumé, et visible dans Windows (Paramètres → Imprimantes et scanners)." : 'Pont non lancé.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {scanners.map(s => {
              const isDefault = defaultScanner ? s.deviceId === defaultScanner : false;
              return (
                <button
                  key={s.deviceId}
                  onClick={() => chooseDefault(s.deviceId)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border text-left transition-all ${
                    isDefault
                      ? 'bg-[#D91B5C]/15 border-[#D91B5C]/40'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                  title="Cliquer pour définir comme scanner par défaut"
                >
                  <ScanLine className="h-4 w-4 text-slate-500 dark:text-slate-300 shrink-0" />
                  <span className="text-slate-900 dark:text-white text-sm flex-1 truncate">{s.name}</span>
                  {isDefault && (
                    <span className="flex items-center gap-1 text-[11px] text-[#ff7aa8] font-medium">
                      <Star className="h-3.5 w-3.5 fill-current" /> Par défaut
                    </span>
                  )}
                </button>
              );
            })}
            <p className="text-slate-500 text-[11px]">
              Clique sur un scanner pour le définir comme appareil par défaut du Scan Direct.
              {!defaultScanner && ' Sans choix, le premier détecté est utilisé.'}
            </p>
          </div>
        )}
      </div>

      {/* Détection d'imprimante */}

      <div className="bg-slate-100/80 dark:bg-white/5 border-y border-r border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-4 flex flex-col gap-3" style={{ borderLeftColor: '#92278F' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#92278F1A' }}>
            <Printer className="h-5 w-5" style={{ color: '#92278F' }} />
          </div>
          <p className="text-slate-900 dark:text-white text-sm font-semibold">Imprimantes détectées</p>
          <span className="text-slate-500 text-xs">{printers.length}</span>
        </div>

        {loadingDevices ? (
          <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Recherche…</p>
        ) : printers.length === 0 ? (
          <p className="text-slate-500 text-sm">{bridge ? 'Aucune imprimante installée.' : 'Pont non lancé.'}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {printers.map(p => (
              <div key={p.name} className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5">
                <Printer className="h-4 w-4 text-slate-500 dark:text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm truncate">{p.name}</p>
                  <p className="text-slate-500 text-[11px] truncate">{p.driver} · {p.port}</p>
                </div>
                {p.default && (
                  <span className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-300 font-medium shrink-0">
                    <Star className="h-3.5 w-3.5 fill-current" /> Par défaut Windows
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-slate-400 text-[11px] mt-auto">
        La détection passe par le pont local (WIA et spouleur Windows). Un périphérique absent ici est
        également absent pour Windows : vérifier le câble, l'alimentation et le pilote du fabricant.
      </p>
    </div>
  );
}
