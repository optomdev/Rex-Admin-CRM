<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CustomerContact } from '~/types'

const props = defineProps<{
  customerId: string
  contacts: CustomerContact[]
}>()

const emit = defineEmits<{
  changed: []
}>()

const schema = z.object({
  name: z.string().min(2, 'Enter the contact name'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.string().optional(),
  is_primary: z.boolean()
})

type Schema = z.output<typeof schema>

const toast = useToast()
const modalOpen = ref(false)
const saving = ref(false)
const removing = ref(false)
const editingContactId = ref<string | null>(null)

const state = reactive<Schema>({
  name: '',
  email: '',
  phone: '',
  role: '',
  is_primary: false
})

const modalTitle = computed(() => editingContactId.value ? 'Edit contact' : 'Add contact')

function openCreate() {
  editingContactId.value = null
  state.name = ''
  state.email = ''
  state.phone = ''
  state.role = ''
  state.is_primary = props.contacts.length === 0
  modalOpen.value = true
}

function openEdit(contact: CustomerContact) {
  editingContactId.value = contact.id
  state.name = contact.name
  state.email = contact.email || ''
  state.phone = contact.phone || ''
  state.role = contact.role || ''
  state.is_primary = contact.is_primary
  modalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  const body = {
    ...event.data,
    email: event.data.email || null,
    phone: event.data.phone || null,
    role: event.data.role || null
  }

  try {
    if (editingContactId.value) {
      await $fetch(`/api/customers/contacts/${editingContactId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/customers/${props.customerId}/contacts`, { method: 'POST', body })
    }

    toast.add({
      title: editingContactId.value ? 'Contact updated' : 'Contact added',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not save contact',
      description: error instanceof Error ? error.message : 'The contact was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function removeContact() {
  if (!editingContactId.value) return

  removing.value = true

  try {
    await $fetch(`/api/customers/contacts/${editingContactId.value}`, { method: 'DELETE' })

    toast.add({
      title: 'Contact removed',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not remove contact',
      description: error instanceof Error ? error.message : 'The contact was not removed.',
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
          Contacts
        </h2>
        <p class="text-sm text-muted">
          Who to call at this practice.
        </p>
      </div>
      <UButton
        label="Contact"
        icon="i-lucide-plus"
        size="sm"
        variant="subtle"
        @click="openCreate"
      />
    </div>

    <div v-if="contacts.length" class="space-y-2">
      <button
        v-for="contact in contacts"
        :key="contact.id"
        type="button"
        class="block w-full rounded-md bg-elevated px-3 py-2 text-left transition hover:ring-2 hover:ring-primary/20"
        @click="openEdit(contact)"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium text-highlighted">
            {{ contact.name }}
          </p>
          <div class="flex items-center gap-1.5">
            <UBadge
              v-if="contact.is_primary"
              label="Primary"
              color="success"
              variant="subtle"
            />
            <UIcon name="i-lucide-pencil" class="size-3.5 text-dimmed" />
          </div>
        </div>
        <p class="mt-1 text-sm text-muted">
          {{ contact.role || 'No role' }}<span v-if="contact.email"> - {{ contact.email }}</span>
        </p>
        <p v-if="contact.phone" class="mt-1 text-xs text-muted">
          {{ contact.phone }}
        </p>
      </button>
    </div>

    <div v-else class="rounded-md border border-dashed border-default p-4 text-center">
      <p class="text-sm text-muted">
        No contacts yet. Add the practice owner or manager so support replies reach the right person.
      </p>
    </div>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
      description="Practice contact details."
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
            <UFormField label="Role" name="role">
              <UInput v-model="state.role" placeholder="Practice manager" class="w-full" />
            </UFormField>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Email" name="email">
              <UInput v-model="state.email" type="email" class="w-full" />
            </UFormField>
            <UFormField label="Phone" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
          </div>
          <UCheckbox v-model="state.is_primary" label="Primary contact" />

          <div class="flex items-center justify-between gap-2">
            <UButton
              v-if="editingContactId"
              label="Remove"
              color="error"
              variant="subtle"
              icon="i-lucide-trash-2"
              :loading="removing"
              @click="removeContact"
            />
            <div class="ml-auto flex gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="modalOpen = false"
              />
              <UButton
                :label="editingContactId ? 'Save contact' : 'Add contact'"
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
