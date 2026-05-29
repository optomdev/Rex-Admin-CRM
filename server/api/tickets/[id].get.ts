import { sampleTickets } from '../../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

export default eventHandler(async (event) => {
  const ticketId = getRouterParam(event, 'id')

  if (!ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  if (!isSupabaseConfigured()) {
    const ticket = sampleTickets.find(item => item.id === ticketId)

    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
    }

    return {
      ticket,
      messages: [],
      events: []
    }
  }

  const supabase = serverSupabase()
  const [ticket, messages, events] = await Promise.all([
    supabase
      .from('tickets')
      .select('*, customer:customers(id,name,status,health_score)')
      .eq('id', ticketId)
      .single(),
    supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
    supabase
      .from('ticket_events')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  if (ticket.error) {
    throw createError({ statusCode: 404, statusMessage: ticket.error.message })
  }

  if (messages.error) {
    throw createError({ statusCode: 500, statusMessage: messages.error.message })
  }

  if (events.error) {
    throw createError({ statusCode: 500, statusMessage: events.error.message })
  }

  return {
    ticket: ticket.data,
    messages: messages.data ?? [],
    events: events.data ?? []
  }
})
