<script setup lang="ts">
const props = defineProps<{
  points: { date: string, value: number }[]
  format: (value: number) => string
  /** Compact formatter for axis labels. */
  axisFormat?: (value: number) => string
  label: string
}>()

const W = 600
const H = 220
const hover = ref<number | null>(null)
const chart = ref<HTMLElement | null>(null)

/** A "nice" axis maximum (1, 2, 2.5 or 5 x 10^n) so gridlines land on round numbers. */
const yMax = computed(() => {
  const max = Math.max(0, ...props.points.map(p => p.value))
  if (max === 0) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => s * pow >= max)!
  return step * pow
})

const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => yMax.value * f))

function x(i: number) {
  return props.points.length <= 1 ? W / 2 : (i / (props.points.length - 1)) * W
}
function y(v: number) {
  return H - (v / yMax.value) * H
}

const line = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' '))
const area = computed(() => props.points.length ? `${line.value} L${x(props.points.length - 1)},${H} L${x(0)},${H} Z` : '')

const xLabels = computed(() => {
  const n = props.points.length
  if (!n) return []
  const count = Math.min(n, 6)
  return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / Math.max(count - 1, 1)))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map(i => ({ i, left: `${(x(i) / W) * 100}%`, text: shortDate(props.points[i]!.date) }))
})

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function onMove(e: PointerEvent) {
  const el = chart.value
  if (!el || !props.points.length) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
  hover.value = Math.round(ratio * (props.points.length - 1))
}

const active = computed(() => hover.value === null ? null : { ...props.points[hover.value]!, i: hover.value })
const isEmpty = computed(() => props.points.every(p => p.value === 0))
</script>

<template>
  <div class="flex gap-3">
    <div
      class="flex flex-col justify-between text-right text-xs text-dimmed tabular-nums h-55 -my-1.5 shrink-0"
      :class="{ invisible: isEmpty }"
      aria-hidden="true"
    >
      <span
        v-for="t in [...ticks].reverse()"
        :key="t"
      >{{ (axisFormat ?? format)(t) }}</span>
    </div>

    <div class="flex-1 min-w-0">
      <div
        ref="chart"
        class="relative h-55"
        role="img"
        :aria-label="`${label}: grafik ${points.length} hari`"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
          class="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient
              id="trend-fill"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stop-color="var(--ui-primary)"
                stop-opacity="0.18"
              />
              <stop
                offset="100%"
                stop-color="var(--ui-primary)"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>
          <line
            v-for="t in ticks"
            :key="t"
            x1="0"
            :x2="W"
            :y1="y(t)"
            :y2="y(t)"
            stroke="var(--ui-border)"
            :stroke-dasharray="t === 0 ? undefined : '3 4'"
            vector-effect="non-scaling-stroke"
          />
          <path
            v-if="!isEmpty"
            :d="area"
            fill="url(#trend-fill)"
          />
          <path
            v-if="!isEmpty"
            :d="line"
            fill="none"
            stroke="var(--ui-primary)"
            stroke-width="2"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-if="active"
            :x1="x(active.i)"
            :x2="x(active.i)"
            y1="0"
            :y2="H"
            stroke="var(--ui-border-accented)"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <span
          v-if="active && !isEmpty"
          class="absolute size-2.5 rounded-full bg-primary ring-2 ring-default -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          :style="{ left: `${(x(active.i) / W) * 100}%`, top: `${(y(active.value) / H) * 100}%` }"
        />
        <div
          v-if="active"
          class="absolute top-0 z-10 rounded-md border border-default bg-default px-2.5 py-1.5 shadow-sm pointer-events-none text-xs whitespace-nowrap"
          :class="active.i > points.length / 2 ? '-translate-x-full -ml-3' : 'ml-3'"
          :style="{ left: `${(x(active.i) / W) * 100}%` }"
        >
          <p class="text-muted">
            {{ shortDate(active.date) }}
          </p>
          <p class="font-semibold text-highlighted tabular-nums">
            {{ format(active.value) }}
          </p>
        </div>

        <p
          v-if="isEmpty"
          class="absolute inset-0 grid place-items-center text-sm text-muted"
        >
          Belum ada penjualan pada periode ini
        </p>
      </div>

      <div
        class="relative h-5 mt-2 text-xs text-dimmed"
        aria-hidden="true"
      >
        <span
          v-for="l in xLabels"
          :key="l.i"
          class="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
          :style="{ left: l.left }"
        >{{ l.text }}</span>
      </div>
    </div>
  </div>
</template>
