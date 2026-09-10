import { describe, expect, test } from 'bun:test';
import { createHttpClient } from '../src/services/http-client';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function harness(send: typeof fetch) {
  let state = { token: 'old', refreshToken: 'refresh', revision: 1 } as { token: string | null; refreshToken: string | null; revision: number };
  const session = { snapshot: () => state, replaceToken: async (token: string, revision: number) => { if (state.revision === revision) state.token = token; }, expire: async (revision: number) => { if (state.revision === revision) state = { token: null, refreshToken: null, revision: revision + 1 }; } };
  return { session, request: createHttpClient('https://example.test', session, send) };
}
describe('session refresh', () => {
  test('concurrent protected requests refresh once and retry with new token', async () => {
    let refreshes = 0;
    const h = harness((async (url, init) => {
      if (String(url).endsWith('/refresh')) { refreshes++; await new Promise(r => setTimeout(r, 10)); return json({ data: { token: 'new' } }); }
      return new Headers(init?.headers).get('Authorization') === 'Bearer new' ? json({ data: ['ok'] }) : json({}, 401);
    }) as typeof fetch);
    expect(await Promise.all([h.request('/orders'), h.request('/tickets')])).toEqual([['ok'], ['ok']]);
    expect(refreshes).toBe(1);
  });
  test('wrong login password does not expire an existing session', async () => {
    const h = harness((async () => json({ error: 'Invalid email or password' }, 401)) as typeof fetch);
    await expect(h.request('/auth/customer/login')).rejects.toThrow('Invalid email');
    expect(h.session.snapshot().token).toBe('old');
  });
  test('refresh transport failure preserves credentials', async () => {
    const h = harness((async url => { if (String(url).endsWith('/refresh')) throw new TypeError('network'); return json({}, 401); }) as typeof fetch);
    await expect(h.request('/tickets')).rejects.toMatchObject({ offline: true });
    expect(h.session.snapshot().refreshToken).toBe('refresh');
  });
  test('logout while refresh is in flight cannot restore a session', async () => {
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const h = harness((async url => { if (String(url).endsWith('/refresh')) { started(); await barrier; return json({ data: { token: 'new' } }); } return json({}, 401); }) as typeof fetch);
    const pending = h.request('/tickets'); await ready; await h.session.expire(1); release();
    await expect(pending).rejects.toThrow('Sesi berubah');
    expect(h.session.snapshot().token).toBeNull();
  });
  test('expired refresh token clears the session; 403 data access does not', async () => {
    const h = harness((async () => json({}, 401)) as typeof fetch);
    await expect(h.request('/tickets')).rejects.toThrow(); expect(h.session.snapshot().token).toBeNull();
    const forbidden = harness((async () => json({}, 403)) as typeof fetch);
    await expect(forbidden.request('/tickets')).rejects.toThrow(); expect(forbidden.session.snapshot().token).toBe('old');
  });
});
