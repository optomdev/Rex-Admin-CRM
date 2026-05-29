create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create policy customers_service_role_all on public.customers for all to service_role using (true) with check (true);
create policy customer_contacts_service_role_all on public.customer_contacts for all to service_role using (true) with check (true);
create policy customer_branches_service_role_all on public.customer_branches for all to service_role using (true) with check (true);
create policy tickets_service_role_all on public.tickets for all to service_role using (true) with check (true);
create policy ticket_messages_service_role_all on public.ticket_messages for all to service_role using (true) with check (true);
create policy ticket_events_service_role_all on public.ticket_events for all to service_role using (true) with check (true);
create policy onboarding_templates_service_role_all on public.onboarding_templates for all to service_role using (true) with check (true);
create policy onboarding_projects_service_role_all on public.onboarding_projects for all to service_role using (true) with check (true);
create policy onboarding_tasks_service_role_all on public.onboarding_tasks for all to service_role using (true) with check (true);
create policy charges_service_role_all on public.charges for all to service_role using (true) with check (true);
create policy charge_events_service_role_all on public.charge_events for all to service_role using (true) with check (true);
create policy releases_service_role_all on public.releases for all to service_role using (true) with check (true);
create policy customer_release_statuses_service_role_all on public.customer_release_statuses for all to service_role using (true) with check (true);
create policy customer_timeline_items_service_role_all on public.customer_timeline_items for all to service_role using (true) with check (true);
create policy webhook_events_service_role_all on public.webhook_events for all to service_role using (true) with check (true);
create policy webhook_deliveries_service_role_all on public.webhook_deliveries for all to service_role using (true) with check (true);
