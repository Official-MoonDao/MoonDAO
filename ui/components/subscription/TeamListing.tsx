import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { MediaRenderer, useAddress } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '../layout/LoadingSpinner'
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
  marketplaceTableContract?: any
  refreshListings?: any
  editable?: boolean
  teamName?: boolean
}

export default function TeamListing({
  selectedChain,
  listing,
  marketplaceTableContract,
  teamContract,
  refreshListings,
  editable,
  teamName,
}: TeamListingProps) {
  const address = useAddress()

  const [enabledMarketplaceListingModal, setEnabledMarketplaceListingModal] =
    useState(false)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)

  const [teamData, setTeamData] = useState<any>()

  useEffect(() => {
    async function getTeamData() {
      if (teamContract && listing) {
        // Check if teamContract is defined
        const teamNft = await teamContract.erc721.get(listing.teamId)
        setTeamData({
          name: teamNft.metadata.name,
          multisigAddress: teamNft.owner,
        })
      }
    }
    if (listing) getTeamData()
  }, [listing, teamContract])

  return (
    <span
      id="link-frame"
      className={`card-container h-full w-full flex lg:flex-col rounded-[20px] relative overflow-hidden ${
        !editable ? 'cursor-pointer' : ''
      }`}
      onClick={() => {
        if (!address) return toast.error('Please connect your wallet')
        if (!editable) {
          setEnabledBuyListingModal(true)
        }
      }}
    >
      {!editable ? (
        <>
          <span
            id="Interactive-Element"
            className="clip absolute h-full w-full z-10"
          ></span>
          <div
            id="card-styling"
            className={`
          bg-darkest-cool rounded-[20px] w-[43%] h-[30%] absolute top-0 left-0 pb-5
      `}
          ></div>
        </>
      ) : (
        <>
          <span
            id="Static-Element"
            className="divider-8 absolute w-[80%] h-full z-10"
          ></span>
          <div
            id="card-styling"
            className={`
          bg-darkest-cool rounded-[20px] w-[23%] h-[20%] absolute top-0 left-0 pb-5
      `}
          ></div>
        </>
      )}

      <span
        id="card-container"
        className={`
        card-container animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[200px]
    `}
      >
        <div
          id="card-styling"
          className={`
            bg-gradient-to-tl from-transparent from-50% to-darkest-cool to-50% rounded-[20px] w-[43%] h-[30%] absolute top-0 left-0 pb-5
        `}
        ></div>
        <span
          id="content-container"
          className="h-full w-full lg:max-w-[575px] p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between"
        >
          <span
            id="content"
            className="animate-fadeIn relative z-50 flex flex-col"
          >
            <div className="">
              <MediaRenderer
                className="w-full rounded-tl-[20px] rounded-tr-[5vmax] rounded-bl-[5vmax] max-w-[575px] md:max-w-[500px] pb-5 rounded-br-[5vmax] overflow-hidden"
                width="100%"
                height="100%"
                src={listing.image}
              />
            </div>

            <span
              id="title-section"
              className={`
                    flex 
                    pb-5 flex flex-col items-start pr-5 justify-between
                `}
            >
              <div className="flex min-h-[100px] pb-5 flex-col">
                {teamName && teamData?.name && (
                  <Link
                    href={`/team/${listing.teamId}`}
                    className="font-bold text-light-cool"
                  >
                    {teamData.name}
                  </Link>
                )}
                <h2
                  id="main-header"
                  className={`z-20 pt-[10px] pb-[10px] static-sub-header font-GoodTimes flex items-center 
        text-left`}
                >
                  {listing.title}
                </h2>
                <p>{listing.description}</p>
              </div>
              {editable && (
                <div className="flex flex-wrap items-end justify-end w-full gap-4 ml-4 ">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      setEnabledMarketplaceListingModal(true)
                    }}
                  >
                    {!isDeleting && (
                      <PencilIcon className="h-6 w-6 text-light-warm" />
                    )}
                  </button>
                  {isDeleting ? (
                    <LoadingSpinner className="scale-[75%]" />
                  ) : (
                    <button
                      onClick={async (event) => {
                        event.stopPropagation()
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
            <div id="listing-id-container" className="relative z-50">
              <div id="listing-id" className="listing">
                <div>
                  {`${listing.price} 
                  ${listing.currency}`}
                </div>
                <div id="listing-description"></div>
                <span
                  id="mobile-button-container"
                  className="md:hidden flex pt-5 pb-5 justify-start w-full"
                >
                  {/* Removed StandardButton here */}
                </span>
              </div>
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
            recipient={teamData.multisigAddress}
            setEnabled={setEnabledBuyListingModal}
          />
        )}
      </span>
    </span>
  )
}
