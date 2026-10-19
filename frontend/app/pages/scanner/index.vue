<script setup lang="ts">
import { Html5Qrcode } from 'html5-qrcode'

useHead({ title: 'Scan Check-In' })

interface EventOption { id: string, title: string, dateTime: string, status: 'open' | 'closed', venue?: { name: string, city: string } | null }
interface Stats {
  totalTickets: number
  checkedIn: number
  remaining: number
  checkedInPct: number
  byCategory: { categoryName: string, total: number, checkedIn: number, checkedInPct: number }[]
}
type Outcome = 'success' | 'used' | 'wrong_event' | 'invalid' | 'error'
interface ScanResult {
  outcome: Outcome
  code: string
  title: string
  detail: string
  at: Date
}

const { request } = useApi()
const { prefs } = useScannerPrefs()
const EVENT_KEY = 'ggtix_scanner_event'

// ---- Events -------------------------------------------------------------
const events = ref<EventOption[]>([])
const eventsError = ref('')
const eventsLoading = ref(true)
const eventId = ref('')

/** Events closest to now first; upcoming shows win over past ones on the same distance. */
function relevance(e: EventOption) {
  const diff = Date.parse(e.dateTime) - Date.now()
  return diff >= -12 * 3600000 ? Math.abs(diff) : Math.abs(diff) * 4
}

async function loadEvents() {
  eventsLoading.value = true
  eventsError.value = ''
  try {
    // Ticket sales are often closed on show day, so include closed events.
    const res = await request<{ data: EventOption[] }>('/events', { query: { limit: 100 } })
    events.value = [...res.data].sort((a, b) => relevance(a) - relevance(b))
    let remembered: string | null = null
    try {
      remembered = localStorage.getItem(EVENT_KEY)
    } catch { /* storage blocked */ }
    eventId.value = events.value.find(e => e.id === remembered)?.id ?? events.value[0]?.id ?? ''
  } catch (err) {
    eventsError.value = apiErrorMessage(err, 'Daftar event gagal dimuat.')
  } finally {
    eventsLoading.value = false
  }
}

const eventItems = computed(() => events.value.map(e => ({
  label: e.title,
  value: e.id,
  description: `${formatDateTime(e.dateTime)}${e.venue ? ` · ${e.venue.name}` : ''}`
})))
const currentEvent = computed(() => events.value.find(e => e.id === eventId.value))

// ---- Live stats ---------------------------------------------------------
const stats = ref<Stats | null>(null)
const statsStale = ref(false)
const statsUpdatedAt = ref<Date | null>(null)
let statsTimer: ReturnType<typeof setInterval> | undefined

async function loadStats() {
  const id = eventId.value
  if (!id || document.hidden) return
  try {
    const res = await request<{ data: Stats }>(`/tickets/stats/${id}`)
    if (id !== eventId.value) return
    stats.value = res.data
    statsStale.value = false
    statsUpdatedAt.value = new Date()
  } catch {
    // Keep the last real numbers and flag them; never show invented ones.
    statsStale.value = true
  }
}

watch(eventId, (id) => {
  stats.value = null
  history.value = []
  result.value = null
  if (!id) return
  try {
    localStorage.setItem(EVENT_KEY, id)
  } catch { /* storage blocked */ }
  loadStats()
  if (scanning.value) restartCamera()
})

// ---- Camera -------------------------------------------------------------
const READER_ID = 'qr-reader'
let scanner: Html5Qrcode | null = null
const scanning = ref(false)
const starting = ref(false)
const cameraError = ref('')
const facing = ref<'environment' | 'user'>(prefs.value.cameraFacing)

