<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CrmCustomer, TimelineItem } from '~/types'

const { data: items, status, refresh } = await useAsyncData<TimelineItem[]>('timeline', () => $fetch('/api/timeline'))
const { data: customers } = await useAsyncData<CrmCustomer[]>('timeline-customers', () => $fetch('/api/customers'))
const typeFilter = ref<'All' | TimelineItem['item_type']>('All')
const noteOpen = ref(false)
const noteSaving = ref(false)
const toast = useToast()
const route = useRoute()
const router = useRouter()

const typeItems = ['All', 'ticket', 'message', 'onboarding', 'charge', 'release', 'note']
const noteSchema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  title: z.string().trim().min(2, 'Enter a note title').max(160),
  body: z.string().trim().min(1, 'Write the note').max(4000)
})

type NoteSchema = z.output<typeof noteSchema>

const noteState = reactive<NoteSchema>({
  customer_id: '',
  title: '',
  body: ''
})

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
const customerScopedItems = computed(() => (items.value ?? [])
  .filter(item => customerFilter.value === 'all' || item.customer_id === customerFilter.value))

const filteredItems = computed(() => {
  const rows = customerScopedItems.value
  return typeFilter.value === 'All'
    ? rows
    : rows.filter(item => item.item_type === typeFilter.value)
})

const timelineStats = computed(() => {
  const rows = customerScopedItems.value
  return [{
    label: 'Events',
    value: rows.length.toString(),
    detail: `${filteredItems.value.length} in view`,
    icon: 'i-lucide-history',
    color: 'primary' as const
  }, {
    label: 'Customers',
    value: new Set(rows.map(item => item.customer_id)).size.toString(),
    detail: 'With recorded activity',
    icon: 'i-lucide-building-2',
    color: 'secondary' as const
  }]
})

const iconForType = (type: TimelineItem['item_type']) => {
  if (type === 'ticket') return 'i-lucide-life-buoy'
  if (type === 'message') return 'i-lucide-message-square'
  if (type === 'onboarding') return 'i-lucide-list-checks'
  if (type === 'charge') return 'i-lucide-receipt'
  if (type === 'release') return 'i-lucide-git-branch'
  return 'i-lucide-sticky-note'
}

const colorForType = (type: TimelineItem['item_type']) => {
  if (type === 'ticket') return 'primary'
  if (type === 'message') return 'secondary'
  if (type === 'onboarding') return 'success'
  if (type === 'charge') return 'warning'
  if (type === 'release') return 'neutral'
  return 'neutral'
}

function resetNoteForm() {
  noteState.customer_id = ''
  noteState.title = ''
  noteState.body = ''
}

watch(noteOpen, (open) => {
  if (open && customerFilter.value !== 'all' && !noteState.customer_id) {
    noteState.customer_id = customerFilter.value
  }
})

async function addTimelineNote(event: FormSubmitEvent<NoteSchema>) {
  noteSaving.value = true

  try {
    await $fetch('/api/timeline/notes', {
      method: 'POST',
      body: event.data
    })

    toast.add({
      title: 'Note added',
      description: 'The note is now part of the customer timeline.',
      color: 'success',
      icon: 'i-lucide-check'
    })

    noteOpen.value = false
    resetNoteForm()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Could not add note',
      description: error instanceof Error ? error.message : 'The timeline note was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    noteSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="timeline">
    <template #header>
      <UDashboardNavbar title="Timeline">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-sticky-note" label="Note" @click="noteOpen = true" />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <USelect v-model="typeFilter" :items="typeItems" class="w-48" />
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
            to="/timeline"
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
      <div class="mx-auto max-w-5xl">
        <div class="mb-5 grid gap-3 sm:grid-cols-2">
          <div
            v-for="metric in timelineStats"
            :key="metric.label"
            class="rounded-lg border border-default bg-default p-4 shadow-xs"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm text-muted">
                  {{ metric.label }}
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ metric.value }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  {{ metric.detail }}
                </p>
              </div>
              <UBadge :color="metric.color" variant="subtle" square>
                <UIcon :name="metric.icon" class="size-4" />
              </UBadge>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="grid grid-cols-[2.5rem_1fr] gap-4"
          >
            <div class="flex justify-center">
              <div class="flex size-9 items-center justify-center rounded-md bg-elevated ring-1 ring-default">
                <UIcon :name="iconForType(item.item_type)" class="size-4 text-muted" />
              </div>
            </div>
            <div class="rounded-lg border border-default p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-medium text-highlighted">
                  {{ item.title }}
                </p>
                <span class="text-xs text-muted">
                  {{ new Date(item.occurred_at).toLocaleString('en-GB') }}
                </span>
              </div>
              <p class="mt-1 text-sm text-muted">
                <NuxtLink
                  v-if="item.customer"
                  :to="`/customers/${item.customer.id}`"
                  class="hover:text-primary"
                >
                  {{ item.customer.name }}
                </NuxtLink>
                <span v-else>Unknown customer</span>
                - {{ item.body }}
              </p>
              <UBadge
                class="mt-3"
                :label="item.item_type"
                :color="colorForType(item.item_type)"
                variant="outline"
              />
            </div>
          </div>
        </div>

        <UAlert
          v-if="!filteredItems.length && status !== 'pending'"
          icon="i-lucide-history"
          color="neutral"
          variant="subtle"
          title="No timeline items yet"
          description="Tickets, charges, onboarding updates, releases, and notes will appear here."
        />

        <UModal
          v-model:open="noteOpen"
          title="New timeline note"
          description="Record a customer note without creating a ticket or charge."
        >
          <template #body>
            <UForm
              id="create-timeline-note"
              :schema="noteSchema"
              :state="noteState"
              class="space-y-4"
              @submit="addTimelineNote"
            >
              <UFormField label="Customer" name="customer_id" required>
                <USelect
                  v-model="noteState.customer_id"
                  :items="customerItems"
                  placeholder="Choose customer"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Title" name="title" required>
                <UInput
                  v-model="noteState.title"
                  placeholder="DPO follow-up"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Note" name="body" required>
                <UTextarea
                  v-model="noteState.body"
                  :rows="5"
                  autoresize
                  placeholder="Record the customer update, blocker, decision, or follow-up."
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="noteOpen = false"
                />
                <UButton
                  label="Add note"
                  icon="i-lucide-check"
                  type="submit"
                  :loading="noteSaving"
                />
              </div>
            </UForm>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
