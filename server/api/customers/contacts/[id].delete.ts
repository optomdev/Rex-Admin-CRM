import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

export default eventHandler(async (event) => {
  const contactId = getRouterParam(event, 'id')

  if (!contactId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contact id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      id: contactId,
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

  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('id', contactId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: current.data.customer_id,
    item_type: 'note',
    title: 'Customer contact removed',
    body: current.data.name,
    related_table: 'customer_contacts',
    metadata: {
      removed_contact_id: current.data.id
    }
  })

  return {
    ok: true,
    id: contactId
  }
})
