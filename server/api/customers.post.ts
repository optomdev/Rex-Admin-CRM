import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const customerSchema = z.object({
  name: z.string().min(2),
  status: z.enum(['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned']).default('prospect'),
  health_score: z.coerce.number().int().min(0).max(100).default(75),
  primary_domain: z.string().trim().optional().nullable(),
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
      commercial_notes: body.commercial_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const { data, error } = await serverSupabase()
    .from('customers')
    .insert({
      ...body,
      primary_domain: body.primary_domain || null,
      commercial_notes: body.commercial_notes || null
    })
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
