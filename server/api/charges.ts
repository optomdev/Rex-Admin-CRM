import { sampleCharges } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleCharges
  }

  const { data, error } = await serverSupabase()
    .from('charges')
    .select('*, customer:customers(id,name)')
    .order('charge_date', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
