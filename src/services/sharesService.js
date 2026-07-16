import { supabase } from '../lib/supabaseClient';

function normalizeProvinceFilter(province) {
  if (!province) return null;
  const normalized = String(province).trim();
  if (normalized.toLowerCase() === 'toutes provinces') return null;
  return normalized;
}

export async function listShares({ province = null } = {}) {
  const { data, error } = await supabase
    .from('shares')
    .select('*, documents(name, province)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const provinceFilter = normalizeProvinceFilter(province);
  if (!provinceFilter) return data;

  return (data ?? []).filter((item) => item.documents?.province === provinceFilter);
}

export async function createShare({ documentId, sharedWith, accessLevel = 'Lecture', expiresAt = null }) {
  const { data, error } = await supabase
    .from('shares')
    .insert({
      document_id: documentId,
      shared_with: sharedWith,
      access_level: accessLevel,
      expires_at: expiresAt,
    })
    .select('*, documents(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShare(id) {
  const { error } = await supabase.from('shares').delete().eq('id', id);
  if (error) throw error;
}
