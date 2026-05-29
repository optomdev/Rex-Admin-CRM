import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
  is_primary: z.boolean().default(false)
})

export default eventHandler(async (event) => {
  const customerId = getRouterParam(event, 'id')
  const body = contactSchema.parse(await readBody(event))

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  const payload = {
    customer_id: customerId,
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    role: body.role || null,
    is_primary: body.is_primary
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

  if (body.is_primary) {
    await supabase
      .from('customer_contacts')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
  }

  const { data, error } = await supabase
    .from('customer_contacts')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: customerId,
    item_type: 'note',
    title: 'Customer contact added',
    body: data.name,
    related_table: 'customer_contacts',
    related_id: data.id,
    metadata: {
      role: data.role,
      email: data.email,
      is_primary: data.is_primary
    }
  })

  return data
})
