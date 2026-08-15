<script setup lang="ts">
import type { EventItem, ArtistOption, VenueOption } from '~/components/EventFormModal.vue'

const { request } = useApi()

// Search & Filter state
const search = ref('')
const selectedCity = ref('ALL')
const selectedStatus = ref<'ALL' | 'open' | 'closed'>('ALL')

// Modal state
const isModalOpen = ref(false)
const editingEvent = ref<EventItem | null>(null)
const isLoading = ref(false)

// Category manager modal state
const isCategoryModalOpen = ref(false)
const selectedEventForCategories = ref<EventItem | null>(null)

function openCategoryManager(event: EventItem) {
  selectedEventForCategories.value = event
  isCategoryModalOpen.value = true
}

// Artists list for select dropdown
const artists = ref<ArtistOption[]>([
  { id: 'art-001', name: 'Rover Ensemble' },
  { id: 'art-002', name: 'Coldplay' },
  { id: 'art-003', name: 'NIKI' },
  { id: 'art-004', name: 'Sheila on 7' }
])

function getArtistName(id: string) {
  return artists.value.find(a => a.id === id)?.name || id
}

function getVenueName(event: EventItem) {
  if (event.venue && typeof event.venue === 'object' && event.venue.name) {
    return event.venue.name
  }
  const vId = event.venueId || (typeof event.venue === 'string' ? event.venue : null)
  if (vId) {
    const found = venues.value.find(v => v.id === vId)
    if (found) return found.name
    return vId
  }
  return '-'
}

function getVenueCity(event: EventItem) {
  if (event.venue && typeof event.venue === 'object' && event.venue.city) {
    return event.venue.city
  }
  if (event.city) return event.city
  const vId = event.venueId || (typeof event.venue === 'string' ? event.venue : null)
  if (vId) {
    const found = venues.value.find(v => v.id === vId)
    if (found) return found.city
  }
  return '-'
}

async function fetchArtists() {
  try {
    const res = await request<{ data: { id: string; name: string }[] }>('/artists')
    if (res?.data) {
      artists.value = res.data
    }
  } catch {
    // Keep mock
  }
}

// Events list matching BE contract
const events = ref<EventItem[]>([
  {
    id: 'evt-001',
    title: 'Wuthering Waves Live 2026',
    artistId: 'art-001',
    publisherName: 'Kuro Games',
    venueId: '',
    venue: { id: 'v-1', name: 'Gelora Bung Karno', city: 'Jakarta' },
    city: 'Jakarta',
    dateTime: '2026-10-12T19:00:00.000Z',
    status: 'open'
  },
  {
    id: 'evt-002',
    title: 'Coldplay Music of the Spheres',
    artistId: 'art-002',
    publisherName: 'PK Entertainment',
    venueId: '',
    venue: { id: 'v-2', name: 'Stadion Utama GBK', city: 'Jakarta' },
    city: 'Jakarta',
    dateTime: '2026-11-15T20:00:00.000Z',
    status: 'open'
  },
  {
    id: 'evt-003',
    title: 'NIKI Nicole World Tour',
    artistId: 'art-003',
    publisherName: '88rising',
    venueId: '',
    venue: { id: 'v-3', name: 'Beach City International Stadium', city: 'Jakarta' },
    city: 'Jakarta',
    dateTime: '2026-12-20T19:30:00.000Z',
    status: 'closed'
  }
])

// Fetch real events from BE
async function fetchEvents() {
  isLoading.value = true
  try {
    const res = await request<{ data: EventItem[] }>('/events')
    if (res?.data) {
      events.value = res.data
    }
  } catch {
    // Keep mock data
  } finally {
    isLoading.value = false
  }
}

const venues = ref<VenueOption[]>([])

async function fetchVenues() {
  try {
    const res = await request<{ data: VenueOption[] }>('/venues')
    if (res?.data) {
      venues.value = res.data
    }
  } catch {
    // Keep mock
  }
}

onMounted(() => {
  fetchEvents()
  fetchArtists()
  fetchVenues()
})

