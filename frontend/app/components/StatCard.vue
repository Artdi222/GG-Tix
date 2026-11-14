<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  hint?: string
  loading?: boolean
  tone?: 'default' | 'warning' | 'success' | 'info' | 'error'
  /** Percent change vs the previous period; null hides the chip. */
  delta?: number | null
  /** Set when a decrease is the good direction (e.g. pending orders). */
  invertDelta?: boolean
  /** Makes the whole card a link (drill-down). */
  to?: string
}>()

// Literal classes so Tailwind generates them.
const TILES = {
  default: 'bg-gold-100 text-gold-700',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-green-100 text-green-700',
  info: 'bg-sky-100 text-sky-700',
  error: 'bg-red-100 text-red-700'
} as const
const tile = computed(() => TILES[props.tone ?? 'default'])

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
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="group block min-w-0 rounded-xl bg-default p-4 sm:p-5 shadow-(--shadow-card) ring ring-default transition"
    :class="to ? 'hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary' : ''"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="grid size-9 shrink-0 place-items-center rounded-full"
        :class="tile"
      >
        <UIcon
          :name="icon"
          class="size-4.5"
        />
      </span>
      <span
        v-if="!loading && deltaState"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums shrink-0"
        :class="deltaState.class"
      >
        <UIcon
          :name="deltaState.icon"
          class="size-3.5"
        />
        {{ deltaState.text }}
      </span>
      <UIcon
        v-else-if="to"
        name="i-lucide-arrow-up-right"
        class="size-4 text-muted opacity-0 transition group-hover:opacity-100"
      />
    </div>
    <USkeleton
      v-if="loading"
      class="mt-4 h-8 w-28"
    />
    <p
      v-else
      class="mt-3 font-display text-xl sm:text-[28px] leading-tight font-bold tracking-tight text-highlighted tabular-nums truncate"
    >
      {{ value }}
    </p>
    <p class="mt-0.5 text-sm text-muted truncate">
      {{ label }}
    </p>
    <p
      v-if="!loading && hint"
      class="mt-1 text-xs text-dimmed truncate"
    >
      {{ hint }}
    </p>
  </component>
</template>
