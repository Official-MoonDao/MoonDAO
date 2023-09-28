import { MarketplaceV3 } from "@thirdweb-dev/sdk";
import { serialize } from "./marketplace-utils";

//Get all auctions including expired & closed auctions from marketplace
export async function getAllAuctions(marketplace: MarketplaceV3) {
  try {
    const auctions = await marketplace.englishAuctions.getAll();
    const serialized = serialize(auctions);
    return serialized;
  } catch (err) {
    console.log(err);
    return [];
  }
}

//Get all valid listings from marketplace
export async function getAllValidListings(marketplace: MarketplaceV3) {
  try {
    const listings = await marketplace.directListings.getAllValid();
    const serialized = serialize(listings);
    return serialized;
  } catch (err) {
    console.log(err);
    return [];
  }
}

//Get all valid auctions from marketplace
export async function getAllValidAuctions(marketplace: MarketplaceV3) {
  try {
    const auctions = await marketplace.englishAuctions.getAllValid();
    const serialized = serialize(auctions);
    return serialized;
  } catch (err) {
    console.log(err);
    return [];
  }
}
