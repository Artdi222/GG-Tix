<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  hint?: string
  loading?: boolean
  tone?: 'default' | 'warning' | 'success'
  /** Percent change vs the previous period; null hides the chip. */
  delta?: number | null
  /** Set when a decrease is the good direction (e.g. pending orders). */
  invertDelta?: boolean
}>()

const deltaState = computed(() => {
  const d = props.delta
  if (d === null || d === undefined || !Number.isFinite(d)) return null
  const rounded = Math.round(d * 10) / 10
  const good = props.invertDelta ? rounded < 0 : rounded > 0
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('id-ID')}%`,
    icon: rounded === 0 ? 'i-lucide-minus' : rounded > 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down',
    class: rounded === 0 ? 'bg-elevated text-muted' : good ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
  }
})
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }">
    <div class="flex items-center gap-2 text-muted">
      <UIcon
        :name="icon"
        class="size-4 shrink-0"
        :class="{
          'text-primary': !tone || tone === 'default',
          'text-warning': tone === 'warning',
          'text-success': tone === 'success'
        }"
      />
      <p class="text-[13px] font-medium truncate">
        {{ label }}
      </p>
    </div>
    <USkeleton
      v-if="loading"
      class="mt-3 h-8 w-28"
    />
    <p
      v-else
      class="mt-2 text-[26px] leading-tight font-semibold tracking-tight text-highlighted tabular-nums truncate"
    >
      {{ value }}
    </p>
    <div
      v-if="!loading && (deltaState || hint)"
      class="mt-2 flex items-center gap-2 min-w-0 text-xs"
    >
      <span
        v-if="deltaState"
        class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums shrink-0"
        :class="deltaState.class"
      >
        <UIcon
          :name="deltaState.icon"
          class="size-3.5"
        />
        {{ deltaState.text }}
      </span>
      <span
        v-if="hint"
        class="text-dimmed truncate"
      >{{ hint }}</span>
    </div>
  </UCard>
</template>
