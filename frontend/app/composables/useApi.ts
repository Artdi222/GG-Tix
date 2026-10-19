export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  query?: Record<string, unknown>
  signal?: AbortSignal
}

// One in-flight refresh shared by every request that hits a 401 at the same time.
let refreshing: Promise<string> | null = null

export function useApi() {
  const token = useCookie<string | null>('ggtix_access_token', { default: () => null, maxAge: 3600, sameSite: 'lax' })
  const refreshToken = useCookie<string | null>('ggtix_refresh_token', { default: () => null, maxAge: 604800, sameSite: 'lax' })
  const apiBase = useRuntimeConfig().public.apiBase as string

  function clearSession() {
    token.value = null
    refreshToken.value = null
    useState('auth_user').value = null
  }

  async function refreshAccessToken() {
    refreshing ??= $fetch<{ data: { token: string } }>('/auth/refresh', {
      baseURL: apiBase,
      method: 'POST',
      body: { refreshToken: refreshToken.value }
    })
      .then((res) => {
        token.value = res.data.token
        return res.data.token
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  function send<T>(endpoint: string, options: ApiOptions, accessToken: string | null) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    return $fetch<T>(endpoint, {
      baseURL: apiBase,
      method: options.method ?? 'GET',
      body: options.body as BodyInit | Record<string, unknown> | undefined,
      query: options.query,
      signal: options.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers
      }
    })
  }

  async function request<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    try {
      return await send<T>(endpoint, options, token.value)
    } catch (err) {
      if (apiErrorStatus(err) !== 401 || !refreshToken.value) throw err
      let fresh: string
      try {
        fresh = await refreshAccessToken()
      } catch {
        clearSession()
        await navigateTo('/login')
        throw err
      }
      return await send<T>(endpoint, options, fresh)
    }
  }

  return { request, token, refreshToken, clearSession }
}
