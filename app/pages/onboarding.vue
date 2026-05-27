<script setup lang="ts">
import type { OnboardingProject } from '~/types'

const { data: projects, status, refresh } = await useAsyncData<OnboardingProject[]>('onboarding', () => $fetch('/api/onboarding'))
</script>

<template>
  <UDashboardPanel id="onboarding">
    <template #header>
      <UDashboardNavbar title="Onboarding">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Project" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UCard
          v-for="project in projects"
          :key="project.id"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-center">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold text-highlighted">
                  {{ project.name }}
                </h2>
                <UBadge :label="project.status.replaceAll('_', ' ')" color="primary" variant="subtle" />
              </div>
              <p class="mt-2 text-sm text-muted">
                {{ project.customer?.name }} - target go-live {{ project.go_live_target || 'not scheduled' }}
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
              <UProgress :model-value="project.readiness_score" class="mt-2" />
              <div class="mt-4 flex justify-end">
                <UButton
                  icon="i-lucide-list-checks"
                  label="Checklist"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="!projects?.length && status !== 'pending'"
          icon="i-lucide-info"
          color="neutral"
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
    </template>
  </UDashboardPanel>
</template>