// KPI Stats Computations
const totalEventsCount = computed(() => events.value.length)
const openEventsCount = computed(() => events.value.filter(e => e.status === 'open').length)
const closedEventsCount = computed(() => events.value.filter(e => e.status === 'closed').length)

const cityOptions = computed(() => {
  const cities = new Set<string>()
  venues.value.forEach(v => {
    if (v.city) cities.add(v.city)
  })
  events.value.forEach(e => {
    const c = getVenueCity(e)
    if (c && c !== '-') cities.add(c)
  })
  return [
    { label: 'Semua Kota', value: 'ALL' },
    ...Array.from(cities).map(c => ({ label: c, value: c }))
  ]
})

const statusOptions = [
  { label: 'Semua Status', value: 'ALL' },
  { label: 'Open (Aktif)', value: 'open' },
  { label: 'Closed (Tutup)', value: 'closed' }
]

const filteredEvents = computed(() => {
  return events.value.filter((e) => {
    const venueName = getVenueName(e)
    const venueCity = getVenueCity(e)
    const matchesSearch = !search.value ||
      e.title.toLowerCase().includes(search.value.toLowerCase()) ||
      venueName.toLowerCase().includes(search.value.toLowerCase()) ||
      venueCity.toLowerCase().includes(search.value.toLowerCase()) ||
      (e.publisherName && e.publisherName.toLowerCase().includes(search.value.toLowerCase()))
    const matchesCity = selectedCity.value === 'ALL' || venueCity === selectedCity.value
    const matchesStatus = selectedStatus.value === 'ALL' || e.status === selectedStatus.value
    return matchesSearch && matchesCity && matchesStatus
  })
})

function openCreateModal() {
  editingEvent.value = null
  isModalOpen.value = true
}

function openEditModal(event: EventItem) {
  const venueIdVal = event.venueId || (typeof event.venue === 'object' ? event.venue?.id : event.venue) || ''
  const preparedEvent: EventItem = {
    ...event,
    venueId: venueIdVal
  }
  editingEvent.value = preparedEvent
  isModalOpen.value = true
}

async function handleSaveEvent(saved: EventItem) {
  try {
    if (saved.id) {
      await request(`/events/${saved.id}`, { method: 'PUT', body: saved })
      const idx = events.value.findIndex(e => e.id === saved.id)
      if (idx !== -1) events.value[idx] = saved
    } else {
      const res = await request<{ data: EventItem }>('/events', { method: 'POST', body: saved })
      events.value.unshift(res.data || { ...saved, id: `evt-${Date.now()}` })
    }
  } catch {
    if (saved.id) {
      const idx = events.value.findIndex(e => e.id === saved.id)
      if (idx !== -1) events.value[idx] = saved
    } else {
      events.value.unshift({ ...saved, id: `evt-${Date.now()}` })
    }
  }
}

async function toggleStatus(event: EventItem) {
  const newStatus = event.status === 'open' ? 'closed' : 'open'
  try {
    await request(`/events/${event.id}/status`, { method: 'PATCH', body: { status: newStatus } })
    event.status = newStatus
  } catch {
    event.status = newStatus
  }
}

