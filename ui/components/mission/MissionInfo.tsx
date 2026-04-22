import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import MissionActivityList from './MissionActivityList'
import MissionPayRedeem from './MissionPayRedeem'
import MissionSocialLinks from './MissionSocialLinks'
import MissionTimelineChart from './MissionTimelineChart'
import MissionTokenInfo from './MissionTokenInfo'
import OverviewLeaderboardPreview from './OverviewLeaderboardPreview'

export type MissionInfoTabType =
  | 'activity'
  | 'about'
  | 'tokenomics'
  | 'leaderboard'

/** Human-readable label for each tab. We map explicitly so we can use a
 *  multi-word label (e.g. "Fly with Frank") for the leaderboard tab without
 *  losing the title-cased fallback for the other tabs. */
const TAB_LABELS: Record<MissionInfoTabType, string> = {
  about: 'About',
  leaderboard: 'Fly with Frank',
  activity: 'Activity',
  tokenomics: 'Tokenomics',
}

function MissionInfoTab({
  tab,
  currentTab,
  setTab,
}: {
  tab: MissionInfoTabType
  currentTab: MissionInfoTabType
  setTab: (tab: MissionInfoTabType) => void
}) {
  const isActive = currentTab === tab
  return (
    <button
      className={`relative px-5 py-3 text-base md:text-lg font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${
        isActive
          ? 'text-white'
          : 'text-gray-500 hover:text-gray-300'
      }`}
      onClick={() => setTab(tab)}
    >
      {TAB_LABELS[tab]}
      {isActive && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-indigo-400 rounded-full" />
      )}
    </button>
  )
}

function MissionInfoHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
        <Image src={icon} alt="Section Icon" width={18} height={18} />
      </div>
      <h2 className="text-xl md:text-2xl font-GoodTimes text-white">
        {title}
      </h2>
    </div>
  )
}

