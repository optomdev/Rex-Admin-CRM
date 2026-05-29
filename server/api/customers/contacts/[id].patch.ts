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
  const contactId = getRouterParam(event, 'id')
  const body = contactSchema.parse(await readBody(event))

  if (!contactId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })
  }

  const payload = {
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    role: body.role || null,
    is_primary: body.is_primary
  }

  if (!isSupabaseConfigured()) {
    return {
      id: contactId,
      ...payload,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('customer_contacts')
    .select('id, customer_id, name')
    .eq('id', contactId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  if (body.is_primary) {
    await supabase
      .from('customer_contacts')
      .update({ is_primary: false })
      .eq('customer_id', current.data.customer_id)
      .neq('id', contactId)
  }

  const { data, error } = await supabase
    .from('customer_contacts')
    .update(payload)
    .eq('id', contactId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: current.data.customer_id,
    item_type: 'note',
    title: 'Customer contact updated',
    body: data.name,
    related_table: 'customer_contacts',
    related_id: data.id,
    metadata: {
      previous_name: current.data.name,
      is_primary: data.is_primary
    }
  })

  return data
})
