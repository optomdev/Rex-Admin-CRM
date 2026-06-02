create table public.twilio_usage_sources (
  id uuid primary key default gen_random_uuid(),
  account_sid text not null unique,
  project_name text,
  billing_group_id uuid references public.billing_groups(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.twilio_invoice_imports (
  id uuid primary key default gen_random_uuid(),
  account_sid text not null references public.twilio_usage_sources(account_sid) on delete cascade,
  invoice_number text not null unique,
  period_start date not null,
  period_end date not null,
  currency text not null default 'GBP',
  phone_numbers_amount numeric(12, 2) not null default 0,
  messaging_quantity numeric(12, 2) not null default 0,
  messaging_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  source_filename text,
  raw_summary jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create trigger twilio_usage_sources_set_updated_at
  before update on public.twilio_usage_sources
  for each row execute function public.set_updated_at();

alter table public.twilio_usage_sources enable row level security;
alter table public.twilio_invoice_imports enable row level security;

create policy twilio_usage_sources_service_role_all
  on public.twilio_usage_sources
  for all
  to service_role
  using (true)
  with check (true);

create policy twilio_invoice_imports_service_role_all
  on public.twilio_invoice_imports
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.twilio_usage_sources to service_role;
grant all on table public.twilio_invoice_imports to service_role;
grant select, insert, update, delete on table public.twilio_usage_sources to authenticated;
grant select, insert, update, delete on table public.twilio_invoice_imports to authenticated;

insert into public.pricing_items (
  code,
  name,
  category,
  charge_type,
  amount,
  currency,
  unit_label,
  notes,
  is_active,
  sort_order
) values
  ('twilio-phone-numbers', 'Twilio phone numbers', 'usage', 'ad_hoc', 0, 'GBP', 'number', 'Pass-through Twilio number rental usage.', true, 65),
  ('twilio-vat', 'Twilio VAT', 'usage', 'ad_hoc', 0, 'GBP', 'invoice', 'Supplier VAT recorded from Twilio invoice.', true, 66)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  charge_type = excluded.charge_type,
  amount = excluded.amount,
  currency = excluded.currency,
  unit_label = excluded.unit_label,
  notes = excluded.notes,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.twilio_usage_sources (
  account_sid,
  project_name,
  billing_group_id,
  customer_id,
  notes,
  is_active
)
select
  'rexapps_twilio_usage_source',
  'My first Twilio account',
  billing_group.id,
  customer_row.id,
  'RexApps Twilio usage source from invoice SCRXDQ-2026-04.',
  true
from (
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
left join public.billing_group_accounts account
  on account.customer_id = customer_row.id
left join public.billing_groups billing_group
  on billing_group.id = account.billing_group_id
where customer_row.customer_rank = 1
on conflict (account_sid) do update set
  project_name = excluded.project_name,
  billing_group_id = excluded.billing_group_id,
  customer_id = excluded.customer_id,
  notes = excluded.notes,
  is_active = excluded.is_active;

insert into public.twilio_invoice_imports (
  account_sid,
  invoice_number,
  period_start,
  period_end,
  currency,
  phone_numbers_amount,
  messaging_quantity,
  messaging_amount,
  tax_amount,
  total_amount,
  source_filename,
  raw_summary
) values (
  'rexapps_twilio_usage_source',
  'SCRXDQ-2026-04',
  '2026-04-01',
  '2026-04-30',
  'GBP',
  0.87,
  3,
  0.13,
  0.20,
  1.20,
  'rexapps-twilio-2026-04-IV770bd413d047560bd34be7b24e508174.pdf',
  jsonb_build_object(
    'account_sid', 'redacted_for_repository',
    'project_name', 'My first Twilio account',
    'invoice_number', 'SCRXDQ-2026-04',
    'issue_date', '2026-04-30',
    'usage_period', 'Apr 1 2026 - Apr 30 2026',
    'phone_numbers', jsonb_build_object('quantity', 1, 'amount', 0.87),
    'programmable_messaging', jsonb_build_object('quantity', 3, 'amount', 0.13, 'detail', 'UNITED KINGDOM Outbound SMS - T-Mobile'),
    'taxes', jsonb_build_object('vat_rate', '20%', 'amount', 0.20),
    'total', 1.20
  )
)
on conflict (invoice_number) do update set
  period_start = excluded.period_start,
  period_end = excluded.period_end,
  currency = excluded.currency,
  phone_numbers_amount = excluded.phone_numbers_amount,
  messaging_quantity = excluded.messaging_quantity,
  messaging_amount = excluded.messaging_amount,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  source_filename = excluded.source_filename,
  raw_summary = excluded.raw_summary;

insert into public.charges (
  id,
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
  charge.id,
  source.customer_id,
  source.billing_group_id,
  pricing.id,
  'ad_hoc',
  charge.description,
  charge.amount,
  'GBP',
  'draft',
  null,
  '2026-04-30',
  null,
  charge.notes
from public.twilio_usage_sources source
join (
  values
    ('55dfb82e-9d1b-4860-ac57-7d870ad60001'::uuid, 'twilio-phone-numbers', 'Twilio phone number usage - April 2026', 0.87::numeric, 'Twilio invoice SCRXDQ-2026-04: 1 United Kingdom local phone number.'),
    ('55dfb82e-9d1b-4860-ac57-7d870ad60002'::uuid, 'sms-charges', 'Twilio SMS usage - April 2026', 0.13::numeric, 'Twilio invoice SCRXDQ-2026-04: 3 United Kingdom outbound SMS to T-Mobile.'),
    ('55dfb82e-9d1b-4860-ac57-7d870ad60003'::uuid, 'twilio-vat', 'Twilio VAT - April 2026', 0.20::numeric, 'Twilio invoice SCRXDQ-2026-04: VAT at 20% on taxable services.')
) as charge(id, pricing_code, description, amount, notes)
  on true
join public.pricing_items pricing
  on pricing.code = charge.pricing_code
where source.account_sid = 'rexapps_twilio_usage_source'
  and source.customer_id is not null
on conflict (id) do update set
  customer_id = excluded.customer_id,
  billing_group_id = excluded.billing_group_id,
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
