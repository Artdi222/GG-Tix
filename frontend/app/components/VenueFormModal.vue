<script setup lang="ts">
export interface Venue {
  id?: string
  name: string
  address: string
  city: string
  imageUrl: string | null
  sortOrder?: number
}

const props = defineProps<{
  open: boolean
  venue?: Venue | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [venue: Venue]
}>()

const { request } = useApi()

const isEdit = computed(() => !!props.venue?.id)

const state = reactive({
  name: '',
  address: '',
  city: '',
  sortOrder: 0,
  imageUrl: ''
})

const isSaving = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    uploadError.value = ''
    if (props.venue) {
      state.name = props.venue.name
      state.address = props.venue.address
      state.city = props.venue.city || ''
      state.sortOrder = props.venue.sortOrder || 0
      state.imageUrl = props.venue.imageUrl || ''
    } else {
      state.name = ''
      state.address = ''
      state.city = ''
      state.sortOrder = 0
      state.imageUrl = ''
    }
  }
)

async function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadError.value = ''
  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'venue') // UPL-03: venue ratio 9:16

    const res = await request<{ data: { url: string; thumbUrl: string; key: string } }>('/uploads', {
      method: 'POST',
      body: formData
    })

    if (res?.data?.url) {
      state.imageUrl = res.data.url
    }
  } catch (err: any) {
    uploadError.value = err?.data?.error || 'Gagal mengunggah gambar denah venue.'
  } finally {
    isUploading.value = false
  }
}

async function onSubmit() {
  if (!state.name.trim() || !state.address.trim() || !state.city.trim()) return
  isSaving.value = true
  uploadError.value = ''

  try {
    const payload = {
      name: state.name.trim(),
      address: state.address.trim(),
      city: state.city.trim(),
      sortOrder: Number(state.sortOrder) || 0,
      imageUrl: state.imageUrl || ''
    }

    if (props.venue?.id) {
      const res = await request<{ data: Venue }>(`/venues/${props.venue.id}`, {
        method: 'PUT',
        body: payload
      })
      emit('saved', res?.data || {
        id: props.venue.id,
        ...payload
      })
    } else {
      const res = await request<{ data: Venue }>('/venues', {
        method: 'POST',
        body: payload
      })
      emit('saved', res?.data || {
        id: `venue-${Date.now()}`,
        ...payload
      })
    }
    emit('update:open', false)
  } catch (err: any) {
    uploadError.value = err?.data?.error || 'Gagal menyimpan data venue.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'Edit Venue Konser' : 'Tambah Venue Konser Baru'"
    :description="isEdit ? 'Perbarui informasi venue & denah lokasi.' : 'Tambahkan data master venue & denah area konser.'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="uploadError"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :description="uploadError"
        />

        <UFormField label="Nama Venue" required>
          <UInput v-model="state.name" placeholder="Contoh: Gelora Bung Karno" class="w-full" />
        </UFormField>

        <UFormField label="Alamat Lengkap" required>
          <UInput v-model="state.address" placeholder="Jl. Pintu Satu Senayan, Jakarta" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Kota" required>
            <UInput v-model="state.city" placeholder="Contoh: Jakarta" class="w-full" />
          </UFormField>
          <UFormField label="Urutan Tampil (Sort Order)">
            <UInput v-model.number="state.sortOrder" type="number" placeholder="0" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Gambar / Denah Area Venue (Rasio 9:16)">
          <p class="text-xs text-gray-400 mb-2">Denah layout tempat duduk & zona tiket untuk memudahkan customer.</p>
          <div class="flex items-start gap-4">
            <div class="w-28 h-40 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="state.imageUrl" :src="state.imageUrl" alt="Preview Denah Venue" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-image" class="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <div class="space-y-2">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-upload"
                :loading="isUploading"
                @click="fileInput?.click()"
              >
                {{ state.imageUrl ? 'Ganti Denah' : 'Upload Denah' }}
              </UButton>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onImageSelected"
              >
              <p class="text-xs text-gray-400">PNG, JPG, atau WebP (Maksimal 10 MB). Di-crop otomatis ke rasio 9:16.</p>
            </div>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <UButton color="neutral" variant="outline" @click="emit('update:open', false)">
            Batal
          </UButton>
          <UButton type="submit" :loading="isSaving" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white">
            {{ isEdit ? 'Simpan Perubahan' : 'Buat Venue' }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>