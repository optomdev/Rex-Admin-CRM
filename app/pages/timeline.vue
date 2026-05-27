<script setup lang="ts">
import type { TimelineItem } from '~/types'

const { data: items, status } = await useAsyncData<TimelineItem[]>('timeline', () => $fetch('/api/timeline'))

const iconForType = (type: TimelineItem['item_type']) => {
  if (type === 'ticket') return 'i-lucide-life-buoy'
  if (type === 'message') return 'i-lucide-message-square'
  if (type === 'onboarding') return 'i-lucide-list-checks'
  if (type === 'charge') return 'i-lucide-receipt'
  if (type === 'release') return 'i-lucide-git-branch'
  return 'i-lucide-sticky-note'
}
</script>

<template>
  <UDashboardPanel id="timeline">
    <template #header>
      <UDashboardNavbar title="Timeline">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-4xl space-y-4">
        <div
          v-for="item in items"
          :key="item.id"
          class="grid grid-cols-[2.5rem_1fr] gap-4"
        >
          <div class="flex justify-center">
            <div class="flex size-9 items-center justify-center rounded-md bg-elevated ring-1 ring-default">
              <UIcon :name="iconForType(item.item_type)" class="size-4 text-muted" />
            </div>
          </div>
          <div class="rounded-lg border border-default p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-medium text-highlighted">
                {{ item.title }}
              </p>
              <span class="text-xs text-muted">
                {{ new Date(item.occurred_at).toLocaleString('en-GB') }}
              </span>
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ item.customer?.name }} - {{ item.body }}
            </p>
            <UBadge
              class="mt-3"
              :label="item.item_type"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>

        <UAlert
          v-if="!items?.length && status !== 'pending'"
          icon="i-lucide-history"
          color="neutral"
          title="No timeline items yet"
          description="Tickets, charges, onboarding updates, releases, and notes will appear here."
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
