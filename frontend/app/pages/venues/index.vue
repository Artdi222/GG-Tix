<script setup lang="ts">
interface Venue {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  imageUrl: string
}

const { data: venues } = await useFetch<Venue[]>('/api/venues')

const search = ref('')
const isFormOpen = ref(false)
const editingVenue = ref<Venue | null>(null)

const filteredVenues = computed(() => {
  if (!search.value.trim()) return venues.value ?? []
  const query = search.value.toLowerCase()
  return (venues.value ?? []).filter((v) =>
    v.name.toLowerCase().includes(query) || v.address.toLowerCase().includes(query)
  )
})

function openCreate() {
  editingVenue.value = null
  isFormOpen.value = true
}

function openEdit(venue: Venue) {
  editingVenue.value = venue
  isFormOpen.value = true
}

function onSaved(venue: Venue) {
  const list = venues.value ?? []
  const index = list.findIndex((v) => v.id === venue.id)
  if (index === -1) {
    venues.value = [venue, ...list]
  } else {
    venues.value = list.map((v) => (v.id === venue.id ? venue : v))
  }
}

async function onDelete(venue: Venue) {
  // TODO: call DELETE /api/venues/:id once the backend is ready
  venues.value = (venues.value ?? []).filter((v) => v.id !== venue.id)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <UInput
        v-model="search"
        placeholder="Search venues or addresses..."
        icon="i-lucide-search"
        class="w-full sm:w-72"
      />
      <UButton
        icon="i-lucide-plus"
        class="bg-[#1B1330] hover:bg-[#2A1F49] text-white shrink-0"
        @click="openCreate"
      >
        Add Venue
      </UButton>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="venue in filteredVenues"
        :key="venue.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden"
      >
        <div class="h-32 bg-gray-50 flex items-center justify-center">
          <img v-if="venue.imageUrl" :src="venue.imageUrl" :alt="venue.name" class="w-full h-full object-cover">
          <UIcon v-else name="i-lucide-image" class="w-6 h-6 text-gray-300" />
        </div>
        <div class="p-4">
          <p class="font-medium text-gray-900">{{ venue.name }}</p>
          <p class="text-sm text-gray-500 mt-0.5 line-clamp-2">{{ venue.address }}</p>
          <div class="flex items-center justify-end gap-1 mt-3">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Edit venue"
              @click="openEdit(venue)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Delete venue"
              @click="onDelete(venue)"
            />
          </div>
        </div>
      </div>

      <div v-if="!filteredVenues.length" class="col-span-full text-center text-gray-400 py-10">
        No venues found.
      </div>
    </div>

    <VenueFormModal
      v-model:open="isFormOpen"
      :venue="editingVenue"
      @saved="onSaved"
    />
  </div>
</template>