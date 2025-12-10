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
}

export default function NewMarketplaceListings({
  selectedChain,
  teamContract,
  marketplaceTableContract,
}: NewMarketplaceListingsProps) {
  const router = useRouter()
  const [newListings, setNewListings] = useState<TeamListingType[]>([])
  const [tableName, setTableName] = useState<string | null>(null)

  // Get table name from contract
  useEffect(() => {
    async function getTableName() {
      if (!marketplaceTableContract) return
      try {
        const name: any = await readContract({
          contract: marketplaceTableContract,
          method: 'getTableName' as string,
          params: [],
        })
        setTableName(name)
      } catch (error) {
        console.error('Error fetching table name:', error)
      }
    }
    getTableName()
  }, [marketplaceTableContract])

  const now = Math.floor(Date.now() / 1000)
  const statement = tableName
    ? `SELECT * FROM ${tableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 10`
    : null

  const { data: listings } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  // Process and filter listings with rate limiting
  useEffect(() => {
    async function processListings() {
      if (!listings || !teamContract || listings.length === 0) {
        setNewListings([])
        return
      }

      // Process in batches to avoid rate limiting
      const BATCH_SIZE = 5
      const DELAY_BETWEEN_BATCHES = 200 // ms
      const validListings: TeamListingType[] = []

      for (let i = 0; i < listings.length; i += BATCH_SIZE) {
        const batch = listings.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async (listing: TeamListingType) => {
            try {
              const teamExpiration = await readContract({
                contract: teamContract,
                method: 'expiresAt' as string,
                params: [listing.teamId],
              })
              return +teamExpiration.toString() > now ? listing : null
            } catch {
              return null
            }
          })
        )

        validListings.push(...batchResults.filter((listing: any) => listing !== null))

        if (i + BATCH_SIZE < listings.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }
      setNewListings(validListings)
    }

    processListings()
  }, [listings, teamContract, now])

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
          {newListings.map((listing, i) => (
            <TeamListing
              key={`team-listing-${i}`}
              listing={listing}
              selectedChain={selectedChain}
              teamContract={teamContract}
              marketplaceTableContract={marketplaceTableContract}
              teamName
              isCitizen={true}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
