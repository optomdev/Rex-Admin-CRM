create table public.billing_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_email text,
  invoice_day_of_month integer not null default 1 check (invoice_day_of_month between 1 and 28),
  due_days integer not null default 14 check (due_days between 0 and 90),
  invoice_timezone text not null default 'Europe/London',
  payment_method_notes text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_group_accounts (
  id uuid primary key default gen_random_uuid(),
  billing_group_id uuid not null references public.billing_groups(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_group_accounts_unique unique (billing_group_id, customer_id),
  constraint billing_group_accounts_customer_unique unique (customer_id)
);

create table public.billing_group_pricing_items (
  id uuid primary key default gen_random_uuid(),
  billing_group_id uuid not null references public.billing_groups(id) on delete cascade,
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

alter table public.charges
  add column billing_group_id uuid references public.billing_groups(id) on delete set null;

create index billing_groups_active_invoice_day_idx
  on public.billing_groups(is_active, invoice_day_of_month, name);

create index billing_group_accounts_group_idx
  on public.billing_group_accounts(billing_group_id, is_primary);

create index billing_group_pricing_items_group_idx
  on public.billing_group_pricing_items(billing_group_id, is_active, starts_on, ends_on);

create index charges_billing_group_id_idx
  on public.charges(billing_group_id);

create trigger billing_groups_set_updated_at
  before update on public.billing_groups
  for each row execute function public.set_updated_at();

create trigger billing_group_accounts_set_updated_at
  before update on public.billing_group_accounts
  for each row execute function public.set_updated_at();

create trigger billing_group_pricing_items_set_updated_at
  before update on public.billing_group_pricing_items
  for each row execute function public.set_updated_at();

alter table public.billing_groups enable row level security;
alter table public.billing_group_accounts enable row level security;
alter table public.billing_group_pricing_items enable row level security;

create policy billing_groups_service_role_all
  on public.billing_groups
  for all
  to service_role
  using (true)
  with check (true);

create policy billing_group_accounts_service_role_all
  on public.billing_group_accounts
  for all
  to service_role
  using (true)
  with check (true);

create policy billing_group_pricing_items_service_role_all
  on public.billing_group_pricing_items
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.billing_groups to service_role;
grant all on table public.billing_group_accounts to service_role;
grant all on table public.billing_group_pricing_items to service_role;
grant select, insert, update, delete on table public.billing_groups to authenticated;
grant select, insert, update, delete on table public.billing_group_accounts to authenticated;
grant select, insert, update, delete on table public.billing_group_pricing_items to authenticated;

drop function if exists public.generate_monthly_customer_charges(date);

create or replace function public.generate_monthly_customer_charges(
  p_billing_month date default date_trunc('month', current_date)::date,
  p_invoice_day integer default null
)
returns table(customer_id uuid, charge_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  billing_month date := date_trunc('month', coalesce(p_billing_month, current_date))::date;
  configured_invoice_day integer := coalesce((select invoice_day_of_month from public.invoice_settings where id = true), 1);
  configured_due_days integer := coalesce((select due_days from public.invoice_settings where id = true), 14);
begin
  return query
  with group_accounts as (
    select
      group_row.id as billing_group_id,
      group_row.name as billing_group_name,
      group_row.due_days,
      account.customer_id,
      account.is_primary,
      customer.name as customer_name
    from public.billing_groups group_row
    join public.billing_group_accounts account
      on account.billing_group_id = group_row.id
    join public.customers customer
      on customer.id = account.customer_id
    where group_row.is_active
      and (p_invoice_day is null or group_row.invoice_day_of_month = p_invoice_day)
  ), group_account_profiles as (
    select
      group_accounts.billing_group_id,
      group_accounts.billing_group_name,
      (array_agg(group_accounts.customer_id order by group_accounts.is_primary desc, group_accounts.customer_name))[1] as invoice_customer_id,
      max(group_accounts.due_days) as due_days,
      string_agg(group_accounts.customer_name, ', ' order by group_accounts.is_primary desc, group_accounts.customer_name) as account_names
    from group_accounts
    group by group_accounts.billing_group_id, group_accounts.billing_group_name
  ), group_lines as (
    select
      group_row.id as billing_group_id,
      pricing.id as pricing_item_id,
      pricing.name as pricing_name,
      line.quantity,
      coalesce(line.unit_amount_override, pricing.amount) as unit_amount,
      coalesce(line.currency_override, pricing.currency) as currency,
      line.notes
    from public.billing_groups group_row
    join public.billing_group_pricing_items line
      on line.billing_group_id = group_row.id
    join public.pricing_items pricing
      on pricing.id = line.pricing_item_id
    where group_row.is_active
      and (p_invoice_day is null or group_row.invoice_day_of_month = p_invoice_day)
      and line.is_active
      and pricing.is_active
      and pricing.charge_type = 'monthly'
      and line.starts_on <= billing_month
      and (line.ends_on is null or line.ends_on >= billing_month)
  ), group_profiles as (
    select
      group_account_profiles.billing_group_id,
      group_account_profiles.invoice_customer_id as customer_id,
      null::uuid as pricing_item_id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' ' || group_account_profiles.billing_group_name || ' invoice' as description,
      sum(group_lines.unit_amount * group_lines.quantity) as amount,
      max(group_lines.currency) as currency,
      (billing_month + make_interval(days => max(group_account_profiles.due_days)))::date as due_date,
      'Accounts: ' || group_account_profiles.account_names || E'\n'
        || string_agg(
          group_lines.pricing_name
            || case
              when group_lines.quantity = 1 then ''
              else ' x ' || group_lines.quantity::text
            end
            || ' - ' || group_lines.currency || ' '
            || to_char(group_lines.unit_amount * group_lines.quantity, 'FM999999999990.00')
            || coalesce(' (' || nullif(group_lines.notes, '') || ')', ''),
          E'\n'
          order by group_lines.pricing_name
        ) as notes,
      'AUTO-' || to_char(billing_month, 'YYYYMM') || '-BG-' || right(replace(group_account_profiles.billing_group_id::text, '-', ''), 12) as invoice_reference
    from group_account_profiles
    join group_lines
      on group_lines.billing_group_id = group_account_profiles.billing_group_id
    group by
      group_account_profiles.billing_group_id,
      group_account_profiles.billing_group_name,
      group_account_profiles.invoice_customer_id,
      group_account_profiles.account_names
  ), assigned_customers as (
    select billing_group_accounts.customer_id
    from public.billing_group_accounts
  ), active_assignments as (
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
      and not exists (
        select 1 from assigned_customers where assigned_customers.customer_id = customer.id
      )
      and (p_invoice_day is null or p_invoice_day = configured_invoice_day)
      and assignment.is_active
      and pricing.is_active
      and pricing.charge_type = 'monthly'
      and assignment.starts_on <= billing_month
      and (assignment.ends_on is null or assignment.ends_on >= billing_month)
  ), assigned_profiles as (
    select
      active_assignments.customer_id,
      null::uuid as billing_group_id,
      case
        when count(*) = 1 then (array_agg(active_assignments.pricing_item_id order by active_assignments.pricing_item_id::text))[1]
        else null
      end as pricing_item_id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' Rex subscription' as description,
      sum(active_assignments.unit_amount * active_assignments.quantity) as amount,
      max(active_assignments.currency) as currency,
      (billing_month + make_interval(days => configured_due_days))::date as due_date,
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
      ) as notes,
      'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(active_assignments.customer_id::text, 8) as invoice_reference
    from active_assignments
    group by active_assignments.customer_id
  ), recurring_profiles as (
    select
      customer.id as customer_id,
      null::uuid as billing_group_id,
      pricing.id as pricing_item_id,
      trim(to_char(billing_month, 'FMMonth YYYY')) || ' Rex subscription' as description,
      customer.recurring_monthly_amount as amount,
      'GBP' as currency,
      (billing_month + make_interval(days => configured_due_days))::date as due_date,
      'Generated from customer recurring monthly amount because no active pricing assignments or billing group exist.' as notes,
      'AUTO-' || to_char(billing_month, 'YYYYMM') || '-' || left(customer.id::text, 8) as invoice_reference
    from public.customers customer
    left join public.pricing_items pricing
      on pricing.code = 'rex-main-license'
    where customer.status in ('active', 'at_risk')
      and not exists (
        select 1 from assigned_customers where assigned_customers.customer_id = customer.id
      )
      and (p_invoice_day is null or p_invoice_day = configured_invoice_day)
      and customer.recurring_monthly_amount > 0
      and not exists (
        select 1
        from active_assignments
        where active_assignments.customer_id = customer.id
      )
  ), charge_sources as (
    select
      group_profiles.customer_id,
      group_profiles.billing_group_id,
      group_profiles.pricing_item_id,
      group_profiles.description,
      group_profiles.amount,
      group_profiles.currency,
      group_profiles.due_date,
      group_profiles.notes,
      group_profiles.invoice_reference
    from group_profiles

    union all

    select
      assigned_profiles.customer_id,
      assigned_profiles.billing_group_id,
      assigned_profiles.pricing_item_id,
      assigned_profiles.description,
      assigned_profiles.amount,
      assigned_profiles.currency,
      assigned_profiles.due_date,
      assigned_profiles.notes,
      assigned_profiles.invoice_reference
    from assigned_profiles

    union all

    select
      recurring_profiles.customer_id,
      recurring_profiles.billing_group_id,
      recurring_profiles.pricing_item_id,
      recurring_profiles.description,
      recurring_profiles.amount,
      recurring_profiles.currency,
      recurring_profiles.due_date,
      recurring_profiles.notes,
      recurring_profiles.invoice_reference
    from recurring_profiles
  ), created as (
    insert into public.charges (
      customer_id,
      billing_group_id,
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
      charge_sources.billing_group_id,
      charge_sources.pricing_item_id,
      'monthly',
      charge_sources.description,
      charge_sources.amount,
      charge_sources.currency,
      'open',
      charge_sources.invoice_reference,
      billing_month,
      charge_sources.due_date,
      charge_sources.notes
    from charge_sources
    where charge_sources.amount > 0
      and not exists (
        select 1
        from public.charges existing
        where existing.invoice_reference = charge_sources.invoice_reference
      )
    returning public.charges.customer_id, public.charges.id, public.charges.description, public.charges.amount, public.charges.currency, public.charges.billing_status, public.charges.billing_group_id
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
        'billing_group_id', created.billing_group_id,
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

  return query
  select *
  from public.generate_monthly_customer_charges(
    date_trunc('month', effective_today)::date,
    extract(day from effective_today)::integer
  );
end;
$$;

insert into public.billing_groups (
  id,
  name,
  billing_email,
  invoice_day_of_month,
  due_days,
  payment_method_notes,
  notes,
  is_active
)
values
  ('9a7a11f5-588f-4718-94f4-6a66daed9001', 'Rex group billing', 'billing@rex.example', 1, 14, 'Card on file ending 4242.', 'Sample group with more than one account sharing Rex and Hearing pricing.', true),
  ('9a7a11f5-588f-4718-94f4-6a66daed9002', 'Launch group billing', 'accounts@launch.example', 1, 14, 'Invoice by email for launch billing.', 'Sample launch billing group with shared core and HR pricing.', true)
on conflict (id) do update set
  name = excluded.name,
  billing_email = excluded.billing_email,
  invoice_day_of_month = excluded.invoice_day_of_month,
  due_days = excluded.due_days,
  payment_method_notes = excluded.payment_method_notes,
  notes = excluded.notes,
  is_active = excluded.is_active;

insert into public.billing_group_accounts (
  id,
  billing_group_id,
  customer_id,
  is_primary,
  notes
)
select
  account.id,
  account.billing_group_id,
  customer_row.id,
  account.is_primary,
  account.notes
from (
  values
    ('1ad0e7c4-a92e-4ea0-a9be-b4b217659001'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9001'::uuid, 1, true, 'Primary invoice account.'),
    ('1ad0e7c4-a92e-4ea0-a9be-b4b217659002'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9001'::uuid, 2, false, 'Linked account included on the same bill.'),
    ('1ad0e7c4-a92e-4ea0-a9be-b4b217659003'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9002'::uuid, 3, true, 'Launch billing account.')
) as account(id, billing_group_id, customer_rank, is_primary, notes)
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
  on customer_row.customer_rank = account.customer_rank
on conflict (id) do update set
  billing_group_id = excluded.billing_group_id,
  customer_id = excluded.customer_id,
  is_primary = excluded.is_primary,
  notes = excluded.notes;

insert into public.billing_group_pricing_items (
  id,
  billing_group_id,
  pricing_item_id,
  quantity,
  notes,
  starts_on,
  is_active
)
select
  line.id,
  line.billing_group_id,
  pricing.id,
  line.quantity,
  line.notes,
  line.starts_on,
  line.is_active
from (
  values
    ('0aa80ebe-8d67-420e-a3ee-173dcdeed001'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9001'::uuid, 'rex-main-license', 1::numeric, 'Shared core Rex licence.', '2026-06-01'::date, true),
    ('0aa80ebe-8d67-420e-a3ee-173dcdeed002'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9001'::uuid, 'hearing-module', 1::numeric, 'Hearing module shared by the group.', '2026-06-01'::date, true),
    ('0aa80ebe-8d67-420e-a3ee-173dcdeed003'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9002'::uuid, 'rex-main-license', 1::numeric, 'Launch core Rex licence.', '2026-06-01'::date, true),
    ('0aa80ebe-8d67-420e-a3ee-173dcdeed004'::uuid, '9a7a11f5-588f-4718-94f4-6a66daed9002'::uuid, 'hr-full-module', 1::numeric, 'HR module included in launch group.', '2026-06-01'::date, true)
) as line(id, billing_group_id, pricing_code, quantity, notes, starts_on, is_active)
join public.pricing_items pricing
  on pricing.code = line.pricing_code
on conflict (id) do update set
  billing_group_id = excluded.billing_group_id,
  pricing_item_id = excluded.pricing_item_id,
  quantity = excluded.quantity,
  notes = excluded.notes,
  starts_on = excluded.starts_on,
  is_active = excluded.is_active;
