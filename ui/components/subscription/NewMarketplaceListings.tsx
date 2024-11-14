import { TABLELAND_ENDPOINT } from 'const/config'
import { useEffect, useState } from 'react'
import SlidingCardMenu from '../layout/SlidingCardMenu'
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
  const [newListings, setNewListings] = useState<TeamListingType[]>([])

  useEffect(() => {
    //get latest 25 listings
    async function getNewMarketplaceListings() {
      const now = Math.floor(Date.now() / 1000)
      const tableName = await marketplaceTableContract.call('getTableName')
      const statement = `SELECT * FROM ${tableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY startTime DESC LIMIT 25`
      const allListingsRes = await fetch(
        `${TABLELAND_ENDPOINT}?statement=${statement}`
      )
      const allListings = await allListingsRes.json()
      const validListings = allListings.filter(
        async (listing: TeamListingType) => {
          const teamExpiration = await teamContract.call('expiresAt', [
            listing.teamId,
          ])
          return teamExpiration.toNumber() > now
        }
      )
      setNewListings(validListings.reverse())
    }
    if (teamContract && marketplaceTableContract) {
      getNewMarketplaceListings()
    }
  }, [teamContract, marketplaceTableContract])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex gap-5 opacity-[50%]">
        <p className="header font-GoodTimes">New Listings</p>
      </div>

      <SlidingCardMenu>
        <div className="flex gap-5">
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
      </SlidingCardMenu>
    </div>
  )
}
