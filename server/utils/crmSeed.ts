import type {
  BillingGroup,
  Charge,
  CrmCustomer,
  CrmTicket,
  CustomerPricingItem,
  DashboardSummary,
  OnboardingProject,
  Release,
  TimelineItem
} from '~/types'

const now = new Date().toISOString()

export const sampleCustomers: CrmCustomer[] = [{
  id: '6b82aa63-2798-42f0-a9fd-d3d552f20a01',
  name: 'Abbey Road Opticians',
  account_type: 'customer',
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
  account_type: 'prospect',
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
  account_type: 'customer',
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
}, {
  id: '4db2a00c-09a0-4fd1-b742-bd8285c00001',
  customer_id: sampleCustomers[0]!.id,
  charge_type: 'ad_hoc',
  description: 'May SMS charges',
  amount: 28.40,
  currency: 'GBP',
  billing_status: 'open',
  invoice_reference: 'INV-2026-063',
  charge_date: '2026-06-01',
  due_date: '2026-06-14',
  notes: '142 appointment reminders and recall messages.',
  customer: sampleCustomers[0]!
}, {
  id: '4db2a00c-09a0-4fd1-b742-bd8285c00002',
  customer_id: sampleCustomers[0]!.id,
  charge_type: 'ad_hoc',
  description: 'May postcode look ups',
  amount: 12.60,
  currency: 'GBP',
  billing_status: 'paid',
  invoice_reference: 'INV-2026-060',
  charge_date: '2026-05-01',
  due_date: '2026-05-14',
  notes: '63 postcode lookups.',
  customer: sampleCustomers[0]!
}, {
  id: '4db2a00c-09a0-4fd1-b742-bd8285c00003',
  customer_id: sampleCustomers[2]!.id,
  charge_type: 'ad_hoc',
  description: 'IMP letter charges',
  amount: 36,
  currency: 'GBP',
  billing_status: 'overdue',
  invoice_reference: 'INV-2026-058',
  charge_date: '2026-05-01',
  due_date: '2026-05-14',
  notes: '18 IMP letters generated during May.',
  customer: sampleCustomers[2]!
}, {
  id: '4db2a00c-09a0-4fd1-b742-bd8285c00004',
  customer_id: sampleCustomers[2]!.id,
  charge_type: 'ad_hoc',
  description: 'Remote training session',
  amount: 85,
  currency: 'GBP',
  billing_status: 'invoice_sent',
  invoice_reference: 'INV-2026-064',
  charge_date: '2026-06-01',
  due_date: '2026-06-14',
  notes: 'Additional staff refresher session after rollout hold.',
  customer: sampleCustomers[2]!
}]

export const sampleCustomerPricingItems: CustomerPricingItem[] = [{
  id: '0f571fe7-2c4e-46d1-a684-061c09c50001',
  customer_id: sampleCustomers[0]!.id,
  pricing_item_id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
  quantity: 1,
  notes: 'Main agreed Rex licence.',
  starts_on: '2026-06-01',
  is_active: true,
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[0]!,
  pricing_item: {
    id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
    code: 'rex-main-license',
    name: 'Rex main license fee',
    category: 'license',
    charge_type: 'monthly',
    amount: 300,
    currency: 'GBP',
    unit_label: 'month'
  }
}, {
  id: '0f571fe7-2c4e-46d1-a684-061c09c50002',
  customer_id: sampleCustomers[0]!.id,
  pricing_item_id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2002',
  quantity: 1,
  notes: 'Hearing clinic module agreed from June.',
  starts_on: '2026-06-01',
  is_active: true,
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[0]!,
  pricing_item: {
    id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2002',
    code: 'hearing-module',
    name: 'Hearing module',
    category: 'module',
    charge_type: 'monthly',
    amount: 150,
    currency: 'GBP',
    unit_label: 'month'
  }
}, {
  id: '0f571fe7-2c4e-46d1-a684-061c09c50003',
  customer_id: sampleCustomers[2]!.id,
  pricing_item_id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
  quantity: 1,
  notes: 'Core Rex licence only while release rollout is paused.',
  starts_on: '2026-06-01',
  is_active: true,
  created_at: now,
  updated_at: now,
  customer: sampleCustomers[2]!,
  pricing_item: {
    id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
    code: 'rex-main-license',
    name: 'Rex main license fee',
    category: 'license',
    charge_type: 'monthly',
    amount: 300,
    currency: 'GBP',
    unit_label: 'month'
  }
}]

export const sampleBillingGroups: BillingGroup[] = [{
  id: '9a7a11f5-588f-4718-94f4-6a66daed9001',
  name: 'Rex group billing',
  billing_email: 'billing@abbeyroad.example',
  invoice_day_of_month: 1,
  due_days: 14,
  invoice_timezone: 'Europe/London',
  payment_method_notes: 'Card on file ending 4242.',
  notes: 'Sample group with multiple accounts sharing Rex and Hearing pricing.',
  is_active: true,
  created_at: now,
  updated_at: now,
  accounts: [{
    id: '1ad0e7c4-a92e-4ea0-a9be-b4b217659001',
    billing_group_id: '9a7a11f5-588f-4718-94f4-6a66daed9001',
    customer_id: sampleCustomers[0]!.id,
    is_primary: true,
    notes: 'Primary invoice account.',
    created_at: now,
    updated_at: now,
    customer: sampleCustomers[0]!
  }, {
    id: '1ad0e7c4-a92e-4ea0-a9be-b4b217659002',
    billing_group_id: '9a7a11f5-588f-4718-94f4-6a66daed9001',
    customer_id: sampleCustomers[1]!.id,
    is_primary: false,
    notes: 'Linked account included on the same bill.',
    created_at: now,
    updated_at: now,
    customer: sampleCustomers[1]!
  }],
  pricing_items: [{
    id: '0aa80ebe-8d67-420e-a3ee-173dcdeed001',
    billing_group_id: '9a7a11f5-588f-4718-94f4-6a66daed9001',
    pricing_item_id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
    quantity: 1,
    notes: 'Shared core Rex licence.',
    starts_on: '2026-06-01',
    is_active: true,
    created_at: now,
    updated_at: now,
    pricing_item: {
      id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
      code: 'rex-main-license',
      name: 'Rex main license fee',
      category: 'license',
      charge_type: 'monthly',
      amount: 300,
      currency: 'GBP',
      unit_label: 'month'
    }
  }, {
    id: '0aa80ebe-8d67-420e-a3ee-173dcdeed002',
    billing_group_id: '9a7a11f5-588f-4718-94f4-6a66daed9001',
    pricing_item_id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2002',
    quantity: 1,
    notes: 'Hearing module shared by the group.',
    starts_on: '2026-06-01',
    is_active: true,
    created_at: now,
    updated_at: now,
    pricing_item: {
      id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2002',
      code: 'hearing-module',
      name: 'Hearing module',
      category: 'module',
      charge_type: 'monthly',
      amount: 150,
      currency: 'GBP',
      unit_label: 'month'
    }
  }]
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
