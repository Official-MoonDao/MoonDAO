import { Canvas } from '@react-three/fiber'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useListingsByWallet } from '../../../lib/marketplace/hooks'
import { useUserWinnings } from '../../../lib/marketplace/hooks/useUserWinnings'
import {
  getAllAuctions,
  getAllValidListings,
} from '../../../lib/marketplace/marketplace-listings'
import {
  AuctionListing,
  DirectListing,
} from '../../../lib/marketplace/marketplace-utils'
import { useChainDefault } from '../../../lib/thirdweb/hooks/useChainDefault'
import { useShallowQueryRoute } from '../../../lib/utils/hooks'
import Skeleton from '../../../components/marketplace/Layout/Skeleton'
import ProfileListingGrid from '../../../components/marketplace/Profile/ProfileListingGrid'
import BannerScene from '../../../components/marketplace/r3f/Profile/BannerScene'
import { MARKETPLACE_ADDRESS } from '../../../const/config'

type ProfilePageProps = {
  walletAddress: string
  queryTab: 'listings' | 'auctions' | 'winningBids'
}

export default function ProfilePage({
  walletAddress,
  queryTab,
}: ProfilePageProps) {
  useChainDefault('l2')
  const router = useRouter()
  const address: any = useAddress()

  const { contract: marketplace }: any = useContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )
  const [loadingListings, setLoadingListings] = useState<boolean>(true)
  const [validListings, setValidListings] = useState<DirectListing[]>([])
  const [allAuctions, setAllAuctions] = useState<AuctionListing[]>([])

  const { listings, auctions } = useListingsByWallet(
    validListings,
    allAuctions,
    walletAddress
  )

  const assetsWon = useUserWinnings(marketplace, allAuctions, address)

  const [tab, setTab] = useState<'listings' | 'auctions' | 'winningBids'>(
    queryTab
  )
  const shallowQueryRoute = useShallowQueryRoute()

  useEffect(() => {
    if (marketplace) {
      getAllValidListings(marketplace).then((listings: DirectListing[]) => {
        setValidListings(listings)
        setLoadingListings(false)
      })
      getAllAuctions(marketplace).then((auctions: AuctionListing[]) => {
        setAllAuctions(auctions)
        setLoadingListings(false)
      })
    }
  }, [marketplace])

  useEffect(() => {
    if (address) {
      router.push(`/profile/${address}`)
    }
  }, [address])

  return (
    <main className="w-full ml-auto mr-auto px-4 mt-24 max-w-[1200px]">
      <div>
        <div className="flex justify-center items-center w-full bg-[#272a2d] h-[300px] rounded-tl-[30px] rounded-br-[30px] bg-gradient-to-br from-moon-secondary via-indigo-900 to-moon-secondary">
          <Canvas flat className="w-full">
            <BannerScene walletAddress={walletAddress} />
          </Canvas>
        </div>
      </div>

      <div className="w-full flex justify-start border-b-[1px] border-white border-opacity-60 my-4">
        <h3
          className={`p-4 text-base font-semibold cursor-pointer transition-all duration-100 ease-in-out hover:text-[#e9e9f9]
        ${
          tab === 'listings'
            ? 'text-moon-gold border-b-moon-gold border-b-2'
            : 'text-white text-opacity-60'
        }`}
          onClick={() => {
            setTab('listings')
            shallowQueryRoute({ address: walletAddress, tab: 'listings' })
          }}
        >
          Listings
        </h3>
        <h3
          className={`p-4 text-base font-semibold cursor-pointer transition-all duration-100 ease-in-out hover:text-[#e9e9f9]
        ${
          tab === 'auctions'
            ? 'text-moon-gold border-b-moon-gold border-b-2'
            : 'text-white text-opacity-60'
        }`}
          onClick={() => {
            setTab('auctions')
            shallowQueryRoute({ address: walletAddress, tab: 'auctions' })
          }}
        >
          Auctions
        </h3>
        <h3
          className={`p-4 text-base font-semibold cursor-pointer transition-all duration-100 ease-in-out hover:text-[#e9e9f9]
        ${
          tab === 'winningBids'
            ? 'text-moon-gold border-b-moon-gold border-b-2'
            : 'text-white text-opacity-60'
        }`}
          onClick={() => {
            setTab('winningBids')
            shallowQueryRoute({ address: walletAddress, tab: 'winningBids' })
          }}
        >
          Winning Bids
          {assetsWon && assetsWon.length > 0 && (
            <span className="mx-2 py-1 px-1 bg-moon-secondary rounded-full">
              {assetsWon.length}
            </span>
          )}
        </h3>
      </div>

      <div
        className={`${
          tab === 'listings'
            ? 'flex opacity-100'
            : 'hidden h-0 opacity-0 transition-all duration-100'
        }`}
      >
        {marketplace && !loadingListings ? (
          <ProfileListingGrid listings={listings} type="direct" />
        ) : (
          <Skeleton />
        )}
      </div>

      <div
        className={`${
          tab === 'auctions'
            ? 'flex opacity-100'
            : 'hidden h-0 opacity-0 transition-all duration-100'
        }`}
      >
        {marketplace && !loadingListings ? (
          <ProfileListingGrid
            listings={auctions?.filter((a: AuctionListing) => a.status !== 2)}
            type="auction"
          />
        ) : (
          <Skeleton />
        )}
      </div>
      <div
        className={`${
          tab === 'winningBids'
            ? 'flex-opacity-100'
            : 'hidden h-0 opacity-0 transition-all duration-100'
        }`}
      >
        {marketplace && !loadingListings ? (
          <ProfileListingGrid listings={assetsWon} type="winningBids" />
        ) : (
          <Skeleton />
        )}
      </div>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async ({
  params,
  query,
}) => {
  const walletAddress = params?.address
  const queryTab = query?.tab || 'listings'
  return {
    props: {
      walletAddress,
      queryTab,
    },
  }
}
