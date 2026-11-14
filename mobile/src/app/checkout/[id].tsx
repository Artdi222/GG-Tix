import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { paymentReturnBase } from '../../services/payment';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { eventTz, getPosterImage, tzShort } from '../../components/EventCard';
import { PageHeader } from '../../components/layout';

export default function CheckoutScreen() {
  const { id, categoryId, qty, price, categoryName } = useLocalSearchParams<{
    id: string;
    categoryId: string;
    qty?: string;
    price?: string;
    categoryName?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // State updates land on the next render, so two fast taps would both pass a state check.
  const submittingRef = useRef(false);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const authReady = useAuthStore((state) => state.isInitialized);

  const payButtonScale = useSharedValue(1);
  const payButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: payButtonScale.value }],
  }));

  // Route params come from deep links too, so clamp them to what the event allows.
  const category = eventData?.ticketCategories?.find((c: { id: string }) => c.id === categoryId);
  const maxQty = Math.max(1, Math.min(Number(eventData?.maxTicketsPerOrder) || 10, category ? Number(category.quotaRemaining) || 1 : 10));
  const parsedQty = parseInt(qty || '1', 10);
  const quantity = Number.isFinite(parsedQty) ? Math.min(Math.max(parsedQty, 1), maxQty) : 1;
  const unitPrice = Number(category?.price ?? price ?? 0);
  const blockedReason = !eventData
    ? null
    : !category
      ? 'Kategori tiket tidak ditemukan. Kembali dan pilih ulang kategori.'
      : eventData.status !== 'open'
        ? 'Penjualan tiket untuk konser ini sudah ditutup.'
        : Number(category.quotaRemaining) <= 0
          ? 'Kategori tiket ini sudah habis.'
          : eventData.maintenanceMode
            ? 'Pemesanan sementara ditutup untuk pemeliharaan.'
            : null;
  const canPay = !!eventData && !blockedReason;
  const totalPrice = unitPrice * quantity;

  // Promo code & voucher discount state
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoState, setAppliedPromo] = useState<{
    valid: boolean; code: string; name: string;
    subtotalPrice: string; discountAmount: string; totalPrice: string;
    quantity: number;
  } | null>(null);
  // A promo is priced for one quantity; if the clamp changes it after the event loads, it no longer applies.
  const appliedPromo = promoState?.quantity === quantity ? promoState : null;
  const [promoError, setPromoError] = useState('');

  const discountAmount = Number(appliedPromo?.discountAmount || 0);
  const finalTotalPrice = appliedPromo ? Number(appliedPromo.totalPrice) : totalPrice;

  useEffect(() => {
    let isMounted = true;
    if (id) {
      apiFetch<any>(`/events/${id}`)
        .then((res) => {
          if (!isMounted) return;
          const data = res?.data || res;
          setEventData(data);
        })
        .catch((error: any) => {
          if (isMounted) setLoadError(error.message || 'Gagal memuat detail konser.');
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id, reloadKey]);

  const formattedUnitPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(unitPrice);

  const formattedTotalPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(appliedPromo?.subtotalPrice ?? totalPrice));

  const formattedDiscount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(discountAmount);

  const formattedFinalPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(finalTotalPrice);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: eventTz(eventData),
      });
    } catch {
      return isoString;
    }
  };

  const handleApplyPromo = async () => {
    if (!canPay) return;
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      setPromoError('Masukkan kode promo terlebih dahulu');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    setPromoError('');
    setIsApplyingPromo(true);

    try {
      const res = await apiFetch<any>('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({
          code,
          categoryId,
          quantity,
          eventId: id,
        }),
      });

      const promoData = res.data || res;
      if (promoData.valid) {
        setAppliedPromo({ ...promoData, quantity });
        setPromoCodeInput('');
      } else {
        setPromoError(promoData.message || 'Kode promo tidak dapat digunakan');
      }
    } catch (err: any) {
      setPromoError(err.message || 'Gagal menerapkan kode promo');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setAppliedPromo(null);
    setPromoError('');
  };

  const handlePay = async () => {
    if (submittingRef.current || !canPay) return;
    submittingRef.current = true;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        
      }
    }

    try {
      setLoading(true);
      const res = await apiFetch<any>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          eventId: id,
          categoryId,
          quantity,
          voucherCode: appliedPromo?.code || undefined,
          paymentReturnUrl: paymentReturnBase(),
        }),
      });

      const orderId = res.data?.id || res.id;
      if (!orderId) throw new Error('ID pesanan tidak tersedia. Periksa riwayat sebelum mencoba lagi.');
      router.replace({ pathname: '/payment/[id]', params: { id: orderId, autoPay: '1' } });
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Terjadi kesalahan saat memproses checkout.');
      } else {
        Alert.alert('Gagal Memproses Pesanan', error.message || 'Terjadi kesalahan saat memproses checkout.');
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const posterUri = eventData ? getPosterImage(eventData) : null;

  if (authReady && !token) {
    return <Redirect href={{ pathname: '/auth/login', params: { redirect: `/event/${id}` } }} />;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top, backgroundColor: '#FFFFFF' }}>
        <PageHeader title="Checkout" back />
      </View>

      {loadError || blockedReason ? (
        <View style={styles.blocked}>
          <Ionicons name="alert-circle" size={18} color="#B91C1C" />
          <Text style={styles.blockedText}>{loadError || blockedReason}</Text>
          {loadError ? (
            <Pressable onPress={() => { setLoadError(''); setReloadKey((k) => k + 1); }} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.blockedAction}>Coba lagi</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.eventRow}>
          {posterUri ? <Image source={{ uri: posterUri }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {eventData?.title || (loadError ? 'Detail konser gagal dimuat' : 'Memuat…')}
            </Text>
            {eventData?.dateTime ? <Text style={styles.meta}>{formatDate(eventData.dateTime)} {tzShort(eventData.dateTime, eventTz(eventData))}</Text> : null}
            {eventData?.venue ? <Text style={styles.meta} numberOfLines={1}>{eventData.venue.name}, {eventData.venue.city}</Text> : null}
          </View>
        </View>

        <View style={styles.band} />

        <Section title="Tiket">
          <Row label={categoryName || category?.name || 'Kategori'} value={`${quantity} × ${formattedUnitPrice}`} />
        </Section>

        <Section title="E-tiket dikirim ke">
          <Text style={styles.strong}>{user?.name}</Text>
          <Text style={styles.meta}>{user?.email}</Text>
        </Section>

        <Section title="Kode promo">
          {appliedPromo ? (
            <View style={styles.promoApplied}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{appliedPromo.code}</Text>
                <Text style={styles.meta}>{appliedPromo.name} · hemat {formattedDiscount}</Text>
              </View>
              <Pressable onPress={handleRemovePromo} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hapus kode promo">
                <Text style={styles.link}>Hapus</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.promoRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Masukkan kode"
                  placeholderTextColor="#A1A1AA"
                  value={promoCodeInput}
                  onChangeText={(val) => setPromoCodeInput(val.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Kode promo"
                />
                <Pressable
                  style={[styles.promoBtn, (isApplyingPromo || !canPay || !promoCodeInput.trim()) && { opacity: 0.4 }]}
                  disabled={isApplyingPromo || !canPay || !promoCodeInput.trim()}
                  onPress={handleApplyPromo}
                  accessibilityRole="button"
                >
                  {isApplyingPromo ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.promoBtnText}>Pakai</Text>}
                </Pressable>
              </View>
              {promoError ? <Text style={styles.error}>{promoError}</Text> : null}
            </>
          )}
        </Section>

        <Section title="Rincian pembayaran">
          <Row label={`Subtotal (${quantity} tiket)`} value={formattedTotalPrice} />
          {appliedPromo ? <Row label={`Diskon ${appliedPromo.code}`} value={`− ${formattedDiscount}`} tone="good" /> : null}
          <View style={styles.hr} />
          <Row label="Total" value={formattedFinalPrice} bold />
          <Text style={[styles.meta, { marginTop: 12 }]}>
            Pembayaran diproses lewat Midtrans: virtual account, QRIS, GoPay, atau ShopeePay. Tiket muncul di Tiket Saya setelah pembayaran terverifikasi.
          </Text>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total pembayaran</Text>
          <Text style={styles.footerTotal}>{formattedFinalPrice}</Text>
        </View>
        <Animated.View style={payButtonAnimatedStyle}>
          <Pressable
            style={[styles.payBtn, (loading || !canPay) && styles.payBtnOff]}
            disabled={loading || !canPay}
            onPressIn={() => { if (!loading && canPay) payButtonScale.set(withSpring(MOTION_TOKENS.pressScale.button, MOTION_TOKENS.springSnappy)); }}
            onPressOut={() => payButtonScale.set(withSpring(1, MOTION_TOKENS.springSnappy))}
            onPress={handlePay}
            accessibilityRole="button"
            accessibilityLabel="Bayar sekarang"
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.payText}>Bayar</Text>}
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: 'good' }) {
  const color = tone === 'good' ? '#047857' : undefined;
  return (
    <View style={styles.row}>
      <Text style={[bold ? styles.totalLabel : styles.rowLabel, color && { color }]} numberOfLines={1}>{label}</Text>
      <Text style={[bold ? styles.totalValue : styles.rowValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  blocked: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.08)' },
  blockedText: { flex: 1, fontSize: 14, color: '#991B1B', fontWeight: '600' },
  blockedAction: { fontSize: 14, color: '#991B1B', fontWeight: '800' },

  eventRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  thumb: { width: 72, height: 108, borderRadius: 10, backgroundColor: '#E4E4E7' },
  eventTitle: { fontSize: 18, fontWeight: '800', color: '#18181B', lineHeight: 23 },
  meta: { fontSize: 14, color: '#71717A', lineHeight: 20 },
  band: { height: 8, backgroundColor: '#F4F4F5', marginTop: 16 },

  section: { paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F4F4F5' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#18181B', marginBottom: 10 },
  strong: { fontSize: 15, fontWeight: '700', color: '#18181B' },
  link: { fontSize: 14, fontWeight: '700', color: '#B4630A' },

  promoRow: { flexDirection: 'row', gap: 10 },
  promoInput: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 15, color: '#18181B', fontWeight: '700', letterSpacing: 1 },
  promoBtn: { height: 48, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' },
  promoBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  promoApplied: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.08)' },
  error: { marginTop: 8, fontSize: 13, color: '#B91C1C' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { flex: 1, fontSize: 15, color: '#52525B' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#18181B', fontVariant: ['tabular-nums'] },
  totalLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: '#18181B' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#18181B', fontVariant: ['tabular-nums'] },
  hr: { height: 1, backgroundColor: '#E4E4E7', marginVertical: 8 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E4E7' },
  footerLabel: { fontSize: 12, color: '#71717A', fontWeight: '600' },
  footerTotal: { fontSize: 20, fontWeight: '800', color: '#18181B', fontVariant: ['tabular-nums'] },
  payBtn: { height: 52, minWidth: 140, paddingHorizontal: 32, borderRadius: 26, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' },
  payBtnOff: { backgroundColor: '#D4D4D8' },
  payText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
