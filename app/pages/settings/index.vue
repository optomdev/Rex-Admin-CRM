<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-lg border border-default bg-default p-4">
        <UIcon name="i-lucide-cloud" class="size-5 text-primary" />
        <p class="mt-3 text-sm font-medium text-highlighted">
          CRM Cloud DB
        </p>
        <p class="mt-1 text-xs text-muted">
          Supabase Auth, CRM tables, and service API.
        </p>
      </div>
      <div class="rounded-lg border border-default bg-default p-4">
        <UIcon name="i-lucide-webhook" class="size-5 text-secondary" />
        <p class="mt-3 text-sm font-medium text-highlighted">
          Rex Inbound
        </p>
        <p class="mt-1 text-xs text-muted">
          Signed support tickets from each deployment.
        </p>
      </div>
      <div class="rounded-lg border border-default bg-default p-4">
        <UIcon name="i-simple-icons-github" class="size-5 text-muted" />
        <p class="mt-3 text-sm font-medium text-highlighted">
          GitHub Sync
        </p>
        <p class="mt-1 text-xs text-muted">
          Manual release imports for rollout tracking.
        </p>
      </div>
    </div>

    <UPageCard
      title="Rex Webhook Receiver"
      description="POST /api/webhooks/rex accepts signed support_ticket.created events with x-rex-signature and x-idempotency-key headers."
      variant="subtle"
      icon="i-lucide-webhook"
    />

    <UPageCard
      title="One-way Ticket Intake"
      description="V1 keeps Rex posting support tickets into the CRM. CRM workflow stays local, and customer replies are emailed from the CRM."
      variant="subtle"
      icon="i-lucide-route"
    />

    <UPageCard
      title="GitHub Version Sync"
      description="The Versions page pulls GitHub releases using NUXT_GITHUB_OWNER, NUXT_GITHUB_REPO, and an optional token."
      variant="subtle"
      icon="i-simple-icons-github"
    />
  </div>
</template>
