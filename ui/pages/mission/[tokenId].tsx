import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  IPFS_GATEWAY,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_NAMES,
  TEAM_ADDRESSES,
} from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { getBackers } from '@/lib/mission'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { Mission } from '@/components/mission/MissionCard'
import MissionProfile from '@/components/mission/MissionProfile'

const CHAIN = DEFAULT_CHAIN_V5
const CHAIN_SLUG = getChainSlug(CHAIN)

const jbControllerContract = getContract({
  client: serverClient,
  address: JBV5_CONTROLLER_ADDRESS,
  abi: JBV5Controller.abi as any,
  chain: CHAIN,
})

const jbDirectoryContract = getContract({
  client: serverClient,
  address: JBV5_DIRECTORY_ADDRESS,
  abi: JBV5Directory.abi as any,
  chain: CHAIN,
})

const missionCreatorContract = getContract({
  client: serverClient,
  address: MISSION_CREATOR_ADDRESSES[CHAIN_SLUG],
  abi: MissionCreator.abi as any,
  chain: CHAIN,
})

const IPFS_GATEWAYS = [
  IPFS_GATEWAY,
  'https://cf-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
]

// Try multiple IPFS gateways with timeout
const fetchFromIPFSWithFallback = async (ipfsHash: string, timeout = 3000) => {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await Promise.race([
        fetch(`${gateway}${ipfsHash}`),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('IPFS fetch timeout')), timeout)
        ),
      ])

      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.warn(`Failed to fetch from gateway ${gateway}:`, error)
      continue // Try next gateway
    }
  }

  // All gateways failed, return fallback
  throw new Error('All IPFS gateways failed')
}

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
  _stage: number
  _deadline: number | undefined
  _refundPeriod: number | undefined
  _primaryTerminalAddress: string
  _token?: any
  _teamNFT?: any
  _teamHats?: any[]
  _fundingGoal: number
  _ruleset: any[]
  _backers: any[]
  _citizens: any[]
}

