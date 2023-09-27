import { MarketplaceV3 } from '@thirdweb-dev/sdk'
import { useEffect, useState } from 'react'
import { AuctionListing } from '../marketplace-utils'

//Filter auctions won by the profile address (only applies to winning bids on auctions, buying out an auction does not require the user to claim the token manually)

export function useUserWinnings(
  marketplace: MarketplaceV3,
  allAuctions: any,
  walletAddress: string
) {
  const [assetsWon, setAssetsWon] = useState<any>([])

  useEffect(() => {
    if (marketplace && walletAddress && allAuctions && allAuctions[0]) {
      ;(async () => {
        setAssetsWon([])
        await allAuctions.map(async (a: AuctionListing) => {
          if (a.status !== 5) return
          let winningBid: any
          let closed: any
          try {
            winningBid = await marketplace.englishAuctions.getWinningBid(
              a.auctionId
            )
            closed = await marketplace.englishAuctions.events.getEvents(
              'AuctionClosed',
              {
                filters: {
                  auctionId: a.auctionId,
                },
              }
            )
          } catch (err) {
            console.log(err)
          }
          if (winningBid?.bidderAddress === walletAddress && !closed[0])
            setAssetsWon((prev: any) => [
              ...prev.filter((prevA: any) => prevA.auctionId !== a.auctionId),
              a,
            ])
        })
      })()
    }
  }, [allAuctions, marketplace, walletAddress])

  return assetsWon
}
