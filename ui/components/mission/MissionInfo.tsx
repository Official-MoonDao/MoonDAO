import {
  CalendarDateRangeIcon,
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { DiscordIcon, TwitterIcon } from '../assets'
import StandardWideCard from '../layout/StandardWideCard'
import MissionTimelineChart from './MissionTimelineChart'
import MissionTokenInfo from './MissionTokenInfo'

export type MissionInfoTabType = 'activity' | 'about' | 'token'

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

export default function MissionInfo({
  mission,
  teamNFT,
  subgraphData,
  token,
  rulesets,
  points,
  userMissionTokenBalance,
}: any) {
  const [tab, setTab] = useState<MissionInfoTabType>('about')
  return (
    <div>
      <div id="mission-info-tabs" className="mt-4 flex gap-[5vw] w-3/4">
        <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="token" currentTab={tab} setTab={setTab} />
      </div>

      <div id="mission-info-content" className="mt-8">
        {tab === 'about' && (
          <div>
            {' '}
            <div className="flex gap-2 text-light-cool">
              <Image
                src="/assets/icon-star-blue.svg"
                alt="Star Icon"
                width={30}
                height={30}
              />
              <h1 className="header font-GoodTimes text-moon-indigo">
                About the Mission
              </h1>
            </div>
            <div
              className="mt-4 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: mission?.metadata?.description || '',
              }}
            />
            <div className="mt-8 flex gap-2 text-light-cool">
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
              <StandardWideCard
                title={teamNFT?.metadata.name}
                subheader={
                  <div className="flex flex-col gap-2">
                    <div
                      id="socials-container"
                      className="p-1.5 mb-2 mr-2 md:mb-0 px-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] flex text-sm bg-filter"
                    >
                      {mission?.metadata?.discord &&
                        !mission?.metadata?.discord.includes(
                          '/users/undefined'
                        ) && (
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
                fullParagraph={false}
                image={teamNFT?.metadata.image}
                paragraph={
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
            </div>
          </div>
        )}
        {tab === 'activity' && (
          <MissionTimelineChart
            points={points}
            height={500}
            createdAt={subgraphData?.createdAt}
          />
        )}
        {tab === 'token' && (
          <MissionTokenInfo
            token={token}
            userMissionTokenBalance={userMissionTokenBalance}
          />
        )}
      </div>
    </div>
  )
}
