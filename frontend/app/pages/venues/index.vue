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
    // Keep empty if BE offline
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
    (v) => v.name.toLowerCase().includes(query) || v.address.toLowerCase().includes(query)
  )
})

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
  } catch {
    venuesList.value = venuesList.value.filter((v) => v.id !== id)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Master Venue & Lokasi Konser
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola master gedung, stadium, denah area, dan koordinat lokasi (/api/venues)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="md"
        class="font-semibold shadow-sm"
        @click="openCreateModal"
      >
        Tambah Venue
      </UButton>
    </div>

    <!-- Search Bar -->
    <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari nama venue atau alamat..."
        size="md"
        class="w-full sm:w-80"
      />
    </div>

    <!-- Venues Table -->
    <div class="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">
          <tr>
            <th scope="col" class="px-6 py-4">Denah / Visual</th>
            <th scope="col" class="px-6 py-4">Nama Venue</th>
            <th scope="col" class="px-6 py-4">Alamat Lengkap</th>
            <th scope="col" class="px-6 py-4">Kota</th>
            <th scope="col" class="px-6 py-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
          <tr v-if="filteredVenues.length === 0">
            <td colspan="5" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
              Tidak ada venue yang ditemukan.
            </td>
          </tr>
          <tr
            v-for="v in filteredVenues"
            :key="v.id"
            class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
          >
            <!-- Denah preview -->
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="w-12 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                <img v-if="v.imageUrl" :src="v.imageUrl" :alt="v.name" class="w-full h-full object-cover">
                <UIcon v-else name="i-lucide-map" class="w-5 h-5 text-gray-400" />
              </div>
            </td>

            <!-- Nama -->
            <td class="px-6 py-4">
              <div class="font-bold text-gray-900 dark:text-white">{{ v.name }}</div>
            </td>

            <!-- Alamat -->
            <td class="px-6 py-4">
              <div class="text-gray-600 dark:text-gray-300 max-w-sm line-clamp-2">{{ v.address }}</div>
            </td>

            <!-- Kota -->
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-full text-xs font-medium">
                {{ v.city }}
              </span>
            </td>

            <!-- Aksi -->
            <td class="px-6 py-4 whitespace-nowrap text-right">
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
