import { MarketplaceV3 } from '@thirdweb-dev/sdk'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { CurrListing } from '../../../lib/marketplace/marketplace-utils'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS, MOONEY_DECIMALS } from '../../../const/config'
import { PrivyWeb3Button } from '../../privy/PrivyWeb3Button'
import Skeleton from '../Layout/Skeleton'

type BuyOrBidProps = {
  marketplace: MarketplaceV3 | undefined
  walletAddress: string | undefined
  winningBid: string | undefined
  currListing: CurrListing | undefined
}

export default function BuyOrBid({
  marketplace,
  walletAddress,
  winningBid,
  currListing,
}: BuyOrBidProps) {
  const router = useRouter()
  const [bidValue, setBidValue] = useState<number>(
    currListing?.listing?.minimumBidAmount / MOONEY_DECIMALS || 0
  )
  const [directListingQuantity, setDirectListingQuantity] = useState<number>(1)

  const isOwner = useMemo(() => {
    if (walletAddress && currListing?.listing?.creatorAddress)
      return (
        walletAddress?.toLowerCase() ===
        currListing?.listing?.creatorAddress.toLowerCase()
      )
  }, [walletAddress, currListing])

  async function createBidOrOffer() {
    let txResult
    if (!currListing || !marketplace) return
    try {
      if (currListing.type === 'auction') {
        txResult = await marketplace?.englishAuctions.makeBid(
          currListing.listing?.auctionId,
          bidValue
        )
      } else {
        throw new Error('No valid auction listing found for this NFT')
      }
      setTimeout(() => {
        router.reload()
        toast(`Bid success!`, {
          icon: '✅',
          style: toastStyle,
          position: 'bottom-center',
        })
      }, 1000)
      return txResult
    } catch (err: any) {
      toast.error(`Bid failed! Reason: ${err?.reason}`)
    }
  }

  async function buyListing() {
    let txResult
    if (!currListing || !marketplace) return
    try {
      if (currListing.type === 'direct') {
        txResult = await marketplace.directListings.buyFromListing(
          currListing.listing.listingId,
          directListingQuantity,
          walletAddress
        )
      } else {
        txResult = await marketplace.englishAuctions.buyoutAuction(
          currListing.listing.auctionId
        )
        await marketplace.englishAuctions.executeSale(
          currListing.listing.auctionId
        )
      }
      setTimeout(() => {
        router.reload()
        toast(`Purchase success!`, {
          icon: '✅',
          style: toastStyle,
          position: 'bottom-center',
        })
      }, 1000)
      return txResult
    } catch (err: any) {
      toast(`Purchase failed! Reason: ${err?.reason}`, {
        icon: '❌',
        style: toastStyle,
        position: 'bottom-center',
      })
    }
  }

  return (
    <>
      {currListing && !currListing.listing?.creatorAddress ? (
        <Skeleton width="100%" height="164" />
      ) : (
        <>
          {/*Web3 connect button and template in case of listed by user address*/}
          {isOwner ? (
            <div className="ml-3 italic pt-1 opacity-80">
              This listing was created by you.
            </div>
          ) : (
            <>
              <div className="flex justify-evenly items-center">
                <PrivyWeb3Button
                  className={`hover:!text-title-light 
                    bg-slate-300
                    dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                  label={`Buy ${
                    currListing?.type === 'direct'
                      ? directListingQuantity || '1'
                      : currListing?.listing.quantity
                  } for ${
                    currListing?.type === 'direct'
                      ? Number(
                          (currListing?.listing.pricePerToken /
                            MOONEY_DECIMALS) *
                            (directListingQuantity || 1)
                        ).toFixed(1)
                      : Number(
                          currListing?.listing.buyoutBidAmount / MOONEY_DECIMALS
                        ).toFixed(1)
                  } (MOONEY)`}
                  action={async () => await buyListing()}
                />

                {currListing?.type === 'direct' &&
                  currListing?.listing.quantity > 1 && (
                    <input
                      className="block border border-white w-[25%] py-3 px-4 bg-black bg-opacity-70 border-opacity-60 rounded-lg ml-[2px]"
                      placeholder={'1'}
                      type="number"
                      step={1}
                      onChange={(e: any) => {
                        if (+e.target.value > +currListing?.listing.quantity) {
                          const currQuantity = currListing?.listing.quantity
                          e.target.value = currQuantity
                          setDirectListingQuantity(currQuantity)
                          return toast.error(
                            `You can't buy more than ${currQuantity} of this asset`,
                            { style: toastStyle }
                          )
                        }
                        setDirectListingQuantity(e.target.value)
                      }}
                    />
                  )}
              </div>
              {currListing &&
                walletAddress &&
                currListing.type === 'auction' && (
                  <>
                    <div className="flex items-center justify-center m-0 my-4">
                      <p className="text-sm leading-6 text-white text-opacity-60 m-0">
                        or
                      </p>
                    </div>
                    <input
                      className="block border border-white w-[98%] py-3 px-4 bg-black bg-opacity-70 border-opacity-60 rounded-lg mb-4 ml-[2px]"
                      placeholder={
                        currListing.type === 'auction' &&
                        winningBid &&
                        +winningBid > 0
                          ? String(+winningBid / MOONEY_DECIMALS)
                          : currListing.listing
                          ? String(
                              +currListing.listing.minimumBidAmount /
                                MOONEY_DECIMALS
                            )
                          : '0'
                      }
                      type="number"
                      step={1}
                      onChange={(e: any) => {
                        setBidValue(e.target.value)
                      }}
                    />

                    <PrivyWeb3Button
                      className={`hover:!text-title-light 
                      bg-slate-300
                      dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                      label={'Place bid'}
                      action={async () => await createBidOrOffer()}
                    />
                    <p className="text-[80%] opacity-60 p-2">
                      {
                        '*Winning an Auction: after the auction has expired go to the'
                      }
                      <Link
                        className="text-moon-gold"
                        href={`/profile/${walletAddress}?tab=winningBids`}
                      >{` 'winning bids' `}</Link>
                      {
                        'tab to claim your asset, if the auction creator has already claimed the payout this will be done automatically*'
                      }
                    </p>
                  </>
                )}
            </>
          )}
        </>
      )}
    </>
  )
}
