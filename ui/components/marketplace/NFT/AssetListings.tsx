import { toast } from 'react-hot-toast'
import {
  AuctionListing,
  DirectListing,
} from '../../../lib/marketplace/marketplace-utils'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import Listing from './Listing'

type AssetListingsProps = {
  tab: string
  setTab: Function
  directListings: DirectListing[]
  auctionListings: AuctionListing[]
  currListing: any
  setCurrListing: Function
}

export default function AssetListings({
  tab,
  setTab,
  auctionListings,
  directListings,
  currListing,
  setCurrListing,
}: AssetListingsProps) {
  return (
    <div
      className={` ${
        !directListings[0] && !auctionListings[0] && 'hidden'
      } flex flex-col gap-2 px-3 py-2 mb-4`}
    >
      <div className={'w-full flex justify-evenly p-2'}>
        <h3
          className={`p-4 text-base font-semibold cursor-pointer transition-colors duration-100 ease-in-out hover:text-[#e9e9f9]
        ${
          tab === 'listings'
            ? 'border-b-2 border-moon-gold text-moon-gold'
            : 'text-white text-opacity-60'
        }`}
          onClick={() => {
            if (!directListings[0])
              return toast('No direct listings available', {
                style: toastStyle,
              })
            setTab('listings')
          }}
        >
          Listings
        </h3>
        <h3
          className={`p-4 text-base font-semibold text-white text-opacity-60 cursor-pointer transition-colors duration-100 ease-in-out hover:text-[#e9e9f9]
        ${
          tab === 'auctions'
            ? 'border-b-2 border-moon-gold text-moon-gold'
            : 'text-white text-opacity-60'
        }`}
          onClick={() => {
            if (!auctionListings[0])
              return toast('No auction listings available', {
                style: toastStyle,
              })
            setTab('auctions')
          }}
        >
          Auctions
        </h3>
      </div>
      {tab === 'listings' && directListings[0] && (
        <>
          <p className="opacity-60 mt-1 p-2 bg-moon-orange text-black rounded-sm">
            Direct Listings :
          </p>
          <div className="max-h-[250px] overflow-y-scroll divide-y-2 divide-moon-gold divide-opacity-30">
            {directListings[0] &&
              directListings.map((l: any, i: number) => (
                <div
                  key={`erc-1155-direct-listing-container-${i}`}
                  className={`flex flex-col mt-1 md:px-2 rounded-sm ${
                    currListing.listing.listingId === l.listingId &&
                    'bg-[#ffffff30]'
                  }`}
                >
                  <Listing
                    key={`erc-1155-direct-listing-${i}`}
                    type="direct"
                    listing={l}
                    setCurrListing={setCurrListing}
                  />
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'auctions' && auctionListings[0] && (
        <>
          <p className="opacity-60 mt-1 p-2 bg-moon-orange text-black rounded-sm">
            Auction Listings :
          </p>
          <div
            className={
              'max-h-[250px] overflow-y-scroll divide-y-2 divide-moon-gold divide-opacity-25'
            }
          >
            {auctionListings[0] &&
              auctionListings.map((a: any, i: number) => (
                <div
                  key={`erc-1155-auction-listing-container-${i}`}
                  className={`flex flex-col mt-1 md:px-2 rounded-sm ${
                    currListing.listing.auctionId === a.auctionId &&
                    'bg-[#ffffff30]'
                  }`}
                >
                  <Listing
                    key={`erc-1155-auction-listing-${i}`}
                    type="auction"
                    listing={a}
                    setCurrListing={setCurrListing}
                  />
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
