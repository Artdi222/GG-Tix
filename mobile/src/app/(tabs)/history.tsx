import React, { useState } from 'react';
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
import { useCustomerOrders } from '../../hooks/useCustomerOrders';
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { StatusBadge } from '../../components/StatusBadge';
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

type FilterKey = 'all' | 'verified' | 'pending' | 'failed';

interface OrderCardProps {
  item: OrderItem;
  onPress: () => void;
}

function OrderCardItem({ item, onPress }: OrderCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.set(withSpring(0.98, MOTION_TOKENS.springSnappy));
  };

  const handlePressOut = () => {
    scale.set(withSpring(1, MOTION_TOKENS.springSnappy));
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

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const posterUri = item.event ? getPosterImage(item.event as any) : null;
  const isVerified = item.status === 'verified';

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Pesanan ${item.event?.title || 'Konser'}, Status ${item.status}`}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.orderRefWrap}>
            <Ionicons name="receipt-outline" size={13} color={BRAND_COLORS.accent} />
            <Text style={styles.orderRefText}>#{item.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.divider} />

        <View style={styles.eventBodyRow}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.eventThumb} contentFit="cover" />
          ) : (
            <View style={styles.eventThumbPlaceholder}>
              <Ionicons name="musical-notes" size={22} color={BRAND_COLORS.accent} />
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

        <View style={styles.divider} />

        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.footerQuantity}>
              {item.quantity} Tiket • {formatCurrency(item.totalPrice)}
            </Text>
            <Text style={styles.footerDate}>Dipesan: {formatDate(item.createdAt)}</Text>
          </View>

          {isVerified ? (
            <View style={styles.qrActionBtn}>
              <Ionicons name="qr-code" size={14} color="#09090B" />
              <Text style={styles.qrActionText}>Buka E-Tiket</Text>
            </View>
          ) : (
            <View style={styles.detailActionBtn}>
              <Text style={styles.detailActionText}>Detail</Text>
              <Ionicons name="chevron-forward" size={13} color="#A1A1AA" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const token = useAuthStore((state) => state.token);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const data = useCustomerOrders(activeFilter);
  const { items: filteredHistory, loading, error } = data;
  const refreshing = loading && filteredHistory.length > 0;
  const onRefresh = data.reload;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const filterTabs = [
    { label: 'Semua', key: 'all' as const, count: data.summary.totalOrders },
    { label: 'Berhasil', key: 'verified' as const, count: data.summary.verified },
    { label: 'Menunggu', key: 'pending' as const, count: data.summary.pending },
    { label: 'Batal', key: 'failed' as const, count: data.summary.rejected + data.summary.expired },
  ];

  if (!token) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.guestIconWrap}>
          <Ionicons name="receipt-outline" size={40} color={BRAND_COLORS.accent} />
        </View>
        <Text style={styles.promptTitle}>Riwayat Transaksi</Text>
        <Text style={styles.promptSub}>
          Masuk ke akun Anda untuk melihat seluruh catatan transaksi dan status pembayaran tiket konser.
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
          <Text style={styles.headerTitle}>Riwayat Pesanan</Text>
          <Text style={styles.headerSub}>Catatan transaksi tiket konser akun Anda</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{data.summary.totalOrders} Transaksi</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }
                setActiveFilter(tab.key);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${tab.label} (${tab.count})`}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.filterCountDot, isActive && styles.filterCountDotActive]}>
                <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {data.offline ? <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: BRAND_COLORS.accent }}>Mode offline: menampilkan status pesanan terakhir yang tersimpan.</Text></View> : null}
      {error ? <TouchableOpacity onPress={data.reload} style={{ padding: 16 }} accessibilityRole="button"><Text style={{ color: '#FCA5A5' }}>{error} Ketuk untuk coba lagi.</Text></TouchableOpacity> : null}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
          <Text style={styles.loadingText}>Memuat riwayat transaksi...</Text>
        </View>
      ) : (
        <FlatList
          ListFooterComponent={data.page < data.totalPages ? <TouchableOpacity onPress={data.loadMore} disabled={loading} style={{ padding: 20, alignItems: 'center' }} accessibilityRole="button"><Text style={{ color: BRAND_COLORS.accent }}>{loading ? 'Memuat...' : 'Muat lebih banyak'}</Text></TouchableOpacity> : null}
          data={filteredHistory}
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
          renderItem={({ item }) => (
            <OrderCardItem
              item={item}
              onPress={() => {
                router.push(item.status === 'verified' ? `/ticket/${item.id}` : `/payment/${item.id}`);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={36} color="#71717A" />
              </View>
              <Text style={styles.emptyTitle}>Tidak Ada Transaksi</Text>
              <Text style={styles.emptyText}>
                Belum ada riwayat pesanan tiket konser pada kategori status ini.
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
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#1F1F24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  countBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#09090B',
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterChipActive: {
    backgroundColor: '#1F1F24',
    borderColor: BRAND_COLORS.accent,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  filterTextActive: {
    color: BRAND_COLORS.accent,
    fontWeight: '700',
  },
  filterCountDot: {
    backgroundColor: '#27272A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountDotActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  filterCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717A',
    fontVariant: ['tabular-nums'],
  },
  filterCountTextActive: {
    color: BRAND_COLORS.accent,
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

  orderCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderRefWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  orderRefText: {
    fontSize: 11,
    color: BRAND_COLORS.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 10,
  },

  eventBodyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventThumb: {
    width: 60,
    height: 82,
    borderRadius: 8,
    backgroundColor: '#1F1F24',
  },
  eventThumbPlaceholder: {
    width: 60,
    height: 82,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#FAFAFA',
    lineHeight: 18,
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

  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  footerQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    fontVariant: ['tabular-nums'],
  },
  footerDate: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 2,
  },
  qrActionBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
  },
  qrActionText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 11,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1F1F24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 36,
  },
  detailActionText: {
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
