<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

export interface EventItem {
  id?: string
  title: string
  artistId: string
  publisherName: string
  venue: string
  city: string
  dateTime: string
  status: 'open' | 'closed'
}

interface ArtistOption {
  id: string
  name: string
}

const props = defineProps<{
  eventData?: EventItem | null
  artists?: ArtistOption[]
}>()

const emit = defineEmits<{
  saved: [eventData: EventItem]
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditMode = computed(() => !!props.eventData?.id)

const schema = v.object({
  title: v.pipe(v.string(), v.minLength(3, 'Judul event minimal 3 karakter')),
  artistId: v.pipe(v.string(), v.minLength(1, 'Pilih artis')),
  publisherName: v.pipe(v.string(), v.minLength(2, 'Nama publisher/promoter wajib diisi')),
  venue: v.pipe(v.string(), v.minLength(2, 'Nama venue wajib diisi')),
  city: v.pipe(v.string(), v.minLength(2, 'Kota wajib diisi')),
  dateTime: v.pipe(v.string(), v.minLength(1, 'Tanggal & waktu wajib diisi')),
  status: v.picklist(['open', 'closed'])
})
type Schema = v.InferOutput<typeof schema>

function defaultState() {
  return {
    title: '',
    artistId: '',
    publisherName: '',
    venue: '',
    city: '',
    dateTime: new Date().toISOString().slice(0, 16),
    status: 'open' as Schema['status']
  }
}

const state = reactive(defaultState())
const isSaving = ref(false)

const statusOptions = [
  { label: 'Open (Aktif)', value: 'open' },
  { label: 'Closed (Tutup)', value: 'closed' }
]

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.eventData) {
    state.title = props.eventData.title
    state.artistId = props.eventData.artistId
    state.publisherName = props.eventData.publisherName
    state.venue = props.eventData.venue
    state.city = props.eventData.city
    state.dateTime = props.eventData.dateTime ? new Date(props.eventData.dateTime).toISOString().slice(0, 16) : ''
    state.status = props.eventData.status
  } else {
    Object.assign(state, defaultState())
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  try {
    const payload: EventItem = {
      id: props.eventData?.id,
      ...event.data,
      dateTime: new Date(event.data.dateTime).toISOString()
    }
    emit('saved', payload)
    open.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit">
    <UModal v-model:open="open" :title="isEditMode ? 'Edit Event Konser' : 'Buat Event Konser Baru'">
      <template #body>
        <div class="space-y-4">
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
            <UFormField label="Nama Venue" name="venue">
              <UInput v-model="state.venue" placeholder="Contoh: Gelora Bung Karno" class="w-full" />
            </UFormField>

            <UFormField label="Kota" name="city">
              <UInput v-model="state.city" placeholder="Contoh: Jakarta" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tanggal & Waktu Konser" name="dateTime">
              <UInput v-model="state.dateTime" type="datetime-local" class="w-full" />
            </UFormField>

            <UFormField label="Status Event" name="status">
              <USelect v-model="state.status" :items="statusOptions" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="open = false">
            Batal
          </UButton>
          <UButton
            type="submit"
            :loading="isSaving"
            class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
          >
            {{ isEditMode ? 'Simpan Perubahan' : 'Buat Event' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UForm>
</template>
