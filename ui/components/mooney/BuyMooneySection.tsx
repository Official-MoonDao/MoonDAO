import React, { ReactNode } from 'react'
import Link from 'next/link'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import { Chain } from '@/lib/rpc/chains'

export interface BuyMooneySectionProps {
  title?: string
  description?: string
  selectedChain: Chain
  swapComponent: ReactNode
  lockLink?: string
  voteLink?: string
}

export default function BuyMooneySection({
  title = 'Buy MOONEY',
  description = "Get MOONEY tokens to participate in MoonDAO governance. After buying, you can lock them for voting power.",
  selectedChain,
  swapComponent,
  lockLink = '/lock',
  voteLink = '/projects',
}: BuyMooneySectionProps) {
  return (
    <section
      id="buy"
      className="py-12 px-6 bg-gradient-to-br from-gray-900/50 to-blue-900/20 w-full"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            {description}
          </p>
        </div>

        <div className="mb-8">
          <div className="max-w-xl mx-auto bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-4 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Network Selection
                </h3>
                <p className="text-gray-300 text-sm">
                  Select a network to buy MOONEY on
                </p>
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                <NetworkSelector />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-12">
          <div>{swapComponent}</div>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Next Steps</h3>
            <p className="text-gray-300 text-sm">
              After buying MOONEY, lock them to gain voting power in
              governance.
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                href={lockLink}
                className="block bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
              >
                Lock for Voting Power
              </Link>
              <Link
                href={voteLink}
                className="block bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
              >
                View Governance
              </Link>
            </div>
            <div className="text-center text-xs text-gray-400 mt-4">
              Locking MOONEY gives you vMOONEY for quadratic voting
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

