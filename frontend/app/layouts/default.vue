<script setup lang="ts">
const route = useRoute()
const isMobileMenuOpen = ref(false)

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Concerts', to: '/concerts', icon: 'i-lucide-calendar' },
  { label: 'Venues', to: '/venues', icon: 'i-lucide-map-pin' },
  { label: 'Artists', to: '/artists', icon: 'i-lucide-users' },
  { label: 'Orders', to: '/orders', icon: 'i-lucide-shopping-cart' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

async function onLogout() {
  // TODO: call /api/auth/logout once the backend is ready
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Mobile overlay -->
    <div
      v-if="isMobileMenuOpen"
      class="fixed inset-0 bg-black/40 z-30 lg:hidden"
      @click="isMobileMenuOpen = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 bg-[#1B1330] text-white flex flex-col shrink-0 transition-transform duration-200 lg:static lg:translate-x-0"
      :class="isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center justify-between px-6 border-b border-white/10">
        <span class="font-bold tracking-[0.3em] text-lg">GGTIX</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="lg:hidden text-white"
          aria-label="Close menu"
          @click="isMobileMenuOpen = false"
        />
      </div>

      <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.to) ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'"
          @click="isMobileMenuOpen = false"
        >
          <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
          {{ item.label }}
          <span
            v-if="isActive(item.to)"
            class="ml-auto w-1.5 h-1.5 rounded-full bg-[#F2A93B]"
            aria-hidden="true"
          />
        </NuxtLink>
      </nav>

      <div class="p-3 border-t border-white/10">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          @click="onLogout"
        >
          <UIcon name="i-lucide-log-out" class="w-5 h-5 shrink-0" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            size="sm"
            class="lg:hidden"
            aria-label="Open menu"
            @click="isMobileMenuOpen = true"
          />
          <h1 class="text-lg font-medium text-gray-900">
            {{ navItems.find((item) => isActive(item.to))?.label ?? 'Dashboard' }}
          </h1>
        </div>

        <div class="flex items-center gap-4">
          <UButton
            icon="i-lucide-bell"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Notifications"
          />
          <div class="flex items-center gap-2.5">
            <UAvatar
              src="https://i.pravatar.cc/80?u=ggtix-admin"
              alt="Admin"
              size="sm"
            />
            <span class="hidden sm:block text-sm font-medium text-gray-700">Admin</span>
          </div>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>