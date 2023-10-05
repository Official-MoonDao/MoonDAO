import { ThirdwebNftMedia } from "@thirdweb-dev/react";

const SellCard = ({ nft, i, setSelectedNft }: any) => {
  if (nft.quantityOwned <= 0) return <></>; //only render if user owns at least 1 of this NFT
  return (
    <div
      className="relative group hover:translate-y-[-4%] duration-300 ease-in my-[2.5%] flex flex-col items-center"
      key={`userNFT-${i}`}
      onClick={() => setSelectedNft(nft)}
    >
      <ThirdwebNftMedia
        className="rounded-md group-hover:drop-shadow-[0px_0px_10px_#d1d1d1] ease-in duration-300"
        metadata={nft?.metadata}
      />
      {nft.type === "ERC1155" && (
        <p className="absolute top-3 left-3 text-lg tracking-widest px-2 py-1 bg-moon-gold bg-opacity-80 rounded-xl">
          {"x" + nft.quantityOwned}
        </p>
      )}
      <div className="group-hover:drop-shadow-[0px_10px_15px_#d1d1d1] bg-gradient-to-br w-full shadow transition-all duration-300 shadow-white from-black via-gray-900 to-black -mt-2 z-50 relative py-3 pl-4 pr-3">
        <p className="text-sm opacity-70 truncate">{nft.collectionName}</p>
        <p className="mt-4 font-GoodTimes tracking-wide truncate">
          {nft.metadata?.name}
        </p>
        <p className="text-xs uppercase tracking-widest mt-4 text-moon-gold opacity-70">
          {nft?.type}
        </p>
      </div>
    </div>
  );
};

export default SellCard;
