<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CrmCustomer } from '~/types'

const props = defineProps<{
  customer: CrmCustomer
}>()

const emit = defineEmits<{
  saved: [customer: CrmCustomer]
}>()

const open = defineModel<boolean>('open', { default: false })

const customerStatuses = ['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned'] as const
const customerAccountTypes = ['internal', 'prospect', 'customer', 'partner', 'franchise'] as const

const schema = z.object({
  name: z.string().min(2, 'Enter the practice name'),
  account_type: z.enum(customerAccountTypes),
  status: z.enum(customerStatuses),
  health_score: z.coerce.number().int().min(0).max(100),
  primary_domain: z.string().optional(),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  rex_supabase_url: z.string().url('Enter a valid Supabase URL').optional().or(z.literal('')),
  recurring_monthly_amount: z.coerce.number().min(0, 'Monthly amount cannot be negative'),
  onboarding_fee: z.coerce.number().min(0, 'Onboarding fee cannot be negative'),
  tags: z.string().optional(),
  commercial_notes: z.string().optional()
})

type Schema = z.output<typeof schema>

const toast = useToast()
const saving = ref(false)

const state = reactive<Schema>({
  name: '',
  account_type: 'prospect',
  status: 'prospect',
  health_score: 75,
  primary_domain: '',
  customer_identifier: '',
  rex_project_ref: '',
  rex_supabase_url: '',
  recurring_monthly_amount: 0,
  onboarding_fee: 0,
  tags: '',
  commercial_notes: ''
})

watch(open, (isOpen) => {
  if (isOpen) hydrate(props.customer)
})

function hydrate(customer: CrmCustomer) {
  state.name = customer.name
  state.account_type = customer.account_type
  state.status = customer.status
  state.health_score = customer.health_score
  state.primary_domain = customer.primary_domain || ''
  state.customer_identifier = customer.customer_identifier || ''
  state.rex_project_ref = customer.rex_project_ref || ''
  state.rex_supabase_url = customer.rex_supabase_url || ''
  state.recurring_monthly_amount = Number(customer.recurring_monthly_amount)
  state.onboarding_fee = Number(customer.onboarding_fee)
  state.tags = customer.tags.join(', ')
  state.commercial_notes = customer.commercial_notes || ''
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  try {
    const updated = await $fetch<CrmCustomer>(`/api/customers/${props.customer.id}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        primary_domain: event.data.primary_domain || null,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        rex_supabase_url: event.data.rex_supabase_url || null,
        commercial_notes: event.data.commercial_notes || null,
        tags: event.data.tags
          ? event.data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : []
      }
    })

    toast.add({
      title: 'Customer updated',
      description: `${updated.name} is up to date.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    open.value = false
    emit('saved', updated)
  } catch (error) {
    toast.add({
      title: 'Could not update customer',
      description: error instanceof Error ? error.message : 'The customer was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit customer"
    description="Practice, deployment, and commercial details."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Practice name" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Account type" name="account_type">
            <USelect v-model="state.account_type" :items="[...customerAccountTypes]" class="w-full" />
          </UFormField>

          <UFormField label="Status" name="status">
            <USelect v-model="state.status" :items="[...customerStatuses]" class="w-full" />
          </UFormField>

          <UFormField label="Domain" name="primary_domain">
            <UInput v-model="state.primary_domain" placeholder="practice.example" class="w-full" />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Customer identifier" name="customer_identifier">
            <UInput v-model="state.customer_identifier" placeholder="cecil-amey" class="w-full" />
          </UFormField>

          <UFormField label="Rex project ref" name="rex_project_ref">
            <UInput v-model="state.rex_project_ref" class="w-full" />
          </UFormField>

          <UFormField label="Rex Supabase URL" name="rex_supabase_url">
            <UInput v-model="state.rex_supabase_url" placeholder="https://project.supabase.co" class="w-full" />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Health score" name="health_score">
            <UInputNumber
              v-model="state.health_score"
              :min="0"
              :max="100"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Monthly amount" name="recurring_monthly_amount">
            <UInputNumber v-model="state.recurring_monthly_amount" :min="0" class="w-full" />
          </UFormField>

          <UFormField label="Onboarding fee" name="onboarding_fee">
            <UInputNumber v-model="state.onboarding_fee" :min="0" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Tags" name="tags" help="Comma separated, e.g. multi-branch, priority">
          <UInput v-model="state.tags" class="w-full" />
        </UFormField>

        <UFormField label="Commercial notes" name="commercial_notes">
          <UTextarea
            v-model="state.commercial_notes"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Save changes"
            icon="i-lucide-save"
            type="submit"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
