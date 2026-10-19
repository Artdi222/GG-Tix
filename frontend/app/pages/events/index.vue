<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { EventRow, Option } from '~/components/EventFormModal.vue'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Event' })

const { request } = useApi()
const toast = useToast()
const confirm = useConfirm()

const status = ref<'all' | 'open' | 'closed'>('all')
const list = usePaginatedList<EventRow>('/events', {
  searchParam: 'search',
  query: () => ({ status: status.value === 'all' ? undefined : status.value })
})

const artists = ref<Option[]>([])
const venues = ref<Option[]>([])
const optionsError = ref('')
async function loadOptions() {
  optionsError.value = ''
  try {
    const [a, v] = await Promise.all([
      request<{ data: { id: string, name: string }[] }>('/artists', { query: { limit: 100 } }),
      request<{ data: { id: string, name: string, city: string }[] }>('/venues', { query: { limit: 100 } })
    ])
    artists.value = a.data.map(x => ({ label: x.name, value: x.id }))
    venues.value = v.data.map(x => ({ label: `${x.name} — ${x.city}`, value: x.id }))
  } catch (err) {
    optionsError.value = apiErrorMessage(err, 'Daftar artis dan venue gagal dimuat; form event tidak bisa dipakai.')
  }
}
onMounted(loadOptions)

const formOpen = ref(false)
const editing = ref<EventRow | null>(null)
const categoriesFor = ref<EventRow | null>(null)
const categoriesOpen = ref(false)
const busy = ref<string | null>(null)

function openForm(event: EventRow | null) {
  editing.value = event
  formOpen.value = true
}

