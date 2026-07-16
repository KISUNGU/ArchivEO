import { supabase } from '../lib/supabaseClient';

export async function getFraisByQueueId(queueId) {
  const { data, error } = await supabase
    .from('frais')
    .select('*')
    .eq('queue_id', queueId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createFrais(queueId, fraisData) {
  const { data, error } = await supabase
    .from('frais')
    .insert({ queue_id: queueId, ...fraisData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFrais(fraisId, payload) {
  const { data, error } = await supabase
    .from('frais')
    .update(payload)
    .eq('id', fraisId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFrais(fraisId) {
  const { error } = await supabase.from('frais').delete().eq('id', fraisId);
  if (error) throw error;
}

export async function addMultipleFrais(queueId, fraisArray) {
  const { data, error } = await supabase
    .from('frais')
    .insert(fraisArray.map(f => ({ queue_id: queueId, ...f })))
    .select();
  if (error) throw error;
  return data;
}
