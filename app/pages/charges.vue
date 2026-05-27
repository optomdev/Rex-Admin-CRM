<script setup lang="ts">
import type { Charge } from '~/types'

const { data: charges, status, refresh } = await useAsyncData<Charge[]>('charges', () => $fetch('/api/charges'))

const totals = computed(() => {
  const rows = charges.value ?? []
  return {
    open: rows.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)).reduce((sum, charge) => sum + charge.amount, 0),
    paid: rows.filter(charge => charge.billing_status === 'paid').reduce((sum, charge) => sum + charge.amount, 0),
    count: rows.length
  }
})
</script>

<template>
  <UDashboardPanel id="charges">
    <template #header>
      <UDashboardNavbar title="Charges">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Charge" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-5 grid gap-4 sm:grid-cols-3">
        <UCard :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }">
          <p class="text-sm text-muted">
            Open
          </p>
          <p class="mt-2 text-2xl font-semibold text-highlighted">
            GBP {{ totals.open.toLocaleString('en-GB') }}
          </p>
        </UCard>
        <UCard :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }">
          <p class="text-sm text-muted">
            Paid
          </p>
          <p class="mt-2 text-2xl font-semibold text-highlighted">
            GBP {{ totals.paid.toLocaleString('en-GB') }}
          </p>
        </UCard>
        <UCard :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }">
          <p class="text-sm text-muted">
            Ledger items
          </p>
          <p class="mt-2 text-2xl font-semibold text-highlighted">
            {{ totals.count }}
          </p>
        </UCard>
      </div>

      <div class="divide-y divide-default rounded-lg border border-default">
        <div
          v-for="charge in charges"
          :key="charge.id"
          class="grid gap-3 p-4 md:grid-cols-[1fr_11rem_9rem_9rem] md:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-highlighted">
              {{ charge.description }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ charge.customer?.name }} - {{ charge.invoice_reference || 'No invoice reference' }}
            </p>
          </div>
          <UBadge :label="charge.charge_type.replaceAll('_', ' ')" color="neutral" variant="outline" />
          <p class="font-medium text-highlighted">
            {{ charge.currency }} {{ charge.amount.toLocaleString('en-GB') }}
          </p>
          <UBadge :label="charge.billing_status.replaceAll('_', ' ')" :color="charge.billing_status === 'paid' ? 'success' : charge.billing_status === 'overdue' ? 'error' : 'warning'" variant="subtle" />
        </div>
      </div>

      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UButton
          icon="i-lucide-refresh-cw"
          label="Loading charges"
          color="neutral"
          variant="ghost"
          loading
          @click="refresh()"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
