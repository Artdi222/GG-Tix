<script setup lang="ts">
import type { Venue } from '~/components/VenueFormModal.vue'

const { request } = useApi()

const search = ref('')
const venuesList = ref<Venue[]>([])

const isLoading = ref(false)
const isModalOpen = ref(false)
const editingVenue = ref<Venue | null>(null)

async function fetchVenues() {
  isLoading.value = true
  try {
    const res = await request<{ data: Venue[] }>('/venues')
    if (res?.data) {
      venuesList.value = res.data
    }
  } catch {
    // Fallback
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchVenues()
})

const filteredVenues = computed(() => {
  if (!search.value) return venuesList.value
  const query = search.value.toLowerCase()
  return venuesList.value.filter(
    (v) => v.name.toLowerCase().includes(query) || v.address.toLowerCase().includes(query) || (v.city && v.city.toLowerCase().includes(query))
  )
})

// KPI Stats Computations
const totalVenuesCount = computed(() => venuesList.value.length)
const withMapCount = computed(() => venuesList.value.filter(v => !!v.imageUrl).length)
const citiesCount = computed(() => new Set(venuesList.value.map(v => v.city || 'Jakarta')).size)

function openCreateModal() {
  editingVenue.value = null
  isModalOpen.value = true
}

function openEditModal(venue: Venue) {
  editingVenue.value = venue
  isModalOpen.value = true
}

function handleSavedVenue(saved: Venue) {
  const idx = venuesList.value.findIndex((v) => v.id === saved.id)
  if (idx !== -1) {
    venuesList.value[idx] = saved
  } else {
    venuesList.value.unshift(saved)
  }
}

async function deleteVenue(id?: string) {
  if (!id) return
  if (!confirm('Apakah Anda yakin ingin menghapus venue ini?')) return

  try {
    await request(`/venues/${id}`, { method: 'DELETE' })
    venuesList.value = venuesList.value.filter((v) => v.id !== id)
  } catch (err: any) {
    alert(err?.data?.error || err?.data?.message || err?.message || 'Gagal menghapus venue.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Master Venue & Lokasi Konser
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola master gedung, stadium, denah area, dan lokasi kota (/api/venues)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="sm"
        class="font-medium text-xs shadow-xs"
        @click="openCreateModal"
      >
        Tambah Venue
      </UButton>
    </div>

    <!-- Stats KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Master Venue</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ totalVenuesCount }}</h3>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-map-pin" class="w-3 h-3" />
            Lokasi konser terdaftar
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-building-2" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Denah Area Terpasang</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ withMapCount }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-check-circle" class="w-3 h-3" />
            Visual layout 9:16
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-map" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cakupan Kota</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ citiesCount }} Kota</h3>
          <p class="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-navigation" class="w-3 h-3" />
            Sebaran lokasi acara
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <UIcon name="i-lucide-globe" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari nama venue, alamat, atau kota..."
        size="sm"
        class="w-full sm:w-72 text-xs"
      />
    </div>

    <!-- Venues Table -->
    <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th scope="col" class="px-4 py-3">Denah / Visual</th>
            <th scope="col" class="px-4 py-3">Nama Venue</th>
            <th scope="col" class="px-4 py-3">Alamat Lengkap</th>
            <th scope="col" class="px-4 py-3">Kota</th>
            <th scope="col" class="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
          <tr v-if="isLoading">
            <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-xs">
              <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
              Memuat data venue...
            </td>
          </tr>
          <tr v-else-if="filteredVenues.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              Tidak ada venue yang ditemukan.
            </td>
          </tr>
          <tr
            v-for="v in filteredVenues"
            :key="v.id"
            class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
          >
            <!-- Denah preview -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="w-9 h-12 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                <img v-if="v.imageUrl" :src="v.imageUrl" :alt="v.name" class="w-full h-full object-cover">
                <UIcon v-else name="i-lucide-map" class="w-4 h-4 text-gray-400" />
              </div>
            </td>

            <!-- Nama -->
            <td class="px-4 py-3">
              <div class="font-semibold text-xs text-gray-900 dark:text-white">{{ v.name }}</div>
            </td>

            <!-- Alamat -->
            <td class="px-4 py-3">
              <div class="text-gray-600 dark:text-gray-300 max-w-sm line-clamp-2 text-xs">{{ v.address }}</div>
            </td>

            <!-- Kota -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-md text-[11px] font-medium">
                {{ v.city || 'Jakarta' }}
              </span>
            </td>

            <!-- Aksi -->
            <td class="px-4 py-3 whitespace-nowrap text-right">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-edit-2"
                  size="xs"
                  @click="openEditModal(v)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="xs"
                  @click="deleteVenue(v.id)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Venue Modal Form -->
    <VenueFormModal
      v-model:open="isModalOpen"
      :venue="editingVenue"
      @saved="handleSavedVenue"
    />
  </div>
</template>
