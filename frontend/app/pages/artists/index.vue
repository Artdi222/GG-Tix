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
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Artis & Performer
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Daftar musisi, band, dan pengisi acara konser (/api/artists)
        </p>
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus-circle"
        size="md"
        class="font-semibold shadow-sm"
        @click="openCreateModal"
      >
        Tambah Artis
      </UButton>
    </div>

    <!-- Search bar -->
    <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari nama artis..."
        size="md"
        class="w-full sm:w-80"
      />
    </div>

    <!-- Artist list grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="artist in filteredArtists"
        :key="artist.id"
        class="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-start gap-4"
      >
        <UAvatar
          :src="artist.photoUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'"
          :alt="artist.name"
          size="xl"
          class="shrink-0 ring-2 ring-amber-500/20"
        />

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-bold text-gray-900 dark:text-white truncate">{{ artist.name }}</h3>
            <div class="flex items-center gap-1 shrink-0">
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
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {{ artist.bio || 'Tidak ada deskripsi bio.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Modal Form Artist -->
    <UModal v-model:open="isModalOpen" :title="editingArtist ? 'Edit Artis' : 'Tambah Artis Baru'">
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="uploadError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="uploadError"
          />

          <UFormField label="Nama Artis / Band" required>
            <UInput v-model="formState.name" placeholder="Contoh: Coldplay" class="w-full" />
          </UFormField>

          <UFormField label="Foto Profil Artis (Rasio 1:1)">
            <div class="flex items-center gap-4 mb-2">
              <UAvatar
                :src="formState.photoUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'"
                size="lg"
                class="shrink-0 ring-2 ring-amber-500/20"
              />
              <div class="space-y-1">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
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
                <p class="text-xs text-gray-400">PNG, JPG, atau WebP (Maksimal 10 MB). Di-crop 1:1.</p>
              </div>
            </div>
            <UInput v-model="formState.photoUrl" placeholder="Atau masukkan URL foto manual (https://...)" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Deskripsi Bio">
            <UTextarea v-model="formState.bio" placeholder="Bio singkat artis..." class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="isModalOpen = false">Batal</UButton>
          <UButton color="primary" @click="handleSaveArtist">Simpan</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
