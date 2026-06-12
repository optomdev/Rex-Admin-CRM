<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CustomerBranch } from '~/types'

const props = defineProps<{
  customerId: string
  branches: CustomerBranch[]
}>()

const emit = defineEmits<{
  changed: []
}>()

const branchStatuses = ['planned', 'active', 'paused', 'closed'] as const

const schema = z.object({
  name: z.string().min(2, 'Enter the branch name'),
  address: z.string().optional(),
  postcode: z.string().optional(),
  branch_code: z.string().optional(),
  status: z.enum(branchStatuses)
})

type Schema = z.output<typeof schema>

const toast = useToast()
const modalOpen = ref(false)
const saving = ref(false)
const removing = ref(false)
const editingBranchId = ref<string | null>(null)

const state = reactive<Schema>({
  name: '',
  address: '',
  postcode: '',
  branch_code: '',
  status: 'active'
})

const modalTitle = computed(() => editingBranchId.value ? 'Edit branch' : 'Add branch')

function openCreate() {
  editingBranchId.value = null
  state.name = ''
  state.address = ''
  state.postcode = ''
  state.branch_code = ''
  state.status = 'active'
  modalOpen.value = true
}

function openEdit(branch: CustomerBranch) {
  editingBranchId.value = branch.id
  state.name = branch.name
  state.address = branch.address || ''
  state.postcode = branch.postcode || ''
  state.branch_code = branch.branch_code || ''
  state.status = branch.status
  modalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  const body = {
    ...event.data,
    address: event.data.address || null,
    postcode: event.data.postcode || null,
    branch_code: event.data.branch_code || null
  }

  try {
    if (editingBranchId.value) {
      await $fetch(`/api/customers/branches/${editingBranchId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/customers/${props.customerId}/branches`, { method: 'POST', body })
    }

    toast.add({
      title: editingBranchId.value ? 'Branch updated' : 'Branch added',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not save branch',
      description: error instanceof Error ? error.message : 'The branch was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function removeBranch() {
  if (!editingBranchId.value) return

  removing.value = true

  try {
    await $fetch(`/api/customers/branches/${editingBranchId.value}`, { method: 'DELETE' })

    toast.add({
      title: 'Branch removed',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not remove branch',
      description: error instanceof Error ? error.message : 'The branch was not removed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <section class="space-y-3 rounded-lg border border-default bg-default p-4 shadow-xs">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold text-highlighted">
          Branches
        </h2>
        <p class="text-sm text-muted">
          Practice locations on this account.
        </p>
      </div>
      <UButton
        label="Branch"
        icon="i-lucide-plus"
        size="sm"
        variant="subtle"
        @click="openCreate"
      />
    </div>

    <div v-if="branches.length" class="space-y-2">
      <button
        v-for="branch in branches"
        :key="branch.id"
        type="button"
        class="block w-full rounded-md bg-elevated px-3 py-2 text-left transition hover:ring-2 hover:ring-primary/20"
        @click="openEdit(branch)"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium text-highlighted">
            {{ branch.name }}
          </p>
          <div class="flex items-center gap-1.5">
            <UBadge :label="branch.status" :color="branch.status === 'active' ? 'success' : 'neutral'" variant="subtle" />
            <UIcon name="i-lucide-pencil" class="size-3.5 text-dimmed" />
          </div>
        </div>
        <p class="mt-1 text-sm text-muted">
          {{ branch.branch_code || 'No code' }}<span v-if="branch.postcode"> - {{ branch.postcode }}</span>
        </p>
        <p v-if="branch.address" class="mt-1 text-xs text-muted">
          {{ branch.address }}
        </p>
      </button>
    </div>

    <div v-else class="rounded-md border border-dashed border-default p-4 text-center">
      <p class="text-sm text-muted">
        No branches yet. Track each practice location to plan rollouts and training.
      </p>
    </div>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
      description="Practice location details."
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Name" name="name" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField label="Status" name="status">
              <USelect v-model="state.status" :items="[...branchStatuses]" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Address" name="address">
            <UInput v-model="state.address" class="w-full" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Postcode" name="postcode">
              <UInput v-model="state.postcode" class="w-full" />
            </UFormField>
            <UFormField label="Branch code" name="branch_code">
              <UInput v-model="state.branch_code" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-between gap-2">
            <UButton
              v-if="editingBranchId"
              label="Remove"
              color="error"
              variant="subtle"
              icon="i-lucide-trash-2"
              :loading="removing"
              @click="removeBranch"
            />
            <div class="ml-auto flex gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="modalOpen = false"
              />
              <UButton
                :label="editingBranchId ? 'Save branch' : 'Add branch'"
                icon="i-lucide-check"
                type="submit"
                :loading="saving"
              />
            </div>
          </div>
        </UForm>
      </template>
    </UModal>
  </section>
</template>
