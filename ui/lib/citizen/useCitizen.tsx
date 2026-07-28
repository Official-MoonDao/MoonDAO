import { usePrivy } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES } from 'const/config'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '../thirdweb/chain'
import client from '../thirdweb/client'

export function useCitizen(
  selectedChain: any,
  citizenContract?: any,
  citizenAddress?: string,
  skipFetch: boolean = false
) {
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { user, authenticated } = usePrivy()
  const [citizenNFT, setCitizenNFT] = useState<any>()

  useEffect(() => {
    // Check skipFetch FIRST, before changing any state
    if (skipFetch) {
      console.log('Skipping citizen fetch - cache not checked yet')
      return
    }

    async function getCitizenNFTByAddress() {
      setCitizenNFT(undefined)
      if (!authenticated || !user) return

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

        const nft = await getNFT({
          contract: contract,
          tokenId: BigInt(ownedTokenId),
        })

        setCitizenNFT(nft)
      } catch (err: any) {
        if (err.reason === 'No token owned') setCitizenNFT(undefined)
      }
    }

    if (selectedChain) getCitizenNFTByAddress()
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

  return citizenNFT
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
