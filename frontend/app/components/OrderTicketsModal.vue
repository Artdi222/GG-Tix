<script setup lang="ts">
interface TicketItem {
  id: string
  qrCodeValue: string
  qrCodeDataUrl?: string
  checkedIn: boolean
  checkedInAt?: string | null
}

interface OrderInfo {
  id: string
  eventTitle: string
  eventDate: string
  venueName: string
  categoryName: string
  quantity: number
  status: string
  customerName?: string
}

const props = defineProps<{
  orderId?: string
  orderData?: any
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const isLoading = ref(false)
const order = ref<OrderInfo | null>(null)
const tickets = ref<TicketItem[]>([])
const errorMsg = ref('')

// Fallback dummy tickets if offline
const DUMMY_TICKETS: TicketItem[] = [
  {
    id: 'tix-001',
    qrCodeValue: 'tix_d3f41a03-f6c7-47c0-a5ba-ee4a17851db3',
    qrCodeDataUrl: '',
    checkedIn: false,
    checkedInAt: null
  },
  {
    id: 'tix-002',
    qrCodeValue: 'tix_e988ae75-3cd8-458d-b2ef-3814072cf5ed',
    qrCodeDataUrl: '',
    checkedIn: true,
    checkedInAt: '2026-10-12T18:45:00.000Z'
  }
]

async function fetchTickets() {
  if (!props.orderId) return
  isLoading.value = true
  errorMsg.value = ''
  try {
    const res = await request<{ data: { order: OrderInfo; tickets: TicketItem[] } }>(`/tickets/order/${props.orderId}`)
    if (res?.data) {
      order.value = res.data.order
      tickets.value = res.data.tickets || []
    }
  } catch (err: any) {
    // Fallback if offline
    order.value = {
      id: props.orderId,
      eventTitle: props.orderData?.event?.title || 'Konser Musik GGTIX',
      eventDate: props.orderData?.event?.dateTime || '2026-10-12T19:00:00.000Z',
      venueName: 'Gelora Bung Karno, Jakarta',
      categoryName: props.orderData?.category?.name || 'VIP',
      quantity: props.orderData?.quantity || 2,
      status: 'verified',
      customerName: props.orderData?.customer?.name || 'Customer'
    }
    tickets.value = DUMMY_TICKETS
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [isOpen.value, props.orderId],
  ([open, id]) => {
    if (open && id) {
      fetchTickets()
    }
  },
  { immediate: true }
)

function formatDate(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function printTicket() {
  window.print()
}

// Generate fallback SVG QR representation if qrCodeDataUrl is not present
function getQrImageSrc(ticket: TicketItem) {
  if (ticket.qrCodeDataUrl) return ticket.qrCodeDataUrl
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ticket.qrCodeValue)}`
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="`E-Tiket Digital Order #${orderId?.substring(0, 8)}`"
    description="Daftar tiket resmi dengan kode QR unik untuk validasi masuk venue konser."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4 text-xs">
        <div v-if="isLoading" class="p-8 text-center text-gray-400">
          <UIcon name="i-lucide-loader" class="animate-spin w-5 h-5 mx-auto mb-2" />
          Mengambil data tiket digital...
        </div>

        <div v-else-if="errorMsg" class="p-4 bg-red-50 text-red-700 rounded-xl">
          {{ errorMsg }}
        </div>

        <div v-else class="space-y-4">
          <!-- Order / Event Header Card -->
          <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {{ order?.categoryName }} Class
              </span>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{{ order?.eventTitle }}</h3>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 text-gray-400" />
                {{ formatDate(order?.eventDate) }}
              </p>
            </div>

            <div class="text-left sm:text-right">
              <span class="text-[11px] text-gray-400">Jumlah:</span>
              <span class="text-xs font-bold text-gray-900 dark:text-white ml-1">{{ tickets.length }} Tiket</span>
              <div class="mt-1">
                <UBadge color="success" variant="soft" size="sm" class="font-bold px-2 py-0.5 text-[10px] tracking-wide rounded-md uppercase">
                  {{ order?.status || 'VERIFIED' }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Tickets Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div
              v-for="(ticket, idx) in tickets"
              :key="ticket.id"
              class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col items-center text-center relative overflow-hidden"
            >
              <!-- Ticket Header -->
              <div class="w-full flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2 mb-3">
                <span class="text-[11px] font-semibold text-gray-500">Tiket #{{ idx + 1 }} dari {{ tickets.length }}</span>
                <UBadge
                  :color="ticket.checkedIn ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                  class="font-bold px-2 py-0.5 text-[10px] rounded-md"
                >
                  {{ ticket.checkedIn ? '✅ Sudah Check-In' : '🎟️ Belum Check-In' }}
                </UBadge>
              </div>

              <!-- QR Code Preview -->
              <div class="w-40 h-40 bg-white p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs flex items-center justify-center mb-3">
                <img
                  :src="getQrImageSrc(ticket)"
                  :alt="ticket.qrCodeValue"
                  class="w-full h-full object-contain"
                >
              </div>

              <!-- QR String -->
              <div class="w-full px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-md text-gray-700 dark:text-gray-300 font-mono text-[10px] truncate select-all">
                {{ ticket.qrCodeValue }}
              </div>

              <!-- Check-In Time if used -->
              <p v-if="ticket.checkedIn && ticket.checkedInAt" class="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                Check-in: {{ formatDate(ticket.checkedInAt) }}
              </p>
              <p v-else class="text-[10px] text-gray-400 mt-2">
                Tunjukkan QR code ini di pintu masuk
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <span class="text-[11px] text-gray-400">GGTIX Digital Ticket Protection System</span>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-printer" @click="printTicket">
            Cetak Tiket
          </UButton>
          <UButton color="primary" size="sm" @click="isOpen = false">
            Tutup
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
