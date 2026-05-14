import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authService } from '../services/authService';

interface AuthContextValue {
  user: User | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithYandex: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    authService.getInitialSession()
      .then(({ user }) => {
        if (!mounted) return;
        setUser(user);
      })
      .catch((error: any) => {
        if (!mounted) return;
        setError(error?.message || 'Не удалось восстановить сессию');
      })
      .finally(() => {
        if (!mounted) return;
        setIsReady(true);
        setIsLoading(false);
      });

    const unsubscribe = authService.onAuthStateChange((_session, nextUser) => {
      setUser(nextUser);
      setIsReady(true);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isReady,
    isLoading,
    error,
    signInWithYandex: async () => {
      setError(null);
      setIsLoading(true);
      try {
        await authService.signInWithYandex();
      } catch (error: any) {
        setError(error?.message || 'Ошибка входа через Яндекс');
        setIsLoading(false);
      }
    },
    signInWithEmail: async (email: string, password: string) => {
      setError(null);
      setIsLoading(true);
      try {
        await authService.signInWithEmail(email, password);
      } catch (error: any) {
        setError(error?.message || 'Ошибка входа');
        setIsLoading(false);
        throw error;
      }
    },
    signUpWithEmail: async (email: string, password: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const result = await authService.signUpWithEmail(email, password);
        if (result.needsEmailConfirmation) setIsLoading(false);
        return result;
      } catch (error: any) {
        setError(error?.message || 'Ошибка регистрации');
        setIsLoading(false);
        throw error;
      }
    },
    signOut: async () => {
      setError(null);
      setIsLoading(true);
      try {
        await authService.signOut();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    },
    clearError: () => setError(null),
  }), [user, isReady, isLoading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthSession = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthSession must be used within AuthProvider');
  return context;
};
