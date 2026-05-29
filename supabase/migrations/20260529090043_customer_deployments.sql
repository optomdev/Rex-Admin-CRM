create table if not exists public.customer_deployments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  environment text not null default 'production' check (environment in ('demo', 'staging', 'production', 'training')),
  status text not null default 'active' check (status in ('provisioning', 'active', 'maintenance', 'paused', 'retired', 'error')),
  health_status text not null default 'unknown' check (health_status in ('unknown', 'healthy', 'degraded', 'down')),
  customer_identifier text,
  rex_project_ref text,
  supabase_url text,
  app_url text,
  region text,
  deployed_release_id uuid references public.releases(id) on delete set null,
  deployed_version text,
  last_seen_at timestamptz,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets
  add column if not exists customer_deployment_id uuid references public.customer_deployments(id) on delete set null;

insert into public.customer_deployments (
  customer_id,
  name,
  environment,
  status,
  health_status,
  customer_identifier,
  rex_project_ref,
  supabase_url,
  is_primary,
  notes
)
select
  id,
  case when name ilike '%stag%' then 'Rex staging cloud' else 'Primary Rex deployment' end,
  case when name ilike '%stag%' then 'staging' else 'production' end,
  case when status in ('paused', 'churned') then 'paused' else 'active' end,
  'unknown',
  customer_identifier,
  rex_project_ref,
  rex_supabase_url,
  true,
  'Created from the original customer deployment fields.'
from public.customers
where (customer_identifier is not null or rex_project_ref is not null or rex_supabase_url is not null)
  and not exists (
    select 1
    from public.customer_deployments existing
    where existing.customer_id = customers.id
  );

update public.tickets t
set customer_deployment_id = d.id
from public.customer_deployments d
where t.customer_deployment_id is null
  and t.customer_id = d.customer_id
  and (
    (t.customer_identifier is not null and d.customer_identifier = t.customer_identifier)
    or (t.rex_project_ref is not null and d.rex_project_ref = t.rex_project_ref)
  );

update public.customer_deployments d
set last_seen_at = signals.last_seen_at,
    health_status = case when d.health_status = 'unknown' then 'healthy' else d.health_status end
from (
  select customer_deployment_id, max(created_at) as last_seen_at
  from public.tickets
  where customer_deployment_id is not null
  group by customer_deployment_id
) signals
where d.id = signals.customer_deployment_id
  and d.last_seen_at is null;

alter table public.customer_timeline_items
  drop constraint if exists customer_timeline_items_item_type_check;

alter table public.customer_timeline_items
  add constraint customer_timeline_items_item_type_check
  check (item_type in ('ticket', 'message', 'onboarding', 'charge', 'release', 'deployment', 'note'));

create unique index if not exists customer_deployments_customer_name_unique
  on public.customer_deployments(customer_id, lower(name));

create unique index if not exists customer_deployments_primary_unique
  on public.customer_deployments(customer_id)
  where is_primary;

create index if not exists customer_deployments_customer_id_idx
  on public.customer_deployments(customer_id);

create unique index if not exists customer_deployments_identifier_unique
  on public.customer_deployments(customer_identifier)
  where customer_identifier is not null;

create unique index if not exists customer_deployments_project_ref_unique
  on public.customer_deployments(rex_project_ref)
  where rex_project_ref is not null;

create index if not exists tickets_customer_deployment_id_idx
  on public.tickets(customer_deployment_id);

create trigger customer_deployments_set_updated_at
  before update on public.customer_deployments
  for each row execute function public.set_updated_at();

alter table public.customer_deployments enable row level security;

grant select, insert, update, delete on table public.customer_deployments to service_role;
revoke all on table public.customer_deployments from anon, authenticated;

comment on table public.customer_deployments is 'Per-customer Rex deployments. Each customer can have its own Supabase project while sharing the same Rex codebase.';
comment on column public.customer_deployments.customer_identifier is 'Stable slug used in Rex webhook payloads to route tickets to the right customer/deployment.';
comment on column public.customer_deployments.rex_project_ref is 'Supabase project ref for this customer deployment.';
comment on column public.customer_deployments.deployed_release_id is 'CRM release record currently deployed to this environment.';
