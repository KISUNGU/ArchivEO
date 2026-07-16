import { supabase } from '../lib/supabaseClient';

export async function logActivity({ documentId = null, action, detail = null }) {
  const { error } = await supabase
    .from('activity_log')
    .insert({ document_id: documentId, action, detail });
  if (error) throw error;
}

export async function listRecentActivity(limit = 20) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, documents(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function countActivityByAction(action, sinceISODate) {
  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', action);
  if (sinceISODate) query = query.gte('created_at', sinceISODate);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function listActivitySince(sinceISODate) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('action, created_at')
    .gte('created_at', sinceISODate);
  if (error) throw error;
  return data;
}
