import React from 'react'
import { ChartPieIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import ContractAddressCard from './ContractAddressCard'
import QuadraticVotingCard from './QuadraticVotingCard'
import TokenDistributionChart from './TokenDistributionChart'
import GeometricDecayChart from './GeometricDecayChart'
import { useTokenDistribution } from '@/lib/mooney/hooks/useTokenDistribution'
import { useGeometricDecayData } from '@/lib/mooney/hooks/useGeometricDecayData'
import { DISTRIBUTION_LAST_UPDATED } from '@/lib/mooney/utils/tokenData'
import Link from 'next/link'

export default function TokenInfoSection() {
  const { data: distributionData } = useTokenDistribution()
  const { quarterlyData, scheduleInfo } = useGeometricDecayData()

  return (
    <section className="py-16 px-6 bg-gradient-to-br from-gray-900/60 to-black/40 w-full">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-center text-white mb-12">
          Token Information
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <ContractAddressCard />
          <QuadraticVotingCard />
        </div>

        <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10 mt-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <ChartPieIcon className="h-5 w-5 text-purple-400" />
            Token Usage & Allocation (Last updated {DISTRIBUTION_LAST_UPDATED})
          </h3>
          <TokenDistributionChart data={distributionData} />
        </div>

        <div className="bg-gradient-to-br from-gray-900/50 to-orange-900/20 rounded-xl p-6 border border-white/10 mt-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-orange-400" />
            Projects System Reward Structure
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col h-full">
              <div className="bg-black/20 rounded-lg p-4 flex-1">
                <h4 className="text-orange-300 font-semibold mb-6">
                  Quarterly Reward Pool
                </h4>
                <div className="space-y-6 text-sm text-gray-300 mb-6">
                  <div className="flex justify-between">
                    <span>Starting Quarter ({scheduleInfo.startingQuarter}):</span>
                    <span className="text-orange-300 font-medium">
                      {scheduleInfo.startingAmount / 1_000_000}M MOONEY
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reduction Rate:</span>
                    <span className="text-orange-300 font-medium">
                      {scheduleInfo.reductionRatePercent}% per quarter
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Schedule Type:</span>
                    <span className="text-orange-300 font-medium">
                      {scheduleInfo.scheduleType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MOONEY Rewards:</span>
                    <span className="text-purple-300 font-medium">
                      {scheduleInfo.lockPeriod}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-400/20 mt-4">
                <p className="text-orange-300 text-sm">
                  Retroactive rewards incentivize projects that advance
                  MoonDAO's mission
                </p>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <div className="bg-black/20 rounded-lg p-4 flex-1">
                <h4 className="text-blue-300 font-semibold mb-3">
                  Geometric Decay Visualization
                </h4>
                <GeometricDecayChart data={quarterlyData} />
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-400/20 mt-4">
                <p className="text-green-300 text-sm">
                  <Link
                    href="/project-system-docs"
                    className="underline hover:text-green-200"
                  >
                    Learn more about the Projects System
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

