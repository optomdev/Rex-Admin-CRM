import type {
  Charge,
  CrmCustomer,
  CrmTicket,
  DashboardSummary,
  OnboardingProject,
  Release,
  TimelineItem
} from '~/types'

const now = new Date().toISOString()

export const sampleCustomers: CrmCustomer[] = [{
  id: '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
  name: 'Abbey Road Opticians',
  status: 'active',
  health_score: 92,
  primary_domain: 'abbeyroad.example',
  commercial_notes: 'Three branches live. Interested in automated statements after V1 billing ledger settles.',
  tags: ['multi-branch', 'champion'],
  recurring_monthly_amount: 449,
  onboarding_fee: 1200,
  created_at: now,
  updated_at: now
}, {
  id: '8ce90a83-dbd4-4a22-86c2-92215efb0a21',
  name: 'Northgate Eye Care',
  status: 'onboarding',
  health_score: 78,
  primary_domain: 'northgate.example',
  commercial_notes: 'Go-live depends on catalog import and staff training completion.',
  tags: ['onboarding', 'training'],
  recurring_monthly_amount: 329,
  onboarding_fee: 900,
  created_at: now,
  updated_at: now
}, {
  id: '8d156422-2528-4671-b805-1048c9dd25aa',
  name: 'Mersey Vision Clinic',
  status: 'at_risk',
  health_score: 51,
  primary_domain: 'merseyvision.example',
  commercial_notes: 'Owner wants clearer release notes before approving next rollout.',
  tags: ['attention', 'release-hold'],
  recurring_monthly_amount: 289,
  onboarding_fee: 750,
  created_at: now,
  updated_at: now
}]

export const sampleTickets: CrmTicket[] = [{
  id: '53ee732d-a057-4536-b6b5-7e6fc0f0a001',
  customer_id: sampleCustomers[0]!.id,
  rex_ticket_id: 'REX-2148',
  rex_local_table_id: '47',
  reporter_name: 'Priya Shah',
  reporter_email: 'priya@abbeyroad.example',
  page_url: 'https://rex.app/dispensing/orders/823',
  priority: 'high',
  status: 'triage',
  assignment: 'Dan',
  subject: 'Lens order total differs after discount',
  description: 'Reporter sees a different grand total after reopening an order with a manual discount.',
  screenshot_metadata: { count: 1, filenames: ['order-total.png'] },
  environment: { browser: 'Chrome', os: 'Windows 11' },
  app_version: 'v1.18.2',
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[0]!
}, {
  id: '2f2db0d6-6af4-45e5-a2ff-8a21bf0a0002',
  customer_id: sampleCustomers[1]!.id,
  rex_ticket_id: 'REX-2149',
  rex_local_table_id: '48',
  reporter_name: 'Molly Carter',
  reporter_email: 'molly@northgate.example',
  page_url: 'https://rex.app/settings/imports',
  priority: 'normal',
  status: 'waiting_on_customer',
  assignment: 'Dan',
  subject: 'Need help mapping supplier catalogue columns',
  description: 'Customer uploaded a catalogue where the supplier reference and retail price fields are swapped.',
  screenshot_metadata: {},
  environment: { browser: 'Edge', os: 'Windows 11' },
  app_version: 'v1.18.1',
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[1]!
}, {
  id: 'cbbd25b6-d42e-4e93-8f77-0343fb0a0003',
  customer_id: sampleCustomers[2]!.id,
  rex_ticket_id: 'REX-2150',
  rex_local_table_id: '49',
  reporter_name: 'Elliot Moore',
  reporter_email: 'elliot@merseyvision.example',
  page_url: 'https://rex.app/patients/search',
  priority: 'urgent',
  status: 'in_progress',
  assignment: 'Dan',
  subject: 'Patient search intermittently times out',
  description: 'Search returns no results for broad surname queries during afternoon clinics.',
  screenshot_metadata: {},
  environment: { browser: 'Chrome', os: 'macOS' },
  app_version: 'v1.17.9',
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[2]!
}]

export const sampleOnboarding: OnboardingProject[] = [{
  id: 'ef91ef5d-801c-4f01-8361-bdb71d90a001',
  customer_id: sampleCustomers[1]!.id,
  name: 'Northgate launch',
  status: 'in_progress',
  go_live_target: '2026-06-14',
  readiness_score: 64,
  blockers: 'Supplier catalogue mapping and two staff training sessions remain.',
  training_notes: 'Reception team prefers short recorded walkthroughs after live training.',
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[1]!
}]

