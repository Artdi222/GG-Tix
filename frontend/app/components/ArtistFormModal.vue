<script setup lang="ts">
export interface Artist {
  id: string
  name: string
  bio: string | null
  photoUrl: string | null
  createdAt: string
}

const props = withDefaults(defineProps<{ artist?: Artist | null }>(), { artist: null })
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()
const state = reactive({ name: '', bio: '', photoUrl: '' })
const saving = ref(false)
const formError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  Object.assign(state, { name: props.artist?.name ?? '', bio: props.artist?.bio ?? '', photoUrl: props.artist?.photoUrl ?? '' })
})

async function submit() {
  formError.value = state.name.trim() ? '' : 'Nama artis wajib diisi.'
  if (formError.value) return
  saving.value = true
  const body = { name: state.name.trim(), bio: state.bio.trim(), photoUrl: state.photoUrl }
  try {
    if (props.artist) await request(`/artists/${props.artist.id}`, { method: 'PUT', body })
    else await request('/artists', { method: 'POST', body })
    toast.add({ title: props.artist ? 'Artis diperbarui' : 'Artis ditambahkan', color: 'success' })
    open.value = false
    emit('saved')
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Artis gagal disimpan.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="artist ? 'Edit artis' : 'Tambah artis'"
    :dismissible="!saving"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <form
        id="artist-form"
        class="grid sm:grid-cols-[10rem_1fr] gap-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="Foto"
          help="1:1"
        >
          <ImageField
            v-model="state.photoUrl"
            kind="profile"
            aspect="aspect-square"
            hint="Rasio 1:1"
          />
        </UFormField>
        <div class="space-y-4">
          <UFormField
            label="Nama"
            required
          >
            <UInput
              v-model="state.name"
              placeholder="Nama artis / grup"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bio">
            <UTextarea
              v-model="state.bio"
              :rows="5"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="formError"
          class="sm:col-span-2"
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
        form="artist-form"
        :label="artist ? 'Simpan perubahan' : 'Tambah artis'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
