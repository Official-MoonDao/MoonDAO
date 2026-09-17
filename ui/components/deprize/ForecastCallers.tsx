import { FORECASTS_TABLE_NAMES } from 'const/config'
import { useMemo } from 'react'
import { CARD } from '@/components/deprize/detail/primitives'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'

type CallerRow = {
  displayName?: string
  vector?: string | number[]
  updatedAt?: number
}

function parseVector(raw: unknown, n: number): number[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
  }
  if (typeof raw === 'string') {
    try {
      return parseVector(JSON.parse(raw), n)
    } catch {
      return Array.from({ length: n }, () => 0)
    }
  }
  return Array.from({ length: n }, () => 0)
}

export default function ForecastCallers({
  chainSlug,
  deprizeId,
  labels,
}: {
  chainSlug: string
  deprizeId: number
  labels: string[]
}) {
  const table = FORECASTS_TABLE_NAMES[chainSlug] ?? ''
  const statement = useMemo(() => {
    if (!table || !Number.isInteger(deprizeId) || deprizeId <= 0) return null
    if (!/^(sepolia|arbitrum|arbitrum-sepolia)$/.test(chainSlug)) return null
    return `SELECT displayName, vector, updatedAt FROM ${table} WHERE chainSlug = '${chainSlug}' AND deprizeId = ${deprizeId} ORDER BY updatedAt DESC LIMIT 40`
  }, [table, chainSlug, deprizeId])

  const { data, isLoading } = useTablelandQuery(statement, { revalidateOnFocus: false })
  const rows = (Array.isArray(data) ? data : []) as CallerRow[]

  if (!table) return null

  return (
    <section className={CARD}>
      <h3 className="text-white text-sm font-semibold">Who&apos;s called it</h3>
      {isLoading && <p className="mt-2 text-sm text-gray-400">Loading predictions…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-2 text-sm text-gray-400">No public predictions yet.</p>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((row, i) => {
            const vector = parseVector(row.vector, labels.length)
            const name = row.displayName?.trim() || `Caller ${i + 1}`
            return (
              <li key={`${name}-${row.updatedAt ?? i}`} className="text-sm">
                <p className="text-white truncate">{name}</p>
                <p className="text-xs text-gray-400">
                  {labels
                    .map((label, idx) => `${label} ${Math.round((vector[idx] ?? 0) * 100)}%`)
                    .join(' · ')}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
