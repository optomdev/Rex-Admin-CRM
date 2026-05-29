import { createClient } from '@supabase/supabase-js'

export function isSupabaseConfigured() {
  const config = useRuntimeConfig()
  return Boolean(config.public.supabaseUrl && config.supabaseSecretKey)
}

export function serverSupabase() {
  const config = useRuntimeConfig()

  if (!config.public.supabaseUrl || !config.supabaseSecretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_SUPABASE_SECRET_KEY.'
    })
  }

  return createClient(
    config.public.supabaseUrl,
    config.supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}
