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

const columns = computed(() => customerLifecycleStages.map(stage => ({
  stage,
  customers: props.customers.filter(customer => customer.status === stage)
})))

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

function healthEdge(score: number) {
  if (score >= 80) return 'border-l-success'
  if (score >= 60) return 'border-l-warning'
  return 'border-l-error'
}

function stageSignal(customer: CrmCustomer): { label: string, urgent: boolean } | null {
  if (customer.status === 'onboarding') {
    if (customer.pipeline?.onboarding_blocked) {
      return { label: 'Blocked', urgent: true }
    }

    const readiness = customer.pipeline?.onboarding_readiness_score
    if (readiness === null || readiness === undefined) {
      return { label: 'No launch plan', urgent: false }
    }

    const target = customer.pipeline?.onboarding_go_live_target
    const targetLabel = target
      ? ` · ${new Date(target).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : ''
    return { label: `${readiness}% ready${targetLabel}`, urgent: false }
  }

  if (customer.status === 'prospect') {
    const days = customer.pipeline?.days_since_last_touch
    if (days === null || days === undefined) return { label: 'No touch logged', urgent: false }
    if (days === 0) return { label: 'Touched today', urgent: false }
    return { label: `${days}d since touch`, urgent: days > 14 }
  }

  return null
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
</script>

<template>
  <div class="flex gap-3 overflow-x-auto pb-2">
    <div
      v-for="column in columns"
      :key="column.stage"
      class="flex w-64 shrink-0 flex-col rounded-lg transition"
      :class="dragOverStage === column.stage ? 'bg-elevated/60 ring-1 ring-primary/30' : 'bg-elevated/30'"
      @dragover="onDragOver($event, column.stage)"
      @dragleave="dragOverStage = dragOverStage === column.stage ? null : dragOverStage"
      @drop="onDrop($event, column.stage)"
    >
      <div class="flex items-baseline gap-2 px-3 pt-3">
        <p class="truncate text-sm font-medium capitalize text-highlighted">
          {{ formatStatusLabel(column.stage) }}
        </p>
        <span class="text-sm text-muted">{{ column.customers.length }}</span>
      </div>

      <div class="flex min-h-24 flex-1 flex-col gap-1.5 p-2">
        <div
          v-for="customer in column.customers"
          :key="customer.id"
          role="button"
          tabindex="0"
          draggable="true"
          class="group cursor-grab rounded-md border border-default border-l-2 bg-default px-3 py-2 text-left transition hover:bg-elevated/50 active:cursor-grabbing"
          :class="[
            healthEdge(customer.health_score),
            draggingId === customer.id ? 'opacity-50' : '',
            pendingId === customer.id ? 'pointer-events-none opacity-60' : ''
          ]"
          @dragstart="onDragStart($event, customer)"
          @dragend="onDragEnd"
          @click="openCustomer(customer)"
          @keydown.enter="openCustomer(customer)"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="min-w-0 truncate text-sm font-medium text-highlighted">
              {{ customer.name }}
            </p>
            <UDropdownMenu :items="moveItems(customer)" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis"
                color="neutral"
                variant="ghost"
                size="xs"
                class="-mr-1.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                :aria-label="`Move ${customer.name} to another stage`"
                @click.stop
              />
            </UDropdownMenu>
          </div>

          <p class="mt-0.5 truncate text-xs text-muted">
            {{ customer.primary_domain || customer.customer_identifier || '—' }}
          </p>

          <p
            v-if="stageSignal(customer)"
            class="mt-1 truncate text-xs"
            :class="stageSignal(customer)!.urgent ? 'font-medium text-error' : 'text-muted'"
          >
            {{ stageSignal(customer)!.label }}
          </p>
        </div>

        <div
          v-if="!column.customers.length"
          class="flex flex-1 items-center justify-center rounded-md border border-dashed border-default/50 p-4"
        >
          <p class="text-xs text-muted/60">
            {{ dragOverStage === column.stage ? 'Drop here' : '' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
