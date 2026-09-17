import { FORECAST_SCHEMA_VERSION } from './constants'

export class UnknownForecastSchemaError extends Error {
  constructor(version: unknown) {
    super(`unknown-forecast-schema:${String(version)}`)
    this.name = 'UnknownForecastSchemaError'
  }
}

export function assertForecastVersion(value: { v?: unknown } | null | undefined): void {
  if (!value || value.v !== FORECAST_SCHEMA_VERSION) {
    throw new UnknownForecastSchemaError(value?.v)
  }
}

export function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return null
}
