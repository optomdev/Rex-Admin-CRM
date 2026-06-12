<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CustomerDeployment, Release } from '~/types'

const props = defineProps<{
  customerId: string
  deployments: CustomerDeployment[]
  releases?: Release[] | null
}>()

const emit = defineEmits<{
  changed: []
}>()

const deploymentEnvironments = ['demo', 'staging', 'production', 'training'] as const
const deploymentStatuses = ['provisioning', 'active', 'maintenance', 'paused', 'retired', 'error'] as const
const deploymentHealthStatuses = ['unknown', 'healthy', 'degraded', 'down'] as const
const deploymentDeployStatuses = ['unknown', 'building', 'deployed', 'failed', 'rolled_back'] as const

const schema = z.object({
  name: z.string().min(2, 'Enter the deployment name'),
  environment: z.enum(deploymentEnvironments),
  status: z.enum(deploymentStatuses),
  health_status: z.enum(deploymentHealthStatuses),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  supabase_url: z.string().url('Enter a valid Supabase URL').optional().or(z.literal('')),
  app_url: z.string().url('Enter a valid app URL').optional().or(z.literal('')),
  region: z.string().optional(),
  deployed_release_id: z.string().optional(),
  deployed_version: z.string().optional(),
  app_provider: z.string().optional(),
  app_provider_project: z.string().optional(),
  git_repo: z.string().optional(),
  git_branch: z.string().optional(),
  git_tag: z.string().optional(),
  git_commit: z.string().optional(),
  latest_migration_version: z.string().optional(),
  latest_migration_name: z.string().optional(),
  edge_functions_commit: z.string().optional(),
  deploy_status: z.enum(deploymentDeployStatuses),
  last_deployed_at: z.string().optional(),
  last_smoke_tested_at: z.string().optional(),
  is_primary: z.boolean(),
  notes: z.string().optional()
})

type Schema = z.output<typeof schema>

const toast = useToast()
const modalOpen = ref(false)
const saving = ref(false)
const removing = ref(false)
const editingDeploymentId = ref<string | null>(null)

const state = reactive<Schema>(blankState())

const modalTitle = computed(() => editingDeploymentId.value ? 'Edit deployment' : 'New deployment')

const releaseItems = computed(() => [
  { label: 'No linked version', value: '' },
  ...(props.releases ?? []).map(release => ({
    label: `${release.version} - ${release.title}`,
    value: release.id
  }))
])

function blankState(): Schema {
  return {
    name: '',
    environment: 'production',
    status: 'active',
    health_status: 'unknown',
    customer_identifier: '',
    rex_project_ref: '',
    supabase_url: '',
    app_url: '',
    region: 'eu-west-2',
    deployed_release_id: '',
    deployed_version: '',
    app_provider: '',
    app_provider_project: '',
    git_repo: '',
    git_branch: '',
    git_tag: '',
    git_commit: '',
    latest_migration_version: '',
    latest_migration_name: '',
    edge_functions_commit: '',
    deploy_status: 'unknown',
    last_deployed_at: '',
    last_smoke_tested_at: '',
    is_primary: false,
    notes: ''
  }
}

function openCreate() {
  editingDeploymentId.value = null
  Object.assign(state, blankState(), { is_primary: props.deployments.length === 0 })
  modalOpen.value = true
}

