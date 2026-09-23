// Server-only ownership checks for Lunar Atlas curator write routes.
//
// Atlas content is MoonDAO-curated: the only writers are Citizens (by NFT) or
// Team managers. This mirrors the ownership scaffolding from the retired sim so
// the curator API can gate writes without a bespoke auth system.

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

async function ownsCitizen(walletAddresses: string[]): Promise<boolean> {
  for (const address of walletAddresses) {
    try {
      const owned = await readContract({
        contract: citizenContract,
        method: 'getOwnedToken' as string,
        params: [address],
      })
      if (owned !== undefined && owned !== null) return true
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

export type CuratorAuth =
  | { kind: 'citizen' }
  | { kind: 'team'; teamTokenId: number }

export type OwnershipResult = {
  ok: boolean
  walletAddresses: string[]
  reason?: string
}

// Verify that the holder of `accessToken` is allowed to curate the atlas: any
// Citizen, or a manager of the given Team.
export async function verifyAtlasCurator(
  accessToken: string,
  auth: CuratorAuth
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
    auth.kind === 'citizen'
      ? await ownsCitizen(walletAddresses)
      : await managesTeam(walletAddresses, auth.teamTokenId)

  return { ok, walletAddresses, reason: ok ? undefined : 'not_authorized' }
}
