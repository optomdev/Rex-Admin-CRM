import { sampleOnboarding } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleOnboarding
  }

  const { data, error } = await serverSupabase()
    .from('onboarding_projects')
    .select('*, customer:customers(id,name)')
    .order('updated_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
