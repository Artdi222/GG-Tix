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

/** The equally long window right before the selected one, for period-over-period deltas. */
const previousQuery = computed(() => {
  const DAY = 86400000
  if (preset.value === 'custom') {
    const start = Date.parse(`${from.value}T00:00:00`)
    const length = Math.round((Date.parse(`${to.value}T00:00:00`) - start) / DAY) + 1
    return { from: toDateInput(new Date(start - length * DAY)), to: toDateInput(new Date(start - DAY)) }
  }
  const n = Number(preset.value)
  return { from: toDateInput(new Date(Date.now() - (2 * n - 1) * DAY)), to: toDateInput(new Date(Date.now() - n * DAY)) }
})

const summary = ref<Summary | null>(null)
const previous = ref<Summary | null>(null)
const trend = ref<TrendItem[]>([])
const previousTrend = ref<TrendItem[]>([])
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
    const [s, t, e, ps, pt] = await Promise.all([
      request<Summary>('/dashboard/summary', { query: rangeQuery.value }),
      request<TrendItem[]>('/dashboard/trend', { query: rangeQuery.value }),
      request<{ data: EventDetail[] }>('/dashboard/events'),
      // Comparison data is a nice-to-have; never fail the page over it.
      request<Summary>('/dashboard/summary', { query: previousQuery.value }).catch(() => null),
      request<TrendItem[]>('/dashboard/trend', { query: previousQuery.value }).catch(() => [])
    ])
    if (id !== requestId) return
    summary.value = s
    trend.value = t ?? []
    events.value = e.data ?? []
    previous.value = ps
    previousTrend.value = pt ?? []
  } catch (err) {
    if (id === requestId) error.value = apiErrorMessage(err, 'Ringkasan gagal dimuat.')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(rangeQuery, load, { deep: true })
onMounted(load)

const metric = ref<'revenue' | 'tickets'>('revenue')
const pick = (t: TrendItem) => metric.value === 'revenue' ? t.revenue : t.tickets
const trendPoints = computed(() => trend.value.map(t => ({ date: t.date, value: pick(t) })))
const comparePoints = computed(() => previousTrend.value.map(t => ({ date: t.date, value: pick(t) })))
const trendTotal = computed(() => trend.value.reduce((s, t) => s + pick(t), 0))
const previousTrendTotal = computed(() => previousTrend.value.reduce((s, t) => s + pick(t), 0))

function avgPerTicket(s: Summary | null) {
  const v = s?.overallStats.verified
  return v && v.tickets ? s!.overview.totalRevenue / v.tickets : 0
}
const avgOrder = computed(() => avgPerTicket(summary.value))

/** Percent change, or null when there is no baseline to compare against. */
function change(current: number, before: number | undefined) {
  if (!previous.value || before === undefined || before === 0) return null
  return ((current - before) / before) * 100
}
const deltas = computed(() => ({
  revenue: change(summary.value?.overview.totalRevenue ?? 0, previous.value?.overview.totalRevenue),
  tickets: change(summary.value?.overview.totalTicketsSold ?? 0, previous.value?.overview.totalTicketsSold),
  avg: change(avgOrder.value, avgPerTicket(previous.value) || undefined),
  trend: change(trendTotal.value, previousTrendTotal.value)
}))

const { user } = useAuth()
const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 19 ? 'sore' : 'malam'
  return `Selamat ${part}, ${user.value?.name.split(' ')[0] ?? ''}`
})
const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Categorical tier colors: brand first, then distinct hues that stay legible together.
const TIER_COLORS = ['#f5a524', '#b4630a', '#0e7490', '#15803d', '#475569', '#94a3b8']

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
    .map((t, i) => ({ ...t, color: TIER_COLORS[Math.min(i, TIER_COLORS.length - 1)]! }))
})

function dateTile(iso: string) {
  const d = new Date(iso)
  return { day: d.getDate(), month: d.toLocaleDateString('id-ID', { month: 'short' }) }
}

const upcoming = computed(() => events.value
  .filter(e => e.status === 'open' && Date.parse(e.dateTime) >= Date.now())
  .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))
  .slice(0, 5))

