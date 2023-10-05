import { useAddress } from '@thirdweb-dev/react'
import {
  AuctionListing,
  DirectListing,
} from '../../../lib/marketplace/marketplace-utils'
import ProfileAuctionListing from './ProfileAuctionListing'
import ProfileDirectListing from './ProfileDirectListing'
import ProfileWinningBid from './ProfileWinningBid'

export default function ProfileListingGrid({ listings, type = 'direct' }: any) {
  const address = useAddress()
  return (
    <div className="flex flex-wrap gap-[1%] w-full">
      {listings && listings[0] ? (
        <>
          {type === 'direct' &&
            listings.map((l: DirectListing, i: number) => (
              <ProfileDirectListing
                key={`profile-direct-listing-${i}`}
                listing={l}
                walletAddress={address || ''}
              />
            ))}{' '}
          {type === 'auction' &&
            listings.map((a: AuctionListing, i: number) => (
              <ProfileAuctionListing
                key={`profile-auction-listing-${i}`}
                listing={a}
                walletAddress={address || ''}
              />
            ))}
          {type === 'winningBids' &&
            listings.map((a: AuctionListing, i: number) => (
              <ProfileWinningBid
                key={`profile-winning-bid-${i}`}
                listing={a}
                walletAddress={address || ''}
              />
            ))}
        </>
      ) : (
        <div>
          {type === 'direct' || type === 'auction'
            ? `No ${type} listings`
            : `No assets to claim`}
        </div>
      )}
    </div>
  )
}
