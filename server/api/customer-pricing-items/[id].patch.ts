import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const assignmentSchema = z.object({
  customer_id: z.string().uuid().optional(),
  pricing_item_id: z.string().uuid().optional(),
  quantity: z.coerce.number().min(0.01).optional(),
  unit_amount_override: z.coerce.number().min(0).optional().nullable(),
  currency_override: z.string().trim().min(3).max(3).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  starts_on: z.string().date().optional(),
  ends_on: z.string().date().optional().nullable(),
  is_active: z.boolean().optional()
})

export default eventHandler(async (event) => {
  const assignmentId = getRouterParam(event, 'id')
  const body = assignmentSchema.parse(await readBody(event))

  if (!assignmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer pricing assignment id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No assignment fields supplied' })
  }

  const update = { ...body }

  if ('currency_override' in body) update.currency_override = body.currency_override?.toUpperCase() || null
  if ('notes' in body) update.notes = body.notes?.trim() || null
  if ('ends_on' in body) update.ends_on = body.ends_on || null

  if (!isSupabaseConfigured()) {
    return {
      id: assignmentId,
      ...update,
      updated_at: new Date().toISOString(),
      simulated: true
    }
  }

  const { data, error } = await serverSupabase()
    .from('customer_pricing_items')
    .update(update)
    .eq('id', assignmentId)
    .select('*, customer:customers(id,name), pricing_item:pricing_items(id,name,code,category,charge_type,amount,currency,unit_label)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
