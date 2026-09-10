import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { pushDevices, notificationJobs } from '../db/schema';

export async function registerDevice(customerId: string, token: string) {
  return db.transaction(async tx => {
    // Serialize token reassignment, including first registration on two accounts.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${token}))`);
    const [old] = await tx.select().from(pushDevices).where(eq(pushDevices.token, token)).for('update');
    if (old && old.customerId !== customerId) {
      await tx.delete(notificationJobs).where(eq(notificationJobs.deviceId, old.id));
    }
    const [device] = await tx.insert(pushDevices).values({ customerId, token }).onConflictDoUpdate({
      target: pushDevices.token,
      set: { customerId, enabled: true, activatedAt: old?.customerId === customerId && old.enabled ? old.activatedAt : new Date() },
    }).returning({ id: pushDevices.id, enabled: pushDevices.enabled });
    return device;
  });
}
export async function unregisterDevice(customerId: string, token: string) {
  await db.transaction(async tx => {
    const [device] = await tx.update(pushDevices).set({ enabled: false }).where(and(eq(pushDevices.customerId, customerId), eq(pushDevices.token, token))).returning();
    if (device) await tx.update(notificationJobs).set({ status: 'cancelled' }).where(and(eq(notificationJobs.deviceId, device.id), eq(notificationJobs.status, 'pending')));
  });
}

// The unique key makes repeated scheduler ticks and duplicate payment callbacks safe.
// Only post-opt-in events/payments are announced; reminders cover owned upcoming tickets.
export async function enqueueNotifications() {
  await db.execute(sql`
    insert into notification_jobs (dedupe_key, device_id, title, body, data)
    select 'paid:' || d.id || ':' || o.id, d.id, 'Pembayaran berhasil', 'Tiket Anda siap. Buka GG-Tix untuk melihat detail.',
      jsonb_build_object('kind','order','id',o.id,'customerId',d.customer_id)
    from orders o join push_devices d on d.customer_id = o.customer_id and d.enabled
    where o.status = 'verified' and o.verified_at >= d.activated_at and o.verified_at >= now() - interval '7 days'
    on conflict (dedupe_key) do nothing`);
  await db.execute(sql`
    insert into notification_jobs (dedupe_key, device_id, title, body, data)
    select 'reminder:' || d.id || ':' || o.id, d.id, 'Konser sebentar lagi', 'Acara Anda dimulai dalam 24 jam. Siapkan e-tiket untuk check-in.',
      jsonb_build_object('kind','order','id',o.id,'customerId',d.customer_id)
    from orders o join events e on e.id = o.event_id join push_devices d on d.customer_id = o.customer_id and d.enabled
    where o.status = 'verified' and e.date_time > now() and e.date_time <= now() + interval '24 hours'
      and exists (select 1 from tickets t where t.order_id = o.id and not t.checked_in)
    on conflict (dedupe_key) do nothing`);
  await db.execute(sql`
    insert into notification_jobs (dedupe_key, device_id, title, body, data)
    select 'event:' || d.id || ':' || e.id, d.id, 'Konser baru di GG-Tix', 'Temukan acara terbaru dan kategori tiket yang tersedia.',
      jsonb_build_object('kind','event','id',e.id,'customerId',d.customer_id)
    from events e cross join push_devices d
    where d.enabled and e.status = 'open' and e.date_time > now() and e.created_at >= d.activated_at and e.created_at >= now() - interval '7 days'
    on conflict (dedupe_key) do nothing`);
}

interface PushResult { status: 'ok' | 'error'; id?: string; details?: { error?: string } }
async function expoRequest(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
  const result = await response.json();
  if (!result.data || result.errors?.length) throw new Error('Expo response invalid');
  return result.data;
}

export async function deliverNotifications() {
  await db.execute(sql`update notification_jobs set status='failed', last_error='Delivery lease expired after final attempt' where status='processing' and attempts >= 5 and available_at <= now()`);
  // Lease jobs so multiple backend instances cannot send the same batch concurrently.
  const jobs = await db.execute(sql`
    update notification_jobs j set status='processing', attempts=attempts+1, available_at=now()+interval '5 minutes'
    where j.id in (
      select n.id from notification_jobs n join push_devices d on d.id=n.device_id
      where d.enabled and n.status in ('pending','processing') and n.available_at <= now() and n.attempts < 5
      order by n.created_at limit 100 for update of n skip locked
    ) returning j.*`);
  for (const job of jobs) {
    const [device] = await db.select().from(pushDevices).where(and(eq(pushDevices.id, String(job.device_id)), eq(pushDevices.enabled, true)));
    if (!device || (job.data as { customerId?: string })?.customerId !== device.customerId) {
      await db.update(notificationJobs).set({ status: 'cancelled' }).where(eq(notificationJobs.id, String(job.id))); continue;
    }
    try {
      const result: PushResult = await expoRequest('send', { to: device.token, title: job.title, body: job.body, data: job.data, sound: 'default', channelId: 'tickets', ttl: 3600 });
      if (result.status === 'ok' && result.id) {
        await db.update(notificationJobs).set({ status: 'accepted', receiptId: result.id, availableAt: new Date(Date.now() + 15 * 60000), lastError: null }).where(eq(notificationJobs.id, String(job.id)));
      } else {
        const reason = result.details?.error || 'ExpoRejected';
        if (reason === 'DeviceNotRegistered') await unregisterDevice(device.customerId, device.token);
        if (reason === 'MessageRateExceeded') throw new Error(reason);
        await db.update(notificationJobs).set({ status: 'failed', lastError: reason }).where(eq(notificationJobs.id, String(job.id)));
      }
    } catch {
      await db.update(notificationJobs).set({ status: Number(job.attempts) >= 5 ? 'failed' : 'pending', lastError: 'Delivery temporarily unavailable', availableAt: new Date(Date.now() + 60000 * 2 ** Number(job.attempts)) }).where(eq(notificationJobs.id, String(job.id)));
    }
  }
  const waiting = await db.select().from(notificationJobs).where(and(eq(notificationJobs.status, 'accepted'), sql`${notificationJobs.availableAt} <= now()`)).limit(100);
  if (!waiting.length) return;
  const receipts: Record<string, PushResult> = await expoRequest('getReceipts', { ids: waiting.map(job => job.receiptId) });
  for (const job of waiting) {
    const receipt = receipts[job.receiptId!];
    if (!receipt) {
      await db.update(notificationJobs).set({ status: Date.now() - job.createdAt.getTime() > 24 * 3600000 ? 'unknown' : 'accepted', availableAt: new Date(Date.now() + 15 * 60000) }).where(eq(notificationJobs.id, job.id)); continue;
    }
    if (receipt.details?.error === 'DeviceNotRegistered') {
      await db.update(pushDevices).set({ enabled: false }).where(eq(pushDevices.id, job.deviceId));
    }
    await db.update(notificationJobs).set({ status: receipt.status === 'ok' ? 'delivered' : 'failed', lastError: receipt.details?.error || null }).where(eq(notificationJobs.id, job.id));
  }
}
let running = false;
export async function runNotificationWorker() {
  if (running || process.env.EXPO_PUSH_ENABLED !== 'true') return;
  running = true;
  try { await enqueueNotifications(); await deliverNotifications(); }
  finally { running = false; }
}
