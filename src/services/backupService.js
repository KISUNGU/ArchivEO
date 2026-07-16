import { listDocuments, createDocument } from './documentsService';
import { listCategories } from './categoriesService';
import { listServices } from './servicesService';

const BACKUP_VERSION = 1;

/**
 * Construit un objet de sauvegarde contenant les documents visibles par
 * l'utilisateur courant (respecte l'isolation par province : un compte
 * provincial n'exporte que ses propres archives, le super admin peut
 * exporter une province précise ou "Toutes provinces").
 */
export async function buildBackup({ province, isSuperAdmin }) {
  const scope = isSuperAdmin ? (province || null) : province;
  const documents = await listDocuments({ province: scope });

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: scope || 'Toutes provinces',
    documents: documents.map((doc) => ({
      name: doc.name,
      doc_type: doc.doc_type,
      source: doc.source,
      province: doc.province,
      status: doc.status,
      size_kb: doc.size_kb,
      page_count: doc.page_count,
      content_text: doc.content_text,
      file_url: doc.file_url,
      ai_summary: doc.ai_summary,
      ai_tags: doc.ai_tags,
      ai_confidence: doc.ai_confidence,
      doc_date: doc.doc_date,
      sender: doc.sender,
      subject: doc.subject,
      category_name: doc.categories?.name || null,
      service_name: doc.services?.name || null,
    })),
  };
}

/** Déclenche le téléchargement du fichier JSON de sauvegarde dans le navigateur. */
export function downloadBackupFile(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeScope = String(backup.scope || 'export').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `archiveo-backup-${safeScope}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lit et valide un fichier de sauvegarde JSON sélectionné par l'utilisateur. */
export async function parseBackupFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible : ce n\'est pas un JSON valide.');
  }
  if (!data || !Array.isArray(data.documents)) {
    throw new Error('Fichier de sauvegarde invalide : structure inattendue.');
  }
  return data;
}

/**
 * Importe les documents d'une sauvegarde dans la base. Un compte provincial
 * force la province courante sur chaque document importé (isolation) ; le
 * super admin conserve la province d'origine du document si présente.
 */
export async function importBackup(backup, { province, isSuperAdmin, onProgress } = {}) {
  const [categories, services] = await Promise.all([listCategories(), listServices()]);
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const serviceByName = new Map(services.map((s) => [s.name.toLowerCase(), s.id]));

  const total = backup.documents.length;
  let imported = 0;
  let skipped = 0;

  for (const doc of backup.documents) {
    try {
      const targetProvince = isSuperAdmin ? (doc.province || province || 'Kinshasa') : province;
      await createDocument({
        name: doc.name || 'Document importé',
        doc_type: doc.doc_type || null,
        source: doc.source || 'import_backup',
        province: targetProvince,
        status: doc.status || 'archived',
        size_kb: doc.size_kb || 0,
        page_count: doc.page_count || 1,
        content_text: doc.content_text || '',
        file_url: doc.file_url || null,
        ai_summary: doc.ai_summary || null,
        ai_tags: doc.ai_tags || [],
        ai_confidence: doc.ai_confidence ?? null,
        doc_date: doc.doc_date || null,
        sender: doc.sender || null,
        subject: doc.subject || null,
        category_id: doc.category_name ? categoryByName.get(String(doc.category_name).toLowerCase()) || null : null,
        service_id: doc.service_name ? serviceByName.get(String(doc.service_name).toLowerCase()) || null : null,
      });
      imported += 1;
    } catch {
      skipped += 1;
    }
    onProgress?.(imported + skipped, total);
  }

  return { imported, skipped, total };
}
