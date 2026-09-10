import { expect, test } from 'bun:test';
import { createPaymentPoller } from '../src/services/payment-poller';
import type { PaymentStatus } from '../src/services/payment';

const status = (value: PaymentStatus['status']): PaymentStatus => ({orderId:'test',status:value,totalPrice:'10000',quantity:1,paymentStatus:null,requiresReview:false,payment:null});
const wait = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

test('polls pending until verified and stops', async () => {
  let calls = 0;
  const received: string[] = [];
  const poller = createPaymentPoller({ request: async () => status(++calls === 1 ? 'pending' : 'verified'), onStatus: value => received.push(value.status), onError: () => {}, onChecking: () => {}, onEnded: () => {}, intervalMs: 1 });
  poller.restart();
  await wait(30);
  expect(received).toEqual(['pending','verified']);
  expect(calls).toBe(2);
  poller.pause();
});
test('caps pending polling and allows an explicit retry', async () => {
  let calls = 0;
  let ended = 0;
  const poller = createPaymentPoller({ request: async () => { calls++; return status('pending'); }, onStatus: () => {}, onError: () => {}, onChecking: () => {}, onEnded: () => ended++, intervalMs: 1, maxAttempts: 2 });
  poller.restart(); await wait(30);
  expect(calls).toBe(2); expect(ended).toBe(1);
  poller.restart(); await wait(30);
  expect(calls).toBe(4); expect(ended).toBe(2);
  poller.pause();
});
test('leaving cancels the request and ignores a late response', async () => {
  let resolve: (value: PaymentStatus) => void = () => {};
  let signal: AbortSignal | undefined;
  let updates = 0;
  const poller = createPaymentPoller({ request: current => { signal = current; return new Promise(done => { resolve = done; }); }, onStatus: () => updates++, onError: () => updates++, onChecking: () => {}, onEnded: () => {} });
  poller.restart(); poller.pause(); resolve(status('verified')); await wait();
  expect(signal?.aborted).toBe(true); expect(updates).toBe(0);
});
test('connection failure stops polling with a retryable error', async () => {
  const errors: string[] = [];
  let calls = 0;
  const poller = createPaymentPoller({ request: async () => { calls++; throw new Error('Offline'); }, onStatus: () => {}, onError: message => errors.push(message), onChecking: () => {}, onEnded: () => {}, intervalMs: 1 });
  poller.restart(); await wait();
  expect(errors).toEqual(['Offline']); expect(calls).toBe(1); poller.pause();
});
