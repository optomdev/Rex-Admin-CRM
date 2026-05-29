import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const chargeSchema = z.object({
  customer_id: z.string().uuid(),
  charge_type: z.enum(['monthly', 'onboarding', 'ad_hoc', 'credit']),
  description: z.string().min(2),
  amount: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3).default('GBP'),
  billing_status: z.enum(['draft', 'open', 'invoice_sent', 'paid', 'overdue', 'void']).default('open'),
  invoice_reference: z.string().trim().optional().nullable(),
  charge_date: z.string().date(),
  due_date: z.string().date().optional().nullable(),
  paid_at: z.string().datetime().optional().nullable()
})

export default eventHandler(async (event) => {
  const body = chargeSchema.parse(await readBody(event))

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...body,
      invoice_reference: body.invoice_reference || null,
      due_date: body.due_date || null,
      paid_at: body.paid_at || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const supabase = serverSupabase()
  const charge = await supabase
    .from('charges')
    .insert({
      customer_id: body.customer_id,
      charge_type: body.charge_type,
      description: body.description,
      amount: body.amount,
      currency: body.currency.toUpperCase(),
      billing_status: body.billing_status,
      invoice_reference: body.invoice_reference || null,
      charge_date: body.charge_date,
      due_date: body.due_date || null,
      paid_at: body.billing_status === 'paid' ? (body.paid_at || new Date().toISOString()) : null
    })
    .select('*, customer:customers(id,name)')
    .single()

  if (charge.error) {
    throw createError({ statusCode: 500, statusMessage: charge.error.message })
  }

  await supabase.from('charge_events').insert({
    charge_id: charge.data.id,
    event_type: 'charge.created',
    details: {
      billing_status: body.billing_status,
      amount: body.amount,
      currency: body.currency.toUpperCase()
    }
  })

  await supabase.from('customer_timeline_items').insert({
    customer_id: body.customer_id,
    item_type: 'charge',
    title: 'Charge added',
    body: `${body.description} - ${body.currency.toUpperCase()} ${body.amount.toLocaleString('en-GB')}`,
    related_table: 'charges',
    related_id: charge.data.id,
    metadata: {
      charge_type: body.charge_type,
      billing_status: body.billing_status,
      invoice_reference: body.invoice_reference || null
    }
  })

  return charge.data
})
