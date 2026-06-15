<script setup lang="ts">
import type { CrmCustomer, CrmTicket, TicketDetail, TicketMessage, TicketPriority, TicketStatus } from '~/types'

const search = ref('')
const statusFilter = ref('All')
const detailOpen = ref(false)
const detailLoading = ref(false)
const workflowSaving = ref(false)
const replySending = ref(false)
const noteSaving = ref(false)
const retryingMessageId = ref<string | null>(null)
const selectedTicketId = ref<string | null>(null)
const selectedStatus = ref<TicketStatus>('new')
const selectedPriority = ref<TicketPriority>('normal')
const selectedAssignment = ref('')
const selectedCustomerId = ref('')
const replyBody = ref('')
const internalNote = ref('')
const ticketDetail = ref<TicketDetail | null>(null)
const toast = useToast()
const route = useRoute()
const router = useRouter()

const { data: tickets, status, refresh } = await useAsyncData<CrmTicket[]>('tickets', () => $fetch('/api/tickets'))
const { data: customers } = await useAsyncData<CrmCustomer[]>('ticket-customers', () => $fetch('/api/customers'))

const ticketStatuses: TicketStatus[] = ['new', 'triage', 'waiting_on_customer', 'in_progress', 'blocked', 'resolved', 'closed']
const ticketPriorities: TicketPriority[] = ['low', 'normal', 'high', 'urgent']
const statusItems = ['All', ...ticketStatuses]
const customerItems = computed(() => [{
  label: 'Unlinked customer',
  value: ''
}, ...(customers.value ?? []).map(customer => ({
  label: customer.name,
  value: customer.id
}))])

const statusTone: Record<TicketStatus, 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
  new: 'neutral',
  triage: 'secondary',
  waiting_on_customer: 'warning',
  in_progress: 'primary',
  blocked: 'error',
  resolved: 'success',
  closed: 'neutral'
}

const statusIcon: Record<TicketStatus, string> = {
  new: 'i-lucide-sparkles',
  triage: 'i-lucide-clipboard-list',
  waiting_on_customer: 'i-lucide-hourglass',
  in_progress: 'i-lucide-loader-circle',
  blocked: 'i-lucide-octagon-alert',
  resolved: 'i-lucide-circle-check',
  closed: 'i-lucide-archive'
}

