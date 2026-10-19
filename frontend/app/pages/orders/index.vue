<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Pesanan' })

type OrderStatus = 'pending' | 'verified' | 'rejected' | 'expired'

interface OrderRow {
  id: string
  customer: { id: string, name: string, email: string }
  event: { title: string, dateTime: string }
  category: { name: string }
  quantity: number
  subtotalPrice: string
  discountAmount: string
  totalPrice: string
  voucherCode: string | null
  status: OrderStatus
  createdAt: string
  verifiedAt: string | null
  paymentProofs?: { paymentType?: string | null, transactionStatus?: string | null, paidAt?: string | null }[]
}

interface OrderStats { pending: number, verified: number, rejected: number, expired: number, total: number, verifiedRevenue: number }

const { request } = useApi()
const toast = useToast()
const confirm = useConfirm()
const pendingOrders = usePendingOrdersCount()

const status = ref<OrderStatus | 'all'>('all')
const eventId = ref<string>('all')

const list = usePaginatedList<OrderRow>('/orders', {
  searchParam: 'search',
  query: () => ({
    status: status.value === 'all' ? undefined : status.value,
    eventId: eventId.value === 'all' ? undefined : eventId.value
  })
})

const stats = ref<OrderStats | null>(null)
const statsLoading = ref(true)
async function loadStats() {
  statsLoading.value = true
  try {
    const res = await request<{ data: OrderStats }>('/orders/stats', {
      query: { eventId: eventId.value === 'all' ? undefined : eventId.value }
    })
    stats.value = res.data
    if (eventId.value === 'all') pendingOrders.value = res.data.pending
  } catch {
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}
watch(eventId, loadStats)
onMounted(loadStats)

const eventOptions = ref<{ label: string, value: string }[]>([{ label: 'Semua event', value: 'all' }])
onMounted(async () => {
  try {
    const res = await request<{ data: { id: string, title: string }[] }>('/events', { query: { limit: 100 } })
    eventOptions.value = [{ label: 'Semua event', value: 'all' }, ...res.data.map(e => ({ label: e.title, value: e.id }))]
  } catch {
    // Filter stays at "all events".
  }
})

const statusOptions = [
  { label: 'Semua status', value: 'all' },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Lunas', value: 'verified' },
  { label: 'Ditolak', value: 'rejected' },
  { label: 'Kedaluwarsa', value: 'expired' }
]

const columns: TableColumn<OrderRow>[] = [
  { accessorKey: 'id', header: 'Pesanan' },
  { accessorKey: 'customer', header: 'Pelanggan' },
  { accessorKey: 'event', header: 'Event' },
  { accessorKey: 'totalPrice', header: () => h('span', { class: 'block text-right' }, 'Total') },
  { accessorKey: 'paymentProofs', header: 'Pembayaran' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: '' }
]

const processing = ref<string | null>(null)
const ticketsOrderId = ref<string | null>(null)
const ticketsOpen = ref(false)

const PAYMENT_LABELS: Record<string, string> = {
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  qris: 'QRIS',
  bank_transfer: 'Transfer bank',
  bca_va: 'BCA VA',
  bni_va: 'BNI VA',
  bri_va: 'BRI VA',
  permata_va: 'Permata VA',
  echannel: 'Mandiri Bill',
  credit_card: 'Kartu kredit'
}

function paymentLabel(order: OrderRow) {
  const type = order.paymentProofs?.[0]?.paymentType
  if (!type) return order.status === 'pending' ? 'Belum dibayar' : '—'
  return PAYMENT_LABELS[type] ?? type.replaceAll('_', ' ')
}

async function decide(order: OrderRow, decision: 'verified' | 'rejected') {
  const ok = await confirm(decision === 'verified'
    ? {
        title: 'Setujui pesanan secara manual?',
        description: `Tiket untuk ${order.customer.name} akan diterbitkan meskipun pembayaran belum terkonfirmasi gateway. Lakukan hanya jika dana sudah diterima.`,
        confirmLabel: 'Setujui & terbitkan tiket'
      }
    : {
        title: 'Tolak pesanan ini?',
        description: `Kuota ${order.quantity} tiket akan dikembalikan ke kategori ${order.category.name}. Tindakan ini tidak bisa dibatalkan.`,
        confirmLabel: 'Tolak pesanan',
        danger: true
      })
  if (!ok) return

  processing.value = order.id
  try {
    await request(`/orders/${order.id}/verify`, { method: 'PATCH', body: { decision } })
    toast.add({ title: decision === 'verified' ? 'Pesanan disetujui' : 'Pesanan ditolak', color: decision === 'verified' ? 'success' : 'neutral' })
  } catch (err) {
    toast.add({ title: 'Gagal memperbarui pesanan', description: apiErrorMessage(err), color: 'error' })
  } finally {
    processing.value = null
    // Re-sync: another admin or the payment webhook may have changed it meanwhile.
    await Promise.all([list.refresh(), loadStats()])
  }
}

function rowActions(order: OrderRow): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = [[
    { label: 'Salin ID pesanan', icon: 'i-lucide-copy', onSelect: () => navigator.clipboard.writeText(order.id) }
  ]]
  if (order.status === 'verified') {
    groups[0]!.push({ label: 'Lihat e-tiket', icon: 'i-lucide-qr-code', onSelect: () => openTickets(order.id) })
  }
  if (order.status === 'pending') {
    groups.push([
      { label: 'Setujui manual', icon: 'i-lucide-check', onSelect: () => decide(order, 'verified') },
      { label: 'Tolak', icon: 'i-lucide-x', color: 'error', onSelect: () => decide(order, 'rejected') }
    ])
  }
  return groups
}

