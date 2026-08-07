export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  params?: Record<string, any>
  query?: Record<string, any>
  _isRetry?: boolean
}

export function useApi() {
  const token = useCookie<string | null>('ggtix_access_token', { default: () => null })
  const refreshToken = useCookie<string | null>('ggtix_refresh_token', { default: () => null })
  const config = useRuntimeConfig()
  const apiBase = (config.public.apiBase as string) || 'http://localhost:3000/api'

  async function request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }

    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    try {
      const res = await $fetch<T>(url, {
        ...(options as any),
        headers
      })
      return res as T
    } catch (err: any) {
      // Auto-refresh token on 401 Unauthorized
      if (err.response?.status === 401 && refreshToken.value && !options._isRetry) {
        try {
          const refreshRes = await $fetch<{ data: { token: string } }>(`${apiBase}/auth/refresh`, {
            method: 'POST',
            body: { refreshToken: refreshToken.value }
          })
          token.value = refreshRes.data.token
          headers['Authorization'] = `Bearer ${token.value}`

          const retryRes = await $fetch<T>(url, {
            ...(options as any),
            headers,
            _isRetry: true
          })
          return retryRes as T
        } catch {
          // Token refresh failed -> clear session & redirect to login
          token.value = null
          refreshToken.value = null
          navigateTo('/login')
          throw err
        }
      }
      throw err
    }
  }

  return {
    request,
    token,
    refreshToken
  }
}
