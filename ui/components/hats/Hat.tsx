import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import { MediaRenderer, NFT } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import { useHatData } from '@/lib/hats/useHatData'

type HatProps = {
  selectedChain: Chain
  hatsContract: any
  hat: any
  teamImage?: boolean
  teamContract?: any
}

export function Hat({
  selectedChain,
  hatsContract,
  hat,
  teamImage,
  teamContract,
}: HatProps) {
  const router = useRouter()
  const hatData = useHatData(selectedChain, hatsContract, hat.id)

  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(hat?.teamId || 0),
  })

  return (
    <button
      className="text-left px-4 flex flex-col"
      onClick={() => {
        if (hat.teamId) {
          router.push(`/team/${hat.teamId}`)
        }
      }}
    >
      <div className="flex items-center gap-5">
        {teamNFT && (
          <div className="rounded-[2.5vmax] rounded-tl-[10px] overflow-hidden w-2/5">
            <MediaRenderer
              src={teamNFT.metadata.image}
              className="object-cover"
              width="150px"
              height="150px"
            />
          </div>
        )}
        <div>
          <p className="font-GoodTimes">{hatData.name}</p>
          <p>{hatData.description}</p>
        </div>
        <div>
          <ArrowUpRightIcon
            height={20}
            width={20}
            className="text-light-warm"
          />
        </div>
      </div>
    </button>
  )
}
