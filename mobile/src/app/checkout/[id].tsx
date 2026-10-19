import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
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
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { getPosterImage } from '../../components/EventCard';

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
  const [appliedPromo, setAppliedPromo] = useState<{
    valid: boolean; code: string; name: string;
    subtotalPrice: string; discountAmount: string; totalPrice: string;
  } | null>(null);
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
        timeZone: 'Asia/Jakarta',
      });
    } catch {
      return isoString;
    }
  };

  const handleApplyPromo = async () => {
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
        setAppliedPromo(promoData);
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke detail konser"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konfirmasi Pembayaran</Text>
        <View style={styles.sslBadge}>
          <Ionicons name="lock-closed" size={11} color={BRAND_COLORS.success} />
          <Text style={styles.sslBadgeText}>256-BIT SSL</Text>
        </View>
      </View>

      {loadError || blockedReason ? (
        <View style={styles.blockedBanner}>
          <Ionicons name="alert-circle" size={16} color={BRAND_COLORS.danger} />
          <Text style={styles.blockedText}>{loadError || blockedReason}</Text>
          {loadError ? (
            <TouchableOpacity onPress={() => { setLoadError(''); setReloadKey((k) => k + 1); }} accessibilityRole="button">
              <Text style={styles.blockedAction}>Coba lagi</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ticketStubCard}>
          <View style={styles.eventRow}>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.eventThumb} contentFit="cover" />
            ) : (
              <View style={styles.eventThumbPlaceholder}>
                <Ionicons name="musical-notes" size={24} color={BRAND_COLORS.accent} />
              </View>
            )}
            <View style={styles.eventInfoCol}>
              <View style={styles.tierBadge}>
                <View style={styles.tierDot} />
                <Text style={styles.tierBadgeText}>{categoryName || 'General Admission'}</Text>
              </View>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {eventData?.title || (loadError ? 'Detail konser gagal dimuat' : 'Memuat detail konser…')}
              </Text>
              {eventData?.dateTime ? (
                <View style={styles.eventMetaRow}>
                  <Ionicons name="calendar-outline" size={12} color={BRAND_COLORS.accent} />
                  <Text style={styles.eventMetaText}>{formatDate(eventData.dateTime)} WIB</Text>
                </View>
              ) : null}
              {eventData?.venue ? (
                <View style={styles.eventMetaRow}>
                  <Ionicons name="location-outline" size={12} color="#71717A" />
                  <Text style={styles.eventMetaText} numberOfLines={1}>
                    {eventData.venue.name}, {eventData.venue.city}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="mail-outline" size={15} color={BRAND_COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Tujuan Pengiriman E-Tiket</Text>
              <Text style={styles.cardHeaderSub}>QR Code tiket akan otomatis dikirim ke akun ini</Text>
            </View>
          </View>

          <View style={styles.userInfoBox}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'email@customer.com'}</Text>
            </View>
            <View style={styles.verifiedChip}>
              <Ionicons name="checkmark-circle" size={12} color={BRAND_COLORS.success} />
              <Text style={styles.verifiedChipText}>Aktif</Text>
            </View>
          </View>
        </View>

        {/* PROMO VOUCHER CARD */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="ticket-outline" size={15} color={BRAND_COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Promo & Voucher Diskon</Text>
              <Text style={styles.cardHeaderSub}>Gunakan kupon potongan harga resmi</Text>
            </View>
          </View>

          {appliedPromo ? (
            <View style={styles.promoAppliedBox}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={15} color={BRAND_COLORS.success} />
                  <Text style={styles.promoAppliedCode}>{appliedPromo.code}</Text>
                  <View style={styles.promoAppliedBadge}>
                    <Text style={styles.promoAppliedBadgeText}>HEMAT {formattedDiscount}</Text>
                  </View>
                </View>
                <Text style={styles.promoAppliedName}>{appliedPromo.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.promoRemoveBtn}
                onPress={handleRemovePromo}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Hapus voucher promo"
              >
                <Ionicons name="close" size={16} color="#52525B" />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.promoInputRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Kode promo"
                  placeholderTextColor="#71717A"
                  value={promoCodeInput}
                  onChangeText={(val) => setPromoCodeInput(val.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.promoApplyBtn, isApplyingPromo && { opacity: 0.6 }]}
                  disabled={isApplyingPromo || !promoCodeInput.trim()}
                  onPress={handleApplyPromo}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Terapkan kode promo"
                >
                  {isApplyingPromo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.promoApplyBtnText}>Terapkan</Text>
                  )}
                </TouchableOpacity>
              </View>
              {promoError ? (
                <Text style={styles.promoErrorText}>{promoError}</Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="receipt-outline" size={15} color={BRAND_COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Rincian Pembayaran</Text>
              <Text style={styles.cardHeaderSub}>Harga resmi tanpa biaya tersembunyi</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Kategori {categoryName || 'Tiket'} ({quantity}x)
            </Text>
            <Text style={styles.priceValue}>{formattedTotalPrice}</Text>
          </View>

          {appliedPromo ? (
            <View style={styles.priceRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.priceLabel, { color: BRAND_COLORS.success }]}>
                  Diskon Voucher ({appliedPromo.code})
                </Text>
              </View>
              <Text style={[styles.priceValue, { color: BRAND_COLORS.success }]}>
                - {formattedDiscount}
              </Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Harga Satuan</Text>
            <Text style={styles.priceValueMuted}>{formattedUnitPrice}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.priceLabel}>Biaya Layanan & Admin</Text>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>PROMO</Text>
              </View>
            </View>
            <Text style={styles.priceFreeText}>Rp 0 (Gratis)</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total Tagihan</Text>
              <Text style={styles.totalSub}>Termasuk pajak & biaya sistem</Text>
            </View>
            <Text style={styles.totalAmount}>{formattedFinalPrice}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.headerIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="shield-checkmark" size={15} color={BRAND_COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Midtrans Secure Gateway</Text>
              <Text style={styles.cardHeaderSub}>Pilih metode pembayaran di halaman Midtrans</Text>
            </View>
          </View>

          <Text style={styles.cardHeaderSub}>Virtual account, QRIS, GoPay, dan ShopeePay tersedia sesuai pilihan di Midtrans.</Text>
        </View>

        <View style={styles.policyCard}>
          <Ionicons name="shield-outline" size={15} color="#71717A" style={{ marginTop: 2 }} />
          <Text style={styles.policyText}>
            Tiket resmi langsung diterbitkan ke tab <Text style={{ color: BRAND_COLORS.accent, fontWeight: '700' }}>Tiket Saya</Text> setelah pembayaran diverifikasi oleh sistem.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>Total Pembayaran</Text>
          <Text style={styles.footerPriceValue}>{formattedFinalPrice}</Text>
        </View>

        <Animated.View style={payButtonAnimatedStyle}>
          <TouchableOpacity
            style={[styles.payButton, (loading || !canPay) && styles.payButtonDisabled]}
            disabled={loading || !canPay}
            onPressIn={() => {
              if (!loading && canPay) {
                payButtonScale.set(withSpring(MOTION_TOKENS.pressScale.button, MOTION_TOKENS.springSnappy));
              }
            }}
            onPressOut={() => {
              payButtonScale.set(withSpring(1, MOTION_TOKENS.springSnappy));
            }}
            onPress={handlePay}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Bayar sekarang dengan Midtrans"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.payButtonText}>Bayar Sekarang</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  blockedText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '600',
  },
  blockedAction: {
    color: BRAND_COLORS.accent,
    fontSize: 12.5,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F6F6F8',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEF',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  sslBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  sslBadgeText: {
    color: BRAND_COLORS.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
  },

  ticketStubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventThumb: {
    width: 76,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
  },
  eventThumbPlaceholder: {
    width: 76,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfoCol: {
    flex: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    marginBottom: 6,
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BRAND_COLORS.accent,
  },
  tierBadgeText: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
    lineHeight: 20,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '500',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  cardHeaderSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },

  userInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: BRAND_COLORS.accent,
    fontWeight: '800',
    fontSize: 14,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  userEmail: {
    fontSize: 11,
    color: '#52525B',
    marginTop: 1,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verifiedChipText: {
    color: BRAND_COLORS.success,
    fontSize: 10,
    fontWeight: '700',
  },

  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingHorizontal: 12,
    color: '#18181B',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  promoApplyBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  promoErrorText: {
    color: BRAND_COLORS.danger,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 2,
  },
  promoAppliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  promoAppliedCode: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_COLORS.success,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  promoAppliedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  promoAppliedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: BRAND_COLORS.success,
  },
  promoAppliedName: {
    fontSize: 11,
    color: '#52525B',
    marginTop: 3,
  },
  promoRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: '#E4E4E7',
    marginVertical: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#18181B',
    fontVariant: ['tabular-nums'],
  },
  priceValueMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    fontVariant: ['tabular-nums'],
  },
  freeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  freeBadgeText: {
    color: BRAND_COLORS.success,
    fontSize: 8,
    fontWeight: '800',
  },
  priceFreeText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLORS.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  totalSub: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 1,
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },

  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  channelChipActive: {
    borderColor: BRAND_COLORS.accent,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  channelChipText: {
    color: '#3F3F46',
    fontSize: 11,
    fontWeight: '600',
  },
  channelChipTextActive: {
    color: BRAND_COLORS.accent,
    fontWeight: '700',
  },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  policyText: {
    flex: 1,
    fontSize: 11,
    color: '#71717A',
    lineHeight: 16,
  },

  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceCol: {
    flex: 1,
    marginRight: 12,
  },
  footerPriceLabel: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '600',
  },
  footerPriceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
    marginTop: 2,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  payButton: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  payButtonDisabled: {
    backgroundColor: '#D4D4D8',
    opacity: 0.6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