function daysUntil(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86400000)
  return days <= 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi`
}

// ---- kehadiran (donut) & okupansi (gauge), gabungan event yang dibuka ----
const live = computed(() => events.value.filter(e => e.status === 'open'))
const totals = computed(() => live.value.reduce(
  (a, e) => ({ sold: a.sold + e.sold, capacity: a.capacity + e.capacity, checkedIn: a.checkedIn + e.checkedIn }),
  { sold: 0, capacity: 0, checkedIn: 0 }
))
const attendancePct = computed(() => totals.value.sold ? Math.round(totals.value.checkedIn / totals.value.sold * 100) : 0)
const R = 52
const C = 2 * Math.PI * R
const attendanceDash = computed(() => `${attendancePct.value / 100 * C} ${C}`)

const capPct = computed(() => totals.value.capacity ? Math.min(100, Math.round(totals.value.sold / totals.value.capacity * 100)) : 0)
const cap = computed(() => capPct.value >= 90
  ? { color: 'error' as const, label: 'Hampir habis', stroke: '#e11d48' }
  : capPct.value >= 60
    ? { color: 'warning' as const, label: 'Laris', stroke: '#d97706' }
    : { color: 'primary' as const, label: 'Tersedia', stroke: '#f5a524' })
const GA = Math.PI * 70
const gaugeDash = computed(() => `${capPct.value / 100 * GA} ${GA}`)

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
          <span
            v-if="previous"
            class="text-xs text-dimmed hidden md:inline"
          >Dibandingkan dengan {{ formatDate(previousQuery.from) }} – {{ formatDate(previousQuery.to) }}</span>
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
        role="alert"
        :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: load }]"
      />

      <!-- Hero -->
      <section class="relative overflow-hidden rounded-xl bg-ink p-6 text-white shadow-(--shadow-card) sm:p-8">
        <div class="relative flex flex-wrap items-end justify-between gap-6">
          <div class="min-w-0 max-w-2xl">
            <span class="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">
              {{ todayLabel }}
            </span>
            <h1 class="mt-3 text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {{ greeting }}
            </h1>
            <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span class="inline-flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-calendar-range"
                  class="size-4"
                />Performa {{ periodLabel.toLowerCase() }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-calendar-check"
                  class="size-4"
                />{{ formatNumber(summary?.overview.openCount ?? 0) }} event dibuka
              </span>
            </p>
          </div>
          <div class="flex flex-col items-start gap-3 sm:items-end">
            <div class="sm:text-right">
              <p class="text-xs font-medium uppercase tracking-wide text-white/60">
                Pendapatan periode ini
              </p>
              <USkeleton
                v-if="loading && !summary"
                class="mt-1 h-12 w-56 bg-white/10"
              />
              <p
                v-else
                class="font-display text-4xl font-bold tracking-tight text-accent tabular-nums sm:text-5xl"
              >
                {{ formatIDR(summary?.overview.totalRevenue ?? 0, true) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                to="/events"
                icon="i-lucide-plus"
                color="neutral"
                variant="solid"
                class="bg-white text-ink hover:bg-white/90"
              >
                Kelola event
              </UButton>
              <UButton
                to="/orders"
                icon="i-lucide-receipt-text"
                color="neutral"
                variant="ghost"
                class="text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white"
              >
                Pesanan
              </UButton>
            </div>
          </div>
        </div>
      </section>

      <h2 class="font-display text-lg font-bold text-highlighted">
        Ringkasan penjualan
      </h2>
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Pendapatan"
          :value="formatIDR(summary?.overview.totalRevenue ?? 0)"
          :delta="deltas.revenue"
          hint="vs periode sebelumnya"
          icon="i-lucide-wallet"
          :loading="loading && !summary"
        />
        <StatCard
          label="Tiket terjual"
          :value="formatNumber(summary?.overview.totalTicketsSold)"
          :delta="deltas.tickets"
          :hint="`Rata-rata ${formatIDR(avgOrder)} / tiket`"
          icon="i-lucide-ticket"
          tone="info"
          :loading="loading && !summary"
        />
        <StatCard
          label="Menunggu pembayaran"
          :value="formatNumber(summary?.overview.pendingVerifications)"
          hint="Semua periode"
          icon="i-lucide-hourglass"
          tone="warning"
          to="/orders"
          :loading="loading && !summary"
        />
        <StatCard
          label="Event dibuka"
          :value="formatNumber(summary?.overview.openCount)"
          :hint="summary ? `${formatNumber(summary.overview.closedCount)} sudah ditutup` : undefined"
          icon="i-lucide-calendar-check"
          tone="success"
          to="/events"
          :loading="loading && !summary"
        />
      </div>

      <!-- Okupansi + kehadiran -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard
          class="rounded-xl"
          :ui="{ body: 'p-5 sm:p-6' }"
        >
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold text-highlighted">
                Okupansi tiket
              </h3>
              <p class="text-xs text-muted">
                Gabungan event yang dibuka
              </p>
            </div>
            <UBadge
              v-if="totals.capacity"
              :color="cap.color"
              variant="subtle"
            >
              {{ cap.label }}
            </UBadge>
          </div>
          <USkeleton
            v-if="loading && !events.length"
            class="mx-auto mt-4 h-32 w-56"
          />
          <template v-else-if="totals.capacity">
            <div class="relative mx-auto mt-4 w-56">
              <svg
                viewBox="0 0 160 90"
                class="w-full"
                role="img"
                :aria-label="`Okupansi ${capPct}%`"
              >
                <path
                  d="M10 80 A70 70 0 0 1 150 80"
                  fill="none"
                  stroke="var(--ui-bg-accented)"
                  stroke-width="14"
                  stroke-linecap="round"
                />
                <path
                  v-if="capPct > 0"
                  d="M10 80 A70 70 0 0 1 150 80"
                  fill="none"
                  :stroke="cap.stroke"
                  stroke-width="14"
                  stroke-linecap="round"
                  :stroke-dasharray="gaugeDash"
                  class="transition-all duration-700"
                />
              </svg>
              <div class="absolute inset-x-0 bottom-0 text-center">
                <span class="text-3xl font-bold tabular-nums text-highlighted">{{ capPct }}%</span>
              </div>
            </div>
            <p class="mt-3 text-center text-sm text-muted">
              <span class="font-semibold text-highlighted">{{ formatNumber(totals.sold) }}</span>
              dari {{ formatNumber(totals.capacity) }} tiket terjual · sisa {{ formatNumber(Math.max(0, totals.capacity - totals.sold)) }}
            </p>
          </template>
          <p
            v-else
            class="mt-8 text-center text-sm text-muted"
          >
            Belum ada event yang dibuka.
          </p>
        </UCard>

        <UCard
          class="rounded-xl"
          :ui="{ body: 'flex h-full flex-col p-5 sm:p-6' }"
        >
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold text-highlighted">
                Kehadiran
              </h3>
              <p class="text-xs text-muted">
                Tiket yang sudah check-in
              </p>
            </div>
            <UButton
              to="/scanner"
              size="xs"
              color="neutral"
              variant="ghost"
              trailing-icon="i-lucide-arrow-right"
            >
              Scanner
            </UButton>
          </div>
          <div class="mt-4 flex flex-1 flex-wrap items-center justify-center gap-6">
            <div class="relative size-36 shrink-0">
              <svg
                viewBox="0 0 120 120"
                class="size-full -rotate-90"
                role="img"
                :aria-label="`Tingkat kehadiran ${attendancePct}%`"
              >
                <circle
                  cx="60"
                  cy="60"
                  :r="R"
                  fill="none"
                  stroke="var(--ui-bg-accented)"
                  stroke-width="12"
                />
                <circle
                  v-if="attendancePct > 0"
                  cx="60"
                  cy="60"
                  :r="R"
                  fill="none"
                  stroke="#15803d"
                  stroke-width="12"
                  stroke-linecap="round"
                  :stroke-dasharray="attendanceDash"
                  class="transition-all duration-700"
                />
              </svg>
              <div class="absolute inset-0 grid place-content-center text-center">
                <span class="text-3xl font-bold tabular-nums text-highlighted">{{ attendancePct }}%</span>
                <span class="text-xs text-muted">hadir</span>
              </div>
            </div>
            <dl class="grid min-w-36 gap-3 text-center">
              <div class="rounded-xl bg-emerald-50 px-4 py-2">
                <dt class="text-xs text-emerald-800">
                  Sudah check-in
                </dt>
                <dd class="text-xl font-bold tabular-nums text-emerald-900">
                  {{ formatNumber(totals.checkedIn) }}
                </dd>
              </div>
              <div class="rounded-xl bg-elevated px-4 py-2">
                <dt class="text-xs text-muted">
                  Belum hadir
                </dt>
                <dd class="text-xl font-bold tabular-nums text-highlighted">
                  {{ formatNumber(Math.max(0, totals.sold - totals.checkedIn)) }}
                </dd>
              </div>
            </dl>
          </div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <UCard class="rounded-xl xl:col-span-2">
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-[13px] font-medium text-muted">
                  Tren penjualan · pesanan lunas per hari
                </p>
                <div class="mt-1 flex items-center gap-2.5">
                  <p class="text-xl font-semibold tracking-tight text-highlighted tabular-nums">
                    {{ metric === 'revenue' ? formatIDR(trendTotal) : `${formatNumber(trendTotal)} tiket` }}
                  </p>
                  <span
                    v-if="deltas.trend !== null"
                    class="rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums"
                    :class="deltas.trend >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
                  >{{ deltas.trend >= 0 ? '+' : '' }}{{ (Math.round(deltas.trend * 10) / 10).toLocaleString('id-ID') }}%</span>
                </div>
                <div class="mt-2 flex items-center gap-4 text-xs text-muted">
                  <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full bg-primary" />Periode ini</span>
                  <span
                    v-if="comparePoints.length"
                    class="flex items-center gap-1.5"
                  ><span class="w-3 border-t-2 border-dashed border-(--ui-border-accented)" />Periode sebelumnya</span>
                </div>
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
            :compare="comparePoints"
            :label="metric === 'revenue' ? 'Pendapatan harian' : 'Tiket harian'"
            :format="metric === 'revenue' ? (v: number) => formatIDR(v) : (v: number) => `${formatNumber(v)} tiket`"
            :axis-format="metric === 'revenue' ? (v: number) => formatIDR(v, true) : (v: number) => formatNumber(Math.round(v))"
          />
        </UCard>

        <UCard class="rounded-xl">
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
          <template v-else>
            <p class="text-xl font-semibold tracking-tight text-highlighted tabular-nums">
              {{ formatIDR(summary?.overview.totalRevenue ?? 0) }}
            </p>
            <div
              class="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              role="img"
              :aria-label="tiers.map(t => `${t.name} ${t.share}%`).join(', ')"
            >
              <span
                v-for="tier in tiers"
                :key="tier.name"
                class="h-full first:rounded-s-full last:rounded-e-full"
                :style="{ width: `${tier.share}%`, background: tier.color }"
              />
            </div>
            <ul class="mt-5 divide-y divide-default">
              <li
                v-for="tier in tiers.slice(0, 6)"
                :key="tier.name"
                class="flex items-center gap-3 py-2.5 first:pt-0 text-sm"
              >
                <span
                  class="size-2.5 shrink-0 rounded-sm"
                  :style="{ background: tier.color }"
                />
                <span class="flex-1 truncate text-highlighted">{{ tier.name }}</span>
                <span class="text-xs text-dimmed tabular-nums">{{ formatNumber(tier.ticketsSold) }} tiket</span>
                <span class="w-12 text-right tabular-nums font-medium text-highlighted">{{ tier.share.toLocaleString('id-ID') }}%</span>
              </li>
            </ul>
          </template>
        </UCard>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <UCard
          class="rounded-xl xl:col-span-2"
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
              <tr class="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-toned">
                <th class="text-left px-5 py-3">
                  Event
                </th>
                <th class="text-left px-5 py-3 w-[35%]">
                  Terjual / kapasitas
                </th>
                <th class="text-right px-5 py-3">
                  Pendapatan
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="ev in summary.byEvent.slice(0, 8)"
                :key="ev.eventId"
                class="transition-colors even:bg-slate-50/70 hover:bg-gold-50"
              >
                <td class="px-5 py-3.5 text-highlighted max-w-0 truncate">
                  {{ ev.title }}
                </td>
                <td class="px-5 py-3.5">
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
                <td class="px-5 py-3.5 text-right tabular-nums text-highlighted whitespace-nowrap">
                  {{ formatIDR(ev.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard
          class="rounded-xl"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
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
              class="px-5 py-3.5"
            >
              <div class="flex items-start gap-3">
                <div class="w-11 shrink-0 overflow-hidden rounded-lg ring ring-default text-center">
                  <p class="bg-primary/10 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {{ dateTile(ev.dateTime).month }}
                  </p>
                  <p class="py-0.5 text-base font-semibold text-highlighted tabular-nums">
                    {{ dateTile(ev.dateTime).day }}
                  </p>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-highlighted truncate">
                      {{ ev.title }}
                    </p>
                    <span class="shrink-0 text-xs text-muted">{{ daysUntil(ev.dateTime) }}</span>
                  </div>
                  <p class="text-xs text-muted truncate">
                    {{ formatTime(ev.dateTime) }} · {{ ev.venue ?? 'Venue belum diatur' }}{{ ev.city ? `, ${ev.city}` : '' }}
                  </p>
                </div>
              </div>
              <div class="mt-2.5 ps-14 flex items-center gap-3 text-xs text-muted tabular-nums">
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
