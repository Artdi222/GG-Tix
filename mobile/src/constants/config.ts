import { Platform } from 'react-native';

const DEFAULT_LOCAL_IP = 'localhost';

export const API_BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return `http://${DEFAULT_LOCAL_IP}:3000/api`;
})();

export const STORAGE_KEYS = {
  TOKEN: 'ggtix_customer_token',
  REFRESH_TOKEN: 'ggtix_customer_refresh_token',
  USER: 'ggtix_customer_user',
} as const;

// Light theme, sharing the admin dashboard's violet brand.
export const BRAND_COLORS = {
  primary: '#18181B',
  bgDark: '#F6F6F8',
  bgHeader: '#FFFFFF',
  secondary: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBgElevated: '#F4F4F5',
  cardBgHover: '#EDEDF0',

  accent: '#7C3AED',
  accentGold: '#7C3AED',
  accentHover: '#6D28D9',
  accentGlow: 'rgba(124, 58, 237, 0.10)',
  accentGlowStrong: 'rgba(124, 58, 237, 0.22)',

  success: '#059669',
  successBg: 'rgba(5, 150, 105, 0.1)',
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.08)',
  warning: '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.1)',

  borderLight: '#E4E4E7',
  borderMedium: '#D4D4D8',
  borderGold: 'rgba(124, 58, 237, 0.35)',

  seatAvailable: '#059669',
  seatSelected: '#7C3AED',
  seatLocked: '#DC2626',
  seatSold: '#D4D4D8',
  zoneVip: '#9333EA',
  zoneCat1: '#0284C7',
  zoneCat2: '#059669',
  zoneCat3: '#D97706',
  zoneFestival: '#DB2777',

  white: '#FFFFFF',
  textLight: '#18181B',
  textMuted: '#52525B',
  textDim: '#71717A',
  muted: '#71717A',
} as const;