export default function MissionProfilePage({
  mission,
  _stage,
  _deadline,
  _refundPeriod,
  _primaryTerminalAddress,
  _token,
  _teamNFT,
  _teamHats,
  _fundingGoal,
  _ruleset,
  _backers,
  _citizens,
}: ProjectProfileProps) {
  const selectedChain = DEFAULT_CHAIN_V5

  return (
    <JuiceProviders
      projectId={mission?.projectId}
      selectedChain={selectedChain}
    >
      <MissionProfile
        mission={mission}
        _stage={_stage}
        _deadline={_deadline}
        _refundPeriod={_refundPeriod}
        _primaryTerminalAddress={_primaryTerminalAddress}
        _token={_token}
        _teamNFT={_teamNFT}
        _teamHats={_teamHats}
        _fundingGoal={_fundingGoal}
        _ruleset={_ruleset}
        _backers={_backers}
        _citizens={_citizens}
      />
    </JuiceProviders>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const tokenId: any = params?.tokenId

    if (tokenId === 'dummy') {
      return {
        props: {
          mission: {
            id: 5,
            metadata: {
              name: 'Dummy Mission',
              description: 'This is a dummy mission',
              logoUri: '/Original.png',
            },
            projectId: 224,
            teamId: 1,
          },
          _stage: 3,
          _deadline: Date.now() + 5 * 1000,
          _refundPeriod: Date.now() + 60 * 1000, // 1 minute after deadline
          _primaryTerminalAddress: '0x0000000000000000000000000000000000000000',
          _token: {
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenName: 'Dummy Token',
            tokenSymbol: 'DUMMY',
            tokenSupply: '1000000000000000000000000000',
          },
        },
      }
    }

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    if (tokenId === undefined || isNaN(Number(tokenId))) {
      return {
        notFound: true,
      }
    }

    const missionTableName = MISSION_TABLE_NAMES[chainSlug]
    const statement = `SELECT * FROM ${missionTableName} WHERE id = ${tokenId}`

    const missionRows = await queryTable(chain, statement)

    const missionRow = missionRows?.[0]

    if (!missionRow || BLOCKED_MISSIONS.has(Number(tokenId))) {
      return {
        notFound: true,
      }
    }

    // Create jbTokensContract for token data fetching
    const jbTokensContract = getContract({
      client: serverClient,
      address: JBV5_TOKENS_ADDRESS,
      abi: JBV5Tokens.abi as any,
      chain: chain,
    })

    const [
      metadataURI,
      stage,
      payHookAddress,
      tokenAddress,
      primaryTerminalAddress,
      ruleset,
    ] = await Promise.all([
      readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [missionRow.projectId],
      }).then((result) => {
        return result
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [tokenId],
      }).then((result) => {
        return result
      }),
      readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [tokenId],
      })
        .then((result) => {
          return result
        })
        .catch(() => null), // Don't fail if this fails
      readContract({
        contract: jbTokensContract,
        method: 'tokenOf' as string,
        params: [missionRow.projectId],
      }),
      readContract({
        contract: jbDirectoryContract,
        method: 'primaryTerminalOf' as string,
        params: [missionRow.projectId, JB_NATIVE_TOKEN_ADDRESS],
      }).catch((e) => '0x0000000000000000000000000000000000000000'), // Default to zero address if fetch fails
      readContract({
        contract: jbControllerContract,
        method: 'currentRulesetOf' as string,
        params: [missionRow.projectId],
      }).catch((e) => null), // Don't fail if this fails
    ])

    const ipfsHash = metadataURI.startsWith('ipfs://')
      ? metadataURI.replace('ipfs://', '')
      : metadataURI

    const promises = [
      // IPFS metadata fetch with multiple gateway fallbacks
      fetchFromIPFSWithFallback(ipfsHash).catch((error: any) => {
        console.warn('All IPFS gateways failed:', error)
        return {
          name: 'Mission Loading...',
          description: 'Metadata is loading...',
          logoUri: '',
        }
      }),
    ]

    if (
      payHookAddress &&
      payHookAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      const payHookContract = getContract({
        client: serverClient,
        address: payHookAddress,
        chain: chain,
        abi: LaunchPadPayHookABI.abi as any,
      })

      // Fetch both deadline and refundPeriod
      promises.push(
        Promise.all([
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
        ]).catch(() => [undefined, undefined])
      )
    }

    const [metadata, timeData] = await Promise.all(promises)

    // Extract deadline and refundPeriod
    const deadline = Array.isArray(timeData) ? timeData[0] : timeData
    const refundPeriod = Array.isArray(timeData) ? timeData[1] : undefined

    // Fetch token data if token address exists
    let tokenData = {
      tokenAddress: tokenAddress || '',
      tokenName: '',
      tokenSymbol: '',
      tokenSupply: '',
      reservedTokens: '',
      reservedRate: '',
    }

    if (
      tokenAddress &&
      tokenAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      try {
        const tokenContract = getContract({
          client: serverClient,
          address: tokenAddress,
          abi: JBV5Token as any,
          chain: chain,
        })

        const [nameResult, symbolResult, supplyResult] =
          await Promise.allSettled([
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

    const mission: any = {
      id: missionRow.id,
      teamId: missionRow.teamId,
      projectId: missionRow.projectId,
      metadata: metadata,
    }

    // Fetch team data and hats if teamId exists
    let teamNFT: any = null
    let teamHats: any[] = []

    if (mission.teamId !== undefined) {
      try {
        // Create team contract
        const teamContract = getContract({
          client: serverClient,
          address: TEAM_ADDRESSES[chainSlug],
          abi: TeamABI as any,
          chain: chain,
        })

        // Fetch team NFT data
        teamNFT = await getNFT({
          contract: teamContract,
          tokenId: BigInt(mission.teamId),
        })

        if (teamNFT) {
          teamNFT = {
            ...teamNFT,
            metadata: { ...teamNFT.metadata, id: teamNFT.id.toString() },
          }

          // Fetch admin hat ID from team contract
          const adminHatId = await readContract({
            contract: teamContract,
            method: 'teamAdminHat' as string,
            params: [mission.teamId],
          })

          if (adminHatId) {
            // Fetch sub-hats using the hats subgraph client
            const hat = await hatsSubgraphClient.getHat({
              chainId: chain.id,
              hatId: adminHatId.toString(),
              props: {
                subHats: {
                  props: {
                    details: true,
                    wearers: {
                      props: {},
                    },
                    subHats: {
                      props: {
                        details: true,
                        wearers: {
                          props: {},
                        },
                      },
                    },
                  },
                },
              },
            })

            if (hat?.subHats) {
              const subHatsLevel1 = hat.subHats
              const subHatsLevel2 = subHatsLevel1
                ?.map((hat: any) => hat.subHats)
                .flat()
              teamHats = subHatsLevel1.concat(subHatsLevel2)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch team data or hats:', error)
        // Continue without team data if fetch fails
      }
    }

    const _ruleset = [
      { weight: +ruleset[0].weight.toString() },
      { reservedPercent: +ruleset[1].reservedPercent.toString() },
    ]

    let _backers: any[] = []
    try {
      _backers = await getBackers(mission.projectId, mission.id)
    } catch (err) {
      _backers = []
      console.error('Failed to fetch backers:', err)
    }
    const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}
     WHERE owner IN (${_backers
       .map((backer) => `"${backer.backer}"`)
       .join(',')})`
    const _citizens = await queryTable(chain, citizenStatement)

    return {
      props: {
        mission,
        _stage: +stage.toString(),
        _deadline: deadline,
        _refundPeriod: refundPeriod,
        _primaryTerminalAddress: primaryTerminalAddress,
        _token: tokenData,
        _teamNFT: {
          ...teamNFT,
          id: teamNFT.id.toString(),
        },
        _teamHats: teamHats,
        _fundingGoal: missionRow.fundingGoal,
        _ruleset,
        _backers,
        _citizens,
      },
    }
  } catch (error) {
    console.error('getServerSideProps error:', error)
    return {
      notFound: true,
    }
  }
}
