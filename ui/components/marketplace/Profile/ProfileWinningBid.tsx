import { MediaRenderer, useContract } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { AuctionListing } from '../../../lib/marketplace/marketplace-utils'
import { MARKETPLACE_ADDRESS } from '../../../const/config'
import Skeleton from '../Layout/Skeleton'
import ClaimAsset from './ClaimAsset'

interface ProfileAuctionListingProps {
  listing: AuctionListing
  walletAddress: string
}

export default function ProfileWinningBid({
  listing,
  walletAddress,
}: ProfileAuctionListingProps) {
  const [winningBidObj, setWinningBidObj] = useState<any>()
  const [loadingBid, setLoadingBid] = useState<boolean>(true)

  const { contract: marketplace } = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )

  useEffect(() => {
    if (marketplace && listing?.auctionId) {
      setLoadingBid(true)
      marketplace.englishAuctions
        .getWinningBid(listing.auctionId)
        .then((bid: any) => {
          setWinningBidObj(bid)
          setLoadingBid(false)
        })
        .catch((e: any) => {
          setLoadingBid(false)
          console.log(e)
        })
    }
  }, [marketplace, listing])

  if (listing.status === 3 || listing.status === 2) return <></>
  return (
    <article className="relative flex flex-col justify-baseline my-2 hover:scale-[1.03] transition-all duration-150">
      <div
        className={`bg-gradient-to-br from-yellow-600 via-amber-500 to-moon-secondary px-2 py-1 rounded-full italic absolute top-2 left-3 text-sm`}
      >
        {'Status : '}
        {'Won ✨'}
      </div>
      {/*Image with Link*/}
      <div>
        {listing.asset ? (
          <MediaRenderer
            className="rounded-xl object-cover"
            src={listing.asset.image}
          />
        ) : (
          <Skeleton height={'300px'} width={'300px'} borderRadius="12px" />
        )}
      </div>

      <div className="w-[300px] rounded-b-xl -mt-2 py-2 px-3 flex flex-col gap-3 bg-gradient-to-br from-moon-secondary via-indigo-900 to-moon-secondary">
        {/*Title*/}
        <h4 className="font-GoodTimes tracking-wider text-lg">
          {listing.asset.name}
        </h4>

        {/* Auctions that have ended and have a payout */}
        {walletAddress &&
          winningBidObj &&
          winningBidObj?.bidderAddress === walletAddress && (
            <ClaimAsset
              walletAddress={walletAddress}
              auctionId={listing.auctionId}
            />
          )}
      </div>
    </article>
  )
}
