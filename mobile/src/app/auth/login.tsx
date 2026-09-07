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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Email dan password wajib diisi');
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch<any>('/auth/customer/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.token && res.user) {
        await setAuth(res.token, res.user, res.refreshToken);
        router.replace('/(tabs)');
      } else {
        throw new Error('Format respon login tidak sesuai.');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Gagal masuk. Periksa email dan password.');
    } finally {
      setLoading(false);
    }
  };

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
            Selamat{'\n'}
            <Text style={styles.heroHeadlineBold}>Datang Kembali</Text>
          </Text>
          <Text style={styles.subtitle}>Masuk untuk mengakses dan mengelola tiket konsermu</Text>
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
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailFocused ? '#F59E0B' : '#71717A'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="nama@email.com"
                  placeholderTextColor="#71717A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => { setEmail(val); setErrorMsg(''); }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordFocused ? '#F59E0B' : '#71717A'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => { setPassword(val); setErrorMsg(''); }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#09090B" size="small" />
              ) : (
                <Text style={styles.buttonText}>Masuk ke Akun</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkNormal}>Belum punya akun? </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkHighlight}>Daftar Sekarang</Text>
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
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
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
    paddingTop: 24,
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
    gap: 16,
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
    paddingVertical: 13,
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
