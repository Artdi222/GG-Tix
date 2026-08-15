<script setup lang="ts">
import { Html5Qrcode } from 'html5-qrcode'

interface EventOption {
  id: string
  title: string
  dateTime: string
  venueName?: string
  city?: string
  status?: string
}

interface TicketStats {
  eventId: string
  eventTitle: string
  totalTickets: number
  checkedIn: number
  remaining: number
  checkedInPct: number
  byCategory: Array<{
    categoryName: string
    total: number
    checkedIn: number
    remaining: number
    checkedInPct: number
  }>
}

interface ScanResult {
  status: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'WRONG_EVENT' | 'TICKET_NOT_FOUND' | 'ERROR'
  message: string
  ticket?: {
    id: string
    qrCodeValue: string
    checkedIn: boolean
    checkedInAt?: string | null
  }
  order?: {
    customerName: string
    categoryName: string
    quantity: number
  }
  event?: {
    title: string
  }
  timestamp: string
}

const { request } = useApi()

// Event selection state
const events = ref<EventOption[]>([])
const selectedEventId = ref<string>('')
const isLoadingEvents = ref(false)

// Scanner state
const isScanning = ref(false)
const scannerError = ref('')
const manualQrCode = ref('')
const isProcessing = ref(false)
const cameraFacingMode = ref<'environment' | 'user'>('environment')
let html5QrScanner: Html5Qrcode | null = null

// Live check-in stats
const stats = ref<TicketStats | null>(null)
let statsInterval: any = null

// Feedback state
const currentFeedback = ref<ScanResult | null>(null)
const scanHistory = ref<ScanResult[]>([])
let feedbackTimer: any = null

// Web Audio API Synthesis for Chime / Buzz (100% Reliable Offline)
function playSound(type: 'success' | 'error' | 'warning') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    if (type === 'success') {
      // Ascending two-tone chime (880Hz -> 1320Hz)
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } else {
      // Low buzz tone (160Hz sawtooth)
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    }
  } catch {
    // Ignore audio context autoplay errors
  }
}

// Fetch Events List
async function fetchEventsList() {
  isLoadingEvents.value = true
  try {
    const res = await request<{ data: any[] }>('/events')
    if (res?.data && res.data.length > 0) {
      events.value = res.data.map((e: any) => ({
        id: e.id,
        title: e.title,
        dateTime: e.dateTime,
        venueName: typeof e.venue === 'object' ? e.venue?.name : 'Venue Konser',
        city: e.city || (typeof e.venue === 'object' ? e.venue?.city : 'Jakarta'),
        status: e.status
      }))
      if (!selectedEventId.value && events.value.length > 0 && events.value[0]) {
        selectedEventId.value = events.value[0].id
      }
    }
  } catch {
    // Fallback demo events
    events.value = [
      {
        id: 'evt-001',
        title: 'Wuthering Waves Live 2026',
        dateTime: '2026-10-12T19:00:00.000Z',
        venueName: 'Gelora Bung Karno',
        city: 'Jakarta',
        status: 'open'
      },
      {
        id: 'evt-002',
        title: 'Coldplay Music of the Spheres',
        dateTime: '2026-11-15T20:00:00.000Z',
        venueName: 'Stadion Utama GBK',
        city: 'Jakarta',
        status: 'open'
      }
    ]
    if (!selectedEventId.value) {
      selectedEventId.value = 'evt-001'
    }
  } finally {
    isLoadingEvents.value = false
  }
}

