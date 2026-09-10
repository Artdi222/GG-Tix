<script setup lang="ts">
import type { Voucher } from '~/components/VoucherFormModal.vue'

const { request } = useApi()
const { user } = useAuth()

const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const search = ref('')
const selectedStatus = ref<'all' | 'active' | 'inactive'>('all')
const vouchersList = ref<Voucher[]>([])
const isLoading = ref(false)

// Modals state
const isFormModalOpen = ref(false)
const editingVoucher = ref<Voucher | null>(null)

const isUsagesModalOpen = ref(false)
const selectedVoucherForUsages = ref<{ id: string; code: string } | null>(null)

// Stats KPI
const stats = reactive({
  activeVouchers: 0,
  totalDiscountDistributed: '0.00',
  totalDiscountedOrders: 0
})

function formatRupiah(val: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(val) || 0)
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function isVoucherExpired(endDateStr: string) {
  return new Date(endDateStr).getTime() < Date.now()
}

async function fetchStats() {
  try {
    const res = await request<{
      data: {
        activeVouchers: number
        totalDiscountDistributed: string
        totalDiscountedOrders: number
      }
    }>('/vouchers/stats')
    if (res?.data) {
      stats.activeVouchers = res.data.activeVouchers
      stats.totalDiscountDistributed = res.data.totalDiscountDistributed
      stats.totalDiscountedOrders = res.data.totalDiscountedOrders
    }
  } catch {
    // Ignore error
  }
}

