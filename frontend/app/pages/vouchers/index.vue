<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Voucher } from '~/components/VoucherFormModal.vue'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Voucher' })

const { request } = useApi()
const { isSuperAdmin } = useAuth()
const toast = useToast()
const confirm = useConfirm()

const status = ref<'all' | 'active' | 'inactive'>('all')
const list = usePaginatedList<Voucher>('/vouchers', {
  searchParam: 'search',
  query: () => ({ status: status.value === 'all' ? undefined : status.value })
})

const stats = ref<{ activeVouchers: number, totalDiscountDistributed: string, totalDiscountedOrders: number } | null>(null)
const statsLoading = ref(true)
async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = (await request<{ data: NonNullable<typeof stats.value> }>('/vouchers/stats')).data
  } catch {
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}
onMounted(loadStats)

/** What a customer actually experiences, not just the isActive flag. */
function effectiveStatus(v: Voucher) {
  if (!v.isActive) return 'inactive'
  if (Date.parse(v.endDate) < Date.now()) return 'expired'
  if (v.startDate && Date.parse(v.startDate) > Date.now()) return 'scheduled'
  if (v.quotaRemaining <= 0) return 'soldout'
  return 'active'
}

function discountLabel(v: Voucher) {
  if (v.discountType === 'percentage') {
    const cap = v.maxDiscountAmount && Number(v.maxDiscountAmount) > 0 ? ` (maks. ${formatIDR(v.maxDiscountAmount)})` : ''
    return `${Number(v.discountValue)}%${cap}`
  }
  return formatIDR(v.discountValue)
}

const formOpen = ref(false)
const editing = ref<Voucher | null>(null)
const usagesFor = ref<Voucher | null>(null)
const usagesOpen = ref(false)
const busy = ref<string | null>(null)

function openForm(v: Voucher | null) {
  editing.value = v
  formOpen.value = true
}

