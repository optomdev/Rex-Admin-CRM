<script setup lang="ts">
import * as z from 'zod'
import type { FormError } from '@nuxt/ui'

const supabase = useSupabaseClient()
const toast = useToast()
const saving = ref(false)

const passwordSchema = z.object({
  new: z.string().min(8, 'Must be at least 8 characters')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  new: ''
})

const validate = (_state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  return errors
}

async function updatePassword() {
  saving.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.new
    })

    if (error) throw error

    password.new = ''
    toast.add({
      title: 'Password updated',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update password',
      description: error instanceof Error ? error.message : 'Try signing in again first.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UPageCard
    title="Password"
    description="Update the Supabase Auth password for the current CRM admin session."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      class="flex flex-col gap-4 max-w-xs"
      @submit="updatePassword"
    >
      <UFormField name="new">
        <UInput
          v-model="password.new"
          type="password"
          placeholder="New password"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Update password"
        icon="i-lucide-key-round"
        class="w-fit"
        type="submit"
        :loading="saving"
      />
    </UForm>
  </UPageCard>

  <UPageCard
    title="Session Boundary"
    description="CRM pages and API routes require a Supabase Auth session. The signed Rex webhook remains available without a user session."
    variant="subtle"
    icon="i-lucide-shield-check"
  >
    <template #footer>
      <UBadge label="Single admin V1" color="success" variant="subtle" />
    </template>
  </UPageCard>
</template>
