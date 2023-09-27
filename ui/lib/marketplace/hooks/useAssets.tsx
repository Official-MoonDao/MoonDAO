import { useEffect, useState } from "react";
import { AuctionListing, DirectListing } from "../marketplace-utils";

//Get unique assets for a specific collection
export function useAssets(
  listings: DirectListing[],
  auctions: AuctionListing[],
  assetContractAddress: string
) {
  const [assets, setAssets] = useState([]);
  useEffect(() => {
    if (listings || auctions) {
      const uniqueAssets: any = [];
      const filteredAssets: any = [];
      const length: number =
        listings.length > auctions.length ? listings.length : auctions.length;
      for (let i = 0; i < length; i++) {
        if (
          listings[i] &&
          listings[i].assetContractAddress === assetContractAddress &&
          !uniqueAssets.includes(listings[i].tokenId)
        ) {
          const tokenId: any = listings[i].tokenId;
          uniqueAssets.push(tokenId);
          filteredAssets.push(listings[i]);
        }
        if (
          auctions[i] &&
          auctions[i].assetContractAddress === assetContractAddress &&
          !uniqueAssets.includes(auctions[i].tokenId)
        ) {
          const tokenId: any = auctions[i].tokenId;
          uniqueAssets.push(tokenId);
          filteredAssets.push(auctions[i]);
        }
      }
      setAssets(filteredAssets);
    }
  }, [listings, auctions]);
  return assets;
}
