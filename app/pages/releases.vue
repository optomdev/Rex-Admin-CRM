<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CustomerReleaseStatus, Release, ReleaseDetail, RolloutStatus } from '~/types'

const toast = useToast()
const syncing = ref(false)
const rolloutOpen = ref(false)
const editOpen = ref(false)
const rolloutLoading = ref(false)
const releaseSaving = ref(false)
const rolloutSaving = ref<string | null>(null)
const releaseDetail = ref<ReleaseDetail | null>(null)
const editingReleaseId = ref<string | null>(null)

const { data: releases, status, refresh } = await useAsyncData<Release[]>('releases', () => $fetch('/api/releases'))
const rolloutStatuses: RolloutStatus[] = ['not_started', 'scheduled', 'deployed', 'blocked', 'rolled_back']
const releaseSchema = z.object({
  title: z.string().min(1, 'Enter a release title'),
  release_notes: z.string().optional(),
  known_issues: z.string().optional(),
  published_at: z.string().optional(),
  github_url: z.string().url('Enter a valid GitHub URL').optional().or(z.literal(''))
})

type ReleaseSchema = z.output<typeof releaseSchema>

interface RolloutForm {
  rollout_status: RolloutStatus
  scheduled_for: string
  notes: string
}

interface FetchErrorLike {
  data?: {
    message?: string
    statusMessage?: string
  }
  message?: string
  statusMessage?: string
}

const rolloutForms = reactive<Record<string, RolloutForm>>({})
const releaseState = reactive<ReleaseSchema>({
  title: '',
  release_notes: '',
  known_issues: '',
  published_at: '',
  github_url: ''
})

const currentRelease = computed(() => releaseDetail.value?.release ?? null)
const currentRollouts = computed(() => releaseDetail.value?.rollouts ?? [])
const deployedCount = computed(() => currentRollouts.value.filter(item => item.rollout_status === 'deployed').length)
const blockedCount = computed(() => currentRollouts.value.filter(item => item.rollout_status === 'blocked').length)
const rolloutProgress = computed(() => currentRollouts.value.length
  ? Math.round((deployedCount.value / currentRollouts.value.length) * 100)
  : 0)

const releaseStats = computed(() => {
  const rows = releases.value ?? []
  const latest = rows[0]
  const withKnownIssues = rows.filter(release => release.known_issues).length

  return [{
    label: 'Imported',
    value: rows.length.toString(),
    detail: 'GitHub release records',
    icon: 'i-lucide-tags',
    color: 'primary' as const
  }, {
    label: 'Latest',
    value: latest?.version ?? 'None',
    detail: latest?.title ?? 'Run GitHub sync',
    icon: 'i-lucide-git-branch',
    color: 'secondary' as const
  }, {
    label: 'Known Issues',
    value: withKnownIssues.toString(),
    detail: withKnownIssues ? 'Rollout notes required' : 'No issues recorded',
    icon: withKnownIssues ? 'i-lucide-triangle-alert' : 'i-lucide-shield-check',
    color: withKnownIssues ? 'warning' as const : 'success' as const
  }]
})

function publishedLabel(date?: string | null) {
  if (!date) return 'Unpublished'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date))
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const fetchError = error as FetchErrorLike
    return fetchError.data?.statusMessage
      || fetchError.data?.message
      || fetchError.statusMessage
      || fetchError.message
      || fallback
  }

  return fallback
}

function resetReleaseForm() {
  editingReleaseId.value = null
  releaseState.title = ''
  releaseState.release_notes = ''
  releaseState.known_issues = ''
  releaseState.published_at = ''
  releaseState.github_url = ''
}

function openReleaseEdit(release: Release) {
  editingReleaseId.value = release.id
  releaseState.title = release.title
  releaseState.release_notes = release.release_notes || ''
  releaseState.known_issues = release.known_issues || ''
  releaseState.published_at = release.published_at ? release.published_at.slice(0, 10) : ''
  releaseState.github_url = release.github_url || ''
  editOpen.value = true
}

