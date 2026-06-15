<script setup lang="ts">
import type { CustomerAccountType, CustomerDeployment } from '~/types'

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
      deployment.deployed_version,
      deployment.app_provider,
      deployment.git_repo,
      deployment.git_branch,
      deployment.git_tag,
      deployment.git_commit,
      deployment.latest_migration_version,
      deployment.latest_migration_name,
      deployment.edge_functions_commit
    ].filter(Boolean).join(' ').toLowerCase()

    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesEnvironment = environmentFilter.value === 'All' || deployment.environment === environmentFilter.value
    const matchesHealth = healthFilter.value === 'All' || deployment.health_status === healthFilter.value

    return matchesSearch && matchesEnvironment && matchesHealth
  })
})

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

function deployStatusColor(deployStatus: CustomerDeployment['deploy_status']): UiColor {
  if (deployStatus === 'deployed') return 'success'
  if (deployStatus === 'building') return 'warning'
  if (deployStatus === 'failed' || deployStatus === 'rolled_back') return 'error'
  return 'neutral'
}

function customerColor(customerStatus?: string): UiColor {
  if (customerStatus === 'active') return 'success'
  if (customerStatus === 'onboarding') return 'secondary'
  if (customerStatus === 'at_risk') return 'warning'
  if (customerStatus === 'churned') return 'error'
  return 'neutral'
}

function accountTypeColor(accountType?: CustomerAccountType): UiColor {
  if (accountType === 'internal') return 'info'
  if (accountType === 'customer') return 'success'
  if (accountType === 'partner') return 'secondary'
  if (accountType === 'franchise') return 'warning'
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
      <div class="divide-y divide-default rounded-lg border border-default">
        <div
          v-for="deployment in filteredDeployments"
          :key="deployment.id"
          class="grid gap-4 p-4 xl:grid-cols-[0.9fr_1fr_1.2fr_auto] xl:items-center"
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
              <UBadge :label="deployment.deploy_status.replaceAll('_', ' ')" :color="deployStatusColor(deployment.deploy_status)" variant="subtle" />
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
                <NuxtLink
                  v-if="deployment.customer"
                  :to="`/customers/${deployment.customer.id}`"
                  class="hover:text-primary"
                >
                  {{ deployment.customer.name }}
                </NuxtLink>
                <span v-else>Unlinked</span>
              </dd>
              <div v-if="deployment.customer" class="mt-2 flex flex-wrap gap-2">
                <UBadge
                  :label="deployment.customer.account_type.replaceAll('_', ' ')"
                  :color="accountTypeColor(deployment.customer.account_type)"
                  variant="subtle"
                />
                <UBadge
                  :label="deployment.customer.status.replaceAll('_', ' ')"
                  :color="customerColor(deployment.customer.status)"
                  variant="subtle"
                />
              </div>
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
                {{ deployment.git_tag || deployment.release?.version || deployment.deployed_version || 'Not linked' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.git_branch ? `${deployment.git_branch} @ ${deployment.git_commit || 'unknown'}` : deployment.release?.title || deployment.notes || 'No rollout note' }}
              </p>
            </div>
          </dl>

          <dl class="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-4">
            <div class="min-w-0">
              <dt class="text-muted">
                Provider
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.app_provider || 'Not set' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.app_provider_project || deployment.git_repo || 'No provider project' }}
              </p>
            </div>
            <div class="min-w-0">
              <dt class="text-muted">
                Branch
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.git_branch || 'Not set' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.git_commit || 'No commit recorded' }}
              </p>
            </div>
            <div class="min-w-0">
              <dt class="text-muted">
                Migration
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.latest_migration_version || 'Not set' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.latest_migration_name || 'No migration name' }}
              </p>
            </div>
            <div class="min-w-0">
              <dt class="text-muted">
                Edge source
              </dt>
              <dd class="mt-1 truncate font-medium text-highlighted">
                {{ deployment.edge_functions_commit || 'Not set' }}
              </dd>
              <p class="mt-2 truncate text-xs text-muted">
                {{ deployment.last_smoke_tested_at ? `Smoke tested ${new Date(deployment.last_smoke_tested_at).toLocaleDateString('en-GB')}` : 'Smoke test not recorded' }}
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
        variant="subtle"
        title="No deployments match that view"
        description="Clear the search or change the deployment filters."
      />
    </template>
  </UDashboardPanel>
</template>
