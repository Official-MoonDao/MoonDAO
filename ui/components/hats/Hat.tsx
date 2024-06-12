import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import Link from 'next/link'
import { useEffect } from 'react'
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
      href={`https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${treeId}?hatId=${hatId}`}
      className="px-4 flex flex-col"
      target="_blank"
      rel="noreferrer"
      passHref
    >
      <div className="flex justify-between items-center gap-4">
        <p>
          <strong>{hatData.name}</strong>
          {' | '}
          {hatData.description}
        </p>
        <ArrowUpRightIcon height={20} width={20} className="text-moon-orange" />
      </div>
    </Link>
  )
}
