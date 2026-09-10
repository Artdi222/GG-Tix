import { beforeEach, expect, mock, test } from 'bun:test';
const values = new Map<string, string>();
const storage = {
  getItem: async (key: string) => values.get(key) ?? null,
  setItem: async (key: string, value: string) => { values.set(key,value); },
  removeItem: async (key: string) => { values.delete(key); },
  getAllKeys: async () => [...values.keys()],
  removeMany: async (keys: string[]) => { keys.forEach(key => values.delete(key)); },
};
mock.module('@react-native-async-storage/async-storage', () => ({ default: storage }));
mock.module('../src/services/storage', () => ({ storage }));
const { session } = await import('../src/services/session');
const user = (id: string) => ({ id, name: id, email:`${id}@example.invalid` });
beforeEach(async () => { await session.expire(); values.clear(); });
test('private tickets are scoped to owner and removed on logout/account switch', async () => {
  await session.login('token-a',user('a'),'refresh-a');
  const revision = session.snapshot().revision;
  await session.cacheWrite('ticket:1',{ qr:'secret-a' },revision);
  expect(await session.cacheRead('ticket:1',revision)).toEqual({qr:'secret-a'});
  await session.login('token-b',user('b'),'refresh-b');
  expect(await session.cacheRead('ticket:1',session.snapshot().revision)).toBeNull();
  expect(await session.cacheRead('ticket:1',revision)).toBeNull();
  await session.cacheWrite('ticket:1',{qr:'late-a'},revision);
  expect([...values.keys()].some(key => key.startsWith('@ggtix_private:'))).toBe(false);
});
test('legacy global ticket caches are purged during initialization', async () => {
  values.set('@ggtix_cached_orders_me','old'); values.set('@ggtix_cached_ticket_1','secret');
  values.set('unrelated-preference','keep');
  await session.initialize();
  expect(values.has('@ggtix_cached_ticket_1')).toBe(false);
  expect(values.get('unrelated-preference')).toBe('keep');
});
test('stale refresh and profile writes never restore a logged-out account', async () => {
  await session.login('token-a',user('a'),'refresh-a');const revision=session.snapshot().revision;
  await session.expire();await session.replaceToken('late-token',revision);await session.updateUser(user('a'),revision);
  expect(session.snapshot().token).toBeNull();expect(session.snapshot().user).toBeNull();
  expect(values.has('ggtix_customer_token')).toBe(false);
});