// Fetch Stats for selected event
async function fetchEventStats() {
  if (!selectedEventId.value) return
  try {
    const res = await request<{ data: TicketStats }>(`/tickets/stats/${selectedEventId.value}`)
    if (res?.data) {
      stats.value = res.data
    }
  } catch {
    // Fallback demo stats
    stats.value = {
      eventId: selectedEventId.value,
      eventTitle: currentSelectedEvent.value?.title || 'Konser Musik',
      totalTickets: 500,
      checkedIn: 342,
      remaining: 158,
      checkedInPct: 68.4,
      byCategory: [
        { categoryName: 'VVIP', total: 50, checkedIn: 48, remaining: 2, checkedInPct: 96.0 },
        { categoryName: 'VIP', total: 150, checkedIn: 120, remaining: 30, checkedInPct: 80.0 },
        { categoryName: 'Reguler', total: 300, checkedIn: 174, remaining: 126, checkedInPct: 58.0 }
      ]
    }
  }
}

const currentSelectedEvent = computed(() => {
  return events.value.find((e) => e.id === selectedEventId.value)
})

const eventSelectOptions = computed(() => {
  return events.value.map((e) => ({
    label: `${e.title} (${e.city || 'Jakarta'})`,
    value: e.id
  }))
})

// Camera Scanner Controls
async function startScanner() {
  if (!selectedEventId.value) {
    scannerError.value = 'Pilih event konser terlebih dahulu.'
    return
  }

  scannerError.value = ''
  try {
    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode('qr-video-reader')
    }

    const config = {
      fps: 10,
      qrbox: { width: 240, height: 240 },
      aspectRatio: 1.0
    }

    await html5QrScanner.start(
      { facingMode: cameraFacingMode.value },
      config,
      (decodedText) => {
        handleQrDetected(decodedText)
      },
      () => {
        // Ignore frame scan misses
      }
    )
    isScanning.value = true
  } catch (err: any) {
    scannerError.value = err?.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.'
    isScanning.value = false
  }
}

async function stopScanner() {
  if (html5QrScanner && isScanning.value) {
    try {
      await html5QrScanner.stop()
    } catch {
      // Ignore
    }
    isScanning.value = false
  }
}

async function toggleCamera() {
  cameraFacingMode.value = cameraFacingMode.value === 'environment' ? 'user' : 'environment'
  if (isScanning.value) {
    await stopScanner()
    await startScanner()
  }
}

// Handle QR Scan / Check-In
async function handleQrDetected(qrValue: string) {
  if (isProcessing.value || !qrValue.trim()) return
  isProcessing.value = true

  const cleanQr = qrValue.trim()

  try {
    const res = await request<{ data: any }>('/tickets/check-in', {
      method: 'POST',
      body: {
        qrCodeValue: cleanQr,
        eventId: selectedEventId.value
      }
    })

    const data = res?.data
    const successResult: ScanResult = {
      status: 'SUCCESS',
      message: 'Tiket Valid — Check-in Berhasil!',
      ticket: data?.ticket || { id: cleanQr, qrCodeValue: cleanQr, checkedIn: true, checkedInAt: new Date().toISOString() },
      order: data?.order || { customerName: 'Pengunjung', categoryName: 'VIP', quantity: 1 },
      event: data?.event || { title: currentSelectedEvent.value?.title || 'Event' },
      timestamp: new Date().toLocaleTimeString('id-ID')
    }

    setFeedback(successResult)
    playSound('success')

    // Optimistic stats update
    if (stats.value) {
      stats.value.checkedIn += 1
      stats.value.remaining = Math.max(0, stats.value.remaining - 1)
      stats.value.checkedInPct = Math.min(100, Math.round((stats.value.checkedIn / stats.value.totalTickets) * 1000) / 10)
    }
    fetchEventStats()
  } catch (err: any) {
    const errCode = err?.data?.error || 'ERROR'
    const errMsg = err?.data?.message || err?.message || 'Gagal memvalidasi tiket.'
    const checkedInAt = err?.data?.checkedInAt

    let statusType: ScanResult['status'] = 'ERROR'
    let soundType: 'error' | 'warning' = 'error'

    if (errCode === 'ALREADY_CHECKED_IN') {
      statusType = 'ALREADY_CHECKED_IN'
      soundType = 'warning'
    } else if (errCode === 'WRONG_EVENT') {
      statusType = 'WRONG_EVENT'
      soundType = 'warning'
    } else if (errCode === 'TICKET_NOT_FOUND') {
      statusType = 'TICKET_NOT_FOUND'
      soundType = 'error'
    }

    const failureResult: ScanResult = {
      status: statusType,
      message: errMsg + (checkedInAt ? ` (${new Date(checkedInAt).toLocaleTimeString('id-ID')})` : ''),
      ticket: { id: cleanQr, qrCodeValue: cleanQr, checkedIn: true, checkedInAt },
      timestamp: new Date().toLocaleTimeString('id-ID')
    }

    setFeedback(failureResult)
    playSound(soundType)
  } finally {
    setTimeout(() => {
      isProcessing.value = false
    }, 2000)
  }
}

