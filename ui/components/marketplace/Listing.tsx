import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { MediaRenderer, useAddress, useNFT } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import EntityMarketplaceListingModal from '../subscription/EntityMarketplaceListingModal'
import BuyListingModal from './BuyListingModal'

export type Listing = {
  id: number
  entityId: number
  title: string
  description: string
  image: string
  price: string
  currency: string
}

type ListingProps = {
  selectedChain: any
  listing: Listing
  entityContract: any
  marketplaceTableContract?: any
  refreshListings?: any
  editable?: boolean
  showEntityId?: boolean
}

export default function Listing({
  selectedChain,
  listing,
  entityContract,
  marketplaceTableContract,
  refreshListings,
  editable,
  showEntityId,
}: ListingProps) {
  const address = useAddress()

  const [enabledMarketplaceListingModal, setEnabledMarketplaceListingModal] =
    useState(false)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)

  const { data: nft, isLoading: isLoadingNft }: any = useNFT(
    entityContract,
    listing.entityId
  )

  return (
    <div className="p-2 flex flex-col justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm gap-2">
      <MediaRenderer src={listing.image} />
      <div className="flex justify-between">
        <p className="font-bold">{listing.title}</p>
        <div className="flex gap-2">
          {showEntityId && (
            <Link
              href={`/entity/${listing.entityId}`}
              className="text-moon-orange"
            >{`Entity #${listing.entityId}`}</Link>
          )}
          <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
            {editable && (
              <div className="flex gap-4">
                <button onClick={() => setEnabledMarketplaceListingModal(true)}>
                  {!isDeleting && (
                    <PencilIcon className="h-6 w-6 text-moon-orange" />
                  )}
                </button>
                {isDeleting ? (
                  <LoadingSpinner className="scale-[75%]" />
                ) : (
                  <button
                    onClick={async () => {
                      setIsDeleting(true)
                      try {
                        await marketplaceTableContract.call('deleteFromTable', [
                          listing.id,
                          listing.entityId,
                        ])
                        setTimeout(() => {
                          refreshListings()
                          setIsDeleting(false)
                        }, 25000)
                      } catch (err) {
                        console.log(err)
                        setIsDeleting(false)
                      }
                    }}
                  >
                    <TrashIcon className="h-6 w-6 text-moon-orange" />
                  </button>
                )}
                {enabledMarketplaceListingModal && (
                  <EntityMarketplaceListingModal
                    entityId={listing.entityId}
                    setEnabled={setEnabledMarketplaceListingModal}
                    marketplaceTableContract={marketplaceTableContract}
                    listing={listing}
                    edit
                    refreshListings={refreshListings}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="py-2 h-[200px] overflow-auto">{listing.description}</p>
      <p>{`${listing.price} ${listing.currency}`}</p>
      {enabledBuyListingModal && (
        <BuyListingModal
          selectedChain={selectedChain}
          listing={listing}
          recipient={nft?.owner}
          setEnabled={setEnabledBuyListingModal}
        />
      )}
      {isLoadingNft ? (
        <LoadingSpinner className="scale-[75%]" />
      ) : (
        <button
          className="px-2 flex items-center justify-center min-w-[100px] border-2 border-moon-orange text-moon-orange rounded-full"
          onClick={() => {
            if (!address) return toast.error('Please connect your wallet')
            setEnabledBuyListingModal(true)
          }}
        >
          Buy
        </button>
      )}
    </div>
  )
}
