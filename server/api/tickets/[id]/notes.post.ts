import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bodySchema = z.object({
  body: z.string().min(1),
  author_name: z.string().default('Rex Admin')
})

export default eventHandler(async (event) => {
  const ticketId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      message_id: crypto.randomUUID()
    }
  }

  const supabase = serverSupabase()
  const ticket = await supabase
    .from('tickets')
    .select('id, customer_id, subject, description, rex_ticket_id')
    .eq('id', ticketId)
    .single()

  if (ticket.error) {
    throw createError({ statusCode: 404, statusMessage: ticket.error.message })
  }

  const message = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      direction: 'internal',
      author_name: body.author_name,
      body: body.body,
      delivery_status: 'stored'
    })
    .select('id')
    .single()

  if (message.error) {
    throw createError({ statusCode: 500, statusMessage: message.error.message })
  }

  await supabase.from('ticket_events').insert({
    ticket_id: ticketId,
    event_type: 'support_ticket.internal_note_added',
    details: {
      message_id: message.data.id
    }
  })

  if (ticket.data.customer_id) {
    await supabase.from('customer_timeline_items').insert({
      customer_id: ticket.data.customer_id,
      item_type: 'message',
      title: 'Internal ticket note added',
      body: body.body,
      related_table: 'ticket_messages',
      related_id: message.data.id,
      metadata: {
        ticket_id: ticket.data.id,
        rex_ticket_id: ticket.data.rex_ticket_id,
        ticket_title: ticket.data.subject || ticket.data.description
      }
    })
  }

  return {
    ok: true,
    message_id: message.data.id
  }
})
