import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import Link from 'next/link'
import { useHatData } from '@/lib/hats/useHatData'
import { useHandleRead } from '@/lib/thirdweb/hooks'

type HatProps = {
  selectedChain: Chain
  hatsContract: any
  hatId: string
}

export function Hat({ selectedChain, hatsContract, hatId }: HatProps) {
  const hatData = useHatData(hatsContract, hatId)

  const { data: treeId } = useHandleRead(hatsContract, 'getTopHatDomain', [
    hatId,
  ])

  return (
    <Link
      href={`https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${treeId}`}
      className="px-4 flex flex-col"
      target="_blank"
      rel="noreferrer"
      passHref
    >
      <div className="flex justify-between">
        <p>
          <strong>{hatData.name}</strong>
          {' | '}
          {hatData.description.slice(0, 24)}
          ...
        </p>
        <ArrowUpRightIcon height={20} width={20} className="text-moon-orange" />
      </div>
    </Link>
  )
}
