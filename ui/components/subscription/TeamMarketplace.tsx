import { TABLELAND_ENDPOINT } from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
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

  async function getEntityMarketplaceListings() {
    const marketplaceTableName = await marketplaceTableContract.call(
      'getTableName'
    )
    const statement = `SELECT * FROM ${marketplaceTableName} WHERE teamId = ${teamId}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()

    setListings(data)
  }

  useEffect(() => {
    if (marketplaceTableContract) getEntityMarketplaceListings()
  }, [marketplaceTableContract, teamId])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
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
            className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
            onClick={() => setListingModalEnabled(true)}
          >
            Create a Listing
          </StandardButton>
        )}
      </div>
      <SlidingCardMenu>
        <div className="flex gap-4">
          {listings?.[0] &&
            listings.map((listing, i) => (
              <TeamListing
                key={`team-listing-${i}`}
                selectedChain={selectedChain}
                listing={listing}
                marketplaceTableContract={marketplaceTableContract}
                teamContract={teamContract}
                editable={isManager}
                refreshListings={getEntityMarketplaceListings}
              />
            ))}
        </div>
      </SlidingCardMenu>
      {!listings?.[0] && (
        <p className="p-4">{`This team hasn't listed any items for sale yet.`}</p>
      )}
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
