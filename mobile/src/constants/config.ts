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

export const BRAND_COLORS = {
  primary: '#1B1330', // Deep Indigo
  secondary: '#2D224C', // Surface Indigo
  accent: '#F2A93B', // Golden Amber
  accentHover: '#E0982A',
  success: '#4CD964', // Emerald Green
  danger: '#FF3B30', // Ruby Red
  warning: '#F2A93B', // Amber
  muted: '#8E8B9A',
  cardBg: '#2D224C',
  bgDark: '#1B1330',
  white: '#FFFFFF',
  textLight: '#F3F4F6',
  textMuted: '#9CA3AF',
} as const;
