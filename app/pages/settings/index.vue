<template>
  <div class="space-y-4">
    <UPageCard
      title="Rex Webhook Receiver"
      description="POST /api/webhooks/rex accepts signed support_ticket.created events with x-rex-signature and x-idempotency-key headers."
      variant="subtle"
      icon="i-lucide-webhook"
    />

    <UPageCard
      title="CRM Callback Sender"
      description="Ticket status changes and outbound replies call the Rex inbound Edge Function configured in NUXT_REX_CALLBACK_URL."
      variant="subtle"
      icon="i-lucide-send"
    />

    <UPageCard
      title="GitHub Version Sync"
      description="The Versions page pulls GitHub releases using NUXT_GITHUB_OWNER, NUXT_GITHUB_REPO, and an optional token."
      variant="subtle"
      icon="i-simple-icons-github"
    />
  </div>
</template>
