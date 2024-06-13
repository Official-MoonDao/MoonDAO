import { useNFT } from '@thirdweb-dev/react'
import { useState } from 'react'
import { useHatData } from '@/lib/hats/useHatData'

type TeamMemberProps = {
  address: string
  citizenContract: any
}

type TeamMembersProps = {
  selectedChain: any
  hatsContract: any
  citizenConract: any
  hatId: any
  wearers: any[]
}

function TeamMember({ address, citizenContract }: TeamMemberProps) {
  const { data: nft } = useNFT(citizenContract, 0)
  return <div></div>
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
          {wearers.map(({ id }) => (
            <></>
          ))}
        </div>
      </div>
    </div>
  )
}
