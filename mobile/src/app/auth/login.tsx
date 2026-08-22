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
import { BRAND_COLORS } from '../../constants/config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

      // res is { token, refreshToken, user: { id, name, email } }
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
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandTitle}>GGTIX</Text>
          <Text style={styles.title}>Masuk ke GG Tix</Text>
          <Text style={styles.subtitle}>Akses tiket konser game & pop culture favoritmu</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={BRAND_COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={BRAND_COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nama@email.com"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setErrorMsg('');
                }}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={BRAND_COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setErrorMsg('');
                }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={BRAND_COLORS.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
            ) : (
              <Text style={styles.buttonText}>Masuk</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkNormal}>Belum punya akun? </Text>
            <Link href="/auth/register" asChild>
              <TouchableOpacity>
                <Text style={styles.linkHighlight}>Daftar Sekarang</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: BRAND_COLORS.accent,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    flex: 1,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 14,
    fontSize: 15,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: BRAND_COLORS.accent,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: BRAND_COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  linkNormal: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
  linkHighlight: {
    color: BRAND_COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
