<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { BillingGroup, BillingGroupPricingItem, Charge, CrmCustomer, CustomerPricingItem, InvoiceGenerationResult, InvoiceSettings, PricingCategory, PricingItem } from '~/types'

const { data: charges, status, refresh } = await useAsyncData<Charge[]>('charges', () => $fetch('/api/charges'))
const { data: customers } = await useAsyncData<CrmCustomer[]>('charge-customers', () => $fetch('/api/customers'))
const { data: pricingItems, refresh: refreshPricing } = await useAsyncData<PricingItem[]>('pricing-items', () => $fetch('/api/pricing'))
const { data: customerPricingItems, refresh: refreshCustomerPricing } = await useAsyncData<CustomerPricingItem[]>('customer-pricing-items', () => $fetch('/api/customer-pricing-items'))
const { data: invoiceSettings, refresh: refreshInvoiceSettings } = await useAsyncData<InvoiceSettings>('invoice-settings', () => $fetch('/api/invoice-settings'))
const { data: billingGroups } = await useAsyncData<BillingGroup[]>('billing-groups', () => $fetch('/api/billing-groups'))
const toast = useToast()
const route = useRoute()
const router = useRouter()

const createOpen = ref(false)
const editOpen = ref(false)
const pricingModalOpen = ref(false)
const assignmentModalOpen = ref(false)
const saving = ref(false)
const editSaving = ref(false)
const pricingSaving = ref(false)
const assignmentSaving = ref(false)
const invoiceSettingsSaving = ref(false)
const invoiceGenerating = ref(false)
const statusSaving = ref<string | null>(null)
const editingChargeId = ref<string | null>(null)
const editingPricingId = ref<string | null>(null)
const editingAssignmentId = ref<string | null>(null)

const chargeTypes = ['monthly', 'onboarding', 'ad_hoc', 'credit'] as const
const billingStatuses = ['draft', 'open', 'invoice_sent', 'paid', 'overdue', 'void'] as const
const pricingCategories = ['license', 'module', 'usage', 'misc'] as const

const chargeSchema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  billing_group_id: z.string().optional(),
  pricing_item_id: z.string().min(1),
  charge_type: z.enum(chargeTypes),
  description: z.string().min(2, 'Enter a description'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  currency: z.string().min(3).max(3),
  billing_status: z.enum(billingStatuses),
  invoice_reference: z.string().optional(),
  charge_date: z.string().date('Choose a charge date'),
  due_date: z.string().optional(),
  notes: z.string().optional()
})

const pricingSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2, 'Enter a name'),
  category: z.enum(pricingCategories),
  charge_type: z.enum(chargeTypes),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  currency: z.string().min(3).max(3),
  unit_label: z.string().min(2, 'Enter a unit'),
  notes: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int()
})

const assignmentSchema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  pricing_item_id: z.string().uuid('Choose a monthly pricing item'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be more than 0'),
  starts_on: z.string().date('Choose a start date'),
  ends_on: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean()
})

type ChargeSchema = z.output<typeof chargeSchema>
type PricingSchema = z.output<typeof pricingSchema>
type AssignmentSchema = z.output<typeof assignmentSchema>

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfCurrentMonth() {
  const date = new Date()
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10)
}

const createState = reactive<ChargeSchema>({
  customer_id: '',
  billing_group_id: 'none',
  pricing_item_id: 'custom',
  charge_type: 'monthly',
  description: '',
  amount: 0,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: '',
  charge_date: todayDate(),
  due_date: '',
  notes: ''
})

const editState = reactive<ChargeSchema>({
  customer_id: '',
  billing_group_id: 'none',
  pricing_item_id: 'custom',
  charge_type: 'monthly',
  description: '',
  amount: 0,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: '',
  charge_date: todayDate(),
  due_date: '',
  notes: ''
})

const pricingState = reactive<PricingSchema>({
  code: '',
  name: '',
  category: 'misc',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'item',
  notes: '',
  is_active: true,
  sort_order: 100
})

const assignmentState = reactive<AssignmentSchema>({
  customer_id: '',
  pricing_item_id: '',
  quantity: 1,
  starts_on: todayDate(),
  ends_on: '',
  notes: '',
  is_active: true
})

const invoiceRunState = reactive({
  billing_date: firstDayOfCurrentMonth()
})

