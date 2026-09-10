export class ApiError extends Error {
  constructor(message: string, public status = 0, public offline = false) { super(message); }
}
export interface SessionSnapshot { token: string | null; refreshToken: string | null; revision: number }
export interface SessionAdapter {
  snapshot(): SessionSnapshot;
  replaceToken(token: string, expected: number): Promise<void>;
  expire(expected: number): Promise<void>;
}

// Kept independent of React Native so concurrent refresh/logout behavior is testable.
export function createHttpClient(baseUrl: string, session: SessionAdapter, send: typeof fetch = fetch) {
  let refreshing: { revision: number; promise: Promise<void> } | undefined;
  async function request(endpoint: string, options: RequestInit = {}, envelope = false): Promise<any> {
    const initial = session.snapshot();
    const publicAuth = /^\/auth\/(customer\/(login|register)|refresh)$/.test(endpoint);
    const sendRequest = async (token: string | null) => {
      const headers = new Headers(options.headers);
      headers.set('Accept', 'application/json');
      if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
      if (token && !publicAuth) headers.set('Authorization', `Bearer ${token}`);
      try {
        return await send(`${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
          ...options, headers, signal: options.signal ?? AbortSignal.timeout(15000),
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        throw new ApiError('Gagal terhubung ke server. Periksa koneksi lalu coba lagi.', 0, true);
      }
    };
    let response = await sendRequest(initial.token);
    if (!publicAuth && initial.token && response.status === 401 && session.snapshot().revision === initial.revision && session.snapshot().token !== initial.token) {
      response = await sendRequest(session.snapshot().token);
    }
    if (!publicAuth && initial.token && response.status === 401) {
      if (session.snapshot().revision !== initial.revision) throw new ApiError('Sesi berubah. Silakan coba lagi.', 401);
      if (!initial.refreshToken) {
        await session.expire(initial.revision);
        throw new ApiError('Sesi telah berakhir. Silakan masuk kembali.', 401);
      }
      if (!refreshing || refreshing.revision !== initial.revision) {
        const promise = (async () => {
          let res: Response;
          try {
            res = await send(`${baseUrl}/auth/refresh`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: initial.refreshToken }), signal: AbortSignal.timeout(15000),
            });
          } catch { throw new ApiError('Koneksi terputus. Sesi tersimpan; coba lagi.', 0, true); }
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) await session.expire(initial.revision);
            throw new ApiError(res.status === 401 || res.status === 403 ? 'Sesi telah berakhir. Silakan masuk kembali.' : 'Sesi belum dapat diperbarui. Coba lagi.', res.status);
          }
          const json = await res.json();
          if (!json.data?.token) throw new ApiError('Respons sesi tidak valid.', 502);
          await session.replaceToken(json.data.token, initial.revision);
        })();
        refreshing = { revision: initial.revision, promise };
        void promise.finally(() => { if (refreshing?.promise === promise) refreshing = undefined; }).catch(() => {});
      }
      await refreshing.promise;
      if (session.snapshot().revision !== initial.revision) throw new ApiError('Sesi berubah. Silakan coba lagi.', 401);
      response = await sendRequest(session.snapshot().token);
      if (response.status === 401) await session.expire(initial.revision);
    }
    if (!publicAuth && initial.token && session.snapshot().revision !== initial.revision) {
      throw new ApiError('Sesi berubah. Silakan coba lagi.', 401);
    }
    const json = await response.json().catch(() => { throw new ApiError('Respons server tidak valid.', response.status || 502); });
    if (!response.ok) {
      const message = typeof json.error === 'string' ? json.error : json.message;
      throw new ApiError(message || 'Permintaan gagal. Periksa data dan coba lagi.', response.status);
    }
    return envelope || json.payment ? json : json.data !== undefined ? json.data : json;
  }
  return request;
}
