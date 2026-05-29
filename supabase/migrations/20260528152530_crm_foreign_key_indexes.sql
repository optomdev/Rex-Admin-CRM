create index if not exists customer_contacts_customer_id_idx
  on public.customer_contacts(customer_id);

create index if not exists customer_branches_customer_id_idx
  on public.customer_branches(customer_id);

create index if not exists ticket_events_ticket_id_idx
  on public.ticket_events(ticket_id);

create index if not exists onboarding_projects_template_id_idx
  on public.onboarding_projects(template_id);

create index if not exists onboarding_tasks_project_id_idx
  on public.onboarding_tasks(project_id);

create index if not exists charge_events_charge_id_idx
  on public.charge_events(charge_id);

create index if not exists customer_release_statuses_release_id_idx
  on public.customer_release_statuses(release_id);

create index if not exists webhook_deliveries_ticket_id_idx
  on public.webhook_deliveries(ticket_id);
