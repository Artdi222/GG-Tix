import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { TicketQRCode } from '../../components/TicketQRCode';

interface TicketData {
  id: string;
  qrCodeValue: string;
  checkedIn?: boolean;
  checkedInAt?: string | null;
}

interface OrderDetailResponse {
  order: {
    id: string;
    eventTitle: string;
    categoryName: string;
    venueName?: string;
    eventDate?: string;
    quantity: number;
    status: string;
  };
  tickets: TicketData[];
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [currentIndex, setCurrentIndex] = useState(0);

  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    if (id) {
      apiFetch<any>(`/tickets/order/${id}`)
        .then((res) => {
          if (!isMounted) return;
          const orderData = res.data || res;
          setData(orderData);
        })
        .catch((err: any) => {
          if (!isMounted) return;
          Alert.alert('Gagal Memuat Tiket', err.message || 'Tiket tidak ditemukan atau belum diverifikasi.');
        })
        .finally(() => {
          if (!isMounted) return;
          setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleTabSwitch = (idx: number) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setCurrentIndex(idx);
  };

  if (loading || !data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
        <Text style={styles.loadingText}>Memuat QR Code Tiket...</Text>
      </View>
    );
  }

  const currentTicket = data.tickets?.[currentIndex] || data.tickets?.[0];
  const totalTickets = data.tickets?.length || 1;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke daftar tiket"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FAFAFA" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>E-Ticket Digital</Text>
          <View style={styles.sslBadge}>
            <Ionicons name="shield-checkmark" size={11} color={BRAND_COLORS.success} />
            <Text style={styles.sslBadgeText}>RESMI</Text>
          </View>
        </View>

        {totalTickets > 1 && (
          <View style={styles.switcherContainer}>
            <Text style={styles.switcherLabel}>
              PILIH TIKET ({currentIndex + 1} DARI {totalTickets})
            </Text>
            <View style={styles.switcherTabs}>
              {data.tickets.map((t, idx) => {
                const isActive = currentIndex === idx;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.switcherTab,
                      isActive && styles.switcherTabActive,
                    ]}
                    onPress={() => handleTabSwitch(idx)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Tiket ${idx + 1}`}
                  >
                    <Text
                      style={[
                        styles.switcherTabText,
                        isActive && styles.switcherTabTextActive,
                      ]}
                    >
                      Tiket {idx + 1} {t.checkedIn ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {currentTicket ? (
          <TicketQRCode
            ticket={currentTicket}
            eventTitle={data.order.eventTitle}
            categoryName={data.order.categoryName}
            venueName={data.order.venueName}
            eventDate={data.order.eventDate}
          />
        ) : (
          <Text style={styles.errorText}>Data tiket tidak valid.</Text>
        )}

        <View style={styles.tipBox}>
          <View style={styles.tipIconWrap}>
            <Ionicons name="sunny" size={18} color={BRAND_COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Kecerahan Otomatis Aktif</Text>
            <Text style={styles.tipText}>
              Kecerahan layar otomatis dimaksimalkan demi kelancaran scan barcode saat memasuki gate konser.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  sslBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
  switcherContainer: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
  },
  switcherLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  switcherTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switcherTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: '#27272A',
    minHeight: 38,
    justifyContent: 'center',
  },
  switcherTabActive: {
    backgroundColor: BRAND_COLORS.accent,
    borderColor: BRAND_COLORS.accent,
  },
  switcherTabText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  switcherTabTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  errorText: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#16161A',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 18,
    maxWidth: 360,
    width: '100%',
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 11,
    color: '#71717A',
    lineHeight: 16,
  },
});
