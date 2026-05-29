import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const ticketStatuses = ['new', 'triage', 'waiting_on_customer', 'in_progress', 'blocked', 'resolved', 'closed'] as const
const ticketPriorities = ['low', 'normal', 'high', 'urgent'] as const

const bodySchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  assignment: z.string().trim().max(120).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable()
})

type TicketUpdate = z.output<typeof bodySchema>
type TicketWorkflowField = keyof TicketUpdate

function changedFields(current: Record<TicketWorkflowField, unknown>, body: TicketUpdate) {
  return (Object.entries(body) as [TicketWorkflowField, unknown][])
    .filter(([key, value]) => current[key] !== value)
}

export default eventHandler(async (event) => {
  const ticketId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!ticketId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No ticket workflow fields supplied' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: ticketId,
      ...body,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('tickets')
    .select('id, customer_id, status, priority, assignment, subject, description, rex_ticket_id')
    .eq('id', ticketId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const normalizedBody: TicketUpdate = {}

  if ('status' in body) normalizedBody.status = body.status
  if ('priority' in body) normalizedBody.priority = body.priority
  if ('assignment' in body) normalizedBody.assignment = body.assignment?.trim() || null
  if ('customer_id' in body) normalizedBody.customer_id = body.customer_id || null

  const currentWorkflow = {
    status: current.data.status,
    priority: current.data.priority,
    assignment: current.data.assignment,
    customer_id: current.data.customer_id
  }

  const changes = changedFields(currentWorkflow, normalizedBody)

  if (!changes.length) {
    return current.data
  }

  const ticket = await supabase
    .from('tickets')
    .update(normalizedBody)
    .eq('id', ticketId)
    .select('*, customer:customers(id,name,status,health_score)')
    .single()

  if (ticket.error) {
    throw createError({ statusCode: 500, statusMessage: ticket.error.message })
  }

  const eventType = changes.length === 1 && changes[0]?.[0] === 'status'
    ? 'support_ticket.status_changed'
    : 'support_ticket.workflow_updated'

  const details = {
    changes: Object.fromEntries(changes.map(([key, value]) => [
      key,
      {
        from: currentWorkflow[key],
        to: value
      }
    ]))
  }

  await supabase.from('ticket_events').insert({
    ticket_id: ticket.data.id,
    event_type: eventType,
    idempotency_key: `crm-ticket-workflow-${ticket.data.id}-${Date.now()}`,
    details
  })

  const timelineCustomerId = ticket.data.customer_id || current.data.customer_id

  if (timelineCustomerId) {
    const title = eventType === 'support_ticket.status_changed'
      ? `Ticket marked ${ticket.data.status.replaceAll('_', ' ')}`
      : 'Ticket workflow updated'

    await supabase.from('customer_timeline_items').insert({
      customer_id: timelineCustomerId,
      item_type: 'ticket',
      title,
      body: ticket.data.subject || ticket.data.description,
      related_table: 'tickets',
      related_id: ticket.data.id,
      metadata: {
        rex_ticket_id: ticket.data.rex_ticket_id,
        ...details
      }
    })
  }

  return ticket.data
})
