import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { getBackers } from '@/lib/mission'
import { getMissionServerData } from '@/lib/mission/fetchMissionServerData'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'
import queryTable from '@/lib/tableland/queryTable'
import { fetchTeamNFTAndHats } from '@/lib/team/fetchTeamServerData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { Mission } from '@/components/mission/MissionCard'
import MissionProfile from '@/components/mission/MissionProfile'

const CHAIN = DEFAULT_CHAIN_V5
const CHAIN_SLUG = getChainSlug(CHAIN)

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
    <JuiceProviders projectId={mission?.projectId} selectedChain={selectedChain}>
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

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  try {
    const tokenId: any = params?.tokenId

    // Handle dummy mission for testing
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
          _refundPeriod: Date.now() + 60 * 1000,
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

    // Validate tokenId
    if (tokenId === undefined || isNaN(Number(tokenId))) {
      return { notFound: true }
    }

    // Check if mission is blocked
    if (BLOCKED_MISSIONS.has(Number(tokenId))) {
      return { notFound: true }
    }

    // Fetch all mission server data
    const missionData = await getMissionServerData(tokenId, chain)

    if (!missionData || !missionData.missionRow) {
      return { notFound: true }
    }

    const { missionRow, contractData, timeData } = missionData

    // Fetch IPFS metadata
    const ipfsHash = contractData.metadataURI.startsWith('ipfs://')
      ? contractData.metadataURI.replace('ipfs://', '')
      : contractData.metadataURI

    const metadata = await fetchFromIPFSWithFallback(ipfsHash).catch((error: any) => {
      console.warn('All IPFS gateways failed:', error)
      return {
        name: 'Mission Loading...',
        description: 'Metadata is loading...',
        logoUri: '',
      }
    })

    // Fetch token data
    const tokenData = await fetchTokenMetadata(contractData.tokenAddress, chain)

    // Create mission object
    const mission: any = {
      id: missionRow.id,
      teamId: missionRow.teamId,
      projectId: missionRow.projectId,
      metadata: metadata,
    }

    // Fetch team NFT and hats
    const { teamNFT, teamHats } = await fetchTeamNFTAndHats(mission.teamId, chain)

    // Format ruleset
    const _ruleset = contractData.ruleset
      ? [
          { weight: +contractData.ruleset[0].weight.toString() },
          { reservedPercent: +contractData.ruleset[1].reservedPercent.toString() },
        ]
      : [{ weight: 0 }, { reservedPercent: 0 }]

    // Fetch backers
    let _backers: any[] = []
    try {
      _backers = await getBackers(mission.projectId, mission.id)
    } catch (err: any) {
      _backers = []
      console.error('[Mission SSR] Failed to fetch backers:', {
        tokenId,
        projectId: mission.projectId,
        error: err?.message,
      })
    }

    // Only query citizens if there are backers (prevents invalid SQL)
    let _citizens: any[] = []
    if (_backers.length > 0) {
      try {
        const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}
         WHERE owner IN (${_backers.map((backer) => `"${backer.backer}"`).join(',')})`
        _citizens = await queryTable(chain, citizenStatement)
      } catch (err: any) {
        console.error('[Mission SSR] Failed to fetch citizens:', {
          tokenId,
          projectId: mission.projectId,
          backersCount: _backers.length,
          error: err?.message,
        })
        _citizens = []
      }
    }

    return {
      props: {
        mission,
        _stage: +contractData.stage.toString(),
        _deadline: timeData.deadline,
        _refundPeriod: timeData.refundPeriod,
        _primaryTerminalAddress: contractData.primaryTerminalAddress,
        _token: tokenData,
        _teamNFT: teamNFT ? { ...teamNFT, id: teamNFT.id.toString() } : null,
        _teamHats: teamHats,
        _fundingGoal: missionRow.fundingGoal,
        _ruleset,
        _backers,
        _citizens,
      },
    }
  } catch (error: any) {
    return {
      notFound: true,
    }
  }
}
