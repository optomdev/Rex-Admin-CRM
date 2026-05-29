<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CustomerAccountType, CustomerBranch, CustomerContact, CustomerDeployment, CustomerDetail, CrmCustomer, Release } from '~/types'

const search = ref('')
const statusFilter = ref('All')
const accountTypeFilter = ref('all')
const createOpen = ref(false)
const detailOpen = ref(false)
const editContactOpen = ref(false)
const editBranchOpen = ref(false)
const createDeploymentOpen = ref(false)
const editDeploymentOpen = ref(false)
const saving = ref(false)
const detailSaving = ref(false)
const detailLoading = ref(false)
const contactSaving = ref(false)
const branchSaving = ref(false)
const contactEditSaving = ref(false)
const branchEditSaving = ref(false)
const deploymentSaving = ref(false)
const deploymentEditSaving = ref(false)
const editingContactId = ref<string | null>(null)
const editingBranchId = ref<string | null>(null)
const editingDeploymentId = ref<string | null>(null)
const selectedCustomerId = ref<string | null>(null)
const customerDetail = ref<CustomerDetail | null>(null)
const toast = useToast()
const route = useRoute()

const { data: customers, status, refresh } = await useAsyncData<CrmCustomer[]>('customers', () => $fetch('/api/customers'))
const { data: releases } = await useAsyncData<Release[]>('customer-release-options', () => $fetch('/api/releases'))

const customerStatuses = ['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned'] as const
const customerAccountTypes = ['internal', 'prospect', 'customer', 'partner', 'franchise'] as const
const customerStatusItems = [...customerStatuses]
const statusItems = ['All', ...customerStatuses]
const accountTypeItems = [
  { label: 'All accounts', value: 'all' },
  { label: 'Internal', value: 'internal' },
  { label: 'Prospects', value: 'prospect' },
  { label: 'Customers', value: 'customer' },
  { label: 'Partners / franchises', value: 'partners_franchises' }
]
const deploymentEnvironments = ['demo', 'staging', 'production', 'training'] as const
const deploymentStatuses = ['provisioning', 'active', 'maintenance', 'paused', 'retired', 'error'] as const
const deploymentHealthStatuses = ['unknown', 'healthy', 'degraded', 'down'] as const
const deploymentDeployStatuses = ['unknown', 'building', 'deployed', 'failed', 'rolled_back'] as const

const createSchema = z.object({
  name: z.string().min(2, 'Enter the practice name'),
  account_type: z.enum(customerAccountTypes),
  status: z.enum(customerStatuses),
  primary_domain: z.string().optional(),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  rex_supabase_url: z.string().optional(),
  recurring_monthly_amount: z.coerce.number().min(0, 'Monthly amount cannot be negative'),
  onboarding_fee: z.coerce.number().min(0, 'Onboarding fee cannot be negative'),
  tags: z.string().optional(),
  commercial_notes: z.string().optional()
})

const editSchema = z.object({
  name: z.string().min(2, 'Enter the practice name'),
  account_type: z.enum(customerAccountTypes),
  status: z.enum(customerStatuses),
  health_score: z.coerce.number().int().min(0).max(100),
  primary_domain: z.string().optional(),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  rex_supabase_url: z.string().optional(),
  recurring_monthly_amount: z.coerce.number().min(0, 'Monthly amount cannot be negative'),
  onboarding_fee: z.coerce.number().min(0, 'Onboarding fee cannot be negative'),
  tags: z.string().optional(),
  commercial_notes: z.string().optional()
})

const contactSchema = z.object({
  name: z.string().min(2, 'Enter the contact name'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.string().optional(),
  is_primary: z.boolean()
})

const branchSchema = z.object({
  name: z.string().min(2, 'Enter the branch name'),
  address: z.string().optional(),
  postcode: z.string().optional(),
  branch_code: z.string().optional(),
  status: z.enum(['planned', 'active', 'paused', 'closed'])
})

const deploymentSchema = z.object({
  name: z.string().min(2, 'Enter the deployment name'),
  environment: z.enum(deploymentEnvironments),
  status: z.enum(deploymentStatuses),
  health_status: z.enum(deploymentHealthStatuses),
  customer_identifier: z.string().optional(),
  rex_project_ref: z.string().optional(),
  supabase_url: z.string().url('Enter a valid Supabase URL').optional().or(z.literal('')),
  app_url: z.string().url('Enter a valid app URL').optional().or(z.literal('')),
  region: z.string().optional(),
  deployed_release_id: z.string().optional(),
  deployed_version: z.string().optional(),
  app_provider: z.string().optional(),
  app_provider_project: z.string().optional(),
  git_repo: z.string().optional(),
  git_branch: z.string().optional(),
  git_tag: z.string().optional(),
  git_commit: z.string().optional(),
  latest_migration_version: z.string().optional(),
  latest_migration_name: z.string().optional(),
  edge_functions_commit: z.string().optional(),
  deploy_status: z.enum(deploymentDeployStatuses),
  last_deployed_at: z.string().optional(),
  last_smoke_tested_at: z.string().optional(),
  is_primary: z.boolean(),
  notes: z.string().optional()
})

type CreateSchema = z.output<typeof createSchema>
type EditSchema = z.output<typeof editSchema>
type ContactSchema = z.output<typeof contactSchema>
type BranchSchema = z.output<typeof branchSchema>
type DeploymentSchema = z.output<typeof deploymentSchema>
type UiColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const createState = reactive<CreateSchema>({
  name: '',
  account_type: 'prospect',
  status: 'prospect',
  primary_domain: '',
  customer_identifier: '',
  rex_project_ref: '',
  rex_supabase_url: '',
  recurring_monthly_amount: 0,
  onboarding_fee: 0,
  tags: '',
  commercial_notes: ''
})

const editState = reactive<EditSchema>({
  name: '',
  account_type: 'prospect',
  status: 'prospect',
  health_score: 75,
  primary_domain: '',
  customer_identifier: '',
  rex_project_ref: '',
  rex_supabase_url: '',
  recurring_monthly_amount: 0,
  onboarding_fee: 0,
  tags: '',
  commercial_notes: ''
})

const contactState = reactive<ContactSchema>({
  name: '',
  email: '',
  phone: '',
  role: '',
  is_primary: false
})

const branchState = reactive<BranchSchema>({
  name: '',
  address: '',
  postcode: '',
  branch_code: '',
  status: 'active'
})

const contactEditState = reactive<ContactSchema>({
  name: '',
  email: '',
  phone: '',
  role: '',
  is_primary: false
})

const branchEditState = reactive<BranchSchema>({
  name: '',
  address: '',
  postcode: '',
  branch_code: '',
  status: 'active'
})

const deploymentState = reactive<DeploymentSchema>({
  name: '',
  environment: 'production',
  status: 'active',
  health_status: 'unknown',
  customer_identifier: '',
  rex_project_ref: '',
  supabase_url: '',
  app_url: '',
  region: 'eu-west-2',
  deployed_release_id: '',
  deployed_version: '',
  app_provider: '',
  app_provider_project: '',
  git_repo: '',
  git_branch: '',
  git_tag: '',
  git_commit: '',
  latest_migration_version: '',
  latest_migration_name: '',
  edge_functions_commit: '',
  deploy_status: 'unknown',
  last_deployed_at: '',
  last_smoke_tested_at: '',
  is_primary: false,
  notes: ''
})

const deploymentEditState = reactive<DeploymentSchema>({
  name: '',
  environment: 'production',
  status: 'active',
  health_status: 'unknown',
  customer_identifier: '',
  rex_project_ref: '',
  supabase_url: '',
  app_url: '',
  region: 'eu-west-2',
  deployed_release_id: '',
  deployed_version: '',
  app_provider: '',
  app_provider_project: '',
  git_repo: '',
  git_branch: '',
  git_tag: '',
  git_commit: '',
  latest_migration_version: '',
  latest_migration_name: '',
  edge_functions_commit: '',
  deploy_status: 'unknown',
  last_deployed_at: '',
  last_smoke_tested_at: '',
  is_primary: false,
  notes: ''
})

const currentCustomer = computed(() => customerDetail.value?.customer ?? null)
const currentContacts = computed(() => customerDetail.value?.contacts ?? [])
const currentBranches = computed(() => customerDetail.value?.branches ?? [])
const currentDeployments = computed(() => customerDetail.value?.deployments ?? [])
const currentTimeline = computed(() => customerDetail.value?.timeline ?? [])
const currentTickets = computed(() => customerDetail.value?.tickets ?? [])
const currentCharges = computed(() => customerDetail.value?.charges ?? [])
const currentOnboarding = computed(() => customerDetail.value?.onboarding ?? [])
const primaryDeployment = computed(() => currentDeployments.value.find(deployment => deployment.is_primary) ?? currentDeployments.value[0] ?? null)
const latestTicket = computed(() => currentTickets.value[0] ?? null)
const latestSignalAt = computed(() => primaryDeployment.value?.last_seen_at ?? latestTicket.value?.created_at ?? currentTimeline.value[0]?.occurred_at ?? null)
const activeTicketCount = computed(() => currentTickets.value.filter(ticket => !['resolved', 'closed'].includes(ticket.status)).length)
const urgentTicketCount = computed(() => currentTickets.value.filter(ticket => ['high', 'urgent'].includes(ticket.priority) && !['resolved', 'closed'].includes(ticket.status)).length)
const openCharges = computed(() => currentCharges.value.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)))
const openChargeTotal = computed(() => openCharges.value.reduce((sum, charge) => sum + Number(charge.amount), 0))
const activeOnboarding = computed(() => currentOnboarding.value.find(project => !['live', 'paused'].includes(project.status)) ?? currentOnboarding.value[0] ?? null)
const releaseItems = computed(() => [
  { label: 'No linked version', value: '' },
  ...(releases.value ?? []).map(release => ({
    label: `${release.version} - ${release.title}`,
    value: release.id
  }))
])

