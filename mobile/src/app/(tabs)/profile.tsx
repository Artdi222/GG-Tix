import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store';
import { BRAND_COLORS } from '../../constants/config';

export default function ProfileScreen() {
  const { user, token, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Keluar dari Akun', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  if (!token) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-circle-outline" size={70} color={BRAND_COLORS.accent} />
        <Text style={styles.promptTitle}>Akun Pengguna</Text>
        <Text style={styles.promptSub}>
          Masuk atau daftar untuk mengakses fitur lengkap GG Tix Concerts.
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginBtnText}>Masuk / Daftar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || 'Customer').charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.name}>{user?.name || 'Customer GG Tix'}</Text>
        <Text style={styles.email}>{user?.email || 'customer@ggtix.com'}</Text>

        <View style={styles.accountBadge}>
          <Text style={styles.accountBadgeText}>AKUN CUSTOMER RESMI</Text>
        </View>
      </View>

      {/* Menu Options */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Pengaturan & Info</Text>

        <View style={styles.menuCard}>

          <View style={styles.menuItem}>
            <View style={styles.menuIconWrapper}>
              <Ionicons name="shield-checkmark-outline" size={18} color={BRAND_COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Kebijakan Privasi</Text>
              <Text style={styles.menuSub}>Perlindungan data dan tiket</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BRAND_COLORS.muted} />
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <View style={styles.menuIconWrapper}>
              <Ionicons name="help-circle-outline" size={18} color={BRAND_COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Bantuan & FAQ</Text>
              <Text style={styles.menuSub}>Panduan scan dan pembayaran</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BRAND_COLORS.muted} />
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#FF453A" />
        <Text style={styles.logoutText}>Keluar dari Akun</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>GG Tix Mobile v1.0.0 (Expo SDK 57)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  promptSub: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  loginBtnText: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  profileCard: {
    backgroundColor: BRAND_COLORS.cardBg,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND_COLORS.primary,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: BRAND_COLORS.textMuted,
    marginBottom: 12,
  },
  accountBadge: {
    backgroundColor: 'rgba(242, 169, 59, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND_COLORS.accent,
  },
  accountBadgeText: {
    color: BRAND_COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: BRAND_COLORS.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(242, 169, 59, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuSub: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 62,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    marginBottom: 20,
  },
  logoutText: {
    color: '#FF453A',
    fontSize: 15,
    fontWeight: 'bold',
  },
  versionText: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
