import { supabase } from '../lib/supabaseClient';

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}
