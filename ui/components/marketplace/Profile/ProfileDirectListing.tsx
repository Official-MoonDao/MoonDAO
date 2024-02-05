import { MediaRenderer, useContract } from '@thirdweb-dev/react'
import Link from 'next/link'
import { DirectListing } from '../../../lib/marketplace/marketplace-utils'
import { MARKETPLACE_ADDRESS, MOONEY_DECIMALS } from '../../../const/config'
import Skeleton from '../Layout/Skeleton'
import CancelListing from './CancelListing'

interface ProfileDirectListingProps {
  listing: DirectListing
  walletAddress: string
}

export default function ProfileDirectListing({
  listing,
  walletAddress,
}: ProfileDirectListingProps) {
  const buyOut = listing.pricePerToken
  const end = listing.endTimestamp

  const { contract: marketplace } = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )

  return (
    <article className="relative flex flex-col justify-baseline my-2 hover:scale-[1.03] transition-all duration-150">
      {/*Status*/}
      <div
        className={`${
          +end * 1000 > Date.now()
            ? 'bg-gradient-to-br from-yellow-600 via-amber-500 to-moon-secondary'
            : 'bg-amber-700 opacity-70 text-gray-200'
        } px-2 py-1 rounded-full italic absolute top-2 left-3 text-sm`}
      >
        {'Status : '}
        {+end * 1000 > Date.now() ? 'Active ✔' : 'Sold ✖'}
      </div>
      {/*Image with link */}
      <div>
        {listing.asset ? (
          <Link
            href={`/collection/${listing.assetContractAddress}/${listing.tokenId}`}
          >
            <MediaRenderer
              className="rounded-xl object-cover"
              src={listing.asset.image}
            />
          </Link>
        ) : (
          <Skeleton height={'300px'} width={'300px'} borderRadius="12px" />
        )}
      </div>
      <div className="w-[300px] rounded-b-xl -mt-2 py-2 px-3 flex flex-col gap-3 bg-gradient-to-br from-moon-secondary via-indigo-900 to-moon-secondary">
        {/*Title*/}
        <h4 className="font-GoodTimes tracking-wider text-lg">
          {listing.asset.name}
        </h4>
        {/*Quantity*/}
        <div>
          <p className="text-sm opacity-80">Quantity</p>
          <p className="tracking-wide">{listing.quantity}</p>
        </div>
        {/*Price */}
        <div>
          <p className="text-sm opacity-80">Price</p>
          <p className="tracking-wide">{`${Math.round(
            +buyOut / MOONEY_DECIMALS
          )} MOONEY`}</p>
        </div>
        {/*Expiration date*/}
        <div>
          <p className="text-sm opacity-80">Listing Expiration</p>
          <p>{`${new Date(+end * 1000).toLocaleDateString()} @ ${new Date(
            +end * 1000
          ).toLocaleTimeString()}`}</p>
        </div>
        {walletAddress && walletAddress === listing.creatorAddress && (
          <CancelListing
            marketplaceContract={marketplace}
            type="direct"
            listingId={+listing.listingId}
          />
        )}
      </div>
    </article>
  )
}
