import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { TicketQRCode } from '../../components/TicketQRCode';

interface TicketItem {
  id: string;
  qrCodeValue: string;
  checkedIn?: boolean;
  checkedInAt?: string | null;
}

interface TicketOrderData {
  order: {
    id: string;
    customerId: string;
    eventTitle: string;
    eventDate: string;
    venueName: string;
    categoryName: string;
    quantity: number;
    status: string;
  };
  tickets: TicketItem[];
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<TicketOrderData | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [currentIndex, setCurrentIndex] = useState(0);

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    if (id) {
      apiFetch<any>(`/tickets/order/${id}`)
        .then((res) => {
          if (!isMounted) return;
          const payload = res?.data || res;
          setData(payload);
        })
        .catch((error: any) => {
          if (!isMounted) return;
          Alert.alert('Gagal Memuat Tiket', error.message || 'Tiket tidak ditemukan atau belum aktif.');
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>E-Ticket Digital</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Multi-Ticket Switcher */}
        {totalTickets > 1 && (
          <View style={styles.switcherContainer}>
            <Text style={styles.switcherLabel}>
              Pilih Tiket ({currentIndex + 1} dari {totalTickets})
            </Text>
            <View style={styles.switcherTabs}>
              {data.tickets.map((t, idx) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.switcherTab,
                    currentIndex === idx && styles.switcherTabActive,
                  ]}
                  onPress={() => setCurrentIndex(idx)}
                >
                  <Text
                    style={[
                      styles.switcherTabText,
                      currentIndex === idx && styles.switcherTabTextActive,
                    ]}
                  >
                    Tiket {idx + 1} {t.checkedIn ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* QR Code Presentation Component */}
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
          <Ionicons name="sunny" size={20} color={BRAND_COLORS.accent} />
          <Text style={styles.tipText}>
            Kecerahan layar ditingkatkan otomatis agar proses pemindaian di pintu gate cepat dan lancar.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND_COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  switcherContainer: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
    alignItems: 'center',
  },
  switcherLabel: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    marginBottom: 8,
    fontWeight: '600',
  },
  switcherTabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  switcherTab: {
    backgroundColor: BRAND_COLORS.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  switcherTabActive: {
    backgroundColor: BRAND_COLORS.accent,
    borderColor: BRAND_COLORS.accent,
  },
  switcherTabText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  switcherTabTextActive: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
  },
  errorText: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(242, 169, 59, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 59, 0.2)',
  },
  tipText: {
    color: BRAND_COLORS.accent,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
