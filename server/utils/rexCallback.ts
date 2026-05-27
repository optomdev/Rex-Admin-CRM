import { signWebhookPayload } from './hmac'

interface RexCallbackOptions {
  eventType: 'support_ticket.status_changed' | 'support_ticket.reply_sent'
  idempotencyKey: string
  payload: Record<string, unknown>
}

export async function sendRexCallback(options: RexCallbackOptions) {
  const config = useRuntimeConfig()

  if (!config.rexCallbackUrl || !config.crmWebhookSecret) {
    return {
      ok: false,
      skipped: true,
      error: 'NUXT_REX_CALLBACK_URL or NUXT_CRM_WEBHOOK_SECRET is not configured'
    }
  }

  const body = JSON.stringify({
    event: options.eventType,
    ...options.payload
  })

  const signature = signWebhookPayload(body, config.crmWebhookSecret)

  try {
    await $fetch(config.rexCallbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-crm-signature': signature,
        'x-idempotency-key': options.idempotencyKey
      },
      body
    })

    return { ok: true, skipped: false, error: null }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Rex callback failed'
    }
  }
}
