<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const adminLabel = computed(() => user.value?.email || 'Admin')

const signOut = async () => {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const links = [[{
  label: 'Control',
  icon: 'i-lucide-layout-dashboard',
  to: '/',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Tickets',
  icon: 'i-lucide-life-buoy',
  to: '/tickets',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Customers',
  icon: 'i-lucide-users',
  to: '/customers',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Deployments',
  icon: 'i-lucide-cloud',
  to: '/deployments',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Compliance',
  icon: 'i-lucide-folder-lock',
  to: '/compliance',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Onboarding',
  icon: 'i-lucide-list-checks',
  to: '/onboarding',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Charges',
  icon: 'i-lucide-receipt',
  to: '/charges',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Versions',
  icon: 'i-lucide-git-branch',
  to: '/releases',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Timeline',
  icon: 'i-lucide-history',
  to: '/timeline',
  onSelect: () => {
    open.value = false
  }
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings',
  onSelect: () => {
    open.value = false
  }
}]] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
  id: 'links',
  label: 'CRM',
  items: links.flat()
}, {
  id: 'actions',
  label: 'Actions',
  items: [{
    id: 'sync-releases',
    label: 'Sync GitHub releases',
    icon: 'i-lucide-refresh-cw',
    to: '/releases'
  }]
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex min-h-12 items-center gap-3 px-2">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-inverted">
            <UIcon name="i-lucide-glasses" class="size-5" />
          </div>
          <div v-if="!collapsed" class="min-w-0">
            <p class="truncate text-sm font-semibold text-highlighted">
              Rex Admin CRM
            </p>
            <p class="truncate text-xs text-muted">
              Private ops console
            </p>
          </div>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center gap-3 px-2 py-1">
          <UAvatar icon="i-lucide-user-round" size="sm" />
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ adminLabel }}
            </p>
            <p class="truncate text-xs text-muted">
              Single admin V1
            </p>
          </div>
          <UTooltip text="Sign out">
            <UButton
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="collapsed ? 'Sign out' : undefined"
              @click="signOut"
            />
          </UTooltip>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
