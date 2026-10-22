import type { NextApiRequest, NextApiResponse } from 'next'
import { subscribeEmailToKit, fieldsFromRequestBody } from '@/lib/convert-kit/kitSubscribe'
import {
  newsletterClientIp,
  productionSubscribeLimiter,
  type SubscribeRateLimiter,
} from '@/lib/convert-kit/subscribeRateLimit'
import { classifySubscriber, emailLogRef, normalizeEmail } from '@/lib/convert-kit/subscriberFilter'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FORM_ID = /^\d{1,12}$/
/** Same value as CK_NEWSLETTER_FORM_ID. Kept local so this route does not load contract config. */
const NEWSLETTER_FORM_ID = '3715552'

export type NewsletterSubscribeDeps = {
  now: () => number
  sleep: (ms: number) => Promise<void>
  env: Record<string, string | undefined>
  limiter: SubscribeRateLimiter | null
  fetchImpl: typeof fetch
  log: (event: string, detail: Record<string, unknown>) => void
  clientIp: (req: NextApiRequest) => string
}

function defaultDeps(): NewsletterSubscribeDeps {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    env: process.env,
    limiter: productionSubscribeLimiter(),
    fetchImpl: fetch,
    log: (event, detail) => {
      console.info(`[kit-subscribe] ${event}`, detail)
    },
    clientIp: newsletterClientIp,
  }
}

export async function handleNewsletterSubscribe(
  req: NextApiRequest,
  res: NextApiResponse,
  deps: NewsletterSubscribeDeps = defaultDeps()
) {
  if (req.method !== 'POST') {
    res.status(400).json({ success: false })
    return
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const formId = typeof body.formId === 'string' ? body.formId.trim() : ''
  if (!EMAIL.test(email) || email.length > 320 || !FORM_ID.test(formId)) {
    res.status(400).json({ success: false })
    return
  }

  const reason = classifySubscriber({
    email,
    company: body.company,
    formStartedAt: body.formStartedAt,
    now: deps.now(),
    enforceTiming: formId === NEWSLETTER_FORM_ID || typeof body.formStartedAt === 'number',
  })
  if (reason) {
    deps.log('filtered', { reason, ...emailLogRef(email) })
    res.status(200).json({ success: true })
    return
  }

  const normalized = normalizeEmail(email)
  if (deps.limiter) {
    try {
      const ip = deps.clientIp(req)
      const [ipOk, emailOk] = await Promise.all([
        deps.limiter.limitIp(ip),
        deps.limiter.limitEmail(normalized),
      ])
      if (!ipOk || !emailOk) {
        deps.log('filtered', {
          reason: ipOk ? 'rate_email' : 'rate_ip',
          ...emailLogRef(email),
        })
        res.status(200).json({ success: true })
        return
      }
    } catch (error) {
      deps.log('rate_limit_unavailable', {
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  const apiKey = deps.env.CONVERT_KIT_API_KEY
  if (!apiKey) {
    deps.log('missing_api_key', {})
    res.status(502).json({ success: false })
    return
  }

  const fields = fieldsFromRequestBody(body.fields)
  const result = await subscribeEmailToKit({
    email,
    formId,
    fields,
    apiKey,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    log: deps.log,
  })
  if (!result.ok) {
    res.status(result.status).json({ success: false })
    return
  }
  res.status(200).json({ success: true })
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleNewsletterSubscribe(req, res)
}
