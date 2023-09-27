import { MarketplaceV3 } from "@thirdweb-dev/sdk";
import { useState } from "react";
import { toast } from "react-hot-toast";

export function useListingBatch(marketplace: MarketplaceV3) {
  const [listings, setListings] = useState<any[]>([]);
  const [nfts, setNfts] = useState<any[]>([]);
  function addListing({ listing, nft }: any) {
    setNfts((prev) => [...prev, nft]);
    setListings((prev) => [...prev, listing]);
  }

  function removeListing(listingIndex: number) {
    setNfts(nfts.filter((_, i) => i !== listingIndex));
    setListings(listings.filter((_, i) => i !== listingIndex));
  }

  function clearAll() {
    setNfts([]);
    setListings([]);
  }

  async function listAll() {
    if (listings.length <= 1)
      toast.error("You must add at least 2 listings to create a batch listing");
    else {
      try {
        const tx = await marketplace.directListings.createListingsBatch(
          listings
        );
        toast.success("Listings created successfully");
        return tx;
      } catch (err) {
        toast.error("Error creating listings");
      }
    }
  }

  return {
    data: { listings, nfts },
    addListing,
    removeListing,
    listAll,
    clearAll,
  };
}
