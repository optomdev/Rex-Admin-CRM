import { z } from 'zod'
import { pricingSlug } from '../../utils/pricing'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const pricingSchema = z.object({
  code: z.string().trim().min(2).optional(),
  name: z.string().trim().min(2).optional(),
  category: z.enum(['license', 'module', 'usage', 'misc']).optional(),
  charge_type: z.enum(['monthly', 'onboarding', 'ad_hoc', 'credit']).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  unit_label: z.string().trim().min(2).optional(),
  notes: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional()
})

export default eventHandler(async (event) => {
  const pricingItemId = getRouterParam(event, 'id')
  const body = pricingSchema.parse(await readBody(event))

  if (!pricingItemId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing pricing item id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No pricing fields supplied' })
  }

  const update = {
    ...body,
    code: body.code ? pricingSlug(body.code) : undefined,
    name: body.name?.trim(),
    currency: body.currency?.toUpperCase(),
    unit_label: body.unit_label?.trim(),
    notes: body.notes?.trim() || null
  }

  if (!isSupabaseConfigured()) {
    return {
      id: pricingItemId,
      ...update,
      updated_at: new Date().toISOString(),
      simulated: true
    }
  }

  const { data, error } = await serverSupabase()
    .from('pricing_items')
    .update(update)
    .eq('id', pricingItemId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
