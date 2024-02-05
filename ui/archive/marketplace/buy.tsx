import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import {
  getAllValidAuctions,
  getAllValidListings,
} from '../../lib/marketplace/marketplace-listings'
import { useFilter } from '../../lib/marketplace/marketplace-subgraph'
import {
  DirectListing,
  AuctionListing,
} from '../../lib/marketplace/marketplace-utils'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import { useShallowQueryRoute } from '../../lib/utils/hooks/useShallowQueryRoute'
import AssetPreview from '../../components/marketplace/Collection/AssetPreview'
import CollectionPreview from '../../components/marketplace/Collection/CollectionPreview'
import Metadata from '../../components/marketplace/Layout/Metadata'
import VerticalStar from '../../components/marketplace/assets/VerticalStar'
import { MARKETPLACE_ADDRESS } from '../../const/config'
import { useChainDefault } from '../../lib/thirdweb/hooks/useChainDefault'

type BuyPageProps = {
  _validListings: DirectListing[]
  _validAuctions: AuctionListing[]
}

export default function Buy({ _validListings, _validAuctions }: BuyPageProps) {
  useChainDefault('l2')
  const router = useRouter()

  const { contract: marketplace }: any = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )

  const filterSelectionRef: any = useRef()
  const shallowQueryRoute = useShallowQueryRoute()
  const [filter, setFilter] = useState<any>({
    type: '',
    assetOrCollection: '',
  })

  const [validListings, setValidListings] =
    useState<DirectListing[]>(_validListings)
  const [validAuctions, setValidAuctions] =
    useState<AuctionListing[]>(_validAuctions)

  const { collections: filteredCollections, assets: filteredAssets } =
    useFilter(filter?.type, validListings, validAuctions)

  function filterTypeChange(e: any) {
    setFilter({ ...filter, type: e.target.value })
    shallowQueryRoute({
      filterType: e.target.value,
      assetType: filter.assetOrCollection,
    })
  }

  function assetTypeChange() {
    if (filter.assetOrCollection === 'asset') {
      setFilter({ ...filter, assetOrCollection: 'collection' })
      shallowQueryRoute({ assetType: 'collection', filterType: filter.type })
    } else {
      setFilter({ ...filter, assetOrCollection: 'asset' })
      shallowQueryRoute({ assetType: 'asset', filterType: filter.type })
    }
  }

  useEffect(() => {
    if (marketplace) {
      getAllValidListings(marketplace).then((listings: DirectListing[]) => {
        setValidListings(listings)
      })
      getAllValidAuctions(marketplace).then((auctions: AuctionListing[]) => {
        setValidAuctions(auctions)
      })
    }
  }, [_validListings, _validAuctions])

  useEffect(() => {
    if (filterSelectionRef.current && router.query) {
      const { filterType, assetType } = router.query
      setFilter({
        type: filterType || 'all',
        assetOrCollection: assetType || 'asset',
      })
      filterSelectionRef.current.value = filterType || 'all'
    }
  }, [router.query])

  return (
    <div className="pt-10 md:pt-12 lg:pt-16 xl:pt-20 m flex flex-col items-center w-full">
      <Metadata title="Buy" />
      <div className="flex flex-col items-center md:items-start">
        {/*Title*/}
        <h2 className="font-GoodTimes tracking-wide flex items-center text-3xl lg:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-moon-gold to-indigo-100">
          Buy NFTs
          <span className="ml-2 lg:ml-4">
            <VerticalStar />
          </span>
        </h2>
        {/*Filtering options */}
        <div className="my-8 flex gap-6 sm:gap-8 lg:my-10 flex-col items-center sm:flex-row">
          <div className="flex gap-6">
            <div className="flex flex-col divide-y-2 text-left font-semibold tracking-wider">
              <p
                className={`${
                  filter.assetOrCollection !== 'asset' && 'opacity-60'
                } text-yellow-200 py-1 transition-all duration-150`}
              >
                Assets
              </p>
              <p className={`text-indigo-300 py-1`}>
                <span
                  className={`${
                    filter.assetOrCollection !== 'collection' && 'opacity-60'
                  } transition-all duration-150`}
                >
                  Collections
                </span>
              </p>
            </div>
            <div
              className={`flex w-8 h-16 ${
                filter.assetOrCollection === 'asset'
                  ? 'bg-moon-gold'
                  : 'bg-indigo-600'
              } rounded-full ease-in-ease-out duration-150`}
              onClick={assetTypeChange}
            >
              <button
                className={`${
                  filter.assetOrCollection === 'collection' && 'translate-y-8'
                } w-9 h-9 bg-white rounded-full ease-in-ease-out duration-150`}
              ></button>
            </div>
          </div>
          <select
            className="font-bold rounded-sm px-3 mt-3 py-2 w-[230px] focus:ring ring-indigo-200"
            onChange={(e) => filterTypeChange(e)}
            ref={filterSelectionRef}
            defaultValue={router.query.filterType || 'all'}
          >
            <option value="all">All</option>
            <option value="trending">Trending</option>
            {filter.assetOrCollection === 'asset' && (
              <option value="expiring">Expiring Soon</option>
            )}
          </select>
        </div>

        <p className="mt-[14px] lg:mt-6 text-xl opacity-80">
          Pick{' '}
          {filter.assetOrCollection === 'collection'
            ? 'from a collection'
            : 'an asset'}
        </p>

        <section className="mt-10 md:mt-16 flex flex-col gap-10 md:grid md:grid-cols-2 md:grid-flow-row md:gap-12 xl:grid-cols-3 xl:gap-14">
          {/*Collections*/}
          {filter.assetOrCollection === 'collection' && (
            <>
              {filteredCollections?.map((collection: any, i: number) => (
                <CollectionPreview
                  key={`collection-preview-${i}`}
                  collection={collection}
                  validListings={validListings}
                  validAuctions={validAuctions}
                />
              ))}
            </>
          )}
          {/*Assets*/}
          {filter.assetOrCollection === 'asset' && (
            <>
              {filteredAssets?.map(
                (l: DirectListing | AuctionListing, i: number) => (
                  <AssetPreview
                    key={`filtered-asset-preview-${i}`}
                    listing={l}
                    validListings={validListings}
                    validAuctions={validAuctions}
                  />
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export async function getStaticProps() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
  const sdk = initSDK(chain)
  const marketplace = await sdk.getContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )
  const validListings: DirectListing[] = await getAllValidListings(marketplace)
  const validAuctions: AuctionListing[] = await getAllValidAuctions(marketplace)
  return {
    props: {
      _validListings: validListings,
      _validAuctions: validAuctions,
    },
    revalidate: 10,
  }
}
