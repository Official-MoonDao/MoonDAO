import Link from 'next/link'
import { useState } from 'react'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import MissionInfoCard from './MissionInfoCard'

export type MissionFundingTabType = 'current' | 'upcoming' | 'history'

export default function MissionFunding({ mission, rulesets }: any) {
  const [tab, setTab] = useState<MissionFundingTabType>('current')

  const currentCycle = rulesets?.[rulesets?.length - 1]
  const upcomingCycle = rulesets?.[rulesets?.length - 2]
  return (
    <div>
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Funding Details</h1>
      </div>

      <div className="mt-4">
        {tab === 'current' && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <MissionInfoCard title="Phase #" className="col-span-4">
                {`${currentCycle?.ruleset?.cycleNumber}`}
              </MissionInfoCard>
              <MissionInfoCard
                title="View full ruleset on "
                className="col-span-4"
              >
                <Link
                  href={`https://sepolia.juicebox.money/p/${mission?.projectId}`}
                  target="_blank"
                >
                  <JuiceboxLogoWhite />
                </Link>
              </MissionInfoCard>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
