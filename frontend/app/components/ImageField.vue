<script setup lang="ts">
import type { UploadKind } from '~/composables/useImageUpload'

const props = defineProps<{
  kind: UploadKind
  /** Tailwind aspect class for the preview, e.g. "aspect-video". */
  aspect?: string
  hint?: string
  /** Fixed preview height (Tailwind class, e.g. "h-36"); width then follows `aspect`. */
  height?: string
}>()

const model = defineModel<string>({ default: '' })
const { upload, uploading, error, accept } = useImageUpload()
const input = ref<HTMLInputElement | null>(null)

async function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const url = await upload(target.files?.[0], props.kind)
  if (url) model.value = url
  target.value = ''
}
</script>

<template>
  <div>
    <div
      class="relative overflow-hidden rounded-lg border border-dashed border-accented bg-elevated/40 grid place-items-center"
      :class="[aspect ?? 'aspect-video', height ? `${height} w-auto` : 'w-full']"
    >
      <img
        v-if="model"
        :src="model"
        alt=""
        class="absolute inset-0 size-full object-cover"
      >
      <div
        v-else
        class="text-center px-4"
      >
        <UIcon
          name="i-lucide-image-plus"
          class="size-6 text-dimmed"
        />
        <p
          v-if="!height"
          class="mt-1 text-xs text-muted"
        >
          {{ hint ?? 'PNG, JPG, atau WebP · maks. 10 MB' }}
        </p>
      </div>
      <div
        v-if="uploading"
        class="absolute inset-0 grid place-items-center bg-default/70"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-primary"
        />
      </div>
    </div>
    <div class="mt-2 flex items-center gap-2">
      <UButton
        :label="model ? 'Ganti' : 'Pilih'"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        :size="height ? 'xs' : 'md'"
        :loading="uploading"
        @click="input?.click()"
      />
      <UButton
        v-if="model"
        label="Hapus"
        :size="height ? 'xs' : 'md'"
        color="neutral"
        variant="ghost"
        :disabled="uploading"
        @click="model = ''"
      />
      <input
        ref="input"
        type="file"
        :accept="accept"
        class="hidden"
        @change="onChange"
      >
    </div>
    <p
      v-if="error"
      class="mt-1 text-xs text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
