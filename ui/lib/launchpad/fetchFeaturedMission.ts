import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import {
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
} from 'const/config'
import { FEATURED_MISSION_INDEX } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getBackers } from '@/lib/mission'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { ChainType, FeaturedMissionData, Mission } from './types'

export async function fetchFeaturedMissionData(
  missions: Mission[],
  chain: ChainType,
  chainSlug: string,
  jbV5ControllerAddress: string,
  jbV5ControllerAbi: unknown
): Promise<FeaturedMissionData | null> {
  try {
    const featuredMission =
      missions.find(
        (mission: Mission) =>
          mission.projectId &&
          parseInt(mission.projectId) > 0 &&
          mission.fundingGoal &&
          mission.fundingGoal > 0
      ) ||
      (missions.length > 0 && FEATURED_MISSION_INDEX !== null
        ? missions[FEATURED_MISSION_INDEX] || missions[0]
        : null)

    if (!featuredMission || !featuredMission.projectId) {
      return null
    }

    const jbDirectoryContract = getContract({
      client: serverClient,
      address: JBV5_DIRECTORY_ADDRESS,
      abi: JBV5Directory.abi as any,
      chain: chain,
    })

    const missionCreatorContract = getContract({
      client: serverClient,
      address: MISSION_CREATOR_ADDRESSES[chainSlug],
      abi: MissionCreator.abi as any,
      chain: chain,
    })

    const jbTokensContract = getContract({
      client: serverClient,
      address: JBV5_TOKENS_ADDRESS,
      abi: JBV5Tokens.abi as any,
      chain: chain,
    })

    const jbV5ControllerContract = getContract({
      client: serverClient,
      address: jbV5ControllerAddress,
      abi: jbV5ControllerAbi as any,
      chain: chain,
    })

    const [stage, payHookAddress, tokenAddress, primaryTerminalAddress, ruleset] =
      await Promise.all([
        readContract({
          contract: missionCreatorContract,
          method: 'stage' as string,
          params: [featuredMission.id],
        }).catch(() => null),
        readContract({
          contract: missionCreatorContract,
          method: 'missionIdToPayHook' as string,
          params: [featuredMission.id],
        }).catch(() => null),
        readContract({
          contract: jbTokensContract,
          method: 'tokenOf' as string,
          params: [featuredMission.projectId],
        }).catch(() => null),
        readContract({
          contract: jbDirectoryContract,
          method: 'primaryTerminalOf' as string,
          params: [featuredMission.projectId, JB_NATIVE_TOKEN_ADDRESS],
        }).catch(() => '0x0000000000000000000000000000000000000000'),
        readContract({
          contract: jbV5ControllerContract,
          method: 'currentRulesetOf' as string,
          params: [featuredMission.projectId],
        }).catch(() => null),
      ])

    let deadline: number | undefined = undefined
    let refundPeriod: number | undefined = undefined

    if (payHookAddress && payHookAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const payHookContract = getContract({
          client: serverClient,
          address: payHookAddress,
          chain: chain,
          abi: LaunchPadPayHookABI.abi as any,
        })

        const [dl, rp] = await Promise.all([
          readContract({
            contract: payHookContract,
            method: 'deadline' as string,
            params: [],
          }).catch(() => null),
          readContract({
            contract: payHookContract,
            method: 'refundPeriod' as string,
            params: [],
          }).catch(() => null),
        ])

        if (dl) deadline = +dl.toString() * 1000
        if (rp) refundPeriod = +rp.toString() * 1000
      } catch (error) {
        console.warn('Failed to fetch deadline/refundPeriod:', error)
      }
    }

    let tokenData: FeaturedMissionData['_token'] = {
      tokenAddress: tokenAddress || '',
      tokenName: '',
      tokenSymbol: '',
      tokenSupply: '',
    }

    if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const tokenContract = getContract({
          client: serverClient,
          address: tokenAddress,
          abi: JBV5Token as any,
          chain: chain,
        })

        const [nameResult, symbolResult, supplyResult] = await Promise.allSettled([
          readContract({
            contract: tokenContract,
            method: 'name' as string,
            params: [],
          }),
          readContract({
            contract: tokenContract,
            method: 'symbol' as string,
            params: [],
          }),
          readContract({
            contract: tokenContract,
            method: 'totalSupply' as string,
            params: [],
          }),
        ])

        if (nameResult.status === 'fulfilled' && nameResult.value) {
          tokenData.tokenName = nameResult.value
        }
        if (symbolResult.status === 'fulfilled' && symbolResult.value) {
          tokenData.tokenSymbol = symbolResult.value
        }
        if (supplyResult.status === 'fulfilled' && supplyResult.value) {
          tokenData.tokenSupply = supplyResult.value.toString()
        }
      } catch (error) {
        console.warn('Failed to fetch token data:', error)
      }
    }

    const _ruleset = ruleset
      ? [
          { weight: +ruleset[0].weight.toString() },
          { reservedPercent: +ruleset[1].reservedPercent.toString() },
        ]
      : null

    let _backers: FeaturedMissionData['_backers'] = []
    try {
      _backers = await getBackers(featuredMission.projectId, featuredMission.id)
    } catch (err) {
      console.warn('Failed to fetch backers:', err)
    }

    return {
      mission: featuredMission,
      _stage: stage ? +stage.toString() : 1,
      _deadline: deadline,
      _refundPeriod: refundPeriod,
      _primaryTerminalAddress: primaryTerminalAddress,
      _token: tokenData,
      _fundingGoal: featuredMission.fundingGoal || 0,
      _ruleset: _ruleset as any[] | null,
      _backers: _backers,
      projectMetadata: featuredMission.metadata,
    }
  } catch (error) {
    console.warn('Failed to fetch featured mission data:', error)
    return null
  }
}
