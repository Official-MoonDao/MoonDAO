import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import { useHatData } from '@/lib/hats/useHatData'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import client from '@/lib/thirdweb/client'

type HatProps = {
  selectedChain: any
  hatsContract: any
  hat: any
  teamImage?: boolean
  teamContract?: any
  compact?: boolean
  isDisabled?: boolean
}

export function Hat({
  selectedChain,
  hatsContract,
  hat,
  teamImage,
  teamContract,
  compact,
  isDisabled,
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
        if (hat.teamId && !isDisabled) {
          router.push(`/team/${hat.teamId}`)
        }
      }}
    >
      <div className="flex items-center gap-5">
        {teamNFT && (
          <div className="rounded-[2.5vmax] rounded-tl-[10px] overflow-hidden">
            <Image
              alt="Team Image"
              src={getIPFSGateway(teamNFT.metadata.image || '')}
              className="object-cover"
              width={compact ? 75 : 150}
              height={compact ? 75 : 150}
            />
          </div>
        )}
        <div>
          <p className="font-GoodTimes">
            {compact ? teamNFT?.metadata?.name : hatData.name}
          </p>
          <p>{!compact && hatData.description}</p>
        </div>
        {!compact && (
          <div>
            <ArrowUpRightIcon
              height={20}
              width={20}
              className="text-light-warm"
            />
          </div>
        )}
      </div>
    </button>
  )
}
