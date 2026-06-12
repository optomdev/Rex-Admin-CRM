import type { CrmCustomer, OnboardingProject, TimelineItem } from '~/types'
import { sampleCustomers, sampleOnboarding, sampleTimeline } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

type CustomerRow = CrmCustomer
type OnboardingSignal = Pick<OnboardingProject, 'customer_id' | 'readiness_score' | 'go_live_target' | 'status' | 'blockers' | 'updated_at'>
type TimelineSignal = Pick<TimelineItem, 'customer_id' | 'occurred_at'>

function daysSince(date: string | null | undefined) {
  if (!date) return null

  const timestamp = new Date(date).getTime()
  if (Number.isNaN(timestamp)) return null

  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
}

function signalTime(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function enrichCustomers(
  customers: CustomerRow[],
  onboardingRows: OnboardingSignal[],
  timelineRows: TimelineSignal[]
) {
  const onboardingByCustomer = new Map<string, OnboardingSignal>()
  const lastTouchByCustomer = new Map<string, string>()

  for (const project of onboardingRows) {
    const current = onboardingByCustomer.get(project.customer_id)
    const projectIsActive = !['live', 'paused'].includes(project.status)
    const currentIsActive = current ? !['live', 'paused'].includes(current.status) : false

    if (
      !current
      || (projectIsActive && !currentIsActive)
      || (projectIsActive === currentIsActive && signalTime(project.updated_at) > signalTime(current.updated_at))
    ) {
      onboardingByCustomer.set(project.customer_id, project)
    }
  }

  for (const item of timelineRows) {
    const current = lastTouchByCustomer.get(item.customer_id)
    if (!current || signalTime(item.occurred_at) > signalTime(current)) {
      lastTouchByCustomer.set(item.customer_id, item.occurred_at)
    }
  }

  return customers.map((customer) => {
    const onboarding = onboardingByCustomer.get(customer.id)
    const lastTouchAt = lastTouchByCustomer.get(customer.id) ?? customer.updated_at ?? customer.created_at

    return {
      ...customer,
      pipeline: {
        onboarding_readiness_score: onboarding?.readiness_score ?? null,
        onboarding_go_live_target: onboarding?.go_live_target ?? null,
        onboarding_status: onboarding?.status ?? null,
        onboarding_blockers: onboarding?.blockers ?? null,
        onboarding_blocked: Boolean(onboarding && (onboarding.status === 'blocked' || onboarding.blockers?.trim())),
        days_since_last_touch: daysSince(lastTouchAt),
        last_touch_at: lastTouchAt
      }
    }
  })
}

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return enrichCustomers(sampleCustomers, sampleOnboarding, sampleTimeline)
  }

  const supabase = serverSupabase()
  const [customers, onboarding, timeline] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .from('onboarding_projects')
      .select('customer_id, readiness_score, go_live_target, status, blockers, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('customer_timeline_items')
      .select('customer_id, occurred_at')
      .order('occurred_at', { ascending: false })
  ])

  const firstError = [customers, onboarding, timeline].find(result => result.error)?.error

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  return enrichCustomers(
    customers.data ?? [],
    onboarding.data ?? [],
    timeline.data ?? []
  )
})
