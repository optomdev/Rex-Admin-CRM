<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CrmCustomer } from '~/types'

const search = ref('')
const statusFilter = ref('All')
const accountTypeFilter = ref('all')
const createOpen = ref(false)
const saving = ref(false)
const toast = useToast()
const route = useRoute()
const router = useRouter()

const view = useLocalStorage<'board' | 'grid'>('rex-crm-customers-view', 'board', { initOnMounted: true })

const { data: customers, status, refresh } = await useAsyncData<CrmCustomer[]>('customers', () => $fetch('/api/customers'))

const customerStatuses = ['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned'] as const
const customerAccountTypes = ['internal', 'prospect', 'customer', 'partner', 'franchise'] as const
const statusItems = ['All', ...customerStatuses]
const accountTypeItems = [
  { label: 'All accounts', value: 'all' },
  { label: 'Internal', value: 'internal' },
  { label: 'Prospects', value: 'prospect' },
  { label: 'Customers', value: 'customer' },
  { label: 'Partners / franchises', value: 'partners_franchises' }
]

const viewItems = [
  { label: 'Pipeline', value: 'board', icon: 'i-lucide-kanban' },
  { label: 'Cards', value: 'grid', icon: 'i-lucide-layout-grid' }
]

const createSchema = z.object({
  name: z.string().min(2, 'Enter the practice name'),
  account_type: z.enum(customerAccountTypes),
  status: z.enum(customerStatuses),
  primary_domain: z.string().optional(),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  rex_supabase_url: z.string().url('Enter a valid Supabase URL').optional().or(z.literal('')),
  recurring_monthly_amount: z.coerce.number().min(0, 'Monthly amount cannot be negative'),
  onboarding_fee: z.coerce.number().min(0, 'Onboarding fee cannot be negative'),
  tags: z.string().optional(),
  commercial_notes: z.string().optional()
})

type CreateSchema = z.output<typeof createSchema>

const createState = reactive<CreateSchema>({
  name: '',
  account_type: 'prospect',
  status: 'prospect',
  primary_domain: '',
  customer_identifier: '',
  rex_project_ref: '',
  rex_supabase_url: '',
  recurring_monthly_amount: 0,
  onboarding_fee: 0,
  tags: '',
  commercial_notes: ''
})

const matchesSearchAndAccount = (customer: CrmCustomer) => {
  const haystack = [
    customer.name,
    customer.primary_domain,
    customer.customer_identifier,
    customer.account_type,
    ...customer.tags
  ].filter(Boolean).join(' ').toLowerCase()
  const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
  const matchesAccountType = accountTypeFilter.value === 'all'
    || customer.account_type === accountTypeFilter.value
    || (accountTypeFilter.value === 'partners_franchises' && ['partner', 'franchise'].includes(customer.account_type))
  return matchesSearch && matchesAccountType
}

const boardCustomers = computed(() => (customers.value ?? []).filter(matchesSearchAndAccount))

const filteredCustomers = computed(() => boardCustomers.value.filter(customer =>
  statusFilter.value === 'All' || customer.status === statusFilter.value
))

const visibleCount = computed(() => view.value === 'board' ? boardCustomers.value.length : filteredCustomers.value.length)

const customerStats = computed(() => {
  const rows = customers.value ?? []
  const commercialRows = rows.filter(customer => customer.account_type !== 'internal')
  const monthly = commercialRows.reduce((sum, customer) => sum + Number(customer.recurring_monthly_amount), 0)
  const internal = rows.filter(customer => customer.account_type === 'internal').length
  const onboarding = rows.filter(customer => customer.status === 'onboarding').length
  const prospects = rows.filter(customer => customer.status === 'prospect').length
  const atRisk = rows.filter(customer => customer.status === 'at_risk').length
  const averageHealth = rows.length
    ? Math.round(rows.reduce((sum, customer) => sum + customer.health_score, 0) / rows.length)
    : 0

  return [{
    label: 'Customers',
    value: rows.length.toString(),
    detail: internal ? `${visibleCount.value} in view, ${internal} internal` : `${visibleCount.value} in view`,
    icon: 'i-lucide-building-2',
    color: 'primary' as const
  }, {
    label: 'Monthly ledger',
    value: formatMoney(monthly),
    detail: 'Commercial accounts only',
    icon: 'i-lucide-banknote',
    color: 'success' as const
  }, {
    label: 'In motion',
    value: (prospects + onboarding).toString(),
    detail: `${prospects} prospecting, ${onboarding} onboarding`,
    icon: 'i-lucide-rocket',
    color: 'secondary' as const
  }, {
    label: 'Health',
    value: `${averageHealth}%`,
    detail: atRisk ? `${atRisk} customer${atRisk === 1 ? '' : 's'} need attention` : 'No at-risk customers',
    icon: atRisk ? 'i-lucide-heart-pulse' : 'i-lucide-shield-check',
    color: atRisk ? 'warning' as const : 'success' as const
  }]
})

