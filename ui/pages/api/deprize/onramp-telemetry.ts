import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  incrementOnrampTelemetry,
  type OnrampTelemetryEvent,
} from '@/lib/deprize/onrampTelemetryStore'

const EVENTS = new Set<OnrampTelemetryEvent>([
  'cta_shown',
  'cta_clicked',
  'provider_selected:coinbase',
  'provider_selected:moonpay',
  'provider_selected:faucet',
  'jwt_generate_error',
  'return_received',
  'return_rejected:no_jwt',
  'return_rejected:stale',
  'return_rejected:address',
  'return_rejected:outcome',
  'return_rejected:market_closed',
  'return_rejected:consumed',
  'funds_observed',
  'poll_timeout',
  'bet_placed_within_session',
])

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const event = req.body?.event
  if (typeof event !== 'string' || !EVENTS.has(event as OnrampTelemetryEvent)) {
    return res.status(400).json({ error: 'invalid-event' })
  }
  await incrementOnrampTelemetry(event as OnrampTelemetryEvent)
  return res.status(204).end()
}

export default withMiddleware(handler, rateLimit)
