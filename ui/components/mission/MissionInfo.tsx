import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import MissionActivityList from './MissionActivityList'
import MissionFundingChainBanner from './MissionFundingChainBanner'
import MissionPayRedeem from './MissionPayRedeem'
import MissionSocialLinks from './MissionSocialLinks'
import MissionTimelineChart from './MissionTimelineChart'
import MissionTokenInfo from './MissionTokenInfo'

export type MissionInfoTabType = 'activity' | 'about' | 'tokenomics'

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
      className={`relative px-5 py-3 text-base md:text-lg font-semibold tracking-wide transition-all duration-200 ${
        isActive
          ? 'text-white'
          : 'text-gray-500 hover:text-gray-300'
      }`}
      onClick={() => setTab(tab)}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
  setContributeModalEnabled,
  setUsdInput,
  usdInput,
  missionDefaultFundingChainEnabled = false,
  fundingBannerEnabled = false,
  fundingPickReady = false,
  fundingChains = [],
  recommendedChain = null,
  fundingChainBalances = null,
  fundingCompareEnabled = false,
}: any) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [tab, setTab] = useState<MissionInfoTabType>(
    (router.query.tab as MissionInfoTabType) || 'about'
  )

  useEffect(() => {
    if (router.query.tab) {
      setTab(router.query.tab as MissionInfoTabType)
    }
  }, [router])

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

      {/* Tab Navigation */}
      <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-1 border-b border-white/[0.08]">
          <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="tokenomics" currentTab={tab} setTab={setTab} />
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

      {/* Content Area — lg+ matches MissionProfileHeader: 2 equal cols, gap-8 lg:gap-10 */}
      <div
        id="mission-info-content"
        className="w-full relative flex flex-col gap-8 lg:gap-10 lg:grid lg:grid-cols-2 lg:items-start"
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
                <div className="lg:hidden mt-10 pt-8 border-t border-white/[0.08] space-y-3">
                  <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Recent contributions
                  </h3>
                  <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overflow-x-hidden flex flex-col gap-0 pr-1 -mr-1">
                    <MissionActivityList
                      selectedChain={selectedChain}
                      tokenSymbol={token?.tokenSymbol}
                      projectId={mission?.projectId}
                    />
                  </div>
                </div>
              )}
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
              <div className="max-h-[calc(100dvh-22rem)] min-h-[12rem] overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                <MissionActivityList
                  selectedChain={selectedChain}
                  tokenSymbol={token?.tokenSymbol}
                  projectId={mission?.projectId}
                />
              </div>
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
          <MissionFundingChainBanner
            enabled={fundingBannerEnabled}
            chains={fundingChains}
            fundingPickReady={fundingPickReady}
            recommendedChain={recommendedChain}
            fundingChainBalances={fundingChainBalances}
          />
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
            onOpenModal={() => {
              setContributeModalEnabled(true)
            }}
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
