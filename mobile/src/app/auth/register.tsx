import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store';
import { apiFetch } from '../../services/api';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleRegister = async () => {
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMsg('Semua field wajib diisi');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak sama');
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch<any>('/auth/customer/register', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      if (res.token && res.user) {
        await setAuth(res.token, res.user, res.refreshToken);
        router.replace('/(tabs)');
      } else {
        throw new Error('Pendaftaran berhasil, silakan masuk.');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    styles.inputWrapper,
    focusedField === field && styles.inputWrapperFocused,
  ];

  const iconColor = (field: string) =>
    focusedField === field ? '#F59E0B' : '#71717A';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.logoRow}>
            <Text style={styles.brandTitle}>GG TIX</Text>
          </View>
          <Text style={styles.heroHeadline}>
            Buat{'\n'}
            <Text style={styles.heroHeadlineBold}>Akun Baru</Text>
          </Text>
          <Text style={styles.subtitle}>Daftar dan mulai pesan tiket konser impianmu</Text>
        </View>

        <View style={styles.formArea}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={inputStyle('name')}>
                <Ionicons name="person-outline" size={18} color={iconColor('name')} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nama Anda"
                  placeholderTextColor="#71717A"
                  value={name}
                  onChangeText={(val) => { setName(val); setErrorMsg(''); }}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={inputStyle('email')}>
                <Ionicons name="mail-outline" size={18} color={iconColor('email')} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="nama@email.com"
                  placeholderTextColor="#71717A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => { setEmail(val); setErrorMsg(''); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={inputStyle('password')}>
                <Ionicons name="lock-closed-outline" size={18} color={iconColor('password')} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => { setPassword(val); setErrorMsg(''); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <View style={inputStyle('confirm')}>
                <Ionicons name="shield-checkmark-outline" size={18} color={iconColor('confirm')} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ulangi password"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(val) => { setConfirmPassword(val); setErrorMsg(''); }}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#09090B" size="small" />
              ) : (
                <Text style={styles.buttonText}>Daftar Sekarang</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkNormal}>Sudah punya akun? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkHighlight}>Masuk</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FAFAFA',
    letterSpacing: 2,
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '400',
    color: '#A1A1AA',
    lineHeight: 34,
    marginBottom: 6,
  },
  heroHeadlineBold: {
    fontWeight: '900',
    color: '#FAFAFA',
  },
  subtitle: {
    fontSize: 13,
    color: '#71717A',
    lineHeight: 18,
  },
  formArea: {
    flex: 1,
    padding: 24,
    paddingTop: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: '#F59E0B',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FAFAFA',
    paddingVertical: 12,
    fontSize: 14,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    marginTop: 6,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F59E0B',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  dividerText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  linkNormal: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  linkHighlight: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
});
