import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useSegments, useRootNavigationState } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useSafeRouter();
  const segments = useSegments();
  const rootState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (!rootState?.key || isLoading) return;
    if (navigatingRef.current) return;

    const inLoginRoute = segments.includes('login');
    const inTabsRoute = segments.includes('(tabs)');

    if (!isAuthenticated && !inLoginRoute) {
      navigatingRef.current = true;
      router.replace('/login');
    } else if (isAuthenticated && !inTabsRoute) {
      navigatingRef.current = true;
      router.replace('/(tabs)');
    }
  }, [rootState?.key, isAuthenticated, isLoading, segments]);

  useEffect(() => {
    navigatingRef.current = false;
  });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EDFA' }}>
      <ActivityIndicator size="large" color="#7C5CFC" />
    </View>
  );
}
