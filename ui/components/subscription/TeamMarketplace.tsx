import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import StandardButton from '../layout/StandardButton'
import TeamListing, { TeamListing as TeamListingType } from './TeamListing'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'

export default function TeamMarketplace({
  selectedChain,
  marketplaceTableContract,
  teamContract,
  teamId,
  isManager,
  isCitizen,
}: any) {
  const router = useRouter()

  const [listings, setListings] = useState<TeamListingType[]>()
  const [listingModalEnabled, setListingModalEnabled] = useState(false)
  const [queriedListingId, setQueriedListingId] = useState<number>()

  async function getEntityMarketplaceListings() {
    const marketplaceTableName = await readContract({
      contract: marketplaceTableContract,
      method: 'getTableName' as string,
      params: [],
    })
    const statement = `SELECT * FROM ${marketplaceTableName} WHERE teamId = ${teamId}`

    const res = await fetch(`/api/tableland/query?statement=${statement}`)
    const data = await res.json()

    setListings(data)
  }

  useEffect(() => {
    if (marketplaceTableContract) getEntityMarketplaceListings()
  }, [marketplaceTableContract, teamId])

  useEffect(() => {
    if (router.query.listing) {
      function scrollToMarketplace() {
        const teamMarketplace = document.getElementById('team-marketplace')
        if (teamMarketplace) {
          teamMarketplace.scrollIntoView({ behavior: 'smooth' })
        }
      }

      const timeout = setTimeout(scrollToMarketplace, 3000)
      setQueriedListingId(Number(router.query.listing))

      return () => clearTimeout(timeout)
    }
  }, [router.query.listingId])

  return (
    <div
      id="team-marketplace"
      className="w-full p-6"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-6">
        <div className="flex gap-5">
          <Image
            src={'/assets/icon-marketplace.svg'}
            alt="Marketplace icon"
            width={30}
            height={30}
            className="opacity-70"
          />
          <h2 className="font-GoodTimes text-2xl text-white">Marketplace</h2>
        </div>
        {isManager && (
          <StandardButton
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
            onClick={() => setListingModalEnabled(true)}
          >
            Create a Listing
          </StandardButton>
        )}
      </div>
      <div className="mt-4">
        <div className="flex gap-4 flex-wrap">
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
                queriedListingId={queriedListingId}
                isCitizen={isCitizen}
              />
            ))}
        </div>
      </div>
      {!listings?.[0] && (
        <p className="text-slate-300 text-center py-8">{`This team hasn't listed any items for sale yet.`}</p>
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
