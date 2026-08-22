import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type StatusType = 'verified' | 'pending' | 'rejected' | 'expired' | 'checked_in' | 'open' | 'closed';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  let label = status;
  let bgStyle = styles.badgeGray;
  let textStyle = styles.textWhite;

  switch (status) {
    case 'verified':
      label = 'Tiket Aktif ✓';
      bgStyle = styles.badgeGreen;
      textStyle = styles.textDark;
      break;
    case 'pending':
      label = 'Menunggu Verifikasi';
      bgStyle = styles.badgeYellow;
      textStyle = styles.textDark;
      break;
    case 'rejected':
      label = 'Pembayaran Ditolak';
      bgStyle = styles.badgeRed;
      textStyle = styles.textWhite;
      break;
    case 'expired':
      label = 'Kadaluwarsa';
      bgStyle = styles.badgeGray;
      textStyle = styles.textWhite;
      break;
    case 'checked_in':
      label = 'Sudah Check-In';
      bgStyle = styles.badgeBlue;
      textStyle = styles.textWhite;
      break;
    case 'open':
      label = 'Buka';
      bgStyle = styles.badgeGreen;
      textStyle = styles.textDark;
      break;
    case 'closed':
      label = 'Tutup';
      bgStyle = styles.badgeRed;
      textStyle = styles.textWhite;
      break;
    default:
      label = status;
  }

  return (
    <View style={[styles.badge, bgStyle, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.badgeText, textStyle, size === 'md' && styles.badgeTextMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badgeTextMd: {
    fontSize: 13,
  },
  badgeGreen: {
    backgroundColor: '#4CD964',
  },
  badgeYellow: {
    backgroundColor: '#F2A93B',
  },
  badgeRed: {
    backgroundColor: '#FF3B30',
  },
  badgeBlue: {
    backgroundColor: '#5AC8FA',
  },
  badgeGray: {
    backgroundColor: '#555266',
  },
  textDark: {
    color: '#1B1330',
  },
  textWhite: {
    color: '#FFFFFF',
  },
});
