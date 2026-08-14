<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

export interface EventItem {
  id?: string
  title: string
  artistId: string
  publisherName: string
  venueId: string
  dateTime: string
  endDateTime?: string | null
  description?: string | null
  maxTicketsPerOrder?: number
  tags?: string[]
  seatmapUrl?: string | null
  sortOrder?: number
  status: 'open' | 'closed'
  imageUrl?: string | null
}

interface VenueOption {
  id: string
  name: string
  city: string
  imageUrl?: string | null
}

const props = defineProps<{
  eventData?: EventItem | null
  artists?: ArtistOption[]
  venues?: VenueOption[]
}>()

const emit = defineEmits<{
  saved: [eventData: EventItem]
}>()

const { request } = useApi()

const open = defineModel<boolean>('open', { default: false })

const isEditMode = computed(() => !!props.eventData?.id)

const schema = v.object({
  title: v.pipe(v.string(), v.minLength(3, 'Judul event minimal 3 karakter')),
  artistId: v.pipe(v.string(), v.minLength(1, 'Pilih artis')),
  publisherName: v.pipe(v.string(), v.minLength(2, 'Nama publisher/promoter wajib diisi')),
  venueId: v.pipe(v.string(), v.minLength(1, 'Pilih venue')),
  dateTime: v.pipe(v.string(), v.minLength(1, 'Tanggal & waktu wajib diisi')),
  status: v.picklist(['open', 'closed'])
})
type Schema = v.InferOutput<typeof schema>

function defaultState() {
  return {
    title: '',
    artistId: '',
    publisherName: '',
    venueId: '',
    dateTime: new Date().toISOString().slice(0, 16),
    endDateTime: '',
    description: '',
    maxTicketsPerOrder: 4,
    tagInput: '',
    tags: [] as string[],
    seatmapUrl: '',
    sortOrder: 0,
    status: 'open' as Schema['status'],
    imageUrl: ''
  }
}

const state = reactive(defaultState())
const isSaving = ref(false)
const isUploading = ref(false)
const isUploadingSeatmap = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const seatmapFileInput = ref<HTMLInputElement | null>(null)

const statusOptions = [
  { label: 'Open (Aktif)', value: 'open' },
  { label: 'Closed (Tutup)', value: 'closed' }
]

watch(open, (isOpen) => {
  if (!isOpen) return
  uploadError.value = ''
  if (props.eventData) {
    state.title = props.eventData.title
    state.artistId = props.eventData.artistId
    state.publisherName = props.eventData.publisherName
    state.venueId = props.eventData.venueId
    state.dateTime = props.eventData.dateTime ? new Date(props.eventData.dateTime).toISOString().slice(0, 16) : ''
    state.endDateTime = props.eventData.endDateTime ? new Date(props.eventData.endDateTime).toISOString().slice(0, 16) : ''
    state.description = props.eventData.description || ''
    state.maxTicketsPerOrder = props.eventData.maxTicketsPerOrder || 4
    state.tags = props.eventData.tags ? [...props.eventData.tags] : []
    state.seatmapUrl = props.eventData.seatmapUrl || ''
    state.sortOrder = props.eventData.sortOrder || 0
    state.status = props.eventData.status
    state.imageUrl = props.eventData.imageUrl || ''
  } else {
    Object.assign(state, defaultState())
  }
})

function addTag() {
  const t = state.tagInput.trim()
  if (t && !state.tags.includes(t)) {
    state.tags.push(t)
    state.tagInput = ''
  }
}

function removeTag(index: number) {
  state.tags.splice(index, 1)
}

async function onSeatmapSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadError.value = ''
  isUploadingSeatmap.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'venue')

    const res = await request<{ data: { url: string } }>('/uploads', {
      method: 'POST',
      body: formData
    })

    if (res?.data?.url) {
      state.seatmapUrl = res.data.url
    }
  } catch (err: any) {
    uploadError.value = err?.data?.error || 'Gagal mengunggah seatmap event.'
  } finally {
    isUploadingSeatmap.value = false
  }
}

async function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadError.value = ''
  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'banner') // UPL-03: banner ratio 16:9

    const res = await request<{ data: { url: string; thumbUrl: string; key: string } }>('/uploads', {
      method: 'POST',
      body: formData
    })

    if (res?.data?.url) {
      state.imageUrl = res.data.url
    }
  } catch (err: any) {
    uploadError.value = err?.data?.error || 'Gagal mengunggah banner event.'
  } finally {
    isUploading.value = false
  }
}

