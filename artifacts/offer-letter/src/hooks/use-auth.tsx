import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  role: 'recruiter' | 'hr_admin' | 'system_admin';
  email: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (minRole: 'recruiter' | 'hr_admin' | 'system_admin') => boolean;
  isAdmin: boolean;
}

const ROLE_RANK = { recruiter: 1, hr_admin: 2, system_admin: 3 } as const;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function apiBase() {
  // Prefix relative to the app's base path
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    fetch(`${apiBase()}/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setState({ user: data ?? null, loading: false }))
      .catch(() => setState({ user: null, loading: false }));
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
        setState({ user, loading: false });
        return { ok: true };
      }
      const err = await r.json().catch(() => ({ error: 'Login failed.' }));
      return { ok: false, error: err.error ?? 'Login failed.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${apiBase()}/auth/logout`, { method: 'POST', credentials: 'include' });
    setState({ user: null, loading: false });
  }, []);

  const hasRole = useCallback((minRole: 'recruiter' | 'hr_admin' | 'system_admin') => {
    if (!state.user) return false;
    return (ROLE_RANK[state.user.role] ?? 0) >= ROLE_RANK[minRole];
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      hasRole,
      isAdmin: state.user ? ROLE_RANK[state.user.role] >= ROLE_RANK.hr_admin : false,
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
