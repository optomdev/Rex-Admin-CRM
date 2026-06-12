import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const statusSchema = z.object({
  status: z.enum(['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned'])
})

export default eventHandler(async (event) => {
  const customerId = getRouterParam(event, 'id')
  const parsed = statusSchema.safeParse(await readBody(event))

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid customer status' })
  }

  const body = parsed.data

  if (!isSupabaseConfigured()) {
    return {
      id: customerId,
      status: body.status,
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

  if (current.data.status === body.status) {
    return current.data
  }

  const { data, error } = await supabase
    .from('customers')
    .update({ status: body.status })
    .eq('id', customerId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: data.id,
    item_type: 'note',
    title: `Status changed to ${data.status.replaceAll('_', ' ')}`,
    body: `${data.name} moved from ${current.data.status.replaceAll('_', ' ')} to ${data.status.replaceAll('_', ' ')}`,
    related_table: 'customers',
    related_id: data.id,
    metadata: {
      changes: {
        status: {
          from: current.data.status,
          to: data.status
        }
      }
    }
  })

  return data
})
