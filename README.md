# Rex Admin CRM

Private Nuxt 4 + Nuxt UI control centre for Rex customers, support tickets, onboarding, charges, releases, and follow-ups.

## V1 Scope

- Separate CRM app and Supabase project from the practice-facing Rex app.
- Single admin workflow.
- Manual billing ledger.
- Signed Rex to CRM support-ticket webhook at `POST /api/webhooks/rex`.
- Supabase Auth protected CRM UI and server API routes.
- CRM ticket replies are emailed directly to reporters from the CRM.
- Optional future CRM to Rex callbacks for ticket status changes.
- System Health view for Rex webhook intake, failed reply emails, unlinked tickets, and callback backlog.
- Manual GitHub release sync from the Versions page.
- CRM-managed release notes and known issues.
- Per-customer Rex deployment tracking for separate Supabase Cloud projects.
- Per-customer release rollout planning with status, scheduled date, and notes.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Fill `.env` with the CRM Supabase project URL, publishable key, secret key, Rex webhook secret, ticket reply email settings, and GitHub repository settings.

## Timeline Notes

The Timeline page can create manual customer notes. Notes are stored in `customer_timeline_items` with `item_type = note`, so customer follow-ups, deployment decisions, and onboarding context live alongside tickets, charges, releases, and checklist events.

Linked support ticket intake, internal notes, customer replies, and successful reply retries are also written to the customer timeline so support history sits beside onboarding, billing, and release rollout activity.

## System Health

Settings > System Health surfaces operational signals from the CRM database: recent Rex webhook events, stored webhook errors, unlinked tickets, failed outbound ticket replies, and pending or failed callback deliveries. Failed ticket replies link back to the Tickets page for retry from the ticket drawer.

## Onboarding

Onboarding projects generate compliance-led checklist tasks from the RexApp go-live pack. The checklist drawer can update task status plus the live launch details: project status, target go-live date, blockers, and training notes. Project updates are recorded on the customer timeline.

## Releases

The Versions page syncs GitHub releases manually for V1. If the private Rex repository has no GitHub Releases or tags yet, the CRM falls back to recent commits so deployment tracking can still link to a concrete code point. Release records can be edited inside the CRM to maintain support-facing release notes and known issues without changing GitHub history. Each release has a customer rollout drawer for deployment status, scheduled date, and rollout notes, with changes recorded on the customer timeline.

GitHub sync accepts either `NUXT_GITHUB_OWNER=owner` plus `NUXT_GITHUB_REPO=repo`, or a single `NUXT_GITHUB_REPO=owner/repo` / `https://github.com/owner/repo` value. Private repositories also need `NUXT_GITHUB_TOKEN` with read access to repository contents. Restart the Nuxt dev server after changing these environment variables.

Version management has two layers: Versions stores the GitHub release/tag/commit catalogue and rollout plan; Deployments stores the version each customer environment is actually running. When a customer rollout is marked `deployed`, the CRM stamps that customer's primary deployment with the selected release or commit.

## Charges

Charges are manual V1 ledger entries. They can be created, statused, and edited for customer, type, description, amount, invoice reference, charge date, and due date. Charge changes create `charge_events` records and customer timeline entries.

## Customers

Customer records track practice details, commercial terms, Rex deployments, contacts, branches, tickets, onboarding, charges, and timeline history. Contacts, branches, and deployments can be added, edited, removed, and reflected in the customer timeline.

Deployments are where the shared-code/multi-database model lives. Each customer can have one or more Rex environments, each with its own `customer_identifier`, Supabase project ref, Supabase URL, app URL, environment, health status, deployed version/release, and notes. Marking a deployment as primary keeps the customer-level `customer_identifier`, `rex_project_ref`, and `rex_supabase_url` in sync for backwards-compatible webhook routing.

The Deployments page gives a fleet-level view across all customer Rex environments, with filters for environment and health plus quick links back to the owning customer record.

## Supabase

The CRM schema lives in `supabase/migrations`. It includes the V1 tables, `customer_deployments` for Rex Supabase Cloud instances, server-role RLS policies, explicit service-role Data API grants, and foreign-key indexes for the operational tables.

Apply it to the CRM Supabase project with the Supabase CLI once the project is linked:

```bash
pnpm dlx supabase@latest link --project-ref <project-ref>
pnpm dlx supabase@latest db push
```

The migrations enable RLS on all public tables. The Nuxt server API uses the Supabase secret key for V1, so browser clients do not need direct table access. Browser roles are explicitly revoked from the CRM tables; the browser only receives the publishable key for Supabase Auth.

## Auth

The CRM uses `@nuxtjs/supabase` for Supabase Auth, cookies, and route protection. Create the single admin user in the CRM Supabase project's Auth dashboard, then sign in at `/login` with that email and password.

Protected pages redirect to `/login`. Server API routes also require an authenticated Supabase session, except the signed Rex webhook endpoint at `/api/webhooks/rex`.

## Webhooks

Rex to CRM:

- URL: `POST /api/webhooks/rex`
- Headers: `x-rex-signature`, `x-idempotency-key`
- Signature: HMAC-SHA256 hex digest of the raw JSON body using `NUXT_REX_WEBHOOK_SECRET`
- V1 event: `support_ticket.created`
- Ticket payloads should include `customer_identifier` and/or `rex_project_ref`; the CRM resolves these to `customer_deployments` first, then falls back to the customer-level fields for older payloads.

CRM to reporter email:

- Configure `NUXT_RESEND_API_KEY`, `NUXT_SUPPORT_FROM_EMAIL`, and optionally `NUXT_SUPPORT_REPLY_TO_EMAIL`.
- Ticket replies sent from the CRM are stored in `ticket_messages`, emailed to `tickets.reporter_email`, and recorded in `ticket_events`.
- If email config is missing or delivery fails, the reply remains stored locally with `delivery_status = failed` so it can be retried later.
- Ticket status, priority, assignment, and customer link can be managed from the ticket drawer. Changes are recorded in `ticket_events` and customer timeline items when a customer is linked.

Optional future CRM to Rex:

- URL: `NUXT_REX_CALLBACK_URL`
- Headers: `x-crm-signature`, `x-idempotency-key`
- Signature: HMAC-SHA256 hex digest of the raw JSON body using `NUXT_CRM_WEBHOOK_SECRET`
- V1 event: `support_ticket.status_changed`

Webhook failures never block local ticket creation. Failed CRM reply emails are kept on the ticket message with delivery metadata and can be retried from the ticket drawer.

Rex deployment Edge Function secrets:

- `CRM_WEBHOOK_URL`: public CRM URL ending `/api/webhooks/rex`
- `REX_CRM_WEBHOOK_SECRET`: same value as CRM `NUXT_REX_WEBHOOK_SECRET`
- `REX_CUSTOMER_IDENTIFIER`: stable customer slug, for example `cecil-amey`
- `REX_DEPLOYMENT_NAME`: human-readable practice/deployment name
