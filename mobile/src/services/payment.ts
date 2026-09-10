import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export interface PaymentStatus {
  orderId: string;
  status: 'pending' | 'verified' | 'expired' | 'rejected';
  totalPrice: string;
  quantity: number;
  paymentStatus: string | null;
  requiresReview: boolean;
  payment: { token: string; redirectUrl: string; expiresAt: string } | null;
}

export const paymentReturnBase = () => Linking.createURL('/payment');

export async function openPaymentBrowser(url: string, orderId: string) {
  // Never follow a payment link from route/query parameters.
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['app.sandbox.midtrans.com', 'app.midtrans.com'].includes(parsed.hostname)) {
    throw new Error('Tautan pembayaran tidak valid. Coba periksa status pesanan.');
  }
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return;
  }
  const returnUrl = `${paymentReturnBase()}/${orderId}`;
  if (Platform.OS === 'android') {
    // Unlike openBrowserAsync on Android, this waits for return/cancel, not just opening.
    await WebBrowser.openAuthSessionAsync(url, returnUrl, { createTask: false, showTitle: true, enableBarCollapsing: false });
  } else {
    const subscription = Linking.addEventListener('url', event => {
      if (event.url.split('?')[0] === returnUrl) WebBrowser.dismissBrowser();
    });
    try {
      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close', enableBarCollapsing: false });
    } finally {
      subscription.remove();
    }
  }
}
