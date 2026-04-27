import { DEFAULT_CHAIN_V5 } from 'const/config'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { fetchFromIPFSWithFallback, getIPFSGateway } from '@/lib/ipfs/gateway'
import { getMissionServerData } from '@/lib/mission/fetchMissionServerData'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'
import { fetchOverviewLeaderboard } from '@/lib/overview-delegate/fetchLeaderboard'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import { fetchTeamNFTAndHats } from '@/lib/team/fetchTeamServerData'
import Head from '@/components/layout/Head'
import { Mission } from '@/components/mission/MissionCard'
import MissionProfile from '@/components/mission/MissionProfile'

const JuiceProviders = dynamic(() => import('@/lib/juicebox/JuiceProviders'), {
  ssr: false,
})

const CHAIN = DEFAULT_CHAIN_V5

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ProjectProfileProps = {
  tokenId: string
  mission: Mission
  _stage: number
  _deadline: number | null
  _refundPeriod: number | null
  _primaryTerminalAddress: string
  _token?: any
  _teamNFT?: any
  _teamHats?: any[]
  _fundingGoal: number
  _ruleset: any[]
  _overviewLeaderboard?: LeaderboardEntry[]
  /** $OVERVIEW total backing the candidate currently sitting at rank 25 on
   *  the leaderboard. `null` when fewer than 25 candidates exist. Only
   *  provided for the Overview Flight mission (id 4). */
  _overviewTop25Threshold?: number | null
  /** Number of citizens currently ranked on the $OVERVIEW leaderboard
   *  (those with a registered Citizen NFT and at least one backer). Drives
   *  honest copy in the Fly with Frank explainer when the top 25 isn't
   *  full yet. Only provided for the Overview Flight mission. */
  _overviewRankedCount?: number
}

/** Mission ID for the Overview Flight fundraiser; used to opportunistically
 *  hydrate the $OVERVIEW leaderboard preview rendered on its mission page. */
const OVERVIEW_MISSION_ID = 4

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
  _overviewLeaderboard,
  _overviewTop25Threshold,
  _overviewRankedCount,
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
          _overviewLeaderboard={_overviewLeaderboard}
          _overviewTop25Threshold={_overviewTop25Threshold}
          _overviewRankedCount={_overviewRankedCount}
        />
      </JuiceProviders>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

  const tokenId: any = params?.tokenId

  // Handle dummy mission for testing
  if (tokenId === 'dummy') {
    // Allow overriding stage via ?stage= query param (default: 3 = refundable)
    const stageParam = query?.stage
    const dummyStage = stageParam ? Number(stageParam) : 3
    const dummyDeadline =
      dummyStage === 4
        ? Date.now() - 86400 * 1000 // deadline in the past for closed missions
        : Date.now() + 5 * 1000
    const dummyRefundPeriod =
      dummyStage === 4
        ? Date.now() - 3600 * 1000 // refund period in the past for closed missions
        : Date.now() + 60 * 1000

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
        _stage: dummyStage,
        _deadline: dummyDeadline,
        _refundPeriod: dummyRefundPeriod,
        _primaryTerminalAddress: '0x0000000000000000000000000000000000000000',
        _token: {
          tokenAddress: '0x0000000000000000000000000000000000000000',
          tokenName: 'Dummy Token',
          tokenSymbol: 'DUMMY',
          tokenSupply: '1000000000000000000000000000',
        },
        _teamNFT: null,
        _teamHats: [],
        _fundingGoal: 1000000000000000000, // 1 ETH
        _ruleset: [
          { weight: 1000000000000000000000000 },
          { reservedPercent: 0 },
        ],
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

  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const missionData = await getMissionServerData(tokenId, chain)

      if (!missionData || !missionData.missionRow) {
        return { notFound: true }
      }

      const { missionRow, contractData, timeData } = missionData

      const ipfsHash = contractData.metadataURI.startsWith('ipfs://')
        ? contractData.metadataURI.replace('ipfs://', '')
        : contractData.metadataURI

      // Kick off the (mission-4-only) Overview leaderboard fetch in parallel
      // with the IPFS metadata + token metadata round-trips so it doesn't
      // serially extend page TTFB. We pull the full ranking (not just the
      // top 25) so we can simultaneously populate the leaderboard preview
      // (top 5), derive the live threshold to crack the top 25, and report
      // the actual ranked count to the explainer so it never makes a false
      // "fewer than 25 candidates" claim when a partial fetch happens to
      // truncate results.
      const isOverviewMission = Number(tokenId) === OVERVIEW_MISSION_ID
      const overviewLeaderboardPromise = isOverviewMission
        ? fetchOverviewLeaderboard().catch((error) => {
            console.warn(
              '[mission/4] overview leaderboard fetch failed:',
              error
            )
            return [] as LeaderboardEntry[]
          })
        : Promise.resolve(undefined)

      const metadata = await fetchFromIPFSWithFallback(ipfsHash).catch((error: any) => {
        console.warn('All IPFS gateways failed:', error)
        return {
          name: 'Mission Loading...',
          description: 'Metadata is loading...',
          logoUri: '',
        }
      })

      const tokenData = await fetchTokenMetadata(contractData.tokenAddress, chain)

      const mission: any = {
        id: missionRow.id,
        teamId: missionRow.teamId,
        projectId: missionRow.projectId,
        metadata: metadata,
      }

      const { teamNFT, teamHats } = await fetchTeamNFTAndHats(mission.teamId, chain)

      const _ruleset = contractData.ruleset
        ? [
            { weight: +contractData.ruleset[0].weight.toString() },
            { reservedPercent: +contractData.ruleset[1].reservedPercent.toString() },
          ]
        : [{ weight: 0 }, { reservedPercent: 0 }]

      const _overviewLeaderboardFull = await overviewLeaderboardPromise

      // Slice to the top 5 for the preview component (its existing UX),
      // pull the 25th-place backing total for the explainer's threshold
      // callout, and report the actual ranked count so the empty-state
      // copy stays factual when the top 25 isn't filled yet.
      const _overviewLeaderboard =
        _overviewLeaderboardFull !== undefined
          ? _overviewLeaderboardFull.slice(0, 5)
          : undefined
      const _overviewRankedCount =
        _overviewLeaderboardFull !== undefined
          ? _overviewLeaderboardFull.length
          : undefined
      const _overviewTop25Threshold =
        _overviewLeaderboardFull !== undefined
          ? _overviewLeaderboardFull.length >= 25
            ? _overviewLeaderboardFull[24].totalDelegated
            : null
          : undefined

      return {
        props: {
          mission,
          _stage: +contractData.stage.toString(),
          _deadline: timeData.deadline ?? null,
          _refundPeriod: timeData.refundPeriod ?? null,
          _primaryTerminalAddress: contractData.primaryTerminalAddress,
          _token: tokenData,
          _teamNFT: teamNFT ? { ...teamNFT, id: teamNFT.id.toString() } : null,
          _teamHats: teamHats,
          _fundingGoal: missionRow.fundingGoal,
          _ruleset,
          ...(_overviewLeaderboard !== undefined
            ? { _overviewLeaderboard }
            : {}),
          ...(_overviewTop25Threshold !== undefined
            ? { _overviewTop25Threshold }
            : {}),
          ...(_overviewRankedCount !== undefined
            ? { _overviewRankedCount }
            : {}),
        },
      }
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts - 1) {
        await sleep(400 * (attempt + 1))
        continue
      }
    }
  }

  console.error(
    `[mission/${tokenId}] getServerSideProps failed after ${maxAttempts} attempts:`,
    lastError
  )
  throw lastError
}