function handleManualSubmit() {
  if (!manualQrCode.value.trim()) return
  handleQrDetected(manualQrCode.value.trim())
  manualQrCode.value = ''
}

function setFeedback(result: ScanResult) {
  currentFeedback.value = result
  scanHistory.value.unshift(result)
  if (scanHistory.value.length > 10) scanHistory.value.pop()

  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    currentFeedback.value = null
  }, 2500)
}

watch(selectedEventId, (newId) => {
  if (newId) {
    fetchEventStats()
    if (isScanning.value) {
      stopScanner().then(() => startScanner())
    }
  }
})

onMounted(async () => {
  await fetchEventsList()
  fetchEventStats()
  // 5-second polling for live check-in stats
  statsInterval = setInterval(fetchEventStats, 5000)
})

onBeforeUnmount(() => {
  clearInterval(statsInterval)
  clearTimeout(feedbackTimer)
  stopScanner()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Scanner QR Check-In Venue
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Validasi tiket digital pengunjung & monitor statistik pintu masuk konser (/api/tickets/check-in)
        </p>
      </div>

      <!-- Active Event Badge -->
      <UBadge
        v-if="currentSelectedEvent"
        color="primary"
        variant="soft"
        size="sm"
        class="font-semibold text-[11px] px-3 py-1 rounded-md"
      >
        <UIcon name="i-lucide-radio" class="w-3.5 h-3.5 mr-1 text-emerald-500 animate-pulse" />
        {{ currentSelectedEvent.title }}
      </UBadge>
    </div>

    <!-- Event Selector Card -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2.5 flex-1">
        <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-calendar" class="w-4.5 h-4.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pilih Event Konser</p>
          <USelect
            v-model="selectedEventId"
            :items="eventSelectOptions"
            placeholder="Pilih event untuk check-in..."
            size="sm"
            class="w-full sm:w-80 mt-1 text-xs"
          />
        </div>
      </div>

      <!-- Event Quick Info -->
      <div v-if="currentSelectedEvent" class="text-left sm:text-right text-xs">
        <p class="font-semibold text-gray-900 dark:text-white">{{ currentSelectedEvent.venueName }}</p>
        <p class="text-[11px] text-gray-500">{{ currentSelectedEvent.city }} • {{ new Date(currentSelectedEvent.dateTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}</p>
      </div>
    </div>

    <!-- Main Scanner & Stats Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Left Column: Camera Scanner Viewport & Manual Input (7 Cols) -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Scanner Viewport Box -->
        <div
          :class="[
            'p-4 rounded-xl bg-white dark:bg-gray-900 border shadow-xs transition-all duration-300 relative overflow-hidden',
            currentFeedback?.status === 'SUCCESS'
              ? 'border-emerald-500 ring-4 ring-emerald-500/20'
              : currentFeedback?.status === 'ALREADY_CHECKED_IN' || currentFeedback?.status === 'WRONG_EVENT'
              ? 'border-amber-500 ring-4 ring-amber-500/20'
              : currentFeedback
              ? 'border-red-500 ring-4 ring-red-500/20'
              : 'border-gray-200/80 dark:border-gray-800'
          ]"
        >
          <!-- Camera Controls Header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div
                :class="[
                  'w-2.5 h-2.5 rounded-full',
                  isScanning ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'
                ]"
              />
              <span class="text-xs font-bold text-gray-900 dark:text-white">
                {{ isScanning ? 'Kamera Scanner Aktif' : 'Kamera Siap' }}
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <UButton
                v-if="isScanning"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-switch-camera"
                title="Ganti Kamera"
                @click="toggleCamera"
              />
              <UButton
                v-if="!isScanning"
                color="primary"
                size="sm"
                icon="i-lucide-camera"
                class="font-medium text-xs shadow-xs"
                @click="startScanner"
              >
                Nyalakan Kamera
              </UButton>
              <UButton
                v-else
                color="error"
                variant="soft"
                size="sm"
                icon="i-lucide-camera-off"
                class="font-medium text-xs"
                @click="stopScanner"
              >
                Matikan
              </UButton>
            </div>
          </div>

          <!-- Video Viewport Container -->
          <div class="w-full aspect-4/3 rounded-xl bg-gray-950 flex items-center justify-center overflow-hidden relative">
            <div id="qr-video-reader" class="w-full h-full object-cover" />

            <!-- Scanner Idle State Placeholder -->
            <div v-if="!isScanning && !currentFeedback" class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-900/90 text-gray-400">
              <div class="w-14 h-14 rounded-2xl bg-gray-800 text-amber-500 flex items-center justify-center mb-3">
                <UIcon name="i-lucide-qr-code" class="w-8 h-8" />
              </div>
              <p class="text-xs font-semibold text-white">Scanner Belum Aktif</p>
              <p class="text-[11px] text-gray-400 max-w-xs mt-1">
                Klik tombol "Nyalakan Kamera" atau gunakan input manual di bawah untuk check-in tiket.
              </p>
            </div>

            <!-- Visual Feedback Flash Overlay -->
            <div
              v-if="currentFeedback"
              :class="[
                'absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20 transition-all duration-200 animate-in fade-in zoom-in-95',
                currentFeedback.status === 'SUCCESS'
                  ? 'bg-emerald-950/95 text-white'
                  : currentFeedback.status === 'ALREADY_CHECKED_IN' || currentFeedback.status === 'WRONG_EVENT'
                  ? 'bg-amber-950/95 text-white'
                  : 'bg-red-950/95 text-white'
              ]"
            >
              <div
                :class="[
                  'w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-lg',
                  currentFeedback.status === 'SUCCESS'
                    ? 'bg-emerald-500 text-white'
                    : currentFeedback.status === 'ALREADY_CHECKED_IN' || currentFeedback.status === 'WRONG_EVENT'
                    ? 'bg-amber-500 text-white'
                    : 'bg-red-500 text-white'
                ]"
              >
                <UIcon
                  :name="
                    currentFeedback.status === 'SUCCESS'
                      ? 'i-lucide-check-circle'
                      : currentFeedback.status === 'ALREADY_CHECKED_IN'
                      ? 'i-lucide-clock'
                      : 'i-lucide-alert-triangle'
                  "
                  class="w-10 h-10"
                />
              </div>

              <h2 class="text-base font-extrabold tracking-tight">
                {{ currentFeedback.message }}
              </h2>

              <div v-if="currentFeedback.order" class="mt-2 text-xs text-gray-200 space-y-0.5">
                <p class="font-bold text-sm text-white">{{ currentFeedback.order.customerName }}</p>
                <p class="text-[11px] text-emerald-300 font-semibold">{{ currentFeedback.order.categoryName }} Class</p>
              </div>

              <p class="text-[10px] font-mono text-gray-400 mt-2">
                {{ currentFeedback.ticket?.qrCodeValue }}
              </p>
            </div>
          </div>

          <!-- Scanner Error Alert -->
          <UAlert
            v-if="scannerError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :description="scannerError"
            class="mt-3 text-xs"
          />
        </div>

        <!-- Manual Input Fallback -->
        <div class="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Input Manual Kode Tiket (Fallback)</p>
          <div class="flex items-center gap-2">
            <UInput
              v-model="manualQrCode"
              placeholder="Ketik kode tiket (contoh: tix_a3f8b2c1...)"
              size="sm"
              class="flex-1 text-xs font-mono"
              @keydown.enter="handleManualSubmit"
            />
            <UButton
              color="primary"
              size="sm"
              icon="i-lucide-scan-line"
              class="font-semibold text-xs shadow-xs"
              :loading="isProcessing"
              @click="handleManualSubmit"
            >
              Validasi
            </UButton>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Check-In Statistics & Scan Log (5 Cols) -->
      <div class="lg:col-span-5 space-y-4">
        <!-- Live Check-In Progress Card -->
        <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Statistik Check-In Venue</p>
            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <UIcon name="i-lucide-refresh-cw" class="w-3 h-3 animate-spin" />
              Live 5s
            </span>
          </div>

          <div class="flex items-baseline justify-between mt-1">
            <h3 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {{ stats?.checkedIn || 0 }} <span class="text-xs text-gray-400 font-normal">/ {{ stats?.totalTickets || 0 }} tiket</span>
            </h3>
            <span class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {{ stats?.checkedInPct || 0 }}%
            </span>
          </div>

          <!-- Main Progress Bar -->
          <div class="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden mt-2.5">
            <div
              class="bg-emerald-500 h-full rounded-full transition-all duration-500"
              :style="{ width: `${stats?.checkedInPct || 0}%` }"
            />
          </div>

          <!-- Category Breakdown Progress -->
          <div class="mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
            <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Berdasarkan Kategori</p>
            <div v-for="cat in stats?.byCategory" :key="cat.categoryName" class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-gray-800 dark:text-gray-200">{{ cat.categoryName }}</span>
                <span class="text-[11px] text-gray-500">{{ cat.checkedIn }} / {{ cat.total }} ({{ cat.checkedInPct }}%)</span>
              </div>
              <div class="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  class="bg-amber-500 h-full rounded-full transition-all duration-500"
                  :style="{ width: `${cat.checkedInPct}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Scan History Log -->
        <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Log Scan Terakhir (10 Data)</p>

          <div v-if="scanHistory.length === 0" class="text-center py-6 text-gray-400 text-xs">
            Belum ada aktivitas scan pada sesi ini.
          </div>

          <div v-else class="space-y-2 max-h-60 overflow-y-auto pr-1">
            <div
              v-for="(scan, idx) in scanHistory"
              :key="idx"
              class="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-xs"
            >
              <div class="flex items-center gap-2 min-w-0">
                <UIcon
                  :name="
                    scan.status === 'SUCCESS'
                      ? 'i-lucide-check-circle'
                      : scan.status === 'ALREADY_CHECKED_IN'
                      ? 'i-lucide-clock'
                      : 'i-lucide-x-circle'
                  "
                  :class="[
                    'w-4 h-4 shrink-0',
                    scan.status === 'SUCCESS'
                      ? 'text-emerald-500'
                      : scan.status === 'ALREADY_CHECKED_IN'
                      ? 'text-amber-500'
                      : 'text-red-500'
                  ]"
                />
                <div class="truncate">
                  <p class="font-semibold text-gray-900 dark:text-white truncate">
                    {{ scan.order?.customerName || scan.ticket?.qrCodeValue || 'Scan' }}
                  </p>
                  <p class="text-[10px] text-gray-500">{{ scan.order?.categoryName ? `${scan.order.categoryName} • ` : '' }}{{ scan.message }}</p>
                </div>
              </div>

              <span class="text-[10px] text-gray-400 shrink-0 font-mono">{{ scan.timestamp }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
