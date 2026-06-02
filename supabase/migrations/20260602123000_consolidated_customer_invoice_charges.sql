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
