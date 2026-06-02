import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const settingsSchema = z.object({
  invoice_day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  due_days: z.coerce.number().int().min(0).max(90).optional(),
  invoice_timezone: z.string().trim().min(3).optional(),
  cron_enabled: z.boolean().optional()
})

export default eventHandler(async (event) => {
  const body = settingsSchema.parse(await readBody(event))

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No invoice settings supplied' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: true,
      invoice_day_of_month: body.invoice_day_of_month ?? 1,
      due_days: body.due_days ?? 14,
      invoice_timezone: body.invoice_timezone ?? 'Europe/London',
      cron_enabled: body.cron_enabled ?? true,
      updated_at: new Date().toISOString(),
      simulated: true
    }
  }

  const { data, error } = await serverSupabase()
    .from('invoice_settings')
    .update(body)
    .eq('id', true)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
