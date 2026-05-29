import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const customerSchema = z.object({
  name: z.string().min(2),
  status: z.enum(['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned']),
  health_score: z.coerce.number().int().min(0).max(100),
  primary_domain: z.string().trim().optional().nullable(),
  customer_identifier: z.string().trim().optional().nullable(),
  rex_project_ref: z.string().trim().optional().nullable(),
  rex_supabase_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  commercial_notes: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  recurring_monthly_amount: z.coerce.number().min(0),
  onboarding_fee: z.coerce.number().min(0)
})

type CustomerUpdate = z.output<typeof customerSchema>
type CustomerField = keyof CustomerUpdate

function changedFields(current: Record<CustomerField, unknown>, body: CustomerUpdate) {
  return (Object.entries(body) as [CustomerField, unknown][])
    .filter(([key, value]) => {
      const currentValue = Array.isArray(current[key]) ? JSON.stringify(current[key]) : current[key]
      const nextValue = Array.isArray(value) ? JSON.stringify(value) : value
      return currentValue !== nextValue
    })
}

export default eventHandler(async (event) => {
  const customerId = getRouterParam(event, 'id')
  const body = customerSchema.parse(await readBody(event))

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  const payload = {
    ...body,
    primary_domain: body.primary_domain || null,
    customer_identifier: body.customer_identifier || null,
    rex_project_ref: body.rex_project_ref || null,
    rex_supabase_url: body.rex_supabase_url || null,
    commercial_notes: body.commercial_notes || null
  }

  if (!isSupabaseConfigured()) {
    return {
      id: customerId,
      ...payload,
      updated_at: new Date().toISOString(),
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const currentCustomer = {
    name: current.data.name,
    status: current.data.status,
    health_score: current.data.health_score,
    primary_domain: current.data.primary_domain,
    customer_identifier: current.data.customer_identifier,
    rex_project_ref: current.data.rex_project_ref,
    rex_supabase_url: current.data.rex_supabase_url,
    commercial_notes: current.data.commercial_notes,
    tags: current.data.tags,
    recurring_monthly_amount: Number(current.data.recurring_monthly_amount),
    onboarding_fee: Number(current.data.onboarding_fee)
  }
  const changes = changedFields(currentCustomer, payload)

  if (!changes.length) {
    return current.data
  }

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: data.id,
    item_type: 'note',
    title: 'Customer record updated',
    body: data.name,
    related_table: 'customers',
    related_id: data.id,
    metadata: {
      changes: Object.fromEntries(changes.map(([key, value]) => [
        key,
        {
          from: currentCustomer[key],
          to: value
        }
      ]))
    }
  })

  return data
})
