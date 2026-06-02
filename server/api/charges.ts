import { sampleCharges } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleCharges
  }

  const { data, error } = await serverSupabase()
    .from('charges')
    .select('*, customer:customers(id,name), billing_group:billing_groups(id,name), pricing_item:pricing_items(id,name,category,unit_label)')
    .order('charge_date', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