const invoiceSettingsState = reactive({
  invoice_day_of_month: 1,
  due_days: 14,
  cron_enabled: true
})

watch(invoiceSettings, (settings) => {
  if (!settings) return

  invoiceSettingsState.invoice_day_of_month = settings.invoice_day_of_month
  invoiceSettingsState.due_days = settings.due_days
  invoiceSettingsState.cron_enabled = settings.cron_enabled
}, { immediate: true })

const customerItems = computed(() => (customers.value ?? []).map(customer => ({
  label: customer.name,
  value: customer.id
})))
const customerFilterItems = computed(() => [{
  label: 'All customers',
  value: 'all'
}, ...customerItems.value])
const customerFilter = computed<string>({
  get: () => typeof route.query.customer === 'string' && route.query.customer ? route.query.customer : 'all',
  set: (value) => {
    const query = { ...route.query }

    if (value === 'all') {
      delete query.customer
    } else {
      query.customer = value
    }

    void router.replace({ query })
  }
})
const selectedCustomer = computed(() => (customers.value ?? []).find(customer => customer.id === customerFilter.value) ?? null)

const billingGroupItems = computed(() => [{
  label: 'No billing group',
  value: 'none'
}, ...(billingGroups.value ?? []).map(group => ({
  label: group.name,
  value: group.id
}))])

const activePricingItems = computed(() => (pricingItems.value ?? []).filter(item => item.is_active))
const allPricingItems = computed(() => pricingItems.value ?? [])
const activeCustomerPricingItems = computed(() => (customerPricingItems.value ?? []).filter(item => item.is_active))
const activeBillingGroups = computed(() => (billingGroups.value ?? []).filter(group => group.is_active))
const billingGroupAccountIds = computed(() => new Set(
  activeBillingGroups.value.flatMap(group => group.accounts?.map(account => account.customer_id) ?? [])
))
const scopedCustomers = computed(() => (customers.value ?? [])
  .filter(customer => customerFilter.value === 'all' || customer.id === customerFilter.value))
const visibleBillingGroups = computed(() => customerFilter.value === 'all'
  ? activeBillingGroups.value
  : activeBillingGroups.value.filter(group => group.accounts?.some(account => account.customer_id === customerFilter.value)))
const visibleCharges = computed(() => (charges.value ?? [])
  .filter(charge => customerFilter.value === 'all' || charge.customer_id === customerFilter.value))

const customerBillingProfiles = computed(() => scopedCustomers.value
  .filter(customer => !billingGroupAccountIds.value.has(customer.id))
  .map((customer) => {
    const lines = activeCustomerPricingItems.value.filter(item => item.customer_id === customer.id)
    const monthlyTotal = lines.length
      ? lines.reduce((sum, item) => sum + assignmentTotal(item), 0)
      : customer.recurring_monthly_amount

    return {
      customer,
      lines,
      monthlyTotal,
      usesFallback: !lines.length && customer.recurring_monthly_amount > 0
    }
  })
  .filter(profile => profile.lines.length || profile.monthlyTotal > 0))

const pricingSelectItems = computed(() => [{
  label: 'Custom charge',
  value: 'custom'
}, ...activePricingItems.value.map(item => ({
  label: `${item.name} - ${item.currency} ${item.amount.toLocaleString('en-GB')} / ${item.unit_label}`,
  value: item.id
}))])

const monthlyPricingSelectItems = computed(() => activePricingItems.value
  .filter(item => item.charge_type === 'monthly')
  .map(item => ({
    label: `${item.name} - ${item.currency} ${item.amount.toLocaleString('en-GB')} / ${item.unit_label}`,
    value: item.id
  })))

const invoiceCronSummary = computed(() => {
  const settings = invoiceSettings.value
  if (!settings) return 'Invoice cron settings are loading.'

  const enabled = settings.cron_enabled ? 'enabled' : 'paused'
  return `Cron is ${enabled}; it checks daily and generates on day ${settings.invoice_day_of_month}.`
})

function billingColor(billingStatus: Charge['billing_status']) {
  if (billingStatus === 'paid') return 'success'
  if (billingStatus === 'overdue') return 'error'
  if (billingStatus === 'void') return 'neutral'
  return 'warning'
}