async function startCamera() {
  if (!eventId.value || starting.value) return
  cameraError.value = ''
  starting.value = true
  try {
    scanner ??= new Html5Qrcode(READER_ID, { verbose: false })
    await scanner.start({ facingMode: facing.value }, { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, onDecoded, () => {})
    scanning.value = true
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    cameraError.value = /permission|notallowed/i.test(msg)
      ? 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.'
      : /notfound|no camera|requested device/i.test(msg)
        ? 'Kamera tidak ditemukan di perangkat ini. Gunakan input manual.'
        : 'Kamera tidak dapat dibuka. Pastikan tidak dipakai aplikasi lain.'
  } finally {
    starting.value = false
  }
}

async function stopCamera() {
  if (!scanner || !scanning.value) return
  try {
    await scanner.stop()
  } catch { /* already stopped */ }
  scanning.value = false
}

async function restartCamera() {
  await stopCamera()
  await startCamera()
}

async function flipCamera() {
  facing.value = facing.value === 'environment' ? 'user' : 'environment'
  if (scanning.value) await restartCamera()
}

// ---- Check-in -----------------------------------------------------------
const result = ref<ScanResult | null>(null)
const history = ref<ScanResult[]>([])
const processing = ref(false)
const manualCode = ref('')
const recent = new Map<string, number>()
const COOLDOWN_MS = 4000
let clearTimer: ReturnType<typeof setTimeout> | undefined

function onDecoded(text: string) {
  const code = text.trim()
  // The camera sees the same QR many times per second; ignore repeats briefly.
  const last = recent.get(code)
  if (!code || processing.value || (last && Date.now() - last < COOLDOWN_MS)) return
  recent.set(code, Date.now())
  void checkIn(code)
}

function submitManual() {
  const code = manualCode.value.trim()
  if (!code || processing.value) return
  manualCode.value = ''
  void checkIn(code)
}

async function checkIn(code: string) {
  if (!eventId.value) return
  processing.value = true
  let outcome: ScanResult
  try {
    const res = await request<{ data: { order: { customerName: string, categoryName: string } } }>('/tickets/check-in', {
      method: 'POST',
      body: { qrCodeValue: code, eventId: eventId.value }
    })
    outcome = { outcome: 'success', code, title: 'Tiket valid', detail: `${res.data.order.customerName} · ${res.data.order.categoryName}`, at: new Date() }
  } catch (err) {
    const data = (err as { data?: { error?: string, checkedInAt?: string } }).data
    const status = apiErrorStatus(err)
    if (data?.error === 'ALREADY_CHECKED_IN') {
      outcome = { outcome: 'used', code, title: 'Tiket sudah dipakai', detail: `Check-in pukul ${formatTime(data.checkedInAt)}`, at: new Date() }
    } else if (data?.error === 'WRONG_EVENT') {
      outcome = { outcome: 'wrong_event', code, title: 'Bukan untuk event ini', detail: 'Arahkan pengunjung ke gerbang event yang benar.', at: new Date() }
    } else if (data?.error === 'TICKET_NOT_FOUND') {
      outcome = { outcome: 'invalid', code, title: 'QR tidak dikenali', detail: 'Tiket tidak terdaftar di GGTIX.', at: new Date() }
    } else {
      // A network failure is not proof the ticket is fake; let staff retry.
      outcome = { outcome: 'error', code, title: status ? 'Gagal memvalidasi' : 'Tidak ada koneksi', detail: apiErrorMessage(err), at: new Date() }
      recent.delete(code)
    }
  }
  showResult(outcome)
  processing.value = false
  if (outcome.outcome === 'success') loadStats()
  if (!prefs.value.continuousMode && outcome.outcome !== 'error') await stopCamera()
}

function showResult(r: ScanResult) {
  result.value = r
  history.value = [r, ...history.value].slice(0, 20)
  if (prefs.value.soundEnabled) {
    playTone(r.outcome === 'success' ? 'success' : r.outcome === 'used' || r.outcome === 'wrong_event' ? 'warning' : 'error', prefs.value.soundVolume)
  }
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    result.value = null
  }, 4000)
}

const OUTCOME_UI: Record<Outcome, { icon: string, cls: string, badge: 'success' | 'warning' | 'error' | 'neutral' }> = {
  success: { icon: 'i-lucide-circle-check', cls: 'bg-success/10 border-success/40 text-success', badge: 'success' },
  used: { icon: 'i-lucide-circle-alert', cls: 'bg-warning/10 border-warning/40 text-warning', badge: 'warning' },
  wrong_event: { icon: 'i-lucide-circle-slash', cls: 'bg-warning/10 border-warning/40 text-warning', badge: 'warning' },
  invalid: { icon: 'i-lucide-circle-x', cls: 'bg-error/10 border-error/40 text-error', badge: 'error' },
  error: { icon: 'i-lucide-wifi-off', cls: 'bg-elevated border-default text-muted', badge: 'neutral' }
}

function onVisibility() {
  if (!document.hidden) loadStats()
}

