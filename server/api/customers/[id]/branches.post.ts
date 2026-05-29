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
  const customerId = getRouterParam(event, 'id')
  const body = branchSchema.parse(await readBody(event))

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  const payload = {
    customer_id: customerId,
    name: body.name,
    address: body.address || null,
    postcode: body.postcode || null,
    branch_code: body.branch_code || null,
    status: body.status
  }

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('customer_branches')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: customerId,
    item_type: 'note',
    title: 'Customer branch added',
    body: data.name,
    related_table: 'customer_branches',
    related_id: data.id,
    metadata: {
      branch_code: data.branch_code,
      postcode: data.postcode,
      status: data.status
    }
  })

  return data
})