async function onSave() {
  if (!state.title.trim() || !state.artistId || !state.publisherName.trim() || !state.venueId || !state.dateTime) {
    uploadError.value = 'Harap lengkapi semua field yang wajib diisi.'
    return
  }

  if (state.endDateTime && new Date(state.endDateTime) < new Date(state.dateTime)) {
    uploadError.value = 'Waktu selesai tidak boleh sebelum waktu mulai.'
    return
  }

  isSaving.value = true
  uploadError.value = ''
  try {
    const payload: EventItem = {
      id: props.eventData?.id,
      title: state.title.trim(),
      artistId: state.artistId,
      publisherName: state.publisherName.trim(),
      venueId: state.venueId,
      dateTime: state.dateTime ? new Date(state.dateTime).toISOString() : new Date().toISOString(),
      endDateTime: state.endDateTime ? new Date(state.endDateTime).toISOString() : null,
      description: state.description.trim() || null,
      maxTicketsPerOrder: Number(state.maxTicketsPerOrder) || 4,
      tags: state.tags,
      seatmapUrl: state.seatmapUrl || null,
      sortOrder: Number(state.sortOrder) || 0,
      status: state.status,
      imageUrl: state.imageUrl || null
    }
    emit('saved', payload)
    open.value = false
  } catch (err: any) {
    uploadError.value = err?.message || 'Gagal menyimpan event.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="isEditMode ? 'Edit Event Konser' : 'Buat Event Konser Baru'">
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="uploadError"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :description="uploadError"
        />

        <UFormField label="Judul Event" name="title">
          <UInput v-model="state.title" placeholder="Contoh: Wuthering Waves Live 2026" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Artis / Performer" name="artistId">
            <USelect
              v-model="state.artistId"
              :items="(props.artists || []).map(a => ({ label: a.name, value: a.id }))"
              placeholder="Pilih Artis"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Promoter / Publisher" name="publisherName">
            <UInput v-model="state.publisherName" placeholder="Contoh: Kuro Games / Live Nation" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Venue Master" name="venueId">
            <USelect
              v-model="state.venueId"
              :items="(props.venues || []).map(v => ({ label: `${v.name} (${v.city})`, value: v.id }))"
              placeholder="Pilih Venue"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Batas Pembelian per Order" name="maxTicketsPerOrder">
            <UInput v-model.number="state.maxTicketsPerOrder" type="number" min="1" max="10" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Tanggal & Waktu Mulai" name="dateTime">
            <UInput v-model="state.dateTime" type="datetime-local" class="w-full" />
          </UFormField>

          <UFormField label="Tanggal & Waktu Selesai (Opsional)" name="endDateTime">
            <UInput v-model="state.endDateTime" type="datetime-local" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Deskripsi Event" name="description">
          <UTextarea v-model="state.description" placeholder="Deskripsi lengkap event untuk mobile app..." class="w-full" />
        </UFormField>

        <UFormField label="Tags / Kategori (Tekan Enter untuk tambah)">
          <div class="flex flex-wrap gap-2 mb-2" v-if="state.tags.length">
            <span v-for="(tag, idx) in state.tags" :key="idx" class="bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full text-xs flex items-center gap-1">
              {{ tag }}
              <button type="button" @click="removeTag(idx)" class="text-gray-400 hover:text-red-500">×</button>
            </span>
          </div>
          <UInput v-model="state.tagInput" placeholder="Contoh: Genshin, Anime, J-Pop (Tekan Enter)" @keydown.enter.prevent="addTag" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Status Event" name="status">
            <USelect v-model="state.status" :items="statusOptions" class="w-full" />
          </UFormField>

          <UFormField label="Urutan Tampil (Sort Order)">
            <UInput v-model.number="state.sortOrder" type="number" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Banner Gambar Event (Rasio 16:9)">
          <div class="flex items-start gap-4">
            <div class="w-36 h-20 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="state.imageUrl" :src="state.imageUrl" alt="Preview Banner" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-image" class="w-6 h-6 text-gray-300 dark:text-gray-600" />
            </div>
            <div class="space-y-1.5">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-upload"
                :loading="isUploading"
                @click="fileInput?.click()"
              >
                {{ state.imageUrl ? 'Ganti Banner' : 'Upload Banner' }}
              </UButton>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onImageSelected"
              >
              <p class="text-xs text-gray-400">PNG, JPG, atau WebP (Maksimal 10 MB).</p>
            </div>
          </div>
        </UFormField>

        <UFormField label="Seatmap Custom per Event (Opsional)">
          <p class="text-xs text-gray-400 mb-2">Jika kosong, akan otomatis fallback ke gambar default venue.</p>
          <div class="flex items-start gap-4">
            <div class="w-28 h-40 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="state.seatmapUrl" :src="state.seatmapUrl" alt="Preview Seatmap" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-image" class="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <div class="space-y-2">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-upload"
                :loading="isUploadingSeatmap"
                @click="seatmapFileInput?.click()"
              >
                {{ state.seatmapUrl ? 'Ganti Seatmap' : 'Upload Seatmap' }}
              </UButton>
              <input
                ref="seatmapFileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onSeatmapSelected"
              >
              <p class="text-xs text-gray-400">Rasio 9:16 recommended.</p>
            </div>
          </div>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" @click="open = false">
          Batal
        </UButton>
        <UButton
          type="button"
          :loading="isSaving"
          class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
          @click="onSave"
        >
          {{ isEditMode ? 'Simpan Perubahan' : 'Buat Event' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