function rolloutColor(rolloutStatus: RolloutStatus) {
  if (rolloutStatus === 'deployed') return 'success'
  if (rolloutStatus === 'scheduled') return 'primary'
  if (rolloutStatus === 'blocked') return 'error'
  if (rolloutStatus === 'rolled_back') return 'warning'
  return 'neutral'
}

function ensureRolloutForm(rollout: CustomerReleaseStatus) {
  let form = rolloutForms[rollout.id]

  if (!form) {
    form = {
      rollout_status: rollout.rollout_status,
      scheduled_for: rollout.scheduled_for || '',
      notes: rollout.notes || ''
    }
    rolloutForms[rollout.id] = form
  }

  return form
}

function rolloutFormStatus(rollout: CustomerReleaseStatus) {
  return ensureRolloutForm(rollout).rollout_status
}

function rolloutFormSchedule(rollout: CustomerReleaseStatus) {
  return ensureRolloutForm(rollout).scheduled_for
}

function rolloutFormNotes(rollout: CustomerReleaseStatus) {
  return ensureRolloutForm(rollout).notes
}

function setRolloutStatus(rollout: CustomerReleaseStatus, value: string) {
  ensureRolloutForm(rollout).rollout_status = value as RolloutStatus
}

function setRolloutSchedule(rollout: CustomerReleaseStatus, value: string | number) {
  ensureRolloutForm(rollout).scheduled_for = value.toString()
}

function setRolloutNotes(rollout: CustomerReleaseStatus, value: string | number) {
  ensureRolloutForm(rollout).notes = value.toString()
}

