<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, logout } = useAuth()
const { request } = useApi()

const sidebarOpen = ref(false)
const pendingOrders = usePendingOrdersCount()

const isStaff = computed(() => user.value?.role === 'gate_staff')
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const mainLinks = computed<NavigationMenuItem[]>(() => {
  if (isStaff.value) {
    return [{ label: 'Scan Check-In', icon: 'i-lucide-scan-line', to: '/scanner' }]
  }
  return [
    { label: 'Ringkasan', icon: 'i-lucide-layout-dashboard', to: '/', exact: true },
    { label: 'Event', icon: 'i-lucide-calendar-days', to: '/events' },
    {
      label: 'Pesanan',
      icon: 'i-lucide-receipt-text',
      to: '/orders',
      badge: pendingOrders.value ? { label: String(pendingOrders.value), color: 'warning' as const, variant: 'subtle' as const } : undefined
    },
    { label: 'Voucher', icon: 'i-lucide-ticket-percent', to: '/vouchers' },
    { label: 'Scan Check-In', icon: 'i-lucide-scan-line', to: '/scanner' }
  ]
})

const dataLinks = computed<NavigationMenuItem[]>(() => isStaff.value
  ? []
  : [
      { label: 'Venue', icon: 'i-lucide-map-pin', to: '/venues' },
      { label: 'Artis', icon: 'i-lucide-mic-vocal', to: '/artists' },
      { label: 'Pengguna', icon: 'i-lucide-users', to: '/users' }
    ])

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
      class="bg-elevated/40"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          :to="isStaff ? '/scanner' : '/'"
          class="flex items-center gap-2.5 min-w-0"
        >
          <span class="size-8 shrink-0 rounded-lg bg-brand-950 text-accent grid place-items-center">
            <UIcon
              name="i-lucide-ticket"
              class="size-4.5"
            />
          </span>
          <span
            v-if="!collapsed"
            class="min-w-0"
          >
            <span class="block font-semibold tracking-wide text-highlighted leading-tight">GGTIX</span>
            <span class="block text-xs text-muted leading-tight">Admin Console</span>
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainLinks"
          orientation="vertical"
          tooltip
        />
        <template v-if="dataLinks.length">
          <p
            v-if="!collapsed"
            class="px-2.5 pt-4 pb-1 text-xs font-medium text-dimmed"
          >
            Master data
          </p>
          <USeparator
            v-else
            class="my-2"
          />
          <UNavigationMenu
            :collapsed="collapsed"
            :items="dataLinks"
            orientation="vertical"
            tooltip
          />
        </template>
        <UNavigationMenu
          v-if="isSuperAdmin"
          :collapsed="collapsed"
          :items="[{ label: 'Pengaturan', icon: 'i-lucide-settings', to: '/settings' }]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenu"
          :content="{ align: 'center', collisionPadding: 12 }"
          class="w-full"
        >
          <UButton
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated"
            :ui="{ trailingIcon: 'text-dimmed' }"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
          >
            <UAvatar
              :alt="user?.name"
              size="xs"
            />
            <span
              v-if="!collapsed"
              class="min-w-0 flex-1 text-left"
            >
              <span class="block truncate text-sm font-medium text-highlighted">{{ user?.name }}</span>
              <span class="block truncate text-xs text-muted">{{ user ? ROLE_LABELS[user.role] : '' }}</span>
            </span>
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
