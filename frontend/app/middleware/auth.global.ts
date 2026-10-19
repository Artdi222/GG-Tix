import type { AdminRole } from '~/composables/useAuth'

declare module '#app' {
  interface PageMeta {
    /** Roles allowed on this page. Omit to allow every signed-in admin role. */
    roles?: AdminRole[]
  }
}

function homeFor(role: AdminRole) {
  return role === 'gate_staff' ? '/scanner' : '/'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { token, refreshToken } = useApi()
  const { user, fetchMe } = useAuth()
  // The access cookie lasts 1h; a valid refresh token still means "signed in".
  const hasSession = !!(token.value || refreshToken.value)

  if (to.path === '/login') {
    if (!hasSession) return
    if (!user.value) await fetchMe()
    return user.value ? navigateTo(homeFor(user.value.role)) : undefined
  }

  if (!hasSession) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  if (!user.value) await fetchMe()
  if (!user.value) return navigateTo('/login')

  const allowed = to.meta.roles
  if (allowed && !allowed.includes(user.value.role)) {
    return navigateTo(homeFor(user.value.role))
  }
})