async function fetchVouchers() {
  isLoading.value = true
  try {
    const queryParams = new URLSearchParams()
    if (search.value.trim()) queryParams.set('search', search.value.trim())
    if (selectedStatus.value !== 'all') queryParams.set('status', selectedStatus.value)

    const url = `/vouchers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const res = await request<{ data: Voucher[] }>(url)
    if (res?.data) {
      vouchersList.value = res.data
    }
  } catch {
    vouchersList.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
  fetchVouchers()
})

// Debounced search / filter trigger
watch([search, selectedStatus], () => {
  fetchVouchers()
})

function openCreateModal() {
  editingVoucher.value = null
  isFormModalOpen.value = true
}

function openEditModal(v: Voucher) {
  editingVoucher.value = v
  isFormModalOpen.value = true
}

function openUsagesModal(v: Voucher) {
  if (!v.id) return
  selectedVoucherForUsages.value = { id: v.id, code: v.code }
  isUsagesModalOpen.value = true
}

function handleSavedVoucher(saved: Voucher) {
  const idx = vouchersList.value.findIndex((v) => v.id === saved.id)
  if (idx !== -1) {
    vouchersList.value[idx] = { ...vouchersList.value[idx], ...saved }
  } else {
    vouchersList.value.unshift(saved)
  }
  fetchStats()
}

async function toggleVoucherStatus(v: Voucher) {
  if (!v.id) return
  try {
    const res = await request<{ data: Voucher }>(`/vouchers/${v.id}/toggle`, {
      method: 'PATCH'
    })
    if (res?.data) {
      v.isActive = res.data.isActive
      fetchStats()
    }
  } catch (err: any) {
    alert(err?.data?.error || err?.data?.message || err?.message || 'Gagal mengubah status voucher.')
  }
}

async function deleteVoucher(v: Voucher) {
  if (!v.id) return
  if (!confirm(`Apakah Anda yakin ingin menghapus voucher "${v.code}"? Tindakan ini tidak dapat dibatalkan.`)) return

  try {
    await request(`/vouchers/${v.id}`, { method: 'DELETE' })
    vouchersList.value = vouchersList.value.filter((item) => item.id !== v.id)
    fetchStats()
  } catch (err: any) {
    alert(err?.data?.error || err?.data?.message || err?.message || 'Gagal menghapus voucher.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-lucide-ticket-percent" class="w-6 h-6 text-primary-500" />
          Promo & Voucher Diskon
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola kode kupon promo tiket, kuota penggunaan, diskon nominal atau persentase (/api/vouchers)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="sm"
        class="font-medium text-xs shadow-xs"
        @click="openCreateModal"
      >
        Tambah Voucher
      </UButton>
    </div>

    <!-- Stats KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Voucher Aktif</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ stats.activeVouchers }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-check-circle" class="w-3 h-3" />
            Siap digunakan customer
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-tag" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Diskon Diberikan</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ formatRupiah(stats.totalDiscountDistributed) }}</h3>
          <p class="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-coins" class="w-3 h-3" />
            Akumulasi diskon order
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
          <UIcon name="i-lucide-badge-percent" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Transaksi Promo</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ stats.totalDiscountedOrders }} Transaksi</h3>
          <p class="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-shopping-bag" class="w-3 h-3" />
            Order dengan voucher aktif
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <UIcon name="i-lucide-receipt" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari kode promo atau nama..."
          size="sm"
          class="w-full sm:w-72 text-xs"
        />
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <select
          v-model="selectedStatus"
          class="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 shadow-xs focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Semua Status</option>
          <option value="active">Hanya Aktif</option>
          <option value="inactive">Hanya Nonaktif</option>
        </select>
      </div>
    </div>

    <!-- Vouchers Table -->
    <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th scope="col" class="px-4 py-3">Kode & Nama</th>
            <th scope="col" class="px-4 py-3">Tipe & Nilai Diskon</th>
            <th scope="col" class="px-4 py-3">Ketentuan Pembelian</th>
            <th scope="col" class="px-4 py-3">Kuota & Batas</th>
            <th scope="col" class="px-4 py-3">Periode Berlaku</th>
            <th scope="col" class="px-4 py-3 text-center">Status</th>
            <th scope="col" class="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
          <tr v-if="isLoading">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400 text-xs">
              <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
              Memuat data voucher promo...
            </td>
          </tr>
          <tr v-else-if="vouchersList.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              Belum ada voucher promo yang terdaftar.
            </td>
          </tr>
          <tr
            v-for="v in vouchersList"
            :key="v.id"
            class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
          >
            <!-- Kode & Nama -->
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {{ v.code }}
                </span>
                <span v-if="v.event" class="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-medium">
                  {{ v.event.title }}
                </span>
                <span v-else class="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium">
                  Global
                </span>
              </div>
              <div class="font-semibold text-xs text-gray-900 dark:text-white mt-1">{{ v.name }}</div>
              <div v-if="v.description" class="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{{ v.description }}</div>
            </td>

            <!-- Tipe & Nilai Diskon -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                <template v-if="v.discountType === 'percentage'">
                  {{ Number(v.discountValue) }}%
                  <span v-if="v.maxDiscountAmount" class="text-[11px] font-normal text-gray-400 block">
                    Maks. {{ formatRupiah(v.maxDiscountAmount) }}
                  </span>
                </template>
                <template v-else>
                  {{ formatRupiah(v.discountValue) }}
                </template>
              </div>
              <span class="text-[10px] text-gray-400 uppercase tracking-wide">
                {{ v.discountType === 'percentage' ? 'Persentase' : 'Potongan Tetap' }}
              </span>
            </td>

            <!-- Ketentuan Pembelian -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">
                Min. {{ formatRupiah(v.minOrderAmount) }}
              </div>
              <div class="text-[11px] text-gray-400">
                Maks. {{ v.maxUsagePerCustomer }}x / akun
              </div>
            </td>

            <!-- Kuota & Batas -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="text-xs font-semibold text-gray-900 dark:text-white">
                {{ v.quotaRemaining ?? v.quotaTotal }} <span class="font-normal text-gray-400">/ {{ v.quotaTotal }} sisa</span>
              </div>
              <div class="w-20 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  class="bg-primary-500 h-full rounded-full"
                  :style="{
                    width: `${Math.max(0, Math.min(100, (((v.quotaRemaining ?? v.quotaTotal) / v.quotaTotal) * 100)))}%`
                  }"
                />
              </div>
            </td>

            <!-- Periode Berlaku -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="text-[11px] text-gray-600 dark:text-gray-300">
                <span>s.d. {{ formatDate(v.endDate) }}</span>
              </div>
              <div>
                <span
                  v-if="isVoucherExpired(v.endDate)"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  Kedaluwarsa
                </span>
                <span
                  v-else
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  Aktif Berlaku
                </span>
              </div>
            </td>

            <!-- Status Toggle -->
            <td class="px-4 py-3 whitespace-nowrap text-center">
              <button
                type="button"
                :class="[
                  v.isActive ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700',
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden'
                ]"
                :title="v.isActive ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'"
                @click="toggleVoucherStatus(v)"
              >
                <span
                  :class="[
                    v.isActive ? 'translate-x-4' : 'translate-x-0',
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out'
                  ]"
                />
              </button>
            </td>

            <!-- Aksi -->
            <td class="px-4 py-3 whitespace-nowrap text-right">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-history"
                  size="xs"
                  title="Lihat Riwayat Pemakaian"
                  @click="openUsagesModal(v)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-edit-2"
                  size="xs"
                  title="Edit Voucher"
                  @click="openEditModal(v)"
                />
                <UButton
                  v-if="isSuperAdmin"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="xs"
                  title="Hapus Voucher (Super Admin)"
                  @click="deleteVoucher(v)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <VoucherFormModal
      v-model:open="isFormModalOpen"
      :voucher="editingVoucher"
      @saved="handleSavedVoucher"
    />

    <VoucherUsagesModal
      v-model:open="isUsagesModalOpen"
      :voucher-id="selectedVoucherForUsages?.id"
      :voucher-code="selectedVoucherForUsages?.code"
    />
  </div>
</template>
