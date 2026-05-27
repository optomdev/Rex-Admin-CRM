# Rex Admin CRM

Private Nuxt 4 + Nuxt UI control centre for Rex customers, support tickets, onboarding, charges, releases, and follow-ups.

## V1 Scope

- Separate CRM app and Supabase project from the practice-facing Rex app.
- Single admin workflow.
- Manual billing ledger.
- Signed Rex to CRM support-ticket webhook at `POST /api/webhooks/rex`.
- Signed CRM to Rex callbacks for ticket status changes and outbound replies.
- Manual GitHub release sync from the Versions page.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Fill `.env` with the CRM Supabase project URL, publishable key, service role key, Rex webhook secrets, callback URL, and GitHub repository settings.

## Supabase

The initial schema lives in `supabase/migrations/20260526214520_crm_v1_foundation.sql`.

Apply it to the CRM Supabase project with the Supabase CLI once the project is linked:

```bash
pnpm dlx supabase@latest link --project-ref <project-ref>
pnpm dlx supabase@latest db push
```

The migration enables RLS on all public tables. The Nuxt server API uses the service role key for V1, so browser clients do not need direct table access.

## Webhooks

Rex to CRM:

- URL: `POST /api/webhooks/rex`
- Headers: `x-rex-signature`, `x-idempotency-key`
- Signature: HMAC-SHA256 hex digest of the raw JSON body using `NUXT_REX_WEBHOOK_SECRET`
- V1 event: `support_ticket.created`

CRM to Rex:

- URL: `NUXT_REX_CALLBACK_URL`
- Headers: `x-crm-signature`, `x-idempotency-key`
- Signature: HMAC-SHA256 hex digest of the raw JSON body using `NUXT_CRM_WEBHOOK_SECRET`
- V1 events: `support_ticket.status_changed`, `support_ticket.reply_sent`

Webhook failures are recorded for retry rather than blocking local CRM state changes.
