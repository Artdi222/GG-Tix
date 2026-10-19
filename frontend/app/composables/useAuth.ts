export type AdminRole = 'super_admin' | 'admin' | 'gate_staff'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  gate_staff: 'Gate Staff'
}

export function useAuth() {
  const { request, token, refreshToken, clearSession } = useApi()
  const user = useState<AdminUser | null>('auth_user', () => null)

  const isLoggedIn = computed(() => !!token.value)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

  async function login(email: string, password: string): Promise<AdminUser> {
    const res = await request<{ data: { token: string, refreshToken: string, user: AdminUser } }>('/auth/admin/login', {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.data.token
    refreshToken.value = res.data.refreshToken
    user.value = res.data.user
    return res.data.user
  }

  /** Loads the profile. Only an auth failure ends the session; a network blip does not. */
  async function fetchMe() {
    if (!token.value && !refreshToken.value) return null
    try {
      const res = await request<{ data: AdminUser }>('/auth/me')
      user.value = res.data
      return res.data
    } catch (err) {
      if (apiErrorStatus(err) === 401) clearSession()
      return null
    }
  }

  function logout() {
    clearSession()
    return navigateTo('/login')
  }

  return { user, isLoggedIn, isSuperAdmin, login, fetchMe, logout }
}
