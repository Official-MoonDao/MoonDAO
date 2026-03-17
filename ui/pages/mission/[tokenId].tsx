import { DEFAULT_CHAIN_V5 } from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import { getMissionServerData } from '@/lib/mission/fetchMissionServerData'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'
import { fetchTeamNFTAndHats } from '@/lib/team/fetchTeamServerData'
import Head from '@/components/layout/Head'
import { Mission } from '@/components/mission/MissionCard'
import MissionProfile from '@/components/mission/MissionProfile'

const JuiceProviders = dynamic(() => import('@/lib/juicebox/JuiceProviders'), {
  ssr: false,
})

const CHAIN = DEFAULT_CHAIN_V5

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
}: ProjectProfileProps) {
  const selectedChain = DEFAULT_CHAIN_V5

  return (
    <>
      <Head
        title={mission?.metadata?.name}
        image={mission?.metadata?.logoUri}
        description={mission?.metadata?.tagline}
      />
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
        />
      </JuiceProviders>
    </>
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
      },
    }
  } catch (error: any) {
    return {
      notFound: true,
    }
  }
}
