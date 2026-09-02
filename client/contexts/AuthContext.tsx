import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { initSupabaseClient, getSupabaseClient, clearSupabaseClient } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigReady: boolean;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signInAsGuest: () => Promise<{ error?: string }>;
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
  signInWithApple: async () => ({}),
  signInAsGuest: async () => ({}),
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

  const signInWithOtp = useCallback(async (email: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) return { error: error.message };
      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
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

  // 测试阶段专用：游客一键登录（调用后端获取真实 session）
  const signInAsGuest = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();

      /**
       * 服务端文件：server/src/routes/auth.ts
       * 接口：POST /api/v1/auth/guest
       * Body 参数：无
       * 返回：access_token: string, refresh_token: string
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        return { error: '游客登录失败，请稍后再试' };
      }
      const data = await response.json();

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) return { error: error.message };

      const { data: { session: newSession } } = await supabase.auth.getSession();
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
      }
      return {};
    } catch (error: any) {
      return { error: error?.message || '游客登录失败' };
    }
  }, []);

  // Sign in with Apple（Supabase signInWithIdToken 一次性令牌交换，无需 deep link 回调）
  const signInWithApple = useCallback(async () => {
    try {
      if (Platform.OS !== 'ios') {
        return { error: 'Apple 登录仅支持 iOS 设备' };
      }

      const supabase = getSupabaseClient();

      // 记录当前游客会话（若有），登录成功后把游客数据迁移到正式账号
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const oldUserId = currentSession?.user?.id ?? null;

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        return { error: '未获取到 Apple 授权凭据' };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) return { error: error.message };

      // Apple 仅在首次授权时返回姓名，立即存入 user_metadata
      const fullName = credential.fullName;
      if (fullName?.familyName || fullName?.givenName) {
        const displayName = [fullName.familyName, fullName.givenName]
          .filter(Boolean)
          .join(' ');
        await supabase.auth.updateUser({ data: { display_name: displayName } });
      }

      // 游客数据迁移（失败不阻塞登录，可下次重试）
      if (oldUserId) {
        const { data: { session: mergedSession } } = await supabase.auth.getSession();
        if (mergedSession?.access_token) {
          /**
           * 服务端文件：server/src/routes/auth.ts
           * 接口：POST /api/v1/auth/merge-guest
           * Header 参数：Authorization: Bearer <access_token>（新账号）
           * Body 参数：oldUserId: string（旧游客 user id）
           * 返回：{ merged: boolean, moved: Record<string, number> }
           */
          await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/merge-guest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mergedSession.access_token}`,
            },
            body: JSON.stringify({ oldUserId }),
          }).catch(() => { /* 迁移失败不阻塞登录 */ });
        }
      }

      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) {
        setSession(finalSession);
        setUser(finalSession.user);
      }
      return {};
    } catch (error: any) {
      // 用户在 Apple 弹窗中点取消，不算错误
      if (error?.code === 'ERR_CANCELED') return {};
      return { error: error?.message || 'Apple 登录失败' };
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
        signInWithApple,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
