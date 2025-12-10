import { InformationCircleIcon } from '@heroicons/react/24/outline'

export default function RaffleNFTDetail() {
  return (
    <div className="backdropBlur flex flex-col justify-center items-center gap-2 my-4">
      <div className="flex w-full">
        <InformationCircleIcon className="text-primary h-6 w-6 mr-2" />
        <h2 className="text-n3blue w-full text-left">Bonus:</h2>
      </div>
      <p className="text-white">Mint an NFT</p>
    </div>
  )
}
