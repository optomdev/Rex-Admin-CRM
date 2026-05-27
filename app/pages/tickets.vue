<script setup lang="ts">
import type { CrmTicket } from '~/types'

const search = ref('')
const statusFilter = ref('All')

const { data: tickets, status, refresh } = await useAsyncData<CrmTicket[]>('tickets', () => $fetch('/api/tickets'))

const statusItems = ['All', 'new', 'triage', 'waiting_on_customer', 'in_progress', 'blocked', 'resolved', 'closed']

const filteredTickets = computed(() => {
  const rows = tickets.value ?? []
  return rows.filter((ticket) => {
    const haystack = `${ticket.subject ?? ''} ${ticket.description} ${ticket.reporter_name ?? ''} ${ticket.customer?.name ?? ''}`.toLowerCase()
    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'All' || ticket.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})
</script>

<template>
  <UDashboardPanel id="tickets">
    <template #header>
      <UDashboardNavbar title="Tickets">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-send"
            label="Reply"
            color="neutral"
            variant="outline"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search tickets..."
            class="w-72"
          />
          <USelect v-model="statusFilter" :items="statusItems" class="w-56" />
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
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="divide-y divide-default rounded-lg border border-default">
        <div
          v-for="ticket in filteredTickets"
          :key="ticket.id"
          class="grid gap-4 p-4 xl:grid-cols-[1fr_15rem_12rem]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="ticket.priority" :color="ticket.priority === 'urgent' ? 'error' : ticket.priority === 'high' ? 'warning' : 'neutral'" variant="subtle" />
              <span class="text-sm text-muted">{{ ticket.rex_ticket_id || 'No Rex id yet' }}</span>
            </div>
            <p class="mt-2 font-medium text-highlighted">
              {{ ticket.subject || ticket.description }}
            </p>
            <p class="mt-1 line-clamp-2 text-sm text-muted">
              {{ ticket.description }}
            </p>
          </div>

          <div class="text-sm">
            <p class="font-medium text-highlighted">
              {{ ticket.customer?.name || 'Unlinked customer' }}
            </p>
            <p class="mt-1 text-muted">
              {{ ticket.reporter_name || 'Unknown reporter' }}
            </p>
            <p class="truncate text-muted">
              {{ ticket.reporter_email }}
            </p>
          </div>

          <div class="flex items-start justify-between gap-3 xl:justify-end">
            <div class="text-sm xl:text-right">
              <UBadge :label="ticket.status.replaceAll('_', ' ')" color="primary" variant="outline" />
              <p class="mt-2 text-muted">
                {{ ticket.app_version || 'No version' }}
              </p>
            </div>
            <UDropdownMenu
              :items="[[
                { label: 'Mark in progress', icon: 'i-lucide-play', disabled: true },
                { label: 'Mark resolved', icon: 'i-lucide-check', disabled: true }
              ], [
                { label: 'Send reply', icon: 'i-lucide-send', disabled: true }
              ]]"
            >
              <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" />
            </UDropdownMenu>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
