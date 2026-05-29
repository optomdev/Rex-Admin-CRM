import type { AvatarProps } from '@nuxt/ui'

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export type CustomerStatus = 'prospect' | 'onboarding' | 'active' | 'at_risk' | 'paused' | 'churned'
export type CustomerAccountType = 'internal' | 'prospect' | 'customer' | 'partner' | 'franchise'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'new' | 'triage' | 'waiting_on_customer' | 'in_progress' | 'blocked' | 'resolved' | 'closed'
export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type OnboardingStatus = 'planning' | 'in_progress' | 'ready_for_go_live' | 'live' | 'blocked' | 'paused'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked'
export type ComplianceDocumentStatus = 'not_started' | 'draft' | 'evidence_pending' | 'ready_for_review' | 'approved' | 'blocked'
export type ComplianceEvidenceType = 'source_document' | 'supporting_evidence' | 'review_note' | 'screenshot' | 'signed_approval'
export type ChargeStatus = 'draft' | 'open' | 'invoice_sent' | 'paid' | 'overdue' | 'void'
export type ChargeType = 'monthly' | 'onboarding' | 'ad_hoc' | 'credit'
export type RolloutStatus = 'not_started' | 'scheduled' | 'deployed' | 'blocked' | 'rolled_back'
export type DeploymentEnvironment = 'demo' | 'staging' | 'production' | 'training'
export type DeploymentStatus = 'provisioning' | 'active' | 'maintenance' | 'paused' | 'retired' | 'error'
export type DeploymentHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down'
export type DeploymentDeployStatus = 'unknown' | 'building' | 'deployed' | 'failed' | 'rolled_back'

export interface CrmCustomer {
  id: string
  name: string
  account_type: CustomerAccountType
  status: CustomerStatus
  health_score: number
  primary_domain?: string | null
  customer_identifier?: string | null
  rex_project_ref?: string | null
  rex_supabase_url?: string | null
  commercial_notes?: string | null
  tags: string[]
  recurring_monthly_amount: number
  onboarding_fee: number
  created_at: string
  updated_at: string
}

