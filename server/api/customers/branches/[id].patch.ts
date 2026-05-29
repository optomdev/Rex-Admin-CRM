import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const branchSchema = z.object({
  name: z.string().min(2),
  address: z.string().trim().optional().nullable(),
  postcode: z.string().trim().optional().nullable(),
  branch_code: z.string().trim().optional().nullable(),
  status: z.enum(['planned', 'active', 'paused', 'closed']).default('active')
})

export default eventHandler(async (event) => {
  const branchId = getRouterParam(event, 'id')
  const body = branchSchema.parse(await readBody(event))

  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })
  }

  const payload = {
    name: body.name,
    address: body.address || null,
    postcode: body.postcode || null,
    branch_code: body.branch_code || null,
    status: body.status
  }

  if (!isSupabaseConfigured()) {
    return {
      id: branchId,
      ...payload,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('customer_branches')
    .select('id, customer_id, name, status')
    .eq('id', branchId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const { data, error } = await supabase
    .from('customer_branches')
    .update(payload)
    .eq('id', branchId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: current.data.customer_id,
    item_type: 'note',
    title: 'Customer branch updated',
    body: data.name,
    related_table: 'customer_branches',
    related_id: data.id,
    metadata: {
      previous_name: current.data.name,
      previous_status: current.data.status,
      status: data.status
    }
  })

  return data
})
