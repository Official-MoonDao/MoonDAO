import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'
import { TeamListing as TeamListingType } from './TeamListing'
import TeamListingV5 from './TeamListingV5'

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

  useEffect(() => {
    //get latest 25 listings
    async function getNewMarketplaceListings() {
      const now = Math.floor(Date.now() / 1000)
      const tableName = await readContract({
        contract: marketplaceTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const statement = `SELECT * FROM ${tableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 25`
      const allListingsRes = await fetch(
        `/api/tableland/query?statement=${statement}`
      )
      const listings = await allListingsRes.json()
      const validListings = listings.filter(
        async (listing: TeamListingType) => {
          const teamExpiration = await readContract({
            contract: teamContract,
            method: 'expiresAt' as string,
            params: [listing.teamId],
          })
          return +teamExpiration.toString() > now
        }
      )
      setNewListings(validListings)
    }
    if (teamContract && marketplaceTableContract) {
      getNewMarketplaceListings()
    }
  }, [teamContract, marketplaceTableContract])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <h2 className="header font-GoodTimes">Newest Listings</h2>
        </div>

        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/marketplace')}
        >
          See More
        </StandardButton>
      </div>

      <SlidingCardMenu>
        <div id="new-marketplace-listings-container" className="flex gap-5">
          {newListings.map((listing, i) => (
            <TeamListingV5
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
      </SlidingCardMenu>
    </div>
  )
}
