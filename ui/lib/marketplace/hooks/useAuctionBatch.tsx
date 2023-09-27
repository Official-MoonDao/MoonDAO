import { MarketplaceV3 } from "@thirdweb-dev/sdk";
import { useState } from "react";
import { toast } from "react-hot-toast";

export function useAuctionBatch(marketplace: MarketplaceV3) {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [nfts, setNfts] = useState<any[]>([]);
  function addAuction({ auction, nft }: any) {
    setNfts((prev) => [...prev, nft]);
    setAuctions((prev) => [...prev, auction]);
  }

  function removeAuction(auctionIndex: number) {
    setNfts(nfts.filter((_, i) => i !== auctionIndex));
    setAuctions(auctions.filter((_, i) => i !== auctionIndex));
  }

  function clearAll() {
    setNfts([]);
    setAuctions([]);
  }

  async function listAll() {
    if (auctions.length <= 1)
      toast.error("You must add at least 2 listings to create a batch listing");
    else {
      try {
        const tx = await marketplace.englishAuctions.createAuctionsBatch(
          auctions
        );
        toast.success("Auctions created successfully");
        return tx;
      } catch (err) {
        toast.error("Error creating auctions");
      }
    }
  }

  return {
    data: { auctions, nfts },
    addAuction,
    removeAuction,
    listAll,
    clearAll,
  };
}
