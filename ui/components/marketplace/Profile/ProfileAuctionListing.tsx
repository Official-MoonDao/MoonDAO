import { MediaRenderer, useContract } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useClaimableAuction } from '../../../lib/marketplace/hooks'
import { AuctionListing } from '../../../lib/marketplace/marketplace-utils'
import { MARKETPLACE_ADDRESS, MOONEY_DECIMALS } from '../../../const/config'
import Skeleton from '../Layout/Skeleton'
import CancelListing from './CancelListing'
import ClaimAuctionPayout from './ClaimAuctionPayout'

interface ProfileAuctionListingProps {
  listing: AuctionListing
  walletAddress: string
}

export default function ProfileAuctionListing({
  listing,
  walletAddress,
}: ProfileAuctionListingProps) {
  const buyOut = listing?.buyoutBidAmount
  const minBid = listing.minimumBidAmount
  const end = listing.endTimestamp

  const [winningBidObj, setWinningBidObj] = useState<any>()
  const [loadingBid, setLoadingBid] = useState<boolean>(true)

  const { contract: marketplace } = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )

  const claimable = useClaimableAuction(winningBidObj, +buyOut, end)

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
        className={`${
          +end * 1000 > Date.now()
            ? 'bg-gradient-to-br from-yellow-600 via-amber-500 to-moon-secondary'
            : 'bg-gray-800 opacity-70 text-gray-200'
        } px-2 py-1 rounded-full italic absolute top-2 left-3 text-sm`}
      >
        {'Status : '}
        {+end * 1000 > Date.now()
          ? 'Active ✔'
          : claimable
          ? 'Sold ✖'
          : 'Expired'}
      </div>
      {/*Image with Link*/}
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
        {/*Price*/}
        <div>
          <p className="text-sm opacity-80">Buyout price</p>
          <p className="tracking-wide">{`${Math.round(
            +buyOut / MOONEY_DECIMALS
          )} MOONEY`}</p>
        </div>

        {/*Minimum bid*/}
        <div>
          <p className="text-sm opacity-80">Minimum bid</p>
          <p className="tracking-wide">{`${Math.round(
            +minBid / MOONEY_DECIMALS
          )} MOONEY`}</p>
        </div>
        {/*Winning bid*/}
        <div>
          <p className="text-sm opacity-80">Winning bid</p>
          <p className="tracking-wide">{`${
            winningBidObj?.bidAmount / MOONEY_DECIMALS || 'No bids yet'
          } MOONEY`}</p>
        </div>
        {/*Expiration Date */}
        <div>
          <p className="text-sm opacity-80">Listing Expiration</p>
          <p>{`${new Date(+end * 1000).toLocaleDateString()} @ ${new Date(
            +end * 1000
          ).toLocaleTimeString()}`}</p>
        </div>

        {/* Auctions that have ended and have a payout */}

        {claimable && (
          <>
            {walletAddress && walletAddress === listing.creatorAddress && (
              <ClaimAuctionPayout
                marketplaceContract={marketplace}
                claimable={claimable}
                auctionId={+listing.auctionId}
              />
            )}

            <p className="w-full text-center text-[75%]">{`(Payout: ${
              winningBidObj?.bidAmount / MOONEY_DECIMALS
            } MOONEY)`}</p>
          </>
        )}
        {/* Expired Auctions /w No bids */}
        {!loadingBid &&
        walletAddress &&
        walletAddress === listing.creatorAddress &&
        +end * 1000 < Date.now() &&
        !claimable ? (
          <CancelListing
            marketplaceContract={marketplace}
            type="auction"
            listingId={+listing.auctionId}
            expired
          />
        ) : !loadingBid && walletAddress && !winningBidObj ? (
          <CancelListing
            marketplaceContract={marketplace}
            type="auction"
            listingId={+listing.auctionId}
          />
        ) : (
          ''
        )}
      </div>
    </article>
  )
}
