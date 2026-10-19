<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}>(), {
  description: undefined,
  confirmLabel: 'Konfirmasi',
  danger: false
})

const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="true"
    :ui="{ footer: 'justify-end' }"
    @update:open="(open) => !open && emit('close', false)"
  >
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        label="Batal"
        @click="emit('close', false)"
      />
      <UButton
        :color="danger ? 'error' : 'primary'"
        :label="confirmLabel"
        autofocus
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
