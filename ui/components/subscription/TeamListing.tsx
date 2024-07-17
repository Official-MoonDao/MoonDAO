import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { MediaRenderer, useAddress } from '@thirdweb-dev/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'
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
  shipping: string
}

type TeamListingProps = {
  selectedChain: any
  listing: TeamListing
  teamContract: any
  teamSplitAddress: string | undefined
  marketplaceTableContract?: any
  refreshListings?: any
  editable?: boolean
}

export default function TeamListing({
  selectedChain,
  listing,
  teamSplitAddress,
  marketplaceTableContract,
  refreshListings,
  editable,
}: TeamListingProps) {
  const address = useAddress()

  const [enabledMarketplaceListingModal, setEnabledMarketplaceListingModal] =
    useState(false)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <span
      id="link-frame"
      className={`card-container w-[350px] flex lg:flex-col rounded-[20px] relative overflow-hidden cursor-pointer`}
    >
      <span
        id="Interactive-Element"
        className="clip absolute h-full w-full z-10"
      ></span>
      <span
        id="card-container"
        className={`
        card-container animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[200px] min-w-[350px] max-w-[600px]
    `}
      >
        <div
          id="card-styling"
          className={`
            bg-darkest-cool rounded-[20px] min-w-[30%] h-[30%] absolute top-0 left-0 pb-5
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
                className="w-full rounded-tl-[20px] rounded-tr-[5vmax] rounded-bl-[5vmax] rounded-br-[5vmax] overflow-hidden"
                width="100%"
                height="100%"
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
                      <PencilIcon className="h-6 w-6 text-light-warm" />
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
                            [listing.id, listing.teamId]
                          )
                          setTimeout(() => {
                            refreshListings()
                            setIsDeleting(false)
                          }, 25000)
                        } catch (err) {
                          console.log(err)
                          toast.error('Error deleting listing')
                          setIsDeleting(false)
                        }
                      }}
                    >
                      <TrashIcon className="h-6 w-6 text-light-warm" />
                    </button>
                  )}
                </div>
              )}
            </span>
            <div id="description-and-id-container" className="relative z-50">
              <div id="description-and-id" className="description">
                <div className="flex opacity-[70%]">
                  {listing.description}
                </div>
                <div>
                  {`${listing.price} 
                  ${listing.currency}`}
                </div>
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
            recipient={teamSplitAddress}
            setEnabled={setEnabledBuyListingModal}
          />
        )}
      </span>
    </span>
  )
}