function accountTypeColor(accountType: CrmCustomer['account_type']) {
  if (accountType === 'internal') return 'info'
  if (accountType === 'customer') return 'success'
  if (accountType === 'partner') return 'secondary'
  if (accountType === 'franchise') return 'warning'
  return 'neutral'
}

function onCustomerUpdated(updated: CrmCustomer) {
  if (!customers.value) return

  const index = customers.value.findIndex(customer => customer.id === updated.id)
  if (index !== -1) {
    customers.value[index] = { ...customers.value[index], ...updated }
  }
}

function clearFilters() {
  search.value = ''
  statusFilter.value = 'All'
  accountTypeFilter.value = 'all'
}

function resetCreateForm() {
  createState.name = ''
  createState.account_type = 'prospect'
  createState.status = 'prospect'
  createState.primary_domain = ''
  createState.customer_identifier = ''
  createState.rex_project_ref = ''
  createState.rex_supabase_url = ''
  createState.recurring_monthly_amount = 0
  createState.onboarding_fee = 0
  createState.tags = ''
  createState.commercial_notes = ''
}

async function createCustomer(event: FormSubmitEvent<CreateSchema>) {
  saving.value = true

  try {
    const created = await $fetch<CrmCustomer>('/api/customers', {
      method: 'POST',
      body: {
        ...event.data,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        rex_supabase_url: event.data.rex_supabase_url || null,
        tags: event.data.tags
          ? event.data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : []
      }
    })

    toast.add({
      title: 'Customer created',
      description: `${event.data.name} is now in the CRM.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    createOpen.value = false
    resetCreateForm()
    await refresh()

    if (created?.id) {
      await navigateTo(`/customers/${created.id}`)
    }
  } catch (error) {
    toast.add({
      title: 'Could not create customer',
      description: error instanceof Error ? error.message : 'Check the local Supabase connection.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

watch(() => route.query.customer, async (customerParam) => {
  if (typeof customerParam === 'string' && customerParam) {
    await navigateTo(`/customers/${customerParam}`, { replace: true })
  }
}, { immediate: true })

watch(() => route.query.new, (newParam) => {
  if (newParam) {
    createOpen.value = true
    router.replace({ query: { ...route.query, new: undefined } })
  }
}, { immediate: true })
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Customer"
            @click="createOpen = true"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search customers..."
            class="w-64"
          />
          <USelect v-model="accountTypeFilter" :items="accountTypeItems" class="w-52" />
          <USelect
            v-if="view === 'grid'"
            v-model="statusFilter"
            :items="statusItems"
            class="w-44"
          />
        </template>
        <template #right>
          <UTabs
            v-model="view"
            :items="viewItems"
            :content="false"
            size="xs"
            color="neutral"
          />
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
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="metric in customerStats"
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

      <div
        v-if="!customers?.length && status !== 'pending'"
        class="mt-10 mx-auto max-w-md rounded-lg border border-dashed border-default p-8 text-center"
      >
        <UIcon name="i-lucide-building-2" class="mx-auto size-8 text-dimmed" />
        <h2 class="mt-3 font-semibold text-highlighted">
          No customers yet
        </h2>
        <p class="mt-1 text-sm text-muted">
          Add your first practice to start tracking the journey from prospect to live customer.
        </p>
        <UButton
          label="Add your first customer"
          icon="i-lucide-plus"
          class="mt-4"
          @click="createOpen = true"
        />
      </div>

      <template v-else>
        <CustomersPipelineBoard
          v-if="view === 'board' && boardCustomers.length"
          class="mt-5"
          :customers="boardCustomers"
          @updated="onCustomerUpdated"
        />

        <div v-else-if="view === 'grid'" class="mt-5 grid gap-4 lg:grid-cols-3">
          <div
            v-for="customer in filteredCustomers"
            :key="customer.id"
            role="link"
            tabindex="0"
            class="cursor-pointer rounded-lg border border-default bg-default p-4 shadow-xs transition hover:ring-2 hover:ring-primary/20"
            @click="navigateTo(`/customers/${customer.id}`)"
            @keydown.enter="navigateTo(`/customers/${customer.id}`)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted">
                  {{ customer.name }}
                </p>
                <p class="mt-1 truncate text-sm text-muted">
                  {{ customer.primary_domain || 'No domain recorded' }}
                </p>
                <p v-if="customer.customer_identifier" class="mt-1 truncate text-xs text-muted">
                  {{ customer.customer_identifier }}
                </p>
              </div>
              <div class="flex shrink-0 flex-wrap justify-end gap-2">
                <UBadge :label="formatStatusLabel(customer.account_type)" :color="accountTypeColor(customer.account_type)" variant="subtle" />
                <CustomersStatusMenu :customer="customer" size="xs" @updated="onCustomerUpdated" />
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-muted">
                  Health
                </p>
                <p class="font-medium text-highlighted">
                  {{ customer.health_score }}%
                </p>
                <UProgress
                  :model-value="customer.health_score"
                  :color="healthScoreColor(customer.health_score)"
                  size="xs"
                  class="mt-2"
                />
              </div>
              <div>
                <p class="text-muted">
                  Monthly
                </p>
                <p class="font-medium text-highlighted">
                  {{ formatMoney(Number(customer.recurring_monthly_amount)) }}
                </p>
              </div>
            </div>

            <div v-if="customer.tags.length" class="mt-4 flex flex-wrap gap-2">
              <UBadge
                v-for="tag in customer.tags"
                :key="tag"
                :label="tag"
                color="neutral"
                variant="outline"
              />
            </div>

            <div class="mt-5 flex items-center justify-between border-t border-default pt-3">
              <p class="text-xs text-muted">
                Updated {{ formatRelativeTime(customer.updated_at) }}
              </p>
              <span class="flex items-center gap-1 text-xs text-muted">
                View
                <UIcon name="i-lucide-arrow-right" class="size-3.5" />
              </span>
            </div>
          </div>
        </div>

        <UAlert
          v-if="customers?.length && !visibleCount && status !== 'pending'"
          class="mt-5"
          icon="i-lucide-search-x"
          color="neutral"
          variant="subtle"
          title="No customers match that view"
          description="Clear the search or change the filters."
          :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'subtle', onClick: clearFilters }]"
        />
      </template>

      <UModal
        v-model:open="createOpen"
        title="New customer"
        description="Add a practice to the Rex CRM."
      >
        <template #body>
          <UForm
            id="create-customer"
            :schema="createSchema"
            :state="createState"
            class="space-y-4"
            @submit="createCustomer"
          >
            <UFormField label="Practice name" name="name" required>
              <UInput
                v-model="createState.name"
                placeholder="Abbey Road Opticians"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Account type" name="account_type">
                <USelect
                  v-model="createState.account_type"
                  :items="[...customerAccountTypes]"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Status" name="status">
                <USelect
                  v-model="createState.status"
                  :items="[...customerStatuses]"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Domain" name="primary_domain">
                <UInput
                  v-model="createState.primary_domain"
                  placeholder="practice.example"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Customer identifier" name="customer_identifier">
                <UInput
                  v-model="createState.customer_identifier"
                  placeholder="cecil-amey"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Rex project ref" name="rex_project_ref">
                <UInput
                  v-model="createState.rex_project_ref"
                  placeholder="cqvrjkaarnlcibwqgnpn"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Rex Supabase URL" name="rex_supabase_url">
                <UInput
                  v-model="createState.rex_supabase_url"
                  placeholder="https://project.supabase.co"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Monthly amount" name="recurring_monthly_amount">
                <UInputNumber
                  v-model="createState.recurring_monthly_amount"
                  :min="0"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Onboarding fee" name="onboarding_fee">
                <UInputNumber
                  v-model="createState.onboarding_fee"
                  :min="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Tags" name="tags" help="Comma separated, e.g. multi-branch, priority">
              <UInput
                v-model="createState.tags"
                placeholder="onboarding, priority"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Commercial notes" name="commercial_notes">
              <UTextarea
                v-model="createState.commercial_notes"
                :rows="4"
                autoresize
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="createOpen = false"
              />
              <UButton
                label="Create customer"
                icon="i-lucide-check"
                type="submit"
                :loading="saving"
              />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
