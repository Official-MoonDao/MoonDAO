import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { MediaRenderer, useContract } from '@thirdweb-dev/react'
import { DEFAULT_CHAIN, DEPLOYED_ORIGIN, TEAM_ADDRESSES } from 'const/config'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import ChainContext from '@/lib/thirdweb/chain-context'
import { renameFile } from '@/lib/utils/files'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import TeamABI from '../../const/abis/Team.json'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { TeamListing } from './TeamListing'

type ListingData = {
  title: string
  description: string
  image: any
  price: any
  currency: string
  tag: string
  metadata: string
  shipping: string
}

type TeamMarketplaceListingModalProps = {
  teamId: number
  setEnabled: Function
  refreshListings: Function
  marketplaceTableContract: any
  edit?: boolean
  listing?: TeamListing
}

export default function TeamMarketplaceListingModal({
  teamId,
  setEnabled,
  refreshListings,
  marketplaceTableContract,
  edit,
  listing,
}: TeamMarketplaceListingModalProps) {
  const { getAccessToken } = usePrivy()
  const { selectedChain } = useContext(ChainContext)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isUpcoming, setIsUpcoming] = useState(false)

  const [isTimed, setIsTimed] = useState(listing && listing?.startTime > 0)
  const [startTime, setStartTime] = useState(listing?.startTime || 0)
  const [endTime, setEndTime] = useState(listing?.endTime || 0)
  const [listingData, setListingData] = useState<ListingData>(
    edit
      ? {
          title: listing?.title || '',
          description: listing?.description || '',
          image: listing?.image || '',
          price: listing?.price || '',
          currency: listing?.currency || 'ETH',
          tag: listing?.tag || '',
          metadata: listing?.metadata || '',
          shipping: listing?.shipping || 'false',
        }
      : {
          title: '',
          description: '',
          image: '',
          price: '',
          currency: 'ETH',
          tag: '',
          metadata: '',
          shipping: 'false',
        }
  )

  const isValid =
    listingData.title.trim() !== '' &&
    listingData.description.trim() !== '' &&
    listingData.price.trim() !== ''

  const currTime = useCurrUnixTime()

  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug],
    TeamABI
  )

  useEffect(() => {
    if (listing) {
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
    }
  }, [currTime, listing])

  useEffect(() => {
    if (!isTimed) {
      setStartTime(0)
      setEndTime(0)
    }
  }, [isTimed])

  return (
    <Modal id="team-marketplace-listing-modal-backdrop" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5  bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto" // Updated styles
        onSubmit={async (e) => {
          e.preventDefault()
          const accessToken = await getAccessToken()
          await createSession(accessToken)
          if (
            listingData.title.trim() === '' ||
            listingData.description.trim() === '' ||
            listingData.price.trim() === ''
          )
            return toast.error('Please fill out all fields')

          if (!listingData.image) {
            return toast.error('Please upload an image')
          }

          if (isTimed) {
            if (startTime >= endTime) {
              return toast.error('Start time must be before end time')
            } else if (endTime <= startTime) {
              return toast.error('End time must be after start time')
            } else if (startTime === 0 || endTime === 0) {
              return toast.error('Please set start and end times')
            }
          }

          setIsLoading(true)

          const cleanedData = cleanData(listingData)

          let imageIpfsLink

          if (
            typeof listingData.image === 'string' &&
            listingData.image !== 'ipfs://undefined' &&
            listingData.image !== 'ipfs://'
          ) {
            imageIpfsLink = listingData.image
          } else {
            const renamedListingImage = renameFile(
              listingData.image,
              `Team#${teamId} ${cleanedData.title} Listing Image`
            )
            const { cid: imageIpfsHash } = await pinBlobOrFile(
              renamedListingImage
            )
            imageIpfsLink = `ipfs://${imageIpfsHash}`
          }

          let tx

          try {
            if (edit) {
              tx = await marketplaceTableContract.call('updateTable', [
                listing?.id,
                cleanedData.title,
                cleanedData.description,
                imageIpfsLink,
                teamId,
                cleanedData.price,
                cleanedData.currency,
                startTime,
                endTime,
                currTime,
                '',
                '',
                cleanedData.shipping,
              ])
            } else {
              tx = await marketplaceTableContract?.call('insertIntoTable', [
                cleanedData.title,
                cleanedData.description,
                imageIpfsLink,
                teamId,
                cleanedData.price,
                cleanedData.currency,
                startTime,
                endTime,
                currTime,
                '',
                '',
                cleanedData.shipping,
              ])
            }

            //Get listing id from receipt and send discord notification
            const listingId = parseInt(
              tx.receipt.logs[1].topics[1],
              16
            ).toString()
            const listingTeamId = parseInt(
              tx.receipt.logs[1].topics[2],
              16
            ).toString()
            const team = await teamContract?.erc721.get(listingTeamId)
            const teamName = team?.metadata.name as string
            sendDiscordMessage(
              accessToken,
              'networkNotifications',
              `[**${teamName}** has ${
                edit ? 'updated a' : 'posted a new'
              } listing](${DEPLOYED_ORIGIN}/team/${generatePrettyLink(
                teamName
              )}?listing=${listingId}&_timestamp=123456789)`
            )

            setTimeout(() => {
              refreshListings()
              setIsLoading(false)
              setEnabled(false)
            }, 25000)
          } catch (err: any) {
            console.log(err)
            toast.error(
              'Something went wrong, please contact support if this issue persists.',
              { duration: 10000 }
            )
            setIsLoading(false)
          }
          await destroySession(accessToken)
        }}
      >
        <div className="w-full flex items-center justify-between">
          <h2 className="font-GoodTimes">
            {edit ? 'Edit a Listing' : 'Add a Listing'}
          </h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        {/* File input for listingdata.image */}
        {listingData.image && (
          <>
            {typeof listingData.image === 'string' ? (
              <MediaRenderer
                src={listingData.image}
                height="200px"
                width="200px"
                alt=""
              />
            ) : (
              <Image
                className="w-[200px] h-[200px]"
                src={URL.createObjectURL(listingData.image)}
                width={200}
                height={200}
                alt=""
              />
            )}
          </>
        )}
        <div className="w-full flex flex-col gap-2 p-2 mt-2 rounded-t-[20px] rounded-bl-[10px] items-start justify-start bg-darkest-cool">
          <input
            id="listing-image-input"
            type="file"
            className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-t-[20px]"
            onChange={(e: any) =>
              setListingData({ ...listingData, image: e.target.files[0] })
            }
          />

          <input
            id="listing-title-input"
            type="text"
            placeholder="Title"
            className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={(e) => {
              setListingData({ ...listingData, title: e.target.value })
            }}
            value={listingData.title}
          />
          <textarea
            id="listing-description-input"
            placeholder="Description"
            className="w-full h-[200px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={(e) => {
              setListingData({ ...listingData, description: e.target.value })
            }}
            value={listingData.description}
            style={{ resize: 'none' }}
            maxLength={500}
          />
          <div className="flex gap-2">
            <input
              id="listing-price-input"
              type="text"
              placeholder="Price"
              className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
              onChange={(e) => {
                setListingData({ ...listingData, price: e.target.value })
              }}
              value={listingData.price}
            />

            <select
              id="listing-currency-input"
              className="p-2 bg-[#0f152f]"
              onChange={(e) =>
                setListingData({ ...listingData, currency: e.target.value })
              }
              value={listingData.currency}
            >
              <option value="ETH">ETH</option>
              <option value="MOONEY">MOONEY</option>
              <option value="DAI">DAI</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          <div className="w-full flex gap-2">
            <p className="">Require shipping address</p>
            <input
              id="listing-shipping-input"
              className="w-[20px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
              type="checkbox"
              checked={listingData.shipping === 'true'}
              onChange={({ target }) =>
                setListingData({
                  ...listingData,
                  shipping: String(target.checked),
                })
              }
            />
          </div>
          <div className="w-full flex flex-col gap-2">
            <div className="flex gap-2">
              <p className="">Timed</p>
              <input
                id="listing-timed-input"
                className="w-[20px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                type="checkbox"
                checked={isTimed}
                onChange={({ target }) => setIsTimed(target.checked)}
              />
            </div>
            {isTimed && (
              <div className="w-full flex gap-2 text-black">
                <input
                  id="listing-start-time-input"
                  className="p-2 rounded-sm "
                  type="date"
                  min={
                    listing && listing?.startTime > 0
                      ? new Date(listing?.startTime * 1000)
                          .toISOString()
                          .split('T')[0]
                      : new Date().toISOString().split('T')[0]
                  }
                  value={
                    startTime > 0
                      ? new Date(startTime * 1000).toISOString().split('T')[0]
                      : 0
                  }
                  onChange={({ target }: any) => {
                    const date = new Date(target.value)
                    const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
                    const adjustedDate = new Date(
                      date.getTime() + timezoneOffset
                    )
                    const unixTime = Math.floor(adjustedDate.getTime() / 1000)
                    setStartTime(unixTime)
                  }}
                />
                <input
                  id="listing-end-time-input"
                  className="p-2 rounded-sm"
                  type="date"
                  min={
                    listing && listing?.endTime > 0
                      ? new Date(listing?.endTime * 1000)
                          .toISOString()
                          .split('T')[0]
                      : ''
                  }
                  value={
                    endTime > 0
                      ? new Date(endTime * 1000).toISOString().split('T')[0]
                      : 0
                  }
                  onChange={({ target }: any) => {
                    const date = new Date(target.value)
                    const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
                    const adjustedDate = new Date(
                      date.getTime() + timezoneOffset
                    )
                    const unixTime = Math.floor(adjustedDate.getTime() / 1000)
                    setEndTime(unixTime)
                  }}
                />
              </div>
            )}
          </div>
          <p className="opacity-60">{`Listings are marked up 10% for non-citizens`}</p>
        </div>
        <PrivyWeb3Button
          requiredChain={DEFAULT_CHAIN}
          label={edit ? 'Edit Listing' : 'Add Listing'}
          type="submit"
          isDisabled={
            !marketplaceTableContract || !teamContract || isLoading || !isValid
          }
          action={() => {}}
          className={`w-full gradient-2 rounded-t0 rounded-b-[2vmax] ${
            !isValid ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />

        {isLoading && (
          <p className="opacity-60">{`This action may take up to 60 seconds. You can close this modal at any time.`}</p>
        )}
      </form>
    </Modal>
  )
}
