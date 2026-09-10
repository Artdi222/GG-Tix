import React, { useEffect } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useAuthStore } from '../store/auth-store';
import { View, ActivityIndicator } from 'react-native';
import { listenToNotifications } from '../services/notifications';
import { BRAND_COLORS } from '../constants/config';

export default function RootLayout() {
  const router = useRouter();
  const { isInitialized, initializeAuth, user } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isInitialized || !user?.id) return;
    let stopped = false;
    let cleanup: (() => void) | undefined;
    void listenToNotifications(path => router.push(path as Href)).then(dispose => { if (stopped) dispose(); else cleanup = dispose; }).catch(() => {});
    return () => { stopped = true; cleanup?.(); };
  }, [isInitialized, user?.id, router]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND_COLORS.bgDark }}>
        <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: BRAND_COLORS.bgDark },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="checkout/[id]" />
      <Stack.Screen name="ticket/[id]" />
      <Stack.Screen name="payment/[id]" />
    </Stack>
  );
}
