<script setup lang="ts">
definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const redirectInfo = useSupabaseCookieRedirect()
const route = useRoute()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const resolveRedirectPath = (clearSavedPath = false) => {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect
  }

  const savedRedirect = clearSavedPath ? redirectInfo.pluck() : redirectInfo.path.value

  if (savedRedirect?.startsWith('/')) {
    return savedRedirect
  }

  return '/'
}

watchEffect(() => {
  if (user.value) {
    navigateTo(resolveRedirectPath(true))
  }
})

const signIn = async () => {
  errorMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  toast.add({
    title: 'Signed in',
    description: 'Welcome back to Rex Hub.',
    color: 'success',
    icon: 'i-lucide-check'
  })

  await navigateTo(resolveRedirectPath(true))
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-muted px-4 py-10">
    <UCard class="w-full max-w-md" :ui="{ root: 'rounded-lg', body: 'p-6 sm:p-7' }">
      <form class="space-y-5" @submit.prevent="signIn">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-20 shrink-0 items-center justify-center rounded-md bg-[#1c222d] px-2">
            <img src="/brand/rex-email-logo-v3.png" alt="" class="w-full hue-rotate-[260deg]">
          </div>
          <div>
            <h1 class="text-lg font-semibold text-highlighted">
              Rex Hub
            </h1>
            <p class="text-sm text-muted">
              Private admin sign in
            </p>
          </div>
        </div>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :description="errorMessage"
        />

        <UFormField label="Email" name="email" required>
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            icon="i-lucide-mail"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Your Supabase Auth password"
            icon="i-lucide-lock-keyhole"
            class="w-full"
            required
          />
        </UFormField>

        <UButton
          type="submit"
          block
          label="Sign in"
          icon="i-lucide-log-in"
          :loading="loading"
        />
      </form>
    </UCard>
  </main>
</template>
