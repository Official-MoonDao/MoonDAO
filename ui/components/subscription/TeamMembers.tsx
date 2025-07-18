import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import ProfileCard from '../layout/ProfileCard'

type TeamMemberProps = {
  address: string
  hatIds: string[]
  citizenContract: any
  hatsContract: any
}

type TeamMembersProps = {
  hatsContract: any
  citizenContract: any
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
  const [ownedToken, setOwnedToken] = useState<any>()
  const [nft, setNft] = useState<any>()
  const [isLoadingNFT, setIsLoadingNFT] = useState<boolean>(false)

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
    async function getOwnedNFT() {
      setIsLoadingNFT(true)
      try {
        const ownedToken = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [address],
        })
        setOwnedToken(ownedToken)

        const nft = await getNFT({
          contract: citizenContract,
          tokenId: BigInt(ownedToken.toString()),
        })

        setNft(nft)
      } catch (err) {}
      setIsLoadingNFT(false)
    }
    if (address && citizenContract) getOwnedNFT()
  }, [address, citizenContract])

  useEffect(() => {
    if (isLoadingNFT) {
      setMetadata(undefined)
    } else if (
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
  }, [nft, isLoadingNFT])

  return (
    <div className="w-[350px]">
      <ProfileCard
        inline
        metadata={{ id: metadata?.id || nft?.id, ...metadata }}
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
  citizenContract,
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
            citizenContract={citizenContract}
            hatsContract={hatsContract}
          />
        ))}
    </>
  )
}
