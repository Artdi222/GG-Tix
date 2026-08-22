import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';

export default function CheckoutScreen() {
  const { id, categoryId, qty, categoryName, price } = useLocalSearchParams<{
    id: string;
    categoryId: string;
    qty: string;
    categoryName?: string;
    price?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const quantity = parseInt(qty || '1', 10);
  const unitPrice = parseFloat(price || '0');
  const totalPrice = unitPrice * quantity;

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

  const handleProceedPayment = async () => {
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

      // res contains { data: order, payment?: { snapToken, redirectUrl } }
      const snapUrl = res.payment?.redirectUrl || res.payment?.snapUrl || res.redirectUrl;

      if (snapUrl) {
        // Open Midtrans Snap Web Sheet
        await WebBrowser.openBrowserAsync(snapUrl);
        // Redirect to tickets tab
        router.replace('/(tabs)/tickets');
      } else {
        router.replace('/(tabs)/tickets');
      }
    } catch (error: any) {
      Alert.alert('Gagal Memproses Pesanan', error.message || 'Terjadi kesalahan saat memproses checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konfirmasi Pesanan</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Order Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="ticket" size={20} color={BRAND_COLORS.accent} />
            <Text style={styles.cardTitle}>Rincian Tiket</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Kategori Tiket</Text>
            <Text style={styles.detailValue}>{categoryName || 'General Admission'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Harga Satuan</Text>
            <Text style={styles.detailValue}>{formattedUnitPrice}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Jumlah</Text>
            <Text style={styles.detailValue}>{quantity} Tiket</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>Total Tagihan</Text>
            <Text style={styles.totalValue}>{formattedTotalPrice}</Text>
          </View>
        </View>

        {/* Payment Gateway Notice */}
        <View style={styles.gatewayNotice}>
          <Ionicons name="shield-checkmark" size={22} color={BRAND_COLORS.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Midtrans Payment Gateway</Text>
            <Text style={styles.noticeSub}>
              Pembayaran aman mendukung QRIS (GoPay/ShopeePay/BCA), Virtual Account, dan Kartu Kredit.
            </Text>
          </View>
        </View>

        {/* Guarantee Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 E-Ticket dengan QR Code akan otomatis aktif setelah pembayaran berhasil diverifikasi.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={styles.stickyFooter}>
        <View>
          <Text style={styles.footerSub}>Total Bayar</Text>
          <Text style={styles.footerTotal}>{formattedTotalPrice}</Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, loading && styles.payButtonDisabled]}
          onPress={handleProceedPayment}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          ) : (
            <>
              <Text style={styles.payButtonText}>Lanjut ke Pembayaran</Text>
              <Ionicons name="lock-closed" size={16} color={BRAND_COLORS.primary} />
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  card: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: BRAND_COLORS.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  gatewayNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2C3D',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 250, 0.2)',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  noticeSub: {
    fontSize: 12,
    color: '#93C5FD',
    lineHeight: 16,
  },
  infoBox: {
    backgroundColor: 'rgba(242, 169, 59, 0.1)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 59, 0.2)',
  },
  infoText: {
    color: BRAND_COLORS.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerSub: {
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
  },
  footerTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
  },
  payButton: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
