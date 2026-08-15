<script setup lang="ts">
// Types aligned with PRD GGT-02 Backend Response
interface DashboardSummaryResponse {
  overview: {
    totalEvents: number
    totalTicketsSold: number
    totalRevenue: number
    pendingVerifications: number
    upcomingShows: number
    openCount: number
    closedCount: number
  }
  overallStats: {
    verified: { tickets: number; revenue: number }
    pending: { tickets: number; revenue: number }
    rejected: { tickets: number; revenue: number }
  }
  eventActivity: {
    openCount: number
    closedCount: number
    upcoming: Array<{ id: string; title: string; city: string; venue: string; dateTime: string }>
    recentClosed: Array<{ id: string; title: string; city: string; venue: string; dateTime: string }>
  }
  byEvent: Array<{
    eventId: string
    title: string
    ticketsSold: number
    revenue: number
    capacity: number
    occupancyPct: number
  }>
  byCategory: Array<{
    categoryId: string
    name: string
    ticketsSold: number
    revenue: number
    revenueShare: number
  }>
}

interface TrendItem {
  date: string
  tickets: number
  revenue: number
}

interface EventDetailItem {
  id: string
  title: string
  city: string
  venue: string
  dateTime: string
  status: 'open' | 'closed'
  capacity: number
  sold: number
  occupancyPct: number
  checkedIn: number
  attendancePct: number
}

const { request } = useApi()

// Filter State
const presetDays = ref<number | 'custom'>(30)
const fromDate = ref('')
const toDate = ref('')

const isLoading = ref(false)
const errorMessage = ref('')

// Dashboard Data
const summary = ref<DashboardSummaryResponse | null>(null)
const trendData = ref<TrendItem[]>([])
const eventDetails = ref<EventDetailItem[]>([])
const activeHoverRevenue = ref<TrendItem | null>(null)
const activeHoverTicket = ref<TrendItem | null>(null)

// Fallback Mock Data for UI demonstration if BE returns empty / offline
const mockSummary: DashboardSummaryResponse = {
  overview: {
    totalEvents: 6,
    totalTicketsSold: 3420,
    totalRevenue: 485500000,
    pendingVerifications: 14,
    upcomingShows: 4,
    openCount: 4,
    closedCount: 2
  },
  overallStats: {
    verified: { tickets: 3420, revenue: 485500000 },
    pending: { tickets: 210, revenue: 35000000 },
    rejected: { tickets: 45, revenue: 6500000 }
  },
  eventActivity: {
    openCount: 4,
    closedCount: 2,
    upcoming: [
      { id: '1', title: 'Coldplay Live in Jakarta', city: 'Jakarta', venue: 'GBK Stadium', dateTime: '2026-11-15T20:00:00Z' },
      { id: '2', title: 'Wuthering Waves Live 2026', city: 'Jakarta', venue: 'JIExpo Kemayoran', dateTime: '2026-10-12T19:00:00Z' }
    ],
    recentClosed: []
  },
  byEvent: [
    { eventId: '1', title: 'Coldplay Live in Jakarta', ticketsSold: 2800, revenue: 380000000, capacity: 3000, occupancyPct: 93 },
    { eventId: '2', title: 'Wuthering Waves Live 2026', ticketsSold: 420, revenue: 75500000, capacity: 1000, occupancyPct: 42 },
    { eventId: '3', title: 'NIKI World Tour', ticketsSold: 200, revenue: 30000000, capacity: 500, occupancyPct: 40 }
  ],
  byCategory: [
    { categoryId: 'c1', name: 'VIP Category A', ticketsSold: 450, revenue: 225000000, revenueShare: 46.3 },
    { categoryId: 'c2', name: 'CAT 1 Festival', ticketsSold: 1200, revenue: 160000000, revenueShare: 33.0 },
    { categoryId: 'c3', name: 'CAT 2 Seated', ticketsSold: 1770, revenue: 100500000, revenueShare: 20.7 }
  ]
}

const mockTrend: TrendItem[] = [
  { date: '2026-08-01', tickets: 45, revenue: 6750000 },
  { date: '2026-08-02', tickets: 80, revenue: 12000000 },
  { date: '2026-08-03', tickets: 120, revenue: 19500000 },
  { date: '2026-08-04', tickets: 210, revenue: 34000000 },
  { date: '2026-08-05', tickets: 340, revenue: 58000000 },
  { date: '2026-08-06', tickets: 290, revenue: 49000000 },
  { date: '2026-08-07', tickets: 410, revenue: 69500000 }
]

