import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { MediaRenderer } from '@thirdweb-dev/react'
import Image from 'next/image'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { pinImageToIPFS } from '@/lib/ipfs/pin'
import isTextInavlid from '@/lib/tableland/isTextValid'
import { TeamListing } from './TeamListing'

type ListingData = {
  title: string
  description: string
  image: any
  price: any
  currency: string
  shipping: string
}

type EntityMarketplaceListingModalProps = {
  entityId: number
  setEnabled: Function
  refreshListings: Function
  marketplaceTableContract: any
  edit?: boolean
  listing?: TeamListing
}

export default function EntityMarketplaceListingModal({
  entityId,
  setEnabled,
  refreshListings,
  marketplaceTableContract,
  edit,
  listing,
}: EntityMarketplaceListingModalProps) {
  const { getAccessToken } = usePrivy()
  const [isLoading, setIsLoading] = useState(false)
  const [listingData, setListingData] = useState<ListingData>(
    edit
      ? {
          title: listing?.title || '',
          description: listing?.description || '',
          image: listing?.image || '',
          price: listing?.price || '',
          currency: listing?.currency || 'ETH',
          shipping: listing?.shipping || 'false',
        }
      : {
          title: '',
          description: '',
          image: '',
          price: '',
          currency: 'ETH',
          shipping: 'false',
        }
  )

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-marketplace-listing-modal-backdrop')
          setEnabled(false)
      }}
      id="entity-marketplace-listing-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            listingData.title.trim() === '' ||
            listingData.description.trim() === '' ||
            listingData.price.trim() === ''
          )
            return toast.error('Please fill out all fields')

          setIsLoading(true)

          const invalidText = Object.values(listingData).some((v: any) =>
            isTextInavlid(v)
          )

          if (invalidText) {
            return setIsLoading(false)
          }

          //upload image to ipfs
          const accessToken = await getAccessToken()

          const jwtRes = await fetch('/api/ipfs/upload', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })

          const pinataJWT = await jwtRes.text()

          let imageIpfsLink

          if (typeof listingData.image === 'string') {
            imageIpfsLink = listingData.image
          } else {
            imageIpfsLink =
              'ipfs://' +
              (await pinImageToIPFS(
                pinataJWT || '',
                listingData.image,
                `entity#${entityId}-listing-${listingData.title}`
              ))
          }

          let tx

          try {
            if (edit) {
              tx = await marketplaceTableContract.call('updateTable', [
                listing?.id,
                listingData.title,
                listingData.description,
                imageIpfsLink,
                entityId,
                listingData.price,
                listingData.currency,
                listingData.shipping,
              ])
            } else {
              tx = await marketplaceTableContract?.call('insertIntoTable', [
                listingData.title,
                listingData.description,
                imageIpfsLink,
                entityId,
                listingData.price,
                listingData.currency,
                listingData.shipping,
              ])
            }

            if (tx?.receipt)
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
        }}
      >
        <div className="w-full flex items-center justify-between">
          <p>{edit ? 'Edit a Listing' : 'Add a Listing'}</p>
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
                height="150px"
                width="150px"
                alt=""
              />
            ) : (
              <Image
                src={URL.createObjectURL(listingData.image)}
                width={150}
                height={150}
                alt=""
              />
            )}
          </>
        )}

        <input
          type="file"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e: any) =>
            setListingData({ ...listingData, image: e.target.files[0] })
          }
        />

        <input
          type="text"
          placeholder="Title"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setListingData({ ...listingData, title: e.target.value })
          }}
          value={listingData.title}
        />
        <textarea
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
            type="text"
            placeholder="Price"
            className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={(e) => {
              setListingData({ ...listingData, price: e.target.value })
            }}
            value={listingData.price}
          />

          <select
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
          <p className="p-2">Require shipping address</p>
          <input
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

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 px-2 w-[100px] border-2 border-moon-orange text-moon-orange rounded-full"
        >
          {isLoading ? '...loading' : edit ? 'Edit Listing' : 'Add Listing'}
        </button>
        {isLoading && (
          <p className="opacity-60">{`This action may take up to 60 seconds. You can close this modal at any time.`}</p>
        )}
      </form>
    </div>
  )
}
