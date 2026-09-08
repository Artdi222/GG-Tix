import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { getPosterImage } from '../../components/EventCard';

interface OrderItem {
  id: string;
  eventId: string;
  quantity: number;
  totalPrice: string | number;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  createdAt: string;
  event?: {
    id: string;
    title: string;
    dateTime: string;
    imageUrl?: string | null;
    venue?: {
      name: string;
      city: string;
    };
  };
  category?: {
    name: string;
  };
}

interface TicketCardProps {
  item: OrderItem;
  onPress: () => void;
}

function TicketCard({ item, onPress }: TicketCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, MOTION_TOKENS.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, MOTION_TOKENS.springSnappy);
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

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

  const posterUri = item.event ? getPosterImage(item.event as any) : null;
  const isVerified = item.status === 'verified';

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.ticketCard}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Tiket ${item.event?.title || 'Konser'}, Kategori ${item.category?.name || 'Tiket'}`}
      >
        <View style={[styles.ticketAccentStrip, { backgroundColor: isVerified ? BRAND_COLORS.accent : '#52525B' }]} />

        <View style={styles.cardHeader}>
          <View style={styles.headerTopRow}>
            <View style={[styles.statusPill, isVerified && styles.statusPillVerified]}>
              <View style={[styles.statusDot, isVerified && styles.statusDotVerified]} />
              <Text style={[styles.statusPillText, isVerified && styles.statusPillTextVerified]}>
                {isVerified ? 'E-TIKET AKTIF' : item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.orderRef}>#{item.id.substring(0, 8).toUpperCase()}</Text>
          </View>

          <View style={styles.eventRow}>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.eventThumb} contentFit="cover" />
            ) : (
              <View style={styles.eventThumbPlaceholder}>
                <Ionicons name="musical-notes" size={24} color={BRAND_COLORS.accent} />
              </View>
            )}
            <View style={styles.eventInfoCol}>
              <Text style={styles.categoryBadge} numberOfLines={1}>
                {item.category?.name || 'General Admission'}
              </Text>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {item.event?.title || 'Konser Musik GG-Tix'}
              </Text>
              {item.event?.dateTime ? (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={BRAND_COLORS.accent} />
                  <Text style={styles.metaText}>{formatDate(item.event.dateTime)} WIB</Text>
                </View>
              ) : null}
              {item.event?.venue ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color="#71717A" />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.event.venue.name}, {item.event.venue.city}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.tearDivider}>
          <View style={styles.cutoutLeft} />
          <View style={styles.dashedLine} />
          <View style={styles.cutoutRight} />
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.ticketCountLabel}>Jumlah Pas Masuk</Text>
            <Text style={styles.ticketCountValue}>{item.quantity} Tiket Resmi</Text>
          </View>

          {isVerified ? (
            <View style={styles.qrActionBtn}>
              <Ionicons name="qr-code" size={14} color="#09090B" />
              <Text style={styles.qrActionText}>Buka E-Tiket</Text>
            </View>
          ) : (
            <View style={styles.pendingActionBtn}>
              <Text style={styles.pendingActionText}>Lihat Detail</Text>
              <Ionicons name="chevron-forward" size={14} color="#A1A1AA" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TicketsScreen() {
  const token = useAuthStore((state) => state.token);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    if (!token) {
      setRefreshing(false);
      return;
    }
    try {
      const res = await apiFetch<any>('/orders/me');
      const items = Array.isArray(res) ? res : res.data?.items || res.items || res.data || [];
      setOrders(items);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    if (token) {
      apiFetch<any>('/orders/me')
        .then((res) => {
          if (!isMounted) return;
          const items = Array.isArray(res) ? res : res.data?.items || res.items || res.data || [];
          setOrders(items);
        })
        .catch(() => {
          if (!isMounted) return;
          setOrders([]);
        })
        .finally(() => {
          if (!isMounted) return;
          setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'active') {
      return orders.filter((o) => o.status === 'verified');
    }
    return orders;
  }, [orders, activeTab]);

  const activeTicketsCount = useMemo(() => {
    return orders.filter((o) => o.status === 'verified').length;
  }, [orders]);

  if (!token) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.guestIconWrap}>
          <Ionicons name="ticket-outline" size={40} color={BRAND_COLORS.accent} />
        </View>
        <Text style={styles.promptTitle}>Tiket Digital Saya</Text>
        <Text style={styles.promptSub}>
          Masuk ke akun GG-Tix untuk mengakses tiket konser aktif dan QR Code check-in Anda.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/auth/login')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Masuk ke akun"
        >
          <Text style={styles.loginBtnText}>Masuk ke Akun</Text>
          <Ionicons name="arrow-forward" size={16} color="#09090B" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) + (Platform.OS === 'android' ? 6 : 2) }]}>
        <View>
          <Text style={styles.headerTitle}>Tiket Saya</Text>
          <Text style={styles.headerSub}>E-Tiket resmi & akses barcode gate</Text>
        </View>
        <View style={styles.activeCountBadge}>
          <View style={styles.activeCountDot} />
          <Text style={styles.activeCountText}>{activeTicketsCount} Tiket Aktif</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
            }
            setActiveTab('active');
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Filter Tiket Aktif"
        >
          <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
            Tiket Aktif ({activeTicketsCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
            }
            setActiveTab('all');
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Filter Semua Riwayat"
        >
          <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
            Semua Riwayat ({orders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
          <Text style={styles.loadingText}>Memuat tiket digital...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 36 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND_COLORS.accent}
              colors={[BRAND_COLORS.accent]}
            />
          }
          ListHeaderComponent={
            activeTicketsCount > 0 ? (
              <View style={styles.offlineNoticeBox}>
                <Ionicons name="shield-checkmark" size={15} color={BRAND_COLORS.success} />
                <Text style={styles.offlineNoticeText}>
                  QR Code e-tiket tersimpan aman di perangkat dan siap di-scan tanpa perlu koneksi internet saat di venue.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TicketCard
              item={item}
              onPress={() => router.push(`/ticket/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="ticket-outline" size={36} color="#71717A" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active' ? 'Belum Ada Tiket Aktif' : 'Belum Ada Riwayat Transaksi'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'active'
                  ? 'Tiket konser yang telah berhasil dibayar akan otomatis terbit di sini lengkap dengan barcode QR gate check-in.'
                  : 'Seluruh riwayat pesanan tiket konser Anda akan tercatat di halaman ini.'}
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Jelajahi konser"
              >
                <Ionicons name="musical-notes-outline" size={16} color="#09090B" />
                <Text style={styles.exploreBtnText}>Temukan Konser</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    marginTop: 1,
  },
  activeCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  activeCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.success,
  },
  activeCountText: {
    color: BRAND_COLORS.success,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#09090B',
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tabBtnActive: {
    backgroundColor: '#1F1F24',
    borderColor: BRAND_COLORS.accent,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    fontVariant: ['tabular-nums'],
  },
  tabBtnTextActive: {
    color: BRAND_COLORS.accent,
    fontWeight: '700',
  },

  listContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
  },

  offlineNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 12,
  },
  offlineNoticeText: {
    flex: 1,
    color: '#A1A1AA',
    fontSize: 11,
    lineHeight: 15,
  },

  ticketCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  ticketAccentStrip: {
    height: 3,
    backgroundColor: BRAND_COLORS.accent,
  },
  cardHeader: {
    padding: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#27272A',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPillVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#71717A',
  },
  statusDotVerified: {
    backgroundColor: BRAND_COLORS.success,
  },
  statusPillText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statusPillTextVerified: {
    color: BRAND_COLORS.success,
  },
  orderRef: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventThumb: {
    width: 68,
    height: 92,
    borderRadius: 8,
    backgroundColor: '#1F1F24',
  },
  eventThumbPlaceholder: {
    width: 68,
    height: 92,
    borderRadius: 8,
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfoCol: {
    flex: 1,
  },
  categoryBadge: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FAFAFA',
    lineHeight: 19,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },

  tearDivider: {
    height: 18,
    backgroundColor: '#16161A',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cutoutLeft: {
    position: 'absolute',
    left: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#09090B',
    borderRightWidth: 1,
    borderRightColor: '#27272A',
  },
  cutoutRight: {
    position: 'absolute',
    right: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#09090B',
    borderLeftWidth: 1,
    borderLeftColor: '#27272A',
  },
  dashedLine: {
    width: '84%',
    height: 1,
    borderWidth: 1,
    borderColor: '#27272A',
    borderStyle: 'dashed',
  },

  cardFooter: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16161A',
  },
  ticketCountLabel: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '500',
  },
  ticketCountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  qrActionBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
  },
  qrActionText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 12,
  },
  pendingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F1F24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 36,
  },
  pendingActionText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
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

  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16161A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  emptyText: {
    color: '#71717A',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  exploreBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    minHeight: 40,
  },
  exploreBtnText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 13,
  },
});
