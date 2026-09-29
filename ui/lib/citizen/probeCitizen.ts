import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { isNoTokenOwnedError, type CitizenProbe } from './citizenGate'
import { fetchCitizenExpiresAt, isSubscriptionExpired } from './citizenSubscription'

/**
 * Does this address hold an unexpired Citizen on `chain`?
 * `none` is only the contract's "No token owned" revert. Transport and
 * decode failures stay `error` so the UI does not tell a Citizen to mint.
 *
 * Uses the unbatched DePrize reader. The shared thirdweb client batches
 * eth_calls, and a batched result was decoding as a failed lookup.
 */
export async function probeCitizen(
  chain: { id: number; name?: string },
  owner: string
): Promise<CitizenProbe> {
  if (!owner || !chain?.id) return { status: 'error' }

  try {
    const chainSlug = getChainSlug(chain as any)
    const address = CITIZEN_ADDRESSES[chainSlug]
    if (!address) return { status: 'error' }

    const contract = getContract({
      client: deprizeReadClient,
      address,
      chain: deprizeReadChain(chain.id),
      abi: CitizenABI as any,
    })
    const ownedTokenId: any = await rpcRead({
      contract,
      method: 'getOwnedToken' as string,
      params: [owner],
    })
    const tokenId = ownedTokenId?.toString?.() ?? String(ownedTokenId)
    const expiresAt = await fetchCitizenExpiresAt(tokenId, chain)
    if (isSubscriptionExpired(expiresAt)) return { status: 'expired', tokenId }
    return { status: 'citizen', tokenId }
  } catch (err) {
    if (isNoTokenOwnedError(err)) return { status: 'none' }
    console.warn('Citizen lookup failed:', err)
    return { status: 'error' }
  }
}
