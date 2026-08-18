export default defineNuxtRouteMiddleware(async (to) => {
  const { token } = useApi()
  const { fetchMe, user } = useAuth()

  // 1. Redirect already logged-in users away from /login
  if (to.path === '/login') {
    if (token.value) {
      return navigateTo('/')
    }
    return
  }

  // 2. Redirect unauthenticated visitors to /login
  if (!token.value) {
    return navigateTo('/login')
  }

  // 3. Fetch user profile if token exists but user state is empty
  if (token.value && !user.value) {
    await fetchMe()
    if (!user.value) {
      return navigateTo('/login')
    }
  }

  // 4. Granular RBAC Route Guards (MID-07)
  // Restrict sensitive administration routes to Super Admin
  if (to.path.startsWith('/users') && to.query.tab === 'admins') {
    const isSuperAdmin = user.value?.role === 'super_admin'
    if (!isSuperAdmin) {
      return navigateTo('/')
    }
  }
})
