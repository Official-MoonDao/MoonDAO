import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useMetadata,
} from '@thirdweb-dev/react'
import { getAllDetectedExtensionNames } from '@thirdweb-dev/sdk'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useListingsByTokenId } from '../../../../lib/marketplace/hooks'
import {
  getAllValidAuctions,
  getAllValidListings,
} from '../../../../lib/marketplace/marketplace-listings'
import {
  DirectListing,
  AuctionListing,
  CurrListing,
} from '../../../../lib/marketplace/marketplace-utils'
import randomColor from '../../../../lib/marketplace/marketplace-utils/randomColor'
import { initSDK } from '../../../../lib/thirdweb/thirdweb'
import Metadata from '../../../../components/marketplace/Layout/Metadata'
import Skeleton from '../../../../components/marketplace/Layout/Skeleton'
import AssetHistory from '../../../../components/marketplace/NFT/AssetHistory'
import AssetListings from '../../../../components/marketplace/NFT/AssetListings'
import BuyOrBid from '../../../../components/marketplace/NFT/BuyOrBid'
import { MARKETPLACE_ADDRESS, MOONEY_DECIMALS } from '../../../../const/config'

type TokenPageProps = {
  contractAddress: string
  tokenId: string
  nft: any
}

const [randomColor1, randomColor2] = [randomColor(), randomColor()]