export interface CustomerContact {
  id: string
  customer_id: string
  name: string
  email?: string | null
  phone?: string | null
  role?: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CustomerBranch {
  id: string
  customer_id: string
  name: string
  address?: string | null
  postcode?: string | null
  branch_code?: string | null
  status: 'planned' | 'active' | 'paused' | 'closed'
  created_at: string
  updated_at: string
}

export interface CustomerDeployment {
  id: string
  customer_id: string
  name: string
  environment: DeploymentEnvironment
  status: DeploymentStatus
  health_status: DeploymentHealthStatus
  customer_identifier?: string | null
  rex_project_ref?: string | null
  supabase_url?: string | null
  app_url?: string | null
  region?: string | null
  deployed_release_id?: string | null
  deployed_version?: string | null
  app_provider?: string | null
  app_provider_project?: string | null
  git_repo?: string | null
  git_branch?: string | null
  git_tag?: string | null
  git_commit?: string | null
  latest_migration_version?: string | null
  latest_migration_name?: string | null
  edge_functions_commit?: string | null
  deploy_status: DeploymentDeployStatus
  last_deployed_at?: string | null
  last_smoke_tested_at?: string | null
  last_seen_at?: string | null
  is_primary: boolean
  notes?: string | null
  created_at: string
  updated_at: string
  customer?: Pick<CrmCustomer, 'id' | 'name' | 'account_type' | 'status' | 'health_score'> | null
  release?: Pick<Release, 'id' | 'version' | 'title'> | null
}

export interface CustomerDetail {
  customer: CrmCustomer
  contacts: CustomerContact[]
  branches: CustomerBranch[]
  deployments: CustomerDeployment[]
  tickets: CrmTicket[]
  onboarding: OnboardingProject[]
  charges: Charge[]
  timeline: TimelineItem[]
}

export interface CrmTicket {
  id: string
  customer_id?: string | null
  customer_deployment_id?: string | null
  customer_identifier?: string | null
  rex_project_ref?: string | null
  rex_supabase_url?: string | null
  rex_ticket_id?: string | null
  rex_local_table_id?: string | null
  reporter_name?: string | null
  reporter_email?: string | null
  page_url?: string | null
  priority: TicketPriority
  status: TicketStatus
  assignment?: string | null
  subject?: string | null
  description: string
  screenshot_metadata: Record<string, unknown>
  environment: Record<string, unknown>
  app_version?: string | null
  last_synced_to_rex_at?: string | null
  last_sync_error?: string | null
  created_at: string
  updated_at: string
  customer?: Pick<CrmCustomer, 'id' | 'name' | 'account_type' | 'status' | 'health_score'> | null
}

export interface TicketMessage {
  id: string
  ticket_id: string
  direction: MessageDirection
  author_name?: string | null
  author_email?: string | null
  body: string
  delivery_status: 'stored' | 'pending' | 'sent' | 'failed'
  metadata: Record<string, unknown>
  created_at: string
}

export interface TicketEvent {
  id: string
  ticket_id?: string | null
  event_type: string
  idempotency_key?: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface TicketDetail {
  ticket: CrmTicket
  messages: TicketMessage[]
  events: TicketEvent[]
}

export interface OnboardingProject {
  id: string
  customer_id: string
  name: string
  status: OnboardingStatus
  go_live_target?: string | null
  readiness_score: number
  blockers?: string | null
  training_notes?: string | null
  created_at: string
  updated_at: string
  customer?: Pick<CrmCustomer, 'id' | 'name'> | null
}

export interface OnboardingTask {
  id: string
  project_id: string
  title: string
  description?: string | null
  status: TaskStatus
  owner?: string | null
  due_date?: string | null
  sort_order: number
}

export interface OnboardingDetail {
  project: OnboardingProject
  tasks: OnboardingTask[]
}

export interface ComplianceEvidenceFile {
  id: string
  document_id: string
  bucket_id: string
  storage_path: string
  original_filename: string
  content_type?: string | null
  size_bytes: number
  evidence_type: ComplianceEvidenceType
  notes?: string | null
  uploaded_by?: string | null
  uploaded_at: string
}

export interface ComplianceDocument {
  id: string
  document_no: number
  title: string
  source_status: string
  document_status: ComplianceDocumentStatus
  owner: string
  due_date?: string | null
  evidence_required: string
  residual_risk: string
  go_live_blocker: boolean
  source_folder_path?: string | null
  source_markdown_path?: string | null
  source_word_path?: string | null
  notes?: string | null
  sort_order: number
  created_at: string
  updated_at: string
  files?: ComplianceEvidenceFile[]
}

export interface Charge {
  id: string
  customer_id: string
  charge_type: ChargeType
  description: string
  amount: number
  currency: string
  billing_status: ChargeStatus
  invoice_reference?: string | null
  charge_date: string
  due_date?: string | null
  paid_at?: string | null
  customer?: Pick<CrmCustomer, 'id' | 'name'> | null
}

export interface Release {
  id: string
  version: string
  title: string
  release_notes?: string | null
  published_at?: string | null
  github_url?: string | null
  known_issues?: string | null
  created_at: string
  updated_at: string
  deployments?: CustomerDeployment[]
}

export interface CustomerReleaseStatus {
  id: string
  customer_id: string
  release_id: string
  rollout_status: RolloutStatus
  scheduled_for?: string | null
  deployed_at?: string | null
  notes?: string | null
  customer?: Pick<CrmCustomer, 'id' | 'name'> | null
  release?: Pick<Release, 'id' | 'version' | 'title'> | null
}

export interface ReleaseDetail {
  release: Release
  rollouts: CustomerReleaseStatus[]
  deployments: CustomerDeployment[]
}

export interface TimelineItem {
  id: string
  customer_id: string
  item_type: 'ticket' | 'message' | 'onboarding' | 'charge' | 'release' | 'deployment' | 'note'
  title: string
  body?: string | null
  occurred_at: string
  related_table?: string | null
  related_id?: string | null
  customer?: Pick<CrmCustomer, 'id' | 'name'> | null
}

export interface DashboardMetric {
  label: string
  value: string
  detail: string
  icon: string
  tone: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'
}

export interface DashboardSummary {
  metrics: DashboardMetric[]
  tickets: CrmTicket[]
  customers: CrmCustomer[]
  onboarding: OnboardingProject[]
  charges: Charge[]
  releases: Release[]
  timeline: TimelineItem[]
}

export interface WebhookEvent {
  id: string
  direction: 'inbound' | 'outbound'
  source: string
  event_type: string
  idempotency_key: string
  signature_valid: boolean
  processed_at?: string | null
  error?: string | null
  created_at: string
}

export interface WebhookDelivery {
  id: string
  ticket_id?: string | null
  target: string
  event_type: string
  idempotency_key: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  last_error?: string | null
  last_attempted_at?: string | null
  created_at: string
  updated_at: string
}

export interface FailedTicketMessage extends TicketMessage {
  ticket?: Pick<CrmTicket, 'id' | 'subject' | 'rex_ticket_id' | 'reporter_email'> & {
    customer?: Pick<CrmCustomer, 'id' | 'name'> | null
  } | null
}

export interface SystemHealthMetric {
  label: string
  value: string
  detail: string
  icon: string
  tone: 'success' | 'warning' | 'error' | 'neutral' | 'primary'
}

export interface SystemHealthSummary {
  metrics: SystemHealthMetric[]
  recent_webhooks: WebhookEvent[]
  failed_messages: FailedTicketMessage[]
  webhook_deliveries: WebhookDelivery[]
}
