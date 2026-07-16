import { supabase } from '../lib/supabaseClient';

// ── Conversations ───────────────────────────────────────────────────────────

export async function listConversations() {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*, documents(name)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createConversation({ title = 'Nouvelle discussion', documentId = null } = {}) {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ title: title.slice(0, 80), document_id: documentId })
    .select('*, documents(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function touchConversation(id) {
  await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function deleteConversation(id) {
  // les messages sont supprimés en cascade
  const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
  if (error) throw error;
}

// ── Messages ────────────────────────────────────────────────────────────────

export async function listMessages(conversationId) {
  if (!conversationId) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addMessage({ conversationId, documentId = null, role, content }) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, document_id: documentId, role, content })
    .select('*')
    .single();
  if (error) throw error;
  touchConversation(conversationId);
  return data;
}
