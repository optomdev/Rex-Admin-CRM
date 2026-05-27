import { sampleReleases } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleReleases
  }

  const { data, error } = await serverSupabase()
    .from('releases')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
