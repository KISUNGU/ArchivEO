import { supabase } from '../lib/supabaseClient';

const cle = (a) => `${a.code}::${a.piece_type || ''}`;

/** Anomalies d'un document, les plus graves d'abord. */
export async function listAnomalies(documentId) {
  if (!documentId) return [];
  const { data, error } = await supabase
    .from('document_anomalies')
    .select('*')
    .eq('document_id', documentId)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const ordre = { majeure: 0, moyenne: 1, mineure: 2 };
  return (data ?? []).sort((a, b) => ordre[a.severity] - ordre[b.severity]);
}

/**
 * Synchronise les anomalies d'un document après une (ré)analyse.
 * Les anomalies déjà levées avec justification sont conservées ;
 * celles qui ont disparu de l'analyse sont retirées.
 */
export async function saveAnomalies(documentId, anomalies = []) {
  if (!documentId) return [];

  const { data: existantes, error: errLecture } = await supabase
    .from('document_anomalies')
    .select('id, code, piece_type, resolved_at')
    .eq('document_id', documentId);
  if (errLecture) throw errLecture;

  const connues = new Set((existantes ?? []).map(cle));
  const actuelles = new Set(anomalies.map(cle));

  const obsoletes = (existantes ?? [])
    .filter((e) => !actuelles.has(cle(e)))
    .map((e) => e.id);
  if (obsoletes.length) {
    const { error } = await supabase.from('document_anomalies').delete().in('id', obsoletes);
    if (error) throw error;
  }

  const nouvelles = anomalies
    .filter((a) => !connues.has(cle(a)))
    .map((a) => ({ ...a, document_id: documentId }));
  if (nouvelles.length) {
    const { error } = await supabase.from('document_anomalies').insert(nouvelles);
    if (error) throw error;
  }

  return listAnomalies(documentId);
}

/** Lève une anomalie en la justifiant — elle reste tracée, elle n'est pas supprimée. */
export async function resolveAnomalie(id, note, userId = null) {
  const { data, error } = await supabase
    .from('document_anomalies')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_note: note || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reopenAnomalie(id) {
  const { data, error } = await supabase
    .from('document_anomalies')
    .update({ resolved_at: null, resolved_by: null, resolution_note: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Compteurs d'anomalies ouvertes pour une liste de documents (badges). */
export async function countOpenAnomalies(documentIds = []) {
  if (!documentIds.length) return {};
  const { data, error } = await supabase
    .from('document_anomalies')
    .select('document_id, severity')
    .in('document_id', documentIds)
    .is('resolved_at', null);
  if (error) return {};

  return (data ?? []).reduce((acc, row) => {
    const courant = acc[row.document_id] || { majeure: 0, moyenne: 0, mineure: 0, total: 0 };
    courant[row.severity] += 1;
    courant.total += 1;
    return { ...acc, [row.document_id]: courant };
  }, {});
}

/** Indicateurs S&E des liasses financières — alimente le tableau de bord. */
export async function getFinanceStats({ province = null } = {}) {
  let query = supabase.from('v_finance_liasses').select('*');
  if (province && province !== 'Toutes provinces') query = query.eq('province', province);

  const { data, error } = await query;
  if (error) return { total: 0, conformes: 0, tauxConformite: 0, montantTotalCents: 0, anomaliesOuvertes: 0, liasses: [] };

  const liasses = data ?? [];
  const conformes = liasses.filter((l) => l.conforme).length;
  return {
    total: liasses.length,
    conformes,
    tauxConformite: liasses.length ? Math.round((conformes / liasses.length) * 100) : 0,
    montantTotalCents: liasses.reduce((acc, l) => acc + Number(l.montant_total_cents || 0), 0),
    anomaliesOuvertes: liasses.reduce((acc, l) => acc + Number(l.nb_anomalies || 0), 0),
    liasses,
  };
}