const mockEventDetails: EventDetailItem[] = [
  { id: '1', title: 'Coldplay Live in Jakarta', city: 'Jakarta', venue: 'GBK Stadium', dateTime: '2026-11-15T20:00:00Z', status: 'open', capacity: 3000, sold: 2800, occupancyPct: 93, checkedIn: 2450, attendancePct: 88 },
  { id: '2', title: 'Wuthering Waves Live 2026', city: 'Jakarta', venue: 'JIExpo Kemayoran', dateTime: '2026-10-12T19:00:00Z', status: 'open', capacity: 1000, sold: 420, occupancyPct: 42, checkedIn: 380, attendancePct: 90 }
]

const categoryColors = ['#F2A93B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

function buildQueryParams() {
  if (presetDays.value === 'custom') {
    if (!fromDate.value || !toDate.value) return null
    return `from=${fromDate.value}&to=${toDate.value}`
  }
  return `days=${presetDays.value}`
}

async function fetchDashboardData() {
  errorMessage.value = ''
  isLoading.value = true

  const query = buildQueryParams()
  if (presetDays.value === 'custom' && (!fromDate.value || !toDate.value)) {
    errorMessage.value = 'Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir.'
    isLoading.value = false
    return
  }

  try {
    const [summaryRes, trendRes, eventsRes] = await Promise.all([
      request<DashboardSummaryResponse>(`/dashboard/summary?${query}`),
      request<TrendItem[]>(`/dashboard/trend?${query}`),
      request<{ data: EventDetailItem[] }>(`/dashboard/events`)
    ])

    summary.value = summaryRes || mockSummary
    trendData.value = Array.isArray(trendRes) ? trendRes : mockTrend
    eventDetails.value = eventsRes?.data || mockEventDetails
  } catch (err: any) {
    if (err.status === 400 || err.response?.status === 400) {
      errorMessage.value = 'Rentang tanggal tidak valid. Silakan periksa tanggal awal dan akhir.'
    } else if (err.status === 401 || err.response?.status === 401) {
      errorMessage.value = 'Silakan login terlebih dahulu.'
    } else if (err.status === 403 || err.response?.status === 403) {
      errorMessage.value = 'Anda tidak memiliki akses ke dashboard ini.'
    } else {
      summary.value = mockSummary
      trendData.value = mockTrend
      eventDetails.value = mockEventDetails
    }
  } finally {
    isLoading.value = false
  }
}

watch(presetDays, (val) => {
  if (val !== 'custom') {
    fromDate.value = ''
    toDate.value = ''
    fetchDashboardData()
  }
})

onMounted(() => {
  fetchDashboardData()
})

// Formatters
function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount)
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Chart 1 (Revenue Line Chart)
const maxRevenue = computed(() => {
  if (!trendData.value.length) return 1
  return Math.max(...trendData.value.map(t => t.revenue), 1)
})

const revenuePoints = computed(() => {
  if (!trendData.value.length) return ''
  const max = maxRevenue.value
  const width = 800
  const height = 200
  const step = width / Math.max(trendData.value.length - 1, 1)

  return trendData.value
    .map((t, idx) => {
      const x = idx * step
      const y = height - (t.revenue / max) * (height - 30) - 15
      return `${x},${y}`
    })
    .join(' ')
})

// Chart 2 (Ticket Volume Bar Chart)
const maxTickets = computed(() => {
  if (!trendData.value.length) return 1
  return Math.max(...trendData.value.map(t => t.tickets), 1)
})

// Chart 3 (Donut Chart SVG Angles)
const categorySegments = computed(() => {
  const categories = summary.value?.byCategory || []
  let cumulativePercent = 0
  return categories.map((cat, idx) => {
    const startPercent = cumulativePercent
    cumulativePercent += cat.revenueShare
    const color = categoryColors[idx % categoryColors.length]
    return {
      ...cat,
      color,
      startPercent,
      endPercent: cumulativePercent,
      strokeDasharray: `${cat.revenueShare} ${100 - cat.revenueShare}`,
      strokeDashoffset: -startPercent
    }
  })
})
</script>

