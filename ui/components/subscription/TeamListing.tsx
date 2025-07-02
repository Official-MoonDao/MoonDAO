import { PencilIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { daysUntilTimestamp } from '@/lib/utils/timestamp'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import ShareButton from '../layout/ShareButton'
import StandardCard from '../layout/StandardCard'
import BuyTeamListingModal from './BuyTeamListingModal'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'

export type TeamListing = {
  id: number
  teamId: number
  title: string
  description: string
  image: string
  price: string
  currency: string
  startTime: number
  endTime: number
  timestamp: number
  metadata: string
  shipping: string
  tag: string
}

type TeamListingProps = {
  selectedChain: any
  listing: TeamListing
  teamContract: any
  marketplaceTableContract?: any
  refreshListings?: any
  editable?: boolean
  teamName?: boolean
  queriedListingId?: number
  isCitizen?: any
}

export default function TeamListing({
  selectedChain,
  listing,
  marketplaceTableContract,
  teamContract,
  refreshListings,
  editable,
  teamName,
  queriedListingId,
  isCitizen,
}: TeamListingProps) {
  const account = useActiveAccount()
  const router = useRouter()

  const [enabledMarketplaceListingModal, setEnabledMarketplaceListingModal] =
    useState(false)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(
    queriedListingId === listing.id
  )

  const currTime = useCurrUnixTime()

  const [isActive, setIsActive] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isUpcoming, setIsUpcoming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const daysUntilExpiry = daysUntilTimestamp(listing.endTime)

  const [teamNFT, setTeamNFT] = useState<any>()

  const retriesRef = useRef(0)

  useEffect(() => {
    async function getTeamNFT() {
      try {
        const nft = await getNFT({
          contract: teamContract,
          tokenId: BigInt(listing.teamId),
          includeOwner: true,
        })
        if (listing.title.startsWith('Cultura')) console.log(nft)
        // Set teamNFT even if metadata.name doesn't exist, we'll handle the fallback in the display
        if (nft) setTeamNFT(nft)
      } catch (err) {
        retriesRef.current += 1
        if (retriesRef.current < 3) {
          setTimeout(() => {
            getTeamNFT()
          }, 2000)
        }
      }
    }
    if (teamContract && listing.teamId !== undefined) {
      retriesRef.current = 0
      getTeamNFT()
    }
  }, [listing.teamId, teamContract])

  useEffect(() => {
    if (currTime >= listing.startTime && currTime <= listing.endTime) {
      setIsActive(true)
    } else if (listing.startTime === 0 && listing.endTime === 0) {
      setIsActive(true)
    } else if (editable) {
      setIsActive(true)
    } else {
      setIsActive(false)
    }

    if (currTime < listing.startTime) {
      setIsUpcoming(true)
    } else {
      setIsUpcoming(false)
    }

    if (
      currTime > listing.endTime &&
      listing.endTime !== 0 &&
      listing.endTime !== undefined
    ) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, listing.startTime, listing.endTime, editable])

  if (!isActive) return null

  const listingFooter = (
    <div className="text-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p id="listing-price" className="font-bold">
            {`${
              isCitizen
                ? truncateTokenValue(listing.price, listing.currency)
                : truncateTokenValue(+listing.price * 1.1, listing.currency)
            } ${listing.currency}`}
          </p>
          {isCitizen && (
            <p
              id="listing-original-price"
              className="line-through text-xs opacity-70"
            >
              {`${truncateTokenValue(+listing.price * 1.1, listing.currency)} ${
                listing.currency
              }`}
            </p>
          )}
        </div>
        {!isCitizen && (
          <button
            id="listing-savings"
            onClick={(e) => {
              e.stopPropagation()
              router.push('/citizen')
            }}
            className="flex items-center hover:underline text-sm"
          >
            <span className="bg-light-warm px-2 py-1 rounded mr-1">
              {`Save ${truncateTokenValue(
                +listing.price * 0.1,
                listing.currency
              )} ${listing.currency}`}
            </span>
            {' with citizenship'}
          </button>
        )}
      </div>
      {editable && (
        <p id="listing-status" className="opacity-60">
          {isExpired
            ? `*This listing has expired and is no longer available for purchase.`
            : isUpcoming
            ? `*This listing is not available for purchase until ${
                new Date(listing.startTime * 1000).toLocaleDateString() +
                ' ' +
                new Date(listing.startTime * 1000).toLocaleTimeString()
              }`
            : ''}
        </p>
      )}
      {!isExpired && !isUpcoming && listing.endTime != 0 && (
        <p id="listing-end-time" className="mt-2 opacity-60">
          {`Offer ends in ${daysUntilExpiry} ${
            +daysUntilExpiry === 1 ? 'day' : 'days'
          }`}
        </p>
      )}
    </div>
  )

  const listingActions = (
    <div className="flex items-center gap-4">
      <ShareButton
        link={`${window.location.origin}/team/${
          teamNFT?.metadata?.name ? generatePrettyLink(teamNFT.metadata.name) : listing.teamId
        }?listing=${listing.id}`}
      />
      {editable && (
        <>
          <button
            id="edit-listing-button"
            onClick={(event) => {
              event.stopPropagation()
              setEnabledMarketplaceListingModal(true)
            }}
          >
            {!isDeleting && (
              <PencilIcon className="h-6 w-6 text-light-warm hover:text-light-cool" />
            )}
          </button>
          {isDeleting ? (
            <LoadingSpinner className="scale-[75%]" />
          ) : (
            <button
              id="delete-listing-button"
              onClick={async (event) => {
                if (!account) return
                event.stopPropagation()
                setIsDeleting(true)
                try {
                  const transaction = prepareContractCall({
                    contract: marketplaceTableContract,
                    method: 'deleteFromTable' as string,
                    params: [listing.id, listing.teamId],
                  })
                  const receipt = await sendAndConfirmTransaction({
                    transaction,
                    account: account,
                  })
                  setTimeout(() => {
                    refreshListings()
                    setIsDeleting(false)
                  }, 25000)
                } catch (err) {
                  console.log(err)
                  toast.error('Error deleting listing.')
                  setIsDeleting(false)
                }
              }}
            >
              <TrashIcon className="h-6 w-6 text-light-warm hover:text-light-cool" />
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      <StandardCard
        title={listing.title}
        headerLink={`/team/${listing.teamId}`}
        headerLinkLabel={teamNFT?.metadata?.name || `Team ${listing.teamId}`}
        paragraph={listing.description}
        footer={listingFooter}
        actions={listingActions}
        onClick={() => {
          if (!editable) {
            setEnabledBuyListingModal(true)
          }
        }}
        image={listing.image}
        profile={true}
        inline
      />

      {enabledMarketplaceListingModal && (
        <TeamMarketplaceListingModal
          teamId={listing.teamId}
          setEnabled={setEnabledMarketplaceListingModal}
          marketplaceTableContract={marketplaceTableContract}
          listing={listing}
          edit
          refreshListings={refreshListings}
        />
      )}
      {enabledBuyListingModal && (
        <BuyTeamListingModal
          selectedChain={selectedChain}
          listing={listing}
          recipient={teamNFT?.owner}
          setEnabled={setEnabledBuyListingModal}
        />
      )}
    </>
  )
}
