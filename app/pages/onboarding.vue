<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CrmCustomer, OnboardingDetail, OnboardingProject, OnboardingStatus, OnboardingTask, TaskStatus } from '~/types'

const { data: projects, status, refresh } = await useAsyncData<OnboardingProject[]>('onboarding', () => $fetch('/api/onboarding'))
const { data: customers } = await useAsyncData<CrmCustomer[]>('onboarding-customers', () => $fetch('/api/customers'))
const toast = useToast()
const createOpen = ref(false)
const saving = ref(false)
const checklistOpen = ref(false)
const checklistLoading = ref(false)
const checklistSaving = ref<string | null>(null)
const projectSaving = ref(false)
const selectedProjectId = ref<string | null>(null)
const selectedProjectStatus = ref<OnboardingStatus>('planning')
const selectedGoLiveTarget = ref('')
const selectedBlockers = ref('')
const selectedTrainingNotes = ref('')
const onboardingDetail = ref<OnboardingDetail | null>(null)

const projectStatuses = ['planning', 'in_progress', 'ready_for_go_live', 'live', 'blocked', 'paused'] as const
const taskStatuses: TaskStatus[] = ['todo', 'doing', 'done', 'blocked']
const createSchema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  name: z.string().min(2, 'Enter a project name'),
  status: z.enum(projectStatuses),
  go_live_target: z.string().optional(),
  readiness_score: z.coerce.number().int().min(0).max(100),
  blockers: z.string().optional(),
  training_notes: z.string().optional()
})

type CreateSchema = z.output<typeof createSchema>

const createState = reactive<CreateSchema>({
  customer_id: '',
  name: '',
  status: 'planning',
  go_live_target: '',
  readiness_score: 0,
  blockers: '',
  training_notes: ''
})

const customerItems = computed(() => (customers.value ?? []).map(customer => ({
  label: customer.name,
  value: customer.id
})))

const currentProject = computed(() => onboardingDetail.value?.project ?? null)
const currentTasks = computed(() => onboardingDetail.value?.tasks ?? [])
const completedTasks = computed(() => currentTasks.value.filter(task => task.status === 'done').length)
const blockedTasks = computed(() => currentTasks.value.filter(task => task.status === 'blocked').length)
const checklistProgress = computed(() => currentTasks.value.length
  ? Math.round((completedTasks.value / currentTasks.value.length) * 100)
  : 0)

const onboardingStats = computed(() => {
  const rows = projects.value ?? []
  const blocked = rows.filter(project => project.status === 'blocked' || Boolean(project.blockers)).length
  const ready = rows.filter(project => project.readiness_score >= 80).length
  const averageReadiness = rows.length
    ? Math.round(rows.reduce((sum, project) => sum + project.readiness_score, 0) / rows.length)
    : 0

  return [{
    label: 'Projects',
    value: rows.length.toString(),
    detail: 'Launch workstreams',
    icon: 'i-lucide-rocket',
    color: 'primary' as const
  }, {
    label: 'Readiness',
    value: `${averageReadiness}%`,
    detail: 'Average launch confidence',
    icon: 'i-lucide-gauge',
    color: averageReadiness >= 75 ? 'success' as const : 'warning' as const
  }, {
    label: 'Ready Soon',
    value: ready.toString(),
    detail: 'At or above 80%',
    icon: 'i-lucide-circle-check',
    color: 'success' as const
  }, {
    label: 'Blockers',
    value: blocked.toString(),
    detail: blocked ? 'Needs follow-up' : 'Nothing blocking',
    icon: blocked ? 'i-lucide-octagon-alert' : 'i-lucide-shield-check',
    color: blocked ? 'warning' as const : 'success' as const
  }]
})

function statusColor(projectStatus: OnboardingProject['status']) {
  if (projectStatus === 'live') return 'success'
  if (projectStatus === 'ready_for_go_live') return 'success'
  if (projectStatus === 'blocked') return 'error'
  if (projectStatus === 'paused') return 'warning'
  if (projectStatus === 'in_progress') return 'primary'
  return 'neutral'
}

function readinessColor(score: number) {
  if (score >= 80) return 'success'
  if (score >= 55) return 'warning'
  return 'error'
}

function taskStatusColor(taskStatus: TaskStatus) {
  if (taskStatus === 'done') return 'success'
  if (taskStatus === 'doing') return 'primary'
  if (taskStatus === 'blocked') return 'error'
  return 'neutral'
}

function resetCreateForm() {
  createState.customer_id = ''
  createState.name = ''
  createState.status = 'planning'
  createState.go_live_target = ''
  createState.readiness_score = 0
  createState.blockers = ''
  createState.training_notes = ''
}

