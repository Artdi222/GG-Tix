import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { getPosterImage } from '../../components/EventCard';

const PAYMENT_METHODS = [
  { id: 'qris', name: 'QRIS Instant', icon: 'qr-code-outline' },
  { id: 'gopay', name: 'GoPay / GoPay Later', icon: 'wallet-outline' },
  { id: 'shopeepay', name: 'ShopeePay', icon: 'phone-portrait-outline' },
  { id: 'bca', name: 'BCA Virtual Account', icon: 'card-outline' },
  { id: 'mandiri', name: 'Mandiri Livin VA', icon: 'card-outline' },
  { id: 'bni', name: 'BNI Virtual Account', icon: 'card-outline' },
  { id: 'bri', name: 'BRI Virtual Account', icon: 'card-outline' },
  { id: 'cc', name: 'Kartu Kredit / Debit', icon: 'card' },
];

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
  const [selectedMethod, setSelectedMethod] = useState<string>('qris');

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const payButtonScale = useSharedValue(1);
  const payButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: payButtonScale.value }],
  }));

  const quantity = parseInt(qty || '1', 10);
  const unitPrice = parseFloat(price || '0');
  const totalPrice = unitPrice * quantity;

  useEffect(() => {
    let isMounted = true;
    if (id) {
      apiFetch<any>(`/events/${id}`)
        .then((res) => {
          if (!isMounted) return;
          const data = res?.data || res;
          setEventData(data);
        })
        .catch(() => {
          
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id]);

  const formattedUnitPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(unitPrice);

  const formattedTotalPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(totalPrice);

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
      });
    } catch {
      return isoString;
    }
  };

  const handleSelectMethod = (methodId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        
      }
    }
    setSelectedMethod(methodId);
  };

  const handlePay = async () => {
    if (loading) return;

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
        }),
      });

      const snapUrl = res.payment?.redirectUrl || res.data?.payment?.redirectUrl;

      if (snapUrl) {
        if (Platform.OS === 'web') {
          window.location.href = snapUrl;
        } else {
          await WebBrowser.openBrowserAsync(snapUrl);
          router.replace('/(tabs)/tickets');
        }
      } else {
        router.replace('/(tabs)/tickets');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Terjadi kesalahan saat memproses checkout.');
      } else {
        Alert.alert('Gagal Memproses Pesanan', error.message || 'Terjadi kesalahan saat memproses checkout.');
      }
    } finally {
      setLoading(false);
    }
  };

  const posterUri = eventData ? getPosterImage(eventData) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke detail konser"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#FAFAFA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konfirmasi Pembayaran</Text>
        <View style={styles.sslBadge}>
          <Ionicons name="lock-closed" size={11} color={BRAND_COLORS.success} />
          <Text style={styles.sslBadgeText}>256-BIT SSL</Text>
        </View>
      </View>

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
                {eventData?.title || 'Memuat Detail Konser...'}
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
            <Text style={styles.totalAmount}>{formattedTotalPrice}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.headerIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="shield-checkmark" size={15} color={BRAND_COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Midtrans Secure Gateway</Text>
              <Text style={styles.cardHeaderSub}>Pilih preferensi kanal bayar resmi</Text>
            </View>
          </View>

          <View style={styles.channelGrid}>
            {PAYMENT_METHODS.map((m) => {
              const isSelected = selectedMethod === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.channelChip, isSelected && styles.channelChipActive]}
                  onPress={() => handleSelectMethod(m.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Pilih metode pembayaran ${m.name}`}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={13}
                    color={isSelected ? BRAND_COLORS.accent : '#A1A1AA'}
                  />
                  <Text style={[styles.channelChipText, isSelected && styles.channelChipTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
          <Text style={styles.footerPriceValue}>{formattedTotalPrice}</Text>
        </View>

        <Animated.View style={payButtonAnimatedStyle}>
          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            disabled={loading}
            onPressIn={() => {
              if (!loading) {
                payButtonScale.value = withSpring(MOTION_TOKENS.pressScale.button, MOTION_TOKENS.springSnappy);
              }
            }}
            onPressOut={() => {
              payButtonScale.value = withSpring(1, MOTION_TOKENS.springSnappy);
            }}
            onPress={handlePay}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Bayar sekarang dengan Midtrans"
          >
            {loading ? (
              <ActivityIndicator color="#09090B" size="small" />
            ) : (
              <>
                <Text style={styles.payButtonText}>Bayar Sekarang</Text>
                <Ionicons name="arrow-forward" size={16} color="#09090B" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
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
    borderBottomColor: '#1F1F24',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16161A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
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
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: '#1F1F24',
  },
  eventThumbPlaceholder: {
    width: 76,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#1F1F24',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
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
    color: '#FAFAFA',
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
    color: '#A1A1AA',
    fontWeight: '500',
  },

  sectionCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAFAFA',
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
    backgroundColor: '#111114',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272A',
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
    color: '#FAFAFA',
  },
  userEmail: {
    fontSize: 11,
    color: '#A1A1AA',
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

  divider: {
    height: 1,
    backgroundColor: '#27272A',
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
    color: '#A1A1AA',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FAFAFA',
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
    color: '#FAFAFA',
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
    backgroundColor: '#111114',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  channelChipActive: {
    borderColor: BRAND_COLORS.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  channelChipText: {
    color: '#D4D4D8',
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
    backgroundColor: '#111114',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
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
    backgroundColor: '#3F3F46',
    opacity: 0.6,
  },
  payButtonText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 14,
  },
});
