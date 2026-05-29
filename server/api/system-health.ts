import { sampleTickets } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

function healthMetrics(values: {
  recentWebhookCount: number
  unprocessedWebhookCount: number
  failedWebhookCount: number
  failedMessageCount: number
  unlinkedTicketCount: number
  deliveryIssueCount: number
}) {
  return [{
    label: 'Rex intake',
    value: values.recentWebhookCount.toString(),
    detail: values.unprocessedWebhookCount
      ? `${values.unprocessedWebhookCount} unprocessed events`
      : 'Recent signed events',
    icon: values.unprocessedWebhookCount ? 'i-lucide-webhook-off' : 'i-lucide-webhook',
    tone: values.unprocessedWebhookCount ? 'warning' as const : 'success' as const
  }, {
    label: 'Webhook errors',
    value: values.failedWebhookCount.toString(),
    detail: values.failedWebhookCount ? 'Review failed payloads' : 'No stored failures',
    icon: values.failedWebhookCount ? 'i-lucide-triangle-alert' : 'i-lucide-shield-check',
    tone: values.failedWebhookCount ? 'error' as const : 'success' as const
  }, {
    label: 'Email replies',
    value: values.failedMessageCount.toString(),
    detail: values.failedMessageCount ? 'Failed outbound replies' : 'No failed replies',
    icon: values.failedMessageCount ? 'i-lucide-mail-warning' : 'i-lucide-send',
    tone: values.failedMessageCount ? 'error' as const : 'success' as const
  }, {
    label: 'Unlinked tickets',
    value: values.unlinkedTicketCount.toString(),
    detail: values.unlinkedTicketCount ? 'Need customer routing' : 'All tickets linked',
    icon: values.unlinkedTicketCount ? 'i-lucide-link-2-off' : 'i-lucide-link-2',
    tone: values.unlinkedTicketCount ? 'warning' as const : 'success' as const
  }, {
    label: 'Callback queue',
    value: values.deliveryIssueCount.toString(),
    detail: values.deliveryIssueCount ? 'Pending or failed callbacks' : 'No callback backlog',
    icon: values.deliveryIssueCount ? 'i-lucide-refresh-cw-off' : 'i-lucide-circle-check',
    tone: values.deliveryIssueCount ? 'warning' as const : 'neutral' as const
  }]
}

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return {
      metrics: healthMetrics({
        recentWebhookCount: 1,
        unprocessedWebhookCount: 0,
        failedWebhookCount: 0,
        failedMessageCount: 1,
        unlinkedTicketCount: 0,
        deliveryIssueCount: 0
      }),
      recent_webhooks: [{
        id: 'sample-webhook',
        direction: 'inbound',
        source: 'rex',
        event_type: 'support_ticket.created',
        idempotency_key: 'sample-rex-ticket',
        signature_valid: true,
        processed_at: new Date().toISOString(),
        error: null,
        created_at: new Date().toISOString()
      }],
      failed_messages: [{
        id: 'sample-message',
        ticket_id: sampleTickets[0]!.id,
        direction: 'outbound',
        author_name: 'Rex Admin',
        author_email: 'ticket@rexapp.co.uk',
        body: 'Sample failed reply awaiting email retry.',
        delivery_status: 'failed',
        metadata: { error: 'Email provider not configured' },
        created_at: new Date().toISOString(),
        ticket: sampleTickets[0]!
      }],
      webhook_deliveries: []
    }
  }

  const supabase = serverSupabase()

  const [
    recentWebhooks,
    recentWebhookCount,
    unprocessedWebhooks,
    failedWebhooks,
    failedMessages,
    unlinkedTickets,
    webhookDeliveries
  ] = await Promise.all([
    supabase
      .from('webhook_events')
      .select('id, direction, source, event_type, idempotency_key, signature_valid, processed_at, error, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'rex'),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'rex')
      .is('processed_at', null),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .not('error', 'is', null),
    supabase
      .from('ticket_messages')
      .select('id, ticket_id, direction, author_name, author_email, body, delivery_status, metadata, created_at, ticket:tickets(id, subject, rex_ticket_id, reporter_email, customer:customers(id, name))')
      .eq('direction', 'outbound')
      .eq('delivery_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .is('customer_id', null),
    supabase
      .from('webhook_deliveries')
      .select('id, ticket_id, target, event_type, idempotency_key, status, attempts, last_error, last_attempted_at, created_at, updated_at')
      .in('status', ['pending', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(10)
  ])

  const firstError = [
    recentWebhooks,
    recentWebhookCount,
    unprocessedWebhooks,
    failedWebhooks,
    failedMessages,
    unlinkedTickets,
    webhookDeliveries
  ].find(result => result.error)?.error

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  return {
    metrics: healthMetrics({
      recentWebhookCount: recentWebhookCount.count ?? recentWebhooks.data?.length ?? 0,
      unprocessedWebhookCount: unprocessedWebhooks.count ?? 0,
      failedWebhookCount: failedWebhooks.count ?? 0,
      failedMessageCount: failedMessages.data?.length ?? 0,
      unlinkedTicketCount: unlinkedTickets.count ?? 0,
      deliveryIssueCount: webhookDeliveries.data?.length ?? 0
    }),
    recent_webhooks: recentWebhooks.data ?? [],
    failed_messages: failedMessages.data ?? [],
    webhook_deliveries: webhookDeliveries.data ?? []
  }
})
