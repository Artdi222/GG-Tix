<script setup lang="ts">
const route = useRoute()
const { logout, user } = useAuth()

// Mobile sidebar drawer state
const isMobileSidebarOpen = ref(false)

// Admin navigation menu structure aligned with BE resource names
const navigationGroups = computed(() => {
  if (user.value?.role === 'gate_staff') {
    return [
      {
        title: 'Check-In',
        items: [
          { label: 'Scan QR Ticket', icon: 'i-lucide-qr-code', to: '/scanner' }
        ]
      }
    ]
  }
  return [
    {
      title: 'Utama',
      items: [
        { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
        { label: 'Event Konser', icon: 'i-lucide-calendar-range', to: '/events'},
        { label: 'Transaksi & Orders', icon: 'i-lucide-receipt', to: '/orders' },
        { label: 'Scan QR Check-In', icon: 'i-lucide-qr-code', to: '/scanner' }
      ]
    },
    {
      title: 'Manajemen Data',
      items: [
        { label: 'Master Venue', icon: 'i-lucide-map-pin', to: '/venues' },
        { label: 'Data Artis / Performer', icon: 'i-lucide-mic', to: '/artists' },
        { label: 'Data Pengguna', icon: 'i-lucide-users', to: '/users' }
      ]
    },
    {
      title: 'Sistem',
      items: [
        { label: 'Pengaturan', icon: 'i-lucide-settings', to: '/settings' }
      ]
    }
  ]
})

// Profile dropdown menu items
const profileMenuItems = computed(() => [
  [
    {
      label: user.value?.name || 'Admin GGTIX',
      slot: 'account',
      disabled: true
    }
  ],
  [
    {
      label: 'Pengaturan Akun',
      icon: 'i-lucide-user',
      to: '/settings'
    }
  ],
  [
    {
      label: 'Keluar (Logout)',
      icon: 'i-lucide-log-out',
      color: 'error' as const,
      onSelect: () => logout()
    }
  ]
])

// Notifications dropdown state
const notifications = ref<Array<{ id: number; title: string; desc: string; time: string; unread: boolean }>>([])

function isPathActive(targetPath: string) {
  if (targetPath === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(targetPath)
}

// Close mobile sidebar on route navigation
watch(() => route.path, () => {
  isMobileSidebarOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col lg:flex-row font-sans">
    <!-- Mobile Sidebar Backdrop Overlay -->
    <div
      v-if="isMobileSidebarOpen"
      class="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
      @click="isMobileSidebarOpen = false"
    />

    <!-- SIDEBAR (Desktop & Mobile Slide-over) -->
    <aside
      :class="[
        'fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-[#1B1330] text-white flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out border-r border-white/10 shadow-xl lg:shadow-none',
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <div class="relative z-10 flex flex-col h-full overflow-hidden">
        <!-- Sidebar Brand Header -->
        <div class="p-6 flex items-center justify-between border-b border-white/10">
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="w-10 h-10 rounded-xl bg-[#F2A93B] flex items-center justify-center text-[#1B1330] font-black text-xl shadow-md group-hover:scale-105 transition-transform">
              <UIcon name="i-lucide-ticket" class="w-6 h-6" />
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-extrabold tracking-[0.25em] text-lg text-white">GGTIX</span>
                <UBadge color="warning" variant="subtle" size="xs" class="px-1.5 py-0.5 text-[10px] font-bold">
                  ADMIN
                </UBadge>
              </div>
              <p class="text-[11px] text-white/50 tracking-wider uppercase font-medium">Console Panel</p>
            </div>
          </NuxtLink>

          <!-- Close button on Mobile -->
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="lg:hidden text-white/70 hover:text-white"
            aria-label="Close sidebar"
            @click="isMobileSidebarOpen = false"
          />
        </div>

        <!-- Sidebar Navigation Items -->
        <div class="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
          <div v-for="group in navigationGroups" :key="group.title" class="space-y-2">
            <h3 class="px-3 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
              {{ group.title }}
            </h3>

            <div class="space-y-1">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :class="[
                  'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                  isPathActive(item.to)
                    ? 'bg-[#F2A93B] text-[#1B1330] font-bold shadow-md shadow-[#F2A93B]/20'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                ]"
              >
                <div class="flex items-center gap-3">
                  <UIcon
                    :name="item.icon"
                    :class="[
                      'w-5 h-5 shrink-0 transition-transform group-hover:scale-110',
                      isPathActive(item.to) ? 'text-[#1B1330]' : 'text-white/60 group-hover:text-white'
                    ]"
                  />
                  <span>{{ item.label }}</span>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Admin Profile Footer Widget -->
        <div class="p-4 m-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div class="flex items-center gap-3 overflow-hidden">
            <UAvatar
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
              alt="Admin Avatar"
              size="md"
              class="ring-2 ring-[#F2A93B]"
            />
            <div class="truncate">
              <p class="text-sm font-semibold text-white truncate leading-snug">{{ user?.name || 'Admin GGTIX' }}</p>
              <p class="text-xs text-white/50 truncate">{{ user?.email || 'admin@ggtix.com' }}</p>
            </div>
          </div>

          <UTooltip text="Log Out">
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-log-out"
              size="sm"
              class="text-white/70 hover:text-red-400 hover:bg-red-500/20"
              aria-label="Logout"
              @click="logout"
            />
          </UTooltip>
        </div>
      </div>
    </aside>

    <!-- MAIN WRAPPER -->
    <div class="flex-1 flex flex-col min-w-0 min-h-screen">
      <!-- TOP NAVBAR -->
      <header class="sticky top-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-menu"
            class="lg:hidden"
            aria-label="Open sidebar"
            @click="isMobileSidebarOpen = true"
          />

          <div class="hidden sm:flex items-center w-64 md:w-80">
            <UInput
              icon="i-lucide-search"
              placeholder="Cari event, artis, order ID..."
              size="md"
              class="w-full"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">

          <UDropdownMenu :items="notifications.length ? [notifications.map(n => ({ label: n.title, description: n.desc, icon: 'i-lucide-bell' }))] : [[{ label: 'Tidak ada notifikasi baru', disabled: true }]]">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-bell"
              size="md"
              class="relative"
              aria-label="Notifications"
            >
              <span v-if="notifications.length > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
            </UButton>
          </UDropdownMenu>

          <UColorModeButton />

          <USeparator orientation="vertical" class="h-6 mx-1 hidden sm:block" />

          <UDropdownMenu :items="profileMenuItems">
            <UButton
              color="neutral"
              variant="ghost"
              class="p-1 rounded-full flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <UAvatar
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                alt="Admin"
                size="sm"
              />
              <span class="hidden md:inline-block text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ user?.name || 'Admin GGTIX' }}
              </span>
              <UIcon name="i-lucide-chevron-down" class="w-4 h-4 text-gray-500 hidden md:inline-block" />
            </UButton>
          </UDropdownMenu>
        </div>
      </header>

      <!-- PAGE CONTENT SLOT -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <slot />
      </main>

      <!-- ADMIN FOOTER -->
      <footer class="border-t border-gray-200 dark:border-gray-800 py-4 px-6 text-center sm:text-left text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          &copy; 2026 <span class="font-bold text-gray-700 dark:text-gray-300">GGTIX</span>. Admin Ticketing Console
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/events" class="hover:underline">Events</NuxtLink>
          <NuxtLink to="/artists" class="hover:underline">Artists</NuxtLink>
          <NuxtLink to="/orders" class="hover:underline">Orders</NuxtLink>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>