async function toggleStatus(event: EventRow) {
  const next = event.status === 'open' ? 'closed' : 'open'
  const ok = await confirm(next === 'closed'
    ? { title: 'Tutup penjualan?', description: `Pelanggan tidak bisa lagi membeli tiket "${event.title}". Tiket yang sudah terjual tetap berlaku.`, confirmLabel: 'Tutup penjualan', danger: true }
    : { title: 'Buka penjualan?', description: `Tiket "${event.title}" akan bisa dibeli di aplikasi.`, confirmLabel: 'Buka penjualan' })
  if (!ok) return
  busy.value = event.id
  try {
    await request(`/events/${event.id}/status`, { method: 'PATCH', body: { status: next } })
    event.status = next
    toast.add({ title: next === 'open' ? 'Penjualan dibuka' : 'Penjualan ditutup', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Status gagal diubah', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

async function remove(event: EventRow) {
  const ok = await confirm({
    title: `Hapus "${event.title}"?`,
    description: 'Event beserta kategori tiketnya akan dihapus permanen. Event yang sudah memiliki pesanan tidak bisa dihapus — tutup penjualannya saja.',
    confirmLabel: 'Hapus event',
    danger: true
  })
  if (!ok) return
  busy.value = event.id
  try {
    await request(`/events/${event.id}`, { method: 'DELETE' })
    toast.add({ title: 'Event dihapus', color: 'success' })
    await list.refresh()
  } catch (err) {
    toast.add({ title: 'Event tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

function openCategories(event: EventRow) {
  categoriesFor.value = event
  categoriesOpen.value = true
}

function rowActions(event: EventRow): DropdownMenuItem[][] {
  return [
    [
      { label: 'Edit event', icon: 'i-lucide-pencil', onSelect: () => openForm(event) },
      { label: 'Kategori tiket', icon: 'i-lucide-tags', onSelect: () => openCategories(event) }
    ],
    [
      event.status === 'open'
        ? { label: 'Tutup penjualan', icon: 'i-lucide-lock', onSelect: () => toggleStatus(event) }
        : { label: 'Buka penjualan', icon: 'i-lucide-lock-open', onSelect: () => toggleStatus(event) }
    ],
    [{ label: 'Hapus', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(event) }]
  ]
}

const columns: TableColumn<EventRow>[] = [
  { accessorKey: 'title', header: 'Event' },
  { accessorKey: 'dateTime', header: 'Jadwal' },
  { accessorKey: 'venue', header: 'Venue' },
  { id: 'sales', header: 'Tiket terjual' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: '' }
]

const isPast = (iso: string) => Date.parse(iso) < Date.now()
const soldPct = (e: EventRow) => e.capacity ? Math.round(((e.sold ?? 0) / e.capacity) * 100) : 0
const filtered = computed(() => !!list.search.value || status.value !== 'all')
</script>

<template>
  <UDashboardPanel id="events">
    <template #header>
      <UDashboardNavbar title="Event">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Buat event"
            :disabled="!!optionsError"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="list.search.value"
            icon="i-lucide-search"
            placeholder="Cari judul event…"
            class="w-full sm:w-72"
            aria-label="Cari event"
          />
        </template>
        <template #right>
          <USelect
            v-model="status"
            :items="[{ label: 'Semua status', value: 'all' }, { label: 'Dibuka', value: 'open' }, { label: 'Ditutup', value: 'closed' }]"
            class="w-36"
            aria-label="Filter status"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="optionsError"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="optionsError"
        :actions="[{ label: 'Coba lagi', color: 'warning', variant: 'outline', onClick: loadOptions }]"
      />
      <UAlert
        v-if="list.error.value"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="list.error.value"
        :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: () => list.refresh() }]"
      />

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          :data="list.items.value"
          :columns="columns"
          :loading="list.loading.value"
          :ui="{ th: 'text-xs font-medium text-muted', td: 'py-3' }"
        >
          <template #title-cell="{ row }">
            <div class="flex items-center gap-3 min-w-0">
              <EventCover
                :title="row.original.title"
                :src="row.original.imageUrl"
                class="w-16 aspect-video shrink-0"
              />
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate max-w-72">
                  {{ row.original.title }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ row.original.artist?.name ?? '—' }} · {{ row.original.publisherName }}
                </p>
              </div>
            </div>
          </template>
          <template #dateTime-cell="{ row }">
            <p class="text-highlighted whitespace-nowrap">
              {{ formatDateTime(row.original.dateTime) }}
            </p>
            <p
              v-if="isPast(row.original.dateTime)"
              class="text-xs text-dimmed"
            >
              Sudah berlangsung
            </p>
          </template>
          <template #venue-cell="{ row }">
            <p class="text-highlighted truncate max-w-48">
              {{ row.original.venue?.name ?? '—' }}
            </p>
            <p class="text-xs text-muted">
              {{ row.original.venue?.city }}
            </p>
          </template>
          <template #sales-cell="{ row }">
            <div
              v-if="row.original.capacity"
              class="w-40"
            >
              <div class="flex items-baseline justify-between text-xs tabular-nums">
                <span class="font-medium text-highlighted">{{ formatNumber(row.original.sold) }}<span class="font-normal text-dimmed"> / {{ formatNumber(row.original.capacity) }}</span></span>
                <span class="text-muted">{{ soldPct(row.original) }}%</span>
              </div>
              <UProgress
                :model-value="soldPct(row.original)"
                :color="soldPct(row.original) >= 90 ? 'error' : soldPct(row.original) >= 60 ? 'warning' : 'primary'"
                size="xs"
                class="mt-1.5"
              />
            </div>
            <span
              v-else
              class="text-xs text-dimmed"
            >Belum ada kategori</span>
          </template>
          <template #status-cell="{ row }">
            <StatusBadge :status="row.original.status" />
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UDropdownMenu
                :items="rowActions(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-lucide-ellipsis"
                  color="neutral"
                  variant="ghost"
                  :loading="busy === row.original.id"
                  :aria-label="`Aksi untuk ${row.original.title}`"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #empty>
            <div
              v-if="list.loading.value"
              class="space-y-3 p-4"
            >
              <USkeleton
                v-for="i in 5"
                :key="i"
                class="h-9 w-full"
              />
            </div>
            <UEmpty
              v-else
              icon="i-lucide-calendar-days"
              :title="filtered ? 'Tidak ada event yang cocok' : 'Belum ada event'"
              :description="filtered ? 'Ubah kata kunci atau filter.' : 'Buat event pertama, lalu tambahkan kategori tiketnya.'"
              :actions="filtered ? undefined : [{ label: 'Buat event', icon: 'i-lucide-plus', onClick: () => openForm(null) }]"
              variant="naked"
            />
          </template>
        </UTable>
      </UCard>

      <div
        v-if="list.totalPages.value > 1"
        class="flex items-center justify-between gap-3"
      >
        <p class="text-sm text-muted tabular-nums">
          {{ formatNumber(list.totalCount.value) }} event
        </p>
        <UPagination
          v-model:page="list.page.value"
          :total="list.totalCount.value"
          :items-per-page="list.limit"
        />
      </div>

      <EventFormModal
        v-model:open="formOpen"
        :event-data="editing"
        :artists="artists"
        :venues="venues"
        @saved="list.refresh()"
      />
      <CategoryManagerModal
        v-if="categoriesFor"
        v-model:open="categoriesOpen"
        :event-id="categoriesFor.id"
        :event-title="categoriesFor.title"
      />
    </template>
  </UDashboardPanel>
</template>
