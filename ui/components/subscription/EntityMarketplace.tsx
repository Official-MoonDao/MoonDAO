import { TABLELAND_ENDPOINT } from 'const/config'
import { useEffect, useState } from 'react'
import useEntitySplit from '@/lib/entity/useEntitySplit'
import Button from './Button'
import Card from './Card'
import EntityMarketplaceListingModal from './EntityMarketplaceListingModal'
import TeamListing, { TeamListing as TeamListingType } from './TeamListing'

export default function EntityMarketplace({
  selectedChain,
  marketplaceTableContract,
  entityContract,
  entityId,
  isManager,
}: any) {
  const [listings, setListings] = useState<TeamListingType[]>()
  const [listingModalEnabled, setListingModalEnabled] = useState(false)

  const entitySplitAddress = useEntitySplit(entityContract, entityId)

  async function getEntityMarketplaceListings() {
    const marketplaceTableName = await marketplaceTableContract.call(
      'getTableName'
    )
    const statement = `SELECT * FROM ${marketplaceTableName} WHERE entityId = ${entityId}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()

    setListings(data)
  }

  useEffect(() => {
    if (marketplaceTableContract) getEntityMarketplaceListings()
  }, [marketplaceTableContract, entityId])

  return (
    <Card>
      <p className="text-2xl">Marketplace</p>
      <div className="mt-4 max-h-[700px] overflow-auto grid xs:grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {listings?.[0] ? (
          listings.map((listing, i) => (
            <TeamListing
              key={`entity-marketplace-listing-${i}`}
              selectedChain={selectedChain}
              listing={listing}
              marketplaceTableContract={marketplaceTableContract}
              entityContract={entityContract}
              entitySplitAddress={entitySplitAddress}
              editable={isManager}
              refreshListings={getEntityMarketplaceListings}
            />
          ))
        ) : (
          <p>{`This entity hasn't listed any items for sale yet.`}</p>
        )}
      </div>
      {listingModalEnabled && (
        <EntityMarketplaceListingModal
          entityId={entityId}
          refreshListings={getEntityMarketplaceListings}
          marketplaceTableContract={marketplaceTableContract}
          setEnabled={setListingModalEnabled}
        />
      )}
      {isManager && (
        <Button className="mt-4" onClick={() => setListingModalEnabled(true)}>
          Create a Listing
        </Button>
      )}
    </Card>
  )
}
