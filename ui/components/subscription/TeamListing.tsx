import {
  ArrowUpRightIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { MediaRenderer, useAddress } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { daysUntilTimestamp } from '@/lib/utils/timestamp'
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
  isCitizen?: boolean
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
  const address = useAddress()

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

  const [teamData, setTeamData] = useState<any>()

  const daysUntilExpiry = daysUntilTimestamp(listing.endTime)

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

  return (
    <>
      {isActive && (
        <span
          id="link-frame"
          className={`card-container h-full w-full flex lg:flex-col rounded-[20px] relative overflow-hidden ${
            !editable ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
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
                    height="200px"
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
                  <div className="w-full flex min-h-[100px] pb-5 flex-col">
                    <div className="flex items-center justify-between w-full">
                      {teamName && teamData?.name && (
                        <Link
                          id="listing-team-name"
                          href={`/team/${listing.teamId}`}
                          className="font-bold text-light-cool"
                        >
                          {teamData.name}
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <h2
                        id="main-header"
                        className={`z-20 pt-[10px] pb-[10px] static-sub-header font-GoodTimes flex items-center 
                      text-left`}
                      >
                        {listing.title}
                      </h2>
                      <StandardButton
                        className="gradient-2"
                        onClick={(e: any) => {
                          e.stopPropagation()
                          const link = `${window.location.origin}/team/${listing.teamId}?listing=${listing.id}`
                          navigator.clipboard.writeText(link)
                          toast.success('Link copied to clipboard')
                        }}
                        hoverEffect={false}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowUpRightIcon className="h-4 w-4" />
                          {'Share'}
                        </div>
                      </StandardButton>
                    </div>
                    <p id="listing-description">{listing.description}</p>
                  </div>
                  {editable && (
                    <div className="flex flex-wrap items-end justify-end w-full gap-4 ml-4 ">
                      <button
                        id="edit-listing-button"
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
                          id="delete-listing-button"
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
                    <p id="listing-price" className="font-bold">
                      {`${
                        isCitizen
                          ? truncateTokenValue(listing.price, listing.currency)
                          : truncateTokenValue(
                              +listing.price * 1.1,
                              listing.currency
                            )
                      } 
                  ${listing.currency}`}
                    </p>
                    {editable && (
                      <p id="listing-status" className="opacity-60">
                        {isExpired
                          ? `*This listing has expired and is no longer available for purchase.`
                          : isUpcoming
                          ? `*This listing is not available for purchase until ${
                              new Date(
                                listing.startTime * 1000
                              ).toLocaleDateString() +
                              ' ' +
                              new Date(
                                listing.startTime * 1000
                              ).toLocaleTimeString()
                            }`
                          : ''}
                      </p>
                    )}
                    {!isExpired && !isUpcoming && listing.endTime != 0 && (
                      <p
                        id="listing-end-time"
                        className="opacity-60 text-sm"
                      >{`Offer ends in ${daysUntilExpiry} ${
                        +daysUntilExpiry === 1 ? `day` : `days`
                      }`}</p>
                    )}
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
                recipient={teamData?.multisigAddress}
                setEnabled={setEnabledBuyListingModal}
              />
            )}
          </span>
        </span>
      )}
    </>
  )
}
