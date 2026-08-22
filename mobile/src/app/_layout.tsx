import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/auth-store';
import { View, ActivityIndicator } from 'react-native';
import { BRAND_COLORS } from '../constants/config';

export default function RootLayout() {
  const { isInitialized, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

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
    </Stack>
  );
}
