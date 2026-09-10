import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { createPaymentPoller } from '../../services/payment-poller';
import { openPaymentBrowser, paymentReturnBase, type PaymentStatus } from '../../services/payment';
import { useAuthStore } from '../../store/auth-store';
import { BRAND_COLORS as C } from '../../constants/config';

export default function PaymentScreen() {
  const { id, autoPay } = useLocalSearchParams<{ id: string; autoPay?: string }>();
  const userId = useAuthStore(state => state.user?.id);
  return <PaymentContent key={`${userId}:${id}`} id={id} autoPay={autoPay} />;
}

function PaymentContent({ id, autoPay }: { id: string; autoPay?: string }) {
  const token = useAuthStore(state => state.token);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [pollingEnded, setPollingEnded] = useState(false);
  const retry = useRef<(() => void) | null>(null);
  const autoStarted = useRef(false);
  const openingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const restartPolling = useCallback(() => { setPollingEnded(false); retry.current?.(); }, []);
  useFocusEffect(useCallback(() => {
    if (!id || !token) return;
    let active = true;
    const poller = createPaymentPoller({
      request: signal => apiFetch<PaymentStatus>(`/payments/midtrans/${id}/sync`, { method: 'POST', signal }),
      onStatus: status => { if (active) { setPayment(status); setError(''); } },
      onError: message => { if (active) setError(message); },
      onChecking: value => { if (active) setChecking(value); },
      onEnded: () => { if (active) setPollingEnded(true); },
    });
    retry.current = poller.restart;
    poller.restart();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { setPollingEnded(false); poller.restart(); }
      else poller.pause();
    });
    return () => { active = false; retry.current = null; poller.pause(); subscription.remove(); };
  }, [id, token]));

  const continuePayment = useCallback(async () => {
    if (!id || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError('');
    try {
      // Obtain/reuse this order's session; never create a second order when retrying.
      const session = await apiFetch<{ redirectUrl: string }>('/payments/midtrans/token', {
        method: 'POST', body: JSON.stringify({ orderId: id, paymentReturnUrl: paymentReturnBase() }),
      });
      await openPaymentBrowser(session.redirectUrl, id);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Pembayaran belum dapat dibuka. Coba lagi.');
    } finally {
      openingRef.current = false;
      if (mounted.current) { setOpening(false); restartPolling(); }
    }
  }, [id, restartPolling]);

  useEffect(() => {
    if (autoPay === '1' && payment?.status === 'pending' && payment.payment && !autoStarted.current) {
      autoStarted.current = true;
      void continuePayment();
    }
  }, [autoPay, payment, continuePayment]);

  const paid = payment?.status === 'verified';
  const review = payment?.requiresReview;
  const pending = payment?.status === 'pending';
  const title = review ? 'Pembayaran diterima, tiket perlu diperiksa' : paid ? 'Pembayaran berhasil' : pending ? 'Menunggu pembayaran' : payment?.status === 'expired' ? 'Pembayaran kedaluwarsa' : payment?.status === 'rejected' ? 'Pesanan ditolak' : error ? 'Status belum dapat diperiksa' : 'Memeriksa pembayaran';
  const description = review ? 'Pembayaran sudah diterima, tetapi tiket belum dapat diterbitkan. Hubungi bantuan dengan ID pesanan di bawah.' : paid ? 'Tiketmu sudah siap. Buka e-tiket untuk melihat QR masuk venue.' : pending ? 'Selesaikan pembayaran di Midtrans. Setelah selesai, tutup browser atau kembali ke aplikasi untuk memperbarui status.' : payment ? 'Jika kamu sudah membayar, periksa status lagi agar pembayaran dapat dicocokkan.' : 'Status akan diperbarui setelah pembayaran dikonfirmasi.';
  const back = () => router.replace('/(tabs)/history');

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Kembali ke riwayat pesanan" onPress={back} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={C.textLight} /><Text style={styles.backText}>Riwayat pesanan</Text>
      </TouchableOpacity>
      {!token ? <View style={styles.card}>
        <Text style={styles.title}>Masuk untuk melihat pesanan</Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/auth/login')} accessibilityRole="button"><Text style={styles.primaryText}>Masuk ke akun</Text></TouchableOpacity>
      </View> : <View style={styles.card}>
        <Ionicons name={paid ? 'checkmark-circle' : review ? 'alert-circle-outline' : 'receipt-outline'} size={56} color={paid ? C.success : C.accent} />
        <Text style={styles.title} accessibilityLiveRegion="polite">{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text selectable style={styles.reference}>ID pesanan{ '\n' }{id}</Text>
        {payment && <Text style={styles.amount}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(payment.totalPrice))} · {payment.quantity} tiket</Text>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {checking && <View style={styles.progress}><ActivityIndicator color={C.accent} /><Text style={styles.description}>Memperbarui status…</Text></View>}
        {pollingEnded && pending && <Text style={styles.description}>Konfirmasi belum diterima. Kamu bisa memeriksa lagi atau kembali nanti melalui riwayat pesanan.</Text>}
        {paid ? <TouchableOpacity style={styles.primary} accessibilityRole="button" onPress={() => router.replace(`/ticket/${id}`)}><Text style={styles.primaryText}>Buka e-tiket</Text></TouchableOpacity> : <>
          {pending && !review && <TouchableOpacity style={[styles.primary, opening && styles.disabled]} disabled={opening} onPress={() => void continuePayment()} accessibilityRole="button"><Text style={styles.primaryText}>{opening ? 'Pembayaran terbuka…' : 'Lanjutkan pembayaran'}</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.secondary} disabled={checking} onPress={restartPolling} accessibilityRole="button"><Text style={styles.secondaryText}>Periksa status pembayaran</Text></TouchableOpacity>
        </>}
        <TouchableOpacity style={styles.secondary} onPress={back} accessibilityRole="button"><Text style={styles.secondaryText}>Kembali ke riwayat</Text></TouchableOpacity>
      </View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgDark }, content: { paddingHorizontal: 20, gap: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }, backText: { color: C.textLight, fontSize: 16 },
  card: { backgroundColor: C.cardBg, borderColor: C.borderLight, borderWidth: 1, borderRadius: 20, padding: 24, gap: 20 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: C.textLight },
  description: { fontSize: 15, lineHeight: 23, color: C.textMuted }, reference: { color: C.textMuted, fontSize: 13, lineHeight: 22 },
  amount: { fontSize: 18, fontWeight: '600', color: C.textLight }, error: { color: '#F87171', fontSize: 15, lineHeight: 22 },
  primary: { backgroundColor: C.accent, borderRadius: 12, padding: 16, minHeight: 48, alignItems: 'center' },
  primaryText: { color: C.bgDark, fontWeight: '700', fontSize: 16 },
  secondary: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: C.borderLight, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: C.textLight, fontSize: 15, textAlign: 'center' }, disabled: { opacity: 0.6 }, progress: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
