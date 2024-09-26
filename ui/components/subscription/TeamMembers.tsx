import { useNFT } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import ProfileCard from '../layout/ProfileCard'

type TeamMemberProps = {
  address: string
  hatIds: string[]
  citizenContract: any
  hatsContract: any
}

type TeamMembersProps = {
  hatsContract: any
  citizenConract: any
  hats: any[]
}

type Wearer = {
  address: string
  hatIds: string[]
}

function TeamMember({
  address,
  hatIds,
  citizenContract,
  hatsContract,
}: TeamMemberProps) {
  //Hats Data
  const hatNames = useHatNames(hatsContract, hatIds)

  //Citizen Data
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
        image: '/assets/citizen_image.png',
        attributes: [
          {
            trait_type: '',
            value: '',
          },
        ],
      })
    }
  }, [nft, isLoadingNft])

  return (
    <div className="w-[350px]">
      <ProfileCard
        inline
        metadata={metadata}
        owner={address}
        type="citizen"
        hovertext={metadata?.name && 'Explore Profile'}
        horizontalscroll
        subheader={
          <div className="flex flex-col h-[50px] overflow-auto">
            {hatNames?.map((hatName: any, i: number) => (
              <p key={`${address}-hat-name-${i}`}>{hatName.name}</p>
            ))}
          </div>
        }
        profile
      />
    </div>
  )
}

export default function TeamMembers({
  hatsContract,
  citizenConract,
  hats,
}: TeamMembersProps) {
  const wearers = useUniqueHatWearers(hats)
  return (
    <>
      {wearers?.[0].address &&
        wearers.map((w: Wearer, i: number) => (
          <TeamMember
            key={`${w.address}-wearer-${i}`}
            hatIds={w.hatIds}
            address={w.address}
            citizenContract={citizenConract}
            hatsContract={hatsContract}
          />
        ))}
    </>
  )
}
