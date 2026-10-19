<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Venue } from '~/components/VenueFormModal.vue'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Venue' })

const { request } = useApi()
const toast = useToast()
const confirm = useConfirm()

const list = usePaginatedList<Venue>('/venues', { searchParam: 'q' })
const formOpen = ref(false)
const editing = ref<Venue | null>(null)
const busy = ref<string | null>(null)

function openForm(v: Venue | null) {
  editing.value = v
  formOpen.value = true
}

async function remove(v: Venue) {
  const ok = await confirm({ title: `Hapus ${v.name}?`, description: 'Venue yang masih dipakai event tidak dapat dihapus.', confirmLabel: 'Hapus venue', danger: true })
  if (!ok) return
  busy.value = v.id
  try {
    await request(`/venues/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Venue dihapus', color: 'success' })
    await list.refresh()
  } catch (err) {
    toast.add({ title: 'Venue tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

const columns: TableColumn<Venue>[] = [
  { accessorKey: 'name', header: 'Venue' },
  { accessorKey: 'city', header: 'Kota' },
  { accessorKey: 'sortOrder', header: 'Urutan' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel id="venues">
    <template #header>
      <UDashboardNavbar title="Venue">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Tambah venue"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UInput
          v-model="list.search.value"
          icon="i-lucide-search"
          placeholder="Cari nama, alamat, atau kota…"
          class="w-full sm:w-72"
          aria-label="Cari venue"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="list.error.value"
        color="error"
        variant="subtle"
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
          <template #name-cell="{ row }">
            <div class="flex items-center gap-3 min-w-0">
              <div class="size-10 shrink-0 overflow-hidden rounded-md bg-elevated border border-default grid place-items-center">
                <img
                  v-if="row.original.imageUrl"
                  :src="row.original.imageUrl"
                  alt=""
                  class="size-full object-cover"
                  loading="lazy"
                >
                <UIcon
                  v-else
                  name="i-lucide-map-pin"
                  class="size-4 text-dimmed"
                />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ row.original.name }}
                </p>
                <p class="text-xs text-muted truncate max-w-md">
                  {{ row.original.address }}
                </p>
              </div>
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                :aria-label="`Edit ${row.original.name}`"
                @click="openForm(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :loading="busy === row.original.id"
                :aria-label="`Hapus ${row.original.name}`"
                @click="remove(row.original)"
              />
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
              icon="i-lucide-map-pin"
              :title="list.search.value ? 'Tidak ada venue yang cocok' : 'Belum ada venue'"
              :description="list.search.value ? 'Ubah kata kunci pencarian.' : 'Tambahkan venue sebelum membuat event.'"
              variant="naked"
            />
          </template>
        </UTable>
      </UCard>
      <div
        v-if="list.totalPages.value > 1"
        class="flex justify-end"
      >
        <UPagination
          v-model:page="list.page.value"
          :total="list.totalCount.value"
          :items-per-page="list.limit"
        />
      </div>
      <VenueFormModal
        v-model:open="formOpen"
        :venue="editing"
        @saved="list.refresh()"
      />
    </template>
  </UDashboardPanel>
</template>
