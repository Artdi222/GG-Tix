import { create } from 'zustand';
import { apiFetch, storage } from '../services/api';
import { STORAGE_KEYS } from '../constants/config';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (token: string, user: User, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  fetchProfile: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
  isInitialized: false,

  setAuth: async (token: string, user: User, refreshToken?: string) => {
    await storage.setItem(STORAGE_KEYS.TOKEN, token);
    await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    if (refreshToken) {
      await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
    set({ token, user, refreshToken: refreshToken || null, isInitialized: true });
  },

  logout: async () => {
    await storage.removeItem(STORAGE_KEYS.TOKEN);
    await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.removeItem(STORAGE_KEYS.USER);
    set({ token: null, refreshToken: null, user: null });
  },

  fetchProfile: async () => {
    try {
      const user = await apiFetch<User>('/auth/me');
      if (user) {
        await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        set({ user });
        return user;
      }
      return null;
    } catch {
      return null;
    }
  },

  initializeAuth: async () => {
    try {
      const [token, refreshToken, userStr] = await Promise.all([
        storage.getItem(STORAGE_KEYS.TOKEN),
        storage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        storage.getItem(STORAGE_KEYS.USER),
      ]);

      let user: User | null = null;
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch {
          user = null;
        }
      }

      if (token) {
        set({ token, refreshToken, user, isInitialized: true });
        // Refresh profile in background
        get().fetchProfile();
      } else {
        set({ isInitialized: true, token: null, user: null });
      }
    } catch {
      set({ isInitialized: true, token: null, user: null });
    }
  },
}));