async function syncReleases() {
  syncing.value = true

  try {
    const result = await $fetch<{ imported: number, simulated?: boolean, message?: string }>('/api/releases/sync', {
      method: 'POST'
    })

    toast.add({
      title: result.simulated ? 'Sync checked' : 'GitHub releases synced',
      description: result.message || `${result.imported} releases imported or updated.`,
      color: result.simulated ? 'warning' : 'success',
      icon: result.simulated ? 'i-lucide-alert-triangle' : 'i-lucide-check'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Release sync failed',
      description: errorMessage(error, 'Check GitHub environment settings.'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    syncing.value = false
  }
}

async function openRollout(release: Release) {
  rolloutOpen.value = true
  rolloutLoading.value = true

  try {
    releaseDetail.value = await $fetch<ReleaseDetail>(`/api/releases/${release.id}`)
    for (const rollout of releaseDetail.value.rollouts) {
      rolloutForms[rollout.id] = {
        rollout_status: rollout.rollout_status,
        scheduled_for: rollout.scheduled_for || '',
        notes: rollout.notes || ''
      }
    }
  } catch (error) {
    toast.add({
      title: 'Could not load rollout',
      description: errorMessage(error, 'Customer rollout status was not loaded.'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    rolloutLoading.value = false
  }
}

async function saveRollout(rollout: CustomerReleaseStatus) {
  rolloutSaving.value = rollout.id

  try {
    const form = ensureRolloutForm(rollout)
    const result = await $fetch<CustomerReleaseStatus>(`/api/releases/rollouts/${rollout.id}`, {
      method: 'PATCH',
      body: {
        rollout_status: form.rollout_status,
        scheduled_for: form.scheduled_for || null,
        notes: form.notes || null
      }
    })

    const index = currentRollouts.value.findIndex(item => item.id === rollout.id)
    if (index !== -1 && releaseDetail.value) {
      releaseDetail.value.rollouts.splice(index, 1, result)
    }

    toast.add({
      title: 'Rollout updated',
      description: `${result.customer?.name || 'Customer'} is now ${form.rollout_status.replaceAll('_', ' ')}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update rollout',
      description: errorMessage(error, 'The rollout status was not saved.'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    rolloutSaving.value = null
  }
}

async function saveReleaseDetails(event: FormSubmitEvent<ReleaseSchema>) {
  if (!editingReleaseId.value) return

  releaseSaving.value = true

  try {
    const updated = await $fetch<Release>(`/api/releases/${editingReleaseId.value}`, {
      method: 'PATCH',
      body: {
        title: event.data.title,
        release_notes: event.data.release_notes || null,
        known_issues: event.data.known_issues || null,
        published_at: event.data.published_at ? `${event.data.published_at}T00:00:00.000Z` : null,
        github_url: event.data.github_url || null
      }
    })

    const index = releases.value?.findIndex(item => item.id === updated.id) ?? -1
    if (releases.value && index !== -1) {
      releases.value.splice(index, 1, updated)
    } else {
      await refresh()
    }

    if (releaseDetail.value?.release.id === updated.id) {
      releaseDetail.value.release = updated
    }

    toast.add({
      title: 'Release saved',
      description: `${updated.version} now has CRM-managed notes.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    editOpen.value = false
    resetReleaseForm()
  } catch (error) {
    toast.add({
      title: 'Could not save release',
      description: errorMessage(error, 'Release details were not updated.'),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    releaseSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="releases">
    <template #header>
      <UDashboardNavbar title="Versions">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            label="Sync GitHub"
            :loading="syncing"
            @click="syncReleases"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-5 grid gap-3 md:grid-cols-3">
        <div
          v-for="metric in releaseStats"
          :key="metric.label"
          class="rounded-lg border border-default bg-default p-4 shadow-xs"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted">
                {{ metric.label }}
              </p>
              <p class="mt-2 truncate text-2xl font-semibold text-highlighted">
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

      <div class="grid gap-4 xl:grid-cols-2">
        <UCard
          v-for="release in releases"
          :key="release.id"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge :label="release.version" color="secondary" variant="subtle" />
                <span class="text-sm text-muted">{{ publishedLabel(release.published_at) }}</span>
              </div>
              <h2 class="mt-3 font-semibold text-highlighted">
                {{ release.title }}
              </h2>
              <p class="mt-2 line-clamp-3 text-sm text-muted">
                {{ release.release_notes || 'No release notes stored yet.' }}
              </p>
              <UAlert
                v-if="release.known_issues"
                class="mt-4"
                icon="i-lucide-triangle-alert"
                color="warning"
                variant="subtle"
                title="Known issues"
                :description="release.known_issues"
              />
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                aria-label="Edit release"
                @click="openReleaseEdit(release)"
              />
              <UButton
                icon="i-lucide-rocket"
                color="neutral"
                variant="ghost"
                aria-label="Manage rollout"
                @click="openRollout(release)"
              />
              <UButton
                v-if="release.github_url"
                :to="release.github_url"
                target="_blank"
                icon="i-simple-icons-github"
                color="neutral"
                variant="ghost"
              />
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UButton
          icon="i-lucide-refresh-cw"
          label="Loading releases"
          color="neutral"
          variant="ghost"
          loading
        />
      </div>

      <USlideover
        v-model:open="rolloutOpen"
        :title="currentRelease?.version || 'Release rollout'"
        :description="currentRelease?.title || 'Customer deployment status'"
        :ui="{ content: 'sm:max-w-3xl' }"
      >
        <template #body>
          <div v-if="rolloutLoading" class="space-y-3">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-16 w-full" />
            <USkeleton class="h-16 w-full" />
          </div>

          <div v-else-if="currentRelease" class="space-y-6">
            <div class="rounded-lg border border-default bg-elevated/30 p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge :label="currentRelease.version" color="secondary" variant="subtle" />
                    <UBadge
                      :label="`${deployedCount}/${currentRollouts.length} deployed`"
                      color="success"
                      variant="outline"
                    />
                    <UBadge
                      v-if="blockedCount"
                      :label="`${blockedCount} blocked`"
                      color="error"
                      variant="subtle"
                    />
                  </div>
                  <p class="mt-3 text-lg font-semibold text-highlighted">
                    Customer Rollout
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    Track which Rex deployments have received this version.
                  </p>
                </div>
                <div class="min-w-40">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted">Deployed</span>
                    <span class="font-medium text-highlighted">{{ rolloutProgress }}%</span>
                  </div>
                  <UProgress
                    :model-value="rolloutProgress"
                    :color="blockedCount ? 'warning' : 'success'"
                    class="mt-2"
                  />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg border border-default">
              <div class="grid gap-3 border-b border-default bg-elevated/40 px-4 py-3 text-xs font-medium uppercase text-muted lg:grid-cols-[1fr_12rem_10rem_8rem]">
                <span>Customer</span>
                <span>Status</span>
                <span>Schedule</span>
                <span class="lg:text-right">Action</span>
              </div>

              <div
                v-for="rollout in currentRollouts"
                :key="rollout.id"
                class="grid gap-3 border-b border-default p-4 last:border-b-0 lg:grid-cols-[1fr_12rem_10rem_8rem] lg:items-start"
              >
                <div class="min-w-0">
                  <p class="font-medium text-highlighted">
                    {{ rollout.customer?.name || 'Unknown customer' }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <UBadge
                      :label="rollout.rollout_status.replaceAll('_', ' ')"
                      :color="rolloutColor(rollout.rollout_status)"
                      variant="subtle"
                    />
                    <span v-if="rollout.scheduled_for" class="text-xs text-muted">
                      Scheduled {{ publishedLabel(rollout.scheduled_for) }}
                    </span>
                  </div>
                  <UTextarea
                    :model-value="rolloutFormNotes(rollout)"
                    :rows="2"
                    autoresize
                    placeholder="Rollout notes, blockers, rollback context..."
                    class="mt-3 w-full"
                    @update:model-value="setRolloutNotes(rollout, $event)"
                  />
                </div>

                <USelect
                  :model-value="rolloutFormStatus(rollout)"
                  :items="rolloutStatuses"
                  class="w-full"
                  @update:model-value="setRolloutStatus(rollout, $event as string)"
                />

                <UInput
                  :model-value="rolloutFormSchedule(rollout)"
                  type="date"
                  class="w-full"
                  @update:model-value="setRolloutSchedule(rollout, $event)"
                />

                <div class="flex justify-end">
                  <UButton
                    icon="i-lucide-save"
                    label="Save"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :loading="rolloutSaving === rollout.id"
                    @click="saveRollout(rollout)"
                  />
                </div>
              </div>
            </div>

            <UAlert
              icon="i-lucide-info"
              color="neutral"
              variant="subtle"
              title="Rollout planning"
              description="Use scheduled dates for planned deployments, notes for blockers or rollback context, and the status field for the current deployment state."
            />
          </div>
        </template>
      </USlideover>

      <UModal
        v-model:open="editOpen"
        title="Edit release"
        description="Capture CRM-owned release notes, known issues, and rollout context."
      >
        <template #body>
          <UForm
            id="edit-release"
            :schema="releaseSchema"
            :state="releaseState"
            class="space-y-4"
            @submit="saveReleaseDetails"
          >
            <UFormField label="Title" name="title" required>
              <UInput v-model="releaseState.title" class="w-full" />
            </UFormField>

            <UFormField label="Published date" name="published_at">
              <UInput v-model="releaseState.published_at" type="date" class="w-full" />
            </UFormField>

            <UFormField label="GitHub URL" name="github_url">
              <UInput
                v-model="releaseState.github_url"
                icon="i-simple-icons-github"
                placeholder="https://github.com/owner/repo/releases/tag/v1.2.3"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Release notes" name="release_notes">
              <UTextarea
                v-model="releaseState.release_notes"
                :rows="5"
                autoresize
                placeholder="Customer-facing improvements, fixes, and rollout context."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Known issues" name="known_issues">
              <UTextarea
                v-model="releaseState.known_issues"
                :rows="4"
                autoresize
                placeholder="Known defects, exclusions, rollback notes, or customer warnings."
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="editOpen = false"
              />
              <UButton
                label="Save release"
                icon="i-lucide-save"
                type="submit"
                :loading="releaseSaving"
              />
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
