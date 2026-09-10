import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';

// Opt-in, disposable schema. No user rows are copied or modified.
const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('payment reconciliation (isolated PostgreSQL)', () => {
  const namespace = `payment_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const control = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
  const client = postgres(databaseUrl!, { connection: { search_path: namespace }, max: 4 });
  let service: typeof import('../src/services/payment.service');
  let fetchSpy: ReturnType<typeof spyOn>;
  const customerId = crypto.randomUUID();
  const categoryId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const originalKey = process.env.MIDTRANS_SERVER_KEY;
  const originalMode = process.env.MIDTRANS_IS_PRODUCTION;
  const settlement = () => ({ order_id: `GGTIX-${orderId}`, transaction_status: 'settlement', transaction_id: 'gateway-id', gross_amount: '10000.00', currency: 'IDR', status_code: '200', payment_type: 'gopay', transaction_time: '2026-09-10 12:00:00' });

  beforeAll(async () => {
    await control.unsafe(`CREATE SCHEMA ${namespace}`);
    for (const name of ['orders','payment_proofs','ticket_categories','tickets','vouchers','voucher_usages','customers','events','artists','admins','system_settings','venues','push_devices','notification_jobs']) {
      await control.unsafe(`CREATE TABLE ${namespace}.${name} (LIKE public.${name} INCLUDING ALL)`);
    }
    mock.module('../src/db', () => ({ db: drizzle(client, { schema }), client }));
    service = await import('../src/services/payment.service');
  });
  beforeEach(async () => {
    process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    await client`TRUNCATE orders, payment_proofs, ticket_categories, tickets, vouchers, voucher_usages, customers, events, artists, admins, system_settings, venues, push_devices, notification_jobs`;
    await client`INSERT INTO ticket_categories (id,event_id,name,price,quota_total,quota_remaining) VALUES (${categoryId},${crypto.randomUUID()},'VIP',5000,10,8)`;
    await client`INSERT INTO orders (id,customer_id,event_id,category_id,quantity,total_price,status,created_at) VALUES (${orderId},${customerId},${crypto.randomUUID()},${categoryId},2,10000,'pending',now() - interval '1 hour')`;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(settlement()));
  });
  afterEach(() => { fetchSpy.mockRestore(); });
  afterAll(async () => {
    await client.end();
    await control.unsafe(`DROP SCHEMA ${namespace} CASCADE`);
    await control.end();
    process.env.MIDTRANS_SERVER_KEY = originalKey;
    process.env.MIDTRANS_IS_PRODUCTION = originalMode;
  });

  test('settlement sync issues exactly N tickets even concurrently', async () => {
    await Promise.all([service.syncCustomerPayment(customerId,orderId),service.syncCustomerPayment(customerId,orderId)]);
    expect((await client`SELECT status FROM orders`)[0].status).toBe('verified');
    expect((await client`SELECT * FROM tickets`).length).toBe(2);
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(8);
  });
  test('ownership is checked before contacting Midtrans', async () => {
    await expect(service.syncCustomerPayment(crypto.randomUUID(),orderId)).rejects.toMatchObject({statusCode:403});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  test('rejects mismatched amount without issuing tickets', async () => {
    fetchSpy.mockImplementation(async () => Response.json({...settlement(),gross_amount:'1.00'}));
    await expect(service.syncCustomerPayment(customerId,orderId)).rejects.toThrow();
    expect((await client`SELECT status FROM orders`)[0].status).toBe('pending');
    expect((await client`SELECT * FROM tickets`).length).toBe(0);
  });
  test('rejects mismatched gateway order ID', async () => {
    fetchSpy.mockImplementation(async () => Response.json({...settlement(),order_id:`GGTIX-${crypto.randomUUID()}`}));
    await expect(service.syncCustomerPayment(customerId,orderId)).rejects.toThrow();
  });
  test('late settlement reacquires returned stock once', async () => {
    await client`UPDATE orders SET status='expired'`;
    await client`UPDATE ticket_categories SET quota_remaining=10`;
    await Promise.all([service.syncCustomerPayment(customerId,orderId),service.syncCustomerPayment(customerId,orderId)]);
    expect((await client`SELECT status FROM orders`)[0].status).toBe('verified');
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(8);
    expect((await client`SELECT * FROM tickets`).length).toBe(2);
  });
  test('late settlement without stock requires review, never oversells', async () => {
    await client`UPDATE orders SET status='expired'`;
    await client`UPDATE ticket_categories SET quota_remaining=1`;
    const result = await service.syncCustomerPayment(customerId,orderId);
    expect(result.requiresReview).toBe(true);
    expect((await client`SELECT status FROM orders`)[0].status).toBe('expired');
    expect((await client`SELECT * FROM tickets`).length).toBe(0);
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(1);
  });
  test('sweeper reconciles settlement instead of expiring paid orders', async () => {
    await service.expireOverduePendingOrders();
    expect((await client`SELECT status FROM orders`)[0].status).toBe('verified');
  });
  test('gateway failure never releases stock', async () => {
    fetchSpy.mockImplementation(async () => Response.json({}, {status:503}));
    await service.expireOverduePendingOrders();
    expect((await client`SELECT status FROM orders`)[0].status).toBe('pending');
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(8);
  });
  test('pending gateway status remains pending even after local deadline', async () => {
    fetchSpy.mockImplementation(async () => Response.json({...settlement(),transaction_status:'pending'}));
    await service.expireOverduePendingOrders();
    expect((await client`SELECT status FROM orders`)[0].status).toBe('pending');
  });
  test('gateway expiry restores stock exactly once', async () => {
    fetchSpy.mockImplementation(async () => Response.json({...settlement(),transaction_status:'expire'}));
    await service.syncCustomerPayment(customerId,orderId);
    await service.syncCustomerPayment(customerId,orderId);
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(10);
  });
  test('webhook requires a valid signature', async () => {
    await expect(service.handleMidtransWebhook({...settlement(),signature_key:'invalid'})).rejects.toMatchObject({statusCode:403});
  });
  test('valid duplicate webhooks and old notifications cannot regress settlement', async () => {
    const send = async (transaction_status: string) => {
      const payload = { ...settlement(), transaction_status, signature_key: new Bun.CryptoHasher('sha512').update(`GGTIX-${orderId}20010000.00test-server-key`).digest('hex') };
      return service.handleMidtransWebhook(payload);
    };
    await Promise.all([send('settlement'),send('settlement')]);
    await send('pending'); await send('expire');
    expect((await client`SELECT status FROM orders`)[0].status).toBe('verified');
    expect((await client`SELECT transaction_status FROM payment_proofs`)[0].transaction_status).toBe('settlement');
    expect((await client`SELECT * FROM tickets`).length).toBe(2);
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(8);
  });
  test('capture with fraud challenge is not confirmed', async () => {
    fetchSpy.mockImplementation(async () => Response.json({...settlement(),transaction_status:'capture',fraud_status:'challenge'}));
    await service.syncCustomerPayment(customerId,orderId);
    expect((await client`SELECT status FROM orders`)[0].status).toBe('pending');
    expect((await client`SELECT * FROM tickets`).length).toBe(0);
  });
  test('rejected paid order requires review rather than automatic revival', async () => {
    await client`UPDATE orders SET status='rejected'`;
    const result = await service.syncCustomerPayment(customerId,orderId);
    expect(result.requiresReview).toBe(true);
    expect(result.status).toBe('rejected');
    expect((await client`SELECT * FROM tickets`).length).toBe(0);
  });
  test('late voucher payment reacquires voucher and stock once', async () => {
    const voucherId = crypto.randomUUID();
    await client`INSERT INTO vouchers (id,code,name,discount_type,discount_value,quota_total,quota_remaining,end_date,created_by) VALUES (${voucherId},'TEST','Test','fixed',1000,5,5,now()+interval '1 day',${crypto.randomUUID()})`;
    await client`UPDATE orders SET status='expired',voucher_id=${voucherId}`;
    await client`INSERT INTO voucher_usages (voucher_id,customer_id,order_id,discount_applied,status) VALUES (${voucherId},${customerId},${orderId},1000,'refunded')`;
    await service.syncCustomerPayment(customerId,orderId); await service.syncCustomerPayment(customerId,orderId);
    expect((await client`SELECT quota_remaining FROM vouchers`)[0].quota_remaining).toBe(4);
    expect((await client`SELECT status FROM voucher_usages`)[0].status).toBe('active');
  });
  test('Snap creation is reusable, uses configured expiry and the net discounted total', async () => {
    const eventId = crypto.randomUUID();
    await client`INSERT INTO customers (id,name,email,password_hash) VALUES (${customerId},'Test','test@example.invalid','unused')`;
    await client`INSERT INTO events (id,title,artist_id,publisher_name,date_time,created_by) VALUES (${eventId},'Test concert',${crypto.randomUUID()},'Test',now()+interval '1 day',${crypto.randomUUID()})`;
    await client`UPDATE orders SET created_at=now(),event_id=${eventId},total_price=9000,discount_amount=1000`;
    await client`INSERT INTO system_settings (id,pending_order_expiry_minutes) VALUES ('default',20)`;
    fetchSpy.mockImplementation(async () => Response.json({token:'snap-test',redirect_url:'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-test'}));
    const [first, second] = await Promise.all([service.createSnapToken(customerId,orderId,'mobile://payment'),service.createSnapToken(customerId,orderId,'mobile://payment')]);
    expect(first.snapToken).toBe(second.snapToken);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.transaction_details.gross_amount).toBe(9000);
    expect(body.item_details.reduce((sum: number,item: {price:number;quantity:number}) => sum+item.price*item.quantity,0)).toBe(9000);
    expect(body.expiry.duration).toBe(20);
    expect(body.gopay.callback_url).toBe(`mobile://payment/${orderId}`);
    expect(body.callbacks.finish).toBe(`mobile://payment/${orderId}`);
  });
  async function orderFixture() {
    const eventId = crypto.randomUUID();
    await client`INSERT INTO customers (id,name,email,password_hash) VALUES (${customerId},'Test','test@example.invalid','unused')`;
    await client`INSERT INTO events (id,title,artist_id,publisher_name,date_time,created_by,status,max_tickets_per_order) VALUES (${eventId},'Concert',${crypto.randomUUID()},'Test',now()+interval '12 hours',${crypto.randomUUID()},'open',null)`;
    await client`UPDATE ticket_categories SET event_id=${eventId}`;
    await client`UPDATE orders SET event_id=${eventId}`;
    return { customerId, eventId, categoryId, quantity: 2 };
  }
  test('global order limit and maintenance reject without taking stock', async () => {
    const repo = await import('../src/repositories/order.repository');
    const input = await orderFixture();
    await client`INSERT INTO system_settings (id,default_max_tickets_per_order) VALUES ('default',1)`;
    expect(await repo.createOrder(input)).toMatchObject({ error: 'ORDER_LIMIT' });
    await client`UPDATE events SET max_tickets_per_order=2`;
    expect(await repo.createOrder(input)).toHaveProperty('id');
    await client`UPDATE system_settings SET maintenance_mode=true`;
    expect(await repo.createOrder(input)).toMatchObject({ error: 'MAINTENANCE' });
    expect((await client`SELECT quota_remaining FROM ticket_categories`)[0].quota_remaining).toBe(6);
  });
  test('full discount produces verified order and real tickets atomically', async () => {
    const repo = await import('../src/repositories/order.repository');
    const input = await orderFixture();
    await client`INSERT INTO vouchers (code,name,discount_type,discount_value,quota_total,quota_remaining,end_date,created_by) VALUES ('FREE','Free','fixed',10000,1,1,now()+interval '1 day',${crypto.randomUUID()})`;
    const result = await repo.createOrder({ ...input, voucherCode: 'FREE' });
    expect(result).toMatchObject({ status: 'verified', totalPrice: '0.00', discountAmount: '10000.00' });
    expect((await client`SELECT * FROM tickets`).length).toBe(2);
    expect((await client`SELECT quota_remaining FROM vouchers`)[0].quota_remaining).toBe(0);
  });
  test('pagination and status counts include orders beyond page one', async () => {
    const repo = await import('../src/repositories/order.repository');
    const input = await orderFixture();
    for (let i = 0; i < 24; i++) await client`INSERT INTO orders(customer_id,event_id,category_id,quantity,total_price,status) VALUES (${customerId},${input.eventId},${categoryId},1,5000,'expired')`;
    const first = await repo.findOrdersByCustomerId(customerId,1,20,'failed');
    const second = await repo.findOrdersByCustomerId(customerId,2,20,'failed');
    expect(first.items.length).toBe(20); expect(second.items.length).toBe(4);
    expect(new Set([...first.items,...second.items].map(o => o.id)).size).toBe(24);
    expect(await repo.customerOrderSummary(customerId)).toMatchObject({ totalOrders:25, pending:1, expired:24 });
    expect((await repo.findOrdersByCustomerId(crypto.randomUUID())).items).toEqual([]);
  });
  test('concurrent admin verification cannot issue duplicate tickets or refund twice', async () => {
    const repo = await import('../src/repositories/order.repository');
    await Promise.all([repo.verifyOrder(orderId,'verified',crypto.randomUUID()), repo.verifyOrder(orderId,'verified',crypto.randomUUID())]);
    expect((await client`SELECT * FROM tickets`).length).toBe(2);
  });
  test('notifications deduplicate payment and H-1 jobs and honor opt-out', async () => {
    const notifications = await import('../src/services/notification.service');
    await orderFixture();
    const token = 'ExpoPushToken[test_device]';
    await notifications.registerDevice(customerId,token);
    await client`UPDATE orders SET status='verified', verified_at=now()`;
    await client`INSERT INTO tickets(order_id,qr_code_value) VALUES (${orderId},'tix_test')`;
    await notifications.enqueueNotifications(); await notifications.enqueueNotifications();
    expect((await client`SELECT * FROM notification_jobs`).length).toBe(2);
    await notifications.unregisterDevice(customerId,token);
    await notifications.deliverNotifications();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await client`SELECT * FROM notification_jobs WHERE status='cancelled'`).length).toBe(2);
  });
  test('Expo accepted notification is checked via receipt and invalid device is disabled', async () => {
    const notifications = await import('../src/services/notification.service');
    await orderFixture();
    const device = await notifications.registerDevice(customerId,'ExpoPushToken[test_device]');
    await client`INSERT INTO notification_jobs(dedupe_key,device_id,title,body,data) VALUES ('test',${device.id},'Test','Test',${JSON.stringify({customerId})}::jsonb)`;
    fetchSpy.mockImplementation(async () => Response.json({ data: { status:'ok',id:'receipt-1' } }));
    await notifications.deliverNotifications();
    expect((await client`SELECT status FROM notification_jobs`)[0].status).toBe('accepted');
    await client`UPDATE notification_jobs SET available_at=now()`;
    fetchSpy.mockImplementation(async () => Response.json({ data: { 'receipt-1': { status:'error',details:{error:'DeviceNotRegistered'} } } }));
    await notifications.deliverNotifications();
    expect((await client`SELECT status FROM notification_jobs`)[0].status).toBe('failed');
    expect((await client`SELECT enabled FROM push_devices`)[0].enabled).toBe(false);
  });
  test('device reassignment deletes queued notifications from previous account', async () => {
    const notifications = await import('../src/services/notification.service');
    await orderFixture();
    const device = await notifications.registerDevice(customerId,'ExpoPushToken[test_device]');
    await client`INSERT INTO notification_jobs(dedupe_key,device_id,title,body,data) VALUES ('test',${device.id},'Test','Test',${JSON.stringify({customerId})}::jsonb)`;
    await notifications.registerDevice(crypto.randomUUID(),'ExpoPushToken[test_device]');
    expect((await client`SELECT * FROM notification_jobs`).length).toBe(0);
  });

  test('two gate scans accept exactly one check-in', async () => {
    const input = await orderFixture();
    const ticketService = await import('../src/services/ticket.service');
    await client`UPDATE orders SET status='verified',verified_at=now()`;
    await client`INSERT INTO tickets (order_id,qr_code_value) VALUES (${orderId},'tix_gate')`;
    const repo = await import('../src/repositories/order.repository');
    expect((await repo.findOrdersByCustomerId(customerId,1,20,'active')).items.length).toBe(1);
    const results = await Promise.all([ticketService.checkInTicket('tix_gate',input.eventId),ticketService.checkInTicket('tix_gate',input.eventId)]);
    expect(results.filter(r => 'status' in r && r.status === 'SUCCESS').length).toBe(1);
    expect(results.filter(r => 'error' in r && r.error === 'ALREADY_CHECKED_IN').length).toBe(1);
    expect((await repo.findOrdersByCustomerId(customerId,1,20,'active')).items.length).toBe(0);
    expect((await repo.customerOrderSummary(customerId)).activeTickets).toBe(0);
  });

});
