<script setup lang="ts">
export interface EventRow {
  id: string
  title: string
  artistId: string
  publisherName: string
  venueId: string | null
  dateTime: string
  endDateTime: string | null
  description: string | null
  maxTicketsPerOrder: number | null
  tags: string[]
  seatmapUrl: string | null
  sortOrder: number
  status: 'open' | 'closed'
  imageUrl: string | null
  artist?: { id: string, name: string } | null
  venue?: { id: string, name: string, city: string } | null
}

export interface Option { label: string, value: string }

const props = withDefaults(defineProps<{
  eventData?: EventRow | null
  artists: Option[]
  venues: Option[]
}>(), { eventData: null })

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()

function blank() {
  const start = new Date(Date.now() + 30 * 86400000)
  start.setHours(19, 0, 0, 0)
  return {
    title: '',
    artistId: '',
    publisherName: '',
    venueId: '',
    dateTime: toDatetimeLocal(start),
    endDateTime: '',
    description: '',
    maxTicketsPerOrder: undefined as number | undefined,
    tags: [] as string[],
    seatmapUrl: '',
    sortOrder: 0,
    status: 'open' as 'open' | 'closed',
    imageUrl: ''
  }
}

const state = reactive(blank())
const saving = ref(false)
const formError = ref('')
const isEdit = computed(() => !!props.eventData)

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  const e = props.eventData
  Object.assign(state, e
    ? {
        title: e.title,
        artistId: e.artistId,
        publisherName: e.publisherName,
        venueId: e.venueId ?? '',
        dateTime: toDatetimeLocal(e.dateTime),
        endDateTime: toDatetimeLocal(e.endDateTime),
        description: e.description ?? '',
        maxTicketsPerOrder: e.maxTicketsPerOrder ?? undefined,
        tags: [...(e.tags ?? [])],
        seatmapUrl: e.seatmapUrl ?? '',
        sortOrder: e.sortOrder ?? 0,
        status: e.status,
        imageUrl: e.imageUrl ?? ''
      }
    : blank())
})

function validate() {
  if (state.title.trim().length < 3) return 'Judul event minimal 3 karakter.'
  if (!state.artistId) return 'Pilih artis.'
  if (!state.publisherName.trim()) return 'Isi nama promotor.'
  if (!state.venueId) return 'Pilih venue.'
  if (!fromDatetimeLocal(state.dateTime)) return 'Isi tanggal dan waktu mulai.'
  if (state.endDateTime && state.endDateTime <= state.dateTime) return 'Waktu selesai harus setelah waktu mulai.'
  const max = state.maxTicketsPerOrder
  if (max !== undefined && (!Number.isInteger(max) || max < 1 || max > 10)) return 'Batas tiket per pesanan harus 1–10.'
  return ''
}

async function submit() {
  formError.value = validate()
  if (formError.value) return
  saving.value = true
  const body = {
    title: state.title.trim(),
    artistId: state.artistId,
    publisherName: state.publisherName.trim(),
    venueId: state.venueId,
    dateTime: fromDatetimeLocal(state.dateTime),
    endDateTime: fromDatetimeLocal(state.endDateTime),
    description: state.description.trim() || null,
    maxTicketsPerOrder: state.maxTicketsPerOrder ?? null,
    tags: state.tags,
    seatmapUrl: state.seatmapUrl || null,
    sortOrder: Number(state.sortOrder) || 0,
    status: state.status,
    imageUrl: state.imageUrl || null
  }
  try {
    if (props.eventData) await request(`/events/${props.eventData.id}`, { method: 'PUT', body })
    else await request('/events', { method: 'POST', body })
    toast.add({ title: isEdit.value ? 'Event diperbarui' : 'Event dibuat', color: 'success' })
    open.value = false
    emit('saved')
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Event gagal disimpan.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit event' : 'Buat event'"
    :description="isEdit ? eventData?.title : 'Event baru langsung tampil di aplikasi jika statusnya dibuka.'"
    :dismissible="!saving"
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <form
        id="event-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="Judul event"
          required
        >
          <UInput
            v-model="state.title"
            placeholder="Contoh: Wuthering Waves Live 2026"
            class="w-full"
          />
        </UFormField>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField
            label="Artis"
            required
          >
            <USelectMenu
              v-model="state.artistId"
              :items="artists"
              value-key="value"
              placeholder="Pilih artis"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Promotor"
            required
          >
            <UInput
              v-model="state.publisherName"
              placeholder="Contoh: Live Nation"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Venue"
            required
          >
            <USelectMenu
              v-model="state.venueId"
              :items="venues"
              value-key="value"
              placeholder="Pilih venue"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Maks. tiket per pesanan"
            hint="1–10, kosong = default"
          >
            <UInputNumber
              v-model="state.maxTicketsPerOrder"
              :min="1"
              :max="10"
              placeholder="Default"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Mulai"
            required
          >
            <UInput
              v-model="state.dateTime"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Selesai"
            hint="Opsional"
          >
            <UInput
              v-model="state.endDateTime"
              type="datetime-local"
              :min="state.dateTime"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Deskripsi">
          <UTextarea
            v-model="state.description"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Tag"
          hint="Tekan Enter untuk menambah"
        >
          <UInputTags
            v-model="state.tags"
            placeholder="J-Pop, Anime…"
            class="w-full"
          />
        </UFormField>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField label="Status penjualan">
            <USelect
              v-model="state.status"
              :items="[{ label: 'Dibuka', value: 'open' }, { label: 'Ditutup', value: 'closed' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Urutan tampil"
            hint="Angka kecil tampil lebih dulu"
          >
            <UInputNumber
              v-model="state.sortOrder"
              :min="0"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField label="Banner (16:9)">
            <ImageField
              v-model="state.imageUrl"
              kind="banner"
            />
          </UFormField>
          <UFormField
            label="Seatmap"
            hint="Opsional"
          >
            <ImageField
              v-model="state.seatmapUrl"
              kind="venue"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="formError"
        />
      </form>
    </template>

    <template #footer>
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        :disabled="saving"
        @click="open = false"
      />
      <UButton
        type="submit"
        form="event-form"
        :label="isEdit ? 'Simpan perubahan' : 'Buat event'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
