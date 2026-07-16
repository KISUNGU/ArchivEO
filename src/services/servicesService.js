import { supabase } from '../lib/supabaseClient';

/** Regroupements avec leurs services imbriqués (pour les <optgroup> des formulaires). */
export async function listServiceGroups() {
  const { data, error } = await supabase
    .from('service_groups')
    .select('id, name, services(id, name)')
    .order('name');
  if (error) throw error;
  // trie les services de chaque groupe par nom
  return (data || []).map(g => ({
    ...g,
    services: (g.services || []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Liste plate de tous les services (pour l'agent IA et les correspondances). */
export async function listServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, group_id, service_groups(name)')
    .order('name');
  if (error) throw error;
  return data || [];
}

// ── Gestion (écran Paramètres) ──────────────────────────────────────────────

export async function createServiceGroup(name) {
  const { data, error } = await supabase
    .from('service_groups').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function renameServiceGroup(id, name) {
  const { error } = await supabase.from('service_groups').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteServiceGroup(id) {
  const { error } = await supabase.from('service_groups').delete().eq('id', id);
  if (error) throw error;
}

export async function createService(name, groupId) {
  const { data, error } = await supabase
    .from('services').insert({ name, group_id: groupId || null }).select().single();
  if (error) throw error;
  return data;
}

export async function renameService(id, name) {
  const { error } = await supabase.from('services').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteService(id) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}
