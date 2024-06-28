import { TABLELAND_ENDPOINT } from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import useEntitySplit from '@/lib/team/useTeamSplit'
import useTeamSplit from '@/lib/team/useTeamSplit'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'
import TeamListing, { TeamListing as TeamListingType } from './TeamListing'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'

export default function TeamMarketplace({
  selectedChain,
  marketplaceTableContract,
  teamContract,
  teamId,
  isManager,
}: any) {
  const [listings, setListings] = useState<TeamListingType[]>()
  const [listingModalEnabled, setListingModalEnabled] = useState(false)

  const teamSplitAddress = useTeamSplit(teamContract, teamId)

  async function getEntityMarketplaceListings() {
    const marketplaceTableName = await marketplaceTableContract.call(
      'getTableName'
    )
    const statement = `SELECT * FROM ${marketplaceTableName} WHERE entityId = ${teamId}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()

    setListings(data)
  }

  useEffect(() => {
    if (marketplaceTableContract) getEntityMarketplaceListings()
  }, [marketplaceTableContract, teamId])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex justify-between items-center">
        <div className="flex gap-5 opacity-[50%]">
          <Image
            src={'/assets/icon-marketplace.svg'}
            alt="Marketplace icon"
            width={30}
            height={30}
          />
          <h2 className="header font-GoodTimes">Marketplace</h2>
        </div>
        {isManager && (
          <StandardButton
            className="w-full gradient-2 rounded-[5vmax]"
            onClick={() => setListingModalEnabled(true)}
          >
            Create a Listing
          </StandardButton>
        )}
      </div>
      <SlidingCardMenu>
        <div className="flex gap-4">
          {listings?.[0] ? (
            listings.map((listing, i) => (
              <TeamListing
                key={`entity-marketplace-listing-${i}`}
                selectedChain={selectedChain}
                listing={listing}
                marketplaceTableContract={marketplaceTableContract}
                teamContract={teamContract}
                teamSplitAddress={teamSplitAddress}
                editable={isManager}
                refreshListings={getEntityMarketplaceListings}
              />
            ))
          ) : (
            <p>{`This entity hasn't listed any items for sale yet.`}</p>
          )}
        </div>
      </SlidingCardMenu>
      {listingModalEnabled && (
        <TeamMarketplaceListingModal
          teamId={teamId}
          refreshListings={getEntityMarketplaceListings}
          marketplaceTableContract={marketplaceTableContract}
          setEnabled={setListingModalEnabled}
        />
      )}
    </div>
  )
}
