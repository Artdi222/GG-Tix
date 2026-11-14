<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, logout } = useAuth()
const { request } = useApi()

const sidebarOpen = ref(false)
const pendingOrders = usePendingOrdersCount()

const isStaff = computed(() => user.value?.role === 'gate_staff')
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

interface NavLink { label: string, icon: string, to: string, badge?: number }

// Grouped navigation like the ems admin shell; empty groups are hidden.
const groups = computed<{ label: string, items: NavLink[] }[]>(() => {
  if (isStaff.value) {
    return [{ label: 'Operasional', items: [{ label: 'Scan Check-In', icon: 'i-lucide-scan-line', to: '/scanner' }] }]
  }
  return [
    { label: 'Ringkasan', items: [
      { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
      { label: 'Event', icon: 'i-lucide-calendar-range', to: '/events' }
    ] },
    { label: 'Penjualan', items: [
      { label: 'Pesanan', icon: 'i-lucide-receipt-text', to: '/orders', badge: pendingOrders.value || undefined },
      { label: 'Voucher', icon: 'i-lucide-ticket-percent', to: '/vouchers' }
    ] },
    { label: 'Operasional', items: [
      { label: 'Scan Check-In', icon: 'i-lucide-scan-line', to: '/scanner' }
    ] },
    { label: 'Master Data', items: [
      { label: 'Venue', icon: 'i-lucide-map-pin', to: '/venues' },
      { label: 'Artis', icon: 'i-lucide-mic-vocal', to: '/artists' },
      { label: 'Pengguna', icon: 'i-lucide-user-cog', to: '/users' }
    ] },
    ...(isSuperAdmin.value
      ? [{ label: 'Pengaturan', items: [{ label: 'Pengaturan', icon: 'i-lucide-settings', to: '/settings' }] }]
      : [])
  ]
})

const isActive = (to: string) => to === '/' ? route.path === '/' : route.path.startsWith(to)
const initials = computed(() => (user.value?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.name ?? '', avatar: { alt: user.value?.name } }],
  [{ label: 'Profil & keamanan', icon: 'i-lucide-user-cog', to: '/settings' }],
  [{ label: 'Keluar', icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])

async function loadPendingCount() {
  if (isStaff.value || !user.value) return
  try {
    const res = await request<{ data: { pending: number } }>('/orders/stats')
    pendingOrders.value = res.data.pending
  } catch {
    // The badge is informational; ignore failures.
  }
}

onMounted(loadPendingCount)
watch(() => route.path, (path) => {
  if (path === '/' || path.startsWith('/orders')) loadPendingCount()
})
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
  >
    <UDashboardSidebar
      id="main"
      v-model:open="sidebarOpen"
      collapsible
      resizable
      :min-size="14"
      :default-size="16"
      :max-size="20"
      :collapsed-size="4.5"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          :to="isStaff ? '/scanner' : '/'"
          class="flex items-center gap-2.5 min-w-0 rounded-lg"
          :class="collapsed ? 'mx-auto' : ''"
        >
          <span class="size-9 shrink-0 rounded-xl bg-primary text-ink grid place-items-center">
            <UIcon
              name="i-lucide-ticket"
              class="size-5"
            />
          </span>
          <span
            v-if="!collapsed"
            class="min-w-0 font-display text-lg font-bold tracking-tight text-white"
          >GG<span class="text-accent">·</span>Tix</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <nav
          class="flex flex-col gap-5"
          aria-label="Navigasi admin"
        >
          <div
            v-for="g in groups"
            :key="g.label"
          >
            <p
              v-if="!collapsed"
              class="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
            >
              {{ g.label }}
            </p>
            <div
              v-else
              class="mx-3 mb-2 border-t border-white/10"
            />
            <NuxtLink
              v-for="l in g.items"
              :key="l.to"
              :to="l.to"
              :title="collapsed ? l.label : undefined"
              :aria-current="isActive(l.to) ? 'page' : undefined"
              class="relative flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition"
              :class="[
                isActive(l.to) ? 'bg-white/12 text-white font-medium' : 'text-[#C9D1E0] hover:bg-white/8 hover:text-white',
                collapsed ? 'justify-center' : ''
              ]"
            >
              <span
                v-if="isActive(l.to)"
                class="absolute inset-y-1.5 left-0 w-1 rounded-full bg-accent"
                aria-hidden="true"
              />
              <UIcon
                :name="l.icon"
                class="size-5 shrink-0"
              />
              <span
                v-if="!collapsed"
                class="truncate"
              >{{ l.label }}</span>
              <span
                v-if="l.badge"
                class="grid min-w-5 h-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-ink tabular-nums"
                :class="collapsed ? 'absolute right-1 top-0.5' : 'ms-auto'"
              >{{ l.badge }}</span>
            </NuxtLink>
          </div>
        </nav>
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenu"
          :content="{ side: 'top', align: 'start', collisionPadding: 12 }"
          class="w-full"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/8"
            :class="collapsed ? 'justify-center' : ''"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-ink">{{ initials }}</span>
            <span
              v-if="!collapsed"
              class="min-w-0 flex-1"
            >
              <span class="block truncate text-sm font-medium text-white">{{ user?.name }}</span>
              <span class="block truncate text-xs text-white/50">{{ user ? ROLE_LABELS[user.role] : '' }}</span>
            </span>
            <UIcon
              v-if="!collapsed"
              name="i-lucide-chevrons-up-down"
              class="size-4 text-white/40"
            />
          </button>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
