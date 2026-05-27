import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

export type CustomerStatus = 'prospect' | 'onboarding' | 'active' | 'at_risk' | 'paused' | 'churned'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'new' | 'triage' | 'waiting_on_customer' | 'in_progress' | 'blocked' | 'resolved' | 'closed'
export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type OnboardingStatus = 'planning' | 'in_progress' | 'ready_for_go_live' | 'live' | 'blocked' | 'paused'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked'
export type ChargeStatus = 'draft' | 'open' | 'invoice_sent' | 'paid' | 'overdue' | 'void'
export type ChargeType = 'monthly' | 'onboarding' | 'ad_hoc' | 'credit'
export type RolloutStatus = 'not_started' | 'scheduled' | 'deployed' | 'blocked' | 'rolled_back'

export interface CrmCustomer {
  id: string
  name: string
  status: CustomerStatus
  health_score: number
  primary_domain?: string | null
  commercial_notes?: string | null
  tags: string[]
  recurring_monthly_amount: number
  onboarding_fee: number
  created_at: string
  updated_at: string
}

export interface CrmTicket {
  id: string
  customer_id?: string | null
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
  created_at: string
  updated_at: string
  customer?: Pick<CrmCustomer, 'id' | 'name' | 'status' | 'health_score'> | null
}

export interface TicketMessage {
  id: string
  ticket_id: string
  direction: MessageDirection
  author_name?: string | null
  author_email?: string | null
  body: string
  delivery_status: 'stored' | 'pending' | 'sent' | 'failed'
  created_at: string
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
  status: TaskStatus
  owner?: string | null
  due_date?: string | null
  sort_order: number
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

export interface TimelineItem {
  id: string
  customer_id: string
  item_type: 'ticket' | 'message' | 'onboarding' | 'charge' | 'release' | 'note'
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