export default function TokenPage({
  contractAddress,
  tokenId,
  nft,
}: TokenPageProps) {
  const router = useRouter()
  const address = useAddress()

  //Marketplace
  const [validListings, setValidListings] = useState<DirectListing[]>([])
  const [validAuctions, setValidAuctions] = useState<AuctionListing[]>([])
  const { contract: marketplace, isLoading: loadingContract }: any =
    useContract(MARKETPLACE_ADDRESS, 'marketplace-v3')

  //get listings for specific asset
  const { listings: directListings, auctions: auctionListings } =
    useListingsByTokenId(validListings, validAuctions, tokenId, contractAddress)

  //selected listing
  const [currListing, setCurrListing] = useState<CurrListing>({
    type: 'direct',
    listing: {} as DirectListing | AuctionListing,
  })

  //tab for direct listings and auctions
  const [tab, setTab] = useState<'listings' | 'auctions'>('listings')

  const [winningBid, setWinningBid] = useState<any>()

  //NFT Collection & Metadata
  const { contract: nftCollection } = useContract(contractAddress)

  const { data: collectionMetadata }: any = useMetadata(nftCollection)

  // Load historical transfer events: TODO - more event types like sale

  ///set valid listings and auctions
  useEffect(() => {
    if (marketplace) {
      getAllValidListings(marketplace).then((listings: DirectListing[]) => {
        setValidListings(listings)
      })
      getAllValidAuctions(marketplace).then((auctions: AuctionListing[]) => {
        setValidAuctions(auctions)
      })
    }
  }, [marketplace])

  ///set Current Listing (potentially refactor currListing to useMemo?)
  useEffect(() => {
    if (directListings[0] || auctionListings[0]) {
      const listing = directListings[0]
        ? { type: 'direct', listing: directListings[0] }
        : { type: 'auction', listing: auctionListings[0] }
      setCurrListing(listing)
      listing.type === 'auction' && setTab('auctions')
    }
  }, [nft, directListings, auctionListings])

  ///set winning bid
  useEffect(() => {
    //set winning bid if auction
    if (!loadingContract && currListing.type === 'auction') {
      ;(async () => {
        const winningBid = await marketplace?.englishAuctions?.getWinningBid(
          currListing.listing.auctionId
        )
        setWinningBid(winningBid)
      })()
    }
    //check if connected wallet is owner of asset
  }, [currListing, address, loadingContract])

  return (
    <>
      <Metadata
        title={'Asset'}
        description={nft.metadata.description}
        image={nft.metadata.image}
      />
      <article className="w-full ml-auto mr-auto px-4 md:mt-24 max-w-[1200px]">
        <div className="w-full flex flex-col gap-8 mt-4 md:mt-32 tablet:flex-row pb-32 tablet:pb-0">
          <div className="flex flex-col flex-1 w-full mt-8 tablet:mt-0">
            <ThirdwebNftMedia
              metadata={nft?.metadata}
              className="!w-full !h-full bg-white bg-opacity-[0.04] rounded-2xl"
            />

            {/*Description*/}
            <div className="px-4">
              <h3 className="mt-8 mb-[15px] text-[23px] font-medium font-GoodTimes text-moon-gold">
                Description
              </h3>

              <p className="font-medium text-base leading-[25px] opacity-80 font-mono">
                {nft.metadata.description}
              </p>

              {/*Traits*/}
              <h3 className="mt-8 mb-[15px] text-[23px] font-medium font-GoodTimes text-moon-gold">
                Traits
              </h3>

              <div className="py-3 flex flex-wrap gap-4 md:gap-5 mt-3">
                {Object.entries(nft?.metadata?.attributes || {}).map(
                  ([key, value]: any) => (
                    <div
                      className="flex flex-col gap-[6px] rounded-lg bg-slate-900 text-center min-w-[128px] lg:min-w-[142px] min-h-[32px] lg:min-h-[38px] grow-0"
                      key={key}
                    >
                      <p className="text-moon-gold opacity-70 px-2 pt-1 pb-[2px] bg-[#030712] font-semibold uppercase tracking-widest text-sm">
                        {value.trait_type}
                      </p>
                      <p className="text-base px-2 pb-2 text-white tracking-wider text-[17px] font-mono capitalize">
                        {value.value?.toString() || ''}
                      </p>
                    </div>
                  )
                )}
                <p>{/*{nft?.metadata?.attributes}*/}</p>
              </div>

              {/*History*/}
              {currListing?.listing && nft.type === 'ERC721' && (
                <AssetHistory
                  marketplace={marketplace}
                  contract={nftCollection}
                  tokenId={currListing.listing.tokenId}
                />
              )}
            </div>
          </div>

          {/*Collection title, image and description*/}
          <div className="relative w-full max-w-full top-0 tablet:flex-shrink tablet:sticky tablet:min-w-[370px] tablet:max-w-[450px] tablet:mt-4 tablet:mr-4">
            {collectionMetadata && (
              <div className="flex items-center mb-2">
                <Link href={`/marketplace/collection/${contractAddress}`}>
                  <MediaRenderer
                    src={collectionMetadata.image}
                    className="!w-[36px] !h-[36px] rounded-lg mr-4 ml-3 mb-2"
                  />
                  <p className="truncate w-full mx-4 mt-[5px] opacity-50">
                    {collectionMetadata.name}
                  </p>
                </Link>
              </div>
            )}
            <h1 className="font-GoodTimes font-medium text-[32px] break-words mb-2 mx-4 text-moon-white">
              {nft.metadata.name}
            </h1>
            <div className="inline-block">
              <p className="font-medium truncate mx-4 mt-4 text-[20px] py-1 px-[10px] rounded-sm bg-moon-secondary bg-opacity-40">
                Token ID #{nft.metadata.id}
              </p>
            </div>

            {currListing?.listing && nft.type === 'ERC721' && (
              <div className="flex items-center mb-2 mt-6 gap-2 transition-opacity duration-200 ease-in-out mx-4">
                {/* Random linear gradient circle shape */}
                <div
                  className="mt-4 w-[48px] h-[48px] rounded-[50%] opacity-90 border-2 border-white border-opacity-20"
                  style={{
                    background: `linear-gradient(90deg, ${randomColor1}, ${randomColor2})`,
                  }}
                />
                {/*Nft owner info*/}
                <div className="m-0 p-0 ml-[6px] flex flex-col h-full mt-4">
                  <div>
                    <p className="text-white opacity-60 mt-1 p-[2px]">Seller</p>
                    <p className="font-semibold m-0 text-white text-opacity-90">
                      {currListing?.listing?.creatorAddress?.slice(0, 8)}...
                      {currListing?.listing?.creatorAddress?.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col w-full relative grow bg-transparent rounded-2xl overflow-hidden mt-8 mb-6">
              <div className="p-4 pl-5 rounded-xl bg-white bg-opacity-[0.13] w-full m-0 mb-3">
                {/* Quantity for ERC1155 */}
                {currListing?.listing && nft.type === 'ERC1155' && (
                  <>
                    <p className="text-white opacity-60 mt-1 p-[2px]">
                      Quantity
                    </p>
                    <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                      {currListing.listing.quantity}
                    </div>
                  </>
                )}
                {/* Pricing information */}
                <p className="text-white opacity-60 mt-1 p-[2px]">Price</p>
                <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                  {!currListing?.listing ||
                  (currListing.type === 'direct' &&
                    !currListing.listing.pricePerToken) ||
                  (currListing.type === 'auction' &&
                    !currListing.listing.buyoutBidAmount) ? (
                    <Skeleton width="120" height="24" />
                  ) : (
                    <>
                      {currListing.listing && currListing.type === 'direct' ? (
                        <>
                          {Math.round(
                            +currListing.listing.pricePerToken / MOONEY_DECIMALS
                          ) || '...'}
                          {' ' + 'MOONEY'}
                        </>
                      ) : currListing.listing &&
                        currListing.type === 'auction' ? (
                        <>
                          {Math.round(
                            +currListing.listing.buyoutBidAmount /
                              MOONEY_DECIMALS
                          ) || '...'}
                          {' ' + 'MOONEY'}
                        </>
                      ) : (
                        'Not for sale'
                      )}
                      <p
                        className="text-white opacity-60 mt-1 p-[2px]"
                        style={{ marginTop: 12 }}
                      >
                        {'Expiration'}
                      </p>
                      <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                        {new Date(
                          +currListing.listing.endTimestamp * 1000
                        ).toLocaleDateString() +
                          ' @ ' +
                          new Date(
                            +currListing.listing.endTimestamp * 1000
                          ).toLocaleTimeString()}
                      </div>
                    </>
                  )}
                </div>

                {currListing && (
                  <div>
                    {!currListing.listing ? (
                      <Skeleton width="120" height="44" />
                    ) : (
                      <>
                        {currListing.type === 'auction' &&
                          currListing.listing && (
                            <>
                              <p
                                className="text-white opacity-60 mt-1 p-[2px]"
                                style={{ marginTop: 12 }}
                              >
                                Bids starting from
                              </p>

                              <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                                {Math.round(
                                  +currListing.listing.minimumBidAmount /
                                    MOONEY_DECIMALS
                                )}
                                {' ' + 'MOONEY'}
                              </div>
                              <p
                                className="text-white opacity-60 mt-1 p-[2px]"
                                style={{ marginTop: 12 }}
                              >
                                {'Winning Bid'}
                              </p>
                              <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                                {winningBid
                                  ? winningBid.bidAmount / MOONEY_DECIMALS +
                                    ' MOONEY'
                                  : 'No bids yet'}
                              </div>
                              <p
                                className="text-white opacity-60 mt-1 p-[2px]"
                                style={{ marginTop: 12 }}
                              >
                                {'Expiration'}
                              </p>
                              <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                                {new Date(
                                  +currListing.listing.endTimestamp * 1000
                                ).toLocaleDateString() +
                                  ' @ ' +
                                  new Date(
                                    +currListing.listing.endTimestamp * 1000
                                  ).toLocaleTimeString()}
                              </div>
                            </>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/*Direct listings and auction, hidden if there isn't either via conditional*/}
            {nft.type === 'ERC1155' && (
              <AssetListings
                tab={tab}
                setTab={setTab}
                directListings={directListings}
                auctionListings={auctionListings}
                currListing={currListing}
                setCurrListing={setCurrListing}
              />
            )}

            {(directListings[0] || auctionListings[0]) && (
              <BuyOrBid
                marketplace={marketplace}
                walletAddress={address}
                winningBid={String(winningBid?.bidAmount || '')}
                currListing={currListing}
              />
            )}
          </div>
        </div>
      </article>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const contractAddress = params?.contractAddress
  const tokenId = params?.tokenId

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
  const sdk = initSDK(chain)
  const marketplace: any = await sdk.getContract(
    MARKETPLACE_ADDRESS,
    'marketplace-v3'
  )
  const acceptedCollections = await marketplace.roles.get('asset')

  // if no contract address or token id, return 404
  if (!acceptedCollections.includes(contractAddress)) {
    return {
      notFound: true,
    }
  }

  const collectionContract: any = await sdk.getContract(
    contractAddress as string
  )
  const extensions = getAllDetectedExtensionNames(collectionContract.abi)

  let nft
  if (extensions[0] === 'ERC1155') {
    nft = await collectionContract.erc1155.get(tokenId)
  } else {
    nft = await collectionContract.erc721.get(tokenId)
  }

  if (!nft) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      contractAddress,
      tokenId,
      nft,
    },
  }
}
