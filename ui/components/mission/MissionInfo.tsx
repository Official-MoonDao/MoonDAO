import {
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
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
    <div className="flex gap-2 text-light-cool">
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
  jbDirectoryContract,
  points,
  userMissionTokenBalance,
  primaryTerminalAddress,
  stage,
}: any) {
  const [tab, setTab] = useState<MissionInfoTabType>('about')
  return (
    <div>
      <div id="mission-info-tabs" className="mt-4 flex gap-[5vw] w-3/4">
        <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="tokenomics" currentTab={tab} setTab={setTab} />
      </div>

      <div id="mission-info-content" className="mt-8 w-full flex gap-4">
        {tab === 'about' && (
          <div className="flex gap-4 w-full">
            <div>
              <MissionInfoHeader
                title="About the Mission"
                icon="/assets/icon-star-blue.svg"
              />
              <div
                className="mt-4 prose prose-invert w-full"
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
            <MissionTokenInfo
              mission={mission}
              token={token}
              userMissionTokenBalance={userMissionTokenBalance}
              ruleset={ruleset}
              subgraphData={subgraphData}
              fundingGoal={fundingGoal}
            />
          </div>
        )}
        <div className="w-full hidden xl:block">
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
          />
        </div>
      </div>
    </div>
  )
}
