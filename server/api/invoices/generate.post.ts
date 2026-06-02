import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const generateSchema = z.object({
  billing_date: z.string().date()
})

export default eventHandler(async (event) => {
  const body = generateSchema.parse(await readBody(event))

  if (!isSupabaseConfigured()) {
    return {
      billing_date: body.billing_date,
      generated_count: 0,
      generated: [],
      simulated: true
    }
  }

  const { data, error } = await serverSupabase()
    .rpc('generate_monthly_customer_charges', {
      p_billing_month: body.billing_date,
      p_invoice_day: null
    })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const generated = data ?? []

  return {
    billing_date: body.billing_date,
    generated_count: generated.length,
    generated
  }
})
