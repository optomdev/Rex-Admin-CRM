import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const bodySchema = z.object({
  customer_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(4000),
  occurred_at: z.string().datetime().optional()
})

export default eventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))

  if (!isSupabaseConfigured()) {
    return {
      id: `note-${Date.now()}`,
      customer_id: body.customer_id,
      item_type: 'note',
      title: body.title,
      body: body.body,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('customer_timeline_items')
    .insert({
      customer_id: body.customer_id,
      item_type: 'note',
      title: body.title,
      body: body.body,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      related_table: 'customer_timeline_items',
      metadata: {
        source: 'crm_manual_note'
      }
    })
    .select('*, customer:customers(id,name)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
