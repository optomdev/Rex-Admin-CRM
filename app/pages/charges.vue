<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Charge, CrmCustomer } from '~/types'

const { data: charges, status, refresh } = await useAsyncData<Charge[]>('charges', () => $fetch('/api/charges'))
const { data: customers } = await useAsyncData<CrmCustomer[]>('charge-customers', () => $fetch('/api/customers'))
const toast = useToast()
const createOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)
const editSaving = ref(false)
const statusSaving = ref<string | null>(null)
const editingChargeId = ref<string | null>(null)

const chargeTypes = ['monthly', 'onboarding', 'ad_hoc', 'credit'] as const
const billingStatuses = ['draft', 'open', 'invoice_sent', 'paid', 'overdue', 'void'] as const

const createSchema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  charge_type: z.enum(chargeTypes),
  description: z.string().min(2, 'Enter a description'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  currency: z.string().min(3).max(3),
  billing_status: z.enum(billingStatuses),
  invoice_reference: z.string().optional(),
  charge_date: z.string().date('Choose a charge date'),
  due_date: z.string().optional()
})

type CreateSchema = z.output<typeof createSchema>

const createState = reactive<CreateSchema>({
  customer_id: '',
  charge_type: 'monthly',
  description: '',
  amount: 0,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: '',
  charge_date: new Date().toISOString().slice(0, 10),
  due_date: ''
})

const editState = reactive<CreateSchema>({
  customer_id: '',
  charge_type: 'monthly',
  description: '',
  amount: 0,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: '',
  charge_date: new Date().toISOString().slice(0, 10),
  due_date: ''
})

const customerItems = computed(() => (customers.value ?? []).map(customer => ({
  label: customer.name,
  value: customer.id
})))

const totals = computed(() => {
  const rows = charges.value ?? []
  return {
    open: rows.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)).reduce((sum, charge) => sum + charge.amount, 0),
    paid: rows.filter(charge => charge.billing_status === 'paid').reduce((sum, charge) => sum + charge.amount, 0),
    overdue: rows.filter(charge => charge.billing_status === 'overdue').reduce((sum, charge) => sum + charge.amount, 0),
    count: rows.length
  }
})

const chargeMetrics = computed(() => [{
  label: 'Open',
  value: `GBP ${totals.value.open.toLocaleString('en-GB')}`,
  detail: 'Unpaid ledger value',
  icon: 'i-lucide-receipt',
  color: 'warning' as const
}, {
  label: 'Paid',
  value: `GBP ${totals.value.paid.toLocaleString('en-GB')}`,
  detail: 'Closed revenue',
  icon: 'i-lucide-circle-check',
  color: 'success' as const
}, {
  label: 'Overdue',
  value: `GBP ${totals.value.overdue.toLocaleString('en-GB')}`,
  detail: totals.value.overdue ? 'Needs chasing' : 'Nothing overdue',
  icon: totals.value.overdue ? 'i-lucide-octagon-alert' : 'i-lucide-shield-check',
  color: totals.value.overdue ? 'error' as const : 'success' as const
}, {
  label: 'Ledger items',
  value: totals.value.count.toString(),
  detail: 'Manual V1 entries',
  icon: 'i-lucide-list-ordered',
  color: 'neutral' as const
}])

function billingColor(billingStatus: Charge['billing_status']) {
  if (billingStatus === 'paid') return 'success'
  if (billingStatus === 'overdue') return 'error'
  if (billingStatus === 'void') return 'neutral'
  return 'warning'
}

function typeIcon(chargeType: Charge['charge_type']) {
  if (chargeType === 'monthly') return 'i-lucide-calendar-days'
  if (chargeType === 'onboarding') return 'i-lucide-rocket'
  if (chargeType === 'credit') return 'i-lucide-undo-2'
  return 'i-lucide-hammer'
}

function resetCreateForm() {
  createState.customer_id = ''
  createState.charge_type = 'monthly'
  createState.description = ''
  createState.amount = 0
  createState.currency = 'GBP'
  createState.billing_status = 'open'
  createState.invoice_reference = ''
  createState.charge_date = new Date().toISOString().slice(0, 10)
  createState.due_date = ''
}