function openTickets(id: string) {
  ticketsOrderId.value = id
  ticketsOpen.value = true
}

const rangeLabel = computed(() => {
  if (!list.totalCount.value) return ''
  const start = (list.page.value - 1) * list.limit + 1
  const end = Math.min(list.page.value * list.limit, list.totalCount.value)
  return `${formatNumber(start)}–${formatNumber(end)} dari ${formatNumber(list.totalCount.value)}`
})

function refreshAll() {
  list.refresh()
  loadStats()
}
</script>

<template>
  <UDashboardPanel id="orders">
    <template #header>
      <UDashboardNavbar title="Pesanan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            label="Muat ulang"
            :loading="list.loading.value"
            @click="refreshAll"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="list.search.value"
            icon="i-lucide-search"
            placeholder="Cari ID, pelanggan, atau event…"
            class="w-full sm:w-72"
            aria-label="Cari pesanan"
          />
        </template>
        <template #right>
          <USelect
            v-model="status"
            :items="statusOptions"
            class="w-36"
            aria-label="Filter status"
          />
          <USelect
            v-model="eventId"
            :items="eventOptions"
            class="w-48"
            aria-label="Filter event"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total pesanan"
          :value="formatNumber(stats?.total)"
          icon="i-lucide-receipt-text"
          :loading="statsLoading"
        />
        <StatCard
          label="Menunggu pembayaran"
          :value="formatNumber(stats?.pending)"
          icon="i-lucide-hourglass"
          tone="warning"
          :loading="statsLoading"
        />
        <StatCard
          label="Lunas"
          :value="formatNumber(stats?.verified)"
          :hint="stats ? `${formatNumber(stats.rejected + stats.expired)} gagal/kedaluwarsa` : undefined"
          icon="i-lucide-badge-check"
          tone="success"
          :loading="statsLoading"
        />
        <StatCard
          label="Pendapatan terverifikasi"
          :value="formatIDR(stats?.verifiedRevenue ?? 0)"
          icon="i-lucide-wallet"
          :loading="statsLoading"
        />
      </div>

      <UAlert
        v-if="list.error.value"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="list.error.value"
        :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: () => list.refresh() }]"
      />

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          :data="list.items.value"
          :columns="columns"
          :loading="list.loading.value"
          class="min-h-64"
          :ui="{ th: 'text-xs font-medium text-muted', td: 'py-3' }"
        >
          <template #id-cell="{ row }">
            <p class="font-mono text-xs text-highlighted">
              #{{ row.original.id.slice(0, 8).toUpperCase() }}
            </p>
            <p class="text-xs text-muted">
              {{ formatDateTime(row.original.createdAt) }}
            </p>
          </template>
          <template #customer-cell="{ row }">
            <p class="font-medium text-highlighted truncate max-w-48">
              {{ row.original.customer.name }}
            </p>
            <p class="text-xs text-muted truncate max-w-48">
              {{ row.original.customer.email }}
            </p>
          </template>
          <template #event-cell="{ row }">
            <p class="text-highlighted truncate max-w-56">
              {{ row.original.event.title }}
            </p>
            <p class="text-xs text-muted">
              {{ row.original.category.name }} · {{ row.original.quantity }} tiket
            </p>
          </template>
          <template #totalPrice-cell="{ row }">
            <p class="text-right font-medium text-highlighted tabular-nums">
              {{ formatIDR(row.original.totalPrice) }}
            </p>
            <p
              v-if="row.original.voucherCode"
              class="text-right text-xs text-success"
            >
              {{ row.original.voucherCode }} −{{ formatIDR(row.original.discountAmount) }}
            </p>
          </template>
          <template #paymentProofs-cell="{ row }">
            <span class="text-sm text-toned">{{ paymentLabel(row.original) }}</span>
          </template>
          <template #status-cell="{ row }">
            <StatusBadge :status="row.original.status" />
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UDropdownMenu
                :items="rowActions(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-lucide-ellipsis"
                  color="neutral"
                  variant="ghost"
                  :loading="processing === row.original.id"
                  :aria-label="`Aksi untuk pesanan ${row.original.id.slice(0, 8)}`"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #empty>
            <UEmpty
              icon="i-lucide-receipt-text"
              :title="list.search.value || status !== 'all' || eventId !== 'all' ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'"
              :description="list.search.value || status !== 'all' || eventId !== 'all' ? 'Ubah kata kunci atau filter untuk melihat hasil lain.' : 'Pesanan dari aplikasi pelanggan akan muncul di sini.'"
              variant="naked"
            />
          </template>
        </UTable>
      </UCard>

      <div
        v-if="list.totalPages.value > 1 || list.totalCount.value"
        class="flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-muted tabular-nums">
          {{ rangeLabel }}
        </p>
        <UPagination
          v-model:page="list.page.value"
          :total="list.totalCount.value"
          :items-per-page="list.limit"
          :sibling-count="1"
        />
      </div>

      <OrderTicketsModal
        v-model:open="ticketsOpen"
        :order-id="ticketsOrderId ?? undefined"
      />
    </template>
  </UDashboardPanel>
</template>
