alter table public.customers
  add column if not exists customer_identifier text unique,
  add column if not exists rex_project_ref text,
  add column if not exists rex_supabase_url text;

alter table public.tickets
  add column if not exists customer_identifier text,
  add column if not exists rex_project_ref text,
  add column if not exists rex_supabase_url text;

create index if not exists customers_customer_identifier_idx
  on public.customers (customer_identifier)
  where customer_identifier is not null;

create index if not exists tickets_customer_identifier_idx
  on public.tickets (customer_identifier)
  where customer_identifier is not null;

comment on column public.customers.customer_identifier is 'Stable deployment/customer slug used by Rex webhook payloads, e.g. cecil-amey.';
comment on column public.customers.rex_project_ref is 'Primary Supabase project ref for this customer deployment.';
comment on column public.customers.rex_supabase_url is 'Primary Supabase URL for this customer deployment.';
comment on column public.tickets.customer_identifier is 'Customer/deployment slug received from Rex for ticket routing.';
comment on column public.tickets.rex_project_ref is 'Source Rex Supabase project ref for this ticket.';
comment on column public.tickets.rex_supabase_url is 'Source Rex Supabase URL for this ticket.';
