import { sampleCharges } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const customerId = typeof query.customer === 'string' && query.customer ? query.customer : null

  if (!isSupabaseConfigured()) {
    return customerId
      ? sampleCharges.filter(charge => charge.customer_id === customerId)
      : sampleCharges
  }

  let chargeQuery = serverSupabase()
    .from('charges')
    .select('*, customer:customers(id,name), billing_group:billing_groups(id,name), pricing_item:pricing_items(id,name,category,unit_label)')

  if (customerId) {
    chargeQuery = chargeQuery.eq('customer_id', customerId)
  }

  const { data, error } = await chargeQuery.order('charge_date', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
