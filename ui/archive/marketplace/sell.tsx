import { ThirdwebNftMedia, useAddress, useContract } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useUserAssets } from '../../lib/marketplace/hooks'
import { useAuctionBatch } from '../../lib/marketplace/hooks/useAuctionBatch'
import { useListingBatch } from '../../lib/marketplace/hooks/useListingBatch'
import {
  getAllValidAuctions,
  getAllValidListings,
} from '../../lib/marketplace/marketplace-listings'
import { useChainDefault } from '../../lib/thirdweb/hooks/useChainDefault'
import NoAssets from '../../components/marketplace/Sell/NoAssets'
import BatchSaleInfo from '../../components/marketplace/Sell/SaleInfo/BatchSaleInfo'
import ManageBatch from '../../components/marketplace/Sell/SaleInfo/ManageBatch'
import SingleSaleInfo from '../../components/marketplace/Sell/SaleInfo/SingleSaleInfo'
import ToggleSaleInfo from '../../components/marketplace/Sell/SaleInfo/ToggleSaleInfo'
import SellCard from '../../components/marketplace/Sell/SellCard'
import SubmitCollection from '../../components/marketplace/Sell/SubmitCollection'
import VerticalStar from '../../components/marketplace/assets/VerticalStar'
import { MARKETPLACE_ADDRESS } from '../../const/config'

export default function Sell() {
  useChainDefault('l2')
  const router = useRouter()
  const address: any = useAddress()
  const [selectedNft, setSelectedNft]: any = useState({ metadata: {} })

  const { contract: marketplace, isLoading: loadingContract }: any =
    useContract(MARKETPLACE_ADDRESS, 'marketplace-v3')

  const [batch, setBatch] = useState<any>([])
  const [isBatch, setIsBatch] = useState<boolean>(false)
  const [batchType, setBatchType] = useState<'direct' | 'auction' | undefined>()
  const listingBatch = useListingBatch(marketplace)
  const auctionBatch = useAuctionBatch(marketplace)

  const [loading, setLoading] = useState<boolean>(false)

  const [validListings, setValidListings] = useState<any>()
  const [validAuctions, setValidAuctions] = useState<any>()

  const { assets: userAssets, isLoading: loadingUserAssets } = useUserAssets(
    marketplace,
    validListings,
    validAuctions,
    batch,
    address
  )

  useEffect(() => {
    if (marketplace && !validListings && !validAuctions) {
      setLoading(true)
      getAllValidListings(marketplace).then((listings: any) => {
        setValidListings(listings)
        setLoading(false)
      })
      getAllValidAuctions(marketplace).then((auctions: any) => {
        setValidAuctions(auctions)
        setLoading(false)
      })
    }
  }, [marketplace])

  //set batch type
  useEffect(() => {
    if (isBatch) {
      if (listingBatch.data?.listings.length > 0) {
        setBatchType('direct')
      } else if (auctionBatch.data?.auctions.length > 0) {
        setBatchType('auction')
      }
    }
  }, [isBatch, listingBatch, auctionBatch])

  //Handling if user has no NFTs or is connected to the wrong network
  if (!address || loadingUserAssets || !userAssets?.[0] || loading) {
    return (
      <>
        <NoAssets
          address={address}
          userAssets={userAssets}
          loading={loading || loadingUserAssets}
        />
        <div className="w-full">
          <SubmitCollection />
        </div>
      </>
    )
  }

  return (
    <>
      {!selectedNft?.metadata?.id ? (
        <main className="pt-10 md:pt-12 lg:pt-16 xl:pt-20 m flex flex-col items-center w-full">
          <div className="flex flex-col items-center md:items-start px-5">
            <h2 className="font-GoodTimes tracking-wide flex items-center text-3xl lg:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-moon-gold to-indigo-100">
              Sell NFTs
              <span className="ml-2 lg:ml-4">
                <VerticalStar />
              </span>
            </h2>
            <div className="mt-8">
              <ToggleSaleInfo isBatch={isBatch} setIsBatch={setIsBatch} />
              {isBatch && (
                <ManageBatch
                  batchType={batchType}
                  setBatchType={setBatchType}
                  batch={batch}
                  setBatch={setBatch}
                  listingBatch={listingBatch}
                  auctionBatch={auctionBatch}
                />
              )}
            </div>
            {/*Asset grid */}
            <section className="mt-10 md:mt-16 flex flex-col gap-10 md:grid md:grid-cols-2 md:grid-flow-row md:gap-12 xl:grid-cols-3 xl:gap-14">
              {userAssets[0]?.metadata?.id &&
                userAssets.map(
                  (nft: any, i: number) =>
                    nft?.metadata && (
                      <SellCard
                        key={`userAsset-${i}`}
                        nft={nft}
                        setSelectedNft={setSelectedNft}
                        i={i}
                      />
                    )
                )}
            </section>
          </div>
          {!selectedNft?.metadata?.id && (
            <div className="mt-32 w-full">
              <SubmitCollection />
            </div>
          )}
        </main>
      ) : (
        <div className="w-full ml-auto mr-auto px-4 mt-[96px] max-w-[1200px]">
          <div className="mt-0 w-full flex flex-col pb-[128px] tablet:flex-row tablet:pb-0 gap-8">
            <div className="flex flex-col flex-1 w-full mt-8 tablet:mt-0">
              <div className="relative">
                <ThirdwebNftMedia
                  metadata={selectedNft.metadata}
                  className="rounded-xl !w-full !h-auto bg-white bg-opacity-[0.04]"
                />
                <button
                  onClick={() => {
                    setSelectedNft(undefined)
                  }}
                  className="absolute top-[20px] hover:scale-110 transition-all duration-150 opacity-80 hover:opacity-100 right-[20px] text-2xl lg:text-3xl"
                >
                  X
                </button>
              </div>
            </div>

            <div className="relative w-full min-w-0 max-w-full top-0 shrink tablet:sticky tablet:w-full tablet:min-w-[370px] tablet:max-w-[450px] mt-4 tablet:mt-0 mr-4">
              <h1
                className={`mt-4 mb-2 mx-4  text-2xl ${
                  isBatch ? 'text-indigo-500' : 'text-moon-gold'
                }`}
              >
                {`${isBatch ? 'Batch Listing' : 'Single Listing'}`}
              </h1>
              <p className="mx-4 ">
                {isBatch
                  ? `You're about to add this listing to a batch.`
                  : `You're about to list the following item for sale.`}
              </p>

              <h1 className="font-medium text-[32px] font-GoodTimes break-words mt-4 mb-2 mx-4 text-moon-white">
                {selectedNft.metadata.name}
              </h1>
              {/*Id not displaying here*/}
              <p className="inline-block font-medium truncate mx-4 mt-4 text-[20px] py-1 px-[10px] rounded-sm bg-moon-secondary bg-opacity-40">
                Token ID #{selectedNft.metadata.id}
              </p>

              <div className="flex flex-col w-full grow relative bg-transparent rounded-2xl overflow-hidden mt-8 mb-6 gap-4">
                {isBatch ? (
                  <BatchSaleInfo
                    nft={selectedNft}
                    contractAddress={selectedNft.collection}
                    walletAddress={address}
                    setSelectedNft={setSelectedNft}
                    batchType={batchType}
                    listingBatch={listingBatch}
                    auctionBatch={auctionBatch}
                  />
                ) : (
                  <SingleSaleInfo
                    nft={selectedNft}
                    contractAddress={selectedNft.collection}
                    router={router}
                    walletAddress={address}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
