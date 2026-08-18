export default defineNuxtRouteMiddleware(async (to) => {
  const { token } = useApi()
  const { fetchMe, user } = useAuth()

  // 1. Redirect already logged-in users away from /login
  if (to.path === '/login') {
    if (token.value) {
      if (user.value?.role === 'gate_staff') {
        return navigateTo('/scanner')
      }
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

  // 4. Gate Staff RBAC: Force redirect to /scanner & block all other routes
  if (user.value?.role === 'gate_staff') {
    if (to.path !== '/scanner') {
      return navigateTo('/scanner')
    }
    return
  }

  // 5. Super Admin RBAC Route Guards
  if (to.path.startsWith('/users') && to.query.tab === 'admins') {
    const isSuperAdmin = user.value?.role === 'super_admin'
    if (!isSuperAdmin) {
      return navigateTo('/')
    }
  }
})
