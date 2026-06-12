<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CrmCustomer, CustomerStatus } from '~/types'

const props = defineProps<{
  customers: CrmCustomer[]
}>()

const emit = defineEmits<{
  updated: [customer: CrmCustomer]
}>()

const { changeStatus, pendingId } = useCustomerStatusChange()

const draggingId = ref<string | null>(null)
const dragOverStage = ref<CustomerStatus | null>(null)

const columns = computed(() => customerLifecycleStages.map((stage) => {
  const stageCustomers = props.customers.filter(customer => customer.status === stage)
  return {
    stage,
    customers: stageCustomers,
    monthly: stageCustomers.reduce((sum, customer) => sum + Number(customer.recurring_monthly_amount), 0)
  }
}))

function moveItems(customer: CrmCustomer): DropdownMenuItem[] {
  return customerLifecycleStages
    .filter(stage => stage !== customer.status)
    .map(stage => ({
      label: `Move to ${formatStatusLabel(stage)}`,
      icon: customerStatusIcon(stage),
      onSelect: () => {
        changeStatus(customer, stage, updated => emit('updated', updated))
      }
    }))
}

function onDragStart(event: DragEvent, customer: CrmCustomer) {
  draggingId.value = customer.id

  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', customer.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragEnd() {
  draggingId.value = null
  dragOverStage.value = null
}

function onDragOver(event: DragEvent, stage: CustomerStatus) {
  event.preventDefault()
  dragOverStage.value = stage

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent, stage: CustomerStatus) {
  event.preventDefault()

  const droppedId = event.dataTransfer?.getData('text/plain') || draggingId.value
  const customer = props.customers.find(item => item.id === droppedId)

  dragOverStage.value = null
  draggingId.value = null

  if (!customer || customer.status === stage) return

  changeStatus(customer, stage, updated => emit('updated', updated))
}

function openCustomer(customer: CrmCustomer) {
  if (draggingId.value) return
  navigateTo(`/customers/${customer.id}`)
}

function readinessScore(customer: CrmCustomer) {
  return customer.pipeline?.onboarding_readiness_score ?? 0
}

function goLiveTargetLabel(customer: CrmCustomer) {
  const target = customer.pipeline?.onboarding_go_live_target
  if (!target) return null

  return new Date(target).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  })
}

function prospectTouchLabel(customer: CrmCustomer) {
  const days = customer.pipeline?.days_since_last_touch

  if (days === null || days === undefined) return 'No touch logged'
  if (days === 0) return 'Touched today'
  if (days === 1) return '1 day since touch'
  return `${days} days since touch`
}
</script>

<template>
  <div class="flex gap-3 overflow-x-auto pb-2">
    <div
      v-for="column in columns"
      :key="column.stage"
      class="flex w-72 shrink-0 flex-col rounded-lg border border-default bg-elevated/40 transition"
      :class="dragOverStage === column.stage ? 'ring-2 ring-primary/40' : ''"
      @dragover="onDragOver($event, column.stage)"
      @dragleave="dragOverStage = dragOverStage === column.stage ? null : dragOverStage"
      @drop="onDrop($event, column.stage)"
    >
      <div class="flex items-center justify-between gap-2 px-3 pt-3">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon :name="customerStatusIcon(column.stage)" class="size-4 shrink-0 text-muted" />
          <p class="truncate text-sm font-semibold capitalize text-highlighted">
            {{ formatStatusLabel(column.stage) }}
          </p>
          <UBadge
            :label="column.customers.length.toString()"
            :color="customerStatusColor(column.stage)"
            variant="subtle"
            size="sm"
          />
        </div>
        <p v-if="column.monthly" class="shrink-0 text-xs text-muted">
          {{ formatMoney(column.monthly) }}/mo
        </p>
      </div>

      <div class="flex min-h-32 flex-1 flex-col gap-2 p-2">
        <div
          v-for="customer in column.customers"
          :key="customer.id"
          role="button"
          tabindex="0"
          draggable="true"
          class="group cursor-grab rounded-md border border-default bg-default p-3 text-left shadow-xs transition hover:ring-2 hover:ring-primary/20 active:cursor-grabbing"
          :class="[
            draggingId === customer.id ? 'opacity-50' : '',
            pendingId === customer.id ? 'pointer-events-none opacity-60' : ''
          ]"
          @dragstart="onDragStart($event, customer)"
          @dragend="onDragEnd"
          @click="openCustomer(customer)"
          @keydown.enter="openCustomer(customer)"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 truncate font-medium text-highlighted">
              {{ customer.name }}
            </p>
            <UDropdownMenu :items="moveItems(customer)" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                size="xs"
                class="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                :aria-label="`Move ${customer.name} to another stage`"
                @click.stop
              />
            </UDropdownMenu>
          </div>

          <p class="mt-0.5 truncate text-xs text-muted">
            {{ customer.primary_domain || customer.customer_identifier || 'No domain recorded' }}
          </p>

          <div class="mt-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span
                class="size-2 rounded-full"
                :class="{
                  'bg-success': customer.health_score >= 80,
                  'bg-warning': customer.health_score >= 60 && customer.health_score < 80,
                  'bg-error': customer.health_score < 60
                }"
              />
              <span class="text-xs text-muted">{{ customer.health_score }}%</span>
              <UBadge
                v-if="customer.account_type !== 'customer'"
                :label="customer.account_type"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
            <p class="text-xs font-medium text-highlighted">
              {{ formatMoney(Number(customer.recurring_monthly_amount)) }}/mo
            </p>
          </div>

          <div v-if="customer.status === 'onboarding'" class="mt-3 space-y-2 border-t border-default pt-3">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="text-muted">Readiness</span>
              <span class="font-medium text-highlighted">{{ readinessScore(customer) }}%</span>
            </div>
            <UProgress
              :model-value="readinessScore(customer)"
              :color="customer.pipeline?.onboarding_blocked ? 'error' : healthScoreColor(readinessScore(customer))"
              size="xs"
            />
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-if="goLiveTargetLabel(customer)"
                :label="`Target ${goLiveTargetLabel(customer)}`"
                icon="i-lucide-calendar-days"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <UBadge
                v-if="customer.pipeline?.onboarding_blocked"
                label="Blocked"
                icon="i-lucide-octagon-alert"
                color="error"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-else-if="!customer.pipeline?.onboarding_readiness_score"
                label="No launch plan"
                icon="i-lucide-clipboard-list"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
          </div>

          <div v-else-if="customer.status === 'prospect'" class="mt-3 flex items-center gap-1.5 border-t border-default pt-3 text-xs text-muted">
            <UIcon name="i-lucide-clock-3" class="size-3.5" />
            <span>{{ prospectTouchLabel(customer) }}</span>
          </div>
        </div>

        <div
          v-if="!column.customers.length"
          class="flex flex-1 items-center justify-center rounded-md border border-dashed border-default p-4"
        >
          <p class="text-xs text-muted">
            {{ dragOverStage === column.stage ? 'Drop to move here' : 'No customers' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
