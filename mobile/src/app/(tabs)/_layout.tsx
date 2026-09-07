import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, type ColorValue } from 'react-native';
import { BRAND_COLORS } from '../../constants/config';

function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrapper}>
      {focused && <View style={styles.activeDot} />}
      <Ionicons name={name} size={22} color={color as string} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND_COLORS.accent,
        tabBarInactiveTintColor: '#71717A',
        tabBarStyle: {
          backgroundColor: '#111114',
          borderTopColor: '#27272A',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: '#09090B',
          borderBottomColor: '#27272A',
          borderBottomWidth: 1,
        },
        headerTintColor: '#FAFAFA',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 17,
          letterSpacing: -0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'musical-notes' : 'musical-notes-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tiket Saya',
          headerTitle: 'Tiket Digital Saya',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'ticket' : 'ticket-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          headerTitle: 'Riwayat Transaksi',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'receipt' : 'receipt-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          headerTitle: 'Akun Saya',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    position: 'relative',
    paddingTop: 3,
  },
  activeDot: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.accent,
  },
});