function openEdit(deployment: CustomerDeployment) {
  editingDeploymentId.value = deployment.id
  Object.assign(state, blankState(), {
    name: deployment.name,
    environment: deployment.environment,
    status: deployment.status,
    health_status: deployment.health_status,
    customer_identifier: deployment.customer_identifier || '',
    rex_project_ref: deployment.rex_project_ref || '',
    supabase_url: deployment.supabase_url || '',
    app_url: deployment.app_url || '',
    region: deployment.region || '',
    deployed_release_id: deployment.deployed_release_id || '',
    deployed_version: deployment.deployed_version || '',
    app_provider: deployment.app_provider || '',
    app_provider_project: deployment.app_provider_project || '',
    git_repo: deployment.git_repo || '',
    git_branch: deployment.git_branch || '',
    git_tag: deployment.git_tag || '',
    git_commit: deployment.git_commit || '',
    latest_migration_version: deployment.latest_migration_version || '',
    latest_migration_name: deployment.latest_migration_name || '',
    edge_functions_commit: deployment.edge_functions_commit || '',
    deploy_status: deployment.deploy_status || 'unknown',
    last_deployed_at: deployment.last_deployed_at || '',
    last_smoke_tested_at: deployment.last_smoke_tested_at || '',
    is_primary: deployment.is_primary,
    notes: deployment.notes || ''
  })
  modalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  const body = {
    ...event.data,
    customer_identifier: event.data.customer_identifier || null,
    rex_project_ref: event.data.rex_project_ref || null,
    supabase_url: event.data.supabase_url || null,
    app_url: event.data.app_url || null,
    region: event.data.region || null,
    deployed_release_id: event.data.deployed_release_id || null,
    deployed_version: event.data.deployed_version || null,
    app_provider: event.data.app_provider || null,
    app_provider_project: event.data.app_provider_project || null,
    git_repo: event.data.git_repo || null,
    git_branch: event.data.git_branch || null,
    git_tag: event.data.git_tag || null,
    git_commit: event.data.git_commit || null,
    latest_migration_version: event.data.latest_migration_version || null,
    latest_migration_name: event.data.latest_migration_name || null,
    edge_functions_commit: event.data.edge_functions_commit || null,
    deploy_status: event.data.deploy_status,
    last_deployed_at: event.data.last_deployed_at || null,
    last_smoke_tested_at: event.data.last_smoke_tested_at || null,
    notes: event.data.notes || null
  }

  try {
    if (editingDeploymentId.value) {
      await $fetch(`/api/customers/deployments/${editingDeploymentId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/customers/${props.customerId}/deployments`, { method: 'POST', body })
    }

    toast.add({
      title: editingDeploymentId.value ? 'Deployment updated' : 'Deployment added',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not save deployment',
      description: error instanceof Error ? error.message : 'The deployment was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function removeDeployment() {
  if (!editingDeploymentId.value) return

  removing.value = true

  try {
    await $fetch(`/api/customers/deployments/${editingDeploymentId.value}`, { method: 'DELETE' })

    toast.add({
      title: 'Deployment removed',
      color: 'success',
      icon: 'i-lucide-check'
    })

    modalOpen.value = false
    emit('changed')
  } catch (error) {
    toast.add({
      title: 'Could not remove deployment',
      description: error instanceof Error ? error.message : 'The deployment was not removed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removing.value = false
  }
}

function statusColor(status: CustomerDeployment['status']) {
  if (status === 'active') return 'success'
  if (status === 'provisioning' || status === 'maintenance') return 'warning'
  if (status === 'error') return 'error'
  return 'neutral'
}

function healthColor(status: CustomerDeployment['health_status']) {
  if (status === 'healthy') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'down') return 'error'
  return 'neutral'
}

function deployStatusColor(status: CustomerDeployment['deploy_status']) {
  if (status === 'deployed') return 'success'
  if (status === 'building') return 'warning'
  if (status === 'failed' || status === 'rolled_back') return 'error'
  return 'neutral'
}
</script>

<template>
  <section class="space-y-3 rounded-lg border border-default bg-default p-4 shadow-xs">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold text-highlighted">
          Deployments
        </h2>
        <p class="text-sm text-muted">
          Supabase Cloud projects and Rex environments for this customer.
        </p>
      </div>
      <UButton
        label="Deployment"
        icon="i-lucide-plus"
        size="sm"
        @click="openCreate"
      />
    </div>

    <div v-if="deployments.length" class="grid gap-3 lg:grid-cols-2">
      <div
        v-for="deployment in deployments"
        :key="deployment.id"
        class="rounded-md border border-default bg-elevated p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">
                {{ deployment.name }}
              </p>
              <UBadge
                v-if="deployment.is_primary"
                label="Primary"
                color="primary"
                variant="subtle"
              />
            </div>
            <p class="mt-1 truncate text-sm text-muted">
              {{ deployment.supabase_url || deployment.app_url || 'No endpoint recorded' }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UTooltip v-if="deployment.app_url" text="Open Rex">
              <UButton
                :to="deployment.app_url"
                target="_blank"
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Open Rex app"
              />
            </UTooltip>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Edit deployment"
              @click="openEdit(deployment)"
            />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <UBadge :label="deployment.environment" color="neutral" variant="outline" />
          <UBadge :label="deployment.status" :color="statusColor(deployment.status)" variant="subtle" />
          <UBadge :label="deployment.health_status" :color="healthColor(deployment.health_status)" variant="subtle" />
          <UBadge :label="formatStatusLabel(deployment.deploy_status)" :color="deployStatusColor(deployment.deploy_status)" variant="subtle" />
        </div>

        <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt class="text-muted">
              Project ref
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.rex_project_ref || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Version
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.release?.version || deployment.deployed_version || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Provider
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.app_provider || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Branch
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.git_branch || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Tag / commit
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.git_tag || deployment.git_commit || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Latest migration
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.latest_migration_version || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Edge Functions
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.edge_functions_commit || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Identifier
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.customer_identifier || 'Not set' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Last seen
            </dt>
            <dd class="truncate font-medium text-highlighted">
              {{ deployment.last_seen_at ? formatRelativeTime(deployment.last_seen_at) : 'Not seen yet' }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div v-else class="rounded-md border border-dashed border-default p-6 text-center">
      <UIcon name="i-lucide-cloud" class="mx-auto size-6 text-dimmed" />
      <p class="mt-2 text-sm font-medium text-highlighted">
        No deployments yet
      </p>
      <p class="mt-1 text-sm text-muted">
        Add the Supabase project for this practice so support tickets route to the right customer.
      </p>
      <UButton
        label="Add deployment"
        icon="i-lucide-plus"
        size="sm"
        variant="subtle"
        class="mt-3"
        @click="openCreate"
      />
    </div>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
      description="Rex environment, version, and DevOps details."
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-5"
          @submit="onSubmit"
        >
          <div class="space-y-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Environment
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Name" name="name" required>
                <UInput v-model="state.name" placeholder="Rex production" class="w-full" />
              </UFormField>
              <UFormField label="Environment" name="environment">
                <USelect v-model="state.environment" :items="[...deploymentEnvironments]" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Status" name="status">
                <USelect v-model="state.status" :items="[...deploymentStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Health" name="health_status">
                <USelect v-model="state.health_status" :items="[...deploymentHealthStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Region" name="region">
                <UInput v-model="state.region" placeholder="eu-west-2" class="w-full" />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <div class="space-y-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Endpoints and identity
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Customer identifier" name="customer_identifier">
                <UInput v-model="state.customer_identifier" placeholder="cecil-amey" class="w-full" />
              </UFormField>
              <UFormField label="Supabase ref" name="rex_project_ref">
                <UInput v-model="state.rex_project_ref" class="w-full" />
              </UFormField>
              <UFormField label="Supabase URL" name="supabase_url">
                <UInput v-model="state.supabase_url" placeholder="https://project.supabase.co" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="App URL" name="app_url">
              <UInput v-model="state.app_url" placeholder="https://rexapp.co.uk" class="w-full" />
            </UFormField>
          </div>

          <USeparator />

          <div class="space-y-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Version
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Linked version" name="deployed_release_id">
                <USelect v-model="state.deployed_release_id" :items="releaseItems" class="w-full" />
              </UFormField>
              <UFormField label="Version label" name="deployed_version">
                <UInput v-model="state.deployed_version" placeholder="commit-87a328e" class="w-full" />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <div class="space-y-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              DevOps
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="App provider" name="app_provider">
                <UInput v-model="state.app_provider" placeholder="AWS Amplify" class="w-full" />
              </UFormField>
              <UFormField label="Provider project" name="app_provider_project">
                <UInput v-model="state.app_provider_project" class="w-full" />
              </UFormField>
              <UFormField label="Deploy status" name="deploy_status">
                <USelect v-model="state.deploy_status" :items="[...deploymentDeployStatuses]" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Git repo" name="git_repo">
                <UInput v-model="state.git_repo" placeholder="owner/rex-app" class="w-full" />
              </UFormField>
              <UFormField label="Branch" name="git_branch">
                <UInput v-model="state.git_branch" placeholder="main" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Tag" name="git_tag">
                <UInput v-model="state.git_tag" class="w-full" />
              </UFormField>
              <UFormField label="Commit" name="git_commit">
                <UInput v-model="state.git_commit" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Migration version" name="latest_migration_version">
                <UInput v-model="state.latest_migration_version" class="w-full" />
              </UFormField>
              <UFormField label="Migration name" name="latest_migration_name">
                <UInput v-model="state.latest_migration_name" class="w-full" />
              </UFormField>
              <UFormField label="Edge Functions commit" name="edge_functions_commit">
                <UInput v-model="state.edge_functions_commit" class="w-full" />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <div class="space-y-4">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Operations
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Last deployed at" name="last_deployed_at" help="e.g. 2026-06-01 14:30">
                <UInput v-model="state.last_deployed_at" class="w-full" />
              </UFormField>
              <UFormField label="Smoke tested at" name="last_smoke_tested_at">
                <UInput v-model="state.last_smoke_tested_at" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="state.notes"
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>
            <UCheckbox
              v-model="state.is_primary"
              label="Primary deployment"
              description="Keeps customer-level webhook routing fields in sync with this environment."
            />
          </div>

          <div class="flex items-center justify-between gap-2">
            <UButton
              v-if="editingDeploymentId"
              label="Remove"
              color="error"
              variant="subtle"
              icon="i-lucide-trash-2"
              :loading="removing"
              @click="removeDeployment"
            />
            <div class="ml-auto flex gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="modalOpen = false"
              />
              <UButton
                :label="editingDeploymentId ? 'Save deployment' : 'Add deployment'"
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
