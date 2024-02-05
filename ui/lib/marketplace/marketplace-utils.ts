import { DirectListingV3, EnglishAuction } from '@thirdweb-dev/sdk'
import { BigNumber } from 'ethers'
import { MOONEY_ADDRESSES } from '../../const/config'

export type DirectListing = {
  asset: {
    name: string
    description: string
    image: string
    id: string
    uri: string
  }
  listingId: string | number
  creatorAddress: string
  assetContractAddress: string
  tokenId: string
  quantity: string
  currencyContractAddress: string
  pricePerToken: string | number
  startTimestamp: string | number
  endTimestamp: string | number
  reserved: boolean
  status: string | number
  popularity: any
}

export type AuctionListing = {
  asset: {
    name: string
    description: string
    image: string
    id: string
    uri: string
  }
  auctionId: string | number
  creatorAddress: string
  assetContractAddress: string
  tokenId: string
  quantity: string
  currencyContractAddress: string
  minimumBidAmount: string | number
  buyoutBidAmount: string | number
  timeBufferInSeconds: string | number
  bidBufferBps: string | number
  startTimestamp: string | number
  endTimestamp: string | number
  status: string | number
  popularity: any
}

export type CurrListing = {
  type: string
  listing: any
}

export type DirectSubmission = {
  assetContractAddress: string
  tokenId: string
  quantity: string
  currencyContractAddress: string
  pricePerToken: string
  startTimestamp: string
  endTimestamp: string
  isReservedListing: boolean
}

export type AuctionSubmission = {
  assetContractAddress: string
  tokenId: string
  quantity: string
  currencyContractAddress: string
  minimumBidAmount: string
  buyoutBidAmount: string
  timeBufferInSeconds: string
  bidBufferBps: string
  startTimestamp: string
  endTimestamp: string
}

export type LocalQue = {
  queuedListings: DirectSubmission[]
  queuedAuctions: AuctionSubmission[]
}

export type AssetStats = {
  floorPrice: string | number | undefined
  supply: string | number | undefined
  listed: string | number | undefined
}

export type CollectionStats = {
  floorPrice: string | number
  listed: string | number
  supply: string | number
}

export function BigConvert(data: any) {
  return !data ? 0 : BigNumber.from(data).toString()
}

export function serialize(data: any) {
  //data = array of listings = [[{listingData1}], [{listingData2}]]
  let formatted
  console.log(data[0])
  if (data[0]?.minimumBidAmount) {
    formatted = data.map(
      (auction: EnglishAuction) =>
        isL2MOONEY(auction.currencyContractAddress) &&
        ({
          asset: auction.asset,
          auctionId: auction.id,
          creatorAddress: auction.creatorAddress,
          assetContractAddress: auction.assetContractAddress,
          tokenId: auction.tokenId,
          quantity: auction.quantity,
          currencyContractAddress: auction.currencyContractAddress,
          minimumBidAmount: auction.minimumBidAmount,
          buyoutBidAmount: auction?.buyoutBidAmount,
          timeBufferInSeconds: auction.timeBufferInSeconds,
          bidBufferBps: auction.bidBufferBps,
          startTimestamp: auction.startTimeInSeconds,
          endTimestamp: auction.endTimeInSeconds,
          status: auction.status,
        } as AuctionListing)
    )
  } else {
    formatted = data.map(
      (listing: DirectListingV3) =>
        isL2MOONEY(listing.currencyContractAddress) &&
        ({
          asset: listing.asset,
          listingId: listing.id,
          creatorAddress: listing.creatorAddress,
          assetContractAddress: listing.assetContractAddress,
          tokenId: listing.tokenId,
          quantity: listing.quantity,
          currencyContractAddress: listing.currencyContractAddress,
          pricePerToken: listing.pricePerToken,
          startTimestamp: listing.startTimeInSeconds,
          endTimestamp: listing.endTimeInSeconds,
          reserved: listing.isReservedListing,
          status: listing.status,
        } as DirectListing)
    )
  }

  //Filter out any listings or auctions that are not in MOONEY
  const L2_MOONEYListings = formatted.filter(
    (listing: any) =>
      listing?.currencyContractAddress &&
      isL2MOONEY(listing.currencyContractAddress)
  )

  return JSON.parse(JSON.stringify(L2_MOONEYListings))
}

function isL2MOONEY(currencyAddress: string) {
  const mooneyAddress =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
      ? MOONEY_ADDRESSES['polygon']
      : MOONEY_ADDRESSES['mumbai']

  return currencyAddress.toLowerCase() === mooneyAddress.toLowerCase()
}

//////HOOKS////////////////////////////////////////////
////////////////////////////////////////////////////////
