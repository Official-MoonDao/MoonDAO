import { UserIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  useAddress,
  useContract,
  ThirdwebNftMedia,
} from '@thirdweb-dev/react'
import Link from 'next/link'
import useCitizen from '@/lib/citizen/useCitizen'

type CitizenProfileLinkProps = {
  selectedChain: Chain
  citizenContract: any
}

export default function CitizenProfileLink({
  selectedChain,
  citizenContract,
}: CitizenProfileLinkProps) {
  const citizenNft = useCitizen(selectedChain)

  if (citizenNft?.metadata?.id) {
    return (
      <Link href={`/citizen/${citizenNft?.metadata?.id}`} passHref>
        <div className="rounded-full overflow-hidden">
          <ThirdwebNftMedia
            className=""
            metadata={citizenNft.metadata}
            width="40px"
            height="40px"
          />
        </div>
      </Link>
    )
  }
}
