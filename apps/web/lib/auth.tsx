'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<User>;
  applyAsSeller: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    storeName: string;
    description?: string;
    businessContact?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const result = await api<{ user: User }>('/auth/me');
      setUser(result.user);
    } catch {
      try {
        const result = await api<{ user: User }>('/auth/refresh', { method: 'POST' });
        setUser(result.user);
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await api<{ user: User }>('/auth/me');
        if (active) setUser(result.user);
      } catch {
        try {
          const result = await api<{ user: User }>('/auth/refresh', { method: 'POST' });
          if (active) setUser(result.user);
        } catch {
          if (active) setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    const onExpired = () => setUser(null);
    window.addEventListener('markethub:session-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('markethub:session-expired', onExpired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; phone?: string }) => {
      const result = await api<{ user: User }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      setUser(result.user);
      return result.user;
    },
    [],
  );

  const applyAsSeller = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      storeName: string;
      description?: string;
      businessContact?: string;
    }) => {
      const result = await api<{ user: User }>('/auth/seller/apply', {
        method: 'POST',
        body: input,
      });
      setUser(result.user);
      return result.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      applyAsSeller,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, register, applyAsSeller, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