const filteredCustomers = computed(() => {
  const rows = customers.value ?? []
  return rows.filter((customer) => {
    const haystack = [
      customer.name,
      customer.primary_domain,
      customer.customer_identifier,
      customer.account_type,
      ...customer.tags
    ].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = !search.value || haystack.includes(search.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'All' || customer.status === statusFilter.value
    const matchesAccountType = accountTypeFilter.value === 'all'
      || customer.account_type === accountTypeFilter.value
      || (accountTypeFilter.value === 'partners_franchises' && ['partner', 'franchise'].includes(customer.account_type))
    return matchesSearch && matchesStatus && matchesAccountType
  })
})

const customerStats = computed(() => {
  const rows = customers.value ?? []
  const commercialRows = rows.filter(customer => customer.account_type !== 'internal')
  const monthly = commercialRows.reduce((sum, customer) => sum + Number(customer.recurring_monthly_amount), 0)
  const internal = rows.filter(customer => customer.account_type === 'internal').length
  const onboarding = rows.filter(customer => customer.status === 'onboarding').length
  const atRisk = rows.filter(customer => customer.status === 'at_risk').length
  const averageHealth = rows.length
    ? Math.round(rows.reduce((sum, customer) => sum + customer.health_score, 0) / rows.length)
    : 0

  return [{
    label: 'Customers',
    value: rows.length.toString(),
    detail: internal ? `${filteredCustomers.value.length} in view, ${internal} internal` : `${filteredCustomers.value.length} in view`,
    icon: 'i-lucide-building-2',
    color: 'primary' as const
  }, {
    label: 'Monthly ledger',
    value: `GBP ${monthly.toLocaleString('en-GB')}`,
    detail: 'Commercial accounts only',
    icon: 'i-lucide-banknote',
    color: 'success' as const
  }, {
    label: 'Onboarding',
    value: onboarding.toString(),
    detail: 'Active launches',
    icon: 'i-lucide-rocket',
    color: 'secondary' as const
  }, {
    label: 'Health',
    value: `${averageHealth}%`,
    detail: atRisk ? `${atRisk} customer needs attention` : 'No at-risk customers',
    icon: atRisk ? 'i-lucide-heart-pulse' : 'i-lucide-shield-check',
    color: atRisk ? 'warning' as const : 'success' as const
  }]
})

function statusColor(customerStatus: CrmCustomer['status']): UiColor {
  if (customerStatus === 'active') return 'success'
  if (customerStatus === 'onboarding') return 'secondary'
  if (customerStatus === 'at_risk') return 'warning'
  if (customerStatus === 'churned') return 'error'
  return 'neutral'
}

function accountTypeColor(accountType: CustomerAccountType): UiColor {
  if (accountType === 'internal') return 'info'
  if (accountType === 'customer') return 'success'
  if (accountType === 'partner') return 'secondary'
  if (accountType === 'franchise') return 'warning'
  return 'neutral'
}

function accountTypeLabel(accountType: CustomerAccountType) {
  return accountType.replaceAll('_', ' ')
}

function healthColor(score: number): UiColor {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

function formatCurrency(value: number) {
  return `GBP ${value.toLocaleString('en-GB', {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`
}

function deploymentStatusColor(status: CustomerDeployment['status']): UiColor {
  if (status === 'active') return 'success'
  if (status === 'provisioning' || status === 'maintenance') return 'warning'
  if (status === 'error') return 'error'
  return 'neutral'
}

function deploymentHealthColor(status: CustomerDeployment['health_status']): UiColor {
  if (status === 'healthy') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'down') return 'error'
  return 'neutral'
}

function deploymentDeployStatusColor(status: CustomerDeployment['deploy_status']): UiColor {
  if (status === 'deployed') return 'success'
  if (status === 'building') return 'warning'
  if (status === 'failed' || status === 'rolled_back') return 'error'
  return 'neutral'
}

const operationCards = computed<Array<{
  label: string
  value: string
  detail: string
  icon: string
  color: UiColor
}>>(() => [{
  label: 'Primary deployment',
  value: primaryDeployment.value?.environment ?? 'missing',
  detail: primaryDeployment.value?.rex_project_ref ?? 'Add Supabase project ref',
  icon: 'i-lucide-cloud',
  color: primaryDeployment.value ? deploymentHealthColor(primaryDeployment.value.health_status) : 'warning'
}, {
  label: 'Deployed version',
  value: primaryDeployment.value?.git_tag ?? primaryDeployment.value?.release?.version ?? primaryDeployment.value?.deployed_version ?? 'unknown',
  detail: primaryDeployment.value?.git_branch
    ? `${primaryDeployment.value.git_branch} @ ${primaryDeployment.value.git_commit ?? 'commit unknown'}`
    : primaryDeployment.value?.release?.title ?? primaryDeployment.value?.notes ?? 'Link a release or commit',
  icon: 'i-lucide-git-branch',
  color: primaryDeployment.value?.git_tag || primaryDeployment.value?.git_commit || primaryDeployment.value?.deployed_release_id || primaryDeployment.value?.deployed_version ? 'success' : 'neutral'
}, {
  label: 'Active tickets',
  value: activeTicketCount.value.toString(),
  detail: urgentTicketCount.value ? `${urgentTicketCount.value} high priority` : latestTicket.value?.subject ?? 'No active ticket pressure',
  icon: urgentTicketCount.value ? 'i-lucide-siren' : 'i-lucide-ticket-check',
  color: urgentTicketCount.value ? 'error' : activeTicketCount.value ? 'warning' : 'success'
}, {
  label: 'Open ledger',
  value: formatCurrency(openChargeTotal.value),
  detail: `${openCharges.value.length} open charge${openCharges.value.length === 1 ? '' : 's'}`,
  icon: 'i-lucide-receipt-text',
  color: openCharges.value.some(charge => charge.billing_status === 'overdue') ? 'error' : openCharges.value.length ? 'warning' : 'success'
}, {
  label: 'Onboarding',
  value: activeOnboarding.value?.status.replaceAll('_', ' ') ?? 'none',
  detail: activeOnboarding.value ? `${activeOnboarding.value.readiness_score}% readiness` : 'No launch project',
  icon: 'i-lucide-rocket',
  color: activeOnboarding.value?.status === 'blocked' ? 'error' : activeOnboarding.value ? 'primary' : 'neutral'
}, {
  label: 'Last signal',
  value: latestTicket.value?.rex_ticket_id ?? (latestSignalAt.value ? new Date(latestSignalAt.value).toLocaleDateString('en-GB') : 'none'),
  detail: latestSignalAt.value
    ? `${new Date(latestSignalAt.value).toLocaleString('en-GB')} - ${latestTicket.value?.subject ?? currentTimeline.value[0]?.title ?? 'Activity'}`
    : 'No recent activity',
  icon: 'i-lucide-radar',
  color: latestSignalAt.value ? 'success' : 'neutral'
}])

const attentionItems = computed(() => {
  const items: Array<{
    title: string
    detail: string
    icon: string
    color: 'error' | 'warning' | 'neutral' | 'primary' | 'success'
  }> = []

  if (!primaryDeployment.value) {
    items.push({
      title: 'No deployment attached',
      detail: 'Add the customer Supabase project before relying on webhook routing.',
      icon: 'i-lucide-cloud-off',
      color: 'warning'
    })
  } else {
    if (primaryDeployment.value.health_status === 'down' || primaryDeployment.value.status === 'error') {
      items.push({
        title: 'Deployment needs attention',
        detail: `${primaryDeployment.value.name} is marked ${primaryDeployment.value.health_status}/${primaryDeployment.value.status}.`,
        icon: 'i-lucide-triangle-alert',
        color: 'error'
      })
    }

    if (primaryDeployment.value.health_status === 'unknown') {
      items.push({
        title: 'Deployment health unknown',
        detail: 'The CRM has not seen a fresh signal from this environment yet.',
        icon: 'i-lucide-circle-help',
        color: 'neutral'
      })
    }

    if (!primaryDeployment.value.deployed_release_id && !primaryDeployment.value.deployed_version) {
      items.push({
        title: 'No deployed version linked',
        detail: 'Link a GitHub release, tag, or commit so rollout state is traceable.',
        icon: 'i-lucide-git-commit-horizontal',
        color: 'warning'
      })
    }

    if (!primaryDeployment.value.git_branch || !primaryDeployment.value.git_commit) {
      items.push({
        title: 'DevOps baseline incomplete',
        detail: 'Track the provider, branch, commit, and migration for this environment.',
        icon: 'i-lucide-git-pull-request',
        color: 'warning'
      })
    }
  }

  if (urgentTicketCount.value) {
    items.push({
      title: 'High priority support',
      detail: `${urgentTicketCount.value} open high-priority ticket${urgentTicketCount.value === 1 ? '' : 's'}.`,
      icon: 'i-lucide-siren',
      color: 'error'
    })
  }

  if (openCharges.value.some(charge => charge.billing_status === 'overdue')) {
    items.push({
      title: 'Overdue charge',
      detail: 'At least one ledger item is marked overdue.',
      icon: 'i-lucide-receipt',
      color: 'warning'
    })
  }

  if (activeOnboarding.value?.status === 'blocked') {
    items.push({
      title: 'Onboarding blocked',
      detail: activeOnboarding.value.blockers || 'A launch project is blocked.',
      icon: 'i-lucide-octagon-alert',
      color: 'error'
    })
  }

  return items
})

function resetDeploymentForm() {
  deploymentState.name = ''
  deploymentState.environment = 'production'
  deploymentState.status = 'active'
  deploymentState.health_status = 'unknown'
  deploymentState.customer_identifier = ''
  deploymentState.rex_project_ref = ''
  deploymentState.supabase_url = ''
  deploymentState.app_url = ''
  deploymentState.region = 'eu-west-2'
  deploymentState.deployed_release_id = ''
  deploymentState.deployed_version = ''
  deploymentState.app_provider = ''
  deploymentState.app_provider_project = ''
  deploymentState.git_repo = ''
  deploymentState.git_branch = ''
  deploymentState.git_tag = ''
  deploymentState.git_commit = ''
  deploymentState.latest_migration_version = ''
  deploymentState.latest_migration_name = ''
  deploymentState.edge_functions_commit = ''
  deploymentState.deploy_status = 'unknown'
  deploymentState.last_deployed_at = ''
  deploymentState.last_smoke_tested_at = ''
  deploymentState.is_primary = currentDeployments.value.length === 0
  deploymentState.notes = ''
}

function resetDeploymentEditForm() {
  editingDeploymentId.value = null
  deploymentEditState.name = ''
  deploymentEditState.environment = 'production'
  deploymentEditState.status = 'active'
  deploymentEditState.health_status = 'unknown'
  deploymentEditState.customer_identifier = ''
  deploymentEditState.rex_project_ref = ''
  deploymentEditState.supabase_url = ''
  deploymentEditState.app_url = ''
  deploymentEditState.region = 'eu-west-2'
  deploymentEditState.deployed_release_id = ''
  deploymentEditState.deployed_version = ''
  deploymentEditState.app_provider = ''
  deploymentEditState.app_provider_project = ''
  deploymentEditState.git_repo = ''
  deploymentEditState.git_branch = ''
  deploymentEditState.git_tag = ''
  deploymentEditState.git_commit = ''
  deploymentEditState.latest_migration_version = ''
  deploymentEditState.latest_migration_name = ''
  deploymentEditState.edge_functions_commit = ''
  deploymentEditState.deploy_status = 'unknown'
  deploymentEditState.last_deployed_at = ''
  deploymentEditState.last_smoke_tested_at = ''
  deploymentEditState.is_primary = false
  deploymentEditState.notes = ''
}

function openCreateDeployment() {
  resetDeploymentForm()
  createDeploymentOpen.value = true
}

function openEditDeployment(deployment: CustomerDeployment) {
  editingDeploymentId.value = deployment.id
  deploymentEditState.name = deployment.name
  deploymentEditState.environment = deployment.environment
  deploymentEditState.status = deployment.status
  deploymentEditState.health_status = deployment.health_status
  deploymentEditState.customer_identifier = deployment.customer_identifier || ''
  deploymentEditState.rex_project_ref = deployment.rex_project_ref || ''
  deploymentEditState.supabase_url = deployment.supabase_url || ''
  deploymentEditState.app_url = deployment.app_url || ''
  deploymentEditState.region = deployment.region || ''
  deploymentEditState.deployed_release_id = deployment.deployed_release_id || ''
  deploymentEditState.deployed_version = deployment.deployed_version || ''
  deploymentEditState.app_provider = deployment.app_provider || ''
  deploymentEditState.app_provider_project = deployment.app_provider_project || ''
  deploymentEditState.git_repo = deployment.git_repo || ''
  deploymentEditState.git_branch = deployment.git_branch || ''
  deploymentEditState.git_tag = deployment.git_tag || ''
  deploymentEditState.git_commit = deployment.git_commit || ''
  deploymentEditState.latest_migration_version = deployment.latest_migration_version || ''
  deploymentEditState.latest_migration_name = deployment.latest_migration_name || ''
  deploymentEditState.edge_functions_commit = deployment.edge_functions_commit || ''
  deploymentEditState.deploy_status = deployment.deploy_status || 'unknown'
  deploymentEditState.last_deployed_at = deployment.last_deployed_at || ''
  deploymentEditState.last_smoke_tested_at = deployment.last_smoke_tested_at || ''
  deploymentEditState.is_primary = deployment.is_primary
  deploymentEditState.notes = deployment.notes || ''
  editDeploymentOpen.value = true
}

function resetCreateForm() {
  createState.name = ''
  createState.account_type = 'prospect'
  createState.status = 'prospect'
  createState.primary_domain = ''
  createState.customer_identifier = ''
  createState.rex_project_ref = ''
  createState.rex_supabase_url = ''
  createState.recurring_monthly_amount = 0
  createState.onboarding_fee = 0
  createState.tags = ''
  createState.commercial_notes = ''
}

function resetContactForm() {
  contactState.name = ''
  contactState.email = ''
  contactState.phone = ''
  contactState.role = ''
  contactState.is_primary = false
}

function resetContactEditForm() {
  editingContactId.value = null
  contactEditState.name = ''
  contactEditState.email = ''
  contactEditState.phone = ''
  contactEditState.role = ''
  contactEditState.is_primary = false
}

function resetBranchForm() {
  branchState.name = ''
  branchState.address = ''
  branchState.postcode = ''
  branchState.branch_code = ''
  branchState.status = 'active'
}

function resetBranchEditForm() {
  editingBranchId.value = null
  branchEditState.name = ''
  branchEditState.address = ''
  branchEditState.postcode = ''
  branchEditState.branch_code = ''
  branchEditState.status = 'active'
}

function openEditContact(contact: CustomerContact) {
  editingContactId.value = contact.id
  contactEditState.name = contact.name
  contactEditState.email = contact.email || ''
  contactEditState.phone = contact.phone || ''
  contactEditState.role = contact.role || ''
  contactEditState.is_primary = contact.is_primary
  editContactOpen.value = true
}

function openEditBranch(branch: CustomerBranch) {
  editingBranchId.value = branch.id
  branchEditState.name = branch.name
  branchEditState.address = branch.address || ''
  branchEditState.postcode = branch.postcode || ''
  branchEditState.branch_code = branch.branch_code || ''
  branchEditState.status = branch.status
  editBranchOpen.value = true
}

function hydrateEditState(customer: CrmCustomer) {
  editState.name = customer.name
  editState.account_type = customer.account_type
  editState.status = customer.status
  editState.health_score = customer.health_score
  editState.primary_domain = customer.primary_domain || ''
  editState.customer_identifier = customer.customer_identifier || ''
  editState.rex_project_ref = customer.rex_project_ref || ''
  editState.rex_supabase_url = customer.rex_supabase_url || ''
  editState.recurring_monthly_amount = Number(customer.recurring_monthly_amount)
  editState.onboarding_fee = Number(customer.onboarding_fee)
  editState.tags = customer.tags.join(', ')
  editState.commercial_notes = customer.commercial_notes || ''
}

async function loadCustomerDetail(customerId: string) {
  detailLoading.value = true
  selectedCustomerId.value = customerId

  try {
    customerDetail.value = await $fetch<CustomerDetail>(`/api/customers/${customerId}`)
    hydrateEditState(customerDetail.value.customer)
  } catch (error) {
    toast.add({
      title: 'Could not load customer',
      description: error instanceof Error ? error.message : 'The customer record was not loaded.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    detailLoading.value = false
  }
}

async function openCustomer(customer: CrmCustomer) {
  detailOpen.value = true
  await loadCustomerDetail(customer.id)
}

watch([customers, () => route.query.customer], async ([rows, customerParam]) => {
  const customerId = typeof customerParam === 'string' ? customerParam : null
  if (!customerId || !rows?.length || selectedCustomerId.value === customerId) return

  const customer = rows.find(item => item.id === customerId)
  if (customer) {
    await openCustomer(customer)
  }
}, { immediate: true })

async function createCustomer(event: FormSubmitEvent<CreateSchema>) {
  saving.value = true

  try {
    await $fetch('/api/customers', {
      method: 'POST',
      body: {
        ...event.data,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        rex_supabase_url: event.data.rex_supabase_url || null,
        tags: event.data.tags
          ? event.data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : []
      }
    })

    toast.add({
      title: 'Customer created',
      description: `${event.data.name} is now in the CRM.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    createOpen.value = false
    resetCreateForm()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Could not create customer',
      description: error instanceof Error ? error.message : 'Check the local Supabase connection.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function updateCustomer(event: FormSubmitEvent<EditSchema>) {
  if (!selectedCustomerId.value) return

  detailSaving.value = true

  try {
    const updated = await $fetch<CrmCustomer>(`/api/customers/${selectedCustomerId.value}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        primary_domain: event.data.primary_domain || null,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        rex_supabase_url: event.data.rex_supabase_url || null,
        commercial_notes: event.data.commercial_notes || null,
        tags: event.data.tags
          ? event.data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : []
      }
    })

    if (customerDetail.value) {
      customerDetail.value.customer = updated
    }

    toast.add({
      title: 'Customer updated',
      description: `${updated.name} is up to date.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    await refresh()
  } catch (error) {
    toast.add({
      title: 'Could not update customer',
      description: error instanceof Error ? error.message : 'The customer was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    detailSaving.value = false
  }
}

async function createContact(event: FormSubmitEvent<ContactSchema>) {
  if (!selectedCustomerId.value) return

  contactSaving.value = true

  try {
    await $fetch(`/api/customers/${selectedCustomerId.value}/contacts`, {
      method: 'POST',
      body: {
        ...event.data,
        email: event.data.email || null,
        phone: event.data.phone || null,
        role: event.data.role || null
      }
    })

    resetContactForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Contact added',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not add contact',
      description: error instanceof Error ? error.message : 'The contact was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    contactSaving.value = false
  }
}

async function createBranch(event: FormSubmitEvent<BranchSchema>) {
  if (!selectedCustomerId.value) return

  branchSaving.value = true

  try {
    await $fetch(`/api/customers/${selectedCustomerId.value}/branches`, {
      method: 'POST',
      body: {
        ...event.data,
        address: event.data.address || null,
        postcode: event.data.postcode || null,
        branch_code: event.data.branch_code || null
      }
    })

    resetBranchForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Branch added',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not add branch',
      description: error instanceof Error ? error.message : 'The branch was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    branchSaving.value = false
  }
}

async function createDeployment(event: FormSubmitEvent<DeploymentSchema>) {
  if (!selectedCustomerId.value) return

  deploymentSaving.value = true

  try {
    await $fetch(`/api/customers/${selectedCustomerId.value}/deployments`, {
      method: 'POST',
      body: {
        ...event.data,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        supabase_url: event.data.supabase_url || null,
        app_url: event.data.app_url || null,
        region: event.data.region || null,
        deployed_release_id: event.data.deployed_release_id || null,
        deployed_version: event.data.deployed_version || null,
        app_provider: event.data.app_provider || null,
        app_provider_project: event.data.app_provider_project || null,
        git_repo: event.data.git_repo || null,
        git_branch: event.data.git_branch || null,
        git_tag: event.data.git_tag || null,
        git_commit: event.data.git_commit || null,
        latest_migration_version: event.data.latest_migration_version || null,
        latest_migration_name: event.data.latest_migration_name || null,
        edge_functions_commit: event.data.edge_functions_commit || null,
        deploy_status: event.data.deploy_status,
        last_deployed_at: event.data.last_deployed_at || null,
        last_smoke_tested_at: event.data.last_smoke_tested_at || null,
        notes: event.data.notes || null
      }
    })

    createDeploymentOpen.value = false
    resetDeploymentForm()
    await loadCustomerDetail(selectedCustomerId.value)
    await refresh()

    toast.add({
      title: 'Deployment added',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not add deployment',
      description: error instanceof Error ? error.message : 'The deployment was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    deploymentSaving.value = false
  }
}

async function updateContact(event: FormSubmitEvent<ContactSchema>) {
  if (!selectedCustomerId.value || !editingContactId.value) return

  contactEditSaving.value = true

  try {
    await $fetch(`/api/customers/contacts/${editingContactId.value}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        email: event.data.email || null,
        phone: event.data.phone || null,
        role: event.data.role || null
      }
    })

    editContactOpen.value = false
    resetContactEditForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Contact updated',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update contact',
      description: error instanceof Error ? error.message : 'The contact was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    contactEditSaving.value = false
  }
}

async function updateDeployment(event: FormSubmitEvent<DeploymentSchema>) {
  if (!selectedCustomerId.value || !editingDeploymentId.value) return

  deploymentEditSaving.value = true

  try {
    await $fetch(`/api/customers/deployments/${editingDeploymentId.value}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        customer_identifier: event.data.customer_identifier || null,
        rex_project_ref: event.data.rex_project_ref || null,
        supabase_url: event.data.supabase_url || null,
        app_url: event.data.app_url || null,
        region: event.data.region || null,
        deployed_release_id: event.data.deployed_release_id || null,
        deployed_version: event.data.deployed_version || null,
        app_provider: event.data.app_provider || null,
        app_provider_project: event.data.app_provider_project || null,
        git_repo: event.data.git_repo || null,
        git_branch: event.data.git_branch || null,
        git_tag: event.data.git_tag || null,
        git_commit: event.data.git_commit || null,
        latest_migration_version: event.data.latest_migration_version || null,
        latest_migration_name: event.data.latest_migration_name || null,
        edge_functions_commit: event.data.edge_functions_commit || null,
        deploy_status: event.data.deploy_status,
        last_deployed_at: event.data.last_deployed_at || null,
        last_smoke_tested_at: event.data.last_smoke_tested_at || null,
        notes: event.data.notes || null
      }
    })

    editDeploymentOpen.value = false
    resetDeploymentEditForm()
    await loadCustomerDetail(selectedCustomerId.value)
    await refresh()

    toast.add({
      title: 'Deployment updated',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update deployment',
      description: error instanceof Error ? error.message : 'The deployment was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    deploymentEditSaving.value = false
  }
}

async function deleteDeployment() {
  if (!selectedCustomerId.value || !editingDeploymentId.value) return

  deploymentEditSaving.value = true

  try {
    await $fetch(`/api/customers/deployments/${editingDeploymentId.value}`, {
      method: 'DELETE'
    })

    editDeploymentOpen.value = false
    resetDeploymentEditForm()
    await loadCustomerDetail(selectedCustomerId.value)
    await refresh()

    toast.add({
      title: 'Deployment removed',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not remove deployment',
      description: error instanceof Error ? error.message : 'The deployment was not removed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    deploymentEditSaving.value = false
  }
}

async function deleteContact() {
  if (!selectedCustomerId.value || !editingContactId.value) return

  contactEditSaving.value = true

  try {
    await $fetch(`/api/customers/contacts/${editingContactId.value}`, {
      method: 'DELETE'
    })

    editContactOpen.value = false
    resetContactEditForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Contact removed',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not remove contact',
      description: error instanceof Error ? error.message : 'The contact was not removed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    contactEditSaving.value = false
  }
}

async function updateBranch(event: FormSubmitEvent<BranchSchema>) {
  if (!selectedCustomerId.value || !editingBranchId.value) return

  branchEditSaving.value = true

  try {
    await $fetch(`/api/customers/branches/${editingBranchId.value}`, {
      method: 'PATCH',
      body: {
        ...event.data,
        address: event.data.address || null,
        postcode: event.data.postcode || null,
        branch_code: event.data.branch_code || null
      }
    })

    editBranchOpen.value = false
    resetBranchEditForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Branch updated',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not update branch',
      description: error instanceof Error ? error.message : 'The branch was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    branchEditSaving.value = false
  }
}

async function deleteBranch() {
  if (!selectedCustomerId.value || !editingBranchId.value) return

  branchEditSaving.value = true

  try {
    await $fetch(`/api/customers/branches/${editingBranchId.value}`, {
      method: 'DELETE'
    })

    editBranchOpen.value = false
    resetBranchEditForm()
    await loadCustomerDetail(selectedCustomerId.value)

    toast.add({
      title: 'Branch removed',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not remove branch',
      description: error instanceof Error ? error.message : 'The branch was not removed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    branchEditSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Customer"
            @click="createOpen = true"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search customers..."
            class="w-64"
          />
          <USelect v-model="accountTypeFilter" :items="accountTypeItems" class="w-52" />
          <USelect v-model="statusFilter" :items="statusItems" class="w-44" />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            @click="refresh()"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="metric in customerStats"
          :key="metric.label"
          class="rounded-lg border border-default bg-default p-4 shadow-xs"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted">
                {{ metric.label }}
              </p>
              <p class="mt-2 text-2xl font-semibold text-highlighted">
                {{ metric.value }}
              </p>
              <p class="mt-1 truncate text-sm text-muted">
                {{ metric.detail }}
              </p>
            </div>
            <UBadge :color="metric.color" variant="subtle" square>
              <UIcon :name="metric.icon" class="size-4" />
            </UBadge>
          </div>
        </div>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-3">
        <UCard
          v-for="customer in filteredCustomers"
          :key="customer.id"
          :ui="{ root: 'rounded-lg transition hover:ring-2 hover:ring-primary/20', body: 'p-4 sm:p-4' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ customer.name }}
              </p>
              <p class="mt-1 truncate text-sm text-muted">
                {{ customer.primary_domain || 'No domain recorded' }}
              </p>
              <p v-if="customer.customer_identifier" class="mt-1 truncate text-xs text-muted">
                {{ customer.customer_identifier }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap justify-end gap-2">
              <UBadge :label="accountTypeLabel(customer.account_type)" :color="accountTypeColor(customer.account_type)" variant="subtle" />
              <UBadge :label="customer.status.replaceAll('_', ' ')" :color="statusColor(customer.status)" variant="subtle" />
            </div>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-muted">
                Health
              </p>
              <p class="font-medium text-highlighted">
                {{ customer.health_score }}%
              </p>
              <UProgress
                :model-value="customer.health_score"
                :color="healthColor(customer.health_score)"
                size="xs"
                class="mt-2"
              />
            </div>
            <div>
              <p class="text-muted">
                Monthly
              </p>
              <p class="font-medium text-highlighted">
                GBP {{ customer.recurring_monthly_amount.toLocaleString('en-GB') }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge
              v-for="tag in customer.tags"
              :key="tag"
              :label="tag"
              color="neutral"
              variant="outline"
            />
          </div>

          <div class="mt-5 flex items-center justify-between border-t border-default pt-3">
            <p class="text-xs text-muted">
              Updated {{ new Date(customer.updated_at).toLocaleDateString('en-GB') }}
            </p>
            <UButton
              icon="i-lucide-panel-right-open"
              label="Open"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openCustomer(customer)"
            />
          </div>
        </UCard>
      </div>

      <UAlert
        v-if="!filteredCustomers.length && status !== 'pending'"
        class="mt-5"
        icon="i-lucide-search-x"
        color="neutral"
        title="No customers match that view"
        description="Clear the search or change the status filter."
      />

      <UModal
        v-model:open="createOpen"
        title="New customer"
        description="Add a practice to the Rex CRM."
      >
        <template #body>
          <UForm
            id="create-customer"
            :schema="createSchema"
            :state="createState"
            class="space-y-4"
            @submit="createCustomer"
          >
            <UFormField label="Practice name" name="name" required>
              <UInput
                v-model="createState.name"
                placeholder="Abbey Road Opticians"
                class="w-full"
              />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Account type" name="account_type">
                <USelect
                  v-model="createState.account_type"
                  :items="[...customerAccountTypes]"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Status" name="status">
                <USelect
                  v-model="createState.status"
                  :items="customerStatusItems"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Domain" name="primary_domain">
                <UInput
                  v-model="createState.primary_domain"
                  placeholder="practice.example"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Customer identifier" name="customer_identifier">
                <UInput
                  v-model="createState.customer_identifier"
                  placeholder="cecil-amey"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Rex project ref" name="rex_project_ref">
                <UInput
                  v-model="createState.rex_project_ref"
                  placeholder="cqvrjkaarnlcibwqgnpn"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Rex Supabase URL" name="rex_supabase_url">
                <UInput
                  v-model="createState.rex_supabase_url"
                  placeholder="https://project.supabase.co"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Monthly amount" name="recurring_monthly_amount">
                <UInputNumber
                  v-model="createState.recurring_monthly_amount"
                  :min="0"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Onboarding fee" name="onboarding_fee">
                <UInputNumber
                  v-model="createState.onboarding_fee"
                  :min="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Tags" name="tags">
              <UInput
                v-model="createState.tags"
                placeholder="onboarding, priority"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Commercial notes" name="commercial_notes">
              <UTextarea
                v-model="createState.commercial_notes"
                :rows="4"
                autoresize
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="createOpen = false"
              />
              <UButton
                label="Create customer"
                icon="i-lucide-check"
                type="submit"
                :loading="saving"
              />
            </div>
          </UForm>
        </template>
      </UModal>

      <UModal
        v-model:open="createDeploymentOpen"
        title="New deployment"
        description="Add a Rex environment for this customer."
        :ui="{ overlay: 'z-[90]', content: 'z-[91]' }"
      >
        <template #body>
          <UForm
            id="create-deployment"
            :schema="deploymentSchema"
            :state="deploymentState"
            class="space-y-4"
            @submit="createDeployment"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Name" name="name" required>
                <UInput v-model="deploymentState.name" placeholder="Rex staging" class="w-full" />
              </UFormField>
              <UFormField label="Environment" name="environment">
                <USelect v-model="deploymentState.environment" :items="[...deploymentEnvironments]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Status" name="status">
                <USelect v-model="deploymentState.status" :items="[...deploymentStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Health" name="health_status">
                <USelect v-model="deploymentState.health_status" :items="[...deploymentHealthStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Region" name="region">
                <UInput v-model="deploymentState.region" placeholder="eu-west-2" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Customer identifier" name="customer_identifier">
                <UInput v-model="deploymentState.customer_identifier" placeholder="rex-app-stagging" class="w-full" />
              </UFormField>
              <UFormField label="Supabase ref" name="rex_project_ref">
                <UInput v-model="deploymentState.rex_project_ref" placeholder="cqvrjkaarnlcibwqgnpn" class="w-full" />
              </UFormField>
              <UFormField label="Supabase URL" name="supabase_url">
                <UInput v-model="deploymentState.supabase_url" placeholder="https://project.supabase.co" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="App URL" name="app_url">
                <UInput v-model="deploymentState.app_url" placeholder="https://rexapp.co.uk" class="w-full" />
              </UFormField>
              <UFormField label="Linked version" name="deployed_release_id">
                <USelect v-model="deploymentState.deployed_release_id" :items="releaseItems" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Version label" name="deployed_version">
              <UInput v-model="deploymentState.deployed_version" placeholder="commit-87a328e" class="w-full" />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="App provider" name="app_provider">
                <UInput v-model="deploymentState.app_provider" placeholder="AWS Amplify" class="w-full" />
              </UFormField>
              <UFormField label="Provider project" name="app_provider_project">
                <UInput v-model="deploymentState.app_provider_project" placeholder="Amplify app/environment" class="w-full" />
              </UFormField>
              <UFormField label="Deploy status" name="deploy_status">
                <USelect v-model="deploymentState.deploy_status" :items="[...deploymentDeployStatuses]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Git repo" name="git_repo">
                <UInput v-model="deploymentState.git_repo" placeholder="optomdev/Rex" class="w-full" />
              </UFormField>
              <UFormField label="Git branch" name="git_branch">
                <UInput v-model="deploymentState.git_branch" placeholder="staging" class="w-full" />
              </UFormField>
              <UFormField label="Git tag" name="git_tag">
                <UInput v-model="deploymentState.git_tag" placeholder="v1.0.0-staging.1" class="w-full" />
              </UFormField>
              <UFormField label="Git commit" name="git_commit">
                <UInput v-model="deploymentState.git_commit" placeholder="8e929be" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Latest migration" name="latest_migration_version">
                <UInput v-model="deploymentState.latest_migration_version" placeholder="20260529101702" class="w-full" />
              </UFormField>
              <UFormField label="Migration name" name="latest_migration_name">
                <UInput v-model="deploymentState.latest_migration_name" placeholder="harden_recurring_exception_rpc_permission" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Edge Functions commit" name="edge_functions_commit">
                <UInput v-model="deploymentState.edge_functions_commit" placeholder="8e929be" class="w-full" />
              </UFormField>
              <UFormField label="Last deployed at" name="last_deployed_at">
                <UInput v-model="deploymentState.last_deployed_at" placeholder="2026-05-29T10:30:00.000Z" class="w-full" />
              </UFormField>
              <UFormField label="Smoke tested at" name="last_smoke_tested_at">
                <UInput v-model="deploymentState.last_smoke_tested_at" placeholder="2026-05-29T10:45:00.000Z" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="deploymentState.notes"
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>

            <div class="flex items-center justify-between gap-3">
              <UCheckbox v-model="deploymentState.is_primary" label="Primary deployment" />
              <div class="flex justify-end gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="createDeploymentOpen = false"
                />
                <UButton
                  label="Add deployment"
                  icon="i-lucide-check"
                  type="submit"
                  :loading="deploymentSaving"
                />
              </div>
            </div>
          </UForm>
        </template>
      </UModal>

      <UModal
        v-model:open="editDeploymentOpen"
        title="Edit deployment"
        description="Update the Supabase project and version tracking for this environment."
        :ui="{ overlay: 'z-[90]', content: 'z-[91]' }"
      >
        <template #body>
          <UForm
            id="edit-deployment"
            :schema="deploymentSchema"
            :state="deploymentEditState"
            class="space-y-4"
            @submit="updateDeployment"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Name" name="name" required>
                <UInput v-model="deploymentEditState.name" class="w-full" />
              </UFormField>
              <UFormField label="Environment" name="environment">
                <USelect v-model="deploymentEditState.environment" :items="[...deploymentEnvironments]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Status" name="status">
                <USelect v-model="deploymentEditState.status" :items="[...deploymentStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Health" name="health_status">
                <USelect v-model="deploymentEditState.health_status" :items="[...deploymentHealthStatuses]" class="w-full" />
              </UFormField>
              <UFormField label="Region" name="region">
                <UInput v-model="deploymentEditState.region" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Customer identifier" name="customer_identifier">
                <UInput v-model="deploymentEditState.customer_identifier" class="w-full" />
              </UFormField>
              <UFormField label="Supabase ref" name="rex_project_ref">
                <UInput v-model="deploymentEditState.rex_project_ref" class="w-full" />
              </UFormField>
              <UFormField label="Supabase URL" name="supabase_url">
                <UInput v-model="deploymentEditState.supabase_url" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="App URL" name="app_url">
                <UInput v-model="deploymentEditState.app_url" class="w-full" />
              </UFormField>
              <UFormField label="Linked version" name="deployed_release_id">
                <USelect v-model="deploymentEditState.deployed_release_id" :items="releaseItems" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Version label" name="deployed_version">
              <UInput v-model="deploymentEditState.deployed_version" class="w-full" />
            </UFormField>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="App provider" name="app_provider">
                <UInput v-model="deploymentEditState.app_provider" class="w-full" />
              </UFormField>
              <UFormField label="Provider project" name="app_provider_project">
                <UInput v-model="deploymentEditState.app_provider_project" class="w-full" />
              </UFormField>
              <UFormField label="Deploy status" name="deploy_status">
                <USelect v-model="deploymentEditState.deploy_status" :items="[...deploymentDeployStatuses]" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-4">
              <UFormField label="Git repo" name="git_repo">
                <UInput v-model="deploymentEditState.git_repo" class="w-full" />
              </UFormField>
              <UFormField label="Git branch" name="git_branch">
                <UInput v-model="deploymentEditState.git_branch" class="w-full" />
              </UFormField>
              <UFormField label="Git tag" name="git_tag">
                <UInput v-model="deploymentEditState.git_tag" class="w-full" />
              </UFormField>
              <UFormField label="Git commit" name="git_commit">
                <UInput v-model="deploymentEditState.git_commit" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Latest migration" name="latest_migration_version">
                <UInput v-model="deploymentEditState.latest_migration_version" class="w-full" />
              </UFormField>
              <UFormField label="Migration name" name="latest_migration_name">
                <UInput v-model="deploymentEditState.latest_migration_name" class="w-full" />
              </UFormField>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <UFormField label="Edge Functions commit" name="edge_functions_commit">
                <UInput v-model="deploymentEditState.edge_functions_commit" class="w-full" />
              </UFormField>
              <UFormField label="Last deployed at" name="last_deployed_at">
                <UInput v-model="deploymentEditState.last_deployed_at" placeholder="2026-05-29T10:30:00.000Z" class="w-full" />
              </UFormField>
              <UFormField label="Smoke tested at" name="last_smoke_tested_at">
                <UInput v-model="deploymentEditState.last_smoke_tested_at" placeholder="2026-05-29T10:45:00.000Z" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="deploymentEditState.notes"
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>

            <div class="flex items-center justify-between gap-3">
              <UCheckbox v-model="deploymentEditState.is_primary" label="Primary deployment" />
              <div class="flex justify-end gap-2">
                <UButton
                  label="Delete"
                  color="error"
                  variant="subtle"
                  :loading="deploymentEditSaving"
                  @click="deleteDeployment"
                />
                <UButton
                  label="Save"
                  icon="i-lucide-save"
                  type="submit"
                  :loading="deploymentEditSaving"
                />
              </div>
            </div>
          </UForm>
        </template>
      </UModal>

      <USlideover
        v-model:open="detailOpen"
        :title="currentCustomer?.name || 'Customer detail'"
        :description="currentCustomer?.customer_identifier || currentCustomer?.primary_domain || 'CRM customer'"
        :ui="{ content: 'sm:max-w-4xl' }"
      >
        <template #body>
          <div v-if="detailLoading" class="space-y-3">
            <USkeleton class="h-24 w-full" />
            <USkeleton class="h-32 w-full" />
            <USkeleton class="h-32 w-full" />
          </div>

          <div v-else-if="currentCustomer" class="space-y-6">
            <section class="rounded-lg border border-default bg-elevated p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-base font-semibold text-highlighted">
                      Operations
                    </h3>
                    <UBadge
                      :label="accountTypeLabel(currentCustomer.account_type)"
                      :color="accountTypeColor(currentCustomer.account_type)"
                      variant="subtle"
                    />
                    <UBadge
                      :label="currentCustomer.status.replaceAll('_', ' ')"
                      :color="statusColor(currentCustomer.status)"
                      variant="subtle"
                    />
                    <UBadge
                      v-if="primaryDeployment"
                      :label="primaryDeployment.environment"
                      color="neutral"
                      variant="outline"
                    />
                  </div>
                  <p class="mt-1 truncate text-sm text-muted">
                    {{ primaryDeployment?.name || 'No primary deployment' }}
                    <span v-if="primaryDeployment?.supabase_url"> - {{ primaryDeployment.supabase_url }}</span>
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="primaryDeployment?.app_url"
                    :to="primaryDeployment.app_url"
                    target="_blank"
                    icon="i-lucide-external-link"
                    label="Open Rex"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    label="Deployment"
                    size="sm"
                    @click="openCreateDeployment"
                  />
                </div>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="card in operationCards"
                  :key="card.label"
                  class="rounded-md border border-default bg-default p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-xs uppercase text-muted">
                        {{ card.label }}
                      </p>
                      <p class="mt-2 truncate text-lg font-semibold text-highlighted">
                        {{ card.value }}
                      </p>
                      <p class="mt-1 truncate text-sm text-muted">
                        {{ card.detail }}
                      </p>
                    </div>
                    <UBadge :color="card.color" variant="subtle" square>
                      <UIcon :name="card.icon" class="size-4" />
                    </UBadge>
                  </div>
                </div>
              </div>

              <div v-if="attentionItems.length" class="mt-4 grid gap-2 md:grid-cols-2">
                <div
                  v-for="item in attentionItems"
                  :key="item.title"
                  class="flex items-start gap-3 rounded-md border border-default bg-default p-3"
                >
                  <UBadge :color="item.color" variant="subtle" square>
                    <UIcon :name="item.icon" class="size-4" />
                  </UBadge>
                  <div class="min-w-0">
                    <p class="font-medium text-highlighted">
                      {{ item.title }}
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      {{ item.detail }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div class="grid gap-3 md:grid-cols-5">
              <div class="rounded-lg border border-default p-4">
                <p class="text-sm text-muted">
                  Health
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ currentCustomer.health_score }}%
                </p>
                <UProgress
                  :model-value="currentCustomer.health_score"
                  :color="healthColor(currentCustomer.health_score)"
                  size="xs"
                  class="mt-2"
                />
              </div>
              <div class="rounded-lg border border-default p-4">
                <p class="text-sm text-muted">
                  Tickets
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ currentTickets.length }}
                </p>
              </div>
              <div class="rounded-lg border border-default p-4">
                <p class="text-sm text-muted">
                  Deployments
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ currentDeployments.length }}
                </p>
              </div>
              <div class="rounded-lg border border-default p-4">
                <p class="text-sm text-muted">
                  Branches
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ currentBranches.length }}
                </p>
              </div>
              <div class="rounded-lg border border-default p-4">
                <p class="text-sm text-muted">
                  Open Charges
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ currentCharges.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status)).length }}
                </p>
              </div>
            </div>

            <UForm
              :schema="editSchema"
              :state="editState"
              class="space-y-4 rounded-lg border border-default p-4"
              @submit="updateCustomer"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="font-semibold text-highlighted">
                    Customer Record
                  </h3>
                  <p class="text-sm text-muted">
                    Practice, deployment, and commercial details.
                  </p>
                </div>
                <UButton
                  label="Save"
                  icon="i-lucide-save"
                  type="submit"
                  :loading="detailSaving"
                />
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <UFormField label="Practice name" name="name">
                  <UInput v-model="editState.name" class="w-full" />
                </UFormField>

                <UFormField label="Account type" name="account_type">
                  <USelect v-model="editState.account_type" :items="[...customerAccountTypes]" class="w-full" />
                </UFormField>

                <UFormField label="Status" name="status">
                  <USelect v-model="editState.status" :items="customerStatusItems" class="w-full" />
                </UFormField>
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <UFormField label="Customer identifier" name="customer_identifier">
                  <UInput v-model="editState.customer_identifier" class="w-full" />
                </UFormField>

                <UFormField label="Rex project ref" name="rex_project_ref">
                  <UInput v-model="editState.rex_project_ref" class="w-full" />
                </UFormField>

                <UFormField label="Rex Supabase URL" name="rex_supabase_url">
                  <UInput v-model="editState.rex_supabase_url" class="w-full" />
                </UFormField>
              </div>

              <div class="grid gap-4 sm:grid-cols-4">
                <UFormField label="Domain" name="primary_domain">
                  <UInput v-model="editState.primary_domain" class="w-full" />
                </UFormField>

                <UFormField label="Health" name="health_score">
                  <UInputNumber
                    v-model="editState.health_score"
                    :min="0"
                    :max="100"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Monthly" name="recurring_monthly_amount">
                  <UInputNumber v-model="editState.recurring_monthly_amount" :min="0" class="w-full" />
                </UFormField>

                <UFormField label="Onboarding fee" name="onboarding_fee">
                  <UInputNumber v-model="editState.onboarding_fee" :min="0" class="w-full" />
                </UFormField>
              </div>

              <UFormField label="Tags" name="tags">
                <UInput v-model="editState.tags" class="w-full" />
              </UFormField>

              <UFormField label="Commercial notes" name="commercial_notes">
                <UTextarea
                  v-model="editState.commercial_notes"
                  :rows="3"
                  autoresize
                  class="w-full"
                />
              </UFormField>
            </UForm>

            <section class="space-y-3 rounded-lg border border-default p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="font-semibold text-highlighted">
                    Deployments
                  </h3>
                  <p class="text-sm text-muted">
                    Supabase Cloud projects and Rex environments for this customer.
                  </p>
                </div>
                <UButton
                  label="Deployment"
                  icon="i-lucide-plus"
                  size="sm"
                  @click="openCreateDeployment"
                />
              </div>

              <div v-if="currentDeployments.length" class="grid gap-3 lg:grid-cols-2">
                <div
                  v-for="deployment in currentDeployments"
                  :key="deployment.id"
                  class="rounded-md border border-default bg-elevated p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium text-highlighted">
                          {{ deployment.name }}
                        </p>
                        <UBadge
                          v-if="deployment.is_primary"
                          label="Primary"
                          color="primary"
                          variant="subtle"
                        />
                      </div>
                      <p class="mt-1 truncate text-sm text-muted">
                        {{ deployment.supabase_url || deployment.app_url || 'No endpoint recorded' }}
                      </p>
                    </div>
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Edit deployment"
                      @click="openEditDeployment(deployment)"
                    />
                  </div>

                  <div class="mt-3 flex flex-wrap gap-2">
                    <UBadge :label="deployment.environment" color="neutral" variant="outline" />
                    <UBadge :label="deployment.status" :color="deploymentStatusColor(deployment.status)" variant="subtle" />
                    <UBadge :label="deployment.health_status" :color="deploymentHealthColor(deployment.health_status)" variant="subtle" />
                    <UBadge :label="deployment.deploy_status.replaceAll('_', ' ')" :color="deploymentDeployStatusColor(deployment.deploy_status)" variant="subtle" />
                  </div>

                  <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt class="text-muted">
                        Project ref
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.rex_project_ref || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Version
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.release?.version || deployment.deployed_version || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Provider
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.app_provider || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Branch
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.git_branch || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Tag / commit
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.git_tag || deployment.git_commit || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Latest migration
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.latest_migration_version || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Edge Functions
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.edge_functions_commit || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Identifier
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.customer_identifier || 'Not set' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted">
                        Last seen
                      </dt>
                      <dd class="truncate font-medium text-highlighted">
                        {{ deployment.last_seen_at ? new Date(deployment.last_seen_at).toLocaleString('en-GB') : 'Not seen yet' }}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <UAlert
                v-else
                icon="i-lucide-cloud"
                color="neutral"
                variant="subtle"
                title="No deployments yet"
                description="Add the Supabase project for this practice before relying on webhook routing."
              />
            </section>

            <div class="grid gap-4 xl:grid-cols-2">
              <section class="space-y-3 rounded-lg border border-default p-4">
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-highlighted">
                    Contacts
                  </h3>
                  <UBadge :label="currentContacts.length.toString()" color="neutral" variant="outline" />
                </div>

                <div v-if="currentContacts.length" class="space-y-2">
                  <div
                    v-for="contact in currentContacts"
                    :key="contact.id"
                    class="rounded-md bg-elevated px-3 py-2"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="font-medium text-highlighted">
                        {{ contact.name }}
                      </p>
                      <div class="flex items-center gap-1">
                        <UBadge
                          v-if="contact.is_primary"
                          label="Primary"
                          color="success"
                          variant="subtle"
                        />
                        <UButton
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          aria-label="Edit contact"
                          @click="openEditContact(contact)"
                        />
                      </div>
                    </div>
                    <p class="mt-1 text-sm text-muted">
                      {{ contact.role || 'No role' }} - {{ contact.email || 'No email' }}
                    </p>
                    <p v-if="contact.phone" class="mt-1 text-xs text-muted">
                      {{ contact.phone }}
                    </p>
                  </div>
                </div>

                <UForm
                  :schema="contactSchema"
                  :state="contactState"
                  class="space-y-3"
                  @submit="createContact"
                >
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField label="Name" name="name">
                      <UInput v-model="contactState.name" class="w-full" />
                    </UFormField>
                    <UFormField label="Role" name="role">
                      <UInput v-model="contactState.role" class="w-full" />
                    </UFormField>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField label="Email" name="email">
                      <UInput v-model="contactState.email" type="email" class="w-full" />
                    </UFormField>
                    <UFormField label="Phone" name="phone">
                      <UInput v-model="contactState.phone" class="w-full" />
                    </UFormField>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <UCheckbox v-model="contactState.is_primary" label="Primary contact" />
                    <UButton
                      label="Add contact"
                      icon="i-lucide-plus"
                      type="submit"
                      :loading="contactSaving"
                    />
                  </div>
                </UForm>
              </section>

              <section class="space-y-3 rounded-lg border border-default p-4">
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-highlighted">
                    Branches
                  </h3>
                  <UBadge :label="currentBranches.length.toString()" color="neutral" variant="outline" />
                </div>

                <div v-if="currentBranches.length" class="space-y-2">
                  <div
                    v-for="branch in currentBranches"
                    :key="branch.id"
                    class="rounded-md bg-elevated px-3 py-2"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="font-medium text-highlighted">
                        {{ branch.name }}
                      </p>
                      <div class="flex items-center gap-1">
                        <UBadge :label="branch.status" :color="branch.status === 'active' ? 'success' : 'neutral'" variant="subtle" />
                        <UButton
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          aria-label="Edit branch"
                          @click="openEditBranch(branch)"
                        />
                      </div>
                    </div>
                    <p class="mt-1 text-sm text-muted">
                      {{ branch.branch_code || 'No code' }} - {{ branch.postcode || 'No postcode' }}
                    </p>
                    <p v-if="branch.address" class="mt-1 text-xs text-muted">
                      {{ branch.address }}
                    </p>
                  </div>
                </div>

                <UForm
                  :schema="branchSchema"
                  :state="branchState"
                  class="space-y-3"
                  @submit="createBranch"
                >
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField label="Name" name="name">
                      <UInput v-model="branchState.name" class="w-full" />
                    </UFormField>
                    <UFormField label="Status" name="status">
                      <USelect v-model="branchState.status" :items="['planned', 'active', 'paused', 'closed']" class="w-full" />
                    </UFormField>
                  </div>
                  <UFormField label="Address" name="address">
                    <UInput v-model="branchState.address" class="w-full" />
                  </UFormField>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField label="Postcode" name="postcode">
                      <UInput v-model="branchState.postcode" class="w-full" />
                    </UFormField>
                    <UFormField label="Branch code" name="branch_code">
                      <UInput v-model="branchState.branch_code" class="w-full" />
                    </UFormField>
                  </div>
                  <div class="flex justify-end">
                    <UButton
                      label="Add branch"
                      icon="i-lucide-plus"
                      type="submit"
                      :loading="branchSaving"
                    />
                  </div>
                </UForm>
              </section>
            </div>

            <section class="space-y-3 rounded-lg border border-default p-4">
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-highlighted">
                  Recent Activity
                </h3>
                <UButton
                  to="/timeline"
                  label="Timeline"
                  icon="i-lucide-arrow-right"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                />
              </div>

              <div v-if="currentTimeline.length" class="space-y-2">
                <div
                  v-for="item in currentTimeline"
                  :key="item.id"
                  class="flex items-start justify-between gap-3 rounded-md bg-elevated px-3 py-2 text-sm"
                >
                  <div class="min-w-0">
                    <p class="font-medium text-highlighted">
                      {{ item.title }}
                    </p>
                    <p class="truncate text-muted">
                      {{ item.body }}
                    </p>
                  </div>
                  <span class="shrink-0 text-xs text-muted">{{ new Date(item.occurred_at).toLocaleDateString('en-GB') }}</span>
                </div>
              </div>

              <UAlert
                v-else
                icon="i-lucide-history"
                color="neutral"
                title="No customer activity yet"
                description="Tickets, onboarding, charges, and release rollout changes will appear here."
              />
            </section>
          </div>
        </template>
      </USlideover>

      <UModal
        v-model:open="editContactOpen"
        title="Edit contact"
        description="Maintain practice contact details."
      >
        <template #body>
          <UForm
            :schema="contactSchema"
            :state="contactEditState"
            class="space-y-4"
            @submit="updateContact"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Name" name="name">
                <UInput v-model="contactEditState.name" class="w-full" />
              </UFormField>
              <UFormField label="Role" name="role">
                <UInput v-model="contactEditState.role" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Email" name="email">
                <UInput v-model="contactEditState.email" type="email" class="w-full" />
              </UFormField>
              <UFormField label="Phone" name="phone">
                <UInput v-model="contactEditState.phone" class="w-full" />
              </UFormField>
            </div>
            <UCheckbox v-model="contactEditState.is_primary" label="Primary contact" />
            <div class="flex justify-between gap-2">
              <UButton
                label="Remove"
                icon="i-lucide-trash-2"
                color="error"
                variant="subtle"
                :loading="contactEditSaving"
                @click="deleteContact"
              />
              <div class="flex gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="editContactOpen = false"
                />
                <UButton
                  label="Save contact"
                  icon="i-lucide-save"
                  type="submit"
                  :loading="contactEditSaving"
                />
              </div>
            </div>
          </UForm>
        </template>
      </UModal>

      <UModal
        v-model:open="editBranchOpen"
        title="Edit branch"
        description="Maintain practice branch details."
      >
        <template #body>
          <UForm
            :schema="branchSchema"
            :state="branchEditState"
            class="space-y-4"
            @submit="updateBranch"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Name" name="name">
                <UInput v-model="branchEditState.name" class="w-full" />
              </UFormField>
              <UFormField label="Status" name="status">
                <USelect v-model="branchEditState.status" :items="['planned', 'active', 'paused', 'closed']" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Address" name="address">
              <UInput v-model="branchEditState.address" class="w-full" />
            </UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Postcode" name="postcode">
                <UInput v-model="branchEditState.postcode" class="w-full" />
              </UFormField>
              <UFormField label="Branch code" name="branch_code">
                <UInput v-model="branchEditState.branch_code" class="w-full" />
              </UFormField>
            </div>
            <div class="flex justify-between gap-2">
              <UButton
                label="Remove"
                icon="i-lucide-trash-2"
                color="error"
                variant="subtle"
                :loading="branchEditSaving"
                @click="deleteBranch"
              />
              <div class="flex gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="subtle"
                  @click="editBranchOpen = false"
                />
                <UButton
                  label="Save branch"
                  icon="i-lucide-save"
                  type="submit"
                  :loading="branchEditSaving"
                />
              </div>
            </div>
          </UForm>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
