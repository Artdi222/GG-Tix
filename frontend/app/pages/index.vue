<script setup lang="ts">
interface DashboardStats {
  totalEvents: number
  ticketsSold: number
  revenue: number
  upcomingShows: number
}

interface UpcomingShow {
  id: number
  name: string
  date: string
  venue: string
  ticketsSold: number
  capacity: number
}

const { data: stats } = await useFetch<DashboardStats>('/api/dashboard/stats')
const { data: upcomingShows } = await useFetch<UpcomingShow[]>('/api/dashboard/upcoming')

const statCards = computed(() => [
  { label: 'Total Events', value: stats.value?.totalEvents ?? 0, icon: 'i-lucide-calendar' },
  { label: 'Tickets Sold', value: stats.value?.ticketsSold ?? 0, icon: 'i-lucide-ticket' },
  { label: 'Revenue', value: stats.value?.revenue ?? 0, icon: 'i-lucide-banknote', isCurrency: true },
  { label: 'Upcoming Shows', value: stats.value?.upcomingShows ?? 0, icon: 'i-lucide-clock' }
])

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function soldPercentage(show: UpcomingShow) {
  return Math.round((show.ticketsSold / show.capacity) * 100)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="bg-white rounded-xl border border-gray-200 p-5"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">{{ card.label }}</span>
          <div class="w-9 h-9 rounded-lg bg-[#1B1330]/5 flex items-center justify-center">
            <UIcon :name="card.icon" class="w-5 h-5 text-[#1B1330]" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-semibold text-gray-900">
          {{ card.isCurrency ? formatCurrency(card.value) : card.value.toLocaleString('en-US') }}
        </p>
      </div>
    </div>

    <!-- Upcoming shows -->
    <div class="bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="font-medium text-gray-900">Upcoming Shows</h2>
        <NuxtLink to="/concerts" class="text-sm text-[#1B1330] hover:underline">
          View all
        </NuxtLink>
      </div>

      <div class="divide-y divide-gray-100">
        <div
          v-for="show in upcomingShows"
          :key="show.id"
          class="px-5 py-4 flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <p class="font-medium text-gray-900 truncate">{{ show.name }}</p>
            <p class="text-sm text-gray-500">{{ formatDate(show.date) }} · {{ show.venue }}</p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <div class="w-28 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                class="h-full bg-[#F2A93B]"
                :style="{ width: soldPercentage(show) + '%' }"
              />
            </div>
            <span class="text-sm text-gray-500 w-10 text-right">{{ soldPercentage(show) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>