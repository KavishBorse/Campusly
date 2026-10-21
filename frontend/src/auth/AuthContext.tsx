import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Role = 'admin' | 'club' | 'student' | 'external';

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  enrollmentId: string | null;
  role: Role;
  accountType: 'staff' | 'club' | 'internal' | 'external';
  mustChangePassword: boolean;
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<CurrentUser>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<CurrentUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = await response.json() as { user: CurrentUser };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Sign-in failed. Try again.'));
    const data = await response.json() as { user: CurrentUser };
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await fetch('/api/auth/password', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Could not update your password.'));
    const data = await response.json() as { user: CurrentUser };
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, signIn, signOut, changePassword }), [
    user, loading, refresh, signIn, signOut, changePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
