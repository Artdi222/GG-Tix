import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        // Each tab renders its own safe-area header, so the navigator header would only duplicate the title.
        headerShown: false,
        tabBarActiveTintColor: BRAND_COLORS.accent,
        tabBarInactiveTintColor: '#71717A',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E4E4E7',
          borderTopWidth: 1,
          // Grows with the home-indicator inset instead of clipping labels under it.
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: {
          // Fixed line height: the label box is clipped, so "normal" leading cut off descenders.
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 0,
        },
        headerStyle: {
          backgroundColor: '#F6F6F8',
          borderBottomColor: '#E4E4E7',
          borderBottomWidth: 1,
        },
        headerTintColor: '#18181B',
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
