import { CalendarDateRangeIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useState } from 'react'
import MissionFunding from './MissionFunding'
import MissionTimelineChart from './MissionTimelineChart'
import MissionTokenInfo from './MissionTokenInfo'

export type MissionInfoTabType = 'activity' | 'about' | 'funding' | 'token'

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
    <button
      className={`text-xl ${
        currentTab === tab ? 'text-white' : 'text-gray-400'
      }`}
      onClick={() => setTab(tab)}
    >
      {tab.toLocaleUpperCase()}
    </button>
  )
}

export default function MissionInfo({
  mission,
  subgraphData,
  token,
  rulesets,
  points,
  userMissionTokenBalance,
}: any) {
  const [tab, setTab] = useState<MissionInfoTabType>('activity')
  return (
    <div>
      <div id="mission-info-header" className="flex justify-between opacity-60">
        <div className="flex gap-2">
          <Image
            src="/assets/icon-star.svg"
            alt="Star Icon"
            width={30}
            height={30}
          />
          <h1 className="header font-GoodTimes">Info & Statistics</h1>
        </div>
        <div className="flex gap-2 items-center">
          <CalendarDateRangeIcon className="w-8 h-8 " />
          <p className="text-xl">{`Created ${new Date(
            subgraphData?.createdAt * 1000
          ).toLocaleDateString()}`}</p>
        </div>
      </div>
      <div id="mission-info-tabs" className="mt-4 flex gap-8 w-3/4">
        <MissionInfoTab tab="activity" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="about" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="funding" currentTab={tab} setTab={setTab} />
        <MissionInfoTab tab="token" currentTab={tab} setTab={setTab} />
      </div>
      <hr className="my-4 w-full border-1 border-grasy-400" />
      <div id="mission-info-content">
        {tab === 'activity' && (
          <MissionTimelineChart
            points={points}
            height={500}
            createdAt={subgraphData?.createdAt}
          />
        )}
        {tab === 'about' && (
          <div>
            {' '}
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: mission?.metadata?.description || '',
              }}
            />
          </div>
        )}
        {tab === 'funding' && (
          <MissionFunding mission={mission} rulesets={rulesets} />
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
