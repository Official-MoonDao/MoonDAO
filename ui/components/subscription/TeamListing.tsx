import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { MediaRenderer, useAddress, useNFT } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Card from '../layout/Card'
import RoundedFrame from '../layout/Frame'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'
import BuyTeamListingModal from './BuyTeamListingModal'
import EntityMarketplaceListingModal from './EntityMarketplaceListingModal'

export type TeamListing = {
  id: number
  entityId: number
  title: string
  description: string
  image: string
  price: string
  currency: string
  shipping: string
}

type TeamListingProps = {
  selectedChain: any
  listing: TeamListing
  entityContract: any
  entitySplitAddress: string | undefined
  marketplaceTableContract?: any
  refreshListings?: any
  editable?: boolean
  showEntityId?: boolean
}

export default function TeamListing({
  selectedChain,
  listing,
  entityContract,
  entitySplitAddress,
  marketplaceTableContract,
  refreshListings,
  editable,
  showEntityId,
}: TeamListingProps) {
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
    <span className="link-frame">
      <span
        id="card-container"
        className={`
        card-container animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[200px] min-w-[350px]
    `}
      >
        <div
          id="card-styling"
          className={`
            bg-darkest-cool rounded-[20px] min-w-[450px] h-[30%] absolute top-0 left-0 pb-5
        `}
        ></div>
        <span
          id="content-container"
          className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-r-[3px] border-darkest-cool"
        >
          <span
            id="content"
            className="animate-fadeIn relative z-50 flex flex-col"
          >
            <div className="">
              <MediaRenderer
                className="rounded-tl-[20px] rounded-tr-[5vmax] rounded-bl-[5vmax] rounded-br-[5vmax] overflow-hidden"
                width="200px"
                height="200px"
                src={listing.image}
              />
            </div>

            <span
              id="title-section"
              className={`
                    flex 
                    pb-5 flex-row items-end pr-5 justify-between
                `}
            >
              <h2
                id="main-header"
                className={`z-20 pt-[20px] static-sub-header font-GoodTimes flex items-center 
        text-left`}
              >
                {listing.title}
              </h2>
              {editable && (
                <div className="flex gap-4 ml-4">
                  <button
                    onClick={() => setEnabledMarketplaceListingModal(true)}
                  >
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
                          await marketplaceTableContract.call(
                            'deleteFromTable',
                            [listing.id, listing.entityId]
                          )
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
                </div>
              )}
            </span>
            <div id="description-and-id-container" className="relative z-50">
              <div id="description-and-id" className="description">
                <div className="flex opacity-[70%]">{listing.description}</div>

                <span
                  id="mobile-button-container"
                  className="md:hidden flex pt-5 pb-5 justify-start w-full"
                >
                  <StandardButton
                    textColor="text-white"
                    borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                    link="#"
                    paddingOnHover="pl-5"
                    className="gradient-2"
                    styleOnly={true}
                    onClick={() => {
                      if (!address)
                        return toast.error('Please connect your wallet')
                      setEnabledBuyListingModal(true)
                    }}
                  >
                    {'Buy Now'}
                  </StandardButton>
                </span>
              </div>

              <span
                id="hovertext-container"
                className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+300px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
                onClick={() => {
                  if (!address) return toast.error('Please connect your wallet')
                  setEnabledBuyListingModal(true)
                }}
              >
                <span className="hidden md:block">{'Buy Now'}</span>
              </span>
            </div>
          </span>
        </span>
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
        {enabledBuyListingModal && (
          <BuyTeamListingModal
            selectedChain={selectedChain}
            listing={listing}
            recipient={entitySplitAddress}
            setEnabled={setEnabledBuyListingModal}
          />
        )}
      </span>
    </span>
  )

  return (
    <RoundedFrame
      noPadding
      bottomLeft="20px"
      bottomRight="20px"
      topRight="20px"
      topLeft="20px"
    >
      <div
        className={`card-container
      animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[200px]
  `}
      >
        <MediaRenderer
          className="rounded-[20px] rounded-bl-[5vmax] rounded-br-[5vmax] rounded-tr-[5vmax]"
          src={listing.image}
        />

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
                  <button
                    onClick={() => setEnabledMarketplaceListingModal(true)}
                  >
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
                          await marketplaceTableContract.call(
                            'deleteFromTable',
                            [listing.id, listing.entityId]
                          )
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

        <div className="content-container relative overflow-hidden">
          <p className="py-2 h-full overflow-auto description">
            {listing.description}
          </p>
          <p>{`${listing.price} ${listing.currency}`}</p>
          <span
            id="hovertext-container"
            className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+300px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
          >
            <span className="hidden md:block">{'Buy'}</span>
          </span>
        </div>

        {enabledBuyListingModal && (
          <BuyTeamListingModal
            selectedChain={selectedChain}
            listing={listing}
            recipient={entitySplitAddress}
            setEnabled={setEnabledBuyListingModal}
          />
        )}
      </div>
    </RoundedFrame>
  )
}
