<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Concert {
  id: number
  name: string
  date: string
  venue: string
  ticketsSold: number
  capacity: number
  status: 'on-sale' | 'almost-sold-out' | 'sold-out' | 'draft'
}

const props = defineProps<{
  concert?: Concert | null
}>()

const emit = defineEmits<{
  saved: [concert: Concert]
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditMode = computed(() => !!props.concert)

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(3, 'Name must be at least 3 characters')),
  date: v.pipe(v.string(), v.minLength(1, 'Date is required')),
  venue: v.pipe(v.string(), v.minLength(1, 'Venue is required')),
  capacity: v.pipe(v.number(), v.minValue(1, 'Capacity must be greater than 0')),
  status: v.picklist(['on-sale', 'almost-sold-out', 'sold-out', 'draft'])
})
type Schema = v.InferOutput<typeof schema>

function defaultState() {
  return {
    name: '',
    date: '',
    venue: '',
    capacity: 100,
    status: 'draft' as Schema['status']
  }
}

const state = reactive(defaultState())
const isSaving = ref(false)

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'On Sale', value: 'on-sale' },
  { label: 'Almost Sold Out', value: 'almost-sold-out' },
  { label: 'Sold Out', value: 'sold-out' }
]

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.concert) {
    state.name = props.concert.name
    state.date = props.concert.date
    state.venue = props.concert.venue
    state.capacity = props.concert.capacity
    state.status = props.concert.status
  } else {
    Object.assign(state, defaultState())
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSaving.value = true
  try {
    // TODO: replace with real POST /api/concerts or PATCH /api/concerts/:id once the backend is ready
    await new Promise((resolve) => setTimeout(resolve, 600))

    const saved: Concert = {
      id: props.concert?.id ?? Date.now(),
      ticketsSold: props.concert?.ticketsSold ?? 0,
      ...event.data
    }

    emit('saved', saved)
    open.value = false
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit">
    <UModal v-model:open="open" :title="isEditMode ? 'Edit Concert' : 'Create Concert'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Concert Name" name="name">
            <UInput v-model="state.name" placeholder="e.g. Lumina Stage - Golden Night" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Date" name="date">
              <UInput v-model="state.date" type="date" class="w-full" />
            </UFormField>

            <UFormField label="Capacity" name="capacity">
              <UInput v-model.number="state.capacity" type="number" min="1" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Venue" name="venue">
            <UInput v-model="state.venue" placeholder="e.g. Istora Senayan" class="w-full" />
          </UFormField>

          <UFormField label="Status" name="status">
            <USelect v-model="state.status" :items="statusOptions" class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="open = false">
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="isSaving"
            class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
          >
            {{ isEditMode ? 'Save Changes' : 'Create Concert' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UForm>
</template>