<script setup lang="ts">
interface Concert {
  id: number
  name: string
  date: string
  venue: string
  ticketsSold: number
  capacity: number
  status: 'on-sale' | 'almost-sold-out' | 'sold-out' | 'draft'
}

const { data: concerts } = await useFetch<Concert[]>('/api/dummy/concert/concerts')

const search = ref('')

const filteredConcerts = computed(() => {
  if (!search.value.trim()) return concerts.value ?? []
  const query = search.value.toLowerCase()
  return (concerts.value ?? []).filter((c) =>
    c.name.toLowerCase().includes(query) || c.venue.toLowerCase().includes(query)
  )
})

const statusMap: Record<Concert['status'], { label: string; color: 'info' | 'warning' | 'success' | 'neutral' }> = {
  'on-sale': { label: 'On Sale', color: 'info' },
  'almost-sold-out': { label: 'Almost Sold Out', color: 'warning' },
  'sold-out': { label: 'Sold Out', color: 'success' },
  draft: { label: 'Draft', color: 'neutral' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function onDelete(concert: Concert) {
  // TODO: call DELETE /api/concerts/:id once the backend is ready
  concerts.value = (concerts.value ?? []).filter((c) => c.id !== concert.id)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <UInput
        v-model="search"
        placeholder="Search concerts or venues..."
        icon="i-lucide-search"
        class="w-full sm:w-72"
      />
      <UButton
        to="/concerts/create"
        icon="i-lucide-plus"
        class="bg-[#1B1330] hover:bg-[#2A1F49] text-white shrink-0"
      >
        Create Concert
      </UButton>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-gray-500">
            <th class="px-5 py-3 font-medium whitespace-nowrap">Concert</th>
            <th class="px-5 py-3 font-medium whitespace-nowrap">Date</th>
            <th class="px-5 py-3 font-medium whitespace-nowrap">Venue</th>
            <th class="px-5 py-3 font-medium whitespace-nowrap">Tickets Sold</th>
            <th class="px-5 py-3 font-medium whitespace-nowrap">Status</th>
            <th class="px-5 py-3 font-medium whitespace-nowrap text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="concert in filteredConcerts" :key="concert.id" class="hover:bg-gray-50">
            <td class="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">{{ concert.name }}</td>
            <td class="px-5 py-3.5 text-gray-600 whitespace-nowrap">{{ formatDate(concert.date) }}</td>
            <td class="px-5 py-3.5 text-gray-600 whitespace-nowrap">{{ concert.venue }}</td>
            <td class="px-5 py-3.5 text-gray-600 whitespace-nowrap">{{ concert.ticketsSold }} / {{ concert.capacity }}</td>
            <td class="px-5 py-3.5 whitespace-nowrap">
              <UBadge :color="statusMap[concert.status].color" variant="subtle">
                {{ statusMap[concert.status].label }}
              </UBadge>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  :to="`/concerts/${concert.id}/edit`"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit concert"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  aria-label="Delete concert"
                  @click="onDelete(concert)"
                />
              </div>
            </td>
          </tr>

          <tr v-if="!filteredConcerts.length">
            <td colspan="6" class="px-5 py-10 text-center text-gray-400">
              No concerts found.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>