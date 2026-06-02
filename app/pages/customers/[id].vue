<script setup lang="ts">
import type { Charge, CustomerDetail, CustomerPricingItem } from '~/types'

const route = useRoute()
const customerId = computed(() => route.params.id as string)

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

const openCharges = computed(() => charges.value.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)))
const openChargeTotal = computed(() => openCharges.value.reduce((sum, charge) => sum + Number(charge.amount), 0))
const monthlyBillingTotal = computed(() => billingLines.value.length
  ? billingLines.value.reduce((sum, line) => sum + lineTotal(line), 0)
  : customer.value?.recurring_monthly_amount ?? 0)

const metrics = computed(() => [{
  label: 'Monthly',
  value: `GBP ${monthlyBillingTotal.value.toLocaleString('en-GB')}`,
  detail: billingLines.value.length ? `${billingLines.value.length} agreed line${billingLines.value.length === 1 ? '' : 's'}` : 'Recurring fallback',
  icon: 'i-lucide-banknote',
  color: 'primary' as const
}, {
  label: 'Open charges',
  value: `GBP ${openChargeTotal.value.toLocaleString('en-GB')}`,
  detail: `${openCharges.value.length} unpaid item${openCharges.value.length === 1 ? '' : 's'}`,
  icon: 'i-lucide-receipt',
  color: openCharges.value.length ? 'warning' as const : 'success' as const
}, {
  label: 'Tickets',
  value: tickets.value.length.toString(),
  detail: tickets.value[0]?.status?.replaceAll('_', ' ') || 'No recent tickets',
  icon: 'i-lucide-life-buoy',
  color: tickets.value.length ? 'warning' as const : 'neutral' as const
}, {
  label: 'Health',
  value: `${customer.value?.health_score ?? 0}%`,
  detail: customer.value?.status.replaceAll('_', ' ') || 'Loading',
  icon: 'i-lucide-heart-pulse',
  color: healthColor(customer.value?.health_score ?? 0)
}])

function healthColor(score: number) {
  if (score >= 80) return 'success' as const
  if (score >= 55) return 'warning' as const
  return 'error' as const
}

