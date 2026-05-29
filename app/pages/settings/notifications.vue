<script setup lang="ts">
import type { FailedTicketMessage, SystemHealthMetric, SystemHealthSummary, WebhookDelivery, WebhookEvent } from '~/types'

const toast = useToast()
const { data: health, status, refresh } = await useAsyncData<SystemHealthSummary>('system-health', () => $fetch('/api/system-health'))

const metrics = computed(() => health.value?.metrics ?? [])
const recentWebhooks = computed(() => health.value?.recent_webhooks ?? [])
const failedMessages = computed(() => health.value?.failed_messages ?? [])
const webhookDeliveries = computed(() => health.value?.webhook_deliveries ?? [])

function metricColor(metric: SystemHealthMetric) {
  if (metric.tone === 'error') return 'error'
  if (metric.tone === 'warning') return 'warning'
  if (metric.tone === 'success') return 'success'
  if (metric.tone === 'primary') return 'primary'
  return 'neutral'
}

function webhookColor(event: WebhookEvent) {
  if (event.error) return 'error'
  if (!event.processed_at) return 'warning'
  return 'success'
}

function deliveryColor(delivery: WebhookDelivery) {
  if (delivery.status === 'failed') return 'error'
  if (delivery.status === 'pending') return 'warning'
  return 'success'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function messageError(message: FailedTicketMessage) {
  const error = message.metadata?.error
  if (typeof error === 'string' && error.trim()) return error
  return 'Open the ticket drawer and retry the reply after checking email configuration.'
}

async function refreshHealth() {
  await refresh()
  toast.add({
    title: 'Health refreshed',
    description: 'CRM operational signals are up to date.',
    color: 'success',
    icon: 'i-lucide-refresh-cw'
  })
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <UPageCard
        title="System Health"
        description="Rex webhook intake, failed customer replies, unlinked tickets, and callback backlog."
        variant="naked"
        class="min-w-0 flex-1"
      />

      <UButton
        icon="i-lucide-refresh-cw"
        label="Refresh"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refreshHealth"
      />
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-lg border border-default bg-default p-4 shadow-xs"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">
              {{ metric.label }}
            </p>
            <p class="mt-2 truncate text-2xl font-semibold text-highlighted">
              {{ metric.value }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ metric.detail }}
            </p>
          </div>
          <UBadge :color="metricColor(metric)" variant="subtle" square>
            <UIcon :name="metric.icon" class="size-4" />
          </UBadge>
        </div>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <UCard :ui="{ root: 'rounded-lg', body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">
                Rex Webhook Intake
              </h2>
              <p class="mt-1 text-sm text-muted">
                Latest signed events received from Rex deployments.
              </p>
            </div>
            <UBadge :label="`${recentWebhooks.length} shown`" color="neutral" variant="subtle" />
          </div>
        </template>

        <div v-if="recentWebhooks.length" class="divide-y divide-default">
          <div
            v-for="event in recentWebhooks"
            :key="event.id"
            class="grid gap-3 p-4 md:grid-cols-[1fr_9rem]"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :label="event.event_type"
                  :color="webhookColor(event)"
                  variant="subtle"
                />
                <span class="text-xs text-muted">{{ event.source }}</span>
              </div>
              <p class="mt-2 truncate text-sm font-medium text-highlighted">
                {{ event.idempotency_key }}
              </p>
              <p v-if="event.error" class="mt-1 text-sm text-error">
                {{ event.error }}
              </p>
              <p v-else class="mt-1 text-sm text-muted">
                {{ event.processed_at ? 'Processed' : 'Awaiting processing' }}
              </p>
            </div>
            <div class="text-sm text-muted md:text-right">
              {{ formatDateTime(event.created_at) }}
            </div>
          </div>
        </div>

        <UAlert
          v-else
          icon="i-lucide-inbox"
          color="neutral"
          variant="subtle"
          title="No Rex webhooks yet"
          description="Signed support-ticket events will appear here after Rex deployments post to /api/webhooks/rex."
          class="m-4"
        />
      </UCard>

      <UCard :ui="{ root: 'rounded-lg', body: 'p-0 sm:p-0' }">
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">
              Failed Ticket Replies
            </h2>
            <p class="mt-1 text-sm text-muted">
              Replies stored locally but not delivered by email.
            </p>
          </div>
        </template>

        <div v-if="failedMessages.length" class="divide-y divide-default">
          <div
            v-for="message in failedMessages"
            :key="message.id"
            class="p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <UBadge label="failed email" color="error" variant="subtle" />
              <span class="text-xs text-muted">{{ formatDateTime(message.created_at) }}</span>
            </div>
            <p class="mt-3 font-medium text-highlighted">
              {{ message.ticket?.subject || message.ticket?.rex_ticket_id || 'Ticket reply' }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ message.ticket?.customer?.name || message.ticket?.reporter_email || 'Unknown recipient' }}
            </p>
            <p class="mt-2 line-clamp-2 text-sm text-muted">
              {{ messageError(message) }}
            </p>
            <div class="mt-3">
              <UButton
                to="/tickets"
                icon="i-lucide-arrow-right"
                label="Open tickets"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
          </div>
        </div>

        <UAlert
          v-else
          icon="i-lucide-send"
          color="success"
          variant="subtle"
          title="No failed replies"
          description="Outbound customer replies are either sent or waiting for a ticket action."
          class="m-4"
        />
      </UCard>
    </div>

    <UCard :ui="{ root: 'rounded-lg', body: 'p-0 sm:p-0' }">
      <template #header>
        <div>
          <h2 class="font-semibold text-highlighted">
            Callback Backlog
          </h2>
          <p class="mt-1 text-sm text-muted">
            Stored outbound webhook deliveries, useful when CRM to Rex callbacks are enabled later.
          </p>
        </div>
      </template>

      <div v-if="webhookDeliveries.length" class="divide-y divide-default">
        <div
          v-for="delivery in webhookDeliveries"
          :key="delivery.id"
          class="grid gap-3 p-4 md:grid-cols-[1fr_8rem_9rem]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :label="delivery.status"
                :color="deliveryColor(delivery)"
                variant="subtle"
              />
              <span class="text-xs text-muted">{{ delivery.target }}</span>
            </div>
            <p class="mt-2 truncate text-sm font-medium text-highlighted">
              {{ delivery.event_type }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ delivery.last_error || delivery.idempotency_key }}
            </p>
          </div>
          <p class="text-sm text-muted md:text-right">
            {{ delivery.attempts }} attempts
          </p>
          <p class="text-sm text-muted md:text-right">
            {{ formatDateTime(delivery.last_attempted_at || delivery.updated_at) }}
          </p>
        </div>
      </div>

      <UAlert
        v-else
        icon="i-lucide-circle-check"
        color="neutral"
        variant="subtle"
        title="No callback backlog"
        description="V1 is currently one-way Rex intake plus CRM email replies, so this should normally stay empty."
        class="m-4"
      />
    </UCard>
  </div>
</template>