function categoryColor(category: PricingCategory) {
  if (category === 'license') return 'primary'
  if (category === 'module') return 'success'
  if (category === 'usage') return 'warning'
  return 'neutral'
}

function typeIcon(chargeType: Charge['charge_type']) {
  if (chargeType === 'monthly') return 'i-lucide-calendar-days'
  if (chargeType === 'onboarding') return 'i-lucide-rocket'
  if (chargeType === 'credit') return 'i-lucide-undo-2'
  return 'i-lucide-hammer'
}

function resetCreateForm() {
  createState.customer_id = ''
  createState.billing_group_id = 'none'
  createState.pricing_item_id = 'custom'
  createState.charge_type = 'monthly'
  createState.description = ''
  createState.amount = 0
  createState.currency = 'GBP'
  createState.billing_status = 'open'
  createState.invoice_reference = ''
  createState.charge_date = todayDate()
  createState.due_date = ''
  createState.notes = ''
}

function resetEditForm() {
  editingChargeId.value = null
  editState.customer_id = ''
  editState.billing_group_id = 'none'
  editState.pricing_item_id = 'custom'
  editState.charge_type = 'monthly'
  editState.description = ''
  editState.amount = 0
  editState.currency = 'GBP'
  editState.billing_status = 'open'
  editState.invoice_reference = ''
  editState.charge_date = todayDate()
  editState.due_date = ''
  editState.notes = ''
}

function resetPricingForm() {
  editingPricingId.value = null
  pricingState.code = ''
  pricingState.name = ''
  pricingState.category = 'misc'
  pricingState.charge_type = 'ad_hoc'
  pricingState.amount = 0
  pricingState.currency = 'GBP'
  pricingState.unit_label = 'item'
  pricingState.notes = ''
  pricingState.is_active = true
  pricingState.sort_order = 100
}

function resetAssignmentForm() {
  editingAssignmentId.value = null
  assignmentState.customer_id = ''
  assignmentState.pricing_item_id = ''
  assignmentState.quantity = 1
  assignmentState.starts_on = todayDate()
  assignmentState.ends_on = ''
  assignmentState.notes = ''
  assignmentState.is_active = true
}

function selectPricingForCharge(state: ChargeSchema, pricingItemId: string) {
  state.pricing_item_id = pricingItemId
  const item = pricingItems.value?.find(pricing => pricing.id === pricingItemId)
  if (!item) return

  state.charge_type = item.charge_type
  state.description = item.name
  state.amount = item.amount
  state.currency = item.currency

  if (!state.notes && item.notes) {
    state.notes = item.notes
  }
}

function chargePayload(data: ChargeSchema) {
  return {
    ...data,
    billing_group_id: data.billing_group_id === 'none' ? null : data.billing_group_id || null,
    pricing_item_id: data.pricing_item_id === 'custom' ? null : data.pricing_item_id,
    currency: data.currency.toUpperCase(),
    invoice_reference: data.invoice_reference || null,
    due_date: data.due_date || null,
    notes: data.notes || null
  }
}

function openEditCharge(charge: Charge) {
  editingChargeId.value = charge.id
  editState.customer_id = charge.customer_id
  editState.billing_group_id = charge.billing_group_id || 'none'
  editState.pricing_item_id = charge.pricing_item_id || 'custom'
  editState.charge_type = charge.charge_type
  editState.description = charge.description
  editState.amount = charge.amount
  editState.currency = charge.currency
  editState.billing_status = charge.billing_status
  editState.invoice_reference = charge.invoice_reference || ''
  editState.charge_date = charge.charge_date
  editState.due_date = charge.due_date || ''
  editState.notes = charge.notes || ''
  editOpen.value = true
}

function openNewPricingItem() {
  resetPricingForm()
  pricingModalOpen.value = true
}

function openNewAssignment(customerId = '') {
  resetAssignmentForm()
  assignmentState.customer_id = customerId
  assignmentModalOpen.value = true
}

function openEditPricingItem(item: PricingItem) {
  editingPricingId.value = item.id
  pricingState.code = item.code
  pricingState.name = item.name
  pricingState.category = item.category
  pricingState.charge_type = item.charge_type
  pricingState.amount = item.amount
  pricingState.currency = item.currency
  pricingState.unit_label = item.unit_label
  pricingState.notes = item.notes || ''
  pricingState.is_active = item.is_active
  pricingState.sort_order = item.sort_order
  pricingModalOpen.value = true
}