onMounted(async () => {
  await loadEvents()
  statsTimer = setInterval(loadStats, 5000)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  clearInterval(statsTimer)
  clearTimeout(clearTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  void stopCamera()
})
</script>

<template>
  <UDashboardPanel id="scanner">
    <template #header>
      <UDashboardNavbar title="Scan Check-In">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <USelectMenu
            v-model="eventId"
            :items="eventItems"
            value-key="value"
            :loading="eventsLoading"
            placeholder="Pilih event"
            :search-input="{ placeholder: 'Cari event…' }"
            class="w-full sm:w-96"
            aria-label="Event yang sedang di-check-in"
          />
        </template>
        <template #right>
          <StatusBadge
            v-if="currentEvent"
            :status="currentEvent.status"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="eventsError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="eventsError"
        description="Scanner tidak dapat dipakai tanpa daftar event."
        :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: loadEvents }]"
      />
      <UEmpty
        v-else-if="!eventsLoading && !events.length"
        icon="i-lucide-calendar-x"
        title="Belum ada event"
        description="Scanner aktif setelah ada event yang dibuat."
      />

      <div
        v-else
        class="grid grid-cols-1 lg:grid-cols-5 gap-4"
      >
        <div class="lg:col-span-3 space-y-4">
          <UCard>
            <div class="relative mx-auto aspect-square max-w-md overflow-hidden rounded-xl bg-neutral-950">
              <div
                :id="READER_ID"
                class="size-full [&_video]:object-cover"
              />
              <div
                v-if="!scanning"
                class="absolute inset-0 grid place-items-center text-center p-6"
              >
                <div>
                  <UIcon
                    name="i-lucide-scan-line"
                    class="size-10 text-white/40"
                  />
                  <p class="mt-2 text-sm text-white/70">
                    {{ cameraError || 'Kamera belum aktif' }}
                  </p>
                </div>
              </div>
              <Transition
                enter-active-class="transition duration-150"
                enter-from-class="opacity-0 scale-95"
                leave-active-class="transition duration-200"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="result"
                  class="absolute inset-x-3 bottom-3 rounded-lg border p-3 backdrop-blur bg-default/90 flex items-center gap-3"
                  :class="OUTCOME_UI[result.outcome].cls"
                  role="status"
                  aria-live="assertive"
                >
                  <UIcon
                    :name="OUTCOME_UI[result.outcome].icon"
                    class="size-8 shrink-0"
                  />
                  <div class="min-w-0">
                    <p class="font-semibold">
                      {{ result.title }}
                    </p>
                    <p class="text-sm text-toned truncate">
                      {{ result.detail }}
                    </p>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <UButton
                v-if="!scanning"
                icon="i-lucide-camera"
                label="Mulai scan"
                size="md"
                :loading="starting"
                :disabled="!eventId"
                @click="startCamera"
              />
              <UButton
                v-else
                icon="i-lucide-camera-off"
                label="Hentikan"
                color="neutral"
                variant="outline"
                size="md"
                @click="stopCamera"
              />
              <UButton
                icon="i-lucide-switch-camera"
                color="neutral"
                variant="ghost"
                size="md"
                :label="facing === 'environment' ? 'Kamera belakang' : 'Kamera depan'"
                @click="flipCamera"
              />
            </div>

            <form
              class="mt-4 flex gap-2"
              @submit.prevent="submitManual"
            >
              <UInput
                v-model="manualCode"
                placeholder="Ketik kode tiket (tix_…)"
                icon="i-lucide-keyboard"
                class="flex-1 font-mono"
                :disabled="!eventId"
                aria-label="Kode tiket manual"
              />
              <UButton
                type="submit"
                label="Check-in"
                :loading="processing"
                :disabled="!manualCode.trim() || !eventId"
              />
            </form>
          </UCard>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <p class="font-medium text-highlighted">
                  Kehadiran
                </p>
                <span
                  class="text-xs"
                  :class="statsStale ? 'text-warning' : 'text-dimmed'"
                >
                  {{ statsStale ? 'Tidak terbarui — memeriksa ulang…' : statsUpdatedAt ? `Diperbarui ${formatTime(statsUpdatedAt)}` : '' }}
                </span>
              </div>
            </template>
            <div
              v-if="!stats"
              class="space-y-3"
            >
              <USkeleton class="h-10 w-32" />
              <USkeleton class="h-3 w-full" />
            </div>
            <template v-else>
              <div class="flex items-end justify-between">
                <p class="text-3xl font-semibold text-highlighted tabular-nums">
                  {{ formatNumber(stats.checkedIn) }}<span class="text-base font-normal text-muted"> / {{ formatNumber(stats.totalTickets) }}</span>
                </p>
                <p class="text-sm text-muted tabular-nums">
                  {{ stats.checkedInPct }}%
                </p>
              </div>
              <UProgress
                :model-value="stats.checkedInPct"
                class="mt-2"
              />
              <p class="mt-1 text-xs text-muted">
                {{ formatNumber(stats.remaining) }} tiket belum check-in
              </p>
              <ul
                v-if="stats.byCategory.length"
                class="mt-4 space-y-2.5"
              >
                <li
                  v-for="c in stats.byCategory"
                  :key="c.categoryName"
                  class="text-sm"
                >
                  <div class="flex justify-between">
                    <span class="text-toned">{{ c.categoryName }}</span>
                    <span class="text-muted tabular-nums">{{ formatNumber(c.checkedIn) }} / {{ formatNumber(c.total) }}</span>
                  </div>
                  <UProgress
                    :model-value="c.checkedInPct"
                    size="xs"
                    class="mt-1"
                  />
                </li>
              </ul>
            </template>
          </UCard>

          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <p class="font-medium text-highlighted">
                Riwayat scan
              </p>
            </template>
            <p
              v-if="!history.length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              Belum ada scan di sesi ini.
            </p>
            <ul
              v-else
              class="divide-y divide-default max-h-96 overflow-y-auto"
            >
              <li
                v-for="(h, i) in history"
                :key="i"
                class="flex items-center gap-3 px-4 py-2.5"
              >
                <UIcon
                  :name="OUTCOME_UI[h.outcome].icon"
                  class="size-5 shrink-0"
                  :class="OUTCOME_UI[h.outcome].cls.split(' ').find(c => c.startsWith('text-'))"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-highlighted">
                    {{ h.title }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ h.detail }}
                  </p>
                </div>
                <span class="text-xs text-dimmed tabular-nums">{{ formatTime(h.at) }}</span>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
