interface TicketReplyEmailOptions {
  to: string | null
  reporterName?: string | null
  ticketRef?: string | null
  subject?: string | null
  body: string
  authorName: string
}

interface EmailResult {
  ok: boolean
  skipped: boolean
  error: string | null
  provider_id?: string
}

interface ResendEmailResponse {
  id?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function formatFrom(name: string, email: string) {
  return `${name.replaceAll('"', '')} <${email}>`
}

function describeEmailError(error: unknown) {
  if (error instanceof Error) return error.message

  if (typeof error === 'object' && error && 'data' in error) {
    return JSON.stringify((error as { data?: unknown }).data)
  }

  return 'Ticket reply email failed'
}

export async function sendTicketReplyEmail(options: TicketReplyEmailOptions): Promise<EmailResult> {
  const config = useRuntimeConfig()

  if (!options.to) {
    return {
      ok: false,
      skipped: true,
      error: 'Ticket does not have a reporter email address'
    }
  }

  if (!config.resendApiKey || !config.supportFromEmail) {
    return {
      ok: false,
      skipped: true,
      error: 'NUXT_RESEND_API_KEY and NUXT_SUPPORT_FROM_EMAIL are required to email ticket replies'
    }
  }

  const fromName = config.supportFromName || 'Rex Support'
  const ticketLabel = options.ticketRef || 'Rex support ticket'
  const subject = `Re: ${options.subject || ticketLabel}`
  const greeting = options.reporterName ? `Hi ${options.reporterName},` : 'Hi,'
  const replyTo = config.supportReplyToEmail || config.supportFromEmail

  const text = [
    greeting,
    '',
    options.body,
    '',
    `--`,
    `${options.authorName}`,
    'Rex Support',
    '',
    `Ticket: ${ticketLabel}`
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033">
      <p>${escapeHtml(greeting)}</p>
      <div>${escapeHtml(options.body).replaceAll('\n', '<br>')}</div>
      <p style="margin-top:24px;margin-bottom:0">--<br>${escapeHtml(options.authorName)}<br>Rex Support</p>
      <p style="margin-top:24px;color:#64748b;font-size:13px">Ticket: ${escapeHtml(ticketLabel)}</p>
    </div>
  `.trim()

  try {
    const response = await $fetch<ResendEmailResponse>('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${config.resendApiKey}`,
        'content-type': 'application/json'
      },
      body: {
        from: formatFrom(fromName, config.supportFromEmail),
        to: [options.to],
        reply_to: replyTo,
        subject,
        text,
        html
      }
    })

    return {
      ok: true,
      skipped: false,
      error: null,
      provider_id: response.id
    }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: describeEmailError(error)
    }
  }
}
