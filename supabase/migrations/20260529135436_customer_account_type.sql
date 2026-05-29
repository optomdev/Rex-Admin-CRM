alter table public.customers
  add column if not exists account_type text not null default 'prospect'
    check (account_type in ('internal', 'prospect', 'customer', 'partner', 'franchise'));

update public.customers
set account_type = case
  when customer_identifier = 'rexapp-ltd' or lower(name) = 'rexapp ltd' or 'internal' = any(tags) then 'internal'
  when customer_identifier in ('cecil-amey', 'ears-and-eyes-ltd') then 'prospect'
  when 'partner' = any(tags) then 'partner'
  when 'franchise' = any(tags) then 'franchise'
  when status = 'prospect' then 'prospect'
  else 'customer'
end;

create index if not exists customers_account_type_idx
  on public.customers(account_type);

comment on column public.customers.account_type is 'CRM account classification: internal owner, prospect, customer, partner, or franchise.';
