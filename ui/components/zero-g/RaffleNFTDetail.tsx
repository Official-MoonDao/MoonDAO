import { InformationCircleIcon } from '@heroicons/react/outline'
import Image from 'next/image'

export default function RaffleNFTDetail() {
  return (
    <div className="backdropBlur flex flex-col justify-center items-center gap-2 my-4">
      <div className="flex w-full">
        <InformationCircleIcon className="text-primary h-6 w-6 mr-2" />
        <h2 className="text-n3blue w-full text-left">Bonus:</h2>
      </div>
      <p className="text-white">
        The wallet address you used to enter the raffle will be whitelisted to
        mint a limited ediditon Zero-G! NFT! Minting will be open on April 12th
        after we announce the winner of the raffle. You can find the link to the
        landing page on discord or in your email inbox on the day of the
        drawing.
      </p>
      <Image
        className="rounded-[40px] blur-[5px]"
        src={'/raffle-nft-preview.png'}
        width={400}
        height={400}
        alt=""
      />
    </div>
  )
}