<template>
  <div class="space-y-6 pb-10">
    <!-- Header Title & Filter Controls -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Dashboard Analytics Penjualan Tiket
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Pantau tren revenue, kuantitas tiket, dan distribusi kategori secara terpisah (GGT-02)
        </p>
      </div>

      <!-- Filter Controls (DASH-06) -->
      <div class="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
        <div class="flex items-center gap-1">
          <UButton
            v-for="preset in [
              { label: '7 Hari', val: 7 },
              { label: '30 Hari', val: 30 },
              { label: '90 Hari', val: 90 }
            ]"
            :key="preset.val"
            :color="presetDays === preset.val ? 'primary' : 'neutral'"
            :variant="presetDays === preset.val ? 'solid' : 'ghost'"
            size="xs"
            class="font-medium text-xs px-2.5 py-1"
            @click="presetDays = preset.val"
          >
            {{ preset.label }}
          </UButton>
          <UButton
            :color="presetDays === 'custom' ? 'primary' : 'neutral'"
            :variant="presetDays === 'custom' ? 'solid' : 'ghost'"
            size="xs"
            class="font-medium text-xs px-2.5 py-1"
            @click="presetDays = 'custom'"
          >
            Custom Range
          </UButton>
        </div>

        <!-- Custom Date Range Inputs -->
        <div v-if="presetDays === 'custom'" class="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-800 sm:pl-2 w-full sm:w-auto">
          <UInput v-model="fromDate" type="date" size="xs" placeholder="Dari" class="w-28 text-xs" />
          <span class="text-xs text-gray-400">s/d</span>
          <UInput v-model="toDate" type="date" size="xs" placeholder="Sampai" class="w-28 text-xs" />
          <UButton color="primary" size="xs" icon="i-lucide-filter" @click="fetchDashboardData">
            Terapkan
          </UButton>
        </div>
      </div>
    </div>

    <!-- Error Alert Message -->
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      :title="errorMessage"
      class="rounded-xl shadow-xs text-xs"
    />

    <!-- KPI STATS CARDS GRID (DASH-02) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <!-- Total Revenue -->
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Pendapatan</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">
            {{ formatIDR(summary?.overview.totalRevenue || 0) }}
          </p>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
            <UIcon name="i-lucide-trending-up" class="w-3 h-3" />
            Status Verified
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <UIcon name="i-lucide-dollar-sign" class="w-5 h-5" />
        </div>
      </div>

      <!-- Tiket Terjual -->
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tiket Terjual</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">
            {{ (summary?.overview.totalTicketsSold || 0).toLocaleString('id-ID') }} <span class="text-xs font-normal text-gray-400">tiket</span>
          </p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Terverifikasi dari order publik
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <UIcon name="i-lucide-ticket" class="w-5 h-5" />
        </div>
      </div>

      <!-- Total Event -->
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Event Konser</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">
            {{ summary?.overview.totalEvents || 0 }} <span class="text-xs font-normal text-gray-400">event</span>
          </p>
          <p class="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
            {{ summary?.overview.upcomingShows || 0 }} event aktif mendatang
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
          <UIcon name="i-lucide-calendar" class="w-5 h-5" />
        </div>
      </div>

      <!-- Pending Verifications -->
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Antrian Verifikasi</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">
            {{ summary?.overview.pendingVerifications || 0 }} <span class="text-xs font-normal text-gray-400">order</span>
          </p>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 flex items-center gap-1">
            <UIcon name="i-lucide-alert-triangle" class="w-3 h-3" />
            Verifikasi menunggu
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <UIcon name="i-lucide-clock" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- 3 SEPARATE & DISTINCT CHARTS -->

    <!-- CHART 1: TREN PENDAPATAN HARIAN (LINE CHART) -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-line-chart" class="w-5 h-5 text-amber-500" />
            1. Tren Pendapatan Harian (Revenue IDR)
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Line chart khusus memantau nilai transaksi penjualan yang berstatus verified
          </p>
        </div>

        <div v-if="activeHoverRevenue" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium flex items-center gap-3">
          <span>Tanggal: <strong>{{ activeHoverRevenue.date }}</strong></span>
          <span class="text-amber-600 dark:text-amber-400">Revenue: <strong>{{ formatIDR(activeHoverRevenue.revenue) }}</strong></span>
        </div>
      </div>

      <div v-if="!trendData.length" class="py-14 text-center text-gray-400">
        <p class="text-sm font-medium">Tidak ada data penjualan untuk periode ini.</p>
      </div>

      <div v-else class="relative pt-4">
        <div class="h-48 w-full relative">
          <svg viewBox="0 0 800 200" class="w-full h-full overflow-visible" preserveAspectRatio="none">
            <line x1="0" y1="30" x2="800" y2="30" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-dasharray="4" />
            <line x1="0" y1="100" x2="800" y2="100" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-dasharray="4" />
            <line x1="0" y1="170" x2="800" y2="170" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-dasharray="4" />

            <polygon
              :points="`0,200 ${revenuePoints} 800,200`"
              fill="#F2A93B"
              fill-opacity="0.12"
            />
            <polyline
              fill="none"
              stroke="#F2A93B"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              :points="revenuePoints"
            />
          </svg>

          <!-- Interactive Hover Column trigger -->
          <div class="absolute inset-0 flex justify-between items-end">
            <div
              v-for="item in trendData"
              :key="item.date"
              class="flex-1 h-full cursor-pointer hover:bg-amber-500/5 transition-colors"
              @mouseenter="activeHoverRevenue = item"
            />
          </div>
        </div>

        <div class="flex justify-between text-[11px] text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span v-for="(t, idx) in trendData" :key="t.date" :class="idx % Math.ceil(trendData.length / 7) === 0 ? 'block' : 'hidden sm:block'">
            {{ t.date.slice(5) }}
          </span>
        </div>
      </div>
    </div>

    <!-- CHART 2: TREN KUANTITAS TIKET TERJUAL (BAR CHART) -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-3" class="w-5 h-5 text-emerald-500" />
            2. Tren Kuantitas Tiket Terjual Harian (Volume Tiket)
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Bar chart khusus mengukur jumlah fisik tiket terjual per hari
          </p>
        </div>

        <div v-if="activeHoverTicket" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium flex items-center gap-3">
          <span>Tanggal: <strong>{{ activeHoverTicket.date }}</strong></span>
          <span class="text-emerald-600 dark:text-emerald-400">Terjual: <strong>{{ activeHoverTicket.tickets }} tiket</strong></span>
        </div>
      </div>

      <div v-if="!trendData.length" class="py-14 text-center text-gray-400">
        <p class="text-sm font-medium">Tidak ada data penjualan untuk periode ini.</p>
      </div>

      <div v-else class="relative pt-4">
        <div class="h-48 w-full flex items-end justify-between gap-2 px-2 pb-2 border-b border-gray-100 dark:border-gray-800">
          <div
            v-for="item in trendData"
            :key="item.date"
            class="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
            @mouseenter="activeHoverTicket = item"
          >
            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
              {{ item.tickets }}
            </span>
            <div
              class="w-full max-w-[32px] bg-emerald-500 hover:bg-emerald-600 rounded-t-md transition-all duration-200"
              :style="{ height: `${Math.max((item.tickets / maxTickets) * 85, 8)}%` }"
            />
          </div>
        </div>

        <div class="flex justify-between text-[11px] text-gray-400 pt-3">
          <span v-for="(t, idx) in trendData" :key="t.date" :class="idx % Math.ceil(trendData.length / 7) === 0 ? 'block' : 'hidden sm:block'">
            {{ t.date.slice(5) }}
          </span>
        </div>
      </div>
    </div>

    <!-- CHART 3: DISTRIBUSI REVENUE PER KATEGORI TIKET (DONUT & SHARE CHART) -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-pie-chart" class="w-5 h-5 text-purple-500" />
            3. Distribusi Revenue per Kategori Tiket (Donut & Share)
          </h2>
          <p class="text-xs text-gray-500">Visual Donut Chart persentase kontribusi omset per jenis kategori tiket</p>
        </div>
      </div>

      <div v-if="!summary?.byCategory.length" class="py-12 text-center text-xs text-gray-400">
        Belum ada data kategori tiket terverifikasi.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        <!-- SVG Donut Chart -->
        <div class="flex flex-col items-center justify-center relative">
          <svg viewBox="0 0 36 36" class="w-44 h-44 transform -rotate-90">
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E5E7EB" stroke-width="3.8" class="dark:stroke-gray-800" />
            <circle
              v-for="seg in categorySegments"
              :key="seg.categoryId"
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              :stroke="seg.color"
              stroke-width="4.2"
              :stroke-dasharray="seg.strokeDasharray"
              :stroke-dashoffset="seg.strokeDashoffset"
              class="transition-all duration-500"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-xs text-gray-400 font-medium">Total Revenue</span>
            <span class="text-sm font-extrabold text-gray-900 dark:text-white">100%</span>
          </div>
        </div>

        <!-- Category Progress Breakdown List -->
        <div class="md:col-span-2 space-y-4">
          <div v-for="cat in categorySegments" :key="cat.categoryId" class="space-y-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between text-xs font-bold">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
                <span class="text-gray-900 dark:text-white">{{ cat.name }}</span>
              </div>
              <span class="font-extrabold" :style="{ color: cat.color }">{{ cat.revenueShare }}% ({{ formatIDR(cat.revenue) }})</span>
            </div>

            <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${cat.revenueShare}%`, backgroundColor: cat.color }"
              />
            </div>
            <p class="text-[11px] text-gray-400 text-right">{{ cat.ticketsSold }} tiket terjual</p>
          </div>
        </div>
      </div>
    </div>

    <!-- EVENT OCCUPANCY RATES (DASH-03) -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <UIcon name="i-lucide-ticket" class="w-5 h-5 text-emerald-500" />
            Tingkat Keterisian Konser (Event Occupancy Rate)
          </h3>
          <p class="text-xs text-gray-500">Persentase kuota terjual per event konser</p>
        </div>
      </div>

      <div v-if="!summary?.byEvent.length" class="py-8 text-center text-xs text-gray-400">
        Belum ada data event aktif.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        <div v-for="evt in summary?.byEvent" :key="evt.eventId" class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-2">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-gray-900 dark:text-white truncate max-w-[200px]">{{ evt.title }}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">{{ evt.occupancyPct }}%</span>
          </div>

          <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              class="bg-emerald-500 h-full rounded-full transition-all duration-500"
              :style="{ width: `${evt.occupancyPct}%` }"
            />
          </div>

          <div class="flex justify-between text-[11px] text-gray-500 pt-1">
            <span>{{ evt.ticketsSold }} / {{ evt.capacity }} tiket</span>
            <span class="font-semibold text-gray-700 dark:text-gray-300">{{ formatIDR(evt.revenue) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- EVENT DETAIL & CHECK-IN ATTENDANCE STATS (DASH-05 & DASH-07) -->
    <div class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <UIcon name="i-lucide-qr-code" class="w-5 h-5 text-purple-500" />
            Statistik Kehadiran (Check-In Attendance) per Event
          </h3>
          <p class="text-xs text-gray-500">Persentase tiket yang telah di-scan pada hari pelaksanaan konser (/api/dashboard/events)</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th class="p-3.5">Nama Event</th>
              <th class="p-3.5">Venue & Kota</th>
              <th class="p-3.5">Tanggal</th>
              <th class="p-3.5">Kuota Total</th>
              <th class="p-3.5">Terjual</th>
              <th class="p-3.5">Checked-In</th>
              <th class="p-3.5">Tingkat Kedatangan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="ev in eventDetails" :key="ev.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
              <td class="p-3.5 font-bold text-gray-900 dark:text-white">{{ ev.title }}</td>
              <td class="p-3.5 text-xs text-gray-600 dark:text-gray-300">{{ ev.venue }}, {{ ev.city }}</td>
              <td class="p-3.5 text-xs text-gray-600 dark:text-gray-300">{{ formatDate(ev.dateTime) }}</td>
              <td class="p-3.5 font-semibold text-gray-900 dark:text-white">{{ ev.capacity }}</td>
              <td class="p-3.5 font-semibold text-emerald-600 dark:text-emerald-400">{{ ev.sold }}</td>
              <td class="p-3.5 font-semibold text-purple-600 dark:text-purple-400">{{ ev.checkedIn }} tiket</td>
              <td class="p-3.5">
                <div class="flex items-center gap-2">
                  <div class="w-16 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div class="bg-purple-500 h-full rounded-full" :style="{ width: `${ev.attendancePct}%` }" />
                  </div>
                  <span class="text-xs font-bold text-purple-600 dark:text-purple-400">{{ ev.attendancePct }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>