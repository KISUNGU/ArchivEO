import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Nettoyage des anciennes clés localStorage (contenaient les mots de passe en clair
// de l'ancien système d'authentification côté navigateur).
try {
  localStorage.removeItem('archiveo-session');
  localStorage.removeItem('archiveo-accounts');
} catch {
  // stockage inaccessible : rien à nettoyer
}

function toSession(user) {
  if (!user) return null;
  const meta = user.app_metadata || {};
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email,
    email: user.email,
    role: meta.role || 'province',
    province: meta.province || 'Kinshasa',
    accessLevel: meta.accessLevel || 'admin',
    canManageUsers: meta.role === 'super_admin',
  };
}

async function invokeManageUsers(body) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) {
    // supabase-js masque le corps de la réponse en cas de statut d'erreur :
    // on tente de le récupérer pour afficher un message utile.
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      // corps illisible : on garde le message générique
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(toSession(data.session?.user || null)))
      .finally(() => setInitializing(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSession(toSession(authSession?.user || null));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    });
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? 'Identifiants incorrects. Vérifiez l’email et le mot de passe.'
          : error.message
      );
    }
    const nextSession = toSession(data.user);
    setSession(nextSession);
    return nextSession;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAccounts([]);
  };

  const refreshAccounts = async () => {
    const data = await invokeManageUsers({ action: 'list' });
    const users = data?.users || [];
    setAccounts(users);
    return users;
  };

  const createAccount = async (payload) => {
    const province = payload.province || 'Kinshasa';
    const data = await invokeManageUsers({
      action: 'create',
      payload: {
        name: payload.name?.trim(),
        email: payload.email?.trim().toLowerCase(),
        password: payload.password,
        role: payload.role || (province === 'Kinshasa' ? 'national' : 'province'),
        province,
        accessLevel: payload.accessLevel === 'user' ? 'user' : 'admin',
      },
    });
    await refreshAccounts();
    return data?.user;
  };

  const deleteAccount = async (accountId) => {
    await invokeManageUsers({ action: 'delete', payload: { userId: accountId } });
    await refreshAccounts();
  };

  const value = useMemo(() => ({
    accounts,
    session,
    initializing,
    signIn,
    signOut,
    createAccount,
    deleteAccount,
    refreshAccounts,
    isSuperAdmin: session?.role === 'super_admin',
    canDeleteDocuments: session?.role === 'super_admin' || (session?.accessLevel || 'admin') !== 'user',
  }), [accounts, session, initializing]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession doit être utilisé à l’intérieur de SessionProvider');
  }
  return context;
}
