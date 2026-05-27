insert into public.customers (
  id,
  name,
  status,
  health_score,
  primary_domain,
  commercial_notes,
  tags,
  recurring_monthly_amount,
  onboarding_fee
) values
  (
    '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
    'Abbey Road Opticians',
    'active',
    92,
    'abbeyroad.example',
    'Three branches live. Interested in automated statements after V1 billing ledger settles.',
    array['multi-branch', 'champion'],
    449,
    1200
  ),
  (
    '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
    'Northgate Eye Care',
    'onboarding',
    78,
    'northgate.example',
    'Go-live depends on catalog import and staff training completion.',
    array['onboarding', 'training'],
    329,
    900
  ),
  (
    '8d156422-2528-4671-b805-1048c9dd25aa',
    'Mersey Vision Clinic',
    'at_risk',
    51,
    'merseyvision.example',
    'Owner wants clearer release notes before approving next rollout.',
    array['attention', 'release-hold'],
    289,
    750
  )
on conflict (id) do nothing;

insert into public.tickets (
  id,
  customer_id,
  rex_ticket_id,
  rex_local_table_id,
  reporter_name,
  reporter_email,
  page_url,
  priority,
  status,
  assignment,
  subject,
  description,
  screenshot_metadata,
  environment,
  app_version
) values
  (
    '53ee732d-a057-4536-b6b5-7e6fc0f0a001',
    '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
    'REX-2148',
    '47',
    'Priya Shah',
    'priya@abbeyroad.example',
    'https://rex.app/dispensing/orders/823',
    'high',
    'triage',
    'Dan',
    'Lens order total differs after discount',
    'Reporter sees a different grand total after reopening an order with a manual discount.',
    '{"count": 1, "filenames": ["order-total.png"]}'::jsonb,
    '{"browser": "Chrome", "os": "Windows 11"}'::jsonb,
    'v1.18.2'
  ),
  (
    '2f2db0d6-6af4-45e5-a2ff-8a21bf0a0002',
    '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
    'REX-2149',
    '48',
    'Molly Carter',
    'molly@northgate.example',
    'https://rex.app/settings/imports',
    'normal',
    'waiting_on_customer',
    'Dan',
    'Need help mapping supplier catalogue columns',
    'Customer uploaded a catalogue where the supplier reference and retail price fields are swapped.',
    '{}'::jsonb,
    '{"browser": "Edge", "os": "Windows 11"}'::jsonb,
    'v1.18.1'
  ),
  (
    'cbbd25b6-d42e-4e93-8f77-0343fb0a0003',
    '8d156422-2528-4671-b805-1048c9dd25aa',
    'REX-2150',
    '49',
    'Elliot Moore',
    'elliot@merseyvision.example',
    'https://rex.app/patients/search',
    'urgent',
    'in_progress',
    'Dan',
    'Patient search intermittently times out',
    'Search returns no results for broad surname queries during afternoon clinics.',
    '{}'::jsonb,
    '{"browser": "Chrome", "os": "macOS"}'::jsonb,
    'v1.17.9'
  )
on conflict (rex_ticket_id) do nothing;

insert into public.onboarding_templates (
  id,
  name,
  description,
  tasks,
  is_default
) values (
  'a1b23663-42f0-463f-a463-f377bc8a0a01',
  'Standard Rex launch',
  'Default V1 implementation checklist.',
  '[
    {"title": "Import customer catalogue", "owner": "Dan"},
    {"title": "Configure branches and contacts", "owner": "Dan"},
    {"title": "Run staff training", "owner": "Dan"},
    {"title": "Confirm go-live readiness", "owner": "Dan"}
  ]'::jsonb,
  true
) on conflict (id) do nothing;

insert into public.onboarding_projects (
  id,
  customer_id,
  template_id,
  name,
  status,
  go_live_target,
  readiness_score,
  blockers,
  training_notes
) values (
  'ef91ef5d-801c-4f01-8361-bdb71d90a001',
  '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
  'a1b23663-42f0-463f-a463-f377bc8a0a01',
  'Northgate launch',
  'in_progress',
  '2026-06-14',
  64,
  'Supplier catalogue mapping and two staff training sessions remain.',
  'Reception team prefers short recorded walkthroughs after live training.'
) on conflict (id) do nothing;

insert into public.charges (
  id,
  customer_id,
  charge_type,
  description,
  amount,
  currency,
  billing_status,
  invoice_reference,
  charge_date,
  due_date
) values
  (
    '55fb31f3-9656-48ea-afce-bec6a2d0a001',
    '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
    'monthly',
    'June Rex subscription',
    449,
    'GBP',
    'open',
    'INV-2026-061',
    '2026-06-01',
    '2026-06-14'
  ),
  (
    'c903c168-2e9f-45f4-81c1-ddd0a2d0a002',
    '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
    'onboarding',
    'Onboarding fee balance',
    450,
    'GBP',
    'invoice_sent',
    'INV-2026-062',
    '2026-06-01',
    '2026-06-21'
  )
on conflict (id) do nothing;

insert into public.releases (
  id,
  version,
  title,
  release_notes,
  published_at,
  github_url,
  known_issues
) values
  (
    'd5ce6130-8fdb-4819-b7b4-327f3f90a001',
    'v1.18.2',
    'Dispensing totals hardening',
    'Improves order total recalculation and adds extra audit context for support tickets.',
    '2026-05-22T10:30:00.000Z',
    'https://github.com/example/rex/releases/tag/v1.18.2',
    'Manual discounts require regression watch on multi-pair orders.'
  ),
  (
    '61993b4d-7776-4b12-9b18-4ae3dd90a002',
    'v1.18.1',
    'Support ticket screenshot metadata',
    'Adds richer environment capture to the Rex support ticket flow.',
    '2026-05-14T09:00:00.000Z',
    'https://github.com/example/rex/releases/tag/v1.18.1',
    null
  )
on conflict (version) do nothing;

insert into public.customer_timeline_items (
  id,
  customer_id,
  item_type,
  title,
  body,
  related_table,
  related_id
) values
  (
    '43f419ea-d435-458e-b561-94647df0a001',
    '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
    'ticket',
    'High priority ticket received',
    'Lens order total differs after discount',
    'tickets',
    '53ee732d-a057-4536-b6b5-7e6fc0f0a001'
  ),
  (
    '298d38fb-fba1-4a78-8cf6-8c1cc5a0a002',
    '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
    'onboarding',
    'Onboarding readiness moved to 64%',
    'Catalogue mapping remains the main blocker.',
    'onboarding_projects',
    'ef91ef5d-801c-4f01-8361-bdb71d90a001'
  ),
  (
    '8a94cbfb-0c4d-40ff-a389-72886490a003',
    '8d156422-2528-4671-b805-1048c9dd25aa',
    'release',
    'Rollout paused for v1.18.2',
    'Customer requested clearer release notes before deployment.',
    'releases',
    'd5ce6130-8fdb-4819-b7b4-327f3f90a001'
  )
on conflict (id) do nothing;
