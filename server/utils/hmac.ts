import { createHmac, timingSafeEqual } from 'node:crypto'

export function signWebhookPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyWebhookSignature(payload: string, signature: string | undefined, secret: string) {
  if (!signature || !secret) {
    return false
  }

  const normalized = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature

  const expected = signWebhookPayload(payload, secret)
  const providedBuffer = Buffer.from(normalized, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}
