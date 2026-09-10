import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, customerOnly, orderRateLimiter } from '../lib/middleware';
import { registerDevice, unregisterDevice } from '../services/notification.service';
const route = new Hono();
const deviceSchema = z.object({ token: z.string().max(200).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) });
route.use('*', authMiddleware, customerOnly);
route.put('/device', orderRateLimiter, zValidator('json', deviceSchema), async c => {
  const device = await registerDevice(c.get('user').sub, c.req.valid('json').token);
  return c.json({ data: device });
});
route.delete('/device', zValidator('json', deviceSchema), async c => {
  await unregisterDevice(c.get('user').sub, c.req.valid('json').token);
  return c.json({ message: 'Notifikasi perangkat dinonaktifkan.' });
});
export default route;
