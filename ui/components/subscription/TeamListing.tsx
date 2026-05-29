import { PencilIcon, ShoppingBagIcon, TrashIcon } from '@heroicons/react/24/outline'
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
import IPFSRenderer from '../layout/IPFSRenderer'
import BuyTeamListingModal from './BuyTeamListingModal'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'

export type TeamListing = {
  id: number
  teamId: number
  teamName?: string
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
  listing: TeamListing | null
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

  const [enabledMarketplaceListingModal, setEnabledMarketplaceListingModal] = useState(false)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(
    queriedListingId !== undefined && queriedListingId === listing?.id
  )

  const currTime = useCurrUnixTime()

  const [isActive, setIsActive] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isUpcoming, setIsUpcoming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const daysUntilExpiry = daysUntilTimestamp(listing?.endTime || 0)

  const [teamNFT, setTeamNFT] = useState<any>()

  const retriesRef = useRef(0)

  useEffect(() => {
    async function getTeamNFT() {
      if (!listing) return
      try {
        const nft = await getNFT({
          contract: teamContract,
          tokenId: BigInt(listing.teamId),
          includeOwner: true,
        })
        if (listing.title?.startsWith('Cultura')) console.log(nft)
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
    if (teamContract && listing?.teamId !== undefined) {
      retriesRef.current = 0
      getTeamNFT()
    }
  }, [listing?.teamId, teamContract, listing])

  useEffect(() => {
    if (!listing) return

    if (currTime >= (listing.startTime || 0) && currTime <= (listing.endTime || 0)) {
      setIsActive(true)
    } else if ((listing.startTime || 0) === 0 && (listing.endTime || 0) === 0) {
      setIsActive(true)
    } else if (editable) {
      setIsActive(true)
    } else {
      setIsActive(false)
    }

    if (currTime < (listing.startTime || 0)) {
      setIsUpcoming(true)
    } else {
      setIsUpcoming(false)
    }

    if (
      currTime > (listing.endTime || 0) &&
      listing.endTime !== 0 &&
      listing.endTime !== undefined
    ) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, listing?.startTime, listing?.endTime, editable, listing])

  useEffect(() => {
    if (queriedListingId !== undefined && queriedListingId === listing?.id) {
      setEnabledBuyListingModal(true)
    }
  }, [queriedListingId, listing?.id])

  if (!listing) return null
  if (!isActive) return null

  return (
    <>
      <div
        id="link-frame"
        onClick={() => setEnabledBuyListingModal(true)}
        className={`flex-shrink-0 w-56 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col cursor-pointer`}
      >
        {/* Image */}
        <div className="relative w-full h-36 bg-white/5 flex-shrink-0 overflow-hidden">
          {listing?.image ? (
            <IPFSRenderer
              src={listing.image}
              alt={listing.title}
              width={224}
              height={144}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBagIcon className="w-10 h-10 text-white/20" />
            </div>
          )}
          {/* Team badge */}
          {(teamNFT?.metadata?.name || listing?.teamId) && (
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
              <span className="text-white/70 text-xs truncate max-w-[120px] block">
                {teamNFT?.metadata?.name || `Team ${listing?.teamId}`}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <h4 id="main-header" className="text-white font-semibold text-sm leading-tight line-clamp-2">
            {listing?.title}
          </h4>
          {listing?.description && (
            <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
              {listing.description}
            </p>
          )}

          {/* Footer: price + actions */}
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            {listing?.price && listing?.currency ? (
              <div>
                <span id="listing-price" className="text-white font-bold text-sm">
                  {`${isCitizen
                    ? truncateTokenValue(listing.price, listing.currency)
                    : truncateTokenValue(+listing.price * 1.1, listing.currency)
                  } ${listing.currency}`}
                </span>
                {isCitizen && (
                  <span id="listing-original-price" className="text-white/30 text-xs line-through ml-1.5">
                    {`${truncateTokenValue(+listing.price * 1.1, listing.currency)} ${listing.currency}`}
                  </span>
                )}
                {!isCitizen && listing.price && (
                  <p id="listing-savings" className="text-white/40 text-xs mt-0.5">
                    {`Save ${+listing.price * 0.1} ${listing.currency} with citizenship`}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-white/30 text-xs">—</span>
            )}

            {editable && (
              <div className="flex items-center gap-2">
                <button
                  id="edit-listing-button"
                  onClick={(e) => { e.stopPropagation(); setEnabledMarketplaceListingModal(true) }}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                {isDeleting ? (
                  <LoadingSpinner className="scale-75" />
                ) : (
                  <button
                    id="delete-listing-button"
                    onClick={async (e) => {
                      if (!account) return
                      e.stopPropagation()
                      setIsDeleting(true)
                      try {
                        const transaction = prepareContractCall({
                          contract: marketplaceTableContract,
                          method: 'deleteFromTable' as string,
                          params: [listing?.id, listing?.teamId],
                        })
                        const receipt = await sendAndConfirmTransaction({ transaction, account })
                        setTimeout(() => { refreshListings(); setIsDeleting(false) }, 25000)
                      } catch (err) {
                        console.log(err)
                        toast.error('Failed to delete listing. Please try again.')
                        setIsDeleting(false)
                      }
                    }}
                    className="text-white/40 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {isUpcoming && editable && (
            <p id="listing-status" className="text-yellow-400/70 text-xs">
              {`*This listing is not available for purchase until ${new Date(listing.startTime * 1000).toLocaleDateString()} ${new Date(listing.startTime * 1000).toLocaleTimeString()}`}
            </p>
          )}

          {!isExpired && !isUpcoming && listing?.endTime != 0 && (
            <p id="listing-end-time" className="text-white/30 text-xs">
              Offer ends in {daysUntilExpiry} {+daysUntilExpiry === 1 ? 'day' : 'days'}
            </p>
          )}
        </div>
      </div>

      {enabledMarketplaceListingModal && listing && (
        <TeamMarketplaceListingModal
          teamId={listing.teamId}
          setEnabled={setEnabledMarketplaceListingModal}
          marketplaceTableContract={marketplaceTableContract}
          listing={listing}
          edit
          refreshListings={refreshListings}
        />
      )}
      {enabledBuyListingModal && listing && (
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
