import { sampleTimeline } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const customerId = typeof query.customer === 'string' && query.customer ? query.customer : null

  if (!isSupabaseConfigured()) {
    return customerId
      ? sampleTimeline.filter(item => item.customer_id === customerId)
      : sampleTimeline
  }

  let timelineQuery = serverSupabase()
    .from('customer_timeline_items')
    .select('*, customer:customers(id,name)')

  if (customerId) {
    timelineQuery = timelineQuery.eq('customer_id', customerId)
  }

  const { data, error } = await timelineQuery
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
