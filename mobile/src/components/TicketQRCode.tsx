import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_COLORS } from '../constants/config';
import { StatusBadge } from './StatusBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const shimmerTranslateX = useSharedValue(-SCREEN_WIDTH);

  useEffect(() => {
    shimmerTranslateX.value = withRepeat(
      withTiming(SCREEN_WIDTH * 1.5, {
        duration: 3500,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      }),
      -1,
      false
    );

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
      }
    }

    setMaxBrightness();

    return () => {
      if (originalBrightness !== null && Platform.OS !== 'web') {
        Brightness.setBrightnessAsync(originalBrightness).catch(() => {});
      }
    };
  }, [shimmerTranslateX]);

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslateX.value }, { rotate: '25deg' }],
  }));

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
        <View style={styles.topSection}>
          <Animated.View style={[styles.shimmerBeam, shimmerAnimatedStyle]} pointerEvents="none" />

          <View style={styles.securityWatermarkRow}>
            <Ionicons name="shield-checkmark" size={13} color={BRAND_COLORS.accent} />
            <Text style={styles.securityWatermarkText}>
              E-TIKET RESMI GG-TIX
            </Text>
          </View>

          <Text style={styles.eventTitle} numberOfLines={2}>
            {eventTitle}
          </Text>
          {eventDate && <Text style={styles.eventDate}>📅 {formatDate(eventDate)} WIB</Text>}
          {venueName && <Text style={styles.venueName}>📍 {venueName}</Text>}

          <View style={styles.badgeRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{categoryName}</Text>
            </View>
            <StatusBadge status={ticket.checkedIn ? 'checked_in' : 'verified'} size="sm" />
          </View>
        </View>

        <View style={styles.tearLineContainer}>
          <View style={styles.cutoutLeft} />
          <View style={styles.dashedLine} />
          <View style={styles.cutoutRight} />
        </View>

        <View style={styles.qrSection}>
          <Text style={styles.scanInstruction}>
            Tunjukkan kode QR ini kepada petugas di pintu masuk venue
          </Text>

          <View style={styles.qrWrapper}>
            <QRCode
              value={ticket.qrCodeValue}
              size={220}
              color="#09090B"
              backgroundColor="#FFFFFF"
            />
          </View>

          <Text style={styles.ticketCode}>#{ticket.qrCodeValue.substring(0, 16).toUpperCase()}</Text>

          {ticket.checkedIn && (
            <View style={styles.checkedInBox}>
              <Ionicons name="checkmark-circle" size={14} color="#065F46" />
              <Text style={styles.checkedInText}>
                Telah masuk venue: {formatDate(ticket.checkedInAt || undefined)}
              </Text>
            </View>
          )}

          <View style={styles.brightnessHintRow}>
            <Ionicons name="sunny-outline" size={12} color="#9CA3AF" />
            <Text style={styles.brightnessHintText}>
              Kecerahan layar otomatis dinaikkan untuk scan QR
            </Text>
          </View>
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
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  topSection: {
    backgroundColor: '#16161A',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerBeam: {
    position: 'absolute',
    top: -80,
    width: 60,
    height: 300,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  securityWatermarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  securityWatermarkText: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAFAFA',
    lineHeight: 24,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  eventDate: {
    fontSize: 13,
    color: BRAND_COLORS.accent,
    marginBottom: 4,
    fontWeight: '700',
  },
  venueName: {
    fontSize: 13,
    color: '#A1A1AA',
    marginBottom: 12,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  catBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  catBadgeText: {
    color: BRAND_COLORS.accent,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tearLineContainer: {
    height: 22,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cutoutLeft: {
    position: 'absolute',
    left: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#09090B',
    borderRightWidth: 1,
    borderRightColor: '#27272A',
  },
  cutoutRight: {
    position: 'absolute',
    right: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#09090B',
    borderLeftWidth: 1,
    borderLeftColor: '#27272A',
  },
  dashedLine: {
    width: '80%',
    height: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  qrSection: {
    padding: 22,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scanInstruction: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketCode: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  checkedInBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  checkedInText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  brightnessHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  brightnessHintText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
