<script setup lang="ts">
import type { DashboardSummary } from '~/types'

const { data, status, refresh } = await useAsyncData<DashboardSummary>('dashboard-summary', () => $fetch('/api/summary'))

const openTickets = computed(() => (data.value?.tickets ?? []).filter(ticket => !['resolved', 'closed'].includes(ticket.status)))
const urgentTickets = computed(() => openTickets.value.filter(ticket => ['urgent', 'high'].includes(ticket.priority)))
const atRiskCustomers = computed(() => (data.value?.customers ?? []).filter(customer => customer.status === 'at_risk' || customer.health_score < 65))
const overdueCharges = computed(() => (data.value?.charges ?? []).filter(charge => charge.billing_status === 'overdue'))
const blockedLaunches = computed(() => (data.value?.onboarding ?? []).filter(project => project.status === 'blocked'))

const attentionItems = computed(() => {
  const items: Array<{ label: string, detail: string, icon: string, to: string, urgent: boolean }> = []

  if (urgentTickets.value.length) {
    items.push({
      label: `${urgentTickets.value.length} high-priority ticket${urgentTickets.value.length === 1 ? '' : 's'}`,
      detail: urgentTickets.value[0]?.subject || urgentTickets.value[0]?.description.split('\n')[0] || '',
      icon: 'i-lucide-siren',
      to: '/tickets',
      urgent: true
    })
  }

  if (blockedLaunches.value.length) {
    items.push({
      label: `${blockedLaunches.value.length} launch${blockedLaunches.value.length === 1 ? '' : 'es'} blocked`,
      detail: blockedLaunches.value.map(project => project.customer?.name || project.name).join(', '),
      icon: 'i-lucide-octagon-alert',
      to: '/onboarding',
      urgent: true
    })
  }

  if (atRiskCustomers.value.length) {
    items.push({
      label: `${atRiskCustomers.value.length} customer${atRiskCustomers.value.length === 1 ? '' : 's'} at risk`,
      detail: atRiskCustomers.value.map(customer => customer.name).join(', '),
      icon: 'i-lucide-heart-pulse',
      to: '/customers',
      urgent: false
    })
  }

  if (overdueCharges.value.length) {
    items.push({
      label: `${overdueCharges.value.length} overdue charge${overdueCharges.value.length === 1 ? '' : 's'}`,
      detail: overdueCharges.value.map(charge => charge.customer?.name).filter(Boolean).join(', '),
      icon: 'i-lucide-receipt',
      to: '/charges',
      urgent: false
    })
  }

  return items
})

function priorityDot(priority: string) {
  if (priority === 'urgent') return 'bg-error'
  if (priority === 'high') return 'bg-warning'
  return 'bg-(--ui-border-accented)'
}

function ticketTitle(subject?: string | null, description?: string | null) {
  return subject || description?.split('\n')[0] || 'Untitled ticket'
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
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            @click="refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <section>
        <h2 class="text-base font-semibold text-highlighted">
          Needs attention
        </h2>

        <ul v-if="attentionItems.length" class="mt-3 space-y-2">
          <li v-for="item in attentionItems" :key="item.label">
            <NuxtLink :to="item.to" class="group flex items-center gap-2 text-sm">
              <UIcon
                :name="item.icon"
                class="size-4 shrink-0"
                :class="item.urgent ? 'text-error' : 'text-warning'"
              />
              <span class="font-medium text-highlighted group-hover:underline">{{ item.label }}</span>
              <span class="truncate text-muted">— {{ item.detail }}</span>
            </NuxtLink>
          </li>
        </ul>

        <p v-else class="mt-3 flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-circle-check" class="size-4 text-success" />
          All clear. Nothing needs you right now.
        </p>
      </section>

      <div class="mt-8 grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <section>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-highlighted">
              Open Tickets
            </h2>
            <UButton
              to="/tickets"
              label="All tickets"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </div>

          <div v-if="openTickets.length" class="mt-2 divide-y divide-default">
            <NuxtLink
              v-for="ticket in openTickets"
              :key="ticket.id"
              :to="`/tickets?ticket=${ticket.id}`"
              class="flex items-center gap-3 py-3 transition hover:bg-elevated/40"
            >
              <span class="size-2 shrink-0 rounded-full" :class="priorityDot(ticket.priority)" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-highlighted">
                  {{ ticketTitle(ticket.subject, ticket.description) }}
                </p>
                <p class="mt-0.5 truncate text-sm text-muted">
                  {{ ticket.customer?.name || 'Unlinked customer' }} · {{ formatStatusLabel(ticket.status) }}
                </p>
              </div>
              <span class="shrink-0 text-xs text-muted">{{ formatRelativeTime(ticket.created_at) }}</span>
            </NuxtLink>
          </div>
          <p v-else class="mt-3 text-sm text-muted">
            No open tickets.
          </p>
        </section>

        <section>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-highlighted">
              Recent Activity
            </h2>
            <UButton
              to="/timeline"
              label="Timeline"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </div>

          <div v-if="data?.timeline?.length" class="mt-2 divide-y divide-default">
            <div
              v-for="item in data.timeline"
              :key="item.id"
              class="py-3"
            >
              <div class="flex items-baseline justify-between gap-3">
                <p class="min-w-0 truncate font-medium text-highlighted">
                  {{ item.title }}
                </p>
                <span class="shrink-0 text-xs text-muted">{{ formatRelativeTime(item.occurred_at) }}</span>
              </div>
              <p class="mt-0.5 truncate text-sm text-muted">
                <NuxtLink
                  v-if="item.customer"
                  :to="`/customers/${item.customer.id}`"
                  class="hover:underline"
                >
                  {{ item.customer.name }}
                </NuxtLink>
                <span v-if="item.customer && item.body"> · </span>
                <span v-if="item.body">{{ item.body }}</span>
              </p>
            </div>
          </div>
          <p v-else class="mt-3 text-sm text-muted">
            No activity yet.
          </p>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
