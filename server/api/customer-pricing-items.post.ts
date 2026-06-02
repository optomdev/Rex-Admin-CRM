import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const assignmentSchema = z.object({
  customer_id: z.string().uuid(),
  pricing_item_id: z.string().uuid(),
  quantity: z.coerce.number().min(0.01).default(1),
  unit_amount_override: z.coerce.number().min(0).optional().nullable(),
  currency_override: z.string().trim().min(3).max(3).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  starts_on: z.string().date(),
  ends_on: z.string().date().optional().nullable(),
  is_active: z.boolean().default(true)
})

export default eventHandler(async (event) => {
  const body = assignmentSchema.parse(await readBody(event))
  const assignment = {
    customer_id: body.customer_id,
    pricing_item_id: body.pricing_item_id,
    quantity: body.quantity,
    unit_amount_override: body.unit_amount_override ?? null,
    currency_override: body.currency_override?.toUpperCase() || null,
    notes: body.notes || null,
    starts_on: body.starts_on,
    ends_on: body.ends_on || null,
    is_active: body.is_active
  }

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...assignment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const { data, error } = await serverSupabase()
    .from('customer_pricing_items')
    .insert(assignment)
    .select('*, customer:customers(id,name), pricing_item:pricing_items(id,name,code,category,charge_type,amount,currency,unit_label)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
