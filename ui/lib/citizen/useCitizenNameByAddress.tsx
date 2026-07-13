import { TABLELAND_ENDPOINT, CITIZEN_TABLE_NAMES } from 'const/config'
import { useEffect, useState } from 'react'

const chainSlug =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'

/**
 * Look up a MoonDAO citizen name for a given wallet address.
 * Queries the Tableland citizen table via its public REST API.
 * Returns the citizen name string if found, or null if the address
 * is not a citizen (or the lookup is still in flight).
 */
export function useCitizenNameByAddress(address: string | undefined): string | null {
  const [citizenName, setCitizenName] = useState<string | null>(null)

  useEffect(() => {
    if (!address) return

    let cancelled = false
    const tableName = CITIZEN_TABLE_NAMES[chainSlug]
    if (!tableName) return

    const stmt = `SELECT name FROM ${tableName} WHERE LOWER(owner) = '${address.toLowerCase()}' LIMIT 1`
    const url = `${TABLELAND_ENDPOINT}?statement=${encodeURIComponent(stmt)}`

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (!cancelled && Array.isArray(data) && data.length > 0 && data[0]?.name) {
          setCitizenName(data[0].name)
        }
      })
      .catch(() => {
        // silently fall back — non-citizen addresses are expected
      })

    return () => {
      cancelled = true
    }
  }, [address])

  return citizenName
}
