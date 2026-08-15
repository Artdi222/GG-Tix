<script setup lang="ts">
interface OrderItem {
  id: string
  customer: { id: string; name: string; email: string }
  event: { title: string; dateTime: string }
  category: { name: string }
  quantity: number
  totalPrice: string
  status: 'pending' | 'verified' | 'rejected'
  createdAt: string
  verifiedBy?: string | null
  verifiedAt?: string | null
}

const { request } = useApi()

const selectedStatus = ref<'ALL' | 'pending' | 'verified' | 'rejected'>('ALL')
const search = ref('')
const isLoading = ref(false)

const orders = ref<OrderItem[]>([
  {
    id: 'ord-1001',
    customer: { id: 'cust-1', name: 'Sari Dewi', email: 'sari@example.com' },
    event: { title: 'Wuthering Waves Live 2026', dateTime: '2026-10-12T19:00:00.000Z' },
    category: { name: 'VIP' },
    quantity: 2,
    totalPrice: '1500000.00',
    status: 'pending',
    createdAt: '2026-08-07T10:00:00.000Z'
  },
  {
    id: 'ord-1002',
    customer: { id: 'cust-2', name: 'Budi Santoso', email: 'budi@gmail.com' },
    event: { title: 'Coldplay Music of the Spheres', dateTime: '2026-11-15T20:00:00.000Z' },
    category: { name: 'CAT 1' },
    quantity: 1,
    totalPrice: '1250000.00',
    status: 'verified',
    createdAt: '2026-08-06T14:30:00.000Z'
  }
])

async function fetchOrders() {
  isLoading.value = true
  try {
    const res = await request<{ data: OrderItem[] }>('/orders')
    if (res?.data) {
      orders.value = res.data
    }
  } catch {
    // Keep mock
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchOrders()
})

const filteredOrders = computed(() => {
  return orders.value.filter(o => {
    const matchesSearch = !search.value || o.id.toLowerCase().includes(search.value.toLowerCase()) || o.customer.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesStatus = selectedStatus.value === 'ALL' || o.status === selectedStatus.value
    return matchesSearch && matchesStatus
  })
})

// KPI Stats Computations
const totalOrdersCount = computed(() => orders.value.length)
const pendingCount = computed(() => orders.value.filter(o => o.status === 'pending').length)
const verifiedCount = computed(() => orders.value.filter(o => o.status === 'verified').length)
const totalRevenueNumber = computed(() => {
  return orders.value
    .filter(o => o.status === 'verified')
    .reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0)
})

async function handleVerify(orderId: string, decision: 'verified' | 'rejected') {
  try {
    await request(`/orders/${orderId}/verify`, {
      method: 'PATCH',
      body: { decision }
    })
    const target = orders.value.find(o => o.id === orderId)
    if (target) target.status = decision
  } catch {
    const target = orders.value.find(o => o.id === orderId)
    if (target) target.status = decision
  }
}

function formatIDR(priceStr: string | number) {
  const num = typeof priceStr === 'number' ? priceStr : (parseFloat(priceStr) || 0)
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Verifikasi Transaksi & Order
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Daftar pemesanan tiket customer untuk disetujui / ditolak (/api/orders)
        </p>
      </div>

      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" size="sm" class="font-medium text-xs shadow-xs" :loading="isLoading" @click="fetchOrders">
        Refresh Data
      </UButton>
    </div>

    <!-- Stats KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Order</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ totalOrdersCount }}</h3>
          <p class="text-[11px] text-gray-500 mt-0.5 font-medium">Transaksi masuk</p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <UIcon name="i-lucide-receipt" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pending Verifikasi</p>
          <h3 class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 tracking-tight">{{ pendingCount }}</h3>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-clock" class="w-3 h-3" />
            Butuh konfirmasi
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-alert-circle" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Verified / Lunas</p>
          <h3 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-tight">{{ verifiedCount }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-check-circle-2" class="w-3 h-3" />
            Pembayaran sah
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-check-circle" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Pendapatan</p>
          <h3 class="text-base font-bold text-gray-900 dark:text-white mt-0.5 truncate max-w-[130px]">{{ formatIDR(totalRevenueNumber) }}</h3>
          <p class="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-trending-up" class="w-3 h-3" />
            Dari order lunas
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <UIcon name="i-lucide-wallet" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari ID Order atau nama customer..."
        size="sm"
        class="w-full sm:w-72 text-xs"
      />

      <div class="flex items-center gap-1.5">
        <UButton
          v-for="st in [
            { label: 'Semua', val: 'ALL' },
            { label: 'Pending', val: 'pending' },
            { label: 'Verified', val: 'verified' },
            { label: 'Rejected', val: 'rejected' }
          ]"
          :key="st.val"
          :color="selectedStatus === st.val ? 'primary' : 'neutral'"
          :variant="selectedStatus === st.val ? 'solid' : 'ghost'"
          size="xs"
          class="text-xs px-2.5 py-1"
          @click="selectedStatus = st.val as any"
        >
          {{ st.label }}
        </UButton>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table class="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-800">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <tr>
            <th class="px-4 py-3">ID Order</th>
            <th class="px-4 py-3">Customer</th>
            <th class="px-4 py-3">Event & Kategori</th>
            <th class="px-4 py-3">Qty</th>
            <th class="px-4 py-3">Total Harga</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 text-right">Aksi Verifikasi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
          <tr v-if="isLoading">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400 text-xs">
              <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
              Memuat data transaksi...
            </td>
          </tr>
          <tr v-else-if="filteredOrders.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              Tidak ada data transaksi yang ditemukan.
            </td>
          </tr>
          <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors">
            <td class="px-4 py-3 font-mono text-[11px] font-bold text-gray-900 dark:text-white">{{ order.id }}</td>
            <td class="px-4 py-3">
              <p class="font-semibold text-xs text-gray-900 dark:text-white leading-tight">{{ order.customer.name }}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ order.customer.email }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="font-semibold text-xs text-gray-900 dark:text-white">{{ order.event.title }}</p>
              <span class="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded">
                {{ order.category.name }}
              </span>
            </td>
            <td class="px-4 py-3 font-semibold text-xs text-gray-900 dark:text-white">{{ order.quantity }}x</td>
            <td class="px-4 py-3 font-bold text-xs text-gray-900 dark:text-white">{{ formatIDR(order.totalPrice) }}</td>
            <td class="px-4 py-3">
              <UBadge
                :color="order.status === 'verified' ? 'success' : order.status === 'pending' ? 'warning' : 'error'"
                variant="soft"
                size="sm"
                class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs uppercase"
              >
                {{ order.status }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-right">
              <div v-if="order.status === 'pending'" class="flex items-center justify-end gap-1.5">
                <UButton
                  color="success"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-check-circle"
                  @click="handleVerify(order.id, 'verified')"
                >
                  Setujui
                </UButton>
                <UButton
                  color="error"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-x-circle"
                  @click="handleVerify(order.id, 'rejected')"
                >
                  Tolak
                </UButton>
              </div>
              <span v-else class="text-[11px] text-gray-400 font-medium">Selesai</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