function resetEditForm() {
  editingChargeId.value = null
  editState.customer_id = ''
  editState.charge_type = 'monthly'
  editState.description = ''
  editState.amount = 0
  editState.currency = 'GBP'
  editState.billing_status = 'open'
  editState.invoice_reference = ''
  editState.charge_date = new Date().toISOString().slice(0, 10)
  editState.due_date = ''
}

function openEditCharge(charge: Charge) {
  editingChargeId.value = charge.id
  editState.customer_id = charge.customer_id
  editState.charge_type = charge.charge_type
  editState.description = charge.description
  editState.amount = charge.amount
  editState.currency = charge.currency
  editState.billing_status = charge.billing_status
  editState.invoice_reference = charge.invoice_reference || ''
  editState.charge_date = charge.charge_date
  editState.due_date = charge.due_date || ''
  editOpen.value = true
}

async function createCharge(event: FormSubmitEvent<CreateSchema>) {
  saving.value = true

  try {
    await $fetch('/api/charges', {
      method: 'POST',
      body: {
        ...event.data,
        currency: event.data.currency.toUpperCase(),
        invoice_reference: event.data.invoice_reference || null,
        due_date: event.data.due_date || null
      }
    })

    toast.add({
      title: 'Charge added',
      description: `${event.data.currency.toUpperCase()} ${event.data.amount.toLocaleString('en-GB')} added to the ledger.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    createOpen.value = false
    resetCreateForm()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Could not add charge',
      description: error instanceof Error ? error.message : 'The ledger entry was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function updateChargeStatus(charge: Charge, billingStatus: Charge['billing_status']) {
  if (charge.billing_status === billingStatus) return

  statusSaving.value = charge.id

  try {
    const updated = await $fetch<Charge>(`/api/charges/${charge.id}`, {
      method: 'PATCH',
      body: {
        billing_status: billingStatus
      }
    })

    const index = charges.value?.findIndex(item => item.id === charge.id) ?? -1
    if (charges.value && index !== -1) {
      charges.value.splice(index, 1, updated)
    } else {
      await refresh()
    }

    toast.add({
      title: 'Charge updated',
      description: `${updated.description} is now ${billingStatus.replaceAll('_', ' ')}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update charge',
      description: error instanceof Error ? error.message : 'The ledger status was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    statusSaving.value = null
  }
}

async function saveChargeDetails(event: FormSubmitEvent<CreateSchema>) {
  if (!editingChargeId.value) return

  editSaving.value = true

  try {
    const updated = await $fetch<Charge>(`/api/charges/${editingChargeId.value}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        currency: event.data.currency.toUpperCase(),
        invoice_reference: event.data.invoice_reference || null,
        due_date: event.data.due_date || null
      }
    })

    const index = charges.value?.findIndex(item => item.id === updated.id) ?? -1
    if (charges.value && index !== -1) {
      charges.value.splice(index, 1, updated)
    } else {
      await refresh()
    }

    toast.add({
      title: 'Charge saved',
      description: `${updated.description} has been updated in the ledger.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    editOpen.value = false
    resetEditForm()
  } catch (error) {
    toast.add({
      title: 'Could not save charge',
      description: error instanceof Error ? error.message : 'The ledger entry was not updated.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    editSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="charges">
    <template #header>
      <UDashboardNavbar title="Charges">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Charge" @click="createOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="metric in chargeMetrics"
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

      <div class="overflow-hidden rounded-lg border border-default bg-default shadow-xs">
        <div class="grid gap-3 border-b border-default bg-elevated/40 px-4 py-3 text-xs font-medium uppercase text-muted md:grid-cols-[1fr_11rem_9rem_15rem]">
          <span>Description</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        <div
          v-for="charge in charges"
          :key="charge.id"
          class="grid gap-3 border-b border-default p-4 last:border-b-0 md:grid-cols-[1fr_11rem_9rem_15rem] md:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-highlighted">
              {{ charge.description }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ charge.customer?.name }} - {{ charge.invoice_reference || 'No invoice reference' }}
            </p>
          </div>
          <UBadge
            :label="charge.charge_type.replaceAll('_', ' ')"
            :icon="typeIcon(charge.charge_type)"
            color="neutral"
            variant="outline"
          />
          <p class="font-medium text-highlighted">
            {{ charge.currency }} {{ charge.amount.toLocaleString('en-GB') }}
          </p>
          <div class="flex items-center gap-2">
            <UBadge
              :label="charge.billing_status.replaceAll('_', ' ')"
              :color="billingColor(charge.billing_status)"
              variant="subtle"
            />
            <USelect
              :model-value="charge.billing_status"
              :items="[...billingStatuses]"
              :loading="statusSaving === charge.id"
              class="min-w-36"
              @update:model-value="updateChargeStatus(charge, $event as Charge['billing_status'])"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              aria-label="Edit charge"
              @click="openEditCharge(charge)"
            />
          </div>
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

      <UModal
        v-model:open="createOpen"
        title="New charge"
        description="Add a manual billing ledger item."
      >
        <template #body>
          <UForm
            id="create-charge"
            :schema="createSchema"
            :state="createState"
            class="space-y-4"
            @submit="createCharge"
          >
            <UFormField label="Customer" name="customer_id" required>
              <USelect
                v-model="createState.customer_id"
                :items="customerItems"
                placeholder="Choose customer"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Description" name="description" required>
              <UInput
                v-model="createState.description"
                placeholder="June Rex subscription"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Type" name="charge_type">
                <USelect v-model="createState.charge_type" :items="[...chargeTypes]" class="w-full" />
              </UFormField>

              <UFormField label="Status" name="billing_status">
                <USelect v-model="createState.billing_status" :items="[...billingStatuses]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <UFormField label="Amount" name="amount">
                <UInputNumber v-model="createState.amount" :min="0" class="w-full" />
              </UFormField>

              <UFormField label="Currency" name="currency">
                <UInput v-model="createState.currency" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Invoice reference" name="invoice_reference">
              <UInput
                v-model="createState.invoice_reference"
                placeholder="INV-2026-001"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Charge date" name="charge_date">
                <UInput v-model="createState.charge_date" type="date" class="w-full" />
              </UFormField>

              <UFormField label="Due date" name="due_date">
                <UInput v-model="createState.due_date" type="date" class="w-full" />
              </UFormField>
            </div>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="createOpen = false"
              />
              <UButton
                label="Add charge"
                icon="i-lucide-check"
                type="submit"
                :loading="saving"
              />
            </div>
          </UForm>
        </template>
      </UModal>

      <UModal
        v-model:open="editOpen"
        title="Edit charge"
        description="Correct the manual ledger entry and keep the audit trail."
      >
        <template #body>
          <UForm
            id="edit-charge"
            :schema="createSchema"
            :state="editState"
            class="space-y-4"
            @submit="saveChargeDetails"
          >
            <UFormField label="Customer" name="customer_id" required>
              <USelect
                v-model="editState.customer_id"
                :items="customerItems"
                placeholder="Choose customer"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Description" name="description" required>
              <UInput
                v-model="editState.description"
                placeholder="June Rex subscription"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Type" name="charge_type">
                <USelect v-model="editState.charge_type" :items="[...chargeTypes]" class="w-full" />
              </UFormField>

              <UFormField label="Status" name="billing_status">
                <USelect v-model="editState.billing_status" :items="[...billingStatuses]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <UFormField label="Amount" name="amount">
                <UInputNumber v-model="editState.amount" :min="0" class="w-full" />
              </UFormField>

              <UFormField label="Currency" name="currency">
                <UInput v-model="editState.currency" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Invoice reference" name="invoice_reference">
              <UInput
                v-model="editState.invoice_reference"
                placeholder="INV-2026-001"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Charge date" name="charge_date">
                <UInput v-model="editState.charge_date" type="date" class="w-full" />
              </UFormField>

              <UFormField label="Due date" name="due_date">
                <UInput v-model="editState.due_date" type="date" class="w-full" />
              </UFormField>
            </div>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="editOpen = false"
              />
              <UButton
                label="Save charge"
                icon="i-lucide-save"
                type="submit"
                :loading="editSaving"
              />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
