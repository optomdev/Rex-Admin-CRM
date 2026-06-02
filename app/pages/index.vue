<script setup lang="ts">
import type { DashboardSummary } from '~/types'

const { data, status, refresh } = await useAsyncData<DashboardSummary>('dashboard-summary', () => $fetch('/api/summary'))

const metricColor = (tone: DashboardSummary['metrics'][number]['tone']) => {
  if (tone === 'error') return 'error'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'secondary') return 'secondary'
  if (tone === 'primary') return 'primary'
  return 'neutral'
}

const activeLaunches = computed(() => data.value?.onboarding.filter(project => !['live', 'paused'].includes(project.status)) ?? [])
const atRiskCustomers = computed(() => data.value?.customers.filter(customer => customer.status === 'at_risk' || customer.health_score < 65) ?? [])
const openCharges = computed(() => data.value?.charges.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)) ?? [])

const commandFeed = computed(() => [{
  label: 'Live tickets',
  value: `${data.value?.tickets.length ?? 0}`,
  detail: 'Latest support signals',
  icon: 'i-lucide-life-buoy',
  to: '/tickets',
  color: 'primary' as const
}, {
  label: 'Launches',
  value: `${activeLaunches.value.length}`,
  detail: 'Onboarding in motion',
  icon: 'i-lucide-rocket',
  to: '/onboarding',
  color: 'secondary' as const
}, {
  label: 'Attention',
  value: `${atRiskCustomers.value.length}`,
  detail: 'Customer health watch',
  icon: atRiskCustomers.value.length ? 'i-lucide-heart-pulse' : 'i-lucide-shield-check',
  to: '/customers',
  color: atRiskCustomers.value.length ? 'warning' as const : 'success' as const
}, {
  label: 'Ledger',
  value: `${openCharges.value.length}`,
  detail: 'Open charge items',
  icon: 'i-lucide-receipt',
  to: '/charges',
  color: 'warning' as const
}])

function compactTitle(text?: string | null) {
  return text || 'Untitled item'
}
</script>

<template>
  <UDashboardPanel id="control">
    <template #header>
      <UDashboardNavbar title="Control Centre">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UTooltip text="Refresh dashboard">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              :loading="status === 'pending'"
              @click="refresh()"
            />
          </UTooltip>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="item in commandFeed"
          :key="item.label"
          :to="item.to"
          class="rounded-lg border border-default bg-default p-4 shadow-xs transition hover:bg-elevated/60 hover:ring-2 hover:ring-primary/20"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted">
                {{ item.label }}
              </p>
              <p class="mt-2 text-2xl font-semibold text-highlighted">
                {{ item.value }}
              </p>
              <p class="mt-1 truncate text-sm text-muted">
                {{ item.detail }}
              </p>
            </div>
            <UBadge :color="item.color" variant="subtle" square>
              <UIcon :name="item.icon" class="size-4" />
            </UBadge>
          </div>
        </NuxtLink>
      </div>

      <div class="grid gap-4 lg:grid-cols-4">
        <UCard
          v-for="metric in data?.metrics"
          :key="metric.label"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm text-muted">
                {{ metric.label }}
              </p>
              <p class="mt-2 text-2xl font-semibold text-highlighted">
                {{ metric.value }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ metric.detail }}
              </p>
            </div>
            <UBadge :color="metricColor(metric.tone)" variant="subtle" square>
              <UIcon :name="metric.icon" class="size-4" />
            </UBadge>
          </div>
        </UCard>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-highlighted">
              Active Tickets
            </h2>
            <UButton
              to="/tickets"
              label="Open tickets"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </div>

          <div class="divide-y divide-default rounded-lg border border-default">
            <div
              v-for="ticket in data?.tickets"
              :key="ticket.id"
              class="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge :label="ticket.priority" :color="ticket.priority === 'urgent' ? 'error' : ticket.priority === 'high' ? 'warning' : 'neutral'" variant="subtle" />
                  <NuxtLink
                    v-if="ticket.customer"
                    :to="`/customers/${ticket.customer.id}`"
                    class="text-sm text-muted hover:text-primary"
                  >
                    {{ ticket.customer.name }}
                  </NuxtLink>
                  <span v-else class="text-sm text-muted">Unlinked customer</span>
                </div>
                <p class="mt-2 truncate font-medium text-highlighted">
                  {{ compactTitle(ticket.subject || ticket.description) }}
                </p>
                <p class="mt-1 truncate text-sm text-muted">
                  {{ ticket.reporter_name }} - {{ ticket.page_url }}
                </p>
              </div>
              <UBadge :label="ticket.status.replaceAll('_', ' ')" color="primary" variant="outline" />
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-highlighted">
              Customer Timeline
            </h2>
            <UButton
              to="/timeline"
              label="View all"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </div>

          <div class="space-y-3">
            <div
              v-for="item in data?.timeline"
              :key="item.id"
              class="rounded-lg border border-default p-4"
            >
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated">
                  <UIcon name="i-lucide-history" class="size-4 text-muted" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-highlighted">
                    {{ item.title }}
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    <NuxtLink
                      v-if="item.customer"
                      :to="`/customers/${item.customer.id}`"
                      class="hover:text-primary"
                    >
                      {{ item.customer.name }}
                    </NuxtLink>
                    <span v-else>Unknown customer</span>
                    - {{ item.body }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
