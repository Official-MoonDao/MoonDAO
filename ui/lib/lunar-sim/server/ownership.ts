// Server-only ownership checks for lunar-sim scenarios.
// A scenario is owned by either a Citizen (NFT) or a Team (NFT + manager role).

import CitizenABI from 'const/abis/Citizen.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getPrivyUserData } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const citizenContract = getContract({
  address: CITIZEN_ADDRESSES[chainSlug],
  abi: CitizenABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

const teamContract = getContract({
  address: TEAM_ADDRESSES[chainSlug],
  abi: TeamABI as any,
  client: serverClient,
  chain: DEFAULT_CHAIN_V5,
})

async function ownsCitizen(
  walletAddresses: string[],
  tokenId: number
): Promise<boolean> {
  for (const address of walletAddresses) {
    try {
      const owned = await readContract({
        contract: citizenContract,
        method: 'getOwnedToken' as string,
        params: [address],
      })
      if (owned !== undefined && owned !== null && Number(owned) === tokenId) {
        return true
      }
    } catch {
      // getOwnedToken reverts when the address owns no Citizen — keep scanning.
    }
  }
  return false
}

async function managesTeam(
  walletAddresses: string[],
  tokenId: number
): Promise<boolean> {
  for (const address of walletAddresses) {
    try {
      const isManager = await readContract({
        contract: teamContract,
        method: 'isManager' as string,
        params: [tokenId, address],
      })
      if (isManager) return true
    } catch {
      // ignore and keep scanning
    }
  }
  return false
}

export type OwnershipResult = {
  ok: boolean
  walletAddresses: string[]
  reason?: string
}

// Verify that the holder of `accessToken` is allowed to act as the given owner.
export async function verifyScenarioOwnership(
  accessToken: string,
  ownerType: 'citizen' | 'team',
  ownerTokenId: number
): Promise<OwnershipResult> {
  const privyUserData = await getPrivyUserData(accessToken)
  if (!privyUserData) {
    return { ok: false, walletAddresses: [], reason: 'invalid_token' }
  }
  const { walletAddresses } = privyUserData
  if (walletAddresses.length === 0) {
    return { ok: false, walletAddresses, reason: 'no_wallets' }
  }

  const ok =
    ownerType === 'citizen'
      ? await ownsCitizen(walletAddresses, ownerTokenId)
      : await managesTeam(walletAddresses, ownerTokenId)

  return { ok, walletAddresses, reason: ok ? undefined : 'not_owner' }
}
