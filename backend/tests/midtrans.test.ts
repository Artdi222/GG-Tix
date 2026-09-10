import { afterEach, expect, spyOn, test } from 'bun:test';
import * as midtrans from '../src/lib/midtrans';

const originalKey = process.env.MIDTRANS_SERVER_KEY;
const originalMode = process.env.MIDTRANS_IS_PRODUCTION;
let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => {
  fetchSpy?.mockRestore();
  process.env.MIDTRANS_SERVER_KEY = originalKey;
  process.env.MIDTRANS_IS_PRODUCTION = originalMode;
});

test('status uses authenticated GET and returns the gateway response', async () => {
  process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
    order_id: 'GGTIX-example', transaction_status: 'settlement', gross_amount: '10000.00',
  }));
  const result = await midtrans.getTransactionStatus('GGTIX-example');
  expect(result?.transaction_status).toBe('settlement');
  expect(fetchSpy.mock.calls[0][0]).toBe('https://api.sandbox.midtrans.com/v2/GGTIX-example/status');
  expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from('test-server-key:').toString('base64')}` });
});

test('only transaction-not-found is treated as missing, gateway failures throw', async () => {
  process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({status_code: '404'}, {status: 404}));
  expect(await midtrans.getTransactionStatus('example')).toBeNull();
  fetchSpy.mockResolvedValue(Response.json({status_code: '503'}, {status: 503}));
  await expect(midtrans.getTransactionStatus('example')).rejects.toThrow();
  fetchSpy.mockResolvedValue(Response.json({status_code: '401'}, {status: 401}));
  await expect(midtrans.getTransactionStatus('example')).rejects.toThrow();
});
