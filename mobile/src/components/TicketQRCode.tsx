import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';
import { BRAND_COLORS } from '../constants/config';
import { StatusBadge } from './StatusBadge';

interface TicketQRCodeProps {
  ticket: {
    id: string;
    qrCodeValue: string;
    checkedIn?: boolean;
    checkedInAt?: string | null;
  };
  eventTitle: string;
  categoryName: string;
  venueName?: string;
  eventDate?: string;
}

export function TicketQRCode({
  ticket,
  eventTitle,
  categoryName,
  venueName,
  eventDate,
}: TicketQRCodeProps) {
  useEffect(() => {
    let originalBrightness: number | null = null;

    async function setMaxBrightness() {
      if (Platform.OS === 'web') return;
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') {
          originalBrightness = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1.0);
        }
      } catch {
        // Ignored
      }
    }

    setMaxBrightness();

    return () => {
      if (originalBrightness !== null && Platform.OS !== 'web') {
        Brightness.setBrightnessAsync(originalBrightness).catch(() => {});
      }
    };
  }, []);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.ticketCard}>
        {/* Top Section */}
        <View style={styles.topSection}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {eventTitle}
          </Text>
          {eventDate && <Text style={styles.eventDate}>📅 {formatDate(eventDate)}</Text>}
          {venueName && <Text style={styles.venueName}>📍 {venueName}</Text>}

          <View style={styles.badgeRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{categoryName}</Text>
            </View>
            <StatusBadge status={ticket.checkedIn ? 'checked_in' : 'verified'} size="sm" />
          </View>
        </View>

        {/* Tear line divider */}
        <View style={styles.tearLineContainer}>
          <View style={styles.cutoutLeft} />
          <View style={styles.dashedLine} />
          <View style={styles.cutoutRight} />
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <Text style={styles.scanInstruction}>
            Tunjukkan QR ini ke petugas gate di pintu masuk venue
          </Text>

          <View style={styles.qrWrapper}>
            <QRCode
              value={ticket.qrCodeValue}
              size={220}
              color="#1B1330"
              backgroundColor="#FFFFFF"
            />
          </View>

          <Text style={styles.ticketCode}>#{ticket.qrCodeValue.substring(0, 16).toUpperCase()}</Text>

          {ticket.checkedIn && (
            <View style={styles.checkedInBox}>
              <Text style={styles.checkedInText}>
                ✓ Telah masuk venue: {formatDate(ticket.checkedInAt || undefined)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  topSection: {
    backgroundColor: BRAND_COLORS.secondary,
    padding: 20,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 13,
    color: BRAND_COLORS.accent,
    marginBottom: 4,
    fontWeight: '600',
  },
  venueName: {
    fontSize: 13,
    color: BRAND_COLORS.textMuted,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  catBadge: {
    backgroundColor: 'rgba(242, 169, 59, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND_COLORS.accent,
  },
  catBadgeText: {
    color: BRAND_COLORS.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  tearLineContainer: {
    height: 24,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cutoutLeft: {
    position: 'absolute',
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
  },
  cutoutRight: {
    position: 'absolute',
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
  },
  dashedLine: {
    width: '80%',
    height: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  qrSection: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scanInstruction: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ticketCode: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 1,
  },
  checkedInBox: {
    marginTop: 16,
    backgroundColor: 'rgba(76, 217, 100, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.success,
  },
  checkedInText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
});
