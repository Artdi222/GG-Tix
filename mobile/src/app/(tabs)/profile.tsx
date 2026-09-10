import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/auth-store';
import { BRAND_COLORS } from '../../constants/config';
import { apiFetch } from '../../services/api';
import { session, type SessionUser } from '../../services/session';
import { registerForPushNotificationsAsync, disablePushNotifications, isPushEnabled } from '../../services/notifications';

export default function ProfileScreen() {
  const { user, token, logout } = useAuthStore();
  const [stats, setStats] = useState<{ activeTickets: number; totalOrders: number }>({
    activeTickets: 0,
    totalOrders: 0,
  });

  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Change password modal state
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const openPasswordModal = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setIsPasswordModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Semua kolom kata sandi wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      await apiFetch<any>('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword: confirmPassword,
        }),
      });

      setPasswordSuccess('Kata sandi berhasil diubah!');
      setTimeout(() => {
        setIsPasswordModalVisible(false);
      }, 1200);
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah kata sandi');
    } finally {
      setPasswordLoading(false);
    }
  };

  const [support, setSupport] = useState<{ supportEmail: string; supportWhatsapp: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setStats({ activeTickets: 0, totalOrders: 0 });
    setNotice('');
    if (token) {
      void apiFetch<{ activeTickets: number; totalOrders: number }>('/orders/me/summary').then(value => { if (active) setStats(value); }).catch(() => { if (active) setNotice('Statistik belum tersedia. Buka kembali halaman untuk mencoba lagi.'); });
      void isPushEnabled().then(value => { if (active) setPushEnabled(value); });
    }
    void apiFetch<{ supportEmail: string; supportWhatsapp: string }>('/settings/public').then(value => { if (active) setSupport(value); }).catch(() => {});
    return () => { active = false; };
  }, [token]));
  const saveProfile = async () => {
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setProfileError('Isi nama dan email yang valid.'); return; }
    setSaving(true); setProfileError('');
    const revision = session.snapshot().revision;
    try {
      const profile = await apiFetch<SessionUser>('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), email: email.trim() }) });
      await session.updateUser(profile, revision);
      setEditProfile(false); setNotice('Profil berhasil diperbarui.');
    } catch (err) { setProfileError(err instanceof Error ? err.message : 'Profil gagal disimpan.'); }
    finally { setSaving(false); }
  };
  const togglePush = async () => {
    setPushLoading(true); setNotice('');
    try {
      if (pushEnabled) await disablePushNotifications(); else await registerForPushNotificationsAsync();
      setPushEnabled(!pushEnabled); setNotice(pushEnabled ? 'Notifikasi dinonaktifkan.' : 'Notifikasi pembayaran, pengingat acara, dan konser baru aktif.');
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Pengaturan notifikasi gagal.'); }
    finally { setPushLoading(false); }
  };
  const exitAccount = async () => {
    try { if (await isPushEnabled()) await disablePushNotifications(); await logout(); router.replace('/auth/login'); }
    catch { setNotice('Gagal menutup sesi perangkat. Periksa koneksi dan coba keluar lagi.'); }
  };

  const handleLogout = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Yakin ingin keluar dari akun ini?') : true;
      if (confirmed) {
        await exitAccount();
      }
      return;
    }

    Alert.alert(
      'Keluar dari Akun',
      'Sesi Anda akan diakhiri. Anda perlu masuk kembali untuk mengakses e-tiket.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            await exitAccount();
          },
        },
      ]
    );
  };

  const handleMenuPress = (title: string, message: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`); else Alert.alert(title, message);
  };

  if (!token) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.guestIconWrap}>
          <Ionicons name="person-outline" size={40} color={BRAND_COLORS.accent} />
        </View>
        <Text style={styles.promptTitle}>Profil Akun Saya</Text>
        <Text style={styles.promptSub}>
          Masuk ke akun GG-Tix Anda untuk mengakses tiket konser, riwayat transaksi, dan pengaturan keamanan.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/auth/login')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Masuk ke Akun"
        >
          <Text style={styles.loginBtnText}>Masuk ke Akun</Text>
          <Ionicons name="arrow-forward" size={16} color="#09090B" />
        </TouchableOpacity>
      </View>
    );
  }

  const initials = (user?.name || 'Customer').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) + (Platform.OS === 'android' ? 6 : 2) }]}>
        <View>
          <Text style={styles.headerTitle}>Akun Saya</Text>
          <Text style={styles.headerSub}>Profil, keamanan & preferensi aplikasi</Text>
        </View>
        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark" size={11} color={BRAND_COLORS.success} />
          <Text style={styles.securityBadgeText}>ENCRYPTED</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileInfoCol}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || 'Customer GG-Tix'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email || 'customer@ggtix.com'}
              </Text>
              <View style={styles.memberPill}>
                <Ionicons name="star" size={11} color={BRAND_COLORS.accent} />
                <Text style={styles.memberPillText}>MEMBER RESMI GG-TIX</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryBar}>
            <TouchableOpacity
              style={styles.summaryItem}
              onPress={() => router.push('/(tabs)/tickets')}
              activeOpacity={0.75}
            >
              <Text style={styles.summaryValue}>{stats.activeTickets}</Text>
              <Text style={styles.summaryLabel}>Tiket Aktif</Text>
            </TouchableOpacity>

            <View style={styles.summaryDivider} />

            <TouchableOpacity
              style={styles.summaryItem}
              onPress={() => router.push('/(tabs)/history')}
              activeOpacity={0.75}
            >
              <Text style={styles.summaryValue}>{stats.totalOrders}</Text>
              <Text style={styles.summaryLabel}>Riwayat Order</Text>
            </TouchableOpacity>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: BRAND_COLORS.success }]}>Aktif</Text>
              <Text style={styles.summaryLabel}>Status Akun</Text>
            </View>
          </View>
        </View>

        {notice ? <Text style={{ color: '#F2A93B', padding: 16 }}>{notice}</Text> : null}
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setName(user?.name || ''); setEmail(user?.email || ''); setProfileError(''); setEditProfile(true); }} accessibilityRole="button">
            <Ionicons name="person-outline" size={20} color={BRAND_COLORS.accent} /><View style={styles.menuTextCol}><Text style={styles.menuTitle}>Edit Profil</Text><Text style={styles.menuDesc}>Perbarui nama dan email akun</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={togglePush} disabled={pushLoading} accessibilityRole="switch" accessibilityState={{ checked: pushEnabled, disabled: pushLoading }}>
            <Ionicons name="notifications-outline" size={20} color={BRAND_COLORS.accent} /><View style={styles.menuTextCol}><Text style={styles.menuTitle}>Notifikasi {pushEnabled ? 'Aktif' : 'Nonaktif'}</Text><Text style={styles.menuDesc}>{pushLoading ? 'Memproses...' : 'Pembayaran, pengingat H-1, dan konser baru'}</Text></View>
          </TouchableOpacity>
          {support ? <>
            <TouchableOpacity style={styles.menuItem} onPress={() => void Linking.openURL(`mailto:${support.supportEmail}`).catch(() => setNotice('Aplikasi email tidak tersedia.'))}><Text style={styles.menuTitle}>{support.supportEmail}</Text></TouchableOpacity>
            {support.supportWhatsapp ? <TouchableOpacity style={styles.menuItem} onPress={() => void Linking.openURL(`https://wa.me/${support.supportWhatsapp.replace(/\D/g, '')}`).catch(() => setNotice('WhatsApp tidak dapat dibuka.'))}><Text style={styles.menuTitle}>Hubungi Bantuan WhatsApp</Text></TouchableOpacity> : null}
          </> : null}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>PENGATURAN & KEAMANAN</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={openPasswordModal}
              activeOpacity={0.75}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="key-outline" size={18} color={BRAND_COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Ubah Kata Sandi</Text>
                <Text style={styles.menuDesc}>Perbarui kata sandi akun secara berkala</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleMenuPress(
                  'Privasi & Keamanan',
                  'Seluruh data transaksi dan barcode e-tiket dilindungi enkripsi standar industri dan tersimpan aman di perangkat Anda.'
                )
              }
              activeOpacity={0.75}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="lock-closed-outline" size={18} color={BRAND_COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Privasi & Keamanan Data</Text>
                <Text style={styles.menuDesc}>Enkripsi data dan proteksi e-tiket resmi</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>PUSAT BANTUAN & LEGAL</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleMenuPress(
                  'Bantuan & FAQ Check-in Gate',
                  'Tunjukkan QR Code di layar e-tiket kepada petugas gate saat memasuki konser. Kecerahan layar akan otomatis disesuaikan secara maksimal.'
                )
              }
              activeOpacity={0.75}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="help-circle-outline" size={18} color={BRAND_COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Bantuan & FAQ Check-in</Text>
                <Text style={styles.menuDesc}>Panduan pemindaian tiket di pintu masuk venue</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleMenuPress(
                  'Syarat & Ketentuan Konser',
                  'Tiket yang telah dibeli tidak dapat ditukar atau dikembalikan kecuali terjadi pembatalan resmi oleh pihak promotor acara.'
                )
              }
              activeOpacity={0.75}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="document-text-outline" size={18} color={BRAND_COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Syarat & Ketentuan</Text>
                <Text style={styles.menuDesc}>Aturan pembelian dan regulasi venue acara</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleMenuPress(
                  'Tentang GG-Tix',
                  'GG-Tix adalah platform pemesanan tiket resmi untuk konser gaming, anime, dan pop culture di Indonesia.'
                )
              }
              activeOpacity={0.75}
            >
              <View style={styles.menuIconBox}>
                <Ionicons name="information-circle-outline" size={18} color={BRAND_COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Tentang GG-Tix</Text>
                <Text style={styles.menuDesc}>Platform tiket konser game & pop culture</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Keluar dari Akun"
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>GG-Tix Mobile v1.0.0 • Stage Edition</Text>
      </ScrollView>

      <Modal visible={editProfile} transparent animationType="fade" onRequestClose={() => setEditProfile(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Profil</Text>
          <View style={styles.modalForm}>
            <Text style={styles.inputLabel}>Nama</Text><TextInput accessibilityLabel="Nama profil" style={styles.modalInput} value={name} onChangeText={setName} maxLength={100} />
            <Text style={styles.inputLabel}>Email</Text><TextInput accessibilityLabel="Email profil" style={styles.modalInput} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            {profileError ? <Text style={styles.modalAlertErrorText}>{profileError}</Text> : null}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditProfile(false)} disabled={saving}><Text style={styles.modalCancelText}>Batal</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={saveProfile} disabled={saving}><Text style={styles.modalSubmitText}>{saving ? 'Menyimpan...' : 'Simpan Profil'}</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="key" size={16} color={BRAND_COLORS.accent} />
                </View>
                <Text style={styles.modalTitle}>Ubah Kata Sandi</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPasswordModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Perbarui kata sandi akun GG-Tix Anda demi keamanan akses e-tiket.
            </Text>

            {passwordError ? (
              <View style={styles.modalAlertError}>
                <Ionicons name="alert-circle" size={14} color={BRAND_COLORS.danger} />
                <Text style={styles.modalAlertErrorText}>{passwordError}</Text>
              </View>
            ) : null}

            {passwordSuccess ? (
              <View style={styles.modalAlertSuccess}>
                <Ionicons name="checkmark-circle" size={14} color={BRAND_COLORS.success} />
                <Text style={styles.modalAlertSuccessText}>{passwordSuccess}</Text>
              </View>
            ) : null}

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Kata Sandi Saat Ini</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Masukkan kata sandi saat ini"
                placeholderTextColor="#71717A"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />

              <Text style={styles.inputLabel}>Kata Sandi Baru</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Minimal 6 karakter"
                placeholderTextColor="#71717A"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={styles.inputLabel}>Konfirmasi Kata Sandi Baru</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ulangi kata sandi baru"
                placeholderTextColor="#71717A"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsPasswordModalVisible(false)}
                disabled={passwordLoading}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, passwordLoading && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <Text style={styles.modalSubmitText}>Simpan Sandi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: '#16161A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  securityBadgeText: {
    color: BRAND_COLORS.success,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  scrollContent: {
    padding: 16,
  },

  profileCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BRAND_COLORS.accent,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
  },
  profileInfoCol: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: 6,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  memberPillText: {
    color: BRAND_COLORS.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 14,
  },

  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 2,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#27272A',
  },

  menuSection: {
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: '#16161A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    minHeight: 52,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  menuDesc: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginLeft: 62,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginTop: 4,
    marginBottom: 16,
    minHeight: 48,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    color: '#52525B',
    fontSize: 11,
    textAlign: 'center',
  },

  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  guestIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 4,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  promptSub: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  loginBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 44,
  },
  loginBtnText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 14,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 17,
    marginBottom: 14,
  },
  modalAlertError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 12,
  },
  modalAlertErrorText: {
    color: BRAND_COLORS.danger,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  modalAlertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 12,
  },
  modalAlertSuccessText: {
    color: BRAND_COLORS.success,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  modalForm: {
    gap: 10,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: 2,
  },
  modalInput: {
    height: 42,
    backgroundColor: '#111114',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    color: '#FAFAFA',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#27272A',
  },
  modalCancelText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.accent,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
});
