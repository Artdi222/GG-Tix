import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { useAuthStore } from '../../store/auth-store';
import { StatusBadge } from '../../components/StatusBadge';

interface OrderHistoryItem {
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
    venue?: {
      name: string;
      city: string;
    };
  };
  category?: {
    name: string;
    price: string | number;
  };
}

export default function HistoryScreen() {
  const token = useAuthStore((state) => state.token);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'verified' | 'pending' | 'failed'>('all');

  const router = useRouter();

  const loadHistory = useCallback(async () => {
    if (!token) {
      setRefreshing(false);
      return;
    }
    try {
      const res = await apiFetch<any>('/orders/me');
      const items = Array.isArray(res) ? res : res.data?.items || res.items || res.data || [];
      setHistory(items);
    } catch {
      setHistory([]);
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
          setHistory(items);
        })
        .catch(() => {
          if (!isMounted) return;
          setHistory([]);
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
    loadHistory();
  }, [loadHistory]);

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

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const filterTabs = [
    { label: 'Semua', key: 'all' as const },
    { label: 'Berhasil', key: 'verified' as const },
    { label: 'Menunggu', key: 'pending' as const },
    { label: 'Gagal / Batal', key: 'failed' as const },
  ];

  const filteredHistory = history.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'verified') return item.status === 'verified';
    if (activeFilter === 'pending') return item.status === 'pending';
    if (activeFilter === 'failed') return item.status === 'rejected' || item.status === 'expired';
    return true;
  });

  if (!token) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="receipt-outline" size={60} color={BRAND_COLORS.accent} />
        <Text style={styles.promptTitle}>Riwayat Transaksi</Text>
        <Text style={styles.promptSub}>
          Masuk ke akun Anda untuk melihat seluruh catatan pembelian tiket dan status pembayaran.
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
        <Text style={styles.loadingText}>Memuat riwayat transaksi...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredHistory}
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
          <View style={styles.orderCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNumber}>ORDER #{item.id.substring(0, 8).toUpperCase()}</Text>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {item.event?.title || 'Konser Musik'}
                </Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.divider} />

            <View style={styles.cardDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Kategori</Text>
                <Text style={styles.detailValue}>{item.category?.name || 'Tiket'}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Jumlah</Text>
                <Text style={styles.detailValue}>{item.quantity} Tiket</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Biaya</Text>
                <Text style={styles.priceValue}>{formatCurrency(item.totalPrice)}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.dateText}>📅 Dipesan pada {formatDate(item.createdAt)}</Text>
              {item.status === 'verified' && (
                <TouchableOpacity
                  style={styles.viewTicketBtn}
                  onPress={() => router.push(`/ticket/${item.id}`)}
                >
                  <Ionicons name="qr-code" size={14} color={BRAND_COLORS.accent} />
                  <Text style={styles.viewTicketText}>Lihat QR</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={54} color={BRAND_COLORS.muted} />
            <Text style={styles.emptyTitle}>Tidak Ada Transaksi</Text>
            <Text style={styles.emptyText}>
              Belum ada riwayat pesanan tiket pada kategori ini.
            </Text>
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BRAND_COLORS.primary,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: BRAND_COLORS.accent,
    borderColor: BRAND_COLORS.accent,
  },
  filterText: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  orderNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  dateText: {
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
  },
  viewTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewTicketText: {
    color: BRAND_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
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
});
