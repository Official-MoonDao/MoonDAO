import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import MissionActivityList from './MissionActivityList'
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
      className={`relative px-4 py-2.5 text-sm md:text-base font-medium rounded-lg transition-all duration-200 ${
        isActive
          ? 'text-white bg-white/[0.08] shadow-sm'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
      }`}
      onClick={() => setTab(tab)}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
  refreshBackers,
  backers,
  citizens,
  refreshTotalFunding,
  ruleset,
  setContributeModalEnabled,
  setUsdInput,
  usdInput,
}: any) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()
  const stickyRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<MissionInfoTabType>(
    (router.query.tab as MissionInfoTabType) || 'about'
  )

  useEffect(() => {
    const handleScroll = () => {
      const stickyElement = stickyRef.current
      if (!stickyElement) return

      const parentElement = document.getElementById('mission-info-content')
      if (!parentElement) return

      const stickyWrapper = stickyElement.parentElement
      if (!stickyWrapper) return

      // Use the scroll container to get scroll position
      const scrollContainer =
        document.getElementById('main-container') || document.documentElement
      const scrollTop =
        scrollContainer === document.documentElement
          ? window.scrollY
          : scrollContainer.scrollTop

      const parentRect = parentElement.getBoundingClientRect()
      const stickyHeight = stickyElement.getBoundingClientRect().height

      const stickyPoint = 75

      // Calculate parent's top relative to the document (not viewport)
      const parentTopAbsolute = parentRect.top + scrollTop
      const parentHeight = parentRect.height

      // Where the sticky element should start sticking
      const stickStart = parentTopAbsolute - stickyPoint
      // Where it should stop (so it doesn't go past the parent bottom)
      const stickEnd = parentTopAbsolute + parentHeight - stickyHeight - stickyPoint

      if (scrollTop <= stickStart) {
        // Haven't scrolled enough — stay at natural position
        stickyElement.style.position = 'relative'
        stickyElement.style.top = '0'
        stickyElement.style.width = '100%'
      } else if (scrollTop <= stickEnd) {
        // In the sticky zone — follow scroll using absolute within parent
        const offset = scrollTop - parentTopAbsolute + stickyPoint
        stickyElement.style.position = 'absolute'
        stickyElement.style.top = `${offset}px`
        stickyElement.style.width = `${stickyWrapper.offsetWidth}px`
      } else {
        // Past the end — pin to bottom of parent
        stickyElement.style.position = 'absolute'
        stickyElement.style.top = `${parentHeight - stickyHeight}px`
        stickyElement.style.width = `${stickyWrapper.offsetWidth}px`
      }
    }

    // Listen on both possible scroll containers
    const mainContainer = document.getElementById('main-container')
    window.addEventListener('scroll', handleScroll, true)
    mainContainer?.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)

    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      mainContainer?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

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
        <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.05]">
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

      {/* Content Area */}
      <div id="mission-info-content" className="w-full flex items-start gap-6 relative">
        <div className="flex-1 min-w-0">
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
                citizens={citizens}
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
        <div className="hidden xl:block min-w-[350px] lg:w-[400px] pt-[47px]">
          <div ref={stickyRef}>
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
              refreshBackers={refreshBackers}
              backers={backers}
              refreshTotalFunding={refreshTotalFunding}
              onOpenModal={() => {
                setContributeModalEnabled(true)
              }}
              usdInput={usdInput || ''}
              setUsdInput={setUsdInput}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
