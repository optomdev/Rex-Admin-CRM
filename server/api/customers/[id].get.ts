import { sampleCharges, sampleCustomers, sampleOnboarding, sampleTickets, sampleTimeline } from '../../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

export default eventHandler(async (event) => {
  const customerId = getRouterParam(event, 'id')

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  if (!isSupabaseConfigured()) {
    const customer = sampleCustomers.find(item => item.id === customerId)

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
    }

    return {
      customer,
      contacts: [{
        id: `${customerId}-contact-1`,
        customer_id: customerId,
        name: 'Primary contact',
        email: null,
        phone: null,
        role: 'Practice lead',
        is_primary: true,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }],
      branches: [{
        id: `${customerId}-branch-1`,
        customer_id: customerId,
        name: 'Main branch',
        address: null,
        postcode: null,
        branch_code: null,
        status: 'active',
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }],
      deployments: [],
      tickets: sampleTickets.filter(ticket => ticket.customer_id === customerId),
      onboarding: sampleOnboarding.filter(project => project.customer_id === customerId),
      charges: sampleCharges.filter(charge => charge.customer_id === customerId),
      timeline: sampleTimeline.filter(item => item.customer_id === customerId)
    }
  }

  const supabase = serverSupabase()
  const [customer, contacts, branches, deployments, tickets, onboarding, charges, timeline] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('customer_contacts').select('*').eq('customer_id', customerId).order('is_primary', { ascending: false }).order('updated_at', { ascending: false }),
    supabase.from('customer_branches').select('*').eq('customer_id', customerId).order('name', { ascending: true }),
    supabase.from('customer_deployments').select('*, release:releases(id,version,title)').eq('customer_id', customerId).order('is_primary', { ascending: false }).order('updated_at', { ascending: false }),
    supabase.from('tickets').select('*, customer:customers(id,name,account_type,status,health_score)').eq('customer_id', customerId).order('updated_at', { ascending: false }).limit(8),
    supabase.from('onboarding_projects').select('*, customer:customers(id,name)').eq('customer_id', customerId).order('updated_at', { ascending: false }).limit(8),
    supabase.from('charges').select('*, customer:customers(id,name)').eq('customer_id', customerId).order('charge_date', { ascending: false }).limit(8),
    supabase.from('customer_timeline_items').select('*, customer:customers(id,name)').eq('customer_id', customerId).order('occurred_at', { ascending: false }).limit(12)
  ])

  if (customer.error) {
    throw createError({ statusCode: 404, statusMessage: customer.error.message })
  }

  const firstError = [contacts, branches, deployments, tickets, onboarding, charges, timeline].find(result => result.error)?.error
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  return {
    customer: customer.data,
    contacts: contacts.data ?? [],
    branches: branches.data ?? [],
    deployments: deployments.data ?? [],
    tickets: tickets.data ?? [],
    onboarding: onboarding.data ?? [],
    charges: charges.data ?? [],
    timeline: timeline.data ?? []
  }
})