export default function MissionInfo({
  selectedChain,
  mission,
  teamNFT,
  subgraphData,
  token,
  jbTokensContract,
  jbControllerContract,
  points,
  isLoadingPoints,
  range,
  setRange,
  primaryTerminalAddress,
  stage,
  deadline,
  refreshTotalFunding,
  ruleset,
  openContributeModal,
  setUsdInput,
  usdInput,
  fundingPickReady = false,
  recommendedChain = null,
  fundingChainBalances = null,
  fundingCompareEnabled = false,
  /** Pre-fetched $OVERVIEW leaderboard for the Overview Mission (id 4).
   *  When provided we surface a dedicated Leaderboard tab; for every other
   *  mission this is `undefined` and the tab is hidden. */
  _overviewLeaderboard,
}: any) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const showLeaderboardTab = Array.isArray(_overviewLeaderboard)

  /** Tabs in the order they should appear in the bar. The leaderboard slot
   *  sits right after "about" so the most actionable content for mission 4
   *  shows up early — but it's omitted entirely for missions that don't
   *  ship leaderboard data. */
  const visibleTabs = useMemo<MissionInfoTabType[]>(
    () =>
      showLeaderboardTab
        ? ['about', 'leaderboard', 'activity', 'tokenomics']
        : ['about', 'activity', 'tokenomics'],
    [showLeaderboardTab]
  )

  /** Resolve the initial tab from `?tab=`, falling back to "about" if the
   *  URL specifies a tab that isn't valid for this mission (e.g. someone
   *  shares a `?tab=leaderboard` link to a non-mission-4 page). */
  const resolveTab = (raw: unknown): MissionInfoTabType => {
    if (
      typeof raw === 'string' &&
      (visibleTabs as string[]).includes(raw)
    ) {
      return raw as MissionInfoTabType
    }
    return 'about'
  }

  const [tab, setTab] = useState<MissionInfoTabType>(
    resolveTab(router.query.tab)
  )

  useEffect(() => {
    if (router.query.tab) {
      setTab(resolveTab(router.query.tab))
    }
    // resolveTab depends on visibleTabs; including the latter triggers a
    // re-resolve if the leaderboard data arrives after first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, visibleTabs])

  useEffect(() => {
    if (!router.isReady || !mission?.id) return

    const queryParams: any = {
      tokenId: mission?.id,
      tab: tab,
    }

    // Only preserve query parameters that have meaningful values
    Object.keys(router.query).forEach((key) => {
      if (key !== 'tokenId' && key !== 'tab') {
        const value = router.query[key]
        // Only preserve if value exists and is not empty
        if (value && value !== '' && value !== 'undefined') {
          queryParams[key] = value
        }
      }
    })
    shallowQueryRoute(queryParams)
  }, [tab, router.isReady, mission?.id])

  return (
    <div className="w-full">
      {/* Mobile Social Links */}
      <div className="block md:hidden flex items-center justify-center mb-4">
        <MissionSocialLinks
          socials={{
            socialLink: mission?.metadata?.socialLink,
            infoUri: mission?.metadata?.infoUri,
          }}
          className="justify-center w-full"
        />
      </div>

      {/* Tab Navigation — overflow-x-auto so the bar stays single-row on
          phones when the optional Leaderboard tab makes it wider than the
          viewport. */}
      <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-1 border-b border-white/[0.08] overflow-x-auto max-w-full -mx-1 px-1">
          {visibleTabs.map((t) => (
            <MissionInfoTab
              key={t}
              tab={t}
              currentTab={tab}
              setTab={setTab}
            />
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <MissionSocialLinks
            socials={{
              socialLink: mission?.metadata?.socialLink,
              infoUri: mission?.metadata?.infoUri,
            }}
            className="justify-end"
          />
        </div>
      </div>

      {/* Content Area — lg+ matches MissionProfileHeader: 3fr/2fr cols, gap-8 lg:gap-10 */}
      <div
        id="mission-info-content"
        className="w-full relative flex flex-col gap-8 lg:gap-10 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start"
      >
        <div className="min-w-0 pr-2 lg:pr-0">
          {tab === 'about' && (
            <div className="w-full mb-8">
              <MissionInfoHeader
                title="About the Mission"
                icon="/assets/icon-star-blue.svg"
              />
              {mission?.metadata?.youtubeLink &&
                mission?.metadata?.youtubeLink !== '' && (
                  <div className="w-full mb-6">
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/[0.06]">
                      <iframe
                        src={mission?.metadata?.youtubeLink
                          ?.replace('watch?v=', 'embed/')
                          ?.replace('youtu.be/', 'www.youtube.com/embed/')}
                        className="absolute inset-0 w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              <div
                className="prose prose-invert prose-lg max-w-none [&>p]:text-gray-300 [&>p]:leading-relaxed [&>h1]:text-white [&>h2]:text-white [&>h3]:text-white [&>ul]:text-gray-300 [&>ol]:text-gray-300 [&>a]:text-indigo-400"
                dangerouslySetInnerHTML={{
                  __html: mission?.metadata?.description || '',
                }}
              />
              {mission?.projectId != null && mission?.projectId !== '' && (
                <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 p-6 text-center">
                  <h3 className="text-lg font-semibold text-white">
                    Ready to support this mission?
                  </h3>
                  <p className="text-sm text-gray-400 max-w-md">
                    Your contribution helps fund the future of space exploration. Every bit counts.
                  </p>
                  <button
                    type="button"
                    onClick={() => openContributeModal()}
                    className="mt-1 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                  >
                    Contribute Now
                  </button>
                </div>
              )}
              {mission?.projectId != null && mission?.projectId !== '' && (
                <div className="lg:hidden mt-10 pt-8 border-t border-white/[0.08] space-y-3">
                  <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Recent contributions
                  </h3>
                  <MissionActivityList
                    selectedChain={selectedChain}
                    tokenSymbol={token?.tokenSymbol}
                    projectId={mission?.projectId}
                  />
                </div>
              )}
            </div>
          )}
          {tab === 'leaderboard' && showLeaderboardTab && (
            <div className="w-full mb-8">
              <MissionInfoHeader
                title="Fly with Frank Leaderboard"
                icon="/assets/icon-star-blue.svg"
              />
              <OverviewLeaderboardPreview
                leaderboard={
                  (_overviewLeaderboard as LeaderboardEntry[]) ?? []
                }
                missionId={mission?.id ?? 4}
              />
            </div>
          )}
          {tab === 'activity' && (
            <div className="w-full mb-8">
              <MissionInfoHeader
                title="Mission Activity"
                icon="/assets/icon-star-blue.svg"
              />
              <div className="mb-6">
                <MissionTimelineChart
                  points={points}
                  isLoadingPoints={isLoadingPoints}
                  height={400}
                  createdAt={subgraphData?.createdAt}
                  range={range}
                  setRange={setRange}
                />
              </div>
              <MissionActivityList
                selectedChain={selectedChain}
                tokenSymbol={token?.tokenSymbol}
                projectId={mission?.projectId}
              />
            </div>
          )}
          {tab === 'tokenomics' && (
            <div className="w-full mb-8">
              <MissionInfoHeader
                title="Mission Tokenomics"
                icon="/assets/icon-star-blue.svg"
              />
              <MissionTokenInfo mission={mission} token={token} />
            </div>
          )}
        </div>
        <div className="hidden lg:block min-w-0 w-full pt-[47px] self-start">
          <MissionPayRedeem
            ruleset={ruleset}
            stage={stage}
            mission={mission}
            teamNFT={teamNFT}
            token={token}
            deadline={deadline}
            primaryTerminalAddress={primaryTerminalAddress}
            jbTokensContract={jbTokensContract}
            jbControllerContract={jbControllerContract}
            refreshTotalFunding={refreshTotalFunding}
            onOpenModal={openContributeModal}
            usdInput={usdInput || ''}
            setUsdInput={setUsdInput}
            fundingCompareEnabled={fundingCompareEnabled}
            fundingPickReady={fundingPickReady}
            fundingChainBalances={fundingChainBalances}
            recommendedFundingChain={recommendedChain}
          />
        </div>
      </div>
    </div>
  )
}
