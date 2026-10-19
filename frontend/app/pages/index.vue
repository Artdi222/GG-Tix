<script setup lang="ts">
definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Ringkasan' })

interface Summary {
  overview: { totalEvents: number, totalTicketsSold: number, totalRevenue: number, pendingVerifications: number, openCount: number, closedCount: number }
  overallStats: Record<'verified' | 'pending' | 'rejected', { tickets: number, revenue: number }>
  byEvent: { eventId: string, title: string, ticketsSold: number, revenue: number, capacity: number, occupancyPct: number }[]
  byCategory: { categoryId: string, name: string, ticketsSold: number, revenue: number, revenueShare: number }[]
}
interface TrendItem { date: string, tickets: number, revenue: number }
interface EventDetail {
  id: string
  title: string
  city: string | null
  venue: string | null
  dateTime: string
  status: 'open' | 'closed'
  capacity: number
  sold: number
  occupancyPct: number
  checkedIn: number
  attendancePct: number
}

const { request } = useApi()

const preset = ref<'7' | '30' | '90' | 'custom'>('30')
const presets = [
  { label: '7 hari', value: '7' },
  { label: '30 hari', value: '30' },
  { label: '90 hari', value: '90' },
  { label: 'Kustom', value: 'custom' }
]
const today = toDateInput(new Date())
const from = ref(toDateInput(new Date(Date.now() - 29 * 86400000)))
const to = ref(today)

const rangeError = computed(() => {
  if (preset.value !== 'custom') return ''
  if (!from.value || !to.value) return 'Isi tanggal awal dan akhir.'
  if (from.value > to.value) return 'Tanggal awal harus sebelum tanggal akhir.'
  if (to.value > today) return 'Tanggal akhir tidak boleh melewati hari ini.'
  if ((Date.parse(to.value) - Date.parse(from.value)) / 86400000 > 89) return 'Rentang maksimal 90 hari.'
  return ''
})

const rangeQuery = computed(() => preset.value === 'custom' ? { from: from.value, to: to.value } : { days: preset.value })
const periodLabel = computed(() => preset.value === 'custom'
  ? `${formatDate(from.value)} – ${formatDate(to.value)}`
  : `${preset.value} hari terakhir`)

const summary = ref<Summary | null>(null)
const trend = ref<TrendItem[]>([])
const events = ref<EventDetail[]>([])
const loading = ref(true)
const error = ref('')
let requestId = 0

