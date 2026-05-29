import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const customerSchema = z.object({
  name: z.string().min(2),
  account_type: z.enum(['internal', 'prospect', 'customer', 'partner', 'franchise']).default('prospect'),
  status: z.enum(['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned']).default('prospect'),
  health_score: z.coerce.number().int().min(0).max(100).default(75),
  primary_domain: z.string().trim().optional().nullable(),
  customer_identifier: z.string().trim().optional().nullable(),
  rex_project_ref: z.string().trim().optional().nullable(),
  rex_supabase_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  commercial_notes: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  recurring_monthly_amount: z.coerce.number().min(0).default(0),
  onboarding_fee: z.coerce.number().min(0).default(0)
})

export default eventHandler(async (event) => {
  const body = customerSchema.parse(await readBody(event))

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...body,
      primary_domain: body.primary_domain || null,
      customer_identifier: body.customer_identifier || null,
      rex_project_ref: body.rex_project_ref || null,
      rex_supabase_url: body.rex_supabase_url || null,
      commercial_notes: body.commercial_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...body,
      primary_domain: body.primary_domain || null,
      customer_identifier: body.customer_identifier || null,
      rex_project_ref: body.rex_project_ref || null,
      rex_supabase_url: body.rex_supabase_url || null,
      commercial_notes: body.commercial_notes || null
    })
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: data.id,
    item_type: 'note',
    title: 'Customer created',
    body: data.name,
    related_table: 'customers',
    related_id: data.id,
    metadata: {
      account_type: data.account_type,
      status: data.status,
      customer_identifier: data.customer_identifier,
      rex_project_ref: data.rex_project_ref
    }
  })

  return data
})
