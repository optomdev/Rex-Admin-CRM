import { z } from 'zod'
import { sendRexCallback } from '../../../utils/rexCallback'
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
  const ticket = await supabase
    .from('tickets')
    .update({ status: body.status })
    .eq('id', ticketId)
    .select('id, rex_ticket_id, rex_local_table_id, status')
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

  await supabase.from('webhook_deliveries').insert({
    ticket_id: ticket.data.id,
    target: 'rex',
    event_type: 'support_ticket.status_changed',
    idempotency_key: idempotencyKey,
    payload: {
      crm_ticket_id: ticket.data.id,
      rex_ticket_id: ticket.data.rex_ticket_id,
      rex_local_table_id: ticket.data.rex_local_table_id,
      status: body.status,
      note: body.note ?? null
    }
  })

  const callback = await sendRexCallback({
    eventType: 'support_ticket.status_changed',
    idempotencyKey,
    payload: {
      crm_ticket_id: ticket.data.id,
      rex_ticket_id: ticket.data.rex_ticket_id,
      rex_local_table_id: ticket.data.rex_local_table_id,
      status: body.status,
      note: body.note ?? null
    }
  })

  await supabase
    .from('webhook_deliveries')
    .update({
      status: callback.ok ? 'sent' : 'failed',
      attempts: 1,
      last_error: callback.error,
      last_attempted_at: new Date().toISOString()
    })
    .eq('target', 'rex')
    .eq('idempotency_key', idempotencyKey)

  await supabase
    .from('tickets')
    .update({
      last_synced_to_rex_at: callback.ok ? new Date().toISOString() : null,
      last_sync_error: callback.ok ? null : callback.error
    })
    .eq('id', ticket.data.id)

  return {
    ok: callback.ok,
    retryable: !callback.ok,
    callback,
    idempotency_key: idempotencyKey
  }
})
