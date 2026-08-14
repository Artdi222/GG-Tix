export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  params?: Record<string, any>
  query?: Record<string, any>
  _isRetry?: boolean
}

export function useApi() {
  const token = useCookie<string | null>('ggtix_access_token', { default: () => null, maxAge: 3600 })
  const refreshToken = useCookie<string | null>('ggtix_refresh_token', { default: () => null, maxAge: 604800 })
  const config = useRuntimeConfig()
  const apiBase = (config.public.apiBase as string) || 'http://localhost:3000/api'

  async function request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

    const headers: Record<string, string> = {
      ...(options.headers || {})
    }

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    try {
      const res = await $fetch<T>(endpoint, {
        baseURL: endpoint.startsWith('http') ? undefined : apiBase,
        ...(options as any),
        headers
      })
      return res as T
    } catch (err: any) {
      // Auto-refresh token on 401 Unauthorized
      if (err.response?.status === 401 && refreshToken.value && !options._isRetry) {
        try {
          const refreshRes = await $fetch<{ data: { token: string } }>('/auth/refresh', {
            baseURL: apiBase,
            method: 'POST',
            body: { refreshToken: refreshToken.value }
          })
          token.value = refreshRes.data.token
          headers['Authorization'] = `Bearer ${token.value}`

          const retryRes = await $fetch<T>(endpoint, {
            baseURL: endpoint.startsWith('http') ? undefined : apiBase,
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