function chargeColor(status: Charge['billing_status']) {
  if (status === 'paid') return 'success'
  if (status === 'overdue') return 'error'
  if (status === 'void') return 'neutral'
  return 'warning'
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
</script>

<template>
  <UDashboardPanel id="customer-detail">
    <template #header>
      <UDashboardNavbar :title="customer?.name || 'Customer'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton to="/customers" icon="i-lucide-arrow-left" label="Customers" color="neutral" variant="subtle" />
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="status === 'pending'" @click="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="space-y-4">
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
      />

      <div v-else class="space-y-5">
        <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold text-highlighted">
                  {{ customer.name }}
                </h1>
                <UBadge :label="customer.account_type" color="neutral" variant="outline" />
                <UBadge :label="customer.status.replaceAll('_', ' ')" :color="healthColor(customer.health_score)" variant="subtle" />
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ customer.primary_domain || 'No domain recorded' }}
                <span v-if="customer.customer_identifier"> - {{ customer.customer_identifier }}</span>
              </p>
            </div>
            <UButton to="/charges" icon="i-lucide-receipt" label="Billing" color="neutral" variant="subtle" />
          </div>

          <p v-if="customer.commercial_notes" class="mt-4 text-sm text-muted">
            {{ customer.commercial_notes }}
          </p>
        </section>

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
            <UBadge :label="`GBP ${monthlyBillingTotal.toLocaleString('en-GB')} / month`" color="primary" variant="subtle" />
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
                  {{ lineCurrency(line) }} {{ lineUnitAmount(line).toLocaleString('en-GB') }}
                  <span v-if="line.quantity !== 1">x {{ line.quantity }}</span>
                  <span v-if="line.notes"> - {{ line.notes }}</span>
                </p>
              </div>
              <p class="shrink-0 font-medium text-highlighted">
                {{ lineCurrency(line) }} {{ lineTotal(line).toLocaleString('en-GB') }}
              </p>
            </div>
          </div>

          <UAlert
            v-else
            icon="i-lucide-info"
            color="warning"
            variant="subtle"
            title="Using recurring fallback"
            :description="`This customer uses GBP ${customer.recurring_monthly_amount.toLocaleString('en-GB')} until agreed billing lines are assigned.`"
          />
        </section>

        <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <h2 class="mb-3 font-semibold text-highlighted">
              Charges
            </h2>
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
                  <UBadge :label="charge.billing_status.replaceAll('_', ' ')" :color="chargeColor(charge.billing_status)" variant="subtle" />
                  <p class="w-24 text-right font-medium text-highlighted">
                    {{ charge.currency }} {{ charge.amount.toLocaleString('en-GB') }}
                  </p>
                </div>
              </div>
            </div>
            <UAlert v-else icon="i-lucide-receipt" color="neutral" variant="subtle" title="No charges" />
          </section>

          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <h2 class="mb-3 font-semibold text-highlighted">
              Contacts And Branches
            </h2>
            <div class="space-y-4">
              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Contacts
                </p>
                <div v-if="contacts.length" class="space-y-2">
                  <div v-for="contact in contacts" :key="contact.id" class="rounded-md border border-default p-3">
                    <p class="font-medium text-highlighted">
                      {{ contact.name }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ contact.role || 'No role' }} - {{ contact.email || 'No email' }}
                    </p>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">
                  No contacts recorded.
                </p>
              </div>

              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Branches
                </p>
                <div v-if="branches.length" class="space-y-2">
                  <div v-for="branch in branches" :key="branch.id" class="rounded-md border border-default p-3">
                    <p class="font-medium text-highlighted">
                      {{ branch.name }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ branch.branch_code || 'No code' }} - {{ branch.postcode || 'No postcode' }}
                    </p>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">
                  No branches recorded.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-5 xl:grid-cols-2">
          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <h2 class="mb-3 font-semibold text-highlighted">
              Deployments
            </h2>
            <div v-if="deployments.length" class="space-y-3">
              <div v-for="deployment in deployments" :key="deployment.id" class="rounded-md border border-default p-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-highlighted">
                    {{ deployment.name }}
                  </p>
                  <UBadge :label="deployment.environment" color="neutral" variant="outline" />
                </div>
                <p class="mt-1 text-sm text-muted">
                  {{ deployment.status }} - {{ deployment.health_status }} - {{ deployment.deployed_version || 'No version' }}
                </p>
              </div>
            </div>
            <UAlert v-else icon="i-lucide-cloud" color="neutral" variant="subtle" title="No deployments" />
          </section>

          <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
            <h2 class="mb-3 font-semibold text-highlighted">
              Recent Work
            </h2>
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Tickets
                </p>
                <div v-if="tickets.length" class="space-y-2">
                  <div v-for="ticket in tickets" :key="ticket.id" class="rounded-md border border-default p-3">
                    <p class="truncate font-medium text-highlighted">
                      {{ ticket.subject || ticket.rex_ticket_id || 'Ticket' }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ ticket.status.replaceAll('_', ' ') }} - {{ ticket.priority }}
                    </p>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">
                  No recent tickets.
                </p>
              </div>

              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Onboarding
                </p>
                <div v-if="onboarding.length" class="space-y-2">
                  <div v-for="project in onboarding" :key="project.id" class="rounded-md border border-default p-3">
                    <p class="truncate font-medium text-highlighted">
                      {{ project.name }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ project.status.replaceAll('_', ' ') }} - {{ project.readiness_score }}%
                    </p>
                  </div>
                </div>
                <p v-else class="text-sm text-muted">
                  No onboarding projects.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section class="rounded-lg border border-default bg-default p-4 shadow-xs">
          <h2 class="mb-3 font-semibold text-highlighted">
            Timeline
          </h2>
          <div v-if="timeline.length" class="divide-y divide-default">
            <div v-for="item in timeline" :key="item.id" class="py-3 first:pt-0 last:pb-0">
              <p class="font-medium text-highlighted">
                {{ item.title }}
              </p>
              <p class="text-sm text-muted">
                {{ item.body || 'No detail' }} - {{ new Date(item.occurred_at).toLocaleString('en-GB') }}
              </p>
            </div>
          </div>
          <UAlert v-else icon="i-lucide-history" color="neutral" variant="subtle" title="No timeline yet" />
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
