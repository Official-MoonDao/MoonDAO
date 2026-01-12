import { ShoppingBagIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import StandardButton from '../layout/StandardButton'
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
    <div className="bg-gradient-to-br from-purple-600/20 to-indigo-800/20 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
            <ShoppingBagIcon className="w-7 h-7" />
            Newest Listings
          </h3>
          <p className="text-purple-200 text-sm">
            Discover and trade exclusive items from space missions
          </p>
        </div>

        <StandardButton
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all"
          onClick={() => router.push('/marketplace')}
        >
          View All Items
        </StandardButton>
      </div>

      <div
        className="overflow-x-auto overflow-y-hidden"
        style={{ msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div id="new-marketplace-listings-container" className="flex gap-4 pb-2">
          {newListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full py-12 text-center">
              <ShoppingBagIcon className="w-16 h-16 text-purple-400/50 mb-4" />
              <p className="text-purple-200 text-lg mb-2">No active listings yet</p>
              <p className="text-purple-300/70 text-sm">Check back soon for new marketplace items</p>
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
