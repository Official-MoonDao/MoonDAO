import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { cacheTypeformAnswers } from '@/lib/typeform/responseCache'

/**
 * Typeform webhook receiver.
 *
 * Typeform delivers a submission here within ~1s of the user finishing the
 * form — far faster than the `/responses` API indexes it. We stash the answers
 * in Redis keyed by responseId so the onboarding poll (see ./response.ts) can
 * return them immediately instead of waiting on Typeform's slow API.
 *
 * Configure the webhook to point at https://<domain>/api/typeform/webhook with
 * a shared secret (TYPEFORM_WEBHOOK_SECRET). See scripts/register-typeform-webhook.
 */

export const config = {
  api: {
    bodyParser: false,
  },
}

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function isValidSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET
  // Reject requests when secret is not configured to prevent unsigned payloads.
  if (!secret) {
    console.error('[typeform webhook] TYPEFORM_WEBHOOK_SECRET not set — rejecting unsigned request')
    return false
  }
  if (!signatureHeader) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('base64')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  let rawBody: Buffer
  try {
    rawBody = await readRawBody(req)
  } catch {
    return res.status(400).json({ message: 'Unable to read body' })
  }

  const signature = req.headers['typeform-signature'] as string | undefined
  if (!isValidSignature(rawBody, signature)) {
    return res.status(401).json({ message: 'Invalid signature' })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' })
  }

  const formResponse = payload?.form_response
  const responseId: string | undefined = formResponse?.token || formResponse?.response_id
  const answers = formResponse?.answers

  if (responseId && Array.isArray(answers)) {
    await cacheTypeformAnswers(responseId, answers)
  }

  // Always 200 so Typeform doesn't retry; caching is best-effort.
  return res.status(200).json({ received: true })
}
