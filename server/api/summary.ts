import { sampleDashboardSummary } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleDashboardSummary()
  }

  const supabase = serverSupabase()

  const [
    customers,
    tickets,
    onboarding,
    charges,
    releases,
    timeline
  ] = await Promise.all([
    supabase.from('customers').select('*').order('updated_at', { ascending: false }).limit(6),
    supabase.from('tickets').select('*, customer:customers(id,name,account_type,status,health_score)').order('updated_at', { ascending: false }).limit(8),
    supabase.from('onboarding_projects').select('*, customer:customers(id,name)').order('updated_at', { ascending: false }).limit(6),
    supabase.from('charges').select('*, customer:customers(id,name)').order('charge_date', { ascending: false }).limit(8),
    supabase.from('releases').select('*').order('published_at', { ascending: false, nullsFirst: false }).limit(5),
    supabase.from('customer_timeline_items').select('*, customer:customers(id,name)').order('occurred_at', { ascending: false }).limit(8)
  ])

  const firstError = [customers, tickets, onboarding, charges, releases, timeline].find(result => result.error)?.error

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  const openTicketCount = tickets.data?.filter(ticket => !['resolved', 'closed'].includes(ticket.status)).length ?? 0
  const urgentTicketCount = tickets.data?.filter(ticket => ticket.priority === 'urgent').length ?? 0
  const monthlyLedger = customers.data?.reduce((total, customer) => total + Number(customer.recurring_monthly_amount), 0) ?? 0
  const openCharges = charges.data
    ?.filter(charge => ['open', 'invoice_sent', 'overdue'].includes(charge.billing_status))
    .reduce((total, charge) => total + Number(charge.amount), 0) ?? 0
  const latestRelease = releases.data?.[0]

  return {
    metrics: [{
      label: 'Open tickets',
      value: openTicketCount.toString(),
      detail: `${urgentTicketCount} urgent`,
      icon: 'i-lucide-life-buoy',
      tone: urgentTicketCount > 0 ? 'error' : 'primary'
    }, {
      label: 'Monthly ledger',
      value: `GBP ${monthlyLedger.toLocaleString('en-GB')}`,
      detail: 'Manual billing ledger',
      icon: 'i-lucide-banknote',
      tone: 'success'
    }, {
      label: 'Open charges',
      value: `GBP ${openCharges.toLocaleString('en-GB')}`,
      detail: 'Open, sent, and overdue',
      icon: 'i-lucide-receipt',
      tone: 'warning'
    }, {
      label: 'Latest Rex version',
      value: latestRelease?.version ?? 'No releases',
      detail: latestRelease?.title ?? 'Run GitHub sync',
      icon: 'i-lucide-git-branch',
      tone: 'secondary'
    }],
    customers: customers.data ?? [],
    tickets: tickets.data ?? [],
    onboarding: onboarding.data ?? [],
    charges: charges.data ?? [],
    releases: releases.data ?? [],
    timeline: timeline.data ?? []
  }
})
