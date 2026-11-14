<script setup lang="ts">
export interface Venue {
  id: string
  name: string
  address: string
  city: string
  timezone: string
  imageUrl: string | null
  sortOrder: number
  isActive: boolean
}

const props = withDefaults(defineProps<{ venue?: Venue | null }>(), { venue: null })
const emit = defineEmits<{ saved: [venue: Venue] }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()
const state = reactive({ name: '', address: '', city: '', timezone: 'Asia/Jakarta', sortOrder: 0 as number | undefined, imageUrl: '', isActive: true })
// Every IANA zone the browser knows; event times at this venue are shown in it.
const timezones: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles']
  }
})()
const saving = ref(false)
const formError = ref('')
const cities = ref<string[]>([])

async function loadCities() {
  try {
    cities.value = (await request<{ data: string[] }>('/venues/cities')).data
  } catch {
    cities.value = [] // autocomplete is a convenience; free text still works
  }
}

function addCity(city: string) {
  const c = city.trim()
  if (!c) return
  if (!cities.value.includes(c)) cities.value = [...cities.value, c]
  state.city = c
}

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  loadCities()
  const v = props.venue
  Object.assign(state, v
    ? { name: v.name, address: v.address, city: v.city, timezone: v.timezone || 'Asia/Jakarta', sortOrder: v.sortOrder, imageUrl: v.imageUrl ?? '', isActive: v.isActive }
    : { name: '', address: '', city: '', timezone: 'Asia/Jakarta', sortOrder: 0, imageUrl: '', isActive: true })
})

async function submit() {
  formError.value = !state.name.trim() ? 'Nama venue wajib diisi.' : !state.address.trim() ? 'Alamat wajib diisi.' : !state.city.trim() ? 'Kota wajib diisi.' : ''
  if (formError.value) return
  saving.value = true
  const body = {
    name: state.name.trim(),
    address: state.address.trim(),
    city: state.city.trim(),
    timezone: state.timezone,
    sortOrder: state.sortOrder ?? 0,
    imageUrl: state.imageUrl || null,
    ...(props.venue ? { isActive: state.isActive } : {})
  }
  try {
    const res = props.venue
      ? await request<{ data: Venue }>(`/venues/${props.venue.id}`, { method: 'PUT', body })
      : await request<{ data: Venue }>('/venues', { method: 'POST', body })
    toast.add({ title: props.venue ? 'Venue diperbarui' : 'Venue ditambahkan', color: 'success' })
    open.value = false
    emit('saved', res.data)
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Venue gagal disimpan.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="venue ? 'Edit venue' : 'Tambah venue'"
    :dismissible="!saving"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <form
        id="venue-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="Nama venue"
          required
        >
          <UInput
            v-model="state.name"
            maxlength="200"
            placeholder="Istora Senayan"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Alamat"
          required
        >
          <UTextarea
            v-model="state.address"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField
            label="Kota"
            required
          >
            <UInputMenu
              v-model="state.city"
              :items="cities"
              create-item
              placeholder="Pilih atau ketik kota"
              class="w-full"
              @create="addCity"
            />
          </UFormField>
          <UFormField label="Urutan tampil">
            <UInputNumber
              v-model="state.sortOrder"
              :min="0"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Zona waktu"
          help="Jam event di venue ini ditampilkan dalam waktu lokal ini."
        >
          <USelectMenu
            v-model="state.timezone"
            :items="timezones"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Foto venue"
          help="Denah kursi dan poster diunggah per event, bukan di sini."
        >
          <ImageField
            v-model="state.imageUrl"
            kind="venue"
            aspect="aspect-[4/3]"
          />
        </UFormField>
        <UFormField
          v-if="venue"
          label="Status"
          help="Venue yang diarsipkan tidak muncul di pilihan event baru, tapi event lamanya tetap aman."
        >
          <USwitch
            v-model="state.isActive"
            :label="state.isActive ? 'Aktif' : 'Diarsipkan'"
          />
        </UFormField>
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
        form="venue-form"
        :label="venue ? 'Simpan perubahan' : 'Tambah venue'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
