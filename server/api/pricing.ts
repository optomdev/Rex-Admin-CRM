import { defaultPricingItems } from '../utils/pricing'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return defaultPricingItems
  }

  const { data, error } = await serverSupabase()
    .from('pricing_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
