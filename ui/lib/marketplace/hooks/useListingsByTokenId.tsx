import { useEffect, useState } from "react";
import { AuctionListing, DirectListing } from "../marketplace-utils";

export function useListingsByTokenId(
  validListings: DirectListing[],
  validAuctions: AuctionListing[],
  tokenId: string | number,
  contractAddress: string
) {
  const [listings, setListings] = useState<any>([]);
  const [auctions, setAuctions] = useState<any>([]);

  useEffect(() => {
    if (validListings && validAuctions && contractAddress) {
      const filteredListings =
        validListings[0] &&
        validListings?.filter(
          (l: DirectListing) =>
            l.assetContractAddress.toLowerCase() ===
              contractAddress.toLowerCase() && +l.tokenId === Number(tokenId)
        );
      const filteredAuctions =
        validAuctions[0] &&
        validAuctions?.filter(
          (a: AuctionListing) =>
            a.assetContractAddress.toLowerCase() ===
              contractAddress.toLowerCase() && +a.tokenId === Number(tokenId)
        );
      setListings(filteredListings || []);
      setAuctions(filteredAuctions || []);
    }
  }, [validListings, validAuctions, contractAddress, tokenId]);

  return { listings, auctions } as {
    listings: DirectListing[];
    auctions: AuctionListing[];
  };
}
