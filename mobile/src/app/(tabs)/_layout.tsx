import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_COLORS } from '../../constants/config';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND_COLORS.accent,
        tabBarInactiveTintColor: BRAND_COLORS.muted,
        tabBarStyle: {
          backgroundColor: BRAND_COLORS.primary,
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: BRAND_COLORS.primary,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          borderBottomWidth: 1,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          headerTitle: 'GG Tix Concerts',
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tiket Saya',
          headerTitle: 'Tiket Digital Saya',
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          headerTitle: 'Riwayat Transaksi',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          headerTitle: 'Akun Saya',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
