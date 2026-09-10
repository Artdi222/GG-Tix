import { expect, test } from 'bun:test';
import { paymentReturnUrlSchema } from '../src/lib/payment-return';

test('accepts only the expected native payment route', () => {
  expect(paymentReturnUrlSchema.safeParse('mobile://payment').success).toBe(true);
  for (const value of ['javascript:alert(1)', 'mobile://profile', 'mobile://payment?token=secret','https://attacker.example/payment','mobile://user:pass@payment']) {
    expect(paymentReturnUrlSchema.safeParse(value).success).toBe(false);
  }
});
test('Expo Go LAN return is available only outside production', () => {
  const env = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    expect(paymentReturnUrlSchema.safeParse('exp://192.168.1.58:8081/--/payment').success).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(paymentReturnUrlSchema.safeParse('exp://192.168.1.58:8081/--/payment').success).toBe(false);
  } finally { process.env.NODE_ENV = env; }
});
