export default function ToggleSaleInfo({ isBatch, setIsBatch }: any) {
  return (
    <div className="flex flex-col items-center md:items-start w-[330px] md:w-[400px]">
      <div
        className="bg-indigo-900 py-2 px-4 rounded-sm"
        onClick={() => setIsBatch(!isBatch)}
      >
        <h1 className="text-xl flex gap-3 font-semibold">
          <span
            className={`${
              !isBatch && "bg-indigo-700 opacity-[1]"
            } px-2 rounded-sm opacity-50`}
          >
            Single
          </span>
          <span className="opacity-50">|</span>
          <span
            className={`${
              isBatch && "bg-indigo-700 opacity-[1]"
            } px-2 rounded-sm opacity-50`}
          >
            Batch
          </span>
        </h1>
      </div>
      <p className="mt-5 text-white opacity-80 text-center md:text-left">
        {isBatch
          ? "Select multiple NFTs to sell at once"
          : "Select a single NFT to sell"}
      </p>
    </div>
  );
}
