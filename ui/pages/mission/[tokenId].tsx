import { DEFAULT_CHAIN_V5 } from 'const/config'
import { BLOCKED_MISSIONS, GATED_MISSIONS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { fetchFromIPFSWithFallback, getIPFSGateway } from '@/lib/ipfs/gateway'
import {
  fetchMissionFundingStats,
  type MissionFundingStats,
} from '@/lib/mission/fetchMissionFundingStats'
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
  /** Aggregated funding stats (total contributions, unique backers, median
   *  / mean / largest contribution amounts in wei) computed from the full
   *  payEvents list at SSR time. Powers the wrapped-up "campaign success"
   *  panel on the Overview Flight mission page. Only provided for mission 4. */
  _overviewStats?: MissionFundingStats | null
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
  _overviewStats,
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
          _overviewStats={_overviewStats}
        />
      </JuiceProviders>
    </>
  )
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      const raw = v.join('=')
      let decoded: string
      try {
        decoded = decodeURIComponent(raw)
      } catch {
        decoded = raw
      }
      return [k, decoded]
    })
  )
}

function setNoStoreHeaders(res: {
  setHeader: (name: string, value: string) => void
}) {
  // Cover browser, Vercel CDN, and intermediary caches. Setting only
  // Cache-Control is not enough on Vercel — CDN-Cache-Control / Vercel-CDN-
  // Cache-Control can still keep a public HIT of a pre-gate page.
  const value = 'private, no-store, no-cache, must-revalidate, max-age=0'
  res.setHeader('Cache-Control', value)
  res.setHeader('CDN-Cache-Control', value)
  res.setHeader('Vercel-CDN-Cache-Control', value)
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  // Prevent any intermediary that ignores no-store from serving a
  // cookie-authenticated response to an anonymous visitor (or vice versa).
  res.setHeader('Vary', 'Cookie')
}

export const getServerSideProps: GetServerSideProps = async ({
  params,
  query,
  req,
  res,
}) => {
  const tokenId: any = params?.tokenId
  const missionIdNumEarly =
    tokenId !== undefined && !isNaN(Number(tokenId)) ? Number(tokenId) : NaN
  const isGatedEarly =
    Number.isFinite(missionIdNumEarly) && GATED_MISSIONS.has(missionIdNumEarly)

  // Decide cache policy BEFORE any early return. Gated missions must never
  // receive a public Cache-Control — a stale CDN HIT of the pre-gate page is
  // exactly how /mission/4 stayed publicly reachable after the gate shipped.
  if (isGatedEarly) {
    setNoStoreHeaders(res)
  } else {
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120'
    )
  }

  // Handle dummy mission for testing
  if (tokenId === 'dummy') {
    // Allow overriding stage via ?stage= query param (default: 3 = refundable)
    const stageParam = query?.stage
    const dummyStage = stageParam ? Number(stageParam) : 3
    // Deadlines must be far enough out that the page state cannot flip while
    // an E2E test is still asserting. A near-future deadline (this used to be
    // now+5s) made `deadlinePassed` turn true mid-test on slow remote
    // browsers (BrowserStack tunnel), swapping the header's "REFUND" label
    // for a close date and randomly failing mission-refund.cy.ts.
    const dummyDeadline =
      dummyStage === 4
        ? Date.now() - 86400 * 1000 // deadline in the past for closed missions
        : Date.now() + 7 * 86400 * 1000
    const dummyRefundPeriod =
      dummyStage === 4
        ? Date.now() - 3600 * 1000 // refund period in the past for closed missions
        : Date.now() + 14 * 86400 * 1000

    return {
      props: {
        mission: {
          // Must be the literal 'dummy' so client hooks (refreshStage,
          // useMissionFundingStage) skip live on-chain reads. With a numeric
          // id here the page raced real contract state for that mission id
          // and the rendered stage depended on RPC health — the other source
          // of random E2E failures.
          id: 'dummy',
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

  // A mission may be hidden from public listings (BLOCKED_MISSIONS) yet still reachable
  // on this page with an access code (GATED_MISSIONS) — used for a private, shareable
  // end-to-end test of an unannounced mission. A blocked-but-not-gated mission stays
  // fully 404'd.
  const missionIdNum = Number(tokenId)
  const isGated = GATED_MISSIONS.has(missionIdNum)
  if (BLOCKED_MISSIONS.has(missionIdNum) && !isGated) {
    return { notFound: true }
  }
  if (isGated) {
    // Headers already set above via isGatedEarly; re-assert so any later
    // middleware/helper cannot reintroduce a public cache policy.
    setNoStoreHeaders(res)

    const accessCode = process.env.MISSION_ACCESS_CODE
    if (!accessCode) {
      // Default-deny when the deploy hasn't been configured with an access code,
      // so a misconfigured environment can't accidentally expose the mission via
      // a fallback string committed to source.
      return { notFound: true }
    }

    const cookies = parseCookies(req?.headers?.cookie)
    const queryAccess =
      typeof query?.access === 'string' ? query.access : undefined
    const provided = queryAccess || cookies['mission_access']
    if (provided !== accessCode) {
      return { notFound: true }
    }
    // Persist access so tab/query navigation works without re-passing ?access=.
    res.setHeader(
      'Set-Cookie',
      `mission_access=${accessCode}; Path=/; Max-Age=604800; SameSite=Lax`
    )
    // If the code came in on the query string, redirect to the bare mission URL
    // so the secret is stripped from the address bar, browser history, and any
    // referrer headers sent by resources the mission page loads.
    if (queryAccess) {
      return {
        redirect: {
          destination: `/mission/${tokenId}`,
          permanent: false,
        },
      }
    }
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

      // The Overview Flight raise is wrapped up — its mission page now
      // surfaces success metrics (total/unique backers, median contribution)
      // instead of a live progress bar. Compute them at SSR time so they
      // ship in the initial HTML and benefit from the page's s-maxage cache
      // rather than triggering a separate client-side subgraph round-trip.
      const overviewStatsPromise: Promise<MissionFundingStats | null | undefined> =
        isOverviewMission
          ? fetchMissionFundingStats(missionRow.projectId).catch((error) => {
              console.warn('[mission/4] funding stats fetch failed:', error)
              return null
            })
          : Promise.resolve(undefined)

      // Longer per-gateway timeout on SSR — 3s was too aggressive from Vercel
      // regions and left mission pages stuck on the "Mission Loading..." fallback.
      const metadata = await fetchFromIPFSWithFallback(ipfsHash, 8000).catch(
        (error: any) => {
          console.warn('All IPFS gateways failed:', error)
          return {
            name: 'Mission Loading...',
            description: 'Metadata is loading...',
            logoUri: '',
          }
        }
      )

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

      const [_overviewLeaderboardFull, _overviewStatsResult] = await Promise.all([
        overviewLeaderboardPromise,
        overviewStatsPromise,
      ])

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
          ...(_overviewStatsResult !== undefined
            ? { _overviewStats: _overviewStatsResult }
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
