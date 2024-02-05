import { MediaRenderer } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useAssetStats } from '../../../lib/marketplace/hooks'
import {
  AuctionListing,
  DirectListing,
} from '../../../lib/marketplace/marketplace-utils'
import LogoSmall from '../../assets/LogoSmall'
import Skeleton from '../Layout/Skeleton'

type AssetPreviewProps = {
  listing: DirectListing | AuctionListing
  validListings: DirectListing[]
  validAuctions: AuctionListing[]
}

export default function AssetPreview({
  listing,
  validListings,
  validAuctions,
}: AssetPreviewProps) {
  const router = useRouter()
  const { floorPrice, listed, supply } = useAssetStats(
    validListings,
    validAuctions,
    listing.assetContractAddress,
    listing.tokenId
  )
  if (!listing?.asset) return <div>NFT not found!</div>

  return (
    <article className="relative group overflow-hidden">
      {/*Stamps to cut corners*/}
      <div className="bg-main-background h-[40px] w-[100px] z-50 rotate-[-32.17deg] absolute -left-8 -top-3"></div>
      <div className="bg-main-background h-[40px] w-[100px] z-50 rotate-[-32.17deg] absolute -right-8 -bottom-3"></div>
      {/*Image container to create zoom effect*/}
      <div className="w-full h-[275px] overflow-hidden">
        <button
          onClick={() =>
            router.push(
              `/marketplace/collection/${listing.assetContractAddress}/${listing.tokenId}`
            )
          }
        >
          <MediaRenderer
            className="object-cover object-center group-hover:scale-110 transition-all duration-200"
            src={listing.asset.image}
            width={'100%'}
            height={'100%'}
          />
        </button>
      </div>
      {/*Card with Asset data*/}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 relative z-10 bg-opacity-10 w-full h-[162px] flex justify-between">
        <div className="pl-6 mt-5 flex flex-col items-start">
          <h6 className="text-lg font-bold">{listing.asset.name}</h6>
          {/*Price*/}
          <p className="mt-11 text-xl flex items-center gap-3 truncate">
            <LogoSmall size={{ width: 24.54, height: 24.07 }} />
            {floorPrice && floorPrice.toString().length < 9
              ? floorPrice
              : floorPrice?.toString().slice(0, 7) + '...'}
          </p>
        </div>
        <div className="mt-5 pr-9 flex flex-col items-end">
          <p className="font-bold text-xl">#{listing.tokenId}</p>
          <button
            onClick={() =>
              router.push(
                `/marketplace/collection/${listing.assetContractAddress}/${listing.tokenId}`
              )
            }
            className="absolute top-12 mt-10 border-[0.5px] hover:scale-105 px-[10px] py-[4px] transition-all duration-150 hover:bg-slate-900 rounded-tl-[10px] rounded-br-[10px]"
          >
            <a>Buy now</a>
          </button>
        </div>
      </div>
    </article>
  )
}
