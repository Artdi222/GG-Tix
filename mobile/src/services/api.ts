import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/config';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch {
      // Ignored
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // Ignored
    }
  },
};

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  error?: string;
  payment?: {
    snapToken?: string;
    redirectUrl?: string;
  };
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getItem(STORAGE_KEYS.TOKEN);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      await storage.removeItem(STORAGE_KEYS.TOKEN);
      await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await storage.removeItem(STORAGE_KEYS.USER);
      throw new Error('Sesi telah berakhir. Silakan masuk kembali.');
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      throw new Error(json.error || json.message || 'Terjadi kesalahan pada server.');
    }

    // If response contains payment info alongside data (like in placeOrder), return the whole json
    if (json.payment) {
      return json as unknown as T;
    }

    // Return data if wrapped, otherwise return whole payload
    if (json.data !== undefined) {
      return json.data as T;
    }

    return json as unknown as T;
  } catch (error: any) {
    if (error.message === 'Network request failed') {
      throw new Error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    throw error;
  }
}
