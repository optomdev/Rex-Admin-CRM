create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned')),
  health_score integer not null default 75 check (health_score between 0 and 100),
  primary_domain text,
  commercial_notes text,
  tags text[] not null default '{}',
  recurring_monthly_amount numeric(12, 2) not null default 0,
  onboarding_fee numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_branches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text,
  postcode text,
  branch_code text,
  status text not null default 'active' check (status in ('planned', 'active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  rex_ticket_id text,
  rex_local_table_id text,
  reporter_name text,
  reporter_email text,
  page_url text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'triage', 'waiting_on_customer', 'in_progress', 'blocked', 'resolved', 'closed')),
  assignment text,
  subject text,
  description text not null,
  screenshot_metadata jsonb not null default '{}'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  app_version text,
  webhook_payload jsonb not null default '{}'::jsonb,
  last_synced_to_rex_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_rex_ticket_unique unique (rex_ticket_id)
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  author_name text,
  author_email text,
  body text not null,
  delivery_status text not null default 'stored' check (delivery_status in ('stored', 'pending', 'sent', 'failed')),
  rex_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade,
  event_type text not null,
  idempotency_key text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ticket_events_idempotency_unique unique (idempotency_key)
);

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  tasks jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  template_id uuid references public.onboarding_templates(id) on delete set null,
  name text not null,
  status text not null default 'planning' check (status in ('planning', 'in_progress', 'ready_for_go_live', 'live', 'blocked', 'paused')),
  go_live_target date,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  blockers text,
  training_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  owner text,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  charge_type text not null check (charge_type in ('monthly', 'onboarding', 'ad_hoc', 'credit')),
  description text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'GBP',
  billing_status text not null default 'open' check (billing_status in ('draft', 'open', 'invoice_sent', 'paid', 'overdue', 'void')),
  invoice_reference text,
  charge_date date not null default current_date,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.charge_events (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  release_notes text,
  published_at timestamptz,
  github_url text,
  known_issues text,
  github_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint releases_version_unique unique (version)
);

create table public.customer_release_statuses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  rollout_status text not null default 'not_started' check (rollout_status in ('not_started', 'scheduled', 'deployed', 'blocked', 'rolled_back')),
  scheduled_for date,
  deployed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_release_unique unique (customer_id, release_id)
);

create table public.customer_timeline_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  item_type text not null check (item_type in ('ticket', 'message', 'onboarding', 'charge', 'release', 'note')),
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  related_table text,
  related_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  source text not null,
  event_type text not null,
  idempotency_key text not null,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  constraint webhook_events_idempotency_unique unique (source, idempotency_key)
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  target text not null,
  event_type text not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  last_attempted_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_deliveries_idempotency_unique unique (target, idempotency_key)
);

create index customers_status_idx on public.customers(status);
create index tickets_status_priority_idx on public.tickets(status, priority);
create index tickets_customer_id_idx on public.tickets(customer_id);
create index ticket_messages_ticket_id_idx on public.ticket_messages(ticket_id);
create index onboarding_projects_customer_id_idx on public.onboarding_projects(customer_id);
create index charges_customer_status_idx on public.charges(customer_id, billing_status);
create index customer_timeline_customer_time_idx on public.customer_timeline_items(customer_id, occurred_at desc);
create index webhook_events_event_type_idx on public.webhook_events(event_type);

create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger customer_contacts_set_updated_at before update on public.customer_contacts for each row execute function public.set_updated_at();
create trigger customer_branches_set_updated_at before update on public.customer_branches for each row execute function public.set_updated_at();
create trigger tickets_set_updated_at before update on public.tickets for each row execute function public.set_updated_at();
create trigger onboarding_templates_set_updated_at before update on public.onboarding_templates for each row execute function public.set_updated_at();
create trigger onboarding_projects_set_updated_at before update on public.onboarding_projects for each row execute function public.set_updated_at();
create trigger onboarding_tasks_set_updated_at before update on public.onboarding_tasks for each row execute function public.set_updated_at();
create trigger charges_set_updated_at before update on public.charges for each row execute function public.set_updated_at();
create trigger releases_set_updated_at before update on public.releases for each row execute function public.set_updated_at();
create trigger customer_release_statuses_set_updated_at before update on public.customer_release_statuses for each row execute function public.set_updated_at();
create trigger webhook_deliveries_set_updated_at before update on public.webhook_deliveries for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_branches enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_events enable row level security;
alter table public.onboarding_templates enable row level security;
alter table public.onboarding_projects enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.charges enable row level security;
alter table public.charge_events enable row level security;
alter table public.releases enable row level security;
alter table public.customer_release_statuses enable row level security;
alter table public.customer_timeline_items enable row level security;
alter table public.webhook_events enable row level security;
alter table public.webhook_deliveries enable row level security;
