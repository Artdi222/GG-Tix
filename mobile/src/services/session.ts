import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import { STORAGE_KEYS } from '../constants/config';
export interface SessionUser { id: string; name: string; email: string; role?: string }
let state = { token: null as string | null, refreshToken: null as string | null, user: null as SessionUser | null, revision: 0 };
const listeners = new Set<() => void>();
let writes: Promise<void> = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  const next = writes.catch(() => {}).then(action);
  writes = next;
  return next;
}
function publish() { listeners.forEach(listener => listener()); }
async function clearCaches() {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@ggtix_cached_') || key.startsWith('@ggtix_private:'));
  if (keys.length) await AsyncStorage.removeMany(keys);
}
export const session = {
  snapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  async initialize() {
    const expected = state.revision;
    await enqueue(async () => {
      const [token, refreshToken, raw] = await Promise.all([
        storage.getItem(STORAGE_KEYS.TOKEN), storage.getItem(STORAGE_KEYS.REFRESH_TOKEN), storage.getItem(STORAGE_KEYS.USER),
      ]);
      const legacy = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@ggtix_cached_'));
      if (legacy.length) await AsyncStorage.removeMany(legacy);
      let user: SessionUser | null = null;
      try { user = raw ? JSON.parse(raw) : null; } catch { /* invalid stored session */ }
      if (state.revision !== expected) return;
      state = { token: user?.id ? token : null, refreshToken, user, revision: expected };
      publish();
    });
  },
  async login(token: string, user: SessionUser, refreshToken?: string) {
    const revision = state.revision + 1;
    state = { token: null, refreshToken: null, user: null, revision }; publish();
    await enqueue(async () => {
      await clearCaches();
      await storage.removeItem(STORAGE_KEYS.TOKEN);
      await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      if (refreshToken) await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      await storage.setItem(STORAGE_KEYS.TOKEN, token);
      if (state.revision === revision) { state = { token, user, refreshToken: refreshToken || null, revision }; publish(); }
    });
  },
  async replaceToken(token: string, expected: number) {
    await enqueue(async () => {
      if (state.revision !== expected) return;
      await storage.setItem(STORAGE_KEYS.TOKEN, token);
      if (state.revision === expected) { state = { ...state, token }; publish(); }
    });
  },
  async updateUser(user: SessionUser, expected: number) {
    await enqueue(async () => {
      if (state.revision !== expected || state.user?.id !== user.id) return;
      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      if (state.revision === expected) { state = { ...state, user }; publish(); }
    });
  },
  async expire(expected = state.revision) {
    if (state.revision !== expected) return;
    state = { token: null, refreshToken: null, user: null, revision: expected + 1 }; publish();
    await enqueue(async () => {
      await Promise.all([storage.removeItem(STORAGE_KEYS.TOKEN), storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN), storage.removeItem(STORAGE_KEYS.USER), clearCaches()]);
    });
  },
  async cacheWrite(key: string, value: unknown, expected: number) {
    await enqueue(async () => {
      if (state.revision !== expected || !state.user || !state.token) return;
      await AsyncStorage.setItem(`@ggtix_private:${state.user.id}:${key}`, JSON.stringify(value));
    });
  },
  async cacheRead<T>(key: string, expected: number): Promise<T | null> {
    const userId = state.user?.id;
    if (!userId || !state.token || state.revision !== expected) return null;
    const raw = await AsyncStorage.getItem(`@ggtix_private:${userId}:${key}`);
    if (state.revision !== expected || !raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
};
