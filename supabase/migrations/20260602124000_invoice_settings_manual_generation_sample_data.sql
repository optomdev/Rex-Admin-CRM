create table public.invoice_settings (
  id boolean primary key default true check (id),
  invoice_day_of_month integer not null default 1 check (invoice_day_of_month between 1 and 28),
  due_days integer not null default 14 check (due_days between 0 and 90),
  invoice_timezone text not null default 'Europe/London',
  cron_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger invoice_settings_set_updated_at
  before update on public.invoice_settings
  for each row execute function public.set_updated_at();

alter table public.invoice_settings enable row level security;

create policy invoice_settings_service_role_all
  on public.invoice_settings
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.invoice_settings to service_role;
grant select, update on table public.invoice_settings to authenticated;

insert into public.invoice_settings (id, invoice_day_of_month, due_days, invoice_timezone, cron_enabled)
values (true, 1, 14, 'Europe/London', true)
on conflict (id) do nothing;

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
  configured_due_days integer := coalesce((select due_days from public.invoice_settings where id = true), 14);
  due_on date := (date_trunc('month', coalesce(p_billing_month, current_date))::date + make_interval(days => configured_due_days))::date;
begin
  return query
  with active_assignments as (
    select
      customer.id as customer_id,
      pricing.id as pricing_item_id,
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
  ), assigned_profiles as (
    select
      active_assignments.customer_id,
      case
        when count(*) = 1 then (array_agg(active_assignments.pricing_item_id order by active_assignments.pricing_item_id::text))[1]
        else null
      end as pricing_item_id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' Rex subscription' as description,
      sum(active_assignments.unit_amount * active_assignments.quantity) as amount,
      max(active_assignments.currency) as currency,
      string_agg(
        active_assignments.pricing_name
          || case
            when active_assignments.quantity = 1 then ''
            else ' x ' || active_assignments.quantity::text
          end
          || ' - ' || active_assignments.currency || ' '
          || to_char(active_assignments.unit_amount * active_assignments.quantity, 'FM999999999990.00')
          || coalesce(' (' || nullif(active_assignments.notes, '') || ')', ''),
        E'\n'
        order by active_assignments.pricing_name
      ) as notes
    from active_assignments
    group by active_assignments.customer_id
  ), charge_sources as (
    select
      assigned_profiles.customer_id,
      assigned_profiles.pricing_item_id,
      assigned_profiles.description,
      assigned_profiles.amount,
      assigned_profiles.currency,
      assigned_profiles.notes
    from assigned_profiles

    union all

    select
      customer.id,
      pricing.id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' Rex subscription',
      customer.recurring_monthly_amount,
      'GBP',
      'Generated from customer recurring monthly amount because no active pricing assignments exist.'
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
      'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(charge_sources.customer_id::text, 8),
      billing_month,
      due_on,
      charge_sources.notes
    from charge_sources
    where charge_sources.amount > 0
      and not exists (
        select 1
        from public.charges existing
        where existing.invoice_reference = 'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(charge_sources.customer_id::text, 8)
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
        'billing_month', billing_month,
        'consolidated', true
      )
    from created
  )
  select created.customer_id, created.id
  from created;
end;
$$;

create or replace function public.run_monthly_invoice_cron(p_today date default null)
returns table(customer_id uuid, charge_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  settings public.invoice_settings%rowtype;
  effective_today date;
begin
  select *
  into settings
  from public.invoice_settings
  where id = true;

  if not found or not settings.cron_enabled then
    return;
  end if;

  effective_today := coalesce(p_today, (now() at time zone settings.invoice_timezone)::date);

  if extract(day from effective_today)::integer <> settings.invoice_day_of_month then
    return;
  end if;

  return query
  select *
  from public.generate_monthly_customer_charges(date_trunc('month', effective_today)::date);
end;
$$;

do $$
begin
  perform cron.unschedule('rex-monthly-invoice-charges');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'rex-monthly-invoice-charges',
  '0 6 * * *',
  $$select public.run_monthly_invoice_cron();$$
);

insert into public.customer_pricing_items (
  id,
  customer_id,
  pricing_item_id,
  quantity,
  notes,
  starts_on,
  is_active
)
select
  assignment.id,
  customer_row.id,
  pricing.id,
  assignment.quantity,
  assignment.notes,
  assignment.starts_on,
  assignment.is_active
from (
  values
    ('0f571fe7-2c4e-46d1-a684-061c09c50001'::uuid, 1, 'rex-main-license', 1::numeric, 'Main agreed Rex licence.', '2026-06-01'::date, true),
    ('0f571fe7-2c4e-46d1-a684-061c09c50002'::uuid, 1, 'hearing-module', 1::numeric, 'Hearing clinic module agreed from June.', '2026-06-01'::date, true),
    ('0f571fe7-2c4e-46d1-a684-061c09c50003'::uuid, 2, 'rex-main-license', 1::numeric, 'Core Rex licence only while release rollout is paused.', '2026-06-01'::date, true),
    ('0f571fe7-2c4e-46d1-a684-061c09c50004'::uuid, 3, 'rex-main-license', 1::numeric, 'Agreed subscription to start when onboarding moves live.', '2026-06-01'::date, true),
    ('0f571fe7-2c4e-46d1-a684-061c09c50005'::uuid, 3, 'hr-full-module', 1::numeric, 'HR module included in launch proposal.', '2026-06-01'::date, true)
) as assignment(id, customer_rank, pricing_code, quantity, notes, starts_on, is_active)
join (
  select
    id,
    row_number() over (
      order by
        case status
          when 'active' then 1
          when 'at_risk' then 2
          when 'onboarding' then 3
          when 'prospect' then 4
          else 5
        end,
        name
    ) as customer_rank
  from public.customers
) customer_row
  on customer_row.customer_rank = assignment.customer_rank
join public.pricing_items pricing
  on pricing.code = assignment.pricing_code
on conflict (id) do update set
  customer_id = excluded.customer_id,
  pricing_item_id = excluded.pricing_item_id,
  quantity = excluded.quantity,
  notes = excluded.notes,
  starts_on = excluded.starts_on,
  is_active = excluded.is_active;

insert into public.charges (
  id,
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
  charge.id,
  customer_row.id,
  pricing.id,
  'ad_hoc',
  charge.description,
  charge.amount,
  charge.currency,
  charge.billing_status,
  charge.invoice_reference,
  charge.charge_date,
  charge.due_date,
  charge.notes
from (
  values
    ('4db2a00c-09a0-4fd1-b742-bd8285c00001'::uuid, 1, 'sms-charges', 'May SMS charges', 28.40::numeric, 'GBP', 'open', 'INV-2026-063', '2026-06-01'::date, '2026-06-14'::date, '142 appointment reminders and recall messages.'),
    ('4db2a00c-09a0-4fd1-b742-bd8285c00002'::uuid, 1, 'postcode-lookups', 'May postcode look ups', 12.60::numeric, 'GBP', 'paid', 'INV-2026-060', '2026-05-01'::date, '2026-05-14'::date, '63 postcode lookups.'),
    ('4db2a00c-09a0-4fd1-b742-bd8285c00003'::uuid, 2, 'imp-letter-charges', 'IMP letter charges', 36.00::numeric, 'GBP', 'overdue', 'INV-2026-058', '2026-05-01'::date, '2026-05-14'::date, '18 IMP letters generated during May.'),
    ('4db2a00c-09a0-4fd1-b742-bd8285c00004'::uuid, 2, 'misc-item', 'Remote training session', 85.00::numeric, 'GBP', 'invoice_sent', 'INV-2026-064', '2026-06-01'::date, '2026-06-14'::date, 'Additional staff refresher session after rollout hold.'),
    ('4db2a00c-09a0-4fd1-b742-bd8285c00005'::uuid, 3, 'email-charges', 'Onboarding email volume', 6.80::numeric, 'GBP', 'draft', null, '2026-06-01'::date, null, 'Launch communications before go-live.')
) as charge(id, customer_rank, pricing_code, description, amount, currency, billing_status, invoice_reference, charge_date, due_date, notes)
join (
  select
    id,
    row_number() over (
      order by
        case status
          when 'active' then 1
          when 'at_risk' then 2
          when 'onboarding' then 3
          when 'prospect' then 4
          else 5
        end,
        name
    ) as customer_rank
  from public.customers
) customer_row
  on customer_row.customer_rank = charge.customer_rank
left join public.pricing_items pricing
  on pricing.code = charge.pricing_code
on conflict (id) do update set
  customer_id = excluded.customer_id,
  pricing_item_id = excluded.pricing_item_id,
  charge_type = excluded.charge_type,
  description = excluded.description,
  amount = excluded.amount,
  currency = excluded.currency,
  billing_status = excluded.billing_status,
  invoice_reference = excluded.invoice_reference,
  charge_date = excluded.charge_date,
  due_date = excluded.due_date,
  notes = excluded.notes;
