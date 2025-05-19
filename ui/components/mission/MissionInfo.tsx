import {
  ChatBubbleLeftIcon,
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import gsap from 'gsap'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { getAttribute } from '@/lib/utils/nft'
import { DiscordIcon, TwitterIcon } from '../assets'
import StandardWideCard from '../layout/StandardWideCard'
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
        className={`text-xl ${
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
  fundingGoal,
  ruleset,
  jbTokensContract,
  jbControllerContract,
  points,
  isLoadingPoints,
  userMissionTokenBalance,
  primaryTerminalAddress,
  stage,
}: any) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const payRedeemRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<MissionInfoTabType>(
    (router.query.tab as MissionInfoTabType) || 'about'
  )

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
    shallowQueryRoute({
      tokenId: mission?.id,
      tab: tab,
    })
  }, [tab])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.innerWidth < 800 ||
      !payRedeemRef.current
    )
      return

    let ctx: gsap.Context
    let originalStyle: Partial<CSSStyleDeclaration> = {}

    async function payRedeemScrollTrigger() {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger)

        ctx = gsap.context(() => {
          const el = payRedeemRef.current!

          // Save original computed styles
          const computed = window.getComputedStyle(el)
          originalStyle = {
            position: computed.position,
            top: computed.top,
            right: computed.right,
            width: computed.width,
            zIndex: computed.zIndex,
          }

          // Main scroll trigger for fixed positioning
          ScrollTrigger.create({
            trigger: el,
            start: 'top bottom',
            end: 'bottom center',
            onEnter: () => {
              gsap.to(el, {
                position: 'fixed',
                top: '450px',
                right: '10vw',
                width: '300px',
                zIndex: 50,
                opacity: 1,
                duration: 0.3,
                ease: 'power2.out',
              })
            },
            onLeaveBack: () => {
              gsap.to(el, {
                ...originalStyle,
                opacity: 1,
                duration: 0.3,
                ease: 'power2.out',
              })
            },
            onUpdate: (self) => {
              const windowHeight = window.innerHeight
              const scrollTop =
                window.pageYOffset || document.documentElement.scrollTop
              const documentHeight = document.documentElement.scrollHeight

              // If we're within 500px of the bottom of the page
              if (documentHeight - (scrollTop + windowHeight) < 500) {
                gsap.set(el, {
                  position: 'absolute',
                  top: documentHeight - 500 - el.offsetHeight,
                  right: '10vw',
                  width: '300px',
                })
              } else if (self.direction > 0) {
                // Scrolling down
                gsap.set(el, {
                  position: 'fixed',
                  top: '450px',
                  right: '10vw',
                  width: '300px',
                })
              }
            },
          })
        })
      })
    }

    payRedeemScrollTrigger()

    document.addEventListener('resize', payRedeemScrollTrigger)

    return () => ctx?.revert()
  }, [])

  return (
    <div ref={containerRef}>
      <div className="px-[1vw] flex flex-col md:flex-row gap-8 md:gap-2 justify-between max-w-[920px]">
        <div id="mission-info-tabs" className="mt-4 flex gap-[5vw] w-3/4">
          <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
          <MissionInfoTab tab="tokenomics" currentTab={tab} setTab={setTab} />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">{'CONNECT WITH THE TEAM'}</p>
          <div className="flex gap-2 justify-end">
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

      <div id="mission-info-content" className="mt-8 xl:w-3/4 flex gap-4">
        {tab === 'about' && (
          <div className="flex gap-4 w-full">
            <div className="w-full">
              <MissionInfoHeader
                title="About the Mission"
                icon="/assets/icon-star-blue.svg"
              />
              <div
                className="mt-4 prose prose-invert w-full max-w-none"
                dangerouslySetInnerHTML={{
                  __html: mission?.metadata?.description || '',
                }}
              />
              <div className="mt-8 flex gap-2 text-light-cool max-w-none">
                <Image
                  src="/assets/icon-star-blue.svg"
                  alt="Star Icon"
                  width={30}
                  height={30}
                />
                <h1 className="header font-GoodTimes text-moon-indigo">
                  About the Team
                </h1>
              </div>
              <div className="mt-4">
                {teamNFT && (
                  <StandardWideCard
                    title={teamNFT?.metadata.name}
                    link={`/team/${generatePrettyLink(
                      teamNFT?.metadata?.name || ''
                    )}`}
                    subheader={
                      <div className="flex flex-col gap-2">
                        <div
                          id="socials-container"
                          className="p-1.5 mb-2 mr-2 md:mb-0 px-5 w-fit gap-5 rounded-bl-[10px] rounded-[2vmax] flex text-sm bg-filter"
                        >
                          {mission?.metadata?.discord && (
                            <Link
                              className="flex gap-2"
                              href={mission?.metadata?.discord}
                              target="_blank"
                              passHref
                            >
                              <DiscordIcon />
                            </Link>
                          )}
                          {mission?.metadata?.twitter && (
                            <Link
                              className="flex gap-2"
                              href={mission?.metadata?.twitter}
                              target="_blank"
                              passHref
                            >
                              <TwitterIcon />
                            </Link>
                          )}
                          {mission?.metadata?.infoUri && (
                            <Link
                              className="flex gap-2"
                              href={mission?.metadata?.infoUri}
                              target="_blank"
                              passHref
                            >
                              <GlobeAltIcon height={25} width={25} />
                            </Link>
                          )}
                        </div>
                      </div>
                    }
                    paragraph={
                      <div className="flex flex-col gap-2">
                        <p>{teamNFT?.metadata.description}</p>
                      </div>
                    }
                    fullParagraph={true}
                    showMore={false}
                    showMoreButton={false}
                    image={teamNFT?.metadata.image}
                    footer={
                      <Link
                        href={`/team/${generatePrettyLink(
                          teamNFT?.metadata?.name || ''
                        )}`}
                        passHref
                        className="flex gap-2 items-center hover:underline"
                      >
                        <InformationCircleIcon width={20} height={20} />
                        {'Learn more about the team'}
                      </Link>
                    }
                  />
                )}
              </div>
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
        <div className="hidden xl:block">
          <div className="w-full" ref={payRedeemRef}>
            <MissionPayRedeem
              stage={stage}
              selectedChain={selectedChain}
              mission={mission}
              teamNFT={teamNFT}
              token={token}
              fundingGoal={fundingGoal}
              subgraphData={subgraphData}
              ruleset={ruleset}
              primaryTerminalAddress={primaryTerminalAddress}
              jbTokensContract={jbTokensContract}
              jbControllerContract={jbControllerContract}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
