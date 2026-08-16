import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { initSupabaseClient, getSupabaseClient, clearSupabaseClient } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigReady: boolean;
  signInWithOtp: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isConfigReady: false,
  signInWithOtp: async () => ({}),
  verifyOtp: async () => ({}),
  signOut: async () => { return; },
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigReady, setIsConfigReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initSupabaseClient();
        if (!mounted) return;
        setIsConfigReady(true);

        const supabase = getSupabaseClient();
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        supabase.auth.onAuthStateChange((_event, newSession) => {
          if (!mounted) return;
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const signInWithOtp = useCallback(async (phone: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: '+86' + phone,
      });
      if (error) return { error: error.message };
      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: '+86' + phone,
        token,
        type: 'sms',
      });
      if (error) return { error: error.message };

      // Manually update session and user to ensure synchronous state update
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      clearSupabaseClient();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        isConfigReady,
        signInWithOtp,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
