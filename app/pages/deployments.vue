<script setup lang="ts">
import type { CustomerDeployment } from '~/types'

type UiColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const search = ref('')
const environmentFilter = ref('All')
const healthFilter = ref('All')

const { data: deployments, status, refresh } = await useAsyncData<CustomerDeployment[]>('deployments', () => $fetch('/api/deployments'))

const environmentItems = computed(() => ['All', ...new Set((deployments.value ?? []).map(deployment => deployment.environment))])
const healthItems = ['All', 'unknown', 'healthy', 'degraded', 'down']

const filteredDeployments = computed(() => {
  const rows = deployments.value ?? []
  return rows.filter((deployment) => {
    const haystack = [
      deployment.name,
      deployment.customer?.name,
      deployment.customer_identifier,
      deployment.rex_project_ref,
      deployment.supabase_url,
      deployment.release?.version,
      deployment.deployed_version
    ].filter(Boolean).join(' ').toLowerCase()

    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesEnvironment = environmentFilter.value === 'All' || deployment.environment === environmentFilter.value
    const matchesHealth = healthFilter.value === 'All' || deployment.health_status === healthFilter.value

    return matchesSearch && matchesEnvironment && matchesHealth
  })
})

const activeDeployments = computed(() => (deployments.value ?? []).filter(deployment => deployment.status === 'active'))
const needsAttention = computed(() => (deployments.value ?? []).filter((deployment) => {
  return ['degraded', 'down'].includes(deployment.health_status)
    || ['error', 'maintenance'].includes(deployment.status)
    || (!deployment.deployed_release_id && !deployment.deployed_version)
}))
const linkedVersions = computed(() => (deployments.value ?? []).filter(deployment => deployment.deployed_release_id || deployment.deployed_version))
const lastSeenCount = computed(() => (deployments.value ?? []).filter(deployment => deployment.last_seen_at).length)

const metrics = computed(() => [{
  label: 'Deployments',
  value: `${deployments.value?.length ?? 0}`,
  detail: `${activeDeployments.value.length} active`,
  icon: 'i-lucide-cloud',
  color: 'primary' as const
}, {
  label: 'Attention',
  value: `${needsAttention.value.length}`,
  detail: needsAttention.value.length ? 'Review health or version links' : 'No obvious deployment gaps',
  icon: needsAttention.value.length ? 'i-lucide-triangle-alert' : 'i-lucide-shield-check',
  color: needsAttention.value.length ? 'warning' as const : 'success' as const
}, {
  label: 'Version Linked',
  value: `${linkedVersions.value.length}`,
  detail: 'Release, tag, or commit attached',
  icon: 'i-lucide-git-branch',
  color: linkedVersions.value.length ? 'success' as const : 'neutral' as const
}, {
  label: 'Seen',
  value: `${lastSeenCount.value}`,
  detail: 'Has webhook activity signal',
  icon: 'i-lucide-radar',
  color: lastSeenCount.value ? 'success' as const : 'neutral' as const
}])

function statusColor(deploymentStatus: CustomerDeployment['status']): UiColor {
  if (deploymentStatus === 'active') return 'success'
  if (deploymentStatus === 'provisioning' || deploymentStatus === 'maintenance') return 'warning'
  if (deploymentStatus === 'error') return 'error'
  return 'neutral'
}

function healthColor(healthStatus: CustomerDeployment['health_status']): UiColor {
  if (healthStatus === 'healthy') return 'success'
  if (healthStatus === 'degraded') return 'warning'
  if (healthStatus === 'down') return 'error'
  return 'neutral'
}

function customerColor(customerStatus?: string): UiColor {
  if (customerStatus === 'active') return 'success'
  if (customerStatus === 'onboarding') return 'secondary'
  if (customerStatus === 'at_risk') return 'warning'
  if (customerStatus === 'churned') return 'error'
  return 'neutral'
}
</script>

<template>
  <UDashboardPanel id="deployments">
    <template #header>
      <UDashboardNavbar title="Deployments">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            @click="refresh()"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search deployments..."
            class="w-72"
          />
          <USelect v-model="environmentFilter" :items="environmentItems" class="w-40" />
          <USelect v-model="healthFilter" :items="healthItems" class="w-40" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-lg border border-default bg-default p-4 shadow-xs"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted">
                {{ metric.label }}
              </p>
              <p class="mt-2 text-2xl font-semibold text-highlighted">
                {{ metric.value }}
              </p>
              <p class="mt-1 truncate text-sm text-muted">
                {{ metric.detail }}
              </p>
            </div>
            <UBadge :color="metric.color" variant="subtle" square>
              <UIcon :name="metric.icon" class="size-4" />
            </UBadge>
          </div>
        </div>
      </div>

      <div class="mt-5 divide-y divide-default rounded-lg border border-default">
        <div
          v-for="deployment in filteredDeployments"
          :key="deployment.id"
          class="grid gap-4 p-4 xl:grid-cols-[1.1fr_1fr_auto] xl:items-center"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-if="deployment.is_primary"
                label="Primary"
                color="primary"
                variant="subtle"
              />
              <UBadge :label="deployment.environment" color="neutral" variant="outline" />
              <UBadge :label="deployment.status" :color="statusColor(deployment.status)" variant="subtle" />
              <UBadge :label="deployment.health_status" :color="healthColor(deployment.health_status)" variant="subtle" />
            </div>

            <p class="mt-3 truncate text-base font-semibold text-highlighted">
              {{ deployment.name }}
            </p>
            <p class="mt-1 truncate text-sm text-muted">
              {{ deployment.supabase_url || deployment.app_url || 'No endpoint recorded' }}
            </p>
          </div>

          <dl class="grid gap-3 text-sm sm:grid-cols-3">
            <div class="min-w-0">
              <dt class="text-muted">
                Customer
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.customer?.name || 'Unlinked' }}
              </dd>
              <UBadge
                v-if="deployment.customer"
                class="mt-2"
                :label="deployment.customer.status.replaceAll('_', ' ')"
                :color="customerColor(deployment.customer.status)"
                variant="subtle"
              />
            </div>
            <div class="min-w-0">
              <dt class="text-muted">
                Project ref
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.rex_project_ref || 'Not set' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.customer_identifier || 'No identifier' }}
              </p>
            </div>
            <div class="min-w-0">
              <dt class="text-muted">
                Version
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.release?.version || deployment.deployed_version || 'Not linked' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.release?.title || deployment.notes || 'No rollout note' }}
              </p>
            </div>
          </dl>

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              v-if="deployment.app_url"
              :to="deployment.app_url"
              target="_blank"
              icon="i-lucide-external-link"
              color="neutral"
              variant="ghost"
              aria-label="Open Rex app"
            />
            <UButton
              v-if="deployment.customer"
              :to="`/customers?customer=${deployment.customer.id}`"
              icon="i-lucide-panel-right-open"
              label="Customer"
              color="neutral"
              variant="subtle"
            />
          </div>
        </div>
      </div>

      <UAlert
        v-if="!filteredDeployments.length && status !== 'pending'"
        class="mt-5"
        icon="i-lucide-cloud-off"
        color="neutral"
        title="No deployments match that view"
        description="Clear the search or change the deployment filters."
      />
    </template>
  </UDashboardPanel>
</template>
