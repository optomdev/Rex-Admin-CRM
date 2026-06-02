<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const links = [[{
  label: 'Integrations',
  icon: 'i-lucide-waypoints',
  to: '/settings',
  exact: true
}, {
  label: 'User management',
  icon: 'i-lucide-users',
  to: '/settings/members'
}, {
  label: 'Webhook Security',
  icon: 'i-lucide-shield-check',
  to: '/settings/security'
}, {
  label: 'System Health',
  icon: 'i-lucide-activity',
  to: '/settings/health'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex w-full flex-col gap-4 sm:gap-6 lg:max-w-6xl lg:mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