async function deleteEvent(id: string) {
  if (!confirm('Apakah Anda yakin ingin menghapus event ini?')) return
  try {
    await request(`/events/${id}`, { method: 'DELETE' })
    events.value = events.value.filter(e => e.id !== id)
  } catch {
    events.value = events.value.filter(e => e.id !== id)
  }
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header Page -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Event Konser
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola daftar konser, venue, tanggal, dan status penjualan tiket (/api/events)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="sm"
        class="font-medium text-xs shadow-xs"
        @click="openCreateModal"
      >
        Tambah Event
      </UButton>
    </div>

    <!-- Stats KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Event Konser</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ totalEventsCount }}</h3>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-calendar" class="w-3 h-3" />
            Jadwal konser terdaftar
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-calendar-range" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Event OPEN (Aktif)</p>
          <h3 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-tight">{{ openEventsCount }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-ticket" class="w-3 h-3" />
            Penjualan tiket dibuka
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-play-circle" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Event CLOSED (Selesai/Tutup)</p>
          <h3 class="text-xl font-bold text-gray-700 dark:text-gray-300 mt-0.5 tracking-tight">{{ closedEventsCount }}</h3>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-pause-circle" class="w-3 h-3" />
            Penjualan ditutup
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center">
          <UIcon name="i-lucide-lock" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row items-center gap-3">
      <div class="flex-1 w-full">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari nama event atau venue..."
          size="sm"
          class="w-full text-xs"
        />
      </div>

      <div class="flex items-center gap-2.5 w-full sm:w-auto">
        <USelect
          v-model="selectedCity"
          :items="cityOptions"
          size="sm"
          class="w-full sm:w-36 text-xs"
        />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          size="sm"
          class="w-full sm:w-36 text-xs"
        />
      </div>
    </div>

    <!-- Events Table -->
    <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th scope="col" class="px-4 py-3">Event & Promoter</th>
            <th scope="col" class="px-4 py-3">Artis / Performer</th>
            <th scope="col" class="px-4 py-3">Waktu</th>
            <th scope="col" class="px-4 py-3">Lokasi & Venue</th>
            <th scope="col" class="px-4 py-3 text-center">Status</th>
            <th scope="col" class="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
          <tr v-if="filteredEvents.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              Tidak ada event yang ditemukan.
            </td>
          </tr>
          <tr 
            v-for="event in filteredEvents" 
            :key="event.id"
            class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
          >
            <!-- Event & Promoter -->
            <td class="px-4 py-3">
              <div class="font-semibold text-xs text-gray-900 dark:text-white">{{ event.title }}</div>
              <div class="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider mt-0.5">
                {{ event.publisherName }}
              </div>
            </td>
            
            <!-- Artist -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-md text-[11px] font-medium">
                <UIcon name="i-lucide-music" class="w-3 h-3 text-gray-400" />
                {{ getArtistName(event.artistId) }}
              </span>
            </td>
            
            <!-- Date/Time -->
            <td class="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 text-xs">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 text-gray-400" />
                <span>{{ formatDate(event.dateTime) }}</span>
              </div>
            </td>
            
            <!-- Venue / City -->
            <td class="px-4 py-3">
              <div class="text-gray-900 dark:text-white font-medium truncate max-w-xs text-xs">{{ getVenueName(event) }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5">{{ getVenueCity(event) }}</div>
            </td>
            
            <!-- Status Badge -->
            <td class="px-4 py-3 text-center whitespace-nowrap">
              <UBadge
                :color="event.status === 'open' ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
                class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs uppercase"
              >
                {{ event.status === 'open' ? 'OPEN' : 'CLOSED' }}
              </UBadge>
            </td>
            
            <!-- Actions -->
            <td class="px-4 py-3 whitespace-nowrap text-right">
              <div class="flex items-center justify-end gap-1.5">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-ticket"
                  size="xs"
                  class="font-medium text-[11px]"
                  @click="openCategoryManager(event)"
                >
                  Kategori
                </UButton>
                
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :icon="event.status === 'open' ? 'i-lucide-pause-circle' : 'i-lucide-play-circle'"
                  :title="event.status === 'open' ? 'Tutup Penjualan' : 'Buka Penjualan'"
                  @click="toggleStatus(event)"
                />
                
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-edit-2"
                  size="xs"
                  @click="openEditModal(event)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="xs"
                  @click="deleteEvent(event.id!)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Event Form Modal Component -->
    <EventFormModal
      v-model:open="isModalOpen"
      :event-data="editingEvent"
      :artists="artists"
      :venues="venues"
      @saved="handleSaveEvent"
    />

    <!-- Category Manager Modal Component -->
    <CategoryManagerModal
      v-model:open="isCategoryModalOpen"
      :event-id="selectedEventForCategories?.id ?? ''"
      :event-title="selectedEventForCategories?.title"
    />
  </div>
</template>