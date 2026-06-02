import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const chargeTypes = ['monthly', 'onboarding', 'ad_hoc', 'credit'] as const
const billingStatuses = ['draft', 'open', 'invoice_sent', 'paid', 'overdue', 'void'] as const

const bodySchema = z.object({
  customer_id: z.string().uuid().optional(),
  billing_group_id: z.string().uuid().optional().nullable(),
  pricing_item_id: z.string().uuid().optional().nullable(),
  charge_type: z.enum(chargeTypes).optional(),
  description: z.string().trim().min(2).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  billing_status: z.enum(billingStatuses).optional(),
  invoice_reference: z.string().trim().optional().nullable(),
  charge_date: z.string().date().optional(),
  due_date: z.string().date().optional().nullable(),
  notes: z.string().trim().optional().nullable()
})

type ChargeUpdate = z.output<typeof bodySchema>
type ChargeField = keyof ChargeUpdate

function changedFields(current: Record<ChargeField, unknown>, body: ChargeUpdate) {
  return (Object.entries(body) as [ChargeField, unknown][])
    .filter(([key, value]) => current[key] !== value)
}

export default eventHandler(async (event) => {
  const chargeId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!chargeId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing charge id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No charge fields supplied' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: chargeId,
      ...body,
      paid_at: body.billing_status === 'paid' ? new Date().toISOString() : null,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('charges')
    .select('id, customer_id, billing_group_id, pricing_item_id, charge_type, description, amount, currency, billing_status, invoice_reference, charge_date, due_date, notes')
    .eq('id', chargeId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const normalizedBody: ChargeUpdate & { paid_at?: string | null } = {}

  if ('customer_id' in body) normalizedBody.customer_id = body.customer_id
  if ('billing_group_id' in body) normalizedBody.billing_group_id = body.billing_group_id || null
  if ('pricing_item_id' in body) normalizedBody.pricing_item_id = body.pricing_item_id || null
  if ('charge_type' in body) normalizedBody.charge_type = body.charge_type
  if ('description' in body) normalizedBody.description = body.description?.trim()
  if ('amount' in body) normalizedBody.amount = body.amount
  if ('currency' in body) normalizedBody.currency = body.currency?.toUpperCase()
  if ('billing_status' in body) {
    normalizedBody.billing_status = body.billing_status
    normalizedBody.paid_at = body.billing_status === 'paid' ? new Date().toISOString() : null
  }
  if ('invoice_reference' in body) normalizedBody.invoice_reference = body.invoice_reference?.trim() || null
  if ('charge_date' in body) normalizedBody.charge_date = body.charge_date
  if ('due_date' in body) normalizedBody.due_date = body.due_date || null
  if ('notes' in body) normalizedBody.notes = body.notes?.trim() || null

  const currentCharge = {
    customer_id: current.data.customer_id,
    billing_group_id: current.data.billing_group_id,
    pricing_item_id: current.data.pricing_item_id,
    charge_type: current.data.charge_type,
    description: current.data.description,
    amount: Number(current.data.amount),
    currency: current.data.currency,
    billing_status: current.data.billing_status,
    invoice_reference: current.data.invoice_reference,
    charge_date: current.data.charge_date,
    due_date: current.data.due_date,
    notes: current.data.notes
  }

  const changeBody = Object.fromEntries(
    Object.entries(normalizedBody).filter(([key]) => key !== 'paid_at')
  ) as ChargeUpdate
  const changes = changedFields(currentCharge, changeBody)

  if (!changes.length) {
    return current.data
  }

  const charge = await supabase
    .from('charges')
    .update(normalizedBody)
    .eq('id', chargeId)
    .select('*, customer:customers(id,name), billing_group:billing_groups(id,name), pricing_item:pricing_items(id,name,category,unit_label)')
    .single()

  if (charge.error) {
    throw createError({ statusCode: 500, statusMessage: charge.error.message })
  }

  const statusChanged = changes.some(([key]) => key === 'billing_status')
  await supabase.from('charge_events').insert({
    charge_id: chargeId,
    event_type: statusChanged && changes.length === 1 ? 'charge.status_changed' : 'charge.updated',
    details: {
      changes: Object.fromEntries(changes.map(([key, value]) => [
        key,
        {
          from: currentCharge[key],
          to: value
        }
      ]))
    }
  })

  const timelineTitle = statusChanged && normalizedBody.billing_status
    ? `Charge marked ${normalizedBody.billing_status.replaceAll('_', ' ')}`
    : 'Charge updated'

  await supabase.from('customer_timeline_items').insert({
    customer_id: charge.data.customer_id,
    item_type: 'charge',
    title: timelineTitle,
    body: `${charge.data.description} - ${charge.data.currency} ${Number(charge.data.amount).toLocaleString('en-GB')}`,
    related_table: 'charges',
    related_id: chargeId,
    metadata: {
      changes: Object.fromEntries(changes.map(([key, value]) => [
        key,
        {
          from: currentCharge[key],
          to: value
        }
      ]))
    }
  })

  return charge.data
})
