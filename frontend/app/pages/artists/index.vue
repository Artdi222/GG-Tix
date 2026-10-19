<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Artist } from '~/components/ArtistFormModal.vue'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Artis' })

const { request } = useApi()
const toast = useToast()
const confirm = useConfirm()

const list = usePaginatedList<Artist>('/artists', { searchParam: 'q' })
const formOpen = ref(false)
const editing = ref<Artist | null>(null)
const busy = ref<string | null>(null)

function openForm(a: Artist | null) {
  editing.value = a
  formOpen.value = true
}

async function remove(a: Artist) {
  const ok = await confirm({ title: `Hapus ${a.name}?`, description: 'Artis yang masih memiliki event tidak dapat dihapus.', confirmLabel: 'Hapus artis', danger: true })
  if (!ok) return
  busy.value = a.id
  try {
    await request(`/artists/${a.id}`, { method: 'DELETE' })
    toast.add({ title: 'Artis dihapus', color: 'success' })
    await list.refresh()
  } catch (err) {
    toast.add({ title: 'Artis tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = null
  }
}

const columns: TableColumn<Artist>[] = [
  { accessorKey: 'name', header: 'Artis' },
  { accessorKey: 'createdAt', header: 'Ditambahkan' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel id="artists">
    <template #header>
      <UDashboardNavbar title="Artis">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Tambah artis"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UInput
          v-model="list.search.value"
          icon="i-lucide-search"
          placeholder="Cari nama artis…"
          class="w-full sm:w-72"
          aria-label="Cari artis"
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
          class="min-h-64"
          :ui="{ th: 'text-xs font-medium text-muted', td: 'py-3' }"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar
                :src="row.original.photoUrl ?? undefined"
                :alt="row.original.name"
                size="md"
              />
              <div class="min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ row.original.name }}
                </p>
                <p class="text-xs text-muted truncate max-w-xl">
                  {{ row.original.bio || 'Belum ada bio' }}
                </p>
              </div>
            </div>
          </template>
          <template #createdAt-cell="{ row }">
            <span class="text-muted whitespace-nowrap">{{ formatDate(row.original.createdAt) }}</span>
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
            <UEmpty
              icon="i-lucide-mic-vocal"
              :title="list.search.value ? 'Tidak ada artis yang cocok' : 'Belum ada artis'"
              :description="list.search.value ? 'Ubah kata kunci pencarian.' : 'Tambahkan artis sebelum membuat event.'"
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
      <ArtistFormModal
        v-model:open="formOpen"
        :artist="editing"
        @saved="list.refresh()"
      />
    </template>
  </UDashboardPanel>
</template>
