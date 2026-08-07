<script setup lang="ts">
import type { EventItem } from '~/components/EventFormModal.vue'

const { request } = useApi()

// Search & Filter state
const search = ref('')
const selectedCity = ref('ALL')
const selectedStatus = ref<'ALL' | 'open' | 'closed'>('ALL')

// Modal state
const isModalOpen = ref(false)
const editingEvent = ref<EventItem | null>(null)
const isLoading = ref(false)

// Artists list for select dropdown
const artists = ref<{ id: string; name: string }[]>([
  { id: 'art-001', name: 'Rover Ensemble' },
  { id: 'art-002', name: 'Coldplay' },
  { id: 'art-003', name: 'NIKI' },
  { id: 'art-004', name: 'Sheila on 7' }
])

// Events list matching BE contract
const events = ref<EventItem[]>([
  {
    id: 'evt-001',
    title: 'Wuthering Waves Live 2026',
    artistId: 'art-001',
    publisherName: 'Kuro Games',
    venue: 'Gelora Bung Karno',
    city: 'Jakarta',
    dateTime: '2026-10-12T19:00:00.000Z',
    status: 'open'
  },
  {
    id: 'evt-002',
    title: 'Coldplay Music of the Spheres',
    artistId: 'art-002',
    publisherName: 'PK Entertainment',
    venue: 'Stadion Utama GBK',
    city: 'Jakarta',
    dateTime: '2026-11-15T20:00:00.000Z',
    status: 'open'
  },
  {
    id: 'evt-003',
    title: 'NIKI Nicole World Tour',
    artistId: 'art-003',
    publisherName: '88rising',
    venue: 'Beach City International Stadium',
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
    // Keep mock data if BE is offline
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchEvents()
})

const cityOptions = [
  { label: 'Semua Kota', value: 'ALL' },
  { label: 'Jakarta', value: 'Jakarta' },
  { label: 'Bandung', value: 'Bandung' },
  { label: 'Surabaya', value: 'Surabaya' },
  { label: 'Bali', value: 'Bali' }
]

const statusOptions = [
  { label: 'Semua Status', value: 'ALL' },
  { label: 'Open (Aktif)', value: 'open' },
  { label: 'Closed (Tutup)', value: 'closed' }
]

const filteredEvents = computed(() => {
  return events.value.filter((e) => {
    const matchesSearch = !search.value || e.title.toLowerCase().includes(search.value.toLowerCase()) || e.venue.toLowerCase().includes(search.value.toLowerCase())
    const matchesCity = selectedCity.value === 'ALL' || e.city === selectedCity.value
    const matchesStatus = selectedStatus.value === 'ALL' || e.status === selectedStatus.value
    return matchesSearch && matchesCity && matchesStatus
  })
})

function openCreateModal() {
  editingEvent.value = null
  isModalOpen.value = true
}

function openEditModal(event: EventItem) {
  editingEvent.value = event
  isModalOpen.value = true
}

async function handleSaveEvent(saved: EventItem) {
  try {
    if (saved.id) {
      // PUT /api/events/:id
      await request(`/events/${saved.id}`, { method: 'PUT', body: saved })
      const idx = events.value.findIndex(e => e.id === saved.id)
      if (idx !== -1) events.value[idx] = saved
    } else {
      // POST /api/events
      const res = await request<{ data: EventItem }>('/events', { method: 'POST', body: saved })
      events.value.unshift(res.data || { ...saved, id: `evt-${Date.now()}` })
    }
  } catch {
    // Fallback local update
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
  <div class="space-y-6">
    <!-- Header Page -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Event Konser
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola daftar konser, venue, tanggal, dan status penjualan tiket (/api/events)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="md"
        class="font-semibold shadow-sm"
        @click="openCreateModal"
      >
        Tambah Event
      </UButton>
    </div>

    <!-- Filters Bar -->
    <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
      <div class="flex-1 w-full">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari nama event atau venue..."
          size="md"
          class="w-full"
        />
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <USelect
          v-model="selectedCity"
          :items="cityOptions"
          size="md"
          class="w-full sm:w-40"
        />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          size="md"
          class="w-full sm:w-40"
        />
      </div>
    </div>

    <!-- Events Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
      >
        <div class="p-6 space-y-4">
          <!-- Card Header & Status Badge -->
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {{ event.publisherName }}
              </span>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white mt-0.5 leading-snug">
                {{ event.title }}
              </h3>
            </div>

            <UBadge
              :color="event.status === 'open' ? 'success' : 'neutral'"
              variant="soft"
              size="xs"
              class="font-bold px-2 py-0.5 shrink-0"
            >
              {{ event.status === 'open' ? 'OPEN' : 'CLOSED' }}
            </UBadge>
          </div>

          <!-- Event Info Details -->
          <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400 shrink-0" />
              <span>{{ formatDate(event.dateTime) }}</span>
            </div>

            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-map-pin" class="w-4 h-4 text-gray-400 shrink-0" />
              <span class="truncate">{{ event.venue }}, {{ event.city }}</span>
            </div>
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div class="p-4 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="event.status === 'open' ? 'i-lucide-pause-circle' : 'i-lucide-play-circle'"
            @click="toggleStatus(event)"
          >
            {{ event.status === 'open' ? 'Tutup Sale' : 'Buka Sale' }}
          </UButton>

          <div class="flex items-center gap-1">
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
        </div>
      </div>
    </div>

    <!-- Event Form Modal Component -->
    <EventFormModal
      v-model:open="isModalOpen"
      :event-data="editingEvent"
      :artists="artists"
      @saved="handleSaveEvent"
    />
  </div>
</template>
