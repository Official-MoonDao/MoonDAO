import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import {
  getAllValidAuctions,
  getAllValidListings,
} from '../../lib/marketplace/marketplace-listings'
import { useFilter } from '../../lib/marketplace/marketplace-subgraph'
import {
  AuctionListing,
  DirectListing,
} from '../../lib/marketplace/marketplace-utils'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import Hero from '../../components/marketplace/Home/Hero'
import CollectionShowcase from '../../components/marketplace/Home/Showcases/CollectionShowcase'
import NewShowcase from '../../components/marketplace/Home/Showcases/NewShowcase'
import TrendingShowcase from '../../components/marketplace/Home/Showcases/TrendingShowcase'
import Metadata from '../../components/marketplace/Layout/Metadata'
import { MARKETPLACE_ADDRESS } from '../../const/config'

type HomeProps = {
  _validListings: DirectListing[]
  _validAuctions: AuctionListing[]
}

export default function Home({ _validListings, _validAuctions }: HomeProps) {
  const { contract: marketplace }: any = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )

  const [validListings, setValidListings] =
    useState<DirectListing[]>(_validListings)
  const [validAuctions, setValidAuctions] =
    useState<AuctionListing[]>(_validAuctions)

  const { collections: trendingCollections, assets: trendingAssets } =
    useFilter('trending', validListings, validAuctions)

  const { collections: newCollections, assets: newAssets } = useFilter(
    'new',
    validListings,
    validAuctions
  )

  //Use SSG data if marketplace contract hasn't loaded yet
  useEffect(() => {
    if (marketplace) {
      getAllValidListings(marketplace).then((listings: DirectListing[]) => {
        setValidListings(listings)
      })
      getAllValidAuctions(marketplace).then((auctions: AuctionListing[]) => {
        setValidAuctions(auctions)
      })
    }
  }, [_validAuctions, _validListings])

  return (
    <main className="flex flex-col items-center px-6 md:px-10">
      <Metadata title="Home" />
      <Hero
        topAssets={trendingAssets.slice(
          0,
          trendingAssets.length < 4 ? trendingAssets.length : 4
        )}
      />

      <CollectionShowcase
        collections={trendingCollections}
        validListings={validListings}
        validAuctions={validAuctions}
      />
      <TrendingShowcase
        assets={trendingAssets}
        validListings={validListings}
        validAuctions={validAuctions}
      />
      <NewShowcase
        collections={newCollections}
        validListings={validListings}
        validAuctions={validAuctions}
      />
    </main>
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