async function load() {
  if (rangeError.value) return
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const [s, t, e] = await Promise.all([
      request<Summary>('/dashboard/summary', { query: rangeQuery.value }),
      request<TrendItem[]>('/dashboard/trend', { query: rangeQuery.value }),
      request<{ data: EventDetail[] }>('/dashboard/events')
    ])
    if (id !== requestId) return
    summary.value = s
    trend.value = t ?? []
    events.value = e.data ?? []
  } catch (err) {
    if (id === requestId) error.value = apiErrorMessage(err, 'Ringkasan gagal dimuat.')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(rangeQuery, load, { deep: true })
onMounted(load)

const metric = ref<'revenue' | 'tickets'>('revenue')
const trendPoints = computed(() => trend.value.map(t => ({ date: t.date, value: metric.value === 'revenue' ? t.revenue : t.tickets })))
const avgOrder = computed(() => {
  const v = summary.value?.overallStats.verified
  return v && v.tickets ? summary.value!.overview.totalRevenue / v.tickets : 0
})

// Category rows are per event; the same tier name (VIP, Reguler…) is merged across events.
const tiers = computed(() => {
  const total = summary.value?.overview.totalRevenue ?? 0
  const byName = new Map<string, { name: string, revenue: number, ticketsSold: number }>()
  for (const c of summary.value?.byCategory ?? []) {
    const t = byName.get(c.name) ?? { name: c.name, revenue: 0, ticketsSold: 0 }
    t.revenue += c.revenue
    t.ticketsSold += c.ticketsSold
    byName.set(c.name, t)
  }
  return [...byName.values()]
    .map(t => ({ ...t, share: total ? Math.round((t.revenue / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
})

const upcoming = computed(() => events.value
  .filter(e => e.status === 'open' && Date.parse(e.dateTime) >= Date.now())
  .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))
  .slice(0, 5))

function daysUntil(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400000)
  return days <= 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi`
}

function occupancyColor(pct: number) {
  return pct >= 90 ? 'error' : pct >= 60 ? 'warning' : 'primary'
}
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Ringkasan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading"
            aria-label="Muat ulang"
            @click="load"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-model="preset"
            :items="presets"
            :content="false"
            size="xs"
            color="neutral"
          />
          <div
            v-if="preset === 'custom'"
            class="flex items-center gap-2"
          >
            <UInput
              v-model="from"
              type="date"
              :max="to || today"
              aria-label="Tanggal awal"
              class="w-36"
            />
            <span class="text-muted text-sm">–</span>
            <UInput
              v-model="to"
              type="date"
              :min="from"
              :max="today"
              aria-label="Tanggal akhir"
              class="w-36"
            />
          </div>
        </template>
        <template #right>
          <span class="text-sm text-muted hidden md:inline">{{ periodLabel }}</span>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="rangeError"
        color="warning"
        variant="subtle"
        icon="i-lucide-calendar-x"
        :title="rangeError"
      />
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: load }]"
      />

      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Pendapatan"
          :value="formatIDR(summary?.overview.totalRevenue ?? 0)"
          :hint="`Rata-rata ${formatIDR(avgOrder)} / tiket`"
          icon="i-lucide-wallet"
          :loading="loading && !summary"
        />
        <StatCard
          label="Tiket terjual"
          :value="formatNumber(summary?.overview.totalTicketsSold)"
          :hint="periodLabel"
          icon="i-lucide-ticket"
          :loading="loading && !summary"
        />
        <StatCard
          label="Menunggu pembayaran"
          :value="formatNumber(summary?.overview.pendingVerifications)"
          hint="Semua periode"
          icon="i-lucide-hourglass"
          tone="warning"
          :loading="loading && !summary"
        />
        <StatCard
          label="Event dibuka"
          :value="formatNumber(summary?.overview.openCount)"
          :hint="summary ? `${formatNumber(summary.overview.closedCount)} sudah ditutup` : undefined"
          icon="i-lucide-calendar-check"
          tone="success"
          :loading="loading && !summary"
        />
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <UCard class="xl:col-span-2">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium text-highlighted">
                  Tren penjualan
                </p>
                <p class="text-xs text-muted">
                  Pesanan lunas per hari · {{ periodLabel }}
                </p>
              </div>
              <UTabs
                v-model="metric"
                :items="[{ label: 'Pendapatan', value: 'revenue' }, { label: 'Tiket', value: 'tickets' }]"
                :content="false"
                size="xs"
                color="neutral"
              />
            </div>
          </template>
          <USkeleton
            v-if="loading && !trend.length"
            class="h-62 w-full"
          />
          <TrendChart
            v-else
            :points="trendPoints"
            :label="metric === 'revenue' ? 'Pendapatan harian' : 'Tiket harian'"
            :format="metric === 'revenue' ? (v: number) => formatIDR(v) : (v: number) => `${formatNumber(v)} tiket`"
            :axis-format="metric === 'revenue' ? (v: number) => formatIDR(v, true) : (v: number) => formatNumber(Math.round(v))"
          />
        </UCard>

        <UCard>
          <template #header>
            <p class="font-medium text-highlighted">
              Pendapatan per tier tiket
            </p>
            <p class="text-xs text-muted">
              Gabungan semua event · {{ periodLabel }}
            </p>
          </template>
          <div
            v-if="loading && !summary"
            class="space-y-4"
          >
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-8 w-full"
            />
          </div>
          <UEmpty
            v-else-if="!tiers.length"
            icon="i-lucide-chart-bar"
            title="Belum ada data"
            description="Kategori muncul setelah ada pesanan lunas."
            variant="naked"
            size="sm"
          />
          <ul
            v-else
            class="space-y-4"
          >
            <li
              v-for="tier in tiers.slice(0, 6)"
              :key="tier.name"
            >
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="truncate text-highlighted">{{ tier.name }}</span>
                <span class="tabular-nums text-muted shrink-0">{{ tier.share }}%</span>
              </div>
              <UProgress
                :model-value="tier.share"
                size="sm"
                class="mt-1.5"
              />
              <p class="mt-1 text-xs text-dimmed tabular-nums">
                {{ formatIDR(tier.revenue) }} · {{ formatNumber(tier.ticketsSold) }} tiket
              </p>
            </li>
          </ul>
        </UCard>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <UCard
          class="xl:col-span-2"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Performa event
                </p>
                <p class="text-xs text-muted">
                  Diurutkan berdasarkan pendapatan periode ini
                </p>
              </div>
              <UButton
                to="/events"
                label="Semua event"
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-arrow-right"
              />
            </div>
          </template>
          <div
            v-if="loading && !summary"
            class="p-4 space-y-3"
          >
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-10 w-full"
            />
          </div>
          <UEmpty
            v-else-if="!summary?.byEvent.length"
            icon="i-lucide-calendar-days"
            title="Belum ada penjualan"
            description="Event dengan pesanan lunas pada periode ini akan tampil di sini."
            variant="naked"
            class="py-8"
          />
          <table
            v-else
            class="w-full text-sm"
          >
            <thead>
              <tr class="text-xs text-muted border-b border-default">
                <th class="text-left font-medium px-4 py-2.5">
                  Event
                </th>
                <th class="text-left font-medium px-4 py-2.5 w-[35%]">
                  Terjual / kapasitas
                </th>
                <th class="text-right font-medium px-4 py-2.5">
                  Pendapatan
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="ev in summary.byEvent.slice(0, 8)"
                :key="ev.eventId"
              >
                <td class="px-4 py-3 text-highlighted max-w-0 truncate">
                  {{ ev.title }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <UProgress
                      :model-value="Math.min(ev.occupancyPct, 100)"
                      :color="occupancyColor(ev.occupancyPct)"
                      size="sm"
                      class="flex-1"
                    />
                    <span class="text-xs text-muted tabular-nums whitespace-nowrap">{{ formatNumber(ev.ticketsSold) }} / {{ formatNumber(ev.capacity) }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums text-highlighted whitespace-nowrap">
                  {{ formatIDR(ev.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <p class="font-medium text-highlighted">
              Event mendatang
            </p>
            <p class="text-xs text-muted">
              Okupansi dan kehadiran
            </p>
          </template>
          <div
            v-if="loading && !events.length"
            class="p-4 space-y-3"
          >
            <USkeleton
              v-for="i in 3"
              :key="i"
              class="h-12 w-full"
            />
          </div>
          <UEmpty
            v-else-if="!upcoming.length"
            icon="i-lucide-calendar-clock"
            title="Tidak ada event mendatang"
            description="Buat event baru atau buka kembali penjualan."
            :actions="[{ label: 'Buat event', to: '/events', icon: 'i-lucide-plus' }]"
            variant="naked"
            class="py-8"
          />
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="ev in upcoming"
              :key="ev.id"
              class="px-4 py-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ ev.title }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ formatDateTime(ev.dateTime) }} · {{ ev.venue ?? 'Venue belum diatur' }}{{ ev.city ? `, ${ev.city}` : '' }}
                  </p>
                </div>
                <UBadge
                  :label="daysUntil(ev.dateTime)"
                  color="neutral"
                  variant="soft"
                  class="shrink-0"
                />
              </div>
              <div class="mt-2 flex items-center gap-3 text-xs text-muted tabular-nums">
                <UProgress
                  :model-value="Math.min(ev.occupancyPct, 100)"
                  :color="occupancyColor(ev.occupancyPct)"
                  size="xs"
                  class="flex-1"
                />
                <span>{{ ev.occupancyPct }}% terisi</span>
              </div>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
