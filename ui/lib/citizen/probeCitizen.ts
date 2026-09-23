import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import { isNoTokenOwnedError, type CitizenProbe } from './citizenGate'
import { fetchCitizenExpiresAt, isSubscriptionExpired } from './citizenSubscription'

/**
 * Does this address hold an unexpired Citizen on `chain`?
 * `none` is only the contract's "No token owned" revert. Transport and
 * decode failures stay `error` so the UI does not tell a Citizen to mint.
 */
export async function probeCitizen(
  chain: { id: number; name?: string },
  owner: string
): Promise<CitizenProbe> {
  if (!owner) return { status: 'error' }

  try {
    const chainSlug = getChainSlug(chain as any)
    const address = CITIZEN_ADDRESSES[chainSlug]
    if (!address) return { status: 'error' }

    const contract = getContract({
      client,
      address,
      chain: chain as any,
      abi: CitizenABI as any,
    })
    const ownedTokenId: any = await readContract({
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
