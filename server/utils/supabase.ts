import { createClient } from '@supabase/supabase-js'

export function isSupabaseConfigured() {
  const config = useRuntimeConfig()
  return Boolean(config.public.supabaseUrl && config.supabaseServiceRoleKey)
}

export function serverSupabase() {
  const config = useRuntimeConfig()

  if (!config.public.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_SUPABASE_SERVICE_ROLE_KEY.'
    })
  }

  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}
