import { usePrivy } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES } from 'const/config'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '../thirdweb/chain'
import client from '../thirdweb/client'
import { fetchCitizenExpiresAt, isSubscriptionExpired } from './citizenSubscription'

export function useCitizen(
  selectedChain: any,
  citizenContract?: any,
  citizenAddress?: string,
  skipFetch: boolean = false
) {
  return useCitizenQuery(selectedChain, citizenContract, citizenAddress, skipFetch).nft
}

/**
 * Same lookup as `useCitizen`, plus whether the check is still in flight.
 * A connected wallet is not "not a citizen" until this settles.
 */
export function useCitizenQuery(
  selectedChain: any,
  citizenContract?: any,
  citizenAddress?: string,
  skipFetch: boolean = false
): { nft: any; isLoading: boolean } {
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { user, authenticated } = usePrivy()
  const [citizenNFT, setCitizenNFT] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check skipFetch FIRST, before changing any state
    if (skipFetch) {
      console.log('Skipping citizen fetch - cache not checked yet')
      return
    }

    let cancelled = false

    async function getCitizenNFTByAddress() {
      if (!authenticated || !user || !selectedChain || !(citizenAddress || address)) {
        if (!cancelled) {
          setCitizenNFT(undefined)
          setIsLoading(false)
        }
        return
      }

      if (!cancelled) setIsLoading(true)

      try {
        let contract
        if (citizenContract) {
          contract = citizenContract
        } else {
          contract = getContract({
            client,
            address: CITIZEN_ADDRESSES[chainSlug],
            chain: selectedChain,
            abi: CitizenABI as any,
          })
        }

        const ownedTokenId: any = await readContract({
          contract: contract,
          method: 'getOwnedToken' as string,
          params: [citizenAddress || address],
        })

        // Callers that omit `citizenAddress` are asking "is the connected
        // wallet a citizen?" to gate a feature — a lapsed subscription has to
        // answer no. Lookups for a specific address are display-only (member
        // lists), so they skip the extra read.
        // Expiry is read on the same chain as the token. Token ids are not
        // shared across chains, so a default-chain read can mark a paid-up
        // testnet citizen as lapsed.
        if (!citizenAddress) {
          const expiresAt = await fetchCitizenExpiresAt(
            ownedTokenId.toString(),
            selectedChain
          )
          if (isSubscriptionExpired(expiresAt)) {
            if (!cancelled) setCitizenNFT(undefined)
            return
          }
        }

        const owned = {
          id: ownedTokenId,
          owner: (citizenAddress || address || '').toLowerCase(),
          metadata: { id: ownedTokenId.toString(), name: '' },
        }
        if (!cancelled) setCitizenNFT(owned)

        try {
          const nft = await getNFT({
            contract: contract,
            tokenId: BigInt(ownedTokenId),
          })
          if (!cancelled) setCitizenNFT(nft)
        } catch (err) {
          // Ownership is already proven. A metadata/gateway failure must not
          // send a citizen back to the mint prompt.
          console.warn('Citizen metadata unavailable:', err)
        }
      } catch (err: any) {
        if (!cancelled) setCitizenNFT(undefined)
        if (err?.reason !== 'No token owned' && !/No token owned/i.test(err?.message || '')) {
          console.warn('Citizen lookup failed:', err)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (selectedChain) getCitizenNFTByAddress()
    return () => {
      cancelled = true
    }
  }, [
    selectedChain,
    chainSlug,
    citizenContract,
    address,
    user,
    authenticated,
    citizenAddress,
    skipFetch,
  ])

  return { nft: citizenNFT, isLoading }
}

/**
 * Batch-check which addresses own a Citizen NFT.
 *
 * Previously this fired one `getOwnedToken` RPC per address in parallel —
 * on /projects that meant dozens of eth_calls on every mount and helped
 * saturate Infura. Prefer a single Tableland query against the citizen
 * table (owner IN (...)); fall back to chunked on-chain reads only if
 * Tableland fails.
 */
export function useCitizens(selectedChain: any, citizenAddresses: string[]) {
  const chainSlug = getChainSlug(selectedChain)
  const [areCitizens, setAreCitizens] = useState<boolean[]>([])
  const addressKey = citizenAddresses
    .map((a) => (typeof a === 'string' ? a.toLowerCase() : ''))
    .filter(Boolean)
    .join(',')

  useEffect(() => {
    let cancelled = false

    async function getAreCitizens() {
      if (!selectedChain || !addressKey) {
        setAreCitizens([])
        return
      }

      const addresses = addressKey.split(',')
      const ownerSet = new Set<string>()

      try {
        const table = CITIZEN_TABLE_NAMES[chainSlug]
        if (table) {
          // Chunk IN(...) clauses so we stay under URL / gateway limits.
          // Owners are stored lowercase (see CitizenProvider queries).
          const CHUNK = 40
          for (let i = 0; i < addresses.length; i += CHUNK) {
            const chunk = addresses.slice(i, i + CHUNK)
            const inList = chunk.map((a) => `'${a}'`).join(',')
            const statement = `SELECT owner FROM ${table} WHERE owner IN (${inList})`
            const res = await fetch(
              `/api/tableland/query?statement=${encodeURIComponent(statement)}`
            )
            if (!res.ok) throw new Error(`tableland ${res.status}`)
            const rows = await res.json()
            if (Array.isArray(rows)) {
              for (const row of rows) {
                if (row?.owner) ownerSet.add(String(row.owner).toLowerCase())
              }
            }
          }
          if (!cancelled) {
            setAreCitizens(addresses.map((a) => ownerSet.has(a)))
          }
          return
        }
      } catch (err) {
        console.warn(
          'useCitizens: Tableland batch failed, falling back to on-chain:',
          err
        )
      }

      // Fallback: chunked sequential RPC so we don't reintroduce the N-wide burst.
      try {
        const contract = getContract({
          client,
          address: CITIZEN_ADDRESSES[chainSlug],
          chain: selectedChain,
          abi: CitizenABI as any,
        })
        const results: boolean[] = []
        const CHUNK = 8
        for (let i = 0; i < addresses.length; i += CHUNK) {
          const chunk = addresses.slice(i, i + CHUNK)
          const chunkResults = await Promise.all(
            chunk.map(async (address) => {
              try {
                const ownedTokenId = await readContract({
                  contract,
                  method: 'getOwnedToken' as string,
                  params: [address],
                })
                return !!ownedTokenId
              } catch {
                return false
              }
            })
          )
          results.push(...chunkResults)
        }
        if (!cancelled) setAreCitizens(results)
      } catch (err: any) {
        console.error(err)
        if (!cancelled) setAreCitizens(addresses.map(() => false))
      }
    }

    getAreCitizens()
    return () => {
      cancelled = true
    }
  }, [selectedChain, chainSlug, addressKey])

  return areCitizens
}