export const sampleCharges: Charge[] = [{
  id: '55fb31f3-9656-48ea-afce-bec6a2d0a001',
  customer_id: sampleCustomers[0]!.id,
  charge_type: 'monthly',
  description: 'June Rex subscription',
  amount: 449,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: 'INV-2026-061',
  charge_date: '2026-06-01',
  due_date: '2026-06-14',
  customer: sampleCustomers[0]!
}, {
  id: 'c903c168-2e9f-45f4-81c1-ddd0a2d0a002',
  customer_id: sampleCustomers[1]!.id,
  charge_type: 'onboarding',
  description: 'Onboarding fee balance',
  amount: 450,
  currency: 'GBP',
  billing_status: 'invoice_sent',
  invoice_reference: 'INV-2026-062',
  charge_date: '2026-06-01',
  due_date: '2026-06-21',
  customer: sampleCustomers[1]!
}]

export const sampleReleases: Release[] = [{
  id: 'd5ce6130-8fdb-4819-b7b4-327f3f90a001',
  version: 'v1.18.2',
  title: 'Dispensing totals hardening',
  release_notes: 'Improves order total recalculation and adds extra audit context for support tickets.',
  published_at: '2026-05-22T10:30:00.000Z',
  github_url: 'https://github.com/example/rex/releases/tag/v1.18.2',
  known_issues: 'Manual discounts require regression watch on multi-pair orders.',
  created_at: now,
  updated_at: now
}, {
  id: '61993b4d-7776-4b12-9b18-4ae3dd90a002',
  version: 'v1.18.1',
  title: 'Support ticket screenshot metadata',
  release_notes: 'Adds richer environment capture to the Rex support ticket flow.',
  published_at: '2026-05-14T09:00:00.000Z',
  github_url: 'https://github.com/example/rex/releases/tag/v1.18.1',
  known_issues: null,
  created_at: now,
  updated_at: now
}]

export const sampleTimeline: TimelineItem[] = [{
  id: '43f419ea-d435-458e-b561-94647df0a001',
  customer_id: sampleCustomers[0]!.id,
  item_type: 'ticket',
  title: 'High priority ticket received',
  body: 'Lens order total differs after discount',
  occurred_at: now,
  related_table: 'tickets',
  related_id: sampleTickets[0]!.id,
  customer: sampleCustomers[0]!
}, {
  id: '298d38fb-fba1-4a78-8cf6-8c1cc5a0a002',
  customer_id: sampleCustomers[1]!.id,
  item_type: 'onboarding',
  title: 'Onboarding readiness moved to 64%',
  body: 'Catalogue mapping remains the main blocker.',
  occurred_at: now,
  related_table: 'onboarding_projects',
  related_id: sampleOnboarding[0]!.id,
  customer: sampleCustomers[1]!
}, {
  id: '8a94cbfb-0c4d-40ff-a389-72886490a003',
  customer_id: sampleCustomers[2]!.id,
  item_type: 'release',
  title: 'Rollout paused for v1.18.2',
  body: 'Customer requested clearer release notes before deployment.',
  occurred_at: now,
  related_table: 'releases',
  related_id: sampleReleases[0]!.id,
  customer: sampleCustomers[2]!
}]

export function sampleDashboardSummary(): DashboardSummary {
  const openCharges = sampleCharges
    .filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status))
    .reduce((total, charge) => total + charge.amount, 0)

  return {
    metrics: [{
      label: 'Open tickets',
      value: sampleTickets.length.toString(),
      detail: '1 urgent, 1 high',
      icon: 'i-lucide-life-buoy',
      tone: 'primary'
    }, {
      label: 'Monthly ledger',
      value: 'GBP 1,067',
      detail: 'Tracked manually in V1',
      icon: 'i-lucide-banknote',
      tone: 'success'
    }, {
      label: 'Open charges',
      value: `GBP ${openCharges.toLocaleString('en-GB')}`,
      detail: '2 awaiting payment',
      icon: 'i-lucide-receipt',
      tone: 'warning'
    }, {
      label: 'Latest Rex version',
      value: sampleReleases[0]!.version,
      detail: 'GitHub sync ready',
      icon: 'i-lucide-git-branch',
      tone: 'secondary'
    }],
    tickets: sampleTickets,
    customers: sampleCustomers,
    onboarding: sampleOnboarding,
    charges: sampleCharges,
    releases: sampleReleases,
    timeline: sampleTimeline
  }
}