async function createProject(event: FormSubmitEvent<CreateSchema>) {
  saving.value = true

  try {
    await $fetch('/api/onboarding', {
      method: 'POST',
      body: {
        ...event.data,
        go_live_target: event.data.go_live_target || null,
        blockers: event.data.blockers || null,
        training_notes: event.data.training_notes || null
      }
    })

    toast.add({
      title: 'Onboarding project created',
      description: 'Compliance-led launch tasks have been generated.',
      color: 'success',
      icon: 'i-lucide-check'
    })

    createOpen.value = false
    resetCreateForm()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Could not create project',
      description: error instanceof Error ? error.message : 'The onboarding project was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function openChecklist(project: OnboardingProject) {
  checklistOpen.value = true
  selectedProjectId.value = project.id
  checklistLoading.value = true

  try {
    onboardingDetail.value = await $fetch<OnboardingDetail>(`/api/onboarding/${project.id}`)
    selectedProjectStatus.value = onboardingDetail.value.project.status
    selectedGoLiveTarget.value = onboardingDetail.value.project.go_live_target || ''
    selectedBlockers.value = onboardingDetail.value.project.blockers || ''
    selectedTrainingNotes.value = onboardingDetail.value.project.training_notes || ''
  } catch (error) {
    toast.add({
      title: 'Could not load checklist',
      description: error instanceof Error ? error.message : 'The onboarding checklist was not loaded.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    checklistLoading.value = false
  }
}

async function saveProjectDetails() {
  if (!selectedProjectId.value) return

  projectSaving.value = true

  try {
    const project = await $fetch<OnboardingProject>(`/api/onboarding/${selectedProjectId.value}`, {
      method: 'PATCH',
      body: {
        status: selectedProjectStatus.value,
        go_live_target: selectedGoLiveTarget.value || null,
        blockers: selectedBlockers.value || null,
        training_notes: selectedTrainingNotes.value || null
      }
    })

    if (onboardingDetail.value) {
      onboardingDetail.value.project = project
    }

    await refresh()

    toast.add({
      title: 'Launch details saved',
      description: 'Onboarding status, blockers, and notes are up to date.',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not save launch details',
      description: error instanceof Error ? error.message : 'The onboarding project was not updated.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    projectSaving.value = false
  }
}

async function updateTaskStatus(task: OnboardingTask, taskStatus: TaskStatus) {
  checklistSaving.value = task.id

  try {
    const result = await $fetch<OnboardingDetail & { task: OnboardingTask }>(`/api/onboarding/tasks/${task.id}`, {
      method: 'PATCH',
      body: {
        status: taskStatus
      }
    })

    const index = currentTasks.value.findIndex(item => item.id === task.id)
    if (index !== -1 && onboardingDetail.value) {
      onboardingDetail.value.tasks.splice(index, 1, result.task)
      onboardingDetail.value.project = result.project
    }

    await refresh()

    toast.add({
      title: 'Checklist updated',
      description: `${task.title} is now ${taskStatus.replaceAll('_', ' ')}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update task',
      description: error instanceof Error ? error.message : 'The checklist task was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    checklistSaving.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="onboarding">
    <template #header>
      <UDashboardNavbar title="Onboarding">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Project" @click="createOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="metric in onboardingStats"
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

      <UAlert
        class="mt-5"
        icon="i-lucide-clipboard-check"
        color="primary"
        variant="subtle"
        title="Compliance-led onboarding"
        description="New projects generate go-live tasks from the RexApp compliance pack: Supabase evidence, processors, RLS/RBAC, support logging, SMS/email minimisation, backups, incidents, and IG/DPO sign-off."
      />

      <div class="space-y-4">
        <UCard
          v-for="project in projects"
          :key="project.id"
          class="mt-5 first:mt-5"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-center">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold text-highlighted">
                  {{ project.name }}
                </h2>
                <UBadge :label="project.status.replaceAll('_', ' ')" :color="statusColor(project.status)" variant="subtle" />
              </div>
              <p class="mt-2 text-sm text-muted">
                <NuxtLink
                  v-if="project.customer"
                  :to="`/customers/${project.customer.id}`"
                  class="hover:text-primary"
                >
                  {{ project.customer.name }}
                </NuxtLink>
                <span v-else>Unknown customer</span>
                - target go-live {{ project.go_live_target || 'not scheduled' }}
              </p>
              <p class="mt-3 text-sm text-muted">
                {{ project.blockers || 'No blockers recorded' }}
              </p>
            </div>

            <div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted">Readiness</span>
                <span class="font-medium text-highlighted">{{ project.readiness_score }}%</span>
              </div>
              <UProgress :model-value="project.readiness_score" :color="readinessColor(project.readiness_score)" class="mt-2" />
              <div class="mt-4 flex justify-end">
                <UButton
                  icon="i-lucide-list-checks"
                  label="Checklist"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="openChecklist(project)"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="!projects?.length && status !== 'pending'"
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="No onboarding projects yet"
          description="Create a customer onboarding project to generate launch tasks and timeline entries."
        />

        <div v-if="status === 'pending'" class="flex justify-center py-8">
          <UButton
            icon="i-lucide-refresh-cw"
            label="Loading onboarding"
            color="neutral"
            variant="ghost"
            loading
            @click="refresh()"
          />
        </div>
      </div>

      <UModal
        v-model:open="createOpen"
        title="New onboarding project"
        description="Create a compliance-led go-live workstream for a customer."
      >
        <template #body>
          <UForm
            id="create-onboarding"
            :schema="createSchema"
            :state="createState"
            class="space-y-4"
            @submit="createProject"
          >
            <UFormField label="Customer" name="customer_id" required>
              <USelect
                v-model="createState.customer_id"
                :items="customerItems"
                placeholder="Choose customer"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Project name" name="name" required>
              <UInput
                v-model="createState.name"
                placeholder="Rex App staging go-live"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Status" name="status">
                <USelect v-model="createState.status" :items="[...projectStatuses]" class="w-full" />
              </UFormField>

              <UFormField label="Go-live target" name="go_live_target">
                <UInput v-model="createState.go_live_target" type="date" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Readiness" name="readiness_score">
              <UInputNumber
                v-model="createState.readiness_score"
                :min="0"
                :max="100"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Blockers" name="blockers">
              <UTextarea
                v-model="createState.blockers"
                :rows="3"
                autoresize
                placeholder="Outstanding Supabase evidence, DPO review, restore test..."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Training notes" name="training_notes">
              <UTextarea
                v-model="createState.training_notes"
                :rows="3"
                autoresize
                placeholder="Staff training, support policy briefing, clinical sign-off notes..."
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="createOpen = false"
              />
              <UButton
                label="Create project"
                icon="i-lucide-check"
                type="submit"
                :loading="saving"
              />
            </div>
          </UForm>
        </template>
      </UModal>

      <USlideover
        v-model:open="checklistOpen"
        :title="currentProject?.name || 'Go-live checklist'"
        :description="currentProject?.customer?.name || 'Compliance-led onboarding'"
        :ui="{ content: 'sm:max-w-3xl' }"
      >
        <template #body>
          <div v-if="checklistLoading" class="space-y-3">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-24 w-full" />
            <USkeleton class="h-24 w-full" />
          </div>

          <div v-else-if="currentProject" class="space-y-6">
            <div class="rounded-lg border border-default bg-elevated/30 p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      :label="currentProject.status.replaceAll('_', ' ')"
                      :color="statusColor(currentProject.status)"
                      variant="subtle"
                    />
                    <UBadge
                      :label="`${completedTasks}/${currentTasks.length} complete`"
                      color="neutral"
                      variant="outline"
                    />
                    <UBadge
                      v-if="blockedTasks"
                      :label="`${blockedTasks} blocked`"
                      color="error"
                      variant="subtle"
                    />
                  </div>
                  <p class="mt-3 text-lg font-semibold text-highlighted">
                    RexApp Go-Live Compliance Checklist
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    Track the evidence and sign-off work needed before real-data production use.
                  </p>
                </div>
                <div class="min-w-40">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted">Readiness</span>
                    <span class="font-medium text-highlighted">{{ checklistProgress }}%</span>
                  </div>
                  <UProgress
                    :model-value="checklistProgress"
                    :color="readinessColor(checklistProgress)"
                    class="mt-2"
                  />
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium text-highlighted">
                Launch Details
              </p>
              <div class="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-2">
                <UFormField label="Status">
                  <USelect
                    v-model="selectedProjectStatus"
                    :items="[...projectStatuses]"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Go-live target">
                  <UInput
                    v-model="selectedGoLiveTarget"
                    type="date"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Blockers" class="sm:col-span-2">
                  <UTextarea
                    v-model="selectedBlockers"
                    :rows="3"
                    autoresize
                    placeholder="Outstanding Supabase evidence, DPO review, restore test..."
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Training notes" class="sm:col-span-2">
                  <UTextarea
                    v-model="selectedTrainingNotes"
                    :rows="3"
                    autoresize
                    placeholder="Training decisions, customer readiness, clinical sign-off notes..."
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-save"
                  label="Save launch details"
                  :loading="projectSaving"
                  @click="saveProjectDetails"
                />
              </div>
            </div>

            <div class="space-y-3">
              <div
                v-for="task in currentTasks"
                :key="task.id"
                class="rounded-lg border border-default p-4"
              >
                <div class="grid gap-3 sm:grid-cols-[1fr_11rem] sm:items-start">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <UBadge
                        :label="`Step ${task.sort_order}`"
                        color="neutral"
                        variant="outline"
                      />
                      <UBadge
                        :label="task.status"
                        :color="taskStatusColor(task.status)"
                        variant="subtle"
                      />
                    </div>
                    <p class="mt-3 font-medium text-highlighted">
                      {{ task.title }}
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      {{ task.description || 'No extra detail recorded.' }}
                    </p>
                  </div>

                  <USelect
                    :model-value="task.status"
                    :items="taskStatuses"
                    :loading="checklistSaving === task.id"
                    class="w-full"
                    @update:model-value="updateTaskStatus(task, $event as TaskStatus)"
                  />
                </div>
              </div>
            </div>

            <UAlert
              icon="i-lucide-info"
              color="neutral"
              variant="subtle"
              title="Evidence storage"
              description="Attach or reference evidence in the customer timeline and notes as the pack is completed. Keep patient-identifiable or clinical evidence in controlled compliance storage."
            />
          </div>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
