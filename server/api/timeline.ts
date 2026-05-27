import { sampleTimeline } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleTimeline
  }

  const { data, error } = await serverSupabase()
    .from('customer_timeline_items')
    .select('*, customer:customers(id,name)')
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
