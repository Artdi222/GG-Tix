interface AdminUser {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'gate_staff' | string
}

interface LoginResponse {
  data: {
    token: string
    refreshToken: string
    user: AdminUser
  }
}

export function useAuth() {
  const { request, token, refreshToken } = useApi()
  const user = useState<AdminUser | null>('auth_user', () => null)

  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string): Promise<AdminUser> {
    const res = await request<LoginResponse>('/auth/admin/login', {
      method: 'POST',
      body: { email, password }
    })

    token.value = res.data.token
    refreshToken.value = res.data.refreshToken
    user.value = res.data.user

    return res.data.user
  }

  async function fetchMe() {
    if (!token.value) return null
    try {
      const res = await request<{ data: AdminUser }>('/auth/me')
      user.value = res.data
      return res.data
    } catch {
      logout()
      return null
    }
  }

  function logout() {
    token.value = null
    refreshToken.value = null
    user.value = null
    navigateTo('/login')
  }

  return {
    user,
    isLoggedIn,
    login,
    fetchMe,
    logout
  }
}
