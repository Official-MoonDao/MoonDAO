import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useNetworkMismatch, useSigner } from '@thirdweb-dev/react'
import {
  MarketplaceV3,
  ThirdwebSDK,
  getAllDetectedExtensionNames,
} from '@thirdweb-dev/sdk'
import { useEffect, useState } from 'react'
import { AuctionListing, DirectListing } from '../marketplace-utils'
import { useListingsByWallet } from './useListingsByWallet'

//Get all NFTs from collections accepted by the marketplace by wallet
export function useUserAssets(
  marketplace: MarketplaceV3 | undefined,
  validListings: DirectListing[],
  validAuctions: AuctionListing[],
  batch: any,
  walletAddress: string
) {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
  const [assets, setAssets] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const signer: any = useSigner()
  const networkMismatch = useNetworkMismatch()

  const {
    listings: profileListings,
    auctions: profileAuctions,
    isLoading: loadingProfileListings,
  } = useListingsByWallet(validListings, validAuctions, signer?._address)

  useEffect(() => {
    if (
      marketplace &&
      signer &&
      !networkMismatch &&
      profileAuctions &&
      profileListings &&
      !loadingProfileListings
    ) {
      setIsLoading(true)
      marketplace.roles.get('asset').then(async (res: any) => {
        await res.forEach(async (collection: any) => {
          if (networkMismatch) return

          try {
            const sdk: ThirdwebSDK = ThirdwebSDK.fromSigner(signer, chain)
            const contract: any = await sdk.getContract(collection)
            const extensions = getAllDetectedExtensionNames(contract.abi)
            let ownedAssets: any
            if (extensions[0] === 'ERC1155') {
              ownedAssets = await contract.erc1155.getOwned(signer._address)
              //Create a new array of ownedAssets with quantityOwned updated to reflect the number of assets not listed on the marketplace
              if (profileListings?.[0] || profileAuctions?.[0]) {
                ownedAssets = await ownedAssets.map((asset: any) => {
                  const ownedQuantity = asset.quantityOwned
                  //only count direct listings, auction listings are automatically subtracted from asset.quantityOwned
                  const listedQuantity =
                    profileListings?.reduce(
                      (arr: number, listing: any) =>
                        listing.assetContractAddress.toLowerCase() ===
                          collection.toLowerCase() &&
                        listing.tokenId === asset.metadata.id
                          ? arr + Number(listing?.quantity)
                          : arr,
                      0
                    ) || 0

                  const batchListedQuantity =
                    batch?.reduce(
                      (arr: number, listing: any) =>
                        listing.assetContractAddress.toLowerCase() ===
                          collection.toLowerCase() &&
                        listing.tokenId === asset.metadata.id
                          ? arr + Number(listing?.quantity)
                          : arr,
                      0
                    ) || 0 + listedQuantity

                  return {
                    ...asset,
                    quantityOwned: ownedQuantity - batchListedQuantity,
                  }
                })
              }
            } else {
              ownedAssets = await contract.erc721.getOwned(signer._address)

              if (profileListings?.[0] || profileAuctions?.[0]) {
                ownedAssets = ownedAssets
                  .filter(
                    (asset: any) =>
                      !profileListings?.find(
                        (listing: any) =>
                          listing.assetContractAddress === collection &&
                          listing.tokenId === asset.metadata.id
                      ) &&
                      !profileAuctions?.find(
                        (auction: any) =>
                          auction.assetContractAddress === collection &&
                          auction.tokenId === asset.metadata.id
                      )
                  )
                  .map((asset: any) => ({ ...asset, quantityOwned: '1' }))

                //check for batch listing
                if (batch?.[0]) {
                  ownedAssets = ownedAssets.filter(
                    (asset: any) =>
                      !batch?.find(
                        (listing: any) =>
                          listing.assetContractAddress === collection &&
                          listing.tokenId === asset.metadata.id
                      )
                  )
                }
              } else {
                ownedAssets = ownedAssets.map((asset: any) => ({
                  ...asset,
                  quantityOwned: '1',
                }))
              }
            }
            const collectionName = await contract.call('name')

            //add collection data to ownedAssets
            ownedAssets = await ownedAssets.map((asset: any) => ({
              ...asset,
              collection,
              collectionName,
            }))

            //add ownedAssets to assets array and filter out any duplicates (on address change duplicates are created and then filtered out, this is a quick fix)
            ownedAssets.length > 0 &&
              setAssets((prev: any) =>
                prev
                  ? [
                      ...prev.filter((a: any) => a.collection !== collection),
                      ...ownedAssets,
                    ]
                  : ownedAssets
              )
          } catch (err: any) {
            console.log(err.message)
          }
          setIsLoading(false)
        })
      })
    }
  }, [batch, signer, profileListings, profileAuctions, walletAddress])

  useEffect(() => {
    if (signer && walletAddress) {
      if (signer._address !== walletAddress) {
        setAssets(undefined)
      }
    }
  }, [signer, walletAddress])
  return { assets, isLoading }
}