async function toggle(v: Voucher) {
  busy.value = v.id
  try {
    const res = await request<{ data: Voucher }>(`/vouchers/${v.id}/toggle`, { method: 'PATCH' })
    v.isActive = res.data.isActive
    toast.add({ title: v.isActive ? `${v.code} diaktifkan` : `${v.code} dinonaktifkan`, color: 'success' })
    loadStats()
  } catch (err) {
    toast.add({ title: 'Status voucher gagal diubah', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

async function remove(v: Voucher) {
  const ok = await confirm({
    title: `Hapus voucher ${v.code}?`,
    description: 'Voucher yang sudah pernah dipakai tidak bisa dihapus — nonaktifkan saja.',
    confirmLabel: 'Hapus voucher',
    danger: true
  })
  if (!ok) return
  busy.value = v.id
  try {
    await request(`/vouchers/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Voucher dihapus', color: 'success' })
    await Promise.all([list.refresh(), loadStats()])
  } catch (err) {
    toast.add({ title: 'Voucher tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

function openUsages(v: Voucher) {
  usagesFor.value = v
  usagesOpen.value = true
}

function rowActions(v: Voucher): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = [
    [
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openForm(v) },
      { label: 'Riwayat pemakaian', icon: 'i-lucide-history', onSelect: () => openUsages(v) },
      { label: 'Salin kode', icon: 'i-lucide-copy', onSelect: () => navigator.clipboard.writeText(v.code) }
    ],
    [{ label: v.isActive ? 'Nonaktifkan' : 'Aktifkan', icon: v.isActive ? 'i-lucide-pause' : 'i-lucide-play', onSelect: () => toggle(v) }]
  ]
  if (isSuperAdmin.value) groups.push([{ label: 'Hapus', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(v) }])
  return groups
}

const columns: TableColumn<Voucher>[] = [
  { accessorKey: 'code', header: 'Voucher' },
  { accessorKey: 'discountValue', header: 'Diskon' },
  { accessorKey: 'quotaRemaining', header: 'Pemakaian' },
  { accessorKey: 'endDate', header: 'Periode' },
  { accessorKey: 'isActive', header: 'Status' },
  { id: 'actions', header: '' }
]

const filtered = computed(() => !!list.search.value || status.value !== 'all')
function afterSave() {
  list.refresh()
  loadStats()
}
</script>

<template>
  <UDashboardPanel id="vouchers">
    <template #header>
      <UDashboardNavbar title="Voucher">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Buat voucher"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="list.search.value"
            icon="i-lucide-search"
            placeholder="Cari kode atau nama promo…"
            class="w-full sm:w-72"
            aria-label="Cari voucher"
          />
        </template>
        <template #right>
          <USelect
            v-model="status"
            :items="[{ label: 'Semua', value: 'all' }, { label: 'Aktif', value: 'active' }, { label: 'Nonaktif', value: 'inactive' }]"
            class="w-32"
            aria-label="Filter status"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Voucher aktif"
          :value="formatNumber(stats?.activeVouchers)"
          icon="i-lucide-ticket-percent"
          :loading="statsLoading"
        />
        <StatCard
          label="Pesanan memakai voucher"
          :value="formatNumber(stats?.totalDiscountedOrders)"
          icon="i-lucide-shopping-bag"
          :loading="statsLoading"
        />
        <StatCard
          label="Total potongan diberikan"
          :value="formatIDR(stats?.totalDiscountDistributed ?? 0)"
          icon="i-lucide-badge-percent"
          tone="success"
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
          <template #code-cell="{ row }">
            <p class="font-mono text-sm font-medium text-highlighted">
              {{ row.original.code }}
            </p>
            <p class="text-xs text-muted truncate max-w-56">
              {{ row.original.name }} · {{ row.original.eventTitle ?? 'Semua event' }}
            </p>
          </template>
          <template #discountValue-cell="{ row }">
            <p class="text-highlighted whitespace-nowrap">
              {{ discountLabel(row.original) }}
            </p>
            <p
              v-if="Number(row.original.minOrderAmount) > 0"
              class="text-xs text-muted"
            >
              Min. {{ formatIDR(row.original.minOrderAmount) }}
            </p>
          </template>
          <template #quotaRemaining-cell="{ row }">
            <div class="w-32">
              <p class="text-xs text-muted tabular-nums">
                {{ formatNumber(row.original.quotaTotal - row.original.quotaRemaining) }} / {{ formatNumber(row.original.quotaTotal) }}
              </p>
              <UProgress
                :model-value="row.original.quotaTotal ? ((row.original.quotaTotal - row.original.quotaRemaining) / row.original.quotaTotal) * 100 : 0"
                size="xs"
                class="mt-1"
              />
            </div>
          </template>
          <template #endDate-cell="{ row }">
            <p class="text-sm whitespace-nowrap">
              {{ formatDate(row.original.startDate) }} – {{ formatDate(row.original.endDate) }}
            </p>
          </template>
          <template #isActive-cell="{ row }">
            <UBadge
              v-if="effectiveStatus(row.original) === 'soldout'"
              label="Kuota habis"
              color="warning"
              variant="subtle"
            />
            <StatusBadge
              v-else
              :status="effectiveStatus(row.original)"
            />
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
                  :loading="busy === row.original.id"
                  :aria-label="`Aksi untuk ${row.original.code}`"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #empty>
            <UEmpty
              icon="i-lucide-ticket-percent"
              :title="filtered ? 'Tidak ada voucher yang cocok' : 'Belum ada voucher'"
              :description="filtered ? 'Ubah kata kunci atau filter.' : 'Buat kode promo untuk mendorong penjualan tiket.'"
              variant="naked"
            />
          </template>
        </UTable>
      </UCard>

      <div
        v-if="list.totalPages.value > 1"
        class="flex items-center justify-between gap-3"
      >
        <p class="text-sm text-muted tabular-nums">
          {{ formatNumber(list.totalCount.value) }} voucher
        </p>
        <UPagination
          v-model:page="list.page.value"
          :total="list.totalCount.value"
          :items-per-page="list.limit"
        />
      </div>

      <VoucherFormModal
        v-model:open="formOpen"
        :voucher="editing"
        @saved="afterSave"
      />
      <VoucherUsagesModal
        v-if="usagesFor"
        v-model:open="usagesOpen"
        :voucher-id="usagesFor.id"
        :voucher-code="usagesFor.code"
      />
    </template>
  </UDashboardPanel>
</template>
