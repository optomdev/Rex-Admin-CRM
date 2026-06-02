import { sampleCustomerPricingItems } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleCustomerPricingItems
  }

  const { data, error } = await serverSupabase()
    .from('customer_pricing_items')
    .select('*, customer:customers(id,name), pricing_item:pricing_items(id,name,code,category,charge_type,amount,currency,unit_label)')
    .order('is_active', { ascending: false })
    .order('starts_on', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
