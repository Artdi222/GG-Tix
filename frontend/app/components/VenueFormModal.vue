<script setup lang="ts">
export interface Venue {
  id: string
  name: string
  address: string
  city: string
  imageUrl: string | null
  sortOrder: number
}

const props = withDefaults(defineProps<{ venue?: Venue | null }>(), { venue: null })
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()
const state = reactive({ name: '', address: '', city: '', sortOrder: 0 as number | undefined, imageUrl: '' })
const saving = ref(false)
const formError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  const v = props.venue
  Object.assign(state, v
    ? { name: v.name, address: v.address, city: v.city, sortOrder: v.sortOrder, imageUrl: v.imageUrl ?? '' }
    : { name: '', address: '', city: '', sortOrder: 0, imageUrl: '' })
})

async function submit() {
  formError.value = !state.name.trim() ? 'Nama venue wajib diisi.' : !state.address.trim() ? 'Alamat wajib diisi.' : !state.city.trim() ? 'Kota wajib diisi.' : ''
  if (formError.value) return
  saving.value = true
  const body = { name: state.name.trim(), address: state.address.trim(), city: state.city.trim(), sortOrder: state.sortOrder ?? 0, imageUrl: state.imageUrl || null }
  try {
    if (props.venue) await request(`/venues/${props.venue.id}`, { method: 'PUT', body })
    else await request('/venues', { method: 'POST', body })
    toast.add({ title: props.venue ? 'Venue diperbarui' : 'Venue ditambahkan', color: 'success' })
    open.value = false
    emit('saved')
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
            <UInput
              v-model="state.city"
              maxlength="100"
              placeholder="Jakarta"
              class="w-full"
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
          label="Denah / foto venue"
        >
          <ImageField
            v-model="state.imageUrl"
            kind="venue"
            aspect="aspect-[4/3]"
          />
        </UFormField>
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
        form="venue-form"
        :label="venue ? 'Simpan perubahan' : 'Tambah venue'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
