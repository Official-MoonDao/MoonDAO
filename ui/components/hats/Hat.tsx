import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import Link from 'next/link'
import { useHatData } from '@/lib/hats/useHatData'

type HatProps = {
  selectedChain: Chain
  hatsContract: any
  hatId: any
}

export function Hat({ selectedChain, hatsContract, hatId }: HatProps) {
  const hatData = useHatData(selectedChain, hatsContract, hatId)

  return (
    <Link
      href={`https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${
        MOONDAO_HAT_TREE_IDS[selectedChain.slug]
      }?hatId=${hatData.prettyId}`}
      className="px-4 flex flex-col"
      target="_blank"
      rel="noreferrer"
      passHref
    >
      <div className="flex items-center gap-5">
        <div>
          <p className="font-GoodTimes">
            {hatData.name}
          </p>
          <p>
            {hatData.description}
          </p>
        </div>
        <div>
          <ArrowUpRightIcon
            height={20}
            width={20}
            className="text-light-warm"
          />
        </div>
      </div>
    </Link>
  )
}
