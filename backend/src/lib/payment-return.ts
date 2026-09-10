import { z } from 'zod';

// Only the app's payment route or an explicitly configured web origin may receive a return.
export const paymentReturnUrlSchema = z.string().url().max(180).refine(value => {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.protocol === 'mobile:') return url.hostname === 'payment' && !url.pathname;
  const isLocal = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  if (process.env.NODE_ENV !== 'production' && isLocal) {
    if (url.protocol === 'exp:') return url.pathname === '/--/payment';
    if (url.protocol === 'http:') return url.pathname === '/payment';
  }
  return url.protocol === 'https:' && url.pathname === '/payment' &&
    (process.env.CORS_ORIGINS ?? '').split(',').map(origin => origin.trim()).includes(url.origin);
}, 'Invalid payment return URL').optional();
