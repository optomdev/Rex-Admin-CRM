<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#020617' : '#F8FAFC')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon.png?v=20261101-teal' },
    { rel: 'shortcut icon', href: '/favicon.ico?v=20261101-teal' },
    { rel: 'apple-touch-icon', href: '/favicon.png?v=20261101-teal' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Rex Admin CRM'
const description = 'Private operating console for Rex customers, tickets, onboarding, charges, versions, releases, and follow-ups.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
