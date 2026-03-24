import { getMissionContributorTiers } from 'const/missionContributorTiers'
import React, { useMemo } from 'react'

type MissionContributorTiersPanelProps = {
  missionId: unknown
}

/** Shown under the mission pay / receive card when tiers exist for this mission. */
export default function MissionContributorTiersPanel({ missionId }: MissionContributorTiersPanelProps) {
  const tiers = useMemo(() => getMissionContributorTiers(missionId), [missionId])
  if (tiers.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-3">
      <div>
        <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">Support tiers</h3>
        <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">
          Perks apply when you contribute at or above each level. The team will follow up to coordinate
          fulfillment where applicable.
        </p>
      </div>
      <ul className="flex flex-col gap-3 w-full list-none m-0 p-0">
        {tiers.map((tier) => (
          <li
            key={tier.amountUsd}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 flex flex-col gap-1"
          >
            <p className="text-indigo-300/90 font-GoodTimes text-sm font-semibold tracking-tight">
              ${tier.amountUsd.toLocaleString('en-US')}
            </p>
            <p className="text-white font-medium text-xs sm:text-sm">{tier.title}</p>
            <p className="text-gray-500 text-[11px] sm:text-xs leading-relaxed">{tier.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
