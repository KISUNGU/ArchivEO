import { supabase } from '../lib/supabaseClient';

const QUEUE_SELECT = '*, documents(id, name, doc_type, page_count, size_kb, content_text, ai_summary, doc_date, province, categories(name, color))';

function normalizeProvinceFilter(province) {
  if (!province) return null;
  const normalized = String(province).trim();
  if (normalized.toLowerCase() === 'toutes provinces') return null;
  return normalized;
}

export async function listQueue({ province = null } = {}) {
  const { data, error } = await supabase
    .from('print_queue')
    .select(QUEUE_SELECT)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const provinceFilter = normalizeProvinceFilter(province);
  if (!provinceFilter) return data;

  return (data ?? []).filter((item) => item.documents?.province === provinceFilter);
}

export async function addToQueue({ documentId, pages = 1 }) {
  const { data, error } = await supabase
    .from('print_queue')
    .insert({ document_id: documentId, pages, status: 'En attente' })
    .select(QUEUE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateQueueStatus(id, status) {
  const { data, error } = await supabase
    .from('print_queue')
    .update({ status })
    .eq('id', id)
    .select(QUEUE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function removeFromQueue(id) {
  const { error } = await supabase.from('print_queue').delete().eq('id', id);
  if (error) throw error;
}
