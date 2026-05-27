import { z } from 'zod'
import { sampleTickets } from '../../utils/crmSeed'
import { verifyWebhookSignature } from '../../utils/hmac'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const rexTicketCreatedSchema = z.object({
  event: z.literal('support_ticket.created'),
  occurred_at: z.string().optional(),
  ticket: z.object({
    rex_ticket_id: z.string().optional(),
    local_table_id: z.union([z.string(), z.number()]).optional(),
    reporter_name: z.string().optional(),
    reporter_email: z.string().email().optional(),
    page_url: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    subject: z.string().optional(),
    description: z.string(),
    screenshot_metadata: z.record(z.string(), z.unknown()).default({}),
    environment: z.record(z.string(), z.unknown()).default({}),
    app_version: z.string().optional()
  })
})

export default eventHandler(async (event) => {
  const config = useRuntimeConfig()
  const rawBody = await readRawBody(event, 'utf8')
  const signature = getHeader(event, 'x-rex-signature')
  const idempotencyKey = getHeader(event, 'x-idempotency-key')

  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Missing webhook body' })
  }

  if (!idempotencyKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing x-idempotency-key header' })
  }

  if (!config.rexWebhookSecret) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_REX_WEBHOOK_SECRET is not configured' })
  }

  if (!verifyWebhookSignature(rawBody, signature, config.rexWebhookSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Rex webhook signature' })
  }

  const payload = rexTicketCreatedSchema.parse(JSON.parse(rawBody))

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      crm_ticket_id: sampleTickets[0]?.id,
      idempotency_key: idempotencyKey
    }
  }

  const supabase = serverSupabase()

  const existingEvent = await supabase
    .from('webhook_events')
    .select('id, processed_at, payload')
    .eq('source', 'rex')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingEvent.error) {
    throw createError({ statusCode: 500, statusMessage: existingEvent.error.message })
  }

  if (existingEvent.data?.processed_at) {
    return {
      ok: true,
      duplicate: true,
      idempotency_key: idempotencyKey
    }
  }

  const webhookEvent = await supabase
    .from('webhook_events')
    .insert({
      direction: 'inbound',
      source: 'rex',
      event_type: payload.event,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      payload
    })
    .select('id')
    .single()

  if (webhookEvent.error) {
    throw createError({ statusCode: 500, statusMessage: webhookEvent.error.message })
  }

  const ticketValues = {
    rex_ticket_id: payload.ticket.rex_ticket_id ?? null,
    rex_local_table_id: payload.ticket.local_table_id?.toString() ?? null,
    reporter_name: payload.ticket.reporter_name ?? null,
    reporter_email: payload.ticket.reporter_email ?? null,
    page_url: payload.ticket.page_url ?? null,
    priority: payload.ticket.priority,
    status: 'new',
    subject: payload.ticket.subject ?? null,
    description: payload.ticket.description,
    screenshot_metadata: payload.ticket.screenshot_metadata,
    environment: payload.ticket.environment,
    app_version: payload.ticket.app_version ?? null,
    webhook_payload: payload
  }

  const ticketWrite = ticketValues.rex_ticket_id
    ? await supabase
        .from('tickets')
        .upsert(ticketValues, { onConflict: 'rex_ticket_id' })
        .select('id')
        .single()
    : await supabase
        .from('tickets')
        .insert(ticketValues)
        .select('id')
        .single()

  if (ticketWrite.error) {
    await supabase
      .from('webhook_events')
      .update({ error: ticketWrite.error.message })
      .eq('id', webhookEvent.data.id)

    throw createError({ statusCode: 500, statusMessage: ticketWrite.error.message })
  }

  await supabase.from('ticket_events').insert({
    ticket_id: ticketWrite.data.id,
    event_type: payload.event,
    idempotency_key: idempotencyKey,
    details: payload
  })

  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', webhookEvent.data.id)

  return {
    ok: true,
    crm_ticket_id: ticketWrite.data.id,
    idempotency_key: idempotencyKey
  }
})
