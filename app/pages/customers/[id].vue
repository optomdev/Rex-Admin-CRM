<script setup lang="ts">
import type { Charge, CrmCustomer, CustomerDetail, CustomerPricingItem, Release, TimelineItem } from '~/types'

const route = useRoute()
const customerId = computed(() => route.params.id as string)
const NuxtLinkComponent = resolveComponent('NuxtLink')

const { data: detail, status, refresh } = await useAsyncData<CustomerDetail>(
  () => `customer-detail-${customerId.value}`,
  () => $fetch(`/api/customers/${customerId.value}`),
  { watch: [customerId] }
)
const { data: customerPricingItems } = await useAsyncData<CustomerPricingItem[]>(
  () => `customer-billing-${customerId.value}`,
  () => $fetch('/api/customer-pricing-items'),
  { watch: [customerId] }
)
const { data: releases } = await useAsyncData<Release[]>('customer-release-options', () => $fetch('/api/releases'))

const editOpen = ref(false)

const customer = computed(() => detail.value?.customer ?? null)
const contacts = computed(() => detail.value?.contacts ?? [])
const branches = computed(() => detail.value?.branches ?? [])
const deployments = computed(() => detail.value?.deployments ?? [])
const tickets = computed(() => detail.value?.tickets ?? [])
const onboarding = computed(() => detail.value?.onboarding ?? [])
const charges = computed(() => detail.value?.charges ?? [])
const timeline = computed(() => detail.value?.timeline ?? [])
const billingLines = computed(() => (customerPricingItems.value ?? [])
  .filter(item => item.customer_id === customerId.value && item.is_active))

const primaryDeployment = computed(() => deployments.value.find(deployment => deployment.is_primary) ?? deployments.value[0] ?? null)
const openTickets = computed(() => tickets.value.filter(ticket => !['resolved', 'closed'].includes(ticket.status)))
const urgentTicketCount = computed(() => openTickets.value.filter(ticket => ['high', 'urgent'].includes(ticket.priority)).length)
const openCharges = computed(() => charges.value.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)))
const openChargeTotal = computed(() => openCharges.value.reduce((sum, charge) => sum + Number(charge.amount), 0))
const activeOnboarding = computed(() => onboarding.value.find(project => !['live', 'paused'].includes(project.status)) ?? null)
const monthlyBillingTotal = computed(() => billingLines.value.length
  ? billingLines.value.reduce((sum, line) => sum + lineTotal(line), 0)
  : customer.value?.recurring_monthly_amount ?? 0)

const metrics = computed(() => [{
  label: 'Monthly',
  value: formatMoney(monthlyBillingTotal.value),
  detail: billingLines.value.length ? `${billingLines.value.length} agreed line${billingLines.value.length === 1 ? '' : 's'}` : 'Recurring fallback',
  icon: 'i-lucide-banknote',
  color: 'primary' as const
}, {
  label: 'Open charges',
  value: formatMoney(openChargeTotal.value),
  detail: `${openCharges.value.length} unpaid item${openCharges.value.length === 1 ? '' : 's'}`,
  icon: 'i-lucide-receipt',
  color: openCharges.value.length ? 'warning' as const : 'success' as const
}, {
  label: 'Open tickets',
  value: openTickets.value.length.toString(),
  detail: urgentTicketCount.value ? `${urgentTicketCount.value} high priority` : 'No urgent pressure',
  icon: 'i-lucide-life-buoy',
  color: urgentTicketCount.value ? 'error' as const : openTickets.value.length ? 'warning' as const : 'neutral' as const
}, {
  label: 'Health',
  value: `${customer.value?.health_score ?? 0}%`,
  detail: customer.value ? formatStatusLabel(customer.value.status) : 'Loading',
  icon: 'i-lucide-heart-pulse',
  color: healthScoreColor(customer.value?.health_score ?? 0)
}])

