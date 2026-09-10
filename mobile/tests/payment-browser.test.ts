import { expect, mock, test } from 'bun:test';

const platform = { OS: 'android' };
const auth = mock(async (_url: string, _returnUrl: string, _options: unknown) => ({type:'cancel'}));
const browser = mock(async (_url: string, _options: unknown) => ({type:'cancel'}));
const dismiss = mock(() => {});
const remove = mock(() => {});
let listener: (event: {url:string}) => void = () => {};
mock.module('react-native', () => ({Platform:platform}));
mock.module('expo-linking', () => ({createURL: () => 'exp://192.168.1.58:8081/--/payment', addEventListener: (_type:string,fn:typeof listener) => {listener=fn; return {remove};}}));
mock.module('expo-web-browser', () => ({openAuthSessionAsync:auth,openBrowserAsync:browser,dismissBrowser:dismiss}));
const {openPaymentBrowser} = await import('../src/services/payment');

test('Android uses a session that waits for return/cancel and has a matching callback', async () => {
  platform.OS='android';
  await openPaymentBrowser('https://app.sandbox.midtrans.com/snap/test','order-id');
  expect(auth).toHaveBeenCalledWith('https://app.sandbox.midtrans.com/snap/test','exp://192.168.1.58:8081/--/payment/order-id',{createTask:false,showTitle:true,enableBarCollapsing:false});
  expect(browser).not.toHaveBeenCalled();
});
test('iOS callback dismisses the payment browser and removes its listener', async () => {
  platform.OS='ios';
  browser.mockImplementation(async () => {listener({url:'exp://192.168.1.58:8081/--/payment/order-id?result=success'});return {type:'cancel'};});
  await openPaymentBrowser('https://app.sandbox.midtrans.com/snap/test','order-id');
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});
test('does not open links outside the official payment gateway', async () => {
  const calls=auth.mock.calls.length+browser.mock.calls.length;
  for(const url of ['http://app.midtrans.com/snap/test','https://attacker.example/snap/test','javascript:alert(1)']) {
    await expect(openPaymentBrowser(url,'order-id')).rejects.toThrow();
  }
  expect(auth.mock.calls.length+browser.mock.calls.length).toBe(calls);
});
