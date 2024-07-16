import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import { useRouter } from 'next/router'
import { useHatData } from '@/lib/hats/useHatData'

type HatProps = {
  selectedChain: Chain
  hatsContract: any
  hat: any
}

export function Hat({ selectedChain, hatsContract, hat }: HatProps) {
  const router = useRouter()
  const hatData = useHatData(selectedChain, hatsContract, hat.id)

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
