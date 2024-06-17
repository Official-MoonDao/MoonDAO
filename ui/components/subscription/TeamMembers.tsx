import { useNFT } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { useHatData } from '@/lib/hats/useHatData'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import EntityCitizenCard from '../directory/EntityCitizenCard'

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
  const { data: ownedToken } = useHandleRead(citizenContract, 'getOwnedToken', [
    address,
  ])

  const { data: nft, isLoading: isLoadingNft } = useNFT(
    citizenContract,
    ownedToken?.toString() || 100000000
  )

  const [metadata, setMetadata] = useState<any>({
    name: undefined,
    description: undefined,
    image: undefined,
    attributes: [
      {
        trait_type: '',
        value: '',
      },
    ],
  })

  useEffect(() => {
    if (isLoadingNft) return
    if (
      nft?.metadata &&
      nft?.metadata?.name !== 'Failed to load NFT metadata'
    ) {
      setMetadata(nft.metadata)
    } else {
      setMetadata({
        name: undefined,
        description: undefined,
        image: '/image-generator/images/citizen_image.png',
        attributes: [
          {
            trait_type: '',
            value: '',
          },
        ],
      })
    }
  }, [nft])

  return (
    <div className="p-4">
      <p className="my-2 px-4 py-2">
        <strong>{`${hatData.name}`}</strong>
      </p>
      <EntityCitizenCard metadata={metadata} owner={address} type="citizen" />
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
    <>
      {wearers.map(({ id }, i) => (
        <TeamMember
          key={`${hatData.name}-wearer-${i}`}
          hatData={hatData}
          address={id}
          citizenContract={citizenConract}
        />
      ))}
    </>
  )
}
