import type { OnrampTelemetryEvent } from './onrampTelemetryStore'

export function trackOnrampEvent(event: OnrampTelemetryEvent): void {
  if (typeof fetch === 'undefined') return
  fetch('/api/deprize/onramp-telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {})
}
