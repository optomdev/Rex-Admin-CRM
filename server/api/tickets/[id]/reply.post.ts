import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'
import { sendTicketReplyEmail } from '../../../utils/ticketEmail'

const bodySchema = z.object({
  body: z.string().min(1),
  author_name: z.string().default('Rex Admin'),
  author_email: z.string().email().optional()
})

function emailMetadata(email: Awaited<ReturnType<typeof sendTicketReplyEmail>>, attemptedAt: string) {
  return {
    email_attempts: 1,
    last_email_attempted_at: attemptedAt,
    last_email_status: email.ok ? 'sent' : 'failed',
    last_email_error: email.error,
    last_email_skipped: email.skipped,
    last_email_provider_id: email.provider_id ?? null
  }
}

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
    .select('id, customer_id, rex_ticket_id, reporter_name, reporter_email, subject, description')
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
      delivery_status: 'pending',
      metadata: {
        email_attempts: 0
      }
    })
    .select('id, created_at')
    .single()

  if (message.error) {
    throw createError({ statusCode: 500, statusMessage: message.error.message })
  }

  const email = await sendTicketReplyEmail({
    to: ticket.data.reporter_email,
    reporterName: ticket.data.reporter_name,
    ticketRef: ticket.data.rex_ticket_id,
    subject: ticket.data.subject,
    body: body.body,
    authorName: body.author_name
  })

  const attemptedAt = new Date().toISOString()

  await supabase
    .from('ticket_messages')
    .update({
      delivery_status: email.ok ? 'sent' : 'failed',
      metadata: emailMetadata(email, attemptedAt)
    })
    .eq('id', message.data.id)

  await supabase.from('ticket_events').insert({
    ticket_id: ticket.data.id,
    event_type: 'support_ticket.reply_sent',
    idempotency_key: idempotencyKey,
    details: {
      message_id: message.data.id,
      reporter_email: ticket.data.reporter_email,
      email_status: email.ok ? 'sent' : 'failed',
      email_error: email.error,
      email_skipped: email.skipped,
      provider_id: email.provider_id ?? null
    }
  })

  if (ticket.data.customer_id) {
    await supabase.from('customer_timeline_items').insert({
      customer_id: ticket.data.customer_id,
      item_type: 'message',
      title: email.ok ? 'Ticket reply emailed' : 'Ticket reply stored locally',
      body: body.body,
      related_table: 'ticket_messages',
      related_id: message.data.id,
      metadata: {
        ticket_id: ticket.data.id,
        rex_ticket_id: ticket.data.rex_ticket_id,
        ticket_title: ticket.data.subject || ticket.data.description,
        delivery_status: email.ok ? 'sent' : 'failed',
        email_error: email.error
      }
    })
  }

  return {
    ok: email.ok,
    retryable: !email.ok,
    email,
    message_id: message.data.id,
    idempotency_key: idempotencyKey
  }
})
