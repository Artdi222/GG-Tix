<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'id' },
  titleTemplate: title => (title ? `${title} · GGTIX Admin` : 'GGTIX Admin')
})

useSeoMeta({
  description: 'Konsol admin GGTIX untuk mengelola event, tiket, dan pesanan.',
  robots: 'noindex, nofollow'
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
