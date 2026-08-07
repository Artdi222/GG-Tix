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
    // Keep mock if BE offline
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

function formatIDR(priceStr: string) {
  const num = parseFloat(priceStr) || 0
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Verifikasi Transaksi & Order
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Daftar pemesanan tiket customer untuk disetujui / ditolak (/api/orders)
        </p>
      </div>

      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="fetchOrders">
        Refresh Data
      </UButton>
    </div>

    <!-- Filter Bar -->
    <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari ID Order atau nama customer..."
        size="md"
        class="w-full sm:w-80"
      />

      <div class="flex items-center gap-2">
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
          @click="selectedStatus = st.val as any"
        >
          {{ st.label }}
        </UButton>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th class="p-3.5">ID Order</th>
              <th class="p-3.5">Customer</th>
              <th class="p-3.5">Event & Kategori</th>
              <th class="p-3.5">Qty</th>
              <th class="p-3.5">Total Harga</th>
              <th class="p-3.5">Status</th>
              <th class="p-3.5 text-right">Aksi Verifikasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
              <td class="p-3.5 font-mono text-xs font-bold text-gray-900 dark:text-white">{{ order.id }}</td>
              <td class="p-3.5">
                <p class="font-medium text-gray-900 dark:text-white leading-tight">{{ order.customer.name }}</p>
                <p class="text-xs text-gray-500">{{ order.customer.email }}</p>
              </td>
              <td class="p-3.5">
                <p class="font-semibold text-gray-900 dark:text-white">{{ order.event.title }}</p>
                <UBadge color="neutral" variant="subtle" size="xs" class="mt-0.5">{{ order.category.name }}</UBadge>
              </td>
              <td class="p-3.5 font-semibold text-gray-900 dark:text-white">{{ order.quantity }}x</td>
              <td class="p-3.5 font-bold text-gray-900 dark:text-white">{{ formatIDR(order.totalPrice) }}</td>
              <td class="p-3.5">
                <UBadge
                  :color="order.status === 'verified' ? 'success' : order.status === 'pending' ? 'warning' : 'error'"
                  variant="soft"
                  size="xs"
                  class="font-bold px-2 py-0.5 uppercase"
                >
                  {{ order.status }}
                </UBadge>
              </td>
              <td class="p-3.5 text-right">
                <div v-if="order.status === 'pending'" class="flex items-center justify-end gap-2">
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
                <span v-else class="text-xs text-gray-400 font-medium">Selesai</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
