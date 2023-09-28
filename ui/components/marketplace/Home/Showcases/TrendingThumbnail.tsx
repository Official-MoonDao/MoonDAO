import { ThirdwebNftMedia } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useAssetStats } from '../../../../lib/marketplace/hooks'
import LogoSmall from '../../../assets/LogoSmall'
import Skeleton from '../../Layout/Skeleton'

export default function TrendingThumbnail({
  asset,
  validListings,
  validAuctions,
  last = false,
  first = false,
}: any) {
  const { floorPrice, listed } = useAssetStats(
    validListings,
    validAuctions,
    asset?.assetContractAddress,
    asset?.tokenId
  )
  if (!asset?.asset) return <Skeleton width="335px" height="162px" />

  return (
    <Link
      href={`/marketplace/collection/${asset?.assetContractAddress}/${asset?.tokenId}`}
    >
      <article className="relative group overflow-hidden">
        {/*Stamps to cut corners*/}
        {/* <div className="bg-[#251d2e] h-[40px] w-[100px] z-50 rotate-[-32.17deg] absolute -left-8 -top-3"></div>
        <div className="bg-[#251d2e] h-[40px] w-[100px] z-50 rotate-[-32.17deg] absolute -right-8 -bottom-3"></div> */}
        {/*Image container to create zoom effect*/}
        <div className={'w-full h-[275px] overflow-hidden'}>
          <ThirdwebNftMedia
            className={`object-cover object-center group-hover:scale-110 hover:rounded transition-all duration-200  ${
              first && 'rounded-tl-[75px]'
            }`}
            width={'100%'}
            metadata={asset.asset}
          />
        </div>
        {/*Card with Asset data*/}
        <div
          className={`bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 relative z-10 bg-opacity-10 w-full max-w-[300px] h-[182px] flex justify-between ${
            last && 'rounded-br-[75px]'
          }`}
        >
          <div className="pl-6 mt-5 flex flex-col items-start">
            <h6 className="text-lg font-bold">{asset.asset.name}</h6>
            <p className="mt-1 text-sm opacity-60 blend">{listed} listed</p>
            <p className="text-sm mt-5 opacity-70">Floor Price</p>
            <span className="flex items-center gap-2">
              <LogoSmall size={{ width: 10.54, height: 11.07 }} />
              {floorPrice && floorPrice.toString().length < 12
                ? floorPrice
                : floorPrice?.toString().slice(0, 10) + '...'}
            </span>
          </div>
          <div className="mt-5  pr-6 flex flex-col items-end">
            <p className="font-bold text-lg">#{asset.tokenId}</p>
            <button className="mt-[50px] text-xs border-[0.5px] px-[10px] py-[6px] rounded-tl-[10px] rounded-br-[10px] hover:bg-slate-900">
              Details
            </button>
          </div>
        </div>
      </article>
    </Link>
  )
}
