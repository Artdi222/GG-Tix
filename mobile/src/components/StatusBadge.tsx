import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type StatusType = 'verified' | 'pending' | 'rejected' | 'expired' | 'checked_in' | 'open' | 'closed';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  let label = status;
  let dotColor = '#71717A';
  let badgeStyle = styles.badgeGray;
  let textColor = '#27272A';

  switch (status) {
    case 'verified':
      label = 'Berhasil';
      dotColor = '#059669';
      badgeStyle = styles.badgeGreen;
      textColor = '#059669';
      break;
    case 'pending':
      label = 'Menunggu Pembayaran';
      dotColor = '#D97706';
      badgeStyle = styles.badgeYellow;
      textColor = '#B45309';
      break;
    case 'rejected':
      label = 'Pembayaran Ditolak';
      dotColor = '#DC2626';
      badgeStyle = styles.badgeRed;
      textColor = '#DC2626';
      break;
    case 'expired':
      label = 'Kadaluwarsa';
      dotColor = '#71717A';
      badgeStyle = styles.badgeGray;
      textColor = '#3F3F46';
      break;
    case 'checked_in':
      label = 'Sudah Masuk Venue';
      dotColor = '#0284C7';
      badgeStyle = styles.badgeBlue;
      textColor = '#0369A1';
      break;
    case 'open':
      label = 'Tiket Tersedia';
      dotColor = '#059669';
      badgeStyle = styles.badgeGreen;
      textColor = '#059669';
      break;
    case 'closed':
      label = 'Penjualan Ditutup';
      dotColor = '#DC2626';
      badgeStyle = styles.badgeRed;
      textColor = '#DC2626';
      break;
    default:
      label = status;
  }

  return (
    <View style={[styles.badge, badgeStyle, size === 'md' && styles.badgeMd]}>
      <View style={[styles.dot, { backgroundColor: dotColor }, size === 'md' && styles.dotMd]} />
      <Text style={[styles.badgeText, { color: textColor }, size === 'md' && styles.badgeTextMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotMd: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeTextMd: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeYellow: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeBlue: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderColor: 'rgba(2, 132, 199, 0.35)',
  },
  badgeGray: {
    backgroundColor: 'rgba(24, 24, 27, 0.06)',
    borderColor: 'rgba(24, 24, 27, 0.12)',
  },
});
