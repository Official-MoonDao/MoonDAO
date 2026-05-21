import { ShoppingBagIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import TeamListing, { TeamListing as TeamListingType } from './TeamListing'

type NewMarketplaceListingsProps = {
  selectedChain: any
  teamContract: any
  marketplaceTableContract: any
  initialListings?: any[]
}

export default function NewMarketplaceListings({
  selectedChain,
  teamContract,
  marketplaceTableContract,
  initialListings = [],
}: NewMarketplaceListingsProps) {
  const router = useRouter()
  const [newListings, setNewListings] = useState<TeamListingType[]>(initialListings)

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
            <ShoppingBagIcon className="w-6 h-6 text-purple-400" />
            Newest Listings
          </h3>
          <p className="text-white/40 text-sm">
            Discover and trade exclusive items from space missions
          </p>
        </div>

        <button
          onClick={() => router.push('/marketplace')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 border-purple-400/20"
        >
          View All →
        </button>
      </div>

      <div
        className="overflow-x-auto overflow-y-hidden"
        style={{ msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div id="new-marketplace-listings-container" className="flex gap-4 pb-2">
          {newListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full py-12 text-center">
              <ShoppingBagIcon className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white/50 text-base mb-1">No active listings yet</p>
              <p className="text-white/30 text-sm">Check back soon for new marketplace items</p>
            </div>
          ) : (
            newListings.map((listing, i) => (
              <TeamListing
                key={`team-listing-${i}`}
                listing={listing}
                selectedChain={selectedChain}
                teamContract={teamContract}
                marketplaceTableContract={marketplaceTableContract}
                teamName
                isCitizen={true}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
