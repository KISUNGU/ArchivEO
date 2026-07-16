import React, { useEffect, useState } from 'react';
import {
  FolderTree, Folder, FolderOpen, ChevronRight, ChevronDown,
  List, LayoutGrid, FileText, Loader2,
} from 'lucide-react';
import { listDocuments, updateDocument } from '../services/documentsService';
import { listCategories } from '../services/categoriesService';
import { listServiceGroups } from '../services/servicesService';
import { logActivity } from '../services/activityLogService';
import { useSession } from '../context/SessionContext';

const SERVICE_ROOT_KEY = 'root:service';
const CATEGORY_ROOT_KEY = 'root:category';

function formatSize(kb) {
  if (!kb) return '—';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo` : `${kb} Ko`;
}

function formatDate(doc) {
  const raw = doc.doc_date || doc.created_at;
  return raw ? raw.slice(0, 10) : '—';
}

function TreeRow({ depth, icon, label, expanded, hasChildren, onToggle, onClick, selected, isDropTarget, dragHandlers = {} }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg py-1.5 pr-2 cursor-pointer text-sm transition-colors ${
        selected ? 'bg-[#F5A623]/20 text-[#F5A623] font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
      } ${isDropTarget ? 'ring-2 ring-[#F5A623] bg-[#F5A623]/10' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onClick}
      {...dragHandlers}
    >
      {hasChildren ? (
        <button onClick={e => { e.stopPropagation(); onToggle(); }} className="shrink-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function Explorateur({ onBack }) {
  const [serviceGroups, setServiceGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set([SERVICE_ROOT_KEY, CATEGORY_ROOT_KEY]));
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [dragOverKey, setDragOverKey] = useState(null);
  const { session, isSuperAdmin } = useSession();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listServiceGroups(),
      listCategories(),
      listDocuments({ province: isSuperAdmin ? null : session?.province }),
    ])
      .then(([groups, cats, docs]) => {
        setServiceGroups(groups);
        setCategories(cats);
        setDocuments(docs);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, session?.province]);

  const toggleExpand = (key) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleDragStart = (e, doc) => {
    e.dataTransfer.setData('text/plain', doc.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, target) => {
    e.preventDefault();
    setDragOverKey(null);
    const docId = e.dataTransfer.getData('text/plain');
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const payload = target.type === 'service' ? { service_id: target.id } : { category_id: target.id };
    try {
      await updateDocument(docId, payload);
      await logActivity({
        documentId: docId,
        action: 'reclassify',
        detail: `Déplacé vers ${target.type === 'service' ? 'service' : 'catégorie'} : ${target.name}`,
      });
      setDocuments(docs => docs.map(d => d.id === docId
        ? {
            ...d,
            ...payload,
            services: target.type === 'service' ? { name: target.name } : d.services,
            categories: target.type === 'category' ? { name: target.name, color: target.color } : d.categories,
          }
        : d));
    } catch (err) {
      setError(err.message);
    }
  };

  const folderDocuments = !selectedNode ? [] : documents.filter(d =>
    selectedNode.type === 'service' ? d.service_id === selectedNode.id : d.category_id === selectedNode.id
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-[#F5A623]">
          <FolderTree className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Explorateur</h2>
          <p className="text-slate-500 text-sm">Navigue et reclasse les documents par service ou par catégorie</p>
        </div>
        <button
          onClick={onBack}
          className="ml-auto px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition-all"
        >
          ← Accueil
        </button>
      </div>

      <hr className="border-slate-200 dark:border-white/10" />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-600 dark:text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-4 flex-1 overflow-hidden">
        <div className="w-72 shrink-0 overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-2 flex flex-col gap-0.5">
          <TreeRow
            depth={0}
            icon={<FolderTree className="h-4 w-4 text-[#F5A623] shrink-0" />}
            label="Par Service"
            expanded={expandedNodes.has(SERVICE_ROOT_KEY)}
            hasChildren
            onToggle={() => toggleExpand(SERVICE_ROOT_KEY)}
            onClick={() => toggleExpand(SERVICE_ROOT_KEY)}
          />
          {expandedNodes.has(SERVICE_ROOT_KEY) && serviceGroups.map(g => {
            const groupKey = `group:${g.id}`;
            return (
              <React.Fragment key={g.id}>
                <TreeRow
                  depth={1}
                  icon={expandedNodes.has(groupKey)
                    ? <FolderOpen className="h-4 w-4 text-slate-400 shrink-0" />
                    : <Folder className="h-4 w-4 text-slate-400 shrink-0" />}
                  label={g.name}
                  expanded={expandedNodes.has(groupKey)}
                  hasChildren={g.services.length > 0}
                  onToggle={() => toggleExpand(groupKey)}
                  onClick={() => toggleExpand(groupKey)}
                />
                {expandedNodes.has(groupKey) && g.services.map(s => {
                  const svcKey = `service:${s.id}`;
                  return (
                    <TreeRow
                      key={s.id}
                      depth={2}
                      icon={<Folder className="h-4 w-4 text-[#F5A623] shrink-0" />}
                      label={s.name}
                      expanded={false}
                      hasChildren={false}
                      onToggle={() => {}}
                      onClick={() => setSelectedNode({ type: 'service', id: s.id, name: s.name, breadcrumb: `Par Service / ${g.name} / ${s.name}` })}
                      selected={selectedNode?.type === 'service' && selectedNode.id === s.id}
                      isDropTarget={dragOverKey === svcKey}
                      dragHandlers={{
                        onDragOver: e => { e.preventDefault(); setDragOverKey(svcKey); },
                        onDragLeave: () => setDragOverKey(prev => prev === svcKey ? null : prev),
                        onDrop: e => handleDrop(e, { type: 'service', id: s.id, name: s.name }),
                      }}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}

          <TreeRow
            depth={0}
            icon={<FolderTree className="h-4 w-4 text-[#F5A623] shrink-0" />}
            label="Par Catégorie"
            expanded={expandedNodes.has(CATEGORY_ROOT_KEY)}
            hasChildren
            onToggle={() => toggleExpand(CATEGORY_ROOT_KEY)}
            onClick={() => toggleExpand(CATEGORY_ROOT_KEY)}
          />
          {expandedNodes.has(CATEGORY_ROOT_KEY) && categories.map(c => {
            const catKey = `category:${c.id}`;
            return (
              <TreeRow
                key={c.id}
                depth={1}
                icon={<Folder className="h-4 w-4 shrink-0" style={{ color: c.color || '#94a3b8' }} />}
                label={c.name}
                expanded={false}
                hasChildren={false}
                onToggle={() => {}}
                onClick={() => setSelectedNode({ type: 'category', id: c.id, name: c.name, color: c.color, breadcrumb: `Par Catégorie / ${c.name}` })}
                selected={selectedNode?.type === 'category' && selectedNode.id === c.id}
                isDropTarget={dragOverKey === catKey}
                dragHandlers={{
                  onDragOver: e => { e.preventDefault(); setDragOverKey(catKey); },
                  onDragLeave: () => setDragOverKey(prev => prev === catKey ? null : prev),
                  onDrop: e => handleDrop(e, { type: 'category', id: c.id, name: c.name, color: c.color }),
                }}
              />
            );
          })}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
            <p className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
              {selectedNode ? selectedNode.breadcrumb : 'Sélectionne un dossier dans l\u2019arborescence'}
            </p>
            {selectedNode && (
              <span className="text-xs text-slate-400 shrink-0">
                {folderDocuments.length} document{folderDocuments.length > 1 ? 's' : ''}
              </span>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="Vue liste"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Vue grille"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#F5A623]/20 text-[#F5A623]' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
              </div>
            ) : !selectedNode ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-6">
                Choisis un service ou une catégorie à gauche pour voir ses documents.
              </div>
            ) : folderDocuments.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center px-6">
                Aucun document dans ce dossier. Glisse un document ici depuis un autre dossier pour le classer.
              </div>
            ) : viewMode === 'list' ? (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                    <th className="text-left text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider px-3 py-2 border-b border-slate-200 dark:border-white/10">Document</th>
                    <th className="text-left text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider px-3 py-2 border-b border-slate-200 dark:border-white/10">Nature</th>
                    <th className="text-left text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider px-3 py-2 border-b border-slate-200 dark:border-white/10">Date</th>
                    <th className="text-left text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider px-3 py-2 border-b border-slate-200 dark:border-white/10">Taille</th>
                  </tr>
                </thead>
                <tbody>
                  {folderDocuments.map(doc => (
                    <tr
                      key={doc.id}
                      draggable
                      onDragStart={e => handleDragStart(e, doc)}
                      className="border-b border-slate-200 dark:border-white/10 last:border-b-0 hover:bg-slate-100/70 dark:hover:bg-white/5 cursor-grab transition-colors"
                    >
                      <td className="px-3 py-2.5 text-slate-900 dark:text-white truncate max-w-[240px]">{doc.name}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: (doc.categories?.color || '#64748B') + '30', color: doc.categories?.color || '#94a3b8' }}
                        >
                          {doc.categories?.name || doc.doc_type || 'Non classé'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(doc)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{formatSize(doc.size_kb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folderDocuments.map(doc => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={e => handleDragStart(e, doc)}
                    title={doc.name}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100/70 dark:hover:bg-white/5 cursor-grab transition-colors"
                  >
                    <FileText className="h-9 w-9 text-[#F5A623]" strokeWidth={1.3} />
                    <span className="text-xs text-slate-700 dark:text-slate-300 text-center truncate w-full">{doc.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
