import { isSupabaseConfigured, serverSupabase } from '../../../../utils/supabase'
import { sendTicketReplyEmail } from '../../../../utils/ticketEmail'

interface TicketForRetry {
  id: string
  customer_id: string | null
  rex_ticket_id: string | null
  reporter_name: string | null
  reporter_email: string | null
  subject: string | null
  description: string | null
}

interface MessageForRetry {
  id: string
  ticket_id: string
  direction: string
  author_name: string | null
  author_email: string | null
  body: string
  delivery_status: string
  metadata: Record<string, unknown> | null
  ticket: TicketForRetry | TicketForRetry[] | null
}

function singleTicket(ticket: MessageForRetry['ticket']) {
  if (Array.isArray(ticket)) return ticket[0] ?? null
  return ticket
}

function metadataRecord(value: Record<string, unknown> | null) {
  return value && typeof value === 'object' ? value : {}
}

function nextAttempt(metadata: Record<string, unknown>) {
  const attempts = metadata.email_attempts
  return typeof attempts === 'number' ? attempts + 1 : 1
}

export default eventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')

  if (!messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing message id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      message_id: messageId
    }
  }

  const supabase = serverSupabase()
  const message = await supabase
    .from('ticket_messages')
    .select('id, ticket_id, direction, author_name, author_email, body, delivery_status, metadata, ticket:tickets(id,customer_id,rex_ticket_id,reporter_name,reporter_email,subject,description)')
    .eq('id', messageId)
    .single<MessageForRetry>()

  if (message.error) {
    throw createError({ statusCode: 404, statusMessage: message.error.message })
  }

  if (message.data.direction !== 'outbound') {
    throw createError({ statusCode: 400, statusMessage: 'Only outbound replies can be retried' })
  }

  if (message.data.delivery_status === 'sent') {
    return {
      ok: true,
      already_sent: true,
      retryable: false,
      message_id: message.data.id
    }
  }

  const ticket = singleTicket(message.data.ticket)

  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found for this message' })
  }

  const previousMetadata = metadataRecord(message.data.metadata)
  const attempt = nextAttempt(previousMetadata)
  const attemptedAt = new Date().toISOString()

  await supabase
    .from('ticket_messages')
    .update({
      delivery_status: 'pending',
      metadata: {
        ...previousMetadata,
        email_attempts: attempt,
        last_email_attempted_at: attemptedAt,
        last_email_status: 'pending',
        last_email_error: null
      }
    })
    .eq('id', message.data.id)

  const email = await sendTicketReplyEmail({
    to: ticket.reporter_email,
    reporterName: ticket.reporter_name,
    ticketRef: ticket.rex_ticket_id,
    subject: ticket.subject,
    body: message.data.body,
    authorName: message.data.author_name || 'Rex Admin'
  })

  await supabase
    .from('ticket_messages')
    .update({
      delivery_status: email.ok ? 'sent' : 'failed',
      metadata: {
        ...previousMetadata,
        email_attempts: attempt,
        last_email_attempted_at: attemptedAt,
        last_email_status: email.ok ? 'sent' : 'failed',
        last_email_error: email.error,
        last_email_skipped: email.skipped,
        last_email_provider_id: email.provider_id ?? null
      }
    })
    .eq('id', message.data.id)

  await supabase.from('ticket_events').insert({
    ticket_id: ticket.id,
    event_type: 'support_ticket.reply_retried',
    idempotency_key: `crm-reply-retry-${message.data.id}-${attempt}`,
    details: {
      message_id: message.data.id,
      attempt,
      reporter_email: ticket.reporter_email,
      email_status: email.ok ? 'sent' : 'failed',
      email_error: email.error,
      email_skipped: email.skipped,
      provider_id: email.provider_id ?? null
    }
  })

  if (email.ok && ticket.customer_id) {
    await supabase.from('customer_timeline_items').insert({
      customer_id: ticket.customer_id,
      item_type: 'message',
      title: 'Ticket reply emailed after retry',
      body: message.data.body,
      related_table: 'ticket_messages',
      related_id: message.data.id,
      metadata: {
        ticket_id: ticket.id,
        rex_ticket_id: ticket.rex_ticket_id,
        ticket_title: ticket.subject || ticket.description,
        attempt,
        provider_id: email.provider_id ?? null
      }
    })
  }

  return {
    ok: email.ok,
    retryable: !email.ok,
    email,
    message_id: message.data.id,
    attempt
  }
})
