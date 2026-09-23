import { Redis } from '@upstash/redis'

export type OnrampTelemetryEvent =
  | 'cta_shown'
  | 'cta_clicked'
  | 'provider_selected:coinbase'
  | 'provider_selected:moonpay'
  | 'provider_selected:faucet'
  | 'jwt_generate_error'
  | 'return_received'
  | 'return_rejected:no_jwt'
  | 'return_rejected:stale'
  | 'return_rejected:address'
  | 'return_rejected:outcome'
  | 'return_rejected:market_closed'
  | 'return_rejected:consumed'
  | 'funds_observed'
  | 'poll_timeout'
  | 'bet_placed_within_session'

export function getOnrampTelemetryRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function onrampTelemetryKey(event: OnrampTelemetryEvent, day = new Date()): string {
  const bucket = day.toISOString().slice(0, 10)
  return `deprize:onramp:${bucket}:${event}`
}

export async function incrementOnrampTelemetry(event: OnrampTelemetryEvent): Promise<boolean> {
  const cache = getOnrampTelemetryRedis()
  if (!cache) return false
  try {
    await cache.incr(onrampTelemetryKey(event))
    return true
  } catch (err) {
    console.error('[deprize] onramp telemetry failed', err)
    return false
  }
}
