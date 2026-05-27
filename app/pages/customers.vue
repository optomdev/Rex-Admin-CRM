<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CrmCustomer } from '~/types'

const search = ref('')
const statusFilter = ref('All')
const createOpen = ref(false)
const saving = ref(false)
const toast = useToast()

const { data: customers, status, refresh } = await useAsyncData<CrmCustomer[]>('customers', () => $fetch('/api/customers'))

const customerStatuses = ['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned'] as const
const customerStatusItems = [...customerStatuses]
const statusItems = ['All', ...customerStatuses]

const createSchema = z.object({
  name: z.string().min(2, 'Enter the practice name'),
  status: z.enum(customerStatuses),
  primary_domain: z.string().optional(),
  recurring_monthly_amount: z.coerce.number().min(0, 'Monthly amount cannot be negative'),
  onboarding_fee: z.coerce.number().min(0, 'Onboarding fee cannot be negative'),
  tags: z.string().optional(),
  commercial_notes: z.string().optional()
})

type CreateSchema = z.output<typeof createSchema>

const createState = reactive<CreateSchema>({
  name: '',
  status: 'prospect',
  primary_domain: '',
  recurring_monthly_amount: 0,
  onboarding_fee: 0,
  tags: '',
  commercial_notes: ''
})

const filteredCustomers = computed(() => {
  const rows = customers.value ?? []
  return rows.filter((customer) => {
    const matchesSearch = !search.value || customer.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'All' || customer.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

function resetCreateForm() {
  createState.name = ''
  createState.status = 'prospect'
  createState.primary_domain = ''
  createState.recurring_monthly_amount = 0
  createState.onboarding_fee = 0
  createState.tags = ''
  createState.commercial_notes = ''
}

async function createCustomer(event: FormSubmitEvent<CreateSchema>) {
  saving.value = true

  try {
    await $fetch('/api/customers', {
      method: 'POST',
      body: {
        ...event.data,
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
          <USelect v-model="statusFilter" :items="statusItems" class="w-44" />
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
      <div class="grid gap-4 lg:grid-cols-3">
        <UCard
          v-for="customer in filteredCustomers"
          :key="customer.id"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ customer.name }}
              </p>
              <p class="mt-1 truncate text-sm text-muted">
                {{ customer.primary_domain || 'No domain recorded' }}
              </p>
            </div>
            <UBadge :label="customer.status.replaceAll('_', ' ')" color="primary" variant="subtle" />
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-muted">
                Health
              </p>
              <p class="font-medium text-highlighted">
                {{ customer.health_score }}%
              </p>
            </div>
            <div>
              <p class="text-muted">
                Monthly
              </p>
              <p class="font-medium text-highlighted">
                GBP {{ customer.recurring_monthly_amount.toLocaleString('en-GB') }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge
              v-for="tag in customer.tags"
              :key="tag"
              :label="tag"
              color="neutral"
              variant="outline"
            />
          </div>
        </UCard>
      </div>

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

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Status" name="status">
                <USelect
                  v-model="createState.status"
                  :items="customerStatusItems"
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

            <UFormField label="Tags" name="tags">
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
