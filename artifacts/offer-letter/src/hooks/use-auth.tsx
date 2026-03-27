import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  role: string; // canonical: 'user' | 'admin' (legacy: recruiter | hr_admin | system_admin)
  email: string | null;
  site: string | null;
  mustResetPassword: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; mustResetPassword?: boolean }>;
  logout: () => Promise<void>;
  completeSetup: (user: AuthUser) => void;
  passwordReset: () => void;
  hasRole: (minRole: 'admin' | 'user') => boolean;
  isAdmin: boolean;
}

const ADMIN_ROLES = new Set(['admin', 'system_admin', 'hr_admin']);

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, needsSetup: false });

  useEffect(() => {
    Promise.all([
      fetch(`${apiBase()}/auth/setup-status`).then(r => r.ok ? r.json() : { needsSetup: false }),
      fetch(`${apiBase()}/auth/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([setup, me]) => {
      setState({ user: me ?? null, loading: false, needsSetup: setup.needsSetup ?? false });
    }).catch(() => {
      setState({ user: null, loading: false, needsSetup: false });
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const r = await fetch(`${apiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        const user = await r.json();
        setState(s => ({ ...s, user, loading: false, needsSetup: false }));
        return { ok: true, mustResetPassword: user.mustResetPassword ?? false };
      }
      const err = await r.json().catch(() => ({ error: 'Login failed.' }));
      return { ok: false, error: err.error ?? 'Login failed.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${apiBase()}/auth/logout`, { method: 'POST', credentials: 'include' });
    setState(s => ({ ...s, user: null, loading: false }));
  }, []);

  const completeSetup = useCallback((user: AuthUser) => {
    setState({ user, loading: false, needsSetup: false });
  }, []);

  const passwordReset = useCallback(() => {
    setState(s => s.user ? { ...s, user: { ...s.user, mustResetPassword: false } } : s);
  }, []);

  const hasRole = useCallback((minRole: 'admin' | 'user') => {
    if (!state.user) return false;
    if (minRole === 'admin') return ADMIN_ROLES.has(state.user.role);
    return true;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      completeSetup,
      passwordReset,
      hasRole,
      isAdmin: state.user ? ADMIN_ROLES.has(state.user.role) : false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
