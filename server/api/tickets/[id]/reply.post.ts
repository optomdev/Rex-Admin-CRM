import { z } from 'zod'
import { sendRexCallback } from '../../../utils/rexCallback'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bodySchema = z.object({
  body: z.string().min(1),
  author_name: z.string().default('Rex Admin'),
  author_email: z.string().email().optional()
})

export default eventHandler(async (event) => {
  const ticketId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  const idempotencyKey = `crm-reply-${ticketId}-${Date.now()}`

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
    .select('id, rex_ticket_id, rex_local_table_id, reporter_email')
    .eq('id', ticketId)
    .single()

  if (ticket.error) {
    throw createError({ statusCode: 500, statusMessage: ticket.error.message })
  }

  const message = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticket.data.id,
      direction: 'outbound',
      author_name: body.author_name,
      author_email: body.author_email ?? null,
      body: body.body,
      delivery_status: 'pending'
    })
    .select('id, created_at')
    .single()

  if (message.error) {
    throw createError({ statusCode: 500, statusMessage: message.error.message })
  }

  await supabase.from('ticket_events').insert({
    ticket_id: ticket.data.id,
    event_type: 'support_ticket.reply_sent',
    idempotency_key: idempotencyKey,
    details: {
      message_id: message.data.id,
      reporter_email: ticket.data.reporter_email
    }
  })

  const callbackPayload = {
    crm_ticket_id: ticket.data.id,
    crm_message_id: message.data.id,
    rex_ticket_id: ticket.data.rex_ticket_id,
    rex_local_table_id: ticket.data.rex_local_table_id,
    body: body.body,
    author_name: body.author_name,
    author_email: body.author_email ?? null,
    created_at: message.data.created_at
  }

  await supabase.from('webhook_deliveries').insert({
    ticket_id: ticket.data.id,
    target: 'rex',
    event_type: 'support_ticket.reply_sent',
    idempotency_key: idempotencyKey,
    payload: callbackPayload
  })

  const callback = await sendRexCallback({
    eventType: 'support_ticket.reply_sent',
    idempotencyKey,
    payload: callbackPayload
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
    .from('ticket_messages')
    .update({ delivery_status: callback.ok ? 'sent' : 'failed' })
    .eq('id', message.data.id)

  return {
    ok: callback.ok,
    retryable: !callback.ok,
    callback,
    message_id: message.data.id,
    idempotency_key: idempotencyKey
  }
})
