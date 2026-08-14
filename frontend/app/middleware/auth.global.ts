export default defineNuxtRouteMiddleware(async (to) => {
  const { token } = useApi()
  const { fetchMe, user } = useAuth()

  if (to.path === '/login') {
    if (token.value) {
      return navigateTo('/')
    }
    return
  }

  if (!token.value) {
    return navigateTo('/login')
  }

  if (token.value && !user.value) {
    await fetchMe()
    if (!user.value) {
      return navigateTo('/login')
    }
  }
})
