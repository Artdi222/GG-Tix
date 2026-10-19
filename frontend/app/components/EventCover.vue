<script setup lang="ts">
const props = defineProps<{ title: string, src?: string | null }>()

const failed = ref(false)
watch(() => props.src, () => {
  failed.value = false
})

/** Stable per-title gradient so events stay recognizable before a banner is uploaded. */
const cover = computed(() => {
  let hash = 0
  for (const ch of props.title) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  const initials = props.title
    .split(/[\s:—-]+/)
    .filter(w => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')
  return {
    initials,
    background: `linear-gradient(135deg, oklch(0.55 0.16 ${hue}) 0%, oklch(0.32 0.12 ${(hue + 40) % 360}) 100%)`
  }
})
</script>

<template>
  <div class="relative overflow-hidden rounded-md ring ring-default">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="size-full object-cover"
      loading="lazy"
      @error="failed = true"
    >
    <div
      v-else
      class="size-full grid place-items-center text-white/90 font-semibold tracking-tight text-xs"
      :style="{ background: cover.background }"
      aria-hidden="true"
    >
      {{ cover.initials }}
    </div>
  </div>
</template>
