import { useState } from 'react'

export type MissionCyclesAndPayoutsTabType = 'current' | 'upcoming' | 'history'

function MissionCyclesAndPayoutsTab({
  tab,
  currentTab,
  setTab,
}: {
  tab: MissionCyclesAndPayoutsTabType
  currentTab: MissionCyclesAndPayoutsTabType
  setTab: (tab: MissionCyclesAndPayoutsTabType) => void
}) {
  return (
    <button
      className={`bg-cool px-2 rounded-full text-xl ${
        currentTab === tab ? 'text-white' : 'text-gray-400'
      }`}
      onClick={() => setTab(tab)}
    >
      {tab}
    </button>
  )
}

function MissionCycleCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <div className={`bg-cool p-4 rounded-lg ${className}`}>
      {title && <h1 className="">{title}</h1>}
      <p className="text-lg">{children}</p>
    </div>
  )
}

export default function MissionCyclesAndPayouts({ rulesets }: any) {
  const [tab, setTab] = useState<MissionCyclesAndPayoutsTabType>('current')

  const currentCycle = rulesets?.[rulesets?.length - 1]
  const upcomingCycle = rulesets?.[rulesets?.length - 2]
  return (
    <div>
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Cycle</h1>
        <div id="mission-cycles-tabs" className="flex gap-2">
          <MissionCyclesAndPayoutsTab
            tab="current"
            currentTab={tab}
            setTab={setTab}
          />
          <MissionCyclesAndPayoutsTab
            tab="upcoming"
            currentTab={tab}
            setTab={setTab}
          />
          <MissionCyclesAndPayoutsTab
            tab="history"
            currentTab={tab}
            setTab={setTab}
          />
        </div>
      </div>

      <div className="mt-4">
        {tab === 'current' && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <MissionCycleCard title="Cycle #">
                {currentCycle?.ruleset?.cycleNumber}
              </MissionCycleCard>
              <MissionCycleCard title="Status">
                {currentCycle?.ruleset?.status}
              </MissionCycleCard>
              <MissionCycleCard className="col-span-2" title="Remaining Time">
                {'-'}
              </MissionCycleCard>
              <MissionCycleCard className="col-span-4" title="Cycle #">
                {currentCycle?.ruleset?.cycleNumber}
              </MissionCycleCard>
            </div>
            <h1 className="mt-8 text-2xl font-bold">Treasury & Payouts</h1>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <MissionCycleCard title="Treasury Balance">
                {currentCycle?.ruleset?.payout}
              </MissionCycleCard>
              <MissionCycleCard title="Overflow">
                {currentCycle?.ruleset?.payout}
              </MissionCycleCard>
              <MissionCycleCard
                className="col-span-2"
                title="Available to pay out"
              >
                {currentCycle?.ruleset?.payout}
              </MissionCycleCard>
              <MissionCycleCard className="col-span-2" title="Payouts">
                {currentCycle?.ruleset?.payout}
              </MissionCycleCard>
            </div>
          </>
        )}
        {tab === 'upcoming' && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <MissionCycleCard title="Cycle #">
                {upcomingCycle?.ruleset?.cycleNumber}
              </MissionCycleCard>
              <MissionCycleCard title="Status">
                {upcomingCycle?.ruleset?.status}
              </MissionCycleCard>
              <MissionCycleCard className="col-span-2" title="Cycle length">
                {'-'}
              </MissionCycleCard>
              <MissionCycleCard
                className="col-span-4"
                title="Upcoming Cycle Rules"
              >
                <div></div>
              </MissionCycleCard>
            </div>
            <h1 className="mt-8 text-2xl font-bold">Treasury & Payouts</h1>
            <div className="mt-4">
              <MissionCycleCard title="Payouts">
                {upcomingCycle?.ruleset?.payout}
              </MissionCycleCard>
            </div>
          </>
        )}
        {tab === 'history' && <></>}
      </div>
    </div>
  )
}
