grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.customers,
  public.customer_contacts,
  public.customer_branches,
  public.tickets,
  public.ticket_messages,
  public.ticket_events,
  public.onboarding_templates,
  public.onboarding_projects,
  public.onboarding_tasks,
  public.charges,
  public.charge_events,
  public.releases,
  public.customer_release_statuses,
  public.customer_timeline_items,
  public.webhook_events,
  public.webhook_deliveries
to service_role;

revoke all on table
  public.customers,
  public.customer_contacts,
  public.customer_branches,
  public.tickets,
  public.ticket_messages,
  public.ticket_events,
  public.onboarding_templates,
  public.onboarding_projects,
  public.onboarding_tasks,
  public.charges,
  public.charge_events,
  public.releases,
  public.customer_release_statuses,
  public.customer_timeline_items,
  public.webhook_events,
  public.webhook_deliveries
from anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
revoke all on tables from anon, authenticated;