const filteredTickets = computed(() => {
  const rows = tickets.value ?? []
  return rows.filter((ticket) => {
    const haystack = `${ticket.subject ?? ''} ${ticket.description} ${ticket.reporter_name ?? ''} ${ticket.customer?.name ?? ''}`.toLowerCase()
    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'All' || ticket.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

const currentTicket = computed(() => ticketDetail.value?.ticket ?? null)
const visibleMessages = computed(() => ticketDetail.value?.messages ?? [])
const visibleEvents = computed(() => ticketDetail.value?.events ?? [])
const currentCustomerLabel = computed(() => {
  if (!currentTicket.value) return 'Unlinked customer'
  return currentTicket.value.customer?.name || currentTicket.value.customer_identifier || 'Unlinked customer'
})

function priorityColor(priority: CrmTicket['priority']) {
  if (priority === 'urgent') return 'error'
  if (priority === 'high') return 'warning'
  return 'neutral'
}

function priorityIcon(priority: CrmTicket['priority']) {
  if (priority === 'urgent') return 'i-lucide-siren'
  if (priority === 'high') return 'i-lucide-arrow-up'
  if (priority === 'low') return 'i-lucide-arrow-down'
  return 'i-lucide-dot'
}

function messageColor(direction: string) {
  if (direction === 'outbound') return 'primary'
  if (direction === 'internal') return 'warning'
  return 'neutral'
}

function deliveryColor(deliveryStatus: TicketMessage['delivery_status']) {
  if (deliveryStatus === 'sent') return 'success'
  if (deliveryStatus === 'failed') return 'error'
  if (deliveryStatus === 'pending') return 'warning'
  return 'neutral'
}

function emailAttempts(message: TicketMessage) {
  const attempts = message.metadata?.email_attempts
  return typeof attempts === 'number' ? attempts : null
}

function lastEmailError(message: TicketMessage) {
  const error = message.metadata?.last_email_error
  return typeof error === 'string' && error ? error : null
}

function ticketTitle(ticket: CrmTicket) {
  return ticket.subject || ticket.description.split('\n')[0] || 'Untitled ticket'
}

function customerLabel(ticket: CrmTicket) {
  return ticket.customer?.name || ticket.customer_identifier || 'Unlinked customer'
}

function eventLabel(eventType: string) {
  return eventType
    .replace(/^support_ticket\./, '')
    .replaceAll('_', ' ')
}

async function loadTicket(ticketId: string) {
  detailLoading.value = true
  selectedTicketId.value = ticketId

  try {
    ticketDetail.value = await $fetch<TicketDetail>(`/api/tickets/${ticketId}`)
    selectedStatus.value = ticketDetail.value.ticket.status
    selectedPriority.value = ticketDetail.value.ticket.priority
    selectedAssignment.value = ticketDetail.value.ticket.assignment || ''
    selectedCustomerId.value = ticketDetail.value.ticket.customer_id || ''
  } catch (error) {
    toast.add({
      title: 'Could not load ticket',
      description: error instanceof Error ? error.message : 'Try refreshing the ticket list.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    detailLoading.value = false
  }
}

async function openTicket(ticket: CrmTicket) {
  detailOpen.value = true
  await loadTicket(ticket.id)
}

function closeTicketDetail() {
  detailOpen.value = false
}

watch(() => route.query.ticket, async (ticketParam) => {
  if (!import.meta.client) return

  if (typeof ticketParam === 'string' && ticketParam) {
    detailOpen.value = true
    router.replace({ query: { ...route.query, ticket: undefined } })
    await loadTicket(ticketParam)
  }
}, { immediate: true })

async function saveWorkflow() {
  if (!selectedTicketId.value) return

  workflowSaving.value = true

  try {
    await $fetch<CrmTicket>(`/api/tickets/${selectedTicketId.value}`, {
      method: 'PATCH',
      body: {
        status: selectedStatus.value,
        priority: selectedPriority.value,
        assignment: selectedAssignment.value || null,
        customer_id: selectedCustomerId.value || null
      }
    })

    toast.add({
      title: 'Workflow saved',
      description: 'Ticket priority, ownership, customer link, and status are up to date.',
      color: 'success',
      icon: 'i-lucide-check'
    })

    await refresh()
    await loadTicket(selectedTicketId.value)
  } catch (error) {
    toast.add({
      title: 'Could not save workflow',
      description: error instanceof Error ? error.message : 'The ticket workflow was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    workflowSaving.value = false
  }
}

async function sendReply() {
  if (!selectedTicketId.value || !replyBody.value.trim()) return

  replySending.value = true

  try {
    const result = await $fetch<{ retryable?: boolean, email?: { error?: string | null, skipped?: boolean } }>(`/api/tickets/${selectedTicketId.value}/reply`, {
      method: 'POST',
      body: {
        body: replyBody.value.trim(),
        author_name: 'Rex Admin'
      }
    })

    toast.add({
      title: result.retryable ? 'Reply stored locally' : 'Reply emailed',
      description: result.retryable
        ? result.email?.error || 'Stored in the CRM. Email delivery needs server-side configuration.'
        : 'The reporter has been emailed.',
      color: result.retryable ? 'warning' : 'success',
      icon: result.retryable ? 'i-lucide-mail-warning' : 'i-lucide-send'
    })

    replyBody.value = ''
    await loadTicket(selectedTicketId.value)
  } catch (error) {
    toast.add({
      title: 'Could not send reply',
      description: error instanceof Error ? error.message : 'The reply was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    replySending.value = false
  }
}

async function retryReply(message: TicketMessage) {
  if (!selectedTicketId.value || message.delivery_status === 'sent') return

  retryingMessageId.value = message.id

  try {
    const result = await $fetch<{ retryable?: boolean, email?: { error?: string | null, skipped?: boolean } }>(`/api/tickets/messages/${message.id}/retry`, {
      method: 'POST'
    })

    toast.add({
      title: result.retryable ? 'Reply still stored locally' : 'Reply emailed',
      description: result.retryable
        ? result.email?.error || 'The CRM kept the reply, but email delivery still needs attention.'
        : 'The reporter has been emailed.',
      color: result.retryable ? 'warning' : 'success',
      icon: result.retryable ? 'i-lucide-mail-warning' : 'i-lucide-send'
    })

    await loadTicket(selectedTicketId.value)
  } catch (error) {
    toast.add({
      title: 'Could not retry reply',
      description: error instanceof Error ? error.message : 'The email retry did not run.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    retryingMessageId.value = null
  }
}

async function saveInternalNote() {
  if (!selectedTicketId.value || !internalNote.value.trim()) return

  noteSaving.value = true

  try {
    await $fetch(`/api/tickets/${selectedTicketId.value}/notes`, {
      method: 'POST',
      body: {
        body: internalNote.value.trim(),
        author_name: 'Rex Admin'
      }
    })

    toast.add({
      title: 'Internal note saved',
      color: 'success',
      icon: 'i-lucide-check'
    })

    internalNote.value = ''
    await loadTicket(selectedTicketId.value)
  } catch (error) {
    toast.add({
      title: 'Could not save note',
      description: error instanceof Error ? error.message : 'The note was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    noteSaving.value = false
  }
}
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
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            @click="refresh()"
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
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="overflow-hidden rounded-lg border border-default bg-default">
        <div class="grid gap-3 border-b border-default bg-elevated/40 px-4 py-3 text-xs font-medium uppercase text-muted xl:grid-cols-[1fr_15rem_12rem]">
          <span>Issue</span>
          <span>Customer</span>
          <span class="xl:text-right">Workflow</span>
        </div>

        <button
          v-for="ticket in filteredTickets"
          :key="ticket.id"
          class="group grid w-full gap-4 border-b border-default p-4 text-left transition last:border-b-0 hover:bg-elevated/50 xl:grid-cols-[1fr_15rem_12rem]"
          type="button"
          @click="openTicket(ticket)"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :label="ticket.priority"
                :icon="priorityIcon(ticket.priority)"
                :color="priorityColor(ticket.priority)"
                variant="subtle"
              />
              <span class="text-sm text-muted">{{ ticket.rex_ticket_id || 'No Rex id yet' }}</span>
              <span class="text-sm text-muted">{{ formatRelativeTime(ticket.created_at) }}</span>
            </div>
            <p class="mt-2 font-medium text-highlighted">
              {{ ticketTitle(ticket) }}
            </p>
            <p class="mt-1 line-clamp-2 text-sm text-muted">
              {{ ticket.description }}
            </p>
          </div>

          <div class="text-sm">
            <p class="font-medium text-highlighted">
              <NuxtLink
                v-if="ticket.customer"
                :to="`/customers/${ticket.customer.id}`"
                class="hover:text-primary"
              >
                {{ customerLabel(ticket) }}
              </NuxtLink>
              <span v-else>{{ customerLabel(ticket) }}</span>
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
              <UBadge
                :label="formatStatusLabel(ticket.status)"
                :icon="statusIcon[ticket.status]"
                :color="statusTone[ticket.status]"
                variant="outline"
              />
              <p class="mt-2 text-muted">
                {{ ticket.app_version || 'No version' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Updated {{ formatRelativeTime(ticket.updated_at) }}
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="mt-1 size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-highlighted" />
          </div>
        </button>

        <div v-if="!filteredTickets.length" class="grid place-items-center px-4 py-16 text-center">
          <div class="max-w-sm">
            <div class="mx-auto flex size-12 items-center justify-center rounded-md bg-elevated">
              <UIcon name="i-lucide-search-x" class="size-5 text-muted" />
            </div>
            <p class="mt-4 font-medium text-highlighted">
              No tickets match that view
            </p>
            <p class="mt-1 text-sm text-muted">
              Clear the search or change the workflow filter.
            </p>
          </div>
        </div>
      </div>

      <USlideover
        v-model:open="detailOpen"
        :ui="{ content: 'sm:max-w-3xl' }"
      >
        <template #header>
          <div class="flex min-w-0 flex-1 items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold text-highlighted">
                {{ currentTicket ? ticketTitle(currentTicket) : 'Ticket detail' }}
              </h2>
              <p class="mt-1 truncate text-sm text-muted">
                {{ currentTicket?.rex_ticket_id || 'CRM ticket' }}
              </p>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              aria-label="Close ticket detail"
              @click="closeTicketDetail"
            />
          </div>
        </template>

        <template #body>
          <div v-if="detailLoading" class="space-y-3">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-32 w-full" />
            <USkeleton class="h-32 w-full" />
          </div>

          <div v-else-if="currentTicket" class="space-y-6">
            <div class="rounded-lg border border-default bg-elevated/30 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      :label="formatStatusLabel(currentTicket.status)"
                      :icon="statusIcon[currentTicket.status]"
                      :color="statusTone[currentTicket.status]"
                      variant="subtle"
                    />
                    <UBadge
                      :label="currentTicket.priority"
                      :icon="priorityIcon(currentTicket.priority)"
                      :color="priorityColor(currentTicket.priority)"
                      variant="outline"
                    />
                  </div>
                  <p class="mt-3 text-lg font-semibold text-highlighted">
                    {{ ticketTitle(currentTicket) }}
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    Raised {{ formatDateTime(currentTicket.created_at) }} by {{ currentTicket.reporter_name || 'Unknown reporter' }}
                  </p>
                </div>
                <UButton
                  v-if="currentTicket.page_url"
                  :to="currentTicket.page_url"
                  target="_blank"
                  icon="i-lucide-external-link"
                  label="Open page"
                  color="neutral"
                  variant="outline"
                />
              </div>
            </div>

            <div class="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-2">
              <div>
                <p class="text-xs font-medium uppercase text-muted">
                  Customer
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ currentCustomerLabel }}
                </p>
                <p v-if="currentTicket.rex_project_ref" class="mt-1 text-xs text-muted">
                  {{ currentTicket.rex_project_ref }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase text-muted">
                  Reporter
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ currentTicket.reporter_name || 'Unknown reporter' }}
                </p>
                <p class="truncate text-sm text-muted">
                  {{ currentTicket.reporter_email }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase text-muted">
                  Source
                </p>
                <p class="mt-1 text-sm text-highlighted">
                  {{ currentTicket.app_version || 'No version captured' }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ currentTicket.customer_identifier || 'Rex deployment' }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase text-muted">
                  Assignment
                </p>
                <p class="mt-1 text-sm text-highlighted">
                  {{ currentTicket.assignment || 'Unassigned' }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase text-muted">
                  Last Updated
                </p>
                <p class="mt-1 text-sm text-highlighted">
                  {{ formatDateTime(currentTicket.updated_at) }}
                </p>
                <p class="text-xs text-muted">
                  {{ formatRelativeTime(currentTicket.updated_at) }}
                </p>
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-sm font-medium text-highlighted">
                Description
              </p>
              <p class="whitespace-pre-wrap rounded-lg border border-default p-4 text-sm text-muted">
                {{ currentTicket.description }}
              </p>
            </div>

            <UAlert
              v-if="currentTicket.last_sync_error"
              icon="i-lucide-cloud-off"
              color="warning"
              title="Stored locally in the CRM"
              :description="currentTicket.last_sync_error"
            />

            <div class="space-y-3">
              <p class="text-sm font-medium text-highlighted">
                Workflow
              </p>
              <div class="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-2">
                <UFormField label="Customer">
                  <USelect
                    v-model="selectedCustomerId"
                    :items="customerItems"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Assigned to">
                  <UInput
                    v-model="selectedAssignment"
                    placeholder="Rex Admin"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Priority">
                  <USelect
                    v-model="selectedPriority"
                    :items="ticketPriorities"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Status">
                  <USelect
                    v-model="selectedStatus"
                    :items="ticketStatuses"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-save"
                  label="Save workflow"
                  :loading="workflowSaving"
                  @click="saveWorkflow"
                />
              </div>
            </div>

            <details class="rounded-lg border border-default p-4">
              <summary class="cursor-pointer text-sm font-medium text-highlighted">
                Submission Context
              </summary>
              <div class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p class="text-xs font-medium uppercase text-muted">
                    Page URL
                  </p>
                  <p class="mt-1 break-all text-muted">
                    {{ currentTicket.page_url || 'Not captured' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs font-medium uppercase text-muted">
                    Screenshots
                  </p>
                  <p class="mt-1 text-muted">
                    {{ Array.isArray(currentTicket.screenshot_metadata) ? currentTicket.screenshot_metadata.length : 'Metadata stored' }}
                  </p>
                </div>
              </div>
            </details>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-highlighted">
                  Messages
                </p>
                <UBadge :label="visibleMessages.length.toString()" color="neutral" variant="outline" />
              </div>

              <div v-if="visibleMessages.length" class="space-y-3">
                <div
                  v-for="message in visibleMessages"
                  :key="message.id"
                  class="rounded-lg border border-default p-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <UBadge :label="message.direction" :color="messageColor(message.direction)" variant="subtle" />
                    <span class="text-xs text-muted">{{ new Date(message.created_at).toLocaleString('en-GB') }}</span>
                  </div>
                  <p class="mt-3 whitespace-pre-wrap text-sm text-highlighted">
                    {{ message.body }}
                  </p>
                  <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{{ message.author_name || 'Unknown author' }}</span>
                      <UBadge
                        :label="message.delivery_status"
                        :color="deliveryColor(message.delivery_status)"
                        variant="soft"
                        size="xs"
                      />
                      <span v-if="emailAttempts(message)">
                        {{ emailAttempts(message) }} email {{ emailAttempts(message) === 1 ? 'attempt' : 'attempts' }}
                      </span>
                    </div>
                    <UButton
                      v-if="message.direction === 'outbound' && message.delivery_status === 'failed'"
                      icon="i-lucide-refresh-cw"
                      label="Retry email"
                      color="neutral"
                      variant="outline"
                      size="xs"
                      :loading="retryingMessageId === message.id"
                      @click="retryReply(message)"
                    />
                  </div>
                  <UAlert
                    v-if="lastEmailError(message)"
                    class="mt-3"
                    icon="i-lucide-mail-warning"
                    color="warning"
                    title="Email delivery failed"
                    :description="lastEmailError(message) || undefined"
                  />
                </div>
              </div>

              <UAlert
                v-else
                icon="i-lucide-message-square"
                color="neutral"
                variant="subtle"
                title="No messages yet"
                description="Replies and internal notes will appear here."
              />
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium text-highlighted">
                Send Reply
              </p>
              <UTextarea
                v-model="replyBody"
                :rows="4"
                autoresize
                placeholder="Write a customer-facing reply..."
                class="w-full"
              />
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-send"
                  label="Send reply"
                  :loading="replySending"
                  :disabled="!replyBody.trim()"
                  @click="sendReply"
                />
              </div>
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium text-highlighted">
                Internal Note
              </p>
              <UTextarea
                v-model="internalNote"
                :rows="3"
                autoresize
                placeholder="Add a private CRM note..."
                class="w-full"
              />
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-sticky-note"
                  label="Save note"
                  color="neutral"
                  variant="outline"
                  :loading="noteSaving"
                  :disabled="!internalNote.trim()"
                  @click="saveInternalNote"
                />
              </div>
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium text-highlighted">
                Recent Events
              </p>
              <div class="space-y-2">
                <div
                  v-for="event in visibleEvents"
                  :key="event.id"
                  class="flex items-center justify-between rounded-md bg-elevated px-3 py-2 text-sm"
                >
                  <span class="capitalize text-highlighted">{{ eventLabel(event.event_type) }}</span>
                  <span class="text-xs text-muted">{{ new Date(event.created_at).toLocaleString('en-GB') }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