const attentionItems = computed(() => {
  const items: Array<{
    title: string
    detail: string
    icon: string
    color: 'error' | 'warning' | 'neutral'
    to?: string
  }> = []

  if (!primaryDeployment.value) {
    items.push({
      title: 'No deployment attached',
      detail: 'Add the customer Supabase project before relying on webhook routing.',
      icon: 'i-lucide-cloud-off',
      color: 'warning'
    })
  } else {
    if (primaryDeployment.value.health_status === 'down' || primaryDeployment.value.status === 'error') {
      items.push({
        title: 'Deployment needs attention',
        detail: `${primaryDeployment.value.name} is marked ${primaryDeployment.value.health_status}/${primaryDeployment.value.status}.`,
        icon: 'i-lucide-triangle-alert',
        color: 'error'
      })
    }

    if (primaryDeployment.value.health_status === 'unknown') {
      items.push({
        title: 'Deployment health unknown',
        detail: 'The CRM has not seen a fresh signal from this environment yet.',
        icon: 'i-lucide-circle-help',
        color: 'neutral'
      })
    }

    if (!primaryDeployment.value.deployed_release_id && !primaryDeployment.value.deployed_version) {
      items.push({
        title: 'No deployed version linked',
        detail: 'Link a GitHub release, tag, or commit so rollout state is traceable.',
        icon: 'i-lucide-git-commit-horizontal',
        color: 'warning'
      })
    }

    if (!primaryDeployment.value.git_branch || !primaryDeployment.value.git_commit) {
      items.push({
        title: 'DevOps baseline incomplete',
        detail: 'Track the provider, branch, commit, and migration for this environment.',
        icon: 'i-lucide-git-pull-request',
        color: 'warning'
      })
    }
  }

  if (urgentTicketCount.value) {
    items.push({
      title: 'High priority support',
      detail: `${urgentTicketCount.value} open high-priority ticket${urgentTicketCount.value === 1 ? '' : 's'}.`,
      icon: 'i-lucide-siren',
      color: 'error',
      to: '/tickets'
    })
  }

  if (openCharges.value.some(charge => charge.billing_status === 'overdue')) {
    items.push({
      title: 'Overdue charge',
      detail: 'At least one ledger item is marked overdue.',
      icon: 'i-lucide-receipt',
      color: 'warning',
      to: customer.value ? `/charges?customer=${customer.value.id}` : '/charges'
    })
  }

  if (activeOnboarding.value?.status === 'blocked') {
    items.push({
      title: 'Onboarding blocked',
      detail: activeOnboarding.value.blockers || 'A launch project is blocked.',
      icon: 'i-lucide-octagon-alert',
      color: 'error',
      to: '/onboarding'
    })
  }

  return items
})

function chargeColor(chargeStatus: Charge['billing_status']) {
  if (chargeStatus === 'paid') return 'success'
  if (chargeStatus === 'overdue') return 'error'
  if (chargeStatus === 'void') return 'neutral'
  return 'warning'
}

function timelineIcon(itemType: TimelineItem['item_type']) {
  if (itemType === 'ticket') return 'i-lucide-life-buoy'
  if (itemType === 'message') return 'i-lucide-mail'
  if (itemType === 'onboarding') return 'i-lucide-rocket'
  if (itemType === 'charge') return 'i-lucide-receipt'
  if (itemType === 'release') return 'i-lucide-git-branch'
  if (itemType === 'deployment') return 'i-lucide-cloud'
  return 'i-lucide-sticky-note'
}

function lineUnitAmount(item: CustomerPricingItem) {
  return item.unit_amount_override ?? item.pricing_item?.amount ?? 0
}

function lineCurrency(item: CustomerPricingItem) {
  return item.currency_override || item.pricing_item?.currency || 'GBP'
}

function lineTotal(item: CustomerPricingItem) {
  return lineUnitAmount(item) * item.quantity
}

function onStatusUpdated(updated: CrmCustomer) {
  if (detail.value) {
    detail.value.customer = { ...detail.value.customer, ...updated }
  }
  refresh()
}

function onCustomerSaved(updated: CrmCustomer) {
  if (detail.value) {
    detail.value.customer = updated
  }
  refresh()
}
</script>

