<script setup lang="ts">
type Color = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const STATUS: Record<string, { label: string, color: Color }> = {
  pending: { label: 'Menunggu', color: 'warning' },
  verified: { label: 'Lunas', color: 'success' },
  rejected: { label: 'Ditolak', color: 'error' },
  expired: { label: 'Kedaluwarsa', color: 'neutral' },
  open: { label: 'Dibuka', color: 'success' },
  closed: { label: 'Ditutup', color: 'neutral' },
  active: { label: 'Aktif', color: 'success' },
  inactive: { label: 'Nonaktif', color: 'neutral' },
  scheduled: { label: 'Terjadwal', color: 'info' },
  refunded: { label: 'Dikembalikan', color: 'neutral' }
}

const props = defineProps<{ status: string }>()
const meta = computed(() => STATUS[props.status] ?? { label: props.status, color: 'neutral' as const })
</script>

<template>
  <UBadge
    :color="meta.color"
    variant="subtle"
    :label="meta.label"
    class="whitespace-nowrap"
  />
</template>
