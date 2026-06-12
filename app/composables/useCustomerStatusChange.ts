import type { CrmCustomer, CustomerStatus } from '~/types'

type StatusChangeTarget = Pick<CrmCustomer, 'id' | 'name' | 'status'>

export function useCustomerStatusChange() {
  const toast = useToast()
  const pendingId = ref<string | null>(null)

  async function changeStatus(
    customer: StatusChangeTarget,
    status: CustomerStatus,
    onUpdated: (customer: CrmCustomer) => void,
    allowUndo = true
  ) {
    if (customer.status === status || pendingId.value) return

    pendingId.value = customer.id
    const previousStatus = customer.status

    try {
      const updated = await $fetch<CrmCustomer>(`/api/customers/${customer.id}/status`, {
        method: 'PATCH',
        body: { status }
      })

      onUpdated(updated)

      toast.add({
        title: `${customer.name} is now ${formatStatusLabel(status)}`,
        icon: customerStatusIcon(status),
        color: status === 'churned' ? 'neutral' : customerStatusColor(status),
        actions: allowUndo
          ? [{
              label: `Undo (back to ${formatStatusLabel(previousStatus)})`,
              color: 'neutral',
              variant: 'outline',
              onClick: () => {
                changeStatus({ ...customer, status }, previousStatus, onUpdated, false)
              }
            }]
          : undefined
      })
    } catch (error) {
      toast.add({
        title: 'Could not change status',
        description: error instanceof Error ? error.message : 'The status was not saved.',
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
    } finally {
      pendingId.value = null
    }
  }

  return { changeStatus, pendingId }
}
