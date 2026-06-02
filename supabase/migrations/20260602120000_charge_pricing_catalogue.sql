create table public.pricing_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null check (category in ('license', 'module', 'usage', 'misc')),
  charge_type text not null default 'monthly' check (charge_type in ('monthly', 'onboarding', 'ad_hoc', 'credit')),
  amount numeric(12, 2) not null default 0,
  currency text not null default 'GBP',
  unit_label text not null default 'month',
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.charges
  add column pricing_item_id uuid references public.pricing_items(id) on delete set null,
  add column notes text;

create index pricing_items_active_sort_idx on public.pricing_items(is_active, sort_order, name);
create index charges_pricing_item_id_idx on public.charges(pricing_item_id);

create trigger pricing_items_set_updated_at
  before update on public.pricing_items
  for each row execute function public.set_updated_at();

alter table public.pricing_items enable row level security;

create policy pricing_items_service_role_all
  on public.pricing_items
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.pricing_items to service_role;
grant select, insert, update, delete on table public.pricing_items to authenticated;

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
  ('rex-main-license', 'Rex main license fee', 'license', 'monthly', 300, 'GBP', 'month', 'Core Rex practice management subscription.', true, 10),
  ('hearing-module', 'Hearing module', 'module', 'monthly', 150, 'GBP', 'month', 'Optional hearing/audiology module.', true, 20),
  ('hr-full-module', 'HR full module', 'module', 'monthly', 200, 'GBP', 'month', 'Full HR module access.', true, 30),
  ('postcode-lookups', 'Postcode look ups', 'usage', 'ad_hoc', 0, 'GBP', 'lookup', 'Usage charge. Set the amount when billing the usage period.', true, 40),
  ('sms-charges', 'SMS charges', 'usage', 'ad_hoc', 0, 'GBP', 'SMS', 'Usage charge. Set the amount when billing the usage period.', true, 50),
  ('email-charges', 'Email charges', 'usage', 'ad_hoc', 0, 'GBP', 'email', 'Usage charge. Set the amount when billing the usage period.', true, 60),
  ('imp-letter-charges', 'IMP letter charges', 'usage', 'ad_hoc', 0, 'GBP', 'letter', 'Usage charge for IMP letters.', true, 70),
  ('misc-item', 'Misc item', 'misc', 'ad_hoc', 0, 'GBP', 'item', 'Use notes to explain the misc charge.', true, 80)
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
