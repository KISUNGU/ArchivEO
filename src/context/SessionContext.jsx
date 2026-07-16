import React, { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'archiveo-session';
const ACCOUNTS_KEY = 'archiveo-accounts';

const DEFAULT_ACCOUNTS = [
  {
    id: 'kinshasa-admin',
    name: 'Administration nationale',
    email: 'admin@kinshasa.cd',
    password: 'admin123',
    role: 'national',
    province: 'Kinshasa',
    accessLevel: 'admin',
    canManageUsers: false,
  },
  {
    id: 'kwilu-user',
    name: 'UPE Kwilu',
    email: 'kwilu@archiveo.cd',
    password: 'kwilu123',
    role: 'province',
    province: 'Kwilu',
    accessLevel: 'admin',
    canManageUsers: false,
  },
  {
    id: 'kasai-user',
    name: 'UPE Kasaï',
    email: 'kasai@archiveo.cd',
    password: 'kasai123',
    role: 'province',
    province: 'Kasaï',
    accessLevel: 'admin',
    canManageUsers: false,
  },
  {
    id: 'kasai-central-user',
    name: 'UPE Kasaï Central',
    email: 'kasaicentral@archiveo.cd',
    password: 'kasaicentral123',
    role: 'province',
    province: 'Kasaï Central',
    accessLevel: 'admin',
    canManageUsers: false,
  },
  {
    id: 'super-admin',
    name: 'Super Admin',
    email: 'super@archiveo.cd',
    password: 'super123',
    role: 'super_admin',
    province: 'Toutes provinces',
    accessLevel: 'admin',
    canManageUsers: true,
  },
];

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [accounts, setAccounts] = useState(() => {
    const stored = safeRead(ACCOUNTS_KEY, DEFAULT_ACCOUNTS);
    return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_ACCOUNTS;
  });
  const [session, setSession] = useState(() => safeRead(STORAGE_KEY, null));

  const persistAccounts = (nextAccounts) => {
    setAccounts(nextAccounts);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  };

  const signIn = (email, password) => {
    const account = accounts.find((item) => item.email.toLowerCase() === String(email).trim().toLowerCase() && item.password === String(password));

    if (!account) {
      throw new Error('Identifiants incorrects. Vérifie le compte choisi dans la liste proposée.');
    }

    const safeSession = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      province: account.province,
      accessLevel: account.accessLevel || 'admin',
      canManageUsers: account.canManageUsers,
    };

    setSession(safeSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSession));
    return safeSession;
  };

  const signOut = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const createAccount = (payload) => {
    const nextAccount = {
      id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
      password: payload.password?.trim(),
      role: payload.role || 'province',
      province: payload.province || 'Kinshasa',
      accessLevel: payload.accessLevel === 'user' ? 'user' : 'admin',
      canManageUsers: false,
    };

    if (!nextAccount.name || !nextAccount.email || !nextAccount.password) {
      throw new Error('Le nom, l’email et le mot de passe sont obligatoires.');
    }

    if (accounts.some((item) => item.email.toLowerCase() === nextAccount.email)) {
      throw new Error('Un compte existe déjà avec cet email.');
    }

    const nextAccounts = [...accounts, nextAccount];
    persistAccounts(nextAccounts);
    return nextAccount;
  };

  const deleteAccount = (accountId) => {
    const nextAccounts = accounts.filter((item) => item.id !== accountId);
    persistAccounts(nextAccounts);
    if (session?.id === accountId) {
      signOut();
    }
  };

  const value = useMemo(() => ({
    accounts,
    session,
    signIn,
    signOut,
    createAccount,
    deleteAccount,
    isSuperAdmin: session?.role === 'super_admin',
    canDeleteDocuments: session?.role === 'super_admin' || (session?.accessLevel || 'admin') !== 'user',
  }), [accounts, session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession doit être utilisé à l’intérieur de SessionProvider');
  }
  return context;
}
