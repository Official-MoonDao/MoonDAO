import { useNFT } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { useHatData } from '@/lib/hats/useHatData'
import { useHandleRead } from '@/lib/thirdweb/hooks'

type TeamMemberProps = {
  address: string
  hatData: any
  citizenContract: any
}

type TeamMembersProps = {
  selectedChain: any
  hatsContract: any
  citizenConract: any
  hatId: any
  wearers: any[]
}

function TeamMember({ address, hatData, citizenContract }: TeamMemberProps) {
  return (
    <div className="bg-[#10162e]">
      <p>
        <strong>{`${hatData.name} : `}</strong>
        {`${address.slice(0, 6)}...${address.slice(-4)}`}
      </p>
    </div>
  )
}

export default function TeamMembers({
  selectedChain,
  hatsContract,
  citizenConract,
  hatId,
  wearers,
}: TeamMembersProps) {
  const hatData = useHatData(selectedChain, hatsContract, hatId)

  return (
    <div className="px-4 flex flex-col ">
      <div className="flex gap-2 justify-between">
        <div className="flex flex-col gap-2">
          {wearers.map(({ id }, i) => (
            <TeamMember
              key={`${hatData.name}-wearer-${i}`}
              hatData={hatData}
              address={id}
              citizenContract={citizenConract}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
