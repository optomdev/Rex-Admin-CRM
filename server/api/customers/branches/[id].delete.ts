import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

export default eventHandler(async (event) => {
  const branchId = getRouterParam(event, 'id')

  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      id: branchId,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('customer_branches')
    .select('id, customer_id, name')
    .eq('id', branchId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const { error } = await supabase
    .from('customer_branches')
    .delete()
    .eq('id', branchId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: current.data.customer_id,
    item_type: 'note',
    title: 'Customer branch removed',
    body: current.data.name,
    related_table: 'customer_branches',
    metadata: {
      removed_branch_id: current.data.id
    }
  })

  return {
    ok: true,
    id: branchId
  }
})
