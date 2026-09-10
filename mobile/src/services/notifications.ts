import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';
import { storage } from './storage';
import { session } from './session';

const TOKEN_KEY = 'ggtix_push_token';
const OWNER_KEY = 'ggtix_push_owner';
export const pushSupported = () => Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

// Dynamic import keeps the unavailable native push module out of Expo Go startup.
export async function registerForPushNotificationsAsync(): Promise<string> {
  if (!pushSupported()) throw new Error('Notifikasi push tersedia di development build atau aplikasi terpasang. Expo Go belum mendukung fitur ini.');
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Konfigurasi project notifikasi belum tersedia.');
  const revision = session.snapshot().revision;
  const userId = session.snapshot().user?.id;
  if (!userId) throw new Error('Masuk untuk mengaktifkan notifikasi.');
  const Notifications = await import('expo-notifications');
  const Device = await import('expo-device');
  if (!Device.isDevice) throw new Error('Aktifkan notifikasi dari perangkat fisik.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('tickets', { name: 'Tiket dan konser', importance: Notifications.AndroidImportance.HIGH });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Izin notifikasi belum diberikan. Aktifkan melalui pengaturan perangkat.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (session.snapshot().revision !== revision) throw new Error('Sesi berubah. Coba lagi.');
  await apiFetch('/notifications/device', { method: 'PUT', body: JSON.stringify({ token }) });
  await storage.setItem(TOKEN_KEY, token);
  await storage.setItem(OWNER_KEY, userId);
  return token;
}
export async function disablePushNotifications() {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) await apiFetch('/notifications/device', { method: 'DELETE', body: JSON.stringify({ token }) });
  await storage.removeItem(TOKEN_KEY); await storage.removeItem(OWNER_KEY);
}
export async function isPushEnabled() {
  return !!session.snapshot().user?.id && await storage.getItem(OWNER_KEY) === session.snapshot().user?.id;
}
export async function listenToNotifications(navigate: (path: string) => void) {
  if (!pushSupported()) return () => {};
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async notification => {
    const own = notification.request.content.data?.customerId === session.snapshot().user?.id;
    return { shouldPlaySound: own, shouldSetBadge: false, shouldShowBanner: own, shouldShowList: own };
  } });
  const open = (response: import('expo-notifications').NotificationResponse | null) => {
    if (!response) return;
    const data = response.notification.request.content.data;
    if (!data) return;
    if (data.customerId !== session.snapshot().user?.id || typeof data.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.id)) return;
    if (data.kind === 'order') navigate(`/ticket/${data.id}`);
    if (data.kind === 'event') navigate(`/event/${data.id}`);
    void Notifications.clearLastNotificationResponseAsync();
  };
  const listener = Notifications.addNotificationResponseReceivedListener(open);
  open(await Notifications.getLastNotificationResponseAsync());
  return () => listener.remove();
}