function openEditAssignment(item: CustomerPricingItem) {
  editingAssignmentId.value = item.id
  assignmentState.customer_id = item.customer_id
  assignmentState.pricing_item_id = item.pricing_item_id
  assignmentState.quantity = item.quantity
  assignmentState.starts_on = item.starts_on
  assignmentState.ends_on = item.ends_on || ''
  assignmentState.notes = item.notes || ''
  assignmentState.is_active = item.is_active
  assignmentModalOpen.value = true
}

function assignmentUnitAmount(item: CustomerPricingItem) {
  return item.unit_amount_override ?? item.pricing_item?.amount ?? 0
}

function assignmentCurrency(item: CustomerPricingItem) {
  return item.currency_override || item.pricing_item?.currency || 'GBP'
}

function assignmentTotal(item: CustomerPricingItem) {
  return assignmentUnitAmount(item) * item.quantity
}

function groupLineUnitAmount(item: BillingGroupPricingItem) {
  return item.unit_amount_override ?? item.pricing_item?.amount ?? 0
}

function groupLineCurrency(item: BillingGroupPricingItem) {
  return item.currency_override || item.pricing_item?.currency || 'GBP'
}

function groupLineTotal(item: BillingGroupPricingItem) {
  return groupLineUnitAmount(item) * item.quantity
}

function billingGroupMonthlyTotal(group: BillingGroup) {
  return (group.pricing_items ?? [])
    .filter(item => item.is_active && item.pricing_item?.charge_type === 'monthly')
    .reduce((sum, item) => sum + groupLineTotal(item), 0)
}

function billingGroupCurrency(group: BillingGroup) {
  const line = group.pricing_items?.find(item => item.currency_override || item.pricing_item?.currency)
  return line ? groupLineCurrency(line) : 'GBP'
}

