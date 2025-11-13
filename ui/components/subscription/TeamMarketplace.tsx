import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import StandardButton from '../layout/StandardButton'
import TeamListing, { TeamListing as TeamListingType } from './TeamListing'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'

type TeamMarketplaceProps = {
  selectedChain: any
  marketplaceTableContract: any
  teamContract: any
  teamId: string
  isManager: boolean
  isCitizen: any
  listings?: TeamListingType[] // Optional: can be provided externally to avoid fetching
}

export default function TeamMarketplace({
  selectedChain,
  marketplaceTableContract,
  teamContract,
  teamId,
  isManager,
  isCitizen,
  listings: externalListings,
}: TeamMarketplaceProps) {
  const router = useRouter()

  const [internalListings, setInternalListings] = useState<TeamListingType[]>()
  const [listingModalEnabled, setListingModalEnabled] = useState(false)
  const [queriedListingId, setQueriedListingId] = useState<number>()
  const [tableName, setTableName] = useState<string | null>(null)

  const shouldFetch = !externalListings

  // Get table name from contract
  useEffect(() => {
    async function getTableName() {
      if (!marketplaceTableContract || !shouldFetch) return
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
  }, [marketplaceTableContract, shouldFetch])

  // Build statement and fetch with SWR
  const statement =
    shouldFetch && tableName
      ? `SELECT * FROM ${tableName} WHERE teamId = ${teamId}`
      : null
  const { data, mutate } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (data) {
      setInternalListings(data)
    }
  }, [data])

  const listings = externalListings || internalListings

  const getEntityMarketplaceListings = () => {
    mutate()
  }

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
    <div id="team-marketplace" className="w-full p-6">
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
            className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px] transition-all duration-200 hover:scale-105"
            onClick={() => setListingModalEnabled(true)}
          >
            Create a Listing
          </StandardButton>
        )}
      </div>
      <div className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
