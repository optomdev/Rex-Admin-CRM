<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CrmCustomer } from '~/types'

const props = withDefaults(defineProps<{
  customer: Pick<CrmCustomer, 'id' | 'name' | 'status'>
  size?: 'xs' | 'sm' | 'md'
}>(), {
  size: 'sm'
})

const emit = defineEmits<{
  updated: [customer: CrmCustomer]
}>()

const { changeStatus, pendingId } = useCustomerStatusChange()

const items = computed<DropdownMenuItem[]>(() => customerLifecycleStages.map(stage => ({
  label: formatStatusLabel(stage),
  icon: customerStatusIcon(stage),
  type: 'checkbox' as const,
  checked: stage === props.customer.status,
  onSelect: () => {
    changeStatus(props.customer, stage, updated => emit('updated', updated))
  }
})))
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton
      :label="formatStatusLabel(customer.status)"
      :color="customerStatusColor(customer.status)"
      :icon="customerStatusIcon(customer.status)"
      :loading="pendingId === customer.id"
      :size="size"
      variant="subtle"
      trailing-icon="i-lucide-chevron-down"
      :aria-label="`Change status for ${customer.name}`"
      @click.stop
    />
  </UDropdownMenu>
</template>
