import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bodySchema = z.object({
  status: z.enum(['new', 'triage', 'waiting_on_customer', 'in_progress', 'blocked', 'resolved', 'closed']),
  note: z.string().optional()
})

export default eventHandler(async (event) => {
  const ticketId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  const idempotencyKey = `crm-status-${ticketId}-${body.status}-${Date.now()}`

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      idempotency_key: idempotencyKey
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('tickets')
    .select('id, status, customer_id, subject, description, rex_ticket_id')
    .eq('id', ticketId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const ticket = await supabase
    .from('tickets')
    .update({ status: body.status })
    .eq('id', ticketId)
    .select('id, status, customer_id, subject, description, rex_ticket_id')
    .single()

  if (ticket.error) {
    throw createError({ statusCode: 500, statusMessage: ticket.error.message })
  }

  await supabase.from('ticket_events').insert({
    ticket_id: ticket.data.id,
    event_type: 'support_ticket.status_changed',
    idempotency_key: idempotencyKey,
    details: { status: body.status, note: body.note ?? null }
  })

  if (ticket.data.customer_id && current.data.status !== body.status) {
    await supabase.from('customer_timeline_items').insert({
      customer_id: ticket.data.customer_id,
      item_type: 'ticket',
      title: `Ticket marked ${body.status.replaceAll('_', ' ')}`,
      body: body.note || ticket.data.subject || ticket.data.description,
      related_table: 'tickets',
      related_id: ticket.data.id,
      metadata: {
        rex_ticket_id: ticket.data.rex_ticket_id,
        previous_status: current.data.status,
        status: body.status
      }
    })
  }

  return {
    ok: true,
    retryable: false,
    idempotency_key: idempotencyKey
  }
})
