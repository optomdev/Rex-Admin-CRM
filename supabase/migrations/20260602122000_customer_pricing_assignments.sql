create table public.customer_pricing_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pricing_item_id uuid not null references public.pricing_items(id) on delete cascade,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_amount_override numeric(12, 2),
  currency_override text,
  notes text,
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_pricing_items_customer_idx
  on public.customer_pricing_items(customer_id, is_active, starts_on, ends_on);

create index customer_pricing_items_pricing_item_idx
  on public.customer_pricing_items(pricing_item_id);

drop index if exists public.charges_auto_monthly_customer_idx;

create unique index if not exists charges_auto_invoice_reference_idx
  on public.charges(invoice_reference)
  where invoice_reference like 'AUTO-%';

create trigger customer_pricing_items_set_updated_at
  before update on public.customer_pricing_items
  for each row execute function public.set_updated_at();

alter table public.customer_pricing_items enable row level security;

create policy customer_pricing_items_service_role_all
  on public.customer_pricing_items
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.customer_pricing_items to service_role;
grant select, insert, update, delete on table public.customer_pricing_items to authenticated;

create or replace function public.generate_monthly_customer_charges(
  p_billing_month date default date_trunc('month', current_date)::date
)
returns table(customer_id uuid, charge_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  billing_month date := date_trunc('month', coalesce(p_billing_month, current_date))::date;
  due_on date := (date_trunc('month', coalesce(p_billing_month, current_date))::date + interval '14 days')::date;
begin
  return query
  with active_assignments as (
    select
      assignment.id as assignment_id,
      customer.id as customer_id,
      pricing.id as pricing_item_id,
      pricing.code as pricing_code,
      pricing.name as pricing_name,
      assignment.quantity,
      coalesce(assignment.unit_amount_override, pricing.amount) as unit_amount,
      coalesce(assignment.currency_override, pricing.currency) as currency,
      assignment.notes
    from public.customer_pricing_items assignment
    join public.customers customer
      on customer.id = assignment.customer_id
    join public.pricing_items pricing
      on pricing.id = assignment.pricing_item_id
    where customer.status in ('active', 'at_risk')
      and assignment.is_active
      and pricing.is_active
      and pricing.charge_type = 'monthly'
      and assignment.starts_on <= billing_month
      and (assignment.ends_on is null or assignment.ends_on >= billing_month)
  ), charge_sources as (
    select
      active_assignments.customer_id,
      active_assignments.pricing_item_id,
      active_assignments.pricing_name as description,
      active_assignments.unit_amount * active_assignments.quantity as amount,
      active_assignments.currency,
      active_assignments.notes,
      active_assignments.pricing_code || '-' || left(active_assignments.assignment_id::text, 8) as reference_key
    from active_assignments

    union all

    select
      customer.id,
      pricing.id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' Rex subscription',
      customer.recurring_monthly_amount,
      'GBP',
      'Generated from customer recurring monthly amount because no active pricing assignments exist.',
      'recurring'
    from public.customers customer
    left join public.pricing_items pricing
      on pricing.code = 'rex-main-license'
    where customer.status in ('active', 'at_risk')
      and customer.recurring_monthly_amount > 0
      and not exists (
        select 1
        from active_assignments
        where active_assignments.customer_id = customer.id
      )
  ), created as (
    insert into public.charges (
      customer_id,
      pricing_item_id,
      charge_type,
      description,
      amount,
      currency,
      billing_status,
      invoice_reference,
      charge_date,
      due_date,
      notes
    )
    select
      charge_sources.customer_id,
      charge_sources.pricing_item_id,
      'monthly',
      charge_sources.description,
      charge_sources.amount,
      charge_sources.currency,
      'open',
      'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(charge_sources.customer_id::text, 8) || '-' || charge_sources.reference_key,
      billing_month,
      due_on,
      charge_sources.notes
    from charge_sources
    where charge_sources.amount > 0
      and not exists (
        select 1
        from public.charges existing
        where existing.invoice_reference = 'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(charge_sources.customer_id::text, 8) || '-' || charge_sources.reference_key
      )
    returning public.charges.customer_id, public.charges.id, public.charges.description, public.charges.amount, public.charges.currency, public.charges.billing_status
  ), timeline as (
    insert into public.customer_timeline_items (
      customer_id,
      item_type,
      title,
      body,
      related_table,
      related_id,
      metadata
    )
    select
      created.customer_id,
      'charge',
      'Monthly invoice charge generated',
      created.description || ' - ' || created.currency || ' ' || to_char(created.amount, 'FM999999999990.00'),
      'charges',
      created.id,
      jsonb_build_object(
        'source', 'invoice_cron',
        'billing_status', created.billing_status,
        'billing_month', billing_month
      )
    from created
  )
  select created.customer_id, created.id
  from created;
end;
$$;
