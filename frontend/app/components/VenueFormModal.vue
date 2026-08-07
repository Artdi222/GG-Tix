<script setup lang="ts">
interface Venue {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  imageUrl: string
}

const props = defineProps<{
  open: boolean
  venue?: Venue | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [venue: Venue]
}>()

const isEdit = computed(() => !!props.venue)

const state = reactive({
  name: '',
  address: '',
  latitude: null as number | null,
  longitude: null as number | null,
  imageUrl: ''
})

const isSaving = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (props.venue) {
      state.name = props.venue.name
      state.address = props.venue.address
      state.latitude = props.venue.latitude
      state.longitude = props.venue.longitude
      state.imageUrl = props.venue.imageUrl
    } else {
      state.name = ''
      state.address = ''
      state.latitude = null
      state.longitude = null
      state.imageUrl = ''
    }
  }
)

function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  // NOTE: this only creates a temporary local preview URL.
  // Once the backend is ready, upload the file there and store the returned permanent URL instead.
  state.imageUrl = URL.createObjectURL(file)
}

async function onSubmit() {
  if (!state.name.trim() || !state.address.trim()) return
  isSaving.value = true
  try {
    // TODO: replace with POST /api/venues (multipart, including the image file) once the backend is ready
    await new Promise((resolve) => setTimeout(resolve, 600))
    emit('saved', {
      id: props.venue?.id ?? Date.now(),
      name: state.name,
      address: state.address,
      latitude: state.latitude ?? 0,
      longitude: state.longitude ?? 0,
      imageUrl: state.imageUrl
    })
    emit('update:open', false)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'Edit venue' : 'Create venue'"
    :description="isEdit ? 'Update the details for this venue.' : 'Add a venue that concerts can be held at.'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Venue name">
          <UInput v-model="state.name" placeholder="Istora Senayan" class="w-full" />
        </UFormField>

        <UFormField label="Address">
          <UInput v-model="state.address" placeholder="Jl. Pintu Satu Senayan, Jakarta" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Latitude">
            <UInput v-model.number="state.latitude" type="number" step="any" placeholder="-6.2192" class="w-full" />
          </UFormField>
          <UFormField label="Longitude">
            <UInput v-model.number="state.longitude" type="number" step="any" placeholder="106.8021" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Venue area image">
          <p class="text-xs text-gray-400 mb-2">Layout or seating/zone map, so customers can see where each ticket area is.</p>
          <div class="flex items-start gap-4">
            <div class="w-32 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="state.imageUrl" :src="state.imageUrl" alt="Venue area preview" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-image" class="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-upload"
                @click="fileInput?.click()"
              >
                {{ state.imageUrl ? 'Replace image' : 'Upload image' }}
              </UButton>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onImageSelected"
              >
              <p class="text-xs text-gray-400 mt-1.5">PNG or JPG, ideally the seating/zone map.</p>
            </div>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="outline" @click="emit('update:open', false)">
            Cancel
          </UButton>
          <UButton type="submit" :loading="isSaving" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white">
            {{ isEdit ? 'Save changes' : 'Create venue' }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>