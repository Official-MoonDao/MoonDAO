import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import {
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import queryTable from '../tableland/queryTable'
import { getChainSlug } from '../thirdweb/chain'
import { serverClient } from '../thirdweb/client'

export type MissionRow = {
  id: number
  teamId: number
  projectId: number
  fundingGoal: number
  [key: string]: any
}

export type TimeData = {
  deadline: number | undefined
  refundPeriod: number | undefined
}

export type MissionContractData = {
  metadataURI: string
  stage: bigint
  payHookAddress: string
  tokenAddress: string
  primaryTerminalAddress: string
  ruleset: any[]
}

/**
 * Fetch mission row from Tableland
 */
export async function fetchMissionRow(
  tokenId: string | number,
  chain: Chain = DEFAULT_CHAIN_V5
): Promise<MissionRow | null> {
  const chainSlug = getChainSlug(chain)
  const missionTableName = MISSION_TABLE_NAMES[chainSlug]
  if (!missionTableName) {
    throw new Error(
      `No Tableland mission table configured for chain slug "${chainSlug}" (chain id ${chain.id}). ` +
        `Add MISSION_TABLE_NAMES["${chainSlug}"] in const/config.ts, or use a chain that already has mission entries (e.g. sepolia).`
    )
  }
  const statement = `SELECT * FROM ${missionTableName} WHERE id = ${tokenId}`

  const missionRows = await queryTable(chain, statement)
  return missionRows?.[0] || null
}

/**
 * Fetch deadline and refund period from PayHook contract
 */
export async function fetchTimeData(
  payHookAddress: string,
  chain: Chain = DEFAULT_CHAIN_V5
): Promise<TimeData> {
  if (!payHookAddress || payHookAddress === '0x0000000000000000000000000000000000000000') {
    return { deadline: undefined, refundPeriod: undefined }
  }

  try {
    const payHookContract = getContract({
      client: serverClient,
      address: payHookAddress,
      chain: chain,
      abi: LaunchPadPayHookABI.abi as any,
    })

    const [deadline, refundPeriod] = await Promise.all([
      readContract({
        contract: payHookContract,
        method: 'deadline' as string,
        params: [],
      }).then((dl: any) => +dl.toString() * 1000),
      readContract({
        contract: payHookContract,
        method: 'refundPeriod' as string,
        params: [],
      }).then((rp: any) => +rp.toString() * 1000),
    ])

    return { deadline, refundPeriod }
  } catch (error) {
    console.warn('Failed to fetch time data from PayHook:', error)
    return { deadline: undefined, refundPeriod: undefined }
  }
}

/**
 * Fetch mission contract data (stage, payHook, token, terminal, ruleset)
 */
export async function fetchMissionContracts(
  projectId: number,
  tokenId: string | number,
  chain: Chain = DEFAULT_CHAIN_V5
): Promise<MissionContractData> {
  const chainSlug = getChainSlug(chain)

  const missionCreatorAddress = MISSION_CREATOR_ADDRESSES[chainSlug]
  if (
    !missionCreatorAddress ||
    missionCreatorAddress === '0x0000000000000000000000000000000000000000'
  ) {
    throw new Error(
      `No MissionCreator contract configured for chain slug "${chainSlug}" (chain id ${chain.id}). ` +
        `Add MISSION_CREATOR_ADDRESSES["${chainSlug}"] in const/config.ts (and matching Tableland config), ` +
        `or set NEXT_PUBLIC_TEST_CHAIN to sepolia if missions are only deployed there.`
    )
  }

  if (projectId == null || !Number.isFinite(Number(projectId))) {
    throw new Error(`Invalid mission projectId for contract reads: ${String(projectId)}`)
  }

  const jbControllerContract = getContract({
    client: serverClient,
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi as any,
    chain: chain,
  })

  const jbDirectoryContract = getContract({
    client: serverClient,
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi as any,
    chain: chain,
  })

  const jbTokensContract = getContract({
    client: serverClient,
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi as any,
    chain: chain,
  })

  const missionCreatorContract = getContract({
    client: serverClient,
    address: missionCreatorAddress,
    abi: MissionCreator.abi as any,
    chain: chain,
  })

  const zeroAddr = '0x0000000000000000000000000000000000000000'

  const [metadataURI, stage, payHookAddress, tokenAddress, primaryTerminalAddress, ruleset] =
    await Promise.all([
      readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [projectId],
      }).catch((err) => {
        console.warn(
          `[fetchMissionContracts] uriOf failed (projectId=${projectId}):`,
          err
        )
        return ''
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [tokenId],
      }).catch((err) => {
        console.warn(`[fetchMissionContracts] stage failed (tokenId=${tokenId}):`, err)
        return BigInt(0)
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [tokenId],
      }).catch(() => zeroAddr),
      readContract({
        contract: jbTokensContract,
        method: 'tokenOf' as string,
        params: [projectId],
      }).catch((err) => {
        console.warn(
          `[fetchMissionContracts] tokenOf failed (projectId=${projectId}):`,
          err
        )
        return zeroAddr
      }),
      readContract({
        contract: jbDirectoryContract,
        method: 'primaryTerminalOf' as string,
        params: [projectId, JB_NATIVE_TOKEN_ADDRESS],
      }).catch(() => zeroAddr),
      readContract({
        contract: jbControllerContract,
        method: 'currentRulesetOf' as string,
        params: [projectId],
      }).catch(() => null),
    ])

  return {
    metadataURI,
    stage,
    payHookAddress,
    tokenAddress,
    primaryTerminalAddress,
    ruleset,
  }
}

export async function getMissionServerData(
  tokenId: string | number,
  chain: Chain = DEFAULT_CHAIN_V5
) {
  const missionRow = await fetchMissionRow(tokenId, chain)

  if (!missionRow) {
    return null
  }

  const contractData = await fetchMissionContracts(missionRow.projectId, tokenId, chain)

  const timeData = await fetchTimeData(contractData.payHookAddress, chain)

  return {
    missionRow,
    contractData,
    timeData,
  }
}