<template>
  <UDashboardPanel id="customer-detail">
    <template #header>
      <UDashboardNavbar :title="customer?.name || 'Customer'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            to="/customers"
            icon="i-lucide-arrow-left"
            label="Customers"
            color="neutral"
            variant="subtle"
          />
          <UButton
            v-if="customer"
            icon="i-lucide-pencil"
            label="Edit"
            color="neutral"
            variant="subtle"
            @click="editOpen = true"
          />
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
      <div v-if="status === 'pending' && !customer" class="space-y-4">
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-48 w-full" />
        <USkeleton class="h-48 w-full" />
      </div>

      <UAlert
        v-else-if="!customer"
        icon="i-lucide-search-x"
        color="error"
        variant="subtle"
        title="Customer not found"
        description="The customer record could not be loaded."
        :actions="[{ label: 'Back to customers', to: '/customers', color: 'neutral', variant: 'subtle' }]"
      />

      <div v-else class="space-y-5">
        <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold text-highlighted">
                  {{ customer.name }}
                </h1>
                <UBadge :label="formatStatusLabel(customer.account_type)" color="neutral" variant="outline" />
                <CustomersStatusMenu :customer="customer" size="xs" @updated="onStatusUpdated" />
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ customer.primary_domain || 'No domain recorded' }}
                <span v-if="customer.customer_identifier"> - {{ customer.customer_identifier }}</span>
              </p>
              <div v-if="customer.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                <UBadge
                  v-for="tag in customer.tags"
                  :key="tag"
                  :label="tag"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="primaryDeployment?.app_url"
                :to="primaryDeployment.app_url"
                target="_blank"
                icon="i-lucide-external-link"
                label="Open Rex"
                color="neutral"
                variant="subtle"
              />
              <UButton
                icon="i-lucide-pencil"
                label="Edit customer"
                @click="editOpen = true"
              />
            </div>
          </div>

          <p v-if="customer.commercial_notes" class="mt-4 text-sm text-muted">
            {{ customer.commercial_notes }}
          </p>
        </section>

        <div v-if="attentionItems.length" class="grid gap-2 md:grid-cols-2">
          <component
            :is="item.to ? NuxtLinkComponent : 'div'"
            v-for="item in attentionItems"
            :key="item.title"
            :to="item.to"
            class="flex items-start gap-3 rounded-lg border border-default bg-default p-3 shadow-xs"
            :class="item.to ? 'transition hover:ring-2 hover:ring-primary/20' : ''"
          >
            <UBadge :color="item.color" variant="subtle" square>
              <UIcon :name="item.icon" class="size-4" />
            </UBadge>
            <div class="min-w-0">
              <p class="font-medium text-highlighted">
                {{ item.title }}
              </p>
              <p class="mt-0.5 text-sm text-muted">
                {{ item.detail }}
              </p>
            </div>
          </component>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ metric.value }}
                </p>
                <p class="mt-1 truncate text-sm text-muted">
                  {{ metric.detail }}
                </p>
              </div>
              <UBadge :color="metric.color" variant="subtle" square>
                <UIcon :name="metric.icon" class="size-4" />
              </UBadge>
            </div>
          </div>
        </div>

        <CustomersDeploymentsCard
          :customer-id="customer.id"
          :deployments="deployments"
          :releases="releases"
          @changed="refresh()"
        />

        <div class="grid gap-5 xl:grid-cols-2">
          <CustomersContactsCard
            :customer-id="customer.id"
            :contacts="contacts"
            @changed="refresh()"
          />
          <CustomersBranchesCard
            :customer-id="customer.id"
            :branches="branches"
            @changed="refresh()"
          />
        </div>

        <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold text-highlighted">
                  Billing Profile
                </h2>
                <p class="text-sm text-muted">
                  Agreed monthly lines plus recent variable charges
                </p>
              </div>
              <UBadge :label="`${formatMoney(monthlyBillingTotal)} / month`" color="primary" variant="subtle" />
            </div>

            <div v-if="billingLines.length" class="divide-y divide-default">
              <div
                v-for="line in billingLines"
                :key="line.id"
                class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="font-medium text-highlighted">
                    {{ line.pricing_item?.name || 'Unknown price' }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ formatMoney(lineUnitAmount(line), lineCurrency(line)) }}
                    <span v-if="line.quantity !== 1">x {{ line.quantity }}</span>
                    <span v-if="line.notes"> - {{ line.notes }}</span>
                  </p>
                </div>
                <p class="shrink-0 font-medium text-highlighted">
                  {{ formatMoney(lineTotal(line), lineCurrency(line)) }}
                </p>
              </div>
            </div>

            <UAlert
              v-else
              icon="i-lucide-info"
              color="warning"
              variant="subtle"
              title="Using recurring fallback"
              :description="`This customer uses ${formatMoney(customer.recurring_monthly_amount)} until agreed billing lines are assigned.`"
            />

            <USeparator class="my-4" />

            <div class="mb-3 flex items-center justify-between gap-3">
              <h3 class="font-semibold text-highlighted">
                Charges
              </h3>
              <UButton
                :to="`/charges?customer=${customer.id}`"
                label="Ledger"
                icon="i-lucide-arrow-right"
                color="neutral"
                variant="ghost"
                size="xs"
              />
            </div>
            <div v-if="charges.length" class="divide-y divide-default">
              <div
                v-for="charge in charges"
                :key="charge.id"
                class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium text-highlighted">
                    {{ charge.description }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ charge.invoice_reference || 'No invoice reference' }} - {{ charge.charge_date }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UBadge :label="formatStatusLabel(charge.billing_status)" :color="chargeColor(charge.billing_status)" variant="subtle" />
                  <p class="w-24 text-right font-medium text-highlighted">
                    {{ formatMoney(Number(charge.amount), charge.currency) }}
                  </p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              No charges recorded yet.
            </p>
          </section>

          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="font-semibold text-highlighted">
                Recent Work
              </h2>
            </div>
            <div class="space-y-4">
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <p class="text-xs font-medium uppercase text-muted">
                    Tickets
                  </p>
                  <UButton
                    to="/tickets"
                    label="All tickets"
                    icon="i-lucide-arrow-right"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                  />
                </div>
                <div v-if="tickets.length" class="space-y-2">
                  <NuxtLink
                    v-for="ticket in tickets"
                    :key="ticket.id"
                    :to="`/tickets?ticket=${ticket.id}`"
                    class="block rounded-md border border-default p-3 transition hover:ring-2 hover:ring-primary/20"
                  >
                    <p class="truncate font-medium text-highlighted">
                      {{ ticket.subject || ticket.rex_ticket_id || 'Ticket' }}
                    </p>
                    <p class="mt-0.5 text-sm text-muted">
                      {{ formatStatusLabel(ticket.status) }} - {{ ticket.priority }} - {{ formatRelativeTime(ticket.created_at) }}
                    </p>
                  </NuxtLink>
                </div>
                <p v-else class="text-sm text-muted">
                  No recent tickets.
                </p>
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <p class="text-xs font-medium uppercase text-muted">
                    Onboarding
                  </p>
                  <UButton
                    to="/onboarding"
                    label="Launch board"
                    icon="i-lucide-arrow-right"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                  />
                </div>
                <div v-if="onboarding.length" class="space-y-2">
                  <NuxtLink
                    v-for="project in onboarding"
                    :key="project.id"
                    to="/onboarding"
                    class="block rounded-md border border-default p-3 transition hover:ring-2 hover:ring-primary/20"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate font-medium text-highlighted">
                        {{ project.name }}
                      </p>
                      <span class="shrink-0 text-xs text-muted">{{ project.readiness_score }}%</span>
                    </div>
                    <UProgress
                      :model-value="project.readiness_score"
                      size="xs"
                      class="mt-2"
                    />
                    <p class="mt-1.5 text-sm text-muted">
                      {{ formatStatusLabel(project.status) }}<span v-if="project.go_live_target"> - target {{ new Date(project.go_live_target).toLocaleDateString('en-GB') }}</span>
                    </p>
                  </NuxtLink>
                </div>
                <p v-else class="text-sm text-muted">
                  No onboarding projects.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">
              Timeline
            </h2>
            <UButton
              :to="`/timeline?customer=${customer.id}`"
              label="Full timeline"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              size="xs"
            />
          </div>
          <div v-if="timeline.length" class="divide-y divide-default">
            <div v-for="item in timeline" :key="item.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated">
                <UIcon :name="timelineIcon(item.item_type)" class="size-4 text-muted" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="font-medium text-highlighted">
                    {{ item.title }}
                  </p>
                  <UTooltip :text="new Date(item.occurred_at).toLocaleString('en-GB')">
                    <span class="shrink-0 text-xs text-muted">{{ formatRelativeTime(item.occurred_at) }}</span>
                  </UTooltip>
                </div>
                <p v-if="item.body" class="mt-0.5 text-sm text-muted">
                  {{ item.body }}
                </p>
              </div>
            </div>
          </div>
          <UAlert
            v-else
            icon="i-lucide-history"
            color="neutral"
            variant="subtle"
            title="No customer activity yet"
            description="Tickets, onboarding, charges, and release rollout changes will appear here."
          />
        </section>

        <CustomersEditCustomerModal
          v-model:open="editOpen"
          :customer="customer"
          @saved="onCustomerSaved"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