async function createCharge(event: FormSubmitEvent<ChargeSchema>) {
  saving.value = true

  try {
    await $fetch('/api/charges', {
      method: 'POST',
      body: chargePayload(event.data)
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

async function saveChargeDetails(event: FormSubmitEvent<ChargeSchema>) {
  if (!editingChargeId.value) return

  editSaving.value = true

  try {
    const updated = await $fetch<Charge>(`/api/charges/${editingChargeId.value}`, {
      method: 'PATCH',
      body: chargePayload(event.data)
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

async function savePricingItem(event: FormSubmitEvent<PricingSchema>) {
  pricingSaving.value = true

  try {
    const method = editingPricingId.value ? 'PATCH' : 'POST'
    const url = editingPricingId.value ? `/api/pricing/${editingPricingId.value}` : '/api/pricing'

    await $fetch<PricingItem>(url, {
      method: method as 'PATCH' | 'POST',
      body: {
        ...event.data,
        code: event.data.code || undefined,
        currency: event.data.currency.toUpperCase(),
        notes: event.data.notes || null
      }
    })

    toast.add({
      title: editingPricingId.value ? 'Price saved' : 'Price added',
      description: `${event.data.name} is now in the pricing catalogue.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    pricingModalOpen.value = false
    resetPricingForm()
    await refreshPricing()
  } catch (error) {
    toast.add({
      title: 'Could not save price',
      description: error instanceof Error ? error.message : 'The pricing item was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    pricingSaving.value = false
  }
}

async function saveAssignment(event: FormSubmitEvent<AssignmentSchema>) {
  assignmentSaving.value = true

  try {
    const method = editingAssignmentId.value ? 'PATCH' : 'POST'
    const url = editingAssignmentId.value ? `/api/customer-pricing-items/${editingAssignmentId.value}` : '/api/customer-pricing-items'

    await $fetch<CustomerPricingItem>(url, {
      method: method as 'PATCH' | 'POST',
      body: {
        ...event.data,
        ends_on: event.data.ends_on || null,
        notes: event.data.notes || null
      }
    })

    toast.add({
      title: editingAssignmentId.value ? 'Assignment saved' : 'Assignment added',
      description: 'Customer billing assignments are ready for the invoice cron.',
      color: 'success',
      icon: 'i-lucide-check'
    })

    assignmentModalOpen.value = false
    resetAssignmentForm()
    await refreshCustomerPricing()
  } catch (error) {
    toast.add({
      title: 'Could not save assignment',
      description: error instanceof Error ? error.message : 'The customer billing assignment was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    assignmentSaving.value = false
  }
}

async function saveInvoiceSettings() {
  invoiceSettingsSaving.value = true

  try {
    await $fetch<InvoiceSettings>('/api/invoice-settings', {
      method: 'PATCH',
      body: {
        invoice_day_of_month: invoiceSettingsState.invoice_day_of_month,
        due_days: invoiceSettingsState.due_days,
        cron_enabled: invoiceSettingsState.cron_enabled
      }
    })

    await refreshInvoiceSettings()

    toast.add({
      title: 'Invoice settings saved',
      description: `Cron generation is set for day ${invoiceSettingsState.invoice_day_of_month}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not save invoice settings',
      description: error instanceof Error ? error.message : 'The invoice cron settings were not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    invoiceSettingsSaving.value = false
  }
}

async function generateInvoices() {
  invoiceGenerating.value = true

  try {
    const result = await $fetch<InvoiceGenerationResult>('/api/invoices/generate', {
      method: 'POST',
      body: {
        billing_date: invoiceRunState.billing_date
      }
    })

    await refresh()

    toast.add({
      title: result.generated_count ? 'Invoices generated' : 'No new invoices',
      description: result.generated_count
        ? `${result.generated_count} invoice charge${result.generated_count === 1 ? '' : 's'} created for ${result.billing_date}.`
        : 'That billing month was already generated or has no billable customers.',
      color: result.generated_count ? 'success' : 'neutral',
      icon: result.generated_count ? 'i-lucide-check' : 'i-lucide-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Could not generate invoices',
      description: error instanceof Error ? error.message : 'Manual invoice generation did not run.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    invoiceGenerating.value = false
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
          <UButton
            icon="i-lucide-link"
            label="Assign"
            color="neutral"
            variant="subtle"
            @click="openNewAssignment()"
          />
          <UButton
            icon="i-lucide-tags"
            label="Price"
            color="neutral"
            variant="subtle"
            @click="openNewPricingItem"
          />
          <UButton icon="i-lucide-plus" label="Charge" @click="createOpen = true" />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <USelect
            v-model="customerFilter"
            :items="customerFilterItems"
            class="w-64"
          />
          <UBadge
            v-if="selectedCustomer"
            :label="formatStatusLabel(selectedCustomer.status)"
            :color="customerStatusColor(selectedCustomer.status)"
            variant="subtle"
          />
        </template>
        <template #right>
          <UButton
            v-if="customerFilter !== 'all'"
            to="/charges"
            icon="i-lucide-x"
            label="Clear"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <section class="mb-5 rounded-lg border border-default bg-default p-4 shadow-xs">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-highlighted">
              Invoicing
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ invoiceCronSummary }}
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_10rem_8rem_8rem_auto_auto] xl:items-end">
            <UFormField label="Billing date">
              <UInput v-model="invoiceRunState.billing_date" type="date" class="w-full" />
            </UFormField>

            <UButton
              label="Generate"
              icon="i-lucide-receipt-text"
              :loading="invoiceGenerating"
              @click="generateInvoices"
            />

            <UFormField label="Cron day">
              <UInputNumber
                v-model="invoiceSettingsState.invoice_day_of_month"
                :min="1"
                :max="28"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Due days">
              <UInputNumber
                v-model="invoiceSettingsState.due_days"
                :min="0"
                :max="90"
                class="w-full"
              />
            </UFormField>

            <UCheckbox v-model="invoiceSettingsState.cron_enabled" label="Cron" />

            <UButton
              label="Save"
              icon="i-lucide-save"
              color="neutral"
              variant="subtle"
              :loading="invoiceSettingsSaving"
              @click="saveInvoiceSettings"
            />
          </div>
        </div>
      </section>

      <section class="mb-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-highlighted">
              Pricing
            </h2>
            <p class="text-sm text-muted">
              License, module, usage, and misc charge catalogue
            </p>
          </div>
          <UButton
            icon="i-lucide-plus"
            label="Price"
            size="sm"
            color="neutral"
            variant="outline"
            @click="openNewPricingItem"
          />
        </div>

        <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="item in allPricingItems"
            :key="item.id"
            class="rounded-lg border border-default bg-default p-4 shadow-xs"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ item.name }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  {{ item.currency }} {{ item.amount.toLocaleString('en-GB') }} / {{ item.unit_label }}
                </p>
              </div>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Edit price"
                @click="openEditPricingItem(item)"
              />
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge :label="item.category" :color="categoryColor(item.category)" variant="subtle" />
              <UBadge :label="item.charge_type.replaceAll('_', ' ')" color="neutral" variant="outline" />
              <UBadge
                v-if="!item.is_active"
                label="inactive"
                color="neutral"
                variant="subtle"
              />
            </div>
            <p v-if="item.notes" class="mt-3 line-clamp-2 text-sm text-muted">
              {{ item.notes }}
            </p>
          </div>
        </div>
      </section>

      <section class="mb-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-highlighted">
              Billing Groups
            </h2>
            <p class="text-sm text-muted">
              One bill, shared pricing, and one payment setup across linked accounts
            </p>
          </div>
        </div>

        <div v-if="visibleBillingGroups.length" class="grid gap-3 xl:grid-cols-2">
          <div
            v-for="group in visibleBillingGroups"
            :key="group.id"
            class="rounded-lg border border-default bg-default p-4 shadow-xs"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ group.name }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  {{ group.billing_email || 'No billing email' }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2 sm:justify-end">
                <UBadge
                  :label="`${billingGroupCurrency(group)} ${billingGroupMonthlyTotal(group).toLocaleString('en-GB')}`"
                  color="primary"
                  variant="subtle"
                />
                <UBadge
                  :label="`Day ${group.invoice_day_of_month}`"
                  color="neutral"
                  variant="outline"
                />
                <UBadge
                  :label="`${group.due_days} due days`"
                  color="neutral"
                  variant="outline"
                />
              </div>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Accounts
                </p>
                <div class="space-y-2">
                  <div
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="flex items-center justify-between gap-3 rounded-md bg-elevated/50 px-3 py-2"
                  >
                    <NuxtLink
                      v-if="account.customer"
                      :to="`/customers/${account.customer.id}`"
                      class="min-w-0 truncate text-sm font-medium text-highlighted hover:text-primary"
                    >
                      {{ account.customer.name }}
                    </NuxtLink>
                    <span v-else class="text-sm text-muted">Unknown account</span>
                    <UBadge
                      v-if="account.is_primary"
                      label="Primary"
                      color="success"
                      variant="subtle"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p class="mb-2 text-xs font-medium uppercase text-muted">
                  Shared Fees
                </p>
                <div class="divide-y divide-default">
                  <div
                    v-for="line in group.pricing_items"
                    :key="line.id"
                    class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-highlighted">
                        {{ line.pricing_item?.name || 'Unknown price' }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ groupLineCurrency(line) }} {{ groupLineUnitAmount(line).toLocaleString('en-GB') }}
                        <span v-if="line.quantity !== 1">x {{ line.quantity }}</span>
                      </p>
                    </div>
                    <UBadge
                      :label="`${groupLineCurrency(line)} ${groupLineTotal(line).toLocaleString('en-GB')}`"
                      color="primary"
                      variant="subtle"
                    />
                  </div>
                </div>
              </div>
            </div>

            <p v-if="group.payment_method_notes" class="mt-4 text-sm text-muted">
              {{ group.payment_method_notes }}
            </p>
            <p v-if="group.notes" class="mt-2 text-sm text-muted">
              {{ group.notes }}
            </p>
          </div>
        </div>

        <UAlert
          v-else
          icon="i-lucide-users"
          color="neutral"
          variant="subtle"
          title="No billing groups"
          description="Ungrouped customer billing assignments will still generate manual test invoices."
        />
      </section>

      <section class="mb-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-highlighted">
              Ungrouped Customer Billing
            </h2>
            <p class="text-sm text-muted">
              Customer-level monthly assignments used when no billing group exists
            </p>
          </div>
          <UButton
            icon="i-lucide-plus"
            label="Assign"
            size="sm"
            color="neutral"
            variant="outline"
            @click="openNewAssignment()"
          />
        </div>

        <div v-if="customerBillingProfiles.length" class="grid gap-3 lg:grid-cols-2">
          <div
            v-for="profile in customerBillingProfiles"
            :key="profile.customer.id"
            class="rounded-lg border border-default bg-default p-4 shadow-xs"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  <NuxtLink :to="`/customers/${profile.customer.id}`" class="hover:text-primary">
                    {{ profile.customer.name }}
                  </NuxtLink>
                </p>
                <p class="mt-1 text-sm text-muted">
                  GBP {{ profile.monthlyTotal.toLocaleString('en-GB') }} agreed monthly billing
                </p>
              </div>
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="sm"
                aria-label="Add agreed fee"
                @click="openNewAssignment(profile.customer.id)"
              />
            </div>

            <div v-if="profile.usesFallback" class="mt-3">
              <UBadge
                label="Using customer recurring monthly amount"
                color="warning"
                variant="subtle"
              />
            </div>

            <div v-else class="mt-3 divide-y divide-default">
              <div
                v-for="line in profile.lines"
                :key="line.id"
                class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ line.pricing_item?.name || 'Unknown price' }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ assignmentCurrency(line) }} {{ assignmentUnitAmount(line).toLocaleString('en-GB') }}
                    <span v-if="line.quantity !== 1">x {{ line.quantity }}</span>
                    <span v-if="line.notes"> - {{ line.notes }}</span>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UBadge
                    :label="`${assignmentCurrency(line)} ${assignmentTotal(line).toLocaleString('en-GB')}`"
                    color="primary"
                    variant="subtle"
                  />
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    aria-label="Edit agreed fee"
                    @click="openEditAssignment(line)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <UAlert
          v-else
          icon="i-lucide-link"
          color="neutral"
          variant="subtle"
          title="No ungrouped billing assignments"
          description="Grouped accounts are billed from their shared billing group pricing."
        />
      </section>

      <div class="overflow-hidden rounded-lg border border-default bg-default shadow-xs">
        <div class="grid gap-3 border-b border-default bg-elevated/40 px-4 py-3 text-xs font-medium uppercase text-muted md:grid-cols-[1fr_10rem_9rem_9rem_15rem]">
          <span>Description</span>
          <span>Source</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        <div
          v-for="charge in visibleCharges"
          :key="charge.id"
          class="grid gap-3 border-b border-default p-4 last:border-b-0 md:grid-cols-[1fr_10rem_9rem_9rem_15rem] md:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-highlighted">
              {{ charge.description }}
            </p>
            <p class="mt-1 text-sm text-muted">
              <NuxtLink
                v-if="charge.customer"
                :to="`/customers/${charge.customer.id}`"
                class="hover:text-primary"
              >
                {{ charge.customer.name }}
              </NuxtLink>
              <span v-else>Unknown customer</span>
              - {{ charge.invoice_reference || 'No invoice reference' }}
            </p>
            <p v-if="charge.notes" class="mt-1 line-clamp-1 text-sm text-muted">
              {{ charge.notes }}
            </p>
          </div>
          <div class="min-w-0">
            <UBadge
              :label="charge.pricing_item?.name || 'Custom'"
              :color="charge.pricing_item ? categoryColor(charge.pricing_item.category) : 'neutral'"
              variant="subtle"
            />
            <p v-if="charge.billing_group" class="mt-1 truncate text-xs text-muted">
              {{ charge.billing_group.name }}
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

        <UAlert
          v-if="!visibleCharges.length && status !== 'pending'"
          class="m-4"
          icon="i-lucide-receipt-text"
          color="neutral"
          variant="subtle"
          title="No charges yet"
          description="Manual ledger and monthly cron entries will appear here once a customer charge is added."
        />
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
        description="Add a ledger item from managed pricing or a custom charge."
      >
        <template #body>
          <UForm
            id="create-charge"
            :schema="chargeSchema"
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

            <UFormField label="Billing group" name="billing_group_id">
              <USelect
                v-model="createState.billing_group_id"
                :items="billingGroupItems"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Pricing item" name="pricing_item_id">
              <USelect
                :model-value="createState.pricing_item_id"
                :items="pricingSelectItems"
                class="w-full"
                @update:model-value="selectPricingForCharge(createState, $event as string)"
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

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="createState.notes" :rows="3" class="w-full" />
            </UFormField>

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
        description="Correct the ledger entry and keep the audit trail."
      >
        <template #body>
          <UForm
            id="edit-charge"
            :schema="chargeSchema"
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

            <UFormField label="Billing group" name="billing_group_id">
              <USelect
                v-model="editState.billing_group_id"
                :items="billingGroupItems"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Pricing item" name="pricing_item_id">
              <USelect
                :model-value="editState.pricing_item_id"
                :items="pricingSelectItems"
                class="w-full"
                @update:model-value="selectPricingForCharge(editState, $event as string)"
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

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="editState.notes" :rows="3" class="w-full" />
            </UFormField>

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

      <UModal
        v-model:open="pricingModalOpen"
        :title="editingPricingId ? 'Edit price' : 'New price'"
        description="Manage catalogue pricing used by manual charges and invoice cron."
      >
        <template #body>
          <UForm
            id="pricing-item"
            :schema="pricingSchema"
            :state="pricingState"
            class="space-y-4"
            @submit="savePricingItem"
          >
            <div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <UFormField label="Name" name="name" required>
                <UInput v-model="pricingState.name" placeholder="Rex main license fee" class="w-full" />
              </UFormField>

              <UFormField label="Code" name="code">
                <UInput v-model="pricingState.code" placeholder="rex-main-license" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Category" name="category">
                <USelect v-model="pricingState.category" :items="[...pricingCategories]" class="w-full" />
              </UFormField>

              <UFormField label="Charge type" name="charge_type">
                <USelect v-model="pricingState.charge_type" :items="[...chargeTypes]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-[1fr_8rem_9rem]">
              <UFormField label="Amount" name="amount">
                <UInputNumber v-model="pricingState.amount" :min="0" class="w-full" />
              </UFormField>

              <UFormField label="Currency" name="currency">
                <UInput v-model="pricingState.currency" class="w-full" />
              </UFormField>

              <UFormField label="Unit" name="unit_label">
                <UInput v-model="pricingState.unit_label" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-end">
              <UFormField label="Order" name="sort_order">
                <UInputNumber v-model="pricingState.sort_order" class="w-full" />
              </UFormField>

              <UCheckbox v-model="pricingState.is_active" label="Active" />
            </div>

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="pricingState.notes" :rows="3" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="pricingModalOpen = false"
              />
              <UButton
                :label="editingPricingId ? 'Save price' : 'Add price'"
                icon="i-lucide-save"
                type="submit"
                :loading="pricingSaving"
              />
            </div>
          </UForm>
        </template>
      </UModal>

      <UModal
        v-model:open="assignmentModalOpen"
        :title="editingAssignmentId ? 'Edit assignment' : 'New assignment'"
        description="Assign a monthly pricing item to a customer for invoice cron billing."
      >
        <template #body>
          <UForm
            id="customer-pricing-assignment"
            :schema="assignmentSchema"
            :state="assignmentState"
            class="space-y-4"
            @submit="saveAssignment"
          >
            <UFormField label="Customer" name="customer_id" required>
              <USelect
                v-model="assignmentState.customer_id"
                :items="customerItems"
                placeholder="Choose customer"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Monthly price" name="pricing_item_id" required>
              <USelect
                v-model="assignmentState.pricing_item_id"
                :items="monthlyPricingSelectItems"
                placeholder="Choose monthly price"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-[1fr_1fr_8rem] sm:items-end">
              <UFormField label="Starts" name="starts_on">
                <UInput v-model="assignmentState.starts_on" type="date" class="w-full" />
              </UFormField>

              <UFormField label="Ends" name="ends_on">
                <UInput v-model="assignmentState.ends_on" type="date" class="w-full" />
              </UFormField>

              <UFormField label="Quantity" name="quantity">
                <UInputNumber
                  v-model="assignmentState.quantity"
                  :min="0.01"
                  :step="1"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UCheckbox v-model="assignmentState.is_active" label="Active" />

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="assignmentState.notes" :rows="3" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="assignmentModalOpen = false"
              />
              <UButton
                :label="editingAssignmentId ? 'Save assignment' : 'Add assignment'"
                icon="i-lucide-save"
                type="submit"
                :loading="assignmentSaving"
              />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
