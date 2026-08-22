import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { useAuthStore } from '../../store/auth-store';

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

export default function TicketsScreen() {
  const token = useAuthStore((state) => state.token);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  const loadOrders = useCallback(async () => {
    if (!token) {
      setRefreshing(false);
      return;
    }
    try {
      const res = await apiFetch<any>('/orders/me');
      const items = Array.isArray(res) ? res : res.data?.items || res.items || res.data || [];
      const verifiedOrders = items.filter((o: OrderItem) => o.status === 'verified');
      setOrders(verifiedOrders);
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
          const verifiedOrders = items.filter((o: OrderItem) => o.status === 'verified');
          setOrders(verifiedOrders);
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

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('id-ID', {
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

  if (!token) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={60} color={BRAND_COLORS.accent} />
        <Text style={styles.promptTitle}>Silakan Masuk</Text>
        <Text style={styles.promptSub}>
          Masuk dengan akun customer GG Tix untuk melihat tiket digital & QR check-in Anda.
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginBtnText}>Masuk ke Akun</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
        <Text style={styles.loadingText}>Memuat tiket digital...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_COLORS.accent}
            colors={[BRAND_COLORS.accent]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.ticketCard}
            activeOpacity={0.88}
            onPress={() => router.push(`/ticket/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {item.event?.title || 'Konser Musik'}
                </Text>
                <Text style={styles.eventDate}>📅 {formatDate(item.event?.dateTime)} WIB</Text>
                <Text style={styles.venueText}>
                  📍 {item.event?.venue?.name || 'Venue'}, {item.event?.venue?.city || 'Kota'}
                </Text>
              </View>
            </View>

            <View style={styles.tearDivider}>
              <View style={styles.cutoutLeft} />
              <View style={styles.dashedLine} />
              <View style={styles.cutoutRight} />
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.catName}>{item.category?.name || 'Kategori Tiket'}</Text>
                <Text style={styles.qtyText}>{item.quantity} Tiket Tersedia</Text>
              </View>

              <View style={styles.qrActionBtn}>
                <Ionicons name="qr-code" size={18} color={BRAND_COLORS.primary} />
                <Text style={styles.qrActionText}>Buka QR</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={60} color={BRAND_COLORS.muted} />
            <Text style={styles.emptyTitle}>Belum Ada Tiket Aktif</Text>
            <Text style={styles.emptyText}>
              Tiket yang telah diverifikasi pembayarannya akan muncul di sini beserta QR Code check-in.
            </Text>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.exploreBtnText}>Cari Konser</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  promptSub: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  loginBtnText: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  loadingText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
  ticketCard: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 13,
    color: BRAND_COLORS.accent,
    fontWeight: '600',
    marginBottom: 4,
  },
  venueText: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
  },
  tearDivider: {
    height: 18,
    backgroundColor: BRAND_COLORS.cardBg,
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
    backgroundColor: BRAND_COLORS.bgDark,
  },
  cutoutRight: {
    position: 'absolute',
    right: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  dashedLine: {
    width: '85%',
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
  },
  cardFooter: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  qtyText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  qrActionBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrActionText: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyText: {
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  exploreBtn: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderWidth: 1,
    borderColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  exploreBtnText: {
    color: BRAND_COLORS.accent,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
