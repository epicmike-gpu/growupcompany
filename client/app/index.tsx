import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSegments, useRootNavigationState } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useSafeRouter();
  const segments = useSegments();
  const rootState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!rootState?.key || isLoading) return;

    const inLoginRoute = segments.includes('login');
    const inTabsRoute = segments.includes('(tabs)');

    if (!isAuthenticated && !inLoginRoute) {
      router.replace('/login');
    } else if (isAuthenticated && !inTabsRoute) {
      router.replace('/');
    }
  }, [rootState?.key, isAuthenticated, isLoading, segments]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EDFA' }}>
      <ActivityIndicator size="large" color="#7C5CFC" />
    </View>
  );
}
