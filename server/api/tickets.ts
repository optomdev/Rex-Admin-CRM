import { sampleTickets } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleTickets
  }

  const { data, error } = await serverSupabase()
    .from('tickets')
    .select('*, customer:customers(id,name,status,health_score)')
    .order('updated_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
