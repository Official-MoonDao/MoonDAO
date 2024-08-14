import { useEffect, useState } from 'react'
import { AuctionListing, DirectListing } from '../marketplace-utils'

//Search for collection or asset by name, return collection or asset url
export function useSearch(
  text: string,
  validListings: DirectListing[],
  validAuctions: AuctionListing[]
) {
  const [validAssets, setValidAssets] = useState<any>([])
  const [searchResults, setSearchResults] = useState<any>([])

  useEffect(() => {
    function uniqueAssets() {
      if (validListings || validAuctions) {
        const listings = validListings
        const auctions = validAuctions
        const uniqueAssets: any = []
        const filteredAssets: any = []
        const length: number =
          listings.length > auctions.length ? listings.length : auctions.length
        for (let i = 0; i < length; i++) {
          if (
            listings[i] &&
            !uniqueAssets.includes(
              listings[i].assetContractAddress + listings[i].tokenId
            )
          ) {
            const tokenId: any = listings[i].tokenId
            uniqueAssets.push(listings[i].assetContractAddress + tokenId)
            filteredAssets.push(listings[i])
          }
          if (
            auctions[i] &&
            !uniqueAssets.includes(
              auctions[i].assetContractAddress + auctions[i].tokenId
            )
          ) {
            const tokenId: any = auctions[i].tokenId
            uniqueAssets.push(auctions[i].assetContractAddress + tokenId)
            filteredAssets.push(auctions[i])
          }
        }
        setValidAssets(filteredAssets)
      }
    }

    uniqueAssets()
  }, [validListings, validAuctions])

  useEffect(() => {
    if (!text || text?.trim() === '' || text.length < 2) return
    //update unique assets

    const results = validAssets.filter((l: any) =>
      l.asset.name.toLowerCase().includes(text.toLowerCase())
    )

    setSearchResults(results)
  }, [text, validAssets])

  //limit search to 4 results
  return searchResults.slice(0, 4)
}
