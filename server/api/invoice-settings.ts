import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const fallbackSettings = {
  id: true,
  invoice_day_of_month: 1,
  due_days: 14,
  invoice_timezone: 'Europe/London',
  cron_enabled: true,
  updated_at: new Date().toISOString()
}

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return fallbackSettings
  }

  const { data, error } = await serverSupabase()
    .from('invoice_settings')
    .select('*')
    .eq('id', true)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
