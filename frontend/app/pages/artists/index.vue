<script setup lang="ts">
interface Artist {
  id: string
  name: string
  bio?: string
  photoUrl?: string
  createdAt?: string
}

const { request } = useApi()

const search = ref('')
const artists = ref<Artist[]>([
  {
    id: 'art-001',
    name: 'Rover Ensemble',
    bio: 'Official orchestra ensemble performing Wuthering Waves live concert soundtracks.',
    photoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'
  },
  {
    id: 'art-002',
    name: 'Coldplay',
    bio: 'British rock band formed in London in 1997.',
    photoUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300'
  },
  {
    id: 'art-003',
    name: 'NIKI',
    bio: 'Indonesian singer, songwriter, and record producer based in the US.',
    photoUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300'
  }
])

const isLoading = ref(false)
const isModalOpen = ref(false)
const isUploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const editingArtist = ref<Artist | null>(null)

const formState = reactive({
  name: '',
  bio: '',
  photoUrl: ''
})

async function fetchArtists() {
  isLoading.value = true
  try {
    const res = await request<{ data: Artist[] }>('/artists')
    if (res?.data) {
      artists.value = res.data
    }
  } catch {
    // Keep mock data if BE offline
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchArtists()
})

const filteredArtists = computed(() => {
  if (!search.value) return artists.value
  return artists.value.filter(a => a.name.toLowerCase().includes(search.value.toLowerCase()))
})

// KPI Stats Computations
const totalArtistsCount = computed(() => artists.value.length)
const withPhotoCount = computed(() => artists.value.filter(a => !!a.photoUrl).length)

function openCreateModal() {
  editingArtist.value = null
  formState.name = ''
  formState.bio = ''
  formState.photoUrl = ''
  uploadError.value = ''
  isModalOpen.value = true
}

function openEditModal(artist: Artist) {
  editingArtist.value = artist
  formState.name = artist.name
  formState.bio = artist.bio || ''
  formState.photoUrl = artist.photoUrl || ''
  uploadError.value = ''
  isModalOpen.value = true
}

async function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadError.value = ''
  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'profile') // UPL-03: profile 1:1 ratio

    const res = await request<{ data: { url: string; thumbUrl: string; key: string } }>('/uploads', {
      method: 'POST',
      body: formData
    })

    if (res?.data?.url) {
      formState.photoUrl = res.data.url
    }
  } catch (err: any) {
    uploadError.value = err?.data?.error || 'Gagal mengunggah foto profil artis.'
  } finally {
    isUploading.value = false
  }
}

async function handleSaveArtist() {
  if (!formState.name) return
  const targetId = editingArtist.value?.id
  try {
    if (targetId) {
      await request(`/artists/${targetId}`, { method: 'PUT', body: formState })
      const idx = artists.value.findIndex(a => a.id === targetId)
      if (idx !== -1) {
        artists.value[idx] = { id: targetId, ...artists.value[idx], ...formState }
      }
    } else {
      const res = await request<{ data: Artist }>('/artists', { method: 'POST', body: formState })
      artists.value.unshift(res.data || { id: `art-${Date.now()}`, ...formState })
    }
    isModalOpen.value = false
  } catch {
    if (targetId) {
      const idx = artists.value.findIndex(a => a.id === targetId)
      if (idx !== -1) {
        artists.value[idx] = { id: targetId, ...artists.value[idx], ...formState }
      }
    } else {
      artists.value.unshift({ id: `art-${Date.now()}`, ...formState })
    }
    isModalOpen.value = false
  }
}

