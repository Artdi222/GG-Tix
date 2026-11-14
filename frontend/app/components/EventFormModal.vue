<script setup lang="ts">
import type { Venue } from '~/components/VenueFormModal.vue'
import type { Artist } from '~/components/ArtistFormModal.vue'

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
  posterUrl: string | null
  artist?: { id: string, name: string } | null
  venue?: { id: string, name: string, city: string, timezone?: string } | null
  /** Ticket totals across categories (list endpoint only). */
  capacity?: number
  sold?: number
}

export interface Option { label: string, value: string, archived?: boolean, timezone?: string }

const props = withDefaults(defineProps<{
  eventData?: EventRow | null
  artists: Option[]
  venues: Option[]
}>(), { eventData: null })

const emit = defineEmits<{ 'saved': [], 'venue-created': [venue: Venue], 'artist-created': [artist: Artist] }>()
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
    imageUrl: '',
    posterUrl: ''
  }
}

const state = reactive(blank())
const saving = ref(false)
const formError = ref('')
const isEdit = computed(() => !!props.eventData)
const venueTz = computed(() => props.venues.find(v => v.value === state.venueId)?.timezone || props.eventData?.venue?.timezone || undefined)
const venueFormOpen = ref(false)
const artistFormOpen = ref(false)

function onArtistCreated(artist: Artist) {
  emit('artist-created', artist)
  state.artistId = artist.id
}

// Archived venues stay selectable only for the event that already uses them.
const venueItems = computed(() =>
  props.venues
    .filter(v => !v.archived || v.value === props.eventData?.venueId)
    .map(v => v.archived ? { ...v, label: `${v.label} (diarsipkan)` } : v)
)

function onVenueCreated(venue: Venue) {
  emit('venue-created', venue)
  state.venueId = venue.id
}

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
        // Times are edited in the venue's local zone, not the admin's browser zone.
        dateTime: toDatetimeLocal(e.dateTime, e.venue?.timezone),
        endDateTime: toDatetimeLocal(e.endDateTime, e.venue?.timezone),
        description: e.description ?? '',
        maxTicketsPerOrder: e.maxTicketsPerOrder ?? undefined,
        tags: [...(e.tags ?? [])],
        seatmapUrl: e.seatmapUrl ?? '',
        sortOrder: e.sortOrder ?? 0,
        status: e.status,
        imageUrl: e.imageUrl ?? '',
        posterUrl: e.posterUrl ?? ''
      }
    : blank())
})

function validate() {
  if (state.title.trim().length < 3) return 'Judul event minimal 3 karakter.'
  if (!state.artistId) return 'Pilih artis.'
  if (!state.publisherName.trim()) return 'Isi nama promotor.'
  if (!state.venueId) return 'Pilih venue.'
  if (!fromDatetimeLocal(state.dateTime, venueTz.value)) return 'Isi tanggal dan waktu mulai.'
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
    dateTime: fromDatetimeLocal(state.dateTime, venueTz.value),
    endDateTime: fromDatetimeLocal(state.endDateTime, venueTz.value),
    description: state.description.trim() || null,
    maxTicketsPerOrder: state.maxTicketsPerOrder ?? null,
    tags: state.tags,
    seatmapUrl: state.seatmapUrl || null,
    sortOrder: Number(state.sortOrder) || 0,
    status: state.status,
    imageUrl: state.imageUrl || null,
    posterUrl: state.posterUrl || null
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
            <template #hint>
              <UButton
                label="Artis baru"
                icon="i-lucide-plus"
                size="xs"
                variant="link"
                class="p-0"
                @click="artistFormOpen = true"
              />
            </template>
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
            <template #hint>
              <UButton
                label="Venue baru"
                icon="i-lucide-plus"
                size="xs"
                variant="link"
                class="p-0"
                @click="venueFormOpen = true"
              />
            </template>
            <USelectMenu
              v-model="state.venueId"
              :items="venueItems"
              value-key="value"
              placeholder="Pilih venue"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Maks. tiket per pesanan"
            help="1–10, kosong = default"
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
            :help="venueTz ? `Waktu lokal venue (${venueTz})` : undefined"
          >
            <UInput
              v-model="state.dateTime"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Selesai"
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
          help="Tekan Enter untuk menambah"
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
            help="Angka kecil tampil lebih dulu"
          >
            <UInputNumber
              v-model="state.sortOrder"
              :min="0"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField
            label="Banner (16:9)"
            help="Carousel beranda dan latar detail event"
          >
            <ImageField
              v-model="state.imageUrl"
              kind="banner"
            />
          </UFormField>
          <UFormField
            label="Poster (2:3)"
            help="Kartu event dan thumbnail tiket"
          >
            <ImageField
              v-model="state.posterUrl"
              kind="poster"
              aspect="aspect-[2/3]"
            />
          </UFormField>
          <UFormField
            label="Seatmap"
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
          role="alert"
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
  <ArtistFormModal
    v-model:open="artistFormOpen"
    @saved="onArtistCreated"
  />
  <VenueFormModal
    v-model:open="venueFormOpen"
    @saved="onVenueCreated"
  />
</template>
