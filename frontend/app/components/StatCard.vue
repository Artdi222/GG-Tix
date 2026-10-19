<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon: string
  hint?: string
  loading?: boolean
  tone?: 'default' | 'warning' | 'success'
}>()
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-4' }">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium text-muted">
          {{ label }}
        </p>
        <USkeleton
          v-if="loading"
          class="mt-2 h-7 w-24"
        />
        <p
          v-else
          class="mt-1 text-2xl font-semibold text-highlighted tabular-nums truncate"
        >
          {{ value }}
        </p>
        <p
          v-if="hint && !loading"
          class="mt-1 text-xs text-dimmed truncate"
        >
          {{ hint }}
        </p>
      </div>
      <span
        class="size-9 shrink-0 rounded-lg grid place-items-center"
        :class="{
          'bg-primary/10 text-primary': !tone || tone === 'default',
          'bg-warning/10 text-warning': tone === 'warning',
          'bg-success/10 text-success': tone === 'success'
        }"
      >
        <UIcon
          :name="icon"
          class="size-4.5"
        />
      </span>
    </div>
  </UCard>
</template>