async function deleteArtist(id: string) {
  if (!confirm('Hapus artist ini?')) return
  try {
    await request(`/artists/${id}`, { method: 'DELETE' })
    artists.value = artists.value.filter(a => a.id !== id)
  } catch {
    artists.value = artists.value.filter(a => a.id !== id)
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Artis & Performer
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Daftar musisi, band, dan pengisi acara konser (/api/artists)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="sm"
        class="font-medium text-xs shadow-xs"
        @click="openCreateModal"
      >
        Tambah Artis
      </UButton>
    </div>

    <!-- Stats KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Artis / Performer</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ totalArtistsCount }}</h3>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-mic" class="w-3 h-3" />
            Pengisi acara konser
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-music" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Foto Profil Terpasang</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ withPhotoCount }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-check-circle" class="w-3 h-3" />
            Visual siap pakai
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-image" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Search bar -->
    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari nama artis..."
        size="sm"
        class="w-full sm:w-64 text-xs"
      />
    </div>

    <!-- Artist List Table (Responsive) -->
    <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th scope="col" class="px-4 py-3">Foto & Nama Artis</th>
            <th scope="col" class="px-4 py-3">Deskripsi Bio</th>
            <th scope="col" class="px-4 py-3">Status Visual</th>
            <th scope="col" class="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
          <tr v-if="isLoading">
            <td colspan="4" class="px-4 py-8 text-center text-gray-400 text-xs">
              <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
              Memuat data artis...
            </td>
          </tr>
          <tr v-else-if="filteredArtists.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              Tidak ada artis yang ditemukan.
            </td>
          </tr>
          <tr
            v-for="artist in filteredArtists"
            :key="artist.id"
            class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
          >
            <!-- Foto & Nama -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div class="flex items-center gap-2.5">
                <UAvatar
                  :src="artist.photoUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'"
                  :alt="artist.name"
                  size="sm"
                  class="ring-1 ring-amber-500/20"
                />
                <div class="font-semibold text-xs text-gray-900 dark:text-white">{{ artist.name }}</div>
              </div>
            </td>

            <!-- Bio -->
            <td class="px-4 py-3">
              <div class="text-gray-600 dark:text-gray-300 max-w-md line-clamp-2 text-xs">
                {{ artist.bio || 'Tidak ada deskripsi bio.' }}
              </div>
            </td>

            <!-- Status Visual -->
            <td class="px-4 py-3 whitespace-nowrap">
              <UBadge
                :color="artist.photoUrl ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
                class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs"
              >
                {{ artist.photoUrl ? 'Foto Terpasang' : 'Foto Default' }}
              </UBadge>
            </td>

            <!-- Aksi -->
            <td class="px-4 py-3 whitespace-nowrap text-right">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-edit-2"
                  size="xs"
                  @click="openEditModal(artist)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="xs"
                  @click="deleteArtist(artist.id)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Form Artist -->
    <UModal v-model:open="isModalOpen" :title="editingArtist ? 'Edit Artis' : 'Tambah Artis Baru'">
      <template #body>
        <div class="space-y-3.5 text-xs">
          <UAlert
            v-if="uploadError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="uploadError"
          />

          <UFormField label="Nama Artis / Band" required>
            <UInput v-model="formState.name" placeholder="Contoh: Coldplay" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Foto Profil Artis (Rasio 1:1)">
            <div class="flex items-center gap-3 mb-2">
              <UAvatar
                :src="formState.photoUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'"
                size="md"
                class="shrink-0 ring-1 ring-amber-500/20"
              />
              <div class="space-y-0.5">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  icon="i-lucide-upload"
                  :loading="isUploading"
                  @click="fileInput?.click()"
                >
                  {{ formState.photoUrl ? 'Ganti Foto' : 'Upload Foto' }}
                </UButton>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="onImageSelected"
                >
                <p class="text-[11px] text-gray-400">PNG, JPG, WebP (Maks 10MB). Rasio 1:1.</p>
              </div>
            </div>
            <UInput v-model="formState.photoUrl" placeholder="Atau URL foto (https://...)" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Deskripsi Bio">
            <UTextarea v-model="formState.bio" placeholder="Bio singkat artis..." size="sm" class="w-full text-xs" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" size="sm" @click="isModalOpen = false">Batal</UButton>
          <UButton color="primary" size="sm" @click="handleSaveArtist">Simpan</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
