import { useEffect, useState } from "react";
import { AuctionListing, DirectListing } from "../marketplace-utils";

//Get listings and auctions for a specific wallet
export function useListingsByWallet(
  validListings: DirectListing[],
  allAuctions: AuctionListing[],
  walletAddress: string
) {
  const [listings, setListings] = useState<any>();
  const [auctions, setAuctions] = useState<any>();
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (walletAddress) {
      setLoading(true);
      const filteredListings =
        (validListings &&
          validListings[0] &&
          validListings?.filter(
            (l: DirectListing) =>
              l.creatorAddress && l.creatorAddress === walletAddress
          )) ||
        [];
      const filteredAuctions =
        (allAuctions &&
          allAuctions[0] &&
          allAuctions?.filter(
            (a: AuctionListing) =>
              a.creatorAddress && a.creatorAddress === walletAddress
          )) ||
        [];
      setListings(filteredListings);
      setAuctions(filteredAuctions);
      setLoading(false);
    }
  }, [validListings, allAuctions, walletAddress]);

  return { listings, auctions, isLoading: loading };
}
