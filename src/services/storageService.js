import { supabase } from '../lib/supabaseClient';

const BUCKET = 'documents';

function sanitizeFileName(name) {
  return String(name || 'fichier')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * Upload un fichier (File ou Blob) vers le bucket de stockage "documents"
 * et retourne son URL publique. Utilisé pour permettre l'affichage et
 * l'impression de la pièce scannée/importée depuis les Archives.
 */
export async function uploadDocumentFile(fileOrBlob, fileName, province = null) {
  const safeName = sanitizeFileName(fileName);
  const folder = province ? sanitizeFileName(province) : 'divers';
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileOrBlob, { upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
