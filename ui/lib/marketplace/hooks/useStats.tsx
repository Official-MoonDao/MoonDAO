import { useEffect, useState } from "react";
import {
  AssetStats,
  AuctionListing,
  CollectionStats,
  DirectListing,
} from "../marketplace-utils";
import { useListingsByTokenId } from "./useListingsByTokenId";
import { getAllDetectedExtensionNames } from "@thirdweb-dev/sdk";
import { useContract } from "@thirdweb-dev/react";
import { MOONEY_DECIMALS } from "../../../const/config";

function getFloorPrice(listings: DirectListing[], auctions: AuctionListing[]) {
  //get floor price for validListings

  const listingFloor =
    listings && listings[0]
      ? Math.min(...listings.map((listing) => +listing.pricePerToken))
      : 0; //get floor price for validAuctions
  const auctionFloor =
    auctions && auctions[0]
      ? Math.min(...auctions.map((auction) => +auction.buyoutBidAmount))
      : 0;

  //true floor price for asset
  if (listingFloor === 0) return auctionFloor;
  if (auctionFloor === 0) return listingFloor;
  return +listingFloor < +auctionFloor ? listingFloor : auctionFloor;
}

//Get stats for a specific asset
export function useAssetStats(
  validListings: DirectListing[],
  validAuctions: AuctionListing[],
  contractAddress: string,
  tokenId: string
) {
  const [stats, setStats] = useState<AssetStats>({
    floorPrice: 0,
    listed: 0,
    supply: 0,
  });

  const { contract }: any = useContract(contractAddress);

  const { listings: assetListings, auctions: assetAuctions } =
    useListingsByTokenId(
      validListings,
      validAuctions,
      tokenId,
      contractAddress
    );

  useEffect(() => {
    let floorPrice, supply;
    if (assetListings && assetAuctions && contract) {
      floorPrice = Math.round(
        +getFloorPrice(assetListings, assetAuctions) / MOONEY_DECIMALS
      );
      const extensions = getAllDetectedExtensionNames(contract?.abi);
      (async () => {
        if (extensions[0] !== "ERC1155") {
          supply = await contract.erc721.totalCount();
        } else {
          supply = await contract.erc1155.totalSupply(tokenId);
        }

        const listed =
          (assetListings?.reduce(
            (arr: number, l: any) => arr + Number(l.quantity),
            0
          ) || 0) +
          (assetAuctions?.reduce(
            (arr: number, a: any) => arr + Number(a.quantity),
            0
          ) || 0);

        setStats({
          floorPrice: floorPrice || 0,
          supply: supply?.toNumber() || 0,
          listed,
        });
      })();
    }
  }, [assetListings, assetAuctions, contract]);

  return stats;
}

//Get stats for a speicific collection
export function useCollectionStats(
  validListings: DirectListing[],
  validAuctions: AuctionListing[],
  collectionContract: any
) {
  const [collectionListings, setCollectionListings] = useState<any>([]);
  const [collectionAuctions, setCollectionAuctions] = useState<any>([]);

  const [stats, setStats] = useState<CollectionStats>({
    floorPrice: 0,
    listed: 0,
    supply: 0,
  });
  //Get nfts for a specific collection
  useEffect(() => {
    if (!collectionContract) return;
    if (validListings) {
      const filteredListings =
        validListings[0] &&
        validListings?.filter(
          (l: DirectListing) =>
            l.assetContractAddress.toLowerCase() ===
            collectionContract.getAddress().toLowerCase()
        );
      setCollectionListings(filteredListings);
    }
    if (validAuctions) {
      const filteredAuctions =
        validAuctions[0] &&
        validAuctions?.filter(
          (a: AuctionListing) =>
            a.assetContractAddress.toLowerCase() ===
            collectionContract.getAddress().toLowerCase()
        );
      setCollectionAuctions(filteredAuctions);
    }
  }, [validListings, validAuctions, collectionContract]);

  //Get stats
  useEffect(() => {
    if (collectionContract && (collectionListings || collectionAuctions)) {
      const floorPrice = getFloorPrice(collectionListings, collectionAuctions);
      const listed =
        (collectionListings?.reduce(
          (arr: number, l: any) => arr + Number(l.quantity),
          0
        ) || 0) +
        (collectionAuctions?.reduce(
          (arr: number, a: any) => arr + Number(a.quantity || 0),
          0
        ) || 0);

      let supply: any;
      (async () => {
        const extensions = getAllDetectedExtensionNames(
          collectionContract?.abi
        );
        if (extensions[0] === "ERC1155") {
          supply = await collectionContract.erc1155.totalCount();
        } else {
          supply = await collectionContract.erc721.totalCount();
        }
        setStats({
          floorPrice: Math.round(+floorPrice / MOONEY_DECIMALS),
          listed,
          supply: supply?.toNumber() || 0,
        });
      })();
    }
  }, [collectionListings, collectionAuctions]);
  return stats;
}
