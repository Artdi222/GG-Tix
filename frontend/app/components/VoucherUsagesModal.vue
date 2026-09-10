<script setup lang="ts">
export interface VoucherUsageItem {
  id: string
  orderId: string
  customerId: string
  customerName: string
  customerEmail: string
  discountApplied: string
  status: 'active' | 'refunded'
  createdAt: string
}

const props = defineProps<{
  open: boolean
  voucherId?: string | null
  voucherCode?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { request } = useApi()

const isLoading = ref(false)
const usages = ref<VoucherUsageItem[]>([])
const page = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)

function formatRupiah(val: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(val) || 0)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchUsages(targetPage = 1) {
  if (!props.voucherId) return
  isLoading.value = true
  try {
    const res = await request<{
      data: VoucherUsageItem[]
      pagination: { page: number; totalPages: number; totalCount: number }
    }>(`/vouchers/${props.voucherId}/usages?page=${targetPage}&limit=10`)
    if (res?.data) {
      usages.value = res.data
      page.value = res.pagination.page
      totalPages.value = res.pagination.totalPages
      totalCount.value = res.pagination.totalCount
    }
  } catch {
    usages.value = []
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.voucherId) {
      page.value = 1
      fetchUsages(1)
    } else {
      usages.value = []
    }
  }
)
</script>

<template>
  <UModal
    :open="open"
    :title="`Riwayat Pemakaian Voucher: ${voucherCode || ''}`"
    description="Daftar transaksi order yang berhasil menggunakan kupon promo ini."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Total transaksi: <strong>{{ totalCount }} kali</strong></span>
          <span v-if="totalPages > 1">Halaman {{ page }} dari {{ totalPages }}</span>
        </div>

        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
            <thead class="bg-gray-50 dark:bg-gray-800/60 font-semibold text-gray-600 dark:text-gray-300">
              <tr>
                <th class="px-3 py-2">Customer</th>
                <th class="px-3 py-2">Order ID</th>
                <th class="px-3 py-2">Potongan</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2 text-right">Waktu Transaksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-if="isLoading">
                <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-xs">
                  <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
                  Memuat riwayat pemakaian...
                </td>
              </tr>
              <tr v-else-if="usages.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                  Belum ada riwayat transaksi yang menggunakan voucher ini.
                </td>
              </tr>
              <tr v-for="item in usages" :key="item.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                <td class="px-3 py-2">
                  <div class="font-medium text-gray-900 dark:text-white">{{ item.customerName }}</div>
                  <div class="text-[11px] text-gray-400">{{ item.customerEmail }}</div>
                </td>
                <td class="px-3 py-2 font-mono text-[11px] text-gray-500">
                  {{ item.orderId.substring(0, 8) }}...
                </td>
                <td class="px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                  -{{ formatRupiah(item.discountApplied) }}
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                  <span
                    v-if="item.status === 'active'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    Diterapkan
                  </span>
                  <span
                    v-else
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  >
                    Dikembalikan
                  </span>
                </td>
                <td class="px-3 py-2 text-right text-gray-500 dark:text-gray-400 text-[11px] whitespace-nowrap">
                  {{ formatDate(item.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="totalPages > 1" class="flex justify-between items-center pt-2">
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            :disabled="page <= 1 || isLoading"
            @click="fetchUsages(page - 1)"
          >
            Sebelumnya
          </UButton>
          <span class="text-xs text-gray-500">Halaman {{ page }} dari {{ totalPages }}</span>
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            :disabled="page >= totalPages || isLoading"
            @click="fetchUsages(page + 1)"
          >
            Berikutnya
          </UButton>
        </div>

        <div class="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <UButton color="neutral" variant="outline" size="sm" @click="emit('update:open', false)">
            Tutup
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
