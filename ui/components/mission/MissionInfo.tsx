import { ChatBubbleLeftIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { getAttribute } from '@/lib/utils/nft'
import { TwitterIcon } from '../assets'
import MissionActivityList from './MissionActivityList'
import MissionPayRedeem from './MissionPayRedeem'
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
  return (
    <div className="relative">
      <button
        className={`text-sm md:text-xl ${
          currentTab === tab ? 'text-white' : 'text-gray-400'
        }`}
        onClick={() => setTab(tab)}
      >
        {tab.charAt(0).toUpperCase() + tab.slice(1)}
      </button>
      {currentTab === tab && (
        <div className="absolute w-[150%] h-1 bg-white -bottom-2 left-1/2 -translate-x-1/2" />
      )}
    </div>
  )
}

function MissionInfoHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex w-full gap-2 text-light-cool">
      <Image src={icon} alt="Star Icon" width={30} height={30} />
      <h1 className="text-2xl 2xl:text-4xl font-GoodTimes text-moon-indigo">
        {title}
      </h1>
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
  refreshTotalFunding,
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

      const parentRect = parentElement.getBoundingClientRect()
      const stickyRect = stickyElement.getBoundingClientRect()

      const stickyTop = stickyRect.top

      const stickyPoint = 20

      const parentBottom = parentRect.bottom

      const parentTop = parentRect.top

      const stickyHeight = stickyRect.height

      if (parentTop > stickyPoint) {
        stickyElement.style.position = 'relative'
        stickyElement.style.top = '0'
        stickyElement.style.width = '100%'
      } else if (
        stickyTop <= stickyPoint &&
        parentBottom > window.innerHeight
      ) {
        stickyElement.style.position = 'fixed'
        stickyElement.style.top = `${stickyPoint}px`
        stickyElement.style.width = '350px'
      } else if (parentBottom <= window.innerHeight) {
        const bottomOffset = window.innerHeight - parentBottom
        const newTop = window.innerHeight - stickyHeight - bottomOffset

        if (newTop < stickyPoint) {
          stickyElement.style.position = 'absolute'
          stickyElement.style.top = `${parentRect.height - stickyHeight}px`
          stickyElement.style.width = '350px'
        } else {
          stickyElement.style.position = 'fixed'
          stickyElement.style.top = `${stickyPoint}px`
          stickyElement.style.width = '350px'
        }
      } else {
        stickyElement.style.position = 'relative'
        stickyElement.style.top = '0'
        stickyElement.style.width = '100%'
      }
    }

    window.addEventListener('scroll', handleScroll)

    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const teamSocials = useMemo(() => {
    return {
      communications: getAttribute(
        teamNFT?.metadata?.attributes,
        'communications'
      )?.value,
      twitter: getAttribute(teamNFT?.metadata?.attributes, 'twitter')?.value,
      website: getAttribute(teamNFT?.metadata?.attributes, 'website')?.value,
      discord: getAttribute(teamNFT?.metadata?.attributes, 'discord')?.value,
    }
  }, [teamNFT?.metadata?.attributes])

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
      <div className="w-full pl-[2vw] flex flex-col md:flex-row gap-10 md:gap-2 justify-between max-w-[1200px]">
        <div
          id="mission-info-tabs"
          className="flex px-10 sm:px-4 md:px-0 justify-between sm:justify-start mt-4 flex gap-10 md:gap-20 w-full"
        >
          <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="tokenomics" currentTab={tab} setTab={setTab} />
        </div>

        <div className="flex items-center md:justify-end gap-2 w-full">
          <div className="text-sm text-gray-400">{'CONNECT WITH THE TEAM'}</div>
          <div className="flex gap-2 justify-start justify-end">
            {teamSocials.communications && (
              <Link
                className="flex gap-2"
                href={teamSocials.communications}
                target="_blank"
                passHref
              >
                <ChatBubbleLeftIcon height={25} width={25} />
              </Link>
            )}
            {teamSocials.twitter && (
              <Link
                className="flex gap-2"
                href={teamSocials.twitter}
                target="_blank"
                passHref
              >
                <TwitterIcon />
              </Link>
            )}
            {teamSocials.website && (
              <Link
                className="flex gap-2"
                href={teamSocials.website}
                target="_blank"
                passHref
              >
                <GlobeAltIcon height={25} width={25} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div id="mission-info-content" className="mt-8 w-full flex gap-4">
        <div className="flex-1 overflow-auto">
          {tab === 'about' && (
            <div className="flex gap-4 mb-[5vw] md:mb-[2vw] w-full">
              <div className="w-full">
                <MissionInfoHeader
                  title="About the Mission"
                  icon="/assets/icon-star-blue.svg"
                />
                {mission?.metadata?.youtubeLink &&
                  mission?.metadata?.youtubeLink !== '' && (
                    <div className="w-full p-4 2xl:p-0 max-w-[1200px]">
                      <iframe
                        src={mission?.metadata?.youtubeLink?.replace(
                          'watch?v=',
                          'embed/'
                        )}
                        width="100%"
                        height="500"
                        allowFullScreen
                        className="rounded-2xl"
                      />
                    </div>
                  )}
                <div
                  className="mt-4 prose prose-invert w-full max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: mission?.metadata?.description || '',
                  }}
                />
              </div>
            </div>
          )}
          {tab === 'activity' && (
            <div className="w-full">
              <MissionInfoHeader
                title="Mission Activity"
                icon="/assets/icon-star-blue.svg"
              />
              <MissionTimelineChart
                points={points}
                isLoadingPoints={isLoadingPoints}
                height={500}
                createdAt={subgraphData?.createdAt}
                range={range}
                setRange={setRange}
              />
              <MissionActivityList
                selectedChain={selectedChain}
                tokenSymbol={token?.tokenSymbol}
                projectId={mission?.projectId}
              />
            </div>
          )}
          {tab === 'tokenomics' && (
            <div className="w-full">
              <MissionInfoHeader
                title="Mission Tokenomics"
                icon="/assets/icon-star-blue.svg"
              />
              <MissionTokenInfo mission={mission} token={token} />
            </div>
          )}
        </div>
        <div className="hidden xl:block  min-w-[350px] lg:w-[400px]">
          <div ref={stickyRef}>
            <MissionPayRedeem
              stage={stage}
              mission={mission}
              teamNFT={teamNFT}
              token={token}
              deadline={deadline}
              primaryTerminalAddress={primaryTerminalAddress}
              jbTokensContract={jbTokensContract}
              jbControllerContract={jbControllerContract}
              refreshBackers={refreshBackers}
              refreshTotalFunding={refreshTotalFunding}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
