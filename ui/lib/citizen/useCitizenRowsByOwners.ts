import { useMemo } from 'react'
import {
  buildCitizenOwnerLookupStatement,
  citizenRowsByOwner,
  type CitizenRow,
} from '@/lib/citizen/citizenLookup'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'

export function useCitizenRowsByOwners(
  addresses: readonly string[],
  chainSlug: string
): Map<string, CitizenRow> {
  const key = addresses
    .map((address) => address.toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',')
  const statement = useMemo(
    () => buildCitizenOwnerLookupStatement(chainSlug, key ? key.split(',') : []),
    [chainSlug, key]
  )
  const { data } = useTablelandQuery(statement, { revalidateOnFocus: false, chainSlug })
  return useMemo(() => citizenRowsByOwner((data || []) as CitizenRow[]), [data])
}
