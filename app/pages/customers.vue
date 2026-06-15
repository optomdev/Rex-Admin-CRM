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

function healthEdge(score: number) {
  if (score >= 80) return 'border-l-success'
  if (score >= 60) return 'border-l-warning'
  return 'border-l-error'
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
          :customers="boardCustomers"
          @updated="onCustomerUpdated"
        />

        <div v-else-if="view === 'grid'" class="grid gap-3 lg:grid-cols-3">
          <div
            v-for="customer in filteredCustomers"
            :key="customer.id"
            role="link"
            tabindex="0"
            class="cursor-pointer rounded-lg border border-default border-l-2 bg-default p-4 transition hover:bg-elevated/50"
            :class="healthEdge(customer.health_score)"
            @click="navigateTo(`/customers/${customer.id}`)"
            @keydown.enter="navigateTo(`/customers/${customer.id}`)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ customer.name }}
                </p>
                <p class="mt-0.5 truncate text-sm text-muted">
                  {{ customer.primary_domain || customer.customer_identifier || '—' }}
                </p>
              </div>
              <CustomersStatusMenu
                class="shrink-0"
                :customer="customer"
                size="xs"
                @updated="onCustomerUpdated"
              />
            </div>

            <div class="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{{ formatMoney(Number(customer.recurring_monthly_amount)) }}/mo</span>
              <span>Updated {{ formatRelativeTime(customer.updated_at) }}</span>
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
