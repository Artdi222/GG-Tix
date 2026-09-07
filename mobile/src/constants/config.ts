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
  primary: '#09090B', 
  bgDark: '#09090B', 
  bgHeader: '#111114', 
  secondary: '#16161A', 
  cardBg: '#16161A', 
  cardBgElevated: '#1F1F24', 
  cardBgHover: '#27272E',

  accent: '#F59E0B', 
  accentGold: '#F59E0B',
  accentHover: '#D97706',
  accentGlow: 'rgba(245, 158, 11, 0.15)',
  accentGlowStrong: 'rgba(245, 158, 11, 0.3)',

  success: '#10B981', 
  successBg: 'rgba(16, 185, 129, 0.1)',
  danger: '#EF4444', 
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.1)',

  
  borderLight: '#27272A', 
  borderMedium: '#3F3F46', 
  borderGold: 'rgba(245, 158, 11, 0.4)',

  
  seatAvailable: '#10B981', 
  seatSelected: '#F59E0B',  
  seatLocked: '#EF4444',    
  seatSold: '#27272A',      
  zoneVip: '#A855F7',       
  zoneCat1: '#38BDF8',      
  zoneCat2: '#34D399',      
  zoneCat3: '#FBBF24',      
  zoneFestival: '#EC4899',  

  
  white: '#FFFFFF',
  textLight: '#FAFAFA', 
  textMuted: '#A1A1AA', 
  textDim: '#71717A', 
  muted: '#71717A',
} as const;
