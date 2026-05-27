<script setup lang="ts">
import type { Release } from '~/types'

const toast = useToast()
const syncing = ref(false)

const { data: releases, status, refresh } = await useAsyncData<Release[]>('releases', () => $fetch('/api/releases'))

async function syncReleases() {
  syncing.value = true

  try {
    const result = await $fetch<{ imported: number, simulated?: boolean, message?: string }>('/api/releases/sync', {
      method: 'POST'
    })

    toast.add({
      title: result.simulated ? 'Sync checked' : 'GitHub releases synced',
      description: result.message || `${result.imported} releases imported or updated.`,
      color: result.simulated ? 'warning' : 'success',
      icon: result.simulated ? 'i-lucide-alert-triangle' : 'i-lucide-check'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Release sync failed',
      description: error instanceof Error ? error.message : 'Check GitHub environment settings.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="releases">
    <template #header>
      <UDashboardNavbar title="Versions">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            label="Sync GitHub"
            :loading="syncing"
            @click="syncReleases"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-4 xl:grid-cols-2">
        <UCard
          v-for="release in releases"
          :key="release.id"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge :label="release.version" color="secondary" variant="subtle" />
                <span class="text-sm text-muted">{{ release.published_at ? new Date(release.published_at).toLocaleDateString('en-GB') : 'Unpublished' }}</span>
              </div>
              <h2 class="mt-3 font-semibold text-highlighted">
                {{ release.title }}
              </h2>
              <p class="mt-2 line-clamp-3 text-sm text-muted">
                {{ release.release_notes || 'No release notes stored yet.' }}
              </p>
            </div>
            <UButton
              v-if="release.github_url"
              :to="release.github_url"
              target="_blank"
              icon="i-simple-icons-github"
              color="neutral"
              variant="ghost"
            />
          </div>
        </UCard>
      </div>

      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UButton
          icon="i-lucide-refresh-cw"
          label="Loading releases"
          color="neutral"
          variant="ghost"
          loading
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
