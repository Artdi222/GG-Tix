import { create } from 'zustand';
import { apiFetch } from '../services/api';
import { session, type SessionUser } from '../services/session';
export type User = SessionUser;
interface AuthState {
  token: string | null; refreshToken: string | null; user: User | null;
  isLoading: boolean; isInitialized: boolean;
  setAuth(token: string, user: User, refreshToken?: string): Promise<void>;
  logout(): Promise<void>;
  initializeAuth(): Promise<void>;
  fetchProfile(): Promise<User | null>;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  token: null, refreshToken: null, user: null, isLoading: false, isInitialized: false,
  setAuth: async (token, user, refreshToken) => { await session.login(token, user, refreshToken); set({ isInitialized: true }); },
  logout: () => session.expire(),
  fetchProfile: async () => {
    const revision = session.snapshot().revision;
    try {
      const user = await apiFetch<User>('/auth/me');
      await session.updateUser(user, revision);
      return session.snapshot().revision === revision ? user : null;
    } catch { return null; }
  },
  initializeAuth: async () => {
    try { await session.initialize(); } catch { /* Remain signed out if persistent storage is unavailable. */ } finally { set({ isInitialized: true }); }
    if (session.snapshot().token) void get().fetchProfile();
  },
}));
session.subscribe(() => {
  const { token, refreshToken, user } = session.snapshot();
  useAuthStore.setState({ token, refreshToken, user });
});